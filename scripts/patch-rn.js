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

try {
  patchFuseboxTracer();
  patchHermesExecutorThreadInclude();
} catch (e) {
  console.warn('[patch-rn] failed:', e && e.message);
}
