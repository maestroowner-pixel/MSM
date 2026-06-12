// ===================================
// Metro config (Expo base + desktop module mocks).
//
// Two desktop tracks share the same JS app, each gated so iOS / Android builds
// see the plain Expo default:
//
//  • Windows (process.platform === 'win32'): swaps native-less modules for the
//    JS stubs in mocks/ and redirects a few RN internals to their `.windows`
//    variants (RNW_OVERRIDES, ported from MHM). See WINDOWS.md.
//
//  • macOS (process.env.RN_PLATFORM === 'macos'): react-native-macos build. The
//    Mac dev machine is darwin — the SAME platform as iOS/Android dev — so macOS
//    CANNOT be gated by process.platform. It is gated by the RN_PLATFORM env var,
//    set by the `macos` / `start:macos` npm scripts. Mocks the Expo native
//    modules that have no macOS target (expo-av, image/document-picker, print,
//    sharing, …). AsyncStorage DOES ship a macOS target, so it is NOT mocked here
//    (unlike Windows). See MACOS.md.
//
// On a plain `expo start` / iOS / Android run neither branch fires.
// ===================================

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');

const config = getDefaultConfig(__dirname);

const isWindows = process.platform === 'win32';
// This folder is a macOS-ONLY project (iOS/Android live in the sibling MSM project), so
// the macOS branch must be active for EVERY Metro instance here — including the packager
// Xcode starts itself, which does NOT set RN_PLATFORM. Gating on the env var made an
// Xcode build/run fail with "Invalid platform 'macos' selected" (resolver.platforms had
// no 'macos'). Default it on (everything except a Windows machine).
const isMacOS = !isWindows;

const mocksDir = path.resolve(__dirname, 'mocks');
const m = (f) => path.join(mocksDir, f);

// Helper: install a resolveRequest hook that swaps `mocks` entries for JS stubs.
function applyMocks(mocks, extraResolve) {
  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    for (const [mod, file] of Object.entries(mocks)) {
      if (moduleName === mod || moduleName.startsWith(mod + '/')) {
        if (file && fs.existsSync(file)) return { type: 'sourceFile', filePath: file };
        return { type: 'empty' };
      }
    }
    if (extraResolve) {
      const hit = extraResolve(context, moduleName, platform);
      if (hit) return hit;
    }
    return defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };
}

