// ===================================
// What happened during a deck watch, read from the records (15 Nov 2026).
//
// A watch entry switched to LIVE (DeckEntrySc) gathers, when it is signed, the
// gangway (crew and passengers ashore / aboard, visitors on and off) and the
// equipment inspections signed since LIVE was switched on. They are read from
// the synced records, not queued on this device, so a crossing marked on the
// gangway tablet reaches the bridge's entry too.
//
// English, like every paper. A passenger's or visitor's name goes masked
// ("A…e"): the deck log goes to the cloud, and their names never do.
// Passes of one category in one round are one line; a failure is its own line.
// ===================================

import type { CrewMove, Visitor } from '../types/security';
import type { Inspection } from '../types/inspection';
import { maskName } from '../utils/privacy';
import { shipStamp } from '../utils/shipTime';

export interface WatchEvent {
  /** "yyyy-mm-dd hh:mm" in ship's time — the order. */
  key: string;
  /** "HH:MM text" in ship's time. */
  line: string;
}

export interface WatchSources {
  moves: CrewMove[];
  visitors: Visitor[];
  /** Ids of passengers: their crossings are in `moves`, their names are masked. */
  passengerIds: Set<string>;
  inspections: Inspection[];
  /** The category's English name. */
  catName: (category: string) => string;
}

/** "yyyy-mm-dd hh:mm" in ship's time — how visitors' times are written. */
const stampKey = (at: number) => { const s = shipStamp(at); return `${s.slice(0, 10)} ${s.slice(11, 16)}`; };
const hm = (at: number) => shipStamp(at).slice(11, 16);

function itemName(i: Inspection, catName: WatchSources['catName']): string {
  const it = i.item ?? {};
  const bits = [catName(i.category), it.no ? `No. ${it.no}` : '', it.type ?? '', it.position ? `(${it.position})` : ''].filter(Boolean);
  return bits.join(' ');
}

/** Events in (since, until], oldest first. */
export function watchEvents(since: number, until: number, src: WatchSources): WatchEvent[] {
  const out: WatchEvent[] = [];
  const inWindow = (at: number) => at > since && at <= until;

  for (const m of src.moves) {
    if (!inWindow(m.at)) continue;
    const pax = src.passengerIds.has(m.crewId);
    const who = pax ? `Passenger ${maskName(m.name)}` : m.name;
    const what = m.dir === 'ashore' ? 'went ashore' : 'came aboard';
    out.push({ key: stampKey(m.at), line: `${m.time || hm(m.at)} ${who} ${what}${m.boat ? ` by ${m.boat}` : ''}` });
  }

  // Visitors carry ship's date and time as typed, not an instant: compared as text.
  const from = stampKey(since), to = stampKey(until);
  const inText = (d?: string, t?: string) => !!d && !!t && `${d} ${t}` > from && `${d} ${t}` <= to;
  for (const v of src.visitors) {
    const who = `Visitor ${maskName(v.name)}${v.company ? ` (${v.company})` : ''}`;
    if (inText(v.date, v.timeIn)) out.push({ key: `${v.date} ${v.timeIn}`, line: `${v.timeIn} ${who} came aboard${v.purpose ? ` — ${v.purpose}` : ''}` });
    if (v.timeOut && inText(v.dateOut ?? v.date, v.timeOut)) out.push({ key: `${v.dateOut ?? v.date} ${v.timeOut}`, line: `${v.timeOut} ${who} left` });
  }

  // Inspections: passes gathered per category, round period and signer; failures one by one.
  const passes = new Map<string, { at: number; n: number; cat: string; period: string; by: string }>();
  for (const i of src.inspections) {
    if (inWindow(i.at)) {
      if (i.outcome === 'fail') {
        const note = i.defect?.note ? `: ${i.defect.note}` : '';
        out.push({ key: stampKey(i.at), line: `${hm(i.at)} ${itemName(i, src.catName)} — ${i.period} inspection FAILED${note} (${i.by})` });
      } else {
        const key = `${i.category}|${i.period}|${i.by}`;
        const p = passes.get(key);
        if (p) { p.n++; p.at = Math.min(p.at, i.at); } else passes.set(key, { at: i.at, n: 1, cat: i.category, period: i.period, by: i.by });
      }
    }
    const d = i.defect;
    if (d && !d.open && d.closedAt && inWindow(d.closedAt)) {
      out.push({ key: stampKey(d.closedAt), line: `${hm(d.closedAt)} Defect rectified: ${itemName(i, src.catName)}${d.closedNote ? ` — ${d.closedNote}` : ''}${d.closedBy ? ` (${d.closedBy})` : ''}` });
    }
  }
  for (const p of passes.values()) {
    const n = p.n === 1 ? '1 item' : `${p.n} items`;
    out.push({ key: stampKey(p.at), line: `${hm(p.at)} ${src.catName(p.cat)} — ${p.period} inspection, ${n} passed (${p.by})` });
  }

  // Ship's date and time: a visitor's has no instant of its own.
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** The remarks with the events added under them; a line already there is not added twice. */
export function withEvents(remarks: string, events: WatchEvent[]): string {
  const have = new Set(remarks.split('\n').map((l) => l.trim()));
  const add = events.map((e) => e.line).filter((l) => !have.has(l));
  if (!add.length) return remarks.trim();
  return remarks.trim() ? `${remarks.trim()}\n${add.join('\n')}` : add.join('\n');
}
