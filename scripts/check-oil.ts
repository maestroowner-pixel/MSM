// npm run check:oil — the verdict of an oil sample, when the next is due, and reading a lab's file.
import { assess, cellDate, cellNumber, headerField, isoCode, judge, judgeIso, limitFor, matchLabRow, pointStatus, readLabSheet, resultFromRow, sampleProblem, verdictOf } from '../services/oil';
import { OilPoint, OilResult, OilSample } from '../types/oil';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const me: OilPoint = { id: 'p1', machineId: 'm1', machineName: 'Main engine PS', name: 'Crankcase', compartment: 'engine', intervalDays: 90, intervalHours: 500, newOil: { v100: 14.5, tbn: 12 }, updatedAt: 0 };
const res = (values: OilResult['values'], p: Partial<OilResult> = {}): OilResult => ({ date: '2026-10-20', values, by: 'Lab', at: 0, ...p });
const smp = (id: string, p: Partial<OilSample>): OilSample => ({ id, pointId: 'p1', date: '2026-07-01', takenBy: 'Sven', at: Number(id.slice(1)), updatedAt: 0, ...p });

// limits
ok(limitFor(me, 'fe')?.c === 50 && limitFor(me, 'fe')?.a === 100, 'engine iron: guide 50 / 100 ppm');
ok(limitFor({ ...me, limits: { fe: { c: 30, a: 60 } } }, 'fe')?.c === 30, "the point's own limit wins over the guide");
ok(limitFor({ ...me, limits: { fe: {} } }, 'fe')?.c === 50, 'an empty own limit falls back to the guide');
ok(limitFor({ ...me, compartment: 'hydraulic' }, 'soot') === undefined, 'hydraulics: soot is not judged');

// single values
ok(judge(me, 'fe', 49) === null, 'iron 49: normal');
ok(judge(me, 'fe', 50)?.level === 1, 'iron 50: caution');
ok(judge(me, 'fe', 120)?.level === 2, 'iron 120: action');
ok(judge(me, 'v100', 13.0) === null, 'viscosity −10 %: normal');
ok(judge(me, 'v100', 12.2)?.level === 1, 'viscosity −16 %: caution');
ok(judge(me, 'v100', 18.5)?.level === 2, 'viscosity +28 %: action (thickened)');
ok(judge({ ...me, newOil: {} }, 'v100', 30) === null, 'viscosity without the new oil figure is not judged');
ok(judge(me, 'tbn', 7.5) === null, 'TBN 62 % of new: normal');
ok(judge(me, 'tbn', 7) ?.level === 1, 'TBN 58 % of new: caution');
ok(judge(me, 'tbn', 5.9)?.level === 2, 'TBN 49 % of new: action');
ok(judge(me, 'water', 0.6)?.level === 2, 'water 0.6 %: action');

// ISO 4406
ok(String(isoCode('19/17/14')) === '19,17,14', 'ISO code parsed');
ok(Number.isNaN(isoCode('16/13')![0]) && isoCode('16/13')![2] === 13, 'two-number ISO code keeps its place from the right');
ok(isoCode('fine') === null, 'not an ISO code');
ok(judgeIso('18/16/13', '18/16/13') === null, 'ISO on target: normal');
ok(judgeIso('18/16/13', '19/16/13')?.level === 1, 'ISO one class over: caution');
ok(judgeIso('18/16/13', '18/18/13')?.level === 2, 'ISO two classes over: action');

// the whole sample
const a1 = assess(me, res({ fe: 20, cu: 4, si: 5, v100: 14.0, tbn: 10 }));
ok(a1.verdict === 'normal' && a1.findings.length === 0, 'a clean sample is normal');
const a2 = assess(me, res({ fe: 60, water: 0.1 }));
ok(a2.verdict === 'caution' && a2.byKey.fe === 1 && a2.byKey.water === 0, 'iron over caution: the sample is caution, water stays normal');
const a3 = assess(me, res({ fe: 20 }, { labVerdict: 'action', labComment: 'Coolant ingress' }));
ok(a3.verdict === 'action' && a3.findings[0].key === 'lab', "the lab's worse verdict wins");
const a4 = assess(me, res({ fe: 40 }), res({ fe: 20 }));
ok(a4.verdict === 'caution' && /rising/.test(a4.findings[0].text), 'iron doubled past half its limit: rising, caution');
ok(assess(me, res({ fe: 15 }), res({ fe: 5 })).verdict === 'normal', 'a rise far below the limit is not flagged');
ok(assess(me, res({ fe: 110 }), res({ fe: 20 })).findings.length === 1, 'past action: no second "rising" line');
ok(assess(me, res({ fe: 58 }), res({ fe: 26 })).findings.length === 1, 'past caution: no second "rising" line');

