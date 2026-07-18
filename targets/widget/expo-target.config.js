/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
// The `targets/*` folder is magic to @bacons/apple-targets: each sub-folder with
// an expo-target.config becomes a native Apple target, linked into the Xcode
// project on `expo prebuild` and kept OUTSIDE the generated `ios/` dir (which is
// gitignored here). Everything else in this folder is the widget's Swift source.
module.exports = (config) => ({
  type: 'widget',
  name: 'MSMWidgets',
  displayName: 'Marine Safety',
  // The widget reads the flagged snapshot from the SAME App Group the app writes
  // to (services/widgetBridge). Mirror whatever the app declares in app.json so
  // the two identifiers can never drift apart.
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? [
        'group.com.kukalab.msm',
      ],
  },
  colors: {
    $accent: '#2E7D99',
    $widgetBackground: '#FFFFFF',
  },
});
