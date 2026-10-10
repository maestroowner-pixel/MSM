// npm run check:gangway — who is ashore, persons on board, the next move a
// crew card makes, double scans, and the crew card QR payload.
import { isAshore, isDoubleScan, lastMoves, nextMove, personsOnBoard } from '../services/gangway';
import { crewQrPayload, parseCrewQr } from '../services/crewQr';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const crew: any[] = [
  { id: 'a', name: 'Ann', active: true },
  { id: 'b', name: 'Bob', active: true },
  { id: 'c', name: 'Cy', active: true, onBoard: false },
];
const t0 = new Date('2026-10-10T09:00:00');
const m1 = nextMove(crew[0], [], 'Watch', 'qr', t0);
ok(m1.dir === 'ashore' && m1.time === '09:00' && m1.date === '2026-10-10', 'first scan of someone aboard = ashore');
const m2 = nextMove(crew[0], [m1], 'Watch', 'qr', new Date('2026-10-10T18:30:00'));
ok(m2.dir === 'aboard', 'second scan = back aboard');
ok(isAshore('a', lastMoves([m1])) && !isAshore('a', lastMoves([m1, m2])), 'place is the last move');
ok(!isAshore('a', lastMoves([m2, m1].reverse())), 'order of the list does not matter');
const pob = personsOnBoard(crew, [m1], [{ timeOut: undefined } as any, { timeOut: '12:00' } as any]);
ok(pob.crewTotal === 2 && pob.crewAboard === 1 && pob.visitors === 1 && pob.total === 2, 'POB: signed-off crew and signed-out visitors not counted');
ok(isDoubleScan('a', [m1], t0.getTime() + 30_000) && !isDoubleScan('a', [m1], t0.getTime() + 120_000), 'double scan within a minute');
ok(parseCrewQr(crewQrPayload('crw_AbC')) === 'crw_AbC' && parseCrewQr('MSM://CREW/x1') === 'x1', 'crew QR round trip, case of scheme ignored');
ok(parseCrewQr('msm://item/x') === null, 'crew and item QRs do not mix');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
