// npm run check:imosigns — IMO signs: the sign of each item, one per place, the round, spares, the order, rules, sync and words.
import { fittedLooks, placeKey, signFor, signNeeds, signOrderLines, signSpots, sparesOf, spareTakes, spotStates } from '../services/imoSigns';
import { IMO_SIGNS, SIGN_MAP } from '../services/imoSignCatalogue';
import { SIGNS_STARTER, wearKept } from '../types/stores';
import { en } from '../constants/i18n/en';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };

// The catalogue.
ok(new Set(IMO_SIGNS.map((s) => s.id)).size === IMO_SIGNS.length, 'every sign id once');
ok(IMO_SIGNS.every((s) => /A\.1116\(30\)|ISO 17631|ISO 7010/.test(s.ref)), 'every sign names its standard');
ok(SIGNS_STARTER.length === IMO_SIGNS.length && SIGNS_STARTER.every((s) => SIGN_MAP[s.signId] && s.min === (SIGN_MAP[s.signId].common ? 2 : 1)), 'the store starts from the catalogue: two of the common, one of the rest');
ok(wearKept('signs'), 'the IMO signs store is counted by wear');

// The sign of an item.
const I = (o: any = {}): any => ({ id: 'x', category: 'x', ...o });
ok(signFor('fire_extinguishers', I()) === 'extinguisher' && signFor('eebd', I()) === 'eebd' && signFor('liferafts', I()) === 'liferaft', 'the plain cases');
ok(signFor('liferafts', I({ type: 'Davit launched 25p' })) === 'davit_liferaft', 'a davit-launched raft');
ok(signFor('lifebuoys', I({ type: 'With light & smoke' })) === 'lifebuoy_smoke' && signFor('lifebuoys', I({ type: 'Self-igniting light' })) === 'lifebuoy_light' && signFor('lifebuoys', I({ remarks: '30 m line' })) === 'lifebuoy_line' && signFor('lifebuoys', I()) === 'lifebuoy', 'a lifebuoy by what it carries');
ok(signFor('lifejackets', I({ size: 'Child' })) === 'child_lifejacket' && signFor('inflatable_lifejackets', I({ type: 'Infant' })) === 'infant_lifejacket' && signFor('lifejackets', I({ size: 'Adult' })) === 'lifejacket', 'a lifejacket by size');
ok(signFor('gmdss_pyro', I({ type: 'EPIRB 406' })) === 'epirb' && signFor('gmdss_pyro', I({ type: 'AIS-SART' })) === 'sart' && signFor('gmdss_pyro', I({ type: 'Rocket parachute flare' })) === 'rocket' && signFor('gmdss_pyro', I({ type: 'Hand flare' })) === 'pyro' && signFor('gmdss_pyro', I({ type: 'Line throwing apparatus' })) === 'line_throwing' && signFor('gmdss_pyro', I({ type: 'GMDSS VHF' })) === 'radio', 'the GMDSS sheet by type');
ok(signFor('gmdss_pyro', I({ type: 'Navtex' })) === null && signFor('plb', I()) === null && signFor('fire_detectors', I()) === null && signFor('fifi_ba', I({ type: 'Spare bottle' })) === null, 'no sign for what is not marked');
ok(signFor('hydrants_fireboxes', I({ type: 'Hydrant' })) === 'hydrant' && signFor('hydrants_fireboxes', I({ type: 'Fire box with hose' })) === 'fire_hose', 'a hydrant or a hose box');

// One sign per place.
const reg: any = {
  fire_extinguishers: [
    I({ id: 'e1', deck: 'Main deck', position: 'Galley' }), I({ id: 'e2', deck: 'main deck ', position: ' galley' }),
    I({ id: 'e3', deck: 'Upper deck', position: 'Bridge' }), I({ id: 'e4', no: 7 }),
  ],
  lifebuoys: [I({ id: 'b1', deck: 'Main deck', position: 'Galley' })],
  plb: [I({ id: 'p1', deck: 'Main deck', position: 'Galley' })],
};
const places: any[] = [
  { id: 'own1', sign: 'escape_left', deck: 'Main deck', position: 'Crew corridor', qty: 3, updatedAt: 1 },
  { id: 'own2', sign: 'no_smoking', deck: 'Main deck', position: 'Old', removed: true, updatedAt: 1 },
  { id: 'h1', hides: placeKey('extinguisher', 'Upper deck', 'Bridge'), updatedAt: 1 },
];
const spots = signSpots(reg, places);
const ext = spots.find((s) => s.key === placeKey('extinguisher', 'Main deck', 'Galley'))!;
ok(!!ext && ext.itemIds.join() === 'e1,e2' && ext.qty === 1, 'two extinguishers in the galley want one sign there (case and spaces do not split it)');
ok(spots.some((s) => s.sign === 'lifebuoy' && s.position === 'Galley'), '…and the lifebuoy there its own');
ok(!spots.some((s) => s.itemIds.includes('p1')), 'a PLB wants none');
ok(spots.some((s) => s.key === 'extinguisher|item:e4' && s.itemNo === '7'), 'an item without a position stands alone, with its number');
ok(!spots.some((s) => s.position === 'Bridge'), 'a place taken off the list is gone');
ok(spots.some((s) => s.placeId === 'own1' && s.qty === 3) && !spots.some((s) => s.placeId === 'own2'), "the vessel's own place counts, a removed one does not");
ok(spots[spots.length - 1].key === 'extinguisher|item:e4' && spots[0].deck === 'Main deck', 'deck by deck, the ones without a deck last');

