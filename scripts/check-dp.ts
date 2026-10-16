// npm run check:dp — DP checklists keep their line ids; DP days count as SDM counts them; the letter says what the log says.
import { DP_TEMPLATES, hasCell, rowCells, formatCell, otherKey, answerText, cellKey, sectionCols, buildLetter, checkOutcome, conditionsText, coordText, dayId, positionFromText, lineSource, parseCoord, parseLine, positionText, dpoTotals, emptySlots, hours, isDpDay, letterHtml, linesFromText, setRange, templatesNow } from '../services/dp';
import { DpDay } from '../types/dp';
import { isOfficerRank } from '../types/crew';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const ids = DP_TEMPLATES.flatMap((x) => x.lines.map((l) => l.id));
const ho = DP_TEMPLATES.find((x) => x.id === 'dp.handover')!;
ok(ho.lines.filter((l) => l.kind === 'field').map((l) => l.text).join('|') === 'Location|Project|Client' && ho.lines.some((l) => l.kind === 'sketch') && ho.lines.some((l) => l.kind === 'text') && ho.lines.find((l) => l.text === 'Operation')?.cols?.[1].name === 'If No, why?', 'handover = the vessel form: header fields, If No why, brief description, schematic');
ok(lineSource(parseLine('@sketch Own vessel, rig')) === '@sketch Own vessel, rig' && checkOutcome({ lines: ho.lines.filter((l) => l.kind), results: {} }).open === 0, 'fields, texts and sketches are not questions');
ok(DP_TEMPLATES.filter((x) => !['dp.handover', 'dp.arrival.bridge'].includes(x.id)).every((x) => x.lines[0].head && x.lines[0].text === 'Operator stations') && DP_TEMPLATES.find((x) => x.id === 'dp.arrival.bridge')!.lines[0].kind === 'field' && DP_TEMPLATES.filter((x) => x.id !== 'dp.handover').every((x) => x.lines.some((l) => l.head && l.cols?.[0].name === 'Checked')), 'every checklist starts with the DP system tables, then its own items as a table');
ok(new Set(ids).size === ids.length && DP_TEMPLATES.length === 4, 'five built-in checklists, line ids unique');
const eng = DP_TEMPLATES.find((x) => x.id === 'dp.arrival.engine')!;
const sys = { ...eng, lines: eng.lines.slice(0, eng.lines.findIndex((l) => l.text === 'Field arrival — engine room')) };
const heads = sys.lines.filter((l) => l.head);
ok(heads.length === 9 && heads.every((h) => h.cols?.length) && heads.find((h) => h.text === 'Sensors')?.cols?.map((x) => x.name).join('|') === 'Available|Priority|Value|Deviation', 'arrival checklist laid out as the paper: nine tables, Sensors = Available / Priority / Value / Deviation');
const prs = heads.find((h) => h.text === 'Origin reference system')!;
ok(prs.cols![0].options!.join('|') === 'Not used|Monitor|Selected|Mobile' && prs.cols![1].name === 'Noise' && !prs.cols![1].options, 'PRS: status chosen, noise and weight written');

// The vessel's own wording replaces a built-in; a switched-off one is gone; its own are added.
const own = [{ ...DP_TEMPLATES[2], title: 'Our handover', updatedAt: 5 }, { ...DP_TEMPLATES[3], off: true, updatedAt: 5 }, { id: 'v.trials', title: 'Annual DP trials prep', where: 'bridge' as const, lines: [], updatedAt: 5 }];
const now = templatesNow(own);
ok(now.map((x) => x.title).join('|') === `${DP_TEMPLATES[0].title}|${DP_TEMPLATES[1].title}|Our handover|Annual DP trials prep`, 'reworded, switched off, own added');

