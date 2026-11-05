// npm run check:reset — "erase this device" leaves nothing behind by accident: every storage key is in resetAllData or named in NOT_RESET, and every list that syncs is erased.
import { readFileSync } from 'fs';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const src = readFileSync('services/storage.ts', 'utf8');
const keys = [...src.matchAll(/export const (\w+_KEY)\b/g)].map((m) => m[1]);
const a = src.indexOf('export async function resetAllData');
const body = src.slice(a, src.indexOf('multiRemove', a));
const kept = [...src.slice(src.indexOf('export const NOT_RESET'), a).matchAll(/'(\w+_KEY)'/g)].map((m) => m[1]);
const has = (k: string) => new RegExp(`\\b${k}\\b`).test(body);

ok(keys.length > 100 && kept.length > 0, `${keys.length} keys found, ${kept.length} kept`);
for (const k of keys) if (!has(k) && !kept.includes(k)) ok(false, `${k} is neither erased nor named in NOT_RESET`);
for (const k of kept) ok(!has(k), `${k} is kept, so not erased as well`);
for (const k of ['DA_RESULTS_KEY', 'APPRAISALS_KEY', 'THREADS_KEY', 'CREW_PRIVATE_KEY', 'PASSENGERS_PRIVATE_KEY', 'MED_TREATMENTS_KEY']) ok(has(k), `${k} is erased`);

// A list that syncs can be got back by rejoining, so nothing excuses leaving it behind.
const fb = readFileSync('services/firebaseService.ts', 'utf8');
const synced = [...fb.slice(fb.indexOf('const SYNCED_LISTS'), fb.indexOf('];', fb.indexOf('const SYNCED_LISTS'))).matchAll(/key: storage\.(\w+_KEY)/g)].map((m) => m[1]);
ok(synced.length > 40, `${synced.length} synced lists found`);
for (const k of synced) if (!has(k)) ok(false, `${k} syncs and must be erased`);

// Leaving with an erase forgets the sync marks; an ordinary reset on a vessel does not.
const enrol = readFileSync('screens/EnrolSc.tsx', 'utf8');
for (const [k, sub] of [['DECK_LOG_KEY', 'deck_log'], ['GMDSS_KEY', 'gmdss'], ['ORDER_GROUPS_KEY', 'order_groups'], ['GALLEY_ORDERS_KEY', 'galley_orders']]) {
  ok(synced.includes(k), `${k} syncs, so a lost device does not lose it`);
  ok(new RegExp(`match /${sub}/`).test(readFileSync('firestore.rules', 'utf8')), `rules for ${sub}`);
  ok(new RegExp(`storage\\.${k}`).test(readFileSync('services/backup.ts', 'utf8')), `${k} is in the .msm backup`);
}
ok(/resetAllData\(\);\s*await fb\.forgetSyncMarks\(\)/.test(enrol), 'leaving with an erase forgets the sync marks');
ok(!/forgetSyncMarks/.test(readFileSync('screens/SettingsSc.tsx', 'utf8')), 'a reset on a syncing device does not pull every list straight back');

console.log(fail ? `\n${fail} FAILED` : '\nAll passed');
process.exit(fail ? 1 : 0);
