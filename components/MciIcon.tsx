// Native MciIcon — just the icon font (works on iOS/Android). Metro loads
// MciIcon.web.tsx (SVG) on web instead, where the font doesn't render on Windows.
import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export function MciIcon({
  name,
  size = 24,
  color,
  style,
}: {
  name: any;
  size?: number;
  color?: string;
  style?: any;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
