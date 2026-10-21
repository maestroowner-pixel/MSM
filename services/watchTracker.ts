import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_ACTIVE = 'deckLog:activeWatch';
const KEY_EVENTS = 'deckLog:pendingEvents';

export interface ActiveWatch {
  id: string;
  period: string;
  date: string;
  startedAt: number;
}

export async function setActiveWatch(w: ActiveWatch): Promise<void> {
  await AsyncStorage.setItem(KEY_ACTIVE, JSON.stringify(w));
  await AsyncStorage.removeItem(KEY_EVENTS);
}

export async function clearActiveWatch(): Promise<void> {
  await AsyncStorage.multiRemove([KEY_ACTIVE, KEY_EVENTS]);
}

export async function getActiveWatch(): Promise<ActiveWatch | null> {
  const s = await AsyncStorage.getItem(KEY_ACTIVE);
  return s ? (JSON.parse(s) as ActiveWatch) : null;
}

/** Called by other modules (drills, rounds, etc.) to append an event line.
 *  Returns false if no active watch — caller ignores silently. */
export async function appendWatchEvent(line: string): Promise<boolean> {
  const w = await getActiveWatch();
  if (!w) return false;
  const raw = await AsyncStorage.getItem(KEY_EVENTS);
  const events: string[] = raw ? JSON.parse(raw) : [];
  events.push(line);
  await AsyncStorage.setItem(KEY_EVENTS, JSON.stringify(events));
  return true;
}

/** Drain pending events into a remarks string (called when signing). */
export async function drainPendingEvents(existingRemarks: string): Promise<string> {
  const raw = await AsyncStorage.getItem(KEY_EVENTS);
  if (!raw) return existingRemarks;
  const events: string[] = JSON.parse(raw);
  if (!events.length) return existingRemarks;
  const appended = events.join('\n');
  return existingRemarks.trim() ? `${existingRemarks.trim()}\n${appended}` : appended;
}
