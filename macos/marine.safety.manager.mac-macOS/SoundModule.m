//
// SoundModule.m — macOS native sound playback for Marine Safety Manager.
//
// expo-av has no macOS target (it's mocked in JS), so the ship's bell / cues are
// played natively via NSSound. utils/sound.ts routes macOS through
// NativeModules.SoundModule.playSound(<name>) — mirroring the Windows SoundModule.
// Sound files are bundled in the app's Resources/Sounds folder (see Xcode project).
//
// Old-architecture bridge module: RCT_EXPORT_MODULE auto-registers it (no manual
// wiring needed). See MACOS.md.
//

#import <React/RCTBridgeModule.h>
#import <AppKit/AppKit.h>

@interface SoundModule : NSObject <RCTBridgeModule, NSSoundDelegate>
@property (nonatomic, strong) NSMutableSet<NSSound *> *active;
@end

@implementation SoundModule

RCT_EXPORT_MODULE();

- (instancetype)init {
  if (self = [super init]) {
    _active = [NSMutableSet set];
  }
  return self;
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

// Play a bundled <name>.mp3 (looked up in Resources/Sounds, then Resources root).
RCT_EXPORT_METHOD(playSound:(NSString *)name) {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSString *path = [[NSBundle mainBundle] pathForResource:name ofType:@"mp3" inDirectory:@"Sounds"];
    if (path == nil) {
      path = [[NSBundle mainBundle] pathForResource:name ofType:@"mp3"];
    }
    if (path == nil) {
      NSLog(@"[SoundModule] sound not found: %@.mp3", name);
      return;
    }
    NSSound *sound = [[NSSound alloc] initWithContentsOfFile:path byReference:NO];
    if (sound == nil) {
      NSLog(@"[SoundModule] failed to load: %@", path);
      return;
    }
    sound.delegate = self;
    [self.active addObject:sound]; // retain until playback finishes
    NSLog(@"[SoundModule] playing: %@", path);
    [sound play];
  });
}

- (void)sound:(NSSound *)sound didFinishPlaying:(BOOL)finished {
  [self.active removeObject:sound];
}

@end
