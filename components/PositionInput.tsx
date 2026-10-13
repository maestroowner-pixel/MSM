// ===================================
// Position or port — two separate fields, one or the other (13 Oct 2026). The
// position is typed into cells: latitude degrees, minutes, N/S; longitude
// degrees, minutes, E/W — and kept as the record books write it,
// 38°45.2'N 002°10.6'E (utils/position.ts). Choosing one clears the other.
//
//   <PositionInput position={pos} port={port} onChange={(pos, port) => …} />
//   <PositionInput position={pos} onChange={(pos) => …} portAllowed={false} />
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { Coords, EMPTY_COORDS, coordsError, formatPosition, parsePosition } from '../utils/position';

export function PositionInput({
  position,
  port,
  onChange,
  label = 'Position',
  portAllowed = true,
  portPlaceholder = 'Port — name',
}: {
  position?: string;
  port?: string;
  onChange: (position: string, port: string) => void;
  label?: string;
  portAllowed?: boolean;
  portPlaceholder?: string;
}) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [mode, setMode] = useState<'sea' | 'port'>(() => (portAllowed && !position?.trim() && port?.trim() ? 'port' : 'sea'));
  const [c, setC] = useState<Coords>(() => parsePosition(position) ?? EMPTY_COORDS);
  // What this field last said — a new value from outside (a form reset, a
  // record opened) refills the cells; our own echo does not.
  const said = useRef(position ?? '');
  useEffect(() => {
    if ((position ?? '') !== said.current) {
      said.current = position ?? '';
      setC(parsePosition(position) ?? EMPTY_COORDS);
      if (position?.trim()) setMode('sea');
      else if (portAllowed && port?.trim()) setMode('port');
    }
  }, [position, port, portAllowed]);

  const setCell = (p: Partial<Coords>) => {
    const next = { ...c, ...p };
    setC(next);
    const text = formatPosition(next);
    said.current = text;
    onChange(text, '');
  };
  const pick = (m: 'sea' | 'port') => {
    setMode(m);
    if (m === 'port') {
      setC(EMPTY_COORDS);
      said.current = '';
      onChange('', port ?? '');
    } else onChange(formatPosition(c), '');
  };
  const err = coordsError(c);
  const num = (v: string) => v.replace(/[^\d.,]/g, '');

  return (
    <View style={styles.wrap}>
      {portAllowed ? (
        <View style={styles.seg}>
          {([['sea', label], ['port', 'Port']] as const).map(([k, l]) => (
            <TouchableOpacity key={k} onPress={() => pick(k)} style={[styles.segBtn, mode === k && styles.segOn]}>
              <Text style={[styles.segText, mode === k && styles.segTextOn]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
      {mode === 'sea' ? (
        <>
          <View style={styles.line}>
            <Text style={styles.axis}>Lat</Text>
            <TextInput style={[styles.cell, { width: 46 }]} value={c.latDeg} onChangeText={(v) => setCell({ latDeg: num(v).slice(0, 2) })} placeholder="dd" placeholderTextColor={COLORS.textLight} keyboardType="number-pad" maxLength={2} accessibilityLabel="Latitude degrees" />
            <Text style={styles.mark}>°</Text>
            <TextInput style={[styles.cell, { width: 60 }]} value={c.latMin} onChangeText={(v) => setCell({ latMin: num(v).slice(0, 4) })} placeholder="mm.m" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" maxLength={4} accessibilityLabel="Latitude minutes" />
            <Text style={styles.mark}>'</Text>
            {(['N', 'S'] as const).map((h) => (
              <TouchableOpacity key={h} onPress={() => setCell({ ns: h })} style={[styles.hemi, c.ns === h && styles.hemiOn]}><Text style={[styles.hemiText, c.ns === h && styles.hemiTextOn]}>{h}</Text></TouchableOpacity>
            ))}
          </View>
          <View style={styles.line}>
            <Text style={styles.axis}>Lon</Text>
            <TextInput style={[styles.cell, { width: 46 }]} value={c.lonDeg} onChangeText={(v) => setCell({ lonDeg: num(v).slice(0, 3) })} placeholder="ddd" placeholderTextColor={COLORS.textLight} keyboardType="number-pad" maxLength={3} accessibilityLabel="Longitude degrees" />
            <Text style={styles.mark}>°</Text>
            <TextInput style={[styles.cell, { width: 60 }]} value={c.lonMin} onChangeText={(v) => setCell({ lonMin: num(v).slice(0, 4) })} placeholder="mm.m" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" maxLength={4} accessibilityLabel="Longitude minutes" />
            <Text style={styles.mark}>'</Text>
            {(['E', 'W'] as const).map((h) => (
              <TouchableOpacity key={h} onPress={() => setCell({ ew: h })} style={[styles.hemi, c.ew === h && styles.hemiOn]}><Text style={[styles.hemiText, c.ew === h && styles.hemiTextOn]}>{h}</Text></TouchableOpacity>
            ))}
          </View>
          {err ? <Text style={styles.err}>{err}</Text> : formatPosition(c) ? <Text style={styles.ok}>{formatPosition(c)}</Text> : null}
        </>
      ) : (
        <TextInput style={styles.port} value={port ?? ''} onChangeText={(v) => onChange('', v)} placeholder={portPlaceholder} placeholderTextColor={COLORS.textLight} />
      )}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    wrap: { marginTop: SIZES.sm, gap: 6 },
    label: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textLight },
    seg: { flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, overflow: 'hidden' },
    segBtn: { paddingVertical: 6, paddingHorizontal: SIZES.md },
    segOn: { backgroundColor: COLORS.primary },
    segText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    segTextOn: { color: COLORS.textWhite },
    line: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    axis: { width: 30, fontSize: SIZES.small, fontWeight: '700', color: COLORS.textLight },
    cell: { ...COLORS.glassInput, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 4, fontSize: SIZES.body, color: COLORS.text, textAlign: 'center' },
    mark: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark, marginRight: 2 },
    hemi: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 9 },
    hemiOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    hemiText: { fontWeight: '800', color: COLORS.textLight },
    hemiTextOn: { color: COLORS.textWhite },
    err: { fontSize: SIZES.small, color: COLORS.danger },
    ok: { fontSize: SIZES.small, color: COLORS.success, fontWeight: '700' },
    port: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text },
  });
