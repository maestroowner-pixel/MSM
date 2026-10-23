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
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { MED_KIND_LABEL, MedItem, MedKind, MedMove } from '../types/hospital';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { batchLabel, mmYY, placeText, MOVE_LABEL, daysTo, expiryState, itemStatus, normExpiry, onOrderByItem, registerLines, scaleEntry, stockByItem } from '../services/hospital';
import { MED_INFO_NOTICE, WHO_NOTICE } from '../constants/medNotice';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

type Action = { kind: 'received' | 'disposed'; qty: string; batchNo: string; expiry: string; note: string; batchKey?: string };
const DISPOSE_REASONS = ['Out of date', 'Damaged', 'Used — not in the log'];

export default function MedItemSc() {
  useT();
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
        <Text style={styles.sub}>{t('mi.notHere')}</Text>
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
    if (!d.name.trim()) return Alert.alert(t('def.item'), t('mi.nameIt'));
    await saveRow(storage.MED_ITEMS_KEY, { ...d, name: d.name.trim(), updatedAt: Date.now() });
    playSuccessSound();
    if (isNew) setSavedId(d.id);
    setDraft(null);
  };

  const remove = () =>
    Alert.alert(t('mi.removeQ'), t('mi.removeBody', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: async () => { await saveRow(storage.MED_ITEMS_KEY, { ...item, deleted: true, updatedAt: Date.now() }); goBackOr(nav); } },
    ]);

  const doMove = async () => {
    if (!act) return;
    const qty = Number(act.qty.replace(',', '.'));
    if (!(qty > 0)) return Alert.alert(MOVE_LABEL[act.kind], t('mc.howMany'));
    if (!signer) return Alert.alert(t('sign.who'), t('round.chooseName'));
    let batchNo = act.batchNo.trim();
    let expiry: string | undefined = act.expiry.trim() ? normExpiry(act.expiry) : undefined;
    if (act.expiry.trim() && !expiry) return Alert.alert(t('mc.expiry'), t('mc.expiryFmt'));
    if (act.kind === 'disposed') {
      const b = batches.find((x) => x.key === act.batchKey);
      if (!b) return Alert.alert(t('mi.dispose'), t('mi.whichBatch'));
      if (qty > b.qty) return Alert.alert(t('mi.dispose'), t('mi.only', { n: b.qty }));
      batchNo = b.batchNo ?? '';
      expiry = b.expiry;
    }
    if (item.controlled && !witness.picked) return Alert.alert(t('mo.cd'), t('mi.chooseWitness'));
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
      <ScreenTitle title={isNew && !stored ? t('mi.new') : item.name} subtitle={[item.strength, item.group, item.code].filter(Boolean).join(' · ') || MED_KIND_LABEL[item.kind]} help="Hospital" />

      {draft ? (
        <Card>
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder={t('mi.namePh')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.strength ?? ''} onChangeText={(v) => set({ strength: v })} placeholder={t('mi.strengthPh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={draft.unit} onChangeText={(v) => set({ unit: v })} placeholder={t('mi.unitPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={draft.required ? String(draft.required) : ''} onChangeText={(v) => set({ required: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" placeholder={t('mi.requiredPh')} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.chips}>
            {(Object.keys(MED_KIND_LABEL) as MedKind[]).map((k) => (
              <TouchableOpacity key={k} style={[styles.chip, draft.kind === k && styles.chipOn]} onPress={() => set({ kind: k })}>
                <Text style={[styles.chipText, draft.kind === k && styles.chipTextOn]}>{MED_KIND_LABEL[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} value={draft.listNo ?? ''} onChangeText={(v) => set({ listNo: v })} placeholder={t('mi.listNoPh')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder={t('mi.wherePh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1, minWidth: 120, marginTop: 0 }]} value={draft.cabinet ?? ''} onChangeText={(v) => set({ cabinet: v })} placeholder={t('mi.cabinetPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 120, marginTop: 0 }]} value={draft.cell ?? ''} onChangeText={(v) => set({ cell: v })} placeholder={t('mi.cellPh')} placeholderTextColor={COLORS.textLight} />
          </View>
          <TextInput style={styles.input} value={draft.group ?? ''} onChangeText={(v) => set({ group: v })} placeholder={t('mi.groupPh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>{t('mi.cdToggle')}</Text>
            <Switch value={!!draft.controlled} onValueChange={(v) => set({ controlled: v })} />
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew && !stored ? goBackOr(nav) : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <View style={[styles.item, { borderLeftColor: st.expired ? COLORS.danger : st.short || st.nextState === 'soon' ? COLORS.warning : COLORS.success }]}>
          <Text style={styles.name}>{`${st.usable} of ${item.required} ${item.unit} in date${st.short ? ` · ${st.short} short` : ''}`}</Text>
          {st.expired ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('mi.expired', { n: st.expired })}</Text> : null}
          {coming ? <Text style={[styles.sub, { color: COLORS.primary }]}>{t('mi.onOrder', { n: coming })}</Text> : null}
          <Text style={styles.sub}>{[MED_KIND_LABEL[item.kind], item.controlled ? t('mo.cd') : null].filter(Boolean).join(' · ')}</Text>
          {placeText(item) ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><MciIcon name="map-marker-outline" size={16} color={COLORS.textLight} /><Text style={[styles.body, { fontWeight: '700', flexShrink: 1 }]}>{placeText(item)}</Text></View> : null}
          {item.listNo ? <Text style={styles.sub}>{t('mi.listNo', { n: item.listNo })}</Text> : null}
          {officer ? (
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setDraft(item)}><Text style={styles.link}>{t('common.edit')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={remove}><Text style={[styles.link, { color: COLORS.danger }]}>{t('common.remove')}</Text></TouchableOpacity>
            </View>
          ) : null}
        </View>
      )}

      {!draft ? (
        <>
          <Label>{t('mi.aboard', { n: st.onHand, unit: item.unit })}</Label>
          {batches.map((b) => {
            const s = expiryState(today, b.expiry);
            return (
              <View key={b.key} style={[styles.item, { borderLeftColor: s === 'expired' ? COLORS.danger : s === 'soon' ? COLORS.warning : COLORS.success, flexDirection: 'row', alignItems: 'center' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{`${b.expiry ? mmYY(b.expiry) : t('mi.noExpiry')} — ${b.qty} ${item.unit}`}</Text>
                  <Text style={[styles.sub, { color: color(s), fontWeight: s === 'expired' || s === 'soon' ? '700' : '400' }]}>
                    {[b.expiry ? `${t('crew.expires', { date: uiDate(b.expiry) })}${s === 'expired' ? ` — ${t('mc.outOfDate')}` : s === 'soon' ? ` — ${t('mi.dLeft', { n: daysTo(today, b.expiry) })}` : ''}` : null, b.batchNo ? t('mi.lot', { n: b.batchNo }) : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {officer ? <TouchableOpacity style={styles.small} onPress={() => setAct({ kind: 'disposed', qty: String(b.qty), batchNo: '', expiry: '', note: s === 'expired' ? 'Out of date' : '', batchKey: b.key })}><Text style={styles.smallText}>{`${t('mi.dispose')}…`}</Text></TouchableOpacity> : null}
              </View>
            );
          })}
          {!batches.length ? <Text style={styles.sub}>{t('mi.noneAboard')}</Text> : null}

          {officer ? (
            act ? (
              <Card>
                <Label>{act.kind === 'received' ? t('mi.receiveOutside') : t('mi.dispose')}</Label>
                <TextInput style={styles.input} value={act.qty} onChangeText={(v) => setAct({ ...act, qty: v })} keyboardType="decimal-pad" placeholder={t('mi.howMany', { unit: item.unit })} placeholderTextColor={COLORS.textLight} />
                {act.kind === 'received' ? (
                  <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1, minWidth: 110, marginTop: 0 }]} value={act.expiry} onChangeText={(v) => setAct({ ...act, expiry: v })} placeholder={t('mi.expiryPh')} placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, { flex: 1, minWidth: 110, marginTop: 0 }]} value={act.batchNo} onChangeText={(v) => setAct({ ...act, batchNo: v })} placeholder={t('mi.lotPh')} placeholderTextColor={COLORS.textLight} />
                  </View>
                ) : (
                  <>
                  {/* How it goes (13 Oct 2026): destroyed on board, or handed ashore — then on a landing report, signed handed over / received. */}
                  <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('gb.how')}</Text>
                  <View style={styles.chips}>
                    <TouchableOpacity style={[styles.chip, styles.chipOn]}><Text style={[styles.chipText, styles.chipTextOn]}>{t('mi.destroyed')}</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.chip} onPress={() => { const b = act.batchKey; setAct(null); nav.navigate('MedLanding', { id: 'new', ...(item.controlled ? { mode: 'cd' } : {}), item: item.id, ...(b ? { batch: b } : {}) }); }}>
                      <Text style={styles.chipText}>{t('mi.landed')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.sub}>{t('mi.why')}</Text>
                  <View style={styles.chips}>
                    {DISPOSE_REASONS.map((r) => (
                      <TouchableOpacity key={r} style={[styles.chip, act.note === r && styles.chipOn]} onPress={() => setAct({ ...act, note: r })}>
                        <Text style={[styles.chipText, act.note === r && styles.chipTextOn]}>{tk(`mi.reason.${DISPOSE_REASONS.indexOf(r)}`)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  </>
                )}
                <TextInput style={styles.input} value={act.note} onChangeText={(v) => setAct({ ...act, note: v })} placeholder={act.kind === 'received' ? t('mi.fromPh') : t('mi.howPh')} placeholderTextColor={COLORS.textLight} />
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                {item.controlled ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void doMove()}><Text style={styles.btnText}>{t('common.sign')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <View style={styles.row}>
                {st.usable > 0 ? <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Treatment', { id: 'new', issue: item.id })}><Text style={styles.btnText}>Issue — medical log</Text></TouchableOpacity> : null}
                <TouchableOpacity style={styles.small} onPress={() => setAct({ kind: 'received', qty: '', batchNo: '', expiry: '', note: '' })}><Text style={styles.smallText}>{t('mi.receivePlus')}</Text></TouchableOpacity>
              </View>
            )
          ) : null}

          {refText || ref.med ? (
            <>
              <TouchableOpacity onPress={() => setShowRef(!showRef)}><Text style={[styles.link, { marginTop: SIZES.md }]}>{showRef ? t('mi.hideRef') : t('mi.showRef')}</Text></TouchableOpacity>
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

          <Label>{item.controlled ? t('mi.cdRegister') : t('mi.history', { n: moves.length })}</Label>
          {(item.controlled ? lines.map((l) => ({ m: l.move, bal: l.balance as number | undefined })) : [...moves].sort((a, b) => b.at - a.at).map((m) => ({ m, bal: undefined as number | undefined }))).map(({ m, bal }) => (
            <View key={m.id} style={[styles.item, { borderLeftColor: m.kind === 'received' || m.kind === 'returned' ? COLORS.success : m.kind === 'count' ? COLORS.primary : COLORS.warning }]}>
              <Text style={styles.name}>{`${MOVE_LABEL[m.kind]} ${m.qty} ${item.unit}${bal != null ? ` → ${t('mi.balance', { n: bal })}` : ''}`}</Text>
              <Text style={styles.sub}>{[uiDate(m.date), m.expiry || m.batchNo ? batchLabel(m) : null, m.treatmentId ? t('mi.medLog') : null, m.orderId ? medOrders.find((o) => o.id === m.orderId)?.no : null, m.note].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.sub}>{`${who(m.by, m.byRank)}${m.signedWith ? ` · ${proofShort(m.signedWith)}` : ''}${m.witness ? ` · ${t('mo.witnessL', { who: who(m.witness, m.witnessRank) })}${m.witnessWith ? ` (${proofShort(m.witnessWith)})` : ''}` : ''}`}</Text>
            </View>
          ))}
          {!moves.length ? <Text style={styles.sub}>{t('mi.nothingYet')}</Text> : null}
        </>
      ) : null}
    </Screen>
  );
}
