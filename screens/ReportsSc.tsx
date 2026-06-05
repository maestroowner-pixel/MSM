// ===================================
// Reports — export PDF / XLSX per category or full register.
// ===================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Screen, ScreenTitle, Card } from '../components/ui';
import { COLORS, SIZES } from '../theme';
import { useData } from '../contexts/DataContext';
import { CATEGORIES } from '../constants/categories';
import { exportPdf, exportXlsx } from '../services/export';
import { CategoryKey } from '../types/equipment';

export default function ReportsSc() {
  const { byCategory, vessel } = useData();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<CategoryKey | 'ALL'>('ALL');

  const run = async (kind: 'pdf' | 'xlsx') => {
    setBusy(true);
    try {
      const only = selected === 'ALL' ? undefined : selected;
      if (kind === 'pdf') await exportPdf(byCategory, vessel, only);
      else await exportXlsx(byCategory, vessel, only);
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const nonEmpty = CATEGORIES.filter((c) => (byCategory[c.key] ?? []).length > 0);

  return (
    <Screen scroll>
      <ScreenTitle title="Reports" subtitle="Export the safety register" />

      <Card>
        <Text style={styles.sectionLabel}>Scope</Text>
        <View style={styles.chips}>
          <Chip label="Full register" active={selected === 'ALL'} onPress={() => setSelected('ALL')} />
          {nonEmpty.map((c) => (
            <Chip
              key={c.key}
              label={`${c.emoji} ${c.short}`}
              active={selected === c.key}
              onPress={() => setSelected(c.key)}
            />
          ))}
        </View>
      </Card>

      {busy ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SIZES.lg }} />
      ) : (
        <View style={styles.btnRow}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => run('pdf')}>
            <Text style={styles.btnText}>Export PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => run('xlsx')}>
            <Text style={styles.btnText}>Export XLSX</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.help}>
        Reports include each item's type, serial, position, dates and compliance status. The export opens your
        device's share sheet so you can email or save it.
      </Text>
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '700', marginBottom: SIZES.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
  chip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: SIZES.radiusRound,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: SIZES.small, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: COLORS.textWhite },
  btnRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  btn: { flex: 1, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center' },
  btnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  help: { marginTop: SIZES.lg, color: COLORS.textLight, fontSize: SIZES.body, lineHeight: 20 },
});
