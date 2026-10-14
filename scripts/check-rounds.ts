// npm run check:rounds — inspection rounds: scope, done in the round only, walking order.
import { overlappingRound, roundFor, roundProgress, roundTakes, walkGroups, duplicateRounds } from '../services/rounds';
import { buildRoundReport, roundSignoffLine } from '../services/reportData';

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

// Deck → Location → number, as the Equipment section (Jez, 13 Oct 2026).
const at = (id: string, category: any, deck: string, position: string, no: string): any => ({ id, category, deck, position, no, type: 'X', updatedAt: 0 });
const walk = walkGroups([
  at('a', 'fire_extinguishers', '2. Bridge Deck', 'Galley', '05'), at('b', 'fire_extinguishers', '1. Sun Deck', 'Bar', '02'),
  at('c', 'fire_extinguishers', '1. Sun Deck', 'Aft', '01'), at('d', 'eebd', '1. Sun Deck', 'Bar', 'E1'), at('e', 'fire_extinguishers', '1. Sun Deck', 'Aft', '03'),
  at('f', 'fire_extinguishers', '1. Sun Deck', '', '04'),
]);
ok(walk.map((d) => d.label).join('|') === '1. Sun Deck|2. Bridge Deck', 'decks in order');
ok(walk[0].places.map((p) => p.label).join('|') === 'Aft|Bar|— No position', `locations walked where their first item comes, none last: ${walk[0].places.map((p) => p.label)}`);
ok(walk[0].places[0].items.map((i) => i.id).join() === 'c,e' && walk[0].places[1].items.map((i) => i.id).join() === 'b,d', 'under a location: category, then number');
const noDecks = walkGroups([at('x', 'eebd', '', 'Bar', '2'), at('y', 'eebd', '', 'Aft', '1')]);
ok(noDecks.length === 1 && noDecks[0].label === '' && noDecks[0].places.map((p) => p.label).join() === 'Aft,Bar', 'no decks: one group of locations');

// The round an inspection counts towards, from anywhere in the app.
const r2: any = { ...round, id: 'r2', startedAt: 9 };
const wk: any = { ...round, id: 'w', period: 'weekly' };
ok(roundFor([round, wk], { category: 'eebd' } as any, 'monthly')?.id === 'r1', 'monthly inspection → the monthly round, not the weekly');
ok(roundFor([round, wk], { category: 'eebd' } as any, 'quarterly') === null, 'no round of that period → none');
ok(roundFor([round, r2], { category: 'eebd' } as any, 'monthly')?.id === 'r2' && roundFor([round, r2], { category: 'eebd' } as any, 'monthly', 'r1')?.id === 'r1', 'two fit: this device\'s round, else the newest');
ok(roundFor([round], { category: 'lifebuoys' } as any, 'monthly') === null, 'category not in the round → none');
ok(overlappingRound([round], 'monthly', ['eebd'])?.id === 'r1' && !overlappingRound([round], 'weekly', ['eebd']) && !overlappingRound([{ ...round, closedAt: 1 }], 'monthly', ['eebd']), 'overlap: same period and category, open');

// The round's report: the Reports layout, scoped to the round.
const closed: any = { ...round, closedAt: Date.parse('2026-10-31T17:05:00'), closedBy: 'Jez', closedByRank: 'Chief Officer', closedWith: { method: 'pin', at: 1 } };
const rep = buildRoundReport(flat, trail, closed);
ok(rep.inScope.length === 4 && rep.missed.length === 3 && rep.done.length === 2 && rep.done.every((i) => i.roundId === 'r1'), 'report: round scope, only inspections signed in it');
ok(/Monthly Inspection Round/.test(rep.headline) && /Incomplete \(1 of 4/.test(rep.headline) && /Signed off/.test(rep.headline), `headline: ${rep.headline}`);
ok(roundSignoffLine(closed) === 'Jez (Chief Officer) · 31 Oct 2026 17:05 · signed by PIN' || /Jez.*Chief Officer.*17:05.*signed by PIN/.test(roundSignoffLine(closed)), `sign-off line: ${roundSignoffLine(closed)}`);
// duplicates (Jez, 14 Oct 2026): two open rounds of the same period sharing a category
{
  const R = (id: string, period: string, cats: string[], at: number, closed?: number): any => ({ id, period, categories: cats, startedAt: at, startedBy: 'x', from: '', to: '', label: '', updatedAt: at, ...(closed ? { closedAt: closed } : {}) });
  const d = duplicateRounds([R('a', 'monthly', ['fire_extinguishers'], 1), R('b', 'monthly', ['fire_extinguishers', 'lifebuoys'], 2), R('c', 'weekly', ['fire_extinguishers'], 3), R('e', 'monthly', ['lifejackets'], 4), R('f', 'monthly', ['fire_extinguishers'], 5, 6)]);
  ok(d.length === 1 && d[0].keep.id === 'a' && d[0].extra.id === 'b', 'duplicate rounds: the later of two open monthly rounds sharing a category; other periods, other categories and closed rounds left alone');
}

console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
