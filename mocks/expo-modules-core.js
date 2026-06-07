"use strict";
class MockEventEmitter {
  addListener() { return { remove: () => {} }; }
  removeAllListeners() {}
  emit() {}
}
if (!globalThis.expo) { globalThis.expo = { EventEmitter: MockEventEmitter }; }
class UnavailabilityError extends Error {
  constructor(moduleName, propertyName) { super(`${moduleName}.${propertyName} is not available on Windows`); this.name = 'UnavailabilityError'; }
}
class NativeModule { addListener() {} removeListeners() {} }
module.exports = {
  EventEmitter: MockEventEmitter,
  LegacyEventEmitter: MockEventEmitter,
  NativeModulesProxy: new Proxy({}, { get: () => () => Promise.resolve(null) }),
  requireNativeModule: () => ({}),
  requireOptionalNativeModule: () => null,
  UnavailabilityError,
  SharedObject: class {},
  SharedRef: class {},
  Platform: { OS: 'windows' },
  NativeModule,
  ExpoNativeModule: NativeModule,
  default: {},
};
