// ===================================
// Sound effects (mirrors MHM utils/sound.ts)
// Ship's bell on app start + success / error cues. Always enabled.
// ===================================

import { Platform, NativeModules } from 'react-native';
import { Audio } from 'expo-av';

const onWindows = Platform.OS === 'windows';
const onWeb = Platform.OS === 'web';

// Sound plays normally on web / the desktop (Electron) build EXCEPT under Wine,
// where touching the audio device (mmdevapi.dll) throws a runtime assertion and
// crashes the app. The Electron main process detects Wine and sets this global,
// so real Windows keeps the ship's bell + cues while the Wine test stays quiet.
function soundDisabled(): boolean {
  return onWeb && (globalThis as any).__MSM_NO_SOUND__ === true;
}

// Audio mode: play even when the device is on silent (iOS), duck others on Android.
// (Skipped on Windows/web, where expo-av audio mode isn't used.)
if (!onWindows && !onWeb) {
  Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  }).catch(() => {});
}

/**
 * Play a bundled sound. iOS/Android use expo-av (by asset require). Windows has
 * no expo-av, so it calls the native SoundModule (SoundModule.h), which plays
 * Bundle\assets\sounds\<name>.mp3 by name. See WINDOWS.md.
 */
async function play(asset: number, name: string, volume: number): Promise<void> {
  if (soundDisabled()) return; // Wine: skip audio to avoid the mmdevapi crash
  if (onWindows) {
    try {
      (NativeModules as any).SoundModule?.playSound(name);
    } catch {
      /* sound is best-effort */
    }
    return;
  }
  try {
    const { sound } = await Audio.Sound.createAsync(asset, {
      shouldPlay: true,
      volume,
      progressUpdateIntervalMillis: 100,
    });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
    });
  } catch (error) {
    console.log('Error playing sound:', error);
  }
}

// Web audio via preloaded HTMLAudioElements. expo-av's createAsync loads the
// file asynchronously and often fails to actually play on web, so on web we play
// a cached <audio> element directly. On the desktop (Electron) build autoplay is
// allowed, so the splash bell rings immediately; a real browser may block it
// until the first interaction (autoplay policy) — nothing we can override.
const webAudioCache: Record<string, any> = {};
function playWeb(mod: any, volume: number): void {
  if (soundDisabled()) return;
  const g: any = globalThis as any;
  try {
    let uri: string | undefined;
    try { uri = require('expo-asset').Asset.fromModule(mod).uri; } catch { /* ignore */ }
    if (!uri) uri = typeof mod === 'string' ? mod : mod?.uri;
    if (!uri) return;
    let a = webAudioCache[uri];
    if (!a) { a = new g.Audio(uri); a.volume = volume; webAudioCache[uri] = a; }
    a.currentTime = 0;
    const p = a.play?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Soft ship's bell — used on the splash / app start. */
export const playShipBellSound = () =>
  onWeb ? playWeb(require('../assets/sounds/ship-bell.mp3'), 0.6) : play(require('../assets/sounds/ship-bell.mp3'), 'ship-bell', 0.6);

/** Short positive cue — import / save / sync success. */
export const playSuccessSound = () =>
  onWeb ? playWeb(require('../assets/sounds/success.mp3'), 0.5) : play(require('../assets/sounds/success.mp3'), 'success', 0.5);

/** Error cue — failed import / sync. */
export const playErrorSound = () =>
  onWeb ? playWeb(require('../assets/sounds/error.mp3'), 0.4) : play(require('../assets/sounds/error.mp3'), 'error', 0.4);
