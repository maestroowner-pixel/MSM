// ===================================
// Chat (types/chat.ts) — the pure part: who may see a channel, a new message,
// what this device has not read, what the office owes an answer, the channel
// on paper. Mentions are the discussion's (services/threads mentionsIn).
// Tested by `npm run check:chat`.
//
// What this device has read is device-local (prefs.chatRead), as for threads:
// a shared tablet and a phone each keep their own.
// ===================================

import { ChatChannel, ChatMessage } from '../types/chat';
import { ThreadSide } from '../types/thread';
import { THREAD_MAX, mentionsIn } from './threads';
import { uid } from '../utils/id';
import type { MachineHistory } from './pmsHistory';

export const CHAT_CHANNELS: ChatChannel[] = ['crew', 'officers', 'office'];
/** Where each channel lives in Firestore (rules: firestore.rules). */
export const CHAT_SUB: Record<ChatChannel, string> = { crew: 'chat_crew', officers: 'chat_officers', office: 'chat_office' };
/** How many messages a channel shows before "Earlier messages". */
export const CHAT_PAGE = 60;

/** The channels a device may open: crew for everyone, the other two for officers and the Master. */
export function channelsFor(officer: boolean): ChatChannel[] {
  return officer ? CHAT_CHANNELS : ['crew'];
}

const byTime = (a: ChatMessage, b: ChatMessage) => a.at - b.at || a.id.localeCompare(b.id);
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** A channel's messages, oldest first. */
export function chatOf(list: ChatMessage[], ch: ChatChannel): ChatMessage[] {
  return list.filter((m) => m.ch === ch).sort(byTime);
}

export interface NewChat {
  ch: ChatChannel;
  text: string;
  by: string;
  byRank?: string;
  side: ThreadSide;
}

export function makeChatMessage(x: NewChat, people: string[], at: number): ChatMessage {
  const text = x.text.trim();
  if (!text) throw new Error('Nothing to send');
  if (text.length > THREAD_MAX) throw new Error('Too long');
  if (x.side === 'office' && x.ch !== 'office') throw new Error('The office writes only in its channel');
  const { mentions, office } = mentionsIn(text, people);
  return {
    id: uid(),
    ch: x.ch,
    text,
    by: x.by,
    ...(x.byRank ? { byRank: x.byRank } : {}),
    at,
    side: x.side,
    ...(mentions.length ? { mentions } : {}),
    ...(office && x.ch === 'office' ? { office: true } : {}),
  };
}

/** Messages this device has not seen in a channel — not the person's own. */
export function unreadChat(list: ChatMessage[], ch: ChatChannel, me: string | undefined, read: Partial<Record<ChatChannel, number>> = {}): ChatMessage[] {
  const since = read[ch] ?? 0;
  return chatOf(list, ch).filter((m) => m.at > since && !(m.side === 'vessel' && me && same(m.by, me)));
}

/** Unread messages naming this person, newest first. */
export function chatMentions(list: ChatMessage[], me: string | undefined, read: Partial<Record<ChatChannel, number>> = {}): ChatMessage[] {
  if (!me) return [];
  return list
    .filter((m) => m.at > (read[m.ch] ?? 0) && !same(m.by, me) && (m.mentions ?? []).some((n) => same(n, me)))
    .sort((a, b) => byTime(b, a));
}

/** Mentions not yet notified on this device. */
export function chatToNotify(list: ChatMessage[], me: string | undefined, read: Partial<Record<ChatChannel, number>> = {}, notifiedAt = 0): ChatMessage[] {
  return chatMentions(list, me, read).filter((m) => m.at > notifiedAt);
}

/**
 * The office channel, read by the office: the vessel's messages since the office
 * last wrote. The channel is the vessel talking to the office, so every one of
 * them waits for an answer; a reply clears them, nothing is stored.
 */
export function officeOwes(list: ChatMessage[]): { since: number; last: ChatMessage; n: number } | null {
  const l = chatOf(list, 'office');
  const lastOffice = l.map((m) => m.side).lastIndexOf('office');
  const after = l.slice(lastOffice + 1);
  return after.length ? { since: after[0].at, last: after[after.length - 1], n: after.length } : null;
}

/** The last `n` of a channel, and how many are left out before them. */
export function recent(l: ChatMessage[], n: number): { shown: ChatMessage[]; earlier: number } {
  return l.length > n ? { shown: l.slice(-n), earlier: l.length - n } : { shown: l, earlier: 0 };
}

const p2 = (n: number) => String(n).padStart(2, '0');
/** The sender's clock, as the screen shows it. */
export function chatWhen(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export const CHANNEL_EN: Record<ChatChannel, string> = { crew: 'Crew', officers: 'Officers', office: 'Office' };

/** The channel on paper, oldest first: from `from` (ms) on, or all. English always. */
export function chatSheet(list: ChatMessage[], ch: ChatChannel, from: number, printed: number): MachineHistory {
  const l = chatOf(list, ch).filter((m) => m.at >= from);
  return {
    title: `Chat — ${CHANNEL_EN[ch]}`,
    facts: [from ? `From ${chatWhen(from).slice(0, 10)}` : 'All messages', `${l.length} messages`, 'Times as on the sender\'s device', `Printed ${chatWhen(printed)}`],
    tables: [{ title: 'Messages', head: ['Time', 'From', 'Message'], rows: l.map((m) => [chatWhen(m.at), [m.by, m.byRank].filter(Boolean).join(', ') + (m.side === 'office' ? ' (office)' : ''), m.text]), widths: { 0: 32, 1: 50, 2: 195 } }],
  };
}
