// ===================================
// Oil Record Book — Part I (machinery space operations). One entry per
// operation under its code A–I; the form asks for what that code needs
// (services/orb.ts) and shows the line as it will read in the book. Signed by
// the officer in charge; the Master signs the month, and alone changes or
// deletes an entry (with the reason — services/versions). Bunkerings can be
// taken from Fuel. PDF / Excel of the month.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MonthPicker, monthName } from '../components/MonthPicker';
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { ORB_CODE, ORB_METHOD, OrbCode, OrbEntry, OrbMethod } from '../types/orb';
import { ORB_FIELDS, orbProblem, orbText } from '../services/orb';
import { exportOrbExcel, exportOrbPdf } from '../services/orbReport';
import { current } from '../services/versions';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

const CODES = Object.keys(ORB_CODE) as OrbCode[];
const METHODS_FOR: Partial<Record<OrbCode, OrbMethod[]>> = {
  B: ['ows', 'shore', 'tank'],
  C: ['shore', 'incinerator', 'tank'],
  D: ['ows', 'holding', 'shore'],
};
const hhmm = () => new Date().toTimeString().slice(0, 5);
const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

export default function OrbSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { orbSigns, versionsOf, appendRow, vessel, fuelBunkers, fuelTanks } = useData();
  const sync = useSync();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const amend = useAmend();
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const all = versionsOf(storage.ORB_KEY) as OrbEntry[];
  const book = useMemo(() => current(all).filter((e) => e.date.startsWith(month)).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`)), [all, month]);
  const sign = orbSigns.find((s) => s.month === month);

  // ---- the form ----
  const blank = { code: 'D' as OrbCode, date: today, time: hhmm(), tank: '', quantity: '', unit: 'm3' as 'm3' | 't', retained: '', method: '' as OrbMethod | '', place: '', start: '', stop: '', grade: '', bdnNo: '', receiptNo: '', remarks: '' };
  const [f, setF] = useState(blank);
  const fields = ORB_FIELDS[f.code];
  const draft = {
    date: f.date, time: f.time, code: f.code,
    ...(f.tank.trim() ? { tank: f.tank.trim() } : {}),
    ...(num(f.quantity) != null ? { quantity: num(f.quantity)! } : {}),
    ...(f.code === 'H' ? { unit: f.unit } : {}),
    ...(num(f.retained) != null ? { retained: num(f.retained)! } : {}),
    ...(f.method ? { method: f.method } : {}),
    ...(f.place.trim() ? { place: f.place.trim() } : {}),
    ...(f.start.trim() ? { start: f.start.trim() } : {}),
    ...(f.stop.trim() ? { stop: f.stop.trim() } : {}),
    ...(f.grade.trim() ? { grade: f.grade.trim() } : {}),
    ...(f.bdnNo.trim() ? { bdnNo: f.bdnNo.trim() } : {}),
    ...(f.receiptNo.trim() ? { receiptNo: f.receiptNo.trim() } : {}),
    ...(f.remarks.trim() ? { remarks: f.remarks.trim() } : {}),
  };
  const problem = orbProblem(draft as any);
  const preview = orbText(draft as any);

  // Bunkerings in Fuel this month not yet in the book (matched by BDN or date + litres).
  const fromFuel = fuelBunkers.filter((b) => b.date.startsWith(month) && !current(all).some((e) => e.code === 'H' && !e.cancelled && ((b.bdnNo && e.bdnNo === b.bdnNo) || (e.date === b.date && Math.abs((e.quantity ?? 0) - b.litres / 1000) < 0.01))));
  const takeBunker = (b: (typeof fuelBunkers)[number]) =>
    setF({ ...blank, code: 'H', date: b.date, time: b.time ?? hhmm(), place: b.port, grade: 'MGO', quantity: String(Math.round(b.litres) / 1000), tank: Object.keys(b.into).map((id) => fuelTanks.find((t) => t.id === id)?.name ?? id).join(', ') || '', bdnNo: b.bdnNo ?? '' });

  const save = async () => {
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name below.');
    if (problem) return Alert.alert('Oil Record Book', problem);
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Oil Record Book — code ${f.code}` });
    if (!sig) return;
    const now = Date.now();
    const e: OrbEntry = { id: uid('orb'), ...(draft as any), text: preview, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now };
    await appendRow(storage.ORB_KEY, e);
    setF({ ...blank, time: hhmm() });
    setAdding(false);
    playSuccessSound();
  };

  const masterSign = async () => {
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name below.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Master's signature — Oil Record Book, ${month}` });
    if (!sig) return;
    const now = Date.now();
    await appendRow(storage.ORB_SIGNS_KEY, { id: `orb_${month}`, month, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now });
    playSuccessSound();
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportOrbPdf(book, month, vessel, sign) : await exportOrbExcel(book, month, vessel, sign);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Oil Record Book', String(e?.message ?? e));
    }
  };

  // A plain function, not a component: a component declared here would remount
  // its TextInput on every keystroke and lose the focus.
  const T = ({ k, ph, kb }: { k: keyof typeof f; ph: string; kb?: 'decimal-pad' }) => (
    <TextInput style={styles.input} value={String(f[k])} onChangeText={(v) => setF({ ...f, [k]: v })} placeholder={ph} placeholderTextColor={COLORS.textLight} keyboardType={kb} />
  );
  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, on && styles.chipOn]}><Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text></TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenTitle
        title={`Oil Record Book — ${monthName(month)}`}
        subtitle="Part I · machinery space operations · MARPOL Annex I"
        help="Oil Record Book"
        actions={<MonthPicker value={month} onChange={setMonth} months={[...new Set(all.map((e) => e.date.slice(0, 7)))]} />}
      />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => { setF({ ...blank, time: hhmm() }); setAdding((v) => !v); }}><Text style={styles.btnText}>{adding ? 'Close' : '+ New entry'}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('pdf')}><Text style={styles.btnOutlineText}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      </View>

      {adding ? (
        <Card>
          <Label>Code</Label>
          <View style={styles.chips}>
            {CODES.map((c) => <Chip key={c} on={f.code === c} label={`${c} · ${ORB_CODE[c]}`} onPress={() => setF({ ...f, code: c, method: '' })} />)}
          </View>
          {f.code === 'H' && fromFuel.length ? (
            <View style={styles.chips}>
              {fromFuel.map((b) => <Chip key={b.id} on={false} label={`From Fuel: ${formatDate(b.date)} · ${b.port} · ${b.litres} L`} onPress={() => takeBunker(b)} />)}
            </View>
          ) : null}
          <View style={styles.pair}>
            {T({ k: "date",  ph: "yyyy-mm-dd" })}
            {T({ k: "time",  ph: "hh:mm" })}
          </View>
          {fields.includes('tank') ? T({ k: 'tank', ph: f.code === 'H' ? 'Tank(s) bunkered into' : f.code === 'C' ? 'Sludge / residue tank' : f.code === 'D' ? 'Bilge holding tank / bilge' : 'Tank(s)' }) : null}
          <View style={styles.pair}>
            {fields.includes('retained') ? T({ k: "retained",  ph: "C 11 — retained, m³",  kb: "decimal-pad" }) : null}
            {fields.includes('quantity') ? T({ k: 'quantity', ph: f.code === 'C' ? 'C 12 — disposed of, m³' : f.code === 'H' ? `Quantity, ${f.unit === 't' ? 't' : 'm³'}` : 'Quantity, m³', kb: 'decimal-pad' }) : null}
            {f.code === 'H' ? <Chip on={f.unit === 't'} label={f.unit === 't' ? 'tonnes' : 'm³'} onPress={() => setF({ ...f, unit: f.unit === 't' ? 'm3' : 't' })} /> : null}
          </View>
          {fields.includes('method') ? (
            <View style={styles.chips}>
              {(METHODS_FOR[f.code] ?? []).map((m) => <Chip key={m} on={f.method === m} label={ORB_METHOD[m]} onPress={() => setF({ ...f, method: m })} />)}
            </View>
          ) : null}
          {fields.includes('place') ? T({ k: "place",  ph: f.code === 'H' ? 'Port' : 'Position (start – stop) or port' }) : null}
          <View style={styles.pair}>
            {fields.includes('start') ? T({ k: "start",  ph: f.code === 'F' ? 'Time of failure' : f.code === 'E' ? 'Into automatic, hh:mm' : 'Start, hh:mm' }) : null}
            {fields.includes('stop') ? T({ k: "stop",  ph: f.code === 'F' ? 'Back in operation, hh:mm' : f.code === 'E' ? 'Back to manual, hh:mm' : 'Stop, hh:mm' }) : null}
          </View>
          <View style={styles.pair}>
            {fields.includes('grade') ? T({ k: "grade",  ph: "Grade — MGO DMA, lube oil SAE 40…" }) : null}
            {fields.includes('bdnNo') ? T({ k: "bdnNo",  ph: "BDN No." }) : null}
            {fields.includes('receiptNo') ? T({ k: "receiptNo",  ph: "Reception facility receipt No." }) : null}
          </View>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder={f.code === 'F' || f.code === 'G' ? 'What happened, cause, action taken ★' : f.code === 'I' ? 'Remark ★' : 'Remarks'} placeholderTextColor={COLORS.textLight} multiline />
          <Text style={styles.previewLabel}>In the book</Text>
          <Text style={styles.preview}>{`${f.code} · ${preview || '—'}`}</Text>
          {problem ? <Text style={styles.problem}>{`⚠ ${problem}`}</Text> : null}
          {picker ? <><Text style={styles.sub}>Officer in charge</Text>{picker}</> : null}
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }, problem && { opacity: 0.5 }]} onPress={() => void save()}><Text style={styles.btnText}>Sign the entry</Text></TouchableOpacity>
        </Card>
      ) : null}

      <Label>{`Entries (${book.length})`}</Label>
      {book.map((e) => (
        <View key={e.id} style={[styles.entry, e.cancelled && { opacity: 0.6 }]}>
          <View style={[styles.code, e.code === 'G' && { backgroundColor: COLORS.danger }]}><Text style={styles.codeText}>{e.code}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.text, e.cancelled && { textDecorationLine: 'line-through' }]}>{e.text}</Text>
            <Text style={styles.sub}>{`${formatDate(e.date)}${e.time ? ` ${e.time}` : ''} · ${e.byRank ? `${e.by} (${e.byRank})` : e.by}`}</Text>
            <AmendNote rec={e} all={all} summary={(p) => `${p.code} · ${p.text}`} />
          </View>
          {!e.cancelled ? (
            <AmendButtons
              isMaster={isMaster}
              onEdit={() => amend.edit({ store: storage.ORB_KEY, record: e, what: `Oil Record Book ${e.code}, ${formatDate(e.date)}`, fields: [{ key: 'date', label: 'Date (yyyy-mm-dd)' }, { key: 'time', label: 'Time' }, { key: 'text', label: 'Record of operations (as in the book)', kind: 'multiline' }] })}
              onDelete={() => amend.remove({ store: storage.ORB_KEY, record: e, what: `Oil Record Book ${e.code}, ${formatDate(e.date)}` })}
            />
          ) : null}
        </View>
      ))}
      {!book.length ? <Text style={styles.sub}>No entries this month.</Text> : null}

      <Label>Master</Label>
      {sign ? (
        <Text style={styles.text}>{`Signed for ${month}: ${sign.byRank ? `${sign.by} (${sign.byRank})` : sign.by} · ${formatDateTime(sign.at)}`}</Text>
      ) : (
        <TouchableOpacity disabled={!isMaster} style={[styles.btnOutline, { alignSelf: 'flex-start', opacity: isMaster ? 1 : 0.35 }]} onPress={() => void masterSign()}>
          <Text style={styles.btnOutlineText}>Sign the month as Master</Text>
        </TouchableOpacity>
      )}
      {amend.ui}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, alignItems: 'center' },
    input: { flex: 1, minWidth: 140, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    previewLabel: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, letterSpacing: 0.6, marginTop: SIZES.md, textTransform: 'uppercase' },
    preview: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 2, fontFamily: undefined },
    problem: { color: COLORS.warning, fontWeight: '700', fontSize: SIZES.small, marginTop: SIZES.sm },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    entry: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs },
    code: { width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    codeText: { color: COLORS.textWhite, fontWeight: '900' },
    text: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
  });
