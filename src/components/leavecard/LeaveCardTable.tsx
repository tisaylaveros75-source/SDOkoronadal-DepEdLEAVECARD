'use client';
// ============================================================
//  LeaveCardTable — renders NT or Teaching leave rows
// ============================================================
import { classifyLeave, calcDays, fmtD, fmtNum, hz } from '@/lib/api';
import type { LeaveRecord } from '@/types';

// ── NT row computation ────────────────────────────────────────
export interface NTRowResult {
  eV: number; eS: number; aV: number; aS: number;
  bV: number; bS: number; wV: number; wS: number;
}
export function computeNTRow(r: LeaveRecord, bV: number, bS: number): NTRowResult {
  const C = classifyLeave(r.action || '');
  let eV = 0, eS = 0;
  if (C.isTransfer)      { eV = r.trV || 0; eS = r.trS || 0; bV += eV; bS += eS; }
  else if (C.isAcc)      { const v = (r.earned === 0 && !(r.action||'').toLowerCase().includes('service')) ? 1.25 : r.earned; eV = v; eS = v; bV += eV; bS += eS; }
  else if (r.earned > 0) { eV = r.earned; eS = r.earned; bV += eV; bS += eS; }
  let aV = 0, aS = 0, wV = 0, wS = 0;
  const days = (!C.isAcc && !C.isTransfer && !C.isDis && !C.isForceDis && !C.isMon && !C.isMD && r.earned === 0) ? calcDays(r) : 0;
  if (C.isDis)                         { /* no change */ }
  // isForceDis: add days back to Set A W/Pay and Set A balance only (bS unchanged)
  else if (C.isForceDis)               { const d = calcDays(r); aV = d; bV += d; }
  else if (C.isMD)                     { bV += r.monDV||0; bS += r.monDS||0; aV = r.monDV||0; aS = r.monDS||0; }
  else if (C.isMon)                    { const mV=r.monV||0,mS=r.monS||0; if(bV>=mV){aV=mV;bV-=mV;}else{aV=Math.max(0,bV);wV=mV-aV;bV=0;} if(bS>=mS){aS=mS;bS-=mS;}else{aS=Math.max(0,bS);wS=mS-aS;bS=0;} }
  else if (C.isPer&&days>0)            { wV=days; }
  else if (C.isVacation&&days>0)       { if(bV>=days){aV=days;bV-=days;}else{aV=Math.max(0,bV);wV=days-aV;bV=0;} }
  else if (C.isSick&&days>0)           { if(bS>=days){aS=days;bS-=days;}else{aS=Math.max(0,bS);wS=days-aS;bS=0;} }
  else if (C.isForce&&days>0)          { if(bV>=days){aV=days;bV-=days;}else{aV=Math.max(0,bV);wV=days-aV;bV=0;} }
  else if (C.isTerminal&&days>0) { if(bV>=days){aV=days;bV-=days;}else{aV=Math.max(0,bV);wV=days-aV;bV=0;} 
  if(bS>=days){aS=days;bS-=days;}else{aS=Math.max(0,bS);wS=days-aS;bS=0;} }
  else if (C.isSetB_noDeduct&&days>0)  { aS=days; }
  else if (C.isSetA_noDeduct&&days>0)  { aV=days; }
  else if (days>0)                     { aV=days; }
  return { eV, eS, aV, aS, bV, bS, wV, wS };
}

