// npm run check:decklogcopy — the Deck log's true copy and the ship's zone frozen at the signature
// (21 Nov 2026, Panama MMC-193 §4.1.2–4.1.4).
import { zoneOnSign } from '../services/deckLog';
import { DECK_COPY_HEAD, deckLogCopy, deckRow } from '../services/deckLogCopy';
import { trueCopyDoc } from '../services/trueCopy';
import { setShipClock } from '../utils/shipTime';
import type { DeckEntry } from '../types/deckLog';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

setShipClock({ ship_utc_offset: '+02:00' } as any);

const base = (id: string, date: string, time: string, x: Partial<DeckEntry> = {}): DeckEntry =>
  ({ id, date, time, period: '08-12', by: 'J. Smith', byRank: 'Chief Officer', at: Date.parse(`${date}T${time}:00Z`) - 2 * 3600000, updatedAt: 0, ...x } as DeckEntry);

// ── zoneOnSign ──
const fresh = zoneOnSign(base('a', '2026-11-20', '14:30'), undefined);
ok(fresh.shipOffset === '+02:00', 'a new signed entry takes the zone in force');
ok(!zoneOnSign(base('b', '2026-11-20', '14:30', { draft: true }), undefined).shipOffset, 'a draft gets no zone yet');
ok(zoneOnSign(base('c', '2026-11-20', '14:30'), { draft: true }).shipOffset === '+02:00', 'signing a draft freezes the zone');
ok(!zoneOnSign(base('d', '2026-11-20', '14:30', { masterAt: 1 }), { draft: false }).shipOffset, 'an entry signed before (Master review added) is left as it was — the rules allow only the review');
ok(zoneOnSign(base('e', '2026-11-20', '14:30', { shipOffset: '-05:00' }), undefined).shipOffset === '-05:00', 'a zone already there stays');

// ── rows ──
const r = deckRow({ ...fresh, latDeg: 41, latMin: 22.5, latHem: 'N', lonDeg: 2, lonMin: 10.1, lonHem: 'E', courseGyro: 215, speed: 11.5, windDir: 'NE', windBft: 4, remarks: 'Passed Cap de Creus' } as DeckEntry);
ok(r.length === DECK_COPY_HEAD.length, 'a row has every column');
ok(r[0] === '20.11.2026 14:30 LT\n(UTC+02:00)\n12:30 UTC', `ship's time with the zone and UTC (${JSON.stringify(r[0])})`);
ok(r[2].includes("41°22.5'N") && r[2].includes('215°T') && r[2].includes('11.5 kn'), 'navigation printed');
ok(r[5].startsWith('J. Smith (Chief Officer)') && r[5].includes('UTC'), 'signed by, with the UTC time of the signature');
ok(r[6] === '', "no Master's review — empty");
const port = deckRow(base('p', '2026-11-20', '09:00', { mode: 'port', courseGyro: 100, wxCondition: 'Rain' }));
ok(port[1].includes('In port') && port[2] === '' && port[3].includes('Rain'), 'an entry in port prints no navigation');
const legacy = deckRow(base('l', '2026-11-01', '04:00'));
ok(legacy[0] === '01.11.2026 04:00', 'an entry without a zone prints as written — none is guessed');

// ── the copy ──
const log: DeckEntry[] = [
  { ...fresh, id: 'n1' },
  zoneOnSign(base('n2', '2026-11-20', '08:00'), undefined),
  base('n3', '2026-11-20', '12:00', { draft: true }),
  base('o1', '2026-09-03', '20:00', { masterBy: 'A. Master', masterByRank: 'Master', masterAt: Date.parse('2026-09-04T08:00:00Z') }),
  base('x1', '2026-12-01', '00:00'),
];
const day = deckLogCopy(log, '2026-11-20', '2026-11-20', { vessel_name: 'Dream/Boat', imo: '1234567' });
ok(day.copy.rows.length === 2, 'a day: signed entries only');
ok(day.copy.rows[0][0].startsWith('20.11.2026 08:00') && day.copy.rows[1][0].startsWith('20.11.2026 14:30'), 'oldest first');
ok(day.copy.verifications.some((l) => l.includes('1 unsigned draft')), 'the draft is counted, not printed');
ok(day.copy.title === 'Deck Watch Log · 20.11.2026', `day title (${day.copy.title})`);
ok(day.name === 'DeckLog_20261120_Dream Boat.pdf', `file name (${day.name})`);

const per = deckLogCopy(log, '2026-11', '2026-09', null);
ok(per.copy.rows.length === 3 && per.copy.rows[0][0].startsWith('03.09.2026'), 'months either way round; December left out');
ok(per.copy.title === 'Deck Watch Log · September 2026 – November 2026', `period title (${per.copy.title})`);
ok(per.copy.verifications.some((l) => l === 'No entries in October 2026.'), 'an empty month is named');
ok(per.copy.verifications.some((l) => l.startsWith('1 of 3 entries reviewed')), "the Master's review counted");
ok(per.copy.verifications.some((l) => l.includes('before version 2.78')), 'entries without a zone are said');
ok(per.copy.rows[0][6].startsWith('A. Master (Master)\n04.09.2026 08:00 UTC'), "the Master's review printed with UTC");
ok(per.name === 'DeckLog_202609-202611.pdf', `period file name (${per.name})`);
ok(deckLogCopy(log, '2026-11', '2026-11', { vessel_name: 'DreamBoat' }).name === 'DeckLog_202611_DreamBoat.pdf', 'one month — one month in the name');
ok(deckLogCopy(log, '2025-01', '2025-02', null).copy.rows.length === 0, 'a period with nothing — an empty copy, not an error');

// ── the PDF itself ──
const many: DeckEntry[] = [];
for (let d = 1; d <= 30; d++) for (const h of ['00', '04', '08', '12', '16', '20']) many.push(zoneOnSign(base(`m${d}${h}`, `2026-06-${String(d).padStart(2, '0')}`, `${h}:00`, { remarks: 'Routine watch, all well. '.repeat(3) }), undefined));
const doc = trueCopyDoc(deckLogCopy(many, '2026-06', '2026-06', { vessel_name: 'DreamBoat' }).copy);
const pages = doc.getNumberOfPages();
ok(pages > 3, `a month of six watches a day runs to ${pages} numbered pages`);
const pdf = String(doc.output());
ok(pdf.includes(`Page ${pages} of ${pages}`) && pdf.includes('Certified true copy'), 'every page numbered n of N, with the true-copy line');

if (fail) { console.log(`\n${fail} failed`); process.exit(1); }
console.log('\nall deck log copy checks passed');
