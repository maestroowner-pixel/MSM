// ===================================
// Plan wizard — a vessel's maintenance plan from the catalogue in five steps
// (services/pmsWizard.ts): kind of vessel → how many of each system → each
// unit's name, maker, model and counter → the jobs and their intervals →
// what will be added. Opened from Maintenance → Plan; Master or superintendent.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { PLAN_LOCKED, plansPms } from '../types/role';
import { SIZES, Palette } from '../theme';
import { DEPTS } from '../types/pms';
import { CATALOGUE, CatalogueSystem } from '../services/pmsCatalogue';
import { MAX_UNITS, UnitSpec, VesselKind, WizardAnswers, buildPlan, defaultCounts, jobKey, resize, systemsFor } from '../services/pmsWizard';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { t, tk, tn, useT } from '../utils/i18n';

const KINDS: { key: VesselKind; icon: string }[] = [
  { key: 'motor', icon: 'ferry' },
  { key: 'sail', icon: 'sail-boat' },
  { key: 'merchant', icon: 'ship-wheel' },
];
const STEPS = 5;

const num = (s: string) => {
  const n = Number(s.replace(',', '.').trim());
  return s.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

export default function PmsWizardSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { machines, savePlan } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<VesselKind | null>(null);
  const [units, setUnits] = useState<Record<string, UnitSpec[]>>({});
  const [more, setMore] = useState(false);
  const [off, setOff] = useState<Set<string>>(new Set());
  // Intervals as typed: blank = none of that kind; absent = the catalogue's.
  const [typed, setTyped] = useState<Record<string, { hours: string; days: string }>>({});
  const [busy, setBusy] = useState(false);

  const pick = (k: VesselKind) => {
    setKind(k);
    const counts = defaultCounts(k);
    setUnits(Object.fromEntries(Object.entries(counts).map(([key, n]) => [key, resize(key, n)])));
    setOff(new Set());
    setTyped({});
    setMore(false);
    setStep(1);
  };
  const setCount = (key: string, n: number) => setUnits((u) => ({ ...u, [key]: resize(key, Math.max(0, Math.min(MAX_UNITS, n)), u[key]) }));
  const setUnit = (key: string, i: number, p: Partial<UnitSpec>) => setUnits((u) => ({ ...u, [key]: (u[key] ?? []).map((x, k) => (k === i ? { ...x, ...p } : x)) }));

  const fitted = CATALOGUE.filter((c) => (units[c.key]?.length ?? 0) > 0);
  const answers: WizardAnswers = useMemo(
    () => ({
      kind: kind ?? 'motor',
      units,
      off: [...off],
      // Typed back to the catalogue's own figures is not a change — the job keeps its "typical" note.
      intervals: Object.fromEntries(
        Object.entries(typed)
          .map(([k, v]) => [k, { hours: num(v.hours), days: num(v.days) }] as const)
          .filter(([k, v]) => {
            const [sys, title] = k.split('|');
            const j = CATALOGUE.find((c) => c.key === sys)?.jobs.find((x) => x.title === title);
            return !j || v.hours !== j.hours || v.days !== j.days;
          })
      ),
    }),
    [kind, units, off, typed]
  );
  const plan = useMemo(() => (step === 4 ? buildPlan(answers, machines, uid, todayIso(), Date.now()) : null), [step, answers, machines]);

  const create = async () => {
    if (!plan || !plan.machines.length) return;
    setBusy(true);
    try {
      await savePlan(plan.machines, plan.jobs);
      Alert.alert(t('wz.done'), t('wz.doneBody', { s: plan.machines.length, j: plan.jobs.length }));
      goBackOr(nav, 'Maintenance');
    } catch (e: any) {
      Alert.alert(t('wz.title'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!canPlan) {
    return (
      <Screen>
        <ScreenTitle title={t('wz.title')} />
        <Empty text={PLAN_LOCKED} />
      </Screen>
    );
  }

  const stepper = (c: CatalogueSystem) => {
    const n = units[c.key]?.length ?? 0;
    return (
      <View key={c.key} style={[styles.row, !n && { opacity: 0.6 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{`${c.critical ? '⚑ ' : ''}${c.label}`}</Text>
          <Text style={styles.sub}>{[tn('n.job', c.jobs.length), c.counter ? t('wz.counter') : null].filter(Boolean).join(' · ')}</Text>
        </View>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setCount(c.key, n - 1)} disabled={!n} hitSlop={6}>
          <Text style={styles.stepText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.count}>{n}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={() => setCount(c.key, n + 1)} hitSlop={6}>
          <Text style={styles.stepText}>+</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const lists = kind ? systemsFor(kind) : null;
  const byDept = (list: CatalogueSystem[]) =>
    DEPTS.map((d) => ({ d, list: list.filter((c) => c.dept === d.key) })).filter((x) => x.list.length);

  return (
    <Screen scroll>
      <ScreenTitle title={t('wz.title')} subtitle={t('wz.stepOf', { n: step + 1, of: STEPS })} help="Planned maintenance" />
      <Text style={styles.lead}>{tk(`wz.lead${step}`)}</Text>

      {step === 0 ? (
        <>
          {KINDS.map((k) => (
            <TouchableOpacity key={k.key} style={[styles.row, kind === k.key && styles.rowOn]} onPress={() => pick(k.key)}>
              <MciIcon name={k.icon} size={24} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{tk(`wz.kind.${k.key}`)}</Text>
                <Text style={styles.sub}>{tk(`wz.kindSub.${k.key}`)}</Text>
              </View>
              <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
          {machines.length ? <Text style={styles.note}>{t('wz.hasPlan', { n: machines.length })}</Text> : null}
        </>
      ) : null}

      {step === 1 && lists ? (
        <>
          {byDept(lists.asked).map(({ d, list }) => (
            <View key={d.key}>
              <Label>{tk(`dept.${d.key}`)}</Label>
              {list.map(stepper)}
            </View>
          ))}
          <TouchableOpacity onPress={() => setMore((x) => !x)} style={{ marginVertical: SIZES.sm }}>
            <Text style={styles.link}>{more ? t('wz.lessSystems') : t('wz.moreSystems', { n: lists.more.length })}</Text>
          </TouchableOpacity>
          {more ? byDept(lists.more).map(({ d, list }) => (
            <View key={d.key}>
              <Label>{tk(`dept.${d.key}`)}</Label>
              {list.map(stepper)}
            </View>
          )) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          {fitted.map((c) => (
            <View key={c.key}>
              <Label>{c.label}</Label>
              {(units[c.key] ?? []).map((u, i) => (
                <Card key={i}>
                  <TextInput style={[styles.input, styles.name]} value={u.name} onChangeText={(x) => setUnit(c.key, i, { name: x })} placeholder={t('wz.unitName')} placeholderTextColor={COLORS.textLight} />
                  <View style={styles.inputs}>
                    <TextInput style={[styles.input, styles.flex]} value={u.maker ?? ''} onChangeText={(x) => setUnit(c.key, i, { maker: x })} placeholder={t('wz.maker')} placeholderTextColor={COLORS.textLight} />
                    <TextInput style={[styles.input, styles.flex]} value={u.model ?? ''} onChangeText={(x) => setUnit(c.key, i, { model: x })} placeholder={t('wz.model')} placeholderTextColor={COLORS.textLight} />
                  </View>
                  <View style={styles.inputs}>
                    <TextInput style={[styles.input, styles.flex]} value={u.serial ?? ''} onChangeText={(x) => setUnit(c.key, i, { serial: x })} placeholder={t('wz.serial')} placeholderTextColor={COLORS.textLight} />
                    {c.counter ? (
                      <TextInput
                        style={[styles.input, styles.flex]}
                        value={u.hours != null ? String(u.hours) : ''}
                        onChangeText={(x) => setUnit(c.key, i, { hours: num(x) })}
                        placeholder={t('wz.hoursNow')}
                        placeholderTextColor={COLORS.textLight}
                        keyboardType="numeric"
                      />
                    ) : null}
                  </View>
                </Card>
              ))}
            </View>
          ))}
          {!fitted.length ? <Empty text={t('wz.noneFitted')} /> : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          {fitted.map((c) => (
            <View key={c.key}>
              <Label>{`${c.label} × ${units[c.key]!.length}`}</Label>
              {c.jobs.map((j) => {
                const k = jobKey(c.key, j.title);
                const on = !off.has(k);
                const v = typed[k];
                const set = (p: Partial<{ hours: string; days: string }>) =>
                  setTyped((x) => ({ ...x, [k]: { hours: x[k]?.hours ?? (j.hours ? String(j.hours) : ''), days: x[k]?.days ?? (j.days ? String(j.days) : ''), ...p } }));
                return (
                  <View key={k} style={[styles.row, !on && { opacity: 0.5 }]}>
                    <TouchableOpacity onPress={() => setOff((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; })} hitSlop={8}>
                      <MciIcon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={on ? COLORS.primary : COLORS.textLight} />
                    </TouchableOpacity>
                    <Text style={[styles.title, styles.flex, !on && { textDecorationLine: 'line-through' }]}>{j.title}</Text>
                    {on && c.counter ? (
                      <View style={styles.every}>
                        <TextInput style={styles.small} value={v ? v.hours : j.hours ? String(j.hours) : ''} onChangeText={(x) => set({ hours: x })} keyboardType="numeric" placeholder="—" placeholderTextColor={COLORS.textLight} />
                        <Text style={styles.sub}>{t('wz.h')}</Text>
                      </View>
                    ) : null}
                    {on ? (
                      <View style={styles.every}>
                        <TextInput style={styles.small} value={v ? v.days : j.days ? String(j.days) : ''} onChangeText={(x) => set({ days: x })} keyboardType="numeric" placeholder="—" placeholderTextColor={COLORS.textLight} />
                        <Text style={styles.sub}>{t('wz.d')}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </>
      ) : null}

      {step === 4 && plan ? (
        <>
          <Card>
            <Text style={styles.big}>{t('wz.summary', { s: plan.machines.length, j: plan.jobs.length })}</Text>
            {plan.skipped.length ? <Text style={styles.sub}>{`${t('wz.skipped', { n: plan.skipped.length })}: ${plan.skipped.join(', ')}`}</Text> : null}
            {plan.empty.length ? <Text style={styles.sub}>{`${t('wz.noJobs')}: ${plan.empty.join(', ')}`}</Text> : null}
          </Card>
          {DEPTS.map((d) => {
            const list = plan.machines.filter((m) => m.dept === d.key);
            if (!list.length) return null;
            return (
              <View key={d.key}>
                <Label>{`${tk(`dept.${d.key}`)} (${list.length})`}</Label>
                {list.map((m) => (
                  <Text key={m.id} style={styles.item}>
                    {`${m.critical ? '⚑ ' : ''}${m.name}${[m.maker, m.model].filter(Boolean).length ? ` — ${[m.maker, m.model].filter(Boolean).join(' ')}` : ''} · ${tn('n.job', plan.jobs.filter((j) => j.machineId === m.id).length)}`}
                  </Text>
                ))}
              </View>
            );
          })}
          <Text style={styles.note}>{t('wz.after')}</Text>
        </>
      ) : null}

      {step > 0 ? (
        <View style={styles.nav}>
          <TouchableOpacity style={styles.outline} onPress={() => setStep((s) => s - 1)}>
            <Text style={styles.link}>{t('common.back')}</Text>
          </TouchableOpacity>
          {step < STEPS - 1 ? (
            <TouchableOpacity style={[styles.btn, !fitted.length && styles.dim]} disabled={!fitted.length} onPress={() => setStep((s) => s + 1)}>
              <Text style={styles.btnText}>{t('wz.next')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.btn, (busy || !plan?.machines.length) && styles.dim]} disabled={busy || !plan?.machines.length} onPress={() => void create()}>
              <Text style={styles.btnText}>{busy ? '…' : t('wz.create')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    lead: { fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.md, lineHeight: 21 },
    note: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.md, lineHeight: 19 },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    rowOn: { borderWidth: 1, borderColor: COLORS.primary },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    big: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginBottom: SIZES.xs },
    item: { fontSize: SIZES.small, color: COLORS.text, paddingVertical: 3 },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    stepText: { color: COLORS.primary, fontSize: 20, fontWeight: '700', lineHeight: 22 },
    count: { minWidth: 26, textAlign: 'center', fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    name: { fontWeight: '700' },
    inputs: { flexDirection: 'row', gap: SIZES.sm },
    // minWidth 0: a web input will not shrink below its default width otherwise, and two side by side overflow a phone.
    flex: { flex: 1, minWidth: 0 },
    every: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    small: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, width: 58, paddingHorizontal: 6, paddingVertical: 5, fontSize: SIZES.small, color: COLORS.text, textAlign: 'right' },
    nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SIZES.lg, gap: SIZES.sm },
    outline: { flex: 1, padding: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
    btn: { flex: 2, padding: SIZES.md, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.primary, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    dim: { opacity: 0.5 },
  });
