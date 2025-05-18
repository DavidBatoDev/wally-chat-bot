// client/src/components/auth/AuthInitializer.tsx
'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/store/AuthStore';
import { supabase } from '@/lib/supabase/client';

export function AuthInitializer() {
  const { initializeFromCookies } = useAuthStore();

  useEffect(() => {
    // Initialize auth state from any existing cookies
    initializeFromCookies();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // When a user signs in or a token is refreshed, update the store
          useAuthStore.setState({ 
            user: session?.user || null,
            session: session
          });
        } else if (event === 'SIGNED_OUT') {
          // When a user signs out, clear the store
          useAuthStore.setState({ 
            user: null,
            session: null
          });
        }
      }
    );

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [initializeFromCookies]);

  // This component doesn't render anything
  return null;
}