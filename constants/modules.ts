// ===================================
// Modules — whole registers that can be switched on for the app as a whole.
//
// WHY THIS EXISTS. A vessel asked for lifting and mooring gear to live inside
// MSM rather than in a second app (29 Sep 2026): one account, one crew list, one
// set of QR labels, one place the evidence is kept. They are right, and the app
// was already shaped for it — MSM is a register of CATEGORIES grouped into LSA,
// FFE and Other, and a new register is another group with its own categories.
//
// WHAT THE FLAG IS FOR. The register is built and can be shipped, but it is not
// finished being AGREED: the fields that matter for lifting gear (SWL/WLL, the
// last proof test, the certificate and who issued it) are being settled with the
// vessel that asked, and the pricing changes with it. So the code ships dark. Off,
// nothing about the module exists anywhere a user can see — its categories are
// never registered, so no screen, report, import sheet or picker knows about it,
// and there is nothing to explain to anybody who has not asked.
//
// TO SHIP IT: set `lifting: true`, and check `npm run check:inspections`, which
// covers the register either way. That is the whole release step — everything
// else is already wired.
//
// This is deliberately NOT a Master's setting. Whether a VESSEL uses a module
// is the Master's business (categories can already be hidden, and a whole group
// will follow the same way); whether the module exists at all is ours — for
// every vessel here, or for one pilot vessel (see `setVesselModules` below).
// ===================================

export type ModuleKey = 'lifting' | 'crewCerts' | 'rest' | 'pms' | 'access' | 'spares' | 'signConfirm' | 'docs' | 'fleet' | 'ptw' | 'fuel' | 'garbage' | 'sopep' | 'security' | 'surveys' | 'board' | 'orb' | 'sewage' | 'ballast' | 'fuelChange' | 'ods' | 'rounds' | 'qhse' | 'drills' | 'hospital' | 'passengers' | 'meetings' | 'stores' | 'ai' | 'searches' | 'ssp' | 'readiness' | 'serviceReport' | 'dp' | 'dpEditor' | 'patrols' | 'keys' | 'watchChecks' | 'orders' | 'deckLog' | 'watchLog' | 'gmdss' | 'i18n';

