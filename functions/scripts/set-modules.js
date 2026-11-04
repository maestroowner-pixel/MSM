// Set the vessel's module flags on safety_vessels/<IMO> (firestore.rules
// refuses this field to any client — only an admin credential may write it).
//
// Example: `npm run modules -- 9967093 off dp`              (DreamBoat has no DP)
//          `npm run modules -- 1234567 on threads`
//          `npm run modules -- 1234567 default threads`  (back to what the build says)
//          `npm run modules -- 1234567 all`
//          `npm run modules -- 9967093 all --except dp,dpEditor`
//
// `on` and `off` say so for this vessel whatever the build says; `off` takes away
// even a module released for everybody (constants/modules.ts). The app before
// 2.72 ignores `off` and goes by the build.
//
// Credentials: application default (`gcloud auth application-default login`),
// or GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key.

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const PROJECT = 'marine-safety-manager';

/** The complete list of module keys, read from constants/modules.ts. */
function allKeys() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'constants', 'modules.ts'), 'utf8');
  const m = src.match(/export type ModuleKey = ([^;]+);/);
  if (!m) throw new Error('ModuleKey not found in constants/modules.ts');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function parseArgs(argv) {
  const a = argv.slice(2);
  if (a.length < 2) usage();
  const imo = a[0].replace(/\D/g, '');
  if (!imo) usage('IMO must be digits');
  const op = a[1].toLowerCase();
  if (!['all', 'on', 'off', 'default'].includes(op)) usage('Unknown op: ' + op);
  const i = a.indexOf('--except');
  const names = (i >= 0 ? a.slice(2, i).concat(a.slice(i + 1)) : a.slice(2))
    .flatMap((s) => s.split(/[\s,]+/))
    .filter(Boolean);
  const except = (i >= 0 ? a.slice(i + 1) : []).flatMap((s) => s.split(/[\s,]+/)).filter(Boolean);
  return { imo, op, names, except };
}

function usage(msg) {
  if (msg) console.error('Error: ' + msg + '\n');
  console.error('Usage: npm run modules -- <IMO> all [--except key1,key2]');
  console.error('       npm run modules -- <IMO> on  key1,key2 …');
  console.error('       npm run modules -- <IMO> off key1,key2 …');
  console.error('       npm run modules -- <IMO> default key1,key2 …');
  process.exit(1);
}

async function main() {
  const { imo, op, names, except } = parseArgs(process.argv);
  const keys = allKeys();
  const unknown = [...names, ...except].filter((k) => !keys.includes(k));
  if (unknown.length) usage('Unknown module key(s): ' + unknown.join(', '));

  admin.initializeApp({ projectId: PROJECT });
  const ref = admin.firestore().doc(`safety_vessels/${imo}`);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`safety_vessels/${imo} does not exist`);
  const current = snap.get('modules') || {};

  let next;
  if (op === 'all') next = Object.fromEntries(keys.map((k) => [k, !except.includes(k)]));
  else if (op === 'on') next = { ...current, ...Object.fromEntries(names.map((k) => [k, true])) };
  else if (op === 'off') next = { ...current, ...Object.fromEntries(names.map((k) => [k, false])) };
  else {
    next = { ...current };
    for (const k of names) delete next[k];
  }

  const changed = diff(current, next);
  if (!changed.length) {
    console.log(`safety_vessels/${imo}: already as requested, nothing to change.`);
    return;
  }
  // update, not set with merge: merge keeps a key that is gone from the map.
  await ref.update({ modules: next });
  console.log(`safety_vessels/${imo}: modules updated.`);
  for (const [k, from, to] of changed) console.log(`  ${k}: ${from} → ${to}`);
  if (next.lifting === false) console.log('  Note: lifting: false does not take effect on the phones (constants/modules.ts).');
}

const word = (v) => (v === undefined ? 'default' : v ? 'on' : 'off');

function diff(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out = [];
  for (const k of keys) if (a[k] !== b[k]) out.push([k, word(a[k]), word(b[k])]);
  return out.sort((x, y) => x[0].localeCompare(y[0]));
}

main().catch((e) => {
  console.error(e.message || e);
  if (/credentials/i.test(String(e))) console.error('Hint: `gcloud auth application-default login` and try again.');
  process.exit(1);
});