// due
const p = { ...me };
const s1 = smp('s1', { date: '2026-07-01', machineHours: 12000, sent: { date: '2026-07-02', by: 'Sven' }, result: res({ fe: 60 }) });
ok(pointStatus(p, [], 12100, '2026-10-27').due === 'never', 'no sample yet: due now');
ok(pointStatus(p, [s1], 12100, '2026-08-01').due === 'ok', 'a month later, 100 h run: not due');
ok(pointStatus(p, [s1], 12100, '2026-09-20').due === 'soon', 'ten days before 90 days: soon');
ok(pointStatus(p, [s1], 12100, '2026-10-01').due === 'overdue', 'past 90 days: overdue');
ok(pointStatus(p, [s1], 12500, '2026-08-01').due === 'overdue', '500 running hours: overdue before the date');
ok(pointStatus(p, [s1], 12460, '2026-08-01').due === 'soon', 'within 50 h of 500: soon');
ok(pointStatus(p, [s1], 12100, '2026-08-01').verdict === 'caution' && pointStatus(p, [s1], 12100, '2026-08-01').toReview === 1, 'the last result colours the point; it waits for review');
const s1r = { ...s1, review: { date: '2026-07-20', verdict: 'normal' as const, action: 'Resample in 100 h — lab confirmed a bad sample', by: 'Chief', at: 1 } };
ok(verdictOf(p, s1r, [s1r]) === 'normal', "the officer's review is the verdict that stands");
const s2 = smp('s2', { date: '2026-09-01', sent: { date: '2026-09-02', by: 'Sven' } });
const st = pointStatus(p, [s1r, s2], 12300, '2026-10-01');
ok(st.awaiting === 1 && st.late === 1 && st.lastResult?.id === 's1', 'sent 29 days ago without a result: late; the colour stays the last result');

// saving
ok(sampleProblem({ date: '2026-10-28' }, '2026-10-27') === 'oil.err.future', 'not in the future');
ok(sampleProblem({ date: '2026-10-27', machineHours: 11000 }, '2026-10-27', 12000) === 'oil.err.hoursBack', 'hours cannot go back');
ok(sampleProblem({ date: '2026-10-27', machineHours: 12100 }, '2026-10-27', 12000) === null, 'a good sample');

// the lab's file
ok(headerField('Iron (Fe) ppm') === 'fe' && headerField('Sample Date') === 'date' && headerField('Lab No.') === 'labNo', 'headers: iron, date taken, lab number');
ok(headerField('Viscosity @ 100°C') === 'v100' && headerField('KV40') === 'v40' && headerField('Viscosity Index') === null, 'headers: both viscosities, not the index');
ok(headerField('Oil Hours') === 'oilHours' && headerField('Unit Hours') === 'machineHours' && headerField('Unit ID') === 'unit', 'headers: oil hours, unit hours, unit');
ok(headerField('TBN') === 'tbn' && headerField('Water (ppm)') === 'water' && headerField('PQ Index') === 'pq' && headerField('ISO 4406') === 'iso', 'headers: TBN, water, PQ, ISO');
ok(headerField('Sample Status') === 'verdict' && headerField('Lab Comments') === 'comment' && headerField('Date Reported') === 'reportDate', 'headers: status, comments, report date');
ok(headerField('Lead (Pb)') === 'pb' && headerField('Tin') === 'sn' && headerField('Sodium Na') === 'na' && headerField('Potassium') === 'k', 'headers: lead, tin, sodium, potassium');
ok(cellDate('12.10.2026') === '2026-10-12' && cellDate('2026-10-12') === '2026-10-12' && cellDate(46307) === '2026-10-12', 'dates: dotted, ISO, Excel serial');
ok(cellNumber('<1') === 0 && cellNumber('12,5') === 12.5 && cellNumber('-') === undefined && cellNumber('') === undefined, 'numbers: below detection, comma, dash');

const sheet: unknown[][] = [
  ['Shell LubeAnalyst — vessel report'],
  [],
  ['Lab No', 'Unit ID', 'Sample Date', 'Date Reported', 'Unit Hours', 'Oil Hours', 'Sample Status', 'Iron (Fe) ppm', 'Copper (Cu) ppm', 'Silicon (Si) ppm', 'Water (ppm)', 'Viscosity @ 100°C', 'TBN', 'Viscosity Index', 'Lab Comments'],
  ['A123', 'ME PS', '01.07.2026', '08.07.2026', 12000, 250, 'Caution', 60, 3, '<1', 800, 14.1, 9.8, 140, 'Iron raised, resample'],
  ['A124', 'ME SB', '01.07.2026', '08.07.2026', 11950, 240, 'Normal', 22, 2, 4, 200, 14.4, 10.5, 141, ''],
];
const rows = readLabSheet(sheet)!;
ok(rows?.length === 2, 'two samples read below a title row');
ok(rows[0].labNo === 'A123' && rows[0].date === '2026-07-01' && rows[0].reportDate === '2026-07-08' && rows[0].machineHours === 12000 && rows[0].oilHours === 250, 'the row: lab number, dates, hours');
ok(rows[0].values.fe === 60 && rows[0].values.si === 0 && rows[0].values.water === 0.08 && rows[0].values.tbn === 9.8, 'values: iron, below detection, water ppm → %, TBN');
ok(rows[0].verdict === 'caution' && rows[0].comment === 'Iron raised, resample', "the lab's verdict and comment");
ok(!('vi' in rows[0].values) && Object.keys(rows[0].values).length === 6, 'the viscosity index is not taken for a viscosity');
ok(readLabSheet([['Name', 'Rank'], ['Sven', 'Chief']]) === null, 'not a lab file');
ok(matchLabRow(rows, { bottle: 'a 124', date: '2026-07-01' }) === 1, 'matched by the bottle number');
ok(matchLabRow(rows, { date: '2026-07-01' }) === -1, 'two rows of that date: ask');
ok(matchLabRow([rows[0]], { date: '2026-06-01' }) === 0, 'a file of one sample: that one');
const r = resultFromRow(rows[0], 'Sven', '2026-10-27', 5);
ok(r.date === '2026-07-08' && r.labNo === 'A123' && r.labVerdict === 'caution' && r.from === 'sheet', 'the row as a result');

console.log(fail ? `\n${fail} FAILED` : '\nAll oil checks passed');
process.exit(fail ? 1 : 0);
