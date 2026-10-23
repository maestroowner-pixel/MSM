// ===================================
// One maintenance job — its interval, when it was last done, and "Done".
//
// "Done" signs a completion record (append-only, types/pms.ts) and moves the
// job's baseline to that date and counter reading in the same step. The signer
// is the person this device belongs to when it has joined a vessel; otherwise
// it is picked from the crew list, as for an inspection.
//
// A counter reading entered here that is higher than the machine's last one
// also becomes the machine's reading: the engineer has just read the counter,
// and asking for it twice is how the two figures drift apart.
//
// With the Spares module on, a job lists the parts it takes each time, and
// "Done" takes them out of the stores in the same step — the quantities can be
// changed or zeroed on the day, because the impeller turned out to be fine.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label, StatusPill } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CONDITION, Condition, DEFECT_CATEGORY, DefectCategory, JOB_TYPE, JobType, PmsDefect, PmsDone, PmsJob, PmsPrepared, hasCounter } from '../types/pms';
import { Attachment } from '../types/equipment';
import { PhotoPicker } from '../components/PhotoPicker';
import * as photoQueue from '../services/photoQueue';
import { Dropdown } from '../components/Dropdown';
import * as storage from '../services/storage';
import { crewLabel } from '../types/crew';
import { personName, plansPms, roleAtLeast } from '../types/role';
import { activeDeferral, dueLabel, jobAfter, jobCycle, jobDue, todayIso, withReading , noteForNext } from '../services/pms';
import { movesForJob, qtyText, stockByPart } from '../services/spares';
import { JobPart } from '../types/spares';
import { moduleOn } from '../constants/modules';
import { PERMIT_TYPES } from '../constants/permitTypes';
import { jobGate } from '../services/jobGate';
import { JOB_FIELDS, changeTextUi, fieldName, planDiff, withChanges } from '../services/planLog';
import { useSignConfirm } from '../components/SignConfirm';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, useT } from '../utils/i18n';

const DAY_CHIPS = [7, 30, 90, 180, 365, 730];
// CONDITION / JOB_TYPE / DEFECT_CATEGORY (types/pms) stay English for records and PDFs; the screen shows them translated.
const condName = (c: Condition) => tk(`pms.cond.${c}`);

