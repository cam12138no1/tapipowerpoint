import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface SimpleUser {
  id: number;
  name: string;
  openId: string;
}

interface SimpleAuthContextType {
  user: SimpleUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string) => Promise<void>;
  logout: () => void;
}

const SimpleAuthContext = createContext<SimpleAuthContextType | undefined>(undefined);

const STORAGE_KEY = 'pptmaster_user';

export function SimpleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SimpleUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string) => {
    if (!username.trim()) {
      throw new Error('请输入用户名');
    }

    // Generate a fixed openId based on username (no timestamp to ensure same user gets same data)
    const openId = `simple_${username.toLowerCase().replace(/\s+/g, '_')}`;
    
    const newUser: SimpleUser = {
      id: Date.now(), // Temporary ID, will be replaced by server
      name: username.trim(),
      openId,
    };

    // Store in localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <SimpleAuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
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
