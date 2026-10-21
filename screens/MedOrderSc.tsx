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
import { batchLabel, ORDER_STATE_LABEL, chestStatus, isArchived, nextNo, normExpiry, onOrderByItem, orderOverdue, orderState, receivedByLine, toOrder } from '../services/hospital';
import { exportOrderPdf } from '../services/hospitalReport';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tn, useT } from '../utils/i18n';

type Rec = Record<string, { qty: string; batchNo: string; expiry: string }>;

export default function MedOrderSc() {
  useT();
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
        <Text style={styles.sub}>{t('mo.notHere')}</Text>
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
    if (!d.lines.length) return Alert.alert(t('mo.order'), t('mo.addWhat'));
    if (d.lines.some((l) => !(l.qty > 0))) return Alert.alert(t('mo.order'), t('mo.needQty'));
    const now = Date.now();
    let out: MedOrder = { ...d, updatedAt: now };
    if (!stored) {
      if (!signer) return Alert.alert(t('mo.whoOrders'), t('round.chooseName'));
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
    if (!take.length) return Alert.alert(t('mo.delivery'), t('mo.howMany'));
    for (const { l, r } of take) if (r.expiry.trim() && !normExpiry(r.expiry)) return Alert.alert(t('mc.expiry'), `${l.name}: ${t('mc.expiryFmt')}`);
    if (!signer) return Alert.alert(t('mo.whoReceives'), t('round.chooseName'));
    const cd = take.some(({ l }) => items.find((i) => i.id === l.itemId)?.controlled);
    if (cd && !witness.picked) return Alert.alert(t('mo.cd'), t('mo.cdWitness'));
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
    if (!closing.trim()) return Alert.alert(t('mo.closeQ'), t('mo.closeWhy'));
    if (!signer) return Alert.alert(t('rounds.whoCloses'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${o.no} — closed, not all delivered` });
    if (!sig) return;
    await saveRow(storage.MED_ORDERS_KEY, { ...o, closedAt: Date.now(), closedBy: signer.name, ...(signer.rank ? { closedByRank: signer.rank } : {}), closeNote: closing.trim(), updatedAt: Date.now() });
    setClosing(null);
    playSuccessSound();
  };

  const pdf = async () => {
    try {
      const w = await exportOrderPdf(o, medMoves, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('mo.order'), String(e?.message ?? e));
    }
  };

  const color = st === 'done' ? COLORS.success : st === 'closed' ? COLORS.textLight : late ? COLORS.danger : st === 'part' ? COLORS.warning : COLORS.primary;

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={o.no ? t('mo.orderNo', { no: o.no }) : t('mo.new')} subtitle={o.no ? `${ORDER_STATE_LABEL[st]}${late ? ` · ${t('mo.overdueCaps')}` : ''}` : t('mo.newSub')} help="Hospital" />

      {draft ? (
        <Card>
          <TextInput style={styles.input} value={draft.supplier ?? ''} onChangeText={(v) => set({ supplier: v })} placeholder={t('mo.supplier')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.ref ?? ''} onChangeText={(v) => set({ ref: v })} placeholder={t('mo.ref')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.port ?? ''} onChangeText={(v) => set({ port: v })} placeholder={t('mo.deliverTo')} placeholderTextColor={COLORS.textLight} />
          <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('mo.expected')} value={draft.due} onChange={(v) => set({ due: v })} onClear={() => set({ due: undefined })} /></View>
          <Label>{t('mo.linesN', { n: draft.lines.length })}</Label>
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
              <TextInput style={styles.input} value={adding} onChangeText={setAdding} placeholder={t('mo.find')} placeholderTextColor={COLORS.textLight} autoFocus />
              {found.map((i) => (
                <TouchableOpacity key={i.id} onPress={() => { set({ lines: [...draft.lines, { id: uid('ol'), itemId: i.id, name: i.name, ...(i.strength ? { strength: i.strength } : {}), unit: i.unit, qty: i.required || 1 }] }); setAdding(null); }}>
                  <Text style={[styles.body, { paddingVertical: 4 }]}>{`+ ${i.name}${i.strength ? ` · ${i.strength}` : ''}`}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setAdding(null)}><Text style={styles.link}>{t('common.done')}</Text></TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setAdding('')}><Text style={styles.link}>{t('mo.addFrom')}</Text></TouchableOpacity>
          )}
          <TextInput style={styles.input} value={draft.note ?? ''} onChangeText={(v) => set({ note: v })} placeholder={t('mo.note')} placeholderTextColor={COLORS.textLight} />
          {!stored && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{stored ? t('common.save') : t('mo.place')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (stored ? setDraft(null) : goBackOr(nav))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <>
          <View style={[styles.item, { borderLeftColor: color }]}>
            <Text style={styles.sub}>{[t('mo.orderedBy', { date: formatDate(o.date), who: who(o.by, o.byRank) }), o.supplier, o.ref ? t('mo.refN', { ref: o.ref }) : null, o.port].filter(Boolean).join(' · ')}</Text>
            {o.due ? <Text style={[styles.sub, late ? { color: COLORS.danger, fontWeight: '700' } : null]}>{`${t('mo.expectedOn', { date: formatDate(o.due) })}${late ? ` — ${t('mo.overdue')}` : ''}`}</Text> : null}
            {o.note ? <Text style={styles.body}>{o.note}</Text> : null}
            {o.closedAt ? <Text style={[styles.body, { color: COLORS.textLight }]}>{`${t('mo.closedBy', { when: formatDateTime(o.closedAt), who: who(o.closedBy, o.closedByRank) })}: ${o.closeNote}`}</Text> : null}
            {officer && !final ? <TouchableOpacity onPress={() => setDraft(o)}><Text style={styles.link}>{t('mo.edit')}</Text></TouchableOpacity> : null}
          </View>

          <Label>{t('mo.lines')}</Label>
          {o.lines.map((l) => {
            const n = got.get(l.id) ?? 0;
            const full = n >= l.qty;
            const r = rec?.[l.id];
            return (
              <View key={l.id} style={[styles.item, { borderLeftColor: full ? COLORS.success : n ? COLORS.warning : COLORS.border }]}>
                <Text style={styles.name}>{`${l.name}${l.strength ? ` · ${l.strength}` : ''}`}</Text>
                <Text style={[styles.sub, { color: full ? COLORS.success : n ? COLORS.warning : COLORS.textLight, fontWeight: '700' }]}>{`${t('mo.received', { n, k: l.qty, unit: l.unit })}${full ? '' : ` · ${t('mo.toCome', { n: l.qty - n })}`}`}</Text>
                {r ? (
                  <View style={styles.row}>
                    <TextInput style={[styles.input, { width: 80, marginTop: 0 }]} value={r.qty} onChangeText={(v) => setRec({ ...rec!, [l.id]: { ...r, qty: v } })} keyboardType="decimal-pad" placeholder={t('mc.qty')} placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, { flex: 1, minWidth: 90, marginTop: 0 }]} value={r.expiry} onChangeText={(v) => setRec({ ...rec!, [l.id]: { ...r, expiry: v } })} placeholder={t('mc.expiryPh')} placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, { flex: 1, minWidth: 90, marginTop: 0 }]} value={r.batchNo} onChangeText={(v) => setRec({ ...rec!, [l.id]: { ...r, batchNo: v } })} placeholder={t('mc.lotPh')} placeholderTextColor={COLORS.textLight} />
                  </View>
                ) : null}
              </View>
            );
          })}

          {officer && !final ? (
            rec ? (
              <Card>
                <Text style={styles.sub}>{t('mo.fillHint')}</Text>
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                {o.lines.some((l) => items.find((i) => i.id === l.itemId)?.controlled) ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void receive()}><Text style={styles.btnText}>{t('mo.signDelivery')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setRec(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </Card>
            ) : closing !== null ? (
              <Card>
                <Label>{t('mo.closeHead')}</Label>
                <TextInput style={[styles.input, { minHeight: 50 }]} value={closing} onChangeText={setClosing} multiline placeholder={t('mo.closePh')} placeholderTextColor={COLORS.textLight} />
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void close()}><Text style={styles.btnText}>{t('mo.signClose')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => setRec(Object.fromEntries(o.lines.filter((l) => (got.get(l.id) ?? 0) < l.qty).map((l) => [l.id, { qty: String(l.qty - (got.get(l.id) ?? 0)), batchNo: '', expiry: '' }])))}><Text style={styles.btnText}>{t('mo.receive')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setClosing('')}><Text style={styles.link}>{t('mo.closeRest')}</Text></TouchableOpacity>
              </View>
            )
          ) : null}

          {deliveries.length ? <Label>{t('mo.deliveriesN', { n: deliveries.length })}</Label> : null}
          {deliveries.map((m) => (
            <Text key={m.id} style={styles.sub}>{[formatDate(m.date), `${o.lines.find((l) => l.id === m.lineId)?.name ?? ''} ${m.qty}`, m.expiry || m.batchNo ? batchLabel(m) : null, who(m.by, m.byRank), m.witness ? t('mo.witnessL', { who: m.witness }) : null].filter(Boolean).join(' · ')}</Text>
          ))}

          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void pdf()}><Text style={styles.btnText}>{t('mo.pdf')}</Text></TouchableOpacity>
          {saved ? <Text style={styles.sub}>{saved}</Text> : null}
        </>
      )}
    </Screen>
  );
}