if (isWindows) {
  // Modules with no Windows native build → JS stub. `null` means "empty module".
  const WINDOWS_MOCKS = {
    'expo-av': m('expo-av.js'),
    'expo-image-picker': m('expo-image-picker.js'),
    'expo-document-picker': m('expo-document-picker.js'),
    'expo-file-system': m('expo-file-system.js'),
    'expo-print': m('expo-print.js'),
    'expo-sharing': m('expo-sharing.js'),
    'expo-linear-gradient': m('expo-linear-gradient.js'),
    'expo-screen-orientation': m('expo-screen-orientation.js'),
    'expo-secure-store': m('expo-secure-store.js'),
    'expo-modules-core': m('expo-modules-core.js'),
    '@react-native-async-storage/async-storage': m('async-storage.js'),
    'react-native-svg': m('react-native-svg.js'),
  };

  const rnPath = fs.realpathSync(
    path.resolve(require.resolve('react-native/package.json'), '..')
  );
  // react-native-windows only exists on the Windows dev machine.
  let rnwPath = null;
  try {
    rnwPath = fs.realpathSync(
      path.resolve(require.resolve('react-native-windows/package.json'), '..')
    );
  } catch {}

  // Redirect RN internals to their .windows variants (from MHM's metro config).
  const RNW_OVERRIDES = rnwPath
    ? [
        {
          match: (mod, origin) =>
            (mod === './BaseViewConfig' || mod.endsWith('/BaseViewConfig')) &&
            origin.includes('/react-native/Libraries/NativeComponent/'),
          file: 'Libraries/NativeComponent/BaseViewConfig.windows.js',
        },
        {
          match: (mod, origin) =>
            (mod === './Image' || mod.endsWith('/Image')) &&
            origin.includes('/react-native/Libraries/'),
          file: 'Libraries/Image/Image.windows.js',
        },
        {
          match: (mod, origin) =>
            (mod === './resolveAssetSource' || mod.endsWith('/resolveAssetSource')) &&
            origin.includes('/react-native/Libraries/'),
          file: 'Libraries/Image/resolveAssetSource.windows.js',
        },
        {
          match: (mod, origin) =>
            (mod === './ImageViewNativeComponent' || mod.endsWith('/ImageViewNativeComponent')) &&
            origin.includes('/react-native/Libraries/'),
          file: 'Libraries/Image/ImageViewNativeComponent.js',
        },
      ]
    : [];

  config.resolver.platforms = ['windows', 'win', 'native', 'android', 'ios'];

  const prevBlock = config.resolver.blockList;
  const prevBlockArr = Array.isArray(prevBlock) ? prevBlock : prevBlock ? [prevBlock] : [];
  config.resolver.blockList = [
    ...prevBlockArr,
    new RegExp(`${path.resolve(__dirname, 'windows').replace(/[\\/]/g, '/')}.*`),
    ...(rnwPath
      ? [
          new RegExp(`${rnwPath.replace(/[\\/]/g, '/')}/build/.*`),
          new RegExp(`${rnwPath.replace(/[\\/]/g, '/')}/target/.*`),
        ]
      : []),
    /.*\.ProjectImports\.zip/,
  ];

  applyMocks(WINDOWS_MOCKS, (context, moduleName) => {
    if (moduleName.includes('ReactDevToolsSettingsManager')) {
      const shim = m('ReactDevToolsSettingsManager.js');
      if (fs.existsSync(shim)) return { type: 'sourceFile', filePath: shim };
    }
    if (rnwPath) {
      const origin = context.originModulePath.replace(/\\/g, '/');
      for (const override of RNW_OVERRIDES) {
        if (override.match(moduleName, origin)) {
          const rnwFile = path.join(rnwPath, override.file);
          if (fs.existsSync(rnwFile)) return { type: 'sourceFile', filePath: rnwFile };
        }
      }
      if (
        moduleName.includes('ReactNativeViewConfigRegistry') &&
        origin.includes('/react-native-windows/')
      ) {
        const rnFile = path.join(rnPath, 'Libraries/Renderer/shims/ReactNativeViewConfigRegistry.js');
        if (fs.existsSync(rnFile)) return { type: 'sourceFile', filePath: rnFile };
      }
    }
    return null;
  });
} else if (isMacOS) {
  // Expo native modules with no macOS target → JS stub (reuse the Windows stubs;
  // they are platform-agnostic no-ops). AsyncStorage ships a macOS target, so it is
  // intentionally NOT mocked. (react-native-svg was removed from this copy — unused.)
  const MACOS_MOCKS = {
    'expo-av': m('expo-av.js'),
    'expo-image-picker': m('expo-image-picker.js'),
    'expo-document-picker': m('expo-document-picker.js'),
    'expo-file-system': m('expo-file-system.js'),
    'expo-print': m('expo-print.js'),
    'expo-sharing': m('expo-sharing.js'),
    'expo-linear-gradient': m('expo-linear-gradient.js'),
    'expo-screen-orientation': m('expo-screen-orientation.js'),
    'expo-secure-store': m('expo-secure-store.js'),
    'expo-modules-core': m('expo-modules-core.js'),
    'expo-font': m('expo-font.js'),
  };

  config.resolver.platforms = ['macos', 'native', 'ios', 'android'];

  // The community-CLI Metro (used by `react-native run-macos`) does not apply
  // Expo CLI's nested-module resolution, so packages npm kept nested under
  // `expo/` (expo-asset, expo-constants, …, pulled in transitively by expo-font /
  // @expo/vector-icons) aren't found by hierarchical lookup from a hoisted
  // top-level package. Add expo's own node_modules as an extra resolution root.
  config.resolver.nodeModulesPaths = [
    ...(config.resolver.nodeModulesPaths || []),
    path.resolve(__dirname, 'node_modules'),
    path.resolve(__dirname, 'node_modules/expo/node_modules'),
  ];

  // The "run before main module" list (RN's InitializeCore — sets up the FormData /
  // XHR / Platform globals) defaults to the iOS `react-native` fork. Swap it for the
  // `react-native-macos` InitializeCore so the polyfills + native module specs match
  // the linked native runtime (otherwise: red-box "Property 'FormData' doesn't exist"
  // / "Cannot read property 'OS' of undefined"). Expo's own winter runtime entry is
  // left untouched.
  config.serializer = config.serializer || {};
  const prevGetModules = config.serializer.getModulesRunBeforeMainModule;
  config.serializer.getModulesRunBeforeMainModule = () =>
    (prevGetModules ? prevGetModules() : []).map((p) =>
      p.replace(
        /node_modules\/react-native\/Libraries\/Core\/InitializeCore\.js$/,
        'node_modules/react-native-macos/Libraries/Core/InitializeCore.js'
      )
    );

  const prevBlock = config.resolver.blockList;
  const prevBlockArr = Array.isArray(prevBlock) ? prevBlock : prevBlock ? [prevBlock] : [];
  config.resolver.blockList = [
    ...prevBlockArr,
    // Don't crawl the generated native macOS project (Pods, build artefacts).
    new RegExp(`${path.resolve(__dirname, 'macos').replace(/[\\/]/g, '/')}/(build|Pods)/.*`),
  ];

  applyMocks(MACOS_MOCKS, (context, moduleName, platform) => {
    if (moduleName.includes('ReactDevToolsSettingsManager')) {
      const shim = m('ReactDevToolsSettingsManager.js');
      if (fs.existsSync(shim)) return { type: 'sourceFile', filePath: shim };
    }
    // CRUCIAL: the native side builds `react-native-macos`, but `react-native` (the
    // iOS fork) is what's installed for Expo. Redirect every `react-native` import to
    // the macOS fork so the JS (Platform.macos.js, native module specs) matches the
    // linked native runtime. Without this the app red-boxes with
    // "Cannot read property 'OS' of undefined" (Platform native constants missing).
    if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
      const rewritten = 'react-native-macos' + moduleName.slice('react-native'.length);
      return context.resolveRequest(context, rewritten, platform);
    }
    // CRUCIAL (images/assets): `@react-native/assets-registry` exists in TWO copies —
    // top-level and nested under react-native-macos. Metro's asset modules call
    // `registerAsset` from the copy resolved at the asset's location (top-level), but
    // react-native-macos's `resolveAssetSource` reads `getAssetByID` from its nested
    // copy → different module instances → resolveAssetSource returns null → `<Image>`
    // with a require()'d asset renders nothing (e.g. the splash logo). Pin every
    // `@react-native/assets-registry` import to the SINGLE react-native-macos copy.
    if (
      moduleName === '@react-native/assets-registry' ||
      moduleName.startsWith('@react-native/assets-registry/')
    ) {
      const base = path.resolve(
        __dirname,
        'node_modules/react-native-macos/node_modules/@react-native/assets-registry'
      );
      const sub = moduleName === '@react-native/assets-registry'
        ? 'registry'
        : moduleName.slice('@react-native/assets-registry/'.length);
      try {
        return { type: 'sourceFile', filePath: require.resolve(path.join(base, sub)) };
      } catch {
        /* fall through to default resolution */
      }
    }
    return null;
  });
}

module.exports = config;
