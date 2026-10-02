// ===================================
// Comparing app versions — "2.47" against "2.3", and what to say about it.
//
// WHY MAX-ACROSS-THE-VESSEL AND NOT "THE LATEST RELEASE". The app has no way to
// ask a store what the newest build is, and a hard-coded number would be a lie
// the day after it shipped. What a vessel CAN see is what its own devices are
// running, so the newest version aboard is the yardstick: as soon as one phone
// updates, every older one reads as behind, and until then nobody is told to
// chase an update that is not out yet.
//
// It understates rather than overstates, which is the right way round: a device
// is never nagged about a version nobody aboard has, and the worst case is that
// a whole vessel is quietly behind — which shows the moment anyone updates.
//
// Pure: no React, no storage — scripts/check-inspections.ts runs it.
// ===================================

/** "2.47" -> [2, 47]. Anything unparseable sorts as oldest. */
function parts(v: string | undefined | null): number[] {
  if (!v) return [];
  return String(v)
    .trim()
    .split(/[.\-+]/)
    .map((p) => parseInt(p, 10))
    .filter((n) => Number.isFinite(n));
}

/** <0 when a is older, 0 when equal, >0 when a is newer. */
export function compareVersions(a: string | undefined | null, b: string | undefined | null): number {
  const pa = parts(a);
  const pb = parts(b);
  // 2.3 vs 2.47: compared part by part as NUMBERS, so 3 < 47. Comparing the
  // strings would put "2.3" after "2.47", which is how a version check ends up
  // telling the newest device on the ship that it is out of date.
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** The newest of a set of versions — the yardstick. Undefined when none parse. */
export function newestVersion(versions: (string | undefined | null)[]): string | undefined {
  let best: string | undefined;
  for (const v of versions) {
    if (!v || !parts(v).length) continue;
    if (!best || compareVersions(v, best) > 0) best = v;
  }
  return best;
}

export type VersionStanding =
  /** Running the newest version anybody aboard has. */
  | { kind: 'current'; version: string }
  /** Behind the newest aboard — `newest` is what to update to. */
  | { kind: 'behind'; version: string; newest: string }
  /** Never reported one: an old build that does not send it, or never refreshed. */
  | { kind: 'unknown' };

export function versionStanding(
  version: string | undefined | null,
  newest: string | undefined | null
): VersionStanding {
  if (!version || !parts(version).length) return { kind: 'unknown' };
  if (!newest || compareVersions(version, newest) >= 0) return { kind: 'current', version };
  return { kind: 'behind', version, newest };
}

/** One short phrase for a device row. */
export function versionLabel(standing: VersionStanding): string {
  switch (standing.kind) {
    case 'current':
      return `v${standing.version} · up to date`;
    case 'behind':
      return `v${standing.version} · update to ${standing.newest}`;
    default:
      return 'version not reported yet';
  }
}
