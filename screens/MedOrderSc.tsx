// ===================================
// One medical order (types/hospital.ts) — new (`id: 'new'`, `fill: 'short'` to
// start from what is short or expiring) or existing.
//
// "Not everything comes on time, nor all at once" (13 Oct 2026): an order is
// lines with the quantity ordered; each delivery is received against its lines
// — how many came, batch, expiry — and signed, so a line reads 6 of 10 until
// the rest comes. When every line is in, the order is complete and goes to the
// archive; one that will never be complete is closed, saying what did not come
// and why. Open, its lines and dates can still be changed.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useWitness } from '../components/WitnessChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { MedMove, MedOrder, OrderLine } from '../types/hospital';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { ORDER_STATE_LABEL, chestStatus, isArchived, nextNo, normExpiry, onOrderByItem, orderOverdue, orderState, receivedByLine, toOrder } from '../services/hospital';
import { exportOrderPdf } from '../services/hospitalReport';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Rec = Record<string, { qty: string; batchNo: string; expiry: string }>;

export default function MedOrderSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { medItems, medMoves, medOrders, saveRow, saveRows, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const witness = useWitness(signer?.name);
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const id = savedId ?? route.params?.id;
  const isNew = id === 'new';
  const stored = medOrders.find((o) => o.id === id);
  const [draft, setDraft] = useState<MedOrder | null>(() => {
    if (!isNew) return null;
    const lines: OrderLine[] = route.params?.fill === 'short'
      ? toOrder(chestStatus(medItems, medMoves, today), today, onOrderByItem(medOrders, medMoves)).map((x) => ({ id: uid('ol'), itemId: x.item.id, name: x.item.name, ...(x.item.strength ? { strength: x.item.strength } : {}), unit: x.item.unit, qty: x.need }))
      : [];
    return { id: uid('mo'), no: '', date: today, lines, by: '', at: Date.now(), updatedAt: Date.now() };
  });
  const [adding, setAdding] = useState<string | null>(null);
  const [rec, setRec] = useState<Rec | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const o = draft ?? stored;
  if (!o) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>This order is not on this device yet — it arrives with the next sync.</Text>
      </Screen>
    );
  }
  const st = orderState(o, medMoves);
  const got = receivedByLine(o, medMoves);
  const final = isArchived(st);
  const late = orderOverdue(o, medMoves, today);
  const deliveries = medMoves.filter((m) => m.orderId === o.id && m.kind === 'received').sort((a, b) => b.at - a.at);
  const set = (p: Partial<MedOrder>) => setDraft({ ...(draft ?? o), ...p });
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
  const items = medItems.filter((i) => !i.deleted);
  const found = adding != null ? items.filter((i) => !o.lines.some((l) => l.itemId === i.id) && `${i.name} ${i.strength ?? ''}`.toLowerCase().includes(adding.toLowerCase())).slice(0, 12) : [];

  const save = async () => {
    const d = draft!;
    if (!d.lines.length) return Alert.alert('Order', 'Add what is ordered.');
    if (d.lines.some((l) => !(l.qty > 0))) return Alert.alert('Order', 'Every line needs a quantity.');
    const now = Date.now();
    let out: MedOrder = { ...d, updatedAt: now };
    if (!stored) {
      if (!signer) return Alert.alert('Who is ordering?', 'Choose your name.');
      out = { ...out, no: nextNo('MO', medOrders, d.date), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now };
    }
    await saveRow(storage.MED_ORDERS_KEY, out);
    playSuccessSound();
    if (isNew) setSavedId(out.id);
    setDraft(null);
  };

  const receive = async () => {
    if (!rec) return;
    const take = o.lines.map((l) => ({ l, r: rec[l.id] })).filter((x) => x.r && Number(x.r.qty.replace(',', '.')) > 0);
    if (!take.length) return Alert.alert('Delivery', 'How many came of each line?');
    for (const { l, r } of take) if (r.expiry.trim() && !normExpiry(r.expiry)) return Alert.alert('Expiry', `${l.name}: write it as 2027-03, 03/2027 or 2027-03-31.`);
    if (!signer) return Alert.alert('Who is receiving?', 'Choose your name.');
    const cd = take.some(({ l }) => items.find((i) => i.id === l.itemId)?.controlled);
    if (cd && !witness.picked) return Alert.alert('Controlled drug', 'The delivery has a controlled drug — choose the witness.');
    const what = `${o.no} — delivery of ${take.length} line${take.length > 1 ? 's' : ''}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const w = cd ? await witness.confirm(what) : null;
    if (cd && !w) return;
    const now = Date.now();
    const got: MedMove[] = [];
    for (const { l, r } of take) {
      const isCd = items.find((i) => i.id === l.itemId)?.controlled;
      const m: MedMove = {
        id: uid('mmv'), itemId: l.itemId, kind: 'received', qty: Number(r.qty.replace(',', '.')), ...(r.batchNo.trim() ? { batchNo: r.batchNo.trim() } : {}),
        ...(normExpiry(r.expiry) ? { expiry: normExpiry(r.expiry) } : {}), date: today, note: `${o.no}${o.supplier ? ` · ${o.supplier}` : ''}`, orderId: o.id, lineId: l.id,
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(isCd && w ? w : {}), updatedAt: now,
      };
      got.push(m);
    }
    await saveRows(storage.MED_MOVES_KEY, got);
    await saveRow(storage.MED_ORDERS_KEY, { ...o, updatedAt: now });
    setRec(null);
    playSuccessSound();
  };

  const close = async () => {
    if (closing === null) return;
    if (!closing.trim()) return Alert.alert('Close the order', 'Say what did not come and why — not available, cancelled, re-ordered as …');
    if (!signer) return Alert.alert('Who is closing it?', 'Choose your name.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${o.no} — closed, not all delivered` });
    if (!sig) return;
    await saveRow(storage.MED_ORDERS_KEY, { ...o, closedAt: Date.now(), closedBy: signer.name, ...(signer.rank ? { closedByRank: signer.rank } : {}), closeNote: closing.trim(), updatedAt: Date.now() });
    setClosing(null);
    playSuccessSound();
  };

  const pdf = async () => {
    try {
      const w = await exportOrderPdf(o, medMoves, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Order', String(e?.message ?? e));
    }
  };

  const color = st === 'done' ? COLORS.success : st === 'closed' ? COLORS.textLight : late ? COLORS.danger : st === 'part' ? COLORS.warning : COLORS.primary;

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={o.no ? `Order ${o.no}` : 'New medical order'} subtitle={o.no ? `${ORDER_STATE_LABEL[st]}${late ? ' · OVERDUE' : ''}` : 'What to order — quantities can be changed'} help="Hospital" />

      {draft ? (
        <Card>
          <TextInput style={styles.input} value={draft.supplier ?? ''} onChangeText={(v) => set({ supplier: v })} placeholder="Supplier / agent" placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.ref ?? ''} onChangeText={(v) => set({ ref: v })} placeholder="Reference / PO number" placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.port ?? ''} onChangeText={(v) => set({ port: v })} placeholder="Deliver to — port, agent" placeholderTextColor={COLORS.textLight} />
          <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label="Expected" value={draft.due} onChange={(v) => set({ due: v })} onClear={() => set({ due: undefined })} /></View>
          <Label>{`Lines · ${draft.lines.length}`}</Label>
          {draft.lines.map((l) => (
            <View key={l.id} style={[styles.row, { marginVertical: 2 }]}>
              <Text style={[styles.body, { flex: 1, minWidth: 160 }]}>{`${l.name}${l.strength ? ` · ${l.strength}` : ''}`}</Text>
              <TextInput style={[styles.input, { width: 80, marginTop: 0, textAlign: 'right' }]} value={String(l.qty || '')} onChangeText={(v) => set({ lines: draft.lines.map((x) => (x.id === l.id ? { ...x, qty: Number(v.replace(/\D/g, '')) || 0 } : x)) })} keyboardType="number-pad" />
              <Text style={styles.sub}>{l.unit}</Text>
              {!got.get(l.id) ? <TouchableOpacity onPress={() => set({ lines: draft.lines.filter((x) => x.id !== l.id) })}><Text style={[styles.link, { color: COLORS.danger }]}>✕</Text></TouchableOpacity> : null}
            </View>
          ))}
          {adding != null ? (
            <>
              <TextInput style={styles.input} value={adding} onChangeText={setAdding} placeholder="Find in the register" placeholderTextColor={COLORS.textLight} autoFocus />
              {found.map((i) => (
                <TouchableOpacity key={i.id} onPress={() => { set({ lines: [...draft.lines, { id: uid('ol'), itemId: i.id, name: i.name, ...(i.strength ? { strength: i.strength } : {}), unit: i.unit, qty: i.required || 1 }] }); setAdding(null); }}>
                  <Text style={[styles.body, { paddingVertical: 4 }]}>{`+ ${i.name}${i.strength ? ` · ${i.strength}` : ''}`}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setAdding(null)}><Text style={styles.link}>Done</Text></TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setAdding('')}><Text style={styles.link}>+ Add from the register</Text></TouchableOpacity>
          )}
          <TextInput style={styles.input} value={draft.note ?? ''} onChangeText={(v) => set({ note: v })} placeholder="Note" placeholderTextColor={COLORS.textLight} />
          {!stored && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{stored ? 'Save' : 'Place the order'}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (stored ? setDraft(null) : goBackOr(nav))}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <>
          <View style={[styles.item, { borderLeftColor: color }]}>
            <Text style={styles.sub}>{[`ordered ${formatDate(o.date)} by ${who(o.by, o.byRank)}`, o.supplier, o.ref ? `ref ${o.ref}` : null, o.port].filter(Boolean).join(' · ')}</Text>
            {o.due ? <Text style={[styles.sub, late ? { color: COLORS.danger, fontWeight: '700' } : null]}>{`Expected ${formatDate(o.due)}${late ? ' — overdue' : ''}`}</Text> : null}
            {o.note ? <Text style={styles.body}>{o.note}</Text> : null}
            {o.closedAt ? <Text style={[styles.body, { color: COLORS.textLight }]}>{`Closed ${formatDateTime(o.closedAt)} by ${who(o.closedBy, o.closedByRank)}: ${o.closeNote}`}</Text> : null}
            {officer && !final ? <TouchableOpacity onPress={() => setDraft(o)}><Text style={styles.link}>Edit — lines, dates</Text></TouchableOpacity> : null}
          </View>

          <Label>Lines</Label>
          {o.lines.map((l) => {
            const n = got.get(l.id) ?? 0;
            const full = n >= l.qty;
            const r = rec?.[l.id];
            return (
              <View key={l.id} style={[styles.item, { borderLeftColor: full ? COLORS.success : n ? COLORS.warning : COLORS.border }]}>
                <Text style={styles.name}>{`${l.name}${l.strength ? ` · ${l.strength}` : ''}`}</Text>
                <Text style={[styles.sub, { color: full ? COLORS.success : n ? COLORS.warning : COLORS.textLight, fontWeight: '700' }]}>{`${n} of ${l.qty} ${l.unit} received${full ? '' : ` · ${l.qty - n} to come`}`}</Text>
                {r ? (
                  <View style={styles.row}>
                    <TextInput style={[styles.input, { width: 80, marginTop: 0 }]} value={r.qty} onChangeText={(v) => setRec({ ...rec!, [l.id]: { ...r, qty: v } })} keyboardType="decimal-pad" placeholder="Qty" placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, { flex: 1, minWidth: 90, marginTop: 0 }]} value={r.batchNo} onChangeText={(v) => setRec({ ...rec!, [l.id]: { ...r, batchNo: v } })} placeholder="Batch" placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, { flex: 1, minWidth: 90, marginTop: 0 }]} value={r.expiry} onChangeText={(v) => setRec({ ...rec!, [l.id]: { ...r, expiry: v } })} placeholder="Expiry 2027-03" placeholderTextColor={COLORS.textLight} />
                  </View>
                ) : null}
              </View>
            );
          })}

          {officer && !final ? (
            rec ? (
              <Card>
                <Text style={styles.sub}>Fill in what came — leave a line empty if nothing of it came this time. One batch per line; a second batch of the same line is a second delivery.</Text>
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                {o.lines.some((l) => items.find((i) => i.id === l.itemId)?.controlled) ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void receive()}><Text style={styles.btnText}>Sign the delivery</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setRec(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </Card>
            ) : closing !== null ? (
              <Card>
                <Label>Close — not all delivered</Label>
                <TextInput style={[styles.input, { minHeight: 50 }]} value={closing} onChangeText={setClosing} multiline placeholder="What did not come and why ★" placeholderTextColor={COLORS.textLight} />
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void close()}><Text style={styles.btnText}>Sign and close</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => setRec(Object.fromEntries(o.lines.filter((l) => (got.get(l.id) ?? 0) < l.qty).map((l) => [l.id, { qty: String(l.qty - (got.get(l.id) ?? 0)), batchNo: '', expiry: '' }])))}><Text style={styles.btnText}>Receive a delivery</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setClosing('')}><Text style={styles.link}>Close — the rest will not come…</Text></TouchableOpacity>
              </View>
            )
          ) : null}

          {deliveries.length ? <Label>{`Deliveries · ${deliveries.length}`}</Label> : null}
          {deliveries.map((m) => (
            <Text key={m.id} style={styles.sub}>{[formatDate(m.date), `${o.lines.find((l) => l.id === m.lineId)?.name ?? ''} ${m.qty}`, m.batchNo ? `batch ${m.batchNo}` : null, m.expiry ? `exp ${m.expiry.slice(0, 7)}` : null, who(m.by, m.byRank), m.witness ? `witness ${m.witness}` : null].filter(Boolean).join(' · ')}</Text>
          ))}

          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void pdf()}><Text style={styles.btnText}>Order (PDF)</Text></TouchableOpacity>
          {saved ? <Text style={styles.sub}>{saved}</Text> : null}
        </>
      )}
    </Screen>
  );
}
