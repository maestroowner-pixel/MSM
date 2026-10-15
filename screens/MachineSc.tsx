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
import { CONDITION, DEFECT_CATEGORY } from '../types/pms';
import { conditionText, machineHistory, openDefects } from '../services/pmsHistory';
import { exportPmsHistory } from '../services/pmsHistoryReport';
import { SIZES, Palette } from '../theme';
import { DEPTS, Machine, PmsDone, PmsJob, deptOf, hasCounter } from '../types/pms';
import { activeDeferral, dueText, hoursPerDay, jobDue, sortJobsByDue, todayIso, withReading, scheduleText , checkReading , lastCondition , cancellable, jobAfterCancel } from '../services/pms';
import { CATALOGUE } from '../services/pmsCatalogue';
import { formatDate } from '../utils/dates';
import { qtyText, stockByPart, stockStatus } from '../services/spares';
import { moduleOn } from '../constants/modules';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { copyJobsTo, copyMachine, predecessors, replaceMachine, scrapMachine } from '../services/pmsMachines';
import { playSuccessSound } from '../utils/sound';

export default function MachineSc() {
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
    existing ?? { id, name: '', ...(route.params?.dept ? { dept: route.params.dept } : {}), updatedAt: Date.now() }
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
      Alert.alert('Name required', 'Name it — "Main engine PS", "Tender", "Galley", "Wi-Fi network".');
      return false;
    }
    await saveMachine({ ...(existing ?? draft), ...draft, ...extra, name, updatedAt: Date.now() });
    return true;
  };

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
    if (!draft.name.trim()) return Alert.alert('Name required', 'Name the machine first.');
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
    if (!reading.trim() || !Number.isFinite(h) || h < 0) return Alert.alert('Counter', 'Enter the hours shown on the counter.');
    const total = h + offset;
    const c = checkReading(existing ?? draft, today, total);
    if (!c.ok) return setDoubt({ total, why: c.why });
    await putReading(total);
  };
  const onReplaced = async () => {
    const shows = Number((replacing ?? '').replace(',', '.'));
    const base = existing ?? draft;
    if (!replacing?.trim() || !Number.isFinite(shows) || shows < 0) return Alert.alert('New counter', 'Enter what the new counter shows now.');
    if (base.hours == null) return Alert.alert('New counter', 'There is no reading yet — just enter the counter.');
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
    if (!copyTo?.size) return Alert.alert('Copy jobs', 'Tick the systems to copy the jobs to.');
    const add = copyJobsTo(id, [...copyTo], pmsJobs, Date.now(), uid);
    if (add.length) await savePlan([], add);
    setCopyTo(null);
    playSuccessSound();
    Alert.alert('Copy jobs', add.length ? `${add.length} job${add.length === 1 ? '' : 's'} added — not yet done; set when each was last done on its job.` : 'They already have these jobs.');
  };
  const onRetire = async () => {
    if (!retire || !existing) return;
    const isIso = /^\d{4}-\d{2}-\d{2}$/.test(retire.date) && !isNaN(Date.parse(retire.date));
    if (!isIso || retire.date > today) return Alert.alert('Date', 'The day it was taken out, yyyy-mm-dd — not in the future.');
    if (retire.reason.trim().length < 3) return Alert.alert('Reason', 'Say why — worn out, failed, replaced at refit…');
    const hours = Number(retire.hours.replace(',', '.') || '0');
    if (retire.replace && hasCounter(existing) && (!Number.isFinite(hours) || hours < 0)) return Alert.alert('New unit', 'The hours on the new unit\'s counter — 0 for a new one.');
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
    if (hasHistory) return Alert.alert('Remove', 'It has a history of work done — scrap it instead, so the history stays where it can be read.');
    Alert.alert('Remove', 'Remove this system and its jobs from the plan? The history of work done is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
          <Text style={styles.headerTitle} numberOfLines={1}>{isNew ? 'New system' : draft.name || 'System'}</Text>
          {canPlan ? (
            <TouchableOpacity onPress={onSave} hitSlop={12}>
              <Text style={styles.save}>Save</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          {retired?.scrapped ? (
            <View style={[styles.doubt, { borderColor: COLORS.danger, marginTop: 0, marginBottom: SIZES.md }]}>
              <Text style={[styles.rowTitle, { color: COLORS.danger }]}>{`Scrapped ${formatDate(retired.scrapped.date)}`}</Text>
              <Text style={styles.sub}>{[retired.scrapped.reason, retired.scrapped.byRank ? `${retired.scrapped.by} (${retired.scrapped.byRank})` : retired.scrapped.by].join(' · ')}</Text>
              {retired.scrapped.replacedBy && allMachines.some((m) => m.id === retired.scrapped!.replacedBy) ? (
                <TouchableOpacity onPress={() => nav.push('Machine', { id: retired.scrapped!.replacedBy })} hitSlop={8}>
                  <Text style={[styles.link, { marginTop: SIZES.xs }]}>{`Replaced by ${allMachines.find((m) => m.id === retired.scrapped!.replacedBy)!.serial ? `S/N ${allMachines.find((m) => m.id === retired.scrapped!.replacedBy)!.serial}` : 'the new unit'} →`}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : !canPlan ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{PLAN_LOCKED}</Text> : null}
          {before.length ? (
            <View style={[styles.card, { marginBottom: SIZES.md }]}>
              <Text style={styles.sub}>{existing?.installed ? `Fitted ${formatDate(existing.installed)} — it replaced:` : 'It replaced:'}</Text>
              {before.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => nav.push('Machine', { id: m.id })} hitSlop={6}>
                  <Text style={[styles.link, { marginTop: 2 }]}>{`${m.serial ? `S/N ${m.serial}` : m.name}${m.scrapped ? ` · scrapped ${formatDate(m.scrapped.date)} — ${m.scrapped.reason}` : ''} · its history →`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <View pointerEvents={canPlan ? 'auto' : 'none'} style={!canPlan && { opacity: 0.6 }}>
          <Label>Department</Label>
          <View style={styles.depts}>
            {DEPTS.map((d) => (
              <TouchableOpacity key={d.key} style={[styles.dept, deptOf(draft) === d.key && styles.deptOn]} onPress={() => set({ dept: d.key })}>
                <Text style={[styles.deptText, deptOf(draft) === d.key && styles.deptTextOn]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Name ★" value={draft.name} onChange={(v) => set({ name: v })} placeholder={deptOf(draft) === 'engineering' ? 'Main engine PS' : 'Tender, Galley, Wi-Fi network…'} />
          <Field label="Location" value={draft.location} onChange={(v) => set({ location: v })} placeholder="Engine room" />
          <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
            <View style={{ flex: 1 }}><Field label="Maker" value={draft.maker} onChange={(v) => set({ maker: v })} /></View>
            <View style={{ flex: 1 }}><Field label="Model" value={draft.model} onChange={(v) => set({ model: v })} /></View>
          </View>
          <Field label="Serial" value={draft.serial} onChange={(v) => set({ serial: v })} />

          <View style={styles.counterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Running-hours counter</Text>
              <Text style={styles.sub}>Off for systems serviced by the calendar only — galley, network, hull.</Text>
            </View>
            <Switch value={hasCounter(draft)} onValueChange={(v) => set({ counter: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          <View style={styles.counterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Critical equipment</Text>
              <Text style={styles.sub}>Steering, propulsion, fire-fighting, safety systems — its jobs are done on time and cannot be deferred.</Text>
            </View>
            <Switch value={!!draft.critical} onValueChange={(v) => set({ critical: v })} trackColor={{ true: COLORS.danger, false: COLORS.border }} />
          </View>
          <View style={styles.counterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Class item</Text>
              <Text style={styles.sub}>Surveyed by class (continuous survey of machinery) — its jobs count as class evidence.</Text>
            </View>
            <Switch value={!!draft.classItem} onValueChange={(v) => set({ classItem: v || undefined })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {draft.classItem ? <Field label="Class code" value={draft.classCode} onChange={(v) => set({ classCode: v })} placeholder="The society's item code" /> : null}
          </View>

          {hasCounter(draft) ? (
          <View style={styles.card}>
            <Label>Running hours</Label>
            <Text style={styles.hours}>
              {(existing ?? draft).hours != null ? `${(existing ?? draft).hours} h` : 'No reading yet'}
            </Text>
            <Text style={styles.sub}>
              {[
                (existing ?? draft).hoursDate ? `read ${formatDate((existing ?? draft).hoursDate!)}` : null,
                rate ? `≈ ${Math.round(rate * 10) / 10} h a day` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.readRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                value={reading}
                onChangeText={setReading}
                placeholder="Today's counter"
                placeholderTextColor={COLORS.textLight}
                keyboardType="decimal-pad"
              />
              <TouchableOpacity style={styles.btn} onPress={onReading}>
                <Text style={styles.btnText}>Save reading</Text>
              </TouchableOpacity>
            </View>
            {offset ? <Text style={styles.sub}>{`Counter replaced: ${offset} h are added to what it shows.`}</Text> : null}
            {doubt ? (
              <View style={styles.doubt}>
                <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{`⚠ ${doubt.total} h — ${doubt.why}`}</Text>
                <TextInput style={[styles.input, { marginTop: SIZES.xs }]} value={doubtReason} onChangeText={setDoubtReason} placeholder="Reason ★ — counter misread last time, engine on shore power test…" placeholderTextColor={COLORS.textLight} />
                <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center', marginTop: SIZES.xs }}>
                  <TouchableOpacity style={styles.btn} onPress={() => (doubtReason.trim().length < 3 ? Alert.alert('Reason', 'Say why the reading is right.') : void putReading(doubt.total, doubtReason.trim()))}>
                    <Text style={styles.btnText}>Save with the reason</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDoubt(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            ) : null}
            {replacing != null ? (
              <View style={styles.doubt}>
                <Text style={styles.sub}>{`The machine is at ${(existing ?? draft).hours ?? 0} h. What does the new counter show now? The difference is added to it from now on, so the jobs keep their due hours.`}</Text>
                <View style={[styles.readRow, { marginTop: SIZES.xs }]}>
                  <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={replacing} onChangeText={setReplacing} placeholder="New counter shows, h" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                  <TouchableOpacity style={styles.btn} onPress={() => void onReplaced()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setReplacing(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
              </View>
            ) : (existing ?? draft).hours != null ? (
              <TouchableOpacity onPress={() => setReplacing('')} hitSlop={8}><Text style={[styles.link, { marginTop: SIZES.xs }]}>Counter replaced…</Text></TouchableOpacity>
            ) : null}
            {((existing ?? draft).readings ?? []).filter((r) => r.reason).slice(-3).map((r) => (
              <Text key={`${r.date}-${r.hours}-${r.reason}`} style={styles.sub}>{`${formatDate(r.date)} · ${r.hours} h — ${r.reason}${r.by ? ` (${r.by})` : ''}`}</Text>
            ))}
          </View>
          ) : null}

          {(() => {
            const lc = lastCondition(id, pmsDone);
            return lc ? (
              <Text style={[styles.sub, { marginTop: SIZES.sm, fontWeight: '700', color: lc.conditionAfter === 'out' || lc.conditionAfter === 'poor' ? COLORS.warning : COLORS.textDark }]}>
                {`Last condition: ${CONDITION[lc.conditionAfter!]} · ${formatDate(lc.date)} · ${lc.jobTitle}`}
              </Text>
            ) : null;
          })()}
          <View style={styles.jobsHead}>
            <Label>{`Jobs (${jobs.length})`}</Label>
            <View pointerEvents={canPlan ? 'auto' : 'none'} style={[{ flexDirection: 'row', gap: SIZES.md }, !canPlan && { opacity: 0.35 }]}>
              <TouchableOpacity onPress={() => setShowTypes((v) => !v)} hitSlop={8}>
                <Text style={styles.link}>Typical jobs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (await saveDetails()) nav.navigate('PmsJob', { id: uid('job'), machineId: id, isNew: true });
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>+ Add job</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (await saveDetails()) nav.navigate('PmsJob', { id: uid('job'), machineId: id, isNew: true, oneOff: true });
                }}
                hitSlop={8}
              >
                <Text style={styles.link}>+ One-off</Text>
              </TouchableOpacity>
            </View>
          </View>
          {showTypes ? (
            <View style={styles.types}>
              <Text style={styles.sub}>Adds the usual jobs for this kind of system, without a last-done date. Check each interval against the maker's manual.</Text>
              {CATALOGUE.filter((t) => t.dept === deptOf(draft)).map((t) => (
                <TouchableOpacity key={t.key} style={styles.type} onPress={() => addTypical(t.key)}>
                  <Text style={styles.typeText}>{`${t.label} · ${t.jobs.length} jobs`}</Text>
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
                  <Text style={styles.sub} numberOfLines={2}>{`${scheduleText(j)} · ${dueText(d)}`}</Text>
                </View>
                {d.status !== 'none' ? <StatusPill status={d.status} /> : null}
              </TouchableOpacity>
            );
          })}

          {fitting.length ? <Label>{`Spares for this machine (${fitting.length})`}</Label> : null}
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
            <Label>{`Open defects (${defects.length})`}</Label>
            {!isNew ? (
              <TouchableOpacity onPress={() => nav.navigate('PmsDefect', { id: uid('new'), machineId: id })} hitSlop={8}>
                <Text style={styles.link}>+ Report defect</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {defects.map((x) => (
            <TouchableOpacity key={x.id} style={styles.row} onPress={() => nav.navigate('PmsDefect', { id: x.id })} activeOpacity={0.7}>
              <View style={[styles.bar, { backgroundColor: categoryColor(COLORS, x.category) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{x.description}</Text>
                <Text style={styles.sub}>{`${DEFECT_CATEGORY[x.category]} · ${formatDate(x.date)} · ${x.by}`}</Text>
              </View>
            </TouchableOpacity>
          ))}

          {!isNew ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md }}>
              <TouchableOpacity
                onPress={() =>
                  void exportPmsHistory('Maintenance history', `Maintenance history-${draft.name}`, vessel, [machineHistory(existing ?? draft, pmsJobs, pmsDone, pmsDeferrals, pmsDefects, today)])
                    .then((w) => typeof w === 'string' && setHistSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`))
                    .catch((e) => Alert.alert('History', String(e?.message ?? e)))
                }
                hitSlop={8}
              >
                <Text style={styles.link}>History for the surveyor (PDF)</Text>
              </TouchableOpacity>
              {histSaved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${histSaved}`}</Text> : null}
            </View>
          ) : null}

          <View style={styles.jobsHead}>
            <Label>{history.length ? 'Recent work' : 'Work done'}</Label>
            {!isNew ? (
              <TouchableOpacity onPress={() => nav.navigate('PmsJob', { id: uid('srv'), machineId: id, unplanned: true })} hitSlop={8}>
                <Text style={styles.link}>+ Unplanned work</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {history.map((h) => (
            <View key={h.id} style={[styles.hist, h.cancelled && { opacity: 0.6 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                <Text style={[styles.rowTitle, { flex: 1 }, h.cancelled && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{`${h.unplanned ? 'Unplanned · ' : ''}${h.jobTitle}`}</Text>
                {!h.cancelled && cancellable(h) ? (
                  <TouchableOpacity disabled={!isMaster} style={!isMaster && { opacity: 0.35 }} onPress={() => cancelDone(h)} hitSlop={8}>
                    <Text style={[styles.link, { color: COLORS.danger }]}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {h.cancelled ? <Text style={[styles.sub, { color: COLORS.danger }]}>{`Cancelled — ${h.editReason ?? ''} · ${h.editedByRank ? `${h.editedBy} (${h.editedByRank})` : h.editedBy ?? ''}`}</Text> : null}
              <Text style={styles.sub}>
                {[formatDate(h.date), h.hours != null ? `${h.hours} h` : null, conditionText(h) || null, h.manHours != null ? `${h.manHours} man-h` : null, h.doneBy ? `done by ${h.doneBy}${h.doneByRank ? ` (${h.doneByRank})` : ''}` : null, h.doneBy ? `signed out by ${h.byRank ? `${h.by} (${h.byRank})` : h.by}` : h.byRank ? `${h.by} (${h.byRank})` : h.by].filter(Boolean).join(' · ')}
              </Text>
              {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
              {h.photos?.length ? (
                <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.xs, flexWrap: 'wrap' }}>
                  {h.photos.map((p) => <EvidencePhoto key={p.id} vessel={vessel?.imo ?? ''} inspectionId={h.supersedes ?? h.id} photo={p} />)}
                </View>
              ) : null}
            </View>
          ))}

          {!isNew && canPlan ? (
            <View style={[styles.jobsHead, { marginTop: SIZES.lg, justifyContent: 'flex-start', gap: SIZES.lg, flexWrap: 'wrap' }]}>
              <TouchableOpacity onPress={() => void onCopy()} hitSlop={8}><Text style={styles.link}>Copy this system</Text></TouchableOpacity>
              {jobs.some((j) => !j.oneOff) ? (
                <TouchableOpacity onPress={() => setCopyTo(copyTo ? null : new Set())} hitSlop={8}><Text style={styles.link}>Copy jobs to…</Text></TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => setRetire(retire ? null : { date: today, reason: '', replace: true, serial: '', hours: '0' })} hitSlop={8}>
                <Text style={[styles.link, { color: COLORS.danger }]}>Scrap / replace…</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {copyTo ? (
            <View style={styles.types}>
              <Text style={styles.sub}>Its recurring jobs are added to the systems ticked — not yet done; a job a system already has by that name is skipped.</Text>
              {machines.filter((m) => m.id !== id).sort((a, b) => Number(deptOf(b) === deptOf(draft)) - Number(deptOf(a) === deptOf(draft)) || a.name.localeCompare(b.name)).map((m) => {
                const on = copyTo.has(m.id);
                return (
                  <TouchableOpacity key={m.id} style={[styles.type, on && { backgroundColor: COLORS.primary }]} onPress={() => { const n = new Set(copyTo); if (on) n.delete(m.id); else n.add(m.id); setCopyTo(n); }}>
                    <Text style={[styles.typeText, on && { color: COLORS.textWhite }]}>{`${on ? '✓ ' : ''}${m.name}`}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center' }}>
                <TouchableOpacity style={styles.btn} onPress={() => void onCopyJobs()}><Text style={styles.btnText}>{`Copy to ${copyTo.size}`}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCopyTo(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}
          {retire ? (
            <View style={[styles.doubt, { borderColor: COLORS.danger }]}>
              <Text style={styles.sub}>Off the plan, with its history kept under Scrapped. Its jobs come off the due lists.</Text>
              <View style={styles.readRow}>
                <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={retire.date} onChangeText={(v) => setRetire({ ...retire, date: v })} placeholder="Date yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
              </View>
              <TextInput style={styles.input} value={retire.reason} onChangeText={(v) => setRetire({ ...retire, reason: v })} placeholder="Reason ★ — worn out, failed, replaced at refit…" placeholderTextColor={COLORS.textLight} />
              <View style={styles.counterRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Replaced by a new unit</Text>
                  <Text style={styles.sub}>A new record takes its place and its jobs, counted from the day it was fitted. The old unit's history stays its own.</Text>
                </View>
                <Switch value={retire.replace} onValueChange={(v) => setRetire({ ...retire, replace: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
              </View>
              {retire.replace ? (
                <View style={styles.readRow}>
                  <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={retire.serial} onChangeText={(v) => setRetire({ ...retire, serial: v })} placeholder="New unit's serial" placeholderTextColor={COLORS.textLight} />
                  {hasCounter(draft) ? (
                    <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={retire.hours} onChangeText={(v) => setRetire({ ...retire, hours: v })} placeholder="Its counter, h" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                  ) : null}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center', marginTop: SIZES.sm }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => void onRetire()}>
                  <Text style={styles.btnText}>{retire.replace ? 'Scrap and fit the new unit' : 'Scrap'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRetire(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}

          {!retired ? (
            <TouchableOpacity disabled={!canPlan} style={[styles.deleteBtn, !canPlan && { opacity: 0.35 }]} onPress={onDelete}>
              <Text style={styles.deleteText}>{isNew ? 'Discard' : hasHistory ? 'Remove (no history only)' : 'Remove — entered by mistake'}</Text>
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
