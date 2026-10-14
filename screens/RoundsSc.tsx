// ===================================
// Inspection rounds — the open ones with their progress, the closed ones with
// their reports, and "Start a round": a period and the categories it covers
// (Jez, 11 Oct 2026). An officer or the Master starts and closes rounds;
// everybody works in them.
// ===================================

import React, { useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP, visibleCategories } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { CategoryKey } from '../types/equipment';
import { InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import { InspectionRound } from '../types/round';
import { windowFor } from '../services/inspections';
import { duplicateRounds, overlappingRound, roundProgress, roundTitle } from '../services/rounds';
import { freshRounds } from '../services/firebaseService';
import { useSignConfirm } from '../components/SignConfirm';
import { setActiveRound } from '../services/activeRound';
import * as storage from '../services/storage';
import { formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

const PERIODS: InspectionPeriod[] = ['weekly', 'monthly', 'quarterly', 'annual'];
export const labelOf = (c: CategoryKey) => CATEGORY_MAP[c]?.label ?? String(c);

export default function RoundsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { rounds, flat, byCategory, templates, inspections: trail, saveRow, reload } = useData();
  const confirmSign = useSignConfirm();
  /** A start in progress — a second tap must not start a second round (Jez, 14 Oct 2026). */
  const startingNow = useRef(false);
  const [checking, setChecking] = useState(false);
  const sync = useSync();
  const canRun = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';
  const { signer, picker } = useSigner('STARTED BY');

  const [starting, setStarting] = useState(false);
  const [period, setPeriod] = useState<InspectionPeriod>('monthly');
  const offered = useMemo(
    () => visibleCategories().filter((c) => (byCategory[c.key] ?? []).length > 0 && periodsFor(c.key, templates).includes(period)),
    [byCategory, templates, period]
  );
  const [cats, setCats] = useState<Set<CategoryKey>>(new Set());
  const toggle = (k: CategoryKey) => setCats((s) => {
    const n = new Set(s);
    n.has(k) ? n.delete(k) : n.add(k);
    return n;
  });

  const open = rounds.filter((r) => !r.closedAt).sort((a, b) => b.startedAt - a.startedAt);
  const closed = rounds.filter((r) => r.closedAt).sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));

  const start = async () => {
    if (startingNow.current) return;
    if (!cats.size) return Alert.alert('Categories', 'Choose what the round covers.');
    if (!signer) return Alert.alert('Who is starting it?', 'Choose your name.');
    startingNow.current = true;
    try {
      // One open round per period and category: an inspection signed anywhere counts
      // towards the round covering it, and two would split the same items. The list is
      // asked from the vessel first, so a round another phone just opened is seen.
      setChecking(true);
      const fresh = sync.enrolled ? ((await freshRounds()) as InspectionRound[] | null) : null;
      setChecking(false);
      if (fresh) await reload();
      const clash = overlappingRound(fresh ?? rounds, period, [...cats]);
      if (clash) return Alert.alert('Already open', `${roundTitle(clash, labelOf)} is open${clash.startedBy ? ` (started by ${clash.startedBy}, ${formatDateTime(clash.startedAt)})` : ''} and covers ${clash.categories.filter((c) => cats.has(c)).map(labelOf).join(', ')}. Work in it, or close it first.`);
      const w = windowFor(period);
      const now = Date.now();
      const r: InspectionRound = {
        id: uid('rnd'), period, categories: [...cats], from: w.from, to: w.to, label: w.label,
        startedBy: signer.name, ...(signer.rank ? { startedByRank: signer.rank } : {}), startedAt: now, updatedAt: now,
      };
      await saveRow(storage.ROUNDS_KEY, r);
      await setActiveRound(r.id);
      setStarting(false);
      setCats(new Set());
      playSuccessSound();
      nav.navigate('Round', { id: r.id });
    } finally {
      startingNow.current = false;
      setChecking(false);
    }
  };

  // Two open rounds covering the same — the later one is closed as a duplicate,
  // signed; what was inspected counts in the round kept (roundFor picks it).
  const dups = duplicateRounds(rounds);
  const closeDuplicate = async (keep: InspectionRound, extra: InspectionRound) => {
    if (!signer) return Alert.alert('Who is closing it?', 'Choose your name.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${roundTitle(extra, labelOf)} — closed as a duplicate` });
    if (!sig) return;
    const now = Date.now();
    await saveRow(storage.ROUNDS_KEY, {
      ...extra, closedAt: now, closedBy: signer.name, ...(signer.rank ? { closedByRank: signer.rank } : {}), ...(sig.proof ? { closedWith: sig.proof } : {}),
      closeNote: `Duplicate of the round started ${formatDateTime(keep.startedAt)} by ${keep.startedBy} — closed; its inspections count in that round.`, updatedAt: now,
    });
    playSuccessSound();
  };

  const row = (r: InspectionRound) => {
    const p = roundProgress(r, flat, trail);
    const pct = p.scope.length ? Math.round((p.done.size / p.scope.length) * 100) : 0;
    return (
      <TouchableOpacity key={r.id} style={styles.row} onPress={() => nav.navigate('Round', { id: r.id })} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{roundTitle(r, labelOf)}</Text>
          <Text style={styles.sub}>{`${p.done.size} / ${p.scope.length} inspected · ${p.outstanding.length} outstanding · started ${formatDateTime(r.startedAt)} by ${r.startedBy}${r.closedAt ? ` · closed ${formatDateTime(r.closedAt)}` : ''}`}</Text>
          <View style={styles.bar}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: pct === 100 ? COLORS.success : COLORS.primary }]} /></View>
        </View>
        <Text style={styles.chev}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle title="Inspection rounds" subtitle="Shared to-do lists — what is still to be inspected, on every device" help="Inspection rounds" />
      {canRun ? (
        starting ? (
          <Card>
            <Label>Period</Label>
            <View style={styles.chips}>
              {PERIODS.map((p) => (
                <TouchableOpacity key={p} style={[styles.chip, period === p && styles.chipOn]} onPress={() => { setPeriod(p); setCats(new Set()); }}>
                  <Text style={[styles.chipText, period === p && styles.chipTextOn]}>{`${PERIOD_LABEL[p]} · ${windowFor(p).label}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.labelRow}>
              <Label>{`Categories (${cats.size}/${offered.length})`}</Label>
              <TouchableOpacity onPress={() => setCats(cats.size === offered.length ? new Set() : new Set(offered.map((c) => c.key)))}>
                <Text style={styles.link}>{cats.size === offered.length ? 'None' : 'All'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chips}>
              {offered.map((c) => (
                <TouchableOpacity key={c.key} style={[styles.chip, cats.has(c.key) && styles.chipOn]} onPress={() => toggle(c.key)}>
                  <Text style={[styles.chipText, cats.has(c.key) && styles.chipTextOn]}>{`${c.label} · ${(byCategory[c.key] ?? []).length}`}</Text>
                </TouchableOpacity>
              ))}
              {!offered.length ? <Text style={styles.sub}>No category has a checklist for this period.</Text> : null}
            </View>
            {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.btn, checking && { opacity: 0.5 }]} disabled={checking} onPress={() => void start()}><Text style={styles.btnText}>{checking ? 'Checking the vessel’s rounds…' : 'Start the round'}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setStarting(false)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
            </View>
          </Card>
        ) : (
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => setStarting(true)}>
            <Text style={styles.btnText}>+ Start a round</Text>
          </TouchableOpacity>
        )
      ) : null}

      {dups.map(({ keep, extra }) => (
        <Card key={extra.id} style={{ borderLeftWidth: 4, borderLeftColor: COLORS.warning }}>
          <Text style={[styles.title, { color: COLORS.warning }]}>Two rounds cover the same</Text>
          <Text style={styles.sub}>{`${roundTitle(extra, labelOf)}, started ${formatDateTime(extra.startedAt)} by ${extra.startedBy}, repeats the one started ${formatDateTime(keep.startedAt)} by ${keep.startedBy}. Close the later one: every inspection counts in the round kept, nothing is lost.`}</Text>
          {canRun ? (
            <>
              {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
              <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => void closeDuplicate(keep, extra)}><Text style={styles.btnText}>Close the duplicate</Text></TouchableOpacity>
            </>
          ) : <Text style={styles.sub}>An officer or the Master closes it.</Text>}
        </Card>
      ))}
      <Label>{`Open (${open.length})`}</Label>
      {open.map(row)}
      {!open.length ? <Text style={styles.sub}>{canRun ? 'No round open. Start one for this week or month.' : 'No round open — an officer starts one.'}</Text> : null}
      {closed.length ? <Label>{`Closed (${closed.length})`}</Label> : null}
      {closed.map(row)}
    </Screen>
  );
}

export const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs },
    title: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '700' },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    chev: { fontSize: 22, color: COLORS.textLight },
    bar: { height: 6, borderRadius: 3, backgroundColor: COLORS.border, marginTop: SIZES.xs, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    place: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark, marginTop: SIZES.xs, marginBottom: 2, paddingLeft: 2 },
    labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    link: { color: COLORS.primary, fontWeight: '700' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm, minHeight: 50, textAlignVertical: 'top' },
  });
