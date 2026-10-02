/*
 * Register sync scenarios (services/registerMerge.ts) — one vessel, several devices.
 *
 * The bug this guards against (14 Sep 2026): "all of the equipment keeps deleting
 * itself when I open the app on a phone, or switch back to the website". Every
 * device pushed its local register over the vessel's on connect and on every
 * return to the foreground. These scenarios drive the same decisions the app
 * makes (decidePull / decidePush / mergeRegister) through a tiny in-memory vessel,
 * with the same glue firebaseService applies, and check that nobody's equipment
 * disappears.
 *
 *   npm run check:sync
 */
import {
  RegisterParts,
  SyncBase,
  decidePull,
  decidePush,
  foreignKeys,
  itemCount,
  mergeRegister,
  outgoingRegister,
  partHashes,
} from '../services/registerMerge';
import { EquipmentItem } from '../types/equipment';

let fails = 0;
const ok = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log('FAIL  ' + name + (extra ? ' :: ' + extra : '')); }
  else console.log('pass  ' + name);
};

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
let clock = 1000;

interface Vessel { at: number; json: string | null }
interface Device { name: string; local: RegisterParts; base: SyncBase | null }

const vessel: Vessel = { at: 0, json: null };
const cloud = (): RegisterParts | null => (vessel.json ? JSON.parse(vessel.json) : null);

class Conflict extends Error {}

/** firebaseService.pullRegister, minus Firestore. Returns needsPush. */
function pull(d: Device): boolean {
  const c = cloud();
  if (!c) return itemCount(d.local) > 0;
  const dec = decidePull(d.base, d.local, vessel.at, c);
  if (dec.kind === 'current') return dec.needsPush;
  if (dec.kind === 'refuse-empty') return true;
  if (dec.kind === 'take') {
    d.local = clone(c);
    d.base = { cloudAt: vessel.at, cloudJson: vessel.json!, local: partHashes(d.local) };
    return false;
  }
  d.local = mergeRegister(d.base ? JSON.parse(d.base.cloudJson) : { categories: {} }, d.local, c, dec.changed);
  d.base = { cloudAt: vessel.at, cloudJson: vessel.json!, local: partHashes(c) };
  return true;
}

/** firebaseService.pushAll: decision on a READ, then a compare-and-set WRITE. */
function push(d: Device, readAt = vessel.at, readCloud = cloud(), force = false): void {
  const dec = decidePush(d.base, d.local, readAt, readCloud, force);
  if (dec === 'skip') return;
  if (dec === 'conflict') throw new Conflict();
  if (!force && vessel.at !== readAt) throw new Conflict(); // the transaction
  vessel.at = ++clock;
  vessel.json = JSON.stringify(d.local);
  d.base = { cloudAt: vessel.at, cloudJson: vessel.json, local: partHashes(d.local) };
}

/** SyncContext.pushNow: pull first, push if needed, go round again on conflict. */
function sync(d: Device): void {
  for (let i = 0; i < 3; i++) {
    if (!pull(d)) return;
    try { push(d); return; } catch (e) { if (!(e instanceof Conflict)) throw e; }
  }
  throw new Error('sync did not settle');
}

const item = (id: string, type: string, at = 1): EquipmentItem => ({ id, category: 'fire_extinguishers', type, updatedAt: at });
const reg = (...items: EquipmentItem[]): RegisterParts => ({ categories: { fire_extinguishers: items } });
const ids = (d: Device) => (d.local.categories.fire_extinguishers ?? []).map((i) => i.id).sort().join(',');
const typeOf = (d: Device, id: string) => d.local.categories.fire_extinguishers?.find((i) => i.id === id)?.type;
const vesselIds = () => (cloud()?.categories.fire_extinguishers ?? []).map((i) => i.id).sort().join(',');

// --- 1. The reported failure: a stale phone joins a vessel run from the website ---
const full = reg(...Array.from({ length: 20 }, (_, i) => item(`fe${i}`, 'Dry powder')));
const web: Device = { name: 'web', local: clone(full), base: null };
sync(web);
ok('website with the register sends it to an empty vessel', itemCount(cloud()) === 20);

