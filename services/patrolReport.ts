// ===================================
// Security rounds and key register reports — PDF through the shared table report
// (services/pmsHistoryReport). Day: every round due, done or missed, who, when,
// which checkpoints; month: day by day, then every round; the duties of each
// round printed with it (Jez, 17 Oct 2026). Keys: out now, the register, the
// movements of the period.
// ===================================

import { VesselInfo } from './storage';
import { exportPmsHistory } from './pmsHistoryReport';
import { dayRounds, keyStatus, keysOut, livePlans, monthSummary } from './patrols';
import { todayIso } from './pms';
import { Patrol, PatrolPlan } from '../types/patrols';
import { KeyItem, KeyMove } from '../types/keys';

const hm = (t: number) => new Date(t).toTimeString().slice(0, 5);
const dmy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const stamp = (t: number) => `${dmy(new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10))} ${hm(t)}`;
type T = { title: string; head: string[]; rows: string[][]; widths?: Record<number, number> };

const roundRow = (p: Patrol, total: number) => [
  `${hm(p.startedAt)}–${hm(p.finishedAt)}`,
  p.byRank ? `${p.by} (${p.byRank})` : p.by,
  `${p.visits.length}/${total}`,
  p.missed.map((m) => m.code).join(', ') || '—',
  [p.dutiesDone ? '' : 'duties not confirmed', p.remarks ?? ''].filter(Boolean).join(' · ') || '—',
];

const dutiesTables = (plans: PatrolPlan[]): T[] =>
  livePlans(plans).map((p) => ({ title: `Duties — ${p.name} (${p.times.join(', ')})`, head: ['#', 'Duty'], rows: p.duties.map((d, i) => [String(i + 1), d]), widths: { 0: 12, 1: 261 } }));

export function exportPatrolDay(date: string, plans: PatrolPlan[], patrols: Patrol[], vessel: VesselInfo | null) {
  const r = dayRounds(date, plans, patrols, { date: todayIso(), hhmm: hm(Date.now()) });
  const done = r.filter((x) => x.done);
  const missed = r.filter((x) => !x.done && !x.pending).length;
  const facts = [`${r.length} rounds due`, `${done.length} done`, `${missed} missed`, ...(r.some((x) => x.pending) ? [`${r.filter((x) => x.pending).length} still to come`] : []), `${done.reduce((n, x) => n + x.done!.missed.length, 0)} checkpoints missed`];
  const rounds: T = {
    title: 'Rounds',
    head: ['Due', 'Round', 'Done', 'By', 'Visited', 'Checkpoints missed', 'Remarks'],
    rows: r.map((x) => (x.done ? [x.slot, x.plan.name, ...roundRow(x.done, x.plan.checkpointIds.length || x.done.visits.length + x.done.missed.length)] : [x.slot, x.plan.name, x.pending ? (date === todayIso() && x.slot <= hm(Date.now()) ? 'due now' : 'not yet due') : 'MISSED', '—', '—', '—', '—'])),
    widths: { 0: 14, 1: 45, 2: 24, 3: 45, 4: 18, 5: 55, 6: 72 },
  };
  const visits: T = {
    title: 'Checkpoints visited',
    head: ['Round', 'Time', 'Checkpoint', 'How'],
    rows: done.flatMap((x) => x.done!.visits.map((v) => [`${x.slot} ${x.plan.name}`, hm(v.at), `${v.code} · ${v.name}`, v.how === 'scan' ? 'QR scanned' : 'ID typed'])),
    widths: { 0: 70, 1: 20, 2: 140, 3: 43 },
  };
  return exportPmsHistory('Security rounds', `Security rounds ${date}`, vessel, [{ title: `Security rounds — ${dmy(date)}`, facts, tables: [rounds, visits, ...dutiesTables(plans)] }]);
}

export function exportPatrolMonth(month: string, today: string, plans: PatrolPlan[], patrols: Patrol[], vessel: VesselInfo | null) {
  const days = monthSummary(month, plans, patrols, today, hm(Date.now()));
  const due = days.reduce((n, d) => n + d.due, 0);
  const done = days.reduce((n, d) => n + d.done, 0);
  const facts = [`${days.length} days`, `${due} rounds due`, `${done} done`, `${due - done} missed`, `${days.reduce((n, d) => n + d.points, 0)} checkpoints missed`];
  const byDay: T = { title: 'Day by day', head: ['Date', 'Due', 'Done', 'Rounds missed', 'Checkpoints missed'], rows: days.map((d) => [dmy(d.date), String(d.due), String(d.done), d.missed.join(', ') || '—', String(d.points || '—')]), widths: { 0: 24, 1: 14, 2: 14, 3: 191, 4: 30 } };
  const all = patrols.filter((p) => p.date.startsWith(month)).sort((a, b) => a.startedAt - b.startedAt);
  const list: T = {
    title: 'Rounds done',
    head: ['Date', 'Due', 'Round', 'Done', 'By', 'Visited', 'Checkpoints missed', 'Remarks'],
    rows: all.map((p) => [dmy(p.date), p.slot ?? '—', p.planName, ...roundRow(p, p.visits.length + p.missed.length)]),
    widths: { 0: 22, 1: 14, 2: 40, 3: 24, 4: 40, 5: 16, 6: 50, 7: 67 },
  };
  return exportPmsHistory('Security rounds', `Security rounds ${month}`, vessel, [{ title: `Security rounds — ${month}`, facts, tables: [byDay, list, ...dutiesTables(plans)] }]);
}

export function exportKeyReport(from: string, to: string, keys: KeyItem[], moves: KeyMove[], vessel: VesselInfo | null) {
  const live = keys.filter((k) => !k.deleted);
  const st = keyStatus(live, moves);
  const out = keysOut(live, moves, Date.now());
  const period = moves.filter((m) => { const d = new Date(m.at - new Date(m.at).getTimezoneOffset() * 60000).toISOString().slice(0, 10); return d >= from && d <= to; }).sort((a, b) => a.at - b.at);
  const facts = [`${live.length} keys`, `${out.length} out now`, `${period.length} movements ${dmy(from)} – ${dmy(to)}`];
  const tables: T[] = [
    { title: 'Out now', head: ['Key', 'Opens', 'Held by', 'Since', 'Days', 'Due back'], rows: out.map((o) => [o.key.code, o.key.name, o.move.personRank ? `${o.move.person} (${o.move.personRank})` : o.move.person, stamp(o.move.at), String(o.days), o.move.dueBack ? dmy(o.move.dueBack) : '—']), widths: { 0: 20, 1: 80, 2: 70, 3: 40, 4: 15, 5: 48 } },
    { title: 'Register', head: ['Key', 'Opens', 'Kept', 'Status'], rows: live.sort((a, b) => a.code.localeCompare(b.code)).map((k) => { const m = st.get(k.id); return [k.code, k.name, k.location ?? '—', m?.dir === 'out' ? `OUT — ${m.person}` : 'On the board']; }), widths: { 0: 20, 1: 110, 2: 70, 3: 73 } },
    { title: 'Movements', head: ['Date', 'Key', 'Out / in', 'Person', 'Recorded by', 'Note'], rows: period.map((m) => [stamp(m.at), `${m.code} · ${m.name}`, m.dir === 'out' ? 'OUT' : 'Back', m.personRank ? `${m.person} (${m.personRank})` : m.person, m.by, m.note ?? '—']), widths: { 0: 32, 1: 70, 2: 18, 3: 55, 4: 45, 5: 53 } },
  ];
  return exportPmsHistory('Key register', `Key register ${from} ${to}`, vessel, [{ title: 'Key register', facts, tables }]);
}
