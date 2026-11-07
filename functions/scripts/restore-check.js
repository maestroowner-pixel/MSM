// Read-only: compares a database restored from a backup (plan item 58) with the live
// one. Every document, every collection, at any depth: counts per collection path
// (ids replaced by *), and for each document the live side has not changed since the
// snapshot, its data must be the same in both. Writes nothing.
//   cd functions && node scripts/restore-check.js restore-check 2026-11-06T19:07:36Z
const { Firestore } = require('@google-cloud/firestore');
const { isDeepStrictEqual } = require('util');

const [restoredId, snapshotIso] = process.argv.slice(2);
if (!restoredId || !snapshotIso) {
  console.error('usage: node scripts/restore-check.js <restored database> <snapshot time>');
  process.exit(1);
}
const snapshotMs = Date.parse(snapshotIso);
const projectId = 'marine-safety-manager';
const live = new Firestore({ projectId });
const restored = new Firestore({ projectId, databaseId: restoredId });

// Every document under the root, by path.
async function walk(db) {
  const docs = new Map();
  const visit = async (cols) => {
    for (const col of cols) {
      const snap = await col.get();
      // A document may exist only as a parent of subcollections; listDocuments finds those too.
      const refs = await col.listDocuments();
      const byId = new Map(snap.docs.map((d) => [d.id, d]));
      for (const ref of refs) {
        const d = byId.get(ref.id);
        if (d) docs.set(ref.path, { data: d.data(), updated: d.updateTime.toMillis(), created: d.createTime.toMillis() });
        await visit(await ref.listCollections());
      }
    }
  };
  await visit(await db.listCollections());
  return docs;
}

const shape = (path) => path.split('/').map((p, i) => (i % 2 ? '*' : p)).join('/');

(async () => {
  const [a, b] = await Promise.all([walk(live), walk(restored)]);
  const counts = new Map();
  const bump = (path, k) => {
    const s = shape(path);
    const c = counts.get(s) || { live: 0, restored: 0 };
    c[k]++;
    counts.set(s, c);
  };
  for (const p of a.keys()) bump(p, 'live');
  for (const p of b.keys()) bump(p, 'restored');

  let same = 0, changedSince = 0, createdSince = 0;
  const missing = [], differ = [], extra = [];
  for (const [p, d] of a) {
    const r = b.get(p);
    if (d.created > snapshotMs) { createdSince++; continue; }
    if (d.updated > snapshotMs) { changedSince++; continue; }
    if (!r) missing.push(p);
    else if (isDeepStrictEqual(JSON.parse(JSON.stringify(d.data)), JSON.parse(JSON.stringify(r.data)))) same++;
    else differ.push(p);
  }
  // In the backup, gone from live since: deleted after the snapshot (expected) — counted, not an error.
  for (const p of b.keys()) if (!a.has(p)) extra.push(p);

  console.log(`live ${a.size} documents, restored ${b.size}; snapshot ${snapshotIso}`);
  console.log(`unchanged since the snapshot and identical: ${same}`);
  console.log(`changed since: ${changedSince}, created since: ${createdSince}, deleted since (only in the backup): ${extra.length}`);
  console.log(`MISSING from the backup: ${missing.length}, DIFFERENT though unchanged: ${differ.length}`);
  for (const p of [...missing, ...differ].slice(0, 20)) console.log('  ' + p);
  console.log('\ncollection path                                   live  restored');
  for (const [s, c] of [...counts].sort((x, y) => x[0].localeCompare(y[0]))) {
    console.log(`${s.padEnd(48)} ${String(c.live).padStart(5)} ${String(c.restored).padStart(9)}`);
  }
  process.exit(missing.length || differ.length ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
