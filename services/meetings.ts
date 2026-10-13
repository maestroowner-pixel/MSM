// ===================================
// Monthly safety meeting (types/meetings.ts) — numbers, the next one due, the
// open actions carried forward, a new meeting laid out. Pure: no storage, no React.
// ===================================

import { AgendaItem, CarriedAction, MEETING_AGENDA, SafetyMeeting } from '../types/meetings';
import type { Attendee } from '../types/drills';
import { uid } from '../utils/id';
import type { MedDoc, SigBox } from './hospitalReport';
import type { SignProof } from './signature';
import { attendanceSig } from './drills';

export function nextMeetingNo(list: Pick<SafetyMeeting, 'no'>[], date: string): string {
  const y = date.slice(0, 4);
  const re = new RegExp(`^SM-${y}-(\\d+)$`);
  const top = list.reduce((m, d) => Math.max(m, Number(re.exec(d.no)?.[1] ?? 0)), 0);
  return `SM-${y}-${String(top + 1).padStart(3, '0')}`;
}

export const heldMeetings = (list: SafetyMeeting[]) => list.filter((m) => m.doneAt && !m.deleted).sort((a, b) => b.date.localeCompare(a.date));

/** Monthly: a meeting this calendar month, or the last one more than a month ago. */
export function meetingDue(list: SafetyMeeting[], today: string): { last?: SafetyMeeting; due: boolean; overdue: boolean } {
  const last = heldMeetings(list)[0];
  if (!last) return { due: true, overdue: false };
  const thisMonth = last.date.slice(0, 7) === today.slice(0, 7);
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last.date}T00:00:00Z`)) / 86400000);
  return { last, due: !thisMonth, overdue: !thisMonth && days > 35 };
}

/** The actions still open after the last meeting held: its new ones, and those it carried and did not close. */
export function openActions(list: SafetyMeeting[]): CarriedAction[] {
  const last = heldMeetings(list)[0];
  if (!last) return [];
  return [
    ...last.carried.filter((c) => !c.done).map((c) => ({ ...c, done: false, note: undefined })),
    ...last.actions.map((a) => ({ ...a, fromNo: last.no, done: false })),
  ].map((c) => Object.fromEntries(Object.entries(c).filter(([, v]) => v !== undefined)) as unknown as CarriedAction);
}

export function freshMeeting(list: SafetyMeeting[], people: { name: string; rank?: string }[], today: string): SafetyMeeting {
  const agenda: AgendaItem[] = MEETING_AGENDA.map((topic) => ({ id: uid('ag'), topic }));
  const attendance: Attendee[] = people.map((p) => ({ name: p.name, ...(p.rank ? { rank: p.rank } : {}), present: false }));
  return { id: uid('sm'), no: '', date: today, agenda, attendance, carried: openActions(list), actions: [], plannedBy: '', updatedAt: Date.now() };
}

export const MEETING_STATE_LABEL = { planned: 'Not signed yet', done: 'Held and signed' } as const;

// ---- the record, printed (services/hospitalReport MedDoc → PDF) ----

/** Ship's time, as on every other record — never UTC. */
const localStamp = (at: number) => {
  const d = new Date(at);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

// As services/signature proofShort — kept here so this file stays free of storage.
const proofShort = (p?: SignProof) => (!p ? '' : p.method === 'biometric' ? 'signed biometrically' : p.method === 'drawn' ? 'signed by hand' : 'signed by PIN');

export function meetingDoc(m: SafetyMeeting, vesselLine: string): MedDoc {
  const present = m.attendance.filter((a) => a.present);
  const sig: SigBox[] = m.doneAt
    ? [{ role: 'Chaired and signed by', name: m.doneByRank ? `${m.doneBy} (${m.doneByRank})` : m.doneBy ?? '', detail: [proofShort(m.doneWith), localStamp(m.doneAt)].filter(Boolean).join(' · '), ...(m.doneWith?.drawing ? { drawing: m.doneWith.drawing } : {}) }]
    : [{ role: 'Chaired and signed by', name: '', detail: 'not signed yet' }];
  return {
    title: `Monthly safety meeting ${m.no || ''}`.trim(),
    vesselLine: `${vesselLine}${m.doneAt ? '' : ' · DRAFT — not signed'}`,
    sections: [
      { title: 'Meeting', rows: [['Date', `${m.date}${m.time ? ` ${m.time}` : ''}`], ['Place', m.location || '—'], ['Present', `${present.length} of ${m.attendance.length}`]] },
      { title: 'Attendance', table: { head: ['#', 'Name', 'Rank', 'Present', 'Signed'], rows: m.attendance.map((a, i) => [String(i + 1), a.name, a.rank ?? '', a.present ? 'yes' : a.reason ? `no — ${a.reason}` : 'no', attendanceSig(a)]) } },
      { title: 'Agenda and discussion', table: { head: ['#', 'Item', 'Discussed'], rows: m.agenda.map((g, i) => [String(i + 1), g.topic, g.notes ?? '']) } },
      ...(m.carried.length ? [{ title: 'Actions from earlier meetings', table: { head: ['From', 'Action', 'Who', 'Due', 'Status'], rows: m.carried.map((c) => [c.fromNo, c.text, c.who ?? '', c.due ?? '', c.done ? `done${c.note ? ` — ${c.note}` : ''}` : `open${c.note ? ` — ${c.note}` : ''}`]) } }] : []),
      { title: 'New actions', table: { head: ['#', 'Action', 'Who', 'Due'], rows: m.actions.length ? m.actions.map((a, i) => [String(i + 1), a.text, a.who ?? '', a.due ?? '']) : [['', 'None', '', '']] } },
      ...(m.minutes ? [{ title: 'Other business', text: m.minutes }] : []),
      { title: 'Signature', signatures: sig },
    ],
  };
}

/** The attendance list alone — to print and pass round, or with the lines signed on the screen. */
export function attendanceDoc(m: SafetyMeeting, vesselLine: string): MedDoc {
  return {
    title: `Safety meeting — attendance list ${m.no || ''}`.trim(),
    vesselLine: `${vesselLine} · ${m.date}${m.time ? ` ${m.time}` : ''}${m.location ? ` · ${m.location}` : ''}`,
    sections: [{ title: 'Attendance', table: { head: ['#', 'Name', 'Rank', 'Present', 'Signature'], rows: m.attendance.map((a, i) => [String(i + 1), a.name, a.rank ?? '', a.present ? 'yes' : '', attendanceSig(a)]) } }],
  };
}
