#!/usr/bin/env node
/*
 * Keep the native projects' version in step with app.json.
 *
 * THE BUG THIS FIXES, caught while building an AAB on 3 Sep 2026: `app.json`
 * said 2.1 / versionCode 20101, and the bundle came out as **1.9 / 1095**. Both
 * `android/` and `ios/` are CNG — Expo writes the version into them at PREBUILD —
 * and neither `expo run:*` nor Gradle re-runs prebuild when the folder already
 * exists. So a version bump lands in app.json, every screen shows it, and the
 * artifact you upload still carries the old one. Play then rejects the AAB for a
 * duplicate versionCode, which is the good case; the bad case is shipping a build
 * that reports the wrong version to users and to crash reporting.
 *
 * NEVER DOWNGRADES. It raises a native version to match app.json and otherwise
 * leaves it alone, warning instead. That rule exists because the two can legally
 * disagree in the other direction: a TestFlight build bumped by hand is AHEAD of
 * app.json, and silently rewinding it would make the next upload unacceptable to
 * App Store Connect ("build number must be higher"). Fixing a stale-low version is
 * safe; rewinding a high one is not, so the script refuses to guess.
 *
 * Runs from `postinstall` and from `npm run aab`, so a release build cannot pick
 * up a stale version by accident. Idempotent.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;

const version = String(app.version);
const androidCode = Number(app.android?.versionCode);
const iosBuild = String(app.ios?.buildNumber ?? '');

/** Compare dotted versions; -1 / 0 / 1. */
function cmp(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

let changed = false;

// ---- Android ---------------------------------------------------------------
const gradle = path.join(ROOT, 'android', 'app', 'build.gradle');
if (fs.existsSync(gradle) && Number.isFinite(androidCode)) {
  let s = fs.readFileSync(gradle, 'utf8');
  const codeNow = Number((s.match(/versionCode\s+(\d+)/) || [])[1]);
  const nameNow = (s.match(/versionName\s+"([^"]+)"/) || [])[1];

  if (Number.isFinite(codeNow) && codeNow > androidCode) {
    console.warn(
      `[patch-native-version] android versionCode ${codeNow} is AHEAD of app.json ` +
        `(${androidCode}) — left alone. Bump app.json rather than rewinding the build.`
    );
  } else if (codeNow !== androidCode || cmp(nameNow, version) !== 0) {
    s = s.replace(/versionCode\s+\d+/, `versionCode ${androidCode}`);
    s = s.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);
    fs.writeFileSync(gradle, s);
    console.log(
      `[patch-native-version] android ${nameNow}/${codeNow} -> ${version}/${androidCode}`
    );
    changed = true;
  }
}

// ---- iOS -------------------------------------------------------------------
const plistDir = path.join(ROOT, 'ios');
if (fs.existsSync(plistDir) && iosBuild) {
  const found = fs
    .readdirSync(plistDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(plistDir, d.name, 'Info.plist'))
    .find((p) => fs.existsSync(p));

  if (found) {
    let s = fs.readFileSync(found, 'utf8');
    const read = (key) =>
      (s.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`)) || [])[1];
    const nameNow = read('CFBundleShortVersionString');
    const buildNow = read('CFBundleVersion');

    if (Number(buildNow) > Number(iosBuild) || cmp(nameNow, version) > 0) {
      console.warn(
        `[patch-native-version] ios ${nameNow}/${buildNow} is AHEAD of app.json ` +
          `(${version}/${iosBuild}) — left alone. Bump app.json to match before releasing.`
      );
    } else if (nameNow !== version || buildNow !== iosBuild) {
      s = s.replace(
        /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]*(<\/string>)/,
        `$1${version}$2`
      );
      s = s.replace(/(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/, `$1${iosBuild}$2`);
      fs.writeFileSync(found, s);
      console.log(`[patch-native-version] ios ${nameNow}/${buildNow} -> ${version}/${iosBuild}`);
      changed = true;
    }
  }
}

/*
 * The Xcode PROJECT settings, not just Info.plist.
 *
 * The widget extension has no version of its own in a plist — it takes
 * MARKETING_VERSION and CURRENT_PROJECT_VERSION from the build configuration, and
 * those were left behind at 1.9 / 1096 while the app moved on. Xcode says so on
 * every build ("The CFBundleVersion of an app extension must match that of its
 * containing parent app") and App Store Connect refuses the upload outright — the
 * third version trap in this project, after the two in the header above.
 *
 * Every occurrence is rewritten, app target and extension alike: they are
 * REQUIRED to match, so there is nothing to be gained by treating them
 * separately. The never-downgrade rule is applied to the highest value present,
 * for the same reason it exists above.
 */
const pbx = path.join(ROOT, 'ios', 'MarineSafetyManager.xcodeproj', 'project.pbxproj');
if (fs.existsSync(pbx) && iosBuild) {
  let s = fs.readFileSync(pbx, 'utf8');
  const builds = [...s.matchAll(/CURRENT_PROJECT_VERSION = ([0-9]+)/g)].map((m) => Number(m[1]));
  const names = [...s.matchAll(/MARKETING_VERSION = ([0-9.]+)/g)].map((m) => m[1]);
  const highestBuild = builds.length ? Math.max(...builds) : 0;
  const highestName = names.sort(cmp).pop() ?? '0';
  if (highestBuild > Number(iosBuild) || cmp(highestName, version) > 0) {
    console.warn(
      `[patch-native-version] xcodeproj ${highestName}/${highestBuild} is AHEAD of app.json ` +
        `(${version}/${iosBuild}) — left alone.`
    );
  } else if (builds.some((b) => b !== Number(iosBuild)) || names.some((n) => n !== version)) {
    s = s.replace(/CURRENT_PROJECT_VERSION = [0-9]+/g, `CURRENT_PROJECT_VERSION = ${iosBuild}`);
    s = s.replace(/MARKETING_VERSION = [0-9.]+/g, `MARKETING_VERSION = ${version}`);
    fs.writeFileSync(pbx, s);
    console.log(
      `[patch-native-version] xcodeproj (app + widget) -> ${version}/${iosBuild} ` +
        `— was ${[...new Set(names)].join(',')}/${[...new Set(builds)].join(',')}`
    );
    changed = true;
  }
}

if (!changed) console.log('[patch-native-version] native versions already match app.json');
