"use client";

import { useState, useEffect } from 'react';

interface User {
  id: string;
  employee_id: string;
  full_name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  authenticated: boolean;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    authenticated: false,
    loading: true
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      
      setAuthState({
        user: data.user,
        authenticated: data.authenticated,
        loading: false
      });
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState({
        user: null,
        authenticated: false,
        loading: false
      });
    }
  };

  const isAdmin = () => {
    return authState.user?.role === 'admin';
  };

  const isUser = () => {
    return authState.user?.role === 'user';
  };

  return {
    ...authState,
    isAdmin,
    isUser,
    checkAuth
  };
}