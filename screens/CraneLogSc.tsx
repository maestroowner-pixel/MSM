// ===================================
// Crane operator's log (types/craneLog.ts, services/craneLog.ts): an officer
// records who worked which crane today — hours, lifts, the kind of work — and
// signs it; per operator, the cranes by make, type and SWL with the hours, and
// the experience statement for the CV, signed by the Master on paper.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { CraneTestsPanel } from '../components/CraneTestsPanel';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { CRANE_OPS, CRANE_OP_EN, CraneEntry, CraneOp } from '../types/craneLog';
import { CRANE_CATEGORIES, craneSnap, entryProblem, hoursOf, operatorTotals, operators, standing } from '../services/craneLog';
import { exportCraneStatement } from '../services/craneReport';
import * as storage from '../services/storage';
import { moduleOn } from '../constants/modules';
import { SIZES, Palette } from '../theme';
import { shipToday } from '../utils/shipTime';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { t, tk, tn, useT } from '../utils/i18n';

const dmy = (iso: string) => iso.split('-').reverse().join('.');
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const yearAgo = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`;

export default function CraneLogSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { flat, crew, craneLog, craneTests, vessel, appendRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner(t('crane.confirmedBy'));
  const today = shipToday();

  const [tab, setTab] = useState<'log' | 'tests' | 'people'>('log');
  const cranes = useMemo(() => flat.filter((i) => CRANE_CATEGORIES.includes(i.category)), [flat]);
  const aboard = useMemo(() => crew.filter(isAboard).sort((a, b) => a.name.localeCompare(b.name)), [crew]);

  // ---- new entry ----
  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [crewId, setCrewId] = useState('');
  const [date, setDate] = useState(today);
  const [hrs, setHrs] = useState('');
  const [lifts, setLifts] = useState('');
  const [ops, setOps] = useState<CraneOp[]>([]);
  const [heaviest, setHeaviest] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const item = cranes.find((c) => c.id === itemId) ?? (cranes.length === 1 ? cranes[0] : undefined);

  const reset = () => {
    setHrs('');
    setLifts('');
    setOps([]);
    setHeaviest('');
    setNote('');
  };

  const sign = async (voids?: CraneEntry) => {
    const person = crew.find((c) => c.id === (voids ? voids.crewId : crewId));
    const base = voids
      ? { ...voids, id: uid('cl'), voids: voids.id, note: t('crane.voidNote') }
      : (() => {
          if (!item) return null;
          const l = lifts.trim() ? Number(lifts) : undefined;
          return {
            id: uid('cl'),
            itemId: item.id,
            crane: craneSnap(item),
            crewId: person?.id ?? '',
            name: person?.name ?? '',
            ...(person?.rank ? { rank: person.rank } : {}),
            date,
            hours: hoursOf(hrs) ?? 0,
            ...(l != null ? { lifts: l } : {}),
            ops,
            ...(heaviest.trim() ? { heaviest: heaviest.trim() } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          };
        })();
    if (!base) return Alert.alert(t('crane.title'), t('crane.need.crane'));
    const problem = voids ? null : entryProblem(base as CraneEntry, today);
    if (problem) return Alert.alert(t('crane.title'), tk(`crane.need.${problem}`));
    if (!signer) return Alert.alert(t('round.whoSigns'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${voids ? 'Void — ' : ''}${base.crane.label} · ${base.name} · ${dmy(base.date)}` });
    if (!sig) return;
    setBusy(true);
    try {
      const now = Date.now();
      const { by: _b, byRank: _r, signedWith: _s, ...rest } = base as CraneEntry;
      const e: CraneEntry = { ...(rest as CraneEntry), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), at: now, createdAt: now, updatedAt: now };
      await appendRow(storage.CRANE_LOG_KEY, e);
      playSuccessSound();
      if (!voids) {
        reset();
        setOpen(false);
      }
    } catch (err: any) {
      Alert.alert(t('crane.title'), String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const askVoid = (e: CraneEntry) =>
    Alert.alert(t('crane.voidQ'), `${e.crane.label} · ${e.name} · ${dmy(e.date)}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('crane.void'), style: 'destructive', onPress: () => void sign(e) },
    ]);

  // ---- operators ----
  const people = useMemo(() => operators(craneLog, craneTests), [craneLog, craneTests]);
  const [who, setWho] = useState('');
  const sel = who || people[0]?.crewId || '';
  const [from, setFrom] = useState(yearAgo(today));
  const [to, setTo] = useState(today);
  const totals = useMemo(() => (sel ? operatorTotals(craneLog, sel, from, to) : []), [craneLog, sel, from, to]);
  const selTests = craneTests.filter((x) => x.crewId === sel && x.date >= from && x.date <= to);
  const [saved, setSaved] = useState<string | null>(null);
  const pdf = async () => {
    const p = people.find((x) => x.crewId === sel);
    if (!p) return;
    try {
      const where = await exportCraneStatement(craneLog, sel, { name: p.name, rank: p.rank, from, to, today }, vessel, craneTests);
      if (typeof where === 'string') setSaved(where === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: where }));
    } catch (e: any) {
      Alert.alert(t('crane.title'), String(e?.message ?? e));
    }
  };

  if (!moduleOn('craneLog')) return <Screen><Empty text={t('common.notAvailable')} /></Screen>;

  const chip = (on: boolean, label: string, press: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={press}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const recent = [...standing(craneLog)].sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at).slice(0, 60);

  return (
    <Screen scroll>
      <ScreenTitle title={t('crane.title')} subtitle={t('crane.sub')} help="Crane operator's log" />
      <View style={styles.chips}>
        {chip(tab === 'log', t('crane.tabLog'), () => setTab('log'), 'log')}
        {chip(tab === 'tests', t('crane.tests'), () => setTab('tests'), 'tests')}
        {chip(tab === 'people', t('crane.tabPeople'), () => setTab('people'), 'people')}
      </View>

      {tab === 'tests' ? <CraneTestsPanel cranes={cranes} officer={officer} /> : null}
      {tab === 'log' ? (
        <>
          {officer && !open ? (
            <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}>
              <Text style={styles.btnText}>{t('crane.new')}</Text>
            </TouchableOpacity>
          ) : null}
          {open ? (
            <Card>
              <Label>{t('crane.crane')}</Label>
              {cranes.length ? <View style={styles.chips}>{cranes.map((c) => chip(item?.id === c.id, craneSnap(c).label, () => setItemId(c.id), c.id))}</View> : <Text style={styles.small}>{t('crane.noCranes')}</Text>}
              {item ? <Text style={styles.small}>{[item.make, item.type, item.swl ? `SWL ${item.swl}` : t('crane.noSwl')].filter(Boolean).join(' · ')}</Text> : null}
              <Label>{t('crane.operator')}</Label>
              {aboard.length ? <View style={styles.chips}>{aboard.map((c) => chip(crewId === c.id, c.rank ? `${c.name} · ${c.rank}` : c.name, () => setCrewId(c.id), c.id))}</View> : <Text style={styles.small}>{t('dp.addCrew')}</Text>}
              <View style={{ marginTop: SIZES.sm }}>
                <SimpleDatePicker label={t('crane.date')} value={date} onChange={(d) => setDate(d || today)} />
              </View>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.small}>{t('crane.hours')}</Text>
                  <TextInput style={styles.input} value={hrs} onChangeText={setHrs} keyboardType="decimal-pad" placeholder="2.5" placeholderTextColor={COLORS.textLight} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.small}>{t('crane.lifts')}</Text>
                  <TextInput style={styles.input} value={lifts} onChangeText={(s) => setLifts(s.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="—" placeholderTextColor={COLORS.textLight} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.small}>{t('crane.heaviest')}</Text>
                  <TextInput style={styles.input} value={heaviest} onChangeText={setHeaviest} placeholder="8.5 t" placeholderTextColor={COLORS.textLight} />
                </View>
              </View>
              <Label>{t('crane.work')}</Label>
              <View style={styles.chips}>{CRANE_OPS.map((o) => chip(ops.includes(o), tk(`crane.op.${o}`), () => setOps((l) => (l.includes(o) ? l.filter((x) => x !== o) : [...l, o])), o))}</View>
              <Text style={styles.small}>{t('crane.note')}</Text>
              <TextInput style={[styles.input, { minHeight: 50 }]} value={note} onChangeText={setNote} multiline placeholderTextColor={COLORS.textLight} />
              {picker}
              <TouchableOpacity style={[styles.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => void sign()}>
                <Text style={styles.btnText}>{busy ? '…' : t('crane.sign')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={[styles.link, { textAlign: 'center' }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </Card>
          ) : null}
          {recent.length ? (
            recent.map((e) => (
              <TouchableOpacity key={e.id} style={styles.entry} onLongPress={officer ? () => askVoid(e) : undefined} activeOpacity={0.8}>
                <Text style={styles.title}>{`${dmy(e.date)} · ${e.name}${e.rank ? ` (${e.rank})` : ''}`}</Text>
                <Text style={styles.small}>{[e.crane.label, e.crane.swl ? `SWL ${e.crane.swl}` : null].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.small}>{[`${num(e.hours)} h`, e.lifts != null ? t('crane.nLifts', { n: e.lifts }) : null, e.ops.map((o) => tk(`crane.op.${o}`)).join(', '), e.heaviest ? `max ${e.heaviest}` : null].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.small}>{t('crane.by', { by: `${e.by}${e.byRank ? `, ${e.byRank}` : ''}` })}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Empty text={t('crane.empty')} />
          )}
          {officer && recent.length ? <Text style={styles.small}>{t('crane.voidHint')}</Text> : null}
        </>
      ) : tab === 'people' ? (
        <>
          {people.length ? (
            <>
              <View style={styles.chips}>{people.map((p) => chip(sel === p.crewId, `${p.name} · ${num(p.hours)} h`, () => setWho(p.crewId), p.crewId))}</View>
              <View style={styles.row}>
                <View style={styles.flex}><SimpleDatePicker label={t('crane.from')} value={from} onChange={(d) => setFrom(d || from)} /></View>
                <View style={styles.flex}><SimpleDatePicker label={t('crane.to')} value={to} onChange={(d) => setTo(d || to)} /></View>
              </View>
              {totals.map((r) => (
                <Card key={r.itemId}>
                  <Text style={styles.title}>{r.crane.label}</Text>
                  <Text style={styles.small}>{[r.crane.make, r.crane.type, r.crane.swl ? `SWL ${r.crane.swl}` : null].filter(Boolean).join(' · ')}</Text>
                  <Text style={styles.small}>{`${num(r.hours)} h · ${r.uncounted ? (r.lifts ? `${r.lifts}+` : '—') : r.lifts} ${t('crane.liftsWord')} · ${tn('crane.days', r.days)} · ${dmy(r.first)} – ${dmy(r.last)}`}</Text>
                  <Text style={styles.small}>{r.ops.map((o) => CRANE_OP_EN[o]).join('; ')}</Text>
                </Card>
              ))}
              {selTests.length ? <Text style={styles.small}>{t('crane.testsOperated', { n: selTests.length })}</Text> : null}
              {!totals.length && !selTests.length ? <Text style={styles.small}>{t('crane.nothingPeriod')}</Text> : null}
              <TouchableOpacity style={styles.btn} onPress={() => void pdf()} disabled={!totals.length && !selTests.length}>
                <Text style={styles.btnText}>{t('crane.statement')}</Text>
              </TouchableOpacity>
              {saved ? <Text style={[styles.small, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
              <Text style={styles.small}>{t('crane.statementHint')}</Text>
            </>
          ) : (
            <Empty text={t('crane.empty')} />
          )}
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginVertical: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    row: { flexDirection: 'row', gap: SIZES.sm, marginVertical: SIZES.sm },
    flex: { flex: 1, minWidth: 0 },
    small: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    title: { color: COLORS.text, fontWeight: '700' },
    link: { color: COLORS.primary, fontWeight: '700', marginVertical: SIZES.sm },
    entry: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    btn: { marginTop: SIZES.md, marginBottom: SIZES.sm, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
