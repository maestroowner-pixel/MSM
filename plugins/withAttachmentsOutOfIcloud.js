// Attached files stay out of the device's iCloud backup (6 Nov 2026, plan item 59).
// They hold crew documents and the vessel's photos, and an iCloud backup is the phone
// owner's private account: personal data stays aboard. AsyncStorage already excludes
// itself. iOS keeps the flag on the folder and applies it to what is inside. No JS
// file API can set it, and ios/ is generated, hence a plugin.
const { withAppDelegate } = require('expo/config-plugins');

const MARK = 'isExcludedFromBackup';
const ANCHOR = '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)';
const CODE = `    // Attached files stay out of the iCloud backup. Set at every launch: clearing them deletes the folder, flag included.
    if var attachments = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first?.appendingPathComponent("attachments", isDirectory: true) {
      try? FileManager.default.createDirectory(at: attachments, withIntermediateDirectories: true)
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try? attachments.setResourceValues(values)
    }

`;

function addExclusion(source) {
  if (source.includes(MARK)) return source;
  if (!source.includes(ANCHOR)) throw new Error('withAttachmentsOutOfIcloud: AppDelegate.swift has changed, the launch return was not found');
  return source.replace(ANCHOR, CODE + ANCHOR);
}

module.exports = (config) =>
  withAppDelegate(config, (c) => {
    c.modResults.contents = addExclusion(c.modResults.contents);
    return c;
  });
module.exports.addExclusion = addExclusion;
