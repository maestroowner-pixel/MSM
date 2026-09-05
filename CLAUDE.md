# Marine Safety Manager (MSM) — Claude Code Context

## Project overview
React Native + Expo app for a ship's **LSA** (Life-Saving Appliances) and **FFE/FIFI**
(Fire-Fighting Equipment) inventory: per-category equipment registers, inspection/expiry
tracking, Excel import, PDF/XLSX export, optional Firebase cloud sync. Targets **iOS**,
**Android**, and **Windows** (react-native-windows, follow-up track).

**Mac and Windows are served by the browser build, not by native desktop apps.** The
react-native-macos copy at `../MSM_Mac` was RETIRED on 5 Sep 2026 (see the banner at the top of
its CLAUDE.md) and the react-native-windows track before it — each was a third tree to mirror
every change into, and the cost was visible: four copies of the version number drifted apart
unnoticed. Mac users get the iPad build from the App Store or the web app; Windows users get the
web app. Port anything you still want OUT of `MSM_Mac`, never back into it.

Sibling app to **Marine Hospital Manager (MHM)** at `/Users/MarineHospitalManager/MHM_4.1.1`,
whose conventions (theme, navigation, expiry logic, XLSX import, Firebase device-approval) this
app mirrors. Bundle id `com.kukalab.msm`.

## Tech stack
- React Native 0.81.5 + React 19.1.0 + TypeScript + Expo SDK 54 (managed)
- Navigation: `@react-navigation` v6 (bottom-tabs + stack), gesture-handler swipe (no reanimated)
- Storage: AsyncStorage (local-first), one key per category `msm:<category>` + `msm:vessel_info`
  + `msm:certificates` + `msm:compressor` (up to 3 BA compressors, each a running-time +
  maintenance log; `types/compressor.ts` `normalizeCompressorState` migrates the old single-log shape)
- Backup: `services/backup.ts` — full self-contained `.msm` snapshot (JSON: all categories +
  vessel + certificates + compressor, with attachment/cert binaries embedded as base64). Export/
  restore from Settings → Data. Restore re-creates files in `attachments/` and relinks every uri.
  Backup file name: `MSM_backup_DDMMYY.msm` (`fileDateStamp()` in utils/dates).
- ZIP export: `export.ts` `exportZip` (Reports tab) — bundles the PDF register of the selected
  categories + every attached photo/document (jszip, base64 round-trip) into `MSM_backup_DDMMYY.zip`.
- Import/Export: SheetJS (`xlsx`), `expo-document-picker`, `expo-print`, `expo-sharing`,
  `expo-file-system/legacy` (base64 read/write)
