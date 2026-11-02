import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Alert, Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { AppRole } from '@/types/models';

import { pushExplanation, shouldExplainPush } from './push-explainer';

type PushEnvironment = {
  isDevice: boolean;
  inExpoGo: boolean;
  platform: string;
  projectId: string | undefined;
};

export type PushSupport =
  { supported: true; projectId: string } | { supported: false; reason: string };

/** Whether this build can receive remote push notifications at all. */
export function pushSupport(env: PushEnvironment): PushSupport {
  if (!env.isDevice) return { supported: false, reason: 'Push needs a physical device.' };
  if (env.platform === 'web') return { supported: false, reason: 'Push is not set up for web.' };
  if (env.inExpoGo && env.platform === 'android') {
    return {
      supported: false,
      reason: 'Expo Go on Android cannot receive push; use a development build.',
    };
  }
  if (!env.projectId) {
    return { supported: false, reason: 'No EAS project id; run `npx eas-cli init`.' };
  }
  return { supported: true, projectId: env.projectId };
}

function currentEnvironment(): PushEnvironment {
  return {
    isDevice: Device.isDevice,
    inExpoGo: isRunningInExpoGo(),
    platform: Platform.OS,
    projectId: Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId,
  };
}

const EXPLAINER_KEY = 'push-explainer-declined-at';

function askToExplain(role: AppRole): Promise<boolean> {
  const { title, body } = pushExplanation(role);
  return new Promise((resolve) =>
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Turn on', onPress: () => resolve(true) },
    ]),
  );
}

// The token registered for this device in this session, so sign-out can remove it.
let registeredToken: string | null = null;

/**
 * Asks for permission (once), gets this device's Expo push token, and stores it
 * for the signed-in user. Returns the token, or null if push isn't available.
 */
export async function registerForPushNotifications(role: AppRole): Promise<string | null> {
  const support = pushSupport(currentEnvironment());
  if (!support.supported) {
    if (__DEV__) console.info(`[push] not registering: ${support.reason}`);
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Visit updates',
      importance: AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let permission = existing;
  if (!existing.granted) {
    // Say what notifications are for before the one-time system prompt.
    const declinedAt = Number(await AsyncStorage.getItem(EXPLAINER_KEY)) || null;
    const explain = shouldExplainPush({
      status: existing.status,
      canAskAgain: existing.canAskAgain,
      declinedAt,
      now: Date.now(),
    });
    if (!explain) return null;
    if (!(await askToExplain(role))) {
      await AsyncStorage.setItem(EXPLAINER_KEY, String(Date.now()));
      return null;
    }
    permission = await Notifications.requestPermissionsAsync();
  }
  if (!permission.granted) {
    return null;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: support.projectId,
  });
  const platform = Platform.OS === 'ios' ? 'ios' : 'android';

  // organization_id and profile_id default from the signed-in user.
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ token, platform }, { onConflict: 'token' });
  if (error) {
    throw error;
  }
  registeredToken = token;
  return token;
}

/** Removes this device's token so the next person to sign in here doesn't get these pushes. */
export async function unregisterPushToken(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await supabase.from('push_tokens').delete().eq('token', token);
}
