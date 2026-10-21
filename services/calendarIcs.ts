// ===================================
// Due dates as a calendar file (.ics, RFC 5545) — backlog #26. Outlook, Google,
// Apple Calendar import it; every line of Inspection readiness that has a date
// from today on becomes an all-day event with a reminder a week before.
//
// The same list as the Readiness screen (services/readiness.ts), looked at a
// year ahead, so the calendar and the screen never disagree about a date. Past
// dates are left out: a calendar is for what is coming — what is already
// overdue is on the Readiness screen in red.
//
// Each event's UID is the record's key, so importing a fresh file again moves
// a date that changed instead of adding a second event (in the calendars that
// honour UIDs — Outlook and Apple do; Google adds the file as new events).
// Pure: no RN imports, so `npm run check:readiness` runs it in node.
// ===================================

import { Readiness, ReadinessInput, buildReadiness } from './readiness';

export const ICS_AHEAD = 365;
export const ICS_REMIND_DAYS = 7;

export interface IcsEvent {
  uid: string;
  date: string; // YYYY-MM-DD
  summary: string;
  description: string;
}

/** The events: every dated line from `today` on, within a year. */
export function icsEvents(r: Readiness, vesselName = ''): IcsEvent[] {
  const out: IcsEvent[] = [];
  for (const s of r.sections) {
    for (const g of s.gaps) {
      if (!g.date || g.date < r.today) continue;
      // "in 12 days" is true on the day the file is made, not on the day it is read.
      const sub = (g.sub ?? '').replace(/\s*—?\s*in \d+ days?\b/g, '').trim();
      out.push({
        uid: `${g.key.replace(/[^A-Za-z0-9:_-]/g, '_')}@ismpilot.com`,
        date: g.date,
        summary: `${g.title}${vesselName ? ` — ${vesselName}` : ''}`,
        description: [s.title, sub].filter(Boolean).join('\n'),
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.summary.localeCompare(b.summary));
}

export function buildCalendar(x: Omit<ReadinessInput, 'kind' | 'date' | 'ahead'>): Readiness {
  return buildReadiness({ ...x, kind: 'psc', date: x.today, ahead: ICS_AHEAD });
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const ymd = (iso: string) => iso.replace(/-/g, '');
const nextDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** RFC 5545 §3.1: lines longer than 75 octets go on in a line starting with a space. */
export function fold(line: string): string {
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (parts.length ? 74 : 75)) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** The whole file. `stamp` is the moment it is made (UTC, for DTSTAMP). */
export function toIcs(events: IcsEvent[], calName: string, stamp: Date): string {
  const dt = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ISM AI Pilot//Due dates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${dt}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(e.date))}`,
      `SUMMARY:${esc(e.summary)}`,
      `DESCRIPTION:${esc(e.description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(e.summary)}`,
      `TRIGGER:-P${ICS_REMIND_DAYS}D`,
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
