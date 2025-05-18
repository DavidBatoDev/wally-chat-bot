import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { clearAuthTokens } from '@/utils/clearAuth';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetError: () => void;
  refreshSession: () => Promise<void>;
  getAuthToken: () => string | null;
  initializeFromCookies: () => Promise<void>; // New method to sync with Supabase cookie auth
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          
          if (error) throw error;
          
          set({ 
            user: data.user,
            session: data.session,
            isLoading: false
          });
        } catch (err: any) {
          set({ 
            error: err.message || 'Failed to login',
            isLoading: false 
          });
        }
      },
      
      signUp: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });
          
          if (error) throw error;
          
          set({ 
            user: data.user, 
            session: data.session,
            isLoading: false
          });
        } catch (err: any) {
          set({ 
            error: err.message || 'Failed to sign up',
            isLoading: false 
          });
        }
      },
      
      logout: async () => {
        try {
          set({ isLoading: true, error: null });
          const { error } = await supabase.auth.signOut();
          
          if (error) throw error;
          
          set({ 
            user: null, 
            session: null,
            isLoading: false 
          });
          clearAuthTokens();
        } catch (err: any) {
          set({ 
            error: err.message || 'Failed to logout',
            isLoading: false 
          });
        }
      },
      
      resetError: () => {
        set({ error: null });
      },
      
      refreshSession: async () => {
        try {
          set({ isLoading: true });
          const { data, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          set({ 
            user: data.session?.user || null,
            session: data.session,
            isLoading: false 
          });
        } catch (err: any) {
          set({ 
            error: err.message || 'Failed to refresh session',
            isLoading: false 
          });
        }
      },
      
      getAuthToken: () => {
        const state = get();
        return state.session?.access_token || null;
      },

      // New method to initialize auth store from Supabase cookie session
      initializeFromCookies: async () => {
        try {
          set({ isLoading: true });
          // This will get the session from cookies if available
          const { data, error } = await supabase.auth.getSession();
          
          if (error) throw error;
          
          if (data.session) {
            set({
              user: data.session.user,
              session: data.session,
              isLoading: false
            });
          } else {
            set({ isLoading: false });
          }
        } catch (err: any) {
          console.error('Error initializing auth from cookies:', err);
          set({ 
            error: err.message || 'Failed to initialize auth',
            isLoading: false 
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user,
        session: state.session
      }),
      // This is important - we'll handle hydration manually after checking cookies
      skipHydration: true,
    }
  )
);