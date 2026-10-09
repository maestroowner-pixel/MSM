// The person's screen order for the menu (components/NavMenu) — pure, so `npm run check:access` can test it.

/** The saved order applied to the screens this device shows; new ones go last. */
export function applyOrder(available: string[], saved: string[] | null): string[] {
  if (!saved?.length) return available;
  const known = saved.filter((r) => available.includes(r));
  return [...known, ...available.filter((r) => !known.includes(r))];
}

export function move(order: string[], name: string, dir: -1 | 1): string[] {
  const i = order.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const out = [...order];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

