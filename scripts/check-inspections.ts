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
import { signoffFor, unsentInspections, create, closeDefect, mergeInspections, mergeCrew, mergeTemplates, roundStatus, roundMark, monthWindow, weekWindow, quarterWindow, yearWindow, windowFor, stepPeriod, forItem, openDefects, failedLines, defectReason } from '../services/inspections';
import { ChecklistTemplate, templateFor, periodsFor, roundsFor, templateById } from '../constants/checklists';
import { CHECKLISTS } from '../constants/checklists';
import { CATEGORIES, GROUP_ORDER } from '../constants/categories';
import { LIFTING_CATEGORIES, LIFTING_CHECKLISTS, LIFTING_KEYS } from '../constants/lifting';
import { moduleOn } from '../constants/modules';
import { EquipmentItem } from '../types/equipment';
import { Inspection, verificationText } from '../types/inspection';
import { SCAN_PROOF_MINUTES, clearScanProofs, newerPolicy, recordScanProof, scanProofFor, scanRequiredFor, signerRule, signingGate } from '../services/signingPolicy';
import { compareVersions, newestVersion, versionLabel, versionStanding } from '../utils/version';
import { RETENTION_DAYS, archivedThroughFor, canMarkArchived, isArchived, monthsToArchive, newerArchive, photosAwaitingArchive, photosInWindow, retentionCutoff, sweepCutoff } from '../services/photoArchive';

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
// EVERY category, not one sample: a category added without a checklist can be
// scanned and opened but not inspected, and nothing else would say so. This is
// what makes the generic fallback load-bearing rather than decorative.
// It read "at least monthly" until the lifting register: that gear is examined
// quarterly or annually and owes no monthly round (constants/lifting.ts), so the
// invariant is the one that was always meant — no category without a round.
ok('every category offers at least one round',
   CATEGORIES.every(c => periodsFor(c.key).length > 0),
   CATEGORIES.filter(c => !periodsFor(c.key).length).map(c => c.key).join(','));
ok('every LSA/FFE/Other category still offers monthly',
   CATEGORIES.filter(c => c.group !== ('LIFTING' as any)).every(c => periodsFor(c.key).includes('monthly')),
   CATEGORIES.filter(c => c.group !== ('LIFTING' as any) && !periodsFor(c.key).includes('monthly')).map(c => c.key).join(','));
ok('every category can build a monthly template with lines',
   CATEGORIES.every(c => (templateFor(c.key, 'monthly')?.lines.length ?? 0) > 0));
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

// ---- a double signature is two records, and merge cannot undo it ------------
// The screen guards against tapping Sign twice (screens/InspectionSc.tsx uses a
// ref, because state does not settle fast enough). This proves WHY that guard
// has to be there rather than being left to the merge: two signings of the same
// checklist get different ids, so they are two distinct signed statements and a
// set union keeps both — and when the round failed, both carry an open defect.
const twice1 = create({ item: ext, template: tpl, results: oneFail, by: 'Jez Dodd' });
const twice2 = create({ item: ext, template: tpl, results: oneFail, by: 'Jez Dodd' });
ok('two signings of one checklist are two records', twice1.id !== twice2.id);
ok('merge cannot collapse a double signature', mergeInspections([twice1], [twice2]).length === 2);
ok('a double signature is a double defect',
   openDefects(mergeInspections([twice1], [twice2])).length === 2);

// ---- a defect always says why -----------------------------------------------
// The note is optional; the failed lines are not. A reason built from the note
// alone prints blank whenever nobody typed one — harmless on screen, a hole in
// the finding column of a report handed to an inspector.
const noNote = create({ item: ext, template: tpl, results: oneFail, by: 'Jez Dodd' });
ok('a defect with no note still states its reason', defectReason(noNote).length > 0);
ok('the reason names the failed line', defectReason(noNote).includes(failedLines(noNote)[0]));
const withNote = create({ item: ext, template: tpl, results: oneFail, by: 'Jez Dodd', defectNote: 'Gauge in the red' });
ok('a note is added to the reason, not instead of it',
   defectReason(withNote).includes('Gauge in the red') && defectReason(withNote).includes(failedLines(withNote)[0]));
ok('a passed inspection has no reason', defectReason(p) === '');

