// npm run check:photocheckai — the photo check: which photo it compares with, how the AI's answer is read, what is asked before signing (plan item 66).
import { checkDefect, checkRemark, monthOf, needsLook, readPhotoCheck, referenceOf, signWarning } from '../services/photoCheckAi';

let bad = 0;
const ok = (c: boolean, m: string) => { if (!c) bad++; console.log(`${c ? '✓' : '✗'} ${m}`); };

const ph = (id: string, kind: 'photo' | 'document' = 'photo') => ({ id, kind, uri: `file:///a/${id}.jpg`, name: id, addedAt: 5 }) as any;
const item = { id: 'it1', attachments: [ph('own')], serial: 'AB-123/4', expiry: '2027-03-31', nextInspection: '2026-12-01' } as any;
const list = [
  { id: 'i1', itemId: 'it1', at: 100, photos: [ph('p1')] },
  { id: 'i2', itemId: 'it1', at: 300, photos: [ph('p2'), ph('doc', 'document')] },
  { id: 'i3', itemId: 'it1', at: 400, photos: [] },
  { id: 'i4', itemId: 'other', at: 900, photos: [ph('x')] },
] as any[];
const r = referenceOf(item, list);
ok(r?.photo.id === 'p2' && r.inspectionId === 'i2' && r.at === 300, 'the newest earlier evidence photo of THIS item, a document skipped, a record without photos passed over');
const own = referenceOf(item, []);
ok(own?.photo.id === 'own' && !own.inspectionId, 'no evidence yet: the item\'s own photo');
ok(referenceOf({ id: 'z', attachments: [ph('d', 'document')] } as any, list) === null, 'nothing to compare: null');

ok(monthOf('2027-03-31') === '2027-03' && monthOf('03/2027') === '2027-03' && monthOf('31.03.27') === '2027-03' && monthOf('MAR 2027') === '2027-03' && monthOf('March 2027') === '2027-03', 'label dates read as a month');
ok(monthOf('13/2027') === '' && monthOf('soon') === '' && monthOf('') === '', 'not a date: nothing');

const c = readPhotoCheck({ match: 'yes', why: ' A  CO2 extinguisher ', same: 'same', serial: 'AB 1234', expiry: '03/2027', findings: [{ kind: 'corrosion', where: 'rust at the base', major: false }, { kind: 'weird', where: 'pin missing', major: true }, { kind: 'damage', where: '' }] }, item, true);
ok(!!c && c.why === 'A CO2 extinguisher' && c.same === 'same', 'why squeezed, same read');
ok(!!c && c.differs.length === 0, `serial with other punctuation and the expiry month agree (${c?.differs})`);
ok(!!c && c.findings.length === 2 && c.findings[1].kind === 'other' && c.findings[1].major, 'unknown kind → other, a finding without a place dropped');

const d = readPhotoCheck({ match: 'maybe', same: 'same', serial: 'ZX999', expiry: '2025-01', findings: 'none' }, item, false);
ok(!!d && d.match === 'unsure' && d.same === undefined, 'an answer outside the list is unsure; no reference → no same');
ok(!!d && d.differs.length === 2 && d.differs[0].includes('ZX999') && d.differs[1].includes('2025-01'), `serial and date that differ are named (${d?.differs})`);
ok(!!d && d.findings.length === 0, 'findings not a list: none');
const n = readPhotoCheck({ match: 'yes', expiry: '2026-12-15' }, item, true);
ok(!!n && n.differs.length === 0 && n.same === 'unsure', 'a date matching the next inspection is fine; missing same → unsure');
ok(readPhotoCheck(null, item, false) === null && readPhotoCheck('x' as any, item, false) === null, 'no answer: nothing');

const clean = readPhotoCheck({ match: 'yes', same: 'same', findings: [] }, item, true)!;
ok(!needsLook(clean) && signWarning(clean, {}) === null, 'a clean photo of the same unit asks nothing');
ok(checkRemark(clean) === 'No corrosion or damage seen. (AI photo check)' && checkDefect(clean) === '', 'clean remark, no defect');

const w = signWarning(c, { a: 'pass', b: 'pass' });
ok(!!w && w.major.length === 1 && !w.notItem && !w.samePhoto, 'a major finding signed all pass is asked about');
ok(signWarning(c, { a: 'pass', b: 'fail' }) === null, 'a failed line already says it: nothing asked');
ok(!!signWarning(d, { a: 'fail' })?.notItem, 'a label that differs is asked about even with a failed line');
const dup = readPhotoCheck({ match: 'yes', same: 'samePhoto' }, item, true)!;
ok(!!signWarning(dup, {})?.samePhoto && needsLook(dup), 'the same photo again is asked about');

ok(checkRemark(c!) === 'Minor corrosion: rust at the base; Major other: pin missing. (AI photo check)', `remark in English (${checkRemark(c!)})`);
ok(checkDefect(c!) === 'Other: pin missing', 'defect from the major findings only');
ok(checkRemark(d!).includes('. Label differs from the register — serial ZX999'), 'remark names the label difference');

console.log(bad ? `\n${bad} failed` : '\nall passed');
process.exit(bad ? 1 : 0);
