// ===================================
// Getting Started — a short "How to start?" guide for an empty register:
// how to load an existing LSA/FFE inventory from an Excel file.
// Opened from the empty Dashboard; content is localized (constants/gettingStarted).
// ===================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, GlyphBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { gettingStarted } from '../constants/gettingStarted';
import { exportTemplate } from '../services/export';
import { playErrorSound } from '../utils/sound';

export default function GettingStartedSc() {
  const styles = useS();
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const content = useMemo(() => gettingStarted(), []);

  const downloadTemplate = async () => {
    try {
      await exportTemplate();
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Template failed', String(e?.message ?? e));
    }
  };

  return (
    <Screen scroll>
      <ScreenTitle title={content.screenTitle} subtitle={content.screenSubtitle} />

      <Text style={styles.intro}>{content.intro}</Text>

      {content.steps.map((s) => (
        <View key={s.title} style={styles.card}>
          <View style={styles.header}>
            <GlyphBadge emoji={s.emoji} size={20} />
            <Text style={styles.title}>{s.title}</Text>
          </View>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}

      <View style={styles.note}>
        <Text style={styles.noteText}>💡 {content.tip}</Text>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={() => nav.navigate('Import')} activeOpacity={0.85}>
        <Text style={styles.primaryText}>{content.importBtn}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={downloadTemplate} activeOpacity={0.85}>
        <Text style={styles.secondaryText}>{content.templateBtn}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.manualLink} onPress={() => nav.navigate('Manual')} activeOpacity={0.7}>
        <Text style={styles.manualLinkText}>{content.manualLink}</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  intro: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 21, marginBottom: SIZES.md },
  card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, marginBottom: SIZES.sm, padding: SIZES.md, gap: SIZES.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
  title: { flex: 1, fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  body: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 20 },
  note: {
    backgroundColor: 'rgba(46,125,153,0.10)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    marginTop: SIZES.xs,
    marginBottom: SIZES.lg,
  },
  noteText: { fontSize: SIZES.small, color: COLORS.text, lineHeight: 18 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  primaryText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  secondaryBtn: {
    marginTop: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  secondaryText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.body },
  manualLink: { alignItems: 'center', paddingVertical: SIZES.md, marginTop: SIZES.sm },
  manualLinkText: { color: COLORS.textLight, fontWeight: '600', fontSize: SIZES.body, textDecorationLine: 'underline' },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
