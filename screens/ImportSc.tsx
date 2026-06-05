// ===================================
// Import — pick the LSA/FFE .xlsx, preview parsed counts, apply.
// ===================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Card } from '../components/ui';
import { COLORS, SIZES, GLASS } from '../theme';
import { parseWorkbookBase64, ImportPreview } from '../services/excelImport';
import { CATEGORY_MAP } from '../constants/categories';
import * as storage from '../services/storage';
import { useData } from '../contexts/DataContext';
import { CategoryKey } from '../types/equipment';
import { playSuccessSound, playErrorSound } from '../utils/sound';

type Mode = 'replace' | 'append';

export default function ImportSc() {
  const nav = useNavigation<any>();
  const { reload } = useData();
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mode, setMode] = useState<Mode>('replace');

  const pick = async () => {
    try {
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

  const apply = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      for (const meta of Object.values(CATEGORY_MAP)) {
        const parsed = preview.byCategory[meta.key] ?? [];
        if (!parsed.length && mode === 'append') continue;
        if (mode === 'replace') {
          await storage.replaceCategory(meta.key as CategoryKey, parsed);
        } else {
          const existing = await storage.loadCategory(meta.key as CategoryKey);
          await storage.replaceCategory(meta.key as CategoryKey, [...existing, ...parsed]);
        }
      }
      await reload();
      playSuccessSound();
      Alert.alert('Import complete', `${preview.total} items imported.`, [
        { text: 'OK', onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Import failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenTitle title="Import from Excel" subtitle="LSA / FFE Inventories workbook (.xlsx)" />

      <TouchableOpacity style={styles.pickBtn} onPress={pick} disabled={busy}>
        <Text style={styles.pickBtnText}>{fileName ? 'Choose a different file' : 'Choose .xlsx file'}</Text>
      </TouchableOpacity>

      {busy ? (
        <View style={{ padding: SIZES.xl, alignItems: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : null}

      {fileName ? <Text style={styles.fileName}>📄 {fileName}</Text> : null}

      {preview ? (
        <>
          <Card>
            <Text style={styles.total}>{preview.total} items found</Text>
            <Text style={styles.totalSub}>across {preview.counts.filter((c) => c.count > 0).length} categories</Text>
          </Card>

          <View style={styles.modeRow}>
            {(['replace', 'append'] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeChip, mode === m && styles.modeChipActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                  {m === 'replace' ? 'Replace all' : 'Append'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modeHint}>
            {mode === 'replace'
              ? 'Existing items in each imported category are overwritten.'
              : 'Parsed items are added to existing ones.'}
          </Text>

          <Card>
            {preview.counts.map((c) => (
              <View key={c.category} style={styles.row}>
                <Text style={styles.rowEmoji}>{CATEGORY_MAP[c.category].emoji}</Text>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Text style={[styles.rowCount, c.count === 0 && { color: COLORS.textLight }]}>{c.count}</Text>
              </View>
            ))}
          </Card>

          {preview.missingSheets.length ? (
            <Text style={styles.missing}>Sheets not found: {preview.missingSheets.join(', ')}</Text>
          ) : null}

          <TouchableOpacity style={styles.applyBtn} onPress={apply} disabled={busy}>
            <Text style={styles.applyText}>Import {preview.total} items</Text>
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.help}>
          Select your “LSA FFE Inventories.xlsx”. Each worksheet maps to an equipment category. Dates are
          converted automatically; you can edit any item afterwards.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pickBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  pickBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  fileName: { marginTop: SIZES.md, color: COLORS.text, fontSize: SIZES.small },
  total: { fontSize: SIZES.h2, fontWeight: '800', color: COLORS.primaryDark },
  totalSub: { fontSize: SIZES.small, color: COLORS.textLight },
  modeRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  modeChip: {
    flex: 1,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  modeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modeText: { fontSize: SIZES.body, color: COLORS.text, fontWeight: '600' },
  modeTextActive: { color: COLORS.textWhite },
  modeHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 4, marginBottom: SIZES.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  rowEmoji: { fontSize: 18, width: 28 },
  rowLabel: { flex: 1, fontSize: SIZES.body, color: COLORS.text },
  rowCount: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.primaryDark },
  missing: { fontSize: SIZES.tiny, color: COLORS.warning, marginBottom: SIZES.sm },
  applyBtn: {
    backgroundColor: COLORS.success,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    marginTop: SIZES.sm,
  },
  applyText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  help: { marginTop: SIZES.lg, color: COLORS.textLight, fontSize: SIZES.body, lineHeight: 20 },
});
