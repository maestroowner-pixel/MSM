// npm run check:listsync — a record that reaches the vessel late still reaches every device: the daily whole-list read, and merging it again changes nothing.
import { FULL_PULL_MS, pullWindow } from '../services/listSync';
import { mergeById } from '../services/pms';
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const NOW = 1_800_000_000_000;

const never = pullWindow(NOW, 0, 0, 0);
ok(never.full && never.since === 0, 'a first pull reads the whole list');
const hour = pullWindow(NOW, NOW - 1000, NOW - 3_600_000, 0);
ok(!hour.full && hour.since === NOW - 1000, 'within the day: only what is newer than the mark');
const day = pullWindow(NOW, NOW - 1000, NOW - FULL_PULL_MS, 0);
ok(day.full && day.since === 0, 'after a day: the whole list, whatever the mark says');
ok(pullWindow(NOW, NOW - 1000, NOW - FULL_PULL_MS, 5000).since === 5000, 'a list kept for some days keeps its cutoff');
ok(pullWindow(NOW, 100, NOW, 5000).since === 5000, '…in the ordinary pull too');

// The late record, as seen live: older than the mark, there in the cloud.
const late = { id: 'late', updatedAt: NOW - 7_200_000 };
const mark = NOW - 1000;
ok(late.updatedAt < pullWindow(NOW, mark, NOW - 3_600_000, 0).since, 'the ordinary pull does not find it');
ok(late.updatedAt > pullWindow(NOW, mark, NOW - FULL_PULL_MS, 0).since, 'the daily read does');
ok(mergeById([], [late]).length === 1, '…and it is kept');

// Reading again changes nothing.
const mine = { id: 'a', updatedAt: 200, note: 'mine, newer' };
ok((mergeById([mine], [{ id: 'a', updatedAt: 100, note: 'older' }])[0] as any).note === 'mine, newer', 'an older copy does not replace a newer one');
ok((mergeById([mine], [{ id: 'a', updatedAt: 200, note: 'masked' }])[0] as any).note === 'mine, newer', 'nor does the same version');
ok((mergeById([mine], [{ id: 'a', updatedAt: 300, note: 'theirs' }])[0] as any).note === 'theirs', 'a newer one does');

const fb = readFileSync('services/firebaseService.ts', 'utf8');
ok(/pullWindow\(startedAt/.test(fb), 'pullList uses it');
ok(/if \(window\.full\) await AsyncStorage\.setItem\(fullKey/.test(fb), 'the day counts only once the read has worked');

console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
process.exit(fail ? 1 : 0);
