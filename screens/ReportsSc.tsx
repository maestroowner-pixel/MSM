// ===================================
// Reports — two different questions, kept apart because they have two different
// answers and mixing them produces a document that answers neither:
//
//   Register     — what the vessel HAS and what is falling due. A snapshot.
//   Inspections  — what the crew DID in a period, who did it, and what is still
//                  outstanding. The audit trail (services/inspectionReport.ts).
//
// A surveyor asks for both, so both are one tap apart rather than one being
// buried in the other's options.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Screen, ScreenTitle, Card, CategoryBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORIES } from '../constants/categories';
import { exportPdf, exportXlsx, exportZip } from '../services/export';
import {
  ReportScope,
  buildReport,
  exportReportPdf,
  exportReportXlsx,
  printReport as printInspectionReport,
} from '../services/inspectionReport';
import { InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import { CategoryKey } from '../types/equipment';

export default function ReportsSc() {
  const { byCategory, vessel, certificates, flat, templates, inspections: trail } = useData();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { width } = useWindowDimensions();
  const twoCol = width >= 600;
  const [busy, setBusy] = useState(false);

  // Which of the two reports is on screen (see the module header).
  const [mode, setMode] = useState<'register' | 'inspections'>('register');
  const [scope, setScope] = useState<ReportScope>('LSA');
  const [period, setPeriod] = useState<InspectionPeriod>('monthly');

  // Live preview of the numbers that will be printed. Built from the same
  // function the export uses, so what is on screen cannot drift from the file.
  const preview = useMemo(
    () => buildReport(flat, trail, { scope, period, templates }),
    [flat, trail, scope, period, templates]
  );

  const runInspectionReport = async (kind: 'pdf' | 'xlsx' | 'print') => {
    setBusy(true);
    try {
      const opts = { scope, period };
      if (kind === 'pdf') await exportReportPdf(flat, trail, vessel, opts);
      else if (kind === 'xlsx') await exportReportXlsx(flat, trail, vessel, opts);
      else await printInspectionReport(flat, trail, vessel, opts);
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

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

  const run = async (kind: 'pdf' | 'xlsx' | 'zip') => {
    const only = Array.from(selected);
    if (!only.length) {
      Alert.alert('Nothing selected', 'Tap at least one category to include in the report.');
      return;
    }
    setBusy(true);
    try {
      if (kind === 'pdf') await exportPdf(byCategory, vessel, only);
      else if (kind === 'xlsx') await exportXlsx(byCategory, vessel, only);
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
        <ScreenTitle title="Reports" subtitle="Export the safety register" help={10} />
        <Card>
          <Text style={styles.empty}>No equipment yet. Import or add items first, then export a report.</Text>
        </Card>
      </Screen>
    );
  }

  const modeSwitch = (
    <View style={styles.modeRow}>
      {(['register', 'inspections'] as const).map((m) => (
        <TouchableOpacity
          key={m}
          style={[styles.modeBtn, mode === m && styles.modeBtnOn]}
          onPress={() => setMode(m)}
        >
          <Text style={[styles.modeText, mode === m && styles.modeTextOn]}>
            {m === 'register' ? 'Register' : 'Inspections'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (mode === 'inspections') {
    return (
      <Screen scroll>
        <ScreenTitle title="Reports" subtitle="What was inspected, by whom, and when" help={10} />
        {modeSwitch}

        <Text style={styles.sectionLabel}>Equipment group</Text>
        <View style={styles.chipRow}>
          {/* OTHER belongs here. The report engine has always handled it — it is a
              Group like any other, and SCOPE_LABEL names it — but this row offered
              only LSA and FFE, so the routine checks a vessel keeps outside the
              statutory rounds (escape routes, emergency lighting, alarms) could not
              be printed on their own. Worse, "ALL" was LABELLED "LSA & FFE" while
              the filter passed every group, so those items appeared in a report
              that said it did not cover them. */}
          {(['LSA', 'FFE', 'OTHER', 'ALL'] as ReportScope[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, scope === g && styles.chipOn]}
              onPress={() => setScope(g)}
            >
              <Text style={[styles.chipText, scope === g && styles.chipTextOn]}>
                {g === 'ALL' ? 'All' : g === 'OTHER' ? 'Other' : g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Period</Text>
        <View style={styles.chipRow}>
          {(['weekly', 'monthly'] as InspectionPeriod[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, period === p && styles.chipOn]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.chipText, period === p && styles.chipTextOn]}>
                {PERIOD_LABEL[p]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* The numbers, before anything is generated — including the ones a
            vessel would rather not see. That is the point of showing them. */}
        <Card>
          <Text style={styles.windowLabel}>{preview.windowLabel}</Text>
          <View style={styles.statRow}>
            <Stat label="In scope" value={preview.inScope.length} />
            <Stat label="Inspected" value={preview.done.length} />
            <Stat label="Outstanding" value={preview.missed.length} bad={preview.missed.length > 0} />
            <Stat label="Defects" value={preview.defects.length} bad={preview.defects.length > 0} />
          </View>
        </Card>

        {busy ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SIZES.lg }} />
        ) : (
          <>
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.outlineBtn]}
                onPress={() => runInspectionReport('pdf')}
              >
                <Text style={[styles.btnText, styles.outlineText]}>Export PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.outlineBtn]}
                onPress={() => runInspectionReport('xlsx')}
              >
                <Text style={[styles.btnText, styles.outlineText]}>Export XLSX</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.zipBtn]}
              onPress={() => runInspectionReport('print')}
            >
              <Text style={styles.btnText}>Print</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.help}>
          The report lists every inspection signed in this period with its date, exact time and the
          crew member who carried it out — followed by the items still outstanding, and every defect
          left open.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title="Reports" subtitle="Choose what to include, then export" help={10} />
      {modeSwitch}

      <View style={styles.headRow}>
        <Text style={styles.sectionLabel}>
          Included categories ({selected.size}/{nonEmpty.length})
        </Text>
        <TouchableOpacity onPress={toggleAll} hitSlop={8}>
          <Text style={styles.selectAll}>{allOn ? 'Clear all' : 'Select all'}</Text>
        </TouchableOpacity>
      </View>

      <View style={twoCol ? styles.gridWrap : undefined}>
        {nonEmpty.map((c) => {
          const on = selected.has(c.key);
          const count = byCategory[c.key]?.length ?? 0;
          return (
            <TouchableOpacity
              key={c.key}
              activeOpacity={0.8}
              onPress={() => toggle(c.key)}
              style={[styles.panel, on && styles.panelOn, twoCol && styles.panelTablet]}
            >
              <CategoryBadge category={c.key} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle} numberOfLines={1}>{c.label}</Text>
                <Text style={styles.panelSub}>{count} item{count === 1 ? '' : 's'}</Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {busy ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SIZES.lg }} />
      ) : (
        <>
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.outlineBtn]} onPress={() => run('pdf')}>
              <Text style={[styles.btnText, styles.outlineText]}>Export PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.outlineBtn]} onPress={() => run('xlsx')}>
              <Text style={[styles.btnText, styles.outlineText]}>Export XLSX</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.btn, styles.zipBtn]} onPress={() => run('zip')}>
            <Text style={styles.btnText}>📦 Export ZIP (PDF + photos)</Text>
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

function Stat({ label, value, bad }: { label: string; value: number; bad?: boolean }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, bad && { color: COLORS.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  modeRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.lg },
  modeBtn: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  modeBtnOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { fontWeight: '700', color: COLORS.text },
  modeTextOn: { color: COLORS.textWhite },
  chipRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md, marginTop: SIZES.sm },
  chip: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontWeight: '600', color: COLORS.text, fontSize: SIZES.small },
  chipTextOn: { color: COLORS.textWhite },
  windowLabel: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  statRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: SIZES.h3, fontWeight: '800', color: COLORS.primaryDark },
  statLabel: { fontSize: SIZES.tiny, color: COLORS.textLight, textTransform: 'uppercase', marginTop: 2 },
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
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SIZES.sm,
  },
  panelOn: { borderColor: COLORS.primary, backgroundColor: COLORS.cardSolid },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  panelTablet: { flexBasis: '48%', flexGrow: 1, marginBottom: 0 },
  panelEmoji: { width: 24, alignItems: 'center' },
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
    backgroundColor: COLORS.cardSolid,
  },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkMark: { color: COLORS.textWhite, fontSize: 14, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  btn: { flex: 1, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center' },
  zipBtn: { backgroundColor: COLORS.primary, marginTop: SIZES.sm },
  outlineBtn: { backgroundColor: COLORS.cardSolid, borderWidth: 1.5, borderColor: COLORS.primary },
  outlineText: { color: COLORS.primary },
  btnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  help: { marginTop: SIZES.lg, color: COLORS.textLight, fontSize: SIZES.body, lineHeight: 20 },
  empty: { fontSize: SIZES.body, color: COLORS.textLight, lineHeight: 20 },
});
