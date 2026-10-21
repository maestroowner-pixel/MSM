// ===================================
// Handover at crew change (services/handover.ts): who hands over to whom, the
// outgoing officer's notes, and what is overdue now or falls due over the
// relief's trip — one PDF to sign on paper. The notes are a draft on this
// device until printed.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { CATEGORY_MAP } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { CategoryKey } from '../types/equipment';
import { personName } from '../types/role';
import { todayIso } from '../services/pms';
import { AHEAD_CHOICES, HandoverDraft, buildHandover, emptyDraft } from '../services/handover';
import { exportHandoverPdf, loadDraft, saveDraft } from '../services/handoverReport';

import { t, tn, useT } from '../utils/i18n';

export default function HandoverSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  const sync = useSync();
  const today = todayIso();
  const me = sync.me ? { name: personName(sync.me), rank: sync.me.position } : null;
  const [d, setD] = useState<HandoverDraft>(() => emptyDraft(me));
  const [saved, setSaved] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loadDraft().then((x) => {
      if (x) setD(x);
      loaded.current = true;
    });
  }, []);
  // Keep the draft as it is typed: a handover is written over days, between other work.
  useEffect(() => {
    if (loaded.current) void saveDraft(d);
  }, [d]);
  const set = (patch: Partial<HandoverDraft>) => setD((v) => ({ ...v, ...patch }));

  const r = useMemo(
    () =>
      buildHandover(
        {
          today,
          on: moduleOn,
          labelOf: (k: CategoryKey) => data.categories.find((c) => c.key === k)?.label ?? CATEGORY_MAP[k]?.label ?? String(k),
          periodsOf: (k: CategoryKey) => periodsFor(k, data.templates),
          ...data,
        },
        d.ahead
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, today, d.ahead, sync.modulesRev]
  );

  const pdf = async () => {
    try {
      const w = await exportHandoverPdf(d, r, data.vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('ho.title'), String(e?.message ?? e));
    }
  };
  const clear = () => {
    setD(emptyDraft(me));
    setSaved(null);
  };

  const field = (label: string, key: keyof HandoverDraft, placeholder: string, multiline = false) => (
    <View style={{ flex: 1, minWidth: 220 }}>
      <Label>{label}</Label>
      <TextInput
        style={[styles.input, multiline && { minHeight: 96 }]}
        value={String(d[key] ?? '')}
        onChangeText={(t) => set({ [key]: t } as Partial<HandoverDraft>)}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textLight}
        multiline={multiline}
      />
    </View>
  );

  // Registered for every vessel; a link to it must not open a module this vessel does not have.
  if (!moduleOn('readiness')) return <Screen><Empty text={t('common.notAvailable')} /></Screen>;

  return (
    <Screen scroll>
      <ScreenTitle title={t('ho.title')} subtitle={t('ho.sub')} help="Inspection readiness" />

      {field(t('ho.area'), 'area', t('ho.areaPh'))}
      <View style={styles.pair}>
        {field(t('ho.from'), 'fromName', t('ho.namePh'))}
        {field(t('ho.rank'), 'fromRank', t('ho.rankPh'))}
      </View>
      <View style={styles.pair}>
        {field(t('ho.to'), 'toName', t('ho.namePh'))}
        {field(t('ho.rank'), 'toRank', t('ho.rankPh'))}
      </View>
      {field(t('ho.progress'), 'progress', t('ho.progressPh'), true)}
      {field(t('ho.remarks'), 'remarks', t('ho.remarksPh'), true)}

      <Label>{t('ho.ahead')}</Label>
      <View style={styles.chips}>
        {AHEAD_CHOICES.map((n) => (
          <TouchableOpacity key={n} style={[styles.chip, d.ahead === n && styles.chipOn]} onPress={() => set({ ahead: n })}>
            <Text style={[styles.chipText, d.ahead === n && styles.chipTextOn]}>{tn('n.day', n)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summary}>
        <MciIcon name="swap-horizontal-bold" size={24} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sumText}>{`${r.red ? t('ho.red', { n: r.red }) : t('ho.noRed')} · ${r.amber ? t('ho.amber', { n: r.amber, days: d.ahead }) : t('ho.noAmber', { days: d.ahead })}`}</Text>
          <Text style={styles.sub}>{t('ho.areas', { n: r.sections.length })}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={pdf}>
          <Text style={styles.btnText}>PDF</Text>
        </TouchableOpacity>
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}

      <View style={styles.links}>
        <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Readiness' })}>
          <Text style={styles.link}>{t('ho.seeList')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clear}>
          <Text style={[styles.link, { color: COLORS.textLight }]}>{t('ho.new')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.sub, { marginTop: SIZES.md }]}>{t('ho.local')}</Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm, textAlignVertical: 'top' },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.sm, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    summary: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.md },
    sumText: { color: COLORS.textDark, fontWeight: '800', fontSize: SIZES.body },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    links: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.lg, marginTop: SIZES.sm },
    link: { color: COLORS.primary, fontWeight: '700' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
  });
