// ===================================
// One drill (types/drills.ts) — new (`id: 'new'`, `type`) or an existing one.
//
// The officer who runs it writes it here (13 Oct 2026: "the officer writes the
// scenario himself — the interface must make that easy"):
//
//   The drill      type, topic, date, start and end, where.
//   Content        what it covers, a point per line; the trainer's checklist
//                  for that drill drops in with one tap.
//   Scenario       timed steps — T+min, what happens, who. A new step comes
//                  five minutes after the last; the usual bones (alarm, muster,
//                  report to the bridge, all clear) are one tap each; the last
//                  drill of the same kind can be copied whole. During the drill
//                  each step is stamped with the time it actually happened.
//   Theory         the briefing from the Drill Trainer, read out and printed as
//                  the report's annex.
//   Attendance     everyone aboard, tap who is there; why not, for the rest;
//                  guests and contractors added by name.
//   Debrief        lessons and actions.
//
// Everything saves as it is typed. Signed as carried out it is final. The
// drill report and the attendance list print at any stage — before the drill
// as the plan and a sheet to sign.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { personName, roleAtLeast } from '../types/role';
import { isAboard } from '../types/crew';
import { ABSENCE_REASONS, Attendee, DRILL_TYPES, DRILL_TYPE_MAP, Drill, OWN_INTERVALS, QUICK_STEPS, ScenarioStep, drillKind, drillTitle } from '../types/drills';
import { DRILL_THEORY } from '../constants/drillTheory';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { DRILL_STATE_LABEL, attendanceSig, clockAt, contentLines, drillState, lastOfType, minutesBetween, nextDrillNo, nextStepMin, nowHm, sortSteps } from '../services/drills';
import { exportDrillPdf } from '../services/drillReport';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles as safetyStyles } from './SafetySc';

/** "930", "9.30", "9:3" → "09:30"; anything else is left for the officer to fix. */
function hm(v: string): string {
  const s = v.trim().replace(/[.,;h ]/g, ':');
  const m = /^(\d{1,2}):?(\d{2})$/.exec(s.includes(':') ? s.replace(/:(\d)$/, ':0$1') : s.padStart(4, '0'));
  if (!m) return v.trim();
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : v.trim();
}

