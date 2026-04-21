'use client';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { StatBox, isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';
import RegisterModal from '@/components/modals/RegisterModal';
import CardStatusModal from '@/components/modals/CardStatusModal';
import { apiCall } from '@/lib/api';
import type { Personnel } from '@/types';

interface Props { onOpenCard: (id: string) => void; }

export default function PersonnelListPage({ onOpenCard }: Props) {
  const { state, dispatch } = useAppStore();
  const [search, setSearch]   = useState('');
  const [fCat, setFCat]       = useState('');
  const [fPos, setFPos]       = useState('');
  const [fSch, setFSch]       = useState('');
  const [fCard, setFCard]     = useState('');
  const [fAcct, setFAcct]     = useState('');
  const [regOpen, setRegOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Personnel | null>(null);
  const [cardStatusOpen, setCardStatusOpen] = useState(false);

  // All employees — inactive are still shown in the list
  const all = useMemo(() => state.db, [state.db]);

  // Only ACTIVE employees are counted in the dashboard stats
  const activeOnly = useMemo(() => all.filter(e => e.account_status !== 'inactive'), [all]);

  const positions = useMemo(() => [...new Set(all.map(e => (e.pos    || '').trim().toUpperCase()).filter(Boolean))].sort(), [all]);
  const schools   = useMemo(() => [...new Set(all.map(e => (e.school || '').trim().toUpperCase()).filter(Boolean))].sort(), [all]);

  const monthLabel       = currentMonthLabel();
 // ✅ After — counts ALL employees (active + inactive)
const teachingCount        = all.filter(e => (e.status ?? '').toLowerCase() === 'teaching').length;
const nonTeachingCount     = all.filter(e => (e.status ?? '').toLowerCase() === 'non-teaching').length;
const teachingRelatedCount = all.filter(e => (e.status ?? '').toLowerCase() === 'teaching related').length;

  // ✅ FIX: pass lastEditedAt so the primary check in isCardUpdatedThisMonth works
  const updatedCount    = activeOnly.filter(e => isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt)).length;
  const notUpdatedCount = activeOnly.length - updatedCount;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter(e => {
      if (fAcct === 'active'   && e.account_status === 'inactive') return false;
      if (fAcct === 'inactive' && e.account_status !== 'inactive') return false;
      const nm = `${e.surname || ''} ${e.given || ''} ${e.suffix || ''}`.toLowerCase();
      if (q && !`${e.id || ''} ${nm} ${e.pos || ''}`.toLowerCase().includes(q)) return false;
      if (fCat && e.status !== fCat) return false;
      if (fPos && (e.pos    || '').trim().toUpperCase() !== fPos) return false;
      if (fSch && (e.school || '').trim().toUpperCase() !== fSch) return false;
      if (fCard) {
        if (e.account_status === 'inactive') return false;
        // ✅ FIX: pass lastEditedAt here too
        const upd = isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);
        if (fCard === 'updated' && !upd) return false;
        if (fCard === 'pending' &&  upd) return false;
      }
      return true;
    }).sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
  }, [all, search, fCat, fPos, fSch, fCard, fAcct]);

  // ── After any save (new or edit), re-fetch the full DB from the server.
  //    This ensures account_status changes (and all other edits) are
  //    immediately reflected in state and survive a page refresh,
  //    because the source of truth is always the DB — not the modal form data.
  async function handleSaved(_emp: Personnel, isNew: boolean) {
    const res = await apiCall('get_personnel', {}, 'GET');
    if (res.ok && res.data) {
      dispatch({ type: 'SET_DB', payload: res.data });
    } else {
      // Fallback to optimistic update if re-fetch fails
      if (isNew) {
        dispatch({ type: 'ADD_EMPLOYEE', payload: _emp });
      } else {
        dispatch({
          type: 'UPDATE_EMPLOYEE',
          payload: { employee: _emp, originalId: editEmp?.id ?? _emp.id },
        });
      }
    }
    setRegOpen(false);
    setEditEmp(null);
  }

  return (
    <>
      {/* ── Dashboard Stats ── */}
      <div className="stats-row no-print">
       <StatBox icon="👥" 
         value={all.length} 
         label="Total Personnel" />
        <StatBox icon="📚" iconClass="si-b"
          value={teachingCount}
          label="Teaching" />
        <StatBox icon="🏢" iconClass="si-a"
          value={nonTeachingCount}
          label="Non-Teaching" />
        <StatBox icon="🎓" iconClass="si-b"
          value={teachingRelatedCount}
          label="Teaching Related" />
        <StatBox icon="✅"
          iconStyle={{ background: '#d1fae5' }}
          value={updatedCount}
          label={`Updated (${monthLabel})`}
          valueStyle={{ color: '#065f46' }}
          style={{ borderColor: 'var(--g3)', cursor: 'pointer' }}
          onClick={() => setCardStatusOpen(true)} />
        <StatBox icon="⏳"
          iconStyle={{ background: '#fee2e2' }}
          value={notUpdatedCount}
          label="Not Yet Updated"
          valueStyle={{ color: '#c53030' }}
          style={{ borderColor: '#e53e3e', cursor: 'pointer' }}
          onClick={() => setCardStatusOpen(true)} />
      </div>

      <div className="card">
        <div className="ch grn">👥 Personnel Registry</div>
        <div className="toolbar no-print">
          <div className="toolbar-left">
            <button className="btn b-grn" onClick={() => { setEditEmp(null); setRegOpen(true); }}>
              ➕ Register New Personnel
            </button>
            <div className="srch">
              <span className="sri">🔍</span>
              <input
                type="text"
                placeholder="Search name or ID…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="toolbar-filters" id="toolbarFilters">
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
            <button
              className="tb-filter-clear no-print"
              onClick={() => { setSearch(''); setFCat(''); setFPos(''); setFSch(''); setFCard(''); setFAcct(''); }}>
              ✕ Clear
            </button>
          </div>
        </div>

        <div className="tw" style={{ maxHeight: 'none' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ height: 44, width: '9%',  fontSize: 12, textAlign: 'center' }}>Employee ID</th>
                <th style={{ width: '20%', fontSize: 12, textAlign: 'center' }}>Full Name</th>
                <th style={{ width: '9%',  fontSize: 12, textAlign: 'center' }}>Category</th>
                <th style={{ width: '14%', fontSize: 12, textAlign: 'center' }}>Position</th>
                <th style={{ width: '16%', fontSize: 12, textAlign: 'center' }}>School / Office</th>
                <th style={{ width: '9%',  fontSize: 12, textAlign: 'center' }}>Card Status</th>
                <th style={{ width: '9%',  fontSize: 12, textAlign: 'center' }}>Account</th>
                <th className="no-print" style={{ width: '14%', fontSize: 12, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--mu)', fontStyle: 'italic' }}>
                    No personnel found.
                  </td>
                </tr>
              ) : filtered.map(e => {
                const isT      = (e.status ?? '').toLowerCase() === 'teaching';
                const inactive = e.account_status === 'inactive';
                // ✅ FIX: pass lastEditedAt so badge reflects DB value correctly
                const upd      = inactive ? false : isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt);

                return (
                  <tr key={e.id} style={inactive ? { opacity: 0.6 } : {}}>
                    <td style={{ textAlign: 'center' }}>
                      <b style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{e.id}</b>
                    </td>
                    <td style={{ textAlign: 'left', fontWeight: 600, paddingLeft: 10 }}>
                      <button
                        className="btn"
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          cursor: 'pointer', fontWeight: 600, color: 'var(--cha)',
                          textAlign: 'left', height: 'auto',
                          textTransform: 'none', letterSpacing: 0,
                        }}
                        onClick={() => {
                          const page = isT ? 't' : 'nt';
                          dispatch({ type: 'SET_CUR_ID', payload: e.id });
                          dispatch({ type: 'SET_PAGE',   payload: page });
                          try {
                            const raw = sessionStorage.getItem('deped_session');
                            if (raw) {
                              const s = JSON.parse(raw);
                              sessionStorage.setItem('deped_session', JSON.stringify({ ...s, curId: e.id, page }));
                            }
                          } catch { /* ignore */ }
                          onOpenCard(e.id);
                        }}>
                        {(e.surname || '').toUpperCase()}, {e.given || ''} {e.suffix || ''}
                      </button>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${isT ? 'bt' : 'bnt'}`}>{e.status}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{(e.pos    || '').toUpperCase()}</td>
                    <td style={{ textAlign: 'center' }}>{(e.school || '').toUpperCase()}</td>
                    <td style={{ textAlign: 'center' }}>
                      {inactive ? (
                        <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: '#f3f4f6', color: '#6b7280' }}>
                          — N/A
                        </span>
                      ) : (
                        <span style={{
                          fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                          background: upd ? '#d1fae5' : '#fee2e2',
                          color:      upd ? '#065f46' : '#9b1c1c',
                        }}>
                          {upd ? '✅ Updated' : '⏳ Pending'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                        background: inactive ? '#fee2e2' : '#d1fae5',
                        color:      inactive ? '#9b1c1c' : '#065f46',
                      }}>
                        {inactive ? '🔴 Inactive' : '🟢 Active'}
                      </span>
                    </td>
                    <td className="no-print" style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn b-amb"
                        style={{ height: 34, padding: '0 18px', fontSize: 12 }}
                        onClick={() => { setEditEmp(e); setRegOpen(true); }}>
                        ✏ Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {regOpen && (
        <RegisterModal
          employee={editEmp}
          onClose={() => { setRegOpen(false); setEditEmp(null); }}
          onSaved={handleSaved}
        />
      )}
      {cardStatusOpen && <CardStatusModal onClose={() => setCardStatusOpen(false)} />}
    </>
  );
}
