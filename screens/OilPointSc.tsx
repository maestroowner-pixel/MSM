// ===================================
// One oil sampling point (types/oil.ts): its trend — every parameter over the
// last samples, coloured by its own limit — and its samples, newest first.
// The officers set it up: the machine (for the running hours), what is
// sampled, the oil, the lab, how often, the new oil's figures and the limits
// (the compartment's guide values unless the vessel has the maker's own).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { hasCounter } from '../types/pms';
import { COMPARTMENTS, Compartment, Level, Limit, NewOil, OilPoint, PARAMS, ParamKey } from '../types/oil';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { GUIDE, assess, guideInterval, pointStatus, pointTitle, previousResult, samplesOf, stageOf, verdictOf } from '../services/oil';
import { exportOilPoint, oilPointSheet } from '../services/oilReport';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};
const str = (n?: number) => (n == null ? '' : String(n));
/** The trend on screen shows this many samples. */
const SHOWN = 6;

interface Draft {
  id: string;
  machineId: string;
  name: string;
  compartment: Compartment;
  oil: string;
  capacity: string;
  lab: string;
  labRef: string;
  intervalDays: string;
  intervalHours: string;
  newOil: Record<keyof NewOil, string>;
  limits: Partial<Record<ParamKey, { c: string; a: string }>>;
  isoTarget: string;
  notes: string;
}

const toDraft = (p: OilPoint): Draft => ({
  id: p.id, machineId: p.machineId ?? '', name: p.name, compartment: p.compartment, oil: p.oil ?? '', capacity: str(p.capacity),
  lab: p.lab ?? '', labRef: p.labRef ?? '', intervalDays: str(p.intervalDays), intervalHours: str(p.intervalHours),
  newOil: { v40: str(p.newOil?.v40), v100: str(p.newOil?.v100), tbn: str(p.newOil?.tbn), tan: str(p.newOil?.tan) },
  limits: Object.fromEntries(Object.entries(p.limits ?? {}).map(([k, l]) => [k, { c: str(l?.c), a: str(l?.a) }])),
  isoTarget: p.isoTarget ?? '', notes: p.notes ?? '',
});