// ---- the round mark: what the dot beside an item means ----------------------
// Blue not yet, green signed and clear, amber the period is closing, red a
// defect still outstanding. The two that matter: "not yet, with time" must not
// look like a problem, and a failure must not be cleared by the calendar.
const early = new Date(new Date().getFullYear(), new Date().getMonth(), 3, 12);
const late = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 12); // last day
ok('inspected and clear reads done', roundMark([p], ext.id, 'monthly') === 'done');
ok('untouched early in the month is not a warning', roundMark([], ext.id, 'monthly', early) === 'open');
ok('untouched at the end of the month warns', roundMark([], ext.id, 'monthly', late) === 'due');
ok('an open defect shows as failed', roundMark([f], ext.id, 'monthly') === 'fail');
ok('a rectified defect stops showing as failed',
   roundMark([closeDefect(f, 'Bosun')], ext.id, 'monthly') !== 'fail');
// A defect raised in a previous period is still outstanding today.
const oldFail = { ...f, at: Date.now() - 90 * 86400000 };
ok('a defect from an earlier period is still failed', roundMark([oldFail], ext.id, 'monthly') === 'fail');

const c1 = { id: 'c1', name: 'Jez', active: true, addedAt: 1, updatedAt: 10 };
const c2 = { id: 'c1', name: 'Jez Dodd', rank: 'Third Officer', active: true, addedAt: 1, updatedAt: 20 };
ok('crew merge takes the newer edit', mergeCrew([c1], [c2])[0].name === 'Jez Dodd');
ok('crew merge keeps one row per id', mergeCrew([c1], [c2]).length === 1);

// --- scan before signing (services/signingPolicy.ts) ---
{
  clearScanProofs();
  const on = { requireScan: true, updatedAt: 5 };
  const off = { requireScan: false, updatedAt: 9 };
  const t0 = 1_800_000_000_000;
  ok('no proof before a scan', scanProofFor('x1', t0) === null);
  recordScanProof('x1', 'qr-camera', t0);
  ok('a scan is proof for that item', scanProofFor('x1', t0 + 60_000)?.method === 'qr-camera');
  ok('…and not for another item', scanProofFor('x2', t0 + 60_000) === null);
  ok(`a scan goes stale after ${SCAN_PROOF_MINUTES} minutes`, scanProofFor('x1', t0 + (SCAN_PROOF_MINUTES + 1) * 60_000) === null);
  ok('a proof from the future is not proof', scanProofFor('x1', t0 - 1000) === null);
  const proof = scanProofFor('x1', t0 + 1000);

  ok('rule off: anyone signs', signingGate(off, 'user', true, null).kind === 'open');
  ok('rule off: a scan is still carried', (signingGate(off, 'user', true, proof) as any).proof?.itemId === 'x1');
  ok('rule on + scan: crew signs', signingGate(on, 'user', true, proof).kind === 'scanned');
  ok('rule on, no scan: crew blocked', signingGate(on, 'user', true, null).kind === 'blocked');
  ok('rule on, no scan: officer blocked', signingGate(on, 'admin', true, null).kind === 'blocked');
  ok('rule on, no scan: role not known yet is blocked', signingGate(on, null, true, null).kind === 'blocked');
  ok('rule on, no scan: Master may override', signingGate(on, 'superadmin', true, null).kind === 'override');
  ok('rule on, no scan: a device on no vessel may override', signingGate(on, null, false, null).kind === 'override');
  ok('no policy at all = off', signingGate(null, 'user', true, null).kind === 'open');

  // Who signs: the device's account, when the vessel says so.
  const bind = { requireScan: false, signAsDevice: true, updatedAt: 2 };
  const meDev = { id: 'd1', firstName: 'Jez', lastName: 'Dodd', position: 'Master' };
  ok('sign-as-device off: pick from the list', signerRule(off, true, meDev).kind === 'pick');
  ok('sign-as-device: an old policy without the field picks', signerRule({ requireScan: true, updatedAt: 1 }, true, meDev).kind === 'pick');
  const bound = signerRule(bind, true, meDev);
  ok('sign-as-device on: the account signs', bound.kind === 'device' && bound.signer.name === 'Jez Dodd' && bound.signer.rank === 'Master');
  ok('sign-as-device: the id names the device, never a crew id', bound.kind === 'device' && bound.signer.id === 'device:d1');
  ok('sign-as-device on, account not loaded: held, not let through', signerRule(bind, true, null).kind === 'waiting');
  ok('sign-as-device on, account with no name: held', signerRule(bind, true, { id: 'd2' }).kind === 'waiting');
  ok('sign-as-device on, device on no vessel: picks (it has no account)', signerRule(bind, false, null).kind === 'pick');
  ok('sign-as-device: a blank rank is dropped', (signerRule(bind, true, { ...meDev, position: '  ' }) as any).signer.rank === undefined);

  ok('newer policy wins', newerPolicy(on, off).requireScan === false && newerPolicy(off, on).requireScan === false);
  ok('a missing copy yields the other', newerPolicy(null, on) === on && newerPolicy(on, null) === on);

  const scanned = create({ item: ext, template: tpl, results: allPass, by: 'Jez Dodd', verification: { method: 'qr-camera', scannedAt: t0 } });
  ok('a scan is written onto the record', scanned.verification?.method === 'qr-camera' && scanned.verification?.scannedAt === t0);
  const overridden = create({ item: ext, template: tpl, results: allPass, by: 'Master', verification: { method: 'override', reason: '  label missing ' } });
  ok('an override keeps its reason, trimmed', overridden.verification?.reason === 'label missing');
  ok('no scan, no rule: nothing claimed', create({ item: ext, template: tpl, results: allPass, by: 'X' }).verification === undefined);
  ok('report text for a scan', verificationText(scanned.verification, () => '14:02') === 'QR 14:02');
  ok('report text for an override', verificationText(overridden.verification, () => '') === 'No scan (Master): label missing');
  const synced = mergeInspections([], [scanned]);
  ok('verification survives a merge', synced[0].verification?.method === 'qr-camera');
}