- **QR labels + scanning** (`services/qrLabel.ts`, `services/barcode.ts`): every item is labelable
  from the moment it exists, because the payload is its own `id` — `msm://item/<id>` (a private
  scheme matching app.json's, not an https URL). A reprint is therefore never a new code and can't
  fork one item into two. The sticker deliberately does NOT encode the category: ItemDetail needs
  `{category, id}`, and the category is recovered from the register (`flat`) at scan time, so a
  re-categorised item's printed label can't point at the wrong screen. Two thermal stocks
  (100×50 / 50×30 mm), one label per page, `@page`-sized. `qrcode` (pure JS) builds the matrix →
  inline SVG string for print, and the same encoder at the same ECL (Q) backs the on-screen preview
  via `react-native-qrcode-svg` — deliberately, so what is approved is what prints. **The printed QR
  does not depend on react-native-svg** (which is a Windows mock). Scanning: `expo-camera`
  BarcodeScanning, lookup order `msm://` id → `serial` (there is no factory-barcode field on
  EquipmentItem, so no third route is pretended).
- **Inspections (the audit trail)** (`types/inspection.ts`, `constants/checklists.ts`,
  `services/inspections.ts`, key `msm:inspections`): a signed record of one crew member working
  one checklist against one item — exact timestamp (`at`), signature snapshot (`by`/`byRank`,
  plus a `byId` that is allowed to dangle), per-line `pass|fail|na`, frozen `outcome`, comment,
  evidence photos, and an optional `defect`. **Records are append-only and never edited** — a
  correction is a new inspection. Two consequences the code depends on: (a) a signed statement
  that could be quietly rewritten is worthless at an audit, and (b) merging two devices is a set
  union (`mergeInspections`, ordered by `updatedAt` only to settle a defect close), which is why
  several officers can work a round on separate phones and lose nothing. The ONE mutation allowed
  is a defect going open→closed, itself stamped and signed. `roundStatus` is calendar-window based
  (`monthWindow`/`weekWindow`), not "within 30 days": a monthly check is a calendar obligation.
- **Checklists** (`constants/checklists.ts`): 30 templates keyed `<category>.<period>`, weekly
  and/or monthly, plus a `genericTemplate` fallback so no category can refuse a round. **Line ids
  are permanent** — they are the keys of every stored `results` map, so re-word freely but never
  re-use an id for a different question; bump `version` when the line set changes (the record
  stores the version, and `templateById` reads old records back against the right questions).
- **Crew** (`types/crew.ts`, key `msm:crew`): who may sign. Deliberately NOT accounts or logins —
  the vessel already has one account by IMO, and per-person passwords on a shared bridge tablet at
  0300 is how a safety round stops happening. The picker is the vocabulary; the NAME is snapshotted
  onto the record so a crew member who leaves (and is deleted) doesn't blank two years of history.
  `prefs.lastCrewId` is device-local, so the bridge tablet and an engineer's phone each default well.
- **Inspection reports** (`services/inspectionReport.ts`): LSA/FFE × weekly/monthly, PDF + XLSX,
  built from one pure `buildReport` so the on-screen preview and the file can never disagree. Three
  sections: what was inspected, **what was not** (printed on purpose — a report that hides the gap
  reads like a clean sheet, and this is what makes it usable as a worklist mid-month), and every
  open defect carried forward. Separate from the register export in `export.ts`, which answers the
  different question "what is falling due".
- Attachments: `expo-image-picker` (camera/library) + `expo-document-picker` (PDF/docs),
  persisted to `documentDirectory/attachments/` via `services/attachments.ts`. Items carry
  `attachments: Attachment[]` (up to 4; long-press a thumbnail for the edit menu —
  Download/Share, Rename, Replace, Delete). **Certificates** (`types/certificate.ts`, key
  `msm:certificates`) are documents that link to many items (group certificate) — managed in the
  Certificates tab (`CertificatesSc` + `CertificateDetailSc`); item detail shows covering
  certificates (row tap = preview the file, chevron = open the cert screen) and can link an
  existing certificate via "＋ Link" (writes to the cert's `itemIds` + `saveCertificate`, since the
  link lives on the certificate — the item's own Save never persists it). Cert dates use
  `SimpleDatePicker`; the cert icon is always 📜 (never the photo/🖼️ variant).
- **`resolveUri(uri)` in `attachments.ts` — IMPORTANT.** iOS app-container UUIDs change on
  reinstall (and simulator rebuilds), so the absolute `file://…/Application/<UUID>/…` path saved
  in an `Attachment.uri`/`cert.fileUri` goes stale and the image/file vanishes. The file *name*
  under `attachments/` is stable, so `resolveUri` re-bases any stored uri onto the CURRENT
  `documentDirectory`. Always render/open/read attachment files through it: `<Image>` sources,
  `openFile`/`deleteFile` (resolve internally), `export.ts` (ZIP reads) and `backup.ts`
  (`collectFileUris` — without it, stale-prefixed files were silently dropped from the backup).
- Audio: `expo-av` — ship's bell on app start (`utils/sound.ts` → `playShipBellSound`,
  asset `assets/sounds/ship-bell.mp3`), mirrors MHM. Shown via `screens/SplashSc.tsx`, an
  overlay in `index.tsx` (`showSplash` state) that animates the logo and calls `onDone` after ~2.2s.
- Cloud (optional): Firebase JS SDK (`firebase`) — Firestore + Storage + Cloud Functions, live
  `onSnapshot` sync; the session comes from a custom token minted by `functions/enrol`
- **Home-screen widgets** (ported from DEM) — a small **Scan** widget (one tap → in-app scanner)
  and a medium **Scan + Flagged** widget (scanner button + the latest flagged items as deep-linked
  rows). iOS: WidgetKit/SwiftUI via `@bacons/apple-targets` (`targets/widget/` — `MSMWidgets.swift`
  + `Shared.swift` + `expo-target.config.js`, a real widget-extension target linked on prebuild).
  Android: `react-native-android-widget` JSX (`widgets/ScanWidget.tsx`, `widgets/FlaggedWidget.tsx`,
  headless `widgets/widget-task-handler.tsx` → `registerMsmWidgets()` at the top of `index.tsx`).
  The widget process can't see live data, so the app pushes a tiny flagged snapshot through a shared
  container — an **App Group** (`group.com.kukalab.msm`) on iOS, an AsyncStorage key on Android —
  from `services/widgetBridge.ts` (`syncFlaggedWidget`, debounced in DataContext on every `flat`
  change). Shape + keys live in `widgets/shared.ts` and MUST match `Shared.swift`. Widgets open the
  app via the same `msm://` scheme as labels, with two extra verbs `msm://scan` / `msm://flagged`
  (see `parseDeepLink` in `qrLabel.ts`); `index.tsx` captures the link (getInitialURL + 'url' event)
  and, for `msm://item/<id>`, recovers the item's category from the register before navigating
  ItemDetail. No-op on web/Windows/Expo Go (native modules absent, wrapped in try/catch).

## Architecture
```
index.tsx                    entry: providers + nav (4 tabs + stack modals + swipe)
theme.ts                     design tokens (copied from MHM, + LSA/FFE group colors)
types/equipment.ts           EquipmentItem model + CategoryKey union (23 categories)
constants/categories.ts      CATEGORIES registry: label, group (LSA/FFE/OTHER), source sheet,
                             emoji, color, dateField (nextInspection|expiry), monthly flag
utils/dates.ts               excelSerialToISO, parseDateCell, daysUntil, computeStatus, formatDate
utils/id.ts                  uid()
services/storage.ts          AsyncStorage CRUD per category + vessel info
services/excelImport.ts      header-driven generic mapper (see below) + First Aid special case
services/export.ts           PDF (expo-print HTML) + XLSX (SheetJS) + expo-sharing
services/qrLabel.ts          msm://item/<id> payload + QR→inline-SVG + printable label HTML
                             (100×50 / 50×30 mm, one label per page). Print: expo-print native,
                             printHtmlWeb on web (@page is honoured there), off on Windows. A PDF
                             file is native-only (printToFileAsync has no web impl) → deliverFile.
services/barcode.ts          lookupScan(code, flat) -> item+category | stale | unknown
services/firebaseService.ts  FIRESTORE storage + live subscriptions. Signs nobody in — see enrolment.ts
contexts/SyncContext.tsx     live sync: auto sign-in, onSnapshot listeners, debounced push,
                             forced re-push on launch/foreground (Firestore's offline queue
                             does not survive process death), and a re-`refresh` on foreground
                             plus a 20s poll WHILE PENDING — approval cannot announce itself,
                             because the device's rights live in a token it has not been given
contexts/DataContext.tsx     in-memory items + vessel, reload()/saveItem()/removeItem()
components/ui.tsx            Screen, Card, StatusPill/Dot, ScreenTitle, Empty, Label
types/inspection.ts          signed inspection record (append-only) + outcomeOf
types/crew.ts                CrewMember + signatureLine (name snapshot, not a login)
constants/checklists.ts      per-category weekly/monthly templates; permanent line ids
services/inspections.ts      create/closeDefect + queries (forItem, openDefects, roundStatus,
                             month/week windows) + mergeInspections/mergeCrew (union by id)
services/inspectionReport.ts LSA/FFE × weekly/monthly PDF+XLSX from one pure buildReport
screens/                    Dashboard, Categories, CategoryItems, ItemDetail(modal),
                             Import(modal), Reports (multi-select category panels →
                             PDF/XLSX), Settings, Manual (accordion help), Compressor
                             (BA compressor running-time + maintenance log; opt-in module —
                             toggle in Settings → Modules, stored in `msm:prefs`; entry point on
                             the FIFI/BA category screen + a Settings link), Splash, Consent (first-launch Privacy +
                             Terms gate), Legal (Privacy/Terms viewer, route.params.doc),
                             Inspection (modal — the round: checklist, signature, defect,
                             photos; "All pass" then downgrade what is wrong), InspectionDetail
                             (modal — one signed record, read-only by design; the only control
                             is recording a rectification), Crew, Defects (open/rectified,
                             filterable by LSA/FFE),
                             Label (modal — QR preview + stock toggle + print; one item via
                             ItemDetail's "Print label", or a batch via CategoryItems' long-press
                             multi-select), Scan (modal — camera + manual entry; a match REPLACES
                             the screen with ItemDetail so back returns to the list)
constants/legal.ts           Privacy Policy + Terms of Use + disclaimer points; LEGAL_VERSION
                             drives the consent key `msm:legal_accepted_v{n}` (gated in index.tsx).
                             Bump LEGAL_VERSION to force re-consent after material changes.
```

### Data model
One unified `EquipmentItem` (id, category, no, type, serial, position, quantity, persons,
manufactureDate, nextInspection, expiry, remarks, extra{}, monthlyChecks{}) for all 23
categories — not 25 rigid schemas. `complianceDate(item)` picks the category's `dateField`;
`computeStatus` → `expired` (<today) / `due` (≤60d) / `ok` / `none`.

### Excel importer (services/excelImport.ts) — IMPORTANT
The source workbook (`LSA FFE Inventories.xlsx`, 25 sheets) is heterogeneous. The mapper is
**header-driven, not fixed-index**:
- `classifyHeader(row)` matches each cell against `FIELD_PATTERNS` → column→field map.
- A row is a **header** when ≥3 columns classify into fields (data rows classify ~0–1 because
  cell *values* don't contain column-name words). This handles multi-section sheets
  (Liferafts+HRU, GMDSS radios+SART+EPIRB, FIFI sets+bottles) by rebuilding the column map per
  section, and carries forward merged `type` cells within a section.
- First Aid sheet has no header row → `mapFirstAid` special case.
- Validated against the real file: **627 items across all 23 sheets** (run `npx tsc --noEmit`
  to typecheck; counts e.g. liferafts 12, immersion 93, fire detectors 108).

## Running locally
```bash
cd /Users/Inspector/MarineSafetyManager
npm install
npx expo start            # then iOS simulator / Android / Expo Go
npx tsc --noEmit          # typecheck (clean)
npm run check:inspections # audit-trail invariants (immutability, merge, windows) — no jest here
```

### iOS native build (prebuilt)
`ios/` is generated via `npx expo prebuild -p ios` (CNG — it's gitignored; regenerate, don't
hand-edit; configure through `app.json`). Workspace: `ios/MarineSafetyManager.xcworkspace`
(bundle id `com.kukalab.msm`, CocoaPods installed). expo-av's microphone permission is disabled
via the `expo-av` plugin config in `app.json` (playback only).
```bash
npx expo run:ios                       # build & launch on a simulator
# or open ios/MarineSafetyManager.xcworkspace in Xcode (set a signing team for a device build)
```
**Widget target (`@bacons/apple-targets`).** `expo prebuild -p ios` reads `targets/widget/` and
adds a real **MSMWidgets** WidgetKit extension to the Xcode project, sharing the App Group
`group.com.kukalab.msm` with the app (both declared in `app.json` `ios.entitlements` +
`expo-target.config.js`). Needs `ios.appleTeamId` set (LAGTN99698) so the extension can be signed;
on a device build confirm BOTH targets have the App Groups capability with that identifier. The
Swift editor shows false "cannot find FlaggedItem / @main in top-level code" errors when a file is
opened in isolation — they resolve once the target is linked at prebuild. Android's widgets need no
extra native work beyond the `react-native-android-widget` plugin block in `app.json`.
### Hermes compatibility fixes (hard-won — keep these)
The app runs on Hermes (RN 0.81). Two real fixes were needed to boot on a real iOS build —
do not regress them:
1. **Import auth from scoped `@firebase/auth`, not `firebase/auth`** (see firebaseService.ts).
   The umbrella `firebase/auth` export map has no `react-native` condition → pulls the browser
   ESM build (ES private fields Hermes can't parse + browser globals → "DOMException doesn't
   exist"). `@firebase/auth` has a `react-native` export condition → clean RN build. (Same as MHM.)
2. **`babel-preset-expo` must match the SDK (`~54.0.11`), NOT latest (56.x).** A stray
   `npm install babel-preset-expo` grabbed 56 → it transpiled JSX/private fields for the wrong
   target → "private properties are not supported", then a blank white screen. Pinning 54.0.11
   fixed it. `babel.config.js` is plain (`presets: ['babel-preset-expo']`) — do NOT add
   `@babel/plugin-transform-private-*` plugins: with the correct preset they're unnecessary and
   break RN's FlatList/VirtualizedList ("property is not configurable" when a list renders items).
3. **Keep every Expo native module on its SDK-54 version — esp. transitive ones like
   `expo-font` (`~14.0.12`).** A stray latest `expo-font` (56.x, for SDK 56) was pulled in via
   `@expo/vector-icons`/`npm audit fix` → at startup `FontLoaderModule` called
   `getDirectConverter` on the older `expo-modules-core` (3.0.30) → `java.lang.NoSuchMethodError`
   in `create_react_context` → Android **release** crashed right after the splash (debug/sim
   fine; not R8). `expo install --check` misses it because `expo-font` isn't a direct dep. Fix:
   `npx expo install expo-font` (pins SDK-54 version), then clean-rebuild. Mismatched native Expo
   modules show up only at runtime in a built APK, never in tsc or the JS bundle.

### Licensing — one licence per VESSEL, sold outside the stores (5 Sep 2026)

MSM Pro is **€99/year per vessel (one IMO)**, bought by the operator on LemonSqueezy and attached
to the vessel's Firestore account. Every enrolled device inherits it; a crew member buys nothing.
`services/purchases.ts` `activateLicense()` works on ALL platforms now (it was web-only), and
`isSubscribed()` reads the vessel entitlement FIRST, falling back to a store subscription only for
anyone who bought through the App Store before this. Why it changed: a store purchase is tied to
the Apple ID that paid, so the mate who bought it had Pro and the second officer beside him did
not — though the licence was meant to cover the ship.

**No IAP product exists on the App Store or Play, and none should.** The app is free in both
stores. On iOS and Android the paywall shows **no price, no buy button and no link** — only key
activation — because sending a user from inside iOS to an outside checkout is what App Store
review rejects (guideline 3.1.1). What is allowed is this shape: free app, silent about where to
pay, accepting a key the operator was issued. Apple's IAP disclosure ("payment is charged to your
store account…") was removed from the native paywall for the same reason — there is no store
charge to disclose, so printing it would simply be untrue.

`LS_PRICE_STRING` in `services/lemonSqueezy.ts` is the ONLY price string (purchases.ts's fallback
now references it — they were two independent constants and had drifted to €9.99 vs €10.00).
LemonSqueezy exposes no price API here, so **it must be kept in step with the dashboard by hand**.

**The trial belongs to the vessel, not the handset.** `syncTrialWithAccount()` mirrors the
first-launch stamp to and from `safety_vessels/{imo}.trialFirstLaunch`, taking the EARLIEST of the
two, and now runs from `SyncContext.connect()` on the enrolment path — it used to run only from
the legacy password sign-in, which nothing calls any more. On iOS the local stamp survives an
uninstall in the Keychain; **on Android the secure store is wiped with the app**, so this account
copy is the only memory the trial has and without it every reinstall handed out a fresh 60 days.
A reinstalled device does see a fresh counter until it re-enrols — the device secret is wiped too
— but it has to join the vessel to reach the register at all, and the stamp is corrected then.

**Pass the VESSEL KEY, never the auth uid** (`firebaseService.currentVesselKey()`). Since
enrolment a device's Firebase uid is `<imo>__<deviceId>` — unique per device — while all vessel
data lives under the IMO and firestore.rules authorises by the `vessel` claim. Licence activation
used `currentUid()` and wrote to `safety_vessels/<imo>__<dev>`, which the rules do not recognise:
the key validated on LemonSqueezy and then failed with "Missing or insufficient permissions".
Fixed 5 Sep 2026; the same trap applies to anything else that addresses the vessel document.

`ENFORCE_LIMITS` is now on everywhere except Windows, which has no cloud path and therefore no way
to activate a licence — enforcing there would be a dead end, not a paywall.

**firestore.rules protects the `entitlement` field**: it lives on the vessel document, which every
member may write, so without that carve-out any crew phone could grant the whole ship Pro with one
field write. Only a Master may change it.

### Two release-build traps (both cost a failed upload — found 3 Sep 2026)

**1. `OutOfMemoryError: Metaspace` in `:expo:lintVitalAnalyzeRelease`.** Expo generates
`-Xmx2048m -XX:MaxMetaspaceSize=512m`; heap is fine, METASPACE is not — Lint's vital analysis
loads the class metadata of the app plus every dependency into one daemon. It fails at RELEASE
only (`lintVitalAnalyzeRelease` does not run for debug), which is why `expo run:android` works
and `npm run aab` does not. Fixed by `scripts/patch-android-memory.js` (6 GB heap / 2 GB
metaspace, sized for a dev Mac — lower on a small CI box). **Run `./gradlew --stop` after
changing it**, or the running daemon keeps the old JVM args and the build fails identically.

**2. The version never reached the native projects.** `app.json` said 2.1 / versionCode 20101 and
the AAB came out **1.9 / 1095**. Both `android/` and `ios/` are CNG and get the version at
PREBUILD; neither `expo run:*` nor Gradle re-runs prebuild when the folder exists, so a bump lands
in app.json, every screen shows it, and the artifact carries the old one — Play then rejects the
upload for a duplicate versionCode. `scripts/patch-native-version.js` syncs app.json into
`android/app/build.gradle` and `ios/.../Info.plist`, and runs from BOTH `postinstall` and
`npm run aab`. It **never downgrades**: a hand-bumped TestFlight build is legitimately ahead of
app.json, and rewinding it would make the next App Store upload unacceptable — it warns instead.
`theme.ts`'s `APP_CONFIG.version` now reads app.json too, so the version lives in exactly one place.

### Android release signing / AAB (Play Store)
The release build is signed with an **upload keystore** kept at repo-root
`credentials/msm-upload.jks` (+ `credentials/keystore.properties` with the passwords).
`credentials/` is **gitignored — never commit it**, and the password is unrecoverable: if it's
lost you can no longer update the app on Play. Back up the keystore + password offline.
- Keystore lives OUTSIDE `android/` so `expo prebuild` (CNG, android/ is gitignored) doesn't wipe it.
- `scripts/patch-android-signing.js` re-injects the release `signingConfig` into
  `android/app/build.gradle` (reads `../credentials/keystore.properties`, falls back to the debug
  key if absent). Idempotent; runs from `postinstall`. **Re-run after every `expo prebuild -p android`.**
- **R8 minify + obfuscation + resource shrinking** are ON for release (gradle.properties
  `android.enableMinifyInReleaseBuilds=true` + `…ShrinkResourcesInReleaseBuilds=true`; keep rules in
  `android/app/proguard-rules.pro`). Re-applied after prebuild by `scripts/patch-android-minify.js`
  (postinstall). App logic is JS→Hermes bytecode (R8 only shrinks/obfuscates the native layer).
  Keep `android/app/build/outputs/mapping/release/mapping.txt` per release → upload to Play to
  de-obfuscate crash stacks. **Smoke-test the release build on a device** (R8 breakage shows at runtime).
- Build the bundle: `npm run aab` → `android/app/build/outputs/bundle/release/app-release.aab`.
- Verify signer: `keytool -printcert -jarfile <aab>` SHA-256 must match the keystore's.
- Bump `expo.android.versionCode` in app.json for each Play upload (and `version` for the name).
- Regenerate the keystore only with: `keytool -genkeypair -keystore credentials/msm-upload.jks
  -alias msm-upload -keyalg RSA -keysize 2048 -validity 10000` (changing it breaks updates once published).

### Firebase RTDB key encoding (keep this)
RTDB forbids `. # $ / [ ]` (and control chars) in keys. Item `extra` keys come from Excel column
headers (e.g. `PLB (Ser.#)`) and broke `pushAll` ("invalid key … in property … .extra"). `pushAll`/
`pullAll` (firebaseService.ts) reversibly `~xx`-hex-encode every object key on push and decode on
pull (`encodeKey`/`decodeKey`/`transformKeys`) so data round-trips while staying RTDB-legal. Values
are never touched. Local AsyncStorage keeps the original (unencoded) keys.

Also: `newArchEnabled` is **`true`** in app.json (re-prebuild after changing — it also gets written
to `android/gradle.properties` + `ios/Podfile.properties.json`). **It MUST stay on:**
`react-native-android-widget`'s headless renderer uses the bridgeless `ReactHost`, and with New Arch
OFF (RN 0.81 / SDK 54) placing a home-screen widget hard-crashes the task
(`TurboModuleRegistry.getEnforcing('PlatformConstants') could not be found`) — the widget appears in
the picker but won't drop onto the home screen. Turning New Arch on affects the WHOLE app (iOS +
Android), so **re-test every screen** after a rebuild. (Was `false` originally; flipped to add the
home-screen widgets. Earlier sim check: Dashboard/Settings render, 627 imported items, export works.)

### Native-build gotchas (iOS) — needed after `prebuild`/reinstall
1. **RN FuseboxTracer patch** — this RN 0.81.5 copy ships a malformed
   `ReactCommon/reactperflogger/fusebox/FuseboxTracer.h` (uses `BufferEvent` but doesn't define
   it → "use of undeclared identifier 'BufferEvent'"). Fixed by `scripts/patch-rn.js`, run via
   the `postinstall` npm script (re-applies on every `npm install`). Idempotent.
2. **Script sandboxing** — Expo prebuild sets `ENABLE_USER_SCRIPT_SANDBOXING = YES` in
   `ios/.../project.pbxproj`, which makes CocoaPods' resource-copy script fail
   ("Sandbox: deny file-write-create"). Set it to `NO` (sed) after prebuild before building.
3. **Codegen** — don't `rm -rf ios/build` between `pod install` and the build; the React
   codegen specs (`ios/build/generated/...`) are produced at pod-install time. If you see
   "Build input file cannot be found … States.cpp", just re-run `pod install` and rebuild.
4. **After ANY npm install / package add/remove/version change → `cd ios && pod install`.**
   npm re-hoists `node_modules`, so an Expo module can move between `node_modules/expo/node_modules/<pkg>`
   and top-level `node_modules/<pkg>`. The Pods project caches the old absolute path, so the iOS
   build then fails with `lstat(... expo/node_modules/<pkg>/ios/...): No such file` (seen with
   expo-font, expo-constants' PrivacyInfo.xcprivacy, …). `pod install` regenerates the paths; then
   Clean Build Folder (⇧⌘K) / clear DerivedData and rebuild. (Mirrors the expo-font SDK-version
   hazard above — node/native mismatches only surface in a real build, never in tsc or the JS bundle.)

Note: `npx expo export` AOT-compiles with `hermesc`; the dev workflow (`expo start` / `run:ios`)
is the validated path.

## Open items / TODO
1. **Firebase — Firestore, not Realtime Database (changed Sep 2026).** The transport was
   migrated to Firestore following DEM/NSeaStoreManager (`/Users/DEM`), because RTDB's single
   tree made two officers syncing at once a race. The login model changed with it — see (2):
   the shared connection password is gone, and **the legacy path was DELETED on 5 Sep 2026**
   (~500 lines out of firebaseService, 300 out of SettingsSc). Do not reintroduce a fallback to
   it: it keyed the register by the Firebase uid, which since enrolment is per-device
   (`<imo>__<deviceId>`), so any device reaching it wrote a second register beside the real one.
   Crew are still identified by the SIGNATURE on each inspection, not by personal accounts.
   Layout: `safety_vessels/{uid}` holds the whole register as ONE JSON STRING field
   (`register`) plus `masterDeviceId` / `entitlement` / `trialFirstLaunch`; subcollections hold
   `devices`, `pending_devices`, `crew` and — one document per signed record — `inspections`.
   The register is a string so arbitrary Excel column headers never become indexed field names;
   the trail is separate documents so it has no 1 MiB ceiling and cannot collide between devices.
   Rules: **`firestore.rules`** (paste into the console). `database.rules.json.rtdb-legacy` is
   the retired RTDB rule, kept only for reference.
   **There is no migration to do.** The Realtime Database was never actually created in the
   project (the console still offered "Set up database" on 3 Sep 2026), so despite `databaseURL`
   sitting in the config, cloud sync had never worked for any vessel and nothing was stored there.
   Firestore is this app's first working cloud, not its second.
   **Windows (react-native-windows) can no longer sync**: its REST path passed the ID token as
   `?auth=`, which RTDB allowed and Firestore does not — Firestore needs an `Authorization`
   header, and `RNCWindowsFileManager.httpRequest` cannot set one. `syncSupported()` returns
   false there and the UI says so. The Windows story is now the browser build in `../MSM Win Web`.
2. **Accounts are ISSUED, not shared (Sep 2026).** The shared connection password is replaced by
   the enrolment model from DEM/NSeaStoreManager: a Master issues an invitation (a name + an
   8-digit PIN) in Settings → Accounts, the person enters it in Settings → Join this vessel, and
   `functions/enrol` mints a **custom token** carrying `{ vessel, role, approved, deviceId }`.
   `firestore.rules` is written against those claims, so a role is now enforced by the server
   rather than agreed between colleagues — and revoking one person no longer means changing the
   password for everybody. The first device on an unclaimed vessel bootstraps to Master using the
   `BOOTSTRAP_CODE` **secret** (`cd functions && npm run secret`), which never ships in the app.
   **`pullAll` refuses an empty cloud register when the device holds items** (firebaseService).
   Without that guard a device pulled an empty blob, lost all 13 items, and pushed the emptiness
   back over the good copy inside a minute — a recoverable glitch turning permanent. Observed for
   real on 4 Sep 2026. Clearing a register is only allowed in the local→cloud direction, which is
   deliberate and recoverable from a `.msm` backup.
   **`components/ConnectionCard.tsx` at the top of Settings is what makes the order discoverable.**
   Joining has a sequence — set the IMO, enrol, then wait to be approved — and until it existed the
   app said none of it: sync just stayed `off` and Settings offered "Join this vessel" beside
   "Accounts" with no hint which came first. The card names ONLY the next step, driven by
   `useSync()` (status / role / enrolled) plus whether the IMO is set.
   `refresh` re-mints a token without a PIN, using the per-device secret issued at enrolment —
   that is how a waiting device notices it has been approved, and why device ids are no longer a
   credential. Roles: `user` (Crew) / `admin` (Officer) / `superadmin` (Master), see `types/role.ts`.
   **The rules also enforce the audit trail**: inspections may be created by any member, updated
   only in their `defect` field and only by an officer, and deleted by nobody — append-only is no
   longer merely an app convention.
   **The bootstrap code must be DIGITS.** The enrolment field is a number pad — crew key it on
   deck in gloves (types/role.ts) — so it strips non-digits. A base64 secret therefore could not
   be entered at all and the first device on a vessel could never enrol; found by walking the flow
   on a device, not by any typecheck. It is 12 digits (10^12 against a counter that stops after 8
   tries in 15 minutes), and the field accepts 8–16 digits so one input serves both an issued PIN
   and the bootstrap code.
   Deploy: `cd functions && npm i && npm run secret && npm run deploy`, then `npm run deploy:rules`.
   Run `npx firebase-tools functions:artifacts:setpolicy --force` once, or container images
   accumulate in Artifact Registry and quietly bill.
   **After the FIRST functions deploy, grant the runtime service account permission to sign
   tokens** — without it `enrol` deploys cleanly, runs its whole logic, logs
   `role superadmin, approved true`, and then dies at the last line with
   `Permission 'iam.serviceAccounts.signBlob' denied`, returning a bare `INTERNAL` to the app.
   `createCustomToken` signs through the IAM API, and the default compute service account cannot
   sign for itself:
   ```
   SA=353177370508-compute@developer.gserviceaccount.com
   gcloud iam service-accounts add-iam-policy-binding $SA --member="serviceAccount:$SA" \
     --role="roles/iam.serviceAccountTokenCreator" --project=marine-safety-manager
   ```
   It takes a minute or two to propagate. Verified end to end on 3 Sep 2026: enrol with the
   bootstrap code returns `superadmin` + a token whose claims are exactly
   `{vessel, role, approved, deviceId}`, `refresh` re-mints with the device secret and refuses a
   wrong one.
3. **Firebase console steps** — Dedicated project `marine-safety-manager`; web config (apiKey,
   appId, messagingSenderId, etc.) is in `services/firebaseService.ts` (`FIREBASE_CONFIG`,
   `ROOT = 'safety_vessels'`). Auth uses `initializeAuth` + `getReactNativePersistence`.
   (a) Authentication → enable Email/Password; (b) create the **Firestore** database (pick the
   region once — it cannot be changed); (c) paste `firestore.rules` into Firestore → Rules.
   The project is **already on Blaze**, so Cloud Storage and Cloud Functions are available —
   which is what unblocks syncing inspection PHOTOS (the one remaining hole in the audit trail:
   the record travels between devices, the image does not). Firestore itself stays inside the
   free tier at this scale; Blaze bills only above it.
4. **The web/desktop build has no source of its own.** `../MSM Win Web` is a shell: its
   `index.js` imports `../MarineSafetyManager/index` and Metro watches this folder, so anything
   added here ships there automatically — no port, no second copy. It does keep its own
   `package.json`, and a dependency added here must be mirrored (this bit rot once: `qrcode` was
   missing and the web bundle would not build at all). Native-only modules get a shim in
   `MSM Win Web/web/shims/` — `react-native-ble-plx`, `react-native-purchases`,
   `react-native-android-widget` and `expo-secure-store` are stubbed there.
5. **Desktop is the web build; there is no installer (changed Sep 2026).** Firebase Hosting
   serves `../MSM Win Web/dist` (`firebase.json` here, `npm run deploy` there). A deploy stamps
   `dist/version.json`; an open tab compares it and offers a reload (`utils/webUpdate.ts` +
   `components/UpdateBanner.tsx`), and `npm run exe` wraps the same site into a single
   self-updating `.exe` via Node's single-executable mechanism — no install, no Node, works
   offline. The Electron/NSIS wrapper and the react-native-windows track below are RETIRED.
   Their scaffolding is still on disk and costs nothing — `mocks/` and the `.windows` redirects
   only engage when Metro runs ON a Windows dev machine (`process.platform === 'win32'`), which
   nothing in the shipping path now does — but it can be deleted whenever you want the tree
   smaller. The web build's own stubs are separate, in `../MSM Win Web/web/shims/`.
6. **Windows track (react-native-windows) — RETIRED** — scaffolding still present (see `WINDOWS.md`): `mocks/` JS stubs +
   `metro.config.js` (swaps native-less modules on `win32`) + `react-native.config.js`
   (guarded `@react-native-windows/cli`, autolink disables) + `assets/windows/` tiles. All
   gated to Windows — iOS/Android unaffected. Use **react-native-windows 0.81.26** (RN 0.81).
   Mirror the working MHM project at `/Volumes/Turbo/MHMWin 1205`. Native modules ported (repo
   root `.h`): **StorageModule.h** (persistent KV via registry → `mocks/async-storage.js` bridge),
   **FileManagerModule.h** (`RNCWindowsFileManager` Save/Open dialogs → `utils/WindowsFileManager.ts`
   + `utils/fileShare.ts`; wired into export.ts/backup.ts/ImportSc), **SoundModule.h** (ship bell).
   So on Windows: persistent data + XLSX export + .msm backup/restore + Excel import work; PDF/ZIP/
   print/attachments are guarded off (`onWindows`). **`mocks/expo-camera.js` is not optional
   politeness** — expo-camera resolves its native module at IMPORT time, so without the mock a
   Windows bundle throws "Cannot find native module 'ExpoCamera'" the moment ScanSc is imported,
   before any Platform check inside the screen could run. (Scan degrades to manual entry there, and
   the lookup is pure JS so it still works; the Label screen guards printing off.) Generate `windows/` (gitignored), copy the 3
   `.h` into `windows/<App>/` + register, build on the Windows machine.
7. **App icons** — DONE. Generated from `assets/MSM logo.png` (transparent isometric MSM cube):
   `icon.png` (iOS, white bg), `adaptive-icon.png` (Android foreground, transparent, white bg via
   app.json), `splash.png` (white bg), `favicon.png`. Windows/UWP tiles in `assets/windows/`
   (Square44/71/150/310, Wide310x150, StoreLogo, SplashScreen, LockScreenLogo, target-size
   variants) — drop into `windows/<App>/Assets/` after prebuild. Regenerate via the Pillow
   scripts (crop cube by alpha bbox, composite at scale on white/transparent).
4. **Inspection photos: downscaled, then queued (Sep 2026).** Two pieces, and the reasoning
   matters more than the code. `services/images.ts` downscales to 1600px on the long edge before
   anything is stored — `expo-image-picker`'s `quality` only sets JPEG compression and leaves the
   full 12 MP resolution, so photos were 2–3 MB and are now 200–450 KB. It measures first, to
   avoid UPSCALING an already-small image, and constrains the long edge rather than the width so
   a portrait photo is not made bigger. `services/photoQueue.ts` then holds each photo in
   AsyncStorage until the connection is worth spending (`prefs.photoUpload`: `wifi` default /
   `always` / `never`), because the cost that hurts is not Google's — Cloud Storage is single-digit
   dollars a month for a hundred vessels — but the ship's own VSAT airtime. Drained on foreground
   (SyncContext) and by a button in Settings; failures back off and park after 6 tries.
   `services/photoStorage.ts` **derives** the object path from the record's ids
   (`safety_vessels/{imo}/inspections/{id}/{photoId}.jpg`) instead of writing a download URL back
   onto the record — a signed inspection is immutable, and the rules only permit updating
   `defect`. `storage.rules` mirrors firestore.rules against the same claims, write-once, no
   delete. **The Storage bucket is not created yet** — Firebase console → Storage → Get started;
   uploads fail harmlessly until it exists (the queue simply keeps them).
5. **The register still syncs as a whole-bucket replace** (`pushAll`/`pullAll`). Unlike
   inspections, two devices editing one ITEM genuinely conflict, and today the later push wins.
   Item-level merge on `updatedAt` is the natural next step.
6. **Checklist templates are built in, not editable.** A vessel whose SMS words a check
   differently cannot yet change it; the version + line ids on every record are what will make a
   template editor safe to add later.
7. **Importer polish** — minor cosmetic mappings (e.g. Hydrants `type` = "Yes", FIFI BA-set
   `position` = fire-station number). Items are editable, so acceptable for v1.
```
