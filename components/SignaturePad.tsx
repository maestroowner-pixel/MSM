// ===================================
// A box to sign in with a finger, stylus or mouse — the visitor's signature in
// the gangway log, where the paper book had a column for it.
//
// The signature is kept as an SVG path ("M12 40L13 41…") in a 300 × 100 box,
// coordinates rounded to whole units: a few hundred bytes, small enough to
// travel with the log entry, and drawn the same on a screen, in a PDF and in
// print.
// ===================================

import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { swipeLock } from '../utils/swipeLock';

export const SIG_W = 300;
export const SIG_H = 100;

export function SignatureView({ path, height = 40, color }: { path: string; height?: number; color?: string }) {
  const c = useTheme();
  return (
    <Svg width={(height * SIG_W) / SIG_H} height={height} viewBox={`0 0 ${SIG_W} ${SIG_H}`}>
      <Path d={path} stroke={color ?? c.textDark} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SignaturePad({ value, onChange, label = 'Visitor’s signature' }: { value: string; onChange: (path: string) => void; label?: string }) {
  const c = useTheme();
  const [w, setW] = useState(SIG_W);
  const scale = SIG_W / w;
  const path = useRef(value);
  path.current = value;
  const live = useRef('');
  const [, redraw] = useState(0);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          swipeLock.held = true;
          const { locationX: x, locationY: y } = e.nativeEvent;
          live.current = `M${Math.round(x * scale)} ${Math.round(y * scale)}`;
          redraw((n) => n + 1);
        },
        onPanResponderMove: (e) => {
          const { locationX: x, locationY: y } = e.nativeEvent;
          const X = Math.max(0, Math.min(SIG_W, Math.round(x * scale)));
          const Y = Math.max(0, Math.min(SIG_H, Math.round(y * scale)));
          live.current += `L${X} ${Y}`;
          redraw((n) => n + 1);
        },
        onPanResponderRelease: () => {
          swipeLock.held = false;
          if (live.current) onChange(`${path.current}${live.current}`);
          live.current = '';
        },
        onPanResponderTerminate: () => {
          swipeLock.held = false;
        },
      }),
    [scale, onChange]
  );

  const drawn = `${value}${live.current}`;
  return (
    <View style={{ marginTop: SIZES.sm }}>
      <View style={styles.head}>
        <Text style={{ fontSize: SIZES.small, color: c.textLight }}>{label}</Text>
        {value ? (
          <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
            <Text style={{ color: c.primary, fontWeight: '700', fontSize: SIZES.small }}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View
        onLayout={(e) => setW(e.nativeEvent.layout.width || SIG_W)}
        style={[styles.box, { borderColor: c.border, backgroundColor: c.cardSolid, height: (w * SIG_H) / SIG_W }, Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'crosshair', userSelect: 'none' } as any) : null]}
        {...pan.panHandlers}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIG_W} ${SIG_H}`} pointerEvents="none">
          <Path d={`M20 ${SIG_H - 22}L${SIG_W - 20} ${SIG_H - 22}`} stroke={c.borderLight} strokeWidth={1} />
          {drawn ? <Path d={drawn} stroke={c.textDark} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </Svg>
        {!drawn ? <Text style={[styles.hint, { color: c.textLight }]} pointerEvents="none">Sign here</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  box: { width: '100%', maxWidth: 520, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, overflow: 'hidden' },
  hint: { position: 'absolute', left: 16, top: 10, fontSize: SIZES.small },
});
