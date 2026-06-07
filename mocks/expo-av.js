// Windows stub for expo-av (no Windows native). Audio is silent on Windows v1.
const Sound = {
  createAsync: async () => ({
    sound: { setOnPlaybackStatusUpdate: () => {}, unloadAsync: async () => {}, playAsync: async () => {} },
  }),
};
module.exports = { Audio: { setAudioModeAsync: async () => {}, Sound } };
