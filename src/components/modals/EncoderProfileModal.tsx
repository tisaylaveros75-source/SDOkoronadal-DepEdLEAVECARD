'use client';
import { useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall } from '@/lib/api';

// ── Encoder Profile Modal ──────────────────────────────────────
export default function EncoderProfileModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useAppStore();
  const [name, setName]   = useState(state.encoderCfg.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { setError('Display name cannot be empty.'); return; }
    setSaving(true);
    const res = await apiCall('save_encoder', { name: name.trim() });
    setSaving(false);
    if (!res.ok) { setError(res.error || 'Save failed.'); return; }
    dispatch({ type: 'SET_ADMIN_CFG', payload: { encoder: { name: name.trim() } } });
    onClose();
  }

  return (
    <div className="mo open">
      <div className="mb xsm">
        <div className="mh"><h3>Encoder Profile</h3><button className="btn b-slt b-sm" onClick={onClose}>✕</button></div>
        <div className="md">
          <p style={{ fontSize: 12, color: 'var(--mu)', marginBottom: 16, lineHeight: 1.65 }}>You can update your display name. Contact the Admin to change your login ID or password.</p>
          <div className="sdiv">Display Name</div>
          <div className="ig" style={{ marginBottom: 4 }}>
            <div className="f" style={{ gridColumn: 'span 2' }}>
              <label>Name Shown in Topbar</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} />
            </div>
          </div>
          {error && <p style={{ color: 'var(--rd)', fontSize: 11.5, marginTop: 8 }}>{error}</p>}
        </div>
        <div className="mf">
          <button className="btn b-slt" onClick={onClose}>Cancel</button>
          <button className="btn b-pri" onClick={handleSave} disabled={saving}>{saving ? '⏳…' : '💾 Save'}</button>
        </div>
      </div>
    </div>
  );
}
