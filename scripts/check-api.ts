// npm run check:api — the server's copies of the app's rules (functions/vesselData.js)
// against the app's own functions, and what the API decides about posted hours.
import { checkReading, withReading } from '../services/pms';
import { followerReadings } from '../services/pmsMachines';
import { surveyStatus, addMonths } from '../services/surveys';
import { readAms } from '../services/amsHours';
import { Machine } from '../types/pms';
import { Survey } from '../types/survey';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const V = require('../../functions/vesselData');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { newKey, sha256 } = require('../../functions/api');

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// ---- the register's shape ----
{
  const blob = { categories: { liferafts: [{ id: 'a', no: 1 }, { id: 'b', deleted: true }], lifebuoys: [{ id: 'c', category: 'lifebuoys', expiry: '2026-01-01' }] }, certificates: [{ id: 'k', scope: 'vessel' }, { id: 'x', deleted: true }] };
  const r = V.readRegister({ register: JSON.stringify(blob) });
  ok(r.items.length === 2 && r.items[0].category === 'liferafts', 'register: object of categories → flat items, category filled in, deleted dropped');
  ok(r.certificates.length === 1, 'register: deleted certificates dropped');
  ok(V.readRegister({ register: '[1,2]' }).items.length === 0, 'register: an old flat array reads as empty, does not throw');
  ok(V.readRegister({ register: '{bad' }).items.length === 0 && V.readRegister({}).items.length === 0, 'register: unreadable or absent → empty');
}

// ---- status ----
ok(V.statusOf('2026-10-27', '2026-10-28') === 'expired', 'status: yesterday → expired');
ok(V.statusOf('2026-12-27', '2026-10-28') === 'due' && V.statusOf('2026-12-28', '2026-10-28') === 'ok', 'status: 60 days → due, 61 → ok');
ok(V.statusOf(undefined, '2026-10-28') === 'none' && V.statusOf('28.10.2026', '2026-10-28') === 'none', 'status: no or bad date → none');

// ---- surveys: the copy against services/surveys.ts ----
{
  const s = (due: string, before: number, after: number, repeat = 12): Survey => ({ id: 's', name: 'x', due, before, after, repeat, anniversary: true, order: 0, updatedAt: 0 });
  const cases: [Survey, string][] = [
    [s('2026-12-31', 3, 3), '2026-10-28'], [s('2026-12-31', 3, 3), '2026-09-01'], [s('2026-06-30', 3, 3), '2026-10-28'],
    [s('2026-07-31', 3, 3), '2026-10-31'], [s('2026-07-31', 3, 3), '2026-11-01'], [s('2027-06-15', 0, 1), '2026-10-28'],
  ];
  ok(cases.every(([x, d]) => same(V.surveyStatus(x, d), surveyStatus(x, d))), 'surveys: same state, window and days as the app (6 cases)');
  const once = s('2026-05-01', 1, 1, 0);
  const done = [{ surveyId: 's', forDue: '2026-05-01' }];
  ok(same(V.surveyStatus(once, '2026-10-28', done), surveyStatus(once, '2026-10-28', done as any)), 'surveys: once-only and done → done, like the app');
  ok(['2026-01-31', '2024-02-29', '2026-08-31'].every((d) => [1, -1, 12, 30].every((n) => V.addMonths(d, n) === addMonths(d, n))), 'surveys: addMonths clamps to month end like the app');
}

// ---- hours: the copies against services/pms.ts and pmsMachines.ts ----
const m = (o: Partial<Machine>): Machine => ({ id: 'm', name: 'Main engine PS', updatedAt: 0, ...o } as Machine);
{
  const base = m({ hours: 1000, hoursDate: '2026-10-20' });
  const probe: [string, number][] = [['2026-10-28', 999], ['2026-10-28', 1000], ['2026-10-28', 1204], ['2026-10-28', 1205], ['2026-10-20', 1036], ['2026-10-20', 1037]];
  ok(probe.every(([d, h]) => (V.checkReading(base, d, h) === null) === checkReading(base, d, h).ok), 'checkReading: same yes/no as the app at every edge (lower, 24 h a day + 12)');
  ok(V.checkReading(m({}), '2026-10-28', 5) === null, 'checkReading: first reading always taken');

  const withR = m({ hours: 1000, hoursDate: '2026-10-20', readings: [{ date: '2026-10-20', hours: 1000 }, { date: '2026-10-28', hours: 1100 }, { date: '2026-10-28', hours: 1090, reason: 'corrected' }] });
  const a = V.withReading(withR, '2026-10-28', 1150, { by: 'API · AMS' }, 1);
  const b = withReading(withR, '2026-10-28', 1150, { by: 'API · AMS' });
  ok(same(a.readings, b.readings) && a.hours === b.hours && a.hoursDate === b.hoursDate, 'withReading: replaces the day\'s plain reading, keeps one with a reason — like the app');
  const many = m({ readings: Array.from({ length: 40 }, (_, i) => ({ date: `2026-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`, hours: i })) });
  ok(V.withReading(many, '2026-10-28', 99, {}, 1).readings.length === 30, 'withReading: keeps the last 30');

  const parent = m({ id: 'p', hours: 100, hoursDate: '2026-10-27' });
  const all = [parent, m({ id: 't', parentId: 'p', followsParent: true, hours: 10 }), m({ id: 'u', parentId: 't', followsParent: true, hours: 0 }), m({ id: 'own', parentId: 'p', hours: 5 }), m({ id: 'gone', parentId: 'p', followsParent: true, hours: 1, scrapped: { date: '2026-01-01', reason: 'x', by: 'y' } })];
  const next = withReading(parent, '2026-10-28', 120);
  const fs = V.followerReadings(parent, next, all, '2026-10-28', 1).map((x: Machine) => [x.id, x.hours]);
  const fa = followerReadings(parent, next, all, '2026-10-28').map((x) => [x.id, x.hours]);
  ok(same(fs, fa) && same(fs, [['t', 30], ['u', 20]]), 'followers: +20 h to the turbocharger and its own component, not to one with its own counter or a scrapped one — like the app');
}

