// npm run check:crewroll — the crew roll (services/crewRoll.ts, MMC-193 §4.3.1): trips kept on signing on again,
// the three reports with the columns Panama names, five years of history, age, CoC, and the wiring of every sign-on path.
import { ageOn, cocOf, daysAboard, detailsSheets, historyRows, historySheet, onboardSheet, recentlyLeft, signOnAgain, tripsOf } from '../services/crewRoll';
import { planCrewImport } from '../services/crewList';
import { CrewMember, CrewPrivate } from '../types/crew';
import { Certificate } from '../types/certificate';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

const cm = (x: Partial<CrewMember> & { id: string; name: string }): CrewMember => ({ active: true, addedAt: 1, updatedAt: 1, ...x } as CrewMember);
const today = '2026-11-21';

// ---- trips -------------------------------------------------------------------------
const away = cm({ id: 'c1', name: 'Anna Berg', rank: 'Chief Officer', onBoard: false, signOn: '2025-03-01', signOnPort: 'Palma', signOff: '2025-09-30', signOffPort: 'Antibes' });
const back = { ...away, ...signOnAgain(away, '2026-04-10') };
ok(back.onBoard === true && back.signOn === '2026-04-10' && !back.signOff && !back.signOffPort && !back.signOnPort, 'signing on again starts a new trip today, ports cleared');
ok(back.trips?.length === 1 && back.trips[0].on === '2025-03-01' && back.trips[0].onPort === 'Palma' && back.trips[0].off === '2025-09-30' && back.trips[0].offPort === 'Antibes' && back.trips[0].rank === 'Chief Officer', 'the finished trip is kept whole: dates, ports, rank');
const aboard = cm({ id: 'c2', name: 'Tom Hall', rank: 'Deckhand', onBoard: true, signOn: '2026-10-01', signOnPort: 'Barcelona' });
const again = { ...aboard, ...signOnAgain(aboard, '2026-11-21') };
ok(!again.trips && again.signOnPort === 'Barcelona', 'someone still aboard keeps their trip and port — nothing is archived');
const twice = { ...back, onBoard: false, signOff: '2026-08-01', signOffPort: 'Barcelona' };
const third = { ...twice, ...signOnAgain(twice, '2026-11-01') };
ok(third.trips?.length === 2 && third.trips[1].on === '2026-04-10' && third.trips[1].off === '2026-08-01', 'a second return keeps both earlier trips, oldest first');
ok(tripsOf(third).length === 3 && !tripsOf(third)[2].off, 'tripsOf: the kept trips and the current one, open while aboard');
ok(tripsOf(twice)[1].offPort === 'Barcelona', 'tripsOf: someone ashore — the current trip closes at the sign-off date and place');
const never = cm({ id: 'c9', name: 'New Hand' });
ok(tripsOf(never).length === 0 && !signOnAgain(never, today).trips, 'no dates at all — no trip is invented');

// ---- age, days, CoC --------------------------------------------------------------
ok(ageOn('1988-11-22', today) === '37' && ageOn('1988-11-21', today) === '38' && ageOn(undefined, today) === '' && ageOn('junk', today) === '', 'age in whole years, the birthday counted on the day');
ok(daysAboard('2026-11-01', undefined, today) === 21 && daysAboard('2026-11-21', '2026-11-21', today) === 1 && daysAboard(undefined, undefined, today) === null, 'days aboard count both ends');
const cert = (id: string, crewId: string, name: string, expiryDate?: string, number?: string): Certificate => ({ id, scope: 'crew', crewId, name, expiryDate, number, itemIds: [], createdAt: 1, updatedAt: 1 });
const certs = [cert('k1', 'c1', 'CoC II/1 OOW <3000 GT', '2028-01-01', 'UK-123'), cert('k2', 'c1', 'ENG1 medical', '2027-01-01'), cert('k3', 'c1', 'Passport', '2030-01-01'), cert('k4', 'c3', 'Master 3000 GT (Yacht)', '2029-05-05'), cert('k5', 'c1', 'STCW II/2 Chief Mate', '2030-02-02')];
ok(cocOf(certs, 'c1') === 'STCW II/2 Chief Mate, exp. 02.02.2030; CoC II/1 OOW <3000 GT, No. UK-123, exp. 01.01.2028', 'CoC: competency certificates only (not medical or passport), latest first, number when held');
ok(cocOf(certs, 'c3').startsWith('Master 3000 GT') && cocOf(certs, 'c2') === '', 'a yacht master’s ticket counts; someone without one prints empty');

