/*
 * Check groups — signed once, a record per item (services/checkGroups.ts).
 *
 *   npm run check:groups
 */
import { applyGroup, checkGroupsOf, findGroup, groupKey, groupProofKey, groupQrPayload, parseGroupQr } from '../services/checkGroups';
import { clearScanProofs, recordScanProof, scanProofFor, signingGate } from '../services/signingPolicy';
import * as inspections from '../services/inspections';
import { roundProgress } from '../services/rounds';
import { templateFor } from '../constants/checklists';
import { verificationText } from '../types/inspection';
import { EquipmentItem } from '../types/equipment';
import { InspectionRound } from '../types/round';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const eebd = (id: string, cabin: string, group?: string) =>
  ({ id, category: 'eebd', no: id, position: cabin, ...(group ? { checkGroup: group } : {}), updatedAt: 1 } as EquipmentItem);
const items: EquipmentItem[] = [
  eebd('04-EB', 'Crew Cabin 1', 'Crew cabin EEBDs'),
  eebd('05-EB', 'Crew Cabin 1', ' crew  cabin eebds '),
  eebd('06-EB', 'Crew Cabin 2', 'Crew cabin EEBDs'),
  eebd('20-EB', 'Engine Room'),
  { id: 'is1', category: 'immersion_suits', checkGroup: 'Crew cabin EEBDs', updatedAt: 1 } as EquipmentItem,
];

ok('name matched ignoring case and spacing', groupKey(' crew  cabin EEBDs ') === 'crew cabin eebds');
const gs = checkGroupsOf(items);
ok('one group per category + name', gs.length === 2, gs.map((g) => g.id).join());
const g = gs.find((x) => x.category === 'eebd')!;
ok('the group holds its three EEBDs, not the ungrouped one', g.items.map((i) => i.id).join() === '04-EB,05-EB,06-EB');
ok('the first spelling names it', g.name === 'Crew cabin EEBDs');
ok('found again by id', findGroup(items, g.id)?.items.length === 3);
ok('a different category with the same name is its own group', gs.some((x) => x.category === 'immersion_suits'));

// Grouping a selection
const r = applyGroup(items, new Set(['20-EB', '04-EB']), 'Crew cabin EEBDs', 99);
ok('an item already in the group is left alone (no sync edit)', r.items[0] === items[0]);
ok('the new member gets the name and updatedAt', r.items[3].checkGroup === 'Crew cabin EEBDs' && r.items[3].updatedAt === 99);
ok('one item changed', r.changed === 1);
const u = applyGroup(items, new Set(['04-EB']), '  ', 99);
ok('an empty name takes the item out', u.items[0].checkGroup === undefined && !('checkGroup' in u.items[0]));

// The group's label
const payload = groupQrPayload(g.id);
ok('label payload round-trips', parseGroupQr(payload) === g.id, payload);
ok('a group id with spaces and | survives the URL', !/[ |]/.test(payload));
ok('an item label is not a group label', parseGroupQr('msm://item/04-EB') === null);

// Who may sign — the same gate as an item, on the group's proof
const policy = { requireScan: true, scanRequired: ['eebd'], updatedAt: 1 } as any;
clearScanProofs();
ok('no scan rule: open', signingGate({ requireScan: false, updatedAt: 1 }, 'user', true, null, 'eebd').kind === 'open');
ok('scan rule, no label scanned: Crew blocked', signingGate(policy, 'user', true, scanProofFor(groupProofKey(g.id)), 'eebd').kind === 'blocked');
ok('scan rule, no label scanned: an Officer blocked too', signingGate(policy, 'admin', true, scanProofFor(groupProofKey(g.id)), 'eebd').kind === 'blocked');
ok('scan rule, no label scanned: Master overrides', signingGate(policy, 'superadmin', true, null, 'eebd').kind === 'override');
recordScanProof(groupProofKey(g.id), 'qr-camera');
ok('label scanned: Crew may sign', signingGate(policy, 'user', true, scanProofFor(groupProofKey(g.id)), 'eebd').kind === 'scanned');
ok("a group's scan is not a scan of its items", scanProofFor('04-EB') === null);

// The records: one per item, they count towards the round
const template = templateFor('eebd', 'weekly', [])!;
const results = Object.fromEntries(template.lines.map((l) => [l.id, 'pass' as const]));
const round: InspectionRound = { id: 'r1', period: 'weekly', categories: ['eebd'], from: 0, to: Date.now() + 1e9, label: 'W45', startedBy: 'CO', startedAt: 0, updatedAt: 0 };
const at = Date.now();
const recs = g.items.map((item) => inspections.create({
  item, template, results, by: 'J. Dodd', byRank: 'Chief Officer', at, roundId: 'r1',
  verification: { method: 'group', group: g.name, groupId: 'gc1', groupSize: g.items.length, scannedAt: new Date(2026, 10, 2, 14, 2).getTime() },
}));
ok('one record per item', new Set(recs.map((x) => x.itemId)).size === 3 && new Set(recs.map((x) => x.id)).size === 3);
ok('records pass, no defect', recs.every((x) => x.outcome === 'pass' && !x.defect));
ok('verification carries the group', recs.every((x) => x.verification?.method === 'group' && x.verification.groupId === 'gc1' && x.verification.groupSize === 3));
ok('report text', verificationText(recs[0].verification, () => '14:02') === 'Group check: Crew cabin EEBDs (3 items) · group label QR 14:02', verificationText(recs[0].verification, () => '14:02'));
ok('report text, Master without scan', verificationText({ method: 'group', group: 'Suits', groupSize: 8, reason: 'label washed off' }, () => '') === 'Group check: Suits (8 items) · no scan (Master): label washed off');
const p = roundProgress(round, items, recs);
ok('the round counts the group as done, the ungrouped one outstanding', p.done.size === 3 && p.outstanding.map((x) => x.id).join() === '20-EB');
ok('each item reads done for the week', inspections.roundStatus(recs, '05-EB', 'weekly') === 'done');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
