// ===================================
// Reports — pick which categories to include, then export PDF / XLSX.
// Each category is a tappable panel; the export bundles every selected one.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Screen, ScreenTitle, Card } from '../components/ui';
import { COLORS, SIZES } from '../theme';
import { useData } from '../contexts/DataContext';
import { CATEGORIES } from '../constants/categories';
import { exportPdf, exportXlsx, exportZip, printReport } from '../services/export';
import { CategoryKey } from '../types/equipment';

export default function ReportsSc() {
  const { byCategory, vessel, certificates } = useData();
  const [busy, setBusy] = useState(false);

  const nonEmpty = useMemo(
    () => CATEGORIES.filter((c) => (byCategory[c.key] ?? []).length > 0),
    [byCategory]
  );

  // Default: everything selected. Auto-fill once, after data first loads, until
  // the user manually changes the selection.
  const [selected, setSelected] = useState<Set<CategoryKey>>(() => new Set(nonEmpty.map((c) => c.key)));
  const touched = useRef(false);
  useEffect(() => {
    if (!touched.current) setSelected(new Set(nonEmpty.map((c) => c.key)));
  }, [nonEmpty]);

  const allOn = nonEmpty.length > 0 && nonEmpty.every((c) => selected.has(c.key));
  const totalItems = nonEmpty.reduce(
    (n, c) => n + (selected.has(c.key) ? byCategory[c.key]?.length ?? 0 : 0),
    0
  );

  const toggle = (key: CategoryKey) => {
    touched.current = true;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    touched.current = true;
    setSelected(allOn ? new Set() : new Set(nonEmpty.map((c) => c.key)));
  };

  const run = async (kind: 'pdf' | 'xlsx' | 'zip' | 'print') => {
    const only = Array.from(selected);
    if (!only.length) {
      Alert.alert('Nothing selected', 'Tap at least one category to include in the report.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'pdf') await exportPdf(byCategory, vessel, only);
      else if (kind === 'xlsx') await exportXlsx(byCategory, vessel, only);
      else if (kind === 'print') await printReport(byCategory, vessel, only);
      else {
        const { files, certificates: certCount } = await exportZip(byCategory, vessel, certificates, only);
        const parts = [
          `${files} photo${files === 1 ? '' : 's'}`,
          `${certCount} certificate${certCount === 1 ? '' : 's'}`,
        ];
        Alert.alert('ZIP ready', `PDF report + ${parts.join(' + ')} bundled.`);
      }
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!nonEmpty.length) {
    return (
      <Screen scroll>
        <ScreenTitle title="Reports" subtitle="Export the safety register" />
        <Card>
          <Text style={styles.empty}>No equipment yet. Import or add items first, then export a report.</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title="Reports" subtitle="Choose what to include, then export" />

      <View style={styles.headRow}>
        <Text style={styles.sectionLabel}>
          Included categories ({selected.size}/{nonEmpty.length})
        </Text>
        <TouchableOpacity onPress={toggleAll} hitSlop={8}>
          <Text style={styles.selectAll}>{allOn ? 'Clear all' : 'Select all'}</Text>
        </TouchableOpacity>
      </View>

      {nonEmpty.map((c) => {
        const on = selected.has(c.key);
        const count = byCategory[c.key]?.length ?? 0;
        return (
          <TouchableOpacity
            key={c.key}
            activeOpacity={0.8}
            onPress={() => toggle(c.key)}
            style={[styles.panel, on && styles.panelOn]}
          >
            <Text style={styles.panelEmoji}>{c.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.panelTitle}>{c.label}</Text>
              <Text style={styles.panelSub}>{count} item{count === 1 ? '' : 's'}</Text>
            </View>
            <View style={[styles.check, on && styles.checkOn]}>
              {on ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}

      {busy ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SIZES.lg }} />
      ) : (
        <>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => run('pdf')}>
              <Text style={styles.btnText}>Export PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => run('xlsx')}>
              <Text style={styles.btnText}>Export XLSX</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.btn, styles.zipBtn]} onPress={() => run('zip')}>
            <Text style={styles.btnText}>📦 Export ZIP (PDF + photos)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.printBtn]} onPress={() => run('print')}>
            <Text style={[styles.btnText, { color: COLORS.primary }]}>🖨️ Print</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.help}>
        {totalItems} item{totalItems === 1 ? '' : 's'} will be exported. Reports include each item's type, serial,
        position, dates and compliance status, and open your device's share sheet.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.sm },
  sectionLabel: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '700' },
  selectAll: { fontSize: SIZES.small, color: COLORS.primary, fontWeight: '700' },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SIZES.sm,
  },
  panelOn: { borderColor: COLORS.primary, backgroundColor: 'rgba(255,255,255,0.9)' },
  panelEmoji: { fontSize: 22 },
  panelTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
  panelSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkMark: { color: COLORS.textWhite, fontSize: 14, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  btn: { flex: 1, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center' },
  zipBtn: { backgroundColor: COLORS.primary, marginTop: SIZES.sm },
  printBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.primary, marginTop: SIZES.sm },
  btnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  help: { marginTop: SIZES.lg, color: COLORS.textLight, fontSize: SIZES.body, lineHeight: 20 },
  empty: { fontSize: SIZES.body, color: COLORS.textLight, lineHeight: 20 },
});
