// npm run check:clock — the clock source in the top line (ISO 21745 §4.2.1): skew from an HTTP Date header, state.
import { clockState, skewOf, skewText, STALE_MS } from '../services/clockSkew';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = Date.parse('2026-11-21T12:00:00Z');
const H = 'Sat, 21 Nov 2026 12:00:00 GMT';
ok(skewOf(H, T, T + 200) === 0, 'clock right within the second the header can tell');
ok(skewOf(H, T + 900, T + 1000) === 0, 'still within: server second runs to 12:00:00.999');
const ahead = skewOf(H, T + 43_000, T + 43_200);
ok(ahead != null && ahead > 41_000 && ahead < 43_000, `device 43 s ahead → about +42 s counted (${ahead})`);
const behind = skewOf(H, T - 120_000, T - 119_900);
ok(behind != null && behind < -119_000, `device 2 min behind → negative (${behind})`);
ok(skewOf(H, T, T + 6000) === null, 'a round trip over 5 s tells too little');
ok(skewOf('garbage', T, T + 100) === null && skewOf(null, T, T + 100) === null, 'no or unreadable header → no check');
ok(clockState(null, T).kind === 'unchecked', 'never checked');
ok(clockState({ at: T, skewMs: 0 }, T + 60_000).kind === 'synced', 'checked a minute ago, right');
ok(clockState({ at: T, skewMs: 12_000 }, T + 60_000).kind === 'off', '12 s off → off');
ok(clockState({ at: T, skewMs: 9_000 }, T + 60_000).kind === 'synced', '9 s → still right');
ok(clockState({ at: T, skewMs: 0 }, T + STALE_MS + 1).kind === 'stale', 'a check older than 6 h is stale');
ok(clockState({ at: T, skewMs: -30_000 }, T + STALE_MS + 1).kind === 'off', 'a known wrong clock stays reported as wrong');
ok(skewText(43_000) === '+43 s' && skewText(-125_000) === '−2 min 05 s' && skewText(3_720_000) === '+1 h 02 min', 'skew wording');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
