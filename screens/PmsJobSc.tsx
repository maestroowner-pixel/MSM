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
import { PmsDone, PmsJob, hasCounter } from '../types/pms';
import { crewLabel } from '../types/crew';
import { personName } from '../types/role';
import { dueText, jobAfter, jobDue, todayIso, withReading } from '../services/pms';
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
  const { pmsJobs, machines, crew, spares, spareMoves, savePmsJob, saveMachine, completePmsJob } = useData();
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
  // Calendar-only systems (galley, network, hull) have no counter to ask about.
  const counter = machine ? hasCounter(machine) : true;

  const [draft, setDraft] = useState<PmsJob>(existing ?? { id, machineId, title: '', updatedAt: Date.now() });
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

  const [doing, setDoing] = useState(false);
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

  const due = jobDue(existing ?? draft, machine);
  const num = (v: string) => {
    const n = Number(v.replace(',', '.'));
    return v.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const onSave = async () => {
    if (!draft.title.trim()) return Alert.alert('Title required', 'Say what the job is — "Oil and filter change".');
    if (!draft.intervalHours && !draft.intervalDays) return Alert.alert('Interval', counter ? 'Give an interval in hours, in days, or both.' : 'Give an interval in days.');
    await savePmsJob({ ...draft, title: draft.title.trim(), updatedAt: Date.now() });
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
    if (!existing) return Alert.alert('Save first', 'Save the job, then record it as done.');
    if (!signer) return Alert.alert('Who did it?', 'Choose your name.');
    const hours = num(doneHours);
    if (counter && existing.intervalHours && hours == null) return Alert.alert('Counter', 'Enter the counter reading when the job was done.');
    if (doneDate > todayIso()) return Alert.alert('Date', 'The date is in the future.');
    const sig = await confirmSign({
      personKey: me && sync.me ? `device:${sync.me.id}` : signerId ?? signer.name,
      name: signer.name,
      ownDevice: !!me,
      what: `Record "${existing.title}" as done`,
    });
    if (!sig) return;
    const done: PmsDone = {
      id: uid('done'),
      jobId: existing.id,
      machineId,
      jobTitle: existing.title,
      machineName: machine?.name ?? '',
      date: doneDate,
      hours,
      by: signer.name,
      byRank: signer.rank,
      note: doneNote.trim() || undefined,
      at: Date.now(),
      ...(sig.proof ? { signedWith: sig.proof } : {}),
      updatedAt: Date.now(),
    };
    const moves = sparesOn
      ? movesForJob(
          Object.entries(take).map(([partId, qty]) => ({ partId, qty })),
          partById,
          stock,
          { by: signer.name, byRank: signer.rank },
          doneDate,
          { doneId: done.id, jobTitle: existing.title, machineName: machine?.name ?? '' }
        )
      : [];
    await completePmsJob(done, jobAfter(existing, done), moves);
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
          <BackButton onPress={() => (doing ? setDoing(false) : goBackOr(nav))} />
          <Text style={styles.headerTitle} numberOfLines={1}>{doing ? 'Record as done' : isNew ? 'New job' : 'Job'}</Text>
          <TouchableOpacity onPress={doing ? onDone : onSave} hitSlop={12}>
            <Text style={styles.save}>{doing ? 'Sign' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <Text style={styles.machine}>{machine?.name ?? 'Machine'}</Text>
          {!isNew ? (
            <View style={styles.dueRow}>
              {due.status !== 'none' ? <StatusPill status={due.status} /> : null}
              <Text style={styles.dueText}>{dueText(due)}</Text>
            </View>
          ) : null}

          {doing ? (
            <>
              <Text style={styles.jobTitle}>{existing?.title}</Text>
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
              <Label>Job ★</Label>
              <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder="Oil and filter change" placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
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

              {!isNew ? (
                <TouchableOpacity style={styles.doneBtn} onPress={startDoing}>
                  <Text style={styles.doneText}>Record as done</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
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
