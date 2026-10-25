// ===================================
// Running hours from the AMS (alarm and monitoring system: K-Chief, Valmatic…).
// The AMS exports its counters as CSV or Excel — a tag, a description, a value,
// often a unit and a time. Each row is matched to a machine by the tag it was
// matched to last time (Machine.amsTag), else by name or serial, and checked
// by the same rule as a reading typed by hand (checkReading): a figure lower
// than the last, or more hours than the calendar allows, is not taken — it waits
// for a reason on the machine's screen, where it is entered by hand.
// ===================================

import { Machine, hasCounter } from '../types/pms';
import { checkReading } from './pms';
import { t } from '../utils/t';

export type AmsStatus = 'ok' | 'same' | 'older' | 'doubt' | 'follows' | 'dup' | 'unmatched';

export interface AmsRow {
  /** The AMS tag, or the description when the file has no tag column. */
  key: string;
  /** Description, when the file has one besides the tag. */
  label?: string;
  /** What the AMS counter shows. */
  shows: number;
  /** yyyy-mm-dd of the figure: the file's time, else today. */
  date: string;
  machineId?: string;
  /** Matched by Machine.amsTag (remembered), by name / serial, or picked by hand. */
  how?: 'tag' | 'name' | 'hand';
  /** The machine's running hours this makes: shows + counterOffset. */
  total?: number;
  status: AmsStatus;
  why?: string;
}

export interface AmsFile {
  rows: AmsRow[];
  /** Lines not read, with why — for the user to see, nothing is guessed. */
  skipped: string[];
}

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '');

const TAG = /^(tag|tagname|tagid|point|pointid|channel|address|signal|id|code|sensor)$/;
const NAME = /(description|desc|name|equipment|machine|object|text|label|item|component)/;
const HOURS = /(hours|hrs|value|reading|counter|runninghours|runhours|rh|total)/;
const DATE = /(date|time|timestamp|logged|updated)/;
const UNIT = /^(unit|units|eng|engunit|uom)$/;

