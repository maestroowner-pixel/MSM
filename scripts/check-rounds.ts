// npm run check:rounds — inspection rounds: scope, done in the round only, walking order.
import { roundProgress, roundTakes } from '../services/rounds';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const it = (id: string, category: any, deck: string, no: string): any => ({ id, category, deck, no, type: 'X', updatedAt: 0 });
const flat = [
  it('f3', 'fire_extinguishers', '2. Bridge Deck', '03'), it('f1', 'fire_extinguishers', '1. Sun Deck', '01'), it('f2', 'fire_extinguishers', '1. Sun Deck', '02'),
  it('e1', 'eebd', '1. Sun Deck', 'E1'), it('l1', 'lifebuoys', '1. Sun Deck', 'L1'),
];
const round: any = { id: 'r1', period: 'monthly', categories: ['fire_extinguishers', 'eebd'], from: 0, to: 1, label: 'October 2026', startedBy: 'Jez', startedAt: 0, updatedAt: 0 };
const ins = (itemId: string, at: number, roundId?: string, by = 'Jez'): any => ({ id: `${itemId}-${at}`, itemId, at, by, period: 'monthly', roundId, category: 'x' });
const trail = [ins('f1', 1, 'r1'), ins('f1', 5, 'r1', 'Simon'), ins('f2', 2), ins('e1', 3, 'r2'), ins('gone', 4, 'r1')];
const p = roundProgress(round, flat, trail);
ok(p.scope.length === 4 && p.scope.map((x) => x.id).join() === 'f1,f2,e1,f3', `scope in walking order: ${p.scope.map((x) => x.id)}`);
ok(p.done.size === 1 && p.done.get('f1')!.by === 'Simon', 'done: only signed in this round, latest wins');
ok(p.outstanding.map((x) => x.id).join() === 'f2,e1,f3', 'f2 checked outside the round stays outstanding; e1 signed in another round too');
ok(p.byCategory.get('fire_extinguishers')!.done === 1 && p.byCategory.get('fire_extinguishers')!.total === 3, 'per category counts');
ok(p.stray.length === 1, 'an inspection of an item no longer in scope is kept apart');
const only = roundProgress(round, flat, trail, ['eebd']);
ok(only.scope.length === 1 && only.outstanding.length === 1, 'category filter');
ok(roundTakes(round, { category: 'eebd' } as any, 'monthly') && !roundTakes(round, { category: 'eebd' } as any, 'weekly') && !roundTakes({ ...round, closedAt: 1 }, { category: 'eebd' } as any, 'monthly'), 'round takes: category + period, not closed');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