const phone: Device = { name: 'phone', local: reg(item('old1', 'Test'), item('old2', 'Test')), base: null };
sync(phone);
ok('a phone with its own register does NOT overwrite the vessel', vesselIds().split(',').filter((x) => x.startsWith('fe')).length === 20, vesselIds());
ok('…the two are united — nothing on either side is lost', itemCount(phone.local) === 22 && itemCount(cloud()) === 22);
sync(web);
ok('…and the website receives the union', itemCount(web.local) === 22);
// The two test items were meant to be gone: deleting them is an ordinary edit.
phone.local.categories.fire_extinguishers = phone.local.categories.fire_extinguishers.filter((i) => !i.id.startsWith('old'));
sync(phone); sync(web);
ok('…and deleting the stray items afterwards sticks', itemCount(cloud()) === 20 && itemCount(web.local) === 20);

// The migration case: the WEBSITE holds the good register, the vessel holds a
// phone's partial one, and neither has a base yet (first sync after updating).
{
  const v0 = { at: vessel.at, json: vessel.json };
  vessel.at = ++clock;
  vessel.json = JSON.stringify(reg(item('fe0', 'Dry powder'), item('fe1', 'Dry powder')));
  const goodWeb: Device = { name: 'good web', local: clone(full), base: null };
  sync(goodWeb);
  ok('migration: a website with the full register and no base loses nothing to a partial vessel copy',
     itemCount(goodWeb.local) === 20 && itemCount(cloud()) === 20);
  vessel.at = v0.at; vessel.json = v0.json;
}

const empty: Device = { name: 'empty phone', local: reg(), base: null };
sync(empty);
ok('an empty phone joining does not empty the vessel', itemCount(cloud()) === 20);
ok('…and receives the register', itemCount(empty.local) === 20);

const before = vessel.at;
for (let i = 0; i < 5; i++) { sync(web); sync(phone); sync(empty); }
ok('opening the app and switching tabs, unchanged, writes nothing', vessel.at === before);
sync(empty);
ok('…and nothing disappears anywhere', [web, phone, empty].every((d) => itemCount(d.local) === 20));

// --- 2. Edits on two devices at once ---
web.local.categories.fire_extinguishers[0] = item('fe0', 'Dry powder 6kg', 50);
phone.local.categories.fire_extinguishers[1] = item('fe1', 'CO2 5kg', 60);
sync(web);
sync(phone);
sync(web);
ok('an edit on each device: both survive on the vessel',
   cloud()!.categories.fire_extinguishers.find((i) => i.id === 'fe0')?.type === 'Dry powder 6kg' &&
   cloud()!.categories.fire_extinguishers.find((i) => i.id === 'fe1')?.type === 'CO2 5kg');
ok('…and on both devices', typeOf(web, 'fe1') === 'CO2 5kg' && typeOf(phone, 'fe0') === 'Dry powder 6kg');

// --- 3. Delete here, edit there ---
sync(empty);
web.local.categories.fire_extinguishers = web.local.categories.fire_extinguishers.filter((i) => i.id !== 'fe2');
phone.local.categories.fire_extinguishers = phone.local.categories.fire_extinguishers.map((i) => (i.id === 'fe3' ? item('fe3', 'Foam', 70) : i));
sync(phone); sync(web); sync(phone); sync(empty);
ok('a deletion on one device and an edit of another item on the other both hold',
   !vesselIds().split(',').includes('fe2') && cloud()!.categories.fire_extinguishers.find((i) => i.id === 'fe3')?.type === 'Foam');
ok('…everywhere', [web, phone, empty].every((d) => !ids(d).split(',').includes('fe2') && typeOf(d, 'fe3') === 'Foam'));

// --- 4. Delete there, edit the SAME item here: the edit wins ---
web.local.categories.fire_extinguishers = web.local.categories.fire_extinguishers.filter((i) => i.id !== 'fe4');
phone.local.categories.fire_extinguishers = phone.local.categories.fire_extinguishers.map((i) => (i.id === 'fe4' ? item('fe4', 'Repaired', 80) : i));
sync(web); sync(phone); sync(web);
ok('an item edited on one device survives its deletion on another', typeOf(web, 'fe4') === 'Repaired' && typeOf(phone, 'fe4') === 'Repaired');

// --- 5. Added on both ---
web.local.categories.fire_extinguishers.push(item('w-new', 'Web added', 90));
phone.local.categories.fire_extinguishers.push(item('p-new', 'Phone added', 91));
sync(phone); sync(web); sync(phone);
ok('items added on two devices at once are all kept', ['w-new', 'p-new'].every((x) => vesselIds().includes(x) && ids(web).includes(x) && ids(phone).includes(x)));

