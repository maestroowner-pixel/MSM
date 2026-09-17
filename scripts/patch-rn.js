#!/usr/bin/env node
/*
 * Postinstall patches for this project's react-native 0.81.5 copy.
 * Idempotent; runs from the `postinstall` npm script. Each patch no-ops when
 * already applied or when the target file is absent.
 *
 * 1) FuseboxTracer.h — this RN copy references `struct BufferEvent`
 *    (member `std::vector<BufferEvent> buffer_`) but no longer defines it, so the
 *    native build fails with "use of undeclared identifier 'BufferEvent'". We
 *    re-insert the struct definition (matching the upstream/working RN copy).
 *
 * 2) HermesExecutorFactory.cpp — uses `std::thread` / `std::this_thread` without
 *    including <thread>. Older libc++ pulled it in transitively; the libc++ in
 *    recent Xcode (e.g. Xcode 26 / iPhoneOS 26 SDK) dropped those transitive
 *    includes, so the build fails with "No member named 'thread' in namespace
 *    'std'" (plus a cascade). We add the missing #include.
 */
const fs = require('fs');
const path = require('path');

const rn = path.join(__dirname, '..', 'node_modules', 'react-native');

function patchFuseboxTracer() {
  const file = path.join(rn, 'ReactCommon', 'reactperflogger', 'fusebox', 'FuseboxTracer.h');
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('struct BufferEvent')) return; // already correct
  const anchor = 'namespace facebook::react {';
  if (!src.includes(anchor)) {
    console.warn('[patch-rn] anchor not found in FuseboxTracer.h, skipping');
    return;
  }
  const struct =
    anchor +
    '\n\n' +
    'struct BufferEvent {\n' +
    '  uint64_t start;\n' +
    '  uint64_t end;\n' +
    '  std::string name;\n' +
    '  std::string track;\n' +
    '};';
  src = src.replace(anchor, struct);
  fs.writeFileSync(file, src);
  console.log('[patch-rn] FuseboxTracer.h: re-inserted struct BufferEvent');
}

function patchHermesExecutorThreadInclude() {
  const file = path.join(rn, 'ReactCommon', 'hermes', 'executor', 'HermesExecutorFactory.cpp');
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('#include <thread>')) return; // already patched
  const anchor = '#include "HermesExecutorFactory.h"';
  if (!src.includes(anchor)) {
    console.warn('[patch-rn] anchor not found in HermesExecutorFactory.cpp, skipping');
    return;
  }
  src = src.replace(anchor, anchor + '\n\n#include <thread>');
  fs.writeFileSync(file, src);
  console.log('[patch-rn] HermesExecutorFactory.cpp: added #include <thread>');
}

/*
 * 3) fmt.podspec — RN 0.81 pins fmt 11.0.2, whose compile-time format-string
 *    check is `consteval`; the clang in Xcode 27 rejects it even inside fmt's own
 *    format.cc ("call to consteval function … is not a constant expression").
 *    fmt's base.h #defines FMT_USE_CONSTEVAL unconditionally, so it cannot be
 *    switched off from a build setting — the fix is the version fmt fixed it in.
 *    11.1.4 is what react-native main moved to; folly 2024.11 builds against it.
 */
const FMT_VERSION = '11.1.4';
function patchFmtPodspec() {
  const file = path.join(rn, 'third-party-podspecs', 'fmt.podspec');
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(`"${FMT_VERSION}"`)) return; // already patched
  const before = src;
  src = src.replace(/spec\.version = "11\.0\.2"/, `spec.version = "${FMT_VERSION}"`);
  src = src.replace(/:tag => "11\.0\.2"/, `:tag => "${FMT_VERSION}"`);
  if (src === before) {
    console.warn('[patch-rn] fmt.podspec: 11.0.2 not found, skipping');
    return;
  }
  fs.writeFileSync(file, src);
  console.log(`[patch-rn] fmt.podspec: 11.0.2 -> ${FMT_VERSION} (Xcode 27 consteval)`);
}
// RCT-Folly pins the same number, or CocoaPods refuses to resolve.
function patchFollyFmtPin() {
  const file = path.join(rn, 'third-party-podspecs', 'RCT-Folly.podspec');
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes(`"fmt", "${FMT_VERSION}"`)) return;
  const before = src;
  src = src.replace(/spec\.dependency "fmt", "11\.0\.2"/, `spec.dependency "fmt", "${FMT_VERSION}"`);
  if (src === before) {
    console.warn('[patch-rn] RCT-Folly.podspec: fmt 11.0.2 pin not found, skipping');
    return;
  }
  fs.writeFileSync(file, src);
  console.log(`[patch-rn] RCT-Folly.podspec: fmt pin -> ${FMT_VERSION}`);
}

try {
  patchFuseboxTracer();
  patchHermesExecutorThreadInclude();
  patchFmtPodspec();
  patchFollyFmtPin();
} catch (e) {
  console.warn('[patch-rn] failed:', e && e.message);
}