export const MODULES: Record<ModuleKey, boolean> = {
  /**
   * Lifting & Mooring — mooring gear, working aloft, cranes, hooks and cables,
   * deck slings and shackles, engineering lifting gear, working aloft anchors,
   * interior lifting eyes and beams. See constants/lifting.ts.
   */
  // Switched on in 2.52 (2 Oct 2026).
  lifting: true,

  // ---- Built 9 Oct 2026, shipped DARK -------------------------------------
  // "Пока всё, что мы делаем, в приложении скрыто" — the owner, 9 Oct 2026.
  // Everything below is finished and tested but not yet offered: off, a module
  // shows no tab, no card, no link, no Settings row and no manual section. Its
  // code, sync and storage stay in place, so a record made on a build where it
  // was on is kept, not lost. To release one: set it true, deploy firestore.rules
  // (`npm run deploy:rules`), and deploy the site manual's matching section.

  /** Crew and vessel certificates — the Crew / Vessel tabs on Certificates. */
  // Released in 2.59 (9 Oct 2026) with Hours of rest — rules deployed first.
  // Released for all vessels 18 Oct 2026.
  crewCerts: true,
  /** Hours of rest (MLC / STCW) — the Rest tab. */
  // Released for all vessels 18 Oct 2026.
  rest: true,
  /** Planned maintenance by running hours — the PMS tab and Dashboard strip. */
  // Released 18 Oct 2026.
  pms: true,
  /** Settings → Access: the Master's tabs-per-device matrix. */
  // Released 18 Oct 2026.
  access: true,
  /** Spare parts stores — the Spares tab; parts used by PMS jobs. */
  // Released 18 Oct 2026.
  spares: true,
  /**
   * Confirmed signatures — fingerprint / face / signing PIN. Needs a STORE BUILD
   * with expo-local-authentication for biometrics; the PIN works on any build.
   */
  // Released 18 Oct 2026 (PIN on all builds; biometrics on store builds).
  signConfirm: true,
  /** ISM documents with read-and-sign — the Docs tab. */
  // Released 18 Oct 2026.
  docs: true,
  /**
   * Fleet console for superintendents (shore accounts) and the `shore` role in
   * Accounts. Needs the functions and rules DEPLOYED (enrolShore, refreshShore,
   * shoreSaveCertificate) before it can be switched on.
   */
  // Released 18 Oct 2026 — functions deployed first.
  fleet: true,
  /** Permits to work and risk assessments — the Permits tab. */
  // Released 18 Oct 2026.
  ptw: true,
  /** Fuel: tanks, daily soundings, bunkerings, transfers, monthly report. */
  fuel: true,
  /** Garbage Record Book (MARPOL Annex V, Part I). */
  // Released 18 Oct 2026.
  garbage: true,
  /** SOPEP locker inventory, checks and oil-spill drills. */
  // Released 18 Oct 2026.
  sopep: true,
  /**
   * Security (ISPS): gangway visitor log and the security level. On for everyone
   * (14 Oct 2026: "do it for all — for now it is one vessel", DreamBoat's trial).
   */
  security: true,
  /** Surveys & audits planner: class, flag, ISM audits, dry-dock — windows and next dates. */
  // Released 18 Oct 2026.
  surveys: true,
  /** The Dashboard as the vessel's notice board across every module (the old list moves to its own screen). */
  // Released 18 Oct 2026.
  board: true,
  /** Oil Record Book Part I (MARPOL Annex I, machinery spaces). */
  // Released 18 Oct 2026.
  orb: true,
  /** Sewage record (MARPOL Annex IV). */
  // Released 18 Oct 2026.
  sewage: true,
  /** Ballast Water Record Book (BWM Convention). */
  // Released 18 Oct 2026.
  ballast: true,
  /** Fuel oil changeover record (MARPOL Annex VI reg. 14.6) — ECA and EU-berth changeovers (26 Oct 2026). */
  // Released in 2.69.
  fuelChange: true,
  /** Ozone-depleting Substances Record Book (MARPOL Annex VI reg. 12.6) (26 Oct 2026). */
  // Released in 2.69.
  ods: true,
  /** Inspection rounds — shared weekly / monthly to-do lists (Jez, 11 Oct 2026). */
  rounds: true,
  /** QHSE: safety observation cards and non-conformities with corrective actions (NC / CAPA). */
  // Released 18 Oct 2026.
  qhse: true,
  /** Drills — schedule, scenario minute by minute, attendance, theory briefing, reports (13 Oct 2026). */
  // Released 18 Oct 2026.
  drills: true,
  /** Hospital — medicine chest with expiry, medical log (officers only), controlled drugs register (13 Oct 2026). */
  // Released 18 Oct 2026.
  hospital: true,
  /** Passengers — the guests aboard, their documents (officers only), and their crossings at the gangway (13 Oct 2026). */
  // Released 18 Oct 2026.
  passengers: true,
  /** Monthly safety meeting — agenda, attendance signed line by line, actions carried forward (13 Oct 2026). */
  // Released 18 Oct 2026.
  meetings: true,
  /** Stores — the PPE store (issued to crew, signed for) and the provision store (best-before), with minimums (14 Oct 2026). */
  // Released 18 Oct 2026.
  stores: true,
  /** AI — smart import of any list, the round by voice and photo, questions to the vessel's data (functions/ai.js, 14 Oct 2026). */
  // Released 18 Oct 2026.
  ai: true,
  /** Security → Searches: stowaway and bomb searches, area by area, by team (15 Oct 2026). Needs `security`. */
  // Released 18 Oct 2026.
  searches: true,
  /** Security → Ship Security Plan: the SSP and its papers, officers only (15 Oct 2026). Needs `security`. */
  // Released 18 Oct 2026.
  ssp: true,
  /** Inspection readiness — what PSC / flag / class would find on a date (services/readiness.ts). */
  // Released 18 Oct 2026.
  readiness: true,
  /** Service report — a station's PDF into the register: dates, remarks, one certificate (services/serviceReport.ts, 16 Oct 2026). */
  // Released 18 Oct 2026.
  serviceReport: true,
  /** Dynamic positioning — DP checklists, DPOs' DP time, the Nautical Institute confirmation letter (services/dp.ts, 16 Oct 2026). */
  // Released 18 Oct 2026.
  dp: true,
  /**
   * The DP checklist editor and the AI reading of a vessel's paper form — ours,
   * not the vessel's (17 Oct 2026: "nobody aboard will do this"). ISM AI Pilot sets
   * a vessel's checklists up when it joins: `modules.dpEditor = true` on that
   * vessel in the console, set them up, then remove it.
   */
  dpEditor: false,
  /** Security rounds — QR checkpoints, opening / daytime / closing rounds, daily and monthly reports (Jez, 17 Oct 2026). Needs `security`. */
  // Released 18 Oct 2026.
  patrols: true,
  /** Key register — keys with QR tags, signed out and back, who holds what (Jez, 17 Oct 2026). Needs `security`. */
  // Released 18 Oct 2026.
  keys: true,
  /** Bridge and engine checklists — watch handover (STCW A-VIII/2) first, on the DP checklist engine (17 Oct 2026). */
  // Released 18 Oct 2026.
  watchChecks: true,
  /**
   * Purchase orders / requisitions — department folders (Bridge / Engine / Deck /
   * Accommodation / Galley) with a register and delivery tracking (Oct 2026).
   * Closes the "Закупки и поставщики" gap vs. IDEA/Seahub.
   */
  orders: true,
  /** Deck watch log (вахтенный журнал мостика) — position, course, speed, weather, watch officer signature (Oct 2026). */
  deckLog: true,
  /**
   * Engine-room rounds / daily log — readings, machinery state, watch signature (Oct 2026).
   * Released in 2.68 with watch periods, remarks, previous readings, trends and the day's PDF.
   */
  watchLog: true,
  /** GMDSS Log — daily/weekly/monthly checks, battery log, radar periods, events (Oct 2026). */
  gmdss: true,
  /**
   * Interface languages — the Manual's six (en, ru, es, uk, no, pt), via
   * utils/i18n `t()`, picked in Settings (default: the device's language).
   * Released in 2.66 (21 Oct 2026) once every screen was on t(). PDF / Excel
   * reports and saved records stay English.
   */
  i18n: true,
};

