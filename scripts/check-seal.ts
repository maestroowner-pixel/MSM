// npm run check:seal — signatures bound to the record (services/seal), the chain
// of hashes, the Master's sealed verification and the signed offline copy
// (services/signedCopy; MEPC.312(74) §4.3.3, §4.4.3–4.4.4).
import { randomBytes } from 'crypto';
import { bookIntegrity, canonical, chainGaps, chainHead, checkRecord, contentHash, coverHashes, coversIntact, keyIdOf, privateFrom, publicOf, sealHash, setKeyRegister, SignKeyRec } from '../services/seal';
import { integrityLines, monthIntegrity, signerCell } from '../services/verification';
import { amended } from '../services/versions';
import { checkCopy, copyFiles, copyManifest, zipCopy } from '../services/signedCopy';
import { trueCopyDoc } from '../services/trueCopy';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const T = (d: string, h = '10:00') => Date.parse(`${d}T${h}:00Z`);
const key = () => privateFrom(new Uint8Array(randomBytes(32)))!;

const ivan = key();
const master = key();
const device = key();
const reg = (priv: Uint8Array, person: string, kind: 'person' | 'device' = 'person'): SignKeyRec => ({ id: keyIdOf(publicOf(priv)), person, name: person, kind, pub: publicOf(priv), at: T('2026-10-01'), updatedAt: 0 });
const keys = [reg(ivan, 'crew-1'), reg(master, 'device:m1'), reg(device, 'dev:d1', 'device')];

// What a screen does: build the record, then seal it into its proof (components/SignConfirm withSeal).
const sealIn = <T extends object>(r: T, priv: Uint8Array, field: 'signedWith' | 'editedWith' = 'signedWith', kind: 'person' | 'device' = 'person'): T => ({ ...r, [field]: { ...((r as any)[field] ?? { method: 'pin', at: 1 }), seal: sealHash(priv, contentHash(r), kind) } });

// ---- hashing ----
ok(canonical({ b: 1, a: [2, { d: undefined, c: 'x' }] }) === '{"a":[2,{"c":"x"}],"b":1}', 'canonical JSON: keys sorted, undefined dropped');
const e1: any = sealIn({ id: 'o1', date: '2026-10-02', code: 'D', text: '13. 2 m³ from bilge', by: 'C/E Ivan', byId: 'crew-1', at: T('2026-10-02'), updatedAt: 5 }, ivan);
ok(contentHash({ ...e1, updatedAt: 999, signedWith: { method: 'drawn' } }) === contentHash(e1), 'sync time and the proof are outside the hash');
ok(contentHash({ ...e1, text: 'x' }) !== contentHash(e1), 'the words are inside it');

// ---- a record's seal ----
ok(checkRecord(e1, keys) === 'valid', 'a sealed entry checks valid against the register');
ok(checkRecord({ ...e1, text: '13. 0.2 m³ from bilge' }, keys) === 'altered', 'changing the words after signing shows');
ok(checkRecord(JSON.parse(JSON.stringify(e1)), keys) === 'valid', 'a round trip through JSON (sync) keeps it valid');
const forged = { ...e1, signedWith: { ...e1.signedWith, seal: { ...e1.signedWith.seal, sig: e1.signedWith.seal.sig.replace(/^./, (c: string) => (c === '0' ? '1' : '0')) } } };
ok(checkRecord(forged, keys) === 'badSig', 'a broken signature shows');
const stranger = key();
const e1x = sealIn({ ...e1, signedWith: undefined }, stranger);
ok(checkRecord(e1x, keys) === 'unknownKey', 'a key not in the register for the signer shows');
ok(checkRecord(sealIn({ ...e1, byId: 'crew-9', signedWith: undefined }, ivan), keys) === 'unknownKey', "Ivan's key does not sign for someone else");
ok(checkRecord(e1x) === 'valid', 'without a register the signature alone is checked');
ok(checkRecord({ id: 'old', at: 1, by: 'x' }) === 'none', 'a pre-2.69 record has no seal');
const drawn = sealIn({ id: 'o9', date: '2026-10-03', text: 'by hand', by: '3/E', byId: 'crew-3', at: T('2026-10-03') }, device, 'signedWith', 'device');
ok(checkRecord(drawn, keys) === 'device', 'signed by hand → sealed by the device');

// ---- the chain ----
const e2: any = sealIn({ id: 'o2', date: '2026-10-05', code: 'C', text: 'second', by: 'C/E Ivan', byId: 'crew-1', at: T('2026-10-05'), prev: chainHead([e1]) }, ivan);
const e3: any = sealIn({ id: 'o3', date: '2026-10-06', code: 'I', text: 'third', by: 'C/E Ivan', byId: 'crew-1', at: T('2026-10-06'), prev: chainHead([e1, e2]) }, ivan);
ok(e2.prev === contentHash(e1) && e3.prev === contentHash(e2), 'each entry points at the hash of the one before');
ok(chainGaps([e1, e2, e3]).length === 0, 'the whole book: no gaps');
ok(chainGaps([e1, e3]).map((r) => r.id).join() === 'o3', 'an entry taken out leaves the next pointing at nothing');

