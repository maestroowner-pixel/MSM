// ===================================
// react-native CLI config — Windows platform + autolinking tweaks.
//
// The react-native-windows CLI (@react-native-windows/cli) is installed ONLY on
// the Windows dev machine, so the require is guarded: on macOS/Linux it falls
// back to a bare config and does not break the iOS/Android tooling.
// The `dependencies` map disables Windows autolinking for native modules that
// have no Windows build (they are mocked in JS via metro.config.js).
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

module.exports = {
  ...windowsPlatform,
  dependencies: {
    // No Windows native build → don't autolink (mocked in JS on Windows).
    '@react-native-async-storage/async-storage': { platforms: { windows: null } },
    'react-native-svg': { platforms: { windows: null } },
  },
};
