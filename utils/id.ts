// Lightweight unique id (no native crypto dependency needed).
let counter = 0;
export function uid(prefix = 'it'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
