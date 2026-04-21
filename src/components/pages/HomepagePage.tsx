'use client';
import { useMemo, useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { isCardUpdatedThisMonth, currentMonthLabel } from '@/components/StatsRow';

const JEOAN_PHOTO  = 'https://raw.githubusercontent.com/jenlynorberte65-tech/SDOKORONADALCITY_LEAVECARD/main/src/developers/jeoan.jpg';
const JANICE_PHOTO = 'https://raw.githubusercontent.com/jenlynorberte65-tech/SDOKORONADALCITY_LEAVECARD/main/src/developers/janice.jpg';


interface Props {
  showLeaveStats?: boolean;
  onOpenCard?: (id: string) => void;
}

export default function HomepagePage({ showLeaveStats = true, onOpenCard }: Props) {
  const { state } = useAppStore();
  const aboutRef = useRef<HTMLDivElement>(null);

  // Track which panel is open: 'updated' | 'pending' | null
  const [openPanel, setOpenPanel] = useState<'updated' | 'pending' | null>(null);

  const all             = useMemo(() => state.db, [state.db]);
  const active          = useMemo(() => state.db.filter(e => e.account_status !== 'inactive'), [state.db]);

  const teaching        = useMemo(() => all.filter(e => (e.status ?? '').toLowerCase() === 'teaching').length, [all]);
  const nonTeaching     = useMemo(() => all.filter(e => (e.status ?? '').toLowerCase() === 'non-teaching').length, [all]);
  const teachingRelated = useMemo(() => all.filter(e => (e.status ?? '').toLowerCase() === 'teaching related').length, [all]);

  // Split active employees into updated / pending lists
  const { updatedList, pendingList } = useMemo(() => {
    const updated: typeof active = [];
    const pending: typeof active = [];
    for (const e of active) {
      if (isCardUpdatedThisMonth(e.records ?? [], e.status ?? '', e.lastEditedAt)) {
        updated.push(e);
      } else {
        pending.push(e);
      }
    }
    // Sort both lists alphabetically by surname
    const sort = (arr: typeof active) =>
      [...arr].sort((a, b) => (a.surname ?? '').localeCompare(b.surname ?? ''));
    return { updatedList: sort(updated), pendingList: sort(pending) };
  }, [active]);

  const updatedCount = updatedList.length;
  const pendingCount = pendingList.length;
  const monthLabel   = currentMonthLabel();

  useEffect(() => {
    const els = document.querySelectorAll('.hp-reveal');
    const obs = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          (en.target as HTMLElement).style.opacity = '1';
          (en.target as HTMLElement).style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const roleName =
    state.role === 'admin'        ? (state.adminCfg.name       || 'Administrator') :
    state.role === 'encoder'      ? (state.encoderCfg.name     || 'Encoder')       :
    state.role === 'school_admin' ? (state.schoolAdminCfg.name || 'School Admin')  : 'User';

  function handleEmployeeClick(id: string) {
    if (onOpenCard) onOpenCard(id);
  }

  function togglePanel(panel: 'updated' | 'pending') {
    setOpenPanel(prev => prev === panel ? null : panel);
  }

  return (
    <div style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* ── Hero Banner ─────────────────────────────────────── */}
      <div style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16, marginBottom: 28,
        background: 'linear-gradient(135deg, #1a0000 0%, #4a0a0a 40%, #8b1a1a 70%, #6b1212 100%)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        minHeight: 220,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '36px 48px', gap: 24,
      }}>
        <div style={{ position:'absolute', top:-60, right:-60, width:260, height:260, borderRadius:'50%', background:'rgba(255,255,255,0.03)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-80, left:200, width:320, height:320, borderRadius:'50%', background:'rgba(255,255,255,0.02)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:20, left:'38%', width:2, height:'80%', background:'rgba(255,255,255,0.07)', pointerEvents:'none' }} />

        <div style={{ display:'flex', alignItems:'center', gap:24, zIndex:1, flex:1 }}>
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: 'radial-gradient(circle, #ef4444, #991b1b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, flexShrink: 0,
            boxShadow: '0 0 0 4px rgba(239,68,68,0.25)',
          }}>🎓</div>
          <div>
            <div style={{ color:'rgba(255,255,255,0.55)', fontSize:11, letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>
              Republic of the Philippines
            </div>
            <div style={{ color:'#fff', fontSize:22, fontWeight:700, lineHeight:1.2 }}>
              Department of Education
            </div>
            <div style={{ color:'#fca5a5', fontSize:14, fontWeight:600, marginTop:4 }}>
              Schools Division of Koronadal City
            </div>
            <div style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginTop:6 }}>
              Leave Management Information System
            </div>
          </div>
        </div>

        <div style={{ textAlign:'right', zIndex:1, flexShrink:0 }}>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>Welcome back</div>
          <div style={{ color:'#fff', fontSize:20, fontWeight:700 }}>{roleName}</div>
          <div style={{ color:'rgba(255,255,255,0.4)', fontSize:11, marginTop:8 }}>
            {new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: showLeaveStats ? 'repeat(auto-fit, minmax(170px, 1fr))' : 'repeat(4, 1fr)',
        gap: 16, marginBottom: showLeaveStats && openPanel ? 0 : 28,
      }}>
        <StatCard icon="👥" value={all.length}     label="Total Encoded"    color="#7f1d1d" bg="#fff0f0" delay={0}   />
        <StatCard icon="📚" value={teaching}        label="Teaching"         color="#991b1b" bg="#fee2e2" delay={80}  />
        <StatCard icon="🏢" value={nonTeaching}     label="Non-Teaching"     color="#6b1a1a" bg="#fecaca" delay={160} />
        <StatCard icon="🎓" value={teachingRelated} label="Teaching Related" color="#1e40af" bg="#dbeafe" delay={240} />

        {showLeaveStats && <>
          {/* Clickable Updated card */}
          <StatCard
            icon="✅"
            value={updatedCount}
            label={`Updated (${monthLabel})`}
            color="#065f46"
            bg="#d1fae5"
            delay={320}
            active={openPanel === 'updated'}
            onClick={() => togglePanel('updated')}
            clickable
          />
          {/* Clickable Pending card */}
          <StatCard
            icon="⏳"
            value={pendingCount}
            label="Not Yet Updated"
            color="#991b1b"
            bg="#fee2e2"
            delay={400}
            active={openPanel === 'pending'}
            onClick={() => togglePanel('pending')}
            clickable
          />
        </>}
      </div>

      {/* ── Expandable Employee Panels ───────────────────────── */}
      {showLeaveStats && openPanel && (
        <div style={{
          marginBottom: 28,
          borderRadius: 14,
          border: `2px solid ${openPanel === 'updated' ? '#6ee7b7' : '#fca5a5'}`,
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          animation: 'fadeSlideIn 0.22s ease',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '14px 20px',
            background: openPanel === 'updated'
              ? 'linear-gradient(90deg,#065f46,#047857)'
              : 'linear-gradient(90deg,#7f1d1d,#991b1b)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
              {openPanel === 'updated'
                ? `✅ Updated — ${monthLabel} (${updatedCount} employee${updatedCount !== 1 ? 's' : ''})`
                : `⏳ Not Yet Updated — ${monthLabel} (${pendingCount} employee${pendingCount !== 1 ? 's' : ''})`}
            </span>
            <button
              onClick={() => setOpenPanel(null)}
              style={{
                background: 'rgba(255,255,255,0.15)', border: 'none',
                color: '#fff', borderRadius: 6, padding: '4px 10px',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
              }}
            >✕ Close</button>
          </div>

          {/* Employee list */}
          <div style={{
            background: '#fff',
            maxHeight: 340,
            overflowY: 'auto',
            padding: '10px 16px',
          }}>
            {(openPanel === 'updated' ? updatedList : pendingList).length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
                {openPanel === 'updated' ? 'No updated employees yet this month.' : 'All employees are up to date! 🎉'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 8, paddingBottom: 8 }}>
                {(openPanel === 'updated' ? updatedList : pendingList).map(e => {
                  const isT = (e.status ?? '').toLowerCase() === 'teaching';
                  return (
                    <button
                      key={e.id}
                      onClick={() => handleEmployeeClick(e.id)}
                      title={`Open leave card for ${e.surname}, ${e.given}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 13px', borderRadius: 8,
                        border: `1.5px solid ${openPanel === 'updated' ? '#a7f3d0' : '#fca5a5'}`,
                        background: openPanel === 'updated' ? '#f0fdf4' : '#fff5f5',
                        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                        fontSize: 12, fontWeight: 500,
                        transition: 'all .15s',
                        textAlign: 'left',
                      }}
                      onMouseEnter={ev => {
                        (ev.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                        (ev.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={ev => {
                        (ev.currentTarget as HTMLButtonElement).style.transform = '';
                        (ev.currentTarget as HTMLButtonElement).style.boxShadow = '';
                      }}
                    >
                      {/* Category badge */}
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 10, fontWeight: 700,
                        background: isT ? '#ddeeff' : '#e8f5ee',
                        color: isT ? '#1e3a6e' : '#1a5c42',
                        flexShrink: 0,
                      }}>
                        {e.status}
                      </span>
                      {/* Name */}
                      <span style={{ fontWeight: 700, color: '#1e2530' }}>
                        {(e.surname ?? '').toUpperCase()}, {e.given ?? ''}{e.suffix ? ` ${e.suffix}` : ''}
                      </span>
                      {/* ID */}
                      <span style={{ fontSize: 10, color: '#6b7a8d', fontFamily: "'JetBrains Mono', monospace" }}>
                        {e.id}
                      </span>
                      {/* Arrow hint */}
                      <span style={{ fontSize: 10, color: openPanel === 'updated' ? '#059669' : '#dc2626', marginLeft: 2 }}>
                        →
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Hint footer */}
          <div style={{
            padding: '8px 20px',
            background: '#f9fafb',
            borderTop: '1px solid #e5e7eb',
            fontSize: 11, color: '#9ca3af', fontStyle: 'italic',
          }}>
            Click any name to open their leave card directly.
          </div>
        </div>
      )}

      {/* ── Division Photo Section ───────────────────────────── */}
      <div className="hp-reveal" style={{
        borderRadius: 14, overflow:'hidden', marginBottom: 28,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        opacity: 0, transform: 'translateY(24px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #1a0000, #4a0a0a)',
          padding: '18px 28px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🏫</span>
          <span style={{ color:'#fca5a5', fontWeight:700, fontSize:15 }}>
            SDO Koronadal City — Division Office
          </span>
        </div>
        <div style={{
          background: 'linear-gradient(160deg, #1a0000 0%, #2a0505 50%, #1a0000 100%)',
          minHeight: 280,
          display: 'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap: 12, padding: 40,
        }}>
          <div style={{ fontSize: 64 }}>🏛️</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#fca5a5', textAlign:'center' }}>
            Schools Division Office of Koronadal City
          </div>
          <div style={{ color: '#fecaca', fontSize: 12, textAlign:'center', maxWidth: 480, lineHeight: 1.7 }}>
            Committed to providing quality, accessible, relevant, and liberating basic education
            for every Filipino child. — DepEd Mission
          </div>
          <div style={{ marginTop: 8, padding: '6px 20px', background: '#7f1d1d', color:'#fca5a5', borderRadius: 20, fontSize: 11, letterSpacing: 1, border: '1px solid #991b1b' }}>
            Koronadal City, South Cotabato
          </div>
        </div>
      </div>

      {/* ── About the Developers ─────────────────────────────── */}
      <div ref={aboutRef} className="hp-reveal" style={{
        borderRadius: 16, overflow:'hidden', marginBottom: 12,
        boxShadow: '0 8px 32px rgba(220,100,160,0.18), 0 2px 8px rgba(200,80,140,0.10)',
        opacity: 0, transform: 'translateY(24px)',
        transition: 'opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s',
        border: '1.5px solid #f9c8e0',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #be185d 0%, #9d174d 50%, #831843 100%)',
          padding: '20px 32px',
          display: 'flex', alignItems: 'center', justifyContent:'center', gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>🌸</span>
          <span style={{ color:'#fff', fontWeight:700, fontSize:16, letterSpacing:1, textTransform:'uppercase' }}>About the Developers</span>
          <span style={{ fontSize: 22 }}>🌸</span>
        </div>

        <div style={{ background:'linear-gradient(135deg, #fff0f6 0%, #ffe4f0 40%, #fce8f8 100%)', padding: '32px 36px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fff, #fce7f3)',
            border: '1.5px solid #fbcfe8',
            borderRadius: 12, padding: '18px 28px',
            marginBottom: 28, textAlign:'center',
            boxShadow: '0 2px 12px rgba(236,72,153,0.08)',
          }}>
            <p style={{ color:'#9d174d', fontSize:13, lineHeight:1.9, margin: 0 }}>
              This system was built to help the HR department of SDO Koronadal City lessen
              the hassle of manually finding and writing leave cards — a process that often
              leads to human error. We just wanted to make their work a little easier.
            </p>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            <DeveloperCard
              name="Jeoan Gwyneth Dajay Gran"
              contact="09127977245"
              location="Koronadal City"
              photo={JEOAN_PHOTO}
              accentColor="#f472b6"
              gradientTop="linear-gradient(135deg, #ffd6e8, #ff9ec8)"
              badgeBg="#ffe0f0"
              badgeColor="#b03070"
              badge="Frontend"
              hearts="🩷 🌸 🩷"
            />
            <DeveloperCard
              name="Janice Luis Laveros"
              contact="09531989302"
              location="Isulan, Sultan Kudarat"
              photo={JANICE_PHOTO}
              accentColor="#ec4899"
              gradientTop="linear-gradient(135deg, #fbb6ce, #f9a8d4)"
              badgeBg="#fce7f3"
              badgeColor="#9d174d"
              badge="Backend"
              hearts="🩷 🌺 🩷"
            />
          </div>

          <div style={{ marginTop: 28, textAlign:'center', padding:'18px 0', borderTop:'1.5px solid #fbcfe8' }}>
            <div style={{ color:'#be185d', fontSize:11, letterSpacing:1.5, textTransform:'uppercase', fontWeight:700 }}>
              BS Information Technology · STI College of Koronadal
            </div>
            <div style={{ color:'#be185d', fontSize:10, marginTop:6, letterSpacing:1 }}>
              © {new Date().getFullYear()} SDO Koronadal City Leave Management System
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────
function StatCard({ icon, value, label, color, bg, delay, onClick, clickable, active }: {
  icon: string; value: number; label: string;
  color: string; bg: string; delay: number;
  onClick?: () => void;
  clickable?: boolean;
  active?: boolean;
}) {
  return (
    <div
      className="hp-reveal"
      onClick={onClick}
      style={{
        background: active ? `${color}18` : bg,
        borderRadius: 12, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        boxShadow: active
          ? `0 0 0 2px ${color}, 0 4px 16px ${color}33`
          : '0 2px 12px rgba(0,0,0,0.10)',
        border: `1.5px solid ${active ? color : color + '33'}`,
        opacity: 0, transform: 'translateY(16px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms, box-shadow 0.15s, border-color 0.15s`,
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: `${color}22`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize: 22, flexShrink:0,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: `${color}99`, marginTop: 3, fontWeight: 600, letterSpacing: 0.5 }}>{label}</div>
      </div>
      {clickable && (
        <div style={{ fontSize: 11, color: `${color}88`, fontWeight: 700 }}>
          {active ? '▲' : '▼'}
        </div>
      )}
    </div>
  );
}

// ── DeveloperCard ─────────────────────────────────────────────
function DeveloperCard({ name, contact, location, photo, accentColor, gradientTop, badgeBg, badgeColor, badge, hearts }: {
  name: string; contact: string; location: string; photo: string;
  accentColor: string; gradientTop: string; badgeBg: string; badgeColor: string;
  badge: string; hearts: string;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 18, padding: '0 0 22px',
      border: `1.5px solid ${accentColor}66`,
      boxShadow: `0 4px 24px ${accentColor}22, 0 1px 6px ${accentColor}11`,
      display: 'flex', flexDirection:'column', alignItems:'center',
      textAlign:'center', overflow:'hidden', position:'relative',
      transition: 'transform 0.2s, box-shadow 0.2s',
    }}>
      <div style={{ width:'100%', height: 80, background: gradientTop, flexShrink: 0 }} />
      <div style={{
        marginTop: -54, marginBottom: 12,
        width: 108, height: 108, borderRadius: '50%', overflow: 'hidden',
        border: '4px solid white',
        boxShadow: `0 4px 18px ${accentColor}44`,
        flexShrink: 0,
        background: '#fde8f4',
      }}>
        <img src={photo} alt={name}
          style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'top center' }} />
      </div>
      <div style={{ fontWeight:700, fontSize:14, color:'#6b1040', marginBottom:3, padding:'0 16px' }}>{name}</div>
      <div style={{
        display:'inline-block', marginBottom:12,
        padding:'3px 14px', borderRadius:20,
        fontSize:9, fontWeight:700, letterSpacing:.8, textTransform:'uppercase',
        background: badgeBg, color: badgeColor,
      }}>{badge}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6, width:'100%', padding:'0 18px' }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background: `${accentColor}11`, borderRadius:8, padding:'7px 12px',
          border: `1px solid ${accentColor}33`,
        }}>
          <span style={{ fontSize:13 }}>📞</span>
          <span style={{ fontSize:12, color: accentColor, fontWeight:600, fontFamily:"'Courier New',monospace" }}>{contact}</span>
        </div>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          background:'#fdf0f8', borderRadius:8, padding:'7px 12px',
          border: `1px solid ${accentColor}22`,
        }}>
          <span style={{ fontSize:13 }}>📍</span>
          <span style={{ fontSize:12, color:'#9d174d', fontWeight:500 }}>{location}</span>
        </div>
      </div>
      <div style={{ marginTop:10, fontSize:12, opacity:.5, letterSpacing:3 }}>{hearts}</div>
    </div>
  );
}
