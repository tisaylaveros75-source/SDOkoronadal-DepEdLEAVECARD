'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { apiCall, validateDepedEmail } from '@/lib/api';
import type { SchoolAdminAccount } from '@/types';

interface AccountRow {
  id: number;
  name: string;
  login_id: string;
  password?: string;
  role: string;
}

type FormState = {
  open: boolean;
  id: number;
  name: string;
  email: string;
  pw: string;
  showPw: boolean;
  error: string;
};

const inputStyle = {
  height: 'var(--H)', padding: '0 12px', border: '1.5px solid var(--br)',
  borderRadius: 7, fontSize: 12, width: '100%', background: 'white',
  color: 'var(--cha)', fontFamily: 'Inter,sans-serif', boxSizing: 'border-box' as const,
};

function AccountForm({
  form, onChangeName, onChangeEmail, onChangePw, onTogglePw,
  onSave, onCancel, accentColor,
}: {
  form: FormState;
  onChangeName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePw: (v: string) => void;
  onTogglePw: () => void;
  onSave: () => void;
  onCancel: () => void;
  accentColor: string;
}) {
  const isNew = form.id === 0;
  return (
    <div style={{ background:'white', border:`1.5px dashed ${accentColor}`, borderRadius:8, padding:14, marginBottom:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:accentColor, marginBottom:10 }}>
        {isNew ? '➕ New Account' : '✏️ Edit Account'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div className="f" style={{ gridColumn:'span 2' }}>
          <label>Display Name <span style={{ color:'#e53e3e', fontSize:10 }}>*</span></label>
          <input style={inputStyle} value={form.name} onChange={e => onChangeName(e.target.value)} placeholder="e.g. Juan Dela Cruz" />
        </div>
        <div className="f" style={{ gridColumn:'span 2' }}>
          <label>Login Email <span style={{ color:'#e53e3e', fontSize:10 }}>(@deped.gov.ph) *</span></label>
          <input type="email" style={inputStyle} value={form.email} onChange={e => onChangeEmail(e.target.value)} placeholder="user@deped.gov.ph" />
        </div>
        <div className="f" style={{ gridColumn:'span 2' }}>
          <label>{isNew ? <><span>Password </span><span style={{ color:'#e53e3e', fontSize:10 }}>*</span></> : <><span>New Password </span><span style={{ color:'var(--mu)', fontSize:10 }}>(blank = keep)</span></>}</label>
          <div className="ew">
            <input type={form.showPw ? 'text' : 'password'} style={inputStyle} value={form.pw} onChange={e => onChangePw(e.target.value)} />
            <button className="eye-btn" type="button" onClick={onTogglePw}>{form.showPw ? '🙈' : '👁'}</button>
          </div>
        </div>
      </div>
      {form.error && <p style={{ color:'var(--rd)', fontSize:11, marginTop:8 }}>{form.error}</p>}
      <div style={{ display:'flex', gap:8, marginTop:12 }}>
        <button className="btn b-slt b-sm" onClick={onCancel}>Cancel</button>
        <button className="btn b-sm" style={{ background:accentColor, color:'white' }} onClick={onSave}>💾 Save Account</button>
      </div>
    </div>
  );
}

function AccountRowItem({ acc, accentColor, onEdit, onDelete }: {
  acc: AccountRow; accentColor: string;
  onEdit: () => void; onDelete: () => void;
}) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'white', border:`1px solid ${accentColor}33`, borderRadius:8, marginBottom:7 }}>
      <div style={{ width:32, height:32, borderRadius:'50%', background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, flexShrink:0 }}>
        {(acc.name || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:700, color:accentColor }}>{acc.name}</div>
        <div style={{ fontSize:10.5, color:'var(--mu)' }}>{acc.login_id}</div>
        <div style={{ fontSize:10.5, color:'var(--mu)', display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
          <span>🔑</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>{showPw ? (acc.password || '(not loaded)') : '••••••••'}</span>
          <button style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--mu)', padding:'0 2px' }} onClick={() => setShowPw(p => !p)}>{showPw ? '🙈' : '👁'}</button>
        </div>
      </div>
      <button className="btn b-sm" style={{ background:accentColor, color:'white', flexShrink:0 }} onClick={onEdit}>✏ Edit</button>
      <button className="btn b-sm b-red" style={{ flexShrink:0 }} onClick={onDelete}>🗑</button>
    </div>
  );
}

