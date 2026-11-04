// ===================================
// Emissions (types/emissions.ts, plan item 44) — which rule applies to this vessel,
// the year's figures out of the fuel soundings and the passages, the CII rating,
// the EU split, what is missing, and the statement signed for the verifier. Entry:
// Fuel, the Board. The arithmetic is in services/emissions.ts, the paper in
// services/emissionsReport.ts.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { personName, roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { applicability, EmApplies, EmGap, emissionsYear, EmRule, emptySplit, frozenOf, sortPassages, splitTotal, statementGaps, statementOf } from '../services/emissions';
import { exportEmissionsExcel, exportEmissionsPdf } from '../services/emissionsReport';
import { EM_CONSUMERS, EM_METHODS, EM_SHIP_TYPES, EmCommercial, EmConsumer, EmMethod, EmShipType, EmStatement, EmVessel } from '../types/emissions';
import { shipToday } from '../utils/shipTime';
import { uid } from '../utils/id';
import { uiDateTime } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const num = (v: string) => {
  const x = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(x) && x >= 0 ? x : undefined;
};
const fmt = (x: number | undefined, p = 1) => (x == null ? '—' : x.toLocaleString('en-GB', { maximumFractionDigits: p }));
const RULES: EmRule[] = ['dcs', 'cii', 'mrv'];
const COMMERCIAL: EmCommercial[] = ['yes', 'no', 'unsure'];
const emptyInputs = () => Object.fromEntries(EM_CONSUMERS.flatMap((c) => [[`${c}.u`, ''], [`${c}.n`, '']])) as Record<string, string>;

