// ===================================
// The Deck log (bridge logbook) as a certified true copy — a day, a run of months or
// the whole log in one PDF (21 Nov 2026, Panama MMC-193 §4.1):
//   §4.1.2  every entry with ship's time and UTC ........ the When column (entryWhen, the
//           zone frozen at the signature — services/deckLog zoneOnSign); entries signed
//           before 2.78 print as they were written
//   §4.1.3  kept five years, available to the Administration in PDF ... nothing in the
//           Deck log is ever deleted (no keepDays, rules: delete false); this is the PDF,
//           on the web too (it used to be an HTML page there)
//   §4.1.4  the Master's electronic signature ........... the Master's review column
// The page itself is services/trueCopy (page n of N, printed at, software, a line for the
// Master to sign it as a true copy) — the same as the record books.
// Pure: `npm run check:decklogcopy` draws it under Node.
// ===================================

import type { DeckEntry } from '../types/deckLog';
import { BEAUFORT_LABEL, PERIOD_LABEL, SEA_STATE_LABEL, positionStr, sortDeckEntries } from './deckLog';
import { TrueCopy, monthsBetween, periodLabel } from './trueCopy';
import { utcStamp } from './verification';
import { entryWhen } from '../utils/shipTime';

interface VesselLike { vessel_name?: string; imo?: string; flag?: string; call_sign?: string; mmsi?: string }

const VIS: Record<string, string> = { good: 'Good', moderate: 'Moderate', poor: 'Poor', fog: 'Fog' };

const header = (v: VesselLike | null) =>
  [v?.vessel_name, v?.imo ? `IMO ${v.imo}` : null, v?.flag, v?.call_sign ? `Call sign ${v.call_sign}` : null, v?.mmsi ? `MMSI ${v.mmsi}` : null].filter(Boolean).join(' · ') || 'Vessel';

const who = (name?: string, rank?: string) => (rank ? `${name ?? ''} (${rank})` : name ?? '');

/** One printed row: When · Watch · Navigation · Weather · Events / remarks · Signed · Master's review. */
export function deckRow(e: DeckEntry): string[] {
  const port = e.mode === 'port';
  const nav = port
    ? []
    : [
        positionStr(e),
        e.courseGyro !== undefined ? `Co ${e.courseGyro}°T` : '',
        e.courseMagnetic !== undefined ? `Mag ${e.courseMagnetic}°` : '',
        e.speed !== undefined ? `${e.speed} kn` : '',
        e.rpm !== undefined ? `${e.rpm} rpm` : '',
        e.distanceRun !== undefined ? `${e.distanceRun} nm run` : '',
      ].filter(Boolean);
  const wx = [
    e.windDir || e.windBft !== undefined ? `Wind ${e.windDir ?? ''}${e.windBft !== undefined ? ` ${BEAUFORT_LABEL[e.windBft] ?? `Bft ${e.windBft}`}` : ''}`.trim() : '',
    !port && e.seaState !== undefined ? `Sea ${SEA_STATE_LABEL[e.seaState] ?? e.seaState}` : '',
    !port && e.visibility ? `Vis ${VIS[e.visibility] ?? e.visibility}` : '',
    port && e.wxCondition ? e.wxCondition : '',
    e.tempAir !== undefined ? `Air ${e.tempAir}°C` : '',
    !port && e.pressure !== undefined ? `${e.pressure} hPa` : '',
  ].filter(Boolean);
  return [
    entryWhen(e.date, e.time, e.shipOffset),
    `${PERIOD_LABEL[e.period] ?? e.period}\n${port ? 'In port' : 'At sea'}`,
    nav.join('\n'),
    wx.join('\n'),
    e.remarks ?? '',
    `${who(e.by, e.byRank)}\n${utcStamp(e.at)}`,
    e.masterAt ? `${who(e.masterBy, e.masterByRank)}\n${utcStamp(e.masterAt)}` : '',
  ];
}

export const DECK_COPY_HEAD = ['When', 'Watch', 'Navigation', 'Weather', 'Events / remarks', 'Signed by', "Master's review"];

const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/**
 * The true copy of the Deck log from `from` to `to` — days (yyyy-mm-dd) or months (yyyy-mm), either way round.
 * Signed entries only, oldest first; unsigned drafts are not records yet and are counted, not printed.
 */
export function deckLogCopy(all: DeckEntry[], from: string, to: string, vessel: VesselLike | null): { copy: TrueCopy; name: string } {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const start = a.length === 7 ? `${a}-01` : a;
  const end = b.length === 7 ? lastDay(b) : b;
  const inside = all.filter((e) => e.date >= start && e.date <= end);
  const signed = sortDeckEntries(inside.filter((e) => !e.draft)).reverse();
  const drafts = inside.length - signed.length;
  const oneDay = start === end;
  const months = monthsBetween(start.slice(0, 7), end.slice(0, 7));
  const period = oneDay ? dmy(start) : a.length === 7 ? periodLabel(months) : `${dmy(start)} – ${dmy(end)}`;

  const reviewed = signed.filter((e) => e.masterAt).length;
  const lines: string[] = [];
  if (signed.length) lines.push(`${reviewed} of ${signed.length} ${signed.length === 1 ? 'entry' : 'entries'} reviewed and signed by the Master.`);
  if (!oneDay && signed.length) {
    const had = new Set(signed.map((e) => e.date.slice(0, 7)));
    const empty = months.filter((m) => !had.has(m));
    if (empty.length) lines.push(`No entries in ${empty.map((m) => periodLabel([m])).join(', ')}.`);
  }
  if (drafts) lines.push(`${drafts} unsigned ${drafts === 1 ? 'draft is' : 'drafts are'} not part of the log and not printed.`);
  if (signed.some((e) => !e.shipOffset)) lines.push("Entries signed before version 2.78 show ship's time only, as written.");

  const vName = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  const m1 = start.slice(0, 7).replace('-', '');
  const m2 = end.slice(0, 7).replace('-', '');
  const stamp = oneDay ? start.replace(/-/g, '') : m1 === m2 ? m1 : `${m1}-${m2}`;
  return {
    name: `DeckLog_${stamp}${vName ? `_${vName}` : ''}.pdf`,
    copy: {
      title: `Deck Watch Log · ${period}`,
      subtitle: `${header(vessel)} · Bridge logbook`,
      vessel: [vessel?.vessel_name, vessel?.imo ? `IMO ${vessel.imo}` : null].filter(Boolean).join(' · ') || 'Vessel',
      orientation: 'landscape',
      head: DECK_COPY_HEAD,
      rows: signed.map(deckRow),
      struck: signed.map(() => false),
      columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 20 }, 2: { cellWidth: 36 }, 3: { cellWidth: 32 }, 5: { cellWidth: 34 }, 6: { cellWidth: 34 } },
      verifications: lines,
      emptyText: oneDay ? 'No signed entries on this day.' : 'No signed entries in this period.',
    },
  };
}
