// ===================================
// Garbage Record Book — Part I (MARPOL Annex V). Record a discharge, delivery
// ashore or incineration; see the month; the Master signs the month; the page
// as PDF or Excel. Rules: services/garbage.ts; the book: types/garbage.ts.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { GARBAGE_CATEGORY, GARBAGE_METHOD, GarbageCategory, GarbageEntry, GarbageMethod } from '../types/garbage';
import { garbageMonth, placeText, seaDischargeProblem } from '../services/garbage';
import { exportGarbageExcel, exportGarbagePdf } from '../services/garbageReport';
import { todayIso } from '../services/pms';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

const CATS = Object.keys(GARBAGE_CATEGORY) as GarbageCategory[];
const METHODS = Object.keys(GARBAGE_METHOD) as GarbageMethod[];
const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
function shiftMonth(m: string, by: number) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function GarbageSc() {
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
  const byMethod = (k: GarbageMethod) => Math.round(m.entries.filter((e) => e.method === k).reduce((n, e) => n + e.volume, 0) * 1000) / 1000;

  // ---- new entry ----
  const blank = { category: 'C' as GarbageCategory, method: 'shore' as GarbageMethod, atSea: false, port: '', position: '', distance: '', comminuted: false, volume: '', receipt: '', container: '', remarks: '', date: today, time: hhmm() };
  const [f, setF] = useState(blank);
  const volume = Number(f.volume.replace(',', '.'));
  const distance = f.distance.trim() ? Number(f.distance.replace(',', '.')) : undefined;
  const problem = seaDischargeProblem({ category: f.category, method: f.method, distanceNm: distance, comminuted: f.comminuted });

  const save = async () => {
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name below.');
    if (!(volume > 0)) return Alert.alert('Amount', 'Enter the estimated amount in m³.');
    if (f.atSea || f.method === 'sea') {
      if (!f.position.trim()) return Alert.alert('Position', 'Enter the ship’s position.');
    } else if (!f.port.trim()) return Alert.alert('Port', 'Enter the port.');
    const go = async () => {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Garbage Record Book — ${f.category} ${GARBAGE_CATEGORY[f.category]}, ${volume} m³` });
      if (!sig) return;
      const now = Date.now();
      const e: GarbageEntry = {
        id: uid('grb'), date: f.date, time: f.time, category: f.category, method: f.method, volume,
        ...(f.atSea || f.method === 'sea' ? { position: f.position.trim(), ...(distance != null ? { distanceNm: distance } : {}) } : { port: f.port.trim() }),
        ...(f.comminuted && f.category === 'B' ? { comminuted: true } : {}),
        ...(f.receipt.trim() ? { receiptNo: f.receipt.trim() } : {}),
        ...(f.container.trim() ? { containerNo: f.container.trim() } : {}),
        ...(f.remarks.trim() ? { remarks: f.remarks.trim() } : {}),
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
      };
      await addGarbage(e);
      setF({ ...blank, port: f.port, position: '', date: today, time: hhmm() });
      setAdding(false);
      playSuccessSound();
    };
    if (problem && f.method === 'sea') {
      Alert.alert('Not allowed at sea', `${problem}\n\nRecord it anyway?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Record', style: 'destructive', onPress: () => void go() }]);
    } else await go();
  };

  const masterSign = async () => {
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name below.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's signature — Garbage Record Book, ${month}` });
    if (!sig) return;
    const now = Date.now();
    await signGarbageMonth({ id: `grb_${month}`, month, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now });
    playSuccessSound();
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const where = kind === 'pdf' ? await exportGarbagePdf(garbage, month, vessel, sign) : await exportGarbageExcel(garbage, month, vessel);
      if (typeof where === 'string') setSaved(where === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${where}”`);
    } catch (e: any) {
      Alert.alert('Garbage Record Book', String(e?.message ?? e));
    }
  };

  const Chip = ({ on, label, onPress, color }: { on: boolean; label: string; onPress: () => void; color?: string }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, { borderColor: color ?? COLORS.primary }, on && { backgroundColor: color ?? COLORS.primary }]}>
      <Text style={[styles.chipText, { color: on ? COLORS.textWhite : color ?? COLORS.primary }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenTitle title="Garbage" subtitle="Garbage Record Book — Part I · MARPOL Annex V" help="Garbage Record Book" />

      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10}><MciIcon name="chevron-left" size={28} color={COLORS.primary} /></TouchableOpacity>
        <Text style={styles.month}>{new Date(`${month}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, 1))} disabled={month >= today.slice(0, 7)} hitSlop={10}>
          <MciIcon name="chevron-right" size={28} color={month >= today.slice(0, 7) ? COLORS.border : COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.stats}>
        {([['To reception facility', 'shore'], ['Incinerated', 'incineration'], ['Into sea', 'sea'], ['Accidental', 'accidental']] as [string, GarbageMethod][]).map(([l, k]) => (
          <View key={k} style={styles.stat}>
            <Text style={[styles.statVal, k === 'accidental' && byMethod(k) ? { color: COLORS.danger } : null]}>{`${byMethod(k)} m³`}</Text>
            <Text style={styles.sub}>{l}</Text>
          </View>
        ))}
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => setAdding((v) => !v)}><Text style={styles.btnText}>{adding ? 'Close' : '+ New entry'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('pdf')}><Text style={styles.btnOutlineText}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      </View>

      {adding ? (
        <Card>
          <Label>Category</Label>
          <View style={styles.chips}>
            {CATS.map((c) => <Chip key={c} on={f.category === c} label={`${c} · ${GARBAGE_CATEGORY[c]}`} onPress={() => setF({ ...f, category: c })} />)}
          </View>
          <Label>How</Label>
          <View style={styles.chips}>
            {METHODS.map((k) => <Chip key={k} on={f.method === k} label={GARBAGE_METHOD[k]} onPress={() => setF({ ...f, method: k, atSea: k === 'sea' ? true : f.atSea })} color={k === 'accidental' ? COLORS.danger : undefined} />)}
          </View>
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>At sea</Text>
            <Switch value={f.atSea || f.method === 'sea'} disabled={f.method === 'sea'} onValueChange={(v) => setF({ ...f, atSea: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {f.atSea || f.method === 'sea' ? (
            <View style={styles.pair}>
              <TextInput style={[styles.input, { flex: 2 }]} value={f.position} onChangeText={(v) => setF({ ...f, position: v })} placeholder="Position — 38°45.2'N 002°10.6'E" placeholderTextColor={COLORS.textLight} />
              <TextInput style={styles.input} value={f.distance} onChangeText={(v) => setF({ ...f, distance: v })} placeholder="nm from land" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            </View>
          ) : (
            <TextInput style={styles.input} value={f.port} onChangeText={(v) => setF({ ...f, port: v })} placeholder="Port" placeholderTextColor={COLORS.textLight} />
          )}
          {f.category === 'B' && f.method === 'sea' ? (
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>Comminuted (ground below 25 mm)</Text>
              <Switch value={f.comminuted} onValueChange={(v) => setF({ ...f, comminuted: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
            </View>
          ) : null}
          <View style={styles.pair}>
            <TextInput style={styles.input} value={f.volume} onChangeText={(v) => setF({ ...f, volume: v })} placeholder="Amount, m³" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={f.date} onChangeText={(v) => setF({ ...f, date: v })} placeholder="yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={f.time} onChangeText={(v) => setF({ ...f, time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.pair}>
            <TextInput style={styles.input} value={f.container} onChangeText={(v) => setF({ ...f, container: v })} placeholder="Container No." placeholderTextColor={COLORS.textLight} />
            {f.method === 'shore' ? <TextInput style={[styles.input, { flex: 2 }]} value={f.receipt} onChangeText={(v) => setF({ ...f, receipt: v })} placeholder="Reception facility receipt No." placeholderTextColor={COLORS.textLight} /> : null}
          </View>
          <TextInput style={styles.input} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder={f.method === 'accidental' ? 'What happened, and what was done' : 'Remarks'} placeholderTextColor={COLORS.textLight} />
          {problem ? <Text style={styles.problem}>{`⚠ ${problem}`}</Text> : null}
          {picker ? (
            <>
              <Text style={styles.sub}>Officer in charge</Text>
              {picker}
            </>
          ) : null}
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void save()}>
            <Text style={styles.btnText}>Sign the entry</Text>
          </TouchableOpacity>
          <Text style={styles.sub}>An entry cannot be changed afterwards. To correct one, make a further entry saying what it corrects.</Text>
        </Card>
      ) : null}

      <Label>{`Entries (${m.entries.length})`}</Label>
      {[...m.entries].reverse().map((e) => (
        <View key={e.id} style={styles.entry}>
          <View style={[styles.cat, e.method === 'accidental' && { backgroundColor: COLORS.danger }]}><Text style={styles.catText}>{e.category}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.entryTitle}>{`${GARBAGE_CATEGORY[e.category]} · ${e.volume} m³ · ${GARBAGE_METHOD[e.method]}`}</Text>
            <Text style={styles.sub}>{[`${formatDate(e.date)} ${e.time}`, placeText(e), e.containerNo ? `container ${e.containerNo}` : null, e.receiptNo ? `receipt ${e.receiptNo}` : null, e.remarks, e.byRank ? `${e.by} (${e.byRank})` : e.by].filter(Boolean).join(' · ')}</Text>
          </View>
        </View>
      ))}
      {!m.entries.length ? <Text style={styles.sub}>No entries this month.</Text> : null}

      <Label>Master</Label>
      {sign ? (
        <Text style={styles.stamp}>{`Signed for ${month}: ${sign.byRank ? `${sign.by} (${sign.byRank})` : sign.by} · ${formatDateTime(sign.at)}`}</Text>
      ) : isMaster ? (
        <TouchableOpacity style={[styles.btnOutline, { alignSelf: 'flex-start' }]} onPress={() => void masterSign()}>
          <Text style={styles.btnOutlineText}>Sign the month as Master</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.sub}>Not signed by the Master yet.</Text>
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
    problem: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small, marginTop: SIZES.sm },
    entry: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    cat: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    catText: { color: COLORS.textWhite, fontWeight: '900' },
    entryTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    stamp: { fontSize: SIZES.body, color: COLORS.textDark },
  });
