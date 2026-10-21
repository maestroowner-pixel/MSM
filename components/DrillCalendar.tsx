// ===================================
// Drills → Calendar: the year's drills, month by month (services/drillPlan.ts,
// 15 Oct 2026).
//
// A grid — each drill a row, the twelve months across — read at a glance:
//   ✓  carried out that month (the SOPEP and ISPS drills too)
//   ●  in the year's plan
//   ◆  planned on a day (a drill record; the day under it)
//   !  in the plan, the month gone, not held
// The officer draws the year up from the schedule, then taps a month to add or
// take a drill away, or to plan the drill itself on a day of that month. The
// year's plan prints for the auditor.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../contexts/ThemeContext';
import { monthName, t as tr, useT } from '../utils/i18n';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { personName, roleAtLeast } from '../types/role';
import { DRILL_TYPES } from '../types/drills';
import { Dropdown } from './Dropdown';
import * as storage from '../services/storage';
import { ScheduleRow, everyLabel } from '../services/drills';
import { Cell, DrillYearPlan, MONTHS, calendarRows, cellOf, dayIn, proposeYear, toggleSlot, yearCounts } from '../services/drillPlan';
import { exportDocPdf } from '../services/hospitalReport';
import { vesselHeader } from '../services/export';
import { formatDate } from '../utils/dates';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';

const NAME_W = 210;
const CELL_W = 46;