// ---- per-vessel release (15 Oct 2026) --------------------------------------
//
// A module finished but not released for everybody can be switched on for ONE
// vessel — a pilot: DreamBoat tries Drills before every ship gets them. The list
// is the `modules` field of the vessel document ({ drills: true, … }), and only
// WE set it (Firebase console or admin credentials): firestore.rules refuses any
// client write to it, the Master's included, because which modules a vessel has
// is the product we sell it, not a vessel setting.
//
// It can only ADD to this build's flags, never take one away: a module released
// for everybody is on whatever the vessel document says.
//
// Read synchronously like the build flags, so every existing `moduleOn` call
// keeps working. SyncContext installs the vessel's list (cached in
// `msm:vessel_modules`, so a launch at sea has it before any network) and
// re-renders its consumers when it changes. Values computed at IMPORT time —
// the lifting categories and checklists — cannot follow it; `lifting` is
// released for everybody, so that costs nothing today.

let vesselModules: Partial<Record<ModuleKey, boolean>> = {};

/** Only known keys with `true` survive — the field is typed by hand in a console. */
export function cleanModules(raw: unknown): Partial<Record<ModuleKey, boolean>> {
  const out: Partial<Record<ModuleKey, boolean>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of Object.keys(MODULES) as ModuleKey[]) {
    if ((raw as any)[k] === true) out[k] = true;
  }
  return out;
}

// In a browser the cache can be read before the first render: a link straight
// to a pilot module's page (/readiness) would otherwise meet a navigator built
// without it and fall back to the Dashboard. Native reads it in SyncContext,
// behind the splash. The key is storage.ts's VESSEL_MODULES_KEY.
try {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('msm:vessel_modules') : null;
  if (raw) vesselModules = cleanModules(JSON.parse(raw));
} catch {
  /* no storage, or not JSON — the vessel document will say */
}

/** Install the vessel's list. Returns true when it changed what is on. */
export function setVesselModules(raw: unknown): boolean {
  const next = cleanModules(raw);
  const changed = JSON.stringify(next) !== JSON.stringify(vesselModules);
  vesselModules = next;
  return changed;
}

/** The vessel's own additions (for Settings → About and diagnostics). */
export function vesselModuleKeys(): ModuleKey[] {
  return Object.keys(vesselModules) as ModuleKey[];
}

export function moduleOn(key: ModuleKey): boolean {
  return MODULES[key] === true || vesselModules[key] === true;
}
