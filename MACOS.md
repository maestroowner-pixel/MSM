# Marine Safety Manager — macOS (react-native-macos) build

This is the **macOS desktop** track of MSM, kept in a sibling folder
`/Users/Inspector/MMM_Mac` (moulded from the iOS/Android MSM project at
`/Users/Inspector/MarineSafetyManager`). It reuses the **same JS/TS app** (index.tsx,
screens/, services/, …) and adds a native **react-native-macos 0.81.5** shell —
the macOS analogue of the Windows (`react-native-windows`) track in `WINDOWS.md`.

- RN core: **react-native 0.81.5** (matches iOS/Android) — so **react-native-macos 0.81.5**.
- Expo: **SDK 54 (managed)**. Expo is **not officially supported on macOS**, so the
  Expo *native* modules are mocked in JS (see below); the pure-JS Expo bits (metro
  config, asset pipeline) still work.

## Why macOS is gated by an env var, not `process.platform`
The Windows track keys off `process.platform === 'win32'`. **The Mac dev machine is
`darwin` — the same platform as iOS/Android dev** — so macOS cannot use that signal.
Instead the macOS branch fires on **`process.env.RN_PLATFORM === 'macos'`**, which the
npm scripts set:
```jsonc
"macos":       "RN_PLATFORM=macos react-native run-macos",
"start:macos": "RN_PLATFORM=macos expo start"
```
A plain `expo start` / `npm run ios` leaves both desktop branches inert.

## Cross-platform-safe scaffolding already in this repo
None of this affects iOS/Android (all macOS logic is behind the `RN_PLATFORM` gate):
- **`package.json`** — `react-native-macos@0.81.5` devDep + `macos` / `start:macos` scripts.
- **`.npmrc`** — `legacy-peer-deps=true`. Needed because every `react-native-macos@0.81.x`
  declares `peer react@^19.1.4`, but Expo SDK 54 pins `react@19.1.0`. The 19.1.0↔19.1.4
  gap is a patch-level quirk; legacy-peer-deps lets the install resolve with react 19.1.0.
- **`metro.config.js`** — on `RN_PLATFORM=macos`: swaps the Expo native modules with no
  macOS target for the `mocks/` JS stubs, adds `macos` to `resolver.platforms`, and blocks
  `macos/build` + `macos/Pods` from the crawl. AsyncStorage + react-native-svg are **not**
  mocked (they ship macOS targets).
- **`react-native.config.js`** — disables macOS autolinking (`platforms: { macos: null }`)
  for those same Expo modules, so `pod install` in `macos/` doesn't choke on a missing
  macOS pod. AsyncStorage + svg are left to autolink.
- **`mocks/`** — the platform-agnostic JS stubs (shared with the Windows track).

The `macos/` native project itself is **generated** (see below); its build output
(`macos/build`, `macos/Pods`) is gitignored.

## Build & run  (the macos/ native project is already generated & building)
The `macos/` Xcode project is generated and **compiles cleanly** (`** BUILD SUCCEEDED **`,
validated headless). To run:
```bash
cd /Users/Inspector/MMM_Mac
npm install                                   # if node_modules absent (legacy-peer-deps via .npmrc)
RCT_NEW_ARCH_ENABLED=0 pod install --project-directory=macos   # if macos/Pods absent
npm run macos                                 # RN_PLATFORM=macos react-native run-macos (starts Metro + launches)
# or: open macos/marine.safety.manager.mac.xcworkspace in Xcode → Run
# headless compile check:
#   xcodebuild -workspace macos/marine.safety.manager.mac.xcworkspace \
#     -scheme "marine.safety.manager.mac-macOS" -configuration Debug \
#     -derivedDataPath macos/build build CODE_SIGNING_ALLOWED=NO
```
Built app (Debug): `macos/build/Build/Products/Debug/marine.safety.manager.mac.app`
(loads JS from the Metro dev server at runtime).

### Hard-won setup fixes (keep these — needed to make Expo + react-native-macos build)
1. **`.npmrc` `legacy-peer-deps=true`** — every `react-native-macos@0.81.x` peers
   `react@^19.1.4`, Expo SDK 54 pins `react@19.1.0`. Benign patch gap; lets install resolve.
