// ===================================
// HelpButton — a "?" that opens the matching User-Manual section in a modal.
// Each screen passes the index of its section in constants/manual (order is the
// same across all languages, so an index maps cleanly to the localized section).
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { MANUAL } from '../constants/manual';
import { manualLang } from '../utils/locale';

export function HelpButton({ section }: { section: number }) {
  const COLORS = useTheme();
  const [open, setOpen] = useState(false);
  const s = useMemo(() => MANUAL[manualLang()].sections[section], [section]);
  const styles = makeStyles(COLORS);
  if (!s) return null;

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)} hitSlop={10} accessibilityLabel="Help">
        <MaterialCommunityIcons name="help-circle-outline" size={24} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity style={styles.card} activeOpacity={1} onPress={() => {}}>
            <View style={styles.head}>
              <Text style={styles.title}>{s.title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: SIZES.sm }}>
              {s.note ? <Text style={styles.note}>{s.note}</Text> : null}
              {s.body?.map((p, i) => (
                <Text key={`p${i}`} style={styles.para}>{p}</Text>
              ))}
              {s.rows?.map((r, i) => (
                <View key={`r${i}`} style={styles.row}>
                  <Text style={styles.k}>{r.k}</Text>
                  <Text style={styles.v}>{r.v}</Text>
                </View>
              ))}
              {s.link ? <Text style={styles.link}>{s.link}</Text> : null}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    btn: { padding: 2 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: SIZES.lg,
    },
    card: {
      ...COLORS.glassCard,
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      width: '100%',
      maxWidth: 520,
      maxHeight: '82%',
    },
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.sm },
    title: { flex: 1, fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    note: {
      fontSize: SIZES.small,
      color: COLORS.textDark,
      backgroundColor: COLORS.overlay,
      borderRadius: SIZES.radiusSm,
      padding: SIZES.sm,
      marginBottom: SIZES.sm,
    },
    para: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 21, marginBottom: SIZES.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: SIZES.md, paddingVertical: 3 },
    k: { flex: 1, fontSize: SIZES.small, color: COLORS.textDark, fontWeight: '600' },
    v: { fontSize: SIZES.small, color: COLORS.textLight, textAlign: 'right' },
    link: { fontSize: SIZES.body, color: COLORS.primary, fontWeight: '700', marginTop: SIZES.xs },
  });
