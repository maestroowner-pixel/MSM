// ===================================
// MciIcon — WEB implementation. Renders MaterialCommunityIcons glyphs as SVG
// (react-native-svg + @mdi/js path data) instead of the icon FONT, because
// Chromium/Electron on real Windows does not paint custom @font-face fonts
// (icons came out as empty squares). SVG renders everywhere, like PNG.
// Drop-in for `<MaterialCommunityIcons name size color />`.
// ===================================
/* eslint-disable @typescript-eslint/no-var-requires */
import React from 'react';
import Svg, { Path } from 'react-native-svg';

// @mdi/js exports each icon as `mdi<PascalCaseName>` path string. Required
// lazily so it's not resolved on native (and needs no types for tsc).
const mdi: Record<string, string> = require('@mdi/js');

function toMdiKey(name: string): string {
  return (
    'mdi' +
    String(name)
      .split('-')
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : ''))
      .join('')
  );
}

export function MciIcon({
  name,
  size = 24,
  color = '#000000',
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}) {
  const d = mdi[toMdiKey(name)] || mdi.mdiHelpCircleOutline;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
