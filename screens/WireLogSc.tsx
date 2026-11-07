// ===================================
// Ropes and wires (plan item 67): every mooring line, crane wire and winch in
// the Lifting & Mooring register with its log, worst first — what is to be
// discarded, what is close to a limit, then the rest. A row opens the item,
// where its log is kept. The PDF and Excel (English) are what a surveyor or a
// terminal asks for.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Screen, ScreenTitle } from '../components/ui';
import { stateLines } from '../components/WireLogCard';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { RED_ISSUES } from '../services/wireLog';
import { exportWireExcel, exportWirePdf } from '../services/wireReport';
import { ropesOf } from '../services/wireRows';
import { CATEGORY_MAP } from '../constants/categories';
import { RATING_COLOR } from './WireEntrySc';
import { SIZES, Palette } from '../theme';
import { shipToday } from '../utils/shipTime';
import { uiDate } from '../utils/dates';
import { t, tk, useT } from '../utils/i18n';

const LEVEL_COLOR = { red: '#dc2626', amber: '#d97706', ok: '#16a34a' } as const;

export default function WireLogSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { flat, wireLog, vessel } = useData();
  const [q, setQ] = useState('');
  const today = shipToday();
  const ropes = useMemo(() => ropesOf(flat, wireLog, today), [flat, wireLog, today]);
  const shown = ropes.filter((r) => !q.trim() || `${r.name} ${r.item.serial ?? ''} ${r.item.position ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()));
  const report = (fn: typeof exportWirePdf) => void fn(flat, wireLog, vessel, today).catch((e: any) => Alert.alert(t('rope.report'), String(e?.message ?? e)));

  return (
    <Screen scroll>
      <ScreenTitle title={t('rope.listTitle')} subtitle={t('rope.listSub', { n: ropes.length, red: ropes.filter((r) => r.state.level === 'red').length, amber: ropes.filter((r) => r.state.level === 'amber').length })} help="Ropes and wires" />
      <View style={styles.bar}>
        <TextInput style={[styles.input, { flex: 1 }]} value={q} onChangeText={setQ} placeholder={t('rope.search')} placeholderTextColor={COLORS.textLight} />
        <TouchableOpacity style={styles.btnOutline} onPress={() => report(exportWirePdf)}><Text style={styles.btnOutlineText}>PDF</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnOutline} onPress={() => report(exportWireExcel)}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
      </View>
      {!ropes.length ? <Empty text={t('rope.none')} /> : null}
      {shown.map(({ item, name, state: s }) => (
        <TouchableOpacity key={item.id} style={[styles.row, { borderLeftColor: LEVEL_COLOR[s.level] }]} onPress={() => nav.navigate('ItemDetail', { category: item.category, id: item.id })}>
          <View style={styles.rowHead}>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            {s.lastLook?.rating ? <Text style={[styles.badge, { color: RATING_COLOR[s.lastLook.rating], borderColor: RATING_COLOR[s.lastLook.rating] }]}>{tk(`rope.r.${s.lastLook.rating}`)}</Text> : null}
          </View>
          <Text style={styles.small}>{[CATEGORY_MAP[item.category]?.label, item.diameter, item.material, item.position].filter(Boolean).join(' · ')}</Text>
          {stateLines(s).slice(0, 3).map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)}
          {s.lastLook ? null : <Text style={styles.small}>{t('rope.s.noLook')}</Text>}
          {s.issues.map((i) => <Text key={i} style={[styles.issue, { color: RED_ISSUES.includes(i) ? '#dc2626' : '#d97706' }]}>● {tk(`rope.i.${i}`)}</Text>)}
          {s.entries.length ? <Text style={styles.small}>{t('rope.lastEntry', { d: uiDate(s.entries[s.entries.length - 1].date), k: tk(`rope.k.${s.entries[s.entries.length - 1].kind}`) })}</Text> : null}
        </TouchableOpacity>
      ))}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', gap: SIZES.xs, alignItems: 'center', marginBottom: SIZES.sm },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, minWidth: 0 },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.sm },
    btnOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    row: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm, borderLeftWidth: 4 },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    name: { flex: 1, fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    badge: { fontSize: 11, fontWeight: '800', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    line: { fontSize: 13, color: COLORS.text, marginTop: 2 },
    issue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    small: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  });
