import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { tokenStorage } from '../utils/tokenStorage';
import { decodeToken, isTokenExpired } from '../utils/jwt';

interface AuthContextType {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const token = tokenStorage.getToken();
    if (token && !isTokenExpired(token)) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUser(decoded);
      } else {
        tokenStorage.removeToken();
      }
    } else if (token) {
      tokenStorage.removeToken();
    }
  }, []);

  const login = (token: string) => {
    tokenStorage.setToken(token);
    const decoded = decodeToken(token);
    if (decoded) {
      setUser(decoded);
    }
  };

  const logout = () => {
    tokenStorage.removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: user !== null
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
