'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import {
  apiCall, getNTAccrualKey, getMandatoryLeaveKey,
  computeRowBalanceUpdates, sortRecordsByDate, classifyLeave, getRecordYear,
  calcDays, fmtD, fmtNum,
} from '@/lib/api';
import type { LeaveRecord, Personnel } from '@/types';

interface Props { onOpenCard?: (id: string) => void; }

const now        = new Date();
const THIS_YEAR  = now.getFullYear();
const THIS_MONTH = now.getMonth();

// ── Leave card computation helpers (inline, no import) ────────────────────────
function hasAccrualThisMonth(records: LeaveRecord[]): boolean {
  return (records ?? []).some(r => {
    if (r._conversion) return false;
    const action = (r.action ?? '').toLowerCase();
    if (!action.includes('accrual') && !action.includes('service credit')) return false;
    const dateStr = r.from || r.to || r.prd || '';
    if (!dateStr) return false;
    const d = parseDateForCheck(dateStr);
    return !!d && d.getFullYear() === THIS_YEAR && d.getMonth() === THIS_MONTH;
  });
}

function hasMandatoryThisYear(records: LeaveRecord[]): boolean {
  return (records ?? []).some(r => {
    if (r._conversion) return false;
    const C = classifyLeave(r.action || '');
    return C.isForce && getRecordYear(r) === THIS_YEAR;
  });
}

function parseDateForCheck(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return new Date(dateStr + 'T00:00:00');
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [mm, , yyyy] = dateStr.split('/');
    return new Date(`${yyyy}-${mm.padStart(2, '0')}-01T00:00:00`);
  }
  const yearMatch  = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
  const monthNames = ['january','february','march','april','may','june',
    'july','august','september','october','november','december'];
  const lower    = dateStr.toLowerCase();
  const monthIdx = monthNames.findIndex(m => lower.includes(m));
  if (yearMatch && monthIdx !== -1) return new Date(parseInt(yearMatch[1]), monthIdx, 1);
  return null;
}

// ── NT row computation ─────────────────────────────────────────────────────────
function computeNTRow(r: LeaveRecord, bV: number, bS: number) {
  const C = classifyLeave(r.action || '');
  let eV = 0, eS = 0;
  if (C.isTransfer)      { eV = r.trV || 0; eS = r.trS || 0; bV += eV; bS += eS; }
  else if (C.isAcc)      { const v = (r.earned === 0 && !(r.action||'').toLowerCase().includes('service')) ? 1.25 : r.earned; eV = v; eS = v; bV += eV; bS += eS; }
  else if (r.earned > 0) { eV = r.earned; eS = r.earned; bV += eV; bS += eS; }
  let aV = 0, aS = 0, wV = 0, wS = 0;
  const days = (!C.isAcc && !C.isTransfer && !C.isDis && !C.isForceDis && !C.isMon && !C.isMD && r.earned === 0) ? calcDays(r) : 0;
  if      (C.isDis)                         { /* no-op */ }
  else if (C.isForceDis)                    { const d = calcDays(r); aV = d; bV += d; }
  else if (C.isMD)                          { bV += r.monDV||0; bS += r.monDS||0; aV = r.monDV||0; aS = r.monDS||0; }
  else if (C.isMon)                         { const mV=r.monV||0,mS=r.monS||0; if(bV>=mV){aV=mV;bV-=mV;}else{aV=Math.max(0,bV);wV=mV-aV;bV=0;} if(bS>=mS){aS=mS;bS-=mS;}else{aS=Math.max(0,bS);wS=mS-aS;bS=0;} }
  else if (C.isPer&&days>0)                 { wV=days; }
  else if (C.isVacation&&days>0)            { if(bV>=days){aV=days;bV-=days;}else{aV=Math.max(0,bV);wV=days-aV;bV=0;} }
  else if (C.isSick&&days>0)               { if(bS>=days){aS=days;bS-=days;}else{aS=Math.max(0,bS);wS=days-aS;bS=0;} }
  else if (C.isForce&&days>0)              { if(bV>=days){aV=days;bV-=days;}else{aV=Math.max(0,bV);wV=days-aV;bV=0;} }
  else if (C.isTerminal&&days>0)           { if(bV>=days){aV=days;bV-=days;}else{aV=Math.max(0,bV);wV=days-aV;bV=0;} if(bS>=days){aS=days;bS-=days;}else{aS=Math.max(0,bS);wS=days-aS;bS=0;} }
  else if (C.isSetB_noDeduct&&days>0)      { aS=days; }
  else if (C.isSetA_noDeduct&&days>0)      { aV=days; }
  else if (days>0)                          { aV=days; }
  return { eV, eS, aV, aS, bV, bS, wV, wS };
}

// ── T row computation ──────────────────────────────────────────────────────────
function computeTRow(r: LeaveRecord, bal: number) {
  const C = classifyLeave(r.action || '');
  const isE = r.earned > 0;
  let aV = 0, aS = 0, wV = 0, wS = 0, earned = 0;
  if      (C.isTransfer)  { bal += r.trV||0; earned = r.trV||0; }
  else if (isE)           { bal += r.earned; earned = r.earned; }
  else if (C.isMD)        { bal += r.monDisAmt||0; aV = r.monDisAmt||0; }
  else if (C.isForceDis)  { const d = calcDays(r); aV = d; bal += d; }
  else if (C.isMon)       { const m=r.monAmount||0; if(bal>=m){aV=m;bal-=m;}else{aV=Math.max(0,bal);wV=m-aV;bal=0;} }
  else if (C.isDis)       { /* no-op */ }
  else {
    const days = calcDays(r);
    if (days > 0) {
      if      (C.isSick)               { if(bal>=days){aS=days;bal-=days;}else{aS=bal;wS=days-bal;bal=0;} }
      else if (C.isForce)              { if(bal>=days){aV=days;bal-=days;}else{aV=Math.max(0,bal);wV=days-aV;bal=0;} }
      else if (C.isTerminal)           { if(bal>=days){aS=days;bal-=days;}else{aS=bal;wS=days-bal;bal=0;} }
      else if (C.isPer)                { wV=days; }
      else if (C.isVacation)           { if(bal>=days){aV=days;bal-=days;}else{aV=Math.max(0,bal);wV=days-aV;bal=0;} }
      else if (C.isSetB_noDeduct)      { aS=days; }
      else                             { aV=days; }
    }
  }
  return { earned, aV, aS, bal, wV, wS };
}

