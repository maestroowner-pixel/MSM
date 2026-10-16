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

export type ModuleKey = 'lifting' | 'crewCerts' | 'rest' | 'pms' | 'access' | 'spares' | 'signConfirm' | 'docs' | 'fleet' | 'ptw' | 'fuel' | 'garbage' | 'sopep' | 'security' | 'surveys' | 'board' | 'orb' | 'sewage' | 'ballast' | 'rounds' | 'qhse' | 'drills' | 'hospital' | 'passengers' | 'meetings' | 'stores' | 'ai' | 'searches' | 'ssp' | 'readiness' | 'serviceReport';

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
  crewCerts: false,
  /** Hours of rest (MLC / STCW) — the Rest tab. */
  rest: false,
  /** Planned maintenance by running hours — the PMS tab and Dashboard strip. */
  pms: false,
  /** Settings → Access: the Master's tabs-per-device matrix. */
  access: false,
  /** Spare parts stores — the Spares tab; parts used by PMS jobs. */
  spares: false,
  /**
   * Confirmed signatures — fingerprint / face / signing PIN. Needs a STORE BUILD
   * with expo-local-authentication for biometrics; the PIN works on any build.
   */
  signConfirm: false,
  /** ISM documents with read-and-sign — the Docs tab. */
  docs: false,
  /**
   * Fleet console for superintendents (shore accounts) and the `shore` role in
   * Accounts. Needs the functions and rules DEPLOYED (enrolShore, refreshShore,
   * shoreSaveCertificate) before it can be switched on.
   */
  fleet: false,
  /** Permits to work and risk assessments — the Permits tab. */
  ptw: false,
  /** Fuel: tanks, daily soundings, bunkerings, transfers, monthly report. */
  fuel: false,
  /** Garbage Record Book (MARPOL Annex V, Part I). */
  garbage: false,
  /** SOPEP locker inventory, checks and oil-spill drills. */
  sopep: false,
  /**
   * Security (ISPS): gangway visitor log and the security level. On for everyone
   * (14 Oct 2026: "do it for all — for now it is one vessel", DreamBoat's trial).
   */
  security: true,
  /** Surveys & audits planner: class, flag, ISM audits, dry-dock — windows and next dates. */
  surveys: false,
  /** The Dashboard as the vessel's notice board across every module (the old list moves to its own screen). */
  board: false,
  /** Oil Record Book Part I (MARPOL Annex I, machinery spaces). */
  orb: false,
  /** Sewage record (MARPOL Annex IV). */
  sewage: false,
  /** Ballast Water Record Book (BWM Convention). */
  ballast: false,
  /** Inspection rounds — shared weekly / monthly to-do lists (Jez, 11 Oct 2026). */
  rounds: true,
  /** QHSE: safety observation cards and non-conformities with corrective actions (NC / CAPA). */
  qhse: false,
  /** Drills — schedule, scenario minute by minute, attendance, theory briefing, reports (13 Oct 2026). */
  drills: false,
  /** Hospital — medicine chest with expiry, medical log (officers only), controlled drugs register (13 Oct 2026). */
  hospital: false,
  /** Passengers — the guests aboard, their documents (officers only), and their crossings at the gangway (13 Oct 2026). */
  passengers: false,
  /** Monthly safety meeting — agenda, attendance signed line by line, actions carried forward (13 Oct 2026). */
  meetings: false,
  /** Stores — the PPE store (issued to crew, signed for) and the provision store (best-before), with minimums (14 Oct 2026). */
  stores: false,
  /** AI — smart import of any list, the round by voice and photo, questions to the vessel's data (functions/ai.js, 14 Oct 2026). */
  ai: false,
  /** Security → Searches: stowaway and bomb searches, area by area, by team (15 Oct 2026). Needs `security`. */
  searches: false,
  /** Security → Ship Security Plan: the SSP and its papers, officers only (15 Oct 2026). Needs `security`. */
  ssp: false,
  /** Inspection readiness — what PSC / flag / class would find on a date (services/readiness.ts). */
  readiness: false,
  /** Service report — a station's PDF into the register: dates, remarks, one certificate (services/serviceReport.ts, 16 Oct 2026). */
  serviceReport: false,
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
