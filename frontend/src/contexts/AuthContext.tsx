import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, ApiError } from '../lib/api';
import type { AuthenticatedUser, Role } from '../types';

const TOKEN_STORAGE_KEY = 'ai-dashboard:auth-token';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  token: string | null;
  login: (params: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  isAuthenticating: boolean;
  isBootstrapping: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null,
  );
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const me = await api.auth.me(token);
      setUser(me as AuthenticatedUser);
    } catch (error) {
      console.error('Failed to refresh session', error);
      clearSession();
    }
  }, [token, clearSession]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      if (!token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        const me = await api.auth.me(token);
        if (isMounted) {
          setUser(me as AuthenticatedUser);
        }
      } catch (error) {
        console.error('Session bootstrap failed', error);
        if (isMounted) {
          clearSession();
        }
      } finally {
        if (isMounted) {
          setIsBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [token, clearSession]);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      setIsAuthenticating(true);
      try {
        const result = await api.auth.login({ email, password });
        setUser(result.user as AuthenticatedUser);
        setToken(result.token);
        if (typeof window !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, result.token);
        }
      } catch (error) {
        clearSession();
        if (error instanceof ApiError) {
          throw new Error(error.message || 'Unable to sign in.');
        }
        throw new Error('Unable to sign in.');
      } finally {
        setIsAuthenticating(false);
      }
    },
    [clearSession],
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      login,
      logout,
      refresh,
      isAuthenticating,
      isBootstrapping,
    }),
    [user, token, login, logout, refresh, isAuthenticating, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export const useHasRole = (roles: Role | Role[]) => {
  const { user } = useAuth();
  const roleList = Array.isArray(roles) ? roles : [roles];
  return user ? roleList.includes(user.role) : false;
};
