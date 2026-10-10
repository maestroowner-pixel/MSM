// ===================================
// Dropdown — one compact control in place of a row of chips (9 Oct 2026: "make
// the sort a drop-down menu, not that many buttons, and put the two side by
// side"). Shows "CAPTION  Value ▾"; a tap opens the list right under it.
//
// Positioned by measuring the button (measureInWindow, which react-native-web
// also has) and drawing the list in a transparent Modal, so it floats over the
// page on a phone and in a browser alike. A tap outside closes it.
// ===================================

import React, { useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';

export interface DropdownOption<T> {
  value: T;
  label: string;
}

export function Dropdown<T>({
  caption,
  value,
  options,
  onChange,
  style,
}: {
  caption: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  style?: any;
}) {
  const COLORS = useTheme();
  const { height: winH, width: winW } = useWindowDimensions();
  const ref = useRef<View>(null);
  const [at, setAt] = useState<{ x: number; y: number; w: number } | null>(null);
  const current = options.find((o) => o.value === value)?.label ?? '';

  const open = () =>
    ref.current?.measureInWindow((x, y, w, h) => {
      const mw = Math.max(w, 200);
      // Keep the list on screen when the button sits at the right edge (a title's corner).
      setAt({ x: Math.max(8, Math.min(x, winW - mw - 8)), y: y + h + 4, w: mw });
    });

  return (
    <>
      <TouchableOpacity
        ref={ref as any}
        onPress={open}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${caption}: ${current}`}
        style={[styles.button, { ...COLORS.glassCard, borderColor: COLORS.borderLight }, style]}
      >
        {caption ? <Text style={[styles.caption, { color: COLORS.textLight }]}>{caption}</Text> : null}
        <Text style={[styles.value, { color: COLORS.textDark }]} numberOfLines={1}>{current}</Text>
        <MciIcon name="chevron-down" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
      <Modal visible={!!at} transparent animationType="none" onRequestClose={() => setAt(null)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setAt(null)} />
        {at ? (
          <View style={[styles.menu, { left: at.x, top: at.y, minWidth: at.w, maxHeight: Math.max(160, winH - at.y - 16), backgroundColor: COLORS.cardSolid, borderColor: COLORS.borderLight }]}>
            <ScrollView>
              {options.map((o) => {
                const on = o.value === value;
                return (
                  <TouchableOpacity
                    key={String(o.value)}
                    style={[styles.item, on && { backgroundColor: COLORS.primary + '14' }]}
                    onPress={() => {
                      onChange(o.value);
                      setAt(null);
                    }}
                  >
                    <Text style={[styles.itemText, { color: on ? COLORS.primary : COLORS.textDark }, on && { fontWeight: '700' }]}>{o.label}</Text>
                    {on ? <MciIcon name="check" size={16} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderWidth: 1, borderRadius: SIZES.radiusMd, paddingVertical: 9, paddingHorizontal: SIZES.md },
  caption: { fontSize: SIZES.tiny, fontWeight: '800', letterSpacing: 0.6 },
  value: { flex: 1, fontSize: SIZES.body, fontWeight: '700', textAlign: 'right' },
  menu: { position: 'absolute', borderWidth: 1, borderRadius: SIZES.radiusMd, paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.md, paddingVertical: 10, paddingHorizontal: SIZES.md },
  itemText: { fontSize: SIZES.body },
});