// Rewording keeps the ids of lines whose text stayed.
const old = ['DP status', 'Set-points', 'References in use', 'Sensors'].map((text, i) => ({ id: `dp.handover.x${i}`, text }));
const edited = linesFromText(`${old[0].text}\n- New line about the ROV\n${old[2].text}\n\n`, old, 'dp.handover', 1);
ok(edited.length === 3 && edited[0].id === old[0].id && edited[2].id === old[2].id && edited[1].id !== old[1].id, 'kept lines keep their id; a new line gets a new one; bullets and blanks dropped');

ok(JSON.stringify(checkOutcome({ lines: old.slice(0, 4), results: { [old[0].id]: 'pass', [old[1].id]: 'fail', [old[2].id]: 'na' } })) === '{"pass":1,"fail":1,"na":1,"open":1}', 'outcome counts');

// Line syntax: options, a reading, a heading; written back the same.
const g = parseLine('Gyro 1 {Available|Priority} [Hdg]');
ok(g.text === 'Gyro 1' && g.options?.length === 2 && g.value === 'Hdg' && lineSource(g) === 'Gyro 1 {Available|Priority} [Hdg]', 'option + reading line parsed and written back');
ok(parseLine('## Power').head === true && parseLine('Position gain [setting]').value === 'setting' && !parseLine('Position gain [setting]').options, 'heading; reading-only');
const L3 = [{ id: 'h', text: 'Sensors', head: true }, { id: 'a', text: 'GPS 1', options: ['Not used', 'Selected'] }, { id: 'b', text: 'Gain', value: 'setting' }, { id: 'c', text: 'Crane', options: ['Good', 'No good'], bad: ['No good'] }, { id: 'd', text: 'Gyro', options: ['Available'], value: 'Hdg' }];
ok(JSON.stringify(checkOutcome({ lines: L3, results: { a: 'Selected', c: 'No good' }, values: { b: '30' } })) === '{"pass":2,"fail":1,"na":0,"open":1}', 'outcome: headings skipped, a reading counts when written, No good is a no');
ok(answerText(L3[4], { results: { d: 'Available' }, values: { d: '123.4' } }) === 'Available · Hdg: 123.4', 'answer text with the reading');
const kept = linesFromText(sys.lines.map(lineSource).join('\n'), sys.lines, sys.id, 1);
ok(kept.every((l, i) => l.id === sys.lines[i].id) && kept.length === sys.lines.length, 'the arrival checklist round-trips through the editor with every id kept');

// Tables: a heading with columns; a row is answered when a cell is, wrong when a "!" answer is chosen.
const th = parseLine('## Comms | Status {Good|!No good} | Note');
ok(th.head === true && th.cols?.[0].bad?.join() === 'No good' && th.cols?.[1].name === 'Note' && lineSource(th) === '## Comms | Status {Good|!No good} | Note', 'table heading parsed, "!" marks the wrong answer, written back');
const T = [{ id: 'h', ...th }, { id: 'r1', text: 'Crane' }, { id: 'r2', text: 'Deck' }, { id: 'r3', text: 'ROV' }];
ok(sectionCols(T).get('r1')?.length === 2, 'rows know their table');
ok(JSON.stringify(checkOutcome({ lines: T, results: { [cellKey('r1', 0)]: 'Good', [cellKey('r2', 0)]: 'No good' }, values: {} })) === '{"pass":1,"fail":1,"na":0,"open":1}', 'table rows: good, no good, empty');
const keptSys = linesFromText(sys.lines.map(lineSource).join('\n'), sys.lines, sys.id, 1);
ok(keptSys.every((l, i) => l.id === sys.lines[i].id && JSON.stringify(l.cols) === JSON.stringify(sys.lines[i].cols)), 'the table checklist round-trips through the editor');

ok(answerText({ id: 'rc', text: 'Rotation centre', options: ['Fwd', 'Other'] }, { results: { rc: 'Other' }, values: { [otherKey('rc')]: 'Moonpool' } }) === 'Other: Moonpool', '"Other" keeps what was written');

