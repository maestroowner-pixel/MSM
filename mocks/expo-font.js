// macOS mock for `expo-font` (no native ExpoFontLoader on react-native-macos).
// @expo/vector-icons only calls isLoaded / loadAsync / renderToImageAsync. We report
// fonts as "loaded" so the icon components render (they fall back to their fontFamily).
// NOTE: the icon glyph fonts are NOT registered with macOS here, so vector-icon glyphs
// may render as missing boxes until the .ttf files are bundled + registered natively
// (Info.plist ATSApplicationFontsPath) — see MACOS.md TODO. Text/layout are unaffected.

export const FontDisplay = { AUTO: 'auto', BLOCK: 'block', SWAP: 'swap', FALLBACK: 'fallback', OPTIONAL: 'optional' };

export async function loadAsync() {
  return undefined;
}
export function isLoaded() {
  return true; // pretend loaded so vector-icons renders instead of suspending
}
export function isLoading() {
  return false;
}
export function getLoadedFonts() {
  return [];
}
export async function unloadAsync() {}
export async function unloadAllAsync() {}
export function processFontFamily(name) {
  return name;
}
// Intentionally NOT exporting renderToImageAsync — @expo/vector-icons treats its
// absence as "outdated expo-font" and uses the plain text/fontFamily render path.

export function useFonts() {
  return [true, null];
}

export default {
  FontDisplay,
  loadAsync,
  isLoaded,
  isLoading,
  getLoadedFonts,
  unloadAsync,
  unloadAllAsync,
  processFontFamily,
  useFonts,
};
