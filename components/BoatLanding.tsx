// ===================================
// The boat landing, on the gangway page (types/muster.ts — module `muster`).
//
// The tender takes people ashore and brings them back from a landing that is not the
// gangway. The watch there names the boat and opens the scanner: each wristband or crew
// card is a crossing with the boat's name on it (CrewMove.boat), so the persons on board
// stay right and the gangway page says who is still out in which boat.
// ===================================

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { outByBoat, recentBoats } from '../services/gangway';
import { shipHm } from '../utils/shipTime';
import { t, useT } from '../utils/i18n';

export function BoatLanding() {
  useT();
  const COLORS = useTheme();
  const styles = makeStyles(COLORS);
  const nav = useNavigation<any>();
  const { crewMoves, crew, passengers } = useData();
  const recent = recentBoats(crewMoves);
  const [boat, setBoat] = useState(recent[0] ?? '');
  if (!moduleOn('muster')) return null;
  const out = outByBoat(crewMoves);
  const nameOf = (id: string, fallback: string) => crew.find((c) => c.id === id)?.name ?? passengers.find((p) => p.id === id)?.name ?? fallback;

  return (
    <Card>
      <Label>{t('mu.landing')}</Label>
      <Text style={styles.sub}>{t('mu.landingHint')}</Text>
      <View style={styles.row}>
        <TextInput style={styles.input} value={boat} onChangeText={setBoat} placeholder={t('mu.boatPh')} placeholderTextColor={COLORS.textLight} />
        <TouchableOpacity style={[styles.btn, !boat.trim() && { opacity: 0.5 }]} disabled={!boat.trim()} onPress={() => nav.navigate('Scan', { gangway: 1, boat: boat.trim() })}>
          <MciIcon name="ferry" size={16} color={COLORS.textWhite} />
          <Text style={styles.btnText}>{t('mu.openLanding')}</Text>
        </TouchableOpacity>
      </View>
      {recent.length > 1 ? (
        <View style={styles.row}>
          {recent.map((b) => (
            <TouchableOpacity key={b} style={[styles.chip, b === boat && styles.chipOn]} onPress={() => setBoat(b)}>
              <Text style={[styles.chipText, b === boat && { color: COLORS.textWhite }]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      {[...out.entries()].map(([b, moves]) => (
        <View key={b} style={{ marginTop: SIZES.sm }}>
          <Text style={styles.title}>{t('mu.outIn', { boat: b, n: moves.length })}</Text>
          <Text style={styles.sub}>{moves.map((m) => `${nameOf(m.crewId, m.name)} ${shipHm(m.at)}`).join(' · ')}</Text>
        </View>
      ))}
    </Card>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    title: { color: COLORS.textDark, fontWeight: '800', fontSize: SIZES.body },
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    input: { ...COLORS.glassInput, flex: 1, minWidth: 160, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, color: COLORS.textDark },
    btn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.xs },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.small },
  });
