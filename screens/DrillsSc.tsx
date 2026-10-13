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
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { DRILL_TYPES, drillTypeTitle } from '../types/drills';
import { todayIso } from '../services/pms';
import { DRILL_STATE_LABEL, drillSchedule, drillState, everyLabel, minutesBetween, sortDrills } from '../services/drills';
import { exportDrillRegisterExcel, exportDrillRegisterPdf } from '../services/drillReport';
import { formatDate } from '../utils/dates';
import { makeStyles } from './SafetySc';

export default function DrillsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { drills, sopepDrills, securityDrills, vessel } = useData();
  const sync = useSync();
  const canPlan = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();

  const [tab, setTab] = useState<'schedule' | 'drills'>(route.params?.view === 'drills' ? 'drills' : 'schedule');
  const [choosing, setChoosing] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const schedule = useMemo(() => drillSchedule(drills, today, sopepDrills, securityDrills), [drills, today, sopepDrills, securityDrills]);
  const list = useMemo(() => sortDrills(drills), [drills]);
  const overdue = schedule.filter((r) => (r.left ?? -1) < 0).length;
  const open = drills.filter((d) => !d.doneAt).length;

  const plan = (type: string) => {
    setChoosing(false);
    nav.navigate('Drill', { id: 'new', type });
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportDrillRegisterPdf(drills, schedule, today, vessel) : await exportDrillRegisterExcel(drills, schedule, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Drill register', String(e?.message ?? e));
    }
  };

  const dueColor = (left?: number) => (left == null || left < 0 ? COLORS.danger : left <= 7 ? COLORS.warning : COLORS.success);

  return (
    <Screen scroll>
      <ScreenTitle title="Drills" subtitle="Schedule, scenario minute by minute, attendance and the drill report" help="Drills" />
      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, tab === 'schedule' && styles.chipOn]} onPress={() => setTab('schedule')}>
          <Text style={[styles.chipText, tab === 'schedule' && styles.chipTextOn]}>{`Schedule${overdue ? ` · ${overdue} due` : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, tab === 'drills' && styles.chipOn]} onPress={() => setTab('drills')}>
          <Text style={[styles.chipText, tab === 'drills' && styles.chipTextOn]}>{`Drills · ${drills.length}${open ? ` (${open} planned)` : ''}`}</Text>
        </TouchableOpacity>
      </View>

      {canPlan ? (
        choosing ? (
          <Card>
            <Label>Which drill?</Label>
            <View style={styles.chips}>
              {DRILL_TYPES.map((t) => (
                <TouchableOpacity key={t.id} style={styles.chip} onPress={() => plan(t.id)}>
                  <Text style={styles.chipText}>{t.title}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.chip} onPress={() => plan('other')}>
                <Text style={styles.chipText}>Other…</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setChoosing(false)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </Card>
        ) : (
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => setChoosing(true)}>
            <Text style={styles.btnText}>+ Plan a drill</Text>
          </TouchableOpacity>
        )
      ) : null}

      {tab === 'schedule' ? (
        <>
          {schedule.map((r) => (
            <TouchableOpacity key={r.type} style={[styles.item, { borderLeftColor: dueColor(r.left) }]} activeOpacity={0.7}
              onPress={() => (r.planned ? nav.navigate('Drill', { id: r.planned.id }) : canPlan ? plan(r.type) : undefined)}>
              <Text style={styles.name}>{r.title}</Text>
              <Text style={styles.sub}>{`${r.reg} · ${everyLabel(r.everyDays)}`}</Text>
              <Text style={[styles.sub, { color: dueColor(r.left), fontWeight: '700' }]}>
                {r.last ? `Last ${formatDate(r.last)} · ${(r.left ?? 0) < 0 ? `overdue since ${formatDate(r.due)}` : `next by ${formatDate(r.due)}`}` : 'Never held — due now'}
              </Text>
              {r.planned ? <Text style={[styles.sub, { color: COLORS.primary }]}>{`Planned ${formatDate(r.planned.date)}${r.planned.time ? ` ${r.planned.time}` : ''} · ${r.planned.no}`}</Text> : canPlan ? <Text style={styles.link}>Plan it →</Text> : null}
            </TouchableOpacity>
          ))}
          <Text style={styles.sub}>Other drills join the schedule once held. Oil-spill and security drills recorded on the SOPEP and Security screens count too.</Text>
        </>
      ) : (
        <>
          {list.map((d) => {
            const st = drillState(d);
            const color = st === 'done' ? COLORS.success : d.date < today ? COLORS.danger : COLORS.primary;
            const len = minutesBetween(d.time, d.endTime);
            return (
              <TouchableOpacity key={d.id} style={[styles.item, { borderLeftColor: color }]} onPress={() => nav.navigate('Drill', { id: d.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${d.no} · ${d.topic || drillTypeTitle(d.type)}`}</Text>
                <Text style={styles.sub}>{[drillTypeTitle(d.type), `${formatDate(d.date)}${d.time ? ` ${d.time}` : ''}`, len != null ? `${len} min` : null, d.location].filter(Boolean).join(' · ')}</Text>
                <Text style={[styles.sub, { color, fontWeight: '700' }]}>
                  {[DRILL_STATE_LABEL[st], st === 'done' ? `${d.attendance.filter((a) => a.present).length}/${d.attendance.length} present` : `${d.scenario.length} steps`, st === 'done' ? d.doneBy : null].filter(Boolean).join(' · ')}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!list.length ? <Text style={styles.sub}>No drills yet. Plan one — pick the drill, write the scenario minute by minute, and on the day mark who is there.</Text> : null}
        </>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void report('pdf')}><Text style={styles.btnText}>Drill register (PDF)</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void report('xlsx')}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
      </View>
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}
    </Screen>
  );
}
