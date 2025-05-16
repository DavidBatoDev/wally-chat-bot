
// client/src/lib/store/AuthStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';
import { User, Session } from '@supabase/supabase-js';

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
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        session: state.session
      }),
    }
  )
);