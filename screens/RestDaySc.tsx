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
//
// PLAN MODE (`plan: true`, plan item 41): the same editor draws the watch plan
// instead of the record — `date` 'pattern' is the standing watch, a date is a
// day that differs from it. Saved into the person's RestPlan, never into rest;
// the check then runs over the forecast (services/restPlan).
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
import { analyseRest, countWork, dayLabels, fitDay, presetWork, REST_PRESETS, RULE_LABEL } from '../services/restHours';
import { emptyPlan, forecast, plannedWork, prunePlan } from '../services/restPlan';
import { PLAN_DAYS, RestPlan } from '../types/restPlan';
import * as storage from '../services/storage';
import { moduleOn } from '../constants/modules';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, useT, dateLocale } from '../utils/i18n';
import { shipToday } from '../utils/shipTime';

function shiftDay(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return shipToday();
}

const PER_ROW = 12; // 6 hours a row — a day of 25 hours has a fifth, short one

export default function RestDaySc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, rest, saveRestDay, vessel, restPlans, saveRow } = useData();
  const sync = useSync();

  const crewId: string = route.params?.crewId;
  const [date, setDate] = useState<string>(route.params?.date ?? todayIso());
  const person = crew.find((c) => c.id === crewId);

  const planMode = route.params?.plan === true || route.params?.plan === 'true';
  const isPattern = planMode && date === 'pattern';
  const plan = restPlans.find((p) => p.crewId === crewId);
  const today = todayIso();

  const saved = planMode ? undefined : rest.find((d) => d.id === restDayId(crewId, date));
  // What the editor starts from: the record, or in plan mode the plan's day / standing watch.
  const planned = planMode ? (isPattern ? (plan?.pattern ? { work: plan.pattern, note: undefined } : null) : plannedWork(plan, date)) : null;
  const startWork = planMode ? planned?.work : saved?.work;
  const startNote = planMode ? planned?.note : saved?.note;
  // The day's real half hours: 50 the day the clocks go back, 46 when they go forward.
  // The standing watch is any day, so always 48.
  const labels = useMemo(() => (isPattern ? dayLabels(today, null) : dayLabels(date, vessel)), [date, vessel, isPattern, today]);
  const fit = (w?: string) => fitDay(w ?? emptyDay(), labels);
  const [work, setWork] = useState<string>(fit(startWork));
  const [note, setNote] = useState<string>(startNote ?? '');
  const [pen, setPen] = useState<'1' | '0'>('1');
  const dirty = useRef(false);

  // Load the day when the date changes (or when it arrives by sync).
  useEffect(() => {
    if (dirty.current) return;
    setWork(fit(startWork));
    setNote(startNote ?? '');
  }, [startWork, startNote, date, labels]);

  const edit = (w: string) => {
    dirty.current = true;
    setWork(w);
  };

  const setCell = (i: number) => {
    if (work[i] === pen) return;
    edit(work.slice(0, i) + pen + work.slice(i + 1));
  };

  const savePlanDay = async (clear = false) => {
    if (!person) return;
    const p: RestPlan = plan ?? emptyPlan(person, today);
    const next: RestPlan = isPattern
      ? { ...p, pattern: work, from: p.pattern ? p.from : today }
      : { ...p, days: { ...p.days } };
    if (!isPattern) {
      if (clear) delete next.days[date];
      else next.days[date] = note.trim() ? { work, note: note.trim() } : { work };
    }
    await saveRow(storage.REST_PLANS_KEY, prunePlan({ ...next, holderName: person.name, updatedBy: sync.me ? personName(sync.me) : undefined, updatedAt: Date.now() }, today));
    dirty.current = false;
  };

  const save = async () => {
    if (planMode) return savePlanDay();
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
    // A planned day is stored only when it was changed — passing through would
    // otherwise copy the standing watch into every day.
    if (dirty.current || (!planMode && !saved)) await save();
    dirty.current = false;
    setDate(shiftDay(date, n));
  };

  const onSave = async () => {
    await save();
    playSuccessSound();
    goBackOr(nav);
  };

  // The rules, judged with this draft in place of the stored day — in plan mode
  // over the forecast, with the draft in the plan (the standing watch: its first breach).
  const planCheck = useMemo(() => {
    if (!planMode || !person) return null;
    const p: RestPlan = plan ?? emptyPlan(person, today);
    const draft: RestPlan = isPattern ? { ...p, pattern: work, from: p.pattern ? p.from : today } : { ...p, days: { ...p.days, [date]: { work } } };
    const f = forecast(crewId, rest, draft, today, vessel);
    return isPattern ? f.find((d) => d.ahead.length) ?? null : f.find((d) => d.date === date) ?? null;
  }, [planMode, isPattern, plan, person, rest, crewId, date, work, vessel, today]);

  const check = useMemo(() => {
    if (planMode) return planCheck?.summary;
    const others = rest.filter((d) => d.crewId === crewId && d.date !== date);
    const draft: RestDay = { id: restDayId(crewId, date), crewId, holderName: '', date, work, updatedAt: 0 };
    return analyseRest([...others, draft], date, date, vessel)[0];
  }, [planMode, planCheck, rest, crewId, date, work, vessel]);

  const prevRec = isPattern ? undefined : rest.find((d) => d.id === restDayId(crewId, shiftDay(date, -1)));
  const prev = isPattern ? undefined : planMode ? (plannedWork(plan, shiftDay(date, -1)) ?? prevRec) : prevRec;
  // The record's day as the plan had it — one tap for the watchkeeper whose day went as planned.
  const asPlanned = !planMode && moduleOn('restPlan') ? plannedWork(plan, date) : null;
  const workSlots = countWork(work);
  const d = new Date(`${isPattern ? today : date}T00:00:00Z`);
  const isFuture = !planMode && date > todayIso();
  const lastPlanDay = shiftDay(today, PLAN_DAYS - 1);
  const canPrev = !planMode || (!isPattern && date > today);
  const canNext = planMode ? !isPattern && date < lastPlanDay : date < todayIso();

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {planMode ? `${t('wp.title')} · ${person?.name ?? ''}` : person?.name ?? saved?.holderName ?? t('rest.title')}
          </Text>
          <TouchableOpacity onPress={onSave} hitSlop={12}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <View style={styles.dayRow}>
            <TouchableOpacity onPress={() => go(-1)} hitSlop={12} disabled={!canPrev} accessibilityLabel={t('rest.prev')}>
              <MciIcon name="chevron-left" size={30} color={canPrev ? COLORS.primary : COLORS.border} />
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.dayTitle}>
                {isPattern ? t('wp.standing') : d.toLocaleString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
              </Text>
              <Text style={styles.daySub}>{t('rest.daySub', { w: workSlots / 2, r: (labels.length - workSlots) / 2 })}</Text>
              {labels.length !== SLOTS_PER_DAY ? (
                <Text style={[styles.daySub, { color: COLORS.warning, fontWeight: '700' }]}>{t(labels.length > SLOTS_PER_DAY ? 'rest.day25' : 'rest.day23', { h: labels.length / 2 })}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => go(1)} hitSlop={12} disabled={!canNext} accessibilityLabel={t('rest.next')}>
              <MciIcon name="chevron-right" size={30} color={canNext ? COLORS.primary : COLORS.border} />
            </TouchableOpacity>
          </View>

          {isFuture ? <Text style={styles.warn}>{t('rest.future')}</Text> : null}
          {planMode ? (
            <Text style={styles.planNote}>
              {isPattern
                ? t('wp.patternHint')
                : plan?.days?.[date]
                  ? t('wp.dayChanged')
                  : plan?.pattern && date >= plan.from
                    ? t('wp.dayStanding')
                    : t('wp.dayNew')}
            </Text>
          ) : null}

          <View style={styles.pens}>
            {(['1', '0'] as const).map((p) => (
              <TouchableOpacity key={p} style={[styles.pen, pen === p && styles.penOn]} onPress={() => setPen(p)} accessibilityRole="radio" accessibilityState={{ selected: pen === p }}>
                <View style={[styles.swatch, { backgroundColor: p === '1' ? COLORS.primary : 'transparent' }]} />
                <Text style={[styles.penText, pen === p && styles.penTextOn]}>{p === '1' ? t('rest.penWork') : t('rest.penRest')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.grid}>
            {Array.from({ length: Math.ceil(labels.length / PER_ROW) }, (_, r) => {
              const row = labels.slice(r * PER_ROW, (r + 1) * PER_ROW);
              // The second time a wall-clock hour comes round, when the clocks went back.
              const again = (i: number) => labels.indexOf(labels[i]) !== i;
              return (
                <View key={r} style={{ marginBottom: SIZES.sm }}>
                  <View style={[styles.hours, row.length < PER_ROW && { width: `${(row.length / PER_ROW) * 100}%` }]}>
                    {Array.from({ length: Math.ceil(row.length / 2) }, (_, h) => (
                      <Text key={h} style={[styles.hourText, again(r * PER_ROW + h * 2) && { color: COLORS.warning, fontWeight: '800' }]}>{row[h * 2].slice(0, 2)}</Text>
                    ))}
                  </View>
                  <View style={[styles.cells, row.length < PER_ROW && { width: `${(row.length / PER_ROW) * 100}%` }]}>
                    {row.map((label, c) => {
                      const i = r * PER_ROW + c;
                      const isWork = work[i] === '1';
                      return (
                        <TouchableOpacity
                          key={i}
                          onPress={() => setCell(i)}
                          style={[styles.cell, c % 2 === 0 && styles.cellHour, isWork && { backgroundColor: COLORS.primary }]}
                          accessibilityLabel={`${label}${again(i) ? ' (2)' : ''} ${isWork ? t('rest.work') : t('rest.rest')}`}
                        />
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>

          <Label>{t('rest.fill')}</Label>
          <View style={styles.presets}>
            {asPlanned ? (
              <TouchableOpacity style={[styles.preset, styles.presetPlan]} onPress={() => edit(fit(asPlanned.work))}>
                <Text style={[styles.presetText, { color: COLORS.textWhite }]}>{t('wp.asPlanned')}</Text>
              </TouchableOpacity>
            ) : null}
            {prev ? (
              <TouchableOpacity style={styles.preset} onPress={() => edit(fit(prev.work))}>
                <Text style={styles.presetText}>{t('rest.same')}</Text>
              </TouchableOpacity>
            ) : null}
            {REST_PRESETS.map((p) => (
              <TouchableOpacity key={p.key} style={styles.preset} onPress={() => edit(presetWork(p.key, labels))}>
                <Text style={styles.presetText}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.check, check?.violations.length ? styles.checkBad : styles.checkOk]}>
            {isPattern && check?.violations.length ? (
              <Text style={styles.checkBadText}>{t('wp.firstBreach', { date: uiDate(check.date) })}</Text>
            ) : null}
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
          {planMode && !isPattern && plan?.days?.[date] ? (
            <TouchableOpacity
              style={[styles.preset, { alignSelf: 'flex-start', marginTop: SIZES.sm }]}
              onPress={async () => {
                await savePlanDay(true);
                goBackOr(nav);
              }}
            >
              <Text style={styles.presetText}>{plan?.pattern ? t('wp.backToStanding') : t('wp.clearDay')}</Text>
            </TouchableOpacity>
          ) : null}
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
    presetPlan: { backgroundColor: COLORS.primary },
    planNote: { color: COLORS.textLight, textAlign: 'center', marginBottom: SIZES.sm, fontSize: SIZES.small },
    check: { borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md, gap: 4, borderWidth: 1 },
    checkOk: { borderColor: COLORS.success },
    checkBad: { borderColor: COLORS.danger },
    checkOkText: { color: COLORS.success, fontWeight: '700', fontSize: SIZES.small },
    checkBadText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small },
    checkNote: { color: COLORS.textLight, fontSize: SIZES.tiny },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4, minHeight: 60 },
    meta: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: SIZES.sm },
  });
