// ===================================
// A service station's report into the register (backlog #24, 16 Oct 2026).
//
// The backlog said "the station uploads its certificate into the vessel by
// invitation". The owner's answer: "the station in reality just sends a PDF with
// the results and the certificates — they can be loaded without connecting
// third parties (AI, for example) or entered by hand; usually one certificate
// per kind of equipment (extinguishers, EEBD…)". So nobody outside the vessel
// gets access: an officer opens the station's PDF here, the AI (or the officer)
// reads the certificate number, the station, the dates and the lines, and the
// app finds the items those lines are about:
//
//   serial    the station's serial number = the item's, ignoring case, spaces,
//             dashes and leading zeros ("CO2-00123" = "co2 123")
//   no        the item's number on board, within the category, only when it
//             picks out one item
//   category  a certificate with no lines (one paper for "all extinguishers
//             serviced") offers every item of the category
//
// Nothing is applied until the officer has looked at the list: each match can
// be unticked, each unmatched item of the category ticked. Applying writes the
// next date into the field the category keeps its date in (or the other one, if
// chosen), adds one line to the item's remarks — "Serviced 12.10.2026 by
// Firemaster, cert. 4471" or "CONDEMNED at service …" — and links the items to
// one equipment certificate carrying the PDF. Same ids, so labels, photos and
// the inspection trail stay where they are, as with bulk "Set dates".
//
// Pure: `npm run check:service` runs it in node.
// ===================================

import { CategoryKey, EquipmentItem } from '../types/equipment';
import { Certificate } from '../types/certificate';
import { parseDateCell } from '../utils/dates';
import { categoryFromWords } from './excelImport';

export type LineResult = 'ok' | 'fail' | 'condemned' | 'replaced' | '';

export interface ReportLine {
  serial?: string;
  no?: string;
  description?: string;
  location?: string;
  result: LineResult;
  /** This line's own next date, when the station gives one per item. */
  next?: string;
  remark?: string;
}

export interface ServiceReport {
  name: string;
  number: string;
  issuer: string;
  serviceDate?: string;
  nextDate?: string;
  category?: CategoryKey;
  lines: ReportLine[];
}

export const emptyReport = (): ServiceReport => ({ name: '', number: '', issuer: '', lines: [] });

/** What the AI is asked for — one row per item line; what the paper says once goes into every row. */
export const AI_FIELDS = [
  'Certificate No — the certificate / report number',
  'Service station — the company that did the service',
  'Equipment — what was serviced: fire extinguishers, EEBD, liferaft, BA sets, immersion suits…',
  'Service date — the date the service / inspection was done',
  'Next service — the next service / inspection due date',
  'Serial number — the item\'s serial number',
  'No — the item\'s number on board',
  'Description — type, size, make of the item',
  'Location — where it is on board',
  'Result — passed / failed / condemned / replaced',
  'Remarks — anything the station wrote about the item',
];

const RESULT: Array<[LineResult, RegExp]> = [
  ['condemned', /condemn|reject|scrap|withdraw|discard|end of life|u\/s|unserviceable/i],
  ['replaced', /replac|new unit|exchanged/i],
  ['fail', /fail|not ok|defect|refill required|recharge required/i],
  ['ok', /pass|ok\b|serviced|satisfact|good|refilled|recharged|tested|✓|^\s*yes\s*$/i],
];
export function resultOf(s: unknown): LineResult {
  const t = String(s ?? '').trim();
  if (!t) return '';
  for (const [r, re] of RESULT) if (re.test(t)) return r;
  return '';
}

const iso = (v: unknown) => {
  const d = parseDateCell(v);
  return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
};
const text = (v: unknown) => (v == null ? '' : String(v).trim());

/** The AI's rows (keyed by the field names before " — ") as a report. */
export function fromAiRows(rows: Record<string, unknown>[]): ServiceReport {
  const key = (o: Record<string, unknown>, name: string) => {
    const k = Object.keys(o).find((x) => x.split(' — ')[0].trim().toLowerCase() === name.toLowerCase());
    return k ? o[k] : undefined;
  };
  const first = (name: string) => rows.map((r) => text(key(r, name))).find(Boolean) ?? '';
  const equipment = first('Equipment');
  const r: ServiceReport = {
    name: equipment ? `${equipment} — service certificate` : 'Service certificate',
    number: first('Certificate No'),
    issuer: first('Service station'),
    serviceDate: iso(first('Service date')),
    nextDate: iso(first('Next service')),
    category: categoryFromWords(equipment) ?? categoryFromWords(rows.map((x) => text(key(x, 'Description'))).join(' ')) ?? undefined,
    lines: [],
  };
  for (const o of rows) {
    const line: ReportLine = {
      serial: text(key(o, 'Serial number')) || undefined,
      no: text(key(o, 'No')) || undefined,
      description: text(key(o, 'Description')) || undefined,
      location: text(key(o, 'Location')) || undefined,
      result: resultOf(key(o, 'Result')),
      next: iso(key(o, 'Next service')),
      remark: text(key(o, 'Remarks')) || undefined,
    };
    // A row that names no item is the paper's header, not a line.
    if (line.serial || line.no || line.description) r.lines.push(line);
  }
  // The next date of the paper: one given for all, else the earliest of the lines.
  if (!r.nextDate) r.nextDate = r.lines.map((l) => l.next).filter(Boolean).sort()[0];
  return r;
}

/** "CO2-00123", "co2 123" and "CO2/123" are one serial; "0" stays "0". */
export const normSerial = (s?: string) =>
  String(s ?? '')
    .toUpperCase()
    .split(/[\s\-_/.]+/)
    .map((p) => p.replace(/^0+(?=\d)/, ''))
    .join('');

