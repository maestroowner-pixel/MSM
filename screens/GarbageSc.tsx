// ===================================
// Garbage Record Book — Part I (MARPOL Annex V). Record a discharge, delivery
// ashore or incineration; see the month; the Master signs the month; the page
// as PDF or Excel. Rules: services/garbage.ts; the book: types/garbage.ts.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { MonthPicker, monthName } from '../components/MonthPicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { GARBAGE_CATEGORY, GARBAGE_METHOD, GarbageCategory, GarbageEntry, GarbageMethod } from '../types/garbage';
import { currentEntries, entryItems, garbageMonth, itemsText, placeText, previousVersions, seaDischargeProblem } from '../services/garbage';
import { exportGarbageExcel, exportGarbagePdf } from '../services/garbageReport';
import { todayIso } from '../services/pms';
import { formatDate, uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { PositionInput } from '../components/PositionInput';
import { playSuccessSound } from '../utils/sound';
import { t, tn, useT } from '../utils/i18n';

const CATS = Object.keys(GARBAGE_CATEGORY) as GarbageCategory[];
const METHODS = Object.keys(GARBAGE_METHOD) as GarbageMethod[];
const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function GarbageSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { garbage, garbageSigns, addGarbage, signGarbageMonth, vessel } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const m = useMemo(() => garbageMonth(garbage, month), [garbage, month]);
  const sign = garbageSigns.find((s) => s.month === month);

  // ---- new entry ----
  // Several categories in one operation, each with its amount (m³ as typed).
  const blank = { amounts: {} as Partial<Record<GarbageCategory, string>>, method: 'shore' as GarbageMethod, atSea: false, port: '', position: '', distance: '', comminuted: false, receipt: '', container: '', remarks: '', date: today, time: hhmm() };
  const [f, setF] = useState(blank);
  // Amending an entry: the form opens with it, and the new version must say why.
  const [editing, setEditing] = useState<GarbageEntry | null>(null);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState<GarbageEntry | null>(null);
  const [openHist, setOpenHist] = useState<string | null>(null);
  const startEdit = (e: GarbageEntry) => {
    const amounts: Partial<Record<GarbageCategory, string>> = {};
    for (const i of entryItems(e)) amounts[i.category] = String(i.volume);
    setF({ amounts, method: e.method, atSea: !!e.position, port: e.port ?? '', position: e.position ?? '', distance: e.distanceNm != null ? String(e.distanceNm) : '', comminuted: !!e.comminuted, receipt: e.receiptNo ?? '', container: e.containerNo ?? '', remarks: e.remarks ?? '', date: e.date, time: e.time });
    setEditing(e);
    setReason('');
    setCancelling(null);
    setAdding(true);
  };
  const cancelEntry = async () => {
    if (!cancelling) return;
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    if (reason.trim().length < 3) return Alert.alert(t('gb.reason'), t('gb.whyCancel'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Cancel garbage entry ${formatDate(cancelling.date)} — ${reason.trim()}` });
    if (!sig) return;
    const now = Date.now();
    // The cancelling version carries its own signer — not the original's rank or proof.
    const { byRank: _r, signedWith: _s, ...base } = cancelling;
    await addGarbage({ ...base, id: uid('grb'), supersedes: cancelling.id, cancelled: true, editReason: reason.trim(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now });
    setCancelling(null);
    setReason('');
    playSuccessSound();
  };
  const picked = CATS.filter((c) => f.amounts[c] != null);
  const items = picked.map((c) => ({ category: c, volume: Number((f.amounts[c] ?? '').replace(',', '.')) }));
  const volume = Math.round(items.reduce((n, i) => n + (i.volume > 0 ? i.volume : 0), 0) * 1000) / 1000;
  const distance = f.distance.trim() ? Number(f.distance.replace(',', '.')) : undefined;
  const problem = picked.length ? seaDischargeProblem({ category: picked[0], method: f.method, distanceNm: distance, comminuted: f.comminuted, items }) : null;

  const save = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    if (!picked.length) return Alert.alert(t('pd.category'), t('gb.tapCats'));
    const noAmount = items.filter((i) => !(i.volume > 0)).map((i) => i.category);
    if (noAmount.length) return Alert.alert(t('gb.amount'), t('gb.enterAmount', { cats: noAmount.join(', ') }));
    if (f.atSea || f.method === 'sea') {
      if (!f.position.trim()) return Alert.alert(t('log.position'), t('gb.enterPos'));
    } else if (!f.port.trim()) return Alert.alert(t('ml.port'), t('gb.enterPort'));
    if (editing && reason.trim().length < 3) return Alert.alert(t('gb.reasonChange'), t('gb.whyChange'));
    const go = async () => {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: editing ? `Amend garbage entry — ${reason.trim()}` : `Garbage Record Book — ${items.map((i) => `${i.category} ${i.volume}`).join(', ')} m³` });
      if (!sig) return;
      const now = Date.now();
      const e: GarbageEntry = {
        id: uid('grb'), date: f.date, time: f.time, category: picked[0], method: f.method, volume, items,
        ...(f.atSea || f.method === 'sea' ? { position: f.position.trim(), ...(distance != null ? { distanceNm: distance } : {}) } : { port: f.port.trim() }),
        ...(f.comminuted && picked.includes('B') ? { comminuted: true } : {}),
        ...(f.receipt.trim() ? { receiptNo: f.receipt.trim() } : {}),
        ...(f.container.trim() ? { containerNo: f.container.trim() } : {}),
        ...(f.remarks.trim() ? { remarks: f.remarks.trim() } : {}),
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
        ...(editing ? { supersedes: editing.id, editReason: reason.trim() } : {}),
      };
      await addGarbage(e);
      setEditing(null);
      setReason('');
      setF({ ...blank, port: f.port, position: '', date: today, time: hhmm() });
      setAdding(false);
      playSuccessSound();
    };
    if (problem && f.method === 'sea') {
      Alert.alert(t('gb.notAllowed'), `${problem}\n\n${t('gb.recordAnyway')}`, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('gb.record'), style: 'destructive', onPress: () => void go() }]);
    } else await go();
  };

  const masterSign = async () => {
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's signature — Garbage Record Book, ${month}` });
    if (!sig) return;
    const now = Date.now();
    await signGarbageMonth({ id: `grb_${month}`, month, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now });
    playSuccessSound();
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const where = kind === 'pdf' ? await exportGarbagePdf(garbage, month, vessel, sign) : await exportGarbageExcel(garbage, month, vessel);
      if (typeof where === 'string') setSaved(where === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: where }));
    } catch (e: any) {
      Alert.alert(t('gb.book'), String(e?.message ?? e));
    }
  };

  const Chip = ({ on, label, onPress, color }: { on: boolean; label: string; onPress: () => void; color?: string }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { borderColor: color ?? COLORS.primary }, on && { backgroundColor: color ?? COLORS.primary }]}>
      <Text style={[styles.chipText, { color: on ? COLORS.textWhite : color ?? COLORS.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenTitle
        title={`${t('gb.title')} — ${monthName(month)}`}
        subtitle={t('gb.sub')}
        help="Garbage Record Book"
        actions={<MonthPicker value={month} onChange={setMonth} months={[...new Set(garbage.map((e) => e.date.slice(0, 7)))]} counts={currentEntries(garbage).reduce((c: Record<string, number>, e) => ((c[e.date.slice(0, 7)] = (c[e.date.slice(0, 7)] ?? 0) + 1), c), {})} />}
      />

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => { setAdding((v) => !v); setEditing(null); setReason(''); setF(blank); }}><Text style={styles.btnText}>{adding ? t('common.close') : t('book.newEntry')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('pdf')}><Text style={styles.btnOutlineText}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      </View>

      {adding ? (
        <Card>
          <Label>{t('pd.category')}</Label>
          <View style={styles.chips}>
            {CATS.map((c) => (
              <Chip
                key={c}
                on={f.amounts[c] != null}
                label={`${c} · ${GARBAGE_CATEGORY[c]}`}
                onPress={() => {
                  const a = { ...f.amounts };
                  if (a[c] != null) delete a[c];
                  else a[c] = '';
                  setF({ ...f, amounts: a });
                }}
              />
            ))}
          </View>
          {picked.length ? <Label>{t('gb.amountM3')}</Label> : null}
          <View style={styles.amounts}>
            {picked.map((c) => (
              <View key={c} style={styles.amountRow}>
                <Text style={styles.amountLabel} numberOfLines={1}>{`${c} · ${GARBAGE_CATEGORY[c]}`}</Text>
                <TextInput style={[styles.input, styles.amountInput]} value={f.amounts[c] ?? ''} onChangeText={(v) => setF({ ...f, amounts: { ...f.amounts, [c]: v } })} placeholder="m³" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
              </View>
            ))}
            {picked.length > 1 ? <Text style={styles.sub}>{t('gb.total', { n: volume })}</Text> : null}
          </View>
          <Label>{t('gb.how')}</Label>
          <View style={styles.chips}>
            {METHODS.map((k) => <Chip key={k} on={f.method === k} label={GARBAGE_METHOD[k]} onPress={() => setF({ ...f, method: k, atSea: k === 'sea' ? true : f.atSea })} color={k === 'accidental' ? COLORS.danger : undefined} />)}
          </View>
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>{t('gb.atSea')}</Text>
            <Switch value={f.atSea || f.method === 'sea'} disabled={f.method === 'sea'} onValueChange={(v) => setF({ ...f, atSea: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {f.atSea || f.method === 'sea' ? (
            <>
              <PositionInput portAllowed={false} position={f.position} onChange={(pos) => setF((x) => ({ ...x, position: pos }))} />
              <TextInput style={styles.input} value={f.distance} onChangeText={(v) => setF({ ...f, distance: v })} placeholder={t('gb.nmPh')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            </>
          ) : (
            <TextInput style={styles.input} value={f.port} onChangeText={(v) => setF({ ...f, port: v })} placeholder={t('ml.port')} placeholderTextColor={COLORS.textLight} />
          )}
          {picked.includes('B') && f.method === 'sea' ? (
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>{t('gb.comminuted')}</Text>
              <Switch value={f.comminuted} onValueChange={(v) => setF({ ...f, comminuted: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
            </View>
          ) : null}
          <View style={styles.pair}>
            <TextInput style={styles.input} value={f.date} onChangeText={(v) => setF({ ...f, date: v })} placeholder="yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={f.time} onChangeText={(v) => setF({ ...f, time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.pair}>
            <TextInput style={styles.input} value={f.container} onChangeText={(v) => setF({ ...f, container: v })} placeholder={t('gb.container')} placeholderTextColor={COLORS.textLight} />
            {f.method === 'shore' ? <TextInput style={[styles.input, { flex: 2 }]} value={f.receipt} onChangeText={(v) => setF({ ...f, receipt: v })} placeholder={t('log.receiptNo')} placeholderTextColor={COLORS.textLight} /> : null}
          </View>
          <TextInput style={styles.input} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder={f.method === 'accidental' ? t('gb.accidentPh') : t('book.remarks')} placeholderTextColor={COLORS.textLight} />
          {problem ? <Text style={styles.problem}>{`⚠ ${problem}`}</Text> : null}
          {picker ? (
            <>
              <Text style={styles.sub}>{t('book.oic')}</Text>
              {picker}
            </>
          ) : null}
          {editing ? (
            <TextInput style={[styles.input, { borderColor: COLORS.warning, borderWidth: 1 }]} value={reason} onChangeText={setReason} placeholder={t('gb.reasonChangePh')} placeholderTextColor={COLORS.textLight} />
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md }}>
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void save()}>
              <Text style={styles.btnText}>{editing ? t('gb.signChange') : t('book.signEntry')}</Text>
            </TouchableOpacity>
            {editing ? <TouchableOpacity onPress={() => { setEditing(null); setAdding(false); setF(blank); }}><Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('common.cancel')}</Text></TouchableOpacity> : null}
          </View>
          <Text style={styles.sub}>{editing ? t('gb.changing', { when: `${uiDate(editing.date)} ${editing.time}` }) : t('gb.changeLater')}</Text>
        </Card>
      ) : null}

      <Label>{t('book.entries', { n: m.entries.length })}</Label>
      {cancelling ? (
        <Card>
          <Label>{t('gb.cancelEntry', { when: `${uiDate(cancelling.date)} ${cancelling.time}` })}</Label>
          <Text style={styles.sub}>{t('gb.struck')}</Text>
          <TextInput style={[styles.input, { borderColor: COLORS.warning, borderWidth: 1 }]} value={reason} onChangeText={setReason} placeholder={t('gb.reasonPh')} placeholderTextColor={COLORS.textLight} />
          {picker}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md }}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => void cancelEntry()}><Text style={styles.btnText}>{t('gb.signCancel')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setCancelling(null); setReason(''); }}><Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('cat.keep')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}
      {[...m.entries].reverse().map((e) => {
        const prev = previousVersions(garbage, e);
        return (
          <View key={e.id} style={[styles.entry, e.cancelled && { opacity: 0.6 }]}>
            <View style={[styles.cat, e.method === 'accidental' && { backgroundColor: COLORS.danger }, e.cancelled && { backgroundColor: COLORS.textLight }]}><Text style={styles.catText} numberOfLines={1}>{entryItems(e).map((i) => i.category).join('')}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.entryTitle, e.cancelled && { textDecorationLine: 'line-through' }]}>{`${itemsText(e, (c) => GARBAGE_CATEGORY[c])} m³ · ${GARBAGE_METHOD[e.method]}`}</Text>
              <Text style={styles.sub}>{[`${uiDate(e.date)} ${e.time}`, placeText(e), e.containerNo ? t('gb.containerL', { n: e.containerNo }) : null, e.receiptNo ? t('gb.receiptL', { n: e.receiptNo }) : null, e.remarks, e.byRank ? `${e.by} (${e.byRank})` : e.by].filter(Boolean).join(' · ')}</Text>
              {e.supersedes ? (
                <TouchableOpacity onPress={() => setOpenHist(openHist === e.id ? null : e.id)}>
                  <Text style={[styles.sub, { color: e.cancelled ? COLORS.danger : COLORS.warning, fontWeight: '700' }]}>
                    {`${e.cancelled ? t('gb.cancelledBy', { when: uiDateTime(e.at), by: e.byRank ? `${e.by} (${e.byRank})` : e.by }) : t('gb.amendedBy', { when: uiDateTime(e.at), by: e.byRank ? `${e.by} (${e.byRank})` : e.by })} — ${e.editReason ?? ''} · ${tn('n.version', prev.length)} ${openHist === e.id ? '▴' : '▾'}`}
                  </Text>
                </TouchableOpacity>
              ) : null}
              {openHist === e.id
                ? prev.map((v) => (
                    <Text key={v.id} style={[styles.sub, { textDecorationLine: 'line-through' }]}>
                      {[`${itemsText(v, (c) => GARBAGE_CATEGORY[c])} m³ · ${GARBAGE_METHOD[v.method]}`, `${uiDate(v.date)} ${v.time}`, placeText(v), v.byRank ? `${v.by} (${v.byRank})` : v.by, v.editReason ? `(${v.editReason})` : null].filter(Boolean).join(' · ')}
                    </Text>
                  ))
                : null}
            </View>
            {!e.cancelled ? (
              // Changing the book is the Master's (10 Oct 2026): everyone else sees
              // the controls greyed out. The server refuses it too (firestore.rules).
              <View style={{ gap: 6, opacity: isMaster ? 1 : 0.35 }} accessibilityState={{ disabled: !isMaster }}>
                <TouchableOpacity disabled={!isMaster} onPress={() => startEdit(e)} hitSlop={6}><Text style={{ color: isMaster ? COLORS.primary : COLORS.textLight, fontWeight: '700', fontSize: SIZES.small }}>{t('common.edit')}</Text></TouchableOpacity>
                <TouchableOpacity disabled={!isMaster} onPress={() => { setCancelling(e); setReason(''); setEditing(null); }} hitSlop={6}><Text style={{ color: isMaster ? COLORS.danger : COLORS.textLight, fontWeight: '700', fontSize: SIZES.small }}>{t('common.delete')}</Text></TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}
      {!m.entries.length ? <Text style={styles.sub}>{t('book.noneMonth')}</Text> : null}

      <Label>{t('book.master')}</Label>
      {sign ? (
        <Text style={styles.stamp}>{`${t('book.signedFor', { month, by: sign.byRank ? `${sign.by} (${sign.byRank})` : sign.by })} · ${uiDateTime(sign.at)}`}</Text>
      ) : isMaster ? (
        <TouchableOpacity style={[styles.btnOutline, { alignSelf: 'flex-start' }]} onPress={() => void masterSign()}>
          <Text style={styles.btnOutlineText}>{t('book.signMonth')}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.sub}>{t('gb.notSigned')}</Text>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
    month: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    stat: { flex: 1, minWidth: 140, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, alignItems: 'center' },
    statVal: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginVertical: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1 },
    chipText: { fontWeight: '600', fontSize: SIZES.small },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginVertical: SIZES.xs },
    toggleText: { flex: 1, fontSize: SIZES.body, color: COLORS.textDark },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    input: { flex: 1, minWidth: 110, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    amounts: { gap: 4, marginBottom: SIZES.sm },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    amountLabel: { flex: 1, fontSize: SIZES.body, color: COLORS.textDark },
    amountInput: { flex: 0, width: 110, minWidth: 110, textAlign: 'right' },
    problem: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small, marginTop: SIZES.sm },
    entry: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    cat: { minWidth: 30, height: 30, paddingHorizontal: 6, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    catText: { color: COLORS.textWhite, fontWeight: '900' },
    entryTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    stamp: { fontSize: SIZES.body, color: COLORS.textDark },
  });
