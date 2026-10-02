// ===================================
// "Scan before you sign" — the vessel's rule, and proof that a label was scanned.
//
// Asked for by a vessel (14 Sep 2026): an Officer or crew member should only be
// able to sign an inspection after reaching that item through its QR label, so a
// signature says somebody stood in front of the equipment, not that they worked
// down a list in the mess room.
//
// Three decisions worth keeping:
//
// 1. **The proof lives in memory, bound to one item, and goes stale.** A scan
//    records `{itemId, at, method}` here and nowhere else — not in route params
//    (a browser URL can carry those), not in storage (a scan yesterday proves
//    nothing today). Reloading the app forgets every proof, which is correct.
//    SCAN_PROOF_MINUTES bounds how long a scan counts for STARTING an inspection;
//    the record keeps both times, so a long gap is visible to anyone who looks.
//
// 2. **Typing the code in is not a scan.** The Scan screen's manual field exists
//    for a damaged label, which is exactly the case the rule must not wave
//    through. Only the camera (in-app, or the phone's own camera opening an
//    msm://item link) counts, and the method is written onto the record.
//
// 3. **The Master can sign without a scan — on the record.** A label falls off, a
//    liferaft is inspected from the davit platform where nobody can reach the
//    sticker. Blocking the Master too would mean the round simply does not get
//    signed. So a Master may override, must say why, and the reason is printed in
//    the report beside the signature. Nobody else can.
//
// What this cannot do, stated plainly: a photograph of a label can be scanned
// from anywhere. The rule raises the effort and makes every exception visible;
// it does not make pretending impossible.
//
// Pure: no storage, no React Native — scripts/check-inspections.ts runs it.
// ===================================

import { Role } from '../types/role';
import { CategoryKey } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';
import { VerificationMethod } from '../types/inspection';

export interface SigningPolicy {
  /** Crew and Officers must scan the item's label before signing an inspection. */
  requireScan: boolean;
  /**
   * An enrolled device signs as the person it was issued to — the name and rank
   * on its account — and the signer picker is gone. Asked for by a vessel
   * (19 Sep 2026): an Officer could scan an item on their own phone and then
   * pick a colleague's name to sign, so the signature said nothing about whose
   * hands the phone was in. With this on, the account IS the signature; the
   * Master changes who a device belongs to in Settings → Accounts (rename).
   * A device that has not joined a vessel still picks from the list — it has
   * no account to sign as. Optional: older copies of the policy lack it.
   */
  signAsDevice?: boolean;
  /**
   * Categories the scan rule does NOT apply to (25 Sep 2026).
   *
   * Asked for by a vessel: a rescue boat's own inventory, or the loose
   * fire-fighting gear in a locker, is worth keeping and checking off item by
   * item — but nobody is going to put a sticker on every spanner, drogue and
   * bailer, and a rule that demands one turns a useful inventory into a round
   * that cannot be signed. So the rule is kept, and the categories where a label
   * makes no sense are named as exceptions.
   *
   * An EXEMPTION LIST rather than a list of categories the rule covers, so the
   * rule keeps its meaning as the register grows: a category added next month is
   * covered by default, and a vessel that has never opened this screen sees
   * exactly what it set when it switched the rule on.
   *
   * Exempt is not "unverified": a scan made anyway is still recorded on the
   * record and still prints in the Scan column, so the report says which items
   * were reached by their label whatever the rule asked for.
   */
  scanExempt?: CategoryKey[];
  /**
   * The other direction: categories the rule DOES cover although it would not by
   * default. Only lifting and mooring gear is exempt by default (see
   * `scanRequiredByDefault`), and a vessel that does label its cranes says so
   * here. Two lists rather than one because the default now differs by register,
   * and a switch must be able to say "yes" as clearly as it says "no".
   */
  scanRequired?: CategoryKey[];
  /** Who set it, as a note for the next Master ("Jez Dodd · Master"). */
  setBy?: string;
  /** Epoch ms. The newer copy wins between a device and the vessel. */
  updatedAt: number;
}

export const DEFAULT_POLICY: SigningPolicy = { requireScan: false, updatedAt: 0 };

/** How long a scan counts as "just scanned" for starting an inspection. */
export const SCAN_PROOF_MINUTES = 30;

export interface ScanProof {
  itemId: string;
  at: number;
  method: Exclude<VerificationMethod, 'override'>;
}

const proofs = new Map<string, ScanProof>();

/** A label was scanned. Called by the Scan screen and the msm://item deep link only. */
export function recordScanProof(itemId: string, method: ScanProof['method'], at: number = Date.now()): void {
  proofs.set(itemId, { itemId, at, method });
}

/** The scan of this item still recent enough to start an inspection, if any. */
export function scanProofFor(itemId: string, now: number = Date.now()): ScanProof | null {
  const p = proofs.get(itemId);
  if (!p) return null;
  if (now - p.at > SCAN_PROOF_MINUTES * 60_000 || now < p.at) return null;
  return p;
}

