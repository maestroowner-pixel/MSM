// npm run check:logbooks — Sewage and Ballast Water record books: rules and lines.
import { BALLAST, SEWAGE } from '../services/logbooks';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
ok(/3 nm/.test(SEWAGE.problem({ code: 'COM', quantity: 2, place: 'x', distance: 2 }) ?? ''), 'comminuted sewage closer than 3 nm → warned');
ok(SEWAGE.problem({ code: 'COM', quantity: 2, place: 'x', distance: 4 }) === null, 'comminuted 4 nm out is fine');
ok(/4 knots/.test(SEWAGE.problem({ code: 'HT', tank: 'Black water tank', quantity: 3, place: 'x', distance: 14, speed: 2 }) ?? ''), 'untreated while slower than 4 kn → warned');
ok(/12 nm/.test(SEWAGE.problem({ code: 'HT', tank: 'T', quantity: 3, place: 'x', distance: 8, speed: 6 }) ?? ''), 'untreated inside 12 nm → warned');
ok(SEWAGE.text({ code: 'SHORE', quantity: 5, tank: 'Black water tank', place: 'Antibes', receiptNo: 'R12' }) === 'To reception facility 5 m³ from Black water tank; Antibes; receipt R12', 'sewage line');
ok(/200 m/.test(BALLAST.problem({ code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, method: 'seq', place: 'a', placeEnd: 'b', distance: 220, depth: 150 }) ?? ''), 'exchange in shallow water → warned');
ok(BALLAST.problem({ code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, method: 'seq', place: 'a', placeEnd: 'b', distance: 220, depth: 3000 }) === null, 'exchange 220 nm out, 3000 m deep');
ok(/Exchange \(Sequential\) 120 m³ in DB 1 P\/S/.test(BALLAST.text({ code: 'EXCH', tank: 'DB 1 P/S', quantity: 120, method: 'seq', place: 'a', placeEnd: 'b', start: '08:00', stop: '11:30' })), 'exchange line names the method');
ok(BALLAST.text({ code: 'UP', tank: 'Fore peak', quantity: 40, place: 'Palma', treated: true }).includes('treated (BWMS)'), 'uptake treated');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
