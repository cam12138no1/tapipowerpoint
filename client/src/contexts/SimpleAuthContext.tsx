import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

interface SimpleUser {
  id: number;
  name: string;
  openId: string;
  role?: string;
}

interface SimpleAuthContextType {
  user: SimpleUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
  token: string | null;
}

const SimpleAuthContext = createContext<SimpleAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'pptmaster_user';
const TOKEN_KEY = 'pptmaster_token';

export function SimpleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedToken = localStorage.getItem(TOKEN_KEY);
    
    if (stored && storedToken) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setToken(storedToken);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string) => {
    if (!username.trim()) {
      throw new Error('请输入用户名');
    }

    try {
      // Call backend to create user and get JWT token
      const result = await loginMutation.mutateAsync({ username: username.trim() });
      
      const newUser: SimpleUser = {
        id: result.user.id,
        name: result.user.name || username.trim(),
        openId: result.user.openId,
        role: result.user.role,
      };

      // Store in localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      localStorage.setItem(TOKEN_KEY, result.token);
      
      setUser(newUser);
      setToken(result.token);
    } catch (error: any) {
      console.error('Login failed:', error);
      throw new Error(error.message || '登录失败');
    }
  }, [loginMutation]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      // Ignore logout errors
    }
    
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setToken(null);
  }, [logoutMutation]);

  return (
    <SimpleAuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user && !!token,
        login,
        logout,
        token,
      }}
    >
      {children}
    </SimpleAuthContext.Provider>
  );
}

export function useSimpleAuth() {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider');
  }
  return context;
}