export default function OilPointSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { oilPoints, oilSamples, machines, saveRow, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isNew = route.params?.id === 'new';
  const stored = oilPoints.find((p) => p.id === route.params?.id);
  const iv = guideInterval('engine');
  const [draft, setDraft] = useState<Draft | null>(() =>
    isNew ? toDraft({ id: uid('oilp'), name: '', compartment: 'engine', intervalDays: iv.days, intervalHours: iv.hours, updatedAt: 0 }) : null);
  const [showLimits, setShowLimits] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const back = () => goBackOr(nav, 'OilAnalysis');
  const today = todayIso();

  const engines = useMemo(() => machines.filter((m) => !m.scrapped && hasCounter(m)).sort((a, b) => a.name.localeCompare(b.name)), [machines]);
  const machine = machines.find((m) => m.id === (draft?.machineId || stored?.machineId));

  if (!draft && !stored) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('mo.notHere')}</Text>
      </Screen>
    );
  }

  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  // ---- edit ----
  if (draft) {
    const pickCompartment = (c: Compartment) => {
      const was = guideInterval(draft.compartment);
      const g = guideInterval(c);
      // The interval follows the compartment until somebody types their own.
      const days = draft.intervalDays === str(was.days) || !draft.intervalDays ? str(g.days) : draft.intervalDays;
      const hours = draft.intervalHours === str(was.hours) || !draft.intervalHours ? str(g.hours) : draft.intervalHours;
      set({ compartment: c, intervalDays: days, intervalHours: hours });
    };
    const save = async () => {
      const name = draft.name.trim();
      if (!name) return Alert.alert(t('oil.point'), t('oil.needName'));
      const m = machines.find((x) => x.id === draft.machineId);
      const newOil = Object.fromEntries(Object.entries(draft.newOil).map(([k, v]) => [k, num(v)]).filter(([, v]) => v != null)) as NewOil;
      const limits = Object.fromEntries(Object.entries(draft.limits).map(([k, l]) => [k, { ...(num(l!.c) != null ? { c: num(l!.c) } : {}), ...(num(l!.a) != null ? { a: num(l!.a) } : {}) }]).filter(([, l]) => Object.keys(l as Limit).length)) as OilPoint['limits'];
      const p: OilPoint = {
        id: draft.id, name, compartment: draft.compartment,
        ...(m ? { machineId: m.id, machineName: m.name } : {}),
        ...(draft.oil.trim() ? { oil: draft.oil.trim() } : {}),
        ...(num(draft.capacity) != null ? { capacity: num(draft.capacity) } : {}),
        ...(draft.lab.trim() ? { lab: draft.lab.trim() } : {}),
        ...(draft.labRef.trim() ? { labRef: draft.labRef.trim() } : {}),
        ...(num(draft.intervalDays) ? { intervalDays: num(draft.intervalDays) } : {}),
        ...(num(draft.intervalHours) ? { intervalHours: num(draft.intervalHours) } : {}),
        ...(Object.keys(newOil).length ? { newOil } : {}),
        ...(limits && Object.keys(limits).length ? { limits } : {}),
        ...(draft.isoTarget.trim() ? { isoTarget: draft.isoTarget.trim() } : {}),
        ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
        updatedAt: Date.now(),
      };
      if (!p.intervalDays && !p.intervalHours) return Alert.alert(t('oil.point'), t('oil.needInterval'));
      await saveRow(storage.OIL_POINTS_KEY, p);
      playSuccessSound();
      setDraft(null);
      if (isNew) nav.replace('OilPoint', { id: p.id });
    };
    const remove = () =>
      stored && Alert.alert(t('oil.removeQ', { name: pointTitle(stored) }), t('oil.removeBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('oil.remove'), style: 'destructive', onPress: async () => { await saveRow(storage.OIL_POINTS_KEY, { ...stored, deleted: true, updatedAt: Date.now() }); back(); } },
      ]);
    const input = (value: string, onChange: (v: string) => void, label: string, opts: { width?: number; kb?: any; placeholder?: string } = {}) => (
      <TextInput style={[styles.input, opts.width ? { width: opts.width } : null]} value={value} onChangeText={onChange} keyboardType={opts.kb} placeholder={opts.placeholder} placeholderTextColor={COLORS.textLight} accessibilityLabel={label} />
    );
    const guide = GUIDE[draft.compartment];
    const limitKeys = PARAMS.filter((d) => d.kind !== 'info');

    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setDraft(null))} />
        <ScreenTitle title={isNew ? t('oil.newPoint') : pointTitle(stored!)} subtitle={t('oil.title')} help="Oil analysis" />
        <Card>
          <Dropdown caption={t('oil.machine')} value={draft.machineId} onChange={(v: string) => set({ machineId: v })} options={[{ value: '', label: t('oil.noMachine') }, ...engines.map((m) => ({ value: m.id, label: `${m.name}${m.hours != null ? ` · ${m.hours} h` : ''}` }))]} style={{ maxWidth: 420 }} />
          <Text style={styles.sub}>{t('oil.pointName')}</Text>
          {input(draft.name, (v) => set({ name: v }), t('oil.pointName'), { placeholder: t('oil.pointNameEg') })}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('oil.compartment')}</Text>
          <View style={styles.chips}>{COMPARTMENTS.map((c) => chip(draft.compartment === c, tk(`oil.cmp.${c}`), () => pickCompartment(c), c))}</View>
          <Text style={styles.sub}>{t('oil.oil')}</Text>
          {input(draft.oil, (v) => set({ oil: v }), t('oil.oil'), { placeholder: 'Shell Gadinia S3 40' })}
          <Text style={styles.sub}>{t('oil.capacity')}</Text>
          {input(draft.capacity, (v) => set({ capacity: v }), t('oil.capacity'), { width: 140, kb: 'decimal-pad' })}
          <Text style={styles.sub}>{t('oil.lab')}</Text>
          {input(draft.lab, (v) => set({ lab: v }), t('oil.lab'), { placeholder: 'Shell LubeAnalyst · Castrol Labcheck · Mobil Signum' })}
          <Text style={styles.sub}>{t('oil.labRef')}</Text>
          {input(draft.labRef, (v) => set({ labRef: v }), t('oil.labRef'), { width: 220 })}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('oil.every')}</Text>
          <View style={[styles.row, { marginTop: 0, alignItems: 'center', gap: SIZES.xs }]}>
            {input(draft.intervalDays, (v) => set({ intervalDays: v }), t('oil.days'), { width: 90, kb: 'number-pad' })}
            <Text style={styles.sub}>{t('oil.days')}</Text>
            {input(draft.intervalHours, (v) => set({ intervalHours: v }), t('oil.hours'), { width: 90, kb: 'number-pad' })}
            <Text style={styles.sub}>{t('oil.hoursWhicheverFirst')}</Text>
          </View>
          {!draft.machineId && draft.intervalHours ? <Text style={[styles.sub, { color: COLORS.warning }]}>{t('oil.hoursNeedMachine')}</Text> : null}

          <Label style={{ marginTop: SIZES.md }}>{t('oil.newOil')}</Label>
          <Text style={styles.sub}>{t('oil.newOilHint')}</Text>
          <View style={[styles.row, { marginTop: 0, flexWrap: 'wrap', gap: SIZES.xs }]}>
            {(['v40', 'v100', 'tbn', 'tan'] as (keyof NewOil)[]).map((k) => (
              <View key={k}>
                <Text style={styles.sub}>{tk(`oil.p.${k}`)}</Text>
                {input(draft.newOil[k], (v) => set({ newOil: { ...draft.newOil, [k]: v } }), tk(`oil.p.${k}`), { width: 110, kb: 'decimal-pad' })}
              </View>
            ))}
          </View>
          {draft.compartment === 'hydraulic' || draft.compartment === 'gear' || draft.compartment === 'thruster' || draft.isoTarget ? (
            <>
              <Text style={styles.sub}>{t('oil.isoTarget')}</Text>
              {input(draft.isoTarget, (v) => set({ isoTarget: v }), t('oil.isoTarget'), { width: 140, placeholder: '18/16/13' })}
            </>
          ) : null}

          <TouchableOpacity onPress={() => setShowLimits(!showLimits)} style={{ marginTop: SIZES.md }}>
            <Text style={styles.link}>{`${showLimits ? '▾' : '▸'} ${t('oil.limits')}`}</Text>
          </TouchableOpacity>
          {showLimits ? (
            <View>
              <Text style={styles.sub}>{t('oil.limitsHint')}</Text>
              {limitKeys.map((d) => {
                const own = draft.limits[d.key] ?? { c: '', a: '' };
                const g = guide[d.key];
                const unit = d.kind === 'visc' ? '± %' : d.kind === 'tbn' ? t('oil.pctOfNew') : d.kind === 'tan' ? t('oil.overNew') : d.unit;
                return (
                  <View key={d.key} style={[styles.row, { marginTop: 4, alignItems: 'center', gap: SIZES.xs }]}>
                    <Text style={[styles.sub, { width: 150, marginTop: 0 }]}>{`${tk(`oil.p.${d.key}`)}${unit ? ` (${unit})` : ''}`}</Text>
                    {input(own.c, (v) => set({ limits: { ...draft.limits, [d.key]: { ...own, c: v } } }), `${d.label} caution`, { width: 80, kb: 'decimal-pad', placeholder: str(g?.c) || '—' })}
                    {input(own.a, (v) => set({ limits: { ...draft.limits, [d.key]: { ...own, a: v } } }), `${d.label} action`, { width: 80, kb: 'decimal-pad', placeholder: str(g?.a) || '—' })}
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('oil.notes')}</Text>
          {input(draft.notes, (v) => set({ notes: v }), t('oil.notes'))}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew ? back() : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
            {!isNew ? <TouchableOpacity onPress={remove}><Text style={[styles.link, { color: COLORS.danger }]}>{t('oil.remove')}</Text></TouchableOpacity> : null}
          </View>
        </Card>
      </Screen>
    );
  }

  // ---- view ----
  const p = stored!;
  const list = samplesOf(p.id, oilSamples);
  const st = pointStatus(p, oilSamples, machine?.hours, today);
  const res = list.filter((s) => s.result).slice(-SHOWN);
  const levels = res.map((s) => assess(p, s.result!, previousResult(s, oilSamples)).byKey);
  const keys = PARAMS.filter((d) => res.some((s) => s.result!.values[d.key] != null));
  const lvlColor = (l?: Level) => (l === 2 ? COLORS.danger : l === 1 ? COLORS.warning : COLORS.textDark);
  const vColor = (v: string | null) => (v === 'action' ? COLORS.danger : v === 'caution' ? COLORS.warning : v === 'normal' ? COLORS.success : COLORS.textLight);
  const out = (w: string | null | void) => {
    if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  };
  const fail = (e: any) => Alert.alert(t('oil.title'), String(e?.message ?? e));
  const cell = { width: 74, paddingVertical: 3, paddingHorizontal: 4 } as const;

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={pointTitle(p)} subtitle={[tk(`oil.cmp.${p.compartment}`), p.oil ?? ''].filter(Boolean).join(' · ')} help="Oil analysis" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <Text style={[styles.name, { color: st.due === 'overdue' || st.due === 'never' ? COLORS.danger : st.due === 'soon' ? COLORS.warning : COLORS.textDark }]}>
          {st.due === 'never' ? t('oil.neverSampled') : [st.dueDate ? t('oil.dueOn', { date: st.dueDate }) : '', st.dueHours ? t('oil.dueAtH', { h: st.dueHours }) : ''].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.sub}>{[
          machine?.hours != null ? t('oil.machineNow', { h: machine.hours }) : '',
          p.intervalDays || p.intervalHours ? t('oil.everyLine', { every: [p.intervalDays ? `${p.intervalDays} ${t('oil.days')}` : '', p.intervalHours ? `${p.intervalHours} h` : ''].filter(Boolean).join(' / ') }) : '',
          p.lab ? `${t('oil.lab')}: ${p.lab}${p.labRef ? ` (${p.labRef})` : ''}` : '',
          p.capacity ? `${p.capacity} L` : '',
        ].filter(Boolean).join(' · ')}</Text>
        {p.notes ? <Text style={styles.sub}>{p.notes}</Text> : null}
      </Card>

      <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('OilSample', { id: 'new', pointId: p.id })}><Text style={styles.btnText}>{`+ ${t('oil.takeSample')}`}</Text></TouchableOpacity>
        {list.length ? <TouchableOpacity style={styles.small} onPress={() => exportOilPoint(p, oilSamples, machine?.hours, today, vessel).then(out).catch(fail)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity> : null}
        {list.length ? <TouchableOpacity style={styles.small} onPress={() => oilPointSheet(p, oilSamples, vessel).then(out).catch(fail)}><Text style={styles.smallText}>Excel</Text></TouchableOpacity> : null}
        {officer ? <TouchableOpacity style={styles.small} onPress={() => setDraft(toDraft(p))}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity> : null}
      </View>

      {res.length ? (
        <>
          <Label style={{ marginTop: SIZES.md }}>{t('oil.trend')}</Label>
          <ScrollView horizontal>
            <View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[styles.sub, { width: 150, fontWeight: '700' }]}> </Text>
                {res.map((s) => <Text key={s.id} style={[styles.sub, cell, { fontWeight: '700' }]}>{s.date.slice(2)}</Text>)}
              </View>
              {keys.map((d) => (
                <View key={d.key} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  <Text style={[styles.sub, { width: 150, paddingVertical: 3 }]}>{`${tk(`oil.p.${d.key}`)}${d.unit ? ` ${d.unit}` : ''}`}</Text>
                  {res.map((s, i) => {
                    const v = s.result!.values[d.key];
                    const l = levels[i][d.key];
                    return <Text key={s.id} style={[styles.body, cell, { marginTop: 0, color: lvlColor(l), fontWeight: l ? '800' : '400' }]}>{v == null ? '' : String(v)}</Text>;
                  })}
                </View>
              ))}
              {res.some((s) => s.result!.iso) ? (
                <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  <Text style={[styles.sub, { width: 150, paddingVertical: 3 }]}>{`ISO 4406${p.isoTarget ? ` (${p.isoTarget})` : ''}`}</Text>
                  {res.map((s, i) => <Text key={s.id} style={[styles.body, cell, { marginTop: 0, color: lvlColor(levels[i].iso) }]}>{s.result!.iso ?? ''}</Text>)}
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border }}>
                <Text style={[styles.sub, { width: 150, paddingVertical: 3 }]}>{t('oil.verdict')}</Text>
                {res.map((s) => {
                  const v = verdictOf(p, s, oilSamples);
                  return <Text key={s.id} style={[styles.sub, cell, { color: vColor(v), fontWeight: '800' }]}>{v ? tk(`oil.v.${v}`) : ''}</Text>;
                })}
              </View>
            </View>
          </ScrollView>
        </>
      ) : null}

      <Label style={{ marginTop: SIZES.md }}>{t('oil.samples')}</Label>
      {!list.length ? <Text style={styles.sub}>{t('oil.noSamples')}</Text> : null}
      {[...list].reverse().map((s) => {
        const v = verdictOf(p, s, oilSamples);
        const stage = stageOf(s);
        return (
          <TouchableOpacity key={s.id} style={[styles.item, { borderLeftColor: vColor(v) }]} onPress={() => nav.navigate('OilSample', { id: s.id })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{[s.date, s.machineHours != null ? `${s.machineHours} h` : '', s.bottle ?? ''].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.sub}>{[tk(`oil.stage.${stage}`), s.review ? s.review.action : '', s.photos?.length ? '📎' : ''].filter(Boolean).join(' · ')}</Text>
              </View>
              {v ? <Text style={[styles.badge, { color: vColor(v), borderColor: vColor(v) }]}>{tk(`oil.v.${v}`)}</Text> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
