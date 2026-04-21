// ============================================================
//  lib/api.ts — API helper + leave logic utilities
// ============================================================

import type { ApiResponse, LeaveRecord, LeaveClassification, RowBalanceUpdate } from '@/types';

const API_BASE = '/api';
const API_TIMEOUT_MS = 10000; // 10 seconds — prevents infinite hangs

export async function apiCall<T = Record<string, unknown>>(
  action: string,
  body: object = {},
  method: 'GET' | 'POST' = 'POST'
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    let url = `${API_BASE}/${action}`;
    const opts: RequestInit = {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    };
    if (method === 'GET') {
      const params = new URLSearchParams(body as Record<string, string>);
      url += `?${params}`;
      opts.method = 'GET';
    } else {
      opts.method = 'POST';
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    return await r.json();
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') {
      console.error(`API timeout: ${action} took longer than ${API_TIMEOUT_MS / 1000}s`);
      return { ok: false, error: 'Request timed out. Please check your connection and try again.' };
    }
    console.error('API error', e);
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Leave Classification ─────────────────────────────────────
// isTransfer matches both new "credit entry" and old "from denr" for backward compatibility
export function classifyLeave(act: string): LeaveClassification {
  const a = act.toLowerCase();
  const isForceDis = (a.includes('force') || a.includes('mandatory')) && a.includes('disapproved');
  return {
    isAcc:       a.includes('accrual') || a.includes('service credit'),
    isMon:       a.includes('monetization') && !a.includes('disapproved'),
    isMD:        a.includes('monetization') && a.includes('disapproved'),
    isForceDis:  isForceDis,
    isDis:       a.includes('(disapproved)') && !(a.includes('monetization') && a.includes('disapproved')) && !isForceDis,
    isSick:      a.includes('sick'),
    isForce:     (a.includes('force') || a.includes('mandatory')) && !a.includes('disapproved'),
    isPer:       a.includes('personal'),
    // Matches "Credit Entry" (new) and "From DENR Region 12" (old records)
    isTransfer:  a.includes('credit entry') || a.includes('from denr'),
    isTerminal:  a.includes('terminal'),
    isSetB_noDeduct: a.includes('maternity') || a.includes('paternity'),
    isSetA_noDeduct: a.includes('solo parent') || a.includes('wellness') ||
                     a.includes('special privilege') || a.includes('spl') ||
                     a.includes('rehabilitation') || a.includes('study') ||
                     a.includes('magna carta') || a.includes('vawc') ||
                     a.includes('cto') || a.includes('compensatory'),
    isVacation:  a.includes('vacation') && !a.includes('(disapproved)'),
  };
}

// ── Calculate weekday count between from/to ──────────────────
// Supports fromPeriod / toPeriod:
//   'AM' or 'PM' on the same date           → 0.5 days
//   'AM' or 'PM' on the start date          → subtract 0.5 from total
//   'AM' or 'PM' on the end date            → subtract 0.5 from total
//   'WD' (Whole Day) or undefined           → full day (no deduction)
export function calcDays(r: LeaveRecord): number {
  const a = (r.action || '').toLowerCase();
  const isForceAction = (a.includes('force') || a.includes('mandatory')) && !a.includes('disapproved');
  const isForceDis    = (a.includes('force') || a.includes('mandatory')) &&  a.includes('disapproved');

  if ((isForceAction || isForceDis) && r.forceAmount > 0) return r.forceAmount;

  if (r.from && r.to) {
    const startHalf = r.fromPeriod === 'AM' || r.fromPeriod === 'PM';
    const endHalf   = r.toPeriod   === 'AM' || r.toPeriod   === 'PM';

    // Same date + half-day period selected → 0.5 days (if it's a weekday)
    if (r.from === r.to && startHalf) {
      const d   = new Date(r.from + 'T00:00:00');
      const day = d.getDay();
      return (day !== 0 && day !== 6) ? 0.5 : 0;
    }

    // Count full weekdays in range
    let count = 0;
    const start = new Date(r.from + 'T00:00:00');
    const end   = new Date(r.to   + 'T00:00:00');
    if (end < start) return 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
    }

    // Deduct 0.5 for each half-day endpoint
    if (startHalf) count -= 0.5;
    if (endHalf)   count -= 0.5;
    if (count < 0) count = 0;

    return count;
  }
  return 0;
}

