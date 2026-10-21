// ===================================
// One machine — its details, its counter, its jobs and their history.
//
// The counter reading is entered on its own, with its date, and saved straight
// away: it is the thing an engineer updates every day or every watch, and it
// should not wait behind an edit of the maker's name. A reading lower than the
// last one is refused — a counter only goes back when it is replaced, and that
// is a new machine record, not a correction.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label, StatusPill, statusColor } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { PLAN_LOCKED, personName, plansPms } from '../types/role';
import { useSync } from '../contexts/SyncContext';
import { useAmend } from '../components/Amend';
import { current, live } from '../services/versions';
import * as storage from '../services/storage';
import { EvidencePhoto } from '../components/EvidencePhoto';
import { categoryColor } from './PmsDefectSc';
import { machineHistory, openDefects } from '../services/pmsHistory';
import { exportPmsHistory } from '../services/pmsHistoryReport';
import { SIZES, Palette } from '../theme';
import { DEPTS, Machine, PmsDone, PmsJob, deptOf, hasCounter } from '../types/pms';
import { activeDeferral, dueLabel, hoursPerDay, jobDue, sortJobsByDue, todayIso, withReading, scheduleLabel , checkReading , lastCondition , cancellable, jobAfterCancel } from '../services/pms';
import { CATALOGUE } from '../services/pmsCatalogue';
import { formatDate } from '../utils/dates';
import { qtyText, stockByPart, stockStatus } from '../services/spares';
import { moduleOn } from '../constants/modules';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { copyJobsTo, copyMachine, parentChoices, predecessors, replaceMachine, scrapMachine } from '../services/pmsMachines';
import { Dropdown } from '../components/Dropdown';
import { MACHINE_FIELDS, changeText, planDiff, withChanges } from '../services/planLog';
import { playSuccessSound } from '../utils/sound';
import { t, tk, tn, useT } from '../utils/i18n';

/** services/pmsHistory conditionText, in the interface language (the report keeps the English one). */
const condLabel = (d: Pick<PmsDone, 'conditionBefore' | 'conditionAfter'>) =>
  `${d.conditionBefore ? tk(`pms.cond.${d.conditionBefore}`) : ''} → ${d.conditionAfter ? tk(`pms.cond.${d.conditionAfter}`) : '—'}`.trim();

