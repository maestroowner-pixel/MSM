// npm run check:dp — DP checklists keep their line ids; DP days count as SDM counts them; the letter says what the log says.
import { DP_TEMPLATES, answerText, buildLetter, checkOutcome, conditionsText, coordText, dayId, lineSource, parseCoord, parseLine, positionText, dpoTotals, emptySlots, hours, isDpDay, letterHtml, linesFromText, setRange, templatesNow } from '../services/dp';
import { DpDay } from '../types/dp';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const ids = DP_TEMPLATES.flatMap((x) => x.lines.map((l) => l.id));
ok(new Set(ids).size === ids.length && DP_TEMPLATES.length === 5, 'five built-in checklists, line ids unique');
const sys = DP_TEMPLATES.find((x) => x.id === 'dp.arrival.systems')!;
ok(sys.lines.filter((l) => l.head).length === 8 && sys.lines.find((l) => l.text === 'GPS 1')?.options?.join('|') === 'Not used|Monitor|Selected', 'arrival systems checklist: eight sections, GPS answered Not used / Monitor / Selected');

// The vessel's own wording replaces a built-in; a switched-off one is gone; its own are added.
const own = [{ ...DP_TEMPLATES[3], title: 'Our handover', updatedAt: 5 }, { ...DP_TEMPLATES[4], off: true, updatedAt: 5 }, { id: 'v.trials', title: 'Annual DP trials prep', where: 'bridge' as const, lines: [], updatedAt: 5 }];
const now = templatesNow(own);
ok(now.map((x) => x.title).join('|') === `${DP_TEMPLATES[0].title}|${DP_TEMPLATES[1].title}|${DP_TEMPLATES[2].title}|Our handover|Annual DP trials prep`, 'reworded, switched off, own added');

// Rewording keeps the ids of lines whose text stayed.
const old = DP_TEMPLATES[3].lines;
const edited = linesFromText(`${old[0].text}\n- New line about the ROV\n${old[2].text}\n\n`, old, 'dp.handover', 1);
ok(edited.length === 3 && edited[0].id === old[0].id && edited[2].id === old[2].id && edited[1].id !== old[1].id, 'kept lines keep their id; a new line gets a new one; bullets and blanks dropped');

ok(JSON.stringify(checkOutcome({ lines: old.slice(0, 4), results: { [old[0].id]: 'pass', [old[1].id]: 'fail', [old[2].id]: 'na' } })) === '{"pass":1,"fail":1,"na":1,"open":1}', 'outcome counts');

// Line syntax: options, a reading, a heading; written back the same.
const g = parseLine('Gyro 1 {Available|Priority} [Hdg]');
ok(g.text === 'Gyro 1' && g.options?.length === 2 && g.value === 'Hdg' && lineSource(g) === 'Gyro 1 {Available|Priority} [Hdg]', 'option + reading line parsed and written back');
ok(parseLine('## Power').head === true && parseLine('Position gain [setting]').value === 'setting' && !parseLine('Position gain [setting]').options, 'heading; reading-only');
const L3 = [{ id: 'h', text: 'Sensors', head: true }, { id: 'a', text: 'GPS 1', options: ['Not used', 'Selected'] }, { id: 'b', text: 'Gain', value: 'setting' }, { id: 'c', text: 'Crane', options: ['Good', 'No good'] }, { id: 'd', text: 'Gyro', options: ['Available'], value: 'Hdg' }];
ok(JSON.stringify(checkOutcome({ lines: L3, results: { a: 'Selected', c: 'No good' }, values: { b: '30' } })) === '{"pass":2,"fail":1,"na":0,"open":1}', 'outcome: headings skipped, a reading counts when written, No good is a no');
ok(answerText(L3[4], { results: { d: 'Available' }, values: { d: '123.4' } }) === 'Available · Hdg: 123.4', 'answer text with the reading');
const kept = linesFromText(sys.lines.map(lineSource).join('\n'), sys.lines, sys.id, 1);
ok(kept.every((l, i) => l.id === sys.lines[i].id) && kept.length === sys.lines.length, 'the arrival checklist round-trips through the editor with every id kept');

