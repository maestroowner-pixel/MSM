// npm run check:board — the notice board picks the right things from each module.
import { buildBoard, BoardInput } from '../services/board';
import { passengerFromCloud, passengerToCloud } from '../types/passengers';
import { planPaxImport, readPaxRows, paxSheet, PAX_HEAD } from '../services/passengerList';
import { uid } from '../utils/id';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const today = new Date().toISOString().slice(0, 10);
const plus = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const base = (o: Partial<BoardInput> = {}): BoardInput => ({
  on: () => true, role: 'superadmin', me: null, today, now: `${today}T13:00`, labelOf: (c) => String(c), periodsOf: () => ['monthly'],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], ...o,
});
const pm = (() => { const d = new Date(); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth() - 1, 1)); return t.toISOString().slice(0, 7); })();
const item = (id: string, expiry: string): any => ({ id, category: 'fire_extinguishers', expiryDate: expiry, nextInspection: expiry });

let b = buildBoard(base({ flat: [item('a', plus(-3)), item('b', plus(10)), item('c', plus(200))] }));
const eq = b.attention.find((x) => x.key === 'eq:fire_extinguishers');
ok(!!eq && eq.level === 'red' && /1 expired, 1 due soon/.test(eq.title), 'register grouped by category: 1 expired, 1 due');
ok(b.plan.some((p) => p.key === 'round:monthly' && /0 of 3 done/.test(p.sub)), 'monthly round progress 0 of 3');
ok(b.tiles.some((t) => t.key === 'eq' && t.level === 'red'), 'LSA/FFE tile red');

b = buildBoard(base({ on: (m) => m === 'fuel', fuelTanks: [{ id: 't', name: 'P', order: 0, updatedAt: 0 }] as any }));
ok(b.attention.some((x) => x.key === 'fuel:snd'), 'after noon, no sounding → notice');
ok(b.today.some((t) => t.key === 'fuel:snd' && !t.done), 'today: sounding not done');
ok(!b.tiles.some((t) => t.key === 'sec'), 'module off → no tile');

b = buildBoard(base({ on: (m) => m === 'surveys', surveys: [{ id: 's', name: 'Class annual', due: plus(20), before: 3, after: 0, repeat: 12, anniversary: true, order: 0, updatedAt: 0 }] as any }));
ok(b.plan.some((p) => p.key === 'sv:s') && b.attention.some((x) => x.key === 'sv:s:n'), 'survey window closing in 20 days → plan + notice');

b = buildBoard(base({ role: 'user', on: (m) => m === 'garbage' || m === 'security', garbage: [{ date: `${pm}-05`, method: 'shore' }] as any }));
ok(!b.attention.some((x) => x.key === 'grb:sign'), 'crew do not see the Master’s unsigned month');
ok(!b.attention.some((x) => x.key === 'isps:drill'), 'crew do not see officer items');
b = buildBoard(base({ role: 'superadmin', on: (m) => m === 'garbage', garbage: [{ date: `${pm}-05`, method: 'shore' }] as any }));
ok(b.attention.some((x) => x.key === 'grb:sign'), 'the Master sees it');
b = buildBoard(base({ role: 'user', on: (m) => m === 'pms', machines: [{ id: 'm', name: 'Steering gear', updatedAt: 0 }] as any, pmsJobs: [{ id: 'j', machineId: 'm', title: 'x', intervalDays: 30, lastDoneDate: plus(0), updatedAt: 0 }] as any, pmsDefects: [{ id: 'd', machineId: 'm', machineName: 'Steering gear', category: 'safety', description: 'Ram seal leaking', date: plus(0), by: 'x', at: 0, updatedAt: 0 }, { id: 'e', machineId: 'm', machineName: 'Steering gear', category: 'class', description: 'y', date: plus(0), by: 'x', at: 0, updatedAt: 0 }] as any }));
ok(b.attention.some((a) => a.key === 'pms:defect-safety' && /Steering gear/.test(a.title)) && !b.attention.some((a) => a.key === 'pms:defect-class'), 'safety-critical defect shown to crew; class-affecting only to officers');
// on board is not signed on: those ashore apart (13 Oct 2026); passengers count too
const crew9 = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, active: true, addedAt: 0, updatedAt: 0, ...(i === 11 ? { onBoard: false } : {}) }));
const away9 = Array.from({ length: 9 }, (_, i) => ({ id: `mv${i}`, crewId: `c${i}`, name: `C${i}`, dir: 'ashore', date: today, time: '09:00', at: 1, by: 'w', via: 'qr', updatedAt: 1 }));
b = buildBoard(base({ crew: crew9 as any, crewMoves: away9 as any, passengers: [{ id: 'p1', name: 'Sophie', embarked: today, addedAt: 0, updatedAt: 0 }, { id: 'p2', name: 'Leo', embarked: plus(3), addedAt: 0, updatedAt: 0 }] as any }));
ok(b.tiles.find((t) => t.key === 'crew')?.line === '2 on board · 9 ashore · 1 on leave', 'crew tile: on board, ashore, on leave apart');
ok(b.status.pob?.total === 3 && b.status.pob?.ashore === 9, 'persons on board: 2 crew + 1 passenger; 9 ashore');
ok(/3 on board · 9 ashore/.test(b.tiles.find((t) => t.key === 'sec')?.line ?? ''), 'security tile: on board and ashore');
ok(b.tiles.find((t) => t.key === 'pax')?.line === '1 on board' && b.plan.some((p) => p.key === 'pax:in:p2'), 'passengers tile; one joining in 3 days on the plan');

