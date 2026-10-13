// ===================================
// One monthly safety meeting (types/meetings.ts) — new (`id: 'new'`) or held.
//
// Saved as it is typed (as a drill). The standing agenda with a line for what
// was said on each point; the attendance list, each person signing his own line
// on this device — PIN or by hand (13 Oct 2026: "the safety meeting has an
// attendance list too"); the actions of earlier meetings, closed or kept open;
// new actions with who and by when. Signed by the Master or who chaired it, the
// meeting is final. PDF: the minutes, and the attendance list on its own.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

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
import { roleAtLeast, personName } from '../types/role';
import { isAboard } from '../types/crew';
import { Attendee, ABSENCE_REASONS } from '../types/drills';
import { SafetyMeeting } from '../types/meetings';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { vesselHeader } from '../services/export';
import { attendanceSig, nowHm } from '../services/drills';
import { attendanceDoc, freshMeeting, meetingDoc, nextMeetingNo } from '../services/meetings';
import { exportDocPdf } from '../services/hospitalReport';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles as safetyStyles } from './SafetySc';

export default function MeetingSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => ({ ...safetyStyles(COLORS), ...makeStyles(COLORS) }), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { safetyMeetings, crew, vessel, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('CHAIRED BY');
  const today = todayIso();
  const people = useMemo(() => crew.filter(isAboard), [crew]);

  const isNew = route.params?.id === 'new';
  const [first] = useState<SafetyMeeting | null>(() => (isNew ? freshMeeting(safetyMeetings, people, today) : null));
  const id = first?.id ?? route.params?.id;
  const stored = safetyMeetings.find((m) => m.id === id);
  const [draft, setDraft] = useState<SafetyMeeting | null>(() => stored ?? first);
  const dirty = useRef(false);
  const latest = useRef<SafetyMeeting | null>(draft);
  latest.current = draft;
  const [guest, setGuest] = useState<{ name: string; rank: string } | null>(null);
  const [act, setAct] = useState<{ text: string; who: string; due?: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (stored && !dirty.current && stored.updatedAt !== latest.current?.updatedAt) setDraft(stored);
  }, [stored]);

  const persist = async (m: SafetyMeeting) => {
    dirty.current = false;
    const no = m.no || nextMeetingNo(safetyMeetings, m.date);
    const out: SafetyMeeting = { ...m, no, plannedBy: m.plannedBy || signer?.name || '', updatedAt: Date.now() };
    await saveRow(storage.SAFETY_MEETINGS_KEY, out);
    if (!m.no) setDraft((p) => (p && !p.no ? { ...p, no, plannedBy: out.plannedBy, updatedAt: out.updatedAt } : p));
    setSavedNote(`Saved ${nowHm()}`);
  };
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
        <Text style={styles.sub}>This meeting is not on this device yet — it arrives with the next sync.</Text>
      </Screen>
    );
  }

  const m = draft;
  const done = !!m.doneAt;
  const ro = done || !canEdit;
  const present = m.attendance.filter((a) => a.present).length;
  const set = (p: Partial<SafetyMeeting>) => {
    if (ro) return;
    dirty.current = true;
    setDraft((x) => (x ? { ...x, ...p } : x));
  };
  const tidy = <T extends object>(a: T): T => Object.fromEntries(Object.entries(a).filter(([, v]) => v !== undefined)) as T;
  const setAtt = (i: number, p: Partial<Attendee>) => set({ attendance: m.attendance.map((a, k) => (k === i ? tidy({ ...a, ...p }) : a)) });

  // Each person his own line, on this device: PIN or by hand (as a drill's list).
  const meName = sync.me ? personName(sync.me) : null;
  const signLine = async (i: number) => {
    const a = m.attendance[i];
    const mine = !!sync.me && a.name === meName;
    const key = mine ? `device:${sync.me!.id}` : crew.find((c) => c.name === a.name && !c.deleted)?.id ?? `guest:${a.name}`;
    const res = await confirmSign({ personKey: key, name: a.name, ownDevice: mine, what: `Attendance — safety meeting ${m.no || formatDate(m.date)}`, always: true });
    if (!res) return;
    const line = tidy({ ...a, present: true, reason: undefined, signedAt: Date.now(), ...(res.proof ? { signedWith: res.proof } : {}) });
    const attendance = m.attendance.map((x, k) => (k === i ? line : x));
    if (canEdit) set({ attendance });
    else {
      const out = { ...m, attendance, updatedAt: Date.now() };
      await saveRow(storage.SAFETY_MEETINGS_KEY, out);
      setDraft(out);
    }
    playSuccessSound();
  };

  const addAction = () => {
    if (!act?.text.trim()) return;
    set({ actions: [...m.actions, tidy({ id: uid('act'), text: act.text.trim(), who: act.who || undefined, due: act.due })] });
    setAct(null);
  };

  const sign = async () => {
    if (!present) return Alert.alert('Attendance', 'Mark who took part.');
    if (!signer) return Alert.alert('Who chaired it?', 'Choose your name — the Master or who chaired the meeting.');
    const unsigned = m.attendance.filter((a) => a.present && !a.signedAt).length;
    if (unsigned && !(await new Promise<boolean>((ok) => Alert.alert('Attendance list', `${unsigned} of ${present} present have not signed the list. Their lines stay unsigned once the meeting is signed.`, [{ text: 'Back to the list', style: 'cancel', onPress: () => ok(false) }, { text: 'Sign anyway', onPress: () => ok(true) }])))) return;
    const no = m.no || nextMeetingNo(safetyMeetings, m.date);
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Safety meeting ${no} — held` });
    if (!sig) return;
    const now = Date.now();
    const out: SafetyMeeting = { ...m, no, time: m.time || nowHm(), plannedBy: m.plannedBy || signer.name, doneAt: now, doneBy: signer.name, ...(signer.rank ? { doneByRank: signer.rank } : {}), ...(sig.proof ? { doneWith: sig.proof } : {}), updatedAt: now };
    dirty.current = false;
    await saveRow(storage.SAFETY_MEETINGS_KEY, out);
    setDraft(out);
    playSuccessSound();
  };

  const drop = () =>
    Alert.alert('Delete', 'Delete this meeting? It was not signed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { dirty.current = false; if (m.no) await saveRow(storage.SAFETY_MEETINGS_KEY, { ...m, deleted: true, updatedAt: Date.now() }); goBackOr(nav); } },
    ]);

  const print = async (list: boolean) => {
    try {
      const doc = list ? attendanceDoc(m, vesselHeader(vessel)) : meetingDoc(m, vesselHeader(vessel));
      const w = await exportDocPdf(doc, `${m.no || 'Safety meeting'} ${list ? 'Attendance' : 'Safety meeting'} ${m.date}`, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Safety meeting', String(e?.message ?? e));
    }
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={`Safety meeting ${m.no}`.trim()} subtitle={done ? `Held ${formatDate(m.date)} · signed by ${m.doneBy} ${formatDateTime(m.doneAt!)}` : `${formatDate(m.date)} · not signed yet${savedNote ? ` · ${savedNote}` : ''}`} help="Security (ISPS)" />

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 200 }}>{ro ? <Text style={styles.body}>{formatDate(m.date)}</Text> : <SimpleDatePicker label="Date" value={m.date} onChange={(v) => set({ date: v })} />}</View>
          <TextInput editable={!ro} style={[styles.input, { width: 90 }]} value={m.time ?? ''} onChangeText={(v) => set({ time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
          <TextInput editable={!ro} style={[styles.input, { flex: 1, minWidth: 160 }]} value={m.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder="Place — crew mess, bridge" placeholderTextColor={COLORS.textLight} />
        </View>
      </Card>

      {/* ---- attendance list ---- */}
      <Card>
        <Label>{`Attendance list · ${present} of ${m.attendance.length} present${present ? ` · ${m.attendance.filter((a) => a.signedAt).length} signed` : ''}`}</Label>
        {!done && present ? <Text style={styles.sub}>On this device, each person signs his own line — his signing PIN, or by hand on the screen.</Text> : null}
        {!ro ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => set({ attendance: m.attendance.map((a) => ({ ...a, present: true, reason: undefined })) })}><Text style={styles.smallText}>All present</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => set({ attendance: m.attendance.map((a) => ({ ...a, present: false })) })}><Text style={styles.smallText}>Clear</Text></TouchableOpacity>
          </View>
        ) : null}
        {m.attendance.map((a, i) => (
          <View key={`${a.name}-${i}`} style={styles.att}>
            <TouchableOpacity style={styles.attMain} disabled={ro} onPress={() => setAtt(i, a.present ? { present: false, signedAt: undefined, signedWith: undefined } : { present: true, reason: undefined })} activeOpacity={0.7}>
              <View style={[styles.box, a.present && { backgroundColor: COLORS.success, borderColor: COLORS.success }]}>{a.present ? <MciIcon name="check" size={16} color={COLORS.textWhite} /> : null}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.sub}>{[a.rank, a.extra ? 'not on the crew list' : null].filter(Boolean).join(' · ') || ' '}</Text>
              </View>
              {a.signedAt ? (
                <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginTop: 0 }]}>{`✓ ${attendanceSig(a) || 'signed'}`}</Text>
              ) : !done && (a.present || !canEdit) ? (
                <TouchableOpacity style={styles.signBtn} onPress={() => void signLine(i)}><Text style={styles.signText}>Sign</Text></TouchableOpacity>
              ) : !a.present && a.reason ? (
                <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{a.reason}</Text>
              ) : null}
            </TouchableOpacity>
            {!ro && !a.present ? (
              <View style={[styles.chips, { marginLeft: 34, marginBottom: 2 }]}>
                {ABSENCE_REASONS.map((r) => (
                  <TouchableOpacity key={r} style={[styles.chipSm, a.reason === r && styles.chipOn]} onPress={() => setAtt(i, { reason: a.reason === r ? undefined : r })}>
                    <Text style={[styles.chipText, { fontSize: 11 }, a.reason === r && styles.chipTextOn]}>{r}</Text>
                  </TouchableOpacity>
                ))}
                {a.extra ? <TouchableOpacity onPress={() => set({ attendance: m.attendance.filter((_, k) => k !== i) })}><Text style={[styles.link, { marginTop: 4 }]}>Remove</Text></TouchableOpacity> : null}
              </View>
            ) : null}
          </View>
        ))}
        {!ro ? (
          guest ? (
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 2, minWidth: 140, marginTop: 0 }]} value={guest.name} onChangeText={(v) => setGuest({ ...guest, name: v })} placeholder="Name ★" placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={guest.rank} onChangeText={(v) => setGuest({ ...guest, rank: v })} placeholder="Rank / company" placeholderTextColor={COLORS.textLight} />
              <TouchableOpacity style={styles.btn} onPress={() => { if (!guest.name.trim()) return; set({ attendance: [...m.attendance, { name: guest.name.trim(), ...(guest.rank.trim() ? { rank: guest.rank.trim() } : {}), present: true, extra: true }] }); setGuest(null); }}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setGuest(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setGuest({ name: '', rank: '' })}><Text style={styles.link}>+ Someone not on the crew list (superintendent, contractor)</Text></TouchableOpacity>
          )
        ) : null}
      </Card>

      {/* ---- agenda ---- */}
      <Card>
        <Label>Agenda — what was said on each point</Label>
        {m.agenda.map((g, i) => (
          <View key={g.id} style={{ marginBottom: SIZES.sm }}>
            <Text style={styles.name}>{`${i + 1}. ${g.topic}`}</Text>
            {ro ? (g.notes ? <Text style={styles.body}>{g.notes}</Text> : <Text style={styles.sub}>—</Text>) : (
              <TextInput style={[styles.input, { minHeight: 40, marginTop: 4 }]} value={g.notes ?? ''} onChangeText={(v) => set({ agenda: m.agenda.map((x) => (x.id === g.id ? tidy({ ...x, notes: v || undefined }) : x)) })} multiline placeholder="Nothing to report / what was said" placeholderTextColor={COLORS.textLight} />
            )}
          </View>
        ))}
        {!ro ? <TouchableOpacity onPress={() => set({ agenda: [...m.agenda, { id: uid('ag'), topic: 'Other' }] })}><Text style={styles.link}>+ Another point</Text></TouchableOpacity> : null}
      </Card>

      {/* ---- actions ---- */}
      {m.carried.length ? (
        <Card>
          <Label>{`Actions from earlier meetings · ${m.carried.filter((c) => c.done).length} of ${m.carried.length} closed`}</Label>
          {m.carried.map((c) => (
            <TouchableOpacity key={c.id} disabled={ro} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 4 }} onPress={() => set({ carried: m.carried.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}>
              <MciIcon name={c.done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={c.done ? COLORS.success : COLORS.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, c.done && { textDecorationLine: 'line-through', color: COLORS.textLight }]}>{c.text}</Text>
                <Text style={styles.sub}>{[c.fromNo, c.who, c.due ? `by ${formatDate(c.due)}` : null, c.done ? 'done' : 'still open — comes back next month'].filter(Boolean).join(' · ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}
      <Card>
        <Label>{`New actions · ${m.actions.length}`}</Label>
        {m.actions.map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 4, alignItems: 'center' }}>
            <Text style={styles.name}>{`${i + 1}.`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{a.text}</Text>
              <Text style={styles.sub}>{[a.who, a.due ? `by ${formatDate(a.due)}` : null].filter(Boolean).join(' · ') || '—'}</Text>
            </View>
            {!ro ? <TouchableOpacity onPress={() => set({ actions: m.actions.filter((x) => x.id !== a.id) })}><Text style={[styles.link, { color: COLORS.danger }]}>✕</Text></TouchableOpacity> : null}
          </View>
        ))}
        {!ro ? (
          act ? (
            <>
              <TextInput style={styles.input} value={act.text} onChangeText={(v) => setAct({ ...act, text: v })} placeholder="What is to be done ★" placeholderTextColor={COLORS.textLight} autoFocus />
              <View style={styles.row}>
                <Dropdown caption="WHO" value={act.who} onChange={(v: string) => setAct({ ...act, who: v })} options={[{ value: '', label: '—' }, ...people.map((p) => ({ value: p.name, label: p.rank ? `${p.name} · ${p.rank}` : p.name }))]} style={{ flex: 1, minWidth: 200 }} />
                <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label="By" value={act.due} onChange={(v) => setAct({ ...act, due: v })} onClear={() => setAct({ ...act, due: undefined })} /></View>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={addAction}><Text style={styles.btnText}>Add the action</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setAct({ text: '', who: '' })}><Text style={styles.link}>+ An action — who does what by when</Text></TouchableOpacity>
          )
        ) : null}
      </Card>

      <Card>
        <Label>Other business</Label>
        {ro ? <Text style={styles.body}>{m.minutes || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 60 }]} value={m.minutes ?? ''} onChangeText={(v) => set({ minutes: v })} multiline placeholder="Anything else said" placeholderTextColor={COLORS.textLight} />}
      </Card>

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void print(false)}><Text style={styles.btnText}>{done ? 'Minutes (PDF)' : 'Draft minutes (PDF)'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void print(true)}><Text style={styles.btnText}>Attendance list (PDF)</Text></TouchableOpacity>
      </View>
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}

      {!ro ? (
        <Card>
          <Label>Held</Label>
          <Text style={styles.sub}>Sign when the meeting is over: the attendance, what was said and the actions go on the record, and it cannot be changed afterwards.</Text>
          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => void sign()}><Text style={styles.btnText}>Sign the meeting</Text></TouchableOpacity>
            <TouchableOpacity onPress={drop}><Text style={[styles.link, { color: COLORS.danger }]}>Delete</Text></TouchableOpacity>
          </View>
        </Card>
      ) : !done ? (
        <Text style={styles.sub}>An officer or the Master writes and signs the meeting; anyone signs his own attendance line here.</Text>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    att: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    attMain: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 8 },
    box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    signBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
    signText: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary },
    chipSm: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
  });
