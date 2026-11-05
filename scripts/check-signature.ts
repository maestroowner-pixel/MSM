// npm run check:signature — the signing PIN's hashing and rules (services/pinHash.ts).
import { createHash } from 'crypto';
import { initialsOf } from '../types/dp';
import { RESPONSIBLE_MS, codeDocId, handUnder, isValidSignPin, isWeakPin, sameCodeName, sha256, stretch } from '../services/pinHash';

let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) failed++; console.log(`${c ? '✓' : '✗'} ${m}`); };
const node = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

ok(sha256('') === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'sha256("") — standard vector');
ok(sha256('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'sha256("abc") — standard vector');
for (const s of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'Подпись · ñ · 船']) {
  ok(sha256(s) === node(s), `matches Node for length ${s.length} (padding edges, UTF-8)`);
}
ok(stretch('4821', 'aa') === stretch('4821', 'aa'), 'stretch is deterministic');
ok(stretch('4821', 'aa') !== stretch('4821', 'ab'), 'salt changes the hash');
ok(stretch('4821', 'aa') !== stretch('4822', 'aa'), 'PIN changes the hash');

ok(isValidSignPin('4821') && isValidSignPin('482193'), '4 and 6 digits valid');
ok(!isValidSignPin('482') && !isValidSignPin('4821935') && !isValidSignPin('48a1'), 'too short, too long, non-digit refused');
ok(isWeakPin('0000') && isWeakPin('1234') && isWeakPin('987654') && isWeakPin('111111'), 'repeats and runs are weak');
ok(!isWeakPin('4821') && !isWeakPin('170392'), 'ordinary PINs are not');

ok(codeDocId('1234567', '11112222') !== codeDocId('7654321', '11112222'), 'a code belongs to its vessel');
ok(!codeDocId('1234567', '11112222').includes('11112222'), 'the id does not say the code');
ok(sameCodeName('Jez', 'Jez Dodd') && sameCodeName('Jez Dodd', 'jez  dodd') && sameCodeName('Dodd Jez', 'Jez Dodd'), 'a code fits the same person however the name is written');
ok(!sameCodeName('Jez Dodd', 'Lisa Darkstein') && !sameCodeName('Jez', 'Jeremy Dodd') && !sameCodeName('', 'Jez'), 'and no one else');

ok(initialsOf('Mike Lone') === 'ML' && initialsOf(' master  nemo ') === 'MN', 'DP log initials');
const officer = { name: 'Jez Dodd', at: 1000 };
ok(handUnder(null, 'Ana Ruiz', 2000) === null, 'no hand signature before the officer has signed');
ok(handUnder(officer, 'Ana Ruiz', 2000) === 'Jez Dodd', 'then the others sign by hand under the officer');
ok(handUnder(officer, 'Jez Dodd', 2000) === null, 'the officer signs with the PIN');
ok(handUnder(officer, 'Ana Ruiz', 1000 + RESPONSIBLE_MS) === null, 'and it runs out');

const t = Date.now();
stretch('482193', 'f00d');
console.log(`  stretch took ${Date.now() - t} ms in Node`);

console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