/** A number from a cell: "12 345,6", "12,345.6", "12345.6 h". */
export function hoursCell(raw: unknown): number | undefined {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : undefined;
  let s = String(raw ?? '').trim().replace(/\s*(h|hrs?|hours?)\.?$/i, '').replace(/[\s ']/g, '');
  if (!s) return undefined;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  return Number(s);
}

/** The day of a time cell: a Date, an Excel serial, "2026-10-24 08:00", "24.10.2026 08:00" (day first). Not later than today. */
function dateCell(raw: unknown, today: string): string | undefined {
  const pad = (n: number) => String(n).padStart(2, '0');
  let d: string | undefined;
  if (raw instanceof Date && !isNaN(raw.getTime())) d = `${raw.getFullYear()}-${pad(raw.getMonth() + 1)}-${pad(raw.getDate())}`;
  else if (typeof raw === 'number' && raw > 20000 && raw < 80000) d = new Date(Date.UTC(1899, 11, 30) + Math.floor(raw) * 86400000).toISOString().slice(0, 10);
  else if (typeof raw === 'string') {
    const s = raw.trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) d = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
    else if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/))) d = `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  }
  if (!d || !/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)) return undefined;
  return d > today ? today : d;
}

/**
 * Read the AMS export (first sheet, as rows) and match it to the machines.
 * `picked` holds the user's own choice for a row the file could not match (row key → machine id).
 */
export function readAms(cells: unknown[][], machines: Machine[], today: string, picked: Record<string, string> = {}): AmsFile {
  const skipped: string[] = [];
  const live = machines.filter((m) => !m.deleted && !m.scrapped && hasCounter(m));

  // The header: the first of the top 15 lines naming a tag or description and a value.
  let head = -1;
  let col = { tag: -1, name: -1, hours: -1, date: -1, unit: -1 };
  for (let i = 0; i < Math.min(15, cells.length); i++) {
    const h = (cells[i] ?? []).map(norm);
    const find = (re: RegExp) => h.findIndex((x) => re.test(x));
    const tag = find(TAG);
    const c = { tag, name: h.findIndex((x, k) => k !== tag && NAME.test(x)), hours: -1, date: find(DATE), unit: find(UNIT) };
    c.hours = h.findIndex((x, k) => HOURS.test(x) && k !== c.tag && k !== c.name && k !== c.date && k !== c.unit);
    if ((c.tag >= 0 || c.name >= 0) && c.hours >= 0) {
      head = i;
      col = c;
      break;
    }
  }
  // No header: the first text column and the first number column.
  if (head < 0) {
    const first = cells.find((r) => (r ?? []).some((x) => hoursCell(x) != null) && (r ?? []).some((x) => typeof x === 'string' && x.trim() && hoursCell(x) == null)) ?? [];
    col.name = first.findIndex((x) => typeof x === 'string' && x.trim() && hoursCell(x) == null);
    col.hours = first.findIndex((x, k) => k !== col.name && hoursCell(x) != null && !(x instanceof Date));
    if (col.name < 0 || col.hours < 0) return { rows: [], skipped: [t('ams.noColumns')] };
  }

  // One figure per tag: an export that logs every hour keeps the newest.
  const byKey = new Map<string, Omit<AmsRow, 'status'>>();
  cells.slice(head + 1).forEach((r, i) => {
    const line = head + 2 + i;
    const tag = col.tag >= 0 ? String(r?.[col.tag] ?? '').trim() : '';
    const name = col.name >= 0 ? String(r?.[col.name] ?? '').trim() : '';
    const key = tag || name;
    if (!key && (r ?? []).every((x) => x == null || String(x).trim() === '')) return;
    const shows = hoursCell(r?.[col.hours]);
    if (!key || shows == null) return void skipped.push(t('ams.lineNotRead', { n: line }));
    const unit = col.unit >= 0 ? norm(r?.[col.unit]) : '';
    if (unit && !/^(h|hr|hrs|hour|hours|rh|ч|час|часы)$/.test(unit)) return void skipped.push(t('ams.lineUnit', { n: line, key, unit: String(r?.[col.unit]).trim() }));
    const date = (col.date >= 0 ? dateCell(r?.[col.date], today) : undefined) ?? today;
    const have = byKey.get(norm(key));
    if (have && have.date > date) return;
    byKey.set(norm(key), { key, ...(tag && name ? { label: name } : {}), shows, date });
  });

  const taken = new Set<string>();
  const rows: AmsRow[] = [...byKey.values()].map((r) => {
    let m: Machine | undefined;
    let how: AmsRow['how'];
    const k = norm(r.key);
    if (picked[r.key]) { m = live.find((x) => x.id === picked[r.key]); how = 'hand'; }
    if (!m) { m = live.find((x) => x.amsTag && norm(x.amsTag) === k); how = 'tag'; }
    if (!m) {
      const names = [k, norm(r.label)].filter(Boolean);
      m = live.find((x) => names.includes(norm(x.name)) || (!!x.serial && names.includes(norm(x.serial))));
      how = 'name';
    }
    if (!m) return { ...r, status: 'unmatched' };
    const base = { ...r, machineId: m.id, how };
    if (taken.has(m.id)) return { ...base, status: 'dup', why: t('ams.dup') };
    taken.add(m.id);
    if (m.followsParent) return { ...base, status: 'follows', why: t('ams.follows') };
    const total = Math.round((r.shows + (m.counterOffset ?? 0)) * 10) / 10;
    const out = { ...base, total };
    if (m.hoursDate && r.date < m.hoursDate) return { ...out, status: 'older', why: t('ams.older', { date: m.hoursDate.split('-').reverse().join('.') }) };
    if (m.hours === total && m.hoursDate === r.date) return { ...out, status: 'same' };
    const c = checkReading(m, r.date, total);
    if (c.ok === false) return { ...out, status: 'doubt', why: c.why };
    return { ...out, status: 'ok' };
  });
  return { rows, skipped };
}
