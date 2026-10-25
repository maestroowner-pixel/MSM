// A day of hours of rest drawn as 48 half-hour cells: work dark, rest light.
// Hour ticks every 6 hours so a watch pattern reads at a glance.
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { SLOTS_PER_DAY } from '../types/rest';

export function RestBar({ work, height = 10 }: { work: string; height?: number }) {
  const COLORS = useTheme();
  return (
    <View style={{ flexDirection: 'row', height, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border }}>
      {Array.from({ length: work.length || SLOTS_PER_DAY }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: work[i] === '1' ? COLORS.primary : 'transparent',
            borderLeftWidth: i && i % 12 === 0 ? 1 : 0,
            borderLeftColor: COLORS.border,
          }}
        />
      ))}
    </View>
  );
}
