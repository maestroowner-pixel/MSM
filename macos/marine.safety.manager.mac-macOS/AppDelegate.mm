#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification
{
  // Expo's registerRootComponent() (index.tsx) registers the root component under
  // the fixed AppRegistry name "main" — the native moduleName MUST match it.
  self.moduleName = @"main";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  self.dependencyProvider = [RCTAppDependencyProvider new];

  [super applicationDidFinishLaunching:notification];

  // Desktop window sizing. The RN content is mobile-portrait-styled, so default to a
  // tall-ish window and a sane minimum. The window frame is auto-saved by RCTAppDelegate,
  // so we only impose the default size ONCE (first launch) and then respect the user's
  // resizing on subsequent launches.
  if (self.window) {
    // RCTAppDelegate titles the window with the moduleName ("main"); use the app name.
    self.window.title = @"Marine Safety Manager";
    self.window.minSize = NSMakeSize(620, 560);
    NSUserDefaults *ud = [NSUserDefaults standardUserDefaults];
    if (![ud boolForKey:@"MSMDidSetDefaultWindowSize"]) {
      [self.window setContentSize:NSMakeSize(900, 820)];
      [self.window center];
      [ud setBool:YES forKey:@"MSMDidSetDefaultWindowSize"];
    }
  }
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled
{
#ifdef RN_FABRIC_ENABLED
  return true;
#else
  return false;
#endif
}

@end
