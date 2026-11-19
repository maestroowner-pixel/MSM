// ===================================
// Remote push (19 Nov 2026) — chat messages reach a phone that is closed.
//
// The chat's own notification (components/ChatNotifier) is local: it comes only
// when the app is alive and has synced, and iOS stops a backgrounded app within
// seconds. So each phone gives the vessel an Expo push token, and the function
// `chatPush` (functions/chatPush.js) sends "New message in Officers" to the
// devices of that channel when a message reaches the cloud.
//
// Through Expo's push service, not FCM/APNs directly: the team's one APNs key
// was made by Expo and lives there (it cannot be downloaded again). The push
// carries the channel only, never the text or a name — that is all that passes
// through Expo, Google and Apple.
//
// The token goes to `push_tokens/{deviceId}`, which only this device writes and
// no client reads (firestore.rules): a token is enough to send a push to the
// phone, and the device list is readable by everyone aboard.
//
// Web has no push here: the browser tab keeps its own notification.
// ===================================

import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';

import * as fb from './firebaseService';

let N: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  N = require('expo-notifications');
} catch {
  N = null;
}

const ROOT = 'safety_vessels';

/** This run of the app holds a push token the vessel knows — the local chat notification stands aside. */
let registered = false;
export const pushRegistered = () => registered;

function projectId(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const C = require('expo-constants').default;
    return C?.expoConfig?.extra?.eas?.projectId ?? C?.easConfig?.projectId;
  } catch {
    return undefined;
  }
}

/**
 * Give the vessel this phone's push token, or say it wants none (`on: false` —
 * reminders switched off in Settings). Asks for no permission: that is the
 * Settings switch's job; without it there is simply no token. Best-effort —
 * a failure never stops the device syncing.
 */
export async function registerPush(vessel: string, on: boolean): Promise<void> {
  if (Platform.OS === 'web' || !N || !vessel) return;
  try {
    const me = await fb.getLocalDeviceId();
    const ref = doc(fb.firestoreDb(), ROOT, vessel, 'push_tokens', me);
    if (!on) {
      registered = false;
      await setDoc(ref, { on: false, updatedAt: Date.now() }, { merge: true });
      return;
    }
    const perm = await N.getPermissionsAsync();
    if (!(perm.granted || perm.status === 'granted')) return;
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync('chat', { name: 'Chat', importance: N.AndroidImportance?.HIGH ?? 4 }).catch(() => {});
    }
    const pid = projectId();
    if (!pid) return;
    const { data: token } = await N.getExpoPushTokenAsync({ projectId: pid });
    if (!token) return;
    await setDoc(ref, { token, platform: Platform.OS, on: true, updatedAt: Date.now() });
    registered = true;
  } catch (e: any) {
    console.warn('[push] register:', e?.message ?? e);
  }
}

/** A tap on a chat push → the channel. Returns the unsubscribe. */
export function onPushTap(open: (ch: string) => void): () => void {
  if (Platform.OS === 'web' || !N) return () => {};
  const go = (r: any) => {
    const d = r?.notification?.request?.content?.data;
    if (d?.kind === 'chat' && typeof d.ch === 'string') open(d.ch);
  };
  try {
    N.getLastNotificationResponseAsync?.().then(go).catch(() => {});
    const sub = N.addNotificationResponseReceivedListener(go);
    return () => sub?.remove?.();
  } catch {
    return () => {};
  }
}