export default function PmsJobSc() {
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { pmsJobs, pmsDone, pmsDefects, machines, crew, spares, spareMoves, savePmsJob, saveMachine, completePmsJob, pmsDeferrals, appendRow, saveRow, vessel, permits, docs, docAcks, pmsProjects } = useData();
  // Evidence at closure, and a defect found doing the job (ISM 10.1).
  const [donePhotos, setDonePhotos] = useState<Attachment[]>([]);
  const [defect, setDefect] = useState<{ category: DefectCategory; description: string } | null>(null);
  const sparesOn = moduleOn('spares');
  const partById = useMemo(() => new Map(spares.map((p) => [p.id, p])), [spares]);
  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);
  const [pickPart, setPickPart] = useState(false);
  /** Quantities to take on "Done", by part id; starts from the job's list. */
  const [take, setTake] = useState<Record<string, number>>({});
  const sync = useSync();
  const confirmSign = useSignConfirm();

  const id: string = route.params?.id;
  const existing = pmsJobs.find((j) => j.id === id);
  const machineId: string = existing?.machineId ?? route.params?.machineId;
  const machine = machines.find((m) => m.id === machineId);
  const isNew = !existing;
  // Work done that was not in the plan — recorded and signed straight away, no job behind it.
  const unplanned = !!route.params?.unplanned;
  // Calendar-only systems (galley, network, hull) have no counter to ask about.
  const counter = machine ? hasCounter(machine) : true;

  const [draft, setDraft] = useState<PmsJob>(
    existing ?? {
      id, machineId, title: route.params?.title ?? '',
      ...(route.params?.oneOff ? { oneOff: true } : {}),
      ...(route.params?.defectId ? { defectId: route.params.defectId } : {}),
      updatedAt: Date.now(),
    }
  );
  const touched = useRef(false);
  useEffect(() => {
    if (existing && !touched.current) setDraft(existing);
  }, [existing]);
  useEffect(() => {
    if (machine?.hours != null && !doneHoursTouched.current) setDoneHours(String(machine.hours));
  }, [machine?.hours]);
  const set = (p: Partial<PmsJob>) => {
    touched.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };

  const [doing, setDoing] = useState(unplanned);
  const [doneDate, setDoneDate] = useState(todayIso());
  const [doneHours, setDoneHoursRaw] = useState(machine?.hours != null ? String(machine.hours) : '');
  const doneHoursTouched = useRef(false);
  const setDoneHours = (v: string) => setDoneHoursRaw(v);
  const [doneNote, setDoneNote] = useState('');
  // The fuller sign-out (TM Master comparison): condition before / after, man-hours, a word for next time.
  const [condBefore, setCondBefore] = useState<Condition | null>(null);
  const [condAfter, setCondAfter] = useState<Condition | null>(null);
  const [manHours, setManHours] = useState('');
  const [nextNote, setNextNote] = useState('');
  const people = useMemo(() => crew.filter((c) => c.active), [crew]);
  const me = sync.me ? personName(sync.me) : '';
  const meRank = sync.me?.position;
  const [signerId, setSignerId] = useState<string | undefined>();
  const signer = me ? { name: me, rank: meRank } : people.find((p) => p.id === signerId);

  const deferral = existing ? activeDeferral(existing, pmsDeferrals) : undefined;
  const linkedDefect = draft.defectId ? pmsDefects.find((d) => d.id === draft.defectId) : undefined;
  // What the job needs before it is signed out: its permit, its documents read by the signer.
  const signerKey = me && sync.me ? `device:${sync.me.id}` : signerId;
  const gate = existing && !unplanned
    ? jobGate(existing, { permits, done: pmsDone, docs, acks: docAcks, personKey: signerKey, ptwOn: moduleOn('ptw'), docsOn: moduleOn('docs') })
    : { permitMissing: false, unread: [] as typeof docs };
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const canPlan = plansPms(sync.enrolled, sync.role);
  const [defer, setDefer] = useState<{ date: string; hours: string; reason: string; projectId?: string } | null>(null);
  const signDeferral = async () => {
    if (!existing || !defer) return;
    if (machine?.critical) return Alert.alert(t('mch.critical'), t('pj.noDeferCritical'));
    const untilHours = num(defer.hours);
    if (!defer.date && untilHours == null) return Alert.alert(t('pj.deferUntil'), t('pj.giveDateOrCounter'));
    if (defer.date && defer.date < todayIso()) return Alert.alert(t('pj.deferUntil'), t('pj.datePast'));
    if (defer.reason.trim().length < 3) return Alert.alert(t('pj.reason'), t('pj.sayWhyDeferred'));
    if (!signer) return Alert.alert(t('sign.who'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: me && sync.me ? `device:${sync.me.id}` : signerId ?? signer.name, name: signer.name, ownDevice: !!me, what: `Defer "${existing.title}" — ${defer.reason.trim()}` });
    if (!sig) return;
    const now = Date.now();
    await appendRow(storage.PMS_DEFERRALS_KEY, {
      id: uid('dfr'), jobId: existing.id, machineId, jobTitle: existing.title, machineName: machine?.name ?? '', cycle: jobCycle(existing),
      ...(defer.projectId ? { projectId: defer.projectId } : {}),
      ...(defer.date ? { untilDate: defer.date } : {}), ...(untilHours != null ? { untilHours } : {}),
      reason: defer.reason.trim(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
    });
    setDefer(null);
    playSuccessSound();
  };
  const due = jobDue(existing ?? draft, machine, undefined, deferral);
  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return v.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const onSave = async () => {
    if (!canPlan) return Alert.alert(t('pj.maintPlan'), t('pms.planLocked'));
    if (!draft.title.trim()) return Alert.alert(t('pj.titleRequired'), t('pj.titleHint'));
    if (draft.oneOff) {
      if (!draft.dueDate && draft.dueHours == null) return Alert.alert(t('pj.due'), counter ? t('pj.dueGiveBoth') : t('pj.dueGiveDate'));
    } else if (!draft.intervalHours && !draft.intervalDays) return Alert.alert(t('pj.interval'), counter ? t('pj.intervalBoth') : t('pj.intervalDays'));
    if (!draft.oneOff && draft.fixed && draft.intervalDays && !draft.anchorDate) return Alert.alert(t('pj.fixedSchedule'), t('pj.fixedNeedDate'));
    const { intervalHours, intervalDays, dueDate, dueHours, fixed, anchorDate, anchorHours, warnDays, warnHours, ...rest } = draft;
    const clean: PmsJob = draft.oneOff
      ? { ...rest, ...(dueDate ? { dueDate } : {}), ...(dueHours != null ? { dueHours } : {}) }
      : {
          ...rest,
          ...(intervalHours ? { intervalHours } : {}),
          ...(intervalDays ? { intervalDays } : {}),
          ...(fixed ? { fixed: true, ...(anchorDate && intervalDays ? { anchorDate } : {}), ...(anchorHours != null && intervalHours ? { anchorHours } : {}) } : {}),
          ...(warnDays != null ? { warnDays } : {}),
          ...(warnHours != null ? { warnHours } : {}),
        };
    const next = { ...clean, title: draft.title.trim() };
    // The change log (services/planLog.ts): an interval, a due date, class or permit changed says why.
    const diff = planDiff(existing, next, JOB_FIELDS);
    if (diff.some((d) => d.needsReason) && changeReason.trim().length < 3) return Alert.alert(t('pj.reasonChange'), t('pj.reasonChangeBody', { what: diff.filter((d) => d.needsReason).map((d) => fieldName(d.field).toLowerCase()).join(', ') }));
    const now = Date.now();
    await savePmsJob({ ...next, ...(diff.length ? { changes: withChanges(existing?.changes, diff, { by: me || 'Master', ...(meRank ? { byRank: meRank } : {}) }, changeReason, now) } : {}), updatedAt: now });
    playSuccessSound();
    goBackOr(nav);
  };
  const [changeReason, setChangeReason] = useState('');
  const [showLog, setShowLog] = useState(false);

  // ---- Done, then signed (TM Master comparison, item 5) ----
  // Anyone may write a job up as done; an officer (or the Master) signs it out —
  // reviewing what was written, adding photos, and signing. Their name signs; the
  // name of whoever did the work goes with it (PmsDone.doneBy).
  const isOfficer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [preparedBy, setPreparedBy] = useState<PmsPrepared | null>(null);
  const startDoing = () => {
    const pr = existing?.prepared;
    if (pr) {
      setDoneDate(pr.date);
      if (pr.hours != null) setDoneHours(String(pr.hours));
      setDoneNote(pr.note ?? '');
      setCondBefore(pr.conditionBefore ?? null);
      setCondAfter(pr.conditionAfter ?? null);
      setManHours(pr.manHours != null ? String(pr.manHours) : '');
      setNextNote(pr.nextNote ?? '');
      setTake(pr.take ?? {});
      setPreparedBy(pr);
    } else setTake(Object.fromEntries((existing?.parts ?? []).map((p) => [p.partId, p.qty])));
    setDoing(true);
  };
  /** The last sign-out of this job, to start from when the work was the same. */
  const lastDone = useMemo(
    () => (existing ? pmsDone.filter((d) => d.jobId === existing.id && !d.cancelled).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)[0] : undefined),
    [existing, pmsDone]
  );
  const copyLast = () => {
    if (!lastDone) return;
    setDoneNote(lastDone.note ?? '');
    setCondBefore(lastDone.conditionBefore ?? null);
    setCondAfter(lastDone.conditionAfter ?? null);
    setManHours(lastDone.manHours != null ? String(lastDone.manHours) : '');
  };
  const onPrepare = async () => {
    if (!existing) return;
    if (!signer) return Alert.alert(t('nc.whoDid'), t('round.chooseName'));
    const hours = num(doneHours);
    if (counter && (existing.intervalHours || existing.dueHours != null) && hours == null) return Alert.alert(t('pj.counter'), t('pj.enterCounter'));
    if (doneDate > todayIso()) return Alert.alert(t('pj.date'), t('pj.dateFuture'));
    const mh = num(manHours);
    if (manHours.trim() && mh == null) return Alert.alert(t('pj.manHours'), t('pj.manHoursNum'));
    const pr: PmsPrepared = {
      date: doneDate, ...(hours != null ? { hours } : {}), ...(doneNote.trim() ? { note: doneNote.trim() } : {}),
      ...(condBefore ? { conditionBefore: condBefore } : {}), ...(condAfter ? { conditionAfter: condAfter } : {}),
      ...(mh != null ? { manHours: mh } : {}), ...(nextNote.trim() ? { nextNote: nextNote.trim() } : {}),
      ...(Object.keys(take).length ? { take } : {}),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(),
    };
    await savePmsJob({ ...existing, prepared: pr, updatedAt: Date.now() });
    playSuccessSound();
    goBackOr(nav);
  };

  const setJobParts = (parts: JobPart[]) => set({ parts });
  const bumpJobPart = (partId: string, by: number) => {
    const parts = draft.parts ?? [];
    const cur = parts.find((p) => p.partId === partId);
    const qty = Math.max(0, (cur?.qty ?? 0) + by);
    setJobParts(qty === 0 ? parts.filter((p) => p.partId !== partId) : cur ? parts.map((p) => (p.partId === partId ? { ...p, qty } : p)) : [...parts, { partId, qty }]);
  };

  const onDone = async () => {
    if (!existing && !unplanned) return Alert.alert(t('pj.saveFirst'), t('pj.saveFirstBody'));
    const jobTitle = unplanned ? draft.title.trim() : existing!.title;
    if (!jobTitle) return Alert.alert(t('pj.whatDoneQ'), t('pj.whatDoneHint'));
    if (unplanned && !doneNote.trim()) return Alert.alert(t('pj.report'), t('pj.reportHint'));
    if (!signer) return Alert.alert(t('nc.whoDid'), t('round.chooseName'));
    const hours = num(doneHours);
    if (counter && (existing?.intervalHours || existing?.dueHours != null) && hours == null) return Alert.alert(t('pj.counter'), t('pj.enterCounter'));
    if (doneDate > todayIso()) return Alert.alert(t('pj.date'), t('pj.dateFuture'));
    if (machine?.critical && !donePhotos.length) return Alert.alert(t('pj.evidence'), t('pj.evidenceHint'));
    if (defect && defect.description.trim().length < 3) return Alert.alert(t('pj.defect'), t('pj.defectHint'));
    if (gate.permitMissing) return Alert.alert(t('pj.permitToWork'), t('pj.permitNeeded', { type: existing!.permitType ? tk(`ptw.kind.${existing!.permitType}`) : '' }));
    if (gate.unread.length) return Alert.alert(t('pj.readFirst'), t('pj.notRead', { name: signer.name, docs: gate.unread.map((d) => t('pj.docRev', { doc: d.title, rev: d.revision })).join(', ') }));
    if (condAfter === 'out' && !defect) return Alert.alert(t('pj.outOfService'), t('pj.outIsDefect'));
    const mh = num(manHours);
    if (manHours.trim() && mh == null) return Alert.alert(t('pj.manHours'), t('pj.manHoursNum'));
    const sig = await confirmSign({
      personKey: me && sync.me ? `device:${sync.me.id}` : signerId ?? signer.name,
      name: signer.name,
      ownDevice: !!me,
      what: unplanned ? `Unplanned work on ${machine?.name ?? 'the machine'}: ${jobTitle}` : `Record "${jobTitle}" as done`,
    });
    if (!sig) return;
    const done: PmsDone = {
      id: uid('done'),
      jobId: unplanned ? 'unplanned' : existing!.id,
      machineId,
      jobTitle,
      ...(unplanned ? { unplanned: true } : {}),
      ...(existing?.defectId ? { forDefectId: existing.defectId } : {}),
      machineName: machine?.name ?? '',
      date: doneDate,
      hours,
      by: signer.name,
      byRank: signer.rank,
      ...(preparedBy && preparedBy.by !== signer.name ? { doneBy: preparedBy.by, ...(preparedBy.byRank ? { doneByRank: preparedBy.byRank } : {}) } : {}),
      note: doneNote.trim() || undefined,
      ...(existing?.lastDoneDate ? { prevLastDoneDate: existing.lastDoneDate } : {}),
      ...(existing?.lastDoneHours != null ? { prevLastDoneHours: existing.lastDoneHours } : {}),
      ...(gate.permit ? { permitId: gate.permit.id, ...(gate.permit.no ? { permitNo: gate.permit.no } : {}) } : {}),
      ...(condBefore ? { conditionBefore: condBefore } : {}),
      ...(condAfter ? { conditionAfter: condAfter } : {}),
      ...(mh != null ? { manHours: mh } : {}),
      ...(nextNote.trim() ? { nextNote: nextNote.trim() } : {}),
      at: Date.now(),
      ...(sig.proof ? { signedWith: sig.proof } : {}),
      ...(donePhotos.length ? { photos: donePhotos } : {}),
      updatedAt: Date.now(),
    };
    const found: PmsDefect | null = defect
      ? {
          id: uid('dft'), machineId, machineName: machine?.name ?? '', ...(existing ? { jobId: existing.id } : {}), jobTitle, doneId: done.id,
          category: defect.category, description: defect.description.trim(), date: doneDate,
          by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: done.at, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: done.at,
        }
      : null;
    if (found) done.defectId = found.id;
    const moves = sparesOn
      ? movesForJob(
          Object.entries(take).map(([partId, qty]) => ({ partId, qty })),
          partById,
          stock,
          { by: signer.name, byRank: signer.rank },
          doneDate,
          { doneId: done.id, jobTitle, machineName: machine?.name ?? '' }
        )
      : [];
    if (existing) await completePmsJob(done, { ...jobAfter(existing, done), ...(existing.prepared ? { prepared: null } : {}) }, moves);
    else {
      await appendRow(storage.PMS_DONE_KEY, done);
      for (const mv of moves) await appendRow(storage.SPARE_MOVES_KEY, mv);
    }
    if (found) await saveRow(storage.PMS_DEFECTS_KEY, found);
    if (donePhotos.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, done);
    if (machine && hours != null && (machine.hours == null || hours > machine.hours)) {
      await saveMachine(withReading(machine, doneDate, hours));
    }
    playSuccessSound();
    goBackOr(nav);
  };

  const onDelete = () => {
    if (isNew) return goBackOr(nav);
    Alert.alert(t('pj.removeTitle'), t('pj.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.remove'),
        style: 'destructive',
        onPress: async () => {
          await savePmsJob({ ...existing!, deleted: true, updatedAt: Date.now() });
          goBackOr(nav);
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => (doing && !unplanned ? setDoing(false) : goBackOr(nav))} />
          <Text style={styles.headerTitle} numberOfLines={1}>{unplanned ? t('pj.hUnplanned') : doing ? t('pj.hRecord') : isNew ? (draft.oneOff ? t('pj.hNewOneOff') : t('pj.hNew')) : draft.oneOff ? t('pj.hOneOff') : t('pj.hJob')}</Text>
          {doing || canPlan ? (
            <TouchableOpacity onPress={doing ? onDone : onSave} hitSlop={12}>
              <Text style={styles.save}>{doing ? t('common.sign') : t('common.save')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <Text style={styles.machine}>{machine?.name ?? t('pj.machine')}</Text>
          {machine?.critical ? <Text style={styles.critical}>{t('pj.criticalCaps')}</Text> : null}
          {linkedDefect ? (
            <TouchableOpacity onPress={() => nav.navigate('PmsDefect', { id: linkedDefect.id })} hitSlop={8} style={{ marginBottom: SIZES.xs }}>
              <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('pj.corrective', { cat: tk(`pms.defcat.${linkedDefect.category}`), date: linkedDefect.date.split('-').reverse().join('.'), desc: linkedDefect.description })}</Text>
            </TouchableOpacity>
          ) : null}
          {!isNew ? (
            <View style={styles.dueRow}>
              {due.status !== 'none' ? <StatusPill status={due.status} /> : null}
              <Text style={styles.dueText}>{dueLabel(due)}</Text>
            </View>
          ) : null}
          {/* Deferral: the Master moves the job to a later date / counter reading, with the reason, signed. */}
          {!isNew && !doing && existing ? (
            deferral ? (
              <Text style={styles.deferNote}>{`${t('pj.deferred')}${deferral.untilDate ? t('pj.untilDate', { date: deferral.untilDate }) : ''}${deferral.untilHours != null ? t(deferral.untilDate ? 'pj.orHours' : 'pj.untilHours', { h: deferral.untilHours }) : ''} — ${deferral.reason} · ${deferral.byRank ? `${deferral.by} (${deferral.byRank})` : deferral.by}`}</Text>
            ) : machine?.critical ? (
              <Text style={styles.sub}>{t('pj.criticalNoDefer')}</Text>
            ) : defer ? (
              <View style={styles.deferBox}>
                {pmsProjects.filter((pj) => !pj.closedAt && pj.dueDate >= todayIso()).length ? (
                  <View style={[styles.chips, { marginTop: 0 }]}>
                    {pmsProjects.filter((pj) => !pj.closedAt && pj.dueDate >= todayIso()).map((pj) => (
                      <TouchableOpacity key={pj.id} style={[styles.chip, styles.chipSmall, defer.projectId === pj.id && styles.chipOn]} onPress={() => setDefer(defer.projectId === pj.id ? { ...defer, projectId: undefined } : { ...defer, projectId: pj.id, date: pj.dueDate, hours: '' })}>
                        <Text style={[styles.chipSmallText, defer.projectId === pj.id && styles.chipTextOn]}>{t('pj.toProject', { name: pj.name, date: pj.dueDate.split('-').reverse().join('.') })}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <Label>{t('pj.deferLabel')}</Label>
                <SimpleDatePicker label={t('pj.until')} value={defer.date} onChange={(v) => setDefer({ ...defer, date: v })} />
                {counter ? (
                  <TextInput style={[styles.input, { marginTop: SIZES.sm }]} value={defer.hours} onChangeText={(v) => setDefer({ ...defer, hours: v })} placeholder={t('pj.untilCounterPh')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                ) : null}
                <TextInput style={[styles.input, { marginTop: SIZES.sm, borderColor: COLORS.warning, borderWidth: 1 }]} value={defer.reason} onChangeText={(v) => setDefer({ ...defer, reason: v })} placeholder={t('pj.deferReasonPh')} placeholderTextColor={COLORS.textLight} />
                {!me ? (
                  <View style={styles.chips}>
                    {people.map((pp) => (
                      <TouchableOpacity key={pp.id} style={[styles.chip, styles.chipSmall, signerId === pp.id && styles.chipOn]} onPress={() => setSignerId(pp.id)}>
                        <Text style={[styles.chipSmallText, signerId === pp.id && styles.chipTextOn]}>{crewLabel(pp)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center', marginTop: SIZES.sm }}>
                  <TouchableOpacity style={styles.deferBtn} onPress={() => void signDeferral()}><Text style={styles.deferBtnText}>{t('pj.signDeferral')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setDefer(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity disabled={!isMaster} style={{ opacity: isMaster ? 1 : 0.35, alignSelf: 'flex-start' }} onPress={() => setDefer({ date: todayIso(), hours: '', reason: '' })}>
                <Text style={styles.link}>{t('pj.deferJob')}</Text>
              </TouchableOpacity>
            )
          ) : null}

          {doing ? (
            <>
              {!unplanned && existing && noteForNext(existing.id, pmsDone) ? (() => {
                const n = noteForNext(existing.id, pmsDone)!;
                return (
                  <View style={[styles.deferBox, { marginBottom: SIZES.md }]}>
                    <Text style={[styles.sub, { fontWeight: '800' }]}>{t('pj.fromLast', { date: n.date.split('-').reverse().join('.'), who: n.byRank ? `${n.by} (${n.byRank})` : n.by })}</Text>
                    <Text style={styles.signer}>{n.nextNote}</Text>
                  </View>
                );
              })() : null}
              {preparedBy ? (
                <View style={[styles.deferBox, { marginBottom: SIZES.md }]}>
                  <Text style={[styles.sub, { fontWeight: '800' }]}>{t('pj.writtenBy', { who: preparedBy.byRank ? `${preparedBy.by} (${preparedBy.byRank})` : preparedBy.by, date: preparedBy.date.split('-').reverse().join('.') })}</Text>
                  <Text style={styles.sub}>{t('pj.checkSign')}</Text>
                </View>
              ) : !unplanned && lastDone ? (
                <TouchableOpacity onPress={copyLast} hitSlop={8} style={{ marginBottom: SIZES.sm }}>
                  <Text style={styles.link}>{t('pj.sameAsLast', { date: lastDone.date.split('-').reverse().join('.') })}</Text>
                </TouchableOpacity>
              ) : null}
              {unplanned ? (
                <>
                  <Label>{t('pj.whatDone')}</Label>
                  <TextInput style={[styles.input, { marginBottom: SIZES.md }]} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder={t('pj.whatDonePh')} placeholderTextColor={COLORS.textLight} />
                </>
              ) : (
                <Text style={styles.jobTitle}>{existing?.title}</Text>
              )}
              <View style={{ marginBottom: SIZES.md }}>
                <SimpleDatePicker label={t('pj.doneOn')} value={doneDate} onChange={setDoneDate} />
              </View>
              {counter ? (<>
              <Label>{`${t('pj.counterReading')}${existing?.intervalHours ? ' ★' : ''}`}</Label>
              <TextInput
                style={styles.input}
                value={doneHours}
                onChangeText={(v) => {
                  doneHoursTouched.current = true;
                  setDoneHours(v);
                }}
                keyboardType="decimal-pad"
                placeholder={t('pj.hUnit')}
                placeholderTextColor={COLORS.textLight}
              />
              </>) : null}
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.condBA')}</Label>
              {(['before', 'after'] as const).map((w) => {
                const v = w === 'before' ? condBefore : condAfter;
                const setV = w === 'before' ? setCondBefore : setCondAfter;
                return (
                  <View key={w} style={[styles.chips, { marginTop: 4 }]}>
                    <Text style={[styles.sub, { width: 52 }]}>{w === 'before' ? t('pj.before') : t('pj.after')}</Text>
                    {(Object.keys(CONDITION) as Condition[]).map((c) => (
                      <TouchableOpacity key={c} style={[styles.chip, styles.chipSmall, v === c && { backgroundColor: c === 'out' || c === 'poor' ? COLORS.warning : COLORS.primary, borderColor: c === 'out' || c === 'poor' ? COLORS.warning : COLORS.primary }]} onPress={() => setV(v === c ? null : c)}>
                        <Text style={[styles.chipSmallText, v === c && styles.chipTextOn]}>{condName(c)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })}
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.manHours')}</Label>
              <TextInput style={[styles.input, { width: 140 }]} value={manHours} onChangeText={setManHours} keyboardType="decimal-pad" placeholder={t('pj.mhPh')} placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.noteDone')}</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={doneNote} onChangeText={setDoneNote} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.noteNext')}</Label>
              <TextInput style={[styles.input, { minHeight: 50 }]} value={nextNote} onChangeText={setNextNote} multiline placeholder={t('pj.noteNextPh')} placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
              <Label>{`${t('pj.photos')}${machine?.critical ? ' ★' : ''}`}</Label>
              <PhotoPicker photos={donePhotos} onChange={setDonePhotos} hint={machine?.critical ? t('pj.photoHintCrit') : t('pj.photoHint')} />
              <View style={{ height: SIZES.md }} />
              <TouchableOpacity style={styles.defectToggle} onPress={() => setDefect(defect ? null : { category: 'operational', description: '' })}>
                <Text style={[styles.defectBox, defect && { backgroundColor: COLORS.warning, color: COLORS.textWhite }]}>{defect ? '✓' : ''}</Text>
                <Text style={styles.signer}>{t('pj.foundDefect')}</Text>
              </TouchableOpacity>
              {defect ? (
                <View style={{ marginTop: SIZES.sm }}>
                  <View style={styles.chips}>
                    {(Object.keys(DEFECT_CATEGORY) as DefectCategory[]).map((c) => (
                      <TouchableOpacity key={c} style={[styles.chip, defect.category === c && styles.chipOn]} onPress={() => setDefect({ ...defect, category: c })}>
                        <Text style={[styles.chipText, defect.category === c && styles.chipTextOn]}>{tk(`pms.defcat.${c}`)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput style={[styles.input, { minHeight: 60, borderColor: COLORS.warning, borderWidth: 1 }]} value={defect.description} onChangeText={(v) => setDefect({ ...defect, description: v })} multiline placeholder={t('pj.defectPh')} placeholderTextColor={COLORS.textLight} />
                </View>
              ) : null}
              {existing?.permitType && moduleOn('ptw') ? (
                <View style={[styles.deferBox, { marginTop: SIZES.md }]}>
                  <Text style={[styles.sub, { fontWeight: '800' }]}>{t('pj.permitLine', { type: tk(`ptw.kind.${existing.permitType}`) })}</Text>
                  {gate.permit ? (
                    <TouchableOpacity onPress={() => nav.navigate('Permit', { id: gate.permit!.id })}>
                      <Text style={[styles.signer, { color: COLORS.success }]}>{`✓ ${gate.permit.no ?? t('pj.permit')} · ${gate.permit.status}`}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => nav.navigate('Permit', { id: uid('ptw'), isNew: true, type: existing.permitType, work: `${machine?.name ?? ''} — ${existing.title}`, location: machine?.location ?? '', pmsJobId: existing.id })}>
                      <Text style={[styles.signer, { color: COLORS.warning }]}>{t('pj.raisePermit')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}
              {gate.unread.length ? (
                <View style={[styles.deferBox, { marginTop: SIZES.md }]}>
                  <Text style={[styles.sub, { fontWeight: '800' }]}>{t('pj.readBefore')}</Text>
                  {gate.unread.map((d) => (
                    <TouchableOpacity key={d.id} onPress={() => nav.navigate('Doc', { id: d.id })}>
                      <Text style={[styles.signer, { color: COLORS.warning }]}>{t('pj.readDoc', { doc: d.title, rev: d.revision })}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.signedBy')}</Label>
              {me ? (
                <Text style={styles.signer}>{meRank ? `${me} (${meRank})` : me}</Text>
              ) : (
                <View style={styles.chips}>
                  {people.map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.chip, signerId === p.id && styles.chipOn]} onPress={() => setSignerId(p.id)}>
                      <Text style={[styles.chipText, signerId === p.id && styles.chipTextOn]}>{crewLabel(p)}</Text>
                    </TouchableOpacity>
                  ))}
                  {people.length === 0 ? <Text style={styles.sub}>{t('pj.crewEmpty')}</Text> : null}
                </View>
              )}
              {!unplanned && existing && !preparedBy ? (
                <TouchableOpacity style={[styles.deferBox, { marginTop: SIZES.md, alignItems: 'center' }]} onPress={() => void onPrepare()}>
                  <Text style={styles.link}>{t('pj.prepare')}</Text>
                  <Text style={styles.sub}>{t('pj.prepareHint')}</Text>
                </TouchableOpacity>
              ) : null}
              {sparesOn && Object.keys(take).length ? (
                <>
                  <View style={{ height: SIZES.md }} />
                  <Label>{t('pj.takenStores')}</Label>
                  {Object.entries(take).map(([partId, qty]) => {
                    const p = partById.get(partId);
                    if (!p) return null;
                    const have = stock.get(partId) ?? 0;
                    return (
                      <View key={partId} style={styles.partRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partName} numberOfLines={1}>{p.name}</Text>
                          <Text style={[styles.sub, qty > have && { color: COLORS.warning }]}>{`${t('pj.onHand', { qty: qtyText(have, p) })}${qty > have ? t('pj.lessThanNeeded') : ''}`}</Text>
                        </View>
                        <Stepper value={qty} onChange={(v) => setTake((tk0) => ({ ...tk0, [partId]: v }))} styles={styles} />
                      </View>
                    );
                  })}
                  <Text style={styles.sub}>{t('pj.setZero')}</Text>
                </>
              ) : null}
              <Text style={[styles.sub, { marginTop: SIZES.md }]}>{t('pj.signingNote')}</Text>
            </>
          ) : (
            <>
              {!canPlan ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{t('pms.planLocked')}</Text> : null}
              <View pointerEvents={canPlan ? 'auto' : 'none'} style={!canPlan && { opacity: 0.6 }}>
              {isNew ? (
                <View style={[styles.chips, { marginTop: 0, marginBottom: SIZES.sm }]}>
                  {[{ k: false, l: t('pj.recurring') }, { k: true, l: t('pj.oneOffCorr') }].map((o) => (
                    <TouchableOpacity key={o.l} style={[styles.chip, !!draft.oneOff === o.k && styles.chipOn]} onPress={() => set({ oneOff: o.k || undefined })}>
                      <Text style={[styles.chipText, !!draft.oneOff === o.k && styles.chipTextOn]}>{o.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Label>{t('pj.jobLabel')}</Label>
              <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder={t('pj.jobPh')} placeholderTextColor={COLORS.textLight} />
              <Dropdown caption={t('pj.typeCaps')} value={draft.type ?? ''} onChange={(v) => set({ type: (v || undefined) as JobType | undefined })} options={[{ value: '', label: '—' }, ...(Object.keys(JOB_TYPE) as JobType[]).map((k) => ({ value: k, label: tk(`pms.type.${k}`) }))]} style={{ marginTop: SIZES.sm }} />
              <View style={{ height: SIZES.md }} />
              {draft.oneOff ? (
                <>
                  <Label>{t('pj.mustBy')}</Label>
                  <SimpleDatePicker label={t('pj.date')} value={draft.dueDate} onChange={(v) => set({ dueDate: v })} />
                  {counter ? (
                    <TextInput style={[styles.input, { marginTop: SIZES.sm }]} value={draft.dueHours != null ? String(draft.dueHours) : ''} onChangeText={(v) => set({ dueHours: num(v) })} keyboardType="decimal-pad" placeholder={`${t('pj.byCounterPh')}${machine?.hours != null ? t('pj.nowH', { h: machine.hours }) : ''}`} placeholderTextColor={COLORS.textLight} />
                  ) : null}
                  <Text style={styles.sub}>{t('pj.oneOffNote')}</Text>
                </>
              ) : (<>
              {counter ? (<>
              <Label>{t('pj.everyHours')}</Label>
              <TextInput
                style={styles.input}
                value={draft.intervalHours != null ? String(draft.intervalHours) : ''}
                onChangeText={(v) => set({ intervalHours: num(v) })}
                keyboardType="number-pad"
                placeholder="250"
                placeholderTextColor={COLORS.textLight}
              />
              <View style={{ height: SIZES.md }} />
              </>) : null}
              <Label>{counter ? t('pj.orEveryDays') : t('pj.everyDays')}</Label>
              <TextInput
                style={styles.input}
                value={draft.intervalDays != null ? String(draft.intervalDays) : ''}
                onChangeText={(v) => set({ intervalDays: num(v) })}
                keyboardType="number-pad"
                placeholder="365"
                placeholderTextColor={COLORS.textLight}
              />
              <View style={styles.chips}>
                {DAY_CHIPS.map((days) => (
                  <TouchableOpacity key={days} style={[styles.chip, styles.chipSmall, draft.intervalDays === days && styles.chipOn]} onPress={() => set({ intervalDays: days })}>
                    <Text style={[styles.chipSmallText, draft.intervalDays === days && styles.chipTextOn]}>{tk(`pj.d.${days}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: SIZES.md }} />
              <TouchableOpacity style={styles.defectToggle} onPress={() => set({ classJob: !draft.classJob || undefined })}>
                <Text style={[styles.defectBox, { borderColor: COLORS.primary }, draft.classJob && { backgroundColor: COLORS.primary, color: COLORS.textWhite }]}>{draft.classJob ? '✓' : ''}</Text>
                <Text style={styles.signer}>{`${t('pj.classJob')}${machine?.classCode ? ` · ${machine.classCode}` : ''}`}</Text>
              </TouchableOpacity>
              {moduleOn('ptw') ? (
                <Dropdown caption={t('pj.requiresPermit')} value={draft.permitType ?? ''} onChange={(v) => set({ permitType: (v || undefined) as PmsJob['permitType'] })} options={[{ value: '', label: t('pj.none') }, ...PERMIT_TYPES.map((pt) => ({ value: pt.key, label: tk(`ptw.kind.${pt.key}`) }))]} style={{ marginTop: SIZES.sm }} />
              ) : null}
              {moduleOn('docs') && docs.length ? (
                <>
                  <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('pj.readBeforeDoing')}</Text>
                  <View style={styles.chips}>
                    {docs.map((d) => {
                      const on = (draft.docIds ?? []).includes(d.id);
                      return (
                        <TouchableOpacity key={d.id} style={[styles.chip, styles.chipSmall, on && styles.chipOn]} onPress={() => set({ docIds: on ? (draft.docIds ?? []).filter((x) => x !== d.id) : [...(draft.docIds ?? []), d.id] })}>
                          <Text style={[styles.chipSmallText, on && styles.chipTextOn]}>{`${d.docNo ? `${d.docNo} · ` : ''}${d.title}`}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}              <View style={{ height: SIZES.md }} />
              <TouchableOpacity style={styles.defectToggle} onPress={() => set({ fixed: !draft.fixed || undefined })}>
                <Text style={[styles.defectBox, { borderColor: COLORS.primary }, draft.fixed && { backgroundColor: COLORS.primary, color: COLORS.textWhite }]}>{draft.fixed ? '✓' : ''}</Text>
                <Text style={styles.signer}>{t('pj.fixedSchedule')}</Text>
              </TouchableOpacity>
              <Text style={styles.sub}>{t('pj.fixedNote')}</Text>
              {draft.fixed ? (
                <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-end', marginTop: SIZES.xs }}>
                  {draft.intervalDays ? (
                    <View style={{ flex: 1 }}>
                      <SimpleDatePicker label={t('pj.dueFrom')} value={draft.anchorDate} onChange={(v) => set({ anchorDate: v })} />
                    </View>
                  ) : null}
                  {counter && draft.intervalHours ? (
                    <View style={{ width: 160 }}>
                      <TextInput style={styles.input} value={draft.anchorHours != null ? String(draft.anchorHours) : ''} onChangeText={(v) => set({ anchorHours: num(v) })} keyboardType="decimal-pad" placeholder={t('pj.firstAtPh', { h: draft.intervalHours })} placeholderTextColor={COLORS.textLight} />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.warnBefore')}</Label>
              <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
                <TextInput style={[styles.input, { flex: 1 }]} value={draft.warnDays != null ? String(draft.warnDays) : ''} onChangeText={(v) => set({ warnDays: num(v) })} keyboardType="number-pad" placeholder={t('pj.warnDaysPh', { n: Math.max(1, Math.round((draft.intervalDays ?? 0) * 0.1)) })} placeholderTextColor={COLORS.textLight} />
                {counter ? (
                  <TextInput style={[styles.input, { flex: 1 }]} value={draft.warnHours != null ? String(draft.warnHours) : ''} onChangeText={(v) => set({ warnHours: num(v) })} keyboardType="number-pad" placeholder={t('pj.warnHoursPh', { n: Math.max(1, Math.round((draft.intervalHours ?? 0) * 0.1)) })} placeholderTextColor={COLORS.textLight} />
                ) : null}
              </View>
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.lastDone')}</Label>
              <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <SimpleDatePicker label={t('pj.date')} value={draft.lastDoneDate} onChange={(v) => set({ lastDoneDate: v })} />
                </View>
                {counter ? <View style={{ width: 120 }}>
                  <TextInput
                    style={styles.input}
                    value={draft.lastDoneHours != null ? String(draft.lastDoneHours) : ''}
                    onChangeText={(v) => set({ lastDoneHours: num(v) })}
                    keyboardType="decimal-pad"
                    placeholder={t('pj.atHPh')}
                    placeholderTextColor={COLORS.textLight}
                  />
                </View> : null}
              </View>
              <Text style={styles.sub}>{t('pj.lastDoneNote')}</Text>
              </>)}
              <View style={{ height: SIZES.md }} />
              <Label>{t('pj.notesPlan')}</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />

              {sparesOn ? (
                <>
                  <View style={styles.partsHead}>
                    <Label>{t('pj.partsEach')}</Label>
                    <TouchableOpacity onPress={() => setPickPart((v) => !v)} hitSlop={10}>
                      <Text style={styles.addPart}>{pickPart ? t('common.done') : t('pj.addPart')}</Text>
                    </TouchableOpacity>
                  </View>
                  {(draft.parts ?? []).map((jp) => {
                    const p = partById.get(jp.partId);
                    return (
                      <View key={jp.partId} style={styles.partRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partName} numberOfLines={1}>{p?.name ?? t('pj.removedStores')}</Text>
                          {p ? <Text style={styles.sub}>{`${t('pj.onHand', { qty: qtyText(stock.get(p.id) ?? 0, p) })}${p.partNo ? ` · ${p.partNo}` : ''}`}</Text> : null}
                        </View>
                        <Stepper value={jp.qty} onChange={(v) => bumpJobPart(jp.partId, v - jp.qty)} styles={styles} />
                      </View>
                    );
                  })}
                  {!(draft.parts ?? []).length && !pickPart ? (
                    <Text style={styles.sub}>{t('pj.addPartsHint')}</Text>
                  ) : null}
                  {pickPart ? (
                    <View style={styles.chips}>
                      {[...spares]
                        .filter((p) => !(draft.parts ?? []).some((jp) => jp.partId === p.id))
                        .sort((a, b) => Number(!(a.machineIds ?? []).includes(machineId)) - Number(!(b.machineIds ?? []).includes(machineId)) || a.name.localeCompare(b.name))
                        .map((p) => (
                          <TouchableOpacity key={p.id} style={[styles.chip, styles.chipSmall]} onPress={() => bumpJobPart(p.id, 1)}>
                            <Text style={styles.chipSmallText}>{`${(p.machineIds ?? []).includes(machineId) ? '★ ' : ''}${p.name}`}</Text>
                          </TouchableOpacity>
                        ))}
                      {spares.length === 0 ? <Text style={styles.sub}>{t('pj.storesEmpty')}</Text> : null}
                    </View>
                  ) : null}
                </>
              ) : null}
              </View>

              {existing && canPlan ? (
                <View style={{ marginTop: SIZES.md }}>
                  <Label>{t('pj.reasonChange')}</Label>
                  <TextInput style={styles.input} value={changeReason} onChangeText={setChangeReason} placeholder={t('pj.reasonChangePh')} placeholderTextColor={COLORS.textLight} />
                </View>
              ) : null}
              {existing?.changes?.length ? (
                <View style={{ marginTop: SIZES.md }}>
                  <TouchableOpacity onPress={() => setShowLog((v) => !v)} hitSlop={8}>
                    <Text style={styles.link}>{t(showLog ? 'pj.hideLog' : 'pj.showLog', { n: existing.changes.length })}</Text>
                  </TouchableOpacity>
                  {showLog
                    ? [...existing.changes].reverse().map((c, i) => (
                        <Text key={`${c.at}-${i}`} style={styles.sub}>{`${new Date(c.at).toISOString().slice(0, 10).split('-').reverse().join('.')} · ${c.byRank ? `${c.by} (${c.byRank})` : c.by} · ${changeTextUi(c)}${c.reason ? ` — ${c.reason}` : ''}`}</Text>
                      ))
                    : null}
                </View>
              ) : null}
              {existing?.prepared ? (
                <View style={[styles.deferBox, { marginTop: SIZES.md }]}>
                  <Text style={[styles.sub, { fontWeight: '800', color: COLORS.warning }]}>{t('pj.awaiting', { date: existing.prepared.date.split('-').reverse().join('.'), who: existing.prepared.byRank ? `${existing.prepared.by} (${existing.prepared.byRank})` : existing.prepared.by })}</Text>
                  {existing.prepared.note ? <Text style={styles.sub}>{existing.prepared.note}</Text> : null}
                </View>
              ) : null}
              {!isNew ? (
                <TouchableOpacity style={styles.doneBtn} onPress={startDoing}>
                  <Text style={styles.doneText}>{existing?.prepared ? (isOfficer ? t('pj.reviewSign') : t('pj.openWriteup')) : t('pj.hRecord')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity disabled={!canPlan} style={[styles.deleteBtn, !canPlan && { opacity: 0.35 }]} onPress={onDelete}>
                <Text style={styles.deleteText}>{isNew ? t('doc.discard') : t('pj.removeTitle')}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stepper({ value, onChange, styles }: { value: number; onChange: (v: number) => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(0, value - 1))} hitSlop={6}>
        <Text style={styles.stepText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.stepVal}>{value}</Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(value + 1)} hitSlop={6}>
        <Text style={styles.stepText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small, marginBottom: SIZES.md },
    critical: { fontSize: SIZES.tiny, fontWeight: '900', color: COLORS.danger, letterSpacing: 1, marginBottom: 4 },
    deferNote: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.warning, marginBottom: SIZES.md },
    deferBox: { borderWidth: 1, borderColor: COLORS.warning, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    deferBtn: { backgroundColor: COLORS.warning, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    deferBtnText: { color: COLORS.textWhite, fontWeight: '800' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    machine: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    dueRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.xs, marginBottom: SIZES.md },
    dueText: { flex: 1, fontSize: SIZES.small, color: COLORS.text },
    jobTitle: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark, marginVertical: SIZES.md },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4 },
    signer: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark, marginTop: 4 },
    defectToggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    defectBox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.warning, textAlign: 'center', fontWeight: '900', overflow: 'hidden' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    chipSmall: { paddingVertical: 4, paddingHorizontal: SIZES.sm, borderColor: COLORS.border },
    chipSmallText: { color: COLORS.text, fontSize: SIZES.tiny },
    doneBtn: { marginTop: SIZES.xl, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.primary, alignItems: 'center' },
    doneText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    deleteBtn: { marginTop: SIZES.md, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
    deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
    partsHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.lg },
    addPart: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    partRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    partName: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
    stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    stepText: { color: COLORS.primary, fontSize: 18, fontWeight: '800', lineHeight: 20 },
    stepVal: { minWidth: 28, textAlign: 'center', fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
  });
