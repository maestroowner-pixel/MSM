// ===================================
// Import — pick the LSA/FFE .xlsx, preview parsed counts, apply.
//
// Three ways in. UPDATE is the default once a register exists: it finds each
// row's existing item (services/registerUpdate.ts) so labels, photos and signed
// history survive a second import. REPLACE and ADD are the original two.
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { BackButton, Card, CategoryBadge, Screen, ScreenTitle } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { parseWorkbookBase64, parseWorkbookBytes, ImportPreview } from '../services/excelImport';
import { exportTemplate } from '../services/export';
import { pickFileBase64, onWindows, onWeb } from '../utils/fileShare';
import { pickBinaryFileWeb } from '../utils/webFile';
import { CATEGORY_MAP, GROUP_ORDER } from '../constants/categories';
import * as storage from '../services/storage';
import { useData } from '../contexts/DataContext';
import { CategoryKey, EquipmentItem, Group } from '../types/equipment';
import { applyPlan, planUpdate, storable } from '../services/registerUpdate';
import * as snapshot from '../services/snapshot';
import { itemIdentifiers, itemLocation } from '../utils/itemText';
import { playSuccessSound, playErrorSound } from '../utils/sound';
import { goBackOr } from '../utils/nav';

type Mode = 'update' | 'replace' | 'append';

const MODE_LABEL: Record<Mode, string> = { update: 'Update', replace: 'Replace all', append: 'Add as new' };

/** "Viking 16DK · #2 · VK-1002 · Boat Deck PS" — enough to recognise a row. */
function rowName(it: EquipmentItem): string {
  return [it.type || CATEGORY_MAP[it.category]?.label, itemIdentifiers(it), itemLocation(it)].filter(Boolean).join(' · ');
}