export default function EmissionsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { emVessel, emPassages, emStatements, fuelTanks, fuelReadings, fuelBunkers, deckLog, vessel, saveRow, appendRow } = useData();
  const sync = useSync();
  const canSign = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const { signer, picker } = useSigner();
  const confirmSign = useSignConfirm();
  const today = shipToday();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState<number>(route.params?.year ?? thisYear);
  const years = useMemo(() => {
    const set = new Set<number>([thisYear, thisYear - 1, year]);
    emPassages.forEach((p) => set.add(Number(p.depAt.slice(0, 4))));
    return [...set].sort((a, b) => b - a);
  }, [emPassages, thisYear, year]);

  const v: EmVessel | undefined = emVessel[0];
  const rules = applicability(v);
  const y = useMemo(
    () => emissionsYear({ year, today, vessel: v, tanks: fuelTanks, readings: fuelReadings, bunkers: fuelBunkers, passages: emPassages, deck: deckLog }),
    [year, today, v, fuelTanks, fuelReadings, fuelBunkers, emPassages, deckLog],
  );
  const statement = statementOf(emStatements, year);
  const gaps: EmGap[] = useMemo(() => {
    const signed = y.ytd && !statement ? [] : statementGaps(y, statement);
    return [...y.gaps, ...signed];
  }, [y, statement]);
  const passages = useMemo(() => sortPassages(emPassages).filter((p) => p.depAt.startsWith(`${year}-`) || p.arrAt.startsWith(`${year}-`)).reverse(), [emPassages, year]);

  // ---- the particulars (the Master) ----
  const [edit, setEdit] = useState<{ type: EmShipType; gt: string; dwt: string; commercial: EmCommercial } | null>(null);
  const startEdit = () => setEdit({ type: v?.type ?? 'yacht', gt: v?.gt != null ? String(v.gt) : '', dwt: v?.dwt != null ? String(v.dwt) : '', commercial: v?.commercial ?? 'unsure' });
  const saveVessel = async () => {
    if (!edit) return;
    const gt = num(edit.gt), dwt = num(edit.dwt);
    if (!gt) return Alert.alert(t('em.particulars'), t('em.needGt'));
    const row: EmVessel = { id: 'vessel', type: edit.type, gt, ...(dwt ? { dwt } : {}), commercial: edit.commercial, ...(sync.me ? { by: personName(sync.me) } : {}), updatedAt: Date.now() };
    await saveRow(storage.EM_VESSEL_KEY, JSON.parse(JSON.stringify(row)));
    setEdit(null);
    playSuccessSound();
  };

  // ---- the statement ----
  const [signing, setSigning] = useState(false);
  const [method, setMethod] = useState<EmMethod>('tank');
  const [split, setSplit] = useState<Record<string, string>>(emptyInputs);
  const [shore, setShore] = useState('');
  const [innovative, setInnovative] = useState('');
  const [note, setNote] = useState('');
  const parsedSplit = () => {
    const out = emptySplit();
    for (const c of EM_CONSUMERS) {
      out[c] = { u: num(split[`${c}.u`]) ?? 0, n: num(split[`${c}.n`]) ?? 0 };
    }
    return out;
  };
  const sign = async () => {
    const s = parsedSplit();
    if (!(splitTotal(s) > 0)) return Alert.alert(t('em.statement'), t('em.needSplit'));
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Emissions statement ${year}` });
    if (!sig) return;
    const now = Date.now();
    const row: EmStatement = {
      id: uid('emst'), year, method, split: s,
      ...(num(shore) != null ? { shoreKwh: num(shore) } : {}),
      ...(innovative.trim() ? { innovative: innovative.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      frozen: frozenOf(y), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), at: now, updatedAt: now,
    };
    await appendRow(storage.EM_STATEMENTS_KEY, JSON.parse(JSON.stringify(row)));
    setSigning(false);
    playSuccessSound();
  };

  const run = (f: () => Promise<unknown>) => void f().catch((e) => Alert.alert(t('common.error'), String(e?.message ?? e)));
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const fact = (k: string, val: string) => <Text style={styles.sub}>{`${k}: ${val}`}</Text>;
  const ruleColor = (a: EmApplies) => (a === 'applies' ? COLORS.primary : a === 'check' ? COLORS.warning : COLORS.textLight);
  const ratingColor = (r: string) => (r === 'A' || r === 'B' ? COLORS.success : r === 'C' ? COLORS.primary : COLORS.danger);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Fuel')} />
      <ScreenTitle title={t('em.title')} subtitle={t('em.sub')} help="Emissions" />

      <Label>{t('em.applies')}</Label>
      {RULES.map((r) => (
        <View key={r} style={[styles.item, { borderLeftColor: ruleColor(rules[r]) }]}>
          <Text style={styles.name}>{tk(`em.rule.${r}`)}</Text>
          <Text style={[styles.sub, { color: ruleColor(rules[r]), fontWeight: '700' }]}>{tk(`em.state.${rules[r]}`)}</Text>
          <Text style={styles.sub}>{tk(`em.why.${r}`)}</Text>
        </View>
      ))}
      <Text style={styles.sub}>{v ? [tk(`em.type.${v.type}`), v.gt != null ? `${fmt(v.gt, 0)} GT` : '', v.dwt != null ? `${fmt(v.dwt, 0)} DWT` : '', tk(`em.comm.${v.commercial}`)].filter(Boolean).join(' · ') : t('em.noParticulars')}</Text>
      {isMaster && !edit ? <TouchableOpacity onPress={startEdit}><Text style={styles.link}>{t('em.particularsEdit')}</Text></TouchableOpacity> : null}
      {edit ? (
        <Card>
          <Label>{t('em.type')}</Label>
          <View style={styles.chips}>{EM_SHIP_TYPES.map((k) => chip(edit.type === k, tk(`em.type.${k}`), () => setEdit({ ...edit, type: k }), k))}</View>
          <Label>GT</Label>
          <TextInput style={styles.input} value={edit.gt} onChangeText={(x) => setEdit({ ...edit, gt: x })} keyboardType="numeric" />
          <Label>DWT</Label>
          <TextInput style={styles.input} value={edit.dwt} onChangeText={(x) => setEdit({ ...edit, dwt: x })} keyboardType="numeric" />
          <Label>{t('em.commercial')}</Label>
          <View style={styles.chips}>{COMMERCIAL.map((k) => chip(edit.commercial === k, tk(`em.comm.${k}`), () => setEdit({ ...edit, commercial: k }), k))}</View>
          <Text style={styles.sub}>{t('em.commHint')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void saveVessel()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      <Label>{t('em.year')}</Label>
      <View style={styles.chips}>{years.map((k) => chip(year === k, String(k), () => { setYear(k); setSigning(false); }, String(k)))}</View>
      {y.ytd ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('em.ytd')}</Text> : null}

      <Card>
        <Text style={styles.name}>{`CO₂ ${fmt(y.co2, 1)} t`}</Text>
        {fact(t('em.fuel'), `${fmt(y.litres)} L · ${fmt(y.tonnes, 1)} t`)}
        {fact(t('em.density'), y.density == null ? '—' : `${fmt(y.density, 3)} kg/L · ${tk(`em.densityFrom.${y.densityFrom}`)}`)}
        {fact(t('em.distanceYear'), `${fmt(y.distance)} nm`)}
        {fact(t('em.hours'), `${fmt(y.hours)} h`)}
        {y.transportWork ? fact(t('em.work'), `${fmt(y.transportWork, 0)} · ${fmt(y.laden)} nm`) : null}
        <Text style={styles.sub}>{t('em.dieselOnly')}</Text>
      </Card>

      {y.cii ? (
        <Card>
          <Text style={[styles.name, { color: ratingColor(y.cii.rating) }]}>{`CII ${y.cii.rating}${y.ytd ? ` · ${t('em.notFinal')}` : ''}`}</Text>
          {fact(t('em.attained'), `${fmt(y.cii.attained, 2)} g CO₂ / capacity·nm`)}
          {fact(t('em.required', { z: y.cii.z }), fmt(y.cii.required, 2))}
          <Text style={styles.sub}>{t('em.ciiNote')}</Text>
        </Card>
      ) : null}

      {rules.mrv === 'applies' || rules.mrv === 'check' ? (
        <Card>
          <Text style={styles.name}>{`EU MRV · CO₂ ${fmt(y.mrv.co2, 1)} t`}</Text>
          {fact(t('em.mrv.intra'), `${fmt(y.mrv.intra)} L · ${fmt(y.mrv.co2Intra, 1)} t`)}
          {fact(t('em.mrv.from'), `${fmt(y.mrv.from)} L · ${fmt(y.mrv.co2From, 1)} t`)}
          {fact(t('em.mrv.to'), `${fmt(y.mrv.to)} L · ${fmt(y.mrv.co2To, 1)} t`)}
          {fact(t('em.mrv.berth'), `${fmt(y.mrv.berth)} L · ${fmt(y.mrv.co2Berth, 1)} t`)}
        </Card>
      ) : null}

      {gaps.length ? <Label>{t('em.gaps')}</Label> : null}
      {gaps.map((g) => (
        <Text key={g.key} style={[styles.sub, { color: COLORS.warning }]}>{`• ${tk(`em.gap.${g.key}`, g.params)}`}</Text>
      ))}

      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.btn} onPress={() => run(() => exportEmissionsPdf(y, v, statement, gaps, vessel))}><Text style={styles.btnText}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => run(() => exportEmissionsExcel(y, v, statement, gaps, vessel))}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
      </View>

      <Label>{t('em.statement')}</Label>
      {statement ? (
        <View style={[styles.item, { borderLeftColor: COLORS.success }]}>
          <Text style={styles.name}>{t('em.signedOn', { who: statement.by, date: uiDateTime(statement.at) })}</Text>
          <Text style={styles.sub}>{`${tk(`em.method.${statement.method}`)} · ${fmt(splitTotal(statement.split), 1)} t`}</Text>
        </View>
      ) : null}
      {y.ytd ? <Text style={styles.sub}>{t('em.signAfter')}</Text> : null}
      {!y.ytd && canSign && !signing ? (
        <TouchableOpacity onPress={() => setSigning(true)}><Text style={styles.link}>{statement ? t('em.signAgain') : t('em.signYear')}</Text></TouchableOpacity>
      ) : null}
      {signing ? (
        <Card>
          <Label>{t('em.method')}</Label>
          <View style={styles.chips}>{EM_METHODS.map((k) => chip(method === k, tk(`em.method.${k}`), () => setMethod(k), k))}</View>
          <Text style={styles.sub}>{t('em.methodHint')}</Text>
          {EM_CONSUMERS.map((c: EmConsumer) => (
            <View key={c}>
              <Label>{tk(`em.consumer.${c}`)}</Label>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1 }]} value={split[`${c}.u`]} onChangeText={(x) => setSplit({ ...split, [`${c}.u`]: x })} keyboardType="decimal-pad" placeholder={t('em.underway')} placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { flex: 1 }]} value={split[`${c}.n`]} onChangeText={(x) => setSplit({ ...split, [`${c}.n`]: x })} keyboardType="decimal-pad" placeholder={t('em.notUnderway')} placeholderTextColor={COLORS.textLight} />
              </View>
            </View>
          ))}
          <Text style={styles.sub}>{t('em.splitSum', { split: fmt(splitTotal(parsedSplit()), 1), total: fmt(y.tonnes, 1) })}</Text>
          <Label>{t('em.shore')}</Label>
          <TextInput style={styles.input} value={shore} onChangeText={setShore} keyboardType="numeric" />
          <Label>{t('em.innovative')}</Label>
          <TextInput style={styles.input} value={innovative} onChangeText={setInnovative} />
          <Label>{t('em.note')}</Label>
          <TextInput style={styles.input} value={note} onChangeText={setNote} />
          {picker}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void sign()}><Text style={styles.btnText}>{t('em.sign')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setSigning(false)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      <Label>{t('em.passages')}</Label>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('EmPassage', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('em.passage')}`}</Text></TouchableOpacity>
      </View>
      {!passages.length ? <Empty text={t('em.noPassages')} /> : null}
      {passages.map((p) => (
        <TouchableOpacity key={p.id} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => nav.navigate('EmPassage', { id: p.id })} activeOpacity={0.7}>
          <Text style={styles.name}>{`${p.fromPort} → ${p.toPort}`}</Text>
          <Text style={styles.sub}>{`${p.depAt.slice(0, 16).replace('T', ' ')} UTC · ${fmt(p.distanceNm)} nm`}</Text>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}
