import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchAuthSession,
  loginWithEmail,
  logout as logoutRequest,
  registerWithEmail,
  updateAuthProfile,
} from '../api/auth';
import { clearAppStateCacheForUserChange } from '../api/storage';
import type { AuthSessionPayload, TheaterAccessRole } from '../types/auth';

interface AuthContextValue {
  user: AuthSessionPayload['user'] | null;
  theaters: AuthSessionPayload['theaters'];
  isPlatformAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, acceptTerms: boolean) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthSessionPayload | null>;
  updateProfile: (payload: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  grantTheaterAccess: (theaterId: string, role?: Extract<TheaterAccessRole, 'owner' | 'editor'>) => void;
  getTheaterRole: (theaterId: string | null | undefined) => TheaterAccessRole | null;
  canEditTheater: (theaterId: string | null | undefined) => boolean;
  canManageMembers: (theaterId: string | null | undefined) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(
  payload: AuthSessionPayload | null,
  setUser: (user: AuthSessionPayload['user'] | null) => void,
  setTheaters: (theaters: AuthSessionPayload['theaters']) => void,
  setIsPlatformAdmin: (value: boolean) => void
) {
  clearAppStateCacheForUserChange(payload?.user.id ?? null);
  setUser(payload?.user ?? null);
  setTheaters(payload?.theaters ?? []);
  setIsPlatformAdmin(Boolean(payload?.isPlatformAdmin));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionPayload['user'] | null>(null);
  const [theaters, setTheaters] = useState<AuthSessionPayload['theaters']>([]);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<AuthSessionPayload | null> => {
    const session = await fetchAuthSession();
    applySession(session, setUser, setTheaters, setIsPlatformAdmin);
    return session;
  }, []);

  const grantTheaterAccess = useCallback(
    (theaterId: string, role: Extract<TheaterAccessRole, 'owner' | 'editor'> = 'owner') => {
      setTheaters((current) => {
        const existing = current.find((entry) => entry.theaterId === theaterId);
        if (existing) {
          if (existing.role === 'owner') return current;
          return current.map((entry) =>
            entry.theaterId === theaterId ? { ...entry, role } : entry
          );
        }
        return [...current, { theaterId, role }];
      });
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetchAuthSession()
      .then((session) => {
        if (!cancelled) applySession(session, setUser, setTheaters, setIsPlatformAdmin);
      })
      .catch(() => {
        if (!cancelled) applySession(null, setUser, setTheaters, setIsPlatformAdmin);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getTheaterRole = useCallback(
    (theaterId: string | null | undefined): TheaterAccessRole | null => {
      if (!theaterId) return null;
      return theaters.find((entry) => entry.theaterId === theaterId)?.role ?? null;
    },
    [theaters]
  );

  const canEditTheater = useCallback(
    (theaterId: string | null | undefined) => {
      const role = getTheaterRole(theaterId);
      return role === 'owner' || role === 'editor';
    },
    [getTheaterRole]
  );

  const canManageMembers = useCallback(
    (theaterId: string | null | undefined) => getTheaterRole(theaterId) === 'owner',
    [getTheaterRole]
  );

  const updateProfile = useCallback(
    async (payload: { name?: string; currentPassword?: string; newPassword?: string }) => {
      const session = await updateAuthProfile(payload);
      applySession(session, setUser, setTheaters, setIsPlatformAdmin);
    },
    []
  );

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginWithEmail(email, password);
    applySession(session, setUser, setTheaters, setIsPlatformAdmin);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, acceptTerms: boolean) => {
    return registerWithEmail(email, password, name, acceptTerms);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    applySession(null, setUser, setTheaters, setIsPlatformAdmin);
  }, []);

  const value = useMemo(
    () => ({
      user,
      theaters,
      isPlatformAdmin,
      loading,
      login,
      register,
      logout,
      refreshSession,
      updateProfile,
      grantTheaterAccess,
      getTheaterRole,
      canEditTheater,
      canManageMembers,
    }),
    [
      user,
      theaters,
      isPlatformAdmin,
      loading,
      login,
      register,
      logout,
      refreshSession,
      updateProfile,
      grantTheaterAccess,
      getTheaterRole,
      canEditTheater,
      canManageMembers,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
