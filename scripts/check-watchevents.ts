// npm run check:watchevents — a LIVE deck watch entry gathers the gangway and the inspections of its window (services/watchEvents).
// Run with TZ=UTC: no ship's clock set, so ship's time is the device's.
import { watchEvents, withEvents } from '../services/watchEvents';
import type { CrewMove, Visitor } from '../types/security';
import type { Inspection } from '../types/inspection';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const T = (s: string) => Date.parse(`${s}:00Z`);
const move = (id: string, crewId: string, name: string, dir: CrewMove['dir'], at: string, boat?: string): CrewMove =>
  ({ id, crewId, name, dir, date: at.slice(0, 10), time: at.slice(11, 16), at: T(at), by: 'Gangway', via: 'qr', boat, updatedAt: T(at) });
const insp = (id: string, at: string, outcome: 'pass' | 'fail', extra: Partial<Inspection> = {}): Inspection =>
  ({ id, itemId: id, category: 'lifejackets', at: T(at), by: 'J. Smith', period: 'weekly', templateId: 'x', templateVersion: 1, results: {}, outcome, item: { no: id.slice(1) }, ...extra } as Inspection);
const vis = (name: string, date: string, timeIn: string, timeOut?: string, dateOut?: string): Visitor =>
  ({ id: name, date, timeIn, timeOut, dateOut, name, company: 'Port Agency', purpose: 'Documents', inBy: 'AB', updatedAt: 0 } as Visitor);

const src = {
  moves: [
    move('m0', 'c1', 'Max Payne', 'ashore', '2026-11-15T07:59'),
    move('m1', 'c1', 'Max Payne', 'ashore', '2026-11-15T08:10'),
    move('m2', 'p1', 'Anna Lee', 'aboard', '2026-11-15T09:05', 'Tender 1'),
    move('m3', 'c2', 'Eva Stone', 'aboard', '2026-11-15T12:01'),
  ],
  visitors: [vis('Peter Hall', '2026-11-15', '08:30', '11:45'), vis('Old Visit', '2026-11-14', '10:00')],
  passengerIds: new Set(['p1']),
  inspections: [
    insp('i1', '2026-11-15T09:00', 'pass'), insp('i2', '2026-11-15T09:02', 'pass'), insp('i3', '2026-11-15T09:04', 'pass'),
    insp('i4', '2026-11-15T09:06', 'fail', { defect: { note: 'Light missing', open: true } }),
    insp('i5', '2026-11-10T09:00', 'fail', { defect: { note: 'Strap torn', open: false, closedAt: T('2026-11-15T10:30'), closedBy: 'Bosun', closedNote: 'Strap renewed' } }),
  ],
  catName: (c: string) => (c === 'lifejackets' ? 'Lifejackets' : c),
};

const ev = watchEvents(T('2026-11-15T08:00'), T('2026-11-15T12:00'), src);
const lines = ev.map((e) => e.line);
console.log(lines.join('\n'));
ok(lines[0] === '08:10 Max Payne went ashore', 'crew crossing in the window, by name; one before the window left out');
ok(lines.includes('09:05 Passenger A…e came aboard by Tender 1'), 'a passenger is masked; the boat is named');
ok(lines.includes('08:30 Visitor P…l (Port Agency) came aboard — Documents') && lines.includes('11:45 Visitor P…l (Port Agency) left'), 'a visitor on and off, masked');
ok(!lines.some((l) => l.includes('O…t')), 'a visitor of another day is not in it');
ok(lines.includes('09:00 Lifejackets — weekly inspection, 3 items passed (J. Smith)'), 'passes of one category and round are one line');
ok(lines.includes('09:06 Lifejackets No. 4 — weekly inspection FAILED: Light missing (J. Smith)'), 'a failure is its own line with the defect');
ok(lines.includes('10:30 Defect rectified: Lifejackets No. 5 — Strap renewed (Bosun)'), 'a defect put right in the window, from an older inspection');
ok(!lines.some((l) => l.includes('Eva Stone')), 'after the end of the window: not in it');
ok(lines.join('|') === [...lines].sort().join('|'), 'in time order');

// Across midnight: the order is the date, not the clock alone.
const night = watchEvents(T('2026-11-15T23:00'), T('2026-11-16T01:00'), { ...src, moves: [move('a', 'c1', 'A B', 'aboard', '2026-11-16T00:20'), move('b', 'c2', 'C D', 'ashore', '2026-11-15T23:40')], visitors: [], inspections: [] });
ok(night.map((e) => e.line.slice(0, 5)).join(',') === '23:40,00:20', 'a watch across midnight keeps 23:40 before 00:20');

ok(withEvents('Pilot on board', ev.slice(0, 2)) === `Pilot on board\n${lines[0]}\n${lines[1]}`, 'added under what was typed');
ok(withEvents(`Pilot on board\n${lines[0]}`, ev.slice(0, 2)) === `Pilot on board\n${lines[0]}\n${lines[1]}`, 'a line already there is not added again');
ok(withEvents('  ', []) === '' && watchEvents(T('2026-11-15T13:00'), T('2026-11-15T14:00'), src).length === 0, 'nothing in the window, nothing added');

console.log(fail ? `\n${fail} failed` : '\nall passed');
process.exit(fail ? 1 : 0);
