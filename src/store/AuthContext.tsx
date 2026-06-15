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
  loginWithGoogle,
  logout as logoutRequest,
  registerWithEmail,
} from '../api/auth';
import { clearAppStateCacheForUserChange } from '../api/storage';
import type { AuthSessionPayload, TheaterAccessRole } from '../types/auth';

interface AuthContextValue {
  user: AuthSessionPayload['user'] | null;
  theaters: AuthSessionPayload['theaters'];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<AuthSessionPayload | null>;
  getTheaterRole: (theaterId: string | null | undefined) => TheaterAccessRole | null;
  canEditTheater: (theaterId: string | null | undefined) => boolean;
  canManageMembers: (theaterId: string | null | undefined) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function applySession(
  payload: AuthSessionPayload | null,
  setUser: (user: AuthSessionPayload['user'] | null) => void,
  setTheaters: (theaters: AuthSessionPayload['theaters']) => void
) {
  clearAppStateCacheForUserChange(payload?.user.id ?? null);
  setUser(payload?.user ?? null);
  setTheaters(payload?.theaters ?? []);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSessionPayload['user'] | null>(null);
  const [theaters, setTheaters] = useState<AuthSessionPayload['theaters']>([]);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<AuthSessionPayload | null> => {
    const session = await fetchAuthSession();
    applySession(session, setUser, setTheaters);
    return session;
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAuthSession()
      .then((session) => {
        if (!cancelled) applySession(session, setUser, setTheaters);
      })
      .catch(() => {
        if (!cancelled) applySession(null, setUser, setTheaters);
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

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginWithEmail(email, password);
    applySession(session, setUser, setTheaters);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const session = await registerWithEmail(email, password, name);
    applySession(session, setUser, setTheaters);
  }, []);

  const googleLogin = useCallback(async (credential: string) => {
    const session = await loginWithGoogle(credential);
    applySession(session, setUser, setTheaters);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    applySession(null, setUser, setTheaters);
  }, []);

  const value = useMemo(
    () => ({
      user,
      theaters,
      loading,
      login,
      register,
      googleLogin,
      logout,
      refreshSession,
      getTheaterRole,
      canEditTheater,
      canManageMembers,
    }),
    [
      user,
      theaters,
      loading,
      login,
      register,
      googleLogin,
      logout,
      refreshSession,
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