// --- the frequencies a category owes (constants/checklists `roundsFor`) -------
//
// The schedule is now a decision the vessel makes per category, and the whole
// point of storing it as a tombstone row is that the decision must not be
// undone by a sync. These checks are about the resolution rules, which is where
// a mistake would silently put a round back on the board — or take one off it.
{
  const own = (patch: Partial<ChecklistTemplate>): ChecklistTemplate => ({
    id: 'v.fire_extinguishers.monthly.1',
    version: 2,
    category: 'fire_extinguishers',
    period: 'monthly',
    title: 'Extinguisher — monthly (ours)',
    lines: [{ id: 'own1', text: 'Our line' }],
    updatedAt: 100,
    ...patch,
  });

  ok('no vessel rows: the built-in rounds stand',
     roundsFor('hydrants_fireboxes').map(r => `${r.period}:${r.on}`).join() === 'weekly:true,monthly:true');
  ok("a vessel's wording is in force and marked as theirs",
     roundsFor('fire_extinguishers', [own({})]).some(r => r.period === 'monthly' && r.own && r.template.lines[0].id === 'own1'));
  ok('a round switched off is still listed, switched off',
     roundsFor('fire_extinguishers', [own({ off: true })]).some(r => r.period === 'monthly' && !r.on));
  ok('…and periodsFor leaves it out',
     !periodsFor('fire_extinguishers', [own({ off: true })]).includes('monthly'));
  ok('a switched-off round is left out of what can be inspected',
     periodsFor('fire_extinguishers', [own({ off: true })]).length === 0);
  ok('switching a round off does not change its checklist',
     templateFor('fire_extinguishers', 'monthly', [own({ off: true })]).lines[0].id === 'own1');
  ok('withdrawing the wording falls back to the built-in, round still on',
     roundsFor('fire_extinguishers', [own({ standard: true, lines: [] })]).some(r => r.period === 'monthly' && r.on && !r.own));
  ok('a row with no lines is a decision, not a wording',
     templateFor('fire_extinguishers', 'monthly', [own({ off: true, lines: [] })]).id === 'fire_extinguishers.monthly');
  ok('a vessel-added round appears where the app ships none',
     roundsFor('fire_extinguishers', [own({ id: 'v.fire_extinguishers.quarterly.1', period: 'quarterly' })])
       .some(r => r.period === 'quarterly' && r.on && r.added));
  ok('rounds come back weekly, monthly, quarterly',
     roundsFor('hydrants_fireboxes', [own({ id: 'v.hydrants_fireboxes.quarterly.1', category: 'hydrants_fireboxes', period: 'quarterly' })])
       .map(r => r.period).join() === 'weekly,monthly,quarterly');
  // The reason `off` is a field on a synced row rather than a local deletion.
  const kept = mergeTemplates([own({ off: true, updatedAt: 200 })], [own({ updatedAt: 100 })]);
  ok('a switch-off survives the vessel sending back the older row', kept.length === 1 && kept[0].off === true);
  ok('every category still offers a round with no vessel rows',
     CATEGORIES.every(c => periodsFor(c.key).length > 0));
}

