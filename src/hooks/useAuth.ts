// lib/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/AuthStore';
import { User, Session } from '@supabase/supabase-js';

interface UseAuthReturn {
  // Auth state
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Auth methods
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetError: () => void;
  getAuthToken: () => string | null;
}

/**
 * Custom hook that provides authentication functionality
 * @param {Object} options - Configuration options
 * @param {string} options.redirectTo - Path to redirect to after login (if provided)
 * @param {string} options.redirectIfFound - Redirect if the user is already logged in (for login/signup pages)
 * @returns {UseAuthReturn} Authentication state and methods
 */
export const useAuth = (options?: { 
  redirectTo?: string; 
  redirectIfFound?: boolean;
}): UseAuthReturn => {
  // Get auth state from the store with explicit typing
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const storeIsLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  
  // Get auth actions from the store
  const login = useAuthStore((state) => state.login);
  const signUp = useAuthStore((state) => state.signUp);
  const logout = useAuthStore((state) => state.logout);
  const resetError = useAuthStore((state) => state.resetError);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const getAuthToken = useAuthStore((state) => state.getAuthToken);

  // Local loading state to handle initial load
  const [isInitializing, setIsInitializing] = useState(true);
  const isLoading = storeIsLoading || isInitializing;
  
  // Derived authentication state
  const isAuthenticated = !!user && !!session;

  // Server-side rendering safe check
  const [isMounted, setIsMounted] = useState(false);
  
  // Handle client-side only operations and session refresh
  useEffect(() => {
    // Skip on server-side
    if (typeof window === 'undefined') return;
    
    setIsMounted(true);
    
    const initAuth = async () => {
      await refreshSession();
      setIsInitializing(false);
      
      // Handle redirects after authentication is initialized
      if (options?.redirectTo && isAuthenticated) {
        window.location.href = options.redirectTo;
      } else if (options?.redirectIfFound && isAuthenticated) {
        window.location.href = '/';
      }
    };
    
    initAuth();
  }, []); // Empty dependency array - only run once on mount

  // Handle changes in authentication state after initialization
  useEffect(() => {
    if (!isMounted || isInitializing || typeof window === 'undefined') return;
    
    if (options?.redirectTo && isAuthenticated) {
      window.location.href = options.redirectTo;
    } else if (options?.redirectIfFound && isAuthenticated) {
      window.location.href = '/';
    }
  }, [isAuthenticated, isMounted, isInitializing, options]);

  return {
    user,
    session,
    isLoading,
    isAuthenticated,
    error,
    login,
    signUp,
    logout,
    resetError,
    getAuthToken
  };
};

export default useAuth;