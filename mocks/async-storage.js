// Windows AsyncStorage backed by the native StorageModule (persistent KV via the
// Windows registry, HKCU\Software\MSMWindows\Storage — see StorageModule.h).
// Falls back to an in-memory store until the native module is built into the app
// (so the bundle still runs; data just won't persist across restarts yet).
const { NativeModules } = require('react-native');
const Native = NativeModules.StorageModule;

let AsyncStorage;

if (Native && typeof Native.getItem === 'function') {
  // Native getItem returns '' for a missing key → normalize to null.
  const getItem = (k) => Native.getItem(k).then((v) => (v == null || v === '' ? null : v));
  const setItem = (k, v) => Native.setItem(k, v == null ? '' : String(v));
  const removeItem = (k) => Native.removeItem(k);

  AsyncStorage = {
    getItem,
    setItem,
    removeItem,
    clear: () => Native.clear(),
    getAllKeys: () => Native.getAllKeys(),
    multiGet: (keys) => Promise.all(keys.map(async (k) => [k, await getItem(k)])),
    multiSet: async (pairs) => { for (const [k, v] of pairs) await setItem(k, v); },
    multiRemove: async (keys) => { for (const k of keys) await removeItem(k); },
    mergeItem: async (k, v) => {
      const existing = await getItem(k);
      if (existing) {
        const merged = { ...JSON.parse(existing), ...JSON.parse(v) };
        await setItem(k, JSON.stringify(merged));
      } else {
        await setItem(k, v);
      }
    },
    flushGetRequests: () => {},
  };
} else {
  // In-memory fallback (no native StorageModule yet).
  const store = {};
  AsyncStorage = {
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
}

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
