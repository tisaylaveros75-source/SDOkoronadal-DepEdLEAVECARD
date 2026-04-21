'use client';
import { useState, useMemo } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { StatBox } from '@/components/StatsRow';
import RegisterModal from '@/components/modals/RegisterModal';
import type { Personnel } from '@/types';

export default function SchoolAdminPage() {
  const { state, dispatch } = useAppStore();
  const [search, setSearch] = useState('');
  const [fCat, setFCat]     = useState('');
  const [fAcct, setFAcct]   = useState('');
  const [regOpen, setRegOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Personnel | null>(null);

  const active = useMemo(() => state.db.filter(e => !e.archived), [state.db]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return active.filter(e => {
      if (fAcct === 'active'   && e.account_status === 'inactive') return false;
      if (fAcct === 'inactive' && e.account_status !== 'inactive') return false;
      if (fCat && e.status !== fCat) return false;
      const nm = `${e.surname || ''} ${e.given || ''} ${e.suffix || ''}`.toLowerCase();
      if (q && !`${e.id || ''} ${nm} ${e.pos || ''}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));
  }, [active, search, fCat, fAcct]);

  function handleSaved(emp: Personnel, isNew: boolean) {
    if (isNew) {
      dispatch({ type: 'ADD_EMPLOYEE', payload: emp });
    } else {
      dispatch({ type: 'UPDATE_EMPLOYEE', payload: { employee: emp, originalId: editEmp?.id ?? emp.id } });
    }
    setRegOpen(false); setEditEmp(null);
  }

  return (
    <>
      <div className="stats-row no-print">
        <StatBox icon="👥" iconClass="si-g" value={active.length} label="Total Personnel" />
        <StatBox icon="📚" iconClass="si-b" value={active.filter(e => e.status === 'Teaching').length} label="Teaching" />
        <StatBox icon="🏢" iconClass="si-a" value={active.filter(e => e.status === 'Non-Teaching').length} label="Non-Teaching" />
        <StatBox icon="🎓" iconClass="si-g" value={active.filter(e => e.status === 'Teaching Related').length} label="Teaching Related" />
      </div>

      <div className="card">
        <div className="ch" style={{ background: 'linear-gradient(90deg,#1e3a6e,#2d5a9e)', color: 'white' }}>
          🏫 School Admin — Personnel Management
        </div>
        <div className="toolbar no-print">
          <div className="toolbar-left">
            <button className="btn b-grn" onClick={() => { setEditEmp(null); setRegOpen(true); }}>➕ Register New Personnel</button>
            <div className="srch">
              <span className="sri">🔍</span>
              <input type="text" placeholder="Search name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="toolbar-filters">
            <select className="tb-filter" value={fCat} onChange={e => setFCat(e.target.value)}>
              <option value="">All Categories</option>
              <option value="Teaching">Teaching</option>
              <option value="Non-Teaching">Non-Teaching</option>
              <option value="Teaching Related">Teaching Related</option>
            </select>
            <select className="tb-filter" value={fAcct} onChange={e => setFAcct(e.target.value)}>
              <option value="">All Accounts</option>
              <option value="active">🟢 Active</option>
              <option value="inactive">🔴 Inactive</option>
            </select>
            <button className="tb-filter-clear no-print" onClick={() => { setSearch(''); setFCat(''); setFAcct(''); }}>✕ Clear</button>
          </div>
        </div>
        <div className="tw" style={{ maxHeight: 'none' }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ height: 44, width: '10%', fontSize: 12, textAlign: 'center' }}>Employee ID</th>
                <th style={{ width: '22%', fontSize: 12, textAlign: 'center' }}>Full Name</th>
                <th style={{ width: '10%', fontSize: 12, textAlign: 'center' }}>Category</th>
                <th style={{ width: '16%', fontSize: 12, textAlign: 'center' }}>Position</th>
                <th style={{ width: '18%', fontSize: 12, textAlign: 'center' }}>School / Office</th>
                <th style={{ width: '10%', fontSize: 12, textAlign: 'center' }}>Account</th>
                <th className="no-print" style={{ width: '14%', fontSize: 12, textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--mu)', fontStyle: 'italic' }}>No personnel found.</td></tr>
              ) : filtered.map(e => {
                const isT = e.status === 'Teaching';
                const isTR = e.status === 'Teaching Related';
                const inactive = e.account_status === 'inactive';
                return (
                  <tr key={e.id} style={inactive ? { opacity: 0.6 } : {}}>
                    <td style={{ textAlign: 'center' }}><b style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>{e.id}</b></td>
                    <td style={{ textAlign: 'left', fontWeight: 600, paddingLeft: 10 }}>
                      {(e.surname || '').toUpperCase()}, {e.given || ''} {e.suffix || ''}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${isT ? 'bt' : isTR ? 'bnt' : 'bnt'}`}
                        style={isTR ? { background: '#e0f2fe', color: '#0369a1' } : {}}>
                        {e.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{(e.pos || '').toUpperCase()}</td>
                    <td style={{ textAlign: 'center' }}>{(e.school || '').toUpperCase()}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: inactive ? '#fee2e2' : '#d1fae5', color: inactive ? '#9b1c1c' : '#065f46' }}>
                        {inactive ? '🔴 Inactive' : '🟢 Active'}
                      </span>
                    </td>
                    <td className="no-print" style={{ textAlign: 'center' }}>
                      <button className="btn b-amb" style={{ height: 34, padding: '0 18px', fontSize: 12 }}
                        onClick={() => { setEditEmp(e); setRegOpen(true); }}>✏ Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {regOpen && (
        <RegisterModal employee={editEmp} onClose={() => { setRegOpen(false); setEditEmp(null); }} onSaved={handleSaved} />
      )}
    </>
  );
}
