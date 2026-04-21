'use client';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';

export default function CardStatusModal({ onClose }: { onClose: () => void }) {
  const { state } = useAppStore();
  const monthLabel = currentMonthLabel();

  const active = state.db
    .filter(e => e.account_status !== 'inactive')
    .sort((a, b) => (a.surname || '').localeCompare(b.surname || ''));

  const upd  = active.filter(e =>  isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt));
  const nupd = active.filter(e => !isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt));

  return (
    <div className="mo open">
      <div className="mb" style={{ maxWidth: 700 }}>
        <div className="mh">
          <h3>📊 Leave Card Update Status — {monthLabel}</h3>
          <button className="btn b-slt b-sm" onClick={onClose}>✕</button>
        </div>
        <div className="md" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
                ✅ Updated ({upd.length})
              </div>
              {upd.length === 0
                ? <div style={{ fontSize: 11.5, color: 'var(--mu)', fontStyle: 'italic' }}>None yet</div>
                : upd.map(e => (
                  <div key={e.id} style={{ padding: '6px 10px', background: '#d1fae5', borderRadius: 6, marginBottom: 5, fontSize: 11.5, fontWeight: 600, color: '#065f46' }}>
                    {(e.surname || '').toUpperCase()}, {e.given || ''} <span style={{ fontSize: 9.5, opacity: .7 }}>({e.status})</span>
                  </div>
                ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c53030', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 8 }}>
                ⏳ Not Yet Updated ({nupd.length})
              </div>
              {nupd.length === 0
                ? <div style={{ fontSize: 11.5, color: 'var(--mu)', fontStyle: 'italic' }}>All cards updated!</div>
                : nupd.map(e => (
                  <div key={e.id} style={{ padding: '6px 10px', background: '#fee2e2', borderRadius: 6, marginBottom: 5, fontSize: 11.5, fontWeight: 600, color: '#9b1c1c' }}>
                    {(e.surname || '').toUpperCase()}, {e.given || ''} <span style={{ fontSize: 9.5, opacity: .7 }}>({e.status})</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
