//
// FileManagerModule.m — native file I/O + HTML→PDF for Marine Safety Manager (macOS).
//
// expo-print / expo-sharing / expo-file-system have no macOS target (mocked in JS),
// so report/backup export is wired through this native module (mirrors the Windows
// RNCWindowsFileManager). Exposed to JS as `RNCMacFileManager`, used by
// utils/MacFileManager.ts via utils/fileShare.ts. See MACOS.md.
//
//  • saveFileBase64(name, base64)  → NSSavePanel, write decoded bytes (xlsx/pdf/zip)
//  • saveFile(name, text)          → NSSavePanel, write UTF-8 text (.msm backup JSON)
//  • openFilePicker([ext])         → NSOpenPanel, returns JSON {name, content:base64}
//  • htmlToPdfBase64(html)         → WKWebView render → PDF → base64
//
// Promises reject with code "CANCELLED" when the user dismisses a panel.
//

#import <React/RCTBridgeModule.h>
#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

@interface FileManagerModule : NSObject <RCTBridgeModule, WKNavigationDelegate>
@property (nonatomic, strong) WKWebView *pdfWebView;
@property (nonatomic, copy) RCTPromiseResolveBlock pdfResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock pdfReject;
@end

@implementation FileManagerModule

// Exposed to JS as `NativeModules.RNCMacFileManager` (matches utils/MacFileManager.ts).
RCT_EXPORT_MODULE(RNCMacFileManager);

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

// --- Save (binary, base64-encoded) ------------------------------------------
RCT_EXPORT_METHOD(saveFileBase64:(NSString *)filename
                  content:(NSString *)base64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64
                                                     options:NSDataBase64DecodingIgnoreUnknownCharacters];
  [self runSavePanel:filename data:data resolve:resolve reject:reject];
}

// --- Save (UTF-8 text) ------------------------------------------------------
RCT_EXPORT_METHOD(saveFile:(NSString *)filename
                  content:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSData *data = [text dataUsingEncoding:NSUTF8StringEncoding];
  [self runSavePanel:filename data:data resolve:resolve reject:reject];
}

- (void)runSavePanel:(NSString *)filename
                data:(NSData *)data
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject {
  if (data == nil) { reject(@"ENCODE", @"Could not decode file content", nil); return; }
  dispatch_async(dispatch_get_main_queue(), ^{
    NSSavePanel *panel = [NSSavePanel savePanel];
    panel.nameFieldStringValue = filename;
    panel.canCreateDirectories = YES;
    NSModalResponse resp = [panel runModal];
    if (resp != NSModalResponseOK || panel.URL == nil) {
      reject(@"CANCELLED", @"Save cancelled", nil);
      return;
    }
    NSError *err = nil;
    if ([data writeToURL:panel.URL options:NSDataWritingAtomic error:&err]) {
      resolve(panel.URL.path);
    } else {
      reject(@"WRITE", err.localizedDescription ?: @"Could not write file", err);
    }
  });
}

// --- Open (returns {name, content:base64}) ----------------------------------
RCT_EXPORT_METHOD(openFilePicker:(NSArray<NSString *> *)extensions
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = YES;
    panel.canChooseDirectories = NO;
    panel.allowsMultipleSelection = NO;
    if (extensions.count > 0) {
      panel.allowedFileTypes = extensions; // bare extensions, e.g. @[@"msm"]
    }
    NSModalResponse resp = [panel runModal];
    if (resp != NSModalResponseOK || panel.URL == nil) {
      reject(@"CANCELLED", @"Open cancelled", nil);
      return;
    }
    NSError *err = nil;
    NSData *data = [NSData dataWithContentsOfURL:panel.URL options:0 error:&err];
    if (data == nil) {
      reject(@"READ", err.localizedDescription ?: @"Could not read file", err);
      return;
    }
    NSDictionary *out = @{
      @"name": panel.URL.lastPathComponent ?: @"file",
      @"content": [data base64EncodedStringWithOptions:0],
    };
    NSData *json = [NSJSONSerialization dataWithJSONObject:out options:0 error:nil];
    resolve([[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding]);
  });
}