// Position.
ok(parseCoord('57 12.345 N', 'lat') === 57.20575 && parseCoord("001°23.456'W", 'lon') === -1.390933 && parseCoord('-33.5', 'lat') === -33.5, 'lat/lon: deg-min with hemisphere, decimal');
ok(parseCoord('57 12.3 E', 'lat') === undefined && parseCoord('91 00 N', 'lat') === undefined && parseCoord('12 75 N', 'lat') === undefined && parseCoord('abc', 'lon') === undefined && parseCoord('', 'lat') === undefined, 'wrong hemisphere, off the globe, minutes ≥ 60, words, empty — refused');
ok(coordText(57.20575, 'lat') === '57°12.345′N' && coordText(-1.390933, 'lon') === '001°23.456′W' && positionText({ lat: NaN, lon: 1 }) === '—', 'written as a navigator writes it');
ok(conditionsText({ waterDepth: '85 m', windSpeed: '15 kn', windDir: '270', waveHeight: '1.5 m' }) === 'water depth 85 m · wind 15 kn / 270 · waves 1.5 m', 'conditions line');

// DP time.
let s = setRange(emptySlots(), 16, 20, 1); // 08:00–10:00 active
ok(hours(s, 1) === 2 && hours(s, 2) === 0 && isDpDay(s), '2 h active → a DP day');
s = setRange(emptySlots(), 16, 19, 2);
ok(!isDpDay(s) && hours(s, 'all') === 1.5, '1.5 h → not a DP day');
const day = (crewId: string, date: string, a: number, p: number, name = 'Ann Lee'): DpDay => ({ id: dayId(crewId, date), crewId, name, rank: 'Second Officer', date, slots: setRange(setRange(emptySlots(), 0, a * 2, 1), a * 2, a * 2 + p * 2, 2), updatedAt: 1 });
const log = [day('m1', '2026-10-01', 4, 2), day('m1', '2026-10-02', 0, 3), day('m1', '2026-10-03', 1, 0), day('m2', '2026-10-01', 6, 0, 'Tom Roe'), { ...day('m1', '2026-10-04', 5, 0), deleted: true }];
const tot = dpoTotals(log);
const ann = tot.find((x) => x.crewId === 'm1')!;
ok(tot.length === 2 && ann.dpDays === 2 && ann.active === 5 && ann.passive === 5 && ann.first === '2026-10-01' && ann.last === '2026-10-03', 'per DPO: DP days, active, passive, first and last; deleted left out');

// The letter.
const info = { company: 'Ocean Co Ltd', dpClass: '2', grt: '4 500', signatoryName: 'J. Smith', signatoryRank: 'Marine Superintendent', contacts: 'ops@ocean.example\n+44 20 0000 0000' };
const L = buildLetter({ scheme: 'new', today: '2026-10-16', name: 'Ann Lee', dob: '1990-03-05', rank: 'Second Officer', vesselName: 'Armada 86 01', imo: '9900001', info, from: '2026-10-01', to: '2026-10-31', days: log.filter((d) => d.crewId === 'm1') });
ok(L.row.join('|') === 'Armada 86 01|4 500|9900001|2|01/10/2026|31/10/2026|2|Second Officer', `table row: ${L.row.join('|')}`);
ok(L.dates[0][1] === '01/10/2026' && L.dates[1][1] === '02/10/2026', 'new scheme: active dates, passive-only dates; a 1-hour day is not listed');
ok(L.paras[0].includes('Ann Lee (DOB: 05/03/1990)') && L.paras[0].includes('Ocean Co Ltd') && L.missing.length === 0, 'who, born, employer; nothing missing');
ok(L.fileName === 'Confirmation_letter_Second_Officer_Lee_20261016.pdf', 'file name as in SDM');
const O = buildLetter({ scheme: 'old', today: '2026-10-16', name: 'Ann Lee', info: {}, from: '2026-11-01', to: '2026-11-30', days: log });
ok(O.dates.length === 0 && O.notes[0] === 'NOTES FOR REVALIDATION:' && O.heading.endsWith('Old Scheme'), 'old scheme: notes, no date lists');
ok(O.missing.join(', ') === 'date of birth (Crew → the person), company, DP class, who signs, a DP day (2 hours or more) in the period', 'missing listed before the letter is made');
const H = letterHtml({ ...L, paras: ['A <b> & "c"'] });
ok(H.includes('A &lt;b&gt; &amp; &quot;c&quot;') && H.includes('ops@ocean.example<br>+44 20 0000 0000'), 'html escaped; contacts line by line');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
