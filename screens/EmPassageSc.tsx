// ===================================
// A passage berth to berth (types/emissions.ts, plan item 44): written and signed
// in one go on arrival, all times UTC, since a passage changes time zone. A new
// passage asks for the ROB and the miles at 31 Dec 24:00 UTC if it crosses the new
// year. Changed by the Master only, as a new version with a reason.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import * as storage from '../services/storage';
import { crossesYear, passageProblem } from '../services/emissions';
import { EmPassage } from '../types/emissions';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const num = (v: string) => {
  const x = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(x) ? x : undefined;
};
const POINTS = ['dep', 'faop', 'eosp', 'arr'] as const;
type Point = (typeof POINTS)[number];
const utcToday = () => new Date().toISOString().slice(0, 10);
const shown = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;

export default function EmPassageSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { versionsOf, appendRow } = useData();
  const sync = useSync();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const amend = useAmend();
  const { signer, picker } = useSigner();
  const confirmSign = useSignConfirm();
  const all = versionsOf(storage.EM_PASSAGES_KEY) as EmPassage[];
  const id = route.params?.id as string;

  const [f, setF] = useState({ fromPort: '', toPort: '', robDep: '', robArr: '', distanceNm: '', carried: '', yearEndRob: '', yearEndNm: '', note: '' });
  const [fromEu, setFromEu] = useState(true);
  const [toEu, setToEu] = useState(true);
  const [dates, setDates] = useState<Record<Point, string>>({ dep: utcToday(), faop: utcToday(), eosp: utcToday(), arr: utcToday() });
  const [times, setTimes] = useState<Record<Point, string>>({ dep: '', faop: '', eosp: '', arr: '' });
  const set = (x: Partial<typeof f>) => setF({ ...f, ...x });
  const stamp = (k: Point) => (/^\d{1,2}:\d{2}$/.test(times[k].trim()) ? `${dates[k]}T${times[k].trim().padStart(5, '0')}` : '');
  const crossing = dates.dep.slice(0, 4) !== dates.arr.slice(0, 4);

  const input = (label: string, key: keyof typeof f, numeric = true, ph?: string) => (
    <>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={f[key]} onChangeText={(v) => set({ [key]: v } as any)} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={ph} placeholderTextColor={COLORS.textLight} />
    </>
  );

  const save = async () => {
    const draft: Partial<EmPassage> = {
      fromPort: f.fromPort.trim(), toPort: f.toPort.trim(), fromEu, toEu,
      depAt: stamp('dep'), faopAt: stamp('faop'), eospAt: stamp('eosp'), arrAt: stamp('arr'),
      robDep: num(f.robDep), robArr: num(f.robArr), distanceNm: num(f.distanceNm),
      ...(num(f.carried) ? { carried: num(f.carried) } : {}),
      ...(crossing ? { yearEndRob: num(f.yearEndRob), yearEndNm: num(f.yearEndNm) } : {}),
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
    };
    const problem = passageProblem(draft);
    if (problem) return Alert.alert(t('em.passage'), tk(`em.bad.${problem}`));
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Passage ${draft.fromPort} to ${draft.toPort}` });
    if (!sig) return;
    const now = Date.now();
    const row = { ...draft, id: uid('pass'), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), at: now, updatedAt: now } as EmPassage;
    await appendRow(storage.EM_PASSAGES_KEY, JSON.parse(JSON.stringify(row)));
    playSuccessSound();
    goBackOr(nav, 'Emissions');
  };

  if (id === 'new') {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Emissions')} />
        <ScreenTitle title={t('em.passageNew')} subtitle={t('em.passageSub')} help="Emissions" />
        <Card>
          {input(t('em.from'), 'fromPort', false)}
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>{t('em.euPort')}</Text>
            <Switch value={fromEu} onValueChange={setFromEu} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {input(t('em.to'), 'toPort', false)}
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>{t('em.euPort')}</Text>
            <Switch value={toEu} onValueChange={setToEu} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          <Text style={styles.sub}>{t('em.portHint')}</Text>
          {POINTS.map((k) => (
            <View key={k} style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
              <View style={{ flex: 1 }}><SimpleDatePicker label={tk(`em.at.${k}`)} value={dates[k]} onChange={(v) => setDates({ ...dates, [k]: v })} /></View>
              <View style={{ width: 90 }}>
                <Label>{t('em.utc')}</Label>
                <TextInput style={styles.input} value={times[k]} onChangeText={(v) => setTimes({ ...times, [k]: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
              </View>
            </View>
          ))}
          {input(t('em.robDep'), 'robDep')}
          {input(t('em.robArr'), 'robArr')}
          {input(t('em.distance'), 'distanceNm')}
          <Text style={styles.sub}>{t('em.distanceHint')}</Text>
          {input(t('em.carried'), 'carried')}
          {crossing ? (
            <>
              <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('em.crossHint')}</Text>
              {input(t('em.yearEndRob'), 'yearEndRob')}
              {input(t('em.yearEndNm'), 'yearEndNm')}
            </>
          ) : null}
          {input(t('em.note'), 'note', false)}
          {picker}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('em.signPassage')}</Text></TouchableOpacity>
          </View>
        </Card>
      </Screen>
    );
  }

  const p = all.find((x) => x.id === id);
  if (!p) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Emissions')} />
        <Empty text={t('em.notFound')} />
      </Screen>
    );
  }
  const latest = !all.some((x) => x.supersedes === p.id);
  const line = (k: string, v?: string | number) => (v == null || v === '' ? null : <Text style={styles.sub}>{`${k}: ${v}`}</Text>);
  const fields = [
    { key: 'fromPort', label: t('em.from') }, { key: 'toPort', label: t('em.to') },
    { key: 'depAt', label: tk('em.at.dep') }, { key: 'faopAt', label: tk('em.at.faop') }, { key: 'eospAt', label: tk('em.at.eosp') }, { key: 'arrAt', label: tk('em.at.arr') },
    { key: 'robDep', label: t('em.robDep'), kind: 'number' as const }, { key: 'robArr', label: t('em.robArr'), kind: 'number' as const },
    { key: 'distanceNm', label: t('em.distance'), kind: 'number' as const }, { key: 'carried', label: t('em.carried'), kind: 'number' as const },
    ...(crossesYear(p) ? [{ key: 'yearEndRob', label: t('em.yearEndRob'), kind: 'number' as const }, { key: 'yearEndNm', label: t('em.yearEndNm'), kind: 'number' as const }] : []),
    { key: 'note', label: t('em.note') },
  ];
  const what = `Passage ${p.fromPort} to ${p.toPort}, ${shown(p.depAt)} UTC`;
  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Emissions')} />
      <ScreenTitle title={`${p.fromPort} → ${p.toPort}`} subtitle={`${shown(p.depAt)} – ${shown(p.arrAt)} UTC`} help="Emissions" />
      <Card>
        <Text style={[styles.name, p.cancelled && { textDecorationLine: 'line-through' }]}>{`${p.distanceNm.toLocaleString('en-GB')} nm`}</Text>
        {line(t('em.from'), `${p.fromPort}${p.fromEu ? ' · EU' : ''}`)}
        {line(t('em.to'), `${p.toPort}${p.toEu ? ' · EU' : ''}`)}
        {POINTS.map((k) => <React.Fragment key={k}>{line(tk(`em.at.${k}`), `${shown(p[`${k}At`])} UTC`)}</React.Fragment>)}
        {line(t('em.robDep'), p.robDep)}
        {line(t('em.robArr'), p.robArr)}
        {line(t('em.carried'), p.carried)}
        {line(t('em.yearEndRob'), p.yearEndRob)}
        {line(t('em.yearEndNm'), p.yearEndNm)}
        {line(t('em.note'), p.note)}
        {line(t('em.signedBy'), p.byRank ? `${p.by} (${p.byRank})` : p.by)}
        <AmendNote rec={p} all={all} summary={(x) => `${x.fromPort} → ${x.toPort} · ${x.distanceNm} nm · ${x.by}`} />
        {latest && !p.cancelled ? (
          <AmendButtons
            row
            isMaster={isMaster}
            onEdit={() => amend.edit({ store: storage.EM_PASSAGES_KEY, record: p, what, fields })}
            onDelete={() => amend.remove({ store: storage.EM_PASSAGES_KEY, record: p, what })}
          />
        ) : null}
      </Card>
      {amend.ui}
    </Screen>
  );
}
