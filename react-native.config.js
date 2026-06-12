// ===================================
// react-native CLI config — Windows + macOS platform + autolinking tweaks.
//
// The react-native-windows CLI (@react-native-windows/cli) is installed ONLY on
// the Windows dev machine, so the require is guarded: on macOS/Linux it falls
// back to a bare config and does not break the iOS/Android/macOS tooling.
//
// The `dependencies` map disables autolinking for native modules with no build on
// the target platform (they are mocked in JS via metro.config.js):
//  • windows: AsyncStorage (mocked).
//  • macos:   the `expo` umbrella pod + Expo native modules — none ship a macOS pod,
//    and `expo`'s pod needs ExpoModulesCore (iOS-only) → the Apple build fails with
//    "'ExpoModulesCore/Platform.h' file not found". The bare RN AppDelegate this
//    project uses doesn't need them; expo-modules-core is mocked in JS.
//
// IMPORTANT — react-native-macos shares the **iOS** autolink config for Apple
// platforms, so the macOS build is excluded with the `ios` key, NOT `macos`
// (a `macos: null` key is silently ignored). This is a macOS-ONLY copy that never
// builds an iOS target, so disabling `ios` autolinking here is safe. See MACOS.md.
// ===================================

let windowsPlatform = {};
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { commands, dependencyConfig, projectConfig } = require('@react-native-windows/cli');
  windowsPlatform = {
    commands,
    platforms: { windows: { dependencyConfig, projectConfig, linkConfig: () => null } },
  };
} catch {
  // @react-native-windows/cli not installed (non-Windows machine) — ignore.
}

// The `expo` umbrella + Expo native modules: no macOS pod → keep out of the Apple
// autolink (mocked in JS). Excluded via the `ios` key (see header note).
const NO_MACOS_POD = [
  'expo',
  'expo-av',
  'expo-image-picker',
  'expo-document-picker',
  'expo-file-system',
  'expo-print',
  'expo-sharing',
  'expo-linear-gradient',
  'expo-screen-orientation',
  'expo-secure-store',
];

const macosAutolinkDisables = Object.fromEntries(
  NO_MACOS_POD.map((name) => [name, { platforms: { ios: null } }])
);

module.exports = {
  ...windowsPlatform,
  dependencies: {
    // No Windows native build → don't autolink (mocked in JS on Windows).
    '@react-native-async-storage/async-storage': { platforms: { windows: null } },
    // NOTE: react-native-svg was REMOVED from this macOS copy (unused by the app, and
    // its pod fails to compile on the macOS 26.x SDK). See MACOS.md.
    // No macOS pod → don't autolink on Apple (mocked in JS on macOS).
    ...macosAutolinkDisables,
  },
};