export type MatchHow = 'serial' | 'no' | 'category';
export interface Match {
  itemId: string;
  how: MatchHow;
  line?: number;
}
export interface Matching {
  matches: Match[];
  /** Lines no item was found for — shown, never guessed. */
  unmatched: number[];
  /** Items of the category the report does not mention — offered unticked. */
  others: string[];
}

export function matchReport(rep: ServiceReport, flat: EquipmentItem[]): Matching {
  const inCat = rep.category ? flat.filter((i) => i.category === rep.category) : [];
  const taken = new Set<string>();
  const matches: Match[] = [];
  const unmatched: number[] = [];
  if (!rep.lines.length) {
    for (const it of inCat) matches.push({ itemId: it.id, how: 'category' });
    return { matches, unmatched, others: [] };
  }
  // Serials are searched across the register: the station may call a category by another name.
  const bySerial = new Map<string, EquipmentItem[]>();
  for (const it of flat) {
    const k = normSerial(it.serial);
    if (k) bySerial.set(k, [...(bySerial.get(k) ?? []), it]);
  }
  rep.lines.forEach((l, i) => {
    const s = normSerial(l.serial);
    let hit: EquipmentItem | undefined;
    let how: MatchHow = 'serial';
    if (s) {
      const c = (bySerial.get(s) ?? []).filter((x) => !taken.has(x.id));
      // Two items with one serial: the one in the report's category, else none.
      hit = c.length === 1 ? c[0] : c.find((x) => x.category === rep.category);
    }
    if (!hit && l.no && rep.category) {
      const c = inCat.filter((x) => x.no != null && String(x.no).trim() === l.no!.trim() && !taken.has(x.id));
      if (c.length === 1) {
        hit = c[0];
        how = 'no';
      }
    }
    if (hit) {
      taken.add(hit.id);
      matches.push({ itemId: hit.id, how, line: i });
    } else unmatched.push(i);
  });
  return { matches, unmatched, others: inCat.filter((x) => !taken.has(x.id)).map((x) => x.id) };
}

const dmy = (d?: string) => (d ? d.split('-').reverse().join('.') : '');

/** The remark line an item gets — one line, so a second Apply does not add it twice. */
export function remarkFor(rep: ServiceReport, line?: ReportLine): string {
  const by = [rep.issuer && `by ${rep.issuer}`, rep.number && `cert. ${rep.number}`].filter(Boolean).join(', ');
  const at = `at service${rep.serviceDate ? ` ${dmy(rep.serviceDate)}` : ''}${by ? ` (${by})` : ''}`;
  const tail = line?.remark ? ` — ${line.remark}` : '';
  switch (line?.result) {
    case 'condemned':
      return `CONDEMNED ${at}${tail}`;
    case 'fail':
      return `FAILED ${at}${tail}`;
    case 'replaced':
      return `Replaced ${at}${tail}`;
    default:
      return `Serviced${rep.serviceDate ? ` ${dmy(rep.serviceDate)}` : ''}${by ? ` ${by}` : ''}${tail}`;
  }
}

export interface ReportPick {
  itemId: string;
  line?: number;
}

/**
 * The register with the picks applied. A condemned or failed item does NOT get
 * the next date — it is not good until then; it gets the remark, and stays on
 * its old date so the list keeps showing it.
 */
export function applyReport(
  flat: EquipmentItem[],
  rep: ServiceReport,
  picks: ReportPick[],
  field: 'nextInspection' | 'expiry',
  now = Date.now()
): { items: EquipmentItem[]; changed: number; bad: number } {
  const byId = new Map(picks.map((p) => [p.itemId, p]));
  let changed = 0;
  let bad = 0;
  const items = flat.map((it) => {
    const p = byId.get(it.id);
    if (!p) return it;
    const line = p.line != null ? rep.lines[p.line] : undefined;
    const broken = line?.result === 'condemned' || line?.result === 'fail';
    if (broken) bad++;
    const next: EquipmentItem = { ...it };
    const date = line?.next ?? rep.nextDate;
    if (date && !broken) next[field] = date;
    const note = remarkFor(rep, line);
    const old = it.remarks?.trim();
    if (!old?.split('\n').some((l) => l.trim() === note)) next.remarks = old ? `${old}\n${note}` : note;
    if (next[field] === it[field] && next.remarks === it.remarks) return it;
    changed++;
    return { ...next, updatedAt: now };
  });
  return { items, changed, bad };
}

/** The equipment certificate the report becomes — or the existing one with the same number, extended. */
export function certificateFor(
  rep: ServiceReport,
  itemIds: string[],
  file: Pick<Certificate, 'fileUri' | 'fileName' | 'fileKind'> | null,
  existing: Certificate[],
  newId: string,
  now = Date.now()
): Certificate {
  const same = rep.number
    ? existing.find((c) => (c.scope ?? 'equipment') === 'equipment' && c.number?.trim().toLowerCase() === rep.number.trim().toLowerCase() && (!rep.issuer || !c.issuer || c.issuer.trim().toLowerCase() === rep.issuer.trim().toLowerCase()))
    : undefined;
  const base: Certificate = same ?? { id: newId, scope: 'equipment', name: '', itemIds: [], createdAt: now, updatedAt: now };
  return {
    ...base,
    name: rep.name.trim() || base.name || 'Service certificate',
    number: rep.number.trim() || base.number,
    issuer: rep.issuer.trim() || base.issuer,
    issueDate: rep.serviceDate ?? base.issueDate,
    expiryDate: rep.nextDate ?? base.expiryDate,
    ...(file?.fileUri ? { fileUri: file.fileUri, fileName: file.fileName, fileKind: file.fileKind } : {}),
    itemIds: [...new Set([...base.itemIds, ...itemIds])],
    updatedAt: now,
  };
}
