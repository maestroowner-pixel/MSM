// npm run check:dp — DP checklists keep their line ids; DP days count as SDM counts them; the letter says what the log says.
import { DP_TEMPLATES, WATCH_TEMPLATES, keepRecent, signRoles, hasCell, rowCells, formatCell, otherKey, answerText, cellKey, sectionCols, buildLetter, checkOutcome, conditionsText, coordText, dayId, positionFromText, lineSource, parseCoord, parseLine, positionText, dpoTotals, emptySlots, hours, isDpDay, letterHtml, linesFromText, setRange, templatesNow, slotsFromRecords, offDpSpans, dpCheckDeckEntry, dpEventDeckEntry } from '../services/dp';
import { DpCheck, DpDay, DpLogEntry } from '../types/dp';
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

const arr = DP_TEMPLATES.find((x) => x.id === 'dp.arrival.bridge')!;
ok(signRoles(arr).join('|') === 'SDPO|DPO' && signRoles(DP_TEMPLATES.find((x) => x.id === 'dp.handover')!).join('|') === 'Handing over|Taking over' && arr.lines.some((l) => l.text === 'DP verification' && l.head) && arr.lines.filter((l) => l.text.startsWith('Move 10 m ahead')).length === 3, 'arrival = handover sheet + DP verification trials, signed by SDPO and DPO');

const DAY = 86_400_000, NOW = 200 * DAY, CUT = NOW - 90 * DAY;
const recs = [{ id: 'new', at: NOW - DAY, updatedAt: NOW - DAY }, { id: 'oldSent', at: NOW - 120 * DAY, updatedAt: NOW - 120 * DAY }, { id: 'oldQueued', at: NOW - 100 * DAY, updatedAt: NOW - 100 * DAY }];
ok(keepRecent(recs, { new: NOW - DAY, oldSent: NOW - 120 * DAY }, CUT).map((r) => r.id).join() === 'new,oldQueued', 'a device keeps 90 days; an older record goes only once it is up in the cloud');

ok(WATCH_TEMPLATES.map((x) => `${x.book}:${x.id}`).join() === 'bridge:bridge.handover,engine:engine.handover,bridge:bridge.signoff,engine:engine.signoff,fam-safety:fam.safety,fam-bridge:fam.bridge,fam-engine:fam.engine,fam-project:fam.project,fam-pax:fam.pax,fam-dp:fam.dp,bridge-sea:bridge.prep.sea,bridge-arrival:bridge.prep.arrival,bridge-pilot:bridge.pilotage,bridge-vis:bridge.restricted,bridge-weather:bridge.heavy,emergency:emergency.fire,emergency:emergency.mob,emergency:emergency.abandon,emergency:emergency.collision,emergency:emergency.grounding,emergency:emergency.flooding' && signRoles(WATCH_TEMPLATES[8]).join('|') === 'Guest|Briefed by' && signRoles(WATCH_TEMPLATES[4]).join('|') === 'Familiarised|Familiarised by' && signRoles(WATCH_TEMPLATES[2]).join('|') === 'Signing off|Signing on' && signRoles(WATCH_TEMPLATES[0]).join('|') === 'Handing over|Taking over', 'bridge and engine books: watch handover and sign-on / sign-off, the right signatures');

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

