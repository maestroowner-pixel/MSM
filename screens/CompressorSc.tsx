// ===================================
// BA Compressor — running-time counter + maintenance log (FIFI outfit).
// Supports up to MAX_COMPRESSORS units; pick a unit with the selector, or add a
// new one. Each "run" entry adds minutes to that unit's accumulated running
// time; maintenance / service / inspection entries record dated events.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, Card, Label } from '../components/ui';
import { SIZES, Palette, COLORS } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import SimpleDatePicker from '../components/SimpleDatePicker';
import {
  Compressor,
  CompressorEntry,
  CompressorEventType,
  COMPRESSOR_EVENT_META,
  MAX_COMPRESSORS,
} from '../types/compressor';

const TYPE_COLOR: Record<CompressorEventType, string> = {
  run: COLORS.primary,
  maintenance: COLORS.warning,
  service: COLORS.secondary,
  inspection: COLORS.success,
};
const TYPE_ORDER: CompressorEventType[] = ['run', 'maintenance', 'service', 'inspection'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${r}m`;
}

export default function CompressorSc() {
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useS();
  const { compressor, saveCompressor } = useData();
  const compressors = compressor.compressors;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active: Compressor | null =
    compressors.find((c) => c.id === selectedId) ?? compressors[0] ?? null;

  // Keep selectedId pointing at a valid unit.
  useEffect(() => {
    if (active && active.id !== selectedId) setSelectedId(active.id);
  }, [active, selectedId]);

  // ---- form state ----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<CompressorEventType>('run');
  const [date, setDate] = useState<string>(todayISO());
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [note, setNote] = useState('');
  const [showBaseline, setShowBaseline] = useState(false);

  const entries = active?.entries ?? [];
  const baseline = active?.baselineMinutes ?? 0;

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1
      ),
    [entries]
  );

  const cumulative = useMemo(() => {
    const runs = entries
      .filter((e) => e.type === 'run')
      .sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
    const map: Record<string, number> = {};
    let acc = baseline;
    for (const r of runs) {
      acc += r.minutes ?? 0;
      map[r.id] = acc;
    }
    return map;
  }, [entries, baseline]);

  const totalMinutes = baseline + entries.reduce((n, e) => n + (e.type === 'run' ? e.minutes ?? 0 : 0), 0);
  const runCount = entries.filter((e) => e.type === 'run').length;

  // ---- persistence helpers ----
  const persistList = (next: Compressor[]) => saveCompressor({ compressors: next });
  const updateActive = (patch: Partial<Compressor>) => {
    if (!active) return;
    persistList(compressors.map((c) => (c.id === active.id ? { ...c, ...patch } : c)));
  };

  const resetForm = () => {
    setEditingId(null);
    setType('run');
    setDate(todayISO());
    setHours('');
    setMins('');
    setNote('');
  };

  const addCompressor = () => {
    if (compressors.length >= MAX_COMPRESSORS) return;
    const id = uid('cmp');
    const next: Compressor = { id, name: `Compressor ${compressors.length + 1}`, entries: [] };
    persistList([...compressors, next]);
    setSelectedId(id);
    resetForm();
    playSuccessSound();
  };

  const removeCompressor = () => {
    if (!active) return;
    Alert.alert('Delete compressor', `Remove "${active.name}" and its entire log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const next = compressors.filter((c) => c.id !== active.id);
          persistList(next);
          setSelectedId(next[0]?.id ?? null);
          resetForm();
        },
      },
    ]);
  };

  const startEdit = (e: CompressorEntry) => {
    setEditingId(e.id);
    setType(e.type);
    setDate(e.date || todayISO());
    setHours(e.minutes ? String(Math.floor(e.minutes / 60)) : '');
    setMins(e.minutes ? String(e.minutes % 60) : '');
    setNote(e.note ?? '');
  };

  const submit = () => {
    if (!active) return;
    const minutes = (parseInt(hours || '0', 10) || 0) * 60 + (parseInt(mins || '0', 10) || 0);
    if (type === 'run' && minutes <= 0) {
      Alert.alert('Running time needed', 'Enter how long the compressor ran (hours / minutes).');
      return;
    }
    const baseEntry: CompressorEntry = editingId
      ? { ...(entries.find((e) => e.id === editingId) as CompressorEntry) }
      : { id: uid('cmp'), createdAt: Date.now(), date, type };
    const entry: CompressorEntry = {
      ...baseEntry,
      date,
      type,
      minutes: type === 'run' ? minutes : undefined,
      note: note.trim() || undefined,
    };
    const nextEntries = editingId
      ? entries.map((e) => (e.id === editingId ? entry : e))
      : [...entries, entry];
    updateActive({ entries: nextEntries });
    playSuccessSound();
    resetForm();
  };

  const removeEntry = (e: CompressorEntry) => {
    Alert.alert('Delete entry', 'Remove this log entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          updateActive({ entries: entries.filter((x) => x.id !== e.id) });
          if (editingId === e.id) resetForm();
        },
      },
    ]);
  };

  const saveBaseline = (h: string, m: string) => {
    const minutes = (parseInt(h || '0', 10) || 0) * 60 + (parseInt(m || '0', 10) || 0);
    updateActive({ baselineMinutes: minutes });
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
          <Text style={styles.back}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>BA Compressors</Text>
        <View style={{ width: 48 }} />
      </View>

      {/* Unit selector */}
      <View style={styles.selectorRow}>
        {compressors.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.unitChip, active?.id === c.id && styles.unitChipOn]}
            onPress={() => setSelectedId(c.id)}
          >
            <Text style={[styles.unitChipText, active?.id === c.id && styles.unitChipTextOn]} numberOfLines={1}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
        {compressors.length < MAX_COMPRESSORS ? (
          <TouchableOpacity style={styles.addChip} onPress={addCompressor}>
            <Text style={styles.addChipText}>＋ Add compressor</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!active ? (
        <Card>
          <Text style={styles.empty}>
            No compressors yet. Tap “＋ Add compressor” to create one (up to {MAX_COMPRESSORS}).
          </Text>
        </Card>
      ) : (
        <>
          {/* Active unit: name + total */}
          <Card style={styles.totalCard}>
            <View style={styles.nameRow}>
              <TextInput
                style={styles.nameInput}
                value={active.name}
                onChangeText={(t) => updateActive({ name: t })}
                placeholder="Compressor name"
                placeholderTextColor={COLORS.textLight}
              />
              <TouchableOpacity style={styles.unitDel} onPress={removeCompressor} hitSlop={8}>
                <Text style={styles.unitDelText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.totalLabel}>Total running time</Text>
            <Text style={styles.totalValue}>{fmtDuration(totalMinutes)}</Text>
            <Text style={styles.totalSub}>
              {runCount} run{runCount === 1 ? '' : 's'} logged
              {baseline > 0 ? ` · incl. ${fmtDuration(baseline)} initial` : ''}
            </Text>
            <TouchableOpacity onPress={() => setShowBaseline((s) => !s)} hitSlop={8}>
              <Text style={styles.baselineToggle}>{showBaseline ? 'Hide' : 'Adjust starting counter'}</Text>
            </TouchableOpacity>
            {showBaseline ? (
              <View style={styles.baselineRow}>
                <Text style={styles.baselineHint}>Counter before logging started:</Text>
                <View style={styles.hmRow}>
                  <HM
                    value={baseline ? String(Math.floor(baseline / 60)) : ''}
                    placeholder="h"
                    onChange={(t) => saveBaseline(t, String(baseline % 60))}
                  />
                  <Text style={styles.colon}>:</Text>
                  <HM
                    value={baseline ? String(baseline % 60) : ''}
                    placeholder="m"
                    onChange={(t) => saveBaseline(String(Math.floor(baseline / 60)), t)}
                  />
                </View>
              </View>
            ) : null}
          </Card>

          {/* Add / edit entry */}
          <Card>
            <Label>{editingId ? 'Edit entry' : 'Add entry'}</Label>
            <View style={styles.typeRow}>
              {TYPE_ORDER.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, type === t && { backgroundColor: TYPE_COLOR[t], borderColor: TYPE_COLOR[t] }]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeChipText, type === t && styles.typeChipTextOn]}>
                    {COMPRESSOR_EVENT_META[t].emoji} {COMPRESSOR_EVENT_META[t].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <SimpleDatePicker label="Date" value={date} onChange={setDate} />

            {type === 'run' ? (
              <View style={{ marginTop: SIZES.sm }}>
                <Label>Running time</Label>
                <View style={styles.hmRow}>
                  <HM value={hours} placeholder="hours" onChange={setHours} wide />
                  <Text style={styles.colon}>h</Text>
                  <HM value={mins} placeholder="min" onChange={setMins} wide />
                  <Text style={styles.colon}>m</Text>
                </View>
              </View>
            ) : null}

            <View style={{ marginTop: SIZES.sm }}>
              <Label>Note</Label>
              <TextInput
                style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder={type === 'run' ? 'e.g. Charging bottles 2, 6 & 9' : 'e.g. 2nd stage filter changed'}
                placeholderTextColor={COLORS.textLight}
              />
            </View>

            <View style={styles.formBtns}>
              {editingId ? (
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={resetForm}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.primary, flex: 1 }]} onPress={submit}>
                <Text style={styles.btnText}>{editingId ? 'Update entry' : 'Add entry'}</Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Log */}
          <Label style={{ marginBottom: SIZES.sm }}>Log ({entries.length})</Label>
          {sorted.length === 0 ? (
            <Card>
              <Text style={styles.empty}>No entries yet. Log a compressor run or a maintenance event above.</Text>
            </Card>
          ) : (
            sorted.map((e) => {
              const meta = COMPRESSOR_EVENT_META[e.type];
              return (
                <TouchableOpacity
                  key={e.id}
                  activeOpacity={0.75}
                  onPress={() => startEdit(e)}
                  style={[styles.entry, editingId === e.id && styles.entryEditing]}
                >
                  <View style={[styles.entryBar, { backgroundColor: TYPE_COLOR[e.type] }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.entryTop}>
                      <Text style={styles.entryDate}>{formatDate(e.date)}</Text>
                      {e.type === 'run' ? (
                        <Text style={[styles.entryDur, { color: TYPE_COLOR.run }]}>{fmtDuration(e.minutes ?? 0)}</Text>
                      ) : (
                        <Text style={[styles.entryTag, { color: TYPE_COLOR[e.type] }]}>
                          {meta.emoji} {meta.label}
                        </Text>
                      )}
                    </View>
                    {e.note ? <Text style={styles.entryNote}>{e.note}</Text> : null}
                    {e.type === 'run' && cumulative[e.id] != null ? (
                      <Text style={styles.entryCumulative}>Σ {fmtDuration(cumulative[e.id])} total</Text>
                    ) : null}
                  </View>
                  <TouchableOpacity style={styles.entryDel} onPress={() => removeEntry(e)} hitSlop={8}>
                    <Text style={styles.entryDelText}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })
          )}
        </>
      )}
    </Screen>
  );
}

