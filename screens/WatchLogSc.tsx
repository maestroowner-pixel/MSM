// ===================================
// Engine-room rounds / daily log — entries by day.
// Calendar strip at top: tap a day or use ← → arrows to navigate.
// Each day is one "page"; past rounds live on their date's page.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { DayStrip, DateNav, buildDays, todayISO } from '../components/LogDayStrip';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { WatchEntry, WatchParam, WatchTemplate } from '../types/watchLog';
import { defaultTemplate, fmtValue, normalStatus } from '../services/watchLog';
import * as storage from '../services/storage';
import { uid } from '../utils/id';

// ─── Template editor ─────────────────────────────────────────────────────────

function TemplateEditor({
  template, onSave, onClose, COLORS, styles,
}: {
  template: WatchTemplate;
  onSave: (t: WatchTemplate) => void;
  onClose: () => void;
  COLORS: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [params, setParams] = useState<WatchParam[]>(template.params);
  const [editingParam, setEditingParam] = useState<WatchParam | null>(null);
  const [draftName, setDraftName] = useState(template.name);

  const addParam = () =>
    setEditingParam({ id: uid(), name: '', unit: '', type: 'number', normalMin: undefined, normalMax: undefined });

  const saveParam = (p: WatchParam) => {
    if (!p.name.trim()) return;
    setParams((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      return i >= 0 ? prev.map((x, j) => (j === i ? p : x)) : [...prev, p];
    });
    setEditingParam(null);
  };

  if (editingParam) {
    return (
      <View style={styles.editor}>
        <Text style={styles.editorTitle}>{params.find((x) => x.id === editingParam.id) ? 'Edit parameter' : 'New parameter'}</Text>
        <Label>Name</Label>
        <TextInput style={styles.input} value={editingParam.name}
          onChangeText={(v) => setEditingParam({ ...editingParam, name: v })}
          placeholder="e.g. ME Cooling Water Temp In" placeholderTextColor={COLORS.textLight} autoFocus />
        <Label>Unit (leave blank for text)</Label>
        <TextInput style={styles.input} value={editingParam.unit}
          onChangeText={(v) => setEditingParam({ ...editingParam, unit: v })}
          placeholder="°C / bar / rpm / kW / ..." placeholderTextColor={COLORS.textLight} />
        <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
          <View style={{ flex: 1 }}>
            <Label>Normal min</Label>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="—" placeholderTextColor={COLORS.textLight}
              value={editingParam.normalMin != null ? String(editingParam.normalMin) : ''}
              onChangeText={(v) => setEditingParam({ ...editingParam, normalMin: v.trim() ? parseFloat(v) : undefined })} />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Normal max</Label>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="—" placeholderTextColor={COLORS.textLight}
              value={editingParam.normalMax != null ? String(editingParam.normalMax) : ''}
              onChangeText={(v) => setEditingParam({ ...editingParam, normalMax: v.trim() ? parseFloat(v) : undefined })} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
          <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.primary }]} onPress={() => saveParam(editingParam)}>
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.cardSolid }]} onPress={() => setEditingParam(null)}>
            <Text style={[styles.btnText, { color: COLORS.textDark }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>Round template</Text>
      <Label>Template name</Label>
      <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} placeholderTextColor={COLORS.textLight} />
      <Label style={{ marginTop: SIZES.sm }}>Parameters</Label>
      {params.map((p) => (
        <View key={p.id} style={styles.paramRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.paramName}>{p.name}</Text>
            <Text style={styles.paramUnit}>{p.unit || (p.type === 'text' ? 'text' : 'number')}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
            <TouchableOpacity onPress={() => setEditingParam({ ...p })} hitSlop={8}>
              <MciIcon name="pencil-outline" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setParams((prev) => prev.filter((x) => x.id !== p.id))} hitSlop={8}>
              <MciIcon name="minus-circle-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.addParamBtn} onPress={addParam}>
        <MciIcon name="plus-circle-outline" size={18} color={COLORS.primary} />
        <Text style={[styles.paramName, { color: COLORS.primary }]}>Add parameter</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md }}>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.primary }]}
          onPress={() => onSave({ ...template, name: draftName || template.name, params, updatedAt: Date.now() })}>
          <Text style={styles.btnText}>Save template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.cardSolid }]} onPress={onClose}>
          <Text style={[styles.btnText, { color: COLORS.textDark }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({ entry, onPress, COLORS, styles }: {
  entry: WatchEntry;
  onPress: () => void;
  COLORS: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const hasWarn = entry.params.some((p) => normalStatus(p, entry.values[p.id] ?? '') === 'warn');
  return (
    <TouchableOpacity style={styles.entryRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.entryDot, { backgroundColor: hasWarn ? COLORS.warning : COLORS.success }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTime}>{entry.time}</Text>
        <Text style={styles.entrySub}>{entry.by}{entry.byRank ? ` · ${entry.byRank}` : ''}</Text>
      </View>
      <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WatchLogSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { watchTemplates, watchLog, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';

  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [editingTemplate, setEditingTemplate] = useState(false);

  const template = useMemo<WatchTemplate>(
    () => watchTemplates[0] ?? defaultTemplate(),
    [watchTemplates],
  );

  const allEntries = useMemo(() => [...watchLog].sort((a, b) => b.at - a.at), [watchLog]);

  const entryDates = useMemo(() => allEntries.map((e) => e.date), [allEntries]);

  const days = useMemo(() => buildDays(entryDates), [entryDates]);

  const entryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of allEntries) m[e.date] = (m[e.date] ?? 0) + 1;
    return m;
  }, [allEntries]);

  const dayEntries = useMemo(
    () => allEntries.filter((e) => e.date === selectedDate),
    [allEntries, selectedDate],
  );

  const goPrev = () => {
    const i = days.indexOf(selectedDate);
    if (i < days.length - 1) setSelectedDate(days[i + 1]);
  };
  const goNext = () => {
    const i = days.indexOf(selectedDate);
    if (i > 0) setSelectedDate(days[i - 1]);
  };

  const saveTemplate = async (t: WatchTemplate) => {
    await saveRow(storage.WATCH_TEMPLATES_KEY, t);
    setEditingTemplate(false);
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <MciIcon name="engine-outline" size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>Engine Room Log</Text>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: SIZES.sm, alignItems: 'center' }}>
            {canEdit && (
              <TouchableOpacity onPress={() => setEditingTemplate((v) => !v)} hitSlop={8}>
                <MciIcon name="cog-outline" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => nav.navigate('WatchEntry', { templateId: template.id })} hitSlop={8}>
              <MciIcon name="plus" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Template editor (overlay) ── */}
        {editingTemplate && (
          <View style={styles.editorCard}>
            <TemplateEditor
              template={template}
              onSave={saveTemplate}
              onClose={() => setEditingTemplate(false)}
              COLORS={COLORS}
              styles={styles}
            />
          </View>
        )}

        {!editingTemplate && (
          <>
            {/* ── Date nav + picker ── */}
            <DateNav
              selected={selectedDate}
              days={days}
              onPrev={goPrev}
              onNext={goNext}
              onPick={setSelectedDate}
              COLORS={COLORS}
            />

            {/* ── Entries for selected day ── */}
            {dayEntries.length === 0 ? (
              <View style={styles.empty}>
                <MciIcon name="engine-outline" size={44} color={COLORS.textLight} />
                <Text style={styles.emptyTitle}>No rounds for this day</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => nav.navigate('WatchEntry', { templateId: template.id })}
                  activeOpacity={0.8}
                >
                  <MciIcon name="plus-circle-outline" size={18} color={COLORS.textWhite} />
                  <Text style={styles.emptyBtnText}>Start new round</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={dayEntries}
                keyExtractor={(e) => e.id}
                renderItem={({ item }) => (
                  <EntryRow
                    entry={item}
                    onPress={() => nav.navigate('WatchEntry', { entryId: item.id, templateId: item.templateId })}
                    COLORS={COLORS}
                    styles={styles}
                  />
                )}
                contentContainerStyle={styles.list}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                ListFooterComponent={() => (
                  <TouchableOpacity
                    style={styles.addRow}
                    onPress={() => nav.navigate('WatchEntry', { templateId: template.id })}
                    activeOpacity={0.75}
                  >
                    <MciIcon name="plus-circle-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.addRowText}>Start new round</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      paddingHorizontal: SIZES.lg, paddingBottom: SIZES.sm,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
    editorCard: {
      margin: SIZES.md, backgroundColor: COLORS.card,
      borderRadius: SIZES.radiusMd, padding: SIZES.md,
      borderWidth: 1, borderColor: COLORS.border,
    },
    list: { padding: SIZES.md, gap: SIZES.sm, paddingBottom: SIZES.xxxl },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
    empty: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      gap: SIZES.sm, padding: SIZES.xl,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textLight },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.sm, paddingHorizontal: SIZES.lg, marginTop: SIZES.sm,
    },
    emptyBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: 14 },
    entryRow: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      paddingVertical: 12, backgroundColor: COLORS.card,
      borderRadius: 10, paddingHorizontal: SIZES.md,
    },
    entryDot: { width: 10, height: 10, borderRadius: 5 },
    entryTime: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
    entrySub:  { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    addRow: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      paddingVertical: SIZES.md, justifyContent: 'center',
    },
    addRowText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
    // Template editor styles
    editor: { paddingVertical: SIZES.xs },
    editorTitle: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginBottom: SIZES.sm },
    input: {
      borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm, paddingVertical: SIZES.xs,
      fontSize: SIZES.body, color: COLORS.textDark, backgroundColor: COLORS.cardSolid,
      marginTop: 4, marginBottom: SIZES.sm,
    },
    btn: {
      borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    paramRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight,
    },
    paramName: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    paramUnit: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    addParamBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
  });