// DP time from the records: handovers make the watch, own DP log lines add half-hours, all Active.
const hc = (at: string, by: string, by2: string, extra: Partial<DpCheck> = {}): DpCheck => ({ id: at, templateId: 'dp.handover', title: 'DP watch handover / takeover', where: 'bridge', at: Date.parse(`${at}:00Z`), shipOffset: '+00:00', position: { lat: 0, lon: 0 }, lines: [], results: {}, by, by2, updatedAt: 0, ...extra });
const ll = (date: string, time: string, name: string): DpLogEntry => ({ id: date + time + name, date, time, text: 'x', initials: '', name, at: 0, updatedAt: 0 });
const ho2 = [hc('2026-11-10T08:00', 'Bob Day', 'Ann Lee'), hc('2026-11-10T12:00', 'Ann Lee', 'Bob Day'), hc('2026-11-10T20:00', 'Bob Day', 'Ann Lee'), hc('2026-11-11T00:00', 'Ann Lee', 'Bob Day')];
const r1 = slotsFromRecords('ann lee', '2026-11-10', ho2, [ll('2026-11-10', '14:10', 'Ann Lee')]);
ok(hours(r1.slots, 1) === 8.5 && hours(r1.slots, 2) === 0 && r1.slots[16] === 1 && r1.slots[23] === 1 && r1.slots[24] === 0 && r1.slots[28] === 1 && r1.slots[40] === 1 && r1.slots[47] === 1 && r1.watches === 2 && r1.lines === 1, `08–12 and 20–24 from handovers + 14:00 from her log line, all Active: ${hours(r1.slots, 1)} h`);
const r2 = slotsFromRecords('Ann Lee', '2026-11-11', ho2, []);
ok(hours(r2.slots, 'all') === 0, 'a watch ending at midnight adds nothing to the next day');
const tz = [hc('2026-11-12T22:00', 'Bob Day', 'Ann Lee', { shipOffset: '+02:00' }), hc('2026-11-13T02:00', 'Ann Lee', 'Bob Day', { shipOffset: '+02:00' })];
const r3a = slotsFromRecords('Ann Lee', '2026-11-12', tz, []), r3b = slotsFromRecords('Ann Lee', '2026-11-13', tz, []);
ok(hours(r3a.slots, 'all') === 0 && hours(r3b.slots, 1) === 4 && r3b.slots[0] === 1 && r3b.slots[7] === 1 && r3b.slots[8] === 0, 'ship\'s time: 22:00–02:00 UTC at +02:00 is 00:00–04:00 on the 13th');
const r4 = slotsFromRecords('Ann Lee', '2026-11-10', [hc('2026-11-10T08:00', 'Bob Day', 'Ann Lee')], [ll('2026-11-10', '09:00', 'Ann Lee'), ll('2026-11-10', '11:40', 'Ann Lee')]);
ok(hours(r4.slots, 1) === 4 && r4.slots[23] === 1 && r4.slots[24] === 0, 'no handover back: the watch runs to her last log line');
const r5 = slotsFromRecords('Ann Lee', '2026-11-10', [hc('2026-11-10T12:00', 'Ann Lee', 'Bob Day')], [ll('2026-11-10', '08:15', 'Ann Lee')]);
ok(hours(r5.slots, 1) === 4 && r5.slots[16] === 1, 'no takeover on record: from her first log line to the handover');
const r6 = slotsFromRecords('Ann Lee', '2026-11-10', [hc('2026-11-10T08:00', 'Bob Day', 'Ann Lee', { book: 'bridge', templateId: 'bridge.handover' })], []);
ok(hours(r6.slots, 'all') === 0, 'a bridge watch handover is not DP time');

// DP status from the deck log / DP log bounds the time: set-up counts, off DP does not; before the first event nothing is cut.
const ev = (time: string, event: 'setup' | 'ready' | 'on' | 'off', date = '2026-11-10') => ({ date, time, event });
const offs = offDpSpans([ev('10:00', 'off'), ev('21:00', 'setup'), ev('21:40', 'ready'), ev('22:00', 'on')]);
ok(offs.length === 1 && offs[0][0] === Date.parse('2026-11-10T10:00:00Z') && offs[0][1] === Date.parse('2026-11-10T21:00:00Z'), 'off from "off DP" to the next set-up start (set-up counts)');
const r7 = slotsFromRecords('Ann Lee', '2026-11-10', ho2, [ll('2026-11-10', '14:10', 'Ann Lee')], [ev('10:00', 'off'), ev('21:00', 'setup')]);
ok(hours(r7.slots, 1) === 5 && r7.slots[19] === 1 && r7.slots[20] === 0 && r7.slots[28] === 0 && r7.slots[41] === 0 && r7.slots[42] === 1 && r7.cut === 7, `08–10 and 21–24 kept, 10–12, 14:00 and 20–21 cut: ${hours(r7.slots, 1)} h, cut ${r7.cut}`);
const r8 = slotsFromRecords('Ann Lee', '2026-11-10', ho2, [], [ev('09:10', 'off')]);
ok(r8.slots[18] === 1 && r8.slots[19] === 0 && r8.slots[16] === 1, 'the half-hour the vessel came off DP still counts');
const r9 = slotsFromRecords('Ann Lee', '2026-11-10', ho2, [], [ev('20:00', 'on', '2026-11-11')]);
ok(hours(r9.slots, 1) === 8 && r9.cut === 0, 'before the first DP status nothing is cut');
const dc = dpCheckDeckEntry({ ...hc('2026-11-10T08:00', 'Bob Day', 'Ann Lee', { shipOffset: '+02:00', asog: 'green', id: 'dpc1' }) });
ok(dc.id === 'dl-dpc-dpc1' && dc.date === '2026-11-10' && dc.time === '10:00' && dc.dpCheckRef === 'dpc1' && dc.remarks!.includes('"DP watch handover / takeover"') && dc.remarks!.includes('Handing over: Bob Day; Taking over: Ann Lee') && dc.remarks!.includes('ASOG Green') && !Object.values(dc).includes(undefined), `deck log line for a signed DP checklist: ${dc.remarks}`);
const de = dpEventDeckEntry({ ...ll('2026-11-10', '21:00', 'Ann Lee'), id: 'e1', event: 'setup' }, 'DPO');
ok(de.id === 'dl-dpe-e1' && de.dpEvent === 'setup' && de.time === '21:00' && de.remarks === "DP set-up started at 21:00 ship's time — Ann Lee" && de.byRank === 'DPO', 'deck log line for a DP status change');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
