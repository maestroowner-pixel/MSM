// ===================================
// Drills — the schedule and the drills themselves (types/drills.ts).
//
// Schedule: every drill SOLAS / ISPS / MARPOL requires, and every other kind
// the vessel has held — when it was last held, when it is next due, overdue in
// red. Tap one to plan it (or open the plan already made).
// Drills: planned and in progress first, then carried out, newest first; each
// opens on its own screen (DrillSc). The register prints both.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { DRILL_TYPES, drillTitle } from '../types/drills';
import { todayIso } from '../services/pms';
import { DRILL_STATE_LABEL, archive, archiveKinds, archiveYears, byMonth, drillSchedule, drillState, everyLabel, minutesBetween, sortDrills } from '../services/drills';
import { exportDrillRegisterExcel, exportDrillRegisterPdf } from '../services/drillReport';
import { formatDate } from '../utils/dates';
import { DrillCalendar } from '../components/DrillCalendar';
import { makeStyles } from './SafetySc';
import { t, useT } from '../utils/i18n';

export default function DrillsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { drills, sopepDrills, securityDrills, vessel } = useData();
  const sync = useSync();
  const canPlan = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();

  type Tab = 'schedule' | 'calendar' | 'planned' | 'archive';
  const [tab, setTab] = useState<Tab>((['archive', 'planned', 'calendar'] as Tab[]).find((t) => t === route.params?.view) ?? 'schedule');
  // The menu's Drill calendar / Drills & schedule entries switch the page of an open screen too.
  React.useEffect(() => {
    const v = route.params?.view;
    if (v === 'calendar' || v === 'archive' || v === 'planned') setTab(v);
    else if (v === 'list') setTab('schedule');
  }, [route.params?.view]);
  const years = useMemo(() => archiveYears(drills), [drills]);
  const [year, setYear] = useState<string>(() => String(new Date().getFullYear()));
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const yearShown = years.includes(year) || !year ? year : years[0] ?? '';
  const kinds = useMemo(() => archiveKinds(drills, yearShown), [drills, yearShown]);
  const found = useMemo(() => archive(drills, { year: yearShown, kind, q }), [drills, yearShown, kind, q]);
  const [choosing, setChoosing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const schedule = useMemo(() => drillSchedule(drills, today, sopepDrills, securityDrills), [drills, today, sopepDrills, securityDrills]);
  const list = useMemo(() => sortDrills(drills).filter((d) => !d.doneAt), [drills]);
  const doneCount = drills.filter((d) => d.doneAt).length;
  const overdue = schedule.filter((r) => (r.left ?? -1) < 0).length;
  const open = drills.filter((d) => !d.doneAt).length;

  const plan = (type: string, title?: string) => {
    setChoosing(false);
    nav.navigate('Drill', { id: 'new', type, ...(title ? { title } : {}) });
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      // From the archive: what it shows (year, drill, search).
      const which = tab === 'archive' ? found : drills;
      const w = kind === 'pdf' ? await exportDrillRegisterPdf(which, schedule, today, vessel) : await exportDrillRegisterExcel(which, schedule, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('drills.register'), String(e?.message ?? e));
    }
  };

  const dueColor = (left?: number, every = 1) => (!every ? COLORS.textLight : left == null || left < 0 ? COLORS.danger : left <= 7 ? COLORS.warning : COLORS.success);

  return (
    <Screen scroll>
      <ScreenTitle title={t('drills.title')} subtitle={t('drills.sub')} help="Drills" />
      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, tab === 'schedule' && styles.chipOn]} onPress={() => setTab('schedule')}>
          <Text style={[styles.chipText, tab === 'schedule' && styles.chipTextOn]}>{`${t('drills.schedule')}${overdue ? ` · ${t('drills.due', { n: overdue })}` : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, tab === 'calendar' && styles.chipOn]} onPress={() => setTab('calendar')}>
          <Text style={[styles.chipText, tab === 'calendar' && styles.chipTextOn]}>{t('drills.calendar')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, tab === 'planned' && styles.chipOn]} onPress={() => setTab('planned')}>
          <Text style={[styles.chipText, tab === 'planned' && styles.chipTextOn]}>{t('drills.plannedN', { n: open })}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, tab === 'archive' && styles.chipOn]} onPress={() => setTab('archive')}>
          <Text style={[styles.chipText, tab === 'archive' && styles.chipTextOn]}>{t('drills.archiveN', { n: doneCount })}</Text>
        </TouchableOpacity>
      </View>

      {canPlan ? (
        choosing ? (
          <Card>
            <Label>{t('drills.which')}</Label>
            <View style={styles.chips}>
              {DRILL_TYPES.map((t) => (
                <TouchableOpacity key={t.id} style={styles.chip} onPress={() => plan(t.id)}>
                  <Text style={styles.chipText}>{t.title}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.chip} onPress={() => plan('other')}>
                <Text style={styles.chipText}>{t('drills.other')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setChoosing(false)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </Card>
        ) : (
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => setChoosing(true)}>
            <Text style={styles.btnText}>{t('drills.plan')}</Text>
          </TouchableOpacity>
        )
      ) : null}

      {tab === 'calendar' ? (
        <DrillCalendar schedule={schedule} today={today} onSaved={(w) => typeof w === 'string' && setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }))} />
      ) : tab === 'schedule' ? (
        <>
          {schedule.map((r) => (
            <TouchableOpacity key={r.type} style={[styles.item, { borderLeftColor: dueColor(r.left, r.everyDays) }]} activeOpacity={0.7}
              onPress={() => (r.planned ? nav.navigate('Drill', { id: r.planned.id }) : canPlan ? (r.own ? plan('other', r.own.title) : plan(r.type)) : undefined)}>
              <Text style={styles.name}>{r.title}</Text>
              <Text style={styles.sub}>{`${r.reg} · ${everyLabel(r.everyDays)}`}</Text>
              <Text style={[styles.sub, { color: dueColor(r.left, r.everyDays), fontWeight: '700' }]}>
                {r.last ? `${t('drills.last', { date: formatDate(r.last) })}${r.due ? ` · ${(r.left ?? 0) < 0 ? t('drills.overdueSince', { date: formatDate(r.due) }) : t('drills.nextBy', { date: formatDate(r.due) })}` : ''}` : r.everyDays ? t('drills.neverDue') : t('drills.notYet')}
              </Text>
              {r.planned ? <Text style={[styles.sub, { color: COLORS.primary }]}>{`${t('drills.planned', { date: `${formatDate(r.planned.date)}${r.planned.time ? ` ${r.planned.time}` : ''}` })} · ${r.planned.no}`}</Text> : canPlan ? <Text style={styles.link}>{t('drills.planIt')}</Text> : null}
            </TouchableOpacity>
          ))}
          <Text style={styles.sub}>{t('drills.otherNote')}</Text>
        </>
      ) : tab === 'archive' ? (
        <>
          <View style={styles.chips}>
            {years.map((y) => (
              <TouchableOpacity key={y} style={[styles.chip, yearShown === y && styles.chipOn]} onPress={() => { setYear(y); setKind(''); }}>
                <Text style={[styles.chipText, yearShown === y && styles.chipTextOn]}>{y}</Text>
              </TouchableOpacity>
            ))}
            {years.length > 1 ? (
              <TouchableOpacity style={[styles.chip, !yearShown && styles.chipOn]} onPress={() => { setYear(''); setKind(''); }}>
                <Text style={[styles.chipText, !yearShown && styles.chipTextOn]}>{t('drills.allYears')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {kinds.length > 1 ? (
            <View style={styles.chips}>
              <TouchableOpacity style={[styles.chip, !kind && styles.chipOn]} onPress={() => setKind('')}>
                <Text style={[styles.chipText, !kind && styles.chipTextOn]}>{t('drills.allDrills')}</Text>
              </TouchableOpacity>
              {kinds.map((k) => (
                <TouchableOpacity key={k.kind} style={[styles.chip, kind === k.kind && styles.chipOn]} onPress={() => setKind(kind === k.kind ? '' : k.kind)}>
                  <Text style={[styles.chipText, kind === k.kind && styles.chipTextOn]}>{`${k.title} · ${k.n}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {doneCount ? <TextInput style={[styles.input, { marginTop: 0, marginBottom: SIZES.sm }]} value={q} onChangeText={setQ} placeholder={t('drills.searchPh')} placeholderTextColor={COLORS.textLight} /> : null}
          {byMonth(found).map((g) => (
            <View key={g.month}>
              <Text style={[styles.sub, { fontWeight: '800', marginTop: SIZES.sm, marginBottom: 4 }]}>{`${g.month} · ${g.drills.length}`}</Text>
              {g.drills.map((d) => {
                const len = minutesBetween(d.time, d.endTime);
                const signed = d.attendance.filter((a) => a.signedAt).length;
                const present = d.attendance.filter((a) => a.present).length;
                return (
                  <TouchableOpacity key={d.id} style={[styles.item, { borderLeftColor: COLORS.success }]} onPress={() => nav.navigate('Drill', { id: d.id })} activeOpacity={0.7}>
                    <Text style={styles.name}>{`${d.no} · ${drillTitle(d)}`}</Text>
                    <Text style={styles.sub}>{[d.topic, `${formatDate(d.date)}${d.time ? ` ${d.time}` : ''}`, len != null ? t('common.min', { n: len }) : null, d.location].filter(Boolean).join(' · ')}</Text>
                    <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{[`${present}/${d.attendance.length} present`, signed ? `${signed} signed the list` : null, d.doneBy].filter(Boolean).join(' · ')}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          {!found.length ? <Text style={styles.sub}>{doneCount ? t('common.nothingFound') : t('drills.noneDone')}</Text> : null}
        </>
      ) : (
        <>
          {list.map((d) => {
            const st = drillState(d);
            const color = st === 'done' ? COLORS.success : d.date < today ? COLORS.danger : COLORS.primary;
            const len = minutesBetween(d.time, d.endTime);
            return (
              <TouchableOpacity key={d.id} style={[styles.item, { borderLeftColor: color }]} onPress={() => nav.navigate('Drill', { id: d.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${d.no} · ${d.topic || drillTitle(d)}`}</Text>
                <Text style={styles.sub}>{[drillTitle(d), `${formatDate(d.date)}${d.time ? ` ${d.time}` : ''}`, len != null ? t('common.min', { n: len }) : null, d.location].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.sub, { color, fontWeight: '700' }]}>
                  {[DRILL_STATE_LABEL[st], st === 'done' ? t('drills.present', { k: d.attendance.filter((a) => a.present).length, n: d.attendance.length }) : t('drills.steps', { n: d.scenario.length }), st === 'done' ? d.doneBy : null].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!list.length ? <Text style={styles.sub}>{t('drills.nonePlanned')}</Text> : null}
        </>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void report('pdf')}><Text style={styles.btnText}>{t('drills.registerPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void report('xlsx')}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
      </View>
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}
    </Screen>
  );
}
