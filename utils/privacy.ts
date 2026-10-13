// ===================================
// What never leaves the vessel (13 Oct 2026): a patient's name, a guest's name.
// On the cloud such a name is its first and last letter — "Ann Lee" → "A…e" —
// and the full name stays on the device it was written on.
// ===================================

export function maskName(name: string): string {
  const s = name.trim().replace(/\s+/g, ' ');
  if (s.length <= 1) return s;
  return `${s[0]}…${s[s.length - 1]}`;
}

/** Already masked — what the cloud holds. */
export const isMasked = (name: string) => /^.(….)?$/u.test(name);
