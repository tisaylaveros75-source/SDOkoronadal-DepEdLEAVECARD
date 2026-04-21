'use client';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import { Topbar, Sidebar } from '@/components/Navigation';
import AdminProfileModal from '@/components/modals/AdminProfileModal';
import HomepagePage from '@/components/pages/HomepagePage';
import PersonnelListPage from '@/components/pages/PersonnelListPage';
import LeaveCardsPage from '@/components/pages/LeaveCardsPage';
import SchoolAdminPage from '@/components/pages/SchoolAdminPage';
import UserPage from '@/components/pages/UserPage';
import NTCardPage from '@/components/pages/NTCardPage';
import TCardPage from '@/components/pages/TCardPage';
import { apiCall } from '@/lib/api';
import type { Personnel } from '@/types';

export default function AppScreen() {
  const { state, dispatch } = useAppStore();
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const isEmployee = state.role === 'employee';

  // ── Pre-load every employee's records immediately after login ──────────
  // Uses a Set of already-fetched IDs instead of a single boolean flag.
  // This means:
  //   • Initial load: fetches everyone with no records
  //   • New employee registered mid-session: their ID isn't in the Set yet,
  //     so the effect re-runs and fetches them automatically
  //   • No duplicate fetches: ID is added to the Set before the await
  const loadedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!state.isAdmin && !state.isEncoder) return;
    if (state.db.length === 0) return;

    // Only employees whose records we haven't fetched yet
    const missing = state.db.filter(
      e => !loadedIdsRef.current.has(e.id) && (!e.records || e.records.length === 0)
    );
    if (missing.length === 0) return;

    // Mark immediately to prevent duplicate fetches on rapid re-renders
    missing.forEach(e => loadedIdsRef.current.add(e.id));

    const fetchMissing = async () => {
      for (const e of missing) {
        try {
          const res = await apiCall('get_records', { employee_id: e.id }, 'GET');
          if (res.ok && res.records) {
            dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id: e.id, records: res.records } });
          }
        } catch {
          // Remove from set so it retries on next render
          loadedIdsRef.current.delete(e.id);
        }
      }
    };

    fetchMissing();
  // Runs whenever db size changes (new employee added) or role changes (new login)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.db.length, state.isAdmin, state.isEncoder]);

  function handleNavigate(page: string) {
    dispatch({ type: 'SET_PAGE', payload: page as never });
    try {
      const raw = sessionStorage.getItem('deped_session');
      if (raw) {
        const s = JSON.parse(raw);
        sessionStorage.setItem('deped_session', JSON.stringify({ ...s, page }));
      }
    } catch { /* ignore */ }
  }

  function handleLogout() {
    dispatch({ type: 'LOGOUT' });
    sessionStorage.removeItem('deped_session');
    loadedIdsRef.current = new Set(); // reset so next login re-fetches
  }

  async function handleOpenCard(id: string) {
    const emp = state.db.find(e => e.id === id) as Personnel | undefined;
    const page = emp?.status === 'Teaching' ? 't' : 'nt';
    try {
      const raw = sessionStorage.getItem('deped_session');
      if (raw) {
        const s = JSON.parse(raw);
        sessionStorage.setItem('deped_session', JSON.stringify({ ...s, curId: id, page }));
      }
    } catch { /* ignore */ }

    dispatch({ type: 'SET_CUR_ID', payload: id });

    if (!emp?.records || emp.records.length === 0) {
      try {
        const res = await apiCall('get_records', { employee_id: id }, 'GET');
        if (res.ok && res.records) {
          dispatch({ type: 'SET_EMPLOYEE_RECORDS', payload: { id, records: res.records } });
        }
      } catch { /* navigate anyway */ }
    }

    dispatch({ type: 'SET_PAGE', payload: page });
  }

  function renderPage() {
    const p = state.page;
    if (isEmployee) return <UserPage onLogout={handleLogout} />;
    if (state.isSchoolAdmin) {
      if (p === 'sa') return <SchoolAdminPage />;
      return <HomepagePage showLeaveStats={false} />;
    }
    if (state.isAdmin || state.isEncoder) {
      if (p === 'list')  return <PersonnelListPage onOpenCard={handleOpenCard} />;
      if (p === 'cards') return <LeaveCardsPage onOpenCard={handleOpenCard} />;
      if (p === 'nt')    return <NTCardPage onBack={() => handleNavigate('cards')} />;
      if (p === 't')     return <TCardPage onBack={() => handleNavigate('cards')} />;
      // Pass onOpenCard so HomepagePage employee list items can navigate directly
      return <HomepagePage showLeaveStats={true} onOpenCard={handleOpenCard} />;
    }
    return null;
  }

  return (
    <div id="s-app" className="screen active">
      {!isEmployee && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onNavigate={handleNavigate}
          currentPage={state.page}
        />
      )}
      <Topbar
        onMenuClick={() => setSidebarOpen(true)}
        showMenu={!isEmployee}
        onLogout={handleLogout}
        showLogoutBtn={isEmployee}
        showSettings={state.isAdmin && !state.isEncoder}
        onSettingsClick={() => setShowAccounts(true)}
      />
      <div className="ca">
        {renderPage()}
      </div>
      {showAccounts && <AdminProfileModal onClose={() => setShowAccounts(false)} />}
      <div id="printPageHeader" />
      <div id="pdfArea" />
    </div>
  );
}
