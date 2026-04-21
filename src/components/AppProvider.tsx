'use client';
import { useReducer, type ReactNode } from 'react';
import { AppContext, appReducer, initialState } from '@/hooks/useAppStore';

export default function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}