// --- 6. A race: two devices read the same vessel copy, both try to write ---
web.local.categories.fire_extinguishers.push(item('race-w', 'W', 100));
phone.local.categories.fire_extinguishers.push(item('race-p', 'P', 101));
pull(web); pull(phone);
const readAt = vessel.at; const readCloud = cloud();
push(phone, readAt, readCloud);
let raced = false;
try { push(web, readAt, readCloud); } catch (e) { raced = e instanceof Conflict; }
ok('the second writer on the same read is refused, not landed on top', raced);
sync(web); sync(phone);
ok('…and after going round again both items are on the vessel', vesselIds().includes('race-w') && vesselIds().includes('race-p'));

// --- 7. A deliberate reset on a synced device empties the vessel, and others follow ---
sync(empty);
web.local = reg();
sync(web);
ok('clearing on a synced device clears the vessel', itemCount(cloud()) === 0);
sync(phone); sync(empty);
ok('…and a device with nothing unsent follows it', itemCount(phone.local) === 0 && itemCount(empty.local) === 0);

// --- 8. A device that never synced keeps its items against an empty vessel ---
const lone: Device = { name: 'lone', local: reg(item('x', 'Kept')), base: null };
sync(lone);
ok('an empty vessel does not wipe a new device — its items go up', itemCount(cloud()) === 1 && itemCount(lone.local) === 1);

// --- 9. Restore (force) replaces the vessel on purpose ---
const restorer: Device = { name: 'restore', local: reg(item('r1', 'Restored'), item('r2', 'Restored')), base: clone(lone.base) };
push(restorer, vessel.at, cloud(), true);
sync(lone);
ok('a forced restore replaces the vessel register, and others take it', vesselIds() === 'r1,r2' && ids(lone) === 'r1,r2');


// --- an item that moved category (services/storage `moveItem`) ---------------
//
// A move is a delete from one bucket and an insert into another, and the merge
// runs per bucket — so the case that matters is the OTHER device editing that
// item in its old category before it hears about the move. Without the cross-
// category pass the item survives in both and the grid shows it twice.
{
  const at = (n: number) => ({ updatedAt: n });
  const item = (id: string, n: number, extra: any = {}) => ({ id, ...at(n), ...extra } as any);

  const base = { categories: { lsa: [item('a', 100)], lifting: [] } } as any;
  // here: moved a -> lifting at t=200
  const mine = { categories: { lsa: [], lifting: [item('a', 200, { category: 'lifting' })] } } as any;
  // there: edited a in place at t=150, never saw the move
  const theirs = { categories: { lsa: [item('a', 150, { position: 'Locker' })], lifting: [] } } as any;

  const merged = mergeRegister(base, mine, theirs, { categories: true } as any);
  const where = Object.entries(merged.categories)
    .filter(([, v]: any) => (v as any[]).some((x) => x.id === 'a'))
    .map(([k]) => k);
  ok('a moved item lands in exactly one category', where.length === 1, where.join(','));
  ok('…and it is the one it moved to', where[0] === 'lifting', where[0]);

  // and the other way round: an edit made AFTER the move wins the item back
  const later = { categories: { lsa: [item('a', 300, { position: 'Locker' })], lifting: [] } } as any;
  const merged2 = mergeRegister(base, mine, later, { categories: true } as any);
  const where2 = Object.entries(merged2.categories)
    .filter(([, v]: any) => (v as any[]).some((x) => x.id === 'a'))
    .map(([k]) => k);
  ok('a later edit keeps it where that device had it', where2.join() === 'lsa', where2.join());

  // nothing else is disturbed
  const plain = mergeRegister(
    { categories: { lsa: [item('b', 1)] } } as any,
    { categories: { lsa: [item('b', 2)] } } as any,
    { categories: { lsa: [item('b', 1)] } } as any,
    { categories: true } as any
  );
  ok('an ordinary edit still merges normally', (plain.categories as any).lsa[0].updatedAt === 2);
}


