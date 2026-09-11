import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole } from '../components/Sidebar';
import socket from '../lib/socket';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface AuthContextType {
  user: User | null;
  activeRole: UserRole | null;
  setActiveRole: (role: UserRole) => void;
  login: (userData: User, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRoleState] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for saved session
    const savedUser = localStorage.getItem('tangolab_admin_user');
    const savedActiveRole = localStorage.getItem('tangolab_active_role');
    const loginTimestamp = localStorage.getItem('tangolab_login_timestamp');
    const authToken = localStorage.getItem('tangolab_auth_token');

    if (savedUser && loginTimestamp && authToken) {
      const now = Date.now();
      const elapsed = now - parseInt(loginTimestamp);
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      if (elapsed > ONE_DAY_MS) {
        // Expired after 1 day!
        localStorage.removeItem('tangolab_admin_user');
        localStorage.removeItem('tangolab_active_role');
        localStorage.removeItem('tangolab_login_timestamp');
        localStorage.removeItem('tangolab_auth_token');
        setUser(null);
        setActiveRoleState(null);
      } else {
        try {
          const parsed = JSON.parse(savedUser);
          setUser(parsed);
          setActiveRoleState((savedActiveRole as UserRole) || parsed.role);
          socket.connect();
        } catch (e) {
          localStorage.removeItem('tangolab_admin_user');
          localStorage.removeItem('tangolab_active_role');
          localStorage.removeItem('tangolab_login_timestamp');
          localStorage.removeItem('tangolab_auth_token');
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User, token: string) => {
    setUser(userData);
    setActiveRoleState(userData.role);
    localStorage.setItem('tangolab_admin_user', JSON.stringify(userData));
    localStorage.setItem('tangolab_active_role', userData.role);
    localStorage.setItem('tangolab_login_timestamp', Date.now().toString());
    localStorage.setItem('tangolab_auth_token', token);
    socket.connect();
  };

  const logout = () => {
    setUser(null);
    setActiveRoleState(null);
    localStorage.removeItem('tangolab_admin_user');
    localStorage.removeItem('tangolab_active_role');
    localStorage.removeItem('tangolab_login_timestamp');
    localStorage.removeItem('tangolab_auth_token');
    socket.disconnect();
  };

  const setActiveRole = (role: UserRole) => {
    setActiveRoleState(role);
    localStorage.setItem('tangolab_active_role', role);
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, setActiveRole, login, logout, isAuthenticated: !!user, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