// ---- posted readings, against the AMS file rules ----
{
  const machines = [
    m({ id: 'me', name: 'Main engine PS', amsTag: 'ME_PS.RH', hours: 1000, hoursDate: '2026-10-20' }),
    m({ id: 'gen', name: 'Generator 1', amsTag: 'DG1_RH', hours: 500, hoursDate: '2026-10-27', counterOffset: 200 }),
    m({ id: 'tc', name: 'Turbo', parentId: 'me', followsParent: true, counter: true, hours: 10 }),
    m({ id: 'ac', name: 'Aircon', dept: 'interior' as any }),
    m({ id: 'old', name: 'Old engine', amsTag: 'OLD', deleted: true }),
  ];
  const r = V.decideReadings([
    { tag: 'me_ps rh', counter: 1100, date: '2026-10-28' },
    { machineId: 'gen', counter: 310 },
    { tag: 'DG1_RH', counter: 400 },
    { machineId: 'tc', counter: 50 },
    { machineId: 'ac', counter: 5 },
    { tag: 'OLD', counter: 5 },
    { tag: 'X', counter: -1 },
    { counter: 5 },
    { tag: 'X', counter: 5, date: '2026-11-01' },
    { tag: 'X', counter: '12' },
  ], machines, '2026-10-28');
  const st = r.map((x: any) => x.status).join(',');
  ok(st === 'ok,ok,dup,follows,nocounter,unmatched,invalid,invalid,invalid,invalid', `decide: ${st}`);
  ok(r[0].machineId === 'me' && r[0].hours === 1100, 'decide: tag matched ignoring case and punctuation, like the AMS file');
  ok(r[1].hours === 510 && r[1].date === '2026-10-28', 'decide: counter + counterOffset, no date → today');

  const doubt = V.decideReadings([{ machineId: 'me', counter: 900 }, { machineId: 'gen', counter: 300, date: '2026-10-26' }], machines, '2026-10-28').map((x: any) => x.status);
  ok(doubt.join() === 'doubt,older', 'decide: lower → doubt (not taken), before the last reading → older');
  ok(V.decideReadings([{ machineId: 'gen', counter: 300, date: '2026-10-27' }], machines, '2026-10-28')[0].status === 'same', 'decide: the figure the machine already has → same');

  // The AMS file in the app decides the same rows the same way.
  const file = readAms([['Tag', 'Description', 'Value', 'Date'], ['ME_PS.RH', 'Main engine', 1100, '2026-10-28'], ['DG1_RH', 'Gen 1', 300, '2026-10-26'], ['ME_PS.RH', 'x', 900, '2026-10-21']], machines, '2026-10-28');
  const api = V.decideReadings([{ tag: 'ME_PS.RH', counter: 1100, date: '2026-10-28' }, { tag: 'DG1_RH', counter: 300, date: '2026-10-26' }], machines, '2026-10-28');
  ok(same(file.rows.map((x) => [x.machineId, x.status, x.total]), api.map((x: any) => [x.machineId, x.status, x.hours])), 'decide: same verdicts and hours as an AMS file in the app');
}

// ---- keys ----
{
  const k = newKey();
  ok(/^ismp_[A-Za-z0-9_-]{32}$/.test(k), `key: ismp_ + 32 url-safe characters (${k.slice(0, 9)}…)`);
  ok(newKey() !== k && sha256(k).length === 64, 'key: random each time; stored as a 64-hex SHA-256');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
