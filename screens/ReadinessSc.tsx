// ===================================
// Inspection readiness — what an inspector would find on a given day
// (services/readiness.ts). Pick the inspection (PSC / flag / class) and its
// date; every line opens the record that puts it right. PDF for the Master
// and the DPA.
// ===================================

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { CATEGORY_MAP } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { CategoryKey } from '../types/equipment';
import { todayIso } from '../services/pms';
import { KIND_LABEL, ReadinessKind, buildReadiness, verdict } from '../services/readiness';
import { exportReadinessPdf } from '../services/readinessReport';

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const SOON = [0, 7, 14, 30];

export default function ReadinessSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  useSync(); // re-render when a pilot module is switched on for the vessel
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));
  const today = todayIso();
  const [kind, setKind] = useState<ReadinessKind>('psc');
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState<string | null>(null);
  const when = date < today ? today : date;

  const r = useMemo(
    () =>
      buildReadiness({
        kind,
        date: when,
        today,
        on: moduleOn,
        labelOf: (k: CategoryKey) => data.categories.find((c) => c.key === k)?.label ?? CATEGORY_MAP[k]?.label ?? String(k),
        periodsOf: (k: CategoryKey) => periodsFor(k, data.templates),
        ...data,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, kind, when, today, tick]
  );

  const pdf = async () => {
    try {
      const w = await exportReadinessPdf(r, data.vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Inspection readiness', String(e?.message ?? e));
    }
  };

  const tone = r.red ? COLORS.danger : r.amber ? COLORS.warning : COLORS.success;
  return (
    <Screen scroll>
      <ScreenTitle title="Inspection readiness" subtitle="What an inspector would find on the day — put it right before they come" help="Inspection readiness" />

      <View style={styles.chips}>
        {(Object.keys(KIND_LABEL) as ReadinessKind[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, kind === k && styles.chipOn]} onPress={() => setKind(k)}>
            <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{KIND_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chips}>
        {SOON.map((n) => {
          const d = addDays(today, n);
          return (
            <TouchableOpacity key={n} style={[styles.chip, when === d && styles.chipOn]} onPress={() => setDate(d)}>
              <Text style={[styles.chipText, when === d && styles.chipTextOn]}>{n === 0 ? 'Today' : `In ${n} days`}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <SimpleDatePicker label="Inspection date" value={when} onChange={(d) => setDate(d || today)} />

      <View style={[styles.verdict, { borderColor: tone }]}>
        <MciIcon name={r.red ? 'alert-octagon-outline' : r.amber ? 'alert-outline' : 'check-decagram-outline'} size={26} color={tone} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.verdictText, { color: tone }]}>{verdict(r)}</Text>
          <Text style={styles.sub}>{`${KIND_LABEL[kind]} · ${when.split('-').reverse().join('.')} · ${r.sections.length} areas checked`}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={pdf}>
          <Text style={styles.btnText}>PDF</Text>
        </TouchableOpacity>
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}

      {r.sections.map((s) => (
        <View key={s.key} style={styles.block}>
          <View style={styles.headRow}>
            <MciIcon name={s.icon} size={18} color={COLORS.textLight} />
            <Text style={styles.head}>{s.title}</Text>
            {s.gaps.length ? (
              <Text style={[styles.count, { color: s.gaps.some((g) => g.level === 'red') ? COLORS.danger : COLORS.warning }]}>{s.gaps.length}</Text>
            ) : (
              <MciIcon name="check-circle-outline" size={18} color={COLORS.success} />
            )}
          </View>
          {s.gaps.map((g) => (
            <TouchableOpacity key={g.key} style={styles.row} onPress={() => nav.navigate(g.route, g.params)} activeOpacity={0.7}>
              <View style={[styles.dot, { backgroundColor: g.level === 'red' ? COLORS.danger : COLORS.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{g.title}</Text>
                {g.sub ? <Text style={styles.sub}>{g.sub}</Text> : null}
              </View>
              <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
          {!s.gaps.length ? <Text style={[styles.sub, { color: COLORS.success }]}>Nothing to put right.</Text> : null}
        </View>
      ))}
      <Text style={[styles.sub, { marginTop: SIZES.md }]}>
        Red — would be found on the day. Amber — runs out within 30 days after it, or still open. The list checks what the app holds; it is not the inspector’s checklist.
      </Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    verdict: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderWidth: 2, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.md },
    verdictText: { fontSize: SIZES.h3, fontWeight: '800' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    block: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.xs },
    head: { flex: 1, fontWeight: '800', color: COLORS.textDark, fontSize: SIZES.body },
    count: { fontWeight: '800', fontSize: SIZES.body },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
    dot: { width: 10, height: 10, borderRadius: 5 },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
  });
