// ===================================
// Into English before it goes ashore (plan AI-9, 6 Nov 2026): what the crew
// wrote in their own language — a machinery defect, an inspection's remark or
// defect, a message to the office — is put into plain English by the AI, before
// it is saved, signed or sent. The writer sees both and chooses; nothing is
// stored by the AI. Not queued: the box is open now, a later answer has nowhere
// to go.
//
// Names stay aboard, and come back: each name on the crew list, the guest list
// and the hospital's treatments becomes a token [P1] before the text leaves the
// device, and the token turns back into what was written when the English
// comes back — so a message's @mention still reaches the person.
// ===================================

import type { Person } from './incidentAi';

export const MAX_ENGLISH = 2000;
export type EnglishKind = 'defect' | 'remark' | 'message' | 'note';

const LETTER = 'A-Za-zÀ-ÿĀ-žА-яЁёІіЇїЄєҐґ';
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The text with each name as [Pn] (the same words, the same token) and what each token stands for. */
export function maskPeople(text: string, people: Person[]): { text: string; tokens: Record<string, string> } {
  const words = new Set<string>();
  for (const p of people) {
    const name = p.name.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    words.add(name);
    for (const part of name.split(/[\s-]+/)) if (part.length >= 3) words.add(part);
  }
  // Longest first, so "Anna Berg" goes whole before "Anna" alone.
  const sorted = [...words].sort((a, b) => b.length - a.length);
  const tokens: Record<string, string> = {};
  const byWords = new Map<string, string>();
  // A token already in the text is not a name; [Pn] numbers start past any there.
  let n = Math.max(0, ...[...text.matchAll(/\[P(\d+)\]/g)].map((m) => Number(m[1])));
  let out = text;
  for (const w of sorted) {
    const re = new RegExp(`(^|[^${LETTER}])${esc(w)}(?=[^${LETTER}]|$)`, 'gi');
    out = out.replace(re, (m: string, pre: string) => {
      const found = m.slice(pre.length);
      let tok = byWords.get(found);
      if (!tok) {
        tok = `[P${++n}]`;
        byWords.set(found, tok);
        tokens[tok] = found;
      }
      return `${pre}${tok}`;
    });
  }
  return { text: out, tokens };
}

export interface EnglishReply {
  english?: unknown;
  from?: unknown;
}

export interface EnglishRead {
  english: string;
  from: string;
  /** Nothing to change: it came back as it went. */
  same: boolean;
  /** Names the English left out (their token did not come back): the writer is told to check. */
  lost: string[];
}

/** The AI's English with the names put back. */
export function readEnglish(r: EnglishReply, sent: string, tokens: Record<string, string>, original: string): EnglishRead | null {
  let english = typeof r?.english === 'string' ? r.english.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (!english) return null;
  english = english.slice(0, MAX_ENGLISH * 2);
  const lost = Object.keys(tokens).filter((tok) => sent.includes(tok) && !english.includes(tok)).map((tok) => tokens[tok]);
  // A token the AI made up stays as it is: it stands for nobody.
  english = english.replace(/\[P\d+\]/g, (tok) => tokens[tok] ?? tok);
  const from = typeof r?.from === 'string' ? r.from.trim().slice(0, 40) : '';
  return { english, from, same: english.trim() === original.trim(), lost: [...new Set(lost)] };
}
