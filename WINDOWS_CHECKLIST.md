# Windows build — step-by-step checklist (run ON the Windows machine)

Full details/background: `WINDOWS.md`. This is the do-it list.

## 0. Prerequisites (once)
- [ ] Windows 10 (2004+) / 11, **Developer Mode** ON (Settings → Privacy & security → For developers).
- [ ] **Visual Studio 2022** with:
  - Workload **Desktop development with C++**
  - Workload **Universal Windows Platform development**
  - Individual components: **Windows 11 SDK (10.0.22621 or 10.0.19041)**, **MSVC v143**, **C++ (v143) Universal Windows Platform tools**
- [ ] **Node LTS** + **Git**.
- [ ] (Optional sanity check) in an **admin** PowerShell:
  ```powershell
  Set-ExecutionPolicy -Scope Process Unrestricted
  iwr https://aka.ms/rnw-deps.ps1 -UseBasicParsing | iex
  ```

## 1. Get the code
- [ ] Copy the **MSM_Windows** folder to the Windows machine (e.g. `C:\dev\MSM_Windows`).
      (It already has mocks/, metro.config.js, react-native.config.js, the three `.h`
      modules, and assets/windows/ tiles.)
- [ ] In that folder:
  ```powershell
  npm install
  npm install --save-dev react-native-windows@0.81.26
  ```

## 2. Generate the Windows project
- [ ] ```powershell
  npx react-native-windows-init --version 0.81.26 --overwrite --language cpp --no-telemetry
  ```
  This creates `windows\` (the `.sln`, the app project, ReactPackageProvider, etc.).
- [ ] Note the app project folder name created under `windows\` (call it `<App>` below,
      e.g. `windows\MarineSafetyManager\`).

## 3. Wire the native modules (Storage / Files / Sound)
- [ ] Copy these from the repo root into `windows\<App>\`:
  - `StorageModule.h`
  - `FileManagerModule.h`
  - `SoundModule.h`
- [ ] In **Visual Studio** (open `windows\*.sln`): right-click the `<App>` project →
      **Add → Existing Item…** → add the three `.h` files (so they're part of the project).
- [ ] Open `windows\<App>\ReactPackageProvider.cpp` and add the includes at the top:
  ```cpp
  #include "StorageModule.h"
  #include "FileManagerModule.h"
  #include "SoundModule.h"
  ```
  Make sure `CreatePackage` calls `AddAttributedModules(packageBuilder, true);`
  (the cpp-app template already does — it auto-registers every `REACT_MODULE` that is
  compiled into the project, so the includes above are what pull them in).

## 4. Tiles & assets
- [ ] Copy `assets\windows\*` → `windows\<App>\Assets\` (overwrite the placeholder tiles).
- [ ] Confirm the sound files exist in the bundle: `assets\sounds\ship-bell.mp3`,
      `success.mp3`, `error.mp3` (SoundModule reads `Bundle\assets\sounds\<name>.mp3`).

## 5. Build & run
- [ ] ```powershell
  npx react-native run-windows --release   # or omit --release for a debug run
  ```
  or in VS2022: set configuration **x64 / Release**, Build → Deploy → Start.

## 6. Verify (the whole point)
- [ ] App launches, ship bell plays.
- [ ] Import the LSA/FFE `.xlsx` (Settings → Import) — native Open dialog appears.
- [ ] Add/edit an item, **restart the app** → data is still there (StorageModule persistence).
- [ ] Export XLSX and a `.msm` backup (Reports / Settings) — native Save dialog appears;
      Restore the `.msm` back.
- [ ] Cloud sync: enter IMO + connection password → Connect → Push → Pull (REST path).

## Notes / known limits on Windows v1
- PDF export, Print, ZIP export, and photo/document attachments are intentionally
  disabled (shown with a message). Use XLSX or `.msm` for export.
- If Metro fails on RN-internal modules, see the RNW_OVERRIDES note in `WINDOWS.md`
  (already wired in `metro.config.js`; compare with `/Volumes/Turbo/MHMWin 1205`).
- To pull later source changes from the main project: on the Mac run
  `bash scripts/sync-windows.sh`, then re-copy MSM_Windows to the PC (or share via Turbo).