// ── HTML leave card generator ──────────────────────────────────────────────────
function buildLeaveCardHTML(e: Personnel, standalone = false): string {
  const isTeaching = (e.status ?? '').toLowerCase() === 'teaching';
  const records    = (e.records ?? []).filter(r => !r._conversion);
  const uc = (v: unknown) => v ? String(v).toUpperCase() : '—';
  const dt = (v: unknown) => v ? fmtD(String(v)) : '—';
  const printDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

  // ── Profile rows ──
  const profileHTML = `
    <div class="pg">
      <div class="pi"><label>Surname</label><span>${uc(e.surname)}</span></div>
      <div class="pi"><label>Given Name</label><span>${uc(e.given)}</span></div>
      <div class="pi"><label>Suffix</label><span>${uc(e.suffix)}</span></div>
      <div class="pi"><label>Maternal Surname</label><span>${uc(e.maternal)}</span></div>
      <div class="pi"><label>Sex</label><span>${uc(e.sex)}</span></div>
      <div class="pi"><label>Civil Status</label><span>${uc(e.civil)}</span></div>
      <div class="pi"><label>Date of Birth</label><span>${dt(e.dob)}</span></div>
      <div class="pi"><label>Place of Birth</label><span>${uc(e.pob)}</span></div>
      <div class="pi span2"><label>Present Address</label><span>${uc(e.addr)}</span></div>
      <div class="pi span2"><label>Name of Spouse</label><span>${uc(e.spouse)}</span></div>
      <div class="pi span2"><label>Educational Qualification</label><span>${uc(e.edu)}</span></div>
      <div class="pi span2"><label>C.S. Eligibility: Kind of Exam</label><span>${uc(e.elig)}</span></div>
      <div class="pi"><label>Rating</label><span>${uc(e.rating)}</span></div>
      <div class="pi"><label>TIN Number</label><span>${uc(e.tin)}</span></div>
      <div class="pi"><label>Place of Exam</label><span>${uc(e.pexam)}</span></div>
      <div class="pi"><label>Date of Exam</label><span>${dt(e.dexam)}</span></div>
      <div class="pi"><label>Employee Number</label><span style="font-family:monospace;font-weight:700">${e.id||'—'}</span></div>
      <div class="pi"><label>Date of Original Appointment</label><span>${dt(e.appt)}</span></div>
      <div class="pi"><label>Position</label><span>${uc(e.pos)}</span></div>
      <div class="pi span2"><label>School / Office</label><span>${uc(e.school)}</span></div>
    </div>`;

  // ── Table rows ──
  let tableRows = '';
  if (isTeaching) {
    let bal = 0;
    for (const r of records) {
      const row = computeTRow(r, bal);
      bal = row.bal;
      const per = r.fromPeriod || r.toPeriod ? ` (${r.fromPeriod ?? ''}–${r.toPeriod ?? ''})` : '';
      tableRows += `
        <tr>
          <td>${r.so||''}</td>
          <td>${r.prd||''}</td>
          <td class="nc">${row.earned > 0 ? fmtNum(row.earned) : ''}</td>
          <td class="nc">${row.aV > 0    ? fmtNum(row.aV)     : ''}</td>
          <td class="bc">${fmtNum(bal)}</td>
          <td class="nc">${row.wV > 0    ? fmtNum(row.wV)     : ''}</td>
          <td class="nc">${''}</td>
          <td class="nc">${row.aS > 0    ? fmtNum(row.aS)     : ''}</td>
          <td class="bc">${fmtNum(bal)}</td>
          <td class="nc">${row.wS > 0    ? fmtNum(row.wS)     : ''}</td>
          <td>${r.action||''}${per}</td>
        </tr>`;
    }
  } else {
    let bV = 0, bS = 0;
    for (const r of records) {
      const row = computeNTRow(r, bV, bS);
      bV = row.bV; bS = row.bS;
      const per = r.fromPeriod || r.toPeriod ? ` (${r.fromPeriod ?? ''}–${r.toPeriod ?? ''})` : '';
      tableRows += `
        <tr>
          <td>${r.so||''}</td>
          <td>${r.prd||''}</td>
          <td class="nc">${row.eV > 0 ? fmtNum(row.eV) : ''}</td>
          <td class="nc">${row.aV > 0 ? fmtNum(row.aV) : ''}</td>
          <td class="bc">${fmtNum(bV)}</td>
          <td class="nc">${row.wV > 0 ? fmtNum(row.wV) : ''}</td>
          <td class="nc">${row.eS > 0 ? fmtNum(row.eS) : ''}</td>
          <td class="nc">${row.aS > 0 ? fmtNum(row.aS) : ''}</td>
          <td class="bc">${fmtNum(bS)}</td>
          <td class="nc">${row.wS > 0 ? fmtNum(row.wS) : ''}</td>
          <td>${r.action||''}${per}</td>
        </tr>`;
    }
  }
  if (!tableRows) {
    tableRows = `<tr><td colspan="11" style="text-align:center;color:#999;font-style:italic;padding:12px">No leave records on file.</td></tr>`;
  }

  const cardType = isTeaching ? 'Teaching Leave Card' : 'Non-Teaching Leave Card';
  const fullName = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;

  const css = `
    @page { size: A4 landscape; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #111; margin:0; }
    .card-wrapper { margin-bottom: 28px; page-break-after: always; }
    .card-wrapper:last-child { page-break-after: auto; }

    /* Card header */
    .card-header { text-align:center; margin-bottom:8px; padding-bottom:6px; border-bottom:2px solid #1a5c42; }
    .card-header .org { font-size:7pt; color:#555; text-transform:uppercase; letter-spacing:.4px; }
    .card-header h2 { font-size:13pt; font-weight:800; margin:3px 0 1px; color:#1a2e1a; }
    .card-header .sub { font-size:8pt; color:#444; }
    .card-header .emp-name { font-size:11pt; font-weight:800; color:#1a3a6b; margin-top:4px; }
    .card-header .print-date { font-size:7pt; color:#999; margin-top:2px; }

    /* Profile grid */
    .pg { display:grid; grid-template-columns:repeat(4,1fr); gap:4px 8px; margin-bottom:10px; }
    .pi { border-bottom:1px solid #e5e7eb; padding:3px 2px; }
    .pi label { display:block; font-size:6.5pt; text-transform:uppercase; letter-spacing:.3px; color:#888; margin-bottom:1px; }
    .pi span  { font-size:8pt; font-weight:600; }
    .span2 { grid-column: span 2; }

    /* Leave table */
    table { width:100%; border-collapse:collapse; font-size:7.5pt; }
    thead th { background:#1a5c42; color:#fff; padding:4px 5px; text-align:center; font-size:7pt; border:1px solid #134a34; }
    thead th.tha { background:#1a3a6b; }
    thead th.thb { background:#7f1d1d; }
    tbody td { padding:3px 5px; border:1px solid #e5e7eb; text-align:center; vertical-align:middle; }
    tbody td:first-child, tbody td:nth-child(2), tbody td:last-child { text-align:left; }
    tbody tr:nth-child(even) { background:#f7faf7; }
    .nc { color:#374151; }
    .bc { font-weight:700; color:#1a5c42; background:#f0fdf4; }

    @media print {
      .no-print { display:none !important; }
    }`;

  const body = `
    <div class="card-wrapper">
      <div class="card-header">
        <div class="org">Republic of the Philippines • Department of Education • SDO City of Koronadal</div>
        <h2>${cardType}</h2>
        <div class="sub">Leave Management System — Official Record</div>
        <div class="emp-name">${fullName}</div>
        <div class="print-date">Printed: ${printDate}</div>
      </div>

      ${profileHTML}

      <table>
        <thead>
          <tr>
            <th rowspan="2">SO #</th>
            <th rowspan="2" style="min-width:80px">Period</th>
            <th colspan="4" class="tha">Study / Vacation / Force / Special Leave</th>
            <th colspan="4" class="thb">Sick / Maternity / Paternity Leave</th>
            <th rowspan="2" style="min-width:110px">Remarks / Nature of Action</th>
          </tr>
          <tr>
            <th>Earned</th><th>Abs W/P</th><th>Balance</th><th>W/O P</th>
            <th>Earned</th><th>Abs W/P</th><th>Balance</th><th>W/O P</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  if (standalone) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${cardType} — ${fullName}</title>
  <style>${css}</style>
</head>
<body>${body}</body>
</html>`;
  }
  return body;
}

