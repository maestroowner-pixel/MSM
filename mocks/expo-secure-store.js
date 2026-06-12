// Windows stub — expo-secure-store has no Windows build. firebaseService never
// calls it on Windows (device_id lives in the registry-backed AsyncStorage),
// this just lets the bundle resolve the import.
module.exports = {
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
  isAvailableAsync: async () => false,
  WHEN_UNLOCKED: 0,
};
