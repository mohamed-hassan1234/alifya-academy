import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthSession, CurrentUser, LoginInput, Permission } from '@alifya/shared';
import { apiPost, refreshSession, registerSessionListener, setAccessToken } from '@/lib/api';
import i18n from '@/i18n';

interface AuthContextValue {
  user: CurrentUser | null;
  /** True until the initial silent refresh has resolved. */
  initializing: boolean;
  login: (input: LoginInput) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  setUser: (u: CurrentUser) => void;
  can: (...perms: Permission[]) => boolean;
  hasRole: (key: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    registerSessionListener((s) => setUser(s?.user ?? null));
    // Restore a session from the HttpOnly refresh cookie (if any).
    refreshSession().finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const session = await apiPost<AuthSession>('/auth/login', input);
    setAccessToken(session.accessToken);
    setUser(session.user);
    if (session.user.preferredLanguage !== i18n.language)
      void i18n.changeLanguage(session.user.preferredLanguage);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      queryClient.clear(); // drop any cached private data
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const perms = new Set(user?.permissions ?? []);
    return {
      user,
      initializing,
      login,
      logout,
      setUser,
      can: (...required) => required.every((p) => perms.has(p)),
      hasRole: (key) => !!user?.roles.some((r) => r.key === key),
    };
  }, [user, initializing, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Staff permissions that unlock the administration area. */
export const ADMIN_AREA_PERMISSIONS: Permission[] = [
  'courses.read',
  'programs.manage',
  'instructors.read',
  'users.read',
  'permissions.manage',
  'audit_logs.read',
  'settings.manage',
];

export function dashboardPathFor(user: CurrentUser): string {
  if (user.permissions.some((p) => ADMIN_AREA_PERMISSIONS.includes(p))) return '/admin';
  if (user.roles.some((r) => r.key === 'instructor')) return '/instructor/dashboard';
  return '/student/dashboard';
}