// ── Confirmation Modal ─────────────────────────────────────────────────────────
interface ConfirmModalProps {
  open: boolean; title: string; message: string;
  confirmLabel: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void;
}
function ConfirmModal({ open, title, message, confirmLabel, confirmColor = '#1a5c42', onConfirm, onCancel }: ConfirmModalProps) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--cd,#fff)', borderRadius:14, padding:'28px 28px 22px', maxWidth:440, width:'92%', boxShadow:'0 8px 40px rgba(0,0,0,0.18)', fontFamily:'Inter,sans-serif' }}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--cha,#111)', marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:13, color:'var(--mu,#555)', lineHeight:1.7, marginBottom:22, whiteSpace:'pre-line' }}>{message}</div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onCancel} style={{ padding:'9px 20px', borderRadius:8, border:'1.5px solid var(--br,#ddd)', background:'transparent', fontSize:13, fontWeight:600, cursor:'pointer', color:'var(--mu,#555)' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding:'9px 22px', borderRadius:8, border:'none', background:confirmColor, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// ── Download progress modal ────────────────────────────────────────────────────
interface DownloadProgressProps {
  open: boolean;
  current: number;
  total: number;
  name: string;
  onCancel: () => void;
}
function DownloadProgress({ open, current, total, name, onCancel }: DownloadProgressProps) {
  if (!open) return null;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'var(--cd,#fff)', borderRadius:14, padding:'28px 32px', maxWidth:420, width:'92%', boxShadow:'0 8px 40px rgba(0,0,0,0.2)', fontFamily:'Inter,sans-serif' }}>
        <div style={{ fontSize:16, fontWeight:800, color:'var(--cha,#111)', marginBottom:6 }}>
          ⬇ Downloading Leave Cards
        </div>
        <div style={{ fontSize:12, color:'var(--mu,#666)', marginBottom:14 }}>
          {current} of {total} — <em>{name}</em>
        </div>
        {/* Progress bar */}
        <div style={{ height:8, background:'var(--g4,#f3f4f6)', borderRadius:8, overflow:'hidden', marginBottom:14 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#1a5c42,#2e7d52)', borderRadius:8, transition:'width .2s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--mu)' }}>{pct}%</span>
          <button onClick={onCancel} style={{ padding:'7px 16px', borderRadius:8, border:'1.5px solid var(--br,#ddd)', background:'transparent', fontSize:12, fontWeight:600, cursor:'pointer', color:'#9b1c1c' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

interface PaginationProps {
  page: number; total: number; pageSize: number; onChange: (p: number) => void;
}
function Pagination({ page, total, pageSize, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    padding:'4px 10px', borderRadius:6,
    border:'1.5px solid var(--br)', background:'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize:13, color:'var(--cha)', lineHeight:1,
  });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--mu)', userSelect:'none' }}>
      <span>Page {page} of {totalPages}</span>
      <button style={btnStyle(page <= 1)}         onClick={() => onChange(page - 1)} disabled={page <= 1}>‹</button>
      <button style={btnStyle(page >= totalPages)} onClick={() => onChange(totalPages)} disabled={page >= totalPages}>»</button>
    </div>
  );
}

// ── Category badge style ───────────────────────────────────────────────────────
function categoryBadgeStyle(status: string): React.CSSProperties {
  const s = (status ?? '').toLowerCase();
  if (s === 'teaching')
    return { background:'#ddeeff', color:'var(--nb, #1a56db)', border:'1px solid #bfdbfe' };
  if (s === 'teaching related')
    return { background:'#ede9fe', color:'#5b21b6', border:'1px solid #ddd6fe' };
  return { background:'var(--g4,#f3f4f6)', color:'var(--g1,#374151)', border:'1px solid var(--br,#e5e7eb)' };
}

// ── Single employee card ───────────────────────────────────────────────────────
interface EmpCardProps {
  e: Personnel;
  onClick: () => void;
}
function EmpCard({ e, onClick }: EmpCardProps) {
  const isInactive = e.account_status === 'inactive';
  const upd        = !isInactive && isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
  const fullName   = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;

  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        padding:'9px 14px', borderRadius:8,
        border:'1.5px solid var(--br,#e5e7eb)',
        background: isInactive ? 'var(--g4,#f9fafb)' : 'var(--cd,#fff)',
        cursor: isInactive ? 'default' : 'pointer',
        fontFamily:'Inter,sans-serif', fontSize:12, fontWeight:500,
        opacity: isInactive ? 0.6 : 1,
        transition:'border-color .15s',
        textAlign:'left', width:'100%',
      }}
      onMouseEnter={ev => { if (!isInactive) (ev.currentTarget as HTMLButtonElement).style.borderColor = '#9ca3af'; }}
      onMouseLeave={ev => { (ev.currentTarget as HTMLButtonElement).style.borderColor = 'var(--br,#e5e7eb)'; }}
    >
      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, fontWeight:700, whiteSpace:'nowrap', flexShrink:0, ...categoryBadgeStyle(e.status ?? '') }}>
        {e.status || '—'}
      </span>
      <span style={{ fontWeight:700, color: isInactive ? '#6b7280' : 'var(--cha)', flexGrow:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {fullName}
      </span>
      <span style={{ fontSize:10, color:'var(--mu)', fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>
        {e.id}
      </span>
      {isInactive ? (
        <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:700, background:'#f3f4f6', color:'#6b7280', flexShrink:0 }}>INACTIVE</span>
      ) : (
        <span style={{ fontSize:9, padding:'2px 7px', borderRadius:10, fontWeight:700, flexShrink:0, background: upd ? '#d1fae5' : '#fee2e2', color: upd ? '#065f46' : '#9b1c1c' }}>
          {upd ? '✅' : '⏳'}
        </span>
      )}
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeaveCardsPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();

  // ── Filters (matching PersonnelListPage) ──
  const [search, setSearch]   = useState('');
  const [fCat, setFCat]       = useState('');
  const [fPos, setFPos]       = useState('');
  const [fSch, setFSch]       = useState('');
  const [fCard, setFCard]     = useState('');
  const [fAcct, setFAcct]     = useState('');
  const [page, setPage]       = useState(1);

  const [accrualPosting, setAccrualPosting]     = useState(false);
  const [mandatoryPosting, setMandatoryPosting] = useState(false);
  const [, forceRerender] = useState(0);

  // Download progress state
  const [dlProgress, setDlProgress] = useState({ open:false, current:0, total:0, name:'' });
  const cancelDownloadRef = useRef(false);

  const [modal, setModal] = useState<{
    open:boolean; title:string; message:string;
    confirmLabel:string; confirmColor:string; onConfirm:()=>void;
  }>({ open:false, title:'', message:'', confirmLabel:'', confirmColor:'#1a5c42', onConfirm:()=>{} });

  const closeModal = useCallback(() => setModal(m => ({ ...m, open:false })), []);

  // Pre-load records
  const loadedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const missing = state.db.filter(e => !loadedIdsRef.current.has(e.id) && (!e.records || e.records.length === 0));
    if (missing.length === 0) return;
    missing.forEach(e => loadedIdsRef.current.add(e.id));
    const load = async () => {
      for (const e of missing) {
        try {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok && res.records) dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:res.records } });
        } catch { loadedIdsRef.current.delete(e.id); }
      }
    };
    load();
  }, [state.db.length, dispatch]);

  const monthLabel   = currentMonthLabel();
  const accrualKey   = getNTAccrualKey();
  const mandatoryKey = getMandatoryLeaveKey();
  const currentYear  = THIS_YEAR;
  const isDecember   = true; // TODO: revert → new Date().getMonth() === 11

  const ntTrActive = useMemo(() =>
    state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return cat === 'non-teaching' || cat === 'teaching related';
    }),
  [state.db]);

  const accrualPending   = useMemo(() => ntTrActive.filter(e => !hasAccrualThisMonth(e.records ?? [])), [ntTrActive]);
  const accrualAllDone   = accrualPending.length === 0 && ntTrActive.length > 0;
  const allActive        = useMemo(() => state.db.filter(e => e.account_status !== 'inactive'), [state.db]);
  const mandatoryPending = useMemo(() => allActive.filter(e => !hasMandatoryThisYear(e.records ?? [])), [allActive]);
  const mandatoryAllDone = mandatoryPending.length === 0 && allActive.length > 0;

  const accrualInfo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem(accrualKey) || 'null'); } catch { return null; }
  }, [accrualKey]);

  const mandatoryInfo = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem(mandatoryKey) || 'null'); } catch { return null; }
  }, [mandatoryKey]);

  // ── Filter options ──
  const positions = useMemo(() => [...new Set(state.db.map(e => (e.pos    || '').trim().toUpperCase()).filter(Boolean))].sort(), [state.db]);
  const schools   = useMemo(() => [...new Set(state.db.map(e => (e.school || '').trim().toUpperCase()).filter(Boolean))].sort(), [state.db]);

  // ── Filtered + sorted list ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return state.db.filter(e => {
      if (fAcct === 'active'   && e.account_status === 'inactive') return false;
      if (fAcct === 'inactive' && e.account_status !== 'inactive') return false;
      if (q && !`${e.id||''} ${e.surname||''} ${e.given||''} ${e.pos||''}`.toLowerCase().includes(q)) return false;
      if (fCat && e.status !== fCat) return false;
      if (fPos && (e.pos    || '').trim().toUpperCase() !== fPos) return false;
      if (fSch && (e.school || '').trim().toUpperCase() !== fSch) return false;
      if (fCard) {
        if (e.account_status === 'inactive') return false;
        const upd = isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
        if (fCard === 'updated' && !upd) return false;
        if (fCard === 'pending' &&  upd) return false;
      }
      return true;
    }).sort((a, b) => (a.surname||'').localeCompare(b.surname||''));
  }, [state.db, search, fCat, fPos, fSch, fCard, fAcct]);

  useEffect(() => { setPage(1); }, [search, fCat, fPos, fSch, fCard, fAcct]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const hasFilters = !!(search || fCat || fPos || fSch || fCard || fAcct);

  // ── Print all filtered leave cards (all in one window) ──────────────────────
  function handlePrintAll() {
    if (filtered.length === 0) return;
    const printDate = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });

    const parts: string[] = [];
    for (const e of filtered) {
      parts.push(buildLeaveCardHTML(e, false));
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Leave Cards — SDO Koronadal (${filtered.length})</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #111; margin:0; }

    /* Batch header — only on first page */
    .batch-header { text-align:center; margin-bottom:12px; padding-bottom:8px; border-bottom:2px solid #1a5c42; }
    .batch-header .org { font-size:7pt; color:#555; text-transform:uppercase; letter-spacing:.4px; }
    .batch-header h1 { font-size:14pt; font-weight:800; margin:3px 0 2px; color:#1a2e1a; }
    .batch-header .meta { font-size:8.5pt; color:#444; }

    /* Each card section */
    .card-wrapper { margin-bottom:0; page-break-after: always; }
    .card-wrapper:last-child { page-break-after: auto; }

    .card-header { text-align:center; margin-bottom:8px; padding-bottom:6px; border-bottom:2px solid #1a5c42; }
    .card-header .org { font-size:7pt; color:#555; text-transform:uppercase; letter-spacing:.4px; }
    .card-header h2 { font-size:13pt; font-weight:800; margin:3px 0 1px; color:#1a2e1a; }
    .card-header .sub { font-size:8pt; color:#444; }
    .card-header .emp-name { font-size:11pt; font-weight:800; color:#1a3a6b; margin-top:4px; }
    .card-header .print-date { font-size:7pt; color:#999; margin-top:2px; }

    .pg { display:grid; grid-template-columns:repeat(4,1fr); gap:4px 8px; margin-bottom:10px; }
    .pi { border-bottom:1px solid #e5e7eb; padding:3px 2px; }
    .pi label { display:block; font-size:6.5pt; text-transform:uppercase; letter-spacing:.3px; color:#888; margin-bottom:1px; }
    .pi span  { font-size:8pt; font-weight:600; }
    .span2 { grid-column: span 2; }

    table { width:100%; border-collapse:collapse; font-size:7.5pt; }
    thead th { background:#1a5c42; color:#fff; padding:4px 5px; text-align:center; font-size:7pt; border:1px solid #134a34; }
    thead th.tha { background:#1a3a6b; }
    thead th.thb { background:#7f1d1d; }
    tbody td { padding:3px 5px; border:1px solid #e5e7eb; text-align:center; vertical-align:middle; }
    tbody td:first-child, tbody td:nth-child(2), tbody td:last-child { text-align:left; }
    tbody tr:nth-child(even) { background:#f7faf7; }
    .nc { color:#374151; }
    .bc { font-weight:700; color:#1a5c42; background:#f0fdf4; }

    @media print { .no-print { display:none !important; } }
  </style>
</head>
<body>

  <div class="batch-header">
    <div class="org">Republic of the Philippines • Department of Education • SDO City of Koronadal</div>
    <h1>Leave Cards — Batch Print</h1>
    <div class="meta">${filtered.length} employee(s) &nbsp;|&nbsp; Printed: ${printDate}${hasFilters ? ' &nbsp;|&nbsp; Filtered results' : ''}</div>
  </div>

  ${parts.join('\n')}

</body>
</html>`;

    const w = window.open('', '_blank', 'width=1100,height=800');
    if (!w) { alert('Pop-up blocked. Please allow pop-ups for this site.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 500);
  }

  // ── Download all filtered leave cards (one HTML file per employee) ──────────
  async function handleDownloadAll() {
    if (filtered.length === 0) return;
    cancelDownloadRef.current = false;
    setDlProgress({ open:true, current:0, total:filtered.length, name:'' });

    // Ensure records are loaded for each employee before download
    for (let i = 0; i < filtered.length; i++) {
      if (cancelDownloadRef.current) break;
      const e = filtered[i];
      const fullName = `${(e.surname || '').toUpperCase()}, ${e.given || ''}${e.suffix ? ' ' + e.suffix : ''}`;
      setDlProgress({ open:true, current:i + 1, total:filtered.length, name:fullName });

      // Fetch records if not loaded yet
      let emp = e;
      if (!emp.records || emp.records.length === 0) {
        try {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok && res.records) {
            emp = { ...e, records: res.records };
            dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:res.records } });
          }
        } catch { /* use empty records */ }
      }

      const html = buildLeaveCardHTML(emp, true);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const safeName = `${(e.surname || 'unknown').replace(/[^a-zA-Z0-9]/g, '_')}_${e.id}`;
      const cardType = (e.status ?? '').toLowerCase() === 'teaching' ? 'T' : 'NT';
      a.download = `LeaveCard_${cardType}_${safeName}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Small delay to avoid browser throttling downloads
      await new Promise(r => setTimeout(r, 300));
    }

    setDlProgress({ open:false, current:0, total:0, name:'' });
    if (!cancelDownloadRef.current && filtered.length > 0) {
      // Brief done toast — simple alert
      setTimeout(() => {
        alert(`✅ Download complete!\n\n${filtered.length} leave card(s) downloaded as individual HTML files.\n\nOpen each file in your browser and use Ctrl+P to print or save as PDF.`);
      }, 200);
    }
  }

  // ── NT Monthly Accrual ─────────────────────────────────────────────────────
  async function runMonthlyNTAccrual() {
    const eligible = state.db.filter(e => {
      if (e.account_status === 'inactive') return false;
      const cat = (e.status ?? '').toLowerCase();
      return (cat === 'non-teaching' || cat === 'teaching related') && !hasAccrualThisMonth(e.records ?? []);
    });
    if (eligible.length === 0) { alert(`✅ All NT/TR employees already have their Monthly Accrual for ${monthLabel}.`); forceRerender(n => n + 1); return; }
    setAccrualPosting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    let successCount = 0;
    const errors: string[] = [];
    for (const e of eligible) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) { records = res.records || []; dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records } }); }
        }
        const accrual: LeaveRecord = {
          so:'', prd:monthLabel, from:todayISO, to:todayISO,
          spec:'', action:'Monthly Accrual', earned:1.25,
          forceAmount:0, monV:0, monS:0, monDV:0, monDS:0, monAmount:0, monDisAmt:0, trV:0, trS:0,
        };
        const saveRes = await apiCall('save_record', { employee_id:e.id, record:accrual });
        if (!saveRes.ok) { errors.push(`${e.surname}, ${e.given}: ${saveRes.error||'failed'}`); continue; }
        accrual._record_id = saveRes.record_id;
        const newRecords = [...(records||[]), accrual];
        sortRecordsByDate(newRecords);
        dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:newRecords } });
        dispatch({ type:'UPDATE_EMPLOYEE', payload:{ ...e, records:newRecords } });
        const empStatus = (e.status??'').toLowerCase() === 'teaching' ? 'Teaching' : 'Non-Teaching';
        const updates = computeRowBalanceUpdates(newRecords, e.id, empStatus);
        for (const u of updates) await apiCall('save_row_balance', u);
        successCount++;
      } catch (err) { errors.push(`${e.surname||e.id}: ${(err as Error).message||'error'}`); }
    }
    localStorage.setItem(accrualKey, JSON.stringify({ count: successCount, date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }));
    setAccrualPosting(false);
    forceRerender(n => n + 1);
    if (errors.length > 0) {
      alert(`✅ Accrual posted for ${successCount} employee(s).\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0,5).join('\n')}${errors.length>5?'\n…and more':''}`);
    } else {
      alert(`✅ Monthly accrual posted!\n\n• ${successCount} NT/TR employee(s) received 1.25 (Set A) + 1.25 (Set B)\n• Month: ${monthLabel}`);
    }
  }

  function doMonthlyNTAccrual() {
    const count = accrualPending.length;
    if (count === 0) { alert(`✅ All NT/TR employees already have their Monthly Accrual for ${monthLabel}.`); return; }
    setModal({
      open:true, title:'📈 Post Monthly NT/TR Accrual',
      message:
        `This will add 1.25 Set A + 1.25 Set B to ${count} NT/TR employee(s) who have not yet received it this month.\n\n` +
        `Month: ${monthLabel}\n\n` +
        `${accrualAllDone ? '' : `⚠️ ${ntTrActive.length - count} employee(s) already have it and will be skipped.\n\n`}` +
        `The button will remain available this month until all NT/TR employees have been posted.`,
      confirmLabel:'Post Accrual', confirmColor:'#1a5c42',
      onConfirm:() => { closeModal(); runMonthlyNTAccrual(); },
    });
  }

  // ── Mandatory Leave ────────────────────────────────────────────────────────
  async function runMandatoryLeaveDeduction() {
    const eligible = state.db.filter(e => e.account_status !== 'inactive' && !hasMandatoryThisYear(e.records ?? []));
    if (eligible.length === 0) { alert(`✅ All active employees already have Mandatory Leave for ${currentYear}.`); forceRerender(n => n + 1); return; }
    setMandatoryPosting(true);
    const todayISO = new Date().toISOString().split('T')[0];
    let successCount = 0; let skippedCount = 0;
    const skippedNames: string[] = [];
    const errors: string[] = [];
    for (const e of eligible) {
      try {
        let records = e.records;
        if (!records || records.length === 0) {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok) { records = res.records || []; dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records } }); }
        }
        if (hasMandatoryThisYear(records || [])) { skippedCount++; skippedNames.push(`${e.surname}, ${e.given}`); continue; }
        const deduction: LeaveRecord = {
          so:'', prd:`December ${currentYear}`, from:todayISO, to:todayISO,
          spec:'', action:'Mandatory Leave', earned:0, forceAmount:5,
          monV:0, monS:0, monDV:0, monDS:0, monAmount:0, monDisAmt:0, trV:0, trS:0,
        };
        const saveRes = await apiCall('save_record', { employee_id:e.id, record:deduction });
        if (!saveRes.ok) { errors.push(`${e.surname}, ${e.given}: ${saveRes.error||'failed'}`); continue; }
        deduction._record_id = saveRes.record_id;
        const newRecords = [...(records||[]), deduction];
        sortRecordsByDate(newRecords);
        dispatch({ type:'SET_EMPLOYEE_RECORDS', payload:{ id:e.id, records:newRecords } });
        dispatch({ type:'UPDATE_EMPLOYEE', payload:{ ...e, records:newRecords } });
        const empStatus = (e.status??'').toLowerCase() === 'teaching' ? 'Teaching' : 'Non-Teaching';
        const updates = computeRowBalanceUpdates(newRecords, e.id, empStatus);
        for (const u of updates) await apiCall('save_row_balance', u);
        successCount++;
      } catch (err) { errors.push(`${e.surname||e.id}: ${(err as Error).message||'error'}`); }
    }
    localStorage.setItem(mandatoryKey, JSON.stringify({ count: successCount, skipped: skippedCount, date: new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) }));
    setMandatoryPosting(false);
    forceRerender(n => n + 1);
    let msg = `✅ Mandatory Leave deduction posted!\n\n• ${successCount} employee(s) deducted 5 days VL\n• Year: ${currentYear}`;
    if (skippedCount > 0) { msg += `\n\n⏭ Skipped ${skippedCount}:`; msg += '\n' + skippedNames.slice(0,8).join('\n'); if (skippedNames.length > 8) msg += `\n…and ${skippedNames.length-8} more`; }
    if (errors.length > 0) msg += `\n\n⚠️ Errors (${errors.length}):\n${errors.slice(0,5).join('\n')}`;
    alert(msg);
  }

  function doMandatoryLeave() {
    if (!isDecember) return;
    const count = mandatoryPending.length;
    if (count === 0) { alert(`✅ All active employees already have Mandatory Leave for ${currentYear}.`); return; }
    const alreadyDone = allActive.length - count;
    setModal({
      open:true, title:'📅 Post Mandatory Leave Deduction',
      message:
        `This will deduct 5 days VL from ${count} employee(s) who have not yet received it this year.\n\n` +
        `• Will be deducted: ${count} employee(s)\n• Already have it (skipped): ${alreadyDone} employee(s)\n\nYear: ${currentYear}\n\n` +
        `The button will remain available in December until all active employees have been posted.`,
      confirmLabel:'Post Deduction', confirmColor:'#9b1c1c',
      onConfirm:() => { closeModal(); runMandatoryLeaveDeduction(); },
    });
  }

  const accrualDisabled   = accrualPosting || accrualAllDone;
  const mandatoryDisabled = mandatoryPosting || mandatoryAllDone || !isDecember;

  const pillStyle = (done: boolean): React.CSSProperties => ({
    display:'inline-flex', alignItems:'center', gap:5,
    fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20,
    background: done ? '#d1fae5' : '#f3f4f6',
    color:      done ? '#065f46' : 'var(--mu)',
    border:`1px solid ${done ? '#a7f3d0' : 'var(--br)'}`,
    whiteSpace:'nowrap',
  });

  return (
    <>
      <ConfirmModal
        open={modal.open} title={modal.title} message={modal.message}
        confirmLabel={modal.confirmLabel} confirmColor={modal.confirmColor}
        onConfirm={modal.onConfirm} onCancel={closeModal}
      />
      <DownloadProgress
        open={dlProgress.open}
        current={dlProgress.current}
        total={dlProgress.total}
        name={dlProgress.name}
        onCancel={() => { cancelDownloadRef.current = true; setDlProgress(p => ({ ...p, open:false })); }}
      />

      <div className="card">
        <div className="ch grn">📋 Leave Cards</div>

        {/* ── Toolbar ── */}
        <div className="no-print" style={{ padding:'14px 16px 12px', borderBottom:'1px solid var(--dv)' }}>

          {/* Row 1: hint + search */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:10 }}>
            <span style={{ fontSize:12, color:'var(--mu)', fontWeight:500 }}>
              Click an employee to open their leave card.
            </span>
            <div className="srch">
              <span className="sri">🔍</span>
              <input
                type="text" placeholder="Search name or ID…"
                value={search} onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: filters */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:10 }}>
            <select className="tb-filter" value={fCat} onChange={e => setFCat(e.target.value)}>
              <option value="">All Categories</option>
              <option value="Teaching">Teaching</option>
              <option value="Non-Teaching">Non-Teaching</option>
              <option value="Teaching Related">Teaching Related</option>
            </select>
            <select className="tb-filter" value={fPos} onChange={e => setFPos(e.target.value)}>
              <option value="">All Positions</option>
              {positions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="tb-filter" value={fSch} onChange={e => setFSch(e.target.value)}>
              <option value="">All Schools/Offices</option>
              {schools.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="tb-filter" value={fCard} onChange={e => setFCard(e.target.value)}>
              <option value="">All Card Status</option>
              <option value="updated">✅ Updated</option>
              <option value="pending">⏳ Pending</option>
            </select>
            <select className="tb-filter" value={fAcct} onChange={e => setFAcct(e.target.value)}>
              <option value="">All Accounts</option>
              <option value="active">🟢 Active</option>
              <option value="inactive">🔴 Inactive</option>
            </select>
            {hasFilters && (
              <button
                className="tb-filter-clear"
                onClick={() => { setSearch(''); setFCat(''); setFPos(''); setFSch(''); setFCard(''); setFAcct(''); }}
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Row 3: print + download action buttons */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12, paddingTop:2 }}>
            {/* Print All */}
            <button
              className="btn"
              title={filtered.length === 0 ? 'No employees to print' : `Print leave cards for ${filtered.length} employee(s)`}
              onClick={handlePrintAll}
              disabled={filtered.length === 0}
              style={{
                background: filtered.length === 0 ? 'var(--g4)' : 'linear-gradient(135deg,#1a3a6b,#2563eb)',
                color: filtered.length === 0 ? '#9ca3af' : '#fff',
                fontWeight:700, fontSize:12, height:36, padding:'0 16px',
                borderRadius:8, border:'none',
                cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
              }}
            >
              🖨 Print All Cards
              {filtered.length > 0 && (
                <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:800 }}>
                  {filtered.length}
                </span>
              )}
            </button>

            {/* Download All */}
            <button
              className="btn"
              title={filtered.length === 0 ? 'No employees to download' : `Download ${filtered.length} leave card(s) individually as HTML files`}
              onClick={handleDownloadAll}
              disabled={filtered.length === 0 || dlProgress.open}
              style={{
                background: filtered.length === 0 ? 'var(--g4)' : 'linear-gradient(135deg,#4a1d96,#7c3aed)',
                color: filtered.length === 0 ? '#9ca3af' : '#fff',
                fontWeight:700, fontSize:12, height:36, padding:'0 16px',
                borderRadius:8, border:'none',
                cursor: filtered.length === 0 ? 'not-allowed' : 'pointer',
                display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
              }}
            >
              ⬇ Download All
              {filtered.length > 0 && (
                <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:800 }}>
                  {filtered.length}
                </span>
              )}
            </button>

            {hasFilters && filtered.length > 0 && (
              <span style={{ fontSize:11, color:'var(--nb,#1a56db)', fontWeight:600 }}>
                {filtered.length} employee{filtered.length !== 1 ? 's' : ''} match current filter
              </span>
            )}
          </div>

          {/* Row 4: accrual + mandatory buttons */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-start' }}>

            {/* NT Accrual */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <button
                className="btn"
                style={{
                  background: accrualDisabled ? 'var(--g4)' : 'linear-gradient(135deg,#1a5c42,#2e7d52)',
                  color:      accrualDisabled ? '#065f46'   : 'white',
                  fontWeight:700, fontSize:12, height:36, padding:'0 16px', borderRadius:8,
                  border:   accrualDisabled ? '1.5px solid #a7f3d0' : 'none',
                  opacity:  accrualDisabled ? 0.75 : 1,
                  cursor:   accrualDisabled ? 'not-allowed' : 'pointer',
                  whiteSpace:'nowrap',
                }}
                onClick={doMonthlyNTAccrual} disabled={accrualDisabled}
              >
                {accrualPosting ? '⏳ Posting…'
                  : accrualAllDone ? '✅ All NT/TR Accruals Posted'
                  : `📈 Post Monthly NT/TR Accrual (1.25 each) — ${accrualPending.length} pending`}
              </button>
              <span style={pillStyle(accrualAllDone)}>
                {accrualAllDone
                  ? `✅ All ${ntTrActive.length} NT/TR employee(s) posted for ${monthLabel}`
                  : accrualInfo
                    ? `⏳ ${accrualPending.length} of ${ntTrActive.length} still pending — last posted ${accrualInfo.date}`
                    : `⏳ ${accrualPending.length} of ${ntTrActive.length} NT/TR employee(s) pending for ${monthLabel}`}
              </span>
            </div>

            <div style={{ width:1, background:'var(--br)', alignSelf:'stretch', margin:'2px 4px' }} />

            {/* Mandatory Leave */}
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <button
                className="btn"
                title={
                  !isDecember ? 'Available in December only'
                    : mandatoryAllDone ? `All employees already have Mandatory Leave for ${currentYear}`
                    : `Post mandatory 5-day VL deduction for ${currentYear}`
                }
                style={{
                  background: mandatoryDisabled ? '#fef2f2' : 'linear-gradient(135deg,#7f1d1d,#b91c1c)',
                  color:      mandatoryDisabled ? '#9b1c1c' : 'white',
                  fontWeight:700, fontSize:12, height:36, padding:'0 16px', borderRadius:8,
                  border:   mandatoryDisabled ? '1.5px solid #fca5a5' : 'none',
                  opacity:  mandatoryDisabled ? 0.75 : 1,
                  cursor:   mandatoryDisabled ? 'not-allowed' : 'pointer',
                  whiteSpace:'nowrap',
                }}
                onClick={doMandatoryLeave} disabled={mandatoryDisabled}
              >
                {mandatoryPosting ? '⏳ Posting…'
                  : mandatoryAllDone ? '✅ All Mandatory Leaves Posted'
                  : !isDecember ? '📅 Post Mandatory Leave (−5 VL)'
                  : `📅 Post Mandatory Leave (−5 VL) — ${mandatoryPending.length} pending`}
              </button>
              <span style={pillStyle(mandatoryAllDone)}>
                {mandatoryAllDone
                  ? `✅ All ${allActive.length} active employee(s) posted for ${currentYear}`
                  : !isDecember ? '🔒 Available in December only'
                  : mandatoryInfo
                    ? `⏳ ${mandatoryPending.length} of ${allActive.length} still pending — last posted ${mandatoryInfo.date}`
                    : `⏳ ${mandatoryPending.length} of ${allActive.length} employee(s) pending for ${currentYear}`}
              </span>
            </div>
          </div>
        </div>

        {/* ── Employee Card Grid ── */}
        <div style={{ padding:'12px 16px 8px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:'16px 4px', color:'var(--mu)', fontStyle:'italic', fontSize:13 }}>
              No employees found{search ? ` for "${search}"` : ''}.
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:6 }}>
                {paginated.map(e => (
                  <EmpCard key={e.id} e={e} onClick={() => onOpenCard?.(e.id)} />
                ))}
              </div>

              {/* Footer: count + pagination */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0 4px', flexWrap:'wrap', gap:8 }}>
                <span style={{ fontSize:12, color:'var(--mu)' }}>
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} employee{filtered.length !== 1 ? 's' : ''}
                  {hasFilters && (
                    <span style={{ marginLeft:8, color:'var(--nb,#1a56db)', fontWeight:600 }}>(filtered)</span>
                  )}
                </span>
                <Pagination page={page} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
