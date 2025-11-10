"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [systemDark, setSystemDark] = useState(false);

  // hydrate from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('theme-preference') as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') setMode(saved);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const setModePersist = useCallback((m: ThemeMode) => {
    setMode(m);
    try { window.localStorage.setItem('theme-preference', m); } catch {}
  }, []);

  const isDark = mode === 'system' ? systemDark : mode === 'dark';

  const value = useMemo(() => ({ mode, isDark, setMode: setModePersist }), [mode, isDark, setModePersist]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

