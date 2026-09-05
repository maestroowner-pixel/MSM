/*
 * Sanity checks for the inspection audit trail.
 *
 * These cover the parts whose correctness is not a matter of taste: that a
 * signed record freezes its outcome and its signature, that a rectification
 * never rewrites the inspection it closes, and that merging two devices is a
 * union rather than last-writer-wins. Get those wrong and the trail is worthless
 * as evidence — which is not something a typecheck can tell you.
 *
 * Deliberately dependency-free (no jest in this project) and pure: it imports
 * only domain modules, no React Native, Expo or Firebase.
 *
 *   npm run check:inspections
 */
import { create, closeDefect, mergeInspections, mergeCrew, roundStatus, monthWindow, weekWindow, forItem, openDefects, failedLines } from '../services/inspections';
import { templateFor, periodsFor, templateById } from '../constants/checklists';
import { CHECKLISTS } from '../constants/checklists';
import { EquipmentItem } from '../types/equipment';
import { Inspection } from '../types/inspection';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const ext: EquipmentItem = { id: 'x1', category: 'fire_extinguishers', type: 'CO2 5kg', serial: 'FE-42', position: 'Bridge', updatedAt: 0 };
const tpl = templateFor('fire_extinguishers', 'monthly');

// --- template registry ---
ok('every template id is unique', new Set(CHECKLISTS.map(c => c.id)).size === CHECKLISTS.length);
ok('line ids unique within each template',
   CHECKLISTS.every(c => new Set(c.lines.map(l => l.id)).size === c.lines.length),
   CHECKLISTS.filter(c => new Set(c.lines.map(l=>l.id)).size !== c.lines.length).map(c=>c.id).join(','));
ok('templateById round-trips a real template', templateById(tpl.id)?.id === tpl.id);
ok('templateById rebuilds a generic id', templateById('mob.monthly.generic')?.lines.length === 5);
ok('unknown template id returns null', templateById('nope.monthly') === null);
ok('every category offers at least monthly', periodsFor('sopep').includes('monthly'));
ok('hydrants offer weekly and monthly', periodsFor('hydrants_fireboxes').join() === 'weekly,monthly');

// --- create: outcome + defect derivation ---
const allPass = Object.fromEntries(tpl.lines.map(l => [l.id, 'pass' as const]));
const p = create({ item: ext, template: tpl, results: allPass, by: 'Jez Dodd', byRank: 'Third Officer' });
ok('all pass -> outcome pass', p.outcome === 'pass');
ok('all pass -> no defect', p.defect === undefined);
ok('signature snapshot stored', p.by === 'Jez Dodd' && p.byRank === 'Third Officer');
ok('exact time stamped', typeof p.at === 'number' && Math.abs(Date.now() - p.at) < 5000);
ok('template version frozen on record', p.templateVersion === tpl.version);

const oneFail = { ...allPass, pressure: 'fail' as const };
const f = create({ item: ext, template: tpl, results: oneFail, by: 'Jez Dodd' });
ok('one fail -> outcome fail', f.outcome === 'fail');
ok('fail raises an open defect', !!f.defect && f.defect.open);
ok('default defect note names the failed line',
   !!f.defect && f.defect.note.includes('Pressure gauge reading in the green'), f.defect?.note);
ok('failedLines reads back the wording', failedLines(f)[0] === 'Pressure gauge reading in the green');

const naOnly = { ...allPass, service: 'na' as const };
ok('n/a never fails', create({ item: ext, template: tpl, results: naOnly, by: 'X' }).outcome === 'pass');

// A hand-written defect on an otherwise clean round still raises one.
const w = create({ item: ext, template: tpl, results: allPass, by: 'X', defectNote: 'Bracket corroded' });
ok('written-up defect on a pass is kept open', !!w.defect && w.defect.open && w.defect.note === 'Bracket corroded');
ok('written-up defect does not force a FAIL outcome', w.outcome === 'pass');

// --- closing a defect ---
const closed = closeDefect(f, 'Bosun', 'Recharged and re-sealed');
ok('close marks it closed', closed.defect!.open === false);
ok('close is signed and stamped', closed.defect!.closedBy === 'Bosun' && !!closed.defect!.closedAt);
ok('close does not touch the original signature', closed.by === f.by && closed.at === f.at);
ok('close does not alter the results', JSON.stringify(closed.results) === JSON.stringify(f.results));

// --- windows / round status ---
const now = new Date();
const mw = monthWindow(now);
ok('month window contains now', now.getTime() >= mw.from && now.getTime() < mw.to);
const ww = weekWindow(now);
ok('week window is exactly 7 days', Math.round((ww.to - ww.from) / 86400000) === 7);
ok('week window starts on a Monday', new Date(ww.from).getDay() === 1);

const trail: Inspection[] = [p, f];
ok('roundStatus done for an item inspected this month', roundStatus(trail, 'x1', 'monthly') === 'done');
ok('roundStatus never for an untouched item', roundStatus(trail, 'zz', 'monthly') === 'never');
const lastMonth = create({ item: ext, template: tpl, results: allPass, by: 'X', at: mw.from - 86400000 });
ok('roundStatus overdue when the last one fell in a previous window',
   roundStatus([lastMonth], 'x1', 'monthly') === 'overdue');

// --- queries ---
ok('forItem returns newest first', forItem(trail, 'x1')[0].at >= forItem(trail, 'x1')[1].at);
ok('openDefects finds the failure', openDefects(trail).length === 1);
ok('openDefects drops a rectified one', openDefects([p, closed]).length === 0);

// --- merge (the multi-device case the client asked about) ---
const deviceA = [p, f];
const deviceB = [create({ item: ext, template: tpl, results: allPass, by: 'Second Officer' })];
const merged = mergeInspections(deviceA, deviceB);
ok('merge keeps every record from both devices', merged.length === 3);
ok('merge is a union, not last-writer-wins',
   merged.some(m => m.by === 'Second Officer') && merged.some(m => m.by === 'Jez Dodd'));
ok('merge is idempotent', mergeInspections(merged, merged).length === 3);
ok('merge is order-independent',
   mergeInspections(deviceB, deviceA).length === mergeInspections(deviceA, deviceB).length);
// A defect closed on one device must win over the still-open copy on the other.
const mergedClose = mergeInspections([f], [closeDefect(f, 'Bosun')]);
ok('a rectification wins over the stale open copy', mergedClose[0].defect!.open === false);
ok('...and not the other way round', mergeInspections([closeDefect(f, 'Bosun')], [f])[0].defect!.open === false);
ok('merge sorts newest first', mergeInspections(deviceA, deviceB).every((x, i, a) => i === 0 || a[i-1].at >= x.at));

const c1 = { id: 'c1', name: 'Jez', active: true, addedAt: 1, updatedAt: 10 };
const c2 = { id: 'c1', name: 'Jez Dodd', rank: 'Third Officer', active: true, addedAt: 1, updatedAt: 20 };
ok('crew merge takes the newer edit', mergeCrew([c1], [c2])[0].name === 'Jez Dodd');
ok('crew merge keeps one row per id', mergeCrew([c1], [c2]).length === 1);

console.log(fails ? `\n${fails} FAILED` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
