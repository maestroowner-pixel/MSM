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
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { useSync } from '../contexts/SyncContext';
import { current } from '../services/versions';
import * as storage from '../services/storage';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { Dropdown } from '../components/Dropdown';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { DEFAULT_TANKS, FuelBunker, FuelKind, FUEL_KIND_LABEL, FuelReading, FuelTank, FuelTransfer } from '../types/fuel';
import { fuelMonth, orbBunkerLine, robTotal, transferText } from '../services/fuel';
import { exportFuelExcel, exportFuelPdf } from '../services/fuelReport';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { t as tt, tk, useT, dateLocale } from '../utils/i18n';

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
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { fuelTanks: allTanks, fuelReadings, fuelBunkers, fuelTransfers, saveFuel, vessel, versionsOf } = useData();
  const sync = useSync();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const amend = useAmend();
  const allReadings = versionsOf(storage.FUEL_READINGS_KEY) as FuelReading[];
  const allBunkersAll = versionsOf(storage.FUEL_BUNKERS_KEY) as FuelBunker[];
  const allTransfers = versionsOf(storage.FUEL_TRANSFERS_KEY) as FuelTransfer[];

  const [kind, setKind] = React.useState<FuelKind>('diesel');
  const tanks = useMemo(() => allTanks.filter((t) => (t.kind ?? 'diesel') === kind), [allTanks, kind]);
  const allBunkers = useMemo(() => allBunkersAll.filter((b) => (b.kind ?? 'diesel') === kind), [allBunkersAll, kind]);
  const kindBunkers = useMemo(() => fuelBunkers.filter((b) => (b.kind ?? 'diesel') === kind), [fuelBunkers, kind]);

  const tankFields = () => tanks.map((t) => ({ key: `tanks.${t.id}`, label: tt('fuel.tankL', { name: t.name }), kind: 'number' as const }));
  const editReading = (r: FuelReading) => amend.edit({ store: storage.FUEL_READINGS_KEY, record: r, what: `Fuel sounding ${formatDate(r.date)}`, fields: tankFields() });
  const removeReading = (r: FuelReading) => amend.remove({ store: storage.FUEL_READINGS_KEY, record: r, what: `Fuel sounding ${formatDate(r.date)}` });
  const { signer, picker } = useSigner();
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [panel, setPanel] = useState<Panel>('none');
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const view: 'sounding' | 'daily' = route.params?.view === 'daily' ? 'daily' : 'sounding';
  const setView = (v: 'sounding' | 'daily') => nav.setParams({ view: v });
  const [saved, setSaved] = useState<string | null>(null);

  const m = useMemo(() => fuelMonth(month, tanks, fuelReadings, kindBunkers, fuelTransfers), [month, tanks, fuelReadings, kindBunkers, fuelTransfers]);
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
    Alert.alert(tt('fuel.whoRecords'), tt('pd.chooseName'));
    return null;
  };

  const setupTanks = async () => {
    if (kind === 'diesel') {
      for (const t of DEFAULT_TANKS) await saveFuel('tank', { ...t, id: uid('tank'), kind: 'diesel' });
    } else {
      await saveFuel('tank', { id: uid('tank'), name: `${FUEL_KIND_LABEL[kind]} — Tank 1`, order: 0, kind });
    }
  };

  const saveSounding = async () => {
    if (!signer) return needSigner();
    const vals: Record<string, number> = {};
    for (const t of tanks) {
      const v = num(robValue(t));
      if (v == null) return Alert.alert(tt('fuel.sounding'), tt('fuel.enterLitres', { name: t.name }));
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
  const [bk, setBk] = useState({ port: '', supplier: '', litres: '', density: '', sulphur: '', bdn: '', note: '', into: {} as Record<string, string>, craft: '', grade: '' });
  const saveBunker = async () => {
    if (!signer) return needSigner();
    const litres = num(bk.litres);
    if (!bk.port.trim() || !litres) return Alert.alert(tt('fuel.bunkering'), tt('fuel.needPort'));
    const into: Record<string, number> = {};
    for (const t of tanks) {
      const v = num(bk.into[t.id] ?? '');
      if (v) into[t.id] = v;
    }
    if (!Object.keys(into).length && tanks.length === 1) into[tanks[0].id] = litres;
    const split = Object.values(into).reduce((a, b) => a + b, 0);
    if (Object.keys(into).length && Math.abs(split - litres) > 1) return Alert.alert(tt('fuel.bunkering'), tt('fuel.addUp', { split, litres }));
    const who = await by(`${FUEL_KIND_LABEL[kind]} — ${litres} L at ${bk.port.trim()}`);
    if (!who) return;
    const b: FuelBunker = {
      id: uid('bunk'), date: today, time: hhmm(), port: bk.port.trim(), litres, into, kind, ...who, updatedAt: Date.now(),
      ...(bk.supplier.trim() ? { supplier: bk.supplier.trim() } : {}),
      ...(kind === 'diesel' && num(bk.density) ? { density: num(bk.density) } : {}),
      ...(kind === 'diesel' && num(bk.sulphur) != null && bk.sulphur.trim() ? { sulphur: num(bk.sulphur) } : {}),
      ...(kind === 'diesel' && bk.bdn.trim() ? { bdnNo: bk.bdn.trim() } : {}),
      ...(kind === 'petrol' && bk.craft.trim() ? { craft: bk.craft.trim() } : {}),
      ...(kind === 'lube_oil' && bk.grade.trim() ? { grade: bk.grade.trim() } : {}),
      ...(bk.note.trim() ? { note: bk.note.trim() } : {}),
    };
    await saveFuel('bunker', b);
    setBk({ port: '', supplier: '', litres: '', density: '', sulphur: '', bdn: '', note: '', into: {}, craft: '', grade: '' });
    setPanel('none');
    playSuccessSound();
  };

  // ---- transfer form ----
  const [tf, setTf] = useState({ from: '', to: '', litres: '' });
  const saveTransfer = async () => {
    if (!signer) return needSigner();
    const litres = num(tf.litres);
    if (!tf.from || !tf.to || tf.from === tf.to || !litres) return Alert.alert(tt('fuel.transfer'), tt('fuel.twoTanks'));
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
      if (typeof where === 'string') setSaved(where === 'Downloads' ? tt('common.savedDownloads') : tt('common.savedFolder', { folder: where }));
    } catch (e: any) {
      Alert.alert(tt('fuel.report'), String(e?.message ?? e));
    }
  };

  const kindChips = (
    <View style={styles.views}>
      {(Object.keys(FUEL_KIND_LABEL) as FuelKind[]).map((k) => (
        <TouchableOpacity key={k} onPress={() => { setKind(k); setPanel('none'); }} style={[styles.viewChip, kind === k && { backgroundColor: COLORS.primary }]}>
          <Text style={[styles.viewChipText, kind === k && { color: COLORS.textWhite }]}>{k === 'diesel' ? 'MGO' : k === 'petrol' ? tt('fuel.petrol') : k === 'freshwater' ? tt('fuel.water') : tt('fuel.oils')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (!tanks.length) {
    const setupLabel = kind === 'diesel' ? tt('fuel.setupTwo') : tt('fuel.addFirst', { kind: tk(`fk.${kind}`) });
    const hint = kind === 'diesel'
      ? tt('fuel.noDiesel')
      : tt('fuel.noKind', { kind: tk(`fk.${kind}`).toLowerCase() });
    return (
      <Screen scroll>
        <ScreenTitle title={tt('fuel.title')} subtitle={tk(`fk.${kind}`)} help="Fuel" />
        {kindChips}
        <Empty text={hint} />
        <TouchableOpacity style={[styles.btn, { alignSelf: 'center' }]} onPress={() => void setupTanks()}>
          <Text style={styles.btnText}>{setupLabel}</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const shownDays = m.days.filter((d) => d.rob != null || d.received).reverse();

  // Fuel has two pages — Sounding and Daily report — opened from the menu's
  // Fuel sub-items, or from these chips (the phone's bar has no sub-items).
  const viewSwitch = (
    <View style={styles.views}>
      {([['sounding', tt('fuel.sounding')], ['daily', tt('fuel.daily')]] as const).map(([k, l]) => (
        <TouchableOpacity key={k} onPress={() => setView(k)} style={[styles.viewChip, view === k && { backgroundColor: COLORS.primary }]}>
          <Text style={[styles.viewChipText, view === k && { color: COLORS.textWhite }]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
  if (view === 'daily' && kind === 'diesel') {
    return (
      <Screen scroll>
        <ScreenTitle title={tt('fuel.dailyTitle')} subtitle={tt('fuel.dailySub')} help="Fuel" />
        {kindChips}
        {viewSwitch}
        <FuelDaily onSounding={() => setView('sounding')} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle
        title={tt('fuel.title')}
        subtitle={tk(`fk.${kind}`)}
        help="Fuel"
        actions={<MonthPicker value={month} onChange={setMonth} months={[...new Set([...fuelReadings.map((r) => r.date.slice(0, 7)), ...kindBunkers.map((b) => b.date.slice(0, 7))])]} />}
      />
      {kindChips}
      {kind === 'diesel' ? viewSwitch : null}

      {/* Today's sounding */}
      <Card>
        <Label>{todays ? tt('fuel.todayBy', { time: todays.time ?? '', by: todays.by }) : tt('fuel.today')}</Label>
        {tanks.map((t) => (
          <View key={t.id} style={styles.tankRow}>
            <Text style={styles.tankName} numberOfLines={1}>{t.name}</Text>
            <TextInput style={[styles.litres, todays && { opacity: 0.7 }]} value={robValue(t)} onChangeText={(v) => setRob({ ...rob, [t.id]: v })} editable={!todays} keyboardType="decimal-pad" placeholder={tt('fuel.litresL')} placeholderTextColor={COLORS.textLight} />
            {t.capacity && num(robValue(t)) != null ? <Text style={styles.pct}>{`${Math.round((num(robValue(t))! / t.capacity) * 100)} %`}</Text> : <View style={{ width: 44 }} />}
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.total}>{`ROB ${nf(tanks.reduce((n, t) => n + (num(robValue(t)) ?? 0), 0))}`}</Text>
          {/* Once signed, today's sounding is changed like any record: the Master, a reason, a signature. */}
          {todays ? (
            <AmendButtons row isMaster={isMaster} onEdit={() => editReading(todays)} onDelete={() => removeReading(todays)} />
          ) : (
            <TouchableOpacity style={styles.btn} onPress={() => void saveSounding()}>
              <Text style={styles.btnText}>{tt('fuel.saveSounding')}</Text>
            </TouchableOpacity>
          )}
        </View>
        {picker ? (
          <>
            <Text style={styles.sub}>{tt('fuel.recordingAs')}</Text>
            {picker}
          </>
        ) : null}
      </Card>

      {/* Month — picked in the title */}
      <Text style={styles.monthHead}>{new Date(`${month}-01T00:00:00Z`).toLocaleString(dateLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' })}</Text>
      <View style={styles.stats}>
        {([[tt('fuel.openRob'), m.opening], [tt('fuel.received'), m.received], [tt('fuel.consumed'), m.consumed], [tt('fuel.closeRob'), m.closing]] as [string, number | undefined][]).map(([l, v]) => (
          <View key={l} style={styles.stat}>
            <Text style={styles.statVal}>{nf(v)}</Text>
            <Text style={styles.sub}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={styles.reportRow}>
        <TouchableOpacity style={styles.btn} onPress={() => void report('pdf')}><Text style={styles.btnText}>{tt('fuel.monthlyPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => void report('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      </View>

      <Label>{tt('fuel.dayByDay')}</Label>
      {shownDays.length ? (
        <View style={styles.table}>
          <View style={[styles.tr, styles.th]}>
            {[tt('nc.date'), 'ROB', tt('fuel.received'), tt('fuel.consumed')].map((h) => <Text key={h} style={[styles.td, styles.thText]}>{h}</Text>)}
            <View style={{ width: 96 }} />
          </View>
          {shownDays.map((d) => (
            <View key={d.date} style={styles.tr}>
              <Text style={styles.td}>{formatDate(d.date)}</Text>
              <Text style={styles.td}>{d.rob == null ? '—' : nf(d.rob)}</Text>
              <Text style={styles.td}>{d.received ? nf(d.received) : ''}</Text>
              <Text style={[styles.td, d.suspect && { color: COLORS.danger, fontWeight: '700' }]}>
                {d.consumed == null ? '' : `${nf(d.consumed)}${d.span && d.span > 1 ? ` · ${d.span} d` : ''}${d.suspect ? ' ⚠ check' : ''}`}
              </Text>
              <View style={{ width: 96, alignItems: 'flex-end' }}>
                {(() => {
                  const r = fuelReadings.find((x) => x.date === d.date);
                  return r ? <AmendButtons row isMaster={isMaster} onEdit={() => editReading(r)} onDelete={() => removeReading(r)} /> : null;
                })()}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.sub}>{tt('fuel.noSoundings')}</Text>
      )}

      {/* Bunkering, transfers, tanks */}
      <View style={styles.reportRow}>
        <TouchableOpacity style={[styles.btnOutline, panel === 'bunker' && styles.btnOn]} onPress={() => setPanel(panel === 'bunker' ? 'none' : 'bunker')}>
          <Text style={[styles.btnOutlineText, panel === 'bunker' && { color: COLORS.textWhite }]}>
            {`+ ${kind === 'petrol' ? tt('fuel.fuelling') : kind === 'freshwater' ? tt('fuel.waterDel') : kind === 'lube_oil' ? tt('fuel.oilDel') : tt('fuel.bunkering')}`}
          </Text>
        </TouchableOpacity>
        {kind === 'diesel' ? (
          <TouchableOpacity style={[styles.btnOutline, panel === 'transfer' && styles.btnOn]} onPress={() => setPanel(panel === 'transfer' ? 'none' : 'transfer')}><Text style={[styles.btnOutlineText, panel === 'transfer' && { color: COLORS.textWhite }]}>{`+ ${tt('fuel.transfer')}`}</Text></TouchableOpacity>
        ) : null}
        <TouchableOpacity style={[styles.btnOutline, panel === 'tanks' && styles.btnOn]} onPress={() => setPanel(panel === 'tanks' ? 'none' : 'tanks')}><Text style={[styles.btnOutlineText, panel === 'tanks' && { color: COLORS.textWhite }]}>{tt('fuel.tanks')}</Text></TouchableOpacity>
      </View>

      {panel === 'bunker' ? (
        <Card>
          <Label>{`${kind === 'petrol' ? tt('fuel.fuelling') : kind === 'freshwater' ? tt('fuel.waterDel') : kind === 'lube_oil' ? tt('fuel.oilDel') : tt('fuel.bunkering')} — ${tt('fuel.todayL')}`}</Label>
          <View style={styles.pair}>
            <TextInput style={[styles.input, { flex: 2 }]} value={bk.port} onChangeText={(v) => setBk({ ...bk, port: v })} placeholder={kind === 'lube_oil' ? tt('fuel.locationReq') : tt('fuel.portReq')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 2 }]} value={bk.supplier} onChangeText={(v) => setBk({ ...bk, supplier: v })} placeholder={tt('spp.supplier')} placeholderTextColor={COLORS.textLight} />
          </View>
          {kind === 'petrol' && (
            <TextInput style={styles.input} value={bk.craft} onChangeText={(v) => setBk({ ...bk, craft: v })} placeholder={tt('fuel.craftPh')} placeholderTextColor={COLORS.textLight} />
          )}
          {kind === 'lube_oil' && (
            <TextInput style={styles.input} value={bk.grade} onChangeText={(v) => setBk({ ...bk, grade: v })} placeholder={tt('fuel.gradePh')} placeholderTextColor={COLORS.textLight} />
          )}
          <View style={styles.pair}>
            <TextInput style={styles.input} value={bk.litres} onChangeText={(v) => setBk({ ...bk, litres: v })} placeholder={tt('fuel.litresReq')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
            {kind === 'diesel' && (
              <>
                <TextInput style={styles.input} value={bk.density} onChangeText={(v) => setBk({ ...bk, density: v })} placeholder={tt('fuel.density')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                <TextInput style={styles.input} value={bk.sulphur} onChangeText={(v) => setBk({ ...bk, sulphur: v })} placeholder={tt('fuel.sulphur')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                <TextInput style={styles.input} value={bk.bdn} onChangeText={(v) => setBk({ ...bk, bdn: v })} placeholder={tt('fuel.bdn')} placeholderTextColor={COLORS.textLight} />
              </>
            )}
          </View>
          {tanks.length > 1 ? (
            <View style={styles.pair}>
              {tanks.map((t) => (
                <TextInput key={t.id} style={styles.input} value={bk.into[t.id] ?? ''} onChangeText={(v) => setBk({ ...bk, into: { ...bk.into, [t.id]: v } })} placeholder={tt('fuel.into', { name: t.name })} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
              ))}
            </View>
          ) : null}
          <TextInput style={styles.input} value={bk.note} onChangeText={(v) => setBk({ ...bk, note: v })} placeholder={tt('mo.note')} placeholderTextColor={COLORS.textLight} />
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveBunker()}><Text style={styles.btnText}>{tt('gb.record')}</Text></TouchableOpacity>
        </Card>
      ) : null}

      {panel === 'transfer' ? (
        <Card>
          <Label>{tt('fuel.transferHead')}</Label>
          <View style={styles.pair}>
            <Dropdown caption={tt('st.fromCap')} value={tf.from} onChange={(v) => setTf({ ...tf, from: v })} options={[{ value: '', label: '—' }, ...tanks.map((t) => ({ value: t.id, label: t.name }))]} style={{ flex: 1 }} />
            <Dropdown caption={tt('st.toCap')} value={tf.to} onChange={(v) => setTf({ ...tf, to: v })} options={[{ value: '', label: '—' }, ...tanks.map((t) => ({ value: t.id, label: t.name }))]} style={{ flex: 1 }} />
            <TextInput style={[styles.input, { flex: 1 }]} value={tf.litres} onChangeText={(v) => setTf({ ...tf, litres: v })} placeholder={tt('fuel.litres')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
          </View>
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveTransfer()}><Text style={styles.btnText}>{tt('fuel.recordTransfer')}</Text></TouchableOpacity>
        </Card>
      ) : null}

      {panel === 'tanks' ? (
        <Card>
          <Label>{tt('fuel.tanks')}</Label>
          {tanks.map((t) => (
            <View key={t.id} style={styles.pair}>
              <TextInput style={[styles.input, { flex: 3 }]} defaultValue={t.name} onEndEditing={(e) => e.nativeEvent.text.trim() && void saveFuel('tank', { ...t, name: e.nativeEvent.text.trim() })} onBlur={(e: any) => { const v = e?.target?.value ?? e?.nativeEvent?.text; if (v && v.trim() && v.trim() !== t.name) void saveFuel('tank', { ...t, name: v.trim() }); }} placeholder="Tank name" placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { flex: 1 }]} defaultValue={t.capacity ? String(t.capacity) : ''} onEndEditing={(e) => void saveFuel('tank', { ...t, capacity: num(e.nativeEvent.text) })} onBlur={(e: any) => { const v = num(String(e?.target?.value ?? '')); if (v !== t.capacity) void saveFuel('tank', { ...t, capacity: v }); }} placeholder="Capacity, L" placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
              <TouchableOpacity onPress={() => Alert.alert(tt('fuel.removeTank'), tt('fuel.removeTankBody', { name: t.name }), [{ text: tt('common.cancel'), style: 'cancel' }, { text: tt('common.remove'), style: 'destructive', onPress: () => void saveFuel('tank', { ...t, deleted: true }) }])} hitSlop={8}>
                <MciIcon name="delete-outline" size={22} color={COLORS.danger} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity onPress={() => void saveFuel('tank', { id: uid('tank'), name: `Tank ${tanks.length + 1}`, order: tanks.length, kind })}>
            <Text style={styles.link}>{tt('fuel.addTank')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {current(allReadings).filter((r) => r.supersedes && r.date.startsWith(month)).map((r) => (
        <View key={r.id} style={styles.entry}>
          <Text style={[styles.entryHead, r.cancelled && { textDecorationLine: 'line-through' }]}>{`${tt('fuel.sounding')} ${formatDate(r.date)} · ROB ${nf(robTotal(r, tanks))}`}</Text>
          <AmendNote rec={r} all={allReadings} summary={(p) => `${formatDate(p.date)} · ROB ${nf(robTotal(p, tanks))} · ${p.by}`} />
        </View>
      ))}
      {current(allBunkers).some((b) => b.date.startsWith(month)) ? (
        <>
          <Label>{kind === 'diesel' ? tt('fuel.bunkerMonth') : tt('fuel.delMonth', { kind: tk(`fk.${kind}`) })}</Label>
          {current(allBunkers).filter((b) => b.date.startsWith(month)).sort((a, b) => a.date.localeCompare(b.date)).map((b) => (
            <View key={b.id} style={[styles.entry, { flexDirection: 'row', gap: SIZES.sm }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryHead, b.cancelled && { textDecorationLine: 'line-through' }]}>
                  {`${formatDate(b.date)} · ${nf(b.litres)}${b.craft ? ` → ${b.craft}` : b.grade ? ` · ${b.grade}` : ''} · ${b.port} · ${b.by}`}
                </Text>
                {kind === 'diesel' ? (
                  <Text style={[styles.orb, b.cancelled && { textDecorationLine: 'line-through' }]} selectable>{orbBunkerLine(b, tanks)}</Text>
                ) : null}
                <AmendNote rec={b} all={allBunkers} summary={(p) => `${formatDate(p.date)} · ${nf(p.litres)} · ${p.port} · ${p.by}`} />
              </View>
              {!b.cancelled ? (
                <AmendButtons
                  isMaster={isMaster}
                  onEdit={() => amend.edit({ store: storage.FUEL_BUNKERS_KEY, record: b, what: `${formatDate(b.date)} · ${nf(b.litres)} at ${b.port}`, fields: [{ key: 'port', label: 'Port / Location' }, { key: 'supplier', label: 'Supplier' }, { key: 'litres', label: 'Litres received', kind: 'number' }, ...tanks.map((t) => ({ key: `into.${t.id}`, label: `Into ${t.name}, litres`, kind: 'number' as const })), ...(kind === 'diesel' ? [{ key: 'density', label: 'Density kg/L @15 °C', kind: 'number' as const }, { key: 'sulphur', label: 'Sulphur % m/m', kind: 'number' as const }, { key: 'bdnNo', label: 'BDN No.' }] : []), ...(kind === 'petrol' ? [{ key: 'craft', label: 'Craft (FRC / Tender…)' }] : []), ...(kind === 'lube_oil' ? [{ key: 'grade', label: 'Grade' }] : []), { key: 'note', label: 'Note', kind: 'multiline' }] })}
                  onDelete={() => amend.remove({ store: storage.FUEL_BUNKERS_KEY, record: b, what: `${formatDate(b.date)} at ${b.port}` })}
                />
              ) : null}
            </View>
          ))}
        </>
      ) : null}
      {current(allTransfers).some((t) => t.date.startsWith(month)) ? (
        <>
          <Label>{tt('fuel.transfersMonth')}</Label>
          {current(allTransfers).filter((t) => t.date.startsWith(month)).map((t) => (
            <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sub, t.cancelled && { textDecorationLine: 'line-through' }]}>{`${formatDate(t.date)} — ${transferText(t, tanks)} · ${t.by}`}</Text>
                <AmendNote rec={t} all={allTransfers} summary={(p) => `${formatDate(p.date)} — ${transferText(p, tanks)} · ${p.by}`} />
              </View>
              {!t.cancelled ? (
                <AmendButtons row isMaster={isMaster} onEdit={() => amend.edit({ store: storage.FUEL_TRANSFERS_KEY, record: t, what: `Transfer ${formatDate(t.date)}`, fields: [{ key: 'litres', label: 'Litres', kind: 'number' }, { key: 'note', label: 'Note', kind: 'multiline' }] })} onDelete={() => amend.remove({ store: storage.FUEL_TRANSFERS_KEY, record: t, what: `Transfer ${formatDate(t.date)}` })} />
              ) : null}
            </View>
          ))}
        </>
      ) : null}
      {amend.ui}
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
