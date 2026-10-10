// ===================================
// Fuel — the day's soundings, the month at a glance, bunkerings, transfers and
// the tanks; the monthly report as PDF or Excel. The arithmetic is in
// services/fuel.ts, the report in services/fuelReport.ts.
//
// One fuel, diesel, in litres (owner's decision, 10 Oct 2026). A vessel starts
// with two tanks — port and starboard — and adds, renames or removes them to
// match what it has.
// ===================================

import React, { useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FuelDaily } from '../components/FuelDaily';
import { MonthPicker } from '../components/MonthPicker';
import { useSignConfirm } from '../components/SignConfirm';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { Dropdown } from '../components/Dropdown';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { DEFAULT_TANKS, FuelBunker, FuelReading, FuelTank, FuelTransfer } from '../types/fuel';
import { fuelMonth, orbBunkerLine, robTotal, transferText } from '../services/fuel';
import { exportFuelExcel, exportFuelPdf } from '../services/fuelReport';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

const nf = (x?: number) => (x == null ? '—' : `${x.toLocaleString('en-GB', { maximumFractionDigits: 1 })} L`);
const num = (v: string) => {
  const x = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(x) && x >= 0 ? x : undefined;
};
const hhmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type Panel = 'none' | 'bunker' | 'transfer' | 'tanks';