// --- period windows ----------------------------------------------------------
{
  const inQ3 = new Date(2026, 7, 14); // 14 Aug 2026
  const q = quarterWindow(inQ3);
  ok('a quarter starts on the first of its first month', new Date(q.from).getMonth() === 6 && new Date(q.from).getDate() === 1);
  ok('a quarter ends at the start of the next one', new Date(q.to).getMonth() === 9);
  ok('a quarter is labelled as one', q.label === 'Q3 2026');
  ok('windowFor routes quarterly to the quarter', windowFor('quarterly', inQ3).from === q.from);
  ok('a round signed on 30 Sep is not in Q4',
     new Date(2026, 8, 30).getTime() < quarterWindow(new Date(2026, 9, 1)).from);
  ok('annual is the calendar year', new Date(yearWindow(inQ3).from).getFullYear() === 2026 && yearWindow(inQ3).label === '2026');
  ok('stepping back a quarter lands in the previous one',
     quarterWindow(stepPeriod('quarterly', inQ3, -1)).label === 'Q2 2026');
  ok('stepping back a month is still a month', stepPeriod('monthly', inQ3, -1).getMonth() === 6);
  ok('stepping back a week is seven days', stepPeriod('weekly', new Date(2026, 7, 14), -1).getDate() === 7);
  // The record's period comes from the template it was signed against, so a
  // quarterly round needs a quarterly template — which is what a vessel adds.
  const qTpl = { ...tpl, id: 'v.fire_extinguishers.quarterly.1', period: 'quarterly' as const };
  const q3done = create({ item: ext, template: qTpl, results: allPass, by: 'X', at: new Date(2026, 7, 3).getTime() });
  ok('a quarterly record carries the quarterly period', q3done.period === 'quarterly');
  ok('a quarterly round counts inside its quarter', roundStatus([q3done], ext.id, 'quarterly', inQ3) === 'done');
  ok('…and not in the next quarter', roundStatus([q3done], ext.id, 'quarterly', new Date(2026, 10, 1)) === 'overdue');
}

// --- the scan rule by category (services/signingPolicy `scanExempt`) ---------
{
  const on = { requireScan: true, updatedAt: 5 };
  const exempt = { requireScan: true, scanExempt: ['other_safety' as const], updatedAt: 6 };
  ok('rule on: every category needs a scan', scanRequiredFor(on, 'fire_extinguishers'));
  ok('an exempt category does not', !scanRequiredFor(exempt, 'other_safety'));
  ok('…and its neighbours still do', scanRequiredFor(exempt, 'fire_extinguishers'));
  ok('the vessel-level question ignores the exemptions', scanRequiredFor(exempt));
  ok('rule off: the exemptions are irrelevant', !scanRequiredFor({ requireScan: false, scanExempt: ['other_safety'], updatedAt: 1 }, 'fire_extinguishers'));
  ok('an exempt category lets crew sign without a scan',
     signingGate(exempt, 'user', true, null, 'other_safety').kind === 'open');
  ok('a covered category still blocks them',
     signingGate(exempt, 'user', true, null, 'fire_extinguishers').kind === 'blocked');
  ok('no category named: the rule answers for the vessel',
     signingGate(exempt, 'user', true, null).kind === 'blocked');
}

