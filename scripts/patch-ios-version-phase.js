#!/usr/bin/env node
/*
 * Make Xcode read the version from app.json — so nobody types it twice.
 *
 * THE PROBLEM. `scripts/patch-native-version.js` already carries app.json's
 * version into `android/`, `ios/Info.plist` and the Xcode project — but only when
 * something runs it (`postinstall`, `npm run aab`). Archiving straight from
 * Xcode, which is how the iOS build is actually made, runs none of those: the
 * version in app.json has moved, the project has not, and the choice is to
 * remember the sync command every single time or to re-type the numbers in
 * Xcode's General tab. On 29 Sep 2026 that cost a release — an archive went up
 * carrying the previous build's numbers.
 *
 * THE FIX. A Run Script build phase, FIRST in the app target, that runs the sync
 * before anything is compiled. From then on Xcode cannot produce an archive whose
 * version disagrees with app.json, whoever presses Archive and whatever they
 * remembered to run first. app.json stays the single source; this is the wire
 * from it to the build.
 *
 * `alwaysOutOfDate` is set because the phase has no inputs or outputs Xcode could
 * reason about: without it Xcode decides the phase is up to date and skips it,
 * which is exactly the failure this exists to prevent.
 *
 * Re-applied by `postinstall` because `ios/` is CNG: `expo prebuild` regenerates
 * the project and takes the phase with it. Idempotent — it looks for the phase by
 * name and does nothing if it is already there.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PBXPROJ = path.join(ROOT, 'ios', 'MarineSafetyManager.xcodeproj', 'project.pbxproj');
const PHASE_NAME = 'Sync version from app.json';
const TARGET = 'MarineSafetyManager';

// Runs from ${SRCROOT}, which is ios/ — hence the ..
const SHELL = [
  '# Keeps CFBundleShortVersionString / CFBundleVersion in step with app.json.',
  '# See scripts/patch-ios-version-phase.js for why this phase exists.',
  'if command -v node >/dev/null 2>&1; then',
  '  node "$SRCROOT/../scripts/patch-native-version.js"',
  'else',
  '  echo "warning: node not found — the version in this build may be stale"',
  'fi',
].join('\\n');

function main() {
  if (!fs.existsSync(PBXPROJ)) {
    console.log('[version-phase] ios/ not generated yet — nothing to patch.');
    return;
  }

  let xcode;
  try {
    xcode = require('xcode');
  } catch {
    console.log('[version-phase] the `xcode` package is not installed — skipped.');
    return;
  }

  const proj = xcode.project(PBXPROJ);
  proj.parseSync();

  const phases = proj.hash.project.objects.PBXShellScriptBuildPhase || {};
  const already = Object.values(phases).some(
    (p) => p && typeof p === 'object' && String(p.name).replace(/"/g, '') === PHASE_NAME
  );
  if (already) {
    console.log('[version-phase] Xcode already syncs the version from app.json.');
    return;
  }

  // `addBuildPhase` wants the target's UUID, and the UUID is minted at prebuild —
  // so it is looked up by name every time rather than written down anywhere.
  const targetsByName = proj.hash.project.objects.PBXNativeTarget || {};
  const targetUuid = Object.keys(targetsByName).find(
    (k) =>
      targetsByName[k] &&
      typeof targetsByName[k] === 'object' &&
      String(targetsByName[k].name).replace(/"/g, '') === TARGET
  );
  if (!targetUuid) {
    console.error(`[version-phase] no target called ${TARGET} — check the script against the project.`);
    process.exitCode = 1;
    return;
  }

  const phase = proj.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, targetUuid, {
    shellPath: '/bin/sh',
    shellScript: SHELL,
  });
  // `addBuildPhase` appends; this has to run BEFORE the plist is processed.
  phase.buildPhase.alwaysOutOfDate = 1;

  const list = targetsByName[targetUuid].buildPhases;
  const idx = list.findIndex((p) => p.value === phase.uuid);
  if (idx > 0) {
    const [mine] = list.splice(idx, 1);
    list.unshift(mine);
  }

  fs.writeFileSync(PBXPROJ, proj.writeSync());
  console.log(`[version-phase] Xcode now runs "${PHASE_NAME}" before every build.`);
}

main();
