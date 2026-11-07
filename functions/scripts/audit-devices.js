// Read-only: the device records the rules now read on every request (7 Nov 2026,
// functions/access.js). Counts them, and lists any live record the rules could not
// place — a role that is none of user / admin / superadmin / shore. Writes nothing.
//   cd functions && node scripts/audit-devices.js
const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'marine-safety-manager' });

(async () => {
  const snap = await admin.firestore().collectionGroup('devices').get();
  const rows = { total: 0, live: 0, retired: 0, switchedOff: 0, waiting: 0, shore: 0, noRole: 0 };
  const odd = [];
  for (const d of snap.docs) {
    const x = d.data();
    rows.total++;
    const live = x.approved === true && !(x.disabled === true && !x.retiredAt);
    if (live) rows.live++;
    if (x.retiredAt) rows.retired++;
    if (x.disabled === true && !x.retiredAt) rows.switchedOff++;
    if (x.approved !== true) rows.waiting++;
    if (x.role === 'shore') rows.shore++;
    if (live && !['user', 'admin', 'superadmin', 'shore'].includes(x.role)) {
      rows.noRole++;
      odd.push(`${d.ref.path} role=${x.role}`);
    }
  }
  console.log(rows);
  if (odd.length) console.log(odd.join('\n'));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
