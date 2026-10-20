// ===================================
// One inspection round. Opening it makes it this device's round: a label
// scanned on the way round, and signed, counts towards it. The outstanding
// list shrinks as anyone, on any device, signs an item in the round; done items
// show who, rank, date and time. Category filter, progress, the round's report,
// and Close (an officer or the Master).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { CategoryKey } from '../types/equipment';
import { roundProgress, roundTitle, walkGroups } from '../services/rounds';
import { setActiveRound, useActiveRound } from '../services/activeRound';
import { exportReportPdf, exportReportXlsx, roundSignoffLine } from '../services/inspectionReport';
import { DeckEntry } from '../types/deckLog';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';
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
  const { rounds, flat, inspections: trail, vessel, saveRow, templates } = useData();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('SIGNED OFF BY');
  const [closing, setClosing] = useState<string | null>(null);
  const sync = useSync();
  const canRun = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';
  const round = rounds.find((r) => r.id === route.params?.id);
  const active = useActiveRound();
  const [only, setOnly] = useState<CategoryKey | null>(null);
  const [show, setShow] = useState<'out' | 'done'>('out');

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

  // Closing is the round's final sign-off (Jez, 13 Oct 2026): an Officer or the
  // Master confirms it was reviewed and completed, signed; it prints on the report.
  const close = async () => {
    if (closing === null) return;
    if (!signer) return Alert.alert('Who is signing it off?', 'Choose your name.');
    const left = all.outstanding.length;
    if (left && !closing.trim()) return Alert.alert('Outstanding', `${left} still to inspect. Say why they are left (remarks), or finish them first.`);
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${title} — reviewed and completed` });
    if (!sig) return;
    const now = Date.now();
    await saveRow(storage.ROUNDS_KEY, {
      ...round, closedAt: now, closedBy: signer.name, ...(signer.rank ? { closedByRank: signer.rank } : {}),
      ...(sig.proof ? { closedWith: sig.proof } : {}), ...(closing.trim() ? { closeNote: closing.trim() } : {}), updatedAt: now,
    });
    await saveRow(storage.DECK_LOG_KEY, {
      id: uid('dl'),
      date: todayIso(),
      time: new Date().toTimeString().slice(0, 5),
      period: 'other',
      remarks: `${title} — ${all.done.size}/${all.scope.length} inspected${closing.trim() ? ` · ${closing.trim()}` : ''}`,
      by: signer.name,
      ...(signer.rank ? { byRank: signer.rank } : {}),
      at: now,
      updatedAt: now,
    } as DeckEntry);
    if (active === round.id) await setActiveRound(null);
    setClosing(null);
  };
  const report = async (kind: 'pdf' | 'xlsx') => {
    try {
      const opts = { scope: 'ALL' as const, period: round.period, round, templates };
      if (kind === 'pdf') await exportReportPdf(flat, trail, vessel, opts);
      else await exportReportXlsx(flat, trail, vessel, opts);
    } catch (e: any) {
      Alert.alert('Round report', String(e?.message ?? e));
    }
  };

  // Outstanding as the Equipment section reads: Deck → Location → number.
  const groups = walkGroups(p.outstanding);
  const doneList = p.scope.filter((it) => p.done.has(it.id)).sort((a, b) => p.done.get(b.id)!.at - p.done.get(a.id)!.at);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={`${round.period[0].toUpperCase()}${round.period.slice(1)} round · ${round.label}`} subtitle={`Started ${formatDateTime(round.startedAt)} by ${round.startedByRank ? `${round.startedBy} (${round.startedByRank})` : round.startedBy}${round.closedAt ? ` · closed ${formatDateTime(round.closedAt)}` : ''}`} help="Inspection rounds" />
      <Card>
        <Text style={[styles.title, { fontSize: SIZES.h3 ?? 20 }]}>{`${all.done.size} / ${all.scope.length} completed · ${all.outstanding.length} remaining`}</Text>
        <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct === 100 ? COLORS.success : COLORS.primary }]} /></View>
        {round.closedAt ? (
          <>
            <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ Reviewed and completed — ${roundSignoffLine(round)}`}</Text>
            {round.closeNote ? <Text style={styles.sub}>{round.closeNote}</Text> : null}
          </>
        ) : active === round.id ? (
          <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>Scan a label anywhere in the app — Dashboard, scanner or widget — sign it on this period, and it comes off the list.</Text>
        ) : (
          <Text style={styles.sub}>An inspection of these categories signed on this period counts towards it, from any device.</Text>
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
            <View key={g.key || '-'}>
              {g.label ? <Label>{`${g.label} (${g.places.reduce((n, pl) => n + pl.items.length, 0)})`}</Label> : null}
              {g.places.map((pl) => (
              <View key={pl.key || '-'}>
              <Text style={styles.place}>{`${pl.label} · ${pl.items.length}`}</Text>
              {pl.items.map((it) => (
                <TouchableOpacity
                  key={it.id}
                  style={styles.row}
                  disabled={!!round.closedAt}
                  onPress={() => nav.navigate('Inspection', { itemId: it.id, period: round.period, roundId: round.id })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{`${itemNumber(it) ? `No. ${itemNumber(it)} — ` : ''}${typeWithSize(it) || labelOf(it.category)}`}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{[labelOf(it.category), it.serial ? `S/N ${it.serial}` : ''].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {!round.closedAt ? <Text style={styles.chev}>›</Text> : null}
                </TouchableOpacity>
              ))}
              </View>
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
        {canRun && !round.closedAt && closing === null ? <TouchableOpacity onPress={() => setClosing('')}><Text style={styles.link}>Sign off and close…</Text></TouchableOpacity> : null}
      </View>
      {closing !== null ? (
        <Card>
          <Label>Final sign-off — the round was reviewed and completed</Label>
          <Text style={styles.sub}>{`${all.done.size} of ${all.scope.length} inspected${all.outstanding.length ? ` · ${all.outstanding.length} still outstanding` : ''}. The report keeps who carried out each inspection; this signature closes the round.`}</Text>
          <TextInput style={styles.input} value={closing} onChangeText={setClosing} multiline placeholder={all.outstanding.length ? 'Remarks — why items are left ★' : 'Remarks (optional)'} placeholderTextColor={COLORS.textLight} />
          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btn} onPress={() => void close()}><Text style={styles.btnText}>Sign off and close</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
