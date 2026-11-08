// ===================================
// The makers' library (plan item 54, 8 Nov 2026): the maintenance schedule a
// maker's manual gives for one model, kept once for every vessel.
//
// Filled only by the AI reading a real manual (task `manual`): when the machine
// on that vessel has a maker and a model and the AI says the manual is for
// them, its jobs go under `maker_library/{key}`. Nothing is added from general
// knowledge. What is kept is the maker's: job titles, intervals, type, parts,
// page — never the machine's name, the vessel, the file or what the crew did
// with it. A vessel is counted by a hash, only so "read on n vessels" can be
// said; the hash never leaves the server.
//
// Read only through task `library` (an exact key per unit — the library cannot
// be listed). What comes back is a proposal like a manual read: the plan's
// keeper checks it against the manual aboard before anything is added.
//
// Pure parts (libraryKey, entryFromRead) are checked by npm run check:makerlib.
// ===================================

const crypto = require('crypto');

const LIB = 'maker_library';
const MAX_JOBS = 150;
const MAX_VESSELS = 200;
const TYPES = ['maintenance', 'performance', 'safety', 'measurement', 'visual', 'calibration', 'megger', 'overhaul'];

// Words that say what kind of company, not which.
const CORP = /\b(inc|ltd|llc|gmbh|ag|sa|spa|srl|bv|nv|asa|ab|oy|co|corp|corporation|company|group|plc|kk|limited)\b/g;
// Trailing words a crew adds or leaves out ("Yanmar Marine", "Scania Engines").
const TAIL = ['marine', 'engines', 'engine', 'power', 'systems', 'diesel', 'industries', 'international', 'energy', 'solutions', 'generators', 'generator'];
// The same maker under its other names.
const ALIAS = {
  caterpillar: 'cat',
  mtufriedrichshafen: 'mtu',
  rollsroycemtu: 'mtu',
  rollsroycepowersystems: 'mtu',
  manenergysolutions: 'man',
  mandieselturbo: 'man',
  mandiesel: 'man',
  manbw: 'man',
  volvo: 'volvopenta',
  cumminsonan: 'onan',
  zffriedrichshafen: 'zf',
};

const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function makerKey(maker) {
  let words = fold(maker).replace(/&/g, ' ').replace(CORP, ' ').split(/[^a-z0-9]+/).filter(Boolean);
  while (words.length > 1 && TAIL.includes(words[words.length - 1])) words = words.slice(0, -1);
  const k = words.join('');
  return ALIAS[k] || k;
}

/** maker + model → the library's key, or null when either is too short to tell. "Caterpillar Inc." + "C-32" → "cat__c32". */
function libraryKey(maker, model) {
  const mk = makerKey(maker);
  let md = fold(model).replace(/[^a-z0-9]/g, '');
  // "CAT C32" typed as the model of a CAT.
  if (mk && md.startsWith(mk) && md.length > mk.length + 1) md = md.slice(mk.length);
  if (mk.length < 2 || md.length < 2) return null;
  return `${mk}__${md}`.slice(0, 120);
}

const text = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim().replace(/\s+/g, ' ').slice(0, max) : '');
const whole = (v, max) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 1 && n <= max ? Math.round(n) : null;
};

/** What of a manual read the library keeps — or null when it is not for this maker and model. */
function entryFromRead(machine, reply) {
  const m = machine || {};
  const key = libraryKey(m.maker, m.model);
  if (!key || !reply || reply.covers !== 'yes') return null;
  const seen = new Set();
  const jobs = [];
  for (const j of Array.isArray(reply.jobs) ? reply.jobs : []) {
    const title = text(j && j.title, 120);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const type = TYPES.includes(j.type) ? j.type : null;
    jobs.push({ title, hours: whole(j.hours, 100000), days: whole(j.days, 7300), type, parts: text(j.parts, 300), page: text(j.page, 20) });
    if (jobs.length >= MAX_JOBS) break;
  }
  // A read with no job the plan can count is no schedule.
  if (!jobs.some((j) => j.hours || j.days)) return null;
  return { key, maker: text(m.maker, 80), model: text(m.model, 80), manualModel: text(reply.model, 120), jobs };
}

const counted = (jobs) => jobs.filter((j) => j.hours || j.days).length;

/** After a manual read (task manual): keep it, unless the library already holds a fuller read of that model. */
async function remember(db, vessel, machine, reply) {
  const e = entryFromRead(machine, reply);
  if (!e) return null;
  const who = crypto.createHash('sha256').update(`ismpilot-maker-library:${vessel}`).digest('hex').slice(0, 16);
  const ref = db.doc(`${LIB}/${e.key}`);
  await db.runTransaction(async (tx) => {
    const old = (await tx.get(ref)).data();
    const vessels = Array.from(new Set([...(old?.vessels || []), who])).slice(-MAX_VESSELS);
    const fuller = !old || counted(e.jobs) >= counted(old.jobs || []);
    tx.set(ref, {
      ...(fuller ? { maker: e.maker, model: e.model, manualModel: e.manualModel, jobs: e.jobs, readAt: Date.now() } : {}),
      reads: (old?.reads || 0) + 1,
      vessels,
      updatedAt: Date.now(),
    }, { merge: true });
  });
  return e.key;
}

/** Task library: up to 40 units {maker, model} → for each, the library's schedule or null. */
async function lookup(db, d) {
  const units = (Array.isArray(d && d.units) ? d.units : []).slice(0, 40);
  const keys = units.map((u) => libraryKey(u && u.maker, u && u.model));
  const wanted = Array.from(new Set(keys.filter(Boolean)));
  const docs = wanted.length ? await db.getAll(...wanted.map((k) => db.doc(`${LIB}/${k}`))) : [];
  const found = {};
  for (const s of docs) {
    const v = s.exists ? s.data() : null;
    if (!v || !Array.isArray(v.jobs) || !v.jobs.length) continue;
    found[s.id] = { key: s.id, maker: v.maker || '', model: v.model || '', manualModel: v.manualModel || '', jobs: v.jobs, vessels: (v.vessels || []).length || 1, readAt: v.readAt || 0 };
  }
  return { found: keys.map((k) => (k && found[k]) || null) };
}

module.exports = { libraryKey, entryFromRead, remember, lookup };
