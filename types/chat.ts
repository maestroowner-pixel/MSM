// ===================================
// Chat (14 Nov 2026) — the vessel's channels: everyone aboard (`crew`), the
// officers and the Master (`officers`), and the officers with the office
// (`office`). Built on the discussion's engine (types/thread.ts): one document
// per message, never changed or deleted, `@Name` and `@Office` mentions.
//
// Each channel is a collection of its own (chat_crew, chat_officers,
// chat_office), so the rules decide who reads it: the office never reads the
// crew's or the officers' channel, a crew device never holds the officers'.
// No messages one to one: a channel stays on the vessel's record.
// ===================================

import { ThreadSide } from './thread';

export type ChatChannel = 'crew' | 'officers' | 'office';

export interface ChatMessage {
  id: string;
  ch: ChatChannel;
  text: string;
  by: string;
  byRank?: string;
  at: number;
  side: ThreadSide;
  /** Names mentioned, as they are on the crew list. */
  mentions?: string[];
  /** `@Office` is in the text (office channel only). */
  office?: boolean;
  updatedAt?: number;
}
