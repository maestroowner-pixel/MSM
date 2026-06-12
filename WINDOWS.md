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

## Native storage & file modules (ported from MHM) — REQUIRED for real data
Three native modules (repo root `.h` files) provide persistence and file I/O.
Copy them into `windows/<App>/` and register in the app's `ReactPackageProvider`:
- **`StorageModule.h`** → persistent key-value store in the registry
  (`HKCU\Software\MSMWindows\Storage`). `mocks/async-storage.js` bridges
  AsyncStorage to it, so **all app data persists across restarts** on Windows.
  Without it, the mock falls back to in-memory (data lost on restart).
- **`FileManagerModule.h`** (`RNCWindowsFileManager`) → Windows Save/Open dialogs
  (`saveFile`, `saveFileBase64`, `openFilePicker`) + `httpRequest` (for a future
  Firebase REST auth path). `utils/WindowsFileManager.ts` + `utils/fileShare.ts`
  route exports/imports through it: **XLSX export, .msm backup export & restore,
  and Excel import** work via native dialogs.
- **`SoundModule.h`** → ship-bell / cues (below).

Wiring: place the three `.h` files in the windows app project, then in
`ReactPackageProvider.cpp` add `packageBuilder.AddModule(...)` (the rnw template
auto-registers `REACT_MODULE`s if the headers are compiled into the project).
Compare with MHM at `/Volumes/Turbo/MHMWin 1205/windows/MHMWindows/`.

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

## Windows v1 capabilities (with the native modules wired)
Works:
- **Persistent data** — items, certificates, compressor logs, vessel info (via
  StorageModule + the AsyncStorage bridge).
- **XLSX export**, **.msm backup export & restore**, **Excel import** — via native
  Save/Open dialogs (FileManagerModule + `utils/fileShare.ts`).
- **Cloud sync** — full: Firebase Auth + Realtime Database over **REST** via
  `RNCWindowsFileManager.httpRequest` (firebaseService.ts branches on `onWindows`;
  the JS SDK's RN persistence/transport don't run on rnw). Tokens are saved in the
  persistent AsyncStorage (StorageModule), so sessions survive restarts.
- **Ship bell / cues** (SoundModule).

Not available on Windows v1 (guarded with a clear message or flattened):
- **PDF export & Print** — no Windows print engine (expo-print). XLSX / .msm cover export.
- **ZIP export** — needs the PDF + attachment files; disabled (use XLSX or .msm).
- **Attachments** — camera / image / document picking (expo-image-picker) and the
  per-item file store are not available; the `.msm` backup carries register data only.
- Gradients render flat (`expo-linear-gradient` → plain View).

## What's done vs TODO
- Done: cross-platform scaffolding (mocks, metro, react-native.config), tiles.
- TODO on Windows: generate `windows/`, install rnw, build, then iteratively port
  storage + file I/O (the big one) and any RNW_OVERRIDES from MHM.
