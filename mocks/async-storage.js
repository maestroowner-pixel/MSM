// In-memory AsyncStorage for Windows v1 (data does not persist across restarts;
// replace with a native StorageModule / file-backed shim for production).
const store = {};
const AsyncStorage = {
  getItem: (k) => Promise.resolve(store[k] !== undefined ? store[k] : null),
  setItem: (k, v) => { store[k] = v != null ? String(v) : null; return Promise.resolve(); },
  removeItem: (k) => { delete store[k]; return Promise.resolve(); },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); return Promise.resolve(); },
  getAllKeys: () => Promise.resolve(Object.keys(store)),
  multiGet: (keys) => Promise.resolve(keys.map((k) => [k, store[k] !== undefined ? store[k] : null])),
  multiSet: (pairs) => { pairs.forEach(([k, v]) => { store[k] = v != null ? String(v) : null; }); return Promise.resolve(); },
  multiRemove: (keys) => { keys.forEach((k) => delete store[k]); return Promise.resolve(); },
  mergeItem: (k, v) => { store[k] = v; return Promise.resolve(); },
  flushGetRequests: () => {},
};
module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