export default function ImportSc() {
  const nav = useNavigation<any>();
  const { reload, flat, byCategory, vessel } = useData();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // Update is the safe default the moment there is anything to lose. Derived, not
  // a useState initialiser: opened straight after launch (a reload on /import in
  // a browser) the register is still loading, `flat` is empty for one render, and
  // an initialiser fixed "Replace all" as the default for a ship with 627 items.
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (flat.length ? 'update' : 'replace');
  const [removeMissing, setRemoveMissing] = useState(false);
  const [showAll, setShowAll] = useState<'changed' | 'missing' | null>(null);

  const rows = useMemo(
    () => (preview ? (Object.values(preview.byCategory).flat() as EquipmentItem[]) : []),
    [preview]
  );
  const plan = useMemo(() => {
    if (!preview || mode !== 'update') return null;
    // What the file can declare MISSING: the categories it has sheets for. A
    // vessel's own one-sheet list is sorted row by row and speaks for the whole
    // register, so it covers everything.
    const covered = new Set(Object.keys(preview.byCategory));
    const covers = preview.sortedSheets.length ? () => true : (c: CategoryKey) => covered.has(c);
    return planUpdate(flat, rows, covers);
  }, [preview, mode, flat, rows]);

  const pick = async () => {
    try {
      // Windows uses the native Open dialog (returns base64); mobile uses the picker.
      if (onWindows) {
        const picked = await pickFileBase64(['xlsx', 'xls']);
        if (!picked) return;
        setBusy(true);
        setFileName(picked.name);
        setPreview(parseWorkbookBase64(picked.base64));
        return;
      }
      // Browser: read the bytes ourselves. expo-file-system has no
      // readAsStringAsync on web — the import died on exactly that call.
      if (onWeb) {
        const file = await pickBinaryFileWeb('.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel');
        if (!file) return;
        if (!file.bytes || !file.bytes.byteLength) {
          throw new Error(`"${file.name}" is empty (0 of ${file.size} bytes could be read).`);
        }
        setBusy(true);
        setFileName(file.name);
        setPreview(parseWorkbookBytes(file.bytes));
        return;
      }
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setBusy(true);
      setFileName(asset.name);
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: 'base64' });
      const pv = parseWorkbookBase64(b64);
      setPreview(pv);
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Import failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * A second template appears only when a second register exists. The lifting
   * module has its own columns (SWL, breaking load, certificates, test dates),
   * so it has its own workbook — the same pair of buttons as Settings, because
   * this is the screen a person is on when they go looking for one.
   */
  const hasLifting = GROUP_ORDER.includes('LIFTING');

  const downloadTemplate = async (group?: Group) => {
    try {
      await exportTemplate(group);
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Template failed', String(e?.message ?? e));
    }
  };

  const apply = async () => {
    if (!preview) return;
    if (plan && removeMissing && plan.missing.length) {
      Alert.alert(
        `Remove ${plan.missing.length} item${plan.missing.length === 1 ? '' : 's'}?`,
        'They are not in this file. Their printed labels will stop working. Signed inspections stay on record.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove and update', style: 'destructive', onPress: () => void run() },
        ]
      );
      return;
    }
    await run();
  };

  const run = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      // A dated copy of the register as it was, so the import can be rolled back
      // from Settings → Data like any other bad day.
      await snapshot.takeSnapshot(vessel).catch(() => null);
      let message: string;
      if (mode === 'update' && plan) {
        const next = applyPlan(byCategory, plan, removeMissing);
        for (const [cat, list] of Object.entries(next)) {
          await storage.replaceCategory(cat as CategoryKey, list ?? []);
        }
        const removed = removeMissing ? plan.missing.length : 0;
        message =
          `${plan.changed.length} updated, ${plan.added.length} added` +
          (removed ? `, ${removed} removed.` : '.');
      } else {
        // Rows exported from MSM keep their MSM ID even here, so a full replace
        // of our own export leaves printed labels pointing at the same items.
        // Seeded with the live ids when adding, so nothing can collide.
        const seen = new Set<string>(mode === 'append' ? flat.map((it) => it.id) : []);
        for (const meta of Object.values(CATEGORY_MAP)) {
          const parsed = (preview.byCategory[meta.key] ?? []).map((r) => storable(r, seen));
          if (!parsed.length && mode === 'append') continue;
          if (mode === 'replace') {
            await storage.replaceCategory(meta.key as CategoryKey, parsed);
          } else {
            const existing = await storage.loadCategory(meta.key as CategoryKey);
            await storage.replaceCategory(meta.key as CategoryKey, [...existing, ...parsed]);
          }
        }
        message = `${preview.total} items imported.`;
      }
      await reload();
      playSuccessSound();
      Alert.alert('Import complete', message, [
        { text: 'OK', onPress: () => goBackOr(nav) },
      ]);
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Import failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const nothingToDo = !!plan && !plan.changed.length && !plan.added.length && !(removeMissing && plan.missing.length);
  const applyLabel = plan
    ? nothingToDo
      ? 'Register already matches this file'
      : 'Apply update'
    : `Import ${preview?.total ?? 0} items`;

  return (
    <Screen scroll>
      {/* This screen had no way back at all: a modal, so no stack header, and
          nothing of its own — the browser's back button was the only exit. */}
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title="Import from Excel" subtitle="LSA / FFE Inventories workbook (.xlsx)" help={1} />

      <TouchableOpacity style={styles.pickBtn} onPress={pick} disabled={busy}>
        <Text style={styles.pickBtnText}>{fileName ? 'Choose a different file' : 'Choose .xlsx file'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.templateBtn} onPress={() => void downloadTemplate()} disabled={busy}>
        <Text style={styles.templateBtnText}>
          {hasLifting ? 'Download blank LSA / FFE template (.xlsx)' : 'Download blank template (.xlsx)'}
        </Text>
      </TouchableOpacity>

      {hasLifting ? (
        <TouchableOpacity style={styles.templateBtn} onPress={() => void downloadTemplate('LIFTING')} disabled={busy}>
          <Text style={styles.templateBtnText}>Download blank lifting &amp; mooring template (.xlsx)</Text>
        </TouchableOpacity>
      ) : null}

      {busy ? (
        <View style={{ padding: SIZES.xl, alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}

      {fileName ? <Text style={styles.fileName}>{fileName}</Text> : null}

      {preview ? (
        <>
          <Card>
            <Text style={styles.total}>{preview.total} items found</Text>
            <Text style={styles.totalSub}>across {preview.counts.filter((c) => c.count > 0).length} categories</Text>
          </Card>

          <View style={styles.modeRow}>
            {(['update', 'replace', 'append'] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeChip, mode === m && styles.modeChipActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>{MODE_LABEL[m]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modeHint}>
            {mode === 'update'
              ? 'Matches each row to the item already in the register (by MSM ID, then serial, then number and location). Items keep their QR labels, photos and inspection history.'
              : mode === 'replace'
                ? 'Everything in the register is replaced by this file. Items without an MSM ID get new QR labels.'
                : 'Every row is added as a new item, next to what is already there.'}
          </Text>

          {plan ? (
            <Card>
              <View style={styles.planRow}>
                <PlanStat n={plan.changed.length} label="to update" styles={styles} />
                <PlanStat n={plan.added.length} label="new" styles={styles} />
                <PlanStat n={plan.unchanged.length} label="unchanged" styles={styles} />
                <PlanStat n={plan.missing.length} label="not in file" styles={styles} />
              </View>
              {plan.matchedBy.id === 0 && flat.length > 0 ? (
                <Text style={styles.planNote}>
                  This file has no MSM ID column, so rows were matched by serial, number and location. For an exact
                  match, export the register from Reports (Excel), edit that file and import it here.
                </Text>
              ) : null}

              {plan.changed.length ? (
                <>
                  <Text style={styles.planHead}>Will be updated</Text>
                  {(showAll === 'changed' ? plan.changed : plan.changed.slice(0, 6)).map((c) => (
                    <Text key={c.before.id} style={styles.planItem} numberOfLines={2}>
                      {rowName(c.after)} — <Text style={styles.planFields}>{c.fields.join(', ')}</Text>
                    </Text>
                  ))}
                  {plan.changed.length > 6 && showAll !== 'changed' ? (
                    <Text style={styles.planMore} onPress={() => setShowAll('changed')}>
                      Show all {plan.changed.length}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {plan.missing.length ? (
                <>
                  <Text style={styles.planHead}>In the register, not in this file</Text>
                  {(showAll === 'missing' ? plan.missing : plan.missing.slice(0, 6)).map((it) => (
                    <Text key={it.id} style={styles.planItem} numberOfLines={1}>
                      {rowName(it)}
                    </Text>
                  ))}
                  {plan.missing.length > 6 && showAll !== 'missing' ? (
                    <Text style={styles.planMore} onPress={() => setShowAll('missing')}>
                      Show all {plan.missing.length}
                    </Text>
                  ) : null}
                  <View style={styles.removeRow}>
                    <Text style={styles.removeText}>
                      {plan.missing.length === 1 ? 'Remove this item' : `Remove these ${plan.missing.length}`} from the register
                    </Text>
                    <Switch value={removeMissing} onValueChange={setRemoveMissing} />
                  </View>
                  <Text style={styles.planNote}>
                    {removeMissing
                      ? 'They will be deleted. Signed inspections of them stay on record.'
                      : 'Off: they are kept as they are.'}
                  </Text>
                </>
              ) : null}
            </Card>
          ) : null}

          <Card>
            {preview.counts.map((c) => (
              <View key={c.category} style={styles.row}>
                <View style={styles.rowEmoji}><CategoryBadge category={c.category} size={18} /></View>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Text style={[styles.rowCount, c.count === 0 && { color: COLORS.textLight }]}>{c.count}</Text>
              </View>
            ))}
          </Card>

          {preview.sortedSheets.length ? (
            <Text style={styles.sorted}>
              Sorted by description from: {preview.sortedSheets.join(', ')}. Anything that could not be
              recognised is under Other Safety Equipment.
            </Text>
          ) : null}

          {preview.missingSheets.length ? (
            <Text style={styles.missing}>Sheets not found: {preview.missingSheets.join(', ')}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.applyBtn, nothingToDo && styles.applyBtnIdle]}
            onPress={apply}
            disabled={busy || nothingToDo}
          >
            <Text style={styles.applyText}>{applyLabel}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.help}>
          Select your “LSA FFE Inventories.xlsx”, or download the blank template above, fill it in (one
          worksheet per category) and import it back. To change a register you already have, export it from
          Reports as Excel, edit it and import it here with Update — items keep their labels and history. Your own list works too — one sheet with columns such
          as #, Deck, Location, Description, Make, Type, Size, Serial and Exp / Inspc.; each row is sorted
          into its category by its description. Each worksheet maps to an equipment category. Dates
          are converted automatically; you can edit any item afterwards.
        </Text>
      )}
    </Screen>
  );
}

function PlanStat({ n, label, styles }: { n: number; label: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.planStat}>
      <Text style={styles.planStatN}>{n}</Text>
      <Text style={styles.planStatLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  pickBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  pickBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  templateBtn: {
    marginTop: SIZES.sm,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  templateBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.body },
  fileName: { marginTop: SIZES.md, color: COLORS.text, fontSize: SIZES.small },
  total: { fontSize: SIZES.h2, fontWeight: '800', color: COLORS.primaryDark },
  totalSub: { fontSize: SIZES.small, color: COLORS.textLight },
  modeRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  modeChip: {
    flex: 1,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { fontSize: SIZES.body, color: COLORS.text, fontWeight: '600' },
  modeTextActive: { color: COLORS.textWhite },
  modeHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 4, marginBottom: SIZES.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowEmoji: { width: 28, alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: SIZES.body, color: COLORS.text },
  rowCount: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.primaryDark },
  missing: { fontSize: SIZES.tiny, color: COLORS.warning, marginBottom: SIZES.sm },
  sorted: { fontSize: SIZES.tiny, color: COLORS.textLight, marginBottom: SIZES.sm, lineHeight: 16 },
  applyBtn: {
    backgroundColor: COLORS.success,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    marginTop: SIZES.sm,
  },
  applyBtnIdle: { backgroundColor: COLORS.textLight },
  applyText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between' },
  planStat: { flex: 1, alignItems: 'center' },
  planStatN: { fontSize: SIZES.h3, fontWeight: '800', color: COLORS.primaryDark },
  planStatLabel: { fontSize: SIZES.tiny, color: COLORS.textLight },
  planHead: { marginTop: SIZES.md, marginBottom: 4, fontSize: SIZES.small, fontWeight: '700', color: COLORS.text },
  planItem: { fontSize: SIZES.small, color: COLORS.text, paddingVertical: 2 },
  planFields: { color: COLORS.textLight },
  planMore: { fontSize: SIZES.small, color: COLORS.primary, fontWeight: '600', paddingVertical: 4 },
  planNote: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 6, lineHeight: 16 },
  removeRow: { flexDirection: 'row', alignItems: 'center', marginTop: SIZES.sm, gap: SIZES.sm },
  removeText: { flex: 1, fontSize: SIZES.body, color: COLORS.text, fontWeight: '600' },
  help: { marginTop: SIZES.lg, color: COLORS.textLight, fontSize: SIZES.body, lineHeight: 20 },
});
