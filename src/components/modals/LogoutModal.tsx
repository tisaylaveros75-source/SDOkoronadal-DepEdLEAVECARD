'use client';
import { useAppStore } from '@/hooks/useAppStore';
import { isUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';

// ── LogoutModal ────────────────────────────────────────────────
export function LogoutModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useAppStore();
  function doLogout() {
    dispatch({ type: 'LOGOUT' });
    sessionStorage.removeItem('deped_session');
    onClose();
  }
  return (
    <div className="mo open">
      <div className="mb xsm">
        <div className="mh"><h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '1.2rem', color: 'var(--g1)' }}>Until next time</h3><button className="btn b-slt b-sm" onClick={onClose}>✕</button></div>
        <div className="md" style={{ textAlign: 'center', padding: '36px 28px 28px' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,var(--g1),var(--g2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', boxShadow: '0 4px 18px rgba(26,92,66,.25)' }}>
            <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>🔒</span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--cha)', marginBottom: 6 }}>Log out of the system?</p>
          <p style={{ fontSize: 12, color: 'var(--mu)', lineHeight: 1.6 }}>You will be returned to the login screen.</p>
        </div>
        <div className="mf" style={{ gap: 10 }}>
          <button className="btn b-slt" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn b-red" style={{ flex: 1 }} onClick={doLogout}>🔒 Logout</button>
        </div>
      </div>
    </div>
  );
}

export default LogoutModal;