/** Tests only. */
export function clearScanProofs(): void {
  proofs.clear();
}

export type SigningGate =
  /** No rule on this vessel. A scan, if there was one, is still recorded. */
  | { kind: 'open'; proof: ScanProof | null }
  /** Rule on, and the label was scanned. */
  | { kind: 'scanned'; proof: ScanProof }
  /** Rule on, not scanned, and this device may sign anyway — with a reason. */
  | { kind: 'override' }
  /** Rule on, not scanned, and this device may not sign. */
  | { kind: 'blocked' };

/**
 * May this device sign an inspection of this item now?
 *
 * The rank that counts is the DEVICE's (the role in its enrolment token), not the
 * name picked in the signer list — that list is a vocabulary, not a login, and
 * letting it grant the override would let anybody pick the Master's name. A
 * device that has not joined a vessel answers to nobody (see SettingsSc `solo`),
 * so it holds the Master's override; one that has joined but whose role is not
 * known yet is treated as crew, because the strict answer is the safe one.
 */
export function signingGate(
  policy: SigningPolicy | null | undefined,
  role: Role | null | undefined,
  enrolled: boolean,
  proof: ScanProof | null,
  /** The item's category. Omitted = ask about the vessel as a whole. */
  category?: CategoryKey
): SigningGate {
  if (!scanRequiredFor(policy, category)) return { kind: 'open', proof };
  if (proof) return { kind: 'scanned', proof };
  const master = !enrolled || role === 'superadmin';
  return master ? { kind: 'override' } : { kind: 'blocked' };
}

/**
 * Does the scan rule bite on this category?
 *
 * With no category named the answer is about the vessel — which is what the
 * Settings switch shows and what a report footer means.
 */
/**
 * Whether the rule covers a category when the vessel has said nothing about it.
 *
 * Everything except lifting and mooring gear. That register is identified by the
 * maker's own numbers, and the vessel that asked for it was explicit (30 Sep
 * 2026): "I don't think we would physically label or QR code probably 90% of the
 * lifting gear and mooring equipment ... it would be useful if QR labelling
 * remained completely optional within this module rather than being central to
 * how the inspections work."
 *
 * A shackle carries a stamped ID and a certificate number; matching that to the
 * record is the identification, and demanding an MSM sticker on top of it would
 * be asking the ship to relabel gear that is already labelled.
 */
export function scanRequiredByDefault(category: CategoryKey): boolean {
  return CATEGORY_MAP[category]?.group !== 'LIFTING';
}

export function scanRequiredFor(
  policy: SigningPolicy | null | undefined,
  category?: CategoryKey
): boolean {
  if (!policy?.requireScan) return false;
  if (!category) return true;
  if ((policy.scanRequired ?? []).includes(category)) return true;
  if ((policy.scanExempt ?? []).includes(category)) return false;
  return scanRequiredByDefault(category);
}

/** The newer of two copies of the policy — a device's and the vessel's. */
export function newerPolicy(a: SigningPolicy | null | undefined, b: SigningPolicy | null | undefined): SigningPolicy {
  if (!a) return b ?? DEFAULT_POLICY;
  if (!b) return a;
  return (b.updatedAt ?? 0) > (a.updatedAt ?? 0) ? b : a;
}

// ---- who signs -------------------------------------------------------------

/** The name and rank a signature carries, and where they came from. */
export interface Signer {
  id: string;
  name: string;
  rank?: string;
  /** 'device' — the account this device was issued to; 'picked' — chosen from the list. */
  source: 'device' | 'picked';
}

/** What the enrolled device knows about itself (types/role EnrolledDevice, narrowed). */
export interface DeviceIdentity {
  id: string;
  firstName?: string;
  lastName?: string;
  position?: string;
}

export type SignerRule =
  /** Pick from the crew list, as always. */
  | { kind: 'pick' }
  /** Sign as this device's account — no picker. */
  | { kind: 'device'; signer: Signer }
  /** The rule is on but the device's account has not loaded — nothing may be signed yet. */
  | { kind: 'waiting' };

/**
 * Who this device signs as. Pure, so it can be checked.
 *
 * The rule binds ENROLLED devices only: one that has not joined the vessel has
 * no account, and refusing it the picker would stop a standalone install from
 * inspecting anything. An enrolled device whose account has not arrived yet is
 * held ("waiting") rather than let through to the picker — a rule that quietly
 * fell back to the old behaviour whenever the network was slow would not be one.
 */
export function signerRule(
  policy: SigningPolicy | null | undefined,
  enrolled: boolean,
  me: DeviceIdentity | null | undefined
): SignerRule {
  if (!policy?.signAsDevice || !enrolled) return { kind: 'pick' };
  const name = [me?.firstName, me?.lastName].filter(Boolean).join(' ').trim();
  if (!me || !name) return { kind: 'waiting' };
  return { kind: 'device', signer: { id: `device:${me.id}`, name, rank: me.position?.trim() || undefined, source: 'device' } };
}