export default function AdminProfileModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useAppStore();
  const [admins,     setAdmins]     = useState<AccountRow[]>([]);
  const [encoders,   setEncoders]   = useState<AccountRow[]>([]);
  const [saAccounts, setSaAccounts] = useState<SchoolAdminAccount[]>([]);

  const emptyForm: FormState = { open:false, id:0, name:'', email:'', pw:'', showPw:false, error:'' };
  const [adminForm, setAdminForm] = useState<FormState>(emptyForm);
  const [encForm,   setEncForm]   = useState<FormState>(emptyForm);
  const [saForm,    setSaForm]    = useState<FormState>(emptyForm);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [ar, er, sr] = await Promise.all([
      apiCall('get_admin_cfg', { role: 'admin' },   'GET'),
      apiCall('get_admin_cfg', { role: 'encoder' }, 'GET'),
      apiCall('get_school_admins', {}, 'GET'),
    ]);
    if (ar.ok) setAdmins((ar as any).accounts || []);
    if (er.ok) setEncoders((er as any).accounts || []);
    if (sr.ok) setSaAccounts(sr.school_admins || []);
  }

  function openForm(setter: typeof setAdminForm, accounts: AccountRow[], id: number) {
    const found = id > 0 ? accounts.find(a => a.id === id) : null;
    setter({ open:true, id, name: found?.name||'', email: found?.login_id||'', pw:'', showPw:false, error:'' });
  }

  function openSaForm(id: number) {
    const sa = id > 0 ? saAccounts.find(x => x.id === id) : null;
    setSaForm({ open:true, id, name: sa?.name||'', email: sa?.login_id||'', pw:'', showPw:false, error:'' });
  }

  async function saveAdmin() {
    const f = adminForm;
    if (!f.name) { setAdminForm(p=>({...p,error:'Display name is required.'})); return; }
    const emailErr = validateDepedEmail(f.email.toLowerCase().trim());
    if (emailErr) { setAdminForm(p=>({...p,error:emailErr})); return; }
    if (f.id === 0 && !f.pw) { setAdminForm(p=>({...p,error:'Password is required for new accounts.'})); return; }
    if (f.pw && f.pw.length < 4) { setAdminForm(p=>({...p,error:'Min 4 characters.'})); return; }
    const res = await apiCall('save_admin', { role:'admin', account_id:f.id, name:f.name, login_id:f.email, ...(f.pw?{password:f.pw}:{}) });
    if (!res.ok) { setAdminForm(p=>({...p,error:res.error||'Save failed.'})); return; }
    dispatch({ type:'SET_ADMIN_CFG', payload:{ admin:{ name:f.name, id:f.email }, encoder:{ name:'', id:'' } } });
    setAdminForm(emptyForm);
    loadAll();
  }

  async function saveEncoder() {
    const f = encForm;
    if (!f.name) { setEncForm(p=>({...p,error:'Display name is required.'})); return; }
    const emailErr = validateDepedEmail(f.email.toLowerCase().trim());
    if (emailErr) { setEncForm(p=>({...p,error:emailErr})); return; }
    if (f.id === 0 && !f.pw) { setEncForm(p=>({...p,error:'Password is required for new accounts.'})); return; }
    if (f.pw && f.pw.length < 4) { setEncForm(p=>({...p,error:'Min 4 characters.'})); return; }
    const res = await apiCall('save_admin', { role:'encoder', account_id:f.id, name:f.name, login_id:f.email, ...(f.pw?{password:f.pw}:{}) });
    if (!res.ok) { setEncForm(p=>({...p,error:res.error||'Save failed.'})); return; }
    dispatch({ type:'SET_ADMIN_CFG', payload:{ admin:{ name:'', id:'' }, encoder:{ name:f.name, id:f.email } } });
    setEncForm(emptyForm);
    loadAll();
  }

  async function saveSa() {
    const f = saForm;
    if (!f.name) { setSaForm(p=>({...p,error:'Display name is required.'})); return; }
    const emailErr = validateDepedEmail(f.email.toLowerCase().trim());
    if (emailErr) { setSaForm(p=>({...p,error:emailErr})); return; }
    if (f.id === 0 && !f.pw) { setSaForm(p=>({...p,error:'Password is required for new accounts.'})); return; }
    const res = await apiCall('save_school_admin', { sa_id:f.id, name:f.name, login_id:f.email, ...(f.pw?{password:f.pw}:{}) });
    if (!res.ok) { setSaForm(p=>({...p,error:res.error||'Save failed.'})); return; }
    setSaForm(emptyForm);
    loadAll();
  }

  async function deleteAccount(role: 'admin'|'encoder', id: number, name: string) {
    if (!confirm(`Delete "${name}"?\nThis cannot be undone.`)) return;
    const res = await apiCall('save_admin', { role, account_id:id, _delete:true });
    if (!res.ok) { alert('Delete failed: ' + (res.error||'Unknown error')); return; }
    loadAll();
  }

  async function deleteSa(id: number, name: string) {
    if (!confirm(`Delete school admin "${name}"?\nThis cannot be undone.`)) return;
    const res = await apiCall('delete_school_admin', { sa_id:id });
    if (!res.ok) { alert('Delete failed: ' + (res.error||'Unknown error')); return; }
    loadAll();
  }

  return (
    <div className="mo open">
      <div className="mb" style={{ maxWidth:600 }}>
        <div className="mh">
          <h3>⚙️ Account Management</h3>
          <button className="btn b-slt b-sm" onClick={onClose}>✕</button>
        </div>
        <div className="md" style={{ padding:'18px 24px 10px' }}>

          {/* ── Admin Accounts ── */}
          <div style={{ border:'1.5px solid #1a5c42', borderRadius:10, padding:16, marginBottom:16, background:'linear-gradient(135deg,#f0fff4,#e6ffed)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,var(--g1),var(--g2))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>👑</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'var(--g1)' }}>Administrator Accounts</div>
                  <div style={{ fontSize:10, color:'var(--mu)' }}>Full system access — leave cards, personnel, settings</div>
                </div>
              </div>
              {!adminForm.open && <button className="btn b-sm" style={{ background:'#1a5c42', color:'white', flexShrink:0 }} onClick={()=>openForm(setAdminForm,admins,0)}>➕ Add</button>}
            </div>
            {admins.length === 0 && !adminForm.open && <p style={{ fontSize:11.5, color:'var(--g2)', fontStyle:'italic', padding:'4px 0 8px' }}>No admin accounts yet.</p>}
            {admins.map(a => <AccountRowItem key={a.id} acc={a} accentColor="#1a5c42" onEdit={()=>openForm(setAdminForm,admins,a.id)} onDelete={()=>deleteAccount('admin',a.id,a.name)} />)}
            {adminForm.open && <AccountForm form={adminForm} onChangeName={v=>setAdminForm(p=>({...p,name:v}))} onChangeEmail={v=>setAdminForm(p=>({...p,email:v}))} onChangePw={v=>setAdminForm(p=>({...p,pw:v}))} onTogglePw={()=>setAdminForm(p=>({...p,showPw:!p.showPw}))} onSave={saveAdmin} onCancel={()=>setAdminForm(emptyForm)} accentColor="#1a5c42" />}
          </div>

          {/* ── Encoder Accounts ── */}
          <div style={{ border:'1.5px solid var(--nb)', borderRadius:10, padding:16, marginBottom:16, background:'linear-gradient(135deg,#eff6ff,#dbeafe)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#1e3a6e,#2d5a9e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>✏️</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1e3a6e' }}>Encoder Accounts</div>
                  <div style={{ fontSize:10, color:'var(--mu)' }}>Can edit leave cards and personnel records</div>
                </div>
              </div>
              {!encForm.open && <button className="btn b-sm" style={{ background:'#1e3a6e', color:'white', flexShrink:0 }} onClick={()=>openForm(setEncForm,encoders,0)}>➕ Add</button>}
            </div>
            {encoders.length === 0 && !encForm.open && <p style={{ fontSize:11.5, color:'#1e3a6e', fontStyle:'italic', padding:'4px 0 8px' }}>No encoder accounts yet.</p>}
            {encoders.map(e => <AccountRowItem key={e.id} acc={e} accentColor="#1e3a6e" onEdit={()=>openForm(setEncForm,encoders,e.id)} onDelete={()=>deleteAccount('encoder',e.id,e.name)} />)}
            {encForm.open && <AccountForm form={encForm} onChangeName={v=>setEncForm(p=>({...p,name:v}))} onChangeEmail={v=>setEncForm(p=>({...p,email:v}))} onChangePw={v=>setEncForm(p=>({...p,pw:v}))} onTogglePw={()=>setEncForm(p=>({...p,showPw:!p.showPw}))} onSave={saveEncoder} onCancel={()=>setEncForm(emptyForm)} accentColor="#1e3a6e" />}
          </div>

          {/* ── School Admin Accounts ── */}
          <div style={{ border:'1.5px solid #7c3aed', borderRadius:10, padding:16, marginBottom:4, background:'linear-gradient(135deg,#faf5ff,#ede9fe)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#7c3aed,#a855f7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>🏫</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#5b21b6' }}>School Admin Accounts</div>
                  <div style={{ fontSize:10, color:'var(--mu)' }}>Can register &amp; edit personnel only — no leave card access</div>
                </div>
              </div>
              {!saForm.open && <button className="btn b-sm" style={{ background:'#7c3aed', color:'white', flexShrink:0 }} onClick={()=>openSaForm(0)}>➕ Add</button>}
            </div>
            {saAccounts.length === 0 && !saForm.open && <p style={{ fontSize:11.5, color:'#7c3aed', fontStyle:'italic', padding:'4px 0 8px' }}>No school admin accounts yet.</p>}
            {saAccounts.map(sa => <AccountRowItem key={sa.id} acc={{ id:sa.id, name:sa.name, login_id:sa.login_id, role:'school_admin' }} accentColor="#7c3aed" onEdit={()=>openSaForm(sa.id)} onDelete={()=>deleteSa(sa.id,sa.name)} />)}
            {saForm.open && <AccountForm form={saForm} onChangeName={v=>setSaForm(p=>({...p,name:v}))} onChangeEmail={v=>setSaForm(p=>({...p,email:v}))} onChangePw={v=>setSaForm(p=>({...p,pw:v}))} onTogglePw={()=>setSaForm(p=>({...p,showPw:!p.showPw}))} onSave={saveSa} onCancel={()=>setSaForm(emptyForm)} accentColor="#7c3aed" />}
          </div>

        </div>
        <div className="mf">
          <button className="btn b-slt" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
