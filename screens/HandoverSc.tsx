// ===================================
// Handover at crew change (services/handover.ts): who hands over to whom, the
// outgoing officer's notes, and what is overdue now or falls due over the
// relief's trip — one PDF to sign on paper. The notes are a draft on this
// device until printed.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Label, Screen, ScreenTitle } from '../components/ui';
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

export default function HandoverSc() {
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
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Handover', String(e?.message ?? e));
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

  return (
    <Screen scroll>
      <ScreenTitle title="Handover" subtitle="For the relief at crew change — what is overdue, what falls due, your notes" help="Inspection readiness" />

      {field('What is handed over', 'area', 'Deck — Chief Officer, Engine room, Whole vessel…')}
      <View style={styles.pair}>
        {field('Outgoing — name', 'fromName', 'Name')}
        {field('Rank', 'fromRank', 'Chief Officer')}
      </View>
      <View style={styles.pair}>
        {field('Incoming — name', 'toName', 'Name')}
        {field('Rank', 'toRank', 'Chief Officer')}
      </View>
      {field('Work in progress', 'progress', 'One item a line — e.g. Liferaft No 2 ashore for service, back 30 Oct', true)}
      {field('For the relief', 'remarks', 'Things to watch, where things are, who to call', true)}

      <Label>List what falls due in the next</Label>
      <View style={styles.chips}>
        {AHEAD_CHOICES.map((n) => (
          <TouchableOpacity key={n} style={[styles.chip, d.ahead === n && styles.chipOn]} onPress={() => set({ ahead: n })}>
            <Text style={[styles.chipText, d.ahead === n && styles.chipTextOn]}>{`${n} days`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.summary}>
        <MciIcon name="swap-horizontal-bold" size={24} color={COLORS.primary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sumText}>{`${r.red ? `${r.red} overdue or open now` : 'Nothing overdue'} · ${r.amber ? `${r.amber} falling due in ${d.ahead} days` : `nothing due in ${d.ahead} days`}`}</Text>
          <Text style={styles.sub}>{`${r.sections.length} areas checked · signatures of both and the Master on the PDF`}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={pdf}>
          <Text style={styles.btnText}>PDF</Text>
        </TouchableOpacity>
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}

      <View style={styles.links}>
        <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Readiness' })}>
          <Text style={styles.link}>See the list on screen →</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clear}>
          <Text style={[styles.link, { color: COLORS.textLight }]}>Start a new handover</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.sub, { marginTop: SIZES.md }]}>The notes stay on this device until you print them; nothing here is sent to the other devices.</Text>
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