export default function MachineSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { machines, scrappedMachines, pmsJobs, pmsDone, pmsDeferrals, pmsDefects, spares, spareMoves, saveMachine, savePmsJob, savePlan, saveSpare, vessel, versionsOf } = useData();
  const defects = useMemo(() => openDefects(pmsDefects.filter((d) => d.machineId === route.params?.id)), [pmsDefects, route.params?.id]);
  const [histSaved, setHistSaved] = useState<string | null>(null);
  const sync = useSync();
  const id: string = route.params?.id;
  const retired = scrappedMachines.find((m) => m.id === id);
  // A scrapped unit is history: read, not planned.
  const canPlan = plansPms(sync.enrolled, sync.role) && !retired;
  // Spare parts marked as fitting this machine (Spares module).
  const fitting = useMemo(() => (moduleOn('spares') ? spares.filter((p) => (p.machineIds ?? []).includes(id)) : []), [spares, id]);
  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);
  const existing = machines.find((m) => m.id === id) ?? retired;
  const isNew = !existing;

  // A new system starts in the department it was added from (MaintenanceSc).
  const [draft, setDraft] = useState<Machine>(
    existing ?? {
      id, name: '',
      ...(route.params?.dept ? { dept: route.params.dept } : {}),
      // A component added from its parent: listed under it, its hours following the parent's when it has a counter.
      ...(route.params?.parentId ? { parentId: route.params.parentId, ...(route.params.follows ? { followsParent: true, counter: true, hours: 0 } : {}) } : {}),
      updatedAt: Date.now(),
    }
  );
  const [reading, setReading] = useState('');
  const [showTypes, setShowTypes] = useState(false);
  // The machine may arrive after the screen does (opened by URL on a cold start,
  // or synced in a moment later): adopt it then, unless the officer has started
  // typing — same as CertificateDetailSc.
  const touched = useRef(false);
  useEffect(() => {
    if (existing && !touched.current) setDraft(existing);
  }, [existing]);
  const set = (p: Partial<Machine>) => {
    touched.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };
  const today = todayIso();

  const jobs = useMemo(() => {
    const byId = new Map([[id, existing ?? draft]]);
    return sortJobsByDue(pmsJobs.filter((j) => j.machineId === id), byId, today, pmsDeferrals);
  }, [pmsJobs, id, existing, draft, today, pmsDeferrals]);
  // Every sign-out as it stands — cancelled ones shown struck through, with the reason.
  const allDone = versionsOf(storage.PMS_DONE_KEY) as PmsDone[];
  const history = useMemo(
    () => current(allDone).filter((d) => d.machineId === id).sort((a, b) => b.at - a.at).slice(0, 10),
    [allDone, id]
  );
  const amend = useAmend();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  // A wrong sign-out, cancelled by the Master: the record stays, struck through; the job goes back.
  const cancelDone = (h: PmsDone) =>
    amend.remove({
      store: storage.PMS_DONE_KEY,
      record: h,
      what: `${h.jobTitle}, signed ${formatDate(h.date)} by ${h.by}${h.unplanned ? '' : ' — the job returns to its earlier due date'}`,
      onDone: async (next: PmsDone) => {
        if (h.unplanned) return;
        const raw = (await storage.loadList<PmsJob>(storage.PMS_JOBS_KEY)).find((j) => j.id === h.jobId);
        if (raw) await savePmsJob(jobAfterCancel(raw, next, live(await storage.loadList<PmsDone>(storage.PMS_DONE_KEY))));
      },
    });
  const rate = hoursPerDay(existing?.readings);

  const saveDetails = async (extra: Partial<Machine> = {}) => {
    const name = (extra.name ?? draft.name).trim();
    if (!name) {
      Alert.alert(t('crew.nameReq'), t('mch.nameIt'));
      return false;
    }
    const next = { ...(existing ?? draft), ...draft, ...extra, name };
    // The change log (services/planLog.ts): critical, class item or code changed says why.
    const diff = planDiff(existing, next, MACHINE_FIELDS);
    if (diff.some((d) => d.needsReason) && changeReason.trim().length < 3) {
      Alert.alert(t('gb.reasonChange'), t('mch.sayWhy', { what: diff.filter((d) => d.needsReason).map((d) => d.label.toLowerCase()).join(', ') }));
      return false;
    }
    const now = Date.now();
    await saveMachine({ ...next, ...(diff.length ? { changes: withChanges(existing?.changes, diff, { by: meName || 'Master', ...(sync.me?.position ? { byRank: sync.me.position } : {}) }, changeReason, now) } : {}), updatedAt: now });
    setChangeReason('');
    return true;
  };
  const [changeReason, setChangeReason] = useState('');
  const [showLog, setShowLog] = useState(false);

  const onSave = async () => {
    if (await saveDetails()) {
      playSuccessSound();
      goBackOr(nav);
    }
  };

  // A reading the calendar cannot explain waits here for its reason (TM Master's
  // rule): lower than the last, or more hours than have passed + 12.
  const [doubt, setDoubt] = useState<{ total: number; why: string } | null>(null);
  const [doubtReason, setDoubtReason] = useState('');
  // Counter replaced: what the new counter shows now.
  const [replacing, setReplacing] = useState<string | null>(null);
  const meName = sync.me ? personName(sync.me) : undefined;
  const offset = (existing ?? draft).counterOffset ?? 0;
  const putReading = async (total: number, reason?: string, extra: Partial<Machine> = {}) => {
    const base = existing ?? draft;
    if (!draft.name.trim()) return Alert.alert(t('crew.nameReq'), t('mch.nameFirst'));
    const next = withReading({ ...base, ...extra, ...(canPlan ? { ...draft, name: draft.name.trim() } : {}) }, today, total, { reason, by: meName });
    await saveMachine(next);
    setDraft(next);
    setReading('');
    setDoubt(null);
    setDoubtReason('');
    setReplacing(null);
    playSuccessSound();
  };
  const onReading = async () => {
    const h = Number(reading.replace(',', '.'));
    if (!reading.trim() || !Number.isFinite(h) || h < 0) return Alert.alert(t('mch.counter'), t('mch.enterHours'));
    const total = h + offset;
    const c = checkReading(existing ?? draft, today, total);
    if (!c.ok) return setDoubt({ total, why: c.why });
    await putReading(total);
  };
  const onReplaced = async () => {
    const shows = Number((replacing ?? '').replace(',', '.'));
    const base = existing ?? draft;
    if (!replacing?.trim() || !Number.isFinite(shows) || shows < 0) return Alert.alert(t('mch.newCounter'), t('mch.enterNew'));
    if (base.hours == null) return Alert.alert(t('mch.newCounter'), t('mch.noReading'));
    await putReading(base.hours, `Counter replaced — new counter at ${shows} h, machine at ${base.hours} h`, { counterOffset: base.hours - shows });
  };

  const addTypical = async (key: string) => {
    const t = CATALOGUE.find((x) => x.key === key);
    // A system picked from the catalogue takes its department and counter too,
    // and its name when none was typed.
    const patch: Partial<Machine> = t
      ? { dept: t.dept, counter: t.counter, ...(t.critical ? { critical: true } : {}), ...(draft.name.trim() ? {} : { name: t.label.replace(/\s*\(.*\)$/, '') }) }
      : {};
    touched.current = true;
    setDraft((d) => ({ ...d, ...patch }));
    if (!(await saveDetails(patch))) return;
    const have = new Set(pmsJobs.filter((j) => j.machineId === id).map((j) => j.title.toLowerCase()));
    for (const job of t?.jobs ?? []) {
      if (have.has(job.title.toLowerCase())) continue;
      const j: PmsJob = {
        id: uid('job'),
        machineId: id,
        title: job.title,
        ...(job.type ? { type: job.type } : {}),
        intervalHours: t?.counter ? job.hours : undefined,
        intervalDays: job.days,
        notes: 'Typical interval — check against the maker\'s manual.',
        updatedAt: Date.now(),
      };
      await savePmsJob(j);
    }
    setShowTypes(false);
  };

  // ---- Copy, copy jobs, scrap / replace (services/pmsMachines.ts) ----
  const allMachines = useMemo(() => [...machines, ...scrappedMachines], [machines, scrappedMachines]);
  const before = useMemo(() => (existing ? predecessors(existing, allMachines) : []), [existing, allMachines]);
  const hasHistory = allDone.some((d) => d.machineId === id);
  const [retire, setRetire] = useState<{ date: string; reason: string; replace: boolean; serial: string; hours: string } | null>(null);
  const [copyTo, setCopyTo] = useState<Set<string> | null>(null);
  /** The spares that fit this machine fit its copy / its replacement too. */
  const linkSpares = async (newId: string) => {
    for (const p of spares.filter((x) => (x.machineIds ?? []).includes(id))) await saveSpare({ ...p, machineIds: [...(p.machineIds ?? []), newId], updatedAt: Date.now() });
  };
  const onCopy = async () => {
    if (!existing || !(await saveDetails())) return;
    const c = copyMachine({ ...existing, ...draft }, pmsJobs, { id: uid('mc'), name: `${draft.name.trim()} (copy)`, now: Date.now(), uid });
    await savePlan([c.machine], c.jobs);
    await linkSpares(c.machine.id);
    playSuccessSound();
    nav.push('Machine', { id: c.machine.id });
  };
  const onCopyJobs = async () => {
    if (!copyTo?.size) return Alert.alert(t('mch.copyJobs'), t('mch.tickSystems'));
    const add = copyJobsTo(id, [...copyTo], pmsJobs, Date.now(), uid);
    if (add.length) await savePlan([], add);
    setCopyTo(null);
    playSuccessSound();
    Alert.alert(t('mch.copyJobs'), add.length ? t('mch.jobsAdded', { x: tn('n.job', add.length) }) : t('mch.already'));
  };
  const onRetire = async () => {
    if (!retire || !existing) return;
    const isIso = /^\d{4}-\d{2}-\d{2}$/.test(retire.date) && !isNaN(Date.parse(retire.date));
    if (!isIso || retire.date > today) return Alert.alert(t('nc.date'), t('mch.dayOut'));
    if (retire.reason.trim().length < 3) return Alert.alert(t('gb.reason'), t('mch.whyOut'));
    const hours = Number(retire.hours.replace(',', '.') || '0');
    if (retire.replace && hasCounter(existing) && (!Number.isFinite(hours) || hours < 0)) return Alert.alert(t('mch.newUnit'), t('mch.newUnitHours'));
    const r = { date: retire.date, reason: retire.reason.trim(), by: meName ?? 'Officer', ...(sync.me?.position ? { byRank: sync.me.position } : {}), now: Date.now() };
    if (retire.replace) {
      const out = replaceMachine(existing, pmsJobs, { ...r, id: uid('mc'), serial: retire.serial, hours, uid });
      await savePlan([out.old, out.fitted], out.jobs);
      await linkSpares(out.fitted.id);
      setRetire(null);
      playSuccessSound();
      nav.replace('Machine', { id: out.fitted.id });
    } else {
      const out = scrapMachine(existing, pmsJobs, r);
      await savePlan([out.machine], out.jobs);
      setRetire(null);
      playSuccessSound();
      goBackOr(nav);
    }
  };

  const onDelete = () => {
    if (isNew) return goBackOr(nav);
    if (hasHistory) return Alert.alert(t('common.remove'), t('mch.hasHistory'));
    Alert.alert(t('common.remove'), t('mch.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          for (const j of pmsJobs.filter((x) => x.machineId === id)) await savePmsJob({ ...j, deleted: true, updatedAt: Date.now() });
          await saveMachine({ ...(existing as Machine), deleted: true, updatedAt: Date.now() });
          goBackOr(nav);
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>{isNew ? t('mch.new') : draft.name || t('mch.system')}</Text>
          {canPlan ? (
            <TouchableOpacity onPress={onSave} hitSlop={12}>
              <Text style={styles.save}>{t('common.save')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          {retired?.scrapped ? (
            <View style={[styles.doubt, { borderColor: COLORS.danger, marginTop: 0, marginBottom: SIZES.md }]}>
              <Text style={[styles.rowTitle, { color: COLORS.danger }]}>{t('mch.scrappedOn', { date: formatDate(retired.scrapped.date) })}</Text>
              <Text style={styles.sub}>{[retired.scrapped.reason, retired.scrapped.byRank ? `${retired.scrapped.by} (${retired.scrapped.byRank})` : retired.scrapped.by].join(' · ')}</Text>
              {retired.scrapped.replacedBy && allMachines.some((m) => m.id === retired.scrapped!.replacedBy) ? (
                <TouchableOpacity onPress={() => nav.push('Machine', { id: retired.scrapped!.replacedBy })} hitSlop={8}>
                  <Text style={[styles.link, { marginTop: SIZES.xs }]}>{`${t('mch.replacedBy', { unit: allMachines.find((m) => m.id === retired.scrapped!.replacedBy)!.serial ? `S/N ${allMachines.find((m) => m.id === retired.scrapped!.replacedBy)!.serial}` : t('mch.theNewUnit') })} →`}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : !canPlan ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{PLAN_LOCKED}</Text> : null}
          {before.length ? (
            <View style={[styles.card, { marginBottom: SIZES.md }]}>
              <Text style={styles.sub}>{existing?.installed ? t('mch.fittedReplaced', { date: formatDate(existing.installed) }) : t('mch.itReplaced')}</Text>
              {before.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => nav.push('Machine', { id: m.id })} hitSlop={6}>
                  <Text style={[styles.link, { marginTop: 2 }]}>{`${m.serial ? `S/N ${m.serial}` : m.name}${m.scrapped ? ` · ${t('mch.scrappedL', { date: formatDate(m.scrapped.date) })} — ${m.scrapped.reason}` : ''} · ${t('mch.itsHistory')} →`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View pointerEvents={canPlan ? 'auto' : 'none'} style={!canPlan && { opacity: 0.6 }}>
          <Label>{t('spp.dept')}</Label>
          <View style={styles.depts}>
            {DEPTS.map((d) => (
              <TouchableOpacity key={d.key} style={[styles.dept, deptOf(draft) === d.key && styles.deptOn]} onPress={() => set({ dept: d.key })}>
                <Text style={[styles.deptText, deptOf(draft) === d.key && styles.deptTextOn]}>{tk(`dept.${d.key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label={t('mt.namePh')} value={draft.name} onChange={(v) => set({ name: v })} placeholder={deptOf(draft) === 'engineering' ? t('mch.namePhEng') : t('mch.namePh')} />
          <Field label={t('risk.location')} value={draft.location} onChange={(v) => set({ location: v })} placeholder={t('dpt.engine')} />
          <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
            <View style={{ flex: 1 }}><Field label={t('spp.maker')} value={draft.maker} onChange={(v) => set({ maker: v })} /></View>
            <View style={{ flex: 1 }}><Field label={t('mch.model')} value={draft.model} onChange={(v) => set({ model: v })} /></View>
          </View>
          <Field label={t('mch.serial')} value={draft.serial} onChange={(v) => set({ serial: v })} />
          {(() => {
            const choices = parentChoices(draft, machines);
            const parent = machines.find((m) => m.id === draft.parentId);
            return choices.length ? (
              <View style={{ marginBottom: SIZES.md }}>
                <Dropdown
                  caption={t('mch.partOf')}
                  value={draft.parentId ?? ''}
                  onChange={(v: string) => set({ parentId: v || undefined, ...(v ? {} : { followsParent: undefined }) })}
                  options={[{ value: '', label: '— a system of its own' }, ...choices.map((m) => ({ value: m.id, label: m.name }))]}
                />
                {parent && hasCounter(parent) ? (
                  <View style={styles.counterRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{t('mch.hoursFrom', { name: parent.name })}</Text>
                      <Text style={styles.sub}>{t('mch.followHint')}</Text>
                    </View>
                    <Switch value={!!draft.followsParent} onValueChange={(v) => set({ followsParent: v || undefined, ...(v ? { counter: true } : {}) })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
                  </View>
                ) : null}
              </View>
            ) : null;
          })()}

          <View style={styles.counterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('mch.counterTitle')}</Text>
              <Text style={styles.sub}>{t('mch.counterHint')}</Text>
            </View>
            <Switch value={hasCounter(draft)} onValueChange={(v) => set({ counter: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          <View style={styles.counterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('mch.critical')}</Text>
              <Text style={styles.sub}>{t('mch.criticalHint')}</Text>
            </View>
            <Switch value={!!draft.critical} onValueChange={(v) => set({ critical: v })} trackColor={{ true: COLORS.danger, false: COLORS.border }} />
          </View>
          <View style={styles.counterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t('mch.classItem')}</Text>
              <Text style={styles.sub}>{t('mch.classHint')}</Text>
            </View>
            <Switch value={!!draft.classItem} onValueChange={(v) => set({ classItem: v || undefined })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {draft.classItem ? <Field label={t('mch.classCode')} value={draft.classCode} onChange={(v) => set({ classCode: v })} placeholder={t('mch.classCodePh')} /> : null}
          {!isNew ? <Field label={t('gb.reasonChange')} value={changeReason} onChange={setChangeReason} placeholder={t('mch.reasonPh')} /> : null}
          </View>

          {hasCounter(draft) ? (
          <View style={styles.card}>
            <Label>{t('mch.runningHours')}</Label>
            <Text style={styles.hours}>
              {(existing ?? draft).hours != null ? t('hor.hours', { n: (existing ?? draft).hours! }) : t('mch.noReadingYet')}
            </Text>
            <Text style={styles.sub}>
              {[
                (existing ?? draft).hoursDate ? t('mch.readOn', { date: formatDate((existing ?? draft).hoursDate!) }) : null,
                rate ? t('mch.perDay', { n: Math.round(rate * 10) / 10 }) : null,
              ].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.readRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                value={reading}
                onChangeText={setReading}
                placeholder={t('mch.todayCounter')}
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={styles.btn} onPress={onReading}>
                <Text style={styles.btnText}>{t('mch.saveReading')}</Text>
              </TouchableOpacity>
            </View>
            {offset ? <Text style={styles.sub}>{t('mch.offsetNote', { n: offset })}</Text> : null}
            {draft.followsParent && machines.find((m) => m.id === draft.parentId) ? (
              <Text style={styles.sub}>{t('mch.followsNote', { name: machines.find((m) => m.id === draft.parentId)!.name })}</Text>
            ) : null}
            {doubt ? (
              <View style={styles.doubt}>
                <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{`⚠ ${doubt.total} h — ${doubt.why}`}</Text>
                <TextInput style={[styles.input, { marginTop: SIZES.xs }]} value={doubtReason} onChangeText={setDoubtReason} placeholder={t('mch.doubtPh')} placeholderTextColor={COLORS.textLight} />
                <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center', marginTop: SIZES.xs }}>
                  <TouchableOpacity style={styles.btn} onPress={() => (doubtReason.trim().length < 3 ? Alert.alert(t('gb.reason'), t('mch.whyRight')) : void putReading(doubt.total, doubtReason.trim()))}>
                    <Text style={styles.btnText}>{t('mch.saveReason')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDoubt(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
            {replacing != null ? (
              <View style={styles.doubt}>
                <Text style={styles.sub}>{t('mch.replaceHint', { n: (existing ?? draft).hours ?? 0 })}</Text>
                <View style={[styles.readRow, { marginTop: SIZES.xs }]}>
                  <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={replacing} onChangeText={setReplacing} placeholder={t('mch.newShowsPh')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                  <TouchableOpacity style={styles.btn} onPress={() => void onReplaced()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setReplacing(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            ) : (existing ?? draft).hours != null ? (
              <TouchableOpacity onPress={() => setReplacing('')} hitSlop={8}><Text style={[styles.link, { marginTop: SIZES.xs }]}>{t('mch.counterReplaced')}</Text></TouchableOpacity>
            ) : null}
            {((existing ?? draft).readings ?? []).filter((r) => r.reason).slice(-3).map((r) => (
              <Text key={`${r.date}-${r.hours}-${r.reason}`} style={styles.sub}>{`${formatDate(r.date)} · ${r.hours} h — ${r.reason}${r.by ? ` (${r.by})` : ''}`}</Text>
            ))}
          </View>
          ) : null}

          {!isNew ? (
            <>
              <View style={styles.jobsHead}>
                <Label>{t('mch.components', { n: machines.filter((m) => m.parentId === id).length })}</Label>
                {canPlan ? (
                  <TouchableOpacity onPress={async () => { if (await saveDetails()) nav.push('Machine', { id: uid('mach'), isNew: true, dept: deptOf(draft), parentId: id, follows: hasCounter(draft) }); }} hitSlop={8}>
                    <Text style={styles.link}>{t('mch.addComponent')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {machines.filter((m) => m.parentId === id).map((c) => (
                <TouchableOpacity key={c.id} style={styles.row} onPress={() => nav.push('Machine', { id: c.id })} activeOpacity={0.7}>
                  <View style={[styles.bar, { backgroundColor: COLORS.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{[c.serial ? `S/N ${c.serial}` : null, hasCounter(c) && c.hours != null ? `${t('hor.hours', { n: c.hours })}${c.followsParent ? ` (${t('mch.follows')})` : ''}` : null, tn('n.job', pmsJobs.filter((j) => j.machineId === c.id && !j.deleted).length)].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          ) : null}
          {draft.parentId && machines.find((m) => m.id === draft.parentId) ? (
            <TouchableOpacity onPress={() => nav.push('Machine', { id: draft.parentId })} hitSlop={8}>
              <Text style={[styles.link, { marginTop: SIZES.xs }]}>{`↑ ${t('mch.partOfL', { name: machines.find((m) => m.id === draft.parentId)!.name })}`}</Text>
            </TouchableOpacity>
          ) : null}
          {(() => {
            const lc = lastCondition(id, pmsDone);
            return lc ? (
              <Text style={[styles.sub, { marginTop: SIZES.sm, fontWeight: '700', color: lc.conditionAfter === 'out' || lc.conditionAfter === 'poor' ? COLORS.warning : COLORS.textDark }]}>
                {`${t('mch.lastCond')}: ${tk(`pms.cond.${lc.conditionAfter!}`)} · ${formatDate(lc.date)} · ${lc.jobTitle}`}
              </Text>
            ) : null;
          })()}
          <View style={styles.jobsHead}>
            <Label>{t('mch.jobsN', { n: jobs.length })}</Label>
            <View pointerEvents={canPlan ? 'auto' : 'none'} style={[{ flexDirection: 'row', gap: SIZES.md }, !canPlan && { opacity: 0.35 }]}>
              <TouchableOpacity onPress={() => setShowTypes((v) => !v)} hitSlop={8}>
                <Text style={styles.link}>{t('mch.typical')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (await saveDetails()) nav.navigate('PmsJob', { id: uid('job'), machineId: id, isNew: true });
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>{t('mch.addJob')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (await saveDetails()) nav.navigate('PmsJob', { id: uid('job'), machineId: id, isNew: true, oneOff: true });
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>{t('mch.oneOff')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showTypes ? (
            <View style={styles.types}>
              <Text style={styles.sub}>{t('mch.typicalHint')}</Text>
              {CATALOGUE.filter((t) => t.dept === deptOf(draft)).map((t) => (
                <TouchableOpacity key={t.key} style={styles.type} onPress={() => addTypical(t.key)}>
                  <Text style={styles.typeText}>{`${t.label} · ${tn('n.job', t.jobs.length)}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          {jobs.map((j) => {
            const d = jobDue(j, existing ?? draft, today, activeDeferral(j, pmsDeferrals));
            return (
              <TouchableOpacity key={j.id} style={styles.row} onPress={() => nav.navigate('PmsJob', { id: j.id })} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: statusColor(d.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{j.title}</Text>
                  <Text style={styles.sub} numberOfLines={2}>{`${scheduleLabel(j)} · ${dueLabel(d)}`}</Text>
                </View>
                {d.status !== 'none' ? <StatusPill status={d.status} /> : null}
              </TouchableOpacity>
            );
          })}

          {fitting.length ? <Label>{t('mch.spares', { n: fitting.length })}</Label> : null}
          {fitting.map((p) => {
            const have = stock.get(p.id) ?? 0;
            const st = stockStatus(p, have);
            return (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => nav.navigate('SparePart', { id: p.id })} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: st === 'out' ? COLORS.danger : st === 'low' ? COLORS.warning : COLORS.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{[p.partNo, p.location].filter(Boolean).join(' · ') || '—'}</Text>
                </View>
                <Text style={[styles.rowTitle, { color: st === 'out' ? COLORS.danger : st === 'low' ? COLORS.warning : COLORS.textDark }]}>{qtyText(have, p)}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.jobsHead}>
            <Label>{t('mt2.openDefects', { n: defects.length })}</Label>
            {!isNew ? (
              <TouchableOpacity onPress={() => nav.navigate('PmsDefect', { id: uid('new'), machineId: id })} hitSlop={8}>
                <Text style={styles.link}>{t('mch.reportDefect')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {defects.map((x) => (
            <TouchableOpacity key={x.id} style={styles.row} onPress={() => nav.navigate('PmsDefect', { id: x.id })} activeOpacity={0.7}>
              <View style={[styles.bar, { backgroundColor: categoryColor(COLORS, x.category) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{x.description}</Text>
                <Text style={styles.sub}>{`${tk(`pms.defcat.${x.category}`)} · ${formatDate(x.date)} · ${x.by}`}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {!isNew ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md }}>
              <TouchableOpacity
                onPress={() =>
                  void exportPmsHistory('Maintenance history', `Maintenance history-${draft.name}`, vessel, [machineHistory(existing ?? draft, pmsJobs, pmsDone, pmsDeferrals, pmsDefects, today)])
                    .then((w) => typeof w === 'string' && setHistSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w })))
                    .catch((e) => Alert.alert(t('mch.history'), String(e?.message ?? e)))
                }
                hitSlop={8}
              >
                <Text style={styles.link}>{t('mch.histPdf')}</Text>
              </TouchableOpacity>
              {histSaved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${histSaved}`}</Text> : null}
            </View>
          ) : null}

          <View style={styles.jobsHead}>
            <Label>{history.length ? t('mch.recent') : t('mch.workDone')}</Label>
            {!isNew ? (
              <TouchableOpacity onPress={() => nav.navigate('PmsJob', { id: uid('srv'), machineId: id, unplanned: true })} hitSlop={8}>
                <Text style={styles.link}>{t('mch.unplanned')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {history.map((h) => (
            <View key={h.id} style={[styles.hist, h.cancelled && { opacity: 0.6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                <Text style={[styles.rowTitle, { flex: 1 }, h.cancelled && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{`${h.unplanned ? `${t('mch.unplannedL')} · ` : ''}${h.jobTitle}`}</Text>
                {!h.cancelled && cancellable(h) ? (
                  <TouchableOpacity disabled={!isMaster} style={!isMaster && { opacity: 0.35 }} onPress={() => cancelDone(h)} hitSlop={8}>
                    <Text style={[styles.link, { color: COLORS.danger }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {h.cancelled ? <Text style={[styles.sub, { color: COLORS.danger }]}>{`${t('mch.cancelled')} — ${h.editReason ?? ''} · ${h.editedByRank ? `${h.editedBy} (${h.editedByRank})` : h.editedBy ?? ''}`}</Text> : null}
              <Text style={styles.sub}>
                {[formatDate(h.date), h.hours != null ? t('hor.hours', { n: h.hours }) : null, condLabel(h) || null, h.manHours != null ? t('mch.manH', { n: h.manHours }) : null, h.doneBy ? t('mch.doneBy', { who: `${h.doneBy}${h.doneByRank ? ` (${h.doneByRank})` : ''}` }) : null, h.doneBy ? t('mch.signedOutBy', { who: h.byRank ? `${h.by} (${h.byRank})` : h.by }) : h.byRank ? `${h.by} (${h.byRank})` : h.by].filter(Boolean).join(' · ')}
              </Text>
              {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
              {h.photos?.length ? (
                <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.xs, flexWrap: 'wrap' }}>
                  {h.photos.map((p) => <EvidencePhoto key={p.id} vessel={vessel?.imo ?? ''} inspectionId={h.supersedes ?? h.id} photo={p} />)}
                </View>
              ) : null}
            </View>
          ))}

          {existing?.changes?.length ? (
            <View style={{ marginTop: SIZES.md }}>
              <TouchableOpacity onPress={() => setShowLog((v) => !v)} hitSlop={8}>
                <Text style={styles.link}>{t(showLog ? 'mch.hideLog' : 'mch.showLog', { n: existing.changes.length })}</Text>
              </TouchableOpacity>
              {showLog
                ? [...existing.changes].reverse().map((c, i) => (
                    <Text key={`${c.at}-${i}`} style={styles.sub}>{`${formatDate(new Date(c.at).toISOString().slice(0, 10))} · ${c.byRank ? `${c.by} (${c.byRank})` : c.by} · ${changeText(c)}${c.reason ? ` — ${c.reason}` : ''}`}</Text>
                  ))
                : null}
            </View>
          ) : null}
          {!isNew && canPlan ? (
            <View style={[styles.jobsHead, { marginTop: SIZES.lg, justifyContent: 'flex-start', gap: SIZES.lg, flexWrap: 'wrap' }]}>
              <TouchableOpacity onPress={() => void onCopy()} hitSlop={8}><Text style={styles.link}>{t('mch.copySystem')}</Text></TouchableOpacity>
              {jobs.some((j) => !j.oneOff) ? (
                <TouchableOpacity onPress={() => setCopyTo(copyTo ? null : new Set())} hitSlop={8}><Text style={styles.link}>{t('mch.copyJobsTo')}</Text></TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setRetire(retire ? null : { date: today, reason: '', replace: true, serial: '', hours: '0' })} hitSlop={8}>
                <Text style={[styles.link, { color: COLORS.danger }]}>{t('mch.scrapReplace')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {copyTo ? (
            <View style={styles.types}>
              <Text style={styles.sub}>{t('mch.copyHint')}</Text>
              {machines.filter((m) => m.id !== id).sort((a, b) => Number(deptOf(b) === deptOf(draft)) - Number(deptOf(a) === deptOf(draft)) || a.name.localeCompare(b.name)).map((m) => {
                const on = copyTo.has(m.id);
                return (
                  <TouchableOpacity key={m.id} style={[styles.type, on && { backgroundColor: COLORS.primary }]} onPress={() => { const n = new Set(copyTo); if (on) n.delete(m.id); else n.add(m.id); setCopyTo(n); }}>
                    <Text style={[styles.typeText, on && { color: COLORS.textWhite }]}>{`${on ? '✓ ' : ''}${m.name}`}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center' }}>
                <TouchableOpacity style={styles.btn} onPress={() => void onCopyJobs()}><Text style={styles.btnText}>{t('mch.copyToN', { n: copyTo.size })}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCopyTo(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}
          {retire ? (
            <View style={[styles.doubt, { borderColor: COLORS.danger }]}>
              <Text style={styles.sub}>{t('mch.scrapHint')}</Text>
              <View style={styles.readRow}>
                <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={retire.date} onChangeText={(v) => setRetire({ ...retire, date: v })} placeholder={t('mch.datePh')} placeholderTextColor={COLORS.textLight} />
              </View>
              <TextInput style={styles.input} value={retire.reason} onChangeText={(v) => setRetire({ ...retire, reason: v })} placeholder={t('mch.reasonOutPh')} placeholderTextColor={COLORS.textLight} />
              <View style={styles.counterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{t('mch.replacedNew')}</Text>
                  <Text style={styles.sub}>{t('mch.replacedNewHint')}</Text>
                </View>
                <Switch value={retire.replace} onValueChange={(v) => setRetire({ ...retire, replace: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
              </View>
              {retire.replace ? (
                <View style={styles.readRow}>
                  <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={retire.serial} onChangeText={(v) => setRetire({ ...retire, serial: v })} placeholder={t('mch.newSerial')} placeholderTextColor={COLORS.textLight} />
                  {hasCounter(draft) ? (
                    <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={retire.hours} onChangeText={(v) => setRetire({ ...retire, hours: v })} placeholder={t('mch.itsCounter')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                  ) : null}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center', marginTop: SIZES.sm }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => void onRetire()}>
                  <Text style={styles.btnText}>{retire.replace ? t('mch.scrapFit') : t('mch.scrap')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRetire(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}

          {!retired ? (
            <TouchableOpacity disabled={!canPlan} style={[styles.deleteBtn, !canPlan && { opacity: 0.35 }]} onPress={onDelete}>
              <Text style={styles.deleteText}>{isNew ? t('doc.discard') : hasHistory ? t('mch.removeNoHist') : t('mch.removeMistake')}</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
        {amend.ui}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <View style={{ marginBottom: SIZES.md }}>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={value ?? ''} onChangeText={onChange} placeholder={placeholder ?? '—'} placeholderTextColor={COLORS.textLight} />
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    depts: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.md },
    dept: { paddingVertical: 5, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    deptOn: { backgroundColor: COLORS.primary },
    deptText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    deptTextOn: { color: COLORS.textWhite },
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginVertical: SIZES.md },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    hours: { fontSize: SIZES.h2, fontWeight: '800', color: COLORS.textDark, marginTop: 2 },
    sub: { fontSize: SIZES.small, color: COLORS.textLight },
    readRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm, alignItems: 'center' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm + 2 },
    btnText: { color: COLORS.textWhite, fontWeight: '700' },
    jobsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.sm, marginBottom: SIZES.xs },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    doubt: { marginTop: SIZES.sm, padding: SIZES.sm, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.warning },
    types: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm, gap: SIZES.xs },
    type: { paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md, borderRadius: SIZES.radiusSm, borderWidth: 1, borderColor: COLORS.primary },
    typeText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    row: { flexDirection: 'row', alignItems: 'center', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden', gap: SIZES.xs },
    bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.sm },
    rowTitle: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
    hist: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingVertical: SIZES.sm },
    note: { fontSize: SIZES.small, color: COLORS.text, marginTop: 2 },
    deleteBtn: { marginTop: SIZES.lg, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
    deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
  });