// monthly safety meeting
const sm = (date: string, actions: any[] = []) => ({ id: `sm${date}`, no: `SM-${date}`, date, agenda: [], attendance: [], carried: [], actions, plannedBy: 'x', doneAt: 1, doneBy: 'Master', updatedAt: 1 });
b = buildBoard(base({ on: (k) => k === 'meetings', safetyMeetings: [] }));
ok(b.plan.some((p) => p.key === 'sm:due'), 'meeting: none held → on the plan');
b = buildBoard(base({ on: (k) => k === 'meetings', safetyMeetings: [sm(plus(-50), [{ id: 'a', text: 'Replace the torn life ring line', due: plus(-5) }])] as any }));
ok(b.attention.some((x) => x.key === 'sm:due' && x.level === 'red') && b.attention.some((x) => x.key === 'sm:act'), 'meeting: over a month ago → red; its action past due');

// gangway names for the Master only
const gw = (role: any) => buildBoard(base({ role, crew: crew9 as any, crewMoves: away9 as any })).summaries.find((v) => v.key === 'gangway')!;
ok(!!gw('superadmin').rows.find((r) => r.label === 'Ashore now')?.more?.length && !gw('admin').rows.some((r) => r.more?.length) && !gw('user').rows.some((r) => r.more?.length), 'gangway summary: names for the Master, counts for the others');
const tb = gw('user').table!;
ok(JSON.stringify(tb.head) === '["","On board","Ashore"]' && tb.rows[0].cells.join() === 'Crew,2,9' && tb.rows[tb.rows.length - 1].cells.join() === 'Total,2,9', 'gangway table: crew 2 on board, 9 ashore; total');

// tile order: Passengers in Documents' place
const order = buildBoard(base({ me: { key: 'k', name: 'Jez' }, docs: [{ id: 'd', title: 'SMS', updatedAt: 0 }] as any, passengers: [] })).tiles.map((t) => t.key);
ok(order.includes('docs') && order.includes('pax') && order.indexOf('pax') < order.indexOf('docs'), 'tiles: Passengers and Documents swapped');

// the guest list does not leave the vessel
const guest: any = { id: 'pax1', name: 'Sophie Martin', cabin: 'VIP', nationality: 'FR', notes: 'Vegetarian', embarked: today, addedAt: 0, updatedAt: 1 };
const up = passengerToCloud(guest);
ok(up.name === 'S…n' && !('nationality' in up) && !('notes' in up) && up.cabin === 'VIP' && guest.name === 'Sophie Martin', 'guest up: masked name, no nationality or notes');
const back = passengerFromCloud(guest, { ...up, disembarked: today, updatedAt: 5 });
ok(back.name === 'Sophie Martin' && back.nationality === 'FR' && back.disembarked === today && passengerFromCloud(undefined, up).name === 'S…n', 'guest down: own copy put back together; elsewhere the letters');
ok(uid('pax').startsWith('pax'), 'passenger ids start with pax (crossings masked by id)');
// passenger list Excel
const sheet = readPaxRows([['Passenger list'], PAX_HEAD, ['Example: X'], ['Sophie  Martin', "Owner's guest", 'VIP', 'France', '1985-04-12', 'Passport', '18AB23456', '2031-06-30', '2026-10-10', 'Palma', '', '', '+33', 'Paul', 'Vegetarian'], ['', 'x']]);
ok(sheet.length === 1 && sheet[0].name === 'Sophie Martin' && sheet[0].idNo === '18AB23456' && sheet[0].dateOfBirth === '1985-04-12', 'Excel read: name, passport, date of birth; examples and blanks skipped');
const plan = planPaxImport(sheet, [guest], [], today);
ok(plan.updated.length === 1 && plan.passengers[0].id === 'pax1' && plan.privates[0].idNo === '18AB23456' && plan.passengers[0].cabin === 'VIP', 'Excel import: matched by name, documents to the private record');
ok(paxSheet([guest], [], false)[0].length < PAX_HEAD.length, 'Excel out without documents for the crew');
const agent = readPaxRows([['Guest manifest — MY Aurora'], ['Surname', 'Given names', 'Nationality', 'DOB', 'Passport No.', 'Passport expiry', 'Stateroom', 'Arrival date', 'Remarks'], ['Example', 'Row', '', '', '', '', '', '', ''], ['MARTIN', 'Sophie', 'France', '12/04/1985', '18AB23456', '30/06/2031', 'VIP', '13/10/2026', 'Vegetarian']]);
ok(agent.length === 1 && agent[0].name === 'Sophie MARTIN' && agent[0].idNo === '18AB23456' && agent[0].cabin === 'VIP' && agent[0].nationality === 'France' && agent[0].notes === 'Vegetarian' && !!agent[0].dateOfBirth && !!agent[0].embarked, `an agent's manifest reads: ${JSON.stringify(agent[0])}`);
const fal = readPaxRows([['Family name, given names', 'Nationality', 'Date of birth', 'Nature and No. of identity document'], ['TESTOV Alexander', 'Cyprus', '1971-03-14', 'Passport K12345678']]);
ok(fal[0]?.name === 'TESTOV Alexander' && fal[0].idNo === 'Passport K12345678', 'a FAL Form 6 layout reads');

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
