// ===================================
// One item of the medicine chest (types/hospital.ts) — new (`id: 'new'`) or
// existing.
//
//   The item     name, strength / form, unit, how many the scale wants, kind,
//                where kept, controlled; officers edit it.
//   Aboard       batch by batch, with expiry.
//   Receive      outside an order (a gift from another vessel, a found box) —
//                orders are received on their own screen.
//   Dispose      out of date, damaged, used outside the log.
//   History      every move; for a controlled drug the register with the
//                balance after each line.
//   Reference    the WHO IMGS entry — indications, dosage, contraindications.
//
// Every move is signed; a controlled drug's also by a witness.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useWitness } from '../components/WitnessChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { MED_KIND_LABEL, MedItem, MedKind, MedMove } from '../types/hospital';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { MOVE_LABEL, daysTo, expiryState, itemStatus, normExpiry, onOrderByItem, registerLines, scaleEntry, stockByItem } from '../services/hospital';
import { MED_INFO_NOTICE, WHO_NOTICE } from '../constants/medNotice';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Action = { kind: 'received' | 'disposed'; qty: string; batchNo: string; expiry: string; note: string; batchKey?: string };
const DISPOSE_REASONS = ['Out of date', 'Damaged', 'Used — not in the log', 'Returned to supplier'];