// The round.
const C = (id: string, at: number, looks: any[], o: any = {}): any => ({ id, date: '2026-11-20', by: 'Bosun', looks, at, updatedAt: at, ...o });
const own = spots.find((s) => s.placeId === 'own1')!;
const checks = [
  C('c1', 1, [{ key: ext.key, sign: 'extinguisher', qty: 1, state: 'ok' }]),
  C('c2', 2, [{ key: ext.key, sign: 'extinguisher', qty: 1, state: 'missing' }, { key: own.key, sign: 'escape_left', qty: 3, state: 'poor', bad: 2 }]),
];
let st = spotStates(spots, checks);
ok(st.get(ext.key)!.state === 'missing' && st.get(ext.key)!.bad === 1, 'the latest look counts');
ok(st.get(own.key)!.bad === 2, '…two of three arrows faded');
ok(st.get('extinguisher|item:e4')!.state === 'unseen', 'a place never looked at says so');
ok(spotStates(spots, [C('c3', 3, [{ key: ext.key, sign: 'lifebuoy', qty: 1, state: 'missing' }])]).get(ext.key)!.state === 'unseen', 'a look at another sign does not count');

// Spares and the order.
const store: any[] = [
  { id: 's1', store: 'signs', name: 'Fire extinguisher', signId: 'extinguisher', unit: 'pcs', min: 2, order: 0, updatedAt: 1 },
  { id: 's2', store: 'signs', name: 'Escape route — arrow left', unit: 'pcs', min: 1, order: 1, updatedAt: 1 },
  { id: 'x', store: 'general', name: 'Fire extinguisher', unit: 'pcs', min: 0, order: 2, updatedAt: 1 },
];
ok(sparesOf('extinguisher', store).map((i) => i.id).join() === 's1' && sparesOf('escape_left', store).map((i) => i.id).join() === 's2' && !sparesOf('lifebuoy', store).length, 'a spare by its sign, else by its name, only in an IMO signs store');
let needs = signNeeds(spots, st, store, new Map([['s1', 3], ['s2', 1]]), new Map());
const nE = needs.find((n) => n.sign === 'extinguisher')!;
const nA = needs.find((n) => n.sign === 'escape_left')!;
ok(nE.replace === 1 && nE.fit === 1 && nE.order === 0, 'one missing, three spare: fit one, two left = the minimum, nothing to order');
ok(nA.replace === 2 && nA.fit === 1 && nA.order === 2, 'two faded, one spare: fit one, order one for the place and one back to the minimum');
needs = signNeeds(spots, st, store, new Map([['s1', 3], ['s2', 1]]), new Map([['s2', 2]]));
ok(needs.find((n) => n.sign === 'escape_left')!.order === 0, 'what is already on order is not ordered again');
// Two stores hold the arrows (the catalogue's in one, a typed one in another): both count.
const two: any[] = [...store, { id: 's3', store: 'signs', roomId: 'r2', name: 'Escape route — arrow left', signId: 'escape_left', unit: 'pcs', min: 1, order: 0, updatedAt: 1 }];
ok(sparesOf('escape_left', two).map((i) => i.id).join() === 's3,s2', 'a sign in two stores: both, the catalogue\'s first');
const n2 = signNeeds(spots, st, two, new Map([['s2', 1], ['s3', 0]]), new Map([['s2', 2]])).find((n) => n.sign === 'escape_left')!;
ok(n2.spare === 1 && n2.fit === 1 && n2.onOrder === 2 && n2.order === 1 && n2.stock!.id === 's3', '…spares, minimums and orders of both: fit one; one for the place + two minimums − two on order = one');
needs = signNeeds(spots, st, [], new Map(), new Map());
ok(needs.every((n) => n.fit === 0 && n.order === n.replace), 'no IMO signs store: everything to replace is ordered');
const lines = signOrderLines(signNeeds(spots, st, store, new Map([['s1', 0], ['s2', 1]]), new Map()));
const lE = lines.find((l) => /Fire extinguisher/.test(l.description))!;
ok(!!lE && lE.qty === 3 && lE.storeItemId === 's1' && /IMO sign — Fire extinguisher, photoluminescent/.test(lE.description) && /ISO 17631/.test(lE.notes) && /Main deck · Galley/.test(lE.notes) && /2 to keep as spare/.test(lE.notes), 'the order line: sign, standard, where, and the spares to keep, received into the store');
ok(!lines.some((l) => l.qty <= 0), 'no empty lines');