// --- HTML → PDF (base64) ----------------------------------------------------
RCT_EXPORT_METHOD(htmlToPdfBase64:(NSString *)html
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    if (self.pdfResolve != nil) { reject(@"BUSY", @"A PDF render is already in progress", nil); return; }
    self.pdfResolve = resolve;
    self.pdfReject = reject;
    // A4 landscape @ 72dpi (matches the report's @page size).
    NSRect frame = NSMakeRect(0, 0, 842, 595);
    WKWebViewConfiguration *cfg = [[WKWebViewConfiguration alloc] init];
    self.pdfWebView = [[WKWebView alloc] initWithFrame:frame configuration:cfg];
    self.pdfWebView.navigationDelegate = self;
    [self.pdfWebView loadHTMLString:html baseURL:nil];
  });
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
  // Give layout a beat, then snapshot the whole content as PDF.
  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.25 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
    WKPDFConfiguration *pdfCfg = [[WKPDFConfiguration alloc] init];
    [webView createPDFWithConfiguration:pdfCfg completionHandler:^(NSData *pdf, NSError *err) {
      if (pdf != nil) {
        if (self.pdfResolve) self.pdfResolve([pdf base64EncodedStringWithOptions:0]);
      } else if (self.pdfReject) {
        self.pdfReject(@"PDF", err.localizedDescription ?: @"Could not render PDF", err);
      }
      self.pdfResolve = nil;
      self.pdfReject = nil;
      self.pdfWebView = nil;
    }];
  });
}

- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
  if (self.pdfReject) self.pdfReject(@"LOAD", error.localizedDescription, error);
  self.pdfResolve = nil; self.pdfReject = nil; self.pdfWebView = nil;
}

// --- Attachment storage (Application Support/<bundle>/attachments) ------------
// expo-file-system is mocked on macOS, so item/certificate attachments are stored
// natively. persistBase64 writes the picked file into the app container and returns
// a file:// URI; openPath opens it with the default app; deletePath removes it.
- (NSString *)attachmentsDir {
  NSArray<NSString *> *paths =
    NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES);
  NSString *base = paths.firstObject ?: NSTemporaryDirectory();
  NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier] ?: @"MSM";
  NSString *dir = [[base stringByAppendingPathComponent:bundleId] stringByAppendingPathComponent:@"attachments"];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  return dir;
}

RCT_EXPORT_METHOD(persistBase64:(NSString *)filename
                  content:(NSString *)base64
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64
                                                     options:NSDataBase64DecodingIgnoreUnknownCharacters];
  if (data == nil) { reject(@"DECODE", @"Could not decode file content", nil); return; }
  NSString *ext = filename.pathExtension.length ? filename.pathExtension : @"dat";
  NSString *name = [NSString stringWithFormat:@"%@.%@", [[NSUUID UUID] UUIDString], ext];
  NSString *dest = [[self attachmentsDir] stringByAppendingPathComponent:name];
  NSError *err = nil;
  if ([data writeToFile:dest options:NSDataWritingAtomic error:&err]) {
    resolve([[NSURL fileURLWithPath:dest] absoluteString]); // file:// URI
  } else {
    reject(@"WRITE", err.localizedDescription ?: @"Could not write file", err);
  }
}

RCT_EXPORT_METHOD(openPath:(NSString *)uriOrPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_main_queue(), ^{
    NSURL *url = [uriOrPath hasPrefix:@"file:"] ? [NSURL URLWithString:uriOrPath]
                                                : [NSURL fileURLWithPath:uriOrPath];
    BOOL ok = url ? [[NSWorkspace sharedWorkspace] openURL:url] : NO;
    resolve(@(ok));
  });
}

RCT_EXPORT_METHOD(deletePath:(NSString *)uriOrPath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  NSString *path = [uriOrPath hasPrefix:@"file:"] ? [[NSURL URLWithString:uriOrPath] path] : uriOrPath;
  if (path) [[NSFileManager defaultManager] removeItemAtPath:path error:nil];
  resolve(@(YES));
}

@end
