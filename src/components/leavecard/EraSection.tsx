'use client';
import { useState } from 'react';
import { LeaveTableHeader, FwdRow } from '@/components/leavecard/LeaveCardTable';
import { fmtD, fmtNum, hz, isEmptyRecord, apiCall } from '@/lib/api';
import type { LeaveRecord, Personnel } from '@/types';

interface Seg {
  status: string;
  recs: LeaveRecord[];
  startIdx: number;
  convIdx: number;
  conv: LeaveRecord | null;
}
interface Props {
  seg: Seg;
  si: number;
  emp: Personnel;
  isAdmin: boolean;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
  cardType: 'nt' | 't';
}

export function EraSection({ seg, si, emp, isAdmin, onRefresh, onEditRow, cardType }: Props) {
  const [open, setOpen]         = useState(false);
  const [deleting, setDeleting] = useState(false);

  const label = `📁 ${seg.status} Leave Record — Era ${si + 1} (${seg.recs.length} entr${seg.recs.length === 1 ? 'y' : 'ies'})`;

  // ── Delete entire era ─────────────────────────────────────────
  async function handleDeleteEra() {
    const eraLabel = `Era ${si + 1} (${seg.status})`;
    const confirmed = window.confirm(
      `⚠️ Delete ${eraLabel}?\n\n` +
      `This will permanently delete ALL ${seg.recs.length} record(s) in this era, ` +
      `including the conversion marker.\n\nThis action CANNOT be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const ids: number[] = [];
      seg.recs.forEach(r => { if (r._record_id) ids.push(r._record_id); });
      if (seg.conv && seg.conv._record_id) ids.push(seg.conv._record_id);

      await Promise.all(
        ids.map(record_id =>
          apiCall('delete_record', { employee_id: emp.id, record_id })
        )
      );
      onRefresh();
    } catch (e) {
      alert('Era deletion failed: ' + String(e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="era-wrapper" id={`${cardType}OldEra${si > 0 ? '_' + si : ''}`}>
      {/* ── Era toggle header ── */}
      <div
        className={`era-old-toggle${open ? ' open' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <span className="era-arrow">▼</span>
        <span>{label}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, color: 'var(--mu)' }}>
          Click to expand / collapse
        </span>
      </div>

      {/* ── Era body ── */}
      <div className={`era-old-body${open ? ' open' : ''}`}>
        <div className="card" style={{ padding: 0, margin: 0 }}>
          <div className="tw">
            <table>
              <LeaveTableHeader showAction={isAdmin} />
              <tbody>
                {/* ── FIX Bug 1 ──────────────────────────────────────────────────
                    Era 1 (si === 0) NEVER has a Balance Forwarded row.
                    Only eras after the first (si > 0) show the forwarded balance
                    that came from the previous era's conversion marker.

                    The `conv` stored on the segment is the conversion marker that
                    CLOSES this era (i.e. the conversion that spawns the NEXT era).
                    The balance forwarded INTO this era comes from the PREVIOUS era's
                    `conv` — which is passed down from the parent (TCardTable /
                    NTCardTable) as `seg.conv` only for si > 0. For si === 0 the
                    parent already passes conv = null, but we guard here too.
                    ───────────────────────────────────────────────────────────── */}
                {si > 0 && seg.conv && (() => {
                  // The FwdRow for this era shows the balance forwarded FROM the
                  // previous era into this one.  The last real record of the
                  // PREVIOUS era's stored balance fields are used — those are
                  // captured in conv.fwdBV / conv.fwdBS by the conversion logic.
                  const bV = seg.conv.fwdBV ?? 0;
                  const bS = seg.conv.fwdBS ?? 0;
                  return <FwdRow conv={seg.conv} bV={bV} bS={bS} status={seg.status} />;
                })()}

                {cardType === 'nt' ? (
                  <NTEraRows
                    records={seg.recs}
                    isAdmin={isAdmin}
                    emp={emp}
                    startIdx={seg.startIdx}
                    onRefresh={onRefresh}
                    onEditRow={onEditRow}
                    eraStatus={seg.status}
                  />
                ) : (
                  <TEraRows
                    records={seg.recs}
                    isAdmin={isAdmin}
                    emp={emp}
                    startIdx={seg.startIdx}
                    onRefresh={onRefresh}
                    onEditRow={onEditRow}
                    eraStatus={seg.status}
                  />
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  NT Era Rows — Non-Teaching  (also used for "Related Teaching" which shares
//  the same computation as Non-Teaching per the requirements)
//
//  FIX Bug 2 & 4:
//  Locked eras read the DB-stored balance fields (setA_balance, setB_balance,
//  setA_earned, setB_earned, etc.) that were written at the time of entry.
//  We NEVER recompute with live logic here — that would cause Era 1 values to
//  change after a conversion, and the last row of a locked era to silently
//  inherit the new era's category logic.
// ─────────────────────────────────────────────────────────────────────────────
function NTEraRows({
  records, isAdmin, emp, startIdx, onRefresh, onEditRow, eraStatus,
}: {
  records: LeaveRecord[];
  isAdmin: boolean;
  emp: Personnel;
  startIdx: number;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
  eraStatus: string;
}) {
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;

        // ── FIX Bug 2 & 4: read DB-stored computed values, never recompute ──
        // These fields were saved by computeRowBalanceUpdates() at the time the
        // record belonged to its era.  They are permanently locked.
        const eV = r.setA_earned  ?? 0;
        const aV = r.setA_abs_wp  ?? 0;
        const bV = r.setA_balance ?? 0;
        const wV = r.setA_wop     ?? 0;
        const eS = r.setB_earned  ?? 0;
        const aS = r.setB_abs_wp  ?? 0;
        const bS = r.setB_balance ?? 0;
        const wS = r.setB_wop     ?? 0;

        const { classifyLeave } = require('@/lib/api');
        const C       = classifyLeave(r.action || '');
        const ac      = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd      = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        const idx     = startIdx + ri;

        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">
              {r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}
            </td>
            <td className="nc">{hz(eV)}</td>
            <td className="nc">{hz(aV)}</td>
            <td className="bc">{fmtNum(bV)}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{hz(eS)}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{fmtNum(bS)}</td>
            <td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`}>{r.action}</td>
            {isAdmin && (
              <EraRowMenu
                record={r}
                idx={idx}
                emp={emp}
                onRefresh={onRefresh}
                onEditRow={onEditRow}
              />
            )}
          </tr>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Teaching Era Rows
//
//  FIX Bug 2 & 4: Same pattern — read DB-stored fields, never recompute.
// ─────────────────────────────────────────────────────────────────────────────
function TEraRows({
  records, isAdmin, emp, startIdx, onRefresh, onEditRow, eraStatus,
}: {
  records: LeaveRecord[];
  isAdmin: boolean;
  emp: Personnel;
  startIdx: number;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
  eraStatus: string;
}) {
  return (
    <>
      {records.map((r, ri) => {
        if (r._conversion) return null;

        // ── FIX Bug 2 & 4: read DB-stored computed values, never recompute ──
        const earned     = r.setA_earned  ?? 0;
        const aV         = r.setA_abs_wp  ?? 0;
        const balA       = r.setA_balance ?? 0;
        const wV         = r.setA_wop     ?? 0;
        const aS         = r.setB_abs_wp  ?? 0;
        const balB       = r.setB_balance ?? 0;
        const wS         = r.setB_wop     ?? 0;

        // Teaching uses a single balance pool; setB is only shown when setA = 0
        const isSetBLeave = balA === 0 && balB > 0;

        const { classifyLeave } = require('@/lib/api');
        const C       = classifyLeave(r.action || '');
        const ac      = (C.isDis || C.isForceDis) ? 'rdc' : (C.isMon || C.isMD ? 'puc' : '');
        const dd      = r.spec || (r.from ? `${fmtD(r.from)} – ${fmtD(r.to)}` : '');
        const isEmpty = isEmptyRecord(r);
        const isE     = r.earned > 0;
        const idx     = startIdx + ri;

        return (
          <tr key={r._record_id || ri} style={isEmpty ? { background: '#fff5f5' } : {}}>
            <td>{r.so}</td>
            <td className="period-cell">
              {r.prd}{dd && <><br /><span className="prd-date">{dd}</span></>}
            </td>
            <td className="nc">
              {C.isTransfer ? fmtNum(r.trV || 0) : (!C.isMon && !C.isPer && isE) ? fmtNum(earned) : ''}
            </td>
            <td className="nc">{hz(aV)}</td>
            <td className="bc">{isSetBLeave ? '' : fmtNum(balA)}</td>
            <td className="nc">{hz(wV)}</td>
            <td className="nc">{''}</td>
            <td className="nc">{hz(aS)}</td>
            <td className="bc">{isSetBLeave ? fmtNum(balB) : ''}</td>
            <td className="nc">{hz(wS)}</td>
            <td className={`${ac} remarks-cell`} style={{ textAlign: 'left', paddingLeft: 4 }}>
              {r.action}
            </td>
            {isAdmin && (
              <EraRowMenu
                record={r}
                idx={idx}
                emp={emp}
                onRefresh={onRefresh}
                onEditRow={onEditRow}
              />
            )}
          </tr>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Per-row action menu (Edit / Delete)
// ─────────────────────────────────────────────────────────────────────────────
function EraRowMenu({
  record, idx, emp, onRefresh, onEditRow,
}: {
  record: LeaveRecord;
  idx: number;
  emp: Personnel;
  onRefresh: () => void;
  onEditRow: (idx: number, record: LeaveRecord) => void;
}) {
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    setOpen(false);
    if (!record._record_id) return;
    if (!confirm('Delete this row? This cannot be undone.')) return;
    const res = await apiCall('delete_record', { employee_id: emp.id, record_id: record._record_id });
    if (!res.ok) { alert('Delete failed: ' + (res.error || 'Unknown error')); return; }
    onRefresh();
  }

  return (
    <td className="no-print" style={{ textAlign: 'center', padding: '0 4px' }}>
      <div className="row-menu-wrap" style={{ position: 'relative', display: 'inline-block' }}>
        <button
          className="row-menu-btn"
          onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        >
          ⋮
        </button>
        {open && (
          <div className="row-menu-dd open" style={{ position: 'absolute', right: 0, zIndex: 9999 }}>
            <button onClick={() => { setOpen(false); onEditRow(idx, record); }}>✏️ Edit Row</button>
            <div className="menu-div" />
            <button className="danger" onClick={handleDelete}>🗑️ Delete Row</button>
          </div>
        )}
      </div>
    </td>
  );
}
