#!/usr/bin/env node
/*
 * Postinstall patch.
 *
 * This project's copy of react-native 0.81.5 ships a malformed
 * ReactCommon/reactperflogger/fusebox/FuseboxTracer.h: it references
 * `struct BufferEvent` (member `std::vector<BufferEvent> buffer_`) but no longer
 * defines it, so the native iOS/Android build fails with
 * "use of undeclared identifier 'BufferEvent'". This re-inserts the struct
 * definition (matching the upstream/working RN copy). Idempotent.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'ReactCommon',
  'reactperflogger',
  'fusebox',
  'FuseboxTracer.h'
);

try {
  if (!fs.existsSync(file)) process.exit(0);
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('struct BufferEvent')) process.exit(0); // already correct

  const anchor = 'namespace facebook::react {';
  const struct =
    anchor +
    '\n\n' +
    'struct BufferEvent {\n' +
    '  uint64_t start;\n' +
    '  uint64_t end;\n' +
    '  std::string name;\n' +
    '  std::string track;\n' +
    '};';

  if (!src.includes(anchor)) {
    console.warn('[patch-rn] anchor not found in FuseboxTracer.h, skipping');
    process.exit(0);
  }
  src = src.replace(anchor, struct);
  fs.writeFileSync(file, src);
  console.log('[patch-rn] FuseboxTracer.h: re-inserted struct BufferEvent');
} catch (e) {
  console.warn('[patch-rn] failed:', e && e.message);
}
