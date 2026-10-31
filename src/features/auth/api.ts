import { unregisterPushToken } from '@/features/notifications/push';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/models';

import { signInErrorMessage } from './errors';
import type { SignInValues } from './schemas';

export async function signIn({ email, password }: SignInValues): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(signInErrorMessage(error));
  }
}

export async function signOut(): Promise<void> {
  // Remove this device's push token while still signed in (RLS needs the session).
  await unregisterPushToken().catch(() => {});
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/** The signed-in user's profile, or null if they have no profile yet. */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data;
}
