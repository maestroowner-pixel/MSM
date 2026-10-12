// ===================================
// Safety — observation cards and non-conformities (types/safety.ts).
//
// Cards: anyone writes one in half a minute, with a name or anonymously; new
// ones first, and an officer reviews them — "Reviewed" with a word, or "Raise
// an NC", which opens a non-conformity filled in from the card.
// Non-conformities: overdue actions first, then those waiting for the Master to
// close; each opens on its own screen (NcSc). The register prints both.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { ObsKind, OBS_KINDS, OBS_KIND_LABEL, OBS_TOPICS, NC_GRADE_LABEL, NC_SOURCE_LABEL, SafetyObservation } from '../types/safety';
import { personName, roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { NC_STATE_LABEL, NcState, ncState, nextActionDue, obsCounts, sortNcs, sortObservations } from '../services/safety';
import { exportSafetyExcel, exportSafetyPdf } from '../services/safetyReport';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

type Draft = { kind: ObsKind; topic: string; location: string; what: string; action: string; stoppedWork: boolean; anonymous: boolean };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const EMPTY: Draft = { kind: 'unsafe_condition', topic: '', location: '', what: '', action: '', stoppedWork: false, anonymous: false };

export default function SafetySc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { observations, ncs, saveRow, vessel } = useData();
  const sync = useSync();
  const canReview = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const { signer, picker } = useSigner('OBSERVED BY');
  const rev = useSigner('REVIEWED BY');
  const today = todayIso();

  const [tab, setTab] = useState<'cards' | 'ncs'>(route.params?.view === 'ncs' ? 'ncs' : 'cards');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const cards = useMemo(() => sortObservations(observations), [observations]);
  const list = useMemo(() => sortNcs(ncs, today), [ncs, today]);
  const fresh = observations.filter((o) => !o.reviewedAt).length;
  const openNcs = ncs.filter((n) => !n.closedAt).length;
  const month = obsCounts(observations, today.slice(0, 7));

  const kindColor: Record<ObsKind, string> = { near_miss: COLORS.danger, unsafe_act: COLORS.warning, unsafe_condition: COLORS.warning, good_practice: COLORS.success };
  const stateColor: Record<NcState, string> = { overdue: COLORS.danger, open: COLORS.warning, ready: COLORS.primary, closed: COLORS.success };

  const submit = async () => {
    if (!draft) return;
    if (!draft.what.trim()) return Alert.alert('Observation', 'Say what you saw.');
    if (!draft.topic) return Alert.alert('Topic', 'Choose what it is about.');
    if (!draft.anonymous && !signer) return Alert.alert('Who saw it?', 'Choose your name — or switch on Anonymous.');
    const now = Date.now();
    const o: SafetyObservation = {
      id: uid('obs'), date: today, kind: draft.kind, topic: draft.topic,
      ...(draft.location.trim() ? { location: draft.location.trim() } : {}), what: draft.what.trim(),
      ...(draft.action.trim() ? { action: draft.action.trim() } : {}), ...(draft.stoppedWork ? { stoppedWork: true } : {}),
      ...(draft.anonymous ? { anonymous: true } : { by: signer!.name, ...(signer!.rank ? { byRank: signer!.rank } : {}) }),
      at: now, updatedAt: now,
    };
    await saveRow(storage.OBSERVATIONS_KEY, o);
    setDraft(null);
    playSuccessSound();
    Alert.alert('Thank you', draft.kind === 'good_practice' ? 'The card is in — good practice is worth sharing.' : 'The card is in. An officer will look at it.');
  };

  const reviewer = () => (sync.me ? { name: personName(sync.me), rank: sync.me.position || undefined } : rev.signer ? { name: rev.signer.name, rank: rev.signer.rank } : null);
  const markReviewed = async (o: SafetyObservation) => {
    const r = reviewer();
    if (!r) return Alert.alert('Who is reviewing?', 'Choose your name on the card.');
    const now = Date.now();
    await saveRow(storage.OBSERVATIONS_KEY, { ...o, reviewedAt: now, reviewedBy: r.name, ...(r.rank ? { reviewedByRank: r.rank } : {}), ...(note.trim() ? { review: note.trim() } : {}), updatedAt: now });
    setOpen(null);
    setNote('');
    playSuccessSound();
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportSafetyPdf(list, cards, today, vessel) : await exportSafetyExcel(list, cards, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('QHSE register', String(e?.message ?? e));
    }
  };

  const by = (o: SafetyObservation) => (o.anonymous ? 'Anonymous' : o.byRank ? `${o.by} (${o.byRank})` : o.by ?? '');

  return (
    <Screen scroll>
      <ScreenTitle title="Safety" subtitle="Observation cards and non-conformities (NC / CAPA)" help="Safety observations & NC" />
      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, tab === 'cards' && styles.chipOn]} onPress={() => setTab('cards')}>
          <Text style={[styles.chipText, tab === 'cards' && styles.chipTextOn]}>{`Observation cards${fresh ? ` · ${fresh} new` : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, tab === 'ncs' && styles.chipOn]} onPress={() => setTab('ncs')}>
          <Text style={[styles.chipText, tab === 'ncs' && styles.chipTextOn]}>{`Non-conformities${openNcs ? ` · ${openNcs} open` : ''}`}</Text>
        </TouchableOpacity>
      </View>

      {tab === 'cards' ? (
        <>
          {draft ? (
            <Card>
              <Label>What did you see?</Label>
              <View style={styles.chips}>
                {OBS_KINDS.map((k) => (
                  <TouchableOpacity key={k.key} style={[styles.chip, draft.kind === k.key && { backgroundColor: kindColor[k.key], borderColor: kindColor[k.key] }]} onPress={() => setDraft({ ...draft, kind: k.key })}>
                    <Text style={[styles.chipText, draft.kind === k.key && styles.chipTextOn]}>{k.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Label>About</Label>
              <View style={styles.chips}>
                {OBS_TOPICS.map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, draft.topic === t && styles.chipOn]} onPress={() => setDraft({ ...draft, topic: t })}>
                    <Text style={[styles.chipText, draft.topic === t && styles.chipTextOn]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={draft.what} onChangeText={(v) => setDraft({ ...draft, what: v })} multiline placeholder="What you saw ★" placeholderTextColor={COLORS.textLight} />
              <TextInput style={styles.input} value={draft.location} onChangeText={(v) => setDraft({ ...draft, location: v })} placeholder="Where — deck, space" placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { minHeight: 50 }]} value={draft.action} onChangeText={(v) => setDraft({ ...draft, action: v })} multiline placeholder={draft.kind === 'good_practice' ? 'Who, and why it is worth sharing' : 'What you did about it there and then'} placeholderTextColor={COLORS.textLight} />
              {draft.kind !== 'good_practice' ? (
                <View style={styles.toggle}>
                  <Text style={styles.toggleText}>I stopped the work (Stop Work Authority)</Text>
                  <Switch value={draft.stoppedWork} onValueChange={(v) => setDraft({ ...draft, stoppedWork: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
                </View>
              ) : null}
              <View style={styles.toggle}>
                <Text style={styles.toggleText}>Anonymous — the card does not carry my name</Text>
                <Switch value={draft.anonymous} onValueChange={(v) => setDraft({ ...draft, anonymous: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
              </View>
              {!draft.anonymous && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void submit()}><Text style={styles.btnText}>Hand in the card</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setDraft(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
              </View>
            </Card>
          ) : (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => setDraft(EMPTY)}><Text style={styles.btnText}>+ Observation card</Text></TouchableOpacity>
              <Text style={styles.sub}>{`This month: ${plural(month.total, 'card')} · ${plural(month.near, 'near miss', 'near misses')} · ${month.good} good practice${month.stop ? ` · work stopped ${month.stop}×` : ''}`}</Text>
            </View>
          )}

          {!cards.length && !draft ? <Empty text="No card yet. Anyone on board can hand one in — an unsafe act or condition, a near miss, or good practice worth sharing." /> : null}
          {cards.map((o) => {
            const nc = o.ncId ? ncs.find((n) => n.id === o.ncId) : undefined;
            return (
              <View key={o.id} style={[styles.item, { borderLeftColor: kindColor[o.kind] }]}>
                <TouchableOpacity onPress={() => (canReview ? setOpen(open === o.id ? null : o.id) : undefined)} activeOpacity={canReview ? 0.7 : 1}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.xs }}>
                    <MciIcon name={OBS_KINDS.find((k) => k.key === o.kind)?.icon ?? 'alert-outline'} size={16} color={kindColor[o.kind]} />
                    <Text style={[styles.name, { flex: 1 }]}>{`${OBS_KIND_LABEL[o.kind]} · ${o.topic}`}</Text>
                    {!o.reviewedAt ? <Text style={[styles.badge, { color: COLORS.warning, borderColor: COLORS.warning }]}>NEW</Text> : null}
                  </View>
                  <Text style={styles.body}>{o.what}</Text>
                  {o.action ? <Text style={styles.sub}>{`${o.kind === 'good_practice' ? 'Note' : 'Done there and then'}: ${o.action}`}</Text> : null}
                  <Text style={styles.sub}>{[formatDate(o.date), o.location, by(o), o.stoppedWork ? 'work stopped' : null].filter(Boolean).join(' · ')}</Text>
                  {o.reviewedAt ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ Reviewed by ${o.reviewedByRank ? `${o.reviewedBy} (${o.reviewedByRank})` : o.reviewedBy}${o.review ? ` — ${o.review}` : ''}`}</Text> : null}
                </TouchableOpacity>
                {nc ? (
                  <TouchableOpacity onPress={() => nav.navigate('Nc', { id: nc.id })}><Text style={styles.link}>{`→ ${nc.no} ${nc.title}`}</Text></TouchableOpacity>
                ) : null}
                {open === o.id && canReview ? (
                  <View>
                    {!o.reviewedAt && rev.picker ? <View style={{ marginTop: SIZES.sm }}>{rev.picker}</View> : null}
                    {!o.reviewedAt ? <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Review — what was done, who was spoken to" placeholderTextColor={COLORS.textLight} multiline /> : null}
                    <View style={styles.row}>
                      {!o.reviewedAt ? <TouchableOpacity style={styles.small} onPress={() => void markReviewed(o)}><Text style={styles.smallText}>Reviewed</Text></TouchableOpacity> : null}
                      {!o.ncId ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('Nc', { id: 'new', obsId: o.id, review: note.trim() || undefined })}><Text style={styles.smallText}>Raise an NC</Text></TouchableOpacity> : null}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : (
        <>
          {canReview ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Nc', { id: 'new' })}><Text style={styles.btnText}>+ Non-conformity</Text></TouchableOpacity>
            </View>
          ) : null}
          {!list.length ? <Empty text={canReview ? 'No non-conformity recorded. Raise one from an audit, PSC, an incident or an observation card.' : 'No non-conformity recorded.'} /> : null}
          {list.map((n) => {
            const st = ncState(n, today);
            const done = n.actions.filter((a) => a.doneAt).length;
            const due = nextActionDue(n);
            return (
              <TouchableOpacity key={n.id} style={[styles.item, { borderLeftColor: stateColor[st] }]} onPress={() => nav.navigate('Nc', { id: n.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${n.no} · ${n.title}`}</Text>
                <Text style={[styles.sub, { color: stateColor[st], fontWeight: '700' }]}>{`${NC_STATE_LABEL[st]}${st !== 'closed' && n.actions.length ? ` · actions ${done}/${n.actions.length}` : ''}${due && st !== 'closed' ? ` · next by ${formatDate(due)}` : ''}`}</Text>
                <Text style={styles.sub}>{[formatDate(n.date), NC_GRADE_LABEL[n.grade], NC_SOURCE_LABEL[n.source], n.sourceRef].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {ncs.length || observations.length ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void report('pdf')}><Text style={styles.btnText}>QHSE register (PDF)</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => void report('xlsx')}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
          {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
        </View>
      ) : null}
    </Screen>
  );
}

export const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginVertical: SIZES.sm, flexWrap: 'wrap' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    link: { color: COLORS.primary, fontWeight: '700', marginTop: SIZES.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm, textAlignVertical: 'top' },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    toggleText: { flex: 1, fontSize: SIZES.small, color: COLORS.textDark },
    item: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs, borderLeftWidth: 4 },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    body: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 4 },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    badge: { fontSize: 10, fontWeight: '800', borderWidth: 1, borderRadius: 4, paddingHorizontal: 4 },
    small: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: SIZES.sm },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
