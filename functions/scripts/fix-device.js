// Revive a disabled device on a vessel (or list all devices).
// Usage:
//   npm run fix:device -- 1234567 list
//   npm run fix:device -- 1234567 revive <deviceId>
//   npm run fix:device -- 1234567 revive-all-nemo

const admin = require('firebase-admin');

const PROJECT = 'marine-safety-manager';
const ROOT = 'safety_vessels';

const args = process.argv.slice(2);
const IMO = args[0];
const CMD = args[1];
const TARGET = args[2];

if (!IMO || !CMD) {
  console.error('Usage: npm run fix:device -- <IMO> list|revive <id>|revive-all-nemo');
  process.exit(1);
}

admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();
const { FieldValue } = require('firebase-admin/firestore');

async function run() {
  const col = db.collection(`${ROOT}/${IMO}/devices`);
  const snap = await col.get();
  const devices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (CMD === 'list') {
    console.log(`\nDevices on vessel ${IMO} (${devices.length} total):\n`);
    for (const d of devices.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0))) {
      const name = [d.firstName, d.lastName].filter(Boolean).join(' ') || '(unnamed)';
      const status = d.disabled ? (d.retiredAt ? `retired ${new Date(d.retiredAt).toISOString().slice(0, 10)}` : 'SWITCHED OFF') : d.approved ? 'active' : 'pending';
      const seen = d.lastSeenAt ? new Date(d.lastSeenAt).toISOString().slice(0, 10) : 'never';
      console.log(`  ${d.id}  ${name.padEnd(20)} ${d.role?.padEnd(12)} ${(d.platform ?? '?').padEnd(8)} seen:${seen}  [${status}]`);
    }
    console.log('');
    return;
  }

  if (CMD === 'revive') {
    if (!TARGET) { console.error('revive requires a device id'); process.exit(1); }
    await col.doc(TARGET).update({ disabled: false, retiredAt: FieldValue.delete(), retiredFor: FieldValue.delete() });
    console.log(`✅  Revived device ${TARGET}`);
    return;
  }

  if (CMD === 'revive-all-nemo') {
    const nemo = devices.filter((d) => d.disabled && d.firstName === 'Master' && d.lastName === 'Nemo');
    if (!nemo.length) { console.log('No disabled Master Nemo devices found.'); return; }
    for (const d of nemo) {
      await col.doc(d.id).update({ disabled: false, retiredAt: FieldValue.delete(), retiredFor: FieldValue.delete() });
      console.log(`✅  Revived ${d.id}  (platform: ${d.platform ?? '?'})`);
    }
    return;
  }

  console.error(`Unknown command: ${CMD}`);
  process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