// ── T row computation ─────────────────────────────────────────
export interface TRowResult {
  earned: number; aV: number; aS: number; bal: number; wV: number; wS: number;
  isSetBLeave: boolean;
}
export function computeTRow(r: LeaveRecord, bal: number): TRowResult {
  const C = classifyLeave(r.action || '');
  const isE = r.earned > 0;
  let aV = 0, aS = 0, wV = 0, wS = 0;
  let earned = 0;
  if (C.isTransfer)      { bal += r.trV||0; earned = r.trV||0; }
  else if (isE)          { bal += r.earned; earned = r.earned; }
  else if (C.isMD)       { bal += r.monDisAmt||0; aV = r.monDisAmt||0; }
  // isForceDis: add days back to Set A W/Pay and Set A balance only
  else if (C.isForceDis) { const d = calcDays(r); aV = d; bal += d; }
  else if (C.isMon)      { const m=r.monAmount||0; if(bal>=m){aV=m;bal-=m;}else{aV=Math.max(0,bal);wV=m-aV;bal=0;} }
  else if (C.isDis)      { /* no change */ }
  else {
    const days = calcDays(r);
    if (days > 0) {
      if (C.isSick)               { if(bal>=days){aS=days;bal-=days;}else{aS=bal;wS=days-bal;bal=0;} }
      else if (C.isForce)         { if(bal>=days){aV=days;bal-=days;}else{aV=Math.max(0,bal);wV=days-aV;bal=0;} }
      else if (C.isTerminal)      { if(bal>=days){aS=days;bal-=days;}else{aS=bal;wS=days-bal;bal=0;} }
      else if (C.isPer)           { wV=days; }
      else if (C.isVacation)      { if(bal>=days){aV=days;bal-=days;}else{aV=Math.max(0,bal);wV=days-aV;bal=0;} }
      else if (C.isSetB_noDeduct) { aS=days; }
      else                        { aV=days; }
    }
  }
  const isSetBLeave = (C.isSick||C.isSetB_noDeduct||C.isTerminal) && !isE && !C.isDis && !C.isForceDis && !C.isMon && !C.isMD;
  return { earned, aV, aS, bal, wV, wS, isSetBLeave };
}

// ── Profile block ─────────────────────────────────────────────
interface Personnel { id: string; surname: string; given: string; suffix: string; maternal: string; sex: string; civil: string; dob: string; pob: string; addr: string; spouse: string; edu: string; elig: string; rating: string; tin: string; pexam: string; dexam: string; appt: string; pos: string; school: string; status: string; [key: string]: unknown; }

export function ProfileBlock({ e }: { e: Personnel }) {
  const uc  = (v: unknown) => v ? String(v).toUpperCase() : '—';
  const dt  = (v: unknown) => v ? fmtD(String(v)) : '—';
  const fi  = (l: string, v: unknown, span?: number) => (
    <div className="pi" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{l}</label><span>{uc(v)}</span>
    </div>
  );
  const fd = (l: string, v: unknown, span?: number) => (
    <div className="pi" style={span ? { gridColumn: `span ${span}` } : {}}>
      <label>{l}</label><span>{dt(v)}</span>
    </div>
  );
  return (
    <div className="pg">
      {fi('Surname',e.surname)}{fi('Given Name',e.given)}{fi('Suffix',e.suffix)}{fi('Maternal Surname',e.maternal)}
      {fi('Sex',e.sex)}{fi('Civil Status',e.civil)}{fd('Date of Birth',e.dob)}{fi('Place of Birth',e.pob)}
      {fi('Present Address',e.addr,2)}{fi('Name of Spouse',e.spouse,2)}
      {fi('Educational Qualification',e.edu,2)}{fi('C.S. Eligibility: Kind of Exam',e.elig,2)}
      {fi('Rating',e.rating)}{fi('TIN Number',e.tin)}{fi('Place of Exam',e.pexam)}{fd('Date of Exam',e.dexam)}
      <div className="pi"><label>Employee Number</label><span><b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{e.id||'—'}</b></span></div>
      {fd('Date of Original Appointment',e.appt)}{fi('Position',e.pos)}{fi('School / Office',e.school,2)}
    </div>
  );
}

