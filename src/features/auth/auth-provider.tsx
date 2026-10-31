import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  /** True until the stored session has been restored from device storage. */
  isRestoring: boolean;
  /**
   * True after signing in with a password-reset code or link, until a new
   * password is saved. Routing holds the user on the reset screen meanwhile.
   */
  recoveringPassword: boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    session: null,
    isRestoring: true,
    recoveringPassword: false,
  });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setState((s) => ({ ...s, session: data.session, isRestoring: false }));
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      setState((s) => ({
        session,
        isRestoring: false,
        recoveringPassword:
          event === 'PASSWORD_RECOVERY'
            ? true
            : event === 'USER_UPDATED' || event === 'SIGNED_OUT'
              ? false
              : s.recoveringPassword,
      }));
      if (event === 'SIGNED_OUT') {
        // Never show one user's cached data to the next user on a shared device.
        queryClient.clear();
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return value;
}