// --- the Lifting & Mooring module (constants/lifting.ts, constants/modules.ts) -
//
// It ships DARK. The checks below are in two halves: what must be true while it
// is off — nothing about it reachable anywhere — and that the register itself is
// sound, so switching it on is one line rather than a day of surprises.
{
  const on = moduleOn('lifting');

  if (!on) {
    ok('module off: its categories are not registered',
       !CATEGORIES.some((c) => LIFTING_KEYS.includes(c.key as any)));
    ok('module off: no LIFTING group is offered', !GROUP_ORDER.includes('LIFTING' as any));
    ok('module off: its checklists are not reachable by id',
       LIFTING_CHECKLISTS.every((t) => templateById(t.id) === null));
  } else {
    ok('module on: every category is registered',
       LIFTING_KEYS.every((k) => CATEGORIES.some((c) => c.key === k)));
    ok('module on: the group is offered', GROUP_ORDER.includes('LIFTING' as any));
    // As agreed with the vessel that asked (constants/lifting.ts): nothing is
    // monthly, everything is annual, and the two categories in constant use —
    // mooring and working aloft — are quarterly as well.
    ok('module on: every category owes an annual round',
       LIFTING_KEYS.every((k) => periodsFor(k as any).includes('annual')));
    ok('module on: nothing is monthly',
       LIFTING_KEYS.every((k) => !periodsFor(k as any).includes('monthly')));
    const quarterly = LIFTING_KEYS.filter((k) => periodsFor(k as any).includes('quarterly'));
    ok('module on: mooring and working aloft are quarterly, and only they',
       [...quarterly].sort().join() === 'mooring,working_aloft', quarterly.join());
  }

  // True either way — the register is data, and data can be wrong while it sleeps.
  ok('every listed category has a checklist of its own',
     LIFTING_KEYS.every((k) => LIFTING_CHECKLISTS.some((t) => t.category === k)));
  ok('the categories match the keys', LIFTING_CATEGORIES.length === LIFTING_KEYS.length);
  ok('every category is in the LIFTING group',
     LIFTING_CATEGORIES.every((c) => c.group === 'LIFTING'));
  ok('every category has its own worksheet name',
     new Set(LIFTING_CATEGORIES.map((c) => c.sheet)).size === LIFTING_CATEGORIES.length);
  ok('no lifting key collides with a built-in one',
     LIFTING_KEYS.every((k) => !CATEGORIES.some((c) => c.key === k && c.group !== 'LIFTING')));
  ok('template ids are unique',
     new Set(LIFTING_CHECKLISTS.map((t) => t.id)).size === LIFTING_CHECKLISTS.length);
  ok('line ids are unique within each template',
     LIFTING_CHECKLISTS.every((t) => new Set(t.lines.map((l) => l.id)).size === t.lines.length));
  ok('every check asks for the SWL marking and the certificate',
     LIFTING_CHECKLISTS.filter((t) => t.period === 'monthly')
       .every((t) => t.lines.some((l) => l.id === 'marking') && t.lines.some((l) => l.id === 'cert')));
}

// --- the report's "Checked by / Rank / Date" (services/inspectionReport) -----
{
  const rec = (by: string, rank: string | undefined, at: number): any => ({
    id: 'i' + at, itemId: 'x1', category: 'fire_extinguishers', at, updatedAt: at,
    by, byRank: rank, period: 'monthly', templateId: 't', templateVersion: 1,
    results: {}, outcome: 'pass',
  });
  // buildReport hands `done` over newest-first, which is what the date relies on.
  const d = (done: any[]): any => ({ done, missed: [], defects: [], inScope: [], period: 'monthly' });

  const one = signoffFor(d([rec('Jeremy Dodd', 'Third Officer', new Date(2026, 8, 25).getTime())]));
  ok('one signer fills the line', one.names === 'Jeremy Dodd' && one.rank === 'Third Officer' && !one.blank);
  ok('the date is the round, not today', one.date === '25 Sep 2026');
  // A night round must not be filed under the previous day (see localISODate).
  const night = signoffFor(d([rec('A B', 'Bosun', new Date(2026, 8, 25, 0, 30).getTime())]));
  ok('a 00:30 round keeps its own date', night.date === '25 Sep 2026');

  const two = signoffFor(d([
    rec('Jeremy Dodd', 'Third Officer', 3000),
    rec('Simon Cridge', 'Chief Officer', 2000),
  ]));
  ok('two signers are both named', two.names === 'Jeremy Dodd, Simon Cridge');
  ok('…and no single rank is claimed for them', two.rank === '');

  const same = signoffFor(d([rec('A B', 'Bosun', 3000), rec('C D', 'Bosun', 2000)]));
  ok('a shared rank is printed', same.rank === 'Bosun');

  const many = signoffFor(d([rec('A', 'x', 5), rec('B', 'x', 4), rec('C', 'x', 3), rec('D', 'x', 2)]));
  ok('beyond three it counts the rest', many.names === 'A, B, C and 1 other');

  ok('the same person twice is one name',
     signoffFor(d([rec('A B', 'Bosun', 3000), rec('A B', 'Bosun', 2000)])).names === 'A B');
  ok('nothing signed leaves the line blank', signoffFor(d([])).blank === true);
}

