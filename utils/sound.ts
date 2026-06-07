// ===================================
// Sound effects (mirrors MHM utils/sound.ts)
// Ship's bell on app start + success / error cues. Always enabled.
// ===================================

import { Platform, NativeModules } from 'react-native';
import { Audio } from 'expo-av';

const onWindows = Platform.OS === 'windows';

// Audio mode: play even when the device is on silent (iOS), duck others on Android.
// (Skipped on Windows, where expo-av is unavailable and the native SoundModule is used.)
if (!onWindows) {
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

/** Soft ship's bell — used on the splash / app start. */
export const playShipBellSound = () => play(require('../assets/sounds/ship-bell.mp3'), 'ship-bell', 0.6);

/** Short positive cue — import / save / sync success. */
export const playSuccessSound = () => play(require('../assets/sounds/success.mp3'), 'success', 0.5);

/** Error cue — failed import / sync. */
export const playErrorSound = () => play(require('../assets/sounds/error.mp3'), 'error', 0.4);