export default function MedItemSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { medItems, medMoves, medOrders, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const witness = useWitness(signer?.name);
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const id = savedId ?? route.params?.id;
  const isNew = id === 'new';
  const stored = medItems.find((i) => i.id === id);
  const [draft, setDraft] = useState<MedItem | null>(() => (isNew ? { id: uid('med'), name: '', unit: 'pcs', required: 0, kind: 'medicine', order: medItems.length, updatedAt: Date.now() } : null));
  const [act, setAct] = useState<Action | null>(null);
  const [showRef, setShowRef] = useState(false);

  const item = draft ?? stored;
  const batches = useMemo(() => (item ? stockByItem(medMoves).get(item.id) ?? [] : []), [medMoves, item]);
  if (!item) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>This item is not on this device yet — it arrives with the next sync.</Text>
      </Screen>
    );
  }
  const st = itemStatus(item, batches, today);
  const coming = onOrderByItem(medOrders, medMoves).get(item.id) ?? 0;
  const ref = scaleEntry(item);
  const refText = ref.med?.ref ?? ref.nursing?.ref;
  const moves = medMoves.filter((m) => m.itemId === item.id);
  const lines = item.controlled ? registerLines(item.id, medMoves).reverse() : [];
  const set = (p: Partial<MedItem>) => setDraft({ ...(draft ?? item), ...p });
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');

  const save = async () => {
    const d = draft!;
    if (!d.name.trim()) return Alert.alert('Item', 'Name it.');
    await saveRow(storage.MED_ITEMS_KEY, { ...d, name: d.name.trim(), updatedAt: Date.now() });
    playSuccessSound();
    if (isNew) setSavedId(d.id);
    setDraft(null);
  };

  const remove = () =>
    Alert.alert('Remove from the chest', `Remove “${item.name}”? Its history stays in the reports.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await saveRow(storage.MED_ITEMS_KEY, { ...item, deleted: true, updatedAt: Date.now() }); goBackOr(nav); } },
    ]);

  const doMove = async () => {
    if (!act) return;
    const qty = Number(act.qty.replace(',', '.'));
    if (!(qty > 0)) return Alert.alert(MOVE_LABEL[act.kind], 'How many?');
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name.');
    let batchNo = act.batchNo.trim();
    let expiry: string | undefined = act.expiry.trim() ? normExpiry(act.expiry) : undefined;
    if (act.expiry.trim() && !expiry) return Alert.alert('Expiry', 'Write it as 2027-03, 03/2027 or 2027-03-31.');
    if (act.kind === 'disposed') {
      const b = batches.find((x) => x.key === act.batchKey);
      if (!b) return Alert.alert('Dispose', 'Which batch?');
      if (qty > b.qty) return Alert.alert('Dispose', `Only ${b.qty} in that batch.`);
      batchNo = b.batchNo ?? '';
      expiry = b.expiry;
    }
    if (item.controlled && !witness.picked) return Alert.alert('Controlled drug', 'Choose the witness — the second person present.');
    const what = `${item.name} — ${qty} ${item.unit} ${act.kind}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const w = item.controlled ? await witness.confirm(what) : null;
    if (item.controlled && !w) return;
    const now = Date.now();
    const m: MedMove = {
      id: uid('mmv'), itemId: item.id, kind: act.kind, qty, ...(batchNo ? { batchNo } : {}), ...(expiry ? { expiry } : {}), date: today,
      ...(act.note.trim() ? { note: act.note.trim() } : {}), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(w ?? {}), updatedAt: now,
    };
    await saveRow(storage.MED_MOVES_KEY, m);
    setAct(null);
    playSuccessSound();
  };

  const color = (state: string) => (state === 'expired' ? COLORS.danger : state === 'soon' ? COLORS.warning : COLORS.textDark);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={isNew && !stored ? 'New item' : item.name} subtitle={[item.strength, item.group, item.code].filter(Boolean).join(' · ') || MED_KIND_LABEL[item.kind]} help="Hospital" />

      {draft ? (
        <Card>
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Name ★ — Paracetamol" placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.strength ?? ''} onChangeText={(v) => set({ strength: v })} placeholder="Strength / form — tablet 500 mg" placeholderTextColor={COLORS.textLight} />
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={draft.unit} onChangeText={(v) => set({ unit: v })} placeholder="Unit — tablets" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={draft.required ? String(draft.required) : ''} onChangeText={(v) => set({ required: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" placeholder="Required by the scale" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.chips}>
            {(Object.keys(MED_KIND_LABEL) as MedKind[]).map((k) => (
              <TouchableOpacity key={k} style={[styles.chip, draft.kind === k && styles.chipOn]} onPress={() => set({ kind: k })}>
                <Text style={[styles.chipText, draft.kind === k && styles.chipTextOn]}>{MED_KIND_LABEL[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} value={draft.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder="Where it is kept — Hospital, locker 2" placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.group ?? ''} onChangeText={(v) => set({ group: v })} placeholder="Group — Cardiovascular, Bandages & Sutures" placeholderTextColor={COLORS.textLight} />
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>Controlled drug — every move witnessed, counted by the Master monthly</Text>
            <Switch value={!!draft.controlled} onValueChange={(v) => set({ controlled: v })} />
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew && !stored ? goBackOr(nav) : setDraft(null))}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <View style={[styles.item, { borderLeftColor: st.expired ? COLORS.danger : st.short || st.nextState === 'soon' ? COLORS.warning : COLORS.success }]}>
          <Text style={styles.name}>{`${st.usable} of ${item.required} ${item.unit} in date${st.short ? ` · ${st.short} short` : ''}`}</Text>
          {st.expired ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{`${st.expired} out of date — dispose of them`}</Text> : null}
          {coming ? <Text style={[styles.sub, { color: COLORS.primary }]}>{`${coming} on order`}</Text> : null}
          <Text style={styles.sub}>{[MED_KIND_LABEL[item.kind], item.location, item.controlled ? 'Controlled drug' : null].filter(Boolean).join(' · ')}</Text>
          {officer ? (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setDraft(item)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={remove}><Text style={[styles.link, { color: COLORS.danger }]}>Remove</Text></TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {!draft ? (
        <>
          <Label>{`Aboard · ${st.onHand} ${item.unit}`}</Label>
          {batches.map((b) => {
            const s = expiryState(today, b.expiry);
            return (
              <View key={b.key} style={[styles.item, { borderLeftColor: s === 'expired' ? COLORS.danger : s === 'soon' ? COLORS.warning : COLORS.success, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{`${b.qty} ${item.unit}`}</Text>
                  <Text style={[styles.sub, { color: color(s), fontWeight: s === 'expired' || s === 'soon' ? '700' : '400' }]}>
                    {[b.batchNo ? `batch ${b.batchNo}` : 'no batch number', b.expiry ? `exp ${formatDate(b.expiry)}${s === 'expired' ? ' — OUT OF DATE' : s === 'soon' ? ` — ${daysTo(today, b.expiry)} d left` : ''}` : 'no expiry'].join(' · ')}
                  </Text>
                </View>
                {officer ? <TouchableOpacity style={styles.small} onPress={() => setAct({ kind: 'disposed', qty: String(b.qty), batchNo: '', expiry: '', note: s === 'expired' ? 'Out of date' : '', batchKey: b.key })}><Text style={styles.smallText}>Dispose…</Text></TouchableOpacity> : null}
              </View>
            );
          })}
          {!batches.length ? <Text style={styles.sub}>None aboard.</Text> : null}

          {officer ? (
            act ? (
              <Card>
                <Label>{act.kind === 'received' ? 'Receive — outside an order' : 'Dispose'}</Label>
                <TextInput style={styles.input} value={act.qty} onChangeText={(v) => setAct({ ...act, qty: v })} keyboardType="decimal-pad" placeholder={`How many ${item.unit} ★`} placeholderTextColor={COLORS.textLight} />
                {act.kind === 'received' ? (
                  <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1, minWidth: 110, marginTop: 0 }]} value={act.batchNo} onChangeText={(v) => setAct({ ...act, batchNo: v })} placeholder="Batch / lot" placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, { flex: 1, minWidth: 110, marginTop: 0 }]} value={act.expiry} onChangeText={(v) => setAct({ ...act, expiry: v })} placeholder="Expiry — 2027-03" placeholderTextColor={COLORS.textLight} />
                  </View>
                ) : (
                  <View style={styles.chips}>
                    {DISPOSE_REASONS.map((r) => (
                      <TouchableOpacity key={r} style={[styles.chip, act.note === r && styles.chipOn]} onPress={() => setAct({ ...act, note: r })}>
                        <Text style={[styles.chipText, act.note === r && styles.chipTextOn]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <TextInput style={styles.input} value={act.note} onChangeText={(v) => setAct({ ...act, note: v })} placeholder={act.kind === 'received' ? 'From — e.g. MY Aurora, shore pharmacy' : 'How disposed — returned to pharmacy, incinerated ashore'} placeholderTextColor={COLORS.textLight} />
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                {item.controlled ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void doMove()}><Text style={styles.btnText}>Sign</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => setAct({ kind: 'received', qty: '', batchNo: '', expiry: '', note: '' })}><Text style={styles.smallText}>+ Receive outside an order</Text></TouchableOpacity>
            )
          ) : null}

          {refText || ref.med ? (
            <>
              <TouchableOpacity onPress={() => setShowRef(!showRef)}><Text style={[styles.link, { marginTop: SIZES.md }]}>{showRef ? 'Hide the WHO IMGS reference' : 'WHO IMGS reference — use, dosage, cautions'}</Text></TouchableOpacity>
              {showRef ? (
                <Card>
                  {ref.med ? <Text style={styles.sub}>{[ref.med.indication, ref.med.atc ? `ATC ${ref.med.atc}` : null, ref.med.who].filter(Boolean).join(' · ')}</Text> : null}
                  {refText ? <Text style={[styles.body, { lineHeight: 21 }]}>{refText}</Text> : null}
                  <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{MED_INFO_NOTICE}</Text>
                  <Text style={[styles.sub, { marginTop: SIZES.xs, fontSize: 11 }]}>{WHO_NOTICE}</Text>
                </Card>
              ) : null}
            </>
          ) : null}

          <Label>{item.controlled ? 'Controlled drugs register' : `History · ${moves.length}`}</Label>
          {(item.controlled ? lines.map((l) => ({ m: l.move, bal: l.balance as number | undefined })) : [...moves].sort((a, b) => b.at - a.at).map((m) => ({ m, bal: undefined as number | undefined }))).map(({ m, bal }) => (
            <View key={m.id} style={[styles.item, { borderLeftColor: m.kind === 'received' ? COLORS.success : m.kind === 'count' ? COLORS.primary : COLORS.warning }]}>
              <Text style={styles.name}>{`${MOVE_LABEL[m.kind]} ${m.qty} ${item.unit}${bal != null ? ` → balance ${bal}` : ''}`}</Text>
              <Text style={styles.sub}>{[formatDate(m.date), m.batchNo ? `batch ${m.batchNo}` : null, m.expiry ? `exp ${m.expiry.slice(0, 7)}` : null, m.treatmentId ? 'medical log' : null, m.orderId ? medOrders.find((o) => o.id === m.orderId)?.no : null, m.note].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.sub}>{`${who(m.by, m.byRank)}${m.signedWith ? ` · ${proofShort(m.signedWith)}` : ''}${m.witness ? ` · witness ${who(m.witness, m.witnessRank)}${m.witnessWith ? ` (${proofShort(m.witnessWith)})` : ''}` : ''}`}</Text>
            </View>
          ))}
          {!moves.length ? <Text style={styles.sub}>Nothing yet.</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}
