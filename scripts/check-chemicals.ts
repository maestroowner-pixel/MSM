// npm run check:chem — the SDS the AI read, put onto a card; what a card is missing; a risk assessment from the card; the Board; rules, sync and words.
import { applySds, chemBoard, chemHazards, chemIssues, chemMatches, chemRaTitle, raFor, readSds, sdsChanged, sdsReviewBy, sortChems, stockLine } from '../services/chemicals';
import { buildBoard } from '../services/board';
import { en } from '../constants/i18n/en';
import { CHEM_USES, GHS } from '../types/chemicals';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const C = (o: any = {}): any => ({ id: 'c1', name: 'Pool chlorine', use: 'pool', stock: [{ place: 'Pool room', qty: 10, unit: 'kg' }], createdAt: 1, updatedAt: 1, ...o });
const SDS = { url: 'https://x/sds.pdf', name: 'sds.pdf', addedAt: 1 };
const RA = (o: any = {}): any => ({ id: 'ra1', title: 'x', hazards: [], generic: false, chemId: 'c1', createdAt: 1, updatedAt: 1, ...o });
const signed = { by: 'Anna', at: 5 };

// The AI's reply as the card takes it.
const r = readSds({
  name: ' HTH  Pool Chlorine ', maker: 'Arch', use: 'pool', date: '2023-02-14', lang: 'Spanish', signal: 'DANGER',
  ghs: ['GHS05', 'ghs 3', 'GHS5', 'GHS10', 'flame'], hazards: ['H272 May intensify fire; oxidiser', 'H302 Harmful if swallowed', 'H272 May intensify fire; oxidiser', ''],
  ppe: 'Nitrile gloves, goggles', firstAid: { eyes: 'Rinse 15 min', skin: '', inhaled: 'Fresh air' }, fire: 'Water spray; no dry chemical', spill: 'Sweep up, keep dry',
  storage: 'Cool, dry, apart from acids', incompatible: 'Acids, ammonia', un: 'UN 2880', unreadable: '',
});
ok(r.isSds && r.name === 'HTH Pool Chlorine' && r.maker === 'Arch', 'name and maker read, spaces cleaned');
ok(JSON.stringify(r.fields.ghs) === '["GHS03","GHS05"]', 'pictograms: only the nine, "GHS5"/"ghs 3" made right, doubles and unknowns dropped');
ok(r.fields.signal === 'danger' && r.fields.sdsDate === '2023-02-14' && r.fields.sdsLang === 'Spanish', 'signal word, date and language');
ok(r.fields.hazards?.length === 2, 'hazard statements: doubles and empties dropped');
ok(r.fields.un === '2880', 'UN number: digits only');
ok(r.fields.firstAid?.eyes === 'Rinse 15 min' && !('skin' in (r.fields.firstAid ?? {})), 'first aid: empty parts left out');
ok(!readSds({ date: '2023-02-30' }).fields.sdsDate && !readSds({ date: '14.02.2023' }).fields.sdsDate, 'a date that is not a real yyyy-mm-dd is not taken');
ok(!readSds({ signal: 'caution' }).fields.signal, 'a signal word other than danger/warning is not taken');
ok(readSds({ isSds: false }).isSds === false && readSds({}).isSds === true, 'not an SDS is said so');

// Onto the card.
const before = C({ name: '', ppe: 'Old gloves', fire: 'Old advice', hazards: ['H999 old'], checked: signed, sds: SDS });
const after = applySds(before, r);
ok(after.name === 'HTH Pool Chlorine', 'an empty name takes the SDS name');
ok(applySds(C({ name: 'Chlorine granules' }), r).name === 'Chlorine granules', '…a name the crew gave stays');
ok(applySds(C({ use: 'cleaning' }), r, true).use === 'pool' && applySds(C({ use: 'cleaning' }), r).use === 'cleaning', 'the use the AI saw: only on a new card');
ok(!readSds({ use: 'spaceship' }).use, '…and only one of ours');
ok(after.ppe === 'Nitrile gloves, goggles' && after.hazards?.length === 2, 'the SDS replaces what the card said');
ok(!applySds(before, readSds({ ppe: 'Gloves' })).fire, '…an old sheet\'s advice does not survive a new one');
ok(after.byAi === true && !after.checked, 'the card waits for a check');
ok(after.stock.length === 1 && after.sds?.url === SDS.url, 'where it is kept and the file stay');
ok(sdsChanged(C({ sds: SDS, ppe: 'a' }), C({ sds: SDS, ppe: 'b' })), 'a changed PPE line breaks the check');
ok(sdsChanged(C({ sds: SDS }), C({ sds: { ...SDS, url: 'https://x/new.pdf' } })), '…a new file too');
ok(!sdsChanged(C({ sds: SDS, notes: 'a' }), C({ sds: SDS, notes: 'b', stock: [] })), '…notes and stock do not');

