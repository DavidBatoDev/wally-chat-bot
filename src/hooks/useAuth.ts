import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/AuthStore';
import { User, Session } from '@supabase/supabase-js';
import { useRouter } from 'next/router'; 

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
  refreshSession: () => Promise<void>; // Added to match AuthStore
}

/**
 * Custom hook that provides authentication functionality
 * @param {Object} options - Configuration options
 * @param {string} options.redirectTo - Path to redirect to after login (if provided)
 * @param {boolean} options.redirectIfFound - Redirect if the user is already logged in (for login/signup pages)
 * @returns {UseAuthReturn} Authentication state and methods
 */
export const useAuth = (options?: {
  redirectTo?: string;
  redirectIfFound?: boolean;
}): UseAuthReturn => {
  const router = typeof window !== 'undefined' ? useRouter() : null;
  
  // Get auth state from the store
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
 
  // Handle client-side only operations and session refresh
  useEffect(() => {
    // Skip on server-side
    if (typeof window === 'undefined') return;
   
    const initAuth = async () => {
      try {
        await refreshSession();
      } catch (error) {
        console.error('Failed to refresh session:', error);
      } finally {
        setIsInitializing(false);
      }
    };
   
    initAuth();
  }, []); // Empty dependency array - only run once on mount
  
  // Handle redirects based on authentication state
  useEffect(() => {
    if (typeof window === 'undefined' || isInitializing || !router) return;
    
    if (options?.redirectTo && isAuthenticated) {
      router.push(options.redirectTo);
    } else if (options?.redirectIfFound && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, isInitializing, options, router]);

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
    getAuthToken,
    refreshSession // Expose refreshSession from the store
  };
};

export default useAuth;