2. **`@react-native-community/cli@20.0.2`** (devDep) — Expo projects don't ship it, but
   `use_native_modules!` (Podfile) and `react-native run-macos` need it for autolinking.
3. **`@react-native/metro-config` + `@react-native/babel-preset`** (devDeps) — the community
   CLI's Metro loader hard-requires `@react-native/metro-config` even though our `metro.config.js`
   uses `expo/metro-config` internally.
4. **`metro.config.js` → `resolver.nodeModulesPaths` includes `node_modules/expo/node_modules`**
   — the community-CLI Metro doesn't do Expo's nested-module resolution, so transitive Expo deps
   kept nested under `expo/` (expo-asset, …) wouldn't resolve otherwise.
5. **`AppDelegate.mm` `self.moduleName = @"main"`** — Expo's `registerRootComponent()` registers
   the root under the fixed name `"main"`; the generated default used the dotted package name.
6. **Autolink excludes via the `ios` key, NOT `macos`** (in `react-native.config.js`) — react-native-macos
   shares the **iOS** autolink config for Apple platforms, so `macos: null` is silently ignored.
   The `expo` umbrella pod + Expo native modules are excluded with `ios: null` (this is a macOS-ONLY
   copy that never builds iOS). Without this, the `expo` pod fails: `'ExpoModulesCore/Platform.h' file not found`.
7. **`react-native-svg` REMOVED** — unused by the app (no imports) and its pod fails to compile on
   the macOS 26.x SDK. Dropped from package.json entirely.
8. **Folder has NO space** (`MMM_Mac`, not `MMM Mac`) — RN/Xcode build-phase scripts break on a
   space in the path (a `find` in pod install already choked on it).