// ── Leave table header ────────────────────────────────────────
export function LeaveTableHeader({ showAction }: { showAction: boolean }) {
  return (
    <thead>
      <tr>
        <th rowSpan={2}>SO #</th>
        <th rowSpan={2} style={{ minWidth: 90 }}>Period</th>
        <th colSpan={4} className="tha">Study / Vacation / Force Personal / Special Leave</th>
        <th colSpan={4} className="thb">Sick / Maternity / Paternity Leave</th>
        <th rowSpan={2} style={{ minWidth: 120 }}>Remarks / Nature of Action</th>
        {showAction && <th rowSpan={2} className="no-print">Action</th>}
      </tr>
      <tr>
        <th className="ths">Earned</th><th className="ths">Abs W/P</th><th className="ths">Balance</th><th className="ths">W/O P</th>
        <th className="ths">Earned</th><th className="ths">Abs W/P</th><th className="ths">Balance</th><th className="ths">W/O P</th>
      </tr>
    </thead>
  );
}

// ── Balance Forwarded row ─────────────────────────────────────
// FIX: Teaching conversion has ONE balance (either SetA or SetB depending on context).
//      Non-Teaching conversion always has TWO balances (bV = SetA, bS = SetB).
//      The toStatus tells us which era is STARTING (the new era after conversion).
//      - If toStatus === 'Teaching'     → coming FROM Non-Teaching → show both bV and bS
//        (Teaching era receives both values but renders as single-balance card)
//      - If toStatus === 'Non-Teaching' → coming FROM Teaching     → show bV as BOTH
//        (Non-Teaching era receives the single Teaching balance as its starting bV AND bS)
//
// IMPORTANT: FwdRow only renders the *display* row. The actual seed values
// (bV, bS) are passed in from EraSection which reads conv.fwdBV / conv.fwdBS.
// For the display we show what's stored: bV in SetA balance, bS in SetB balance.
// When fromStatus === 'Teaching' (converting TO Non-Teaching), bV === bS (same single value).
export function FwdRow({ conv, bV, bS, status }: { conv: LeaveRecord; bV: number; bS: number; status: string }) {
  const convDate  = fmtD(conv.date || '');
  const remarks   = `Converted: ${conv.fromStatus} → ${conv.toStatus}${conv.lastAction ? ` / ${conv.lastAction}` : ''}`;

  // Determine which balances to show based on the ERA TYPE of the forwarded row.
  // `status` is the status of the era that OWNS this FwdRow (i.e. the new era).
  const isTeachingEra = status === 'Teaching';

  // For a Teaching era: show only ONE balance.
  //   - Use bV (fwdBV) which holds the last balance from the previous Non-Teaching era.
  //   - Show in SetA column; SetB column is blank.
  // For a Non-Teaching era: show TWO balances.
  //   - bV → SetA balance (vacation/force)
  //   - bS → SetB balance (sick)
  //   - When converting from Teaching, bV === bS (the single teaching balance copied to both).
const showSetA = bV;
const showSetB = bS;
  return (
    <tr className="era-fwd-row">
      <td>—</td>
      <td style={{ textAlign: 'left', paddingLeft: 5, lineHeight: 1.5 }}>
        <span style={{ fontStyle: 'italic', fontWeight: 700 }}>Balance Forwarded</span>
        <br /><span style={{ fontSize: 9, color: 'var(--au)', fontWeight: 600 }}>({convDate})</span>
      </td>
      {/* SetA columns */}
      <td className="nc"/>
      <td className="nc"/>
      <td className="bc" style={{ color: 'var(--au)', fontWeight: 700 }}>{fmtNum(showSetA)}</td>
      <td className="nc"/>
      {/* SetB columns */}
      <td className="nc"/>
      <td className="nc"/>
      <td className="bc" style={{ color: 'var(--au)', fontWeight: 700 }}>
  {fmtNum(showSetB)}
</td>
      <td className="nc"/>
      <td style={{ fontStyle: 'italic', fontSize: 10, color: 'var(--au)', textAlign: 'left', paddingLeft: 5 }}>{remarks}</td>
    </tr>
  );
}
