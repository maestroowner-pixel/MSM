// ===================================
// Spares — the stores, as an engineer reads them.
//
// One list, grouped by where things are kept (store, shelf), because that is how
// a stocktake walks and how a part is found at 0300. The counts at the top answer
// the question asked before every order: what is out, and what is at or below
// its re-order level. "To order" narrows the list to exactly those lines.
//
// Stock is the sum of movements (types/spares.ts), worked out here per render;
// a vessel's stores run to hundreds of lines and thousands of movements, which
// is still nothing to add up.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { StockStatus, qtyText, statusRank, stockByPart, stockStatus } from '../services/spares';
import { uid } from '../utils/id';

export default function SparesSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { spares, spareMoves } = useData();
  const [q, setQ] = useState('');
  const [toOrder, setToOrder] = useState(false);

  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);
  const rows = useMemo(
    () => spares.map((p) => {
      const onHand = stock.get(p.id) ?? 0;
      return { p, onHand, status: stockStatus(p, onHand) };
    }),
    [spares, stock]
  );
  const out = rows.filter((r) => r.status === 'out').length;
  const low = rows.filter((r) => r.status === 'low').length;

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const shown = rows
      .filter((r) => !toOrder || r.status !== 'ok')
      .filter((r) => !needle || [r.p.name, r.p.partNo, r.p.maker, r.p.location].some((v) => v?.toLowerCase().includes(needle)));
    const byLoc = new Map<string, typeof shown>();
    for (const r of shown) {
      const k = r.p.location?.trim() || 'No location';
      byLoc.set(k, [...(byLoc.get(k) ?? []), r]);
    }
    return [...byLoc.entries()]
      .sort(([a], [b]) => (a === 'No location' ? 1 : b === 'No location' ? -1 : a.localeCompare(b)))
      .map(([loc, list]) => ({
        loc,
        list: list.sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.p.name.localeCompare(b.p.name)),
      }));
  }, [rows, q, toOrder]);

  const color = (s: StockStatus) => (s === 'out' ? COLORS.danger : s === 'low' ? COLORS.warning : COLORS.textDark);
  const addPart = () => nav.navigate('SparePart', { id: uid('part'), isNew: true });

  return (
    <Screen scroll>
      <ScreenTitle title="Spares" subtitle="Spare parts and stores" help="Spare parts" />

      <Card>
        <View style={styles.stats}>
          <Stat value={String(out)} label="Out of stock" color={out ? COLORS.danger : COLORS.textDark} />
          <Stat value={String(low)} label="Low" color={low ? COLORS.warning : COLORS.textDark} />
          <Stat value={String(spares.length)} label="Lines" color={COLORS.textDark} />
        </View>
      </Card>

      <View style={styles.tools}>
        <TextInput
          style={styles.search}
          value={q}
          onChangeText={setQ}
          placeholder="Search name, part no., maker, location…"
          placeholderTextColor={COLORS.textLight}
        />
        <TouchableOpacity style={[styles.chip, toOrder && styles.chipOn]} onPress={() => setToOrder((v) => !v)}>
          <Text style={[styles.chipText, toOrder && styles.chipTextOn]}>To order{out + low ? ` · ${out + low}` : ''}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.head}>
        <Label>Parts</Label>
        <TouchableOpacity onPress={addPart} hitSlop={10}>
          <Text style={styles.add}>+ Add part</Text>
        </TouchableOpacity>
      </View>

      {spares.length === 0 ? (
        <Empty text="No spare parts yet. Add what the vessel keeps — filters, impellers, belts, oil — with where it is stored and the level at which to re-order." />
      ) : groups.length === 0 ? (
        <Empty text={toOrder ? 'Nothing to order — every line is above its re-order level.' : 'No part matches.'} />
      ) : (
        groups.map(({ loc, list }) => (
          <View key={loc}>
            <Text style={styles.loc}>{loc}</Text>
            {list.map(({ p, onHand, status }) => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => nav.navigate('SparePart', { id: p.id })} activeOpacity={0.7}>
                <View style={[styles.bar, { backgroundColor: status === 'ok' ? COLORS.success : color(status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {[p.partNo, p.maker, p.minQty != null ? `min ${p.minQty}` : null].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                <Text style={[styles.qty, { color: color(status) }]}>{qtyText(onHand, p)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  const COLORS = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: SIZES.h4, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontSize: SIZES.tiny, color: COLORS.textLight }}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    stats: { flexDirection: 'row', gap: SIZES.sm },
    tools: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    search: { flex: 1, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text },
    chip: { paddingVertical: 8, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.md },
    add: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    loc: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SIZES.sm, marginBottom: SIZES.xs },
    row: { flexDirection: 'row', alignItems: 'center', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden', gap: SIZES.xs },
    bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.sm },
    title: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    qty: { fontSize: SIZES.h5, fontWeight: '800', marginLeft: SIZES.sm },
  });
