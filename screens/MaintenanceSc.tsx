// ===================================
// Maintenance — the planned-maintenance overview.
//
// Two lists, in the order an engineer asks: what is owed (overdue, then due
// soon, across every system), then the systems themselves, by department —
// Engineering, Deck, Safety, Bridge, Interior, AV/IT, Hull — each with its own
// "+ Add", because the plan is the whole vessel's work and not only the engine
// room's (9 Oct 2026). A filter narrows both lists to one department. A job that has never been done has no baseline and is listed
// under its machine, not in "owed" — it cannot be late until it has a start.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MonthPicker } from '../components/MonthPicker';
import { exportPmsExcel, exportPmsPdf, pmsMonth } from '../services/pmsReport';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle, StatusPill, statusColor } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { categoryColor } from './PmsDefectSc';
import { machineHistory, openDefects, packMachines } from '../services/pmsHistory';
import { exportPmsHistory } from '../services/pmsHistoryReport';
import { PLAN_LOCKED, plansPms } from '../types/role';
import { planImport } from '../services/pmsImport';
import { exportPlanTemplate, pickPlanSheet } from '../services/pmsTemplate';
import { SIZES, Palette } from '../theme';
import { ComplianceStatus } from '../types/equipment';
import { activeDeferral, dueText, jobDue, sortJobsByDue, todayIso, worse } from '../services/pms';
import { DEFECT_CATEGORY, DEPTS, Dept, JOB_TYPE, Machine, PmsJob, deptOf, hasCounter } from '../types/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';