// ---- the reports --------------------------------------------------------------------
const crew = [third, aboard, cm({ id: 'c3', name: 'Lee Park', rank: 'Master', onBoard: true, signOn: '2026-09-01', signOnPort: 'Genoa' }), cm({ id: 'c4', name: 'Old Hand', rank: 'Bosun', active: false, onBoard: false, signOn: '2019-01-01', signOff: '2020-06-01' }), cm({ id: 'c5', name: 'Gone Cook', rank: 'Chef', active: false, onBoard: false, signOn: '2022-01-01', signOff: '2022-12-01', signOffPort: 'Palma' }), cm({ id: 'c6', name: 'Removed', deleted: true, onBoard: true, signOn: '2026-01-01' })];
const privates: CrewPrivate[] = [{ id: 'c1', dateOfBirth: '1990-05-01', placeOfBirth: 'Oslo', nationality: 'NO', passportNo: 'P1', passportExpiry: '2031-01-01', nextOfKin: { firstName: 'Ole', lastName: 'Berg', relationship: 'Husband', address: '1 Fjord St, Oslo' }, updatedAt: 1 }];
const input = { crew, privates, certs, today };
const ob = onboardSheet(input);
const obHead = ob.tables[0].head.join('|');
ok(['Full name', 'Position on board', 'Certificate of Competency', 'Place of birth', 'Age', 'Passport No.'].every((h) => obHead.includes(h)), 'onboard list has every column §4.3.1 i names');
ok(ob.tables[0].rows.map((r) => r[1]).join(',') === 'Lee Park,Anna Berg,Tom Hall', 'onboard: aboard only (not retired, ashore or removed), Master first');
ok(ob.tables[0].rows[1][5] === '36' && ob.tables[0].rows[1][4] === 'Oslo' && ob.tables[0].rows[1][7] === 'P1, exp. 01.01.2031', 'onboard: age, place of birth, passport from the private details');
ok(ob.tables[ob.tables.length - 1].title === 'Master', 'onboard: a line for the Master’s signature and stamp');
const det = detailsSheets(input);
ok(det.length === 3, 'details: one page per person aboard');
const anna = det.find((d) => d.title.includes('Anna Berg'))!.tables[0].rows;
const val = (k: string) => anna.find((r) => r[0] === k)?.[1];
ok(['Full name', 'Position on board', 'Certificate of Competency', 'Place of birth', 'Date of birth / age', 'Nationality', 'Passport No.', 'Next of kin — name', 'Next of kin — address', 'Port / place of embarkation', 'Date of embarkation', 'Time on board'].every((k) => anna.some((r) => r[0] === k)), 'details has every item §4.3.1 ii names');
ok(val('Next of kin — name') === 'Ole Berg (Husband)' && val('Next of kin — address') === '1 Fjord St, Oslo' && val('Time on board') === '21 days' && val('Nationality') === 'NO', 'details: next of kin, nationality, time aboard');
ok(detailsSheets({ ...input, crew: [] })[0].facts[0] === 'Nobody on board', 'details with nobody aboard still makes a page');
const hist = historyRows(input);
ok(hist.length === 6, `history: five years of trips (${hist.length}) — Anna ×3, Tom, Lee, the cook; not the bosun who left in 2020, not the removed`);
ok(!hist.some((r) => r.name === 'Old Hand') && hist.some((r) => r.name === 'Gone Cook'), 'history: left before 21.11.2021 is out, a retired crew member inside the five years is in');
const hs = historySheet(input);
const hHead = hs.tables[0].head.join('|');
ok(['Full name', 'Position on board', 'Certificate of Competency', 'Place of birth', 'Age', 'Nationality', 'Passport No.', 'Port and date of embarkation', 'Place and date of landing'].every((h) => hHead.includes(h)), 'history has every column §4.3.1 iii names');
const annaRows = hs.tables[0].rows.filter((r) => r[1] === 'Anna Berg');
ok(annaRows[0][9] === '30.09.2025, Antibes' && annaRows[0][8] === '01.03.2025, Palma' && annaRows[2][9] === 'On board', 'history: embarkation and landing per trip; the current trip reads On board');
ok(annaRows[0][5] === '34', 'history: age at that embarkation, not today');
ok(Object.keys(hs.tables[0].widths!).length === hs.tables[0].head.length && Object.keys(ob.tables[0].widths!).length === ob.tables[0].head.length, 'every column has a width (jsPDF sizes a table to the widths only when all are given)');
ok(!JSON.stringify([ob, det, hs]).match(/[★−]/), 'no characters the web PDF font lacks');
ok(recentlyLeft(cm({ id: 'x', name: 'x', signOff: '2022-01-01' }), today) && !recentlyLeft(cm({ id: 'y', name: 'y', signOff: '2021-01-01' }), today), 'erasing warns within five years of leaving');

// ---- import: someone back from leave ---------------------------------------------
const plan = planCrewImport([{ name: 'Anna Berg', signOn: '2026-12-01', signOnPort: 'Monaco' }], [twice], [], Date.parse('2026-11-21T10:00:00Z'));
const imp = plan.members[0];
ok(imp.signOn === '2026-12-01' && imp.signOnPort === 'Monaco' && imp.trips?.length === 2 && imp.trips[1].off === '2026-08-01' && imp.trips[1].offPort === 'Barcelona', 'importing someone who had left keeps their trip, then the sheet’s dates start the new one');
const plan2 = planCrewImport([{ name: 'Tom Hall', signOn: '2026-10-02' }], [aboard], [], 1);
ok(!plan2.members[0].trips && plan2.members[0].signOn === '2026-10-02', 'importing someone aboard corrects the date, no trip kept');

// ---- wiring ----------------------------------------------------------------------------
const src = (p: string) => readFileSync(`${__dirname}/../../${p}`, 'utf8');
ok(src('screens/CrewMemberSc.tsx').includes('signOnAgain(m, todayIso())') && src('screens/CrewMatrixSc.tsx').includes('signOnAgain(p, todayIso())'), 'both sign-on switches go through signOnAgain');
ok(!/onBoard: true, signOn: todayIso\(\), signOff: undefined/.test(src('screens/CrewMemberSc.tsx') + src('screens/CrewMatrixSc.tsx')), 'no sign-on left that overwrites the trip');
ok(src('screens/CrewSc.tsx').includes('shareCrewRoll'), 'the crew list offers the three reports');
for (const l of ['en', 'ru', 'uk', 'es', 'pt', 'no']) {
  const d = src(`constants/i18n/${l}.ts`);
  ok(['crew.portLand', 'crew.trips', 'crew.eraseRoll', 'crw.roll', 'crw.rollHint', 'crw.roll.onboard', 'crw.roll.details', 'crw.roll.history'].every((k) => d.includes(`"${k}"`)), `${l}: crew roll strings`);
}

console.log(fail ? `\n${fail} FAILED` : '\nall good');
process.exit(fail ? 1 : 0);