// --- what still has to go up (services/inspections `unsentInspections`) ------
//
// The bug this exists for: a rectification rewrites a record that has already
// been sent, and a "sent ids" filter drops it for ever. A vessel found it — the
// defect it closed was still open on every other device eleven days later.
{
  const mk = (id: string, at: number, upd = at): any => ({
    id, itemId: 'x1', category: 'fire_extinguishers', at, updatedAt: upd,
    by: 'X', period: 'monthly', templateId: 't', templateVersion: 1, results: {}, outcome: 'pass',
  });
  const a = mk('a', 1000);
  const b = mk('b', 2000);

  ok('nothing sent yet: everything goes', unsentInspections([a, b], {}).length === 2);
  ok('already sent at the same stamp: nothing goes', unsentInspections([a, b], { a: 1000, b: 2000 }).length === 0);

  // the actual case
  const closed = closeDefect({ ...a, defect: { note: 'x', open: true } } as any, 'Master', 'fixed', 5000);
  ok('closing a defect moves updatedAt', closed.updatedAt === 5000 && closed.defect?.open === false);
  const owed = unsentInspections([closed, b], { a: 1000, b: 2000 });
  ok('a rectified record goes up again', owed.length === 1 && owed[0].id === 'a');
  ok('…and its neighbour does not', !owed.some((i) => i.id === 'b'));

  ok('a record sent AFTER its last change stays put',
     unsentInspections([closed], { a: 5000 }).length === 0);
  ok('a record with no updatedAt is not re-pushed for ever',
     unsentInspections([{ ...a, updatedAt: undefined } as any], { a: 0 }).length === 0);
  // what the migration from the old id-only list produces
  ok('the migration stamp of 0 sends everything once',
     unsentInspections([a, b], { a: 0, b: 0 }).length === 2);
}

// --- photo retention (services/photoArchive.ts) ------------------------------
//
// This is the one place in the app where being wrong DELETES evidence, so the
// checks are written against that: the sweep cutoff must be 0 whenever nothing
// has been archived, must never run ahead of the archive, and a month must not
// be offered — or marked — before it is completely out of the window.
{
  const DAY = 86_400_000;
  const now = new Date(2026, 11, 15, 12, 0, 0).getTime(); // 15 Dec 2026
  const photo = { id: 'p1', kind: 'photo' as const, uri: 'file://p1.jpg', addedAt: 0 };
  const rec = (at: number, photos = 1): any => ({
    id: `i${at}`, itemId: 'x1', category: 'fire_extinguishers', at, updatedAt: at,
    by: 'X', period: 'monthly', templateId: 't', templateVersion: 1, results: {}, outcome: 'pass',
    photos: Array.from({ length: photos }, (_, n) => ({ ...photo, id: `p${n}` })),
  });

  // 15 Dec − 90 d = 16 SEPTEMBER. So only August is COMPLETELY out of the
  // window; September is not, because its last days are still inside it. That
  // boundary is the reason months are offered whole and late rather than early.
  const aug = rec(new Date(2026, 7, 10).getTime(), 2);
  const sep = rec(new Date(2026, 8, 20).getTime(), 3);
  const oct = rec(new Date(2026, 9, 5).getTime(), 1);
  const dec = rec(new Date(2026, 11, 1).getTime(), 4);
  const trail = [aug, sep, oct, dec];

  ok('the window is 90 days', RETENTION_DAYS === 90 && retentionCutoff(now) === now - 90 * DAY);

  // --- the safety property ---
  ok('nothing archived: the sweep deletes NOTHING', sweepCutoff({ updatedAt: 1 }, now) === 0);
  ok('no state at all: the sweep deletes nothing', sweepCutoff(null, now) === 0 && sweepCutoff(undefined, now) === 0);
  const archivedAug = { archivedThrough: new Date(2026, 8, 1).getTime(), updatedAt: 2 };
  ok('archived through August: the archive is what binds, not the window',
     sweepCutoff(archivedAug, now) === archivedAug.archivedThrough);
  const archivedYesterday = { archivedThrough: now - DAY, updatedAt: 2 };
  ok('a Master claiming everything is archived cannot reach inside the window',
     sweepCutoff(archivedYesterday, now) === retentionCutoff(now));

  ok('an August record reads as archived once August is confirmed', isArchived(aug, archivedAug, now));
  ok('a September record does not', !isArchived(sep, archivedAug, now));
  ok('an October record does not', !isArchived(oct, archivedAug, now));
  ok('nothing is archived while nothing is confirmed', !isArchived(aug, { updatedAt: 1 }, now));

  // --- which months are offered ---
  const months = monthsToArchive(trail, null, now);
  ok('only months completely out of the window are offered', months.map(m => m.key).join() === '2026-08');
  ok('a month still partly inside the window waits', !months.some(m => m.key === '2026-09'));
  ok('photo counts are per month', months[0].photos === 2);
  ok('inspection counts too', months[0].inspections === 1);
  ok('September is offered once it too is out of the window',
     monthsToArchive(trail, null, new Date(2027, 0, 15).getTime()).map(m => m.key).join() === '2026-08,2026-09');
  ok('a month already archived is not offered again',
     monthsToArchive(trail, archivedAug, now).map(m => m.key).join() === '');
  ok('a month with no photographs is not offered',
     monthsToArchive([rec(new Date(2026, 7, 10).getTime(), 0)], null, now).length === 0);

  const later = monthsToArchive(trail, null, new Date(2027, 0, 15).getTime());
  ok('only the oldest outstanding month may be marked',
     canMarkArchived(later, later[0]) && !canMarkArchived(later, later[1]));
  ok('marking August sets the watermark to 1 September',
     archivedThroughFor(months[0]) === new Date(2026, 8, 1).getTime());
  ok('the watermark never moves backwards',
     archivedThroughFor(months[0], { archivedThrough: new Date(2026, 9, 1).getTime(), updatedAt: 1 })
       === new Date(2026, 9, 1).getTime());

  // --- the numbers the screens show ---
  ok('photos in the window are counted', photosInWindow(trail, now) === 8); // sep 3 + oct 1 + dec 4
  ok('photos awaiting an archive are counted', photosAwaitingArchive(trail, null, now) === 2); // aug only
  ok('…and drop to nothing once confirmed', photosAwaitingArchive(trail, archivedAug, now) === 0);

  // --- the mirror between a device and the vessel ---
  const mine = { archivedThrough: 10, updatedAt: 5 };
  const theirs = { archivedThrough: 20, updatedAt: 9, lastSweepAt: 8 };
  ok('the newer copy wins', newerArchive(mine, theirs) === theirs && newerArchive(theirs, mine) === theirs);
  ok('a missing copy yields the other', newerArchive(null, mine) === mine && newerArchive(mine, null) === mine);
}

