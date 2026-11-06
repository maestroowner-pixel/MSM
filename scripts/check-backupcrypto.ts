// npm run check:backupcrypto — the .msm with a password: round trip, wrong password, a changed file, what a file may demand, a plain file untouched.
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../services/backupCrypto';

const rnd = (n: number) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  return b;
};
let failed = 0;
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '✓' : '✗'} ${what}`);
  if (!c) failed++;
};
const code = (p: Promise<unknown>) => p.then(() => 'opened', (e) => e.message);

(async () => {
  const pw = 'correct horse battery';
  const plain = JSON.stringify({ app: 'MarineSafetyManager', categories: {}, name: 'Łukasz Иванов 船 🚢 é', q: '"\\\n' });
  const file = await encryptBackup(plain, pw, rnd);
  ok(isEncryptedBackup(file), 'recognised as protected');
  ok(!isEncryptedBackup(plain) && !isEncryptedBackup('rubbish') && !isEncryptedBackup(''), 'a plain backup and rubbish are not');
  ok(!file.includes('Иванов') && !file.includes('MarineSafetyManager'), 'nothing readable in the file');
  ok((await decryptBackup(file, pw)) === plain, 'opens with the password, every character back');
  ok(await code(decryptBackup(file, 'wrong password!')) === 'wrong-password', 'a wrong password is refused');
  ok(JSON.parse(await encryptBackup(plain, pw, rnd)).data !== JSON.parse(file).data, 'the same data never encrypts the same');

  const f = JSON.parse(file);
  const flipped = (f.data[10] === 'A' ? 'B' : 'A');
  ok(await code(decryptBackup(JSON.stringify({ ...f, data: f.data.slice(0, 10) + flipped + f.data.slice(11) }), pw)) === 'wrong-password', 'a changed file is refused');
  ok(await code(decryptBackup('rubbish', pw)) === 'bad-file', 'rubbish');
  ok(await code(decryptBackup(plain, pw)) === 'bad-file', 'a plain file is not decrypted');
  ok(await code(decryptBackup(JSON.stringify({ ...f, version: 2 }), pw)) === 'newer-file', 'a newer version says so');
  ok(await code(decryptBackup(JSON.stringify({ ...f, kdf: { ...f.kdf, N: 1 << 30 } }), pw)) === 'bad-file', 'a file cannot demand gigabytes of memory');
  ok(await code(decryptBackup(JSON.stringify({ ...f, data: '***' }), pw)) === 'bad-file', 'data that is not base64');

  // Every remainder of 3 across the chunk edge of the base64, and a backup's size.
  for (const n of [8188, 8189, 8190, 8191, 16380, 16381]) {
    const s = 'x'.repeat(n);
    ok((await decryptBackup(await encryptBackup(s, pw, rnd), pw)) === s, `${n} characters`);
  }
  const mb = Number(process.env.BACKUP_MB || 8);
  const big = JSON.stringify({ files: 'QUJD'.repeat((mb * 1024 * 1024) / 4), name: 'Иванов' });
  let t0 = Date.now();
  const bigFile = await encryptBackup(big, pw, rnd);
  const enc = Date.now() - t0;
  t0 = Date.now();
  ok((await decryptBackup(bigFile, pw)) === big, `${mb} MB round trip`);
  console.log(`  encrypt ${enc} ms, decrypt ${Date.now() - t0} ms`);

  console.log(failed ? `${failed} FAILED` : 'All good');
  process.exit(failed ? 1 : 0);
})();
