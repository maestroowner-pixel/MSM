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
import { DEFECT_CATEGORY, DefectCategory, JOB_TYPE, JobType, PmsDefect, PmsDone, PmsJob, hasCounter } from '../types/pms';
import { Attachment } from '../types/equipment';
import { PhotoPicker } from '../components/PhotoPicker';
import * as photoQueue from '../services/photoQueue';
import { Dropdown } from '../components/Dropdown';
import * as storage from '../services/storage';
import { crewLabel } from '../types/crew';
import { PLAN_LOCKED, personName, plansPms } from '../types/role';
import { activeDeferral, dueText, jobAfter, jobCycle, jobDue, todayIso, withReading } from '../services/pms';
import { movesForJob, qtyText, stockByPart } from '../services/spares';
import { JobPart } from '../types/spares';
import { moduleOn } from '../constants/modules';
import { useSignConfirm } from '../components/SignConfirm';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';

const DAY_CHIPS: { label: string; days: number }[] = [
  { label: '1 week', days: 7 },
  { label: '1 month', days: 30 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: '1 year', days: 365 },
  { label: '2 years', days: 730 },
];

export default function PmsJobSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { pmsJobs, machines, crew, spares, spareMoves, savePmsJob, saveMachine, completePmsJob, pmsDeferrals, appendRow, saveRow, vessel } = useData();
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
  const people = useMemo(() => crew.filter((c) => c.active), [crew]);
  const me = sync.me ? personName(sync.me) : '';
  const meRank = sync.me?.position;
  const [signerId, setSignerId] = useState<string | undefined>();
  const signer = me ? { name: me, rank: meRank } : people.find((p) => p.id === signerId);

  const deferral = existing ? activeDeferral(existing, pmsDeferrals) : undefined;
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const canPlan = plansPms(sync.enrolled, sync.role);
  const [defer, setDefer] = useState<{ date: string; hours: string; reason: string } | null>(null);
  const signDeferral = async () => {
    if (!existing || !defer) return;
    if (machine?.critical) return Alert.alert('Critical equipment', 'Jobs on critical equipment cannot be deferred.');
    const untilHours = num(defer.hours);
    if (!defer.date && untilHours == null) return Alert.alert('Defer until', 'Give a date, a counter reading, or both.');
    if (defer.date && defer.date < todayIso()) return Alert.alert('Defer until', 'The date is in the past.');
    if (defer.reason.trim().length < 3) return Alert.alert('Reason', 'Say why the job is deferred.');
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name.');
    const sig = await confirmSign({ personKey: me && sync.me ? `device:${sync.me.id}` : signerId ?? signer.name, name: signer.name, ownDevice: !!me, what: `Defer "${existing.title}" — ${defer.reason.trim()}` });
    if (!sig) return;
    const now = Date.now();
    await appendRow(storage.PMS_DEFERRALS_KEY, {
      id: uid('dfr'), jobId: existing.id, machineId, jobTitle: existing.title, machineName: machine?.name ?? '', cycle: jobCycle(existing),
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
    if (!canPlan) return Alert.alert('Maintenance plan', PLAN_LOCKED);
    if (!draft.title.trim()) return Alert.alert('Title required', 'Say what the job is — "Oil and filter change".');
    if (draft.oneOff) {
      if (!draft.dueDate && draft.dueHours == null) return Alert.alert('Due', counter ? 'Give the date, the counter reading, or both, it must be done by.' : 'Give the date it must be done by.');
    } else if (!draft.intervalHours && !draft.intervalDays) return Alert.alert('Interval', counter ? 'Give an interval in hours, in days, or both.' : 'Give an interval in days.');
    const { intervalHours, intervalDays, dueDate, dueHours, ...rest } = draft;
    const clean: PmsJob = draft.oneOff
      ? { ...rest, ...(dueDate ? { dueDate } : {}), ...(dueHours != null ? { dueHours } : {}) }
      : { ...rest, ...(intervalHours ? { intervalHours } : {}), ...(intervalDays ? { intervalDays } : {}) };
    await savePmsJob({ ...clean, title: draft.title.trim(), updatedAt: Date.now() });
    playSuccessSound();
    goBackOr(nav);
  };

  const startDoing = () => {
    setTake(Object.fromEntries((existing?.parts ?? []).map((p) => [p.partId, p.qty])));
    setDoing(true);
  };

  const setJobParts = (parts: JobPart[]) => set({ parts });
  const bumpJobPart = (partId: string, by: number) => {
    const parts = draft.parts ?? [];
    const cur = parts.find((p) => p.partId === partId);
    const qty = Math.max(0, (cur?.qty ?? 0) + by);
    setJobParts(qty === 0 ? parts.filter((p) => p.partId !== partId) : cur ? parts.map((p) => (p.partId === partId ? { ...p, qty } : p)) : [...parts, { partId, qty }]);
  };

  const onDone = async () => {
    if (!existing && !unplanned) return Alert.alert('Save first', 'Save the job, then record it as done.');
    const jobTitle = unplanned ? draft.title.trim() : existing!.title;
    if (!jobTitle) return Alert.alert('What was done?', 'Say what the work was — "Raw-water pump seal renewed".');
    if (unplanned && !doneNote.trim()) return Alert.alert('Report', 'Describe the work in the note — what failed, what was done.');
    if (!signer) return Alert.alert('Who did it?', 'Choose your name.');
    const hours = num(doneHours);
    if (counter && (existing?.intervalHours || existing?.dueHours != null) && hours == null) return Alert.alert('Counter', 'Enter the counter reading when the job was done.');
    if (doneDate > todayIso()) return Alert.alert('Date', 'The date is in the future.');
    if (machine?.critical && !donePhotos.length) return Alert.alert('Evidence', 'Critical equipment: add at least one photo of the work — before and after, clearances, parts replaced.');
    if (defect && defect.description.trim().length < 3) return Alert.alert('Defect', 'Describe the defect found, or untick it.');
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
      note: doneNote.trim() || undefined,
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
    if (existing) await completePmsJob(done, jobAfter(existing, done), moves);
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
    Alert.alert('Remove job', 'Remove this job from the plan? The record of past work is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
          <Text style={styles.headerTitle} numberOfLines={1}>{unplanned ? 'Unplanned work' : doing ? 'Record as done' : isNew ? (draft.oneOff ? 'New one-off job' : 'New job') : draft.oneOff ? 'One-off job' : 'Job'}</Text>
          {doing || canPlan ? (
            <TouchableOpacity onPress={doing ? onDone : onSave} hitSlop={12}>
              <Text style={styles.save}>{doing ? 'Sign' : 'Save'}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <Text style={styles.machine}>{machine?.name ?? 'Machine'}</Text>
          {machine?.critical ? <Text style={styles.critical}>CRITICAL EQUIPMENT</Text> : null}
          {!isNew ? (
            <View style={styles.dueRow}>
              {due.status !== 'none' ? <StatusPill status={due.status} /> : null}
              <Text style={styles.dueText}>{dueText(due)}</Text>
            </View>
          ) : null}
          {/* Deferral: the Master moves the job to a later date / counter reading, with the reason, signed. */}
          {!isNew && !doing && existing ? (
            deferral ? (
              <Text style={styles.deferNote}>{`Deferred${deferral.untilDate ? ` until ${deferral.untilDate}` : ''}${deferral.untilHours != null ? `${deferral.untilDate ? ' or' : ' until'} ${deferral.untilHours} h` : ''} — ${deferral.reason} · ${deferral.byRank ? `${deferral.by} (${deferral.byRank})` : deferral.by}`}</Text>
            ) : machine?.critical ? (
              <Text style={styles.sub}>Critical equipment — this job cannot be deferred.</Text>
            ) : defer ? (
              <View style={styles.deferBox}>
                <Label>Defer until — date and / or counter reading</Label>
                <SimpleDatePicker label="Until" value={defer.date} onChange={(v) => setDefer({ ...defer, date: v })} />
                {counter ? (
                  <TextInput style={[styles.input, { marginTop: SIZES.sm }]} value={defer.hours} onChangeText={(v) => setDefer({ ...defer, hours: v })} placeholder="…or until counter reading, h" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                ) : null}
                <TextInput style={[styles.input, { marginTop: SIZES.sm, borderColor: COLORS.warning, borderWidth: 1 }]} value={defer.reason} onChangeText={(v) => setDefer({ ...defer, reason: v })} placeholder="Reason ★ — e.g. spares on order, vessel on charter" placeholderTextColor={COLORS.textLight} />
                <View style={{ flexDirection: 'row', gap: SIZES.md, alignItems: 'center', marginTop: SIZES.sm }}>
                  <TouchableOpacity style={styles.deferBtn} onPress={() => void signDeferral()}><Text style={styles.deferBtnText}>Sign the deferral</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setDefer(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity disabled={!isMaster} style={{ opacity: isMaster ? 1 : 0.35, alignSelf: 'flex-start' }} onPress={() => setDefer({ date: todayIso(), hours: '', reason: '' })}>
                <Text style={styles.link}>Defer the job (Master)</Text>
              </TouchableOpacity>
            )
          ) : null}

          {doing ? (
            <>
              {unplanned ? (
                <>
                  <Label>What was done ★</Label>
                  <TextInput style={[styles.input, { marginBottom: SIZES.md }]} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder="Raw-water pump seal renewed" placeholderTextColor={COLORS.textLight} />
                </>
              ) : (
                <Text style={styles.jobTitle}>{existing?.title}</Text>
              )}
              <View style={{ marginBottom: SIZES.md }}>
                <SimpleDatePicker label="Done on" value={doneDate} onChange={setDoneDate} />
              </View>
              {counter ? (<>
              <Label>{`Counter reading${existing?.intervalHours ? ' ★' : ''}`}</Label>
              <TextInput
                style={styles.input}
                value={doneHours}
                onChangeText={(v) => {
                  doneHoursTouched.current = true;
                  setDoneHours(v);
                }}
                keyboardType="decimal-pad"
                placeholder="h"
                placeholderTextColor={COLORS.textLight}
              />
              </>) : null}
              <View style={{ height: SIZES.md }} />
              <Label>Note (parts used, findings)</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={doneNote} onChangeText={setDoneNote} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
              <Label>{`Photos${machine?.critical ? ' ★' : ''}`}</Label>
              <PhotoPicker photos={donePhotos} onChange={setDonePhotos} hint={machine?.critical ? 'Critical equipment — at least one photo of the work.' : 'Before and after, clearances, parts replaced.'} />
              <View style={{ height: SIZES.md }} />
              <TouchableOpacity style={styles.defectToggle} onPress={() => setDefect(defect ? null : { category: 'operational', description: '' })}>
                <Text style={[styles.defectBox, defect && { backgroundColor: COLORS.warning, color: COLORS.textWhite }]}>{defect ? '✓' : ''}</Text>
                <Text style={styles.signer}>Found a defect</Text>
              </TouchableOpacity>
              {defect ? (
                <View style={{ marginTop: SIZES.sm }}>
                  <View style={styles.chips}>
                    {(Object.keys(DEFECT_CATEGORY) as DefectCategory[]).map((c) => (
                      <TouchableOpacity key={c} style={[styles.chip, defect.category === c && styles.chipOn]} onPress={() => setDefect({ ...defect, category: c })}>
                        <Text style={[styles.chipText, defect.category === c && styles.chipTextOn]}>{DEFECT_CATEGORY[c]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput style={[styles.input, { minHeight: 60, borderColor: COLORS.warning, borderWidth: 1 }]} value={defect.description} onChangeText={(v) => setDefect({ ...defect, description: v })} multiline placeholder="What is wrong ★ — it goes to the defect list until an officer closes it" placeholderTextColor={COLORS.textLight} />
                </View>
              ) : null}
              <View style={{ height: SIZES.md }} />
              <Label>Signed by</Label>
              {me ? (
                <Text style={styles.signer}>{meRank ? `${me} (${meRank})` : me}</Text>
              ) : (
                <View style={styles.chips}>
                  {people.map((p) => (
                    <TouchableOpacity key={p.id} style={[styles.chip, signerId === p.id && styles.chipOn]} onPress={() => setSignerId(p.id)}>
                      <Text style={[styles.chipText, signerId === p.id && styles.chipTextOn]}>{crewLabel(p)}</Text>
                    </TouchableOpacity>
                  ))}
                  {people.length === 0 ? <Text style={styles.sub}>The crew list is empty — the Master adds people in Settings → Crew.</Text> : null}
                </View>
              )}
              {sparesOn && Object.keys(take).length ? (
                <>
                  <View style={{ height: SIZES.md }} />
                  <Label>Taken from the stores</Label>
                  {Object.entries(take).map(([partId, qty]) => {
                    const p = partById.get(partId);
                    if (!p) return null;
                    const have = stock.get(partId) ?? 0;
                    return (
                      <View key={partId} style={styles.partRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partName} numberOfLines={1}>{p.name}</Text>
                          <Text style={[styles.sub, qty > have && { color: COLORS.warning }]}>{`On hand ${qtyText(have, p)}${qty > have ? ' — less than needed' : ''}`}</Text>
                        </View>
                        <Stepper value={qty} onChange={(v) => setTake((t) => ({ ...t, [partId]: v }))} styles={styles} />
                      </View>
                    );
                  })}
                  <Text style={styles.sub}>Set a part to 0 if it was not used this time.</Text>
                </>
              ) : null}
              <Text style={[styles.sub, { marginTop: SIZES.md }]}>Signing adds the record to the machine's history. It cannot be edited afterwards; a mistake is corrected by recording the job again.</Text>
            </>
          ) : (
            <>
              {!canPlan ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{PLAN_LOCKED}</Text> : null}
              <View pointerEvents={canPlan ? 'auto' : 'none'} style={!canPlan && { opacity: 0.6 }}>
              {isNew ? (
                <View style={[styles.chips, { marginTop: 0, marginBottom: SIZES.sm }]}>
                  {[{ k: false, l: 'Recurring' }, { k: true, l: 'One-off (corrective)' }].map((o) => (
                    <TouchableOpacity key={o.l} style={[styles.chip, !!draft.oneOff === o.k && styles.chipOn]} onPress={() => set({ oneOff: o.k || undefined })}>
                      <Text style={[styles.chipText, !!draft.oneOff === o.k && styles.chipTextOn]}>{o.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <Label>Job ★</Label>
              <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder="Oil and filter change" placeholderTextColor={COLORS.textLight} />
              <Dropdown caption="TYPE" value={draft.type ?? ''} onChange={(v) => set({ type: (v || undefined) as JobType | undefined })} options={[{ value: '', label: '—' }, ...(Object.keys(JOB_TYPE) as JobType[]).map((k) => ({ value: k, label: JOB_TYPE[k] }))]} style={{ marginTop: SIZES.sm }} />
              <View style={{ height: SIZES.md }} />
              {draft.oneOff ? (
                <>
                  <Label>Must be done by</Label>
                  <SimpleDatePicker label="Date" value={draft.dueDate} onChange={(v) => set({ dueDate: v })} />
                  {counter ? (
                    <TextInput style={[styles.input, { marginTop: SIZES.sm }]} value={draft.dueHours != null ? String(draft.dueHours) : ''} onChangeText={(v) => set({ dueHours: num(v) })} keyboardType="decimal-pad" placeholder={`…or by counter reading, h${machine?.hours != null ? ` (now ${machine.hours})` : ''}`} placeholderTextColor={COLORS.textLight} />
                  ) : null}
                  <Text style={styles.sub}>Done once. Recording it as done takes it off the plan; it stays in the machine's history.</Text>
                </>
              ) : (<>
              {counter ? (<>
              <Label>Every … running hours</Label>
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
              <Label>{counter ? '…or every … days, whichever comes first' : 'Every … days'}</Label>
              <TextInput
                style={styles.input}
                value={draft.intervalDays != null ? String(draft.intervalDays) : ''}
                onChangeText={(v) => set({ intervalDays: num(v) })}
                keyboardType="number-pad"
                placeholder="365"
                placeholderTextColor={COLORS.textLight}
              />
              <View style={styles.chips}>
                {DAY_CHIPS.map((c) => (
                  <TouchableOpacity key={c.days} style={[styles.chip, styles.chipSmall, draft.intervalDays === c.days && styles.chipOn]} onPress={() => set({ intervalDays: c.days })}>
                    <Text style={[styles.chipSmallText, draft.intervalDays === c.days && styles.chipTextOn]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ height: SIZES.md }} />
              <Label>Last done</Label>
              <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <SimpleDatePicker label="Date" value={draft.lastDoneDate} onChange={(v) => set({ lastDoneDate: v })} />
                </View>
                {counter ? <View style={{ width: 120 }}>
                  <TextInput
                    style={styles.input}
                    value={draft.lastDoneHours != null ? String(draft.lastDoneHours) : ''}
                    onChangeText={(v) => set({ lastDoneHours: num(v) })}
                    keyboardType="decimal-pad"
                    placeholder="at … h"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View> : null}
              </View>
              <Text style={styles.sub}>The starting point the next due date is counted from. After this, "Record as done" moves it for you.</Text>
              </>)}
              <View style={{ height: SIZES.md }} />
              <Label>Notes (parts, consumables, maker's reference)</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />

              {sparesOn ? (
                <>
                  <View style={styles.partsHead}>
                    <Label>Parts used each time</Label>
                    <TouchableOpacity onPress={() => setPickPart((v) => !v)} hitSlop={10}>
                      <Text style={styles.addPart}>{pickPart ? 'Done' : '+ Add part'}</Text>
                    </TouchableOpacity>
                  </View>
                  {(draft.parts ?? []).map((jp) => {
                    const p = partById.get(jp.partId);
                    return (
                      <View key={jp.partId} style={styles.partRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.partName} numberOfLines={1}>{p?.name ?? 'Removed from the stores'}</Text>
                          {p ? <Text style={styles.sub}>{`On hand ${qtyText(stock.get(p.id) ?? 0, p)}${p.partNo ? ` · ${p.partNo}` : ''}`}</Text> : null}
                        </View>
                        <Stepper value={jp.qty} onChange={(v) => bumpJobPart(jp.partId, v - jp.qty)} styles={styles} />
                      </View>
                    );
                  })}
                  {!(draft.parts ?? []).length && !pickPart ? (
                    <Text style={styles.sub}>Add the parts this job takes and "Record as done" will take them out of the stores.</Text>
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
                      {spares.length === 0 ? <Text style={styles.sub}>The stores are empty — add parts on the Spares tab first.</Text> : null}
                    </View>
                  ) : null}
                </>
              ) : null}
              </View>

              {!isNew ? (
                <TouchableOpacity style={styles.doneBtn} onPress={startDoing}>
                  <Text style={styles.doneText}>Record as done</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity disabled={!canPlan} style={[styles.deleteBtn, !canPlan && { opacity: 0.35 }]} onPress={onDelete}>
                <Text style={styles.deleteText}>{isNew ? 'Discard' : 'Remove job'}</Text>
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