export default function DrillSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => ({ ...safetyStyles(COLORS), ...makeStyles(COLORS) }), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { drills, crew, vessel, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('CONDUCTED BY');
  const today = todayIso();

  const isNew = route.params?.id === 'new';
  const [id] = useState<string>(() => (isNew ? uid('drl') : route.params?.id));
  const stored = drills.find((d) => d.id === id);
  const people = useMemo(() => crew.filter(isAboard), [crew]);

  const fresh = (): Drill => {
    const type = route.params?.type && (DRILL_TYPE_MAP[route.params.type] || route.params.type === 'other') ? route.params.type : 'fire';
    const now = Date.now();
    // Planning the next of an own drill: its name, requirement, interval and
    // briefing come from the last one of that name.
    const name = type === 'other' ? String(route.params?.title ?? '').trim() : '';
    const like = name ? [...drills].filter((x) => drillKind(x) === drillKind({ type: 'other', title: name })).sort((a, b) => b.date.localeCompare(a.date))[0] : undefined;
    const own = type === 'other' ? { title: name, ...(like?.reg ? { reg: like.reg } : {}), ...(like?.everyDays ? { everyDays: like.everyDays } : {}), ...(like?.theoryText ? { theoryText: like.theoryText } : {}) } : {};
    return {
      id, no: '', type, ...own, topic: '', date: today, scenario: [], theory: !!DRILL_THEORY[type] || !!like?.theoryText,
      attendance: people.map((p) => ({ name: p.name, ...(p.rank ? { rank: p.rank } : {}), present: false })),
      plannedBy: '', updatedAt: now,
    };
  };
  const [draft, setDraft] = useState<Drill | null>(() => stored ?? (isNew ? fresh() : null));
  const dirty = useRef(false);
  const latest = useRef<Drill | null>(draft);
  latest.current = draft;
  const [theoryOpen, setTheoryOpen] = useState(false);
  /** The step just added — its text box takes the cursor. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [guest, setGuest] = useState<{ name: string; rank: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Another phone changed it and nothing is being typed here: take theirs.
  useEffect(() => {
    if (stored && !dirty.current && stored.updatedAt !== latest.current?.updatedAt) setDraft(stored);
  }, [stored]);

  const persist = async (d: Drill) => {
    dirty.current = false;
    const no = d.no || nextDrillNo(drills, d.date);
    const plannedBy = d.plannedBy || signer?.name || '';
    const out: Drill = { ...d, no, plannedBy, ...(!d.plannedBy && signer?.rank ? { plannedByRank: signer.rank } : {}), updatedAt: Date.now() };
    await saveRow(storage.DRILLS_KEY, out);
    if (!d.no) setDraft((p) => (p && !p.no ? { ...p, no, plannedBy: out.plannedBy, ...(out.plannedByRank ? { plannedByRank: out.plannedByRank } : {}), updatedAt: out.updatedAt } : p));
    setSavedNote(`Saved ${nowHm()}`);
  };

  // Saves as it is typed — a moment after the last keystroke, and on leaving.
  useEffect(() => {
    if (!dirty.current || !draft || draft.doneAt) return;
    const t = setTimeout(() => void persist(draft), 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
  useEffect(
    () => () => {
      if (dirty.current && latest.current && !latest.current.doneAt) void persist(latest.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  if (!draft) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>This drill is not on this device yet — it arrives with the next sync.</Text>
      </Screen>
    );
  }

  const d = draft;
  const done = !!d.doneAt;
  const ro = done || !canEdit;
  const st = drillState(d);
  const theory = DRILL_THEORY[d.type];
  const isOwn = d.type === 'other';
  const prev = !ro && !d.scenario.length ? lastOfType(drills, d, d.id) : undefined;
  const present = d.attendance.filter((a) => a.present).length;
  const steps = sortSteps(d.scenario);
  const started = !!d.time && d.date <= today;

  const set = (p: Partial<Drill>) => {
    if (ro) return;
    dirty.current = true;
    setDraft((x) => (x ? { ...x, ...p } : x));
  };
  const setStep = (sid: string, p: Partial<ScenarioStep>) => set({ scenario: d.scenario.map((s) => (s.id === sid ? { ...s, ...p } : s)) });
  const addStep = (text = '', who?: string) => {
    const sid = uid('st');
    set({ scenario: [...d.scenario, { id: sid, min: nextStepMin(d.scenario), text, ...(who ? { who } : {}) }] });
    if (!text) setFocusId(sid);
  };
  // Firestore refuses `undefined`: a field taken away is left out, not emptied.
  const tidy = (a: Attendee): Attendee => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as Attendee;
  const setAtt = (i: number, p: Partial<Attendee>) => set({ attendance: d.attendance.map((a, k) => (k === i ? tidy({ ...a, ...p }) : a)) });
  const toggleAtt = (i: number, a: Attendee) => setAtt(i, a.present ? { present: false, signedAt: undefined, signedWith: undefined } : { present: true, reason: undefined });

  // ---- the attendance list, signed in person ----
  // Signed on the bridge device or the officer's (13 Oct 2026: "they sign on
  // the bridge's or the officer's device"): each person his own line — his
  // signing PIN on that device, or by hand; the fingerprint only for the
  // device's own account, since a shared device cannot tell whose finger it is.
  // Asked always, whatever the vessel's signing setting. A bridge device on a
  // crew account may sign lines but changes nothing else.
  const meName = sync.me ? personName(sync.me) : null;
  const canSignLine = (a: Attendee) => !done && !a.signedAt;
  const signLine = async (i: number) => {
    const a = d.attendance[i];
    const mine = !!sync.me && a.name === meName;
    const key = mine ? `device:${sync.me!.id}` : crew.find((c) => c.name === a.name && !c.deleted)?.id ?? `guest:${a.name}`;
    const res = await confirmSign({ personKey: key, name: a.name, ownDevice: mine, what: `Attendance — ${d.no || 'drill'} ${drillTitle(d)}`, always: true });
    if (!res) return;
    const line = tidy({ ...a, present: true, reason: undefined, signedAt: Date.now(), ...(res.proof ? { signedWith: res.proof } : {}) });
    const attendance = d.attendance.map((x, k) => (k === i ? line : x));
    if (canEdit) set({ attendance });
    else {
      // A bridge device on a crew account: the line is saved at once — it cannot edit the rest.
      const out = { ...d, attendance, updatedAt: Date.now() };
      await saveRow(storage.DRILLS_KEY, out);
      setDraft(out);
    }
    playSuccessSound();
  };

  const copyPrev = () => {
    if (!prev) return;
    set({
      topic: d.topic || prev.topic,
      content: d.content || prev.content,
      location: d.location || prev.location,
      scenario: prev.scenario.map((s) => ({ id: uid('st'), min: s.min, text: s.text, ...(s.who ? { who: s.who } : {}) })),
    });
  };
  const insertChecklist = () => {
    if (!theory?.checklist) return;
    const add = theory.checklist.map((s) => `${s.title}: ${s.items.map((i) => i.split(' — ')[0]).join('; ')}`);
    set({ content: [...contentLines(d), ...add].join('\n') });
  };
  const addMissingCrew = () => {
    const have = new Set(d.attendance.map((a) => a.name));
    const more = people.filter((p) => !have.has(p.name)).map((p) => ({ name: p.name, ...(p.rank ? { rank: p.rank } : {}), present: false }));
    if (more.length) set({ attendance: [...d.attendance, ...more] });
  };

  const sign = async () => {
    if (!d.time) return Alert.alert('Drill', 'When did it start? Fill in the start time.');
    if (!present) return Alert.alert('Attendance', 'Mark who took part.');
    if (isOwn && !d.title?.trim()) return Alert.alert('Drill', 'Give your drill a name.');
    if (!signer) return Alert.alert('Who conducted it?', 'Choose your name.');
    const unsigned = d.attendance.filter((a) => a.present && !a.signedAt).length;
    if (unsigned && !(await new Promise<boolean>((ok) => Alert.alert('Attendance list', `${unsigned} of ${present} present have not signed the list. Their lines stay unsigned once the drill is signed.`, [{ text: 'Back to the list', style: 'cancel', onPress: () => ok(false) }, { text: 'Sign the drill anyway', onPress: () => ok(true) }])))) return;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${d.no || 'Drill'} — ${drillTitle(d)} — carried out` });
    if (!sig) return;
    const now = Date.now();
    const out: Drill = {
      ...d, no: d.no || nextDrillNo(drills, d.date), plannedBy: d.plannedBy || signer.name, ...(!d.plannedBy && signer.rank ? { plannedByRank: signer.rank } : {}), endTime: d.endTime || nowHm(),
      doneAt: now, doneBy: signer.name, ...(signer.rank ? { doneByRank: signer.rank } : {}), ...(sig.proof ? { doneWith: sig.proof } : {}), updatedAt: now,
    };
    dirty.current = false;
    await saveRow(storage.DRILLS_KEY, out);
    setDraft(out);
    playSuccessSound();
  };

  const drop = () =>
    Alert.alert('Delete the plan', 'Delete this drill plan? It was not carried out.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          dirty.current = false;
          if (d.no) await saveRow(storage.DRILLS_KEY, { ...d, deleted: true, updatedAt: Date.now() });
          goBackOr(nav);
        },
      },
    ]);

  const print = async (listOnly: boolean) => {
    try {
      if (dirty.current) await persist(d);
      const w = await exportDrillPdf({ ...d, no: d.no || nextDrillNo(drills, d.date) }, vessel, listOnly);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Drill report', String(e?.message ?? e));
    }
  };

  // A plain function, not a component: a component made here would be a new
  // type on every render and the input would lose focus at each keystroke.
  const field = ({ value, onChange, placeholder, multiline, style }: { value?: string; onChange: (v: string) => void; placeholder: string; multiline?: boolean; style?: any }) =>
    ro ? (value ? <Text style={[styles.body, style]}>{value}</Text> : null) : (
      <TextInput style={[styles.input, multiline && { minHeight: 60 }, style]} value={value ?? ''} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={COLORS.textLight} multiline={multiline} />
    );

  const stateColor = done ? COLORS.success : d.date < today ? COLORS.danger : COLORS.primary;
  const len = minutesBetween(d.time, d.endTime);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle
        title={`${d.no ? `${d.no} · ` : ''}${drillTitle(d)}${isOwn ? '' : ' drill'}`}
        subtitle={done ? `Carried out ${formatDate(d.date)} · signed ${formatDateTime(d.doneAt!)} by ${d.doneByRank ? `${d.doneBy} (${d.doneByRank})` : d.doneBy}${d.doneWith ? ` · ${proofShort(d.doneWith)}` : ''}` : `${DRILL_STATE_LABEL[st]}${DRILL_TYPE_MAP[d.type] ? ` · ${DRILL_TYPE_MAP[d.type].reg}` : d.reg?.trim() ? ` · ${d.reg.trim()}` : isOwn ? ' · own drill' : ''}`}
        help="Drills"
      />
      {!ro && savedNote ? <Text style={[styles.sub, { color: COLORS.success }]}>{savedNote}</Text> : null}

      {/* ---- the drill ---- */}
      <Card>
        <Label>The drill</Label>
        {!ro ? (
          <Dropdown caption="DRILL" value={d.type} onChange={(v: string) => set({ type: v, theory: !!DRILL_THEORY[v] || (v === 'other' && !!d.theoryText?.trim()) })} options={[...DRILL_TYPES.map((t) => ({ value: t.id, label: t.title })), { value: 'other', label: 'Other — your own drill' }]} />
        ) : null}
        {isOwn ? (
          ro ? (
            <Text style={styles.sub}>{[d.reg?.trim() || 'Own drill', OWN_INTERVALS.find((x) => x.days === d.everyDays)?.label ?? 'Not on a cycle'].join(' · ')}</Text>
          ) : (
            <>
              {field({ value: d.title, onChange: (v) => set({ title: v }), placeholder: 'Name of the drill ★ — e.g. Lifeboat release gear, Gas leak in the galley', style: { fontWeight: '700' } })}
              {field({ value: d.reg, onChange: (v) => set({ reg: v }), placeholder: 'Required by — e.g. SMS 8.2, flag circular, charterer' })}
              <Text style={[styles.sub, { marginTop: SIZES.sm }]}>How often</Text>
              <View style={styles.chips}>
                {OWN_INTERVALS.map((x) => (
                  <TouchableOpacity key={x.label} style={[styles.chip, d.everyDays === x.days && styles.chipOn]} onPress={() => set({ everyDays: x.days })}>
                    <Text style={[styles.chipText, d.everyDays === x.days && styles.chipTextOn]}>{x.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )
        ) : null}
        {field({ value: d.topic, onChange: (v) => set({ topic: v }), placeholder: `Topic — e.g. ${d.type === 'fire' ? 'Fire in the galley' : d.type === 'mob' ? 'Man overboard from the aft deck' : 'what the crew is told'}`, style: ro ? { fontWeight: '700' } : null })}
        {ro ? (
          <Text style={styles.sub}>{[`${formatDate(d.date)} ${[d.time, d.endTime].filter(Boolean).join('–')}`, len != null ? `${len} min` : null, d.location].filter(Boolean).join(' · ')}</Text>
        ) : (
          <>
            <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label="Date ★" value={d.date} onChange={(v) => set({ date: v })} /></View>
            <View style={styles.row}>
              <View style={styles.timeBox}>
                <Text style={styles.sub}>Start</Text>
                <TextInput style={styles.time} value={d.time ?? ''} onChangeText={(v) => set({ time: v })} onBlur={() => d.time && set({ time: hm(d.time) })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} keyboardType="numbers-and-punctuation" />
                <TouchableOpacity onPress={() => set({ time: nowHm(), ...(d.date !== today ? { date: today } : {}) })}><Text style={styles.link}>Now</Text></TouchableOpacity>
              </View>
              <View style={styles.timeBox}>
                <Text style={styles.sub}>End</Text>
                <TextInput style={styles.time} value={d.endTime ?? ''} onChangeText={(v) => set({ endTime: v })} onBlur={() => d.endTime && set({ endTime: hm(d.endTime) })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} keyboardType="numbers-and-punctuation" />
                <TouchableOpacity onPress={() => set({ endTime: nowHm() })}><Text style={styles.link}>Now</Text></TouchableOpacity>
              </View>
            </View>
            {field({ value: d.location, onChange: (v) => set({ location: v }), placeholder: 'Where — e.g. Galley, Deck 2; muster at the aft deck' })}
          </>
        )}
        {prev ? (
          <TouchableOpacity style={[styles.hint, { borderColor: COLORS.primary }]} onPress={copyPrev}>
            <MciIcon name="content-copy" size={18} color={COLORS.primary} />
            <Text style={[styles.sub, { flex: 1, color: COLORS.primary, marginTop: 0 }]}>{`Start from the last one — ${prev.no} ${formatDate(prev.date)}${prev.topic ? ` “${prev.topic}”` : ''}: its scenario (${prev.scenario.length} steps), content and place`}</Text>
          </TouchableOpacity>
        ) : null}
      </Card>

      {/* ---- content ---- */}
      <Card>
        <Label>Content of the drill</Label>
        {ro ? (
          contentLines(d).length ? contentLines(d).map((c, i) => <Text key={i} style={styles.body}>{`• ${c}`}</Text>) : <Text style={styles.sub}>—</Text>
        ) : (
          <>
            <TextInput style={[styles.input, { minHeight: 80 }]} value={d.content ?? ''} onChangeText={(v) => set({ content: v })} multiline placeholder={'What the drill covers — a point per line:\nRaise the alarm and report the fire\nBoundary cooling, ventilation closed\nBA team: pressure check, lifeline signals'} placeholderTextColor={COLORS.textLight} />
            {theory?.checklist ? <TouchableOpacity onPress={insertChecklist}><Text style={styles.link}>{`+ Insert the ${drillTitle(d).toLowerCase()} checklist (${theory.checklist.length} parts)`}</Text></TouchableOpacity> : null}
          </>
        )}
      </Card>

      {/* ---- scenario ---- */}
      <Card>
        <Label>{`Scenario — minute by minute${steps.length ? ` · ${steps.length} steps` : ''}`}</Label>
        {!steps.length && ro ? <Text style={styles.sub}>—</Text> : null}
        {steps.map((s) => (
          <View key={s.id} style={styles.step}>
            <View style={styles.minCol}>
              {ro ? (
                <Text style={styles.min}>{`T+${s.min}`}</Text>
              ) : (
                <View style={styles.minRow}>
                  <TouchableOpacity hitSlop={6} onPress={() => setStep(s.id, { min: Math.max(0, s.min - 1) })}><Text style={styles.pm}>−</Text></TouchableOpacity>
                  <TextInput style={styles.minInput} value={String(s.min)} onChangeText={(v) => setStep(s.id, { min: Math.max(0, Number(v.replace(/\D/g, '')) || 0) })} keyboardType="number-pad" selectTextOnFocus />
                  <TouchableOpacity hitSlop={6} onPress={() => setStep(s.id, { min: s.min + 1 })}><Text style={styles.pm}>+</Text></TouchableOpacity>
                </View>
              )}
              <Text style={styles.clock}>{clockAt(d.time, s.min)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              {ro ? (
                <>
                  <Text style={styles.body}>{s.text}</Text>
                  {s.who ? <Text style={styles.sub}>{s.who}</Text> : null}
                </>
              ) : (
                <>
                  <TextInput autoFocus={s.id === focusId} style={[styles.input, styles.stepText]} value={s.text} onChangeText={(v) => setStep(s.id, { text: v })} multiline placeholder="What happens — e.g. Smoke reported in the galley; alarm sounded" placeholderTextColor={COLORS.textLight} />
                  <TextInput style={[styles.input, styles.stepWho]} value={s.who ?? ''} onChangeText={(v) => setStep(s.id, { who: v || undefined })} placeholder="Who — Bridge, Fire party, 2/O…" placeholderTextColor={COLORS.textLight} />
                </>
              )}
            </View>
            <View style={styles.stepSide}>
              {s.at ? (
                <TouchableOpacity disabled={ro} onPress={() => setStep(s.id, { at: undefined })}>
                  <Text style={[styles.atOn, { color: COLORS.success }]}>{`✓ ${s.at}`}</Text>
                </TouchableOpacity>
              ) : !ro && started ? (
                <TouchableOpacity style={styles.atBtn} onPress={() => setStep(s.id, { at: nowHm() })}><Text style={styles.atText}>Done now</Text></TouchableOpacity>
              ) : null}
              {!ro ? (
                <TouchableOpacity hitSlop={8} onPress={() => set({ scenario: d.scenario.filter((x) => x.id !== s.id) })}>
                  <MciIcon name="close" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ))}
        {!ro ? (
          <>
            <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => addStep()}>
              <Text style={styles.smallText}>{`+ Step at T+${nextStepMin(d.scenario)}`}</Text>
            </TouchableOpacity>
            <Text style={[styles.sub, { marginTop: SIZES.sm }]}>Add with one tap:</Text>
            <View style={styles.chips}>
              {QUICK_STEPS.map((q) => (
                <TouchableOpacity key={q.text} style={styles.chip} onPress={() => addStep(q.text, q.who)}>
                  <Text style={styles.chipText}>{q.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {started && !done ? <Text style={styles.sub}>During the drill tap “Done now” on each step — the report shows the planned clock and the actual time side by side.</Text> : <Text style={styles.sub}>Steps keep to their minute; change it with − / + or type it. With the start time filled in, each step shows its clock time.</Text>}
          </>
        ) : null}
      </Card>

      {/* ---- theory ---- */}
      {isOwn ? (
        <Card>
          <Label>Theory briefing</Label>
          {ro ? (
            d.theoryText?.trim() ? <Text style={[styles.body, { lineHeight: 21 }]}>{d.theoryText}</Text> : <Text style={styles.sub}>—</Text>
          ) : (
            <TextInput style={[styles.input, { minHeight: 110 }]} value={d.theoryText ?? ''} onChangeText={(v) => set({ theoryText: v, ...(v.trim() && !d.theoryText?.trim() ? { theory: true } : {}) })} multiline placeholder={'What the crew is told before the drill — the hazard, the equipment, who does what, the signals. A paragraph per line.\nIt is kept with the drill and comes back the next time you plan it.'} placeholderTextColor={COLORS.textLight} />
          )}
          {d.theoryText?.trim() ? (
            <View style={styles.toggle}>
              <Text style={[styles.toggleText, { fontWeight: '700' }]}>Theory briefing given — printed as the report’s annex</Text>
              <Switch value={d.theory} onValueChange={(v) => set({ theory: v })} disabled={ro} />
            </View>
          ) : null}
        </Card>
      ) : theory ? (
        <Card>
          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { fontWeight: '700' }]}>Theory briefing given — printed as the report’s annex</Text>
            <Switch value={d.theory} onValueChange={(v) => set({ theory: v })} disabled={ro} />
          </View>
          <TouchableOpacity onPress={() => setTheoryOpen(!theoryOpen)}>
            <Text style={styles.link}>{theoryOpen ? 'Hide the briefing' : `Read the briefing — ${theory.title} (${theory.text.length} parts)`}</Text>
          </TouchableOpacity>
          {theoryOpen ? theory.text.map((p, i) => <Text key={i} style={[styles.body, { marginTop: SIZES.sm, lineHeight: 21 }]}>{p}</Text>) : null}
        </Card>
      ) : null}

      {/* ---- attendance ---- */}
      <Card>
        <Label>{`Attendance · ${present} of ${d.attendance.length} present${present ? ` · ${d.attendance.filter((a) => a.signedAt).length} signed` : ''}`}</Label>
        {!done && present ? <Text style={styles.sub}>On this device, each person signs his own line — his signing PIN, or by hand on the screen. Taking a tick off takes the signature with it.</Text> : null}
        {!ro ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => set({ attendance: d.attendance.map((a) => ({ ...a, present: true, reason: undefined })) })}><Text style={styles.smallText}>All present</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => set({ attendance: d.attendance.map((a) => ({ ...a, present: false })) })}><Text style={styles.smallText}>Clear</Text></TouchableOpacity>
            {people.some((p) => !d.attendance.some((a) => a.name === p.name)) ? <TouchableOpacity style={styles.small} onPress={addMissingCrew}><Text style={styles.smallText}>+ New crew aboard</Text></TouchableOpacity> : null}
          </View>
        ) : null}
        {d.attendance.map((a, i) => (
          <View key={`${a.name}-${i}`} style={styles.att}>
            <TouchableOpacity style={styles.attMain} disabled={ro} onPress={() => toggleAtt(i, a)} activeOpacity={0.7}>
              <View style={[styles.box, a.present && { backgroundColor: COLORS.success, borderColor: COLORS.success }]}>{a.present ? <MciIcon name="check" size={16} color={COLORS.textWhite} /> : null}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.sub}>{[a.rank, a.extra ? 'not on the crew list' : null].filter(Boolean).join(' · ') || ' '}</Text>
              </View>
              {a.signedAt ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginTop: 0 }]}>{`✓ ${attendanceSig(a)}`}</Text>
                  {a.signedWith?.drawing ? <SigLine path={a.signedWith.drawing} color={COLORS.textDark} /> : null}
                </View>
              ) : canSignLine(a) && (a.present || !canEdit) ? (
                <TouchableOpacity style={styles.signBtn} onPress={() => void signLine(i)}><Text style={styles.signText}>Sign</Text></TouchableOpacity>
              ) : !a.present && (done || st === 'running') ? (
                <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{a.reason || 'absent'}</Text>
              ) : null}
            </TouchableOpacity>
            {!ro && !a.present && st === 'running' ? (
              <View style={[styles.chips, { marginLeft: 34, marginBottom: 2 }]}>
                {ABSENCE_REASONS.map((r) => (
                  <TouchableOpacity key={r} style={[styles.chipSm, a.reason === r && styles.chipOn]} onPress={() => setAtt(i, { reason: a.reason === r ? undefined : r })}>
                    <Text style={[styles.chipText, { fontSize: 11 }, a.reason === r && styles.chipTextOn]}>{r}</Text>
                  </TouchableOpacity>
                ))}
                {a.extra ? <TouchableOpacity onPress={() => set({ attendance: d.attendance.filter((_, k) => k !== i) })}><Text style={[styles.link, { marginTop: 4 }]}>Remove</Text></TouchableOpacity> : null}
              </View>
            ) : null}
          </View>
        ))}
        {!d.attendance.length ? <Text style={styles.sub}>Nobody on the crew list is aboard. Add the crew under Crew, or add people here.</Text> : null}
        {!ro ? (
          guest ? (
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 2, minWidth: 140, marginTop: 0 }]} value={guest.name} onChangeText={(v) => setGuest({ ...guest, name: v })} placeholder="Name ★" placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={guest.rank} onChangeText={(v) => setGuest({ ...guest, rank: v })} placeholder="Rank / company" placeholderTextColor={COLORS.textLight} />
              <TouchableOpacity style={styles.btn} onPress={() => { if (!guest.name.trim()) return; set({ attendance: [...d.attendance, { name: guest.name.trim(), ...(guest.rank.trim() ? { rank: guest.rank.trim() } : {}), present: true, extra: true }] }); setGuest(null); }}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setGuest(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setGuest({ name: '', rank: '' })}><Text style={styles.link}>+ Someone not on the crew list (cadet, contractor, guest)</Text></TouchableOpacity>
          )
        ) : null}
      </Card>

      {/* ---- debrief ---- */}
      <Card>
        <Label>Debrief — lessons and actions</Label>
        {ro ? <Text style={styles.body}>{d.debrief || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 70 }]} value={d.debrief ?? ''} onChangeText={(v) => set({ debrief: v })} multiline placeholder="What went well, what to improve, who does what by when" placeholderTextColor={COLORS.textLight} />}
      </Card>

      {/* ---- reports ---- */}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void print(false)}><Text style={styles.btnText}>{done ? 'Drill report (PDF)' : 'Drill plan (PDF)'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void print(true)}><Text style={styles.btnText}>Attendance list (PDF)</Text></TouchableOpacity>
      </View>
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}

      {/* ---- sign ---- */}
      {!ro ? (
        <Card>
          <Label>Carried out</Label>
          <Text style={styles.sub}>Sign when the drill is over: the start time, who took part and the debrief go on the record, and it cannot be changed afterwards.</Text>
          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => void sign()}><Text style={styles.btnText}>Sign as carried out</Text></TouchableOpacity>
            <TouchableOpacity onPress={drop}><Text style={[styles.link, { color: COLORS.danger }]}>Delete the plan</Text></TouchableOpacity>
          </View>
        </Card>
      ) : !done ? (
        <Text style={[styles.sub, { color: stateColor }]}>An officer or the Master plans and signs drills.</Text>
      ) : null}
    </Screen>
  );
}

