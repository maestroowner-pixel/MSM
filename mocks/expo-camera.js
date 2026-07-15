// Windows stub for expo-camera — there is no Windows native build.
//
// This is not optional politeness: expo-camera's entry point resolves its native
// module at IMPORT time, so without this stub a Windows bundle would throw
// "Cannot find native module 'ExpoCamera'" the moment ScanSc is imported, before
// any Platform check inside the screen could run. The screen guards itself off on
// Windows too — this stub is what lets the module be imported at all so that it can.
//
// The shape mirrors only what ScanSc touches: the view, and the permission hook.
// Permission is reported as permanently denied, which is the truth on Windows.
const React = require('react');
const { View } = require('react-native');

const CameraView = ({ children, style }) => React.createElement(View, { style }, children);

const denied = {
  granted: false,
  canAskAgain: false,
  expires: 'never',
  status: 'denied',
};

module.exports = {
  __esModule: true,
  CameraView,
  Camera: { requestCameraPermissionsAsync: async () => denied },
  useCameraPermissions: () => [denied, async () => denied, async () => denied],
  scanFromURLAsync: async () => [],
};
