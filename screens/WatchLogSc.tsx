// ===================================
// Engine-room rounds / daily log — entries by day.
// Calendar strip at top: tap a day or use ← → arrows to navigate.
// Each day is one "page"; past rounds live on their date's page.
// The chart button swaps the day for the trends: the last 14 readings of
// every numeric parameter against its normal range.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';
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
import { defaultTemplate, fmtValue, history, num, outOfRange, rangeText } from '../services/watchLog';
import { shareWatchLogPage } from '../services/watchLogReport';
import { PERIOD_SHORT } from '../services/deckLog';
import { uiDate } from '../utils/dates';
import * as storage from '../services/storage';
import { uid } from '../utils/id';
import { t, tk, useT } from '../utils/i18n';

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
  useT();
  const [params, setParams] = useState<WatchParam[]>(template.params);
  const [editingParam, setEditingParam] = useState<WatchParam | null>(null);
  const [draftName, setDraftName] = useState(template.name);

  const addParam = () =>
    setEditingParam({ id: uid(), name: '', unit: '', type: 'number', normalMin: undefined, normalMax: undefined });

  const saveParam = (p: WatchParam) => {
    if (!p.name.trim()) return;
    if (p.type === 'text') { delete p.normalMin; delete p.normalMax; }
    if (p.normalMin === undefined) delete p.normalMin;
    if (p.normalMax === undefined) delete p.normalMax;
    setParams((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      return i >= 0 ? prev.map((x, j) => (j === i ? p : x)) : [...prev, p];
    });
    setEditingParam(null);
  };

  if (editingParam) {
    return (
      <View style={styles.editor}>
        <Text style={styles.editorTitle}>{params.find((x) => x.id === editingParam.id) ? t('wl.editParam') : t('wl.newParam')}</Text>
        <Label>{t('wl.name')}</Label>
        <TextInput style={styles.input} value={editingParam.name}
          onChangeText={(v) => setEditingParam({ ...editingParam, name: v })}
          placeholder={t('wl.namePh')} placeholderTextColor={COLORS.textLight} autoFocus />
        <View style={{ flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm }}>
          {(['number', 'text'] as const).map((k) => (
            <TouchableOpacity key={k} onPress={() => setEditingParam({ ...editingParam, type: k, ...(k === 'text' ? { normalMin: undefined, normalMax: undefined } : {}) })}
              style={[styles.typeBtn, editingParam.type === k && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
              <Text style={[styles.paramUnit, { marginTop: 0 }, editingParam.type === k && { color: COLORS.textWhite, fontWeight: '700' }]}>{k === 'number' ? t('wl.number') : t('wl.text')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Label>{t('wl.unit')}</Label>
        <TextInput style={styles.input} value={editingParam.unit}
          onChangeText={(v) => setEditingParam({ ...editingParam, unit: v })}
          placeholder="°C / bar / rpm / kW / ..." placeholderTextColor={COLORS.textLight} />
        {editingParam.type === 'number' ? <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
          <View style={{ flex: 1 }}>
            <Label>{t('wl.min')}</Label>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="—" placeholderTextColor={COLORS.textLight}
              value={editingParam.normalMin != null ? String(editingParam.normalMin) : ''}
              onChangeText={(v) => setEditingParam({ ...editingParam, normalMin: isNaN(num(v)) ? undefined : num(v) })} />
          </View>
          <View style={{ flex: 1 }}>
            <Label>{t('wl.max')}</Label>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="—" placeholderTextColor={COLORS.textLight}
              value={editingParam.normalMax != null ? String(editingParam.normalMax) : ''}
              onChangeText={(v) => setEditingParam({ ...editingParam, normalMax: isNaN(num(v)) ? undefined : num(v) })} />
          </View>
        </View> : null}
        <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
          <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.primary }]} onPress={() => saveParam(editingParam)}>
            <Text style={styles.btnText}>{t('common.save')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.cardSolid }]} onPress={() => setEditingParam(null)}>
            <Text style={[styles.btnText, { color: COLORS.textDark }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>{t('wl.template')}</Text>
      <Label>{t('wl.templateName')}</Label>
      <TextInput style={styles.input} value={draftName} onChangeText={setDraftName} placeholderTextColor={COLORS.textLight} />
      <Label style={{ marginTop: SIZES.sm }}>{t('wl.params')}</Label>
      {params.map((p) => (
        <View key={p.id} style={styles.paramRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.paramName}>{p.name}</Text>
            <Text style={styles.paramUnit}>{p.unit || (p.type === 'text' ? t('wl.text') : t('wl.number'))}</Text>
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
        <Text style={[styles.paramName, { color: COLORS.primary }]}>{t('wl.addParam')}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md }}>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.primary }]}
          onPress={() => onSave({ ...template, name: draftName || template.name, params, updatedAt: Date.now() })}>
          <Text style={styles.btnText}>{t('wl.saveTemplate')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.cardSolid }]} onPress={onClose}>
          <Text style={[styles.btnText, { color: COLORS.textDark }]}>{t('common.cancel')}</Text>
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
  const off = outOfRange(entry.params, entry.values).length;
  const per = entry.period ? (entry.period === 'other' ? tk('de.per.other') : PERIOD_SHORT[entry.period]) : '';
  return (
    <TouchableOpacity style={styles.entryRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.entryDot, { backgroundColor: off ? COLORS.warning : COLORS.success }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.entryTime}>{entry.time}{per ? `  ·  ${per}` : ''}</Text>
        <Text style={styles.entrySub}>{entry.by}{entry.byRank ? ` · ${entry.byRank}` : ''}</Text>
        {off ? <Text style={[styles.entrySub, { color: COLORS.warning, fontWeight: '700' }]}>{t('wl.offRange', { n: off })}</Text> : null}
        {entry.remarks ? <Text style={styles.entrySub} numberOfLines={1}>{entry.remarks}</Text> : null}
      </View>
      <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

// ─── Trends ──────────────────────────────────────────────────────────────────

const CH_W = 300;
const CH_H = 64;

/** The last readings of one parameter as a line, the normal range shaded, out-of-range points marked. */
function Spark({ param, entries, COLORS, styles }: {
  param: WatchParam;
  entries: WatchEntry[];
  COLORS: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const pts = history(param, entries);
  const last = pts[pts.length - 1];
  const vals = pts.map((r) => r.value);
  const lo = Math.min(...vals, param.normalMin ?? Infinity);
  const hi = Math.max(...vals, param.normalMax ?? -Infinity);
  const span = hi - lo || Math.abs(hi) || 1;
  const pad = 6;
  const x = (i: number) => (pts.length < 2 ? CH_W / 2 : pad + (i * (CH_W - 2 * pad)) / (pts.length - 1));
  const y = (v: number) => pad + (1 - (v - lo) / span) * (CH_H - 2 * pad);
  const off = (v: number) => (param.normalMin != null && v < param.normalMin) || (param.normalMax != null && v > param.normalMax);
  const bandTop = param.normalMax != null ? y(param.normalMax) : pad;
  const bandBot = param.normalMin != null ? y(param.normalMin) : CH_H - pad;
  const range = rangeText(param);
  return (
    <View style={styles.trendCard}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: SIZES.sm }}>
        <Text style={[styles.paramName, { flex: 1 }]} numberOfLines={1}>{param.name}</Text>
        <Text style={[styles.entryTime, last && off(last.value) && { color: COLORS.warning }]}>
          {last ? fmtValue(param, String(last.value)) : '—'}
        </Text>
      </View>
      <Text style={styles.paramUnit}>
        {last ? `${uiDate(last.date)} ${last.time}` : t('wl.noReadings')}{range ? ` · ${t('we.normal', { range })}` : ''}
        {pts.length ? ` · ${t('wl.minMax', { min: Math.min(...vals), max: Math.max(...vals) })}` : ''}
      </Text>
      {pts.length ? (
        <Svg width="100%" height={CH_H} viewBox={`0 0 ${CH_W} ${CH_H}`} preserveAspectRatio="none" style={{ marginTop: 6 }}>
          {range ? <Rect x={0} y={bandTop} width={CH_W} height={Math.max(bandBot - bandTop, 1)} fill={COLORS.success} opacity={0.12} /> : null}
          <Line x1={0} y1={CH_H - 0.5} x2={CH_W} y2={CH_H - 0.5} stroke={COLORS.borderLight} strokeWidth={1} />
          {pts.length > 1 ? (
            <Polyline points={pts.map((r, i) => `${x(i)},${y(r.value)}`).join(' ')} fill="none" stroke={COLORS.primary} strokeWidth={2} />
          ) : null}
          {pts.map((r, i) => (
            <Circle key={i} cx={x(i)} cy={y(r.value)} r={off(r.value) ? 4 : 2.5} fill={off(r.value) ? COLORS.warning : COLORS.primary} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function WatchLogSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { watchTemplates, watchLog, vessel, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';

  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [showTrends, setShowTrends] = useState(false);

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
          <Text style={styles.headerTitle}>{t('wl.title')}</Text>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: SIZES.md, alignItems: 'center' }}>
            {dayEntries.length > 0 && !showTrends && !editingTemplate ? (
              <TouchableOpacity
                hitSlop={8}
                accessibilityLabel={t('wl.share')}
                onPress={() => shareWatchLogPage(dayEntries, selectedDate, vessel).catch((e) => Alert.alert(t('common.error'), e?.message ?? String(e)))}
              >
                <MciIcon name="share-outline" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => { setShowTrends((v) => !v); setEditingTemplate(false); }} hitSlop={8} accessibilityLabel={t('wl.trends')}>
              <MciIcon name="chart-line" size={20} color={showTrends ? COLORS.primary : COLORS.textLight} />
            </TouchableOpacity>
            {canEdit && (
              <TouchableOpacity onPress={() => { setEditingTemplate((v) => !v); setShowTrends(false); }} hitSlop={8} accessibilityLabel={t('wl.template')}>
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

        {showTrends && !editingTemplate && (
          <ScrollView contentContainerStyle={styles.list}>
            <Text style={styles.entrySub}>{t('wl.trendsNote')}</Text>
            {template.params.filter((p) => p.type === 'number').map((p) => (
              <Spark key={p.id} param={p} entries={allEntries} COLORS={COLORS} styles={styles} />
            ))}
          </ScrollView>
        )}

        {!editingTemplate && !showTrends && (
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
                <Text style={styles.emptyTitle}>{t('wl.noneDay')}</Text>
                <TouchableOpacity
                  style={styles.emptyBtn}
                  onPress={() => nav.navigate('WatchEntry', { templateId: template.id })}
                  activeOpacity={0.8}
                >
                  <MciIcon name="plus-circle-outline" size={18} color={COLORS.textWhite} />
                  <Text style={styles.emptyBtnText}>{t('wl.start')}</Text>
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
                    <Text style={styles.addRowText}>{t('wl.start')}</Text>
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
    typeBtn: {
      flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: SIZES.radiusMd,
      borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.cardSolid,
    },
    trendCard: {
      backgroundColor: COLORS.card, borderRadius: 10, padding: SIZES.md,
      borderWidth: 1, borderColor: COLORS.border,
    },
    addParamBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
  });
