// npm run check:gaplan — the ship's plan: decks, points, colours, numbering, the paper, rules, sync and words.
import { clampPos, defectStatus, itemStatus, liveSheets, markRows, nextOrder, obsStatus, pinFor, placePin, sheetMarks, sheetProblem, usedStatuses, yardStatus, ALL_MARKS } from '../services/gaPlan';
import { gaPinId } from '../types/gaPlan';
import { en } from '../constants/i18n/en';
import { MODULES } from '../constants/modules';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

// Decks.
const S = (id: string, order: number, o: any = {}): any => ({ id, name: id, order, photos: [{ id: 'p', kind: 'photo', uri: 'x.jpg', addedAt: 1 }], w: 2000, h: 500, by: 'A', at: 1, updatedAt: 1, ...o });
const sheets = [S('tank', 3), S('main', 1), S('upper', 2), S('old', 0, { removed: { by: 'A', at: 2 } })];
ok(liveSheets(sheets).map((s) => s.id).join() === 'main,upper,tank', 'decks in their order, a removed one gone');
ok(nextOrder(sheets) === 4, 'a new deck goes last');
ok(sheetProblem(S('a', 1)) === null && sheetProblem(S(' ', 1, { name: ' ' })) === 'name' && sheetProblem(S('a', 1, { photos: [] })) === 'image' && sheetProblem(S('a', 1, { w: 0 })) === 'image', 'a deck needs a name and a picture with its size');
ok(sheetProblem(S('a', 1, { photos: [{ id: 'd', kind: 'document', uri: 'x.pdf', addedAt: 1 }] })) === 'image', '…a picture, not a PDF');

// Points.
ok(clampPos(-0.2) === 0 && clampPos(1.4) === 1 && clampPos(0.123456) === 0.1235 && clampPos(NaN) === 0.5, 'a tap stays inside the picture');
ok(gaPinId('defect', 'd1') === 'defect_d1' && gaPinId('yard', 'a/b') === 'yard_a_b', 'one point per record, a safe id');
const p1 = placePin(undefined, 'defect', 'd1', 'main', 0.2, 0.3, 'Bob', 10);
const p2 = placePin(p1, 'defect', 'd1', 'upper', 0.5, 1.2, 'Ann', 20);
ok(p2.id === p1.id && p2.at === 10 && p2.updatedAt === 20 && p2.sheetId === 'upper' && p2.y === 1, 'moving keeps the point (same id, first placed), only where changes');
const off = { ...p2, removed: { by: 'Ann', at: 30 } };
ok(!pinFor([off], 'defect', 'd1') && !!pinFor([p2], 'defect', 'd1'), 'a point taken off is not on the plan');
ok(placePin(off, 'defect', 'd1', 'main', 0.1, 0.1, 'Bob', 40).at === 40 && !('removed' in placePin(off, 'defect', 'd1', 'main', 0.1, 0.1, 'Bob', 40)), '…and put back is a new placing');

// Colours.
const D = (id: string, o: any = {}): any => ({ id, machineId: 'm', machineName: 'ME', category: 'operational', description: `defect ${id}`, date: '2026-11-0' + id.slice(-1), by: 'Bob', at: 1, updatedAt: 1, ...o });
const J = (id: string, no: number, o: any = {}): any => ({ id, projectId: 'pr1', no, title: `job ${id}`, dept: 'deck', by: 'yard', createdBy: 'A', at: 1, updatedAt: 1, ...o });
ok(defectStatus(D('d1')) === 'open' && defectStatus(D('d1', { awaitingSpares: { since: '2026-11-01' } })) === 'waiting' && defectStatus(D('d1', { closed: { date: 'x', note: 'n', by: 'b', at: 1 } })) === 'closed', 'defect: open red, waiting for spares amber, closed green');
ok(yardStatus(J('j', 1)) === 'planned' && yardStatus(J('j', 1, { startedOn: 'x' })) === 'waiting' && yardStatus(J('j', 1, { startedOn: 'x', doneOn: 'y' })) === 'done' && yardStatus(J('j', 1, { accepted: {} })) === 'closed' && yardStatus(J('j', 1, { cancelled: {} })) === null, 'yard job: planned, in progress, done, accepted; cancelled is not drawn');

