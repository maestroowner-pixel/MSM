// ===================================
// What the AI is told about the vessel when someone asks it a question (AI no. 3,
// 14 Oct 2026). Built here, on the device, from what the app already holds —
// the Board's own reading (needs attention, plan, summaries), the equipment
// with its dates, certificates, open defects, inspections lately, drills,
// stores. Never in it: patients (the medical log), guests (names and
// documents), crew passports and personal details.
// ===================================

import type { Board } from './board';
import type { EquipmentItem } from '../types/equipment';
import type { Certificate } from '../types/certificate';
import type { Inspection } from '../types/inspection';
import type { CrewMember } from '../types/crew';
import { Drill, drillTitle } from '../types/drills';
import { complianceDate, computeStatus } from '../utils/dates';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';

export interface AskData {
  vesselName?: string;
  today: string;
  board: Board;
  flat: EquipmentItem[];
  labelOf: (cat: string) => string;
  certificates: Certificate[];
  inspections: Inspection[];
  crew: CrewMember[];
  drills?: Drill[];
}

const MAX = 55000;

export function askContext(d: AskData): string {
  const out: string[] = [];
  const push = (title: string, lines: string[]) => {
    if (!lines.length) return;
    out.push(`## ${title}`, ...lines, '');
  };
  push('Vessel', [`${d.vesselName ?? 'The vessel'} · today ${d.today}`, ...(d.board.status.pob ? [`Persons on board ${d.board.status.pob.total}${d.board.status.pob.ashore ? `, ashore ${d.board.status.pob.ashore}` : ''}`] : []), ...(d.board.status.isps ? [`ISPS level ${d.board.status.isps}`] : [])]);
  push('Needs attention (the Board)', d.board.attention.map((a) => `- ${a.title}${a.sub ? ` — ${a.sub}` : ''}`));
  push('Plan', d.board.plan.map((p) => `- ${p.title} — ${p.sub}`));
  push('Today', d.board.today.map((t) => `- ${t.title}: ${t.done ? 'done' : 'not done'}`));
  push('Sections', d.board.tiles.map((t) => `- ${t.label}: ${t.line}`));
  for (const s of d.board.summaries) push(s.title, [...(s.table ? s.table.rows.map((r) => `- ${r.cells[0]}: on board ${r.cells[1]}, ashore ${r.cells[2]}`) : []), ...s.rows.map((r) => `- ${r.label}: ${r.value}${r.more?.length ? ` (${r.more.join('; ')})` : ''}`)]);
  push('Crew on the list', d.crew.filter((c) => !c.deleted && c.active).map((c) => `- ${c.name}${c.rank ? `, ${c.rank}` : ''}${c.onBoard === false ? ' (signed off)' : ''}`));
  push('Certificates (expiry)', d.certificates.filter((c) => c.expiryDate).sort((a, b) => a.expiryDate!.localeCompare(b.expiryDate!)).map((c) => `- ${c.name}${c.holderName ? ` — ${c.holderName}` : ''}${c.number ? ` No. ${c.number}` : ''}: expires ${c.expiryDate}`));
  const open = d.inspections.filter((i) => i.defect?.open).sort((a, b) => b.at - a.at);
  const nameOf = (id: string) => { const it = d.flat.find((x) => x.id === id); return it ? `${typeWithSize(it) || d.labelOf(it.category)}${itemNumber(it) ? ` ${itemNumber(it)}` : ''}${itemLocation(it) ? ` (${itemLocation(it)})` : ''}` : id; };
  push('Open defects', open.map((i) => `- ${nameOf(i.itemId)}: ${i.defect!.note} — raised ${new Date(i.at).toISOString().slice(0, 10)} by ${i.by}`));
  push('Inspections in the last 60 days', d.inspections.filter((i) => Date.now() - i.at < 60 * 86400000).sort((a, b) => b.at - a.at).slice(0, 300).map((i) => `- ${new Date(i.at).toISOString().slice(0, 10)} ${nameOf(i.itemId)} — ${i.outcome ?? ''} by ${i.by}`));
  push('Drills carried out', (d.drills ?? []).filter((x) => x.doneAt && !x.deleted).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80).map((x) => `- ${x.date} ${drillTitle(x)}${x.topic ? ` — ${x.topic}` : ''} (${x.attendance.filter((a) => a.present).length} present)`));
  const items = d.flat.map((it) => ({ it, due: complianceDate(it), st: computeStatus(it) })).sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  push(`Equipment (${d.flat.length} items, soonest due first)`, items.map(({ it, due, st }) => `- ${d.labelOf(it.category)}: ${typeWithSize(it) || '—'}${itemNumber(it) ? ` ${itemNumber(it)}` : ''}${it.serial ? ` S/N ${it.serial}` : ''}${itemLocation(it) ? ` at ${itemLocation(it)}` : ''} — ${due ? `due ${due}` : 'no date'} (${st})`));
  const text = out.join('\n');
  return text.length > MAX ? `${text.slice(0, MAX)}\n…(cut — the list is longer)` : text;
}

/** Questions to start from. */
export const ASK_EXAMPLES = [
  'What expires in the next 30 days?',
  'Which equipment is overdue for inspection?',
  'What open defects are there, and since when?',
  'When was the last enclosed space drill?',
  'What should I prepare for a port state control inspection?',
];