// ── Date formatters ──────────────────────────────────────────
export function fmtD(ds: string): string {
  if (!ds) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(ds)) return ds;
  const d = new Date(ds + (ds.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(d.getTime())) return ds;
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

export function toISODate(mmddyyyy: string): string {
  if (!mmddyyyy) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(mmddyyyy)) return mmddyyyy;
  const parts = mmddyyyy.split('/');
  if (parts.length !== 3) return mmddyyyy;
  const [mm, dd, yyyy] = parts;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export function fmtNum(n: number): string {
  return parseFloat((n || 0).toFixed(10)).toString();
}

export function hz(n: number): string {
  return (!n || n === 0) ? '' : fmtNum(n);
}

// ── Auto-format date as user types ───────────────────────────
export function fmtDateInput(v: string): string {
  let digits = v.replace(/\D/g, '');
  if (digits.length > 8) digits = digits.slice(0, 8);
  if (digits.length >= 5) return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
  if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
  return digits;
}

// ── Sort key for records ─────────────────────────────────────
export function recordSortKey(r: LeaveRecord): string | null {
  if (r._conversion) return null;
  let d = r.from || r.to || '';
  if (d) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const parts = d.split('/');
    if (parts.length === 3 && parts[2].length === 4)
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  const prd = (r.prd || '').trim();
  if (prd) {
    if (/^\d{4}$/.test(prd)) return `${prd}-01-01`;
    const yearMatch = prd.match(/\b(19\d{2}|20\d{2})\b/g);
    const year = yearMatch ? yearMatch[yearMatch.length - 1] : null;
    if (year) {
      const monthMatch = prd.match(/(?:^|[,\s])(\d{1,2})[\/\-]/);
      const month = monthMatch ? monthMatch[1].padStart(2, '0') : '01';
      const dayMatch = prd.match(/(?:^|[,\s])\d{1,2}[\/\-](\d{1,2})/);
      const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

export function sortRecordsByDate(records: LeaveRecord[]): void {
  const convIdxs: number[] = [];
  records.forEach((r, i) => { if (r._conversion) convIdxs.push(i); });
  const segStarts = [0, ...convIdxs.map(i => i + 1)];
  const segEnds   = [...convIdxs, records.length];

  segStarts.forEach((start, si) => {
    const end = segEnds[si];
    const datedPositions: number[] = [];
    for (let i = start; i < end; i++) {
      if (recordSortKey(records[i]) !== null) datedPositions.push(i);
    }
    if (datedPositions.length < 2) return;
    const datedRecs = datedPositions.map(i => records[i]);
    datedRecs.sort((a, b) => recordSortKey(a)!.localeCompare(recordSortKey(b)!));
    datedPositions.forEach((pos, i) => { records[pos] = datedRecs[i]; });
  });
}

export function isEmptyRecord(r: LeaveRecord): boolean {
  if (r._conversion) return false;
  return !r.action && !r.so && !r.prd && !r.from && !r.to && !r.spec
    && !(r.earned > 0) && !(r.forceAmount > 0) && !(r.monAmount > 0) && !(r.monDisAmt > 0)
    && !(r.monV > 0) && !(r.monS > 0);
}

// ── Compute row balance updates ──────────────────────────────
export function computeRowBalanceUpdates(
  records: LeaveRecord[],
  empId: string,
  empStatus: 'Teaching' | 'Non-Teaching'
): RowBalanceUpdate[] {
  interface EraSegment {
    eraStatus: 'Teaching' | 'Non-Teaching';
    conv: LeaveRecord | null;
    recs: LeaveRecord[];
  }

  const segments: EraSegment[] = [];
  let currentStatus: 'Teaching' | 'Non-Teaching' = empStatus;

  const firstConv = records.find(r => r._conversion);
  if (firstConv) {
    currentStatus = (firstConv.fromStatus ?? empStatus) as 'Teaching' | 'Non-Teaching';
  }

  let currentSeg: EraSegment = { eraStatus: currentStatus, conv: null, recs: [] };

  for (const r of records) {
    if (!r) continue;
    if (r._conversion) {
      segments.push(currentSeg);
      const newStatus = (r.toStatus ?? empStatus) as 'Teaching' | 'Non-Teaching';
      currentSeg = { eraStatus: newStatus, conv: r, recs: [] };
    } else {
      currentSeg.recs.push(r);
    }
  }
  segments.push(currentSeg);

  const updates: RowBalanceUpdate[] = [];

  for (const seg of segments) {
    if (seg.eraStatus === 'Teaching') {
      let bal = 0;
      for (const r of seg.recs) {
        if (!r._record_id) continue;
        const C = classifyLeave(r.action || '');
        let rowAEarned = 0, rowAAbsWP = 0, rowAWOP = 0;
        let rowBEarned = 0, rowBAbsWP = 0, rowBWOP = 0;

        if (C.isTransfer)                             { rowAEarned = r.trV || 0; bal += rowAEarned; }
        else if (r.earned > 0 && !C.isMon && !C.isPer) { rowAEarned = r.earned; bal += rowAEarned; }
        else if (C.isMD)                              { bal += r.monDisAmt || 0; rowAAbsWP = r.monDisAmt || 0; }
        else if (C.isForceDis)                        { const d = calcDays(r); rowAAbsWP = d; bal += d; }
        else if (C.isMon)                             { const m = r.monAmount || 0; if (bal >= m) { rowAAbsWP = m; bal -= m; } else { rowAAbsWP = bal; rowAWOP = m - bal; bal = 0; } }
        else if (!C.isDis) {
          const days = calcDays(r);
          if (days > 0) {
            if (C.isSick)               { if (bal >= days) { rowBAbsWP = days; bal -= days; } else { rowBAbsWP = bal; rowBWOP = days - bal; bal = 0; } }
            else if (C.isPer)           { rowAWOP = days; }
            else if (C.isVacation)      { if (bal >= days) { rowAAbsWP = days; bal -= days; } else { rowAAbsWP = bal; rowAWOP = days - bal; bal = 0; } }
            else if (C.isForce)         { if (bal >= days) { rowAAbsWP = days; bal -= days; } else { rowAAbsWP = bal; rowAWOP = days - bal; bal = 0; } }
            else if (C.isTerminal)      { if (bal >= days) { rowBAbsWP = days; bal -= days; } else { rowBAbsWP = bal; rowBWOP = days - bal; bal = 0; } }
            else if (C.isSetB_noDeduct) { rowBAbsWP = days; }
            else                        { rowAAbsWP = days; }
          }
        }

        const isE = r.earned > 0;
        const showBalInSetB = (C.isSick || C.isSetB_noDeduct || C.isTerminal) && !isE && !C.isDis && !C.isForceDis && !C.isMon && !C.isMD;

        updates.push({
          record_id:    r._record_id,
          employee_id:  empId,
          setA_earned:  +rowAEarned.toFixed(3),
          setA_abs_wp:  +rowAAbsWP.toFixed(3),
          setA_balance: showBalInSetB ? 0 : +bal.toFixed(3),
          setA_wop:     +rowAWOP.toFixed(3),
          setB_earned:  0,
          setB_abs_wp:  +rowBAbsWP.toFixed(3),
          setB_balance: showBalInSetB ? +bal.toFixed(3) : 0,
          setB_wop:     +rowBWOP.toFixed(3),
        });
      }
    } else {
      let bV = 0;
      let bS = 0;

      for (const r of seg.recs) {
        if (!r._record_id) continue;
        const C = classifyLeave(r.action || '');
        let rowAEarned = 0, rowAAbsWP = 0, rowAWOP = 0;
        let rowBEarned = 0, rowBAbsWP = 0, rowBWOP = 0;

        if (C.isTransfer)      { rowAEarned = r.trV || 0; rowBEarned = r.trS || 0; bV += rowAEarned; bS += rowBEarned; }
        else if (C.isAcc)      { const v = (r.earned === 0 && !(r.action || '').toLowerCase().includes('service')) ? 1.25 : r.earned; rowAEarned = v; rowBEarned = v; bV += v; bS += v; }
        else if (r.earned > 0) { rowAEarned = r.earned; rowBEarned = r.earned; bV += r.earned; bS += r.earned; }
        else if (C.isMD)       { bV += r.monDV || 0; bS += r.monDS || 0; rowAAbsWP = r.monDV || 0; rowBAbsWP = r.monDS || 0; }
        else if (C.isForceDis) { const d = calcDays(r); rowAAbsWP = d; bV += d; }
        else if (C.isMon)      { const mV = r.monV || 0, mS = r.monS || 0; if (bV >= mV) { rowAAbsWP = mV; bV -= mV; } else { rowAAbsWP = bV; rowAWOP = mV - bV; bV = 0; } if (bS >= mS) { rowBAbsWP = mS; bS -= mS; } else { rowBAbsWP = bS; rowBWOP = mS - bS; bS = 0; } }
        else if (C.isDis)      { /* no change */ }
        else if (C.isPer)           { const d = calcDays(r); if (d > 0) rowAWOP = d; }
        else if (C.isVacation)      { const d = calcDays(r); if (d > 0) { if (bV >= d) { rowAAbsWP = d; bV -= d; } else { rowAAbsWP = bV; rowAWOP = d - bV; bV = 0; } } }
        else if (C.isSick)          { const d = calcDays(r); if (d > 0) { if (bS >= d) { rowBAbsWP = d; bS -= d; } else { rowBAbsWP = bS; rowBWOP = d - bS; bS = 0; } } }
        else if (C.isForce)         { const d = calcDays(r); if (d > 0) { if (bV >= d) { rowAAbsWP = d; bV -= d; } else { rowAAbsWP = bV; rowAWOP = d - bV; bV = 0; } } }
        else if (C.isTerminal)      { const d = calcDays(r); if (d > 0) { if (bV >= d) { rowAAbsWP = d; bV -= d; } else { rowAAbsWP = bV; rowAWOP = d - bV; bV = 0; } if (bS >= d) { rowBAbsWP = d; bS -= d; } else { rowBAbsWP = bS; rowBWOP = d - bS; bS = 0; } } }
        else if (C.isSetB_noDeduct) { const d = calcDays(r); if (d > 0) rowBAbsWP = d; }
        else if (C.isSetA_noDeduct) { const d = calcDays(r); if (d > 0) rowAAbsWP = d; }
        else                        { const d = calcDays(r); if (d > 0) { rowAAbsWP = d; } }

        updates.push({
          record_id:    r._record_id,
          employee_id:  empId,
          setA_earned:  +rowAEarned.toFixed(3),
          setA_abs_wp:  +rowAAbsWP.toFixed(3),
          setA_balance: +bV.toFixed(3),
          setA_wop:     +rowAWOP.toFixed(3),
          setB_earned:  +rowBEarned.toFixed(3),
          setB_abs_wp:  +rowBAbsWP.toFixed(3),
          setB_balance: +bS.toFixed(3),
          setB_wop:     +rowBWOP.toFixed(3),
        });
      }
    }
  }

  return updates;
}

// ── Leave validation ─────────────────────────────────────────
export function getRecordYear(r: LeaveRecord): number | null {
  const d = r.from || r.to || '';
  if (!d) return null;
  return new Date(d + 'T00:00:00').getFullYear();
}

export function validateLeaveEntry(
  empRecords: LeaveRecord[],
  newRec: LeaveRecord,
  editIdx: number,
  empStatus: string
): string | null {
  const al  = (newRec.action || '').toLowerCase();
  const year = getRecordYear(newRec);
  if (!year) return null;

  const existing = empRecords.filter((r, i) => {
    if (r._conversion) return false;
    if (editIdx >= 0 && i === editIdx) return false;
    return true;
  });

  const isForce = (al.includes('force') || al.includes('mandatory')) && !al.includes('disapproved');
  if (isForce) {
    const forceDays = newRec.forceAmount > 0 ? newRec.forceAmount : calcDays(newRec);
    if (forceDays > 5) return `⚠️ Force/Mandatory Leave cannot exceed 5 days per year. You entered ${forceDays} day(s).`;
    const existingForce = existing.filter(r => {
      const ra = (r.action || '').toLowerCase();
      return (ra.includes('force') || ra.includes('mandatory')) && !ra.includes('disapproved') && getRecordYear(r) === year;
    });
    if (existingForce.length > 0) return `⚠️ Force/Mandatory Leave is only allowed ONCE per year (${year}). A Force Leave entry already exists.`;
  }

  if (al.includes('magna carta') || al.includes('special leave benefit')) {
    const newDays = calcDays(newRec);
    const existingDays = existing
      .filter(r => { const ra = (r.action || '').toLowerCase(); return (ra.includes('magna carta') || ra.includes('special leave benefit')) && getRecordYear(r) === year; })
      .reduce((sum, r) => sum + calcDays(r), 0);
    const total = existingDays + newDays;
    if (total > 60) return `⚠️ Special Leave Benefits for Women (Magna Carta) cannot exceed 60 days per year. Total: ${total} day(s).`;
  }

  if (newRec.earned > 0 && empStatus === 'Non-Teaching') {
    const existingEarned = existing.filter(r => r.earned > 0 && getRecordYear(r) === year).reduce((s, r) => s + r.earned, 0);
    const totalEarned = existingEarned + newRec.earned;
    if (totalEarned > 15) return `⚠️ Non-Teaching leave accrual cannot exceed 15 days per year. Total: ${totalEarned.toFixed(3)} days.`;
  }
  return null;
}

// ── NT Accrual key ───────────────────────────────────────────
export function getNTAccrualKey(): string {
  const now = new Date();
  return `nt_accrual_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getNTAccrualMonthLabel(): string {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// ── Employee ID validation ───────────────────────────────────
export function validateEmployeeId(id: string): string | null {
  if (!/^\d{7}$/.test(id)) return 'Invalid Employee No. — must be exactly 7 numbers.';
  return null;
}

export function validateDepedEmail(email: string): string | null {
  if (!email) return 'Email address is required.';
  if (!email.endsWith('@deped.gov.ph')) return 'Email must use @deped.gov.ph domain.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format.';
  return null;
}
// ── Mandatory Leave key (once per year) ──────────────────────
export function getMandatoryLeaveKey(): string {
  return `mandatory_leave_${new Date().getFullYear()}`;
}