// --- app versions (utils/version.ts) -----------------------------------------
//
// The trap this exists for: "2.3" > "2.47" as STRINGS, which would tell the
// newest device on the ship to update to an older build.
{
  ok('2.3 is older than 2.47', compareVersions('2.3', '2.47') < 0);
  ok('2.47 is newer than 2.46', compareVersions('2.47', '2.46') > 0);
  ok('equal versions compare equal', compareVersions('2.47', '2.47') === 0);
  ok('a missing version is oldest', compareVersions(undefined, '1.0') < 0 && compareVersions(null, '1.0') < 0);
  ok('trailing zeros do not matter', compareVersions('2.47', '2.47.0') === 0);

  ok('the newest aboard wins', newestVersion(['2.3', '2.46', '2.47', undefined]) === '2.47');
  ok('rubbish is ignored', newestVersion([undefined, null, 'dev']) === undefined);

  ok('a device on the newest build is current',
     versionStanding('2.47', '2.47').kind === 'current');
  ok('a device behind is told what to update to',
     JSON.stringify(versionStanding('2.3', '2.47')) === JSON.stringify({ kind: 'behind', version: '2.3', newest: '2.47' }));
  ok('a device AHEAD of the fleet is not nagged',
     versionStanding('2.48', '2.47').kind === 'current');
  ok('a device that never reported is unknown, not behind',
     versionStanding(undefined, '2.47').kind === 'unknown');
  ok('with no yardstick nobody is behind', versionStanding('2.3', undefined).kind === 'current');
  ok('the label reads as a row', versionLabel(versionStanding('2.3', '2.47')) === 'v2.3 · update to 2.47');
  ok('…and quietly when current', versionLabel(versionStanding('2.47', '2.47')) === 'v2.47 · up to date');
}

console.log(fails ? `\n${fails} FAILED` : '\nAll checks passed.');
process.exit(fails ? 1 : 0);
