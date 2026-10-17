// ===================================
// Bridge checklists and Engine checklists (17 Oct 2026: "start with the bridge
// and engine watch handover — two folders"). Each folder: the checklists to
// start (the watch handover first; a vessel's own come from its forms), and the
// signed ones, newest first — older than 90 days from the cloud. The checklist
// itself is the DP checklist's screen (screens/DpCheckSc): tables, position and
// time, two officers sign, drafts, PDF and Print.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { checkOutcome, positionText, templatesNow } from '../services/dp';
import { loadOlder } from '../services/dpArchive';
import { DP_KEEP_DAYS } from '../services/firebaseService';
import { CheckBook, DpCheck, bookOf } from '../types/dp';
import { shipAndUtc } from '../utils/shipTime';

type Folder = { key: string; label: string; icon: string; sub: string; books: Exclude<CheckBook, 'dp'>[] };
// Two menu entries share this screen: Bridge & engine checklists, and Familiarisation.
const SETS: Record<'Watch' | 'Familiar', Folder[]> = {
  Watch: [
    // Bridge, engine and emergency — the sea-going round and the IMO emergency cards (SOLAS III/8, STCW A-VIII/2 Part 3).
    { key: 'bridge', label: 'Bridge checklists', icon: 'ferry', sub: 'Navigational watch and the sea-going round — STCW Code A-VIII/2, SOLAS V/34', books: ['bridge', 'bridge-sea', 'bridge-arrival', 'bridge-pilot', 'bridge-vis', 'bridge-weather'] },
    { key: 'engine', label: 'Engine checklists', icon: 'engine-outline', sub: 'Engineering watch, crew change — STCW Code A-VIII/2, ISM 6.3', books: ['engine'] },
    { key: 'emergency', label: 'Emergency cards', icon: 'alarm-light-outline', sub: 'What the OOW does now — SOLAS III/8, muster list', books: ['emergency'] },
  ],
  Familiar: [
    { key: 'fam-safety', label: 'Safety familiarisation', icon: 'lifebuoy', sub: 'Everyone boarding, within 24 hours and before sailing — STCW A-VI/1, ISM 6.3', books: ['fam-safety'] },
    { key: 'fam-bridge', label: 'Bridge familiarisation', icon: 'ferry', sub: 'On joining — STCW I/14, ISM Code 6.3', books: ['fam-bridge'] },
    { key: 'fam-engine', label: 'Engine familiarisation', icon: 'engine-outline', sub: 'On joining — STCW I/14, ISM Code 6.3', books: ['fam-engine'] },
    { key: 'fam-project', label: 'Project crew familiarisation', icon: 'account-hard-hat', sub: 'Project and special personnel on joining — IP Code, SPS Code', books: ['fam-project'] },
    { key: 'fam-pax', label: 'Passenger familiarisation', icon: 'account-group-outline', sub: 'Guests’ safety briefing — SOLAS III/19.2', books: ['fam-pax'] },
  ],
};

export default function WatchChecksSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { dpChecks, dpTemplates } = useData();
  const sync = useSync();
  const BOOKS = SETS[route.name === 'Familiar' ? 'Familiar' : 'Watch'];
  const meta = BOOKS.find((b) => b.key === route.params?.view) ?? BOOKS[0];
  const books = meta.books;
  const templates = useMemo(() => books.flatMap((b) => templatesNow(dpTemplates, b)), [dpTemplates, books]);
  const signed = useMemo(() => dpChecks.filter((c) => books.includes(bookOf(c) as any)).sort((a, b) => b.at - a.at), [dpChecks, books]);
  const [older, setOlder] = useState<DpCheck[]>([]);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderEnd, setOlderEnd] = useState(false);

  if (!moduleOn('watchChecks')) return <Screen><Empty text="Not available on this vessel." /></Screen>;

  const more = async () => {
    setOlderBusy(true);
    try {
      const last = older[older.length - 1];
      const page = await loadOlder(last ? last.updatedAt : undefined);
      setOlder((x) => [...x, ...page.filter((c) => books.includes(bookOf(c) as any) && !dpChecks.some((d) => d.id === c.id))]);
      if (page.length < 40) setOlderEnd(true);
    } finally {
      setOlderBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenTitle title={meta.label} subtitle={meta.sub} help="Bridge and engine checklists" />
      <View style={styles.chips}>
        {BOOKS.map((b) => (
          <TouchableOpacity key={b.key} style={[styles.chip, b.key === meta.key && styles.chipOn]} onPress={() => nav.setParams({ view: b.key })}>
            <Text style={[styles.chipText, b.key === meta.key && styles.chipTextOn]}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Label>Start a checklist</Label>
      {templates.map((tp) => (
        <TouchableOpacity key={tp.id} style={styles.row} onPress={() => nav.navigate('DpCheck', { templateId: tp.id })} activeOpacity={0.7}>
          <MciIcon name={meta.icon} size={20} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{tp.title}</Text>
            <Text style={styles.sub}>{`${tp.lines.filter((l) => !l.head && !l.kind).length} items`}</Text>
          </View>
          <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      ))}
      <Label style={{ marginTop: SIZES.md }}>Signed</Label>
      {!signed.length && !older.length ? <Text style={styles.sub}>None yet.</Text> : null}
      {[...signed, ...older].map((c) => {
        const o = checkOutcome(c);
        return (
          <TouchableOpacity key={c.id} style={styles.row} onPress={() => nav.navigate('DpCheck', { id: c.id })} activeOpacity={0.7}>
            <View style={[styles.dot, { backgroundColor: o.fail ? COLORS.danger : o.open ? COLORS.warning : COLORS.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{c.title}</Text>
              <Text style={styles.sub}>{[`${shipAndUtc(c.at, c.shipOffset).ship} LT`, c.position ? positionText(c.position) : null, c.by2 ? `${c.by} / ${c.by2}` : c.by, o.fail ? `${o.fail} NO` : null].filter(Boolean).join(' · ')}</Text>
            </View>
            <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        );
      })}
      {sync.enrolled ? (
        <TouchableOpacity onPress={() => void more()} disabled={olderBusy || olderEnd} style={{ marginVertical: SIZES.sm }}>
          <Text style={[styles.link, (olderBusy || olderEnd) && { opacity: 0.5 }]}>{olderBusy ? 'Loading…' : olderEnd ? 'No older checklists' : `Older than ${DP_KEEP_DAYS} days — from the cloud →`}</Text>
        </TouchableOpacity>
      ) : null}
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
    row: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
    dot: { width: 10, height: 10, borderRadius: 5 },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    link: { color: COLORS.primary, fontWeight: '700' },
  });
