// ===================================
// One non-conformity (types/safety.ts) — new (`id: 'new'`, optionally from an
// observation card, `obsId`) or an existing one.
//
// Officers write and correct the finding, the root cause and the actions while
// it is open. Whoever an action was given to signs it done (PIN, fingerprint or
// by hand). When every action is done the Master closes it — signed, with a
// word on whether it worked — and a closed NC does not change again.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { CapaAction, CapaKind, CAPA_KIND_LABEL, NC_GRADES, NC_SOURCES, NcSource, NonConformity, OBS_KIND_LABEL } from '../types/safety';
import { plansPms, roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { NC_STATE_LABEL, ncState, nextNcNo } from '../services/safety';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type ActDraft = { kind: CapaKind; text: string; owner: string; due: string };

export default function NcSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { ncs, observations, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const canClose = plansPms(sync.enrolled, sync.role);
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();

  // Once raised, the screen shows the stored NC by its new id (kept here, not in
  // the route: setParams on a linked web route re-rendered in a loop).
  const [savedId, setSavedId] = useState<string | null>(null);
  const isNew = route.params?.id === 'new' && !savedId;
  const obs = isNew ? observations.find((o) => o.id === route.params?.obsId) : undefined;
  const stored = ncs.find((n) => n.id === (savedId ?? route.params?.id));
  const [draft, setDraft] = useState<NonConformity | null>(() => {
    if (!isNew) return null;
    const now = Date.now();
    return {
      id: uid('nc'), no: '', date: obs?.date ?? today, source: obs ? (obs.kind === 'near_miss' ? 'near_miss' : 'observation') : 'internal_audit',
      ...(obs ? { obsId: obs.id } : {}), grade: 'nc', title: obs ? `${OBS_KIND_LABEL[obs.kind]} — ${obs.topic}` : '', what: obs?.what ?? '',
      ...(obs?.location ? { where: obs.location } : {}), actions: obs?.action ? [{ id: uid('ac'), kind: 'correction', text: obs.action, owner: obs.by ?? 'On the spot', due: obs.date, doneAt: obs.at, ...(obs.by ? { doneBy: obs.by } : {}), ...(obs.byRank ? { doneByRank: obs.byRank } : {}) }] : [],
      raisedBy: '', raisedAt: now, updatedAt: now,
    };
  });
  const [editing, setEditing] = useState(isNew);
  const [act, setAct] = useState<ActDraft | null>(null);
  const [doing, setDoing] = useState<{ id: string; note: string } | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const nc = editing ? draft : stored;
  if (!nc) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>This non-conformity is not on this device yet — it arrives with the next sync.</Text>
      </Screen>
    );
  }
  const st = ncState(nc, today);
  const closed = !!nc.closedAt;
  const set = (p: Partial<NonConformity>) => setDraft({ ...(draft ?? nc), ...p });
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');

  const save = async () => {
    const d = draft!;
    if (!d.title.trim() || !d.what.trim()) return Alert.alert('Non-conformity', 'Give it a short title and say what was found.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return Alert.alert('Date', 'When it was found.');
    const now = Date.now();
    let out: NonConformity = { ...d, title: d.title.trim(), what: d.what.trim(), updatedAt: now };
    if (isNew && !stored) {
      if (!signer) return Alert.alert('Who is raising it?', 'Choose your name.');
      out = { ...out, no: nextNcNo(ncs, d.date), raisedBy: signer.name, ...(signer.rank ? { raisedByRank: signer.rank } : {}), raisedAt: now };
      if (obs && !obs.ncId) {
        await saveRow(storage.OBSERVATIONS_KEY, {
          ...obs, ncId: out.id,
          ...(obs.reviewedAt ? {} : { reviewedAt: now, reviewedBy: signer.name, ...(signer.rank ? { reviewedByRank: signer.rank } : {}), review: route.params?.review ?? `Raised as ${out.no}` }),
          updatedAt: now,
        });
      }
    }
    await saveRow(storage.NCS_KEY, out);
    playSuccessSound();
    if (isNew) setSavedId(out.id);
    setDraft(null);
    setEditing(false);
  };

  const write = async (next: NonConformity) => {
    await saveRow(storage.NCS_KEY, { ...next, updatedAt: Date.now() });
  };

  const addAction = async () => {
    if (!act) return;
    if (!act.text.trim() || !act.owner.trim() || !act.due) return Alert.alert('Action', 'What is to be done, by whom, and by when.');
    const a: CapaAction = { id: uid('ac'), kind: act.kind, text: act.text.trim(), owner: act.owner.trim(), due: act.due };
    await write({ ...nc, actions: [...nc.actions, a] });
    setAct(null);
    playSuccessSound();
  };

  const actionDone = async (a: CapaAction) => {
    if (!signer) return Alert.alert('Who did it?', 'Choose your name.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${nc.no} — ${a.text} — done` });
    if (!sig) return;
    const note = doing?.note.trim();
    const done: CapaAction = { ...a, doneAt: Date.now(), doneBy: signer.name, ...(signer.rank ? { doneByRank: signer.rank } : {}), ...(note ? { doneNote: note } : {}) };
    await write({ ...nc, actions: nc.actions.map((x) => (x.id === a.id ? done : x)) });
    setDoing(null);
    playSuccessSound();
  };

  const close = async () => {
    if (closing === null) return;
    if (nc.actions.some((a) => !a.doneAt)) return Alert.alert('Close', 'Every action must be done first.');
    if (!nc.actions.length && nc.grade !== 'observation') return Alert.alert('Close', 'A non-conformity needs at least the correction that was made — add it as an action.');
    if (nc.grade !== 'observation' && !nc.rootCause?.trim()) return Alert.alert('Root cause', 'Establish the root cause before closing — Edit, then Root cause.');
    if (!closing.trim()) return Alert.alert('Effectiveness', 'Say whether the actions worked — what was checked, and when.');
    if (!signer) return Alert.alert('Who is closing it?', 'Choose your name.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${nc.no} ${nc.title} — closed` });
    if (!sig) return;
    const now = Date.now();
    await write({ ...nc, closedAt: now, closedBy: signer.name, ...(signer.rank ? { closedByRank: signer.rank } : {}), ...(sig.proof ? { closedWith: sig.proof } : {}), effectiveness: closing.trim() });
    setClosing(null);
    playSuccessSound();
  };

  const stateColor = { overdue: COLORS.danger, open: COLORS.warning, ready: COLORS.primary, closed: COLORS.success }[st];

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={nc.no ? `${nc.no} · ${nc.title || 'Non-conformity'}` : 'New non-conformity'} subtitle={nc.no ? `${NC_STATE_LABEL[st]} · raised ${formatDate(nc.date)} by ${who(nc.raisedBy, nc.raisedByRank)}` : 'Found at an audit, by PSC, in an incident or from an observation card'} help="Safety observations & NC" />

      {editing && draft ? (
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 160 }}><SimpleDatePicker label="Found on ★" value={draft.date} onChange={(v) => set({ date: v })} /></View>
            <Dropdown caption="SOURCE" value={draft.source} onChange={(v: NcSource) => set({ source: v })} options={NC_SOURCES.map((s) => ({ value: s.key, label: s.label }))} />
          </View>
          <TextInput style={styles.input} value={draft.sourceRef ?? ''} onChangeText={(v) => set({ sourceRef: v })} placeholder="Report / reference No." placeholderTextColor={COLORS.textLight} />
          <Label>Grade</Label>
          <View style={styles.chips}>
            {NC_GRADES.map((g) => (
              <TouchableOpacity key={g.key} style={[styles.chip, draft.grade === g.key && styles.chipOn]} onPress={() => set({ grade: g.key })}>
                <Text style={[styles.chipText, draft.grade === g.key && styles.chipTextOn]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder="Short title ★" placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.input, { minHeight: 70 }]} value={draft.what} onChangeText={(v) => set({ what: v })} multiline placeholder="What was found ★" placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.where ?? ''} onChangeText={(v) => set({ where: v })} placeholder="Where" placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.requirement ?? ''} onChangeText={(v) => set({ requirement: v })} placeholder="Requirement not met — ISM 10.2, SMS chapter, SOLAS reg." placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.input, { minHeight: 50 }]} value={draft.rootCause ?? ''} onChangeText={(v) => set({ rootCause: v })} multiline placeholder="Root cause — why it happened (can be added later)" placeholderTextColor={COLORS.textLight} />
          {isNew && !stored && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{isNew && !stored ? 'Raise the NC' : 'Save'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew && !stored ? goBackOr(nav) : (setDraft(null), setEditing(false)))}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <View style={[styles.item, { borderLeftColor: stateColor }]}>
          <Text style={[styles.sub, { color: stateColor, fontWeight: '700' }]}>{NC_STATE_LABEL[st]}</Text>
          <Text style={styles.sub}>{[NC_GRADES.find((g) => g.key === nc.grade)?.label, NC_SOURCES.find((s) => s.key === nc.source)?.label, nc.sourceRef].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.body}>{nc.what}</Text>
          {nc.where ? <Text style={styles.sub}>{`Where: ${nc.where}`}</Text> : null}
          {nc.requirement ? <Text style={styles.sub}>{`Requirement: ${nc.requirement}`}</Text> : null}
          <Text style={[styles.sub, !nc.rootCause && { color: COLORS.warning }]}>{nc.rootCause ? `Root cause: ${nc.rootCause}` : 'Root cause — not yet established'}</Text>
          {nc.obsId ? <Text style={styles.sub}>From an observation card</Text> : null}
          {canEdit && !closed ? <TouchableOpacity onPress={() => { setDraft(nc); setEditing(true); }}><Text style={styles.link}>Edit</Text></TouchableOpacity> : null}
        </View>
      )}

      {nc.no && !editing ? (
        <>
          <Label>{`Actions (${nc.actions.filter((a) => a.doneAt).length}/${nc.actions.length})`}</Label>
          {nc.actions.map((a) => {
            const late = !a.doneAt && a.due < today;
            return (
              <View key={a.id} style={[styles.item, { borderLeftColor: a.doneAt ? COLORS.success : late ? COLORS.danger : COLORS.warning }]}>
                <Text style={styles.name}>{`${a.doneAt ? '✓ ' : ''}${CAPA_KIND_LABEL[a.kind]}: ${a.text}`}</Text>
                <Text style={[styles.sub, late && { color: COLORS.danger, fontWeight: '700' }]}>{`${a.owner} · by ${formatDate(a.due)}${late ? ' · overdue' : ''}`}</Text>
                {a.doneAt ? <Text style={[styles.sub, { color: COLORS.success }]}>{`Done ${formatDateTime(a.doneAt)} · ${who(a.doneBy, a.doneByRank)}${a.doneNote ? ` — ${a.doneNote}` : ''}`}</Text> : null}
                {!a.doneAt && !closed ? (
                  doing?.id === a.id ? (
                    <View>
                      <TextInput style={styles.input} value={doing.note} onChangeText={(v) => setDoing({ id: a.id, note: v })} placeholder="What was done (optional)" placeholderTextColor={COLORS.textLight} />
                      {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                      <View style={styles.row}>
                        <TouchableOpacity style={styles.btn} onPress={() => void actionDone(a)}><Text style={styles.btnText}>Sign it done</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setDoing(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setDoing({ id: a.id, note: '' })}><Text style={styles.link}>Done…</Text></TouchableOpacity>
                  )
                ) : null}
              </View>
            );
          })}
          {!nc.actions.length ? <Text style={styles.sub}>No action yet — the correction made, the corrective action against the root cause, and anything to stop it elsewhere.</Text> : null}
          {canEdit && !closed ? (
            act ? (
              <Card>
                <View style={styles.chips}>
                  {(Object.keys(CAPA_KIND_LABEL) as CapaKind[]).map((k) => (
                    <TouchableOpacity key={k} style={[styles.chip, act.kind === k && styles.chipOn]} onPress={() => setAct({ ...act, kind: k })}>
                      <Text style={[styles.chipText, act.kind === k && styles.chipTextOn]}>{CAPA_KIND_LABEL[k]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[styles.input, { minHeight: 50 }]} value={act.text} onChangeText={(v) => setAct({ ...act, text: v })} multiline placeholder="What is to be done ★" placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} value={act.owner} onChangeText={(v) => setAct({ ...act, owner: v })} placeholder="By whom — name or rank ★" placeholderTextColor={COLORS.textLight} />
                <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label="By when ★" value={act.due} onChange={(v) => setAct({ ...act, due: v })} /></View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void addAction()}><Text style={styles.btnText}>Add the action</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={() => setAct({ kind: nc.actions.length ? 'corrective' : 'correction', text: '', owner: '', due: '' })}><Text style={styles.smallText}>+ Action</Text></TouchableOpacity>
            )
          ) : null}

          {closed ? (
            <View style={[styles.item, { borderLeftColor: COLORS.success, marginTop: SIZES.md }]}>
              <Text style={[styles.name, { color: COLORS.success }]}>{`Closed ${formatDateTime(nc.closedAt!)}`}</Text>
              <Text style={styles.sub}>{`${who(nc.closedBy, nc.closedByRank)}${nc.closedWith ? ` · ${proofShort(nc.closedWith)}` : ''}`}</Text>
              {nc.effectiveness ? <Text style={styles.body}>{`Effective: ${nc.effectiveness}`}</Text> : null}
            </View>
          ) : canClose && (st === 'ready' || (!nc.actions.length && nc.grade === 'observation')) ? (
            closing !== null ? (
              <Card>
                <Label>Close the non-conformity</Label>
                <TextInput style={[styles.input, { minHeight: 50 }]} value={closing} onChangeText={setClosing} multiline placeholder="Did it work? What was checked, and when ★" placeholderTextColor={COLORS.textLight} />
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void close()}><Text style={styles.btnText}>Sign and close</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => setClosing('')}><Text style={styles.btnText}>Close the NC…</Text></TouchableOpacity>
            )
          ) : st === 'ready' ? (
            <Text style={[styles.sub, { marginTop: SIZES.md }]}>Every action is done — the Master closes it.</Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
