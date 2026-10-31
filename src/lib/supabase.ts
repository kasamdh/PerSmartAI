import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

import { requireEnv } from './env';
import { sessionStorage } from './secure-storage';

// Only the anon (public) key belongs in the app. Data access is enforced by RLS.
const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = requireEnv(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Sessions live in the device Keychain/Keystore (expo-secure-store).
    storage: sessionStorage,
    // Fixed key so the session survives the dev server IP changing.
    storageKey: 'petsitter-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Email links come back to the app with ?code=..., exchanged in app/auth/callback.
    flowType: 'pkce',
  },
});

// Refresh the session only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
