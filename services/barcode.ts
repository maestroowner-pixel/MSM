// ===================================
// Scanning — turning a decoded string into an item, or admitting it cannot.
//
// The lookup order is fixed and deliberate:
//
//   1. `msm://item/<id>` — our own printed sticker. An exact id match, no
//      ambiguity, no heuristics. This is why the payload is an id.
//   2. The serial / ID number, for the maker's own barcode or asset tag on the
//      gear, which long predates this app.
//
// There is no third route, because MSM's EquipmentItem has no factory-barcode
// field: nothing in the register claims to hold an EAN/UPC, so pretending to match
// one would be a lie. If a barcode field is ever added, it belongs between the two
// above.
//
// A `msm://` code whose item is gone is NOT the same as an unrecognised code, and
// the difference matters to the person holding the phone: "this label points at an
// item that is no longer in the register" means a deleted item, or a device
// holding an older copy than the vessel. Offering to treat it as unknown there
// would hide a real data problem.
//
// The category travels back with the item on purpose: MSM opens ItemDetail with
// {category, id}, and the sticker deliberately does not encode the category (see
// services/qrLabel.ts) — so this is where it is recovered, from the register,
// which is the only thing that actually knows.
// ===================================

import type { BarcodeType } from 'expo-camera';

import { CategoryKey, EquipmentItem } from '../types/equipment';
import { parseItemQr } from './qrLabel';

/**
 * What the camera is asked to look for. QR covers MSM's own stickers; the rest are
 * the symbologies that turn up on shipboard safety gear and its packaging. Every
 * extra type costs the scanner work per frame, so this is a list of what is
 * expected aboard, not everything expo-camera can decode.
 */
export const SCAN_BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'datamatrix',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'itf14',
];

export type ScanMatch =
  /** Found. Both routes are exact string matches, so the screen opens the item
   *  straight away rather than asking the keeper to confirm a guess. */
  | { kind: 'item'; item: EquipmentItem; category: CategoryKey }
  /** One of our stickers, but the item is not in the register any more. */
  | { kind: 'stale'; itemId: string }
  /** Not ours, and nothing on file carries this code. */
  | { kind: 'unknown'; code: string };

/** Codes are compared case- and whitespace-insensitively; a printed barcode and a
 *  hand-typed serial disagree about both far more often than they disagree about
 *  the actual characters. */
const norm = (s: string): string => s.trim().toLowerCase();

/** `flat` is DataContext's every-category list — the only place an id can be
 *  resolved without knowing the category first. */
export function lookupScan(code: string, flat: EquipmentItem[]): ScanMatch {
  const raw = code.trim();
  if (!raw) return { kind: 'unknown', code };

  // 1 — our own sticker.
  const id = parseItemQr(raw);
  if (id) {
    const item = flat.find((i) => i.id === id);
    return item ? { kind: 'item', item, category: item.category } : { kind: 'stale', itemId: id };
  }

  // 2 — the maker's serial / asset tag.
  const needle = norm(raw);
  const bySerial = flat.find((i) => i.serial && norm(i.serial) === needle);
  if (bySerial) return { kind: 'item', item: bySerial, category: bySerial.category };

  return { kind: 'unknown', code: raw };
}
