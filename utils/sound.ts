// ===================================
// Sound effects (mirrors MHM utils/sound.ts)
// Ship's bell on app start + success / error cues. Always enabled.
// ===================================

import { Audio } from 'expo-av';

// Audio mode: play even when the device is on silent (iOS), duck others on Android.
Audio.setAudioModeAsync({
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  shouldDuckAndroid: true,
}).catch(() => {});

async function play(asset: number, volume: number): Promise<void> {
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
export const playShipBellSound = () => play(require('../assets/sounds/ship-bell.mp3'), 0.6);

/** Short positive cue — import / save / sync success. */
export const playSuccessSound = () => play(require('../assets/sounds/success.mp3'), 0.5);

/** Error cue — failed import / sync. */
export const playErrorSound = () => play(require('../assets/sounds/error.mp3'), 0.4);