/** A hand signature, small, beside the name. */
function SigLine({ path, color }: { path: string; color: string }) {
  return (
    <Svg viewBox="0 0 300 100" width={66} height={22}>
      <Path d={path} stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    timeBox: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
    time: { width: 74, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.sm, paddingVertical: 6, fontSize: SIZES.body, color: COLORS.text, textAlign: 'center' },
    hint: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginTop: SIZES.md },
    step: { flexDirection: 'row', gap: SIZES.sm, paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight, alignItems: 'flex-start' },
    minCol: { width: 78, alignItems: 'center' },
    minRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    pm: { fontSize: 20, fontWeight: '800', color: COLORS.primary, paddingHorizontal: 4 },
    minInput: { width: 36, ...COLORS.glassInput, borderRadius: 6, paddingVertical: 4, fontSize: SIZES.body, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
    min: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    clock: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2 },
    stepText: { marginTop: 0, minHeight: 40 },
    stepWho: { marginTop: 4, paddingVertical: 4, fontSize: SIZES.small },
    stepSide: { alignItems: 'flex-end', gap: SIZES.sm, minWidth: 56 },
    atBtn: { borderWidth: 1, borderColor: COLORS.success, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
    atText: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.success },
    atOn: { fontSize: SIZES.small, fontWeight: '800' },
    att: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    attMain: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 8 },
    box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    signBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    signText: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary },
    chipSm: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
  });
