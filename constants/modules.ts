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
// This is deliberately NOT a per-vessel setting. Whether a VESSEL uses a module
// is the Master's business (categories can already be hidden, and a whole group
// will follow the same way); whether the module exists at all is ours.
// ===================================

export type ModuleKey = 'lifting' | 'crewCerts' | 'rest' | 'pms' | 'access' | 'spares' | 'signConfirm' | 'docs';

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
};

export function moduleOn(key: ModuleKey): boolean {
  return MODULES[key] === true;
}
