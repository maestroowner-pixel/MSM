module.exports = {
  requestCameraPermissionsAsync: async () => ({ granted: false }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: false }),
  launchCameraAsync: async () => ({ canceled: true, assets: null }),
  launchImageLibraryAsync: async () => ({ canceled: true, assets: null }),
  MediaTypeOptions: { Images: 'Images', All: 'All' },
};