// --- A build that does not know every category (30 Sep 2026) ------------------
//
// The vessel runs devices that disagree about which categories exist: a module on
// in one build and off in another (constants/modules.ts), or a vessel category
// made an hour ago and not yet received. The device that cannot NAME a bucket
// must still carry it — before this, its register said those categories did not
// exist and the next pull deleted them for the whole ship. Modelled here with the
// same glue firebaseService applies: `localRegister` (outgoingRegister) on the way
// out, `writeLocalRegister` (foreignKeys) on the way in.
{
  const v0 = { at: vessel.at, json: vessel.json };
  vessel.at = 0;
  vessel.json = null;

  const BUILTIN = ['fire_extinguishers'];
  interface Build extends Device { knows: string[]; foreign: Record<string, EquipmentItem[]> }

  /** storage.loadAll + storage.loadForeignBuckets, as localRegister joins them. */
  const outgoing = (d: Build): RegisterParts => {
    const own: Record<string, EquipmentItem[]> = {};
    for (const k of d.knows) own[k] = d.local.categories?.[k] ?? [];
    return outgoingRegister({ ...d.local, categories: own }, d.foreign);
  };
  /** writeLocalRegister: write every bucket, remember the ones it cannot name. */
  const incoming = (d: Build, blob: RegisterParts) => {
    d.local = clone(blob);
    d.foreign = {};
    for (const k of foreignKeys(d.knows, blob)) d.foreign[k] = clone(blob.categories[k]);
  };

  const syncBuild = (d: Build) => {
    for (let i = 0; i < 3; i++) {
      const c = cloud();
      const mineOut = outgoing(d);
      if (c) {
        const dec = decidePull(d.base, mineOut, vessel.at, c);
        if (dec.kind === 'take') { incoming(d, c); d.base = { cloudAt: vessel.at, cloudJson: vessel.json!, local: partHashes(outgoing(d)) }; return; }
        if (dec.kind === 'merge') {
          const merged = mergeRegister(d.base ? JSON.parse(d.base.cloudJson) : { categories: {} }, mineOut, c, dec.changed);
          incoming(d, merged);
          d.base = { cloudAt: vessel.at, cloudJson: vessel.json!, local: partHashes(c) };
        } else if (dec.kind === 'current' && !dec.needsPush) return;
      }
      const out = outgoing(d);
      const pd = decidePush(d.base, out, vessel.at, cloud(), false);
      if (pd === 'skip') return;
      if (pd === 'write') {
        vessel.at = ++clock;
        vessel.json = JSON.stringify(out);
        d.base = { cloudAt: vessel.at, cloudJson: vessel.json, local: partHashes(out) };
        return;
      }
    }
    throw new Error('did not settle');
  };

  const li = (id: string): EquipmentItem => ({ id, category: 'mooring' as any, type: 'Mooring line', updatedAt: 1 });
  const fe = (id: string, at = 1): EquipmentItem => ({ id, category: 'fire_extinguishers', type: 'Dry powder', updatedAt: at });

  // the tester's build has the module; the website does not
  const withModule: Build = {
    name: 'module build', knows: [...BUILTIN, 'mooring'], base: null, foreign: {},
    local: { categories: { fire_extinguishers: [fe('fe1')], mooring: [li('mo1'), li('mo2')] } },
  };
  const plain: Build = { name: 'plain build', knows: BUILTIN, base: null, foreign: {}, local: { categories: { fire_extinguishers: [] } } };

  syncBuild(withModule);
  ok('the module build sends its own categories to the vessel', (cloud()!.categories.mooring ?? []).length === 2);

  syncBuild(plain);
  ok('a build without the module still receives them', (cloud()!.categories.mooring ?? []).length === 2);
  ok('…and files them as buckets it cannot name', Object.keys(plain.foreign).join() === 'mooring');

  // the ordinary edit that used to wipe the lot
  plain.local.categories.fire_extinguishers = [fe('fe1'), fe('fe2', 2)];
  syncBuild(plain);
  ok('an edit on that build does NOT delete them from the vessel', (cloud()!.categories.mooring ?? []).length === 2, JSON.stringify(Object.keys(cloud()!.categories)));

  syncBuild(withModule);
  ok('…and the module build still has all of its register', (withModule.local.categories.mooring ?? []).length === 2);
  ok('…having received the other build\'s edit', (withModule.local.categories.fire_extinguishers ?? []).length === 2);

  // a real deletion, made by a build that CAN see the category, still deletes
  withModule.local.categories.mooring = [li('mo1')];
  syncBuild(withModule);
  syncBuild(plain);
  ok('a deletion made where the category IS known still travels', (cloud()!.categories.mooring ?? []).length === 1);

  vessel.at = v0.at;
  vessel.json = v0.json;
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
