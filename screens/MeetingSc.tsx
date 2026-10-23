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
import { formatDate, uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles as safetyStyles } from './SafetySc';
import { t, useT } from '../utils/i18n';

export default function MeetingSc() {
  useT();
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
    setSavedNote(t('mt.savedAt', { time: nowHm() }));
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
        <Text style={styles.sub}>{t('mt.notHere')}</Text>
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
    if (!present) return Alert.alert(t('mt.attendance'), t('mt.markWho'));
    if (!signer) return Alert.alert(t('mt.whoChaired'), t('mt.chooseChair'));
    const unsigned = m.attendance.filter((a) => a.present && !a.signedAt).length;
    if (unsigned && !(await new Promise<boolean>((ok) => Alert.alert(t('mt.list'), t('mt.unsigned', { k: unsigned, n: present }), [{ text: t('mt.backList'), style: 'cancel', onPress: () => ok(false) }, { text: t('mt.signAnyway'), onPress: () => ok(true) }])))) return;
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
    Alert.alert(t('common.delete'), t('mt.deleteQ'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { dirty.current = false; if (m.no) await saveRow(storage.SAFETY_MEETINGS_KEY, { ...m, deleted: true, updatedAt: Date.now() }); goBackOr(nav); } },
    ]);

  const print = async (list: boolean) => {
    try {
      const doc = list ? attendanceDoc(m, vesselHeader(vessel)) : meetingDoc(m, vesselHeader(vessel));
      const w = await exportDocPdf(doc, `${m.no || 'Safety meeting'} ${list ? 'Attendance' : 'Safety meeting'} ${m.date}`, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('mt.title'), String(e?.message ?? e));
    }
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={`${t('mt.title')} ${m.no}`.trim()} subtitle={done ? `${t('mt.held', { date: uiDate(m.date) })} · ${t('meet.signedBy', { name: m.doneBy ?? '' })} ${uiDateTime(m.doneAt!)}` : `${uiDate(m.date)} · ${t('mt.notSigned')}${savedNote ? ` · ${savedNote}` : ''}`} help="Security (ISPS)" />

      <Card>
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 200 }}>{ro ? <Text style={styles.body}>{uiDate(m.date)}</Text> : <SimpleDatePicker label={t('nc.date')} value={m.date} onChange={(v) => set({ date: v })} />}</View>
          <TextInput editable={!ro} style={[styles.input, { width: 90 }]} value={m.time ?? ''} onChangeText={(v) => set({ time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
          <TextInput editable={!ro} style={[styles.input, { flex: 1, minWidth: 160 }]} value={m.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder={t('mt.placePh')} placeholderTextColor={COLORS.textLight} />
        </View>
      </Card>

      {/* ---- attendance list ---- */}
      <Card>
        <Label>{`${t('mt.list')} · ${t('mt.presentOf', { k: present, n: m.attendance.length })}${present ? ` · ${t('mt.signedN', { n: m.attendance.filter((a) => a.signedAt).length })}` : ''}`}</Label>
        {!done && present ? <Text style={styles.sub}>{t('mt.eachSigns')}</Text> : null}
        {!ro ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => set({ attendance: m.attendance.map((a) => ({ ...a, present: true, reason: undefined })) })}><Text style={styles.smallText}>{t('mt.allPresent')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => set({ attendance: m.attendance.map((a) => ({ ...a, present: false })) })}><Text style={styles.smallText}>{t('mt.clear')}</Text></TouchableOpacity>
          </View>
        ) : null}
        {m.attendance.map((a, i) => (
          <View key={`${a.name}-${i}`} style={styles.att}>
            <TouchableOpacity style={styles.attMain} disabled={ro} onPress={() => setAtt(i, a.present ? { present: false, signedAt: undefined, signedWith: undefined } : { present: true, reason: undefined })} activeOpacity={0.7}>
              <View style={[styles.box, a.present && { backgroundColor: COLORS.success, borderColor: COLORS.success }]}>{a.present ? <MciIcon name="check" size={16} color={COLORS.textWhite} /> : null}</View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name}>{a.name}</Text>
                <Text style={styles.sub}>{[a.rank, a.extra ? t('mt.notOnList') : null].filter(Boolean).join(' · ') || ' '}</Text>
              </View>
              {a.signedAt ? (
                <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginTop: 0 }]}>{`✓ ${attendanceSig(a) || 'signed'}`}</Text>
              ) : !done && (a.present || !canEdit) ? (
                <TouchableOpacity style={styles.signBtn} onPress={() => void signLine(i)}><Text style={styles.signText}>{t('common.sign')}</Text></TouchableOpacity>
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
                {a.extra ? <TouchableOpacity onPress={() => set({ attendance: m.attendance.filter((_, k) => k !== i) })}><Text style={[styles.link, { marginTop: 4 }]}>{t('common.remove')}</Text></TouchableOpacity> : null}
              </View>
            ) : null}
          </View>
        ))}
        {!ro ? (
          guest ? (
            <View style={styles.row}>
              <TextInput style={[styles.input, { flex: 2, minWidth: 140, marginTop: 0 }]} value={guest.name} onChangeText={(v) => setGuest({ ...guest, name: v })} placeholder={t('mt.namePh')} placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={guest.rank} onChangeText={(v) => setGuest({ ...guest, rank: v })} placeholder={t('mt.rankPh')} placeholderTextColor={COLORS.textLight} />
              <TouchableOpacity style={styles.btn} onPress={() => { if (!guest.name.trim()) return; set({ attendance: [...m.attendance, { name: guest.name.trim(), ...(guest.rank.trim() ? { rank: guest.rank.trim() } : {}), present: true, extra: true }] }); setGuest(null); }}><Text style={styles.btnText}>{t('common.add')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setGuest(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setGuest({ name: '', rank: '' })}><Text style={styles.link}>{t('mt.addGuest')}</Text></TouchableOpacity>
          )
        ) : null}
      </Card>

      {/* ---- agenda ---- */}
      <Card>
        <Label>{t('mt.agenda')}</Label>
        {m.agenda.map((g, i) => (
          <View key={g.id} style={{ marginBottom: SIZES.sm }}>
            <Text style={styles.name}>{`${i + 1}. ${g.topic}`}</Text>
            {ro ? (g.notes ? <Text style={styles.body}>{g.notes}</Text> : <Text style={styles.sub}>—</Text>) : (
              <TextInput style={[styles.input, { minHeight: 40, marginTop: 4 }]} value={g.notes ?? ''} onChangeText={(v) => set({ agenda: m.agenda.map((x) => (x.id === g.id ? tidy({ ...x, notes: v || undefined }) : x)) })} multiline placeholder={t('mt.agendaPh')} placeholderTextColor={COLORS.textLight} />
            )}
          </View>
        ))}
        {!ro ? <TouchableOpacity onPress={() => set({ agenda: [...m.agenda, { id: uid('ag'), topic: 'Other' }] })}><Text style={styles.link}>{t('mt.another')}</Text></TouchableOpacity> : null}
      </Card>

      {/* ---- actions ---- */}
      {m.carried.length ? (
        <Card>
          <Label>{t('mt.carried', { k: m.carried.filter((c) => c.done).length, n: m.carried.length })}</Label>
          {m.carried.map((c) => (
            <TouchableOpacity key={c.id} disabled={ro} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 4 }} onPress={() => set({ carried: m.carried.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}>
              <MciIcon name={c.done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={c.done ? COLORS.success : COLORS.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.body, c.done && { textDecorationLine: 'line-through', color: COLORS.textLight }]}>{c.text}</Text>
                <Text style={styles.sub}>{[c.fromNo, c.who, c.due ? t('meet.by', { date: uiDate(c.due) }) : null, c.done ? t('mt.done') : t('mt.stillOpen')].filter(Boolean).join(' · ')}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
      ) : null}
      <Card>
        <Label>{t('mt.newActions', { n: m.actions.length })}</Label>
        {m.actions.map((a, i) => (
          <View key={a.id} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 4, alignItems: 'center' }}>
            <Text style={styles.name}>{`${i + 1}.`}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.body}>{a.text}</Text>
              <Text style={styles.sub}>{[a.who, a.due ? t('meet.by', { date: uiDate(a.due) }) : null].filter(Boolean).join(' · ') || '—'}</Text>
            </View>
            {!ro ? <TouchableOpacity onPress={() => set({ actions: m.actions.filter((x) => x.id !== a.id) })}><Text style={[styles.link, { color: COLORS.danger }]}>✕</Text></TouchableOpacity> : null}
          </View>
        ))}
        {!ro ? (
          act ? (
            <>
              <TextInput style={styles.input} value={act.text} onChangeText={(v) => setAct({ ...act, text: v })} placeholder={t('nc.todoPh')} placeholderTextColor={COLORS.textLight} autoFocus />
              <View style={styles.row}>
                <Dropdown caption={t('mt.who')} value={act.who} onChange={(v: string) => setAct({ ...act, who: v })} options={[{ value: '', label: '—' }, ...people.map((p) => ({ value: p.name, label: p.rank ? `${p.name} · ${p.rank}` : p.name }))]} style={{ flex: 1, minWidth: 200 }} />
                <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label={t('mt.by')} value={act.due} onChange={(v) => setAct({ ...act, due: v })} onClear={() => setAct({ ...act, due: undefined })} /></View>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={addAction}><Text style={styles.btnText}>{t('nc.addAction')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => setAct({ text: '', who: '' })}><Text style={styles.link}>{t('mt.addAction')}</Text></TouchableOpacity>
          )
        ) : null}
      </Card>

      <Card>
        <Label>{t('mt.other')}</Label>
        {ro ? <Text style={styles.body}>{m.minutes || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 60 }]} value={m.minutes ?? ''} onChangeText={(v) => set({ minutes: v })} multiline placeholder={t('mt.otherPh')} placeholderTextColor={COLORS.textLight} />}
      </Card>

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void print(false)}><Text style={styles.btnText}>{done ? t('mt.minutesPdf') : t('mt.draftPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void print(true)}><Text style={styles.btnText}>{t('mt.listPdf')}</Text></TouchableOpacity>
      </View>
      {saved ? <Text style={styles.sub}>{saved}</Text> : null}

      {!ro ? (
        <Card>
          <Label>{t('mt.heldHead')}</Label>
          <Text style={styles.sub}>{t('mt.signHint')}</Text>
          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => void sign()}><Text style={styles.btnText}>{t('mt.sign')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={drop}><Text style={[styles.link, { color: COLORS.danger }]}>{t('common.delete')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : !done ? (
        <Text style={styles.sub}>{t('mt.crewHint')}</Text>
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