export default function MaintenanceSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { machines, pmsJobs, pmsDeferrals, pmsDone, pmsDefects, vessel, savePlan } = useData();
  const defectsOpen = useMemo(() => openDefects(pmsDefects), [pmsDefects]);
  const surveyPack = async () => {
    try {
      const list = packMachines(machines).map((m) => machineHistory(m, pmsJobs, pmsDone, pmsDeferrals, pmsDefects, todayIso()));
      if (!list.length) return Alert.alert('Survey pack', 'No systems in the plan yet.');
      const w = await exportPmsHistory('Survey pack — maintenance history', `Survey pack-${todayIso()}`, vessel, list);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Survey pack', String(e?.message ?? e));
    }
  };
  const sync = useSync();
  // The plan itself — systems, jobs, intervals, the template — is the Master's
  // or the superintendent's; everyone records the work.
  const canPlan = plansPms(sync.enrolled, sync.role);
  const downloadTemplate = async () => {
    try {
      const w = await exportPlanTemplate(machines, pmsJobs);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Plan template', String(e?.message ?? e));
    }
  };
  const loadPlan = async () => {
    try {
      const picked = await pickPlanSheet();
      if (!picked) return;
      const r = planImport(picked.rows, machines, pmsJobs, uid);
      if (!r.machines.length && !r.jobs.length) {
        return Alert.alert('Load the plan', ['Nothing new or changed in the sheet.', ...r.errors.slice(0, 12)].join('\n'));
      }
      const apply = async () => {
        await savePlan(r.machines, r.jobs);
        setSaved(`Plan loaded: ${r.addedSystems.length} systems and ${r.addedJobs} jobs added, ${r.updatedJobs} jobs updated`);
      };
      Alert.alert(
        `Load the plan from “${picked.name}”?`,
        [
          r.addedSystems.length ? `New systems (${r.addedSystems.length}): ${r.addedSystems.slice(0, 15).join(', ')}${r.addedSystems.length > 15 ? '…' : ''}.` : null,
          `Jobs: ${r.addedJobs} new, ${r.updatedJobs} updated. Nothing is removed.`,
          r.errors.length ? `Not read (${r.errors.length}):\n${r.errors.slice(0, 12).join('\n')}${r.errors.length > 12 ? '\n…' : ''}` : null,
        ].filter(Boolean).join('\n\n'),
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Load', onPress: () => void apply() }]
      );
    } catch (e: any) {
      Alert.alert('Load the plan', String(e?.message ?? e));
    }
  };
  // The month's report: completion %, done, deferred, overdue — PDF / Excel.
  const [repMonth, setRepMonth] = useState(todayIso().slice(0, 7));
  const [saved, setSaved] = useState<string | null>(null);
  const report = useMemo(() => pmsMonth(repMonth, machines, pmsJobs, pmsDone, pmsDeferrals), [repMonth, machines, pmsJobs, pmsDone, pmsDeferrals]);
  const exportReport = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportPmsPdf(report, vessel) : await exportPmsExcel(report, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('PMS report', String(e?.message ?? e));
    }
  };
  const dueOf = (j: PmsJob, m: Machine | undefined) => jobDue(j, m, today, activeDeferral(j, pmsDeferrals));
  const today = todayIso();
  const [only, setOnly] = useState<Dept | null>(null);

  const byId = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const liveJobs = useMemo(
    () => pmsJobs.filter((j) => byId.has(j.machineId) && (!only || deptOf(byId.get(j.machineId)!) === only)),
    [pmsJobs, byId, only]
  );
  const owed = useMemo(
    () => sortJobsByDue(liveJobs, byId, today, pmsDeferrals).filter((j) => {
      const s = dueOf(j, byId.get(j.machineId)).status;
      return s === 'expired' || s === 'due';
    }),
    [liveJobs, byId, today, pmsDeferrals]
  );
  const overdue = owed.filter((j) => dueOf(j, byId.get(j.machineId)).status === 'expired').length;

  const machineRows = useMemo(
    () =>
      machines
        .filter((m) => !only || deptOf(m) === only)
        .map((m) => {
          const jobs = liveJobs.filter((j) => j.machineId === m.id);
          const worst = jobs.reduce<ComplianceStatus>((w, j) => worse(w, dueOf(j, m).status), 'none');
          return { m, jobs: jobs.length, worst };
        })
        .sort((a, b) => a.m.name.localeCompare(b.m.name)),
    [machines, liveJobs, today, only]
  );
  const present = useMemo(() => new Set(machines.map(deptOf)), [machines]);

  const addMachine = (dept: Dept = only ?? 'engineering') =>
    nav.navigate('Machine', { id: uid('mach'), isNew: true, dept });

  return (
    <Screen scroll>
      <ScreenTitle title="Maintenance" subtitle="Planned maintenance · every department" help="Planned maintenance" />
      <View style={styles.reportRow}>
        <MonthPicker value={repMonth} onChange={setRepMonth} months={[...new Set([...pmsDone.map((d) => d.date.slice(0, 7))])]} />
        <Text style={styles.kpi}>{`${report.completion.all == null ? '—' : `${report.completion.all} %`} done${report.completion.critical != null ? ` · critical ${report.completion.critical} %` : ''}`}</Text>
        <TouchableOpacity style={styles.repBtn} onPress={() => void exportReport('pdf')}><Text style={styles.repBtnText}>Report PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void exportReport('xlsx')}><Text style={styles.repBtnText}>Excel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void surveyPack()}><Text style={styles.repBtnText}>Survey pack (PDF)</Text></TouchableOpacity>
      </View>
      <View style={[styles.reportRow, !canPlan && { opacity: 0.35 }]} pointerEvents={canPlan ? 'auto' : 'none'}>
        <Text style={styles.kpi}>Plan</Text>
        <TouchableOpacity style={styles.repBtn} onPress={() => void downloadTemplate()}><Text style={styles.repBtnText}>Template (Excel)</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void loadPlan()}><Text style={styles.repBtnText}>Load plan (Excel)</Text></TouchableOpacity>
        {!canPlan ? <Text style={styles.sub}>{PLAN_LOCKED}</Text> : null}
      </View>
      {saved ? <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: SIZES.small, marginBottom: SIZES.sm }}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <View style={styles.stats}>
          <Stat value={String(overdue)} label="Overdue" color={overdue ? COLORS.danger : COLORS.textDark} />
          <Stat value={String(owed.length - overdue)} label="Due soon" color={owed.length - overdue ? COLORS.warning : COLORS.textDark} />
          <Stat value={String(machines.length)} label="Systems" color={COLORS.textDark} />
          <Stat value={String(liveJobs.length)} label="Jobs" color={COLORS.textDark} />
        </View>
      </Card>

      {present.size > 1 ? (
        <View style={styles.filters}>
          <TouchableOpacity style={[styles.filter, !only && styles.filterOn]} onPress={() => setOnly(null)}>
            <Text style={[styles.filterText, !only && styles.filterTextOn]}>All</Text>
          </TouchableOpacity>
          {DEPTS.filter((d) => present.has(d.key)).map((d) => (
            <TouchableOpacity key={d.key} style={[styles.filter, only === d.key && styles.filterOn]} onPress={() => setOnly(only === d.key ? null : d.key)}>
              <Text style={[styles.filterText, only === d.key && styles.filterTextOn]}>{d.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {defectsOpen.length ? <Label>{`Open defects (${defectsOpen.length})`}</Label> : null}
      {defectsOpen.map((x) => (
        <TouchableOpacity key={x.id} style={styles.row} onPress={() => nav.navigate('PmsDefect', { id: x.id })} activeOpacity={0.7}>
          <View style={[styles.bar, { backgroundColor: categoryColor(COLORS, x.category) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{x.description}</Text>
            <Text style={styles.sub} numberOfLines={1}>{`${DEFECT_CATEGORY[x.category]} · ${x.machineName} · ${formatDate(x.date)}`}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {owed.length ? <Label>Owed now</Label> : null}
      {owed.map((j) => {
        const m = byId.get(j.machineId)!;
        const d = dueOf(j, m);
        return (
          <TouchableOpacity key={j.id} style={styles.row} onPress={() => nav.navigate('PmsJob', { id: j.id })} activeOpacity={0.7}>
            <View style={[styles.bar, { backgroundColor: statusColor(d.status) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{`${m.critical ? '⚑ ' : ''}${j.title}`}</Text>
              <Text style={styles.sub} numberOfLines={1}>{[m.critical ? 'CRITICAL' : null, m.name, j.type ? JOB_TYPE[j.type] : null, dueText(d)].filter(Boolean).join(' · ')}</Text>
            </View>
            <StatusPill status={d.status} />
          </TouchableOpacity>
        );
      })}

      {machineRows.length === 0 && !only ? (
        <Empty text="Nothing in the plan yet. Add the vessel's systems by department — engines and generators, the tender and the cranes, the galley, the network, the hull — then their jobs, or start each from the typical jobs." />
      ) : null}
      {DEPTS.filter((d) => (only ? d.key === only : true)).map((d) => {
        const rows = machineRows.filter((r) => deptOf(r.m) === d.key);
        return (
          <View key={d.key}>
            <View style={styles.machHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MciIcon name={d.icon} size={16} color={COLORS.textLight} />
                <Label>{rows.length ? `${d.label} (${rows.length})` : d.label}</Label>
              </View>
              <TouchableOpacity disabled={!canPlan} style={!canPlan && { opacity: 0.35 }} onPress={() => addMachine(d.key)} hitSlop={10}>
                <Text style={styles.add}>+ Add</Text>
              </TouchableOpacity>
            </View>
            {rows.map(({ m, jobs, worst }) => (
              <TouchableOpacity key={m.id} style={styles.row} onPress={() => nav.navigate('Machine', { id: m.id })} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: statusColor(worst) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{m.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[
                      hasCounter(m) ? (m.hours != null ? `${m.hours} h${m.hoursDate ? ` on ${formatDate(m.hoursDate)}` : ''}` : 'No counter reading') : null,
                      `${jobs} job${jobs === 1 ? '' : 's'}`,
                      m.location,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {worst !== 'none' ? <StatusPill status={worst} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const COLORS = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: SIZES.h4, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: SIZES.tiny, color: COLORS.textLight }}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    reportRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
    kpi: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark, marginRight: SIZES.sm },
    repBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 7, paddingHorizontal: SIZES.md },
    repBtnText: { color: COLORS.primary, fontWeight: '800' },
    stats: { flexDirection: 'row', gap: SIZES.sm },
    row: { flexDirection: 'row', alignItems: 'center', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden', gap: SIZES.xs },
    bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.sm },
    title: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    filters: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.md },
    filter: { paddingVertical: 5, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    filterOn: { backgroundColor: COLORS.primary },
    filterText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    filterTextOn: { color: COLORS.textWhite },
    machHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.md },
    add: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
