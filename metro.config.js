// ===================================
// Metro config (Expo base + Windows-only module mocks + RNW overrides).
//
// On a Windows dev machine (process.platform === 'win32') Metro: (1) swaps the
// native modules that have no Windows build for the JS stubs in mocks/, and
// (2) redirects a few react-native internals to their `.windows` variants
// (RNW_OVERRIDES, ported from the working MHM project). On iOS / Android / macOS
// this whole block is INERT — the config is the plain Expo default.
// ===================================

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');

const config = getDefaultConfig(__dirname);

const isWindows = process.platform === 'win32';

if (isWindows) {
  const mocksDir = path.resolve(__dirname, 'mocks');
  const m = (f) => path.join(mocksDir, f);

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

  const defaultResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    for (const [mod, file] of Object.entries(WINDOWS_MOCKS)) {
      if (moduleName === mod || moduleName.startsWith(mod + '/')) {
        if (file && fs.existsSync(file)) return { type: 'sourceFile', filePath: file };
        return { type: 'empty' };
      }
    }
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
    return defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