// Fitting from stock.
const fit = fittedLooks(signNeeds(spots, st, store, new Map([['s1', 3], ['s2', 1]]), new Map()), st);
ok(fit.find((l) => l.key === ext.key)!.state === 'ok', 'a place fully fitted reads fine');
const fa = fit.find((l) => l.key === own.key)!;
ok(fa.state === 'poor' && fa.bad === 1 && /1 fitted/.test(fa.note!), '…one fitted in part keeps the rest to replace');
st = spotStates(spots, [...checks, C('c4', 4, fit, { fitted: true })]);
ok(st.get(ext.key)!.state === 'ok' && st.get(own.key)!.bad === 1, 'after the fitting the list says so');
const takes = spareTakes([{ key: 'a', wear: 'good', qty: 2 }, { key: 'b', wear: 'poor', qty: 5 }, { key: 'c', wear: 'new', qty: 1 }] as any, 2);
ok(takes.length === 2 && takes[0].wear === 'new' && takes[0].qty === 1 && takes[1].wear === 'good' && takes[1].qty === 1, 'spares off the shelf: new first, then good, never poor');
ok(spareTakes([{ key: 'b', wear: 'poor', qty: 5 }] as any, 1).length === 0, '…a poor one is never posted');

// Rules, sync, backup, reset, screen, words.
const rules = readFileSync('firestore.rules', 'utf8');
ok(/match \/sign_places\/\{id\}[\s\S]{0,300}isAdmin\(v\)[\s\S]{0,200}allow delete: if false/.test(rules), 'rules: officers keep the places, never deleted');
ok(/match \/sign_checks\/\{id\}[\s\S]{0,400}looks\.size\(\) > 0[\s\S]{0,80}allow update, delete: if false/.test(rules), 'rules: a round is written once');
const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/sub: 'sign_places'.*module: 'imoSigns'/.test(fb) && /sub: 'sign_checks'.*appendOnly: true, module: 'imoSigns'/.test(fb), 'synced with the module');
const bk = readFileSync('services/backup.ts', 'utf8');
ok(/SIGN_PLACES_KEY/.test(bk) && /SIGN_CHECKS_KEY/.test(bk), 'in the backup');
ok(/    SIGN_PLACES_KEY,\n    SIGN_CHECKS_KEY,/.test(readFileSync('services/storage.ts', 'utf8')), 'wiped with the rest on reset');
const idx = readFileSync('index.tsx', 'utf8');
ok(/ImoSigns: \['imoSigns'\]/.test(idx) && /name="ImoSigns" component=\{gated\('ImoSigns'/.test(idx), 'the screen gated by its module');
const files = ['screens/ImoSignsSc.tsx', 'screens/StoresSc.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
const used = [...files.matchAll(/\bt\('((?:sg|st)\.[\w.]+)'/g)].map((m) => m[1]);
const missing = [...new Set(used)].filter((k) => !(k in en));
ok(!missing.length, `every word in English${missing.length ? `: missing ${missing.join(', ')}` : ''}`);
const dyn = ['menu.ImoSigns', 'sro.kind.signs', 'sro.sub.signs', ...['ok', 'poor', 'missing', 'unseen'].map((k) => `sg.state.${k}`), ...['Life-saving', 'Escape', 'Fire', 'Safety'].map((g) => `sg.group.${g}`), ...IMO_SIGNS.map((s) => `sg.sign.${s.id}`)];
const noDyn = dyn.filter((k) => !(k in en));
ok(!noDyn.length, `the words built from a value too${noDyn.length ? `: missing ${noDyn.join(', ')}` : ''}`);
ok(IMO_SIGNS.every((s) => (en as any)[`sg.sign.${s.id}`] === s.name), "the English sign names are the catalogue's");
const manual = readFileSync('constants/manual.ts', 'utf8');
ok(/title: "IMO signs"/.test(manual) && /\{ title: 'IMO signs', module: 'imoSigns' \}/.test(manual), 'the manual has the section, gone with the module');

console.log(fail ? `\n${fail} FAILED` : '\nall passed');
process.exit(fail ? 1 : 0);
