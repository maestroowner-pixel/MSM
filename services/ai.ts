// ===================================
// The app's side of the AI (functions/ai.js): one call per task, through the
// vessel's own server session — the Claude key is the server's secret, never
// the app's. Works for an approved device of a synced vessel; a browser preview
// may set window.__ISMPILOT_AI__ to answer instead (tests).
//
// What never goes: patient and guest names, guest documents, crew passports.
// The importer sends headings and masked sample rows (maskCell), not the list.
// ===================================

import { getFunctions, httpsCallable } from 'firebase/functions';

import * as fb from './firebaseService';
import { moduleOn } from '../constants/modules';
import { LibraryEntry, splitPair } from './makerLibrary';

const REGION = 'europe-west1';
type Mock = (task: string, input: unknown) => Promise<unknown>;
const mock = (): Mock | undefined => (globalThis as any).__ISMPILOT_AI__;

/** The AI can be asked from here: the module is on and the vessel syncs (or a test answers). */
export function aiReady(enrolled: boolean): boolean {
  return moduleOn('ai') && (enrolled || !!mock());
}

export interface CertAiResult {
  name?: string;
  number?: string;
  issuer?: string;
  holder?: string;
  issueDate?: string;
  expiryDate?: string;
  unreadable?: string;
}

export async function aiCall<T>(task: 'map' | 'table' | 'inspect' | 'ask' | 'form' | 'cert' | 'readiness' | 'quote' | 'invoice' | 'manual' | 'incident' | 'sms' | 'diagnose' | 'brief' | 'log' | 'english' | 'photo' | 'sds' | 'library' | 'apform', input: unknown): Promise<T> {
  const m = mock();
  if (m) return (await m(task, input)) as T;
  const app = fb.firebaseApp();
  if (!app) throw new Error('The AI works when the vessel syncs (Settings → Sync).');
  try {
    const r = await httpsCallable<{ task: string; input: unknown }, T>(getFunctions(app, REGION), 'ai', { timeout: 125_000 })({ task, input });
    return r.data;
  } catch (e: any) {
    throw Object.assign(new Error(String(e?.message ?? e).replace(/^FirebaseError:\s*/, '')), { code: e?.code });
  }
}

// What the makers' library answered this session, by maker + model (makerLibrary.pairOf).
const libSeen = new Map<string, LibraryEntry | null>();

/**
 * The makers' library (plan item 54) for these maker + model pairs: the schedule
 * a manual of that model gave on any vessel, or null. One call for all not asked
 * yet this session; without a connection the pairs stay unanswered (absent).
 */
export async function libraryLookup(pairs: string[]): Promise<Record<string, LibraryEntry | null>> {
  const ask = Array.from(new Set(pairs)).filter((p) => !libSeen.has(p)).slice(0, 40);
  if (ask.length) {
    const r = await aiCall<{ found?: (LibraryEntry | null)[] }>('library', { units: ask.map(splitPair) });
    ask.forEach((p, i) => libSeen.set(p, r?.found?.[i] ?? null));
  }
  return Object.fromEntries(pairs.filter((p) => libSeen.has(p)).map((p) => [p, libSeen.get(p)!]));
}

/** After a manual read of this model: the library may hold it now. */
export const libraryForget = (pair: string | null) => {
  if (pair) libSeen.delete(pair);
};

/**
 * A sample cell as the AI may see it — its SHAPE, not its value: every digit a 9
 * ("03/03/1987" → "99/99/9999", a passport number → "99999999"), each word its
 * first and last letter ("Petra NOVAK" → "P…a N…K"). Enough to tell a date from
 * a number from a name; nothing that identifies anyone (14 Oct 2026).
 */
export function maskCell(v: unknown): string {
  const s = v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).trim();
  return s
    .slice(0, 60)
    .replace(/\d/g, '9')
    .replace(/[A-Za-zÀ-ÿА-яЁё]+/g, (w) => (w.length <= 2 ? w[0] : `${w[0]}…${w[w.length - 1]}`));
}