// Numbering and filters.
const defects = [D('d3'), D('d1'), D('d2', { closed: { date: 'x', note: 'n', by: 'b', at: 1 } })];
const jobs = [J('j2', 2), J('j1', 1, { startedOn: 'x' }), J('j9', 9, { cancelled: {} }), J('jx', 3, { projectId: 'pr2' })];
const pins = [
  placePin(undefined, 'yard', 'j2', 'main', 0.5, 0.5, 'A', 1), placePin(undefined, 'defect', 'd3', 'main', 0.1, 0.1, 'A', 1), placePin(undefined, 'defect', 'd1', 'main', 0.2, 0.2, 'A', 1),
  placePin(undefined, 'defect', 'd2', 'main', 0.3, 0.3, 'A', 1), placePin(undefined, 'yard', 'j1', 'main', 0.4, 0.4, 'A', 1), placePin(undefined, 'yard', 'j9', 'main', 0.6, 0.6, 'A', 1),
  placePin(undefined, 'yard', 'jx', 'main', 0.7, 0.7, 'A', 1), placePin(undefined, 'defect', 'd1x', 'main', 0.8, 0.8, 'A', 1), placePin(undefined, 'defect', 'd3', 'upper', 0.1, 0.1, 'A', 1),
];
// d3 is on main AND upper above — the later (upper) id is the same, so in real data only one exists; drop the duplicate.
const real = pins.filter((p, i) => pins.findIndex((q) => q.id === p.id) === i);
const pd = (id: string) => (id === 'pr1' ? '2026-12-01' : '2026-06-01');
const src = { defects, jobs, projectDate: pd };
const all = sheetMarks('main', real, src, ALL_MARKS);
ok(all.map((m) => `${m.n}:${m.pin.ref}`).join() === '1:d1,2:d2,3:d3,4:jx,5:j1,6:j2', 'numbered: defects by date, then yard jobs by period and number; cancelled and missing records left out');
ok(sheetMarks('main', real, src, { kinds: ['defect', 'yard'], closed: false }).map((m) => m.pin.ref).join() === 'd1,d3,jx,j1,j2', 'open only: the closed defect drops, the numbers close up');
ok(sheetMarks('main', real, src, { kinds: ['yard'], closed: true, projectId: 'pr1' }).map((m) => `${m.n}:${m.pin.ref}`).join() === '1:j1,2:j2', 'one yard period\'s jobs');
ok(sheetMarks('main', real, src, { kinds: ['defect'], closed: true }).every((m) => m.pin.kind === 'defect'), 'defects only');
ok(sheetMarks('upper', real, src, ALL_MARKS).length === 0, 'a deck shows only its own points');
ok(sheetMarks('main', real.map((p) => (p.ref === 'd1' ? { ...p, removed: { by: 'A', at: 2 } } : p)), src, ALL_MARKS).every((m) => m.pin.ref !== 'd1'), 'a point taken off is not drawn');

// Gear and observation cards (15 Nov 2026).
const I = (id: string, cat: string, name: string, status: any, o: any = {}): any => ({ id, category: cat, cat, group: 'FFE', name, place: 'Galley', due: '2027-01-01', status, ...o });
const items = [I('e2', 'Fire extinguishers', 'No. 12', 'ok'), I('e1', 'Fire extinguishers', 'No. 2', 'expired'), I('l1', 'Lifebuoys', 'No. 1', 'none', { group: 'LSA' })];
const O = (id: string, o: any = {}): any => ({ id, date: '2026-11-1' + id.slice(-1), kind: 'unsafe_condition', topic: 'Fire safety', location: 'Galley', what: `card ${id}`, at: 1, updatedAt: 1, ...o });
const obs = [O('o2'), O('o1', { reviewedAt: 5 })];
ok(itemStatus(items[0]) === 'ok' && itemStatus(items[1]) === 'expired' && itemStatus(items[2]) === 'nodate' && itemStatus({ status: 'due' }) === 'due', 'gear: expired red, due amber, in date green, no date grey');
ok(obsStatus(obs[0]) === 'open' && obsStatus(obs[1]) === 'closed', 'a card is open until reviewed');
const gpins = [...['e2', 'e1', 'l1', 'gone'].map((r) => placePin(undefined, 'equip', r, 'main', 0.5, 0.5, 'A', 1)), ...['o2', 'o1'].map((r) => placePin(undefined, 'obs', r, 'main', 0.5, 0.5, 'A', 1))];
const src2 = { ...src, items, obs };
const every = sheetMarks('main', [...real, ...gpins], src2, ALL_MARKS);
ok(every.map((m) => m.pin.ref).join() === 'd1,d2,d3,jx,j1,j2,e1,e2,l1,o1,o2', 'numbered: work first, then gear by category and number (No. 2 before No. 12), then cards by date; a missing item left out');
ok(sheetMarks('main', [...real, ...gpins], src2, { kinds: ['equip', 'obs'], closed: false }).map((m) => m.pin.ref).join() === 'e1,e2,l1,o2', 'open only: gear stays whatever its date, the reviewed card drops');
ok(sheetMarks('main', gpins, src2, { kinds: ['equip'], closed: true, category: 'Lifebuoys' }).map((m) => `${m.n}:${m.pin.ref}`).join() === '1:l1', 'one category of gear');
ok(sheetMarks('main', gpins, { defects, jobs }, ALL_MARKS).length === 0, 'without the registers, no gear or cards are drawn');
ok(usedStatuses(sheetMarks('main', gpins, src2, ALL_MARKS)).join() === 'open,closed,expired,ok,nodate', 'the legend lists only the colours on the deck');
const grow = markRows(sheetMarks('main', gpins, src2, ALL_MARKS));
ok(grow[0].join('|') === '1|FFE|No. 2|Fire extinguishers · Galley|01.01.2027|Expired' && grow[3].join('|') === '4|Observation|card o1|Unsafe condition · Fire safety · Galley|11.11.2026|Closed', 'gear and cards in the table: group, what, category and place, next date; kind, topic and place');

