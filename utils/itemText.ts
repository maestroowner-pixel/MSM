// ===================================
// How an item is NAMED to a person — one definition for every screen, label and
// report, so the number on the sticker is the number in the report.
//
// A vessel identifies equipment by its own item number ("01-SD") first and the
// maker's serial second: the number is painted on the bulkhead, the serial is
// on a plate you need a torch to read. Anything that shows only the serial makes
// forty identical extinguishers indistinguishable.
// ===================================

import { EquipmentItem } from '../types/equipment';

/** The vessel's item number, or '' when the register holds none. */
export function itemNumber(item?: Pick<EquipmentItem, 'no'> | null): string {
  if (!item || item.no == null) return '';
  return String(item.no).trim();
}

/** "Sun Deck · EM Generator" — deck and position, without repeating a deck the
 *  position already names. */
export function itemLocation(item?: Pick<EquipmentItem, 'deck' | 'position'> | null): string {
  if (!item) return '';
  const deck = item.deck?.trim() ?? '';
  const pos = item.position?.trim() ?? '';
  if (!deck) return pos;
  if (!pos || pos.toLowerCase().includes(deck.toLowerCase())) return pos || deck;
  return `${deck} · ${pos}`;
}

/** "CO2 5kg" — the type with its size, which is how crew say it out loud. */
export function typeWithSize(item?: Pick<EquipmentItem, 'type' | 'size'> | null): string {
  if (!item) return '';
  return [item.type?.trim(), item.size?.trim()].filter(Boolean).join(' ');
}

/** "No. 01-SD · S/N C001111" — every identifier the register holds, number first. */
export function itemIdentifiers(item?: Pick<EquipmentItem, 'no' | 'serial'> | null): string {
  const no = itemNumber(item);
  return [no && `No. ${no}`, item?.serial && `S/N ${item.serial}`].filter(Boolean).join(' · ');
}

/** Initials from a signed name: "John Smith" -> "JS", "Jez" -> "JEZ" kept short. */
export function initialsOf(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join('').slice(0, 4).toUpperCase();
}
