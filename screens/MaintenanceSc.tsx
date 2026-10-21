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
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MonthPicker } from '../components/MonthPicker';
import { exportPmsExcel, exportPmsPdf, monthLabelPms, pmsMonth } from '../services/pmsReport';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle, StatusPill, statusColor } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { categoryColor } from './PmsDefectSc';
import { classPack, machineHistory, openDefects, packMachines } from '../services/pmsHistory';
import { treeOrder } from '../services/pmsMachines';
import { exportPmsHistory } from '../services/pmsHistoryReport';
import { PLAN_LOCKED, plansPms } from '../types/role';
import { planImport } from '../services/pmsImport';
import { exportPlanTemplate, pickPlanSheet } from '../services/pmsTemplate';
import { SIZES, Palette } from '../theme';
import { ComplianceStatus } from '../types/equipment';
import { activeDeferral, dueLabel, jobAfter, jobDue, multiSignable, sortJobsByDue, todayIso, worse , jobsAhead } from '../services/pms';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { playSuccessSound } from '../utils/sound';
import { PmsDone } from '../types/pms';
import { DEPTS, Dept, Machine, PmsJob, deptOf, hasCounter } from '../types/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { t, tk, tn, useT } from '../utils/i18n';

export default function MaintenanceSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { machines, scrappedMachines, pmsJobs, pmsDeferrals, pmsDone, pmsDefects, pmsProjects, vessel, savePlan, completePmsJob } = useData();
  const { signer, picker } = useSigner('SIGNED BY');
  const confirmSign = useSignConfirm();
  /** Several routine jobs of one type signed out at once (services/pms multiSignable). */
  const [multi, setMulti] = useState<{ ids: string[]; note: string } | null>(null);
  const [showScrapped, setShowScrapped] = useState(false);
  const defectsOpen = useMemo(() => openDefects(pmsDefects), [pmsDefects]);
  // What a class surveyor asks for at a periodical survey, in one file — the last 12 months of work.
  const classSurveyPack = async () => {
    try {
      const today = todayIso();
      const since = `${Number(today.slice(0, 4)) - 1}${today.slice(4)}`;
      const w = await exportPmsHistory('Class survey pack', `Class survey pack-${today}`, vessel, classPack(machines, pmsJobs, pmsDone, pmsDeferrals, pmsDefects, today, since));
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('mt2.classPack'), String(e?.message ?? e));
    }
  };
  const surveyPack = async () => {
    try {
      const list = packMachines(machines).map((m) => machineHistory(m, pmsJobs, pmsDone, pmsDeferrals, pmsDefects, todayIso()));
      if (!list.length) return Alert.alert(t('mt2.surveyPack'), t('mt2.noSystems'));
      const w = await exportPmsHistory('Survey pack — maintenance history', `Survey pack-${todayIso()}`, vessel, list);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('mt2.surveyPack'), String(e?.message ?? e));
    }
  };
  const sync = useSync();
  // The plan itself — systems, jobs, intervals, the template — is the Master's
  // or the superintendent's; everyone records the work.
  const canPlan = plansPms(sync.enrolled, sync.role);
  const downloadTemplate = async () => {
    try {
      const w = await exportPlanTemplate(machines, pmsJobs);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('mt2.planTemplate'), String(e?.message ?? e));
    }
  };
  const loadPlan = async () => {
    try {
      const picked = await pickPlanSheet();
      if (!picked) return;
      const r = planImport(picked.rows, machines, pmsJobs, uid);
      if (!r.machines.length && !r.jobs.length) {
        return Alert.alert(t('mt2.loadPlan'), [t('mt2.nothingNew'), ...r.errors.slice(0, 12)].join('\n'));
      }
      const apply = async () => {
        await savePlan(r.machines, r.jobs);
        setSaved(t('mt2.loaded', { s: r.addedSystems.length, a: r.addedJobs, u: r.updatedJobs }));
      };
      Alert.alert(
        t('mt2.loadQ', { file: picked.name }),
        [
          r.addedSystems.length ? `${t('mt2.newSystems', { n: r.addedSystems.length })}: ${r.addedSystems.slice(0, 15).join(', ')}${r.addedSystems.length > 15 ? '…' : ''}.` : null,
          t('mt2.jobsSummary', { a: r.addedJobs, u: r.updatedJobs }),
          r.errors.length ? `${t('mt2.notRead', { n: r.errors.length })}:\n${r.errors.slice(0, 12).join('\n')}${r.errors.length > 12 ? '\n…' : ''}` : null,
        ].filter(Boolean).join('\n\n'),
        [{ text: t('common.cancel'), style: 'cancel' }, { text: t('mt2.load'), onPress: () => void apply() }]
      );
    } catch (e: any) {
      Alert.alert(t('mt2.loadPlan'), String(e?.message ?? e));
    }
  };
  // The month's report: completion %, done, deferred, overdue — PDF / Excel.
  const [repMonth, setRepMonth] = useState(todayIso().slice(0, 7));
  const [saved, setSaved] = useState<string | null>(null);
  const report = useMemo(() => pmsMonth(repMonth, machines, pmsJobs, pmsDone, pmsDeferrals), [repMonth, machines, pmsJobs, pmsDone, pmsDeferrals]);
  const exportReport = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportPmsPdf(report, vessel) : await exportPmsExcel(report, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert('PMS report', String(e?.message ?? e));
    }
  };
  const dueOf = (j: PmsJob, m: Machine | undefined) => jobDue(j, m, today, activeDeferral(j, pmsDeferrals));
  const today = todayIso();
  const [only, setOnly] = useState<Dept | null>(null);
  // Critical / Class: narrow everything below to those machines and jobs.
  const [flag, setFlag] = useState<'critical' | 'class' | null>(null);
  const [ahead, setAhead] = useState<3 | 6 | 12 | null>(null);
  const flagged = (j: PmsJob, m?: Machine) => !flag || (flag === 'critical' ? !!m?.critical : !!(j.classJob || m?.classItem));

  const byId = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const liveJobs = useMemo(
    () => pmsJobs.filter((j) => byId.has(j.machineId) && (!only || deptOf(byId.get(j.machineId)!) === only) && flagged(j, byId.get(j.machineId))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pmsJobs, byId, only, flag]
  );
  const owed = useMemo(
    () => sortJobsByDue(liveJobs, byId, today, pmsDeferrals).filter((j) => {
      const s = dueOf(j, byId.get(j.machineId)).status;
      return s === 'expired' || s === 'due';
    }),
    [liveJobs, byId, today, pmsDeferrals]
  );
  const overdue = owed.filter((j) => dueOf(j, byId.get(j.machineId)).status === 'expired').length;
  const signable = owed.filter((j) => multiSignable(j, byId.get(j.machineId)));
  const multiType = multi?.ids.length ? owed.find((j) => j.id === multi.ids[0])?.type : undefined;
  const pickable = (j: PmsJob) => multiSignable(j, byId.get(j.machineId)) && (!multi?.ids.length || j.type === multiType);
  const toggleMulti = (j: PmsJob) => {
    if (!multi || !pickable(j)) return;
    setMulti({ ...multi, ids: multi.ids.includes(j.id) ? multi.ids.filter((x) => x !== j.id) : [...multi.ids, j.id] });
  };
  const signMulti = async () => {
    if (!multi?.ids.length) return Alert.alert(t('mt2.signTogether'), t('mt2.tickJobs'));
    if (!signer) return Alert.alert(t('mt2.whoDid'), t('round.chooseName'));
    // From all jobs, not the list as filtered now — a filter changed after ticking must not drop one.
    const list = multi.ids.map((id) => pmsJobs.find((j) => j.id === id && !j.deleted)).filter(Boolean) as PmsJob[];
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${list.length} jobs done: ${list.map((j) => j.title).join(', ')}` });
    if (!sig) return;
    const date = todayIso();
    for (const j of list) {
      const m = byId.get(j.machineId);
      const now = Date.now();
      const done: PmsDone = {
        id: uid('done'), jobId: j.id, machineId: j.machineId, jobTitle: j.title, machineName: m?.name ?? '', date,
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(multi.note.trim() ? { note: multi.note.trim() } : {}),
        ...(j.lastDoneDate ? { prevLastDoneDate: j.lastDoneDate } : {}), ...(j.lastDoneHours != null ? { prevLastDoneHours: j.lastDoneHours } : {}),
        at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
      };
      await completePmsJob(done, jobAfter(j, done));
    }
    setMulti(null);
    playSuccessSound();
  };

  const machineRows = useMemo(
    () =>
      machines
        .filter((m) => (!only || deptOf(m) === only) && (!flag || liveJobs.some((j) => j.machineId === m.id) || (flag === 'critical' ? m.critical : m.classItem)))
        .map((m) => {
          const jobs = liveJobs.filter((j) => j.machineId === m.id);
          const worst = jobs.reduce<ComplianceStatus>((w, j) => worse(w, dueOf(j, m).status), 'none');
          return { m, jobs: jobs.length, worst };
        })
        .sort((a, b) => a.m.name.localeCompare(b.m.name)),
    [machines, liveJobs, today, only]
  );
  const present = useMemo(() => new Set(machines.map(deptOf)), [machines]);
  const awaiting = useMemo(() => pmsJobs.filter((j) => j.prepared && !j.deleted && byId.has(j.machineId)).sort((a, b) => a.prepared!.at - b.prepared!.at), [pmsJobs, byId]);

  const addMachine = (dept: Dept = only ?? 'engineering') =>
    nav.navigate('Machine', { id: uid('mach'), isNew: true, dept });

  return (
    <Screen scroll>
      <ScreenTitle title={t('mt2.title')} subtitle={t('mt2.sub')} help="Planned maintenance" />
      <View style={styles.reportRow}>
        <MonthPicker value={repMonth} onChange={setRepMonth} months={[...new Set([...pmsDone.map((d) => d.date.slice(0, 7))])]} />
        <Text style={styles.kpi}>{`${report.completion.all == null ? '—' : `${report.completion.all} %`} done${report.completion.critical != null ? ` · critical ${report.completion.critical} %` : ''}`}</Text>
        <TouchableOpacity style={styles.repBtn} onPress={() => void exportReport('pdf')}><Text style={styles.repBtnText}>{t('mt2.reportPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void exportReport('xlsx')}><Text style={styles.repBtnText}>Excel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void surveyPack()}><Text style={styles.repBtnText}>{t('mt2.surveyPackPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void classSurveyPack()}><Text style={styles.repBtnText}>{t('mt2.classPackPdf')}</Text></TouchableOpacity>
      </View>
      <View style={[styles.reportRow, !canPlan && { opacity: 0.35 }]} pointerEvents={canPlan ? 'auto' : 'none'}>
        <Text style={styles.kpi}>{t('mt2.plan')}</Text>
        <TouchableOpacity style={styles.repBtn} onPress={() => void downloadTemplate()}><Text style={styles.repBtnText}>{t('mt2.templateXls')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.repBtn} onPress={() => void loadPlan()}><Text style={styles.repBtnText}>{t('mt2.loadXls')}</Text></TouchableOpacity>
        {!canPlan ? <Text style={styles.sub}>{PLAN_LOCKED}</Text> : null}
      </View>
      <TouchableOpacity onPress={() => nav.navigate('PmsProjects')} style={{ alignSelf: 'flex-start', marginBottom: SIZES.sm }}>
        <Text style={[styles.repBtnText, { color: COLORS.primary }]}>{`${t('mt2.projects')}${pmsProjects.filter((p) => !p.closedAt).length ? ` (${pmsProjects.filter((p) => !p.closedAt).length})` : ''} ›`}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => nav.navigate('WatchLog')} style={{ alignSelf: 'flex-start', marginBottom: SIZES.sm }}>
        <Text style={[styles.repBtnText, { color: COLORS.primary }]}>{`${t('wl.title')} ›`}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => nav.navigate('DeckLog')} style={{ alignSelf: 'flex-start', marginBottom: SIZES.sm }}>
        <Text style={[styles.repBtnText, { color: COLORS.primary }]}>{`${t('dl.title')} ›`}</Text>
      </TouchableOpacity>
      {saved ? <Text style={{ color: COLORS.success, fontWeight: '700', fontSize: SIZES.small, marginBottom: SIZES.sm }}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <View style={styles.stats}>
          <Stat value={String(overdue)} label={t('mt2.overdue')} color={overdue ? COLORS.danger : COLORS.textDark} />
          <Stat value={String(owed.length - overdue)} label={t('mt2.dueSoon')} color={owed.length - overdue ? COLORS.warning : COLORS.textDark} />
          <Stat value={String(machines.length)} label={t('mt2.systems')} color={COLORS.textDark} />
          <Stat value={String(liveJobs.length)} label={t('mt2.jobs')} color={COLORS.textDark} />
        </View>
      </Card>

      <View style={styles.filters}>
        {(['critical', 'class'] as const).map((k) => (
          <TouchableOpacity key={k} style={[styles.filter, flag === k && styles.filterOn]} onPress={() => setFlag(flag === k ? null : k)}>
            <Text style={[styles.filterText, flag === k && styles.filterTextOn]}>{k === 'critical' ? `⚑ ${t('mt2.critical')}` : t('mt2.class')}</Text>
          </TouchableOpacity>
        ))}
        {[3, 6, 12].map((n) => (
          <TouchableOpacity key={n} style={[styles.filter, ahead === n && styles.filterOn]} onPress={() => setAhead(ahead === n ? null : (n as 3 | 6 | 12))}>
            <Text style={[styles.filterText, ahead === n && styles.filterTextOn]}>{t('mt2.ahead', { n })}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {ahead ? (
        <>
          {jobsAhead(machines, liveJobs, pmsDeferrals, today, ahead).map((g) => (
            <View key={g.month}>
              <Label>{`${monthLabelPms(g.month)} (${g.rows.length})`}</Label>
              {g.rows.map((r) => (
                <TouchableOpacity key={r.job.id} style={styles.row} onPress={() => nav.navigate('PmsJob', { id: r.job.id })} activeOpacity={0.7}>
                  <View style={[styles.bar, { backgroundColor: statusColor(dueOf(r.job, r.machine).status) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{`${r.machine.critical ? '⚑ ' : ''}${r.job.title}`}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{[formatDate(r.date) + (r.estimated ? ' (est. by hours)' : ''), r.machine.name, r.job.classJob || r.machine.classItem ? 'CLASS' : null].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {!jobsAhead(machines, liveJobs, pmsDeferrals, today, ahead).length ? <Text style={styles.sub}>{t('mt2.nothingDue')}</Text> : null}
        </>
      ) : null}

      {present.size > 1 ? (
        <View style={styles.filters}>
          <TouchableOpacity style={[styles.filter, !only && styles.filterOn]} onPress={() => setOnly(null)}>
            <Text style={[styles.filterText, !only && styles.filterTextOn]}>{t('lb.all')}</Text>
          </TouchableOpacity>
          {DEPTS.filter((d) => present.has(d.key)).map((d) => (
            <TouchableOpacity key={d.key} style={[styles.filter, only === d.key && styles.filterOn]} onPress={() => setOnly(only === d.key ? null : d.key)}>
              <Text style={[styles.filterText, only === d.key && styles.filterTextOn]}>{tk(`dept.${d.key}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {defectsOpen.length ? <Label>{t('mt2.openDefects', { n: defectsOpen.length })}</Label> : null}
      {defectsOpen.map((x) => (
        <TouchableOpacity key={x.id} style={styles.row} onPress={() => nav.navigate('PmsDefect', { id: x.id })} activeOpacity={0.7}>
          <View style={[styles.bar, { backgroundColor: categoryColor(COLORS, x.category) }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{x.description}</Text>
            <Text style={styles.sub} numberOfLines={1}>{`${tk(`pms.defcat.${x.category}`)} · ${x.machineName} · ${formatDate(x.date)}`}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {/* Written up by whoever did them, waiting for an officer to sign out (PmsJob.prepared). */}
      {awaiting.length ? <Label>{t('mt2.awaiting', { n: awaiting.length })}</Label> : null}
      {awaiting.map((j) => (
        <TouchableOpacity key={j.id} style={styles.row} onPress={() => nav.navigate('PmsJob', { id: j.id })} activeOpacity={0.7}>
          <View style={[styles.bar, { backgroundColor: COLORS.warning }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{j.title}</Text>
            <Text style={styles.sub} numberOfLines={1}>{`${byId.get(j.machineId)?.name ?? ''} · done ${formatDate(j.prepared!.date)} by ${j.prepared!.by}`}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {owed.length ? (
        <View style={styles.machHead}>
          <Label>{t('mt2.owedNow')}</Label>
          {signable.length > 1 && !multi ? (
            <TouchableOpacity onPress={() => setMulti({ ids: [], note: '' })} hitSlop={8}><Text style={styles.add}>{t('mt2.signSeveral')}</Text></TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {multi ? (
        <Card>
          <Text style={styles.sub}>{t('mt2.multiHint')}</Text>
          <TextInput style={styles.multiNote} value={multi.note} onChangeText={(v) => setMulti({ ...multi, note: v })} placeholder={t('mt2.notePh')} placeholderTextColor={COLORS.textLight} />
          <View style={[styles.reportRow, { marginTop: SIZES.sm, marginBottom: 0 }]}>
            {picker}
            <TouchableOpacity style={styles.repBtn} onPress={() => void signMulti()}><Text style={styles.repBtnText}>{t('mt2.signN', { n: multi.ids.length })}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setMulti(null)}><Text style={styles.add}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}
      {owed.map((j) => {
        const m = byId.get(j.machineId)!;
        const d = dueOf(j, m);
        const ticked = !!multi?.ids.includes(j.id);
        return (
          <TouchableOpacity key={j.id} style={[styles.row, multi && !pickable(j) && !ticked && { opacity: 0.4 }]} onPress={() => (multi ? toggleMulti(j) : nav.navigate('PmsJob', { id: j.id }))} activeOpacity={0.7}>
            {multi ? <Text style={[styles.tick, ticked && styles.tickOn]}>{ticked ? '✓' : ''}</Text> : null}
            <View style={[styles.bar, { backgroundColor: statusColor(d.status) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{`${m.critical ? '⚑ ' : ''}${j.title}`}</Text>
              <Text style={styles.sub} numberOfLines={1}>{[m.critical ? t('pms.crit') : null, m.name, j.type ? tk(`pms.type.${j.type}`) : null, dueLabel(d)].filter(Boolean).join(' · ')}</Text>
            </View>
            <StatusPill status={d.status} />
          </TouchableOpacity>
        );
      })}

      {machineRows.length === 0 && !only ? (
        <Empty text={t('mt2.empty')} />
      ) : null}
      {DEPTS.filter((d) => (only ? d.key === only : true)).map((d) => {
        // Each system followed by its components (services/pmsMachines treeOrder).
        const rows = treeOrder(machineRows.filter((r) => deptOf(r.m) === d.key));
        return (
          <View key={d.key}>
            <View style={styles.machHead}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MciIcon name={d.icon} size={16} color={COLORS.textLight} />
                <Label>{rows.length ? `${tk(`dept.${d.key}`)} (${rows.length})` : tk(`dept.${d.key}`)}</Label>
              </View>
              <TouchableOpacity disabled={!canPlan} style={!canPlan && { opacity: 0.35 }} onPress={() => addMachine(d.key)} hitSlop={10}>
                <Text style={styles.add}>{`+ ${t('common.add')}`}</Text>
              </TouchableOpacity>
            </View>
            {rows.map(({ m, jobs, worst, depth }) => (
              <TouchableOpacity key={m.id} style={[styles.row, depth ? { marginLeft: Math.min(depth, 3) * SIZES.lg } : null]} onPress={() => nav.navigate('Machine', { id: m.id })} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: statusColor(worst) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{`${depth ? '↳ ' : ''}${m.name}`}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[
                      hasCounter(m) ? (m.hours != null ? `${t('hor.hours', { n: m.hours })}${m.hoursDate ? ` ${t('mt2.onDate', { date: formatDate(m.hoursDate) })}` : ''}` : t('mt2.noCounter')) : null,
                      tn('n.job', jobs),
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

      {/* Taken out of service: off the plan, kept for their history (services/pmsMachines.ts). */}
      {scrappedMachines.length ? (
        <TouchableOpacity style={styles.machHead} onPress={() => setShowScrapped((v) => !v)} hitSlop={8}>
          <Label>{t('mt2.scrappedN', { n: scrappedMachines.length })}</Label>
          <Text style={styles.add}>{showScrapped ? t('mt2.hide') : t('mt2.show')}</Text>
        </TouchableOpacity>
      ) : null}
      {showScrapped
        ? [...scrappedMachines].sort((a, b) => (b.scrapped?.date ?? '').localeCompare(a.scrapped?.date ?? '')).map((m) => (
            <TouchableOpacity key={m.id} style={[styles.row, { opacity: 0.75 }]} onPress={() => nav.navigate('Machine', { id: m.id })} activeOpacity={0.7}>
              <View style={[styles.bar, { backgroundColor: COLORS.textLight }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{`${m.name}${m.serial ? ` · S/N ${m.serial}` : ''}`}</Text>
                <Text style={styles.sub} numberOfLines={1}>{`${m.scrapped?.replacedBy ? t('mt2.replaced') : t('mt2.scrapped')} ${formatDate(m.scrapped?.date)} — ${m.scrapped?.reason ?? ''}`}</Text>
              </View>
            </TouchableOpacity>
          ))
        : null}
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
    multiNote: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm },
    tick: { width: 24, height: 24, marginLeft: SIZES.sm, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, textAlign: 'center', color: COLORS.textWhite, fontWeight: '800', overflow: 'hidden' },
    tickOn: { backgroundColor: COLORS.primary },
  });