// What a card is missing.
const today = '2026-11-07';
ok(sdsReviewBy('2021-11-06') === '2026-11-06', 'five years on');
ok(JSON.stringify(chemIssues(C(), [], today, true)) === '["noSds"]', 'no SDS');
ok(chemIssues(C({ sds: SDS, sdsDate: '2021-11-06', checked: signed }), [], today, true).join() === 'oldSds', 'SDS over five years old');
ok(chemIssues(C({ sds: SDS, sdsDate: '2021-11-07', checked: signed }), [], today, true).length === 0, '…exactly five years is still in date');
ok(chemIssues(C({ sds: SDS, checked: signed }), [], today, true).length === 0, 'an undated SDS is not called old');
ok(chemIssues(C({ sds: SDS, checked: signed, signal: 'warning' }), [], today, true).join() === 'noRa', 'a WARNING product without an assessment');
ok(chemIssues(C({ sds: SDS, checked: signed, signal: 'warning' }), [], today, false).length === 0, '…not asked without permits');
ok(chemIssues(C({ sds: SDS, checked: signed, signal: 'danger' }), [RA()], today, true).join() === 'noRa', '…an assessment not approved does not count');
ok(chemIssues(C({ sds: SDS, checked: signed, signal: 'danger' }), [RA({ approved: signed })], today, true).length === 0, '…an approved one does');
ok(chemIssues(C({ sds: SDS, checked: signed, signal: 'danger' }), [RA({ approved: signed, chemId: 'other' })], today, true).join() === 'noRa', '…another product\'s does not');
ok(chemIssues(C({ sds: SDS }), [], today, true).join() === 'unchecked', 'an SDS not checked');
ok(raFor(C(), [RA({ id: 'a', updatedAt: 9 }), RA({ id: 'b', approved: signed, updatedAt: 2 })])?.id === 'b', 'the approved assessment first');
const b = chemBoard([C(), C({ id: 'c2', deleted: true }), C({ id: 'c3', sds: SDS })], [], today, true);
ok(b.noSds.length === 1 && b.unchecked.length === 1, 'counts leave out what was taken off');

// Order and search.
const list = sortChems([C({ id: 'a', name: 'Zinc' }), C({ id: 'b', name: 'Acetone', signal: 'warning' }), C({ id: 'c', name: 'Bleach', signal: 'danger' }), C({ id: 'd', name: 'Off', deleted: true })]);
ok(list.map((c) => c.name).join() === 'Bleach,Acetone,Zinc', 'DANGER, then WARNING, then the rest; nothing taken off');
ok(chemMatches(C({ hazards: ['H272 x'] }), 'h272') && chemMatches(C(), 'POOL ROOM') && chemMatches(C({ un: '2880' }), '2880') && !chemMatches(C(), 'acetone'), 'search by code, place, UN');
ok(chemMatches(C({ name: 'Désinfectant' }), 'desinf'), '…accents do not matter');
ok(stockLine({ place: 'Pool room', qty: 10, unit: 'kg' }) === 'Pool room — 10 kg' && stockLine({ place: 'Bosun store' }) === 'Bosun store', 'a stock line');

