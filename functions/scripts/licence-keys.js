// One licence key = one vessel (functions/licence.js) — support from here, admin credentials.
//
//   npm run licence -- list                 every key on the register and the vessel it belongs to
//   npm run licence -- bind-existing        put the keys vessels ALREADY hold on the register
//                                           (run once, with the deploy of licenceBind; safe to repeat)
//   npm run licence -- free <IMO>           let that vessel's key go (a ship sold, a key moved);
//                                           the vessel keeps its entitlement until the next re-check
//
// Credentials: application default (`gcloud auth application-default login`),
// or GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account key.

const admin = require('firebase-admin');
const { keyDoc } = require('../licence');

admin.initializeApp({ projectId: 'marine-safety-manager' });
const db = admin.firestore();
const hint = (k) => `${String(k).slice(0, 4)}…${String(k).slice(-4)}`;

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'list') {
    const s = await db.collection('licence_keys').get();
    for (const d of s.docs) console.log(`${d.id.slice(0, 12)}…  IMO ${d.data().vessel}  since ${new Date(d.data().boundAt).toISOString().slice(0, 10)}`);
    console.log(`${s.size} key(s).`);
    return;
  }
  if (cmd === 'bind-existing') {
    const vessels = await db.collection('safety_vessels').select('entitlement').get();
    let bound = 0, had = 0;
    const clash = [];
    for (const v of vessels.docs) {
      const key = v.get('entitlement.licenseKey');
      if (!key) continue;
      const ref = db.doc(keyDoc(key));
      const r = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists) { tx.set(ref, { vessel: v.id, boundAt: Date.now(), by: 'bind-existing' }); return 'bound'; }
        return s.data().vessel === v.id ? 'had' : s.data().vessel;
      });
      if (r === 'bound') bound++;
      else if (r === 'had') had++;
      else clash.push(`IMO ${v.id} holds ${hint(key)}, registered to IMO ${r}`);
    }
    console.log(`Registered ${bound}, already registered ${had}.`);
    for (const c of clash) console.log(`SHARED KEY: ${c}`);
    return;
  }
  if (cmd === 'free') {
    if (!/^\d{7}$/.test(arg || '')) throw new Error('npm run licence -- free <IMO>');
    const s = await db.collection('licence_keys').where('vessel', '==', arg).get();
    for (const d of s.docs) await d.ref.delete();
    console.log(`Freed ${s.size} key(s) of IMO ${arg}.`);
    return;
  }
  throw new Error('npm run licence -- list | bind-existing | free <IMO>');
}

main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
