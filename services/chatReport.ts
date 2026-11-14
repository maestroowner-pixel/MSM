// ===================================
// A chat channel on paper (services/chat chatSheet) — PDF, saved or shared.
// English always.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory, sharePmsHistory } from './pmsHistoryReport';
import { CHANNEL_EN, chatSheet, chatWhen } from './chat';
import { ChatChannel, ChatMessage } from '../types/chat';

/** "Chat Crew 2026-11-14" for the whole channel, "Chat Crew from 2026-10-15" for a period. */
const stem = (ch: ChatChannel, from: number) => `Chat ${CHANNEL_EN[ch]} ${from ? `from ${chatWhen(from).slice(0, 10)}` : chatWhen(Date.now()).slice(0, 10)}`;

export async function exportChat(list: ChatMessage[], ch: ChatChannel, from: number, vessel: VesselInfo | null) {
  return exportPmsHistory(`Chat — ${CHANNEL_EN[ch]}`, stem(ch, from), vessel, [chatSheet(list, ch, from, Date.now())]);
}

export async function shareChat(list: ChatMessage[], ch: ChatChannel, from: number, vessel: VesselInfo | null) {
  return sharePmsHistory(`Chat — ${CHANNEL_EN[ch]}`, stem(ch, from), vessel, [chatSheet(list, ch, from, Date.now())]);
}