export function DrillCalendar({ schedule, today, onSaved }: { schedule: ScheduleRow[]; today: string; onSaved: (w: string | null | void) => void }) {
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { drills, drillPlans, sopepDrills, securityDrills, vessel, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const plan: DrillYearPlan | undefined = drillPlans.find((p) => p.id === String(year));
  const rows = useMemo(() => calendarRows(schedule, plan), [schedule, plan]);
  const ctx = { plan, drills, sopepDrills, securityDrills, today };
  const counts = yearCounts(rows, year, ctx);
  const thisMonth = today.startsWith(String(year)) ? Number(today.slice(5, 7)) : 0;

  const savePlan = async (p: DrillYearPlan) => {
    await saveRow(storage.DRILL_PLANS_KEY, { ...p, ...(sync.me ? { by: personName(sync.me) } : {}) });
  };

  const drawUp = () => {
    const slots = proposeYear(year, schedule, today);
    if (!slots.length) return Alert.alert(tr('dcal.drawYear'), year < Number(today.slice(0, 4)) ? tr('dcal.past') : tr('dcal.noCycle'));
    const go = async () => {
      await savePlan({ id: String(year), slots, updatedAt: Date.now() });
      playSuccessSound();
    };
    if (plan?.slots.length) return Alert.alert(tr('dcal.againQ', { year }), tr('dcal.againBody', { old: plan.slots.length, n: slots.length }), [{ text: tr('common.cancel'), style: 'cancel' }, { text: tr('dcal.replace'), onPress: () => void go() }]);
    void go();
  };

  // Another drill into the year — Man overboard, Blackout — by its own interval.
  const addKind = (type: string) => {
    const t = DRILL_TYPES.find((x) => x.id === type);
    if (!t) return;
    const slots = proposeYear(year, [{ type: t.id, title: t.title, reg: t.reg, everyDays: t.everyDays }], today);
    if (!slots.length) return Alert.alert(t.title, tr('dcal.nothingLeft'));
    const base: DrillYearPlan = plan ?? { id: String(year), slots: [], updatedAt: 0 };
    void savePlan({ ...base, slots: [...base.slots, ...slots], updatedAt: Date.now() });
  };
  const others = DRILL_TYPES.filter((t) => !rows.some((r) => r.kind === t.id));

  const tap = (r: { kind: string; title: string }, month: number, c: Cell) => {
    const done = c.done.find((d) => d.drill)?.drill;
    if (c.state === 'done') return done ? nav.navigate('Drill', { id: done.id }) : Alert.alert(r.title, tr(r.kind === 'oilspill' ? 'dcal.doneSopep' : 'dcal.doneSecurity', { dates: c.done.map((d) => formatDate(d.date)).join(', ') }));
    if (c.scheduled) return nav.navigate('Drill', { id: c.scheduled.id });
    if (!officer) return;
    const base: DrillYearPlan = plan ?? { id: String(year), slots: [], updatedAt: 0 };
    const planIt = () => nav.navigate('Drill', { id: 'new', type: r.kind.startsWith('other:') ? 'other' : r.kind, ...(r.kind.startsWith('other:') ? { title: r.title } : {}), date: dayIn(year, month, today) });
    if (c.inPlan) {
      return Alert.alert(`${r.title} — ${monthName(month - 1)} ${year}`, c.state === 'missed' ? tr('dcal.notHeld') : tr('dcal.inPlan'), [
        { text: tr('dcal.planDay'), onPress: planIt },
        { text: tr('dcal.takeOff'), style: 'destructive', onPress: () => void savePlan(toggleSlot(base, r.kind, r.title, month)) },
        { text: tr('common.cancel'), style: 'cancel' },
      ]);
    }
    void savePlan(toggleSlot(base, r.kind, r.title, month));
  };

  const mark = (c: Cell) =>
    c.state === 'done' ? { t: '✓', bg: COLORS.success, fg: COLORS.textWhite }
    : c.state === 'scheduled' ? { t: `◆${c.scheduled!.date.slice(8, 10)}`, bg: COLORS.primary + '22', fg: COLORS.primary }
    : c.state === 'planned' ? { t: '●', bg: 'transparent', fg: COLORS.primary }
    : c.state === 'missed' ? { t: '!', bg: COLORS.danger + '22', fg: COLORS.danger }
    : { t: '', bg: 'transparent', fg: COLORS.textLight };

  const pdf = () =>
    exportDocPdf({
      title: `Drill plan ${year}`,
      vesselLine: vesselHeader(vessel),
      sections: [
        { title: 'The year', rows: [['Planned', String(counts.planned)], ['Carried out as planned', String(counts.done)], ['Missed', String(counts.missed)], ['Key', '✓ carried out · ● planned · ◆ planned on a day · ! missed']] },
        { title: 'Drills by month', table: { head: ['Drill', 'Interval', ...MONTHS], rows: rows.map((r) => [r.title, r.everyDays ? everyLabel(r.everyDays) : '', ...MONTHS.map((_, i) => { const c = cellOf(r.kind, year, i + 1, ctx); return c.state === 'empty' ? '' : mark(c).t; })]) } },
        { title: 'Approved', signatures: [{ role: 'Master', name: '', detail: '' }, { role: 'Safety officer', name: '', detail: '' }] },
      ],
    }, `Drill plan ${year}`, vessel).then(onSaved, (e) => Alert.alert('Drill plan', String(e?.message ?? e)));

  return (
    <>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs }]}>
        <TouchableOpacity onPress={() => setYear(year - 1)} hitSlop={8} accessibilityLabel={tr('dcal.prevYear')}><Text style={[styles.link, { marginTop: 0, fontSize: 20 }]}>‹</Text></TouchableOpacity>
        <Text style={[styles.name, { fontSize: SIZES.h4 }]}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(year + 1)} hitSlop={8} accessibilityLabel={tr('dcal.nextYear')}><Text style={[styles.link, { marginTop: 0, fontSize: 20 }]}>›</Text></TouchableOpacity>
        <Text style={[styles.sub, { flex: 1, minWidth: 200 }]}>{plan?.slots.length ? tr('dcal.counts', { planned: counts.planned, done: counts.done }) + (counts.missed ? tr('dcal.missedN', { n: counts.missed }) : '') : tr('dcal.noPlan')}</Text>
        {officer ? <TouchableOpacity style={styles.btn} onPress={drawUp}><Text style={styles.btnText}>{plan?.slots.length ? tr('dcal.drawAgain', { year }) : tr('dcal.draw', { year })}</Text></TouchableOpacity> : null}
        <TouchableOpacity style={styles.small} onPress={() => void pdf()}><Text style={styles.smallText}>{tr('dr.planPdf')}</Text></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <View style={{ width: NAME_W }} />
            {MONTHS.map((m, i) => (
              <View key={m} style={{ width: CELL_W, alignItems: 'center', paddingVertical: 4, backgroundColor: thisMonth === i + 1 ? COLORS.primary + '14' : 'transparent' }}>
                <Text style={[styles.sub, { marginTop: 0, fontWeight: '800', color: thisMonth === i + 1 ? COLORS.primary : COLORS.textDark }]}>{monthName(i, 'short')}</Text>
              </View>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.kind} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
              <View style={{ width: NAME_W, paddingVertical: 6, paddingRight: SIZES.sm }}>
                <Text style={[styles.name, { fontSize: SIZES.small }]} numberOfLines={2}>{r.title}</Text>
                {r.everyDays ? <Text style={[styles.sub, { marginTop: 0, fontSize: 11 }]}>{everyLabel(r.everyDays)}</Text> : null}
              </View>
              {MONTHS.map((m, i) => {
                const c = cellOf(r.kind, year, i + 1, ctx);
                const k = mark(c);
                return (
                  <TouchableOpacity
                    key={m}
                    onPress={() => tap(r, i + 1, c)}
                    style={{ width: CELL_W, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: thisMonth === i + 1 ? COLORS.primary + '0D' : 'transparent' }}
                    accessibilityLabel={`${r.title}, ${monthName(i)} ${year}`}
                  >
                    <View style={{ minWidth: 30, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: k.bg, borderWidth: c.state === 'empty' ? 1 : 0, borderColor: COLORS.border }}>
                      <Text style={{ color: k.fg, fontWeight: '800', fontSize: c.state === 'scheduled' ? 11 : 14 }}>{k.t}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      {officer && others.length && year >= Number(today.slice(0, 4)) ? (
        <Dropdown caption={tr('dcal.addTo', { year })} value="" onChange={(v: string) => v && addKind(v)} options={[{ value: '', label: tr('common.choose') }, ...others.map((t) => ({ value: t.id, label: `${t.title} · ${everyLabel(t.everyDays)}` }))]} style={{ marginTop: SIZES.sm, maxWidth: 480 }} />
      ) : null}
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>
        {tr('dcal.key') + (officer ? tr('dcal.keyOfficer') : '')}
      </Text>
    </>
  );
}
