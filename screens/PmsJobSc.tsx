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
import { PmsDone, PmsJob } from '../types/pms';
import { crewLabel } from '../types/crew';
import { personName } from '../types/role';
import { dueText, jobAfter, jobDue, todayIso, withReading } from '../services/pms';
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
  const { pmsJobs, machines, crew, savePmsJob, saveMachine, completePmsJob } = useData();
  const sync = useSync();

  const id: string = route.params?.id;
  const existing = pmsJobs.find((j) => j.id === id);
  const machineId: string = existing?.machineId ?? route.params?.machineId;
  const machine = machines.find((m) => m.id === machineId);
  const isNew = !existing;

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
    if (!draft.intervalHours && !draft.intervalDays) return Alert.alert('Interval', 'Give an interval in hours, in days, or both.');
    await savePmsJob({ ...draft, title: draft.title.trim(), updatedAt: Date.now() });
    playSuccessSound();
    goBackOr(nav);
  };

  const onDone = async () => {
    if (!existing) return Alert.alert('Save first', 'Save the job, then record it as done.');
    if (!signer) return Alert.alert('Who did it?', 'Choose your name.');
    const hours = num(doneHours);
    if (existing.intervalHours && hours == null) return Alert.alert('Counter', 'Enter the counter reading when the job was done.');
    if (doneDate > todayIso()) return Alert.alert('Date', 'The date is in the future.');
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
      updatedAt: Date.now(),
    };
    await completePmsJob(done, jobAfter(existing, done));
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
              <Text style={[styles.sub, { marginTop: SIZES.md }]}>Signing adds the record to the machine's history. It cannot be edited afterwards; a mistake is corrected by recording the job again.</Text>
            </>
          ) : (
            <>
              <Label>Job ★</Label>
              <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder="Oil and filter change" placeholderTextColor={COLORS.textLight} />
              <View style={{ height: SIZES.md }} />
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
              <Label>…or every … days, whichever comes first</Label>
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
                <View style={{ width: 120 }}>
                  <TextInput
                    style={styles.input}
                    value={draft.lastDoneHours != null ? String(draft.lastDoneHours) : ''}
                    onChangeText={(v) => set({ lastDoneHours: num(v) })}
                    keyboardType="decimal-pad"
                    placeholder="at … h"
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
              </View>
              <Text style={styles.sub}>The starting point the next due date is counted from. After this, "Record as done" moves it for you.</Text>
              <View style={{ height: SIZES.md }} />
              <Label>Notes (parts, consumables, maker's reference)</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />

              {!isNew ? (
                <TouchableOpacity style={styles.doneBtn} onPress={() => setDoing(true)}>
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
  });