function HM({
  value,
  placeholder,
  onChange,
  wide,
}: {
  value: string;
  placeholder: string;
  onChange: (t: string) => void;
  wide?: boolean;
}) {
  const COLORS = useTheme();
  const styles = useS();
  return (
    <TextInput
      style={[styles.input, styles.hm, wide && { width: 84 }]}
      value={value}
      onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ''))}
      keyboardType="number-pad"
      placeholder={placeholder}
      placeholderTextColor={COLORS.textLight}
    />
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
  back: { fontSize: SIZES.h5, color: COLORS.primary, fontWeight: '600', width: 48 },
  headerTitle: { fontSize: SIZES.h4, fontWeight: '700', color: COLORS.textDark },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.md },
  unitChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 7,
    borderRadius: SIZES.radiusRound,
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxWidth: 160,
  },
  unitChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  unitChipText: { fontSize: SIZES.small, color: COLORS.text, fontWeight: '600' },
  unitChipTextOn: { color: COLORS.textWhite },
  addChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 7,
    borderRadius: SIZES.radiusRound,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
  },
  addChipText: { fontSize: SIZES.small, color: COLORS.primary, fontWeight: '700' },
  totalCard: { alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: SIZES.sm, marginBottom: SIZES.sm },
  nameInput: {
    ...COLORS.glassInput,
    flex: 1,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.h5,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  unitDel: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitDelText: { color: COLORS.danger, fontSize: 14, fontWeight: '800' },
  totalLabel: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '600' },
  totalValue: { fontSize: 40, fontWeight: '800', color: COLORS.primaryDark, marginVertical: 2 },
  totalSub: { fontSize: SIZES.small, color: COLORS.textLight },
  baselineToggle: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '700', marginTop: SIZES.sm },
  baselineRow: { width: '100%', marginTop: SIZES.sm, alignItems: 'center' },
  baselineHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginBottom: 4 },
  input: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginTop: 4,
  },
  hmRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  hm: { width: 60, textAlign: 'center' },
  colon: { fontSize: SIZES.body, color: COLORS.textLight, fontWeight: '700', marginHorizontal: 2 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.sm, marginBottom: SIZES.xs },
  typeChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: SIZES.radiusRound,
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipText: { fontSize: SIZES.small, color: COLORS.text, fontWeight: '600' },
  typeChipTextOn: { color: COLORS.textWhite },
  formBtns: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
  btn: { paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, alignItems: 'center' },
  btnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  btnGhost: { paddingHorizontal: SIZES.lg, borderWidth: 1, borderColor: COLORS.border },
  btnGhostText: { color: COLORS.text, fontWeight: '600', fontSize: SIZES.body },
  empty: { fontSize: SIZES.body, color: COLORS.textLight, lineHeight: 20 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.sm,
    paddingRight: SIZES.sm,
    paddingLeft: 0,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  entryEditing: { borderWidth: 1.5, borderColor: COLORS.primary },
  entryBar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
  entryDur: { fontSize: SIZES.body, fontWeight: '800' },
  entryTag: { fontSize: SIZES.small, fontWeight: '700' },
  entryNote: { fontSize: SIZES.small, color: COLORS.text, marginTop: 2 },
  entryCumulative: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2 },
  entryDel: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SIZES.xs,
  },
  entryDelText: { color: COLORS.textWhite, fontSize: 12, fontWeight: '800' },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