// A risk assessment from the card.
const card = applySds(C({ name: 'Pool chlorine' }), r);
const hz = chemHazards(card, false);
ok(hz.some((h) => /Corrosive/.test(h.hazard)) && hz.some((h) => /Oxidiser/.test(h.hazard)), 'hazards from the pictograms');
ok(hz.find((h) => /Corrosive/.test(h.hazard))!.controls!.includes('Nitrile gloves'), '…the card\'s PPE as the control');
ok(hz.find((h) => /Oxidiser/.test(h.hazard))!.controls!.includes('Acids, ammonia'), '…what to keep it from');
ok(!hz.some((h) => /incompatible/.test(h.hazard)), '…no second line for incompatibles when the oxidiser line has them');
ok(hz.every((h) => h.likelihood && h.severity && h.residualLikelihood && h.residualSeverity), 'every hazard rated before and after');
ok(!chemHazards(card, true).some((h) => /closed space/.test(h.hazard)), 'enclosed: no vapour line for a product without one');
const solvent = C({ name: 'Thinner', ghs: ['GHS02', 'GHS07'], ppe: 'Gloves' });
ok(chemHazards(solvent, true).some((h) => /closed space/.test(h.hazard)), 'enclosed: a flammable solvent gets the vapour line');
ok(!chemHazards(solvent, false).some((h) => /closed space/.test(h.hazard)), '…on deck it does not');
ok(chemHazards(C({ ghs: ['GHS06', 'GHS07'] }), false).filter((h) => /Irritation/.test(h.hazard)).length === 0, 'toxic covers irritant');
ok(chemHazards(C(), false).length === 1, 'a product with no pictograms still gets one line');
const tt = chemRaTitle(card, true);
ok(tt.title === 'Pool chlorine — use in an enclosed space' && tt.task.includes('H272') && tt.location === 'Pool room', 'the title, task and place');

// The Board.
const base: any = {
  on: (k: string) => ['chem', 'ptw'].includes(k), role: 'admin', me: null, today, now: `${today}T10:00`, labelOf: String, periodsOf: () => [],
  flat: [], certificates: [], inspections: [], crew: [], crewPrivate: [], machines: [], pmsJobs: [], spares: [], spareMoves: [], docs: [], docAcks: [], permits: [],
  fuelTanks: [], fuelReadings: [], fuelBunkers: [], fuelDailySent: [], garbage: [], garbageSigns: [], sopepItems: [], sopepChecks: [], sopepDrills: [],
  visitors: [], securityLevels: [], securityDrills: [], crewMoves: [], surveys: [], surveysDone: [], observations: [],
  chemicals: [C(), C({ id: 'c2', name: 'Acetone', sds: SDS, signal: 'warning' })], risks: [],
};
const all = (x: any = {}) => buildBoard({ ...base, ...x }).attention.filter((n: any) => n.key.startsWith('chem:'));
const keys = (x: any = {}) => all(x).map((n: any) => n.key).sort().join();
ok(keys() === 'chem:noRa,chem:noSds,chem:unchecked', 'Board: no SDS, no assessment, not checked');
ok(all().find((n: any) => n.key === 'chem:noSds')?.level === 'amber' && (all()[0].params as any)?.tab === 'chem', '…amber, opens the chemicals');
ok(all().find((n: any) => n.key === 'chem:noSds')?.sub === 'Pool chlorine', '…names the product');
ok(!keys({ role: 'user' }), '…not on a crew device');
ok(!keys({ on: (k: string) => k === 'ptw' }), '…not with the flag off');

// The words the screens build from keys.
const has = (k: string) => k in en;
ok(CHEM_USES.every((u) => has(`chem.use.${u}`)) && GHS.every((g) => has(`chem.ghs.${g}`)), 'every use and pictogram has its words');
ok(['noSds', 'oldSds', 'noRa', 'unchecked'].every((i) => has(`chem.issue.${i}`)) && ['danger', 'warning', 'none'].every((s) => has(`chem.signal.${s}`)) && ['eyes', 'skin', 'inhaled', 'swallowed'].every((k) => has(`chem.fa.${k}`)), '…every issue, signal word and first-aid part');

// English on paper; rules, sync, the AI.
const src = readFileSync('services/chemicalsReport.ts', 'utf8');
ok(!/\bt\(|\btk\(/.test(src), 'the report does not use t()');
const widths = /widths: \{([^}]+)\}/.exec(src)![1].split(',').map((p) => Number(p.split(':')[1]));
ok(widths.length === 11 && widths.reduce((a, x) => a + x, 0) === 277, 'the PDF table: a width for every column, the page\'s 277 mm');
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/chemicals\/\{id\}[\s\S]{0,400}isAdmin\(v\)[\s\S]{0,200}https/.test(rules), 'rules: officers write, the SDS only as a link');
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'chemicals', key: storage.CHEMICALS_KEY, module: 'chem'/.test(fb), 'the list syncs with the module');
const ai = readFileSync('functions/ai.js', 'utf8');
ok(/async sds\(key, d\)/.test(ai) && /sds: \d+/.test(ai), 'functions/ai.js has the sds task and its allowance');
ok(/'sds'/.test(readFileSync('services/ai.ts', 'utf8')), 'the app may call it');

console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
process.exit(fail ? 1 : 0);