export default function FuelSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { fuelTanks: tanks, fuelReadings, fuelBunkers, fuelTransfers, saveFuel, vessel } = useData();
  const { signer, picker } = useSigner();
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [panel, setPanel] = useState<Panel>('none');
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const view: 'sounding' | 'daily' = route.params?.view === 'daily' ? 'daily' : 'sounding';
  const setView = (v: 'sounding' | 'daily') => nav.setParams({ view: v });
  const [saved, setSaved] = useState<string | null>(null);

  const m = useMemo(() => fuelMonth(month, tanks, fuelReadings, fuelBunkers, fuelTransfers), [month, tanks, fuelReadings, fuelBunkers, fuelTransfers]);
  const todays = fuelReadings.find((r) => r.date === today);
  const [rob, setRob] = useState<Record<string, string>>({});
  const robValue = (t: FuelTank) => rob[t.id] ?? (todays?.tanks[t.id] != null ? String(todays.tanks[t.id]) : '');

  // Each record is signed: the name, and the PIN / fingerprint / hand that confirmed it.
  const confirmSign = useSignConfirm();
  const by = async (what: string) => {
    if (!signer) return null;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return undefined;
    return { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}) };
  };
  const needSigner = () => {
    Alert.alert('Who is recording?', 'Choose your name below.');
    return null;
  };

  const setupTanks = async () => {
    for (const t of DEFAULT_TANKS) await saveFuel('tank', { ...t, id: uid('tank') });
  };

  const saveSounding = async () => {
    if (!signer) return needSigner();
    const vals: Record<string, number> = {};
    for (const t of tanks) {
      const v = num(robValue(t));
      if (v == null) return Alert.alert('Sounding', `Enter the litres in ${t.name}.`);
      vals[t.id] = v;
    }
    const who = await by('Fuel sounding');
    if (!who) return;
    const r: FuelReading = { id: `rob_${today}`, date: today, time: hhmm(), tanks: vals, ...who, updatedAt: Date.now() };
    await saveFuel('reading', r);
    setRob({});
    playSuccessSound();
  };

  // ---- bunkering form ----
  const [bk, setBk] = useState({ port: '', supplier: '', litres: '', density: '', sulphur: '', bdn: '', note: '', into: {} as Record<string, string> });
  const saveBunker = async () => {
    if (!signer) return needSigner();
    const litres = num(bk.litres);
    if (!bk.port.trim() || !litres) return Alert.alert('Bunkering', 'Port and litres received are needed.');
    const into: Record<string, number> = {};
    for (const t of tanks) {
      const v = num(bk.into[t.id] ?? '');
      if (v) into[t.id] = v;
    }
    if (!Object.keys(into).length && tanks.length === 1) into[tanks[0].id] = litres;
    const split = Object.values(into).reduce((a, b) => a + b, 0);
    if (Object.keys(into).length && Math.abs(split - litres) > 1) return Alert.alert('Bunkering', `The tanks add up to ${split} L, not ${litres} L.`);
    const who = await by(`Bunkering — ${litres} L at ${bk.port.trim()}`);
    if (!who) return;
    const b: FuelBunker = {
      id: uid('bunk'), date: today, time: hhmm(), port: bk.port.trim(), litres, into, ...who, updatedAt: Date.now(),
      ...(bk.supplier.trim() ? { supplier: bk.supplier.trim() } : {}),
      ...(num(bk.density) ? { density: num(bk.density) } : {}),
      ...(num(bk.sulphur) != null && bk.sulphur.trim() ? { sulphur: num(bk.sulphur) } : {}),
      ...(bk.bdn.trim() ? { bdnNo: bk.bdn.trim() } : {}),
      ...(bk.note.trim() ? { note: bk.note.trim() } : {}),
    };
    await saveFuel('bunker', b);
    setBk({ port: '', supplier: '', litres: '', density: '', sulphur: '', bdn: '', note: '', into: {} });
    setPanel('none');
    playSuccessSound();
  };

  // ---- transfer form ----
  const [tf, setTf] = useState({ from: '', to: '', litres: '' });
  const saveTransfer = async () => {
    if (!signer) return needSigner();
    const litres = num(tf.litres);
    if (!tf.from || !tf.to || tf.from === tf.to || !litres) return Alert.alert('Transfer', 'Choose two different tanks and the litres moved.');
    const who = await by(`Fuel transfer — ${litres} L`);
    if (!who) return;
    const t: FuelTransfer = { id: uid('xfer'), date: today, time: hhmm(), fromTankId: tf.from, toTankId: tf.to, litres, ...who, updatedAt: Date.now() };
    await saveFuel('transfer', t);
    setTf({ from: '', to: '', litres: '' });
    setPanel('none');
    playSuccessSound();
  };

  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const where = kind === 'pdf' ? await exportFuelPdf(m, tanks, vessel) : await exportFuelExcel(m, tanks, vessel);
      if (typeof where === 'string') setSaved(where === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${where}”`);
    } catch (e: any) {
      Alert.alert('Fuel report', String(e?.message ?? e));
    }
  };

  if (!tanks.length) {
    return (
      <Screen scroll>
        <ScreenTitle title="Fuel" subtitle="Diesel — soundings, bunkering, consumption" help="Fuel" />
        <Empty text="No tanks yet. Start with two — port and starboard — and rename, add or remove them to match the vessel." />
        <TouchableOpacity style={[styles.btn, { alignSelf: 'center' }]} onPress={() => void setupTanks()}>
          <Text style={styles.btnText}>Set up two tanks</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const shownDays = m.days.filter((d) => d.rob != null || d.received).reverse();

  // Fuel has two pages — Sounding and Daily report — opened from the menu's
  // Fuel sub-items, or from these chips (the phone's bar has no sub-items).
  const viewSwitch = (
    <View style={styles.views}>
      {([['sounding', 'Sounding'], ['daily', 'Daily report']] as const).map(([k, l]) => (
        <TouchableOpacity key={k} onPress={() => setView(k)} style={[styles.viewChip, view === k && { backgroundColor: COLORS.primary }]}>
          <Text style={[styles.viewChipText, view === k && { color: COLORS.textWhite }]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  if (view === 'daily') {
    return (
      <Screen scroll>
        <ScreenTitle title="Fuel — daily report" subtitle="The noon report: consumption over the last day, from the soundings" help="Fuel" />
        {viewSwitch}
        <FuelDaily onSounding={() => setView('sounding')} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle
        title="Fuel — sounding"
        subtitle="Diesel — soundings, bunkering, consumption"
        help="Fuel"
        actions={<MonthPicker value={month} onChange={setMonth} months={[...new Set([...fuelReadings.map((r) => r.date.slice(0, 7)), ...fuelBunkers.map((b) => b.date.slice(0, 7))])]} />}
      />
      {viewSwitch}

      {/* Today's sounding */}
      <Card>
        <Label>{todays ? `Today's sounding — ${todays.time ?? ''} by ${todays.by}` : "Today's sounding"}</Label>
        {tanks.map((t) => (
          <View key={t.id} style={styles.tankRow}>
            <Text style={styles.tankName} numberOfLines={1}>{t.name}</Text>
            <TextInput style={styles.litres} value={robValue(t)} onChangeText={(v) => setRob({ ...rob, [t.id]: v })} keyboardType="decimal-pad" placeholder="litres" placeholderTextColor={COLORS.textLight} />
            {t.capacity && num(robValue(t)) != null ? <Text style={styles.pct}>{`${Math.round((num(robValue(t))! / t.capacity) * 100)} %`}</Text> : <View style={{ width: 44 }} />}
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.total}>{`ROB ${nf(tanks.reduce((n, t) => n + (num(robValue(t)) ?? 0), 0))}`}</Text>
          <TouchableOpacity style={styles.btn} onPress={() => void saveSounding()}>
            <Text style={styles.btnText}>{todays ? 'Update' : 'Save sounding'}</Text>
          </TouchableOpacity>
        </View>
        {picker ? (
          <>
            <Text style={styles.sub}>Recording as</Text>
            {picker}
          </>
        ) : null}
      </Card>

      {/* Month — picked in the title */}
      <Text style={styles.monthHead}>{new Date(`${month}-01T00:00:00Z`).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
      <View style={styles.stats}>
        {([['Opening ROB', m.opening], ['Received', m.received], ['Consumed', m.consumed], ['Closing ROB', m.closing]] as [string, number | undefined][]).map(([l, v]) => (
          <View key={l} style={styles.stat}>
            <Text style={styles.statVal}>{nf(v)}</Text>
            <Text style={styles.sub}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={styles.reportRow}>
        <TouchableOpacity style={styles.btn} onPress={() => void report('pdf')}><Text style={styles.btnText}>Monthly report (PDF)</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      </View>

      <Label>Day by day</Label>
      {shownDays.length ? (
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            {['Date', 'ROB', 'Received', 'Consumed'].map((h) => <Text key={h} style={[styles.td, styles.thText]}>{h}</Text>)}
          </View>
          {shownDays.map((d) => (
            <View key={d.date} style={styles.tr}>
              <Text style={styles.td}>{formatDate(d.date)}</Text>
              <Text style={styles.td}>{d.rob == null ? '—' : nf(d.rob)}</Text>
              <Text style={styles.td}>{d.received ? nf(d.received) : ''}</Text>
              <Text style={[styles.td, d.suspect && { color: COLORS.danger, fontWeight: '700' }]}>
                {d.consumed == null ? '' : `${nf(d.consumed)}${d.span && d.span > 1 ? ` · ${d.span} d` : ''}${d.suspect ? ' ⚠ check' : ''}`}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.sub}>No soundings this month.</Text>
      )}

      {/* Bunkering, transfers, tanks */}
      <View style={styles.reportRow}>
        <TouchableOpacity style={[styles.btnOutline, panel === 'bunker' && styles.btnOn]} onPress={() => setPanel(panel === 'bunker' ? 'none' : 'bunker')}><Text style={[styles.btnOutlineText, panel === 'bunker' && { color: COLORS.textWhite }]}>+ Bunkering</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnOutline, panel === 'transfer' && styles.btnOn]} onPress={() => setPanel(panel === 'transfer' ? 'none' : 'transfer')}><Text style={[styles.btnOutlineText, panel === 'transfer' && { color: COLORS.textWhite }]}>+ Transfer</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnOutline, panel === 'tanks' && styles.btnOn]} onPress={() => setPanel(panel === 'tanks' ? 'none' : 'tanks')}><Text style={[styles.btnOutlineText, panel === 'tanks' && { color: COLORS.textWhite }]}>Tanks</Text></TouchableOpacity>
      </View>

      {panel === 'bunker' ? (
        <Card>
          <Label>Bunkering — today</Label>
          <View style={styles.pair}>
            <TextInput style={[styles.input, { flex: 2 }]} value={bk.port} onChangeText={(v) => setBk({ ...bk, port: v })} placeholder="Port ★" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 2 }]} value={bk.supplier} onChangeText={(v) => setBk({ ...bk, supplier: v })} placeholder="Supplier" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.pair}>
            <TextInput style={styles.input} value={bk.litres} onChangeText={(v) => setBk({ ...bk, litres: v })} placeholder="Litres ★" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={bk.density} onChangeText={(v) => setBk({ ...bk, density: v })} placeholder="Density kg/L" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={bk.sulphur} onChangeText={(v) => setBk({ ...bk, sulphur: v })} placeholder="Sulphur %" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={bk.bdn} onChangeText={(v) => setBk({ ...bk, bdn: v })} placeholder="BDN No." placeholderTextColor={COLORS.textLight} />
          </View>
          {tanks.length > 1 ? (
            <View style={styles.pair}>
              {tanks.map((t) => (
                <TextInput key={t.id} style={styles.input} value={bk.into[t.id] ?? ''} onChangeText={(v) => setBk({ ...bk, into: { ...bk.into, [t.id]: v } })} placeholder={`Into ${t.name}, L`} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
              ))}
            </View>
          ) : null}
          <TextInput style={styles.input} value={bk.note} onChangeText={(v) => setBk({ ...bk, note: v })} placeholder="Note" placeholderTextColor={COLORS.textLight} />
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveBunker()}><Text style={styles.btnText}>Record bunkering</Text></TouchableOpacity>
        </Card>
      ) : null}

      {panel === 'transfer' ? (
        <Card>
          <Label>Transfer between tanks — today</Label>
          <View style={styles.pair}>
            <Dropdown caption="FROM" value={tf.from} onChange={(v) => setTf({ ...tf, from: v })} options={[{ value: '', label: '—' }, ...tanks.map((t) => ({ value: t.id, label: t.name }))]} style={{ flex: 1 }} />
            <Dropdown caption="TO" value={tf.to} onChange={(v) => setTf({ ...tf, to: v })} options={[{ value: '', label: '—' }, ...tanks.map((t) => ({ value: t.id, label: t.name }))]} style={{ flex: 1 }} />
            <TextInput style={[styles.input, { flex: 1 }]} value={tf.litres} onChangeText={(v) => setTf({ ...tf, litres: v })} placeholder="Litres" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
          </View>
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveTransfer()}><Text style={styles.btnText}>Record transfer</Text></TouchableOpacity>
        </Card>
      ) : null}

      {panel === 'tanks' ? (
        <Card>
          <Label>Tanks</Label>
          {tanks.map((t) => (
            <View key={t.id} style={styles.pair}>
              <TextInput style={[styles.input, { flex: 3 }]} defaultValue={t.name} onEndEditing={(e) => e.nativeEvent.text.trim() && void saveFuel('tank', { ...t, name: e.nativeEvent.text.trim() })} onBlur={(e: any) => { const v = e?.target?.value ?? e?.nativeEvent?.text; if (v && v.trim() && v.trim() !== t.name) void saveFuel('tank', { ...t, name: v.trim() }); }} placeholder="Tank name" placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { flex: 1 }]} defaultValue={t.capacity ? String(t.capacity) : ''} onEndEditing={(e) => void saveFuel('tank', { ...t, capacity: num(e.nativeEvent.text) })} onBlur={(e: any) => { const v = num(String(e?.target?.value ?? '')); if (v !== t.capacity) void saveFuel('tank', { ...t, capacity: v }); }} placeholder="Capacity, L" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
              <TouchableOpacity onPress={() => Alert.alert('Remove tank', `Remove ${t.name}? Its past soundings stay in the records.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void saveFuel('tank', { ...t, deleted: true }) }])} hitSlop={8}>
                <MciIcon name="delete-outline" size={22} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => void saveFuel('tank', { id: uid('tank'), name: `Tank ${tanks.length + 1}`, order: tanks.length })}>
            <Text style={styles.link}>+ Add a tank</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {m.bunkers.length ? (
        <>
          <Label>Bunkering this month — Oil Record Book entries</Label>
          {m.bunkers.map((b) => (
            <View key={b.id} style={styles.entry}>
              <Text style={styles.entryHead}>{`${formatDate(b.date)} · ${nf(b.litres)} · ${b.port} · ${b.by}`}</Text>
              <Text style={styles.orb} selectable>{orbBunkerLine(b, tanks)}</Text>
            </View>
          ))}
        </>
      ) : null}
      {m.transfers.length ? (
        <>
          <Label>Transfers this month</Label>
          {m.transfers.map((t) => <Text key={t.id} style={styles.sub}>{`${formatDate(t.date)} — ${transferText(t, tanks)} · ${t.by}`}</Text>)}
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    monthHead: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.md, marginBottom: SIZES.sm },
    views: { flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.md },
    viewChip: { paddingVertical: 6, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    viewChipText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    tankRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    tankName: { flex: 1, fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
    litres: { width: 140, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, textAlign: 'right' },
    pct: { width: 44, fontSize: SIZES.small, color: COLORS.textLight, textAlign: 'right' },
    totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.md },
    total: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md, marginTop: SIZES.xs },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md, marginTop: SIZES.xs },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    btnOn: { backgroundColor: COLORS.primary },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: SIZES.md },
    month: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    stats: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },
    stat: { flex: 1, minWidth: 130, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, alignItems: 'center' },
    statVal: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    reportRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginVertical: SIZES.md },
    table: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, overflow: 'hidden', marginBottom: SIZES.md },
    tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    th: { backgroundColor: COLORS.primary + '10' },
    td: { flex: 1, paddingVertical: 7, paddingHorizontal: SIZES.sm, fontSize: SIZES.small, color: COLORS.textDark },
    thText: { fontWeight: '800', color: COLORS.textLight },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, alignItems: 'center' },
    input: { flex: 1, minWidth: 110, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    link: { color: COLORS.primary, fontWeight: '700', marginTop: SIZES.sm },
    entry: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    entryHead: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    orb: { fontSize: SIZES.small, color: COLORS.text, marginTop: 4, lineHeight: 18 },
  });
