// ===================================
// Hours of rest — one day of one person, half hour by half hour.
//
// Tapping a cell sets it to the current pen (Work or Rest), so a block is
// entered by tapping across it rather than toggled cell by cell — toggling
// turned a slip of the finger into the opposite of what was meant. The
// patterns at the top fill a whole day in one tap; "Same as previous day" covers
// the watchkeeper whose day does not change for weeks.
//
// The rules are checked as the day is edited, against the days around it,
// because a breach is usually made across midnight, not inside one date.
// Moving to the next or previous day saves the one being left.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { personName } from '../types/role';
import { emptyDay, RestDay, restDayId, SLOTS_PER_DAY } from '../types/rest';
import { analyseRest, countWork, presetWork, REST_PRESETS, RULE_LABEL } from '../services/restHours';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, useT, dateLocale } from '../utils/i18n';

function shiftDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ROWS = 4; // 6 hours a row
const PER_ROW = SLOTS_PER_DAY / ROWS;

export default function RestDaySc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, rest, saveRestDay } = useData();
  const sync = useSync();

  const crewId: string = route.params?.crewId;
  const [date, setDate] = useState<string>(route.params?.date ?? todayIso());
  const person = crew.find((c) => c.id === crewId);

  const saved = rest.find((d) => d.id === restDayId(crewId, date));
  const [work, setWork] = useState<string>(saved?.work ?? emptyDay());
  const [note, setNote] = useState<string>(saved?.note ?? '');
  const [pen, setPen] = useState<'1' | '0'>('1');
  const dirty = useRef(false);

  // Load the day when the date changes (or when it arrives by sync).
  useEffect(() => {
    if (dirty.current) return;
    setWork(saved?.work ?? emptyDay());
    setNote(saved?.note ?? '');
  }, [saved?.work, saved?.note, date]);

  const edit = (w: string) => {
    dirty.current = true;
    setWork(w);
  };

  const setCell = (i: number) => {
    if (work[i] === pen) return;
    edit(work.slice(0, i) + pen + work.slice(i + 1));
  };

  const save = async () => {
    if (!person && !saved) return;
    const day: RestDay = {
      id: restDayId(crewId, date),
      crewId,
      holderName: person?.name ?? saved?.holderName ?? '',
      date,
      work,
      note: note.trim() || undefined,
      updatedBy: sync.me ? personName(sync.me) : undefined,
      updatedAt: Date.now(),
    };
    await saveRestDay(day);
    dirty.current = false;
  };

  const go = async (n: number) => {
    if (dirty.current || !saved) await save();
    dirty.current = false;
    setDate(shiftDay(date, n));
  };

  const onSave = async () => {
    await save();
    playSuccessSound();
    goBackOr(nav);
  };

  // The rules, judged with this draft in place of the stored day.
  const check = useMemo(() => {
    const others = rest.filter((d) => d.crewId === crewId && d.date !== date);
    const draft: RestDay = { id: restDayId(crewId, date), crewId, holderName: '', date, work, updatedAt: 0 };
    return analyseRest([...others, draft], date, date)[0];
  }, [rest, crewId, date, work]);

  const prev = rest.find((d) => d.id === restDayId(crewId, shiftDay(date, -1)));
  const workSlots = countWork(work);
  const d = new Date(`${date}T00:00:00Z`);
  const isFuture = date > todayIso();

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {person?.name ?? saved?.holderName ?? t('rest.title')}
          </Text>
          <TouchableOpacity onPress={onSave} hitSlop={12}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <View style={styles.dayRow}>
            <TouchableOpacity onPress={() => go(-1)} hitSlop={12} accessibilityLabel={t('rest.prev')}>
              <MciIcon name="chevron-left" size={30} color={COLORS.primary} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.dayTitle}>
                {d.toLocaleString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
              </Text>
              <Text style={styles.daySub}>{t('rest.daySub', { w: workSlots / 2, r: (SLOTS_PER_DAY - workSlots) / 2 })}</Text>
            </View>
            <TouchableOpacity onPress={() => go(1)} hitSlop={12} disabled={date >= todayIso()} accessibilityLabel={t('rest.next')}>
              <MciIcon name="chevron-right" size={30} color={date >= todayIso() ? COLORS.border : COLORS.primary} />
            </TouchableOpacity>
          </View>

          {isFuture ? <Text style={styles.warn}>{t('rest.future')}</Text> : null}

          <View style={styles.pens}>
            {(['1', '0'] as const).map((p) => (
              <TouchableOpacity key={p} style={[styles.pen, pen === p && styles.penOn]} onPress={() => setPen(p)} accessibilityRole="radio" accessibilityState={{ selected: pen === p }}>
                <View style={[styles.swatch, { backgroundColor: p === '1' ? COLORS.primary : 'transparent' }]} />
                <Text style={[styles.penText, pen === p && styles.penTextOn]}>{p === '1' ? t('rest.penWork') : t('rest.penRest')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: ROWS }, (_, r) => (
              <View key={r} style={{ marginBottom: SIZES.sm }}>
                <View style={styles.hours}>
                  {Array.from({ length: PER_ROW / 2 }, (_, h) => (
                    <Text key={h} style={styles.hourText}>{String(r * 6 + h).padStart(2, '0')}</Text>
                  ))}
                </View>
                <View style={styles.cells}>
                  {Array.from({ length: PER_ROW }, (_, c) => {
                    const i = r * PER_ROW + c;
                    const isWork = work[i] === '1';
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => setCell(i)}
                        style={[styles.cell, c % 2 === 0 && styles.cellHour, isWork && { backgroundColor: COLORS.primary }]}
                        accessibilityLabel={`${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'} ${isWork ? t('rest.work') : t('rest.rest')}`}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>

          <Label>{t('rest.fill')}</Label>
          <View style={styles.presets}>
            {prev ? (
              <TouchableOpacity style={styles.preset} onPress={() => edit(prev.work)}>
                <Text style={styles.presetText}>{t('rest.same')}</Text>
              </TouchableOpacity>
            ) : null}
            {REST_PRESETS.map((p) => (
              <TouchableOpacity key={p.key} style={styles.preset} onPress={() => edit(presetWork(p.key))}>
                <Text style={styles.presetText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.check, check?.violations.length ? styles.checkBad : styles.checkOk]}>
            {check?.violations.length ? (
              check.violations.map((v) => (
                <Text key={v.rule} style={styles.checkBadText}>{`${RULE_LABEL[v.rule]}: ${v.detail}`}</Text>
              ))
            ) : (
              <Text style={styles.checkOkText}>
                {check?.minRest24h != null
                  ? t('rest.okMin', { h: check.minRest24h })
                  : t('rest.ok')}
              </Text>
            )}
            <Text style={styles.checkNote}>{t('rest.checkNote')}</Text>
          </View>

          <Label>{t('rest.note')}</Label>
          <TextInput
            style={styles.input}
            value={note}
            onChangeText={(v) => {
              dirty.current = true;
              setNote(v);
            }}
            placeholder="—"
            placeholderTextColor={COLORS.textLight}
            multiline
          />
          {saved?.updatedBy ? (
            <Text style={styles.meta}>{`${t('rest.lastSaved', { who: saved.updatedBy })} · ${new Date(saved.updatedAt).toLocaleString(dateLocale())}`}</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
    dayTitle: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    daySub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    warn: { color: COLORS.warning, textAlign: 'center', marginBottom: SIZES.sm, fontWeight: '600' },
    pens: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
    pen: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SIZES.sm, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.border },
    penOn: { borderColor: COLORS.primary, borderWidth: 2 },
    penText: { fontSize: SIZES.small, color: COLORS.text, fontWeight: '600' },
    penTextOn: { color: COLORS.primary },
    swatch: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, borderColor: COLORS.primary },
    grid: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.md },
    hours: { flexDirection: 'row' },
    hourText: { flex: 1, fontSize: SIZES.tiny, color: COLORS.textLight },
    cells: { flexDirection: 'row', height: 34 },
    cell: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border },
    cellHour: { borderLeftWidth: 1, borderLeftColor: COLORS.textLight },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.md },
    preset: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    presetText: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '600' },
    check: { borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md, gap: 4, borderWidth: 1 },
    checkOk: { borderColor: COLORS.success },
    checkBad: { borderColor: COLORS.danger },
    checkOkText: { color: COLORS.success, fontWeight: '700', fontSize: SIZES.small },
    checkBadText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small },
    checkNote: { color: COLORS.textLight, fontSize: SIZES.tiny },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4, minHeight: 60 },
    meta: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: SIZES.sm },
  });
