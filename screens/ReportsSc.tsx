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
import { MciIcon } from '../components/MciIcon';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { GROUP_ORDER, GROUP_SHORT, visibleCategories } from '../constants/categories';
import { exportPdf, exportXlsx, exportZip } from '../services/export';
import {
  ReportScope,
  buildReport,
  exportReportPdf,
  exportReportXlsx,
  printReport as printInspectionReport,
} from '../services/inspectionReport';
import { InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import { stepPeriod, windowFor } from '../services/inspections';
import { periodsFor } from '../constants/checklists';
import { CategoryKey, EquipmentItem } from '../types/equipment';
import { dueWithinDays } from '../utils/dates';

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
  // Which month or week — any past one, not only the current. A vessel files
  // September's record in October, and needs to be able to print it then.
  const [ref, setRef] = useState<Date>(() => new Date());
  const win = useMemo(() => windowFor(period, ref), [period, ref]);
  const isCurrent = Date.now() >= win.from && Date.now() < win.to;
  const step = (by: -1 | 1) => {
    if (by > 0 && isCurrent) return; // nothing to report on in the future
    setRef((r) => stepPeriod(period, r, by));
  };

  // The categories this scope + period covers: right group, has items, and owes
  // this period's round. What the category picker below offers.
  const roundCats = useMemo(
    () =>
      visibleCategories().filter(
        (c) =>
          (scope === 'ALL' || c.group === scope) &&
          (byCategory[c.key] ?? []).length > 0 &&
          periodsFor(c.key, templates).includes(period)
      ),
    [scope, period, byCategory, templates]
  );

  // Narrow the report to some of them. null = the whole group, which is the
  // default and what the title then says. A customer asked for this in so many
  // words: the lifebuoy round, finished, filed as its own page of evidence —
  // not inside a group report that also lists what has not been done yet.
  const [catSel, setCatSel] = useState<Set<CategoryKey> | null>(null);
  useEffect(() => setCatSel(null), [scope, period]);
  const catOn = (k: CategoryKey) => catSel === null || catSel.has(k);
  const toggleRoundCat = (k: CategoryKey) => {
    setCatSel((prev) => {
      const next = new Set(prev ?? roundCats.map((c) => c.key));
      next.has(k) ? next.delete(k) : next.add(k);
      return next.size === roundCats.length ? null : next;
    });
  };
  const onlyRoundCat = (k: CategoryKey) => setCatSel(new Set([k]));
  const categories = catSel ? [...catSel] : undefined;

  // Live preview of the numbers that will be printed. Built from the same
  // function the export uses, so what is on screen cannot drift from the file.
  const preview = useMemo(
    () => buildReport(flat, trail, { scope, period, templates, ref, categories }),
    [flat, trail, scope, period, templates, ref, categories]
  );

  // Per-category progress for the picker: "3 of 5" tells the officer which round
  // is finished before any report is made — and which one to print.
  const roundProgress = useMemo(() => {
    const m = new Map<CategoryKey, { done: number; total: number; note: string | null }>();
    for (const c of roundCats) {
      const r = buildReport(byCategory[c.key] ?? [], trail, { scope, period, templates, ref, categories: [c.key] });
      m.set(c.key, {
        done: r.inScope.length - r.missed.length,
        total: r.inScope.length,
        // The words match the report's own: a round that failed, or a defect
        // still open from any round. Both are red, but they are not one thing.
        note: r.passed === false ? 'failed' : r.defects.length ? 'defect open' : null,
      });
    }
    return m;
  }, [roundCats, byCategory, trail, scope, period, templates, ref]);

  const runInspectionReport = async (kind: 'pdf' | 'xlsx' | 'print') => {
    setBusy(true);
    try {
      // The same options as the preview — templates included. Without them the
      // file left out the rounds a vessel wrote for itself, and disagreed with
      // the numbers shown just above the button.
      const opts = { scope, period, templates, ref, categories };
      if (kind === 'pdf') await exportReportPdf(flat, trail, vessel, opts);
      else if (kind === 'xlsx') await exportReportXlsx(flat, trail, vessel, opts);
      else await printInspectionReport(flat, trail, vessel, opts);
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * THE REGISTER, NARROWED TO WHAT IS COMING DUE.
   *
   * The sheet a vessel walks round with before an annual inspection. Asked for
   * on 30 Sep 2026: "a few days beforehand we begin collecting the relevant
   * equipment and bringing it together ready for the inspector. Ideally MSM could
   * generate the relevant equipment/register report sheets, which we could use to
   * cross-check the physical equipment against the register" — and, separately,
   * "see equipment coming due within our next annual inspection period, rather
   * than only once it reaches its exact due date", so that certification can be
   * harmonised by bringing items forward.
   *
   * One control answers both: the same filtered list is what you print to check
   * against, and what tells you which items to pull forward. `null` is the whole
   * register, which stays the default — this narrows a report, it does not hide
   * equipment.
   */
  const [horizon, setHorizon] = useState<number | null>(null);
  const HORIZONS: { days: number | null; label: string; note: string }[] = [
    { days: null, label: 'All', note: '' },
    { days: 60, label: '60 days', note: 'Due within 60 days' },
    { days: 182, label: '6 months', note: 'Due within 6 months' },
    { days: 365, label: '12 months', note: 'Due within 12 months' },
  ];
  const horizonNote = HORIZONS.find((h) => h.days === horizon)?.note || undefined;

  const dueRegister = useMemo(() => {
    if (horizon == null) return byCategory;
    const out = {} as Record<CategoryKey, EquipmentItem[]>;
    for (const [key, items] of Object.entries(byCategory)) {
      out[key as CategoryKey] = (items ?? []).filter((it) => dueWithinDays(it, horizon));
    }
    return out;
  }, [byCategory, horizon]);

  const nonEmpty = useMemo(
    () => visibleCategories().filter((c) => (dueRegister[c.key] ?? []).length > 0),
    [dueRegister]
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
    (n, c) => n + (selected.has(c.key) ? dueRegister[c.key]?.length ?? 0 : 0),
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
      if (kind === 'pdf') await exportPdf(dueRegister, vessel, only, horizonNote);
      else if (kind === 'xlsx') await exportXlsx(dueRegister, vessel, only, horizonNote);
      else {
        const { files, certificates: certCount } = await exportZip(dueRegister, vessel, certificates, only);
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
          {([...GROUP_ORDER, 'ALL'] as ReportScope[]).map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.chip, scope === g && styles.chipOn]}
              onPress={() => setScope(g)}
            >
              <Text style={[styles.chipText, scope === g && styles.chipTextOn]}>
                {g === 'ALL' ? 'All' : GROUP_SHORT[g]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Period</Text>
        <View style={styles.chipRow}>
          {/* Quarterly sits beside weekly and monthly because a vessel works to all
              three, per category (Settings → Checklists). A period no category owes
              is still offered: the answer "nothing in scope" is the useful one. */}
          {/* Annual sits here too since the lifting register asked for it: most
              lifting gear is examined and certified once a year, not monthly
              (constants/lifting.ts). */}
          {(['weekly', 'monthly', 'quarterly', 'annual'] as InspectionPeriod[]).map((p) => (
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

        {roundCats.length ? (
          <>
            <View style={styles.headRow}>
              <Text style={styles.sectionLabel}>
                Categories ({catSel ? catSel.size : roundCats.length}/{roundCats.length})
              </Text>
              {catSel ? (
                <TouchableOpacity onPress={() => setCatSel(null)} hitSlop={8}>
                  <Text style={styles.selectAll}>Whole group</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {/* Tap toggles a category in or out; long-press keeps ONLY that one —
                the "print just the lifebuoys" gesture, one motion instead of
                unticking nine others. */}
            <View style={twoCol ? styles.gridWrap : undefined}>
              {roundCats.map((c) => {
                const on = catOn(c.key);
                const p = roundProgress.get(c.key);
                return (
                  <TouchableOpacity
                    key={c.key}
                    activeOpacity={0.8}
                    onPress={() => toggleRoundCat(c.key)}
                    onLongPress={() => onlyRoundCat(c.key)}
                    style={[styles.panel, on && styles.panelOn, twoCol && styles.panelTablet]}
                  >
                    <CategoryBadge category={c.key} size={22} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.panelTitle} numberOfLines={1}>{c.label}</Text>
                      {p ? (
                        <Text style={[styles.panelSub, p.note && { color: COLORS.danger }, p.done === p.total && !p.note && { color: COLORS.success }]}>
                          {p.done} of {p.total} inspected{p.note ? ` · ${p.note}` : p.done === p.total ? ' · complete' : ''}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.pickerHint}>Tap to include or leave out; press and hold to report on that category alone.</Text>
          </>
        ) : null}

        {/* The numbers, before anything is generated — including the ones a
            vessel would rather not see. That is the point of showing them. */}
        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navBtn} onPress={() => step(-1)} hitSlop={8} accessibilityLabel="Previous period">
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.windowLabel} numberOfLines={1}>{preview.periodName}</Text>
            {!isCurrent ? (
              <TouchableOpacity onPress={() => setRef(new Date())} hitSlop={8}>
                <Text style={styles.selectAll}>Back to current</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.navBtn, isCurrent && { opacity: 0.3 }]}
            onPress={() => step(1)}
            disabled={isCurrent}
            hitSlop={8}
            accessibilityLabel="Next period"
          >
            <Text style={styles.navBtnText}>›</Text>
          </TouchableOpacity>
        </View>

        <Card>
          <Text
            style={[
              styles.headline,
              {
                color:
                  preview.passed === false
                    ? COLORS.danger
                    : preview.completed && preview.passed
                      ? COLORS.success
                      : COLORS.warning,
              },
            ]}
          >
            {preview.headline}
          </Text>
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
          The report covers {categories ? (categories.length === 1 ? 'one category' : `${categories.length} categories`) : 'the whole group'} and
          opens with the period's status — completed or not, passed or failed — then lists
          every inspection signed in it: item number, location, type, size, serial, result, comments, the
          inspector's initials, date and time. After that come the items still outstanding, and every
          defect left open.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title="Reports" subtitle="Choose what to include, then export" help={10} />
      {modeSwitch}

      <Text style={styles.sectionLabel}>Coming due</Text>
      <View style={styles.chipRow}>
        {HORIZONS.map((h) => (
          <TouchableOpacity
            key={h.label}
            style={[styles.chip, horizon === h.days && styles.chipOn]}
            onPress={() => setHorizon(h.days)}
          >
            <Text style={[styles.chipText, horizon === h.days && styles.chipTextOn]}>{h.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
          const count = dueRegister[c.key]?.length ?? 0;
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
            <MciIcon name="package-variant" size={16} color={COLORS.textWhite} />
            <Text style={styles.btnText}>Export ZIP (PDF + photos)</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.help}>
        {totalItems} item{totalItems === 1 ? '' : 's'} will be exported. Reports include each item's type, serial,
        position, dates and compliance status, and open your device's share sheet.
        {horizon != null
          ? ` Only equipment already overdue or falling due within ${
              HORIZONS.find((h) => h.days === horizon)!.label
            } is listed, and the report says so on its heading — the sheet to walk round with before an inspection.`
          : ''}
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
  headline: { fontSize: SIZES.body, fontWeight: '800' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  navBtnText: { fontSize: 26, lineHeight: 28, fontWeight: '700', color: COLORS.primary },
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
  pickerHint: { color: COLORS.textLight, fontSize: SIZES.tiny, marginTop: SIZES.xs, marginBottom: SIZES.md },
  empty: { fontSize: SIZES.body, color: COLORS.textLight, lineHeight: 20 },
});
