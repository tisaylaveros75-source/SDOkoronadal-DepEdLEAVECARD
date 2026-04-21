'use client';
import { useState } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import AdminProfileModal from '@/components/modals/AdminProfileModal';
import EncoderProfileModal from '@/components/modals/EncoderProfileModal';
import SAProfileModal from '@/components/modals/SAProfileModal';
import LogoutModal from '@/components/modals/LogoutModal';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
  currentPage: string;
}

export function Sidebar({ open, onClose, onNavigate, currentPage }: SidebarProps) {
  const { state } = useAppStore();
  const [showEncoderProfile, setShowEncoderProfile] = useState(false);
  const [showSAProfile,      setShowSAProfile]      = useState(false);
  const [showLogout,         setShowLogout]         = useState(false);

  const displayName = state.isSchoolAdmin
    ? state.schoolAdminCfg.name
    : state.isEncoder
      ? state.encoderCfg.name
      : state.adminCfg.name;

  const roleLabel = state.isSchoolAdmin
    ? 'School Admin · Edit Profile'
    : state.isEncoder
      ? 'Encoder · Edit Profile'
      : 'Administrator';

  function handleUserChipClick() {
    // Admin profile is now in the topbar — only encoder/SA use this chip
    onClose();
    if (state.isSchoolAdmin)  setShowSAProfile(true);
    else if (state.isEncoder) setShowEncoderProfile(true);
  }

  // ── Nav items per role ────────────────────────────────────
  const navItems = state.isSchoolAdmin
    ? [
        { id: 'home', icon: '🏠', label: 'Home' },
        { id: 'sa',   icon: '🏫', label: 'Personnel Management' },
      ]
    : [
        { id: 'home',  icon: '🏠', label: 'Home' },
        { id: 'list',  icon: '👥', label: 'Personnel List' },
        { id: 'cards', icon: '📋', label: 'Leave Cards' },
      ];

  return (
    <>
      <div className={`sb-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`sidebar${open ? ' open' : ''}`}>
        <div className="sb-head">
          <img
            className="sb-logo"
            src="https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2019/11/korlogo.jpg"
            alt="SDO"
            onError={e => {
              e.currentTarget.src =
                'https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2020/05/korlogo2.jpg';
            }}
          />
          <div className="sb-brand">
            <div className="sb-brand-title">SDO City of Koronadal</div>
            <div className="sb-brand-sub">DepEd Region XII · Leave Management</div>
          </div>
          <button className="sb-close" onClick={onClose}>✕</button>
        </div>

        {/* User chip — clicking opens profile for encoder/SA only */}
        <div
          className="sb-user"
          onClick={!state.isAdmin ? handleUserChipClick : undefined}
          style={{ cursor: state.isAdmin ? 'default' : 'pointer' }}
        >
          <div className="sb-av">{(displayName || 'A')[0].toUpperCase()}</div>
          <div>
            <div className="sb-uname">{displayName}</div>
            <div className="sb-urole">{roleLabel}</div>
          </div>
        </div>

        <nav className="sb-nav">
          {navItems.map(item => (
            <div
              key={item.id}
              className={`sb-item${currentPage === item.id ? ' active' : ''}`}
              onClick={() => { onNavigate(item.id); onClose(); }}
            >
              <span className="sb-icon">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
          <div className="sb-divider" />
          <div className="sb-item danger" onClick={() => { onClose(); setShowLogout(true); }}>
            <span className="sb-icon">🔒</span>
            <span>Logout</span>
          </div>
        </nav>
      </div>

      {showEncoderProfile && <EncoderProfileModal onClose={() => setShowEncoderProfile(false)} />}
      {showSAProfile      && <SAProfileModal      onClose={() => setShowSAProfile(false)} />}
      {showLogout         && <LogoutModal         onClose={() => setShowLogout(false)} />}
    </>
  );
}

interface TopbarProps {
  onMenuClick: () => void;
  showMenu: boolean;
  onLogout: () => void;
  showLogoutBtn?: boolean;
  showSettings?: boolean;
  onSettingsClick?: () => void;
}

export function Topbar({ onMenuClick, showMenu, onLogout, showLogoutBtn, showSettings, onSettingsClick }: TopbarProps) {
  return (
    <div className="topbar no-print">
      <div className="tb-in">
        <div className="tb-brand">
          {showMenu && (
            <>
              <button className="sb-toggle" onClick={onMenuClick} title="Menu">☰</button>
              <div className="tb-divider" />
            </>
          )}
          <img
            className="tb-logo"
            src="https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2019/11/korlogo.jpg"
            alt="SDO"
            onError={e => {
              e.currentTarget.src =
                'https://lrmdskorcitydiv.wordpress.com/wp-content/uploads/2020/05/korlogo2.jpg';
            }}
          />
          <div className="tb-divider" />
          <div className="tb-text">
            <div className="tb-title">SDO City of Koronadal — DepEd Region XII</div>
            <div className="tb-sub">Employee Records &amp; Leave Management System</div>
          </div>
        </div>
        <div className="tb-nav">
          {showSettings && (
            <button
              className="nb"
              onClick={onSettingsClick}
              title="Account Management"
              style={{ gap: 6 }}
            >
              ⚙️ <span style={{ fontSize: 11 }}>Accounts</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