// ---- an amendment ----
let a2: any = amended(e2, { text: 'second, corrected' }, 'o2b', 'wrong tank', { name: 'Master', id: 'device:m1', proof: { method: 'pin', at: 2 } }, T('2026-10-07'));
a2 = sealIn({ ...a2, prev: chainHead([e1, e2, e3]) }, master, 'editedWith');
ok(checkRecord(a2, keys) === 'valid', "an amendment is checked against the amender's seal and key");
ok(checkRecord({ ...a2, editedWith: undefined }, keys) === 'none', "the original's seal does not speak for an amendment");
ok(chainGaps([e1, e2, e3, a2]).length === 0, 'the amendment joins the chain');

// ---- the Master's verification ----
const all = [e1, e2, e3, a2];
const v: any = sealIn({ id: 'orb_2026-10', month: '2026-10', by: 'Master', byId: 'device:m1', at: T('2026-10-08'), covers: ['o1', 'o3', 'o2b'], coverHashes: coverHashes(['o1', 'o3', 'o2b'], all) }, master);
ok(checkRecord(v, keys) === 'valid' && coversIntact(v, all), 'the verification is sealed over the hashes it covers');
ok(!coversIntact(v, [e1, e2, { ...e3, text: 'swapped' }, a2]), 'a covered entry changed later breaks the verification');
const it = bookIntegrity(all, [v], keys);
ok(it.sealed === 4 && !it.bad.length && !it.gaps.length && !it.badVerifications.length, 'the book at a glance: 4 sealed, nothing wrong');

// ---- the printed copy ----
setKeyRegister(keys);
ok(/Sealed, key [0-9A-F-]{19}: signature valid/.test(signerCell(e1)), 'the copy prints the seal and its key under the signer');
setKeyRegister([]);
ok(/NOT IN THE KEY REGISTER/.test(signerCell(e1)), 'a key missing from the register is printed as such');
setKeyRegister(keys);
const mi = monthIntegrity([e1, e3, a2], all, [v], '2026-10');
const lines = integrityLines(mi);
ok(lines.some((l) => /4 of 4 records sealed/.test(l)) && lines.some((l) => /unbroken/.test(l)), `integrity paragraph: ${lines.join(' / ')}`);
const badLines = integrityLines(monthIntegrity([e1, { ...e3, text: 'x' }], [e1, { ...e3, text: 'x' }], [], '2026-10'));
ok(badLines.some((l) => /^WARNING: 1 record does not match/.test(l)) && badLines.some((l) => /chain of hashes broken/.test(l)), 'a changed entry and the gap it leaves are printed as warnings');
const pdf = trueCopyDoc({ title: 'Oil Record Book — Part I · October 2026', subtitle: 'MV Test', vessel: 'MV Test', orientation: 'portrait', head: ['Date', 'Text', 'Officer'], rows: [['02.10.2026', 'x', signerCell(e1)]], struck: [false], verifications: [], integrity: lines });
ok(pdf.getNumberOfPages() >= 1, 'the true copy still draws with the seal lines');

// ---- the Master's signed copy ----
void (async () => {
  const pdfBytes = new Uint8Array(pdf.output('arraybuffer'));
  const records = { entries: all, verifications: [v], keys, access: [] };
  const files = copyFiles('ORB_2026-10.pdf', pdfBytes, records);
  const m = copyManifest({ book: 'orb', title: 'Oil Record Book — Part I · October 2026', month: '2026-10', vessel: { name: 'MV Test', imo: '1234567' }, exportedAt: T('2026-10-09'), master: { name: 'Master', id: 'device:m1', key: keyIdOf(publicOf(master)) } }, files);
  const seal = sealHash(master, contentHash(m), 'person');
  const zip = await zipCopy(files, m, seal, 'uint8array');
  const good = await checkCopy(zip);
  ok(good.ok, `the signed copy checks: ${good.problems.join('; ') || 'intact'}`);
  ok((await checkCopy(await zipCopy(files, m, seal, 'base64'))).ok, 'the same copy as base64 (a phone) checks');

  const JSZip = require('jszip');
  const tamper = async (fn: (z: any) => void) => {
    const z = await JSZip.loadAsync(zip);
    fn(z);
    return checkCopy(await z.generateAsync({ type: 'uint8array' }));
  };
  const r1 = await tamper((z) => z.file('records.json', JSON.stringify({ ...records, entries: [{ ...e1, text: 'nothing' }, e2, e3, a2] })));
  ok(!r1.ok && r1.problems.some((p) => /records.json was changed/.test(p)), 'an edited records.json fails');
  const r2 = await tamper((z) => z.file('manifest.json', canonical({ ...m, files: { ...m.files, 'records.json': contentHash({}) } })));
  ok(!r2.ok && r2.problems.some((p) => /manifest was changed/.test(p)), 'a manifest rewritten to match fails on the seal');
  const r3 = await tamper((z) => z.remove('ORB_2026-10.pdf'));
  ok(!r3.ok && r3.problems.some((p) => /missing/.test(p)), 'a file taken out fails');
  const other = key();
  const r4 = await tamper((z) => z.file('manifest.seal.json', JSON.stringify(sealHash(other, contentHash(m), 'person'))));
  ok(!r4.ok && r4.problems.some((p) => /not the Master's key/.test(p)), "a manifest re-signed with another key fails");
  ok(!(await checkCopy(new Uint8Array([1, 2, 3]))).ok, 'not a ZIP → refused');

  console.log(fail ? `\n${fail} FAILED` : '\nall seal checks passed');
  process.exit(fail ? 1 : 0);
})();
