// ===================================
// Watch plan (types/restPlan.ts, plan item 41) — one person's next two weeks.
//
// The standing watch is set once (a pattern, or drawn on the day editor); the
// days that differ — arrival in the night, a drill, a day off — are drawn on
// the same editor in plan mode (RestDaySc `plan`). Every day is checked by the
// rules of the record, with the person's recorded days behind it, so a watch
// bill that will break 10 h / 77 h is red the moment it is written.
//
// Officers and the Master set plans; everyone sees their own watches. Entry:
// Hours of rest → Watch plan, and the Board notice.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle, StatusPill } from '../components/ui';
import { RestBar } from '../components/RestBar';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { crewLabel, isAboard } from '../types/crew';
import { personName, roleAtLeast } from '../types/role';
import { PLAN_DAYS, RestPlan } from '../types/restPlan';
import * as storage from '../services/storage';
import { countWork, presetWork, REST_PRESETS, RULE_LABEL } from '../services/restHours';
import { emptyPlan, forecast, planBreaches, prunePlan } from '../services/restPlan';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { t, tk, useT, dateLocale } from '../utils/i18n';
import { shipToday } from '../utils/shipTime';

export default function RestPlanSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, rest, restPlans, vessel, prefs, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = shipToday();

  const people = useMemo(() => crew.filter(isAboard).sort((a, b) => a.name.localeCompare(b.name)), [crew]);
  const [personId, setPersonId] = useState<string | undefined>(route.params?.crewId);
  useEffect(() => {
    if (personId) return;
    const own = sync.me ? personName(sync.me).trim().toLowerCase() : '';
    const mine = (own && people.find((c) => c.name.trim().toLowerCase() === own)) || people.find((c) => c.id === prefs.lastCrewId) || people[0];
    if (mine) setPersonId(mine.id);
  }, [people, personId, sync.me, prefs.lastCrewId]);
  const person = people.find((c) => c.id === personId);

  const plan = restPlans.find((p) => p.crewId === personId);
  const days = useMemo(() => (personId ? forecast(personId, rest, plan, today, vessel) : []), [personId, rest, plan, today, vessel]);
  const breaches = useMemo(() => new Map(planBreaches(people, rest, restPlans, today, vessel).map((b) => [b.crewId, b])), [people, rest, restPlans, today, vessel]);

  const savePlan = async (next: RestPlan) => {
    if (!person) return;
    const row = prunePlan({ ...next, holderName: person.name, updatedBy: sync.me ? personName(sync.me) : undefined, updatedAt: Date.now() }, today);
    await saveRow(storage.REST_PLANS_KEY, row);
  };
  const base = (): RestPlan => plan ?? emptyPlan(person!, today);
  const setPattern = (work: string) => {
    const p = base();
    void savePlan({ ...p, pattern: work, from: p.pattern ? p.from : today });
  };

  if (!people.length) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'HoursOfRest')} />
        <ScreenTitle title={t('wp.title')} subtitle={t('wp.sub')} help="Hours of rest" />
        <Text style={styles.meta}>{t('hor.nobody')}</Text>
      </Screen>
    );
  }

  const work = plan?.pattern ?? '';
  const ahead = days.filter((d) => d.ahead.length).length;

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'HoursOfRest')} />
      <ScreenTitle title={person ? `${t('wp.title')} · ${person.name}` : t('wp.title')} subtitle={t('wp.sub')} help="Hours of rest" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.chips}>
        {people.map((c) => {
          const on = c.id === personId;
          const bad = breaches.get(c.id);
          return (
            <TouchableOpacity key={c.id} style={[styles.chip, on && styles.chipOn, !!bad && !on && { borderColor: COLORS.danger }]} onPress={() => setPersonId(c.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Text style={[styles.chipText, on && styles.chipTextOn, !!bad && !on && { color: COLORS.danger }]} numberOfLines={1}>
                {bad ? `${crewLabel(c)} ⚠` : crewLabel(c)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Card>
        <Label>{t('wp.standing')}</Label>
        {work ? (
          <>
            <RestBar work={work} height={14} />
            <Text style={styles.meta}>{t('wp.standingSub', { date: uiDate(plan!.from), w: countWork(work) / 2, r: (work.length - countWork(work)) / 2 })}</Text>
          </>
        ) : (
          <Text style={styles.meta}>{t('wp.noStanding')}</Text>
        )}
        {canEdit && person ? (
          <View style={styles.presets}>
            {REST_PRESETS.filter((p) => p.key !== 'off').map((p) => {
              const w = presetWork(p.key);
              return (
                <TouchableOpacity key={p.key} style={[styles.preset, work === w && styles.presetOn]} onPress={() => setPattern(w)}>
                  <Text style={[styles.presetText, work === w && { color: COLORS.textWhite }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.preset} onPress={() => nav.navigate('RestDay', { crewId: person.id, date: 'pattern', plan: true })}>
              <Text style={styles.presetText}>{t('wp.draw')}</Text>
            </TouchableOpacity>
            {work ? (
              <TouchableOpacity style={[styles.preset, { borderColor: COLORS.danger }]} onPress={() => setPattern('')}>
                <Text style={[styles.presetText, { color: COLORS.danger }]}>{t('wp.clear')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </Card>

      <Label>{ahead ? t('wp.aheadN', { n: ahead, days: PLAN_DAYS }) : t('wp.next', { days: PLAN_DAYS })}</Label>
      {days.map((d) => {
        const dt = new Date(`${d.date}T00:00:00Z`);
        const planned = d.source === 'plan' || d.source === 'changed';
        const tap = d.source === 'record' ? { crewId: personId, date: d.date } : canEdit ? { crewId: personId, date: d.date, plan: true } : null;
        return (
          <TouchableOpacity key={d.date} style={[styles.row, d.ahead.length ? { borderLeftColor: COLORS.danger } : null]} activeOpacity={0.7} disabled={!tap} onPress={() => tap && nav.navigate('RestDay', tap)}>
            <View style={styles.dateCol}>
              <Text style={styles.dow}>{dt.toLocaleString(dateLocale(), { weekday: 'short', timeZone: 'UTC' })}</Text>
              <Text style={[styles.dom, d.date === today && { color: COLORS.primary }]}>{d.date.slice(8)}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {d.work ? <RestBar work={d.work} height={12} /> : <Text style={styles.missing}>{canEdit ? t('wp.nothingTap') : t('wp.nothing')}</Text>}
              {d.work ? (
                <Text style={styles.meta}>
                  {[tk(`wp.src.${d.source}`), t('hor.restWork', { r: d.summary.restHours, w: d.summary.workHours }), d.note].filter(Boolean).join(' · ')}
                  {d.summary.violations.length || !d.summary.minRest24h ? '' : ' · ✓'}
                </Text>
              ) : null}
              {d.summary.violations.map((v) => (
                <Text key={v.rule} style={styles.breach} numberOfLines={2}>{`${RULE_LABEL[v.rule]}: ${v.detail}`}</Text>
              ))}
            </View>
            {d.ahead.length ? <StatusPill status="expired" text={t('wp.willBreach')} /> : planned && d.source === 'changed' ? <StatusPill status="due" text={t('wp.src.changed')} /> : null}
          </TouchableOpacity>
        );
      })}
      <Text style={styles.note}>{t('wp.note')}</Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { gap: SIZES.xs, paddingBottom: SIZES.sm, alignItems: 'center' },
    chip: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.sm },
    preset: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    presetOn: { backgroundColor: COLORS.primary },
    presetText: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs, borderLeftWidth: 4, borderLeftColor: 'transparent' },
    dateCol: { width: 36, alignItems: 'center' },
    dow: { fontSize: SIZES.tiny, color: COLORS.textLight },
    dom: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    meta: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 4 },
    missing: { fontSize: SIZES.small, color: COLORS.textLight, fontStyle: 'italic' },
    breach: { fontSize: SIZES.tiny, color: COLORS.danger, fontWeight: '600' },
    note: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: SIZES.md },
  });
