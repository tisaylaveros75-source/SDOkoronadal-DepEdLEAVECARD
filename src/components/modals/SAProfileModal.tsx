'use client';
import { useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall } from '@/lib/api';

export default function SAProfileModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppStore();
  const [name, setName]   = useState(state.schoolAdminCfg.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError('Display name cannot be empty.'); return; }
    setSaving(true);
    const res = await apiCall('save_school_admin', { sa_id: state.schoolAdminCfg.dbId, name: name.trim(), login_id: state.schoolAdminCfg.id });
    setSaving(false);
    if (!res.ok) { setError('Save failed: ' + (res.error || '')); return; }
    dispatch({ type: 'SET_SCHOOL_ADMIN_NAME', payload: name.trim() });
    onClose();
  }

  return (
    <div className="mo open">
      <div className="mb xsm">
        <div className="mh"><h3>🏫 School Admin Profile</h3><button className="btn b-slt b-sm" onClick={onClose}>✕</button></div>
        <div className="md" style={{ padding: '20px 24px 12px' }}>
          <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16, lineHeight: 1.65 }}>You can update your display name. Contact the Admin to change your login email or password.</p>
          <div className="f" style={{ marginBottom: 6 }}>
            <label>Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} style={{ height: 40, padding: '0 12px', border: '1.5px solid var(--br)', borderRadius: 7, fontSize: 12, width: '100%', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: 'var(--rd)', fontSize: 11, marginTop: 6 }}>{error}</p>}
        </div>
        <div className="mf" style={{ gap: 10 }}>
          <button className="btn b-slt" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn b-pri" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? '⏳…' : '💾 Save'}</button>
        </div>
      </div>
    </div>
  );
}