// Paper.
const rows = markRows(all);
ok(rows[0].join('|') === '1|Defect|defect d1|ME|01.11.2026|Open' && rows[5].join('|') === '6|Yard 002|job j2||01.12.2026|Planned', 'the table under the picture: number, record, what, machine, date, status');

// Rules, sync, wiring.
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/ga_sheets\/\{id\}[\s\S]{0,400}allow delete: if false/.test(rules) && /match \/ga_pins\/\{id\}[\s\S]{0,700}allow delete: if false/.test(rules), 'rules: decks and points, never deleted');
ok(/ga_pins[\s\S]{0,300}kind \+ '_' \+ request\.resource\.data\.ref/.test(rules), 'rules: one point per record (the id is the record)');
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'ga_sheets'.*module: 'gaPlan'/.test(fb) && /sub: 'ga_pins'.*module: 'gaPlan'/.test(fb), 'synced with the module');
ok(MODULES.gaPlan === false, 'flag gaPlan off in this build');
const idx = readFileSync('index.tsx', 'utf8');
ok(/GaPlan: \['gaPlan'\]/.test(idx) && /name="GaPlan" component=\{gated\('GaPlan'/.test(idx), 'screen gated by the module (a link with it off goes nowhere)');
const bk = readFileSync('services/backup.ts', 'utf8');
ok(/GA_SHEETS_KEY/.test(bk) && /GA_PINS_KEY/.test(bk), 'in the backup');
const st = readFileSync('services/storage.ts', 'utf8');
ok(/    GA_SHEETS_KEY,\n    GA_PINS_KEY,/.test(st), 'wiped with the rest on reset');

ok(/<PlanPinLink kind="equip"/.test(readFileSync('screens/ItemDetailSc.tsx', 'utf8')) && /<PlanPinLink kind="obs"/.test(readFileSync('screens/SafetySc.tsx', 'utf8')), 'an item and a card can be put on the plan');

// Words.
const files = ['screens/GaPlanSc.tsx', 'components/PlanPinLink.tsx', 'screens/YardProjectSc.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
const used = [...files.matchAll(/\bt\('(ga\.[\w.]+)'/g)].map((m) => m[1]);
const missing = [...new Set(used)].filter((k) => !(k in en));
ok(!missing.length, `every word in English${missing.length ? `: missing ${missing.join(', ')}` : ''}`);
const dyn = ['ga.need.name', 'ga.need.image', ...['defect', 'yard', 'equip', 'obs'].map((k) => `ga.kinds.${k}`), 'ga.kind.defect', 'ga.kind.obs', ...['open', 'waiting', 'done', 'closed', 'planned', 'expired', 'due', 'ok', 'nodate'].map((s) => `ga.st.${s}`)];
ok(dyn.every((k) => k in en), 'the words built from a value too');
const manual = readFileSync('constants/manual.ts', 'utf8');
ok(/title: "Ship's plan \(GA\)"/.test(manual) && /\{ title: "Ship's plan \(GA\)", module: 'gaPlan' \}/.test(manual), 'the manual has the section, gone with the module');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
