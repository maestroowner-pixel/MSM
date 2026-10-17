// npm run check:patrols — security rounds due / done / missed; the key register.
import { STARTER_PLANS, GRACE_MIN, dayRounds, keyStatus, keysOut, missedPoints, monthSummary, nextCode, slotFor } from '../services/patrols';
import { Patrol } from '../types/patrols';
import { KeyMove } from '../types/keys';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

ok(nextCode('CP-', [{ code: 'CP-01' }, { code: 'cp-02' }]) === 'CP-03' && nextCode('K-', []) === 'K-01', 'next free ID');

const plans = STARTER_PLANS;
const pat = (planId: string, slot: string, date: string, missed = 0): Patrol => ({ id: `${planId}${slot}${date}`, planId, planName: planId, kind: 'daytime', slot, date, startedAt: 1, finishedAt: 2, duties: [], dutiesDone: true, visits: [], missed: Array.from({ length: missed }, (_, i) => ({ checkpointId: `c${i}`, code: `CP-0${i}`, name: 'x' })), by: 'Ann', updatedAt: 2 });
const done = [pat('patrol.opening', '07:00', '2026-10-17'), pat('patrol.daytime', '13:00', '2026-10-17', 1)];
const day = dayRounds('2026-10-17', plans, done);
ok(day.length === 5 && day.map((d) => d.slot).join() === '07:00,10:00,13:00,16:00,21:00', 'five rounds due a day, in time order');
ok(day.filter((d) => d.done).length === 2 && !day.find((d) => d.slot === '10:00')!.done, 'done and missed told apart');

const live = dayRounds('2026-10-17', plans, done, { date: '2026-10-17', hhmm: '12:30' });
ok(!live.find((d) => d.slot === '10:00')!.pending && live.find((d) => d.slot === '16:00')!.pending === true && live.find((d) => d.slot === '21:00')!.pending === true && GRACE_MIN === 120, 'today: a round is missed only two hours after its time; later ones are still to come');
ok(monthSummary('2026-10', plans, done, '2026-10-17', '12:30')[16].due === 3, 'the month leaves out today’s rounds still to come');

const daytime = plans.find((p) => p.id === 'patrol.daytime')!;
ok(slotFor(daytime, '09:20', []) === '10:00' && slotFor(daytime, '11:30', []) === '10:00' && slotFor(daytime, '11:30', ['10:00']) === '13:00' && slotFor(daytime, '17:00', ['10:00', '13:00', '16:00']) === null, 'a round started now is for the right time');

const pts = [{ id: 'a', code: 'CP-01', name: 'Gangway', order: 0, updatedAt: 0 }, { id: 'b', code: 'CP-02', name: 'Bridge', order: 1, updatedAt: 0 }, { id: 'c', code: 'CP-03', name: 'Old', order: 2, deleted: true, updatedAt: 0 }];
ok(missedPoints({ ...daytime, checkpointIds: ['a', 'b', 'c'] }, pts, ['a']).map((c) => c.code).join() === 'CP-02', 'missed checkpoints; a removed one is not counted');

const month = monthSummary('2026-10', plans, done, '2026-10-17');
ok(month.length === 17 && month[16].due === 5 && month[16].done === 2 && month[16].points === 1 && month[0].done === 0 && month[0].missed.length === 5, 'month: day by day, up to today, missed rounds and checkpoints');

const keys = [{ id: 'k1', code: 'K-01', name: 'Tender garage', updatedAt: 0 }, { id: 'k2', code: 'K-02', name: 'Bonded store', updatedAt: 0 }, { id: 'k3', code: 'K-03', name: 'Old', deleted: true, updatedAt: 0 }];
const mv = (keyId: string, dir: 'out' | 'in', at: number): KeyMove => ({ id: `${keyId}${at}`, keyId, code: '', name: '', dir, person: 'Tom', by: 'OOW', at, updatedAt: at });
const moves = [mv('k1', 'out', 1000), mv('k1', 'in', 2000), mv('k2', 'out', 3000), mv('k1', 'out', 86_400_000 * 3)];
ok(keyStatus(keys, moves).get('k2')?.dir === 'out' && keyStatus(keys, moves).get('k1')?.at === 86_400_000 * 3, 'a key is where its last move left it');
const out = keysOut(keys, moves, 86_400_000 * 5);
ok(out.map((o) => o.key.code).join() === 'K-02,K-01' && out[0].days === 4, 'keys out now, longest first, days out; a removed key left out');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
