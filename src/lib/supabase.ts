import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { requireEnv } from './env';

// Only the anon (public) key belongs in the app. Data access is enforced by RLS.
const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = requireEnv(
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
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
