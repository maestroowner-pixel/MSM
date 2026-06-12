// In-memory file shim for Windows v1 (no persistence across restarts).
module.exports = {
  documentDirectory: '/tmp/',
  cacheDirectory: '/tmp/',
  writeAsStringAsync: async () => {},
  readAsStringAsync: async () => '',
  deleteAsync: async () => {},
  getInfoAsync: async () => ({ exists: false }),
  makeDirectoryAsync: async () => {},
  copyAsync: async () => {},
  moveAsync: async () => {},
  downloadAsync: async () => ({ uri: '' }),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
};