9. **`react` bumped to `19.1.4`** (was Expo's `19.1.0`) — `react-native-macos`'s bundled
   `react-native-renderer` is `19.1.4` and **enforces an EXACT match at runtime**: with 19.1.0 the
   renderer threw "Incompatible React versions", so `AppRegistry.registerComponent` never ran →
   `"main" has not been registered` → **blank window** (JS ran, native red-box/LogBox showed, but no
   UI mounted). This was the real cause of the blank window, found via the Metro CDP console.
   (`.npmrc` legacy-peer-deps still needed for other Expo packages that peer 19.1.0.)
10. **`expo-font` mocked** (`mocks/expo-font.js`) — `@expo/vector-icons` calls into the native
    `ExpoFontLoader` (`getLoadedFonts`), absent on macOS → "is not a function" render error. The mock
    reports fonts as loaded so icon components render.
11. **Icon glyph font bundled + registered** — the app only uses `MaterialCommunityIcons`, whose
    glyph Text sets `fontFamily: 'material-community'` (the name expo-font would have registered it
    under on iOS). On macOS we instead: (a) copy `MaterialCommunityIcons.ttf` to
    `macos/<app>/Fonts/material-community.ttf` with its internal name table **renamed to
    `material-community`** (fonttools — see below), (b) add the `Fonts` folder reference to the app
    target's Resources (Xcodeproj), (c) set Info.plist **`ATSApplicationFontsPath = Fonts`** so macOS
    auto-registers it under that family at launch. Result: tab-bar + in-app glyphs render. To add
    another icon family, repeat (rename its .ttf to the family string in
    `@expo/vector-icons/build/<Family>.js`'s `createIconSet(glyphMap, '<name>', …)`).
12. **Default window size** — `AppDelegate.mm` sets `minSize` (620×560) and, ONCE on first launch
    (guarded by a `MSMDidSetDefaultWindowSize` NSUserDefault), a 900×820 content size + centers it,
    then RCTAppDelegate's frame-autosave remembers the user's later resizing.
13. **`<Image source={require(...)}>` rendering** — TWO fixes were needed (without them the splash
    octopus/logo and any bundled image render blank):
    (a) `@react-native/assets-registry` exists in two copies (top-level + nested under
    react-native-macos); the Metro asset module's `registerAsset` and rn-macos's
    `resolveAssetSource`/`getAssetByID` used DIFFERENT copies → `getAssetByID` returned undefined →
    `resolveAssetSource` → `null`. Fixed by pinning every `@react-native/assets-registry` import to
    the single react-native-macos copy in `metro.config.js`'s macOS resolver.
    (b) Expo registers a custom asset source transformer (`expo-asset` `Asset.fx`) that resolves
    require()'d images via `Asset.fromMetadata(...).uri` — EMPTY on react-native-macos (needs the
    Expo manifest/expo-constants) → `uri: ""`. `index.tsx` overrides it on macOS via
    `Image.resolveAssetSource.setCustomSourceTransformer(r => r.defaultAsset())`, restoring RN's
    default resolver (correct dev-server `http://…/assets/…` URI in dev, `file://` in release).
    Diagnosed via the Metro CDP console (`resolveAssetSource` returned `{…,uri:""}`).
14. **`resizeMode` is ignored on react-native-macos `Image`/`Animated.Image`** → an image whose box
    aspect ratio differs from the source gets stretched. Seen on: the splash MSM logo (`SplashSc`),
    the Paywall logo (`PaywallSc`), and the Manual "About" octopus watermark (`ManualSc` — a full-bleed
    `width/height:100%` background stretched the near-square octopus across the wide card). Fix: give
    the image box the source's aspect ratio with explicit `width`/`height` instead of relying on
    `resizeMode="contain"`. For the octopus, on macOS render a centered fixed-size watermark
    (`octopusWrapMac` center container + `octopusMac` 240×234) instead of the stretched full-bleed
    image. (`aspectRatio` alone misbehaves on rn-macos — it blew an image up full-window.)
15. **Bundle identifier = `com.kukalab.msm`** (same as iOS — one app). Set `PRODUCT_BUNDLE_IDENTIFIER`
    in the Xcode project (was the rn-macos default `org.reactjs.native.$(PRODUCT_NAME…)`). NOTE:
    changing it moves the AsyncStorage container (`~/Library/.../<bundle-id>/RCTAsyncLocalStorage_V1`),
    so stored data (incl. the consent flag) resets on the next launch.
16. **Ship's bell / sound cues** — expo-av has no macOS target (mocked → silent), so audio plays via
    a native module **`SoundModule.m`** (NSSound) in the app target, mirroring the Windows SoundModule.
    `utils/sound.ts` routes desktop (Windows + macOS) through `NativeModules.SoundModule.playSound(name)`.
    The `.mp3` cues are bundled in `Resources/Sounds/` (copied from `assets/sounds/`, added to the
    Xcode Resources). `RCT_EXPORT_MODULE` auto-registers it (old-arch bridge). Verified: the bell
    fires on the splash (native log `[SoundModule] playing: …/ship-bell.mp3`).
17. **Human-readable app name** — the menu-bar / Finder name was the dotted `marine.safety.manager.mac`
    (from `PRODUCT_NAME`). Set Info.plist `CFBundleName` + `CFBundleDisplayName` = **`Marine Safety
    Manager`**, and the window title via `AppDelegate.mm` (`self.window.title = @"Marine Safety Manager"`,
    overriding RCTAppDelegate's default of the moduleName "main"). `PRODUCT_NAME` / the target & `.app`
    file keep the dotted name (changing them would churn the scheme) — only the display strings changed.
18. **App icon** — the generated `AppIcon.appiconset` had a `Contents.json` listing all mac icon
    slots but **no actual PNG files**, so the Dock/Finder showed the blank grid placeholder. Fixed by
    generating every size from `assets/icon.png` (1024²) — `icon_{16,32,64,128,256,512,1024}.png` via
    `sips -z` — and adding a `filename` to each slot in `Contents.json`. `actool` then compiles them
    into `Contents/Resources/AppIcon.icns` (+ Assets.car). `ASSETCATALOG_COMPILER_APPICON_NAME=AppIcon`
    was already set. To refresh a stale Dock/Finder icon after rebuild: `lsregister -f <app>`.

## App tweaks (shared JS — also apply to iOS/Android)
- **Paywall price** is `€10.00 / year` — the fallback `priceString` in `services/purchases.ts`
  (`FALLBACK.priceString`). Shown until RevenueCat returns the real store-localized price.
- **Paywall logo** box is sized to the wide msm-logo aspect ratio (`PaywallSc` `logo: {width:96,height:52}`),
  same reason as the splash (rn-macos ignores `resizeMode="contain"` → square box stretches it).

## Desktop file I/O, reports, navigation (native module + JS routing)
Report/backup export and Excel import work on macOS via a native module
**`FileManagerModule.m`** (exposed as `RNCMacFileManager`, mirrors the Windows
`RNCWindowsFileManager`) — expo-print/sharing/file-system are mocked:
- `saveFileBase64` / `saveFile` → **NSSavePanel** (xlsx/pdf/zip bytes, or .msm text).
- `openFilePicker([ext])` → **NSOpenPanel**, returns `{name, content:base64}`.
- `htmlToPdfBase64(html)` → **WKWebView** render → PDF base64 (expo-print has no macOS target).
- Entitlements: `com.apple.security.files.user-selected.read-write` (NSSavePanel needs write).
- **Module name MUST match the JS lookup**: `RCT_EXPORT_MODULE(RNCMacFileManager)` — a bare
  `RCT_EXPORT_MODULE()` registers under the class name (`FileManagerModule`) and the JS side
  (`NativeModules.RNCMacFileManager`) then can't find it → silent fallback. (Same gotcha bit the
  first build: XLSX hit the "save dialog not available" fallback, PDF returned null.)

JS routing (one code path for all platforms):
- `utils/MacFileManager.ts` wraps the native module; `utils/fileShare.ts` adds `onMacOS`/`onDesktop`
  and routes `deliverFile` (save) + `pickFileBase64` (open) through it on desktop.
- `services/export.ts`: **PDF** on macOS renders via `macHtmlToPdfBase64` then `deliverFile`;
  **XLSX** already flows through `deliverFile` (works once the module is registered); **ZIP** is
  guarded off on desktop (`onDesktop`) — it needs per-item attachment file reads (no image picker
  on macOS). ReportsSc hides the ZIP button on desktop.
- `services/backup.ts` (.msm restore) + `screens/ImportSc.tsx` (Excel import) use `pickFileBase64`
  on `onDesktop` (were `onWindows`-only) → native Open panel instead of the mocked DocumentPicker.
- Verified live: Export PDF opens the NSSavePanel with the rendered report; the file picker opens
  for import. (NSSavePanel/NSOpenPanel run out-of-process under the sandbox/powerbox, so they are NOT
  AX children of the app — drive them with CGEvent clicks at screen coords, not System Events.)

### Navigation: back button on macOS (no swipe-back)
The app is header-less and relies on gesture-handler **swipe-back**, which is touch-only — on macOS
pushed/modal screens (Import, Manual, Legal, Compressor, CategoryItems, …) were a **dead end**.
`index.tsx` now sets `headerShown: onMacOS` on the stack (root `Main` stays header-less): a minimal
back-button-only header (`headerTitle: ''`, themed) lets every pushed screen be dismissed. Mobile is
unchanged (swipe-back). Verified live: the blue ← appears and dismisses the screen.

### Attachments: no camera on macOS
`ItemDetailSc` / `CertificateDetailSc` "Choose a source" menus omit the **Camera** option on macOS
(`Platform.OS === 'macos'`) — desktop has no camera. Photo Library + Document remain.

### Attachments: pick + store natively (expo pickers/file-system are mocked)
`services/attachments.ts` `pickDocument` / `pickFromLibrary` used expo-document/image-picker (mocked
→ canceled), and `persist()` used expo-file-system (mocked → no-op), so on macOS **no file could be
attached** (PDF/photo). Now, on `Platform.OS === 'macos'`:
- pick via the native **NSOpenPanel** (`macOpenFile`, filtered to doc/image extensions),
- store the picked bytes natively (`FileManagerModule.persistBase64` → writes into
  `Application Support/<bundle>/attachments/` and returns a `file://` URI),
- `openFile` → `FileManagerModule.openPath` (NSWorkspace opens with the default app),
- `deleteFile` → `FileManagerModule.deletePath`.
This drives BOTH the certificate file (`CertificateDetailSc`) and per-item attachments
(`ItemDetailSc`). `<Image source={{uri:'file://…'}}>` renders the stored image; PDFs show the
filename + Open/Replace/**Remove** buttons (Remove detaches — clears `fileUri`). Verified live:
a PDF attaches and the file lands in the container's `attachments/` dir.
NOTE: the `.msm`/ZIP backup reads attachment binaries via expo-file-system (mocked) → on macOS the
backups carry register data but not the attachment files yet (future: read them via the native module).

## Driving the UI for screenshots (rn-macos)
`System Events`'s `click at` does NOT reach RN views; use a real CGEvent click instead. Tiny Swift
helper (`/tmp/click.swift` → `swiftc`): posts `leftMouseDown`/`leftMouseUp` at a screen point. Screen
coords = window position (from System Events `position of front window`) + the control's offset in
window points. Tab bar buttons are at `x=(n+0.5)/5*width, y≈height-28`.

Regenerating the renamed font (if the icon set is updated):
```python
from fontTools.ttLib import TTFont
f = TTFont('node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf')
for nid in (1,4,6,16):
    f['name'].setName('material-community', nid, 3, 1, 0x409)
    f['name'].setName('material-community', nid, 1, 0, 0)
f.save('macos/marine.safety.manager.mac-macOS/Fonts/material-community.ttf')
```

### Debugging the running app (no Chrome needed)
JS `console`/errors moved to React Native DevTools (CDP). To read them headless, connect to the
inspector target (`curl http://localhost:8081/json` → `webSocketDebuggerUrl`) over a WebSocket and
subscribe to `Runtime.consoleAPICalled` / `Log.entryAdded` (this is how the React-version mismatch
above was found). Screenshot the window with `screencapture -x out.png`.

### To regenerate macos/ from scratch (if ever needed)
```bash
npx react-native-macos-init --version 0.81.5 --overwrite   # rescaffolds macos/
```
…then re-apply the macos/-local fixes below (the generated `macos/` is gitignored), and re-run
`pod install`. Everything else lives in the committed JS/config files.

### macos/-LOCAL fixes to re-apply after regenerating macos/ (Xcode build)
These live inside the generated (gitignored) `macos/` project — re-do them after any
`react-native-macos-init --overwrite`:
1. **AppDelegate.mm**: `self.moduleName = @"main"` (fix #5); window title + default size (fix #12);
   the `Sounds`/`Fonts` resource folders, `SoundModule.m` + `FileManagerModule.m` sources, and the
   Info.plist keys (`ATSApplicationFontsPath`, `CFBundleName/DisplayName`, ATS localhost) — see the
   relevant fixes above. `PRODUCT_BUNDLE_IDENTIFIER = com.kukalab.msm`. Entitlements: user-selected
   read-write. App icon PNGs in the appiconset.
2. **Bundle phase entry file** — the generated "Bundle React Native code and images" phase runs
   `react-native-xcode.sh`, which on macOS bundles **even in Debug** (the iOS simulator skip does NOT
   apply when `PLATFORM_NAME == macosx`) and defaults `ENTRY_FILE` to **`index.macos.js`**. This app's
   entry is `index.tsx`, so the bundle fails with `index.macos.js … was not found` →
   **"Command PhaseScriptExecution failed with a nonzero exit code"** (an Xcode build error, seen
   on both Debug and Release). Fix: in BOTH "Bundle React Native code and images" shell-script phases
   (`project.pbxproj`), add `export ENTRY_FILE=index.tsx` before the `react-native-xcode.sh` call:
   ```
   export NODE_BINARY=node
   export ENTRY_FILE=index.tsx
   ../node_modules/react-native-macos/scripts/react-native-xcode.sh
   ```
   (Note: `react-native-xcode.sh` does NOT source `.xcode.env`, so set it in the phase itself.)

### Metro must default to the macOS platform (Xcode-started packager)
`metro.config.js` activates the macOS branch on `!isWindows` (NOT on `RN_PLATFORM=macos`). This is a
macOS-only project, and the packager **Xcode starts itself** doesn't set `RN_PLATFORM`, so gating on
the env var made `resolver.platforms` lack `'macos'` → builds/runs failed with
**"Invalid platform 'macos' selected"**. Defaulting on (every non-Windows Metro instance here serves
macOS) fixes Xcode-driven builds and `npm run macos` alike.

### `<Modal>` is replaced (RCTModalHostView is compiled out on macOS)
react-native-macos wraps `RCTModalHostViewManager.m` in `#if !TARGET_OS_OSX`, so `<Modal>` from
react-native throws **"No component found for view with name RCTModalHostView"**. Use
`components/PlatformModal.tsx` instead (drop-in): iOS/Android get the real `<Modal>`; macOS registers
the children into `components/modalStore.ts` and renders them via `<ModalOutlet/>` (mounted once at the
app root in `index.tsx`) as a window-covering overlay — a module-level store so a nested modal (e.g.
the date picker inside a ScrollView form) still covers the window without a render loop. Swapped in
`SimpleDatePicker`, `ItemDetailSc`, `SettingsSc`. Add `<ModalOutlet/>` at the App root if regenerating.

## Expo-module mocks → which features degrade on macOS
The mocked modules (no macOS native target) and the app behaviour:
- `expo-av` → **ship bell silent** (audio stub). `utils/sound.ts` already guards by platform.
- `expo-image-picker`, `expo-document-picker` → **no camera / file-picker attachments**.
- `expo-print` → **no PDF / Print** (use XLSX export).
- `expo-sharing`, `expo-file-system` → file delivery must go through a macOS save/open
  path (see TODO — mirror the Windows `FileManagerModule` with an NSSavePanel module).
- `expo-linear-gradient` → gradients render flat but **opaque** (the mock paints the View with
  the gradient's first color). This matters: a full-screen gradient background that rendered
  transparent let the screen behind bleed through — e.g. the first-launch Consent overlay showed
  the Dashboard header underneath. Keeping it opaque fixes that.
- `expo-secure-store`, `expo-screen-orientation` → no-ops (irrelevant on desktop).

What works on macOS (native modules that DID build & autolink): **AsyncStorage**
(persistence → data survives restarts), **react-native-gesture-handler**,
**react-native-safe-area-context**, **@react-native-picker/picker**. Plus the full
register UI (navigation, lists, item detail) and SheetJS XLSX generation in-memory;
Firebase JS SDK over its normal transport.

## Platform guards in the app code (TODO to fully wire)
The shared code currently branches on `Platform.OS === 'windows'` (the `onWindows`
const in `utils/fileShare.ts`, `utils/sound.ts`, `services/firebaseService.ts`,
`services/export.ts`, `services/backup.ts`). On react-native-macos `Platform.OS === 'macos'`.
To give macOS the same graceful degradation as Windows, introduce an `onMacOS`
(or a shared `isDesktop`) alongside `onWindows` and gate PDF/Print/ZIP/attachments
the same way. Until then, those paths will attempt the (mocked) Expo calls and no-op
or throw — acceptable for a first boot, but tidy up before shipping.

## macOS v1 — what's done vs TODO
- **Done:** sibling project moulded from MSM; cross-platform-safe scaffolding
  (package.json, .npmrc, metro, react-native.config, mocks); deps installed; native
  `macos/` Xcode project generated; `pod install` clean (76 pods); JS bundles for the
  `macos` platform; **native build succeeds** (`** BUILD SUCCEEDED **`); **app launches and
  RENDERS the real RN UI** — verified live: Dashboard (status pills + equipment register), the
  tab bar with **MaterialCommunityIcons glyphs**, and category screens all render with data; the
  window opens at a sensible default size. JS runs, no red-box.
- **TODO (not yet done):**
  1. Add an `onMacOS` guard set (mirror `onWindows`) in `utils/fileShare.ts`, `utils/sound.ts`,
     `services/export.ts`, `services/backup.ts`, `services/firebaseService.ts` for PDF/Print/ZIP/
     attachments — otherwise those paths hit the mocked Expo calls and no-op silently.
  2. Native **save/open panel** module (NSSavePanel/NSOpenPanel) to bring back
     XLSX export + `.msm` backup/restore + Excel import on desktop — the macOS analogue
     of the Windows `FileManagerModule.h` (`utils/fileShare.ts` already abstracts delivery).
  3. **Desktop layout polish** — the UI is mobile-portrait-styled (looks tablet-like); optionally
     adapt to wider desktop widths. The default window size + min size are already set (fix #12).
  4. App icon set (`.icns`) from `assets/MSM logo.png`; menu; release build
     (embeds `main.jsbundle`) + signing/notarisation.
