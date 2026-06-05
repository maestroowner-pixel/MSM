# Marine Safety Manager (MSM) — Claude Code Context

## Project overview
React Native + Expo app for a ship's **LSA** (Life-Saving Appliances) and **FFE/FIFI**
(Fire-Fighting Equipment) inventory: per-category equipment registers, inspection/expiry
tracking, Excel import, PDF/XLSX export, optional Firebase cloud sync. Targets **iOS**,
**Android**, and **Windows** (react-native-windows, follow-up track).

Sibling app to **Marine Hospital Manager (MHM)** at `/Users/MarineHospitalManager/MHM_4.1.1`,
whose conventions (theme, navigation, expiry logic, XLSX import, Firebase device-approval) this
app mirrors. Bundle id `com.kukalab.msm`.

## Tech stack
- React Native 0.81.5 + React 19.1.0 + TypeScript + Expo SDK 54 (managed)
- Navigation: `@react-navigation` v6 (bottom-tabs + stack), gesture-handler swipe (no reanimated)
- Storage: AsyncStorage (local-first), one key per category `msm:<category>` + `msm:vessel_info`
- Import/Export: SheetJS (`xlsx`), `expo-document-picker`, `expo-print`, `expo-sharing`,
  `expo-file-system/legacy` (base64 read/write)
- Attachments: `expo-image-picker` (camera/library) + `expo-document-picker` (PDF/docs),
  persisted to `documentDirectory/attachments/` via `services/attachments.ts`. Items carry
  `attachments: Attachment[]`. **Certificates** (`types/certificate.ts`, key `msm:certificates`)
  are documents that link to many items (group certificate) — managed in the Certificates tab
  (`CertificatesSc` + `CertificateDetailSc`); item detail shows/links covering certificates.
- Audio: `expo-av` — ship's bell on app start (`utils/sound.ts` → `playShipBellSound`,
  asset `assets/sounds/ship-bell.mp3`), mirrors MHM. Shown via `screens/SplashSc.tsx`, an
  overlay in `index.tsx` (`showSplash` state) that animates the logo and calls `onDone` after ~2.2s.
- Cloud (optional): Firebase JS SDK (`firebase`) — Auth + Realtime DB, **config is a placeholder**

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
services/firebaseService.ts  Auth-by-IMO, RTDB push/pull, device approval — NEEDS CONFIG
contexts/DataContext.tsx     in-memory items + vessel, reload()/saveItem()/removeItem()
components/ui.tsx            Screen, Card, StatusPill/Dot, ScreenTitle, Empty, Label
screens/                    Dashboard, Categories, CategoryItems, ItemDetail(modal),
                             Import(modal), Reports, Settings, Manual (accordion help),
                             Splash, Consent (first-launch Privacy + Terms gate), Legal
                             (Privacy/Terms viewer, route.params.doc)
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

Also: `newArchEnabled` is `false` in app.json (re-prebuild after changing). Verified on the
iPhone 17 Pro simulator: Dashboard/Settings render, 627 imported items, export works.

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

Note: `npx expo export` AOT-compiles with `hermesc`; the dev workflow (`expo start` / `run:ios`)
is the validated path.

## Open items / TODO
1. **Firebase** — configured. Dedicated project `marine-safety-manager`; web config (apiKey,
   appId, messagingSenderId, etc.) is in `services/firebaseService.ts` (`FIREBASE_CONFIG`,
   `ROOT = 'safety_vessels'`). Auth uses `initializeAuth` + `getReactNativePersistence`.
   **Console steps the user must finish for sync to work:** (a) Authentication → enable
   Email/Password; (b) create Realtime Database — confirm region matches `databaseURL` (assumed
   europe-west1; web config has NO databaseURL until the DB exists); (c) paste
   `database.rules.json` into RTDB Rules (scopes `safety_vessels/$uid` to its own account).
   Vessels log in as `imo.<number>@marinesafety.app`. Windows still needs a REST auth path
   (MHM-style) — firebase/auth RN persistence doesn't run on react-native-windows.
2. **App icons** — DONE. Generated from `assets/MSM logo.png` (transparent isometric MSM cube):
   `icon.png` (iOS, white bg), `adaptive-icon.png` (Android foreground, transparent, white bg via
   app.json), `splash.png` (white bg), `favicon.png`. Windows/UWP tiles in `assets/windows/`
   (Square44/71/150/310, Wide310x150, StoreLogo, SplashScreen, LockScreenLogo, target-size
   variants) — drop into `windows/<App>/Assets/` after prebuild. Regenerate via the Pillow
   scripts (crop cube by alpha bbox, composite at scale on white/transparent).
3. **Windows track** — `npx expo prebuild` + react-native-windows + AsyncStorage native shim
   (mirror MHM's Windows branch); built on the Windows dev machine. Use `assets/windows/` tiles.
4. **Importer polish** — minor cosmetic mappings (e.g. Hydrants `type` = "Yes", FIFI BA-set
   `position` = fire-station number). Items are editable, so acceptable for v1.
```
