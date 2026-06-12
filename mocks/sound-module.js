// Web-Audio fallback bell (parity with MHM). Registers a JS NativeModules.SoundModule
// when the native one is absent (e.g. dev/metro contexts that expose AudioContext).
// The real Windows app uses the native SoundModule.h instead.
const { NativeModules } = require('react-native');

const audioContext =
  typeof AudioContext !== 'undefined'
    ? new AudioContext()
    : typeof webkitAudioContext !== 'undefined'
    ? new webkitAudioContext()
    : null;

if (!NativeModules.SoundModule) {
  NativeModules.SoundModule = {
    playSound: () => {
      if (!audioContext) return;
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.5);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 1.5);
      } catch (e) {}
    },
  };
}

module.exports = {};
