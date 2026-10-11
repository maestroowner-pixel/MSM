// ===================================
// One inspection round. Opening it makes it this device's round: a label
// scanned on the way round, and signed, counts towards it. The outstanding
// list shrinks as anyone, on any device, signs an item in the round; done items
// show who, rank, date and time. Category filter, progress, the round's report,
// and Close (an officer or the Master).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { CategoryKey } from '../types/equipment';
import { roundProgress, roundTitle } from '../services/rounds';
import { setActiveRound, useActiveRound } from '../services/activeRound';
import { exportRoundExcel, exportRoundPdf } from '../services/roundReport';
import * as storage from '../services/storage';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';
import { formatDateTime } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { personName } from '../types/role';
import { labelOf, makeStyles } from './RoundsSc';

export default function RoundSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { rounds, flat, inspections: trail, vessel, saveRow } = useData();
  const sync = useSync();
  const canRun = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';
  const round = rounds.find((r) => r.id === route.params?.id);
  const active = useActiveRound();
  const [only, setOnly] = useState<CategoryKey | null>(null);
  const [show, setShow] = useState<'out' | 'done'>('out');
  const [saved, setSaved] = useState<string | null>(null);

  // Opening an open round makes it this device's round.
  useEffect(() => {
    if (round && !round.closedAt && active !== round.id) void setActiveRound(round.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, round?.closedAt]);

  const all = useMemo(() => (round ? roundProgress(round, flat, trail) : null), [round, flat, trail]);
  const p = useMemo(() => (round ? roundProgress(round, flat, trail, only ? [only] : undefined) : null), [round, flat, trail, only]);
  if (!round || !all || !p) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>This round is not on this device yet — it arrives with the next sync.</Text>
      </Screen>
    );
  }
  const title = roundTitle(round, labelOf);
  const pct = all.scope.length ? Math.round((all.done.size / all.scope.length) * 100) : 0;

  const close = () =>
    Alert.alert('Close the round?', `${all.done.size} of ${all.scope.length} inspected, ${all.outstanding.length} outstanding. A closed round takes no more inspections; its report stays.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          const now = Date.now();
          await saveRow(storage.ROUNDS_KEY, { ...round, closedAt: now, closedBy: sync.me ? personName(sync.me) : 'Master', updatedAt: now });
          if (active === round.id) await setActiveRound(null);
        },
      },
    ]);
  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportRoundPdf(round, title, all, vessel, labelOf) : await exportRoundExcel(round, title, all, vessel, labelOf);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('Round report', String(e?.message ?? e));
    }
  };

  // Outstanding grouped by deck, in walking order.
  const groups: { deck: string; items: typeof p.outstanding }[] = [];
  for (const it of p.outstanding) {
    const d = it.deck?.trim() || 'No deck';
    const g = groups[groups.length - 1];
    if (g && g.deck === d) g.items.push(it);
    else groups.push({ deck: d, items: [it] });
  }
  const doneList = p.scope.filter((it) => p.done.has(it.id)).sort((a, b) => p.done.get(b.id)!.at - p.done.get(a.id)!.at);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={`${round.period[0].toUpperCase()}${round.period.slice(1)} round · ${round.label}`} subtitle={`Started ${formatDateTime(round.startedAt)} by ${round.startedByRank ? `${round.startedBy} (${round.startedByRank})` : round.startedBy}${round.closedAt ? ` · closed ${formatDateTime(round.closedAt)}` : ''}`} help="Inspection rounds" />
      <Card>
        <Text style={[styles.title, { fontSize: SIZES.h3 ?? 20 }]}>{`${all.done.size} / ${all.scope.length} completed · ${all.outstanding.length} remaining`}</Text>
        <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct === 100 ? COLORS.success : COLORS.primary }]} /></View>
        {round.closedAt ? (
          <Text style={styles.sub}>Closed — no more inspections count towards it.</Text>
        ) : active === round.id ? (
          <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>This device is working in this round — scan a label, sign, and it comes off the list.</Text>
        ) : (
          <TouchableOpacity onPress={() => void setActiveRound(round.id)}><Text style={styles.link}>Work in this round on this device</Text></TouchableOpacity>
        )}
      </Card>

      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, !only && styles.chipOn]} onPress={() => setOnly(null)}>
          <Text style={[styles.chipText, !only && styles.chipTextOn]}>{`All · ${all.done.size}/${all.scope.length}`}</Text>
        </TouchableOpacity>
        {[...all.byCategory.entries()].map(([c, n]) => (
          <TouchableOpacity key={c} style={[styles.chip, only === c && styles.chipOn]} onPress={() => setOnly(only === c ? null : c)}>
            <Text style={[styles.chipText, only === c && styles.chipTextOn]}>{`${labelOf(c)} · ${n.done}/${n.total}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chips}>
        <TouchableOpacity style={[styles.chip, show === 'out' && styles.chipOn]} onPress={() => setShow('out')}>
          <Text style={[styles.chipText, show === 'out' && styles.chipTextOn]}>{`Outstanding (${p.outstanding.length})`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, show === 'done' && styles.chipOn]} onPress={() => setShow('done')}>
          <Text style={[styles.chipText, show === 'done' && styles.chipTextOn]}>{`Done (${p.done.size})`}</Text>
        </TouchableOpacity>
      </View>

      {show === 'out'
        ? groups.map((g) => (
            <View key={g.deck}>
              <Label>{`${g.deck} (${g.items.length})`}</Label>
              {g.items.map((it) => (
                <TouchableOpacity
                  key={it.id}
                  style={styles.row}
                  disabled={!!round.closedAt}
                  onPress={() => nav.navigate('Inspection', { itemId: it.id, period: round.period, roundId: round.id })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{`${itemNumber(it) ? `No. ${itemNumber(it)} — ` : ''}${typeWithSize(it) || labelOf(it.category)}`}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{[labelOf(it.category), itemLocation(it), it.serial ? `S/N ${it.serial}` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {!round.closedAt ? <Text style={styles.chev}>›</Text> : null}
                </TouchableOpacity>
              ))}
            </View>
          ))
        : doneList.map((it) => {
            const i = p.done.get(it.id)!;
            return (
              <TouchableOpacity key={it.id} style={styles.row} onPress={() => nav.navigate('InspectionDetail', { id: i.id })} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{`${i.outcome === 'fail' ? '✗ ' : '✓ '}${itemNumber(it) ? `No. ${itemNumber(it)} — ` : ''}${typeWithSize(it) || labelOf(it.category)}`}</Text>
                  <Text style={styles.sub} numberOfLines={1}>{`${i.byRank ? `${i.by} (${i.byRank})` : i.by} · ${formatDateTime(i.at)} · ${itemLocation(it)}`}</Text>
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            );
          })}
      {show === 'out' && !p.outstanding.length ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>Nothing outstanding.</Text> : null}

      <View style={[styles.btnRow, { flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.btn} onPress={() => void report('pdf')}><Text style={styles.btnText}>Round report (PDF)</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void report('xlsx')}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
        {canRun && !round.closedAt ? <TouchableOpacity onPress={close}><Text style={[styles.link, { color: COLORS.danger }]}>Close the round</Text></TouchableOpacity> : null}
        {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
      </View>
    </Screen>
  );
}
