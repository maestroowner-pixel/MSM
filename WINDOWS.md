# Marine Safety Manager — Windows (react-native-windows) build

Reference: the working **MHM Windows** project at `/Volumes/Turbo/MHMWin 1205`
(Expo SDK 55 / RN 0.83). MSM is on **Expo SDK 54 / RN 0.81.5**, so use
**react-native-windows 0.81.x** (latest `0.81.26`).

This repo already carries the **cross-platform-safe** Windows scaffolding (does
not affect iOS/Android — everything is gated to `process.platform === 'win32'`):
- `mocks/` — JS stubs for native modules with no Windows build.
- `metro.config.js` — on Windows, swaps those modules for the stubs.
- `react-native.config.js` — disables Windows autolinking for native-less libs;
  `@react-native-windows/cli` is required only when present (guarded for macOS).
- `assets/windows/` — UWP tiles (Square/Wide/Splash/LockScreen).

The `windows/` native project itself is **generated on the Windows machine** and
is gitignored (like `ios/` and `android/`).

## On the Windows dev machine

### 1. Prerequisites
- Windows 10 (2004+) or 11, **Developer Mode** on.
- **Visual Studio 2022** with workloads:
  - *Desktop development with C++*
  - *Universal Windows Platform development*
  - Components: Windows 10/11 SDK (10.0.19041.0+), MSVC v143, C++ (v143) UWP tools.
- Node LTS, Git. (Quick check: run Microsoft's `rnw-dependencies.ps1` as admin.)

### 2. Install deps
```powershell
git clone <repo> ; cd MarineSafetyManager
npm install
npm install --save-dev react-native-windows@0.81.26   # Windows machine only
```
(Keep `react-native-windows` out of the committed `package.json` so macOS/Linux
installs stay clean — install it locally on the Windows machine, as MHM does.)

### 3. Generate the windows project
```powershell
npx react-native-windows-init --version 0.81.26 --overwrite --language cpp
# (or the newer:  npx @react-native-community/cli init-windows --template cpp-app --overwrite)
```
Then copy the tiles: `assets/windows/*` → `windows/<App>/Assets/`.

### 4. Build & run
```powershell
npx react-native run-windows            # debug
# or open windows/*.sln in VS2022 → x64 / Release → Build
```

## Native sound module (ported from MHM)
`SoundModule.h` (repo root) is a WinRT module that plays
`Bundle\assets\sounds\<name>.mp3`. `utils/sound.ts` calls
`NativeModules.SoundModule.playSound('ship-bell' | 'success' | 'error')` on
Windows (expo-av on iOS/Android). Wire it into the generated project:
1. Copy `SoundModule.h` → `windows/<App>/`.
2. Register it in the app's `ReactPackageProvider` (or add `PackageProviders().Append(...)`),
   the same way the rnw template adds modules. (Compare with MHM's
   `/Volumes/Turbo/MHMWin 1205/windows/`.)
3. Ensure the `assets/sounds/*.mp3` ship in the app's `Bundle\assets\sounds\` (the
   Metro bundle copies them; the module reads them next to the exe).

## Tuning (mirror MHM if you hit errors)
The **RNW_OVERRIDES** (redirect RN's internal `Image`/`BaseViewConfig`/
`resolveAssetSource` to their `.windows` variants) and the
`ReactDevToolsSettingsManager` shim are already included in this repo's
`metro.config.js` (active only when `react-native-windows` is installed). If the
paths differ for your rnw build, compare with
`/Volumes/Turbo/MHMWin 1205/metro.config.js`.

If **gesture-handler / screens / safe-area-context** fail to build on Windows,
disable their autolinking in `react-native.config.js` (`platforms: { windows: null }`)
and null them in `metro.config.js`'s `WINDOWS_MOCKS` — then in `index.tsx` wrap the
swipe `Gesture` / `GestureHandlerRootView` in a `Platform.OS !== 'windows'` guard
(safe-area-context degrades to zero insets; navigation works without native screens).

## Reduced functionality on Windows v1 (mocked — needs native/WinRT work later)
- **No persistence** — AsyncStorage is in-memory (`mocks/async-storage.js`); data is
  lost on restart. Replace with a file-backed or community Windows storage shim.
- **expo-file-system** stubbed → backup/restore, XLSX/ZIP export, attachments file I/O
  are no-ops. Needs a WinRT/file implementation.
- **No** camera / image / document picking (expo-image-picker, expo-document-picker).
- **No** native print / share (expo-print, expo-sharing).
- **Audio**: handled via the native `SoundModule.h` (see above) — wire it into the
  windows project; otherwise the bell/cues are silent.
- Gradients render flat (`expo-linear-gradient` → plain View).
- **Firebase auth**: `getReactNativePersistence` does not run on rnw — use a REST
  auth path or `getAuth` without persistence (see firebaseService.ts note).

## What's done vs TODO
- Done: cross-platform scaffolding (mocks, metro, react-native.config), tiles.
- TODO on Windows: generate `windows/`, install rnw, build, then iteratively port
  storage + file I/O (the big one) and any RNW_OVERRIDES from MHM.
