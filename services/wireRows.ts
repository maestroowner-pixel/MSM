// ===================================
// Ropes and wires on paper — the rows, pure (services/wireReport.ts draws them;
// the list and the item card use the same lines). English always.
// ===================================

import { WireIssue, WireState, isWire, sortRopes, wireApplies, wireState } from './wireLog';
import { LIFTING_KEYS } from '../constants/lifting';
import { CATEGORY_MAP } from '../constants/categories';
import type { EquipmentItem } from '../types/equipment';
import { WIRE_FINDING_EN, WIRE_KIND_EN, WireEntry } from '../types/wireLog';

export const dmy = (iso?: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
export const ISSUE_EN: Record<WireIssue, string> = {
  discard: 'Discard (last look)',
  diameter: 'At discard diameter',
  length: 'Below shortest length',
  age: 'Past its years in service',
  brake: 'Brake test failed',
  poor: 'Poor (last look)',
  soon: 'Discard diameter within 90 days',
  nearDia: 'Three quarters of the wear allowance gone',
  nearLength: 'Near shortest length',
  nearAge: 'Retires within 90 days',
};

export const ropeName = (i: EquipmentItem) => [i.type || i.make, i.marking, i.no != null ? `No. ${i.no}` : null].filter(Boolean).join(' ') || i.id;

export function ropesOf(items: EquipmentItem[], log: WireEntry[], today: string) {
  return sortRopes(items.filter((i) => wireApplies(i, LIFTING_KEYS)).map((item) => ({ item, name: ropeName(item), state: wireState(item, log, today) })));
}

/** What one entry says, in a line. */
export function entryLine(e: WireEntry): string {
  const p: string[] = [];
  if (e.rating) p.push(e.rating.toUpperCase());
  if (e.diameterMm != null) p.push(`${e.diameterMm} mm`);
  if (e.brokenWires != null) p.push(`${e.brokenWires} broken wires`);
  if (e.findings?.length) p.push(e.findings.map((f) => WIRE_FINDING_EN[f]).join(', '));
  if (e.cutM != null) p.push(`${e.cutM} m cut at the ${e.end === 'drum' ? 'drum' : 'outboard'} end`);
  if (e.brakeOk != null) p.push(e.brakeOk ? 'held' : 'FAILED');
  if (e.brakeLoad) p.push(e.brakeLoad);
  if (e.lengthM != null) p.push(`${e.lengthM} m`);
  if (e.diaNew != null) p.push(`${e.diaNew} mm`);
  if (e.certNo) p.push(`cert. ${e.certNo}`);
  if (e.photos?.length) p.push(`${e.photos.length} photo${e.photos.length > 1 ? 's' : ''}`);
  if (e.note) p.push(e.note);
  return p.join(' · ');
}

export const HEAD = ['Rope / gear', 'Category', 'Material', 'Nominal mm', 'Last mm', 'Loss %', 'Discard mm', 'Loss mm/yr', 'Discard by', 'Length m', 'Cut and slip', 'In service', 'Last look', 'Status'];

export function ropeRows(items: EquipmentItem[], log: WireEntry[], today: string): string[][] {
  return ropesOf(items, log, today).map(({ item, name, state: s }) => [
    name,
    CATEGORY_MAP[item.category]?.label ?? item.category,
    item.material ?? (isWire(item) ? 'Wire' : ''),
    s.nominal != null ? String(s.nominal) : '',
    s.lastDia != null ? `${s.lastDia} (${dmy(s.lastDiaOn)})` : '',
    s.lossPct != null ? String(s.lossPct) : '',
    s.discardAt != null ? `${s.discardAt}${s.discardAssumed ? ' (10% assumed)' : ''}` : '',
    s.mmPerYear != null ? String(s.mmPerYear) : '',
    dmy(s.discardOn),
    s.length != null ? `${s.length}${s.minLength != null ? ` (min ${s.minLength})` : ''}` : '',
    s.cuts ? `${s.cuts} cut${s.cuts > 1 ? 's' : ''}, ${s.cutTotal} m` : '',
    s.since ? `${dmy(s.since)}${s.years != null ? `, ${s.years} y` : ''}` : '',
    s.lastLook ? `${dmy(s.lastLook.on)} ${s.lastLook.rating ? s.lastLook.rating.toUpperCase() : ''}`.trim() : '',
    statusText(s),
  ]);
}

export const statusText = (s: WireState) => (s.issues.length ? s.issues.map((i) => ISSUE_EN[i]).join('; ') : 'OK');

export const LOG_HEAD = ['Date', 'Entry', 'Details', 'Signed'];
export const logRows = (s: WireState) => [...s.entries].reverse().map((e) => [dmy(e.date), WIRE_KIND_EN[e.kind], entryLine(e), [e.by, e.byRank].filter(Boolean).join(', ')]);

