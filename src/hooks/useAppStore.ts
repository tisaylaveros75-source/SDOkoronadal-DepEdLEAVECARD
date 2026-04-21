'use client';
// ============================================================
//  hooks/useAppStore.ts — Global application state (React context)
// ============================================================

import { createContext, useContext, useReducer, useCallback, Dispatch } from 'react';
import type { Personnel, AdminConfig, SchoolAdminConfig, Page, UserRole } from '@/types';

// ── State shape ───────────────────────────────────────────────
export interface AppState {
  db: Personnel[];
  isAdmin: boolean;
  isEncoder: boolean;
  isSchoolAdmin: boolean;
  role: UserRole | null;
  curId: string | null;
  page: Page;
  adminCfg: AdminConfig;
  encoderCfg: AdminConfig;
  schoolAdminCfg: SchoolAdminConfig;
  loading: boolean;
}

// ── Actions ───────────────────────────────────────────────────
export type AppAction =
  | { type: 'SET_DB'; payload: Personnel[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_ADMIN'; payload: { name: string; loginId: string; isEncoder: boolean } }
  | { type: 'LOGIN_SCHOOL_ADMIN'; payload: { name: string; loginId: string; dbId: number } }
  | { type: 'LOGIN_EMPLOYEE'; payload: { curId: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_PAGE'; payload: Page }
  | { type: 'SET_CUR_ID'; payload: string | null }
  // Supports both:
  //   { type: 'UPDATE_EMPLOYEE', payload: Personnel }                                    (legacy)
  //   { type: 'UPDATE_EMPLOYEE', payload: { employee: Personnel; originalId: string } }  (new — when ID changed)
  | { type: 'UPDATE_EMPLOYEE'; payload: Personnel | { employee: Personnel; originalId: string } }
  | { type: 'ADD_EMPLOYEE'; payload: Personnel }
  | { type: 'SET_EMPLOYEE_RECORDS'; payload: { id: string; records: Personnel['records'] } }
  | { type: 'SET_ADMIN_CFG'; payload: { admin?: Partial<AdminConfig>; encoder?: Partial<AdminConfig> } }
  | { type: 'SET_SCHOOL_ADMIN_NAME'; payload: string };

// ── Initial state ─────────────────────────────────────────────
export const initialState: AppState = {
  db: [],
  isAdmin: false,
  isEncoder: false,
  isSchoolAdmin: false,
  role: null,
  curId: null,
  page: 'home',
  adminCfg:       { id: '', password: '', name: 'Administrator' },
  encoderCfg:     { id: '', password: '', name: 'Encoder' },
  schoolAdminCfg: { id: '', dbId: 0,    name: 'School Admin' },
  loading: false,
};

// ── Reducer ───────────────────────────────────────────────────
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_DB':
      return { ...state, db: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'LOGIN_ADMIN':
      return {
        ...state,
        isAdmin: true,
        isEncoder: action.payload.isEncoder,
        isSchoolAdmin: false,
        role: action.payload.isEncoder ? 'encoder' : 'admin',
        adminCfg: action.payload.isEncoder
          ? state.adminCfg
          : { ...state.adminCfg, id: action.payload.loginId, name: action.payload.name },
        encoderCfg: action.payload.isEncoder
          ? { ...state.encoderCfg, id: action.payload.loginId, name: action.payload.name }
          : state.encoderCfg,
        page: 'home', // ← redirect to homepage on login
      };

    case 'LOGIN_SCHOOL_ADMIN':
      return {
        ...state,
        isSchoolAdmin: true,
        isAdmin: false,
        isEncoder: false,
        role: 'school_admin',
        schoolAdminCfg: { id: action.payload.loginId, dbId: action.payload.dbId, name: action.payload.name },
        page: 'home', // ← redirect to homepage on login (was 'sa')
      };

    case 'LOGIN_EMPLOYEE':
      return {
        ...state,
        isAdmin: false,
        isEncoder: false,
        isSchoolAdmin: false,
        role: 'employee',
        curId: action.payload.curId,
        page: 'user',
      };

    case 'LOGOUT':
      return { ...initialState };

    case 'SET_PAGE':
      return { ...state, page: action.payload };

    case 'SET_CUR_ID':
      return { ...state, curId: action.payload };

    case 'UPDATE_EMPLOYEE': {
      // Support both payload shapes:
      // - Legacy:  payload is a Personnel object directly
      // - New:     payload is { employee: Personnel; originalId: string }
      let employee: Personnel;
      let originalId: string;

      if ('employee' in action.payload && 'originalId' in action.payload) {
        // New shape — ID may have changed, use originalId to find the record
        employee   = action.payload.employee;
        originalId = action.payload.originalId;
      } else {
        // Legacy shape — ID has not changed, use payload.id as usual
        employee   = action.payload as Personnel;
        originalId = (action.payload as Personnel).id;
      }

      const idx = state.db.findIndex(e => e.id === originalId);
      if (idx === -1) return state;
      const db = [...state.db];
      db[idx] = employee;
      return { ...state, db };
    }

    case 'ADD_EMPLOYEE':
      return { ...state, db: [...state.db, action.payload] };

    case 'SET_EMPLOYEE_RECORDS': {
      const idx = state.db.findIndex(e => e.id === action.payload.id);
      if (idx === -1) return state;
      const db = [...state.db];
      db[idx] = { ...db[idx], records: action.payload.records };
      return { ...state, db };
    }

    case 'SET_ADMIN_CFG':
      return {
        ...state,
        adminCfg:   { ...state.adminCfg,   ...(action.payload.admin   ?? {}) },
        encoderCfg: { ...state.encoderCfg, ...(action.payload.encoder ?? {}) },
      };

    case 'SET_SCHOOL_ADMIN_NAME':
      return { ...state, schoolAdminCfg: { ...state.schoolAdminCfg, name: action.payload } };

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────
export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
} | null>(null);

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
