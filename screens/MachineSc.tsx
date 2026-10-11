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
import { PLAN_LOCKED, plansPms } from '../types/role';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { DEPTS, Machine, PmsJob, deptOf, hasCounter } from '../types/pms';
import { activeDeferral, dueText, hoursPerDay, intervalText, jobDue, sortJobsByDue, todayIso, withReading } from '../services/pms';
import { CATALOGUE } from '../services/pmsCatalogue';
import { formatDate } from '../utils/dates';
import { qtyText, stockByPart, stockStatus } from '../services/spares';
import { moduleOn } from '../constants/modules';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';

export default function MachineSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { machines, pmsJobs, pmsDone, pmsDeferrals, spares, spareMoves, saveMachine, savePmsJob } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);
  const id: string = route.params?.id;
  // Spare parts marked as fitting this machine (Spares module).
  const fitting = useMemo(() => (moduleOn('spares') ? spares.filter((p) => (p.machineIds ?? []).includes(id)) : []), [spares, id]);
  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);
  const existing = machines.find((m) => m.id === id);
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
  const history = useMemo(
    () => pmsDone.filter((d) => d.machineId === id).sort((a, b) => b.at - a.at).slice(0, 10),
    [pmsDone, id]
  );
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

  const onReading = async () => {
    const h = Number(reading.replace(',', '.'));
    if (!Number.isFinite(h) || h < 0) return Alert.alert('Counter', 'Enter the hours shown on the counter.');
    const base = existing ?? draft;
    if (base.hours != null && h < base.hours) {
      return Alert.alert('Counter', `The last reading was ${base.hours} h. A counter does not go back — if it was replaced, add it as a new machine.`);
    }
    if (!draft.name.trim()) return Alert.alert('Name required', 'Name the machine first.');
    const next = withReading({ ...base, ...draft, name: draft.name.trim() }, today, h);
    await saveMachine(next);
    setDraft(next);
    setReading('');
    playSuccessSound();
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

  const onDelete = () => {
    if (isNew) return goBackOr(nav);
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
          {!canPlan ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{PLAN_LOCKED}</Text> : null}
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
          </View>
          ) : null}

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
                  <Text style={styles.sub} numberOfLines={2}>{`Every ${intervalText(j)} · ${dueText(d)}`}</Text>
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

          {history.length ? <Label>Recent work</Label> : null}
          {history.map((h) => (
            <View key={h.id} style={styles.hist}>
              <Text style={styles.rowTitle} numberOfLines={1}>{h.jobTitle}</Text>
              <Text style={styles.sub}>
                {[formatDate(h.date), h.hours != null ? `${h.hours} h` : null, h.byRank ? `${h.by} (${h.byRank})` : h.by].filter(Boolean).join(' · ')}
              </Text>
              {h.note ? <Text style={styles.note}>{h.note}</Text> : null}
            </View>
          ))}

          <TouchableOpacity disabled={!canPlan} style={[styles.deleteBtn, !canPlan && { opacity: 0.35 }]} onPress={onDelete}>
            <Text style={styles.deleteText}>{isNew ? 'Discard' : 'Remove'}</Text>
          </TouchableOpacity>
        </ScrollView>
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