const sw = parseLine('## > Swell | Direction (deg) | Height (m) [0.0]');
ok(sw.beside === true && sw.cols?.[1].name === 'Height (m)' && sw.cols?.[1].format === '0.0' && lineSource(sw) === '## > Swell | Direction (deg) | Height (m) [0.0]' && formatCell('1,25', '0.0') === '1.3' && formatCell('2', '0.0') === '2.0' && formatCell('n/a', '0.0') === 'n/a', 'swell height to one decimal; table beside');

ok(['Master', 'Chief Officer', '2/O', 'Third Officer', 'SDPO', 'DPO', 'Chief Engineer', '2nd Engineer', 'ETO', 'Chief Mate'].every(isOfficerRank) && !['Bosun', 'AB', 'Cook', 'Deck Cadet', 'Engine Cadet', 'Motorman', 'Oiler', ''].some(isOfficerRank), 'officers by rank sign DP checklists; ratings and cadets do not');

const dg = parseLine('DGPS 1 -[Beacon No.] -[Mode]');
const rs = DP_TEMPLATES.find((x) => x.id === 'dp.handover')!.lines.find((l) => l.text === 'Reference system settings')!;
ok(dg.text === 'DGPS 1' && dg.skip?.join('|') === 'Beacon No.|Mode' && lineSource(dg) === 'DGPS 1 -[Beacon No.] -[Mode]' && rs.cols!.map((c) => c.name).join('|') === 'Setting|Beacon No.|Value (%)|Mode|HDOP|Satellites' && !hasCell(dg as any, rs.cols![3]) && hasCell(dg as any, rs.cols![2]) && rowCells({ id: 'd', ...dg }, rs.cols!, { results: {}, values: {} })[3] === ' ', 'DGPS has no mode or beacon; Mode is the last column');

const hid = parseLine('~Bow AZI');
const hoT = DP_TEMPLATES.find((x) => x.id === 'dp.handover')!;
const withHidden = { ...hoT, lines: hoT.lines.map((l) => (l.text === 'Bow AZI' ? { ...l, hidden: true } : l)) };
ok(hid.hidden === true && hid.text === 'Bow AZI' && lineSource(hid) === '~Bow AZI' && !templatesNow([withHidden]).find((x) => x.id === 'dp.handover')!.lines.some((l) => l.text === 'Bow AZI') && hoT.lines.some((l) => l.text === 'AZI 2'), 'thruster variants shipped; a hidden row (~) stays in the wording, out of the checklist');

const pr = parseLine('## Sensors — gyros | Preferred {one} | Heading (deg)');
ok(pr.cols?.[0].one === true && pr.cols?.[0].options?.join() === 'Yes' && lineSource(pr) === '## Sensors — gyros | Preferred {one} | Heading (deg)', 'one preferred sensor per table');

// Position.
ok(parseCoord('57 12.345 N', 'lat') === 57.20575 && parseCoord("001°23.456'W", 'lon') === -1.390933 && parseCoord('-33.5', 'lat') === -33.5, 'lat/lon: deg-min with hemisphere, decimal');
ok(parseCoord('57 12.3 E', 'lat') === undefined && parseCoord('91 00 N', 'lat') === undefined && parseCoord('12 75 N', 'lat') === undefined && parseCoord('abc', 'lon') === undefined && parseCoord('', 'lat') === undefined, 'wrong hemisphere, off the globe, minutes ≥ 60, words, empty — refused');
ok(coordText(57.20575, 'lat') === "57°12.3'N" && coordText(-1.390933, 'lon') === "001°23.5'W" && positionText({ lat: NaN, lon: 1 }) === '—', 'written as the record books write it');
const pf = positionFromText("57°12.3'N 001°23.5'W");
ok(!!pf && pf.lat === 57.205 && pf.lon === -1.391667 && positionText(pf) === "57°12.3'N 001°23.5'W" && !positionFromText('') && !positionFromText("57°12.3'N"), 'the record-book cells read back to degrees and round-trip');
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
