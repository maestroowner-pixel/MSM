// npm run check:sdmcrypto — the encrypted .sdm: round trip, wrong password, a changed file, what a file may demand, the file for the vessel, and the same module in all three projects.
import { decryptSdm, encryptSdm, fromB64, fromUtf8, isEncryptedSdm, isVesselFile, MIN_PASSWORD, toB64, utf8, vesselFile } from '../services/sdmCrypto';
import { parseSdm } from '../services/sdmImport';
import { randomBytes } from 'crypto';
import { existsSync, readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const rnd = (n: number) => new Uint8Array(randomBytes(n));
const code = async (p: Promise<unknown>) => { try { await p; return 'ok'; } catch (e: any) { return String(e?.message); } };

(async () => {
  const state = JSON.stringify({ personal: { firstName: 'Жан-Поль', lastName: 'Müller 李', birthDate: '1980-01-02', minDayRate: '999', photo: 'PHOTO', phone: '+1' }, biometrics: { bloodType: 'O+' }, notes: 'NOTES', education: { degree: 'BSc' }, dpDays: [1], nextOfKin: { name: 'Sam 🙂', phone: '2' }, documents: [{ id: 'a', category: 'Passport', name: 'Passport', number: 'P1', expiryDate: '2030-01-01', noExpiryDate: false, notes: 'doc note' }], seaService: [{ id: 's', vesselName: 'Ship', comments: 'bad captain', signOn: '2020-01-01' }] });
  const pw = 'correct horse батарея';

  for (const s of ['', 'a', 'ab', 'abc', 'Привет 🙂 李', 'x'.repeat(5000)]) {
    ok(fromUtf8(utf8(s)) === s, `utf8 round trip (${s.length})`);
    const b = utf8(s);
    ok(Buffer.from(toB64(b), 'base64').equals(Buffer.from(b)) && Buffer.from(fromB64(toB64(b))).equals(Buffer.from(b)), `base64 agrees with the standard (${s.length})`);
  }

  const file = await encryptSdm(state, pw, rnd);
  ok(isEncryptedSdm(file), 'recognised as encrypted');
  ok(!isEncryptedSdm(state) && !isEncryptedSdm('not json'), 'a plain file and rubbish are not');
  for (const secret of ['Müller', 'P1', 'O+', 'NOTES', 'Sam', 'firstName']) ok(!file.includes(secret), `nothing readable: ${secret}`);
  ok((await decryptSdm(file, pw)) === state, 'opens with the password, every character back');
  ok(await code(decryptSdm(file, 'wrong password!')) === 'wrong-password', 'a wrong password is refused');
  const other = await encryptSdm(state, pw, rnd);
  ok(JSON.parse(other).nonce !== JSON.parse(file).nonce && JSON.parse(other).kdf.salt !== JSON.parse(file).kdf.salt, 'a new salt and nonce every time');
  ok(JSON.parse(other).data !== JSON.parse(file).data, 'the same data never encrypts the same');

  const f = JSON.parse(file);
  const bytes = Buffer.from(f.data, 'base64'); bytes[3] ^= 1;
  ok(await code(decryptSdm(JSON.stringify({ ...f, data: bytes.toString('base64') }), pw)) === 'wrong-password', 'a changed byte is detected');
  ok(await code(decryptSdm('rubbish', pw)) === 'bad-file', 'rubbish');
  ok(await code(decryptSdm(state, pw)) === 'bad-file', 'a plain file is not decrypted');
  ok(await code(decryptSdm(JSON.stringify({ ...f, version: 2 }), pw)) === 'newer-file', 'a newer version says so');
  ok(await code(decryptSdm(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 2 ** 30 } }), pw)) === 'bad-file', 'a file cannot demand gigabytes of memory');
  ok(await code(decryptSdm(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 1000 } }), pw)) === 'bad-file', 'N must be a power of two');
  ok(await code(decryptSdm(JSON.stringify({ ...f, kdf: { ...f.kdf, r: 1024 } }), pw)) === 'bad-file', 'nor a huge r');
  ok(await code(decryptSdm(JSON.stringify({ ...f, kdf: { ...f.kdf, p: 1000 } }), pw)) === 'bad-file', 'nor a huge p');
  ok(await code(decryptSdm(JSON.stringify({ ...f, nonce: 'AAAA' }), pw)) === 'bad-file', 'a short nonce');
  ok(MIN_PASSWORD >= 12, 'a long enough password is asked for');

  const v = vesselFile(state);
  for (const secret of ['999', 'PHOTO', 'O+', 'NOTES', 'BSc', 'bad captain', 'doc note', 'dpDays', 'biometrics']) ok(!v.includes(secret), `not in the vessel's file: ${secret}`);
  ok(isVesselFile(v) && !isVesselFile(state), 'marked, so SDM will not restore it over everything');
  const parsed = parseSdm(v);
  ok((parsed.personal as any).firstName === 'Жан-Поль' && parsed.documents?.[0].number === 'P1' && (parsed.nextOfKin as any).name === 'Sam 🙂', 'this app reads what it needs from it');
  ok(!!(JSON.parse(v).seaService[0].vesselName), 'sea service goes too');
  ok((await decryptSdm(await encryptSdm(v, pw, rnd), pw)) === v, 'and it can be encrypted');

  const here = readFileSync('services/sdmCrypto.ts', 'utf8');
  for (const copy of ['/Users/Seafarer-Documents-Manager/utils/sdmCrypto.ts', '/Users/Seafarer-Documents-Manager/SDM-Web/utils/sdmCrypto.ts']) {
    if (existsSync(copy)) ok(readFileSync(copy, 'utf8') === here, `the same module: ${copy}`);
  }
  console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
  process.exit(fail ? 1 : 0);
})();
