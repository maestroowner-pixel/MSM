// ===================================
// A rope's log on its register item (plan item 67): what is left of it — wear,
// the date the discard diameter is reached at this rate, length, age, the last
// look — what is wrong, and the entries, newest first. "Record" opens
// WireEntrySc; the entries themselves never change.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { EvidencePhoto } from './EvidencePhoto';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { EquipmentItem } from '../types/equipment';
import { RED_ISSUES, wireState, WireState } from '../services/wireLog';
import { entryLine } from '../services/wireRows';
import { RATING_COLOR } from '../screens/WireEntrySc';
import { SIZES, Palette } from '../theme';
import { shipToday } from '../utils/shipTime';
import { uiDate } from '../utils/dates';
import { t, tk, useT } from '../utils/i18n';

/** The figures in a line each, for the card and the list. */
export function stateLines(s: WireState): string[] {
  const out: string[] = [];
  if (s.lastDia != null && s.nominal != null) out.push(t('rope.s.dia', { last: s.lastDia, nom: s.nominal, pct: s.lossPct ?? 0, at: s.discardAt ?? '—' }) + (s.discardAssumed ? ` ${t('rope.s.assumed')}` : ''));
  else if (s.nominal != null) out.push(t('rope.s.noReading', { nom: s.nominal }));
  if (s.mmPerYear != null && s.mmPerYear > 0) out.push(t('rope.s.rate', { n: s.mmPerYear }) + (s.discardOn ? ` ${t('rope.s.by', { d: uiDate(s.discardOn) })}` : ''));
  if (s.length != null) out.push((s.cuts ? t('rope.s.length', { n: s.length, cut: s.cutTotal, cuts: s.cuts }) : t('rope.s.lengthNew', { n: s.length })) + (s.minLength != null ? ` · ${t('rope.minLen', { n: s.minLength })}` : ''));
  if (s.since) out.push(t('rope.s.since', { d: uiDate(s.since), y: s.years ?? 0 }) + (s.retireOn ? ` · ${t('rope.s.retire', { d: uiDate(s.retireOn) })}` : ''));
  if (s.endForEnd || s.lubed) out.push([s.endForEnd ? t('rope.s.e4e', { d: uiDate(s.endForEnd) }) : '', s.lubed ? t('rope.s.lube', { d: uiDate(s.lubed) }) : ''].filter(Boolean).join(' · '));
  if (s.brake) out.push(t(s.brake.ok ? 'rope.s.brakeOk' : 'rope.s.brakeFail', { d: uiDate(s.brake.on) }));
  return out;
}

export default function WireLogCard({ item }: { item: EquipmentItem }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { wireLog, vessel } = useData();
  const [all, setAll] = useState(false);
  const s = wireState(item, wireLog, shipToday());
  const list = [...s.entries].reverse();
  const shown = all ? list : list.slice(0, 5);
  const imo = vessel?.imo ?? '';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>{t('rope.title')}</Text>
        <TouchableOpacity onPress={() => nav.navigate('WireLog')}>
          <Text style={styles.link}>{t('rope.allRopes')}</Text>
        </TouchableOpacity>
      </View>
      {s.lastLook ? (
        <Text style={[styles.look, s.lastLook.rating ? { color: RATING_COLOR[s.lastLook.rating] } : null]}>
          {t('rope.s.look', { d: uiDate(s.lastLook.on), r: s.lastLook.rating ? tk(`rope.r.${s.lastLook.rating}`) : '—' })}
        </Text>
      ) : (
        <Text style={styles.small}>{t('rope.s.noLook')}</Text>
      )}
      {stateLines(s).map((l, i) => <Text key={i} style={styles.line}>{l}</Text>)}
      {s.issues.map((i) => (
        <Text key={i} style={[styles.issue, { color: RED_ISSUES.includes(i) ? '#dc2626' : '#d97706' }]}>● {tk(`rope.i.${i}`)}</Text>
      ))}
      {!item.discardDia && s.nominal == null ? <Text style={styles.small}>{t('rope.s.setDia')}</Text> : null}

      {shown.map((e) => (
        <View key={e.id} style={styles.entry}>
          <Text style={styles.entryHead}>{uiDate(e.date)} · {tk(`rope.k.${e.kind}`)}</Text>
          <Text style={styles.small}>{[entryLine(e), [e.by, e.byRank].filter(Boolean).join(', ')].filter(Boolean).join(' — ')}</Text>
          {e.photos?.length ? <View style={styles.photos}>{e.photos.map((p) => <EvidencePhoto key={p.id} vessel={imo} inspectionId={e.id} photo={p} />)}</View> : null}
        </View>
      ))}
      {list.length > 5 ? (
        <TouchableOpacity onPress={() => setAll(!all)}>
          <Text style={styles.link}>{all ? t('common.showLess') : t('common.showMore', { n: list.length - 5 })}</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('WireEntry', { itemId: item.id })}>
        <Text style={styles.btnText}>{t('rope.record')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    card: { backgroundColor: COLORS.cardSolid, borderRadius: 10, padding: SIZES.md, marginBottom: SIZES.md, marginTop: SIZES.sm },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontWeight: '700', color: COLORS.text },
    link: { color: COLORS.primary, fontSize: 13, marginTop: 4 },
    look: { fontWeight: '700', fontSize: 14, marginBottom: 2 },
    line: { fontSize: 13, color: COLORS.text, marginTop: 2 },
    issue: { fontSize: 13, fontWeight: '700', marginTop: 2 },
    small: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    entry: { paddingVertical: 6, borderTopWidth: 1, borderColor: COLORS.border, marginTop: 6 },
    entryHead: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.xs },
    btn: { marginTop: SIZES.sm, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8 },
    btnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  });
