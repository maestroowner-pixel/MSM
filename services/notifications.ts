// ===================================
// Local expiry reminders — notifies 60 / 30 / 7 days before each item's
// compliance date (next inspection or expiry, per category).
//
// expo-notifications is loaded defensively: in Expo Go / a build without the
// native module every call is a safe no-op (never throws, never crashes start).
// Reminders are LOCAL (no server). iOS caps pending local notifications at 64,
// so we schedule only the soonest MAX_SCHEDULED threshold-events and re-schedule
// on every data reload, giving a rolling window that refills as dates pass.
// ===================================

import { complianceDate, formatDate } from '../utils/dates';
import { CATEGORY_MAP } from '../constants/categories';
import { EquipmentItem } from '../types/equipment';

// Defensive require — missing native module must not crash app startup.
let N: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  N = require('expo-notifications');
} catch {
  N = null;
}

export const REMIND_OFFSETS = [60, 30, 7]; // days before the date
const MAX_SCHEDULED = 60; // stay under iOS's 64 pending-notification limit
const FIRE_HOUR = 9; // local 09:00 on the reminder day

export function notificationsSupported(): boolean {
  return !!N;
}

/** Ask for notification permission. Returns true if granted. */
export async function requestPermission(): Promise<boolean> {
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted || current.status === 'granted') return true;
    const req = await N.requestPermissionsAsync();
    return req.granted || req.status === 'granted';
  } catch {
    return false;
  }
}

export async function cancelAll(): Promise<void> {
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    /* ignore */
  }
}

/**
 * Cancel and re-schedule expiry reminders for the given items.
 * Returns the number of notifications scheduled (0 when unsupported/denied).
 */
export async function rescheduleExpiryReminders(items: EquipmentItem[]): Promise<number> {
  if (!N) return 0;
  try {
    await N.cancelAllScheduledNotificationsAsync();
    const now = Date.now();

    type Reminder = { fire: Date; title: string; body: string };
    const reminders: Reminder[] = [];

    for (const it of items) {
      const iso = complianceDate(it);
      if (!iso) continue;
      const exp = new Date(`${iso}T00:00:00`);
      if (isNaN(exp.getTime())) continue;

      const catLabel = CATEGORY_MAP[it.category]?.short ?? 'Equipment';
      const name = it.type || (it.no != null ? `#${it.no}` : catLabel);

      for (const off of REMIND_OFFSETS) {
        const fire = new Date(exp);
        fire.setDate(fire.getDate() - off);
        fire.setHours(FIRE_HOUR, 0, 0, 0);
        if (fire.getTime() <= now) continue;
        reminders.push({
          fire,
          title: `${catLabel} — ${off} days to expiry`,
          body: `${name}${it.position ? ` · ${it.position}` : ''} — due ${formatDate(iso)}`,
        });
      }
    }

    reminders.sort((a, b) => a.fire.getTime() - b.fire.getTime());
    const slice = reminders.slice(0, MAX_SCHEDULED);

    for (const r of slice) {
      await N.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger: r.fire,
      });
    }
    return slice.length;
  } catch {
    return 0;
  }
}
