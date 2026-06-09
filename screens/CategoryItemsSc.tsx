// ===================================
// Category items list
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, StatusPill, Empty, statusColor, CategoryBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { complianceDate, computeStatus, daysUntil, formatDate } from '../utils/dates';
import { CategoryKey, ComplianceStatus, EquipmentItem } from '../types/equipment';
import { uid } from '../utils/id';

type SortBy = 'date' | 'position';
const SORT_ORDER: SortBy[] = ['date', 'position'];
const SORT_LABEL: Record<SortBy, string> = { date: 'Expiry date', position: 'Position' };
const NO_POSITION = '— No position';

interface Scored {
  it: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
}
type ListEntry =
  | { kind: 'header'; key: string; position: string; count: number }
  | ({ kind: 'row'; key: string } & Scored);

export default function CategoryItemsSc() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const category: CategoryKey = route.params.category;
  const meta = CATEGORY_MAP[category];
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { byCategory, certificates, prefs } = useData();
  const certItemIds = useMemo(() => {
    const s = new Set<string>();
    certificates.forEach((c) => c.itemIds.forEach((id) => s.add(id)));
    return s;
  }, [certificates]);
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');

  const filtered = useMemo(() => {
    const list = byCategory[category] ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((it) =>
      [it.type, it.serial, it.position, String(it.no)].some((v) => v?.toLowerCase().includes(needle))
    );
  }, [byCategory, category, q]);

  // Sort by soonest expiry/inspection, or group by position with location headers.
  const listData = useMemo<ListEntry[]>(() => {
    const scored: Scored[] = filtered.map((it) => {
      const date = complianceDate(it);
      return { it, status: computeStatus(it), date, days: daysUntil(date) };
    });
    const byDays = (a: Scored, b: Scored) => (a.days ?? 1e9) - (b.days ?? 1e9);

    if (sortBy === 'date') {
      return [...scored].sort(byDays).map((r) => ({ kind: 'row', key: r.it.id, ...r }));
    }
    // Group by position, alphabetical, with a header per location.
    const byPos = new Map<string, Scored[]>();
    for (const r of scored) {
      const pos = (r.it.position ?? '').trim() || NO_POSITION;
      const arr = byPos.get(pos);
      if (arr) arr.push(r);
      else byPos.set(pos, [r]);
    }
    const positions = [...byPos.keys()].sort((a, b) => {
      if (a === NO_POSITION) return 1;
      if (b === NO_POSITION) return -1;
      return a.localeCompare(b);
    });
    const out: ListEntry[] = [];
    for (const pos of positions) {
      const group = byPos.get(pos)!.sort(byDays);
      out.push({ kind: 'header', key: `h:${pos}`, position: pos, count: group.length });
      for (const r of group) out.push({ kind: 'row', key: r.it.id, ...r });
    }
    return out;
  }, [filtered, sortBy]);

  const cycleSort = () => setSortBy((s) => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  // Tablets: lay item cards out two-per-row (location headers stay full-width).
  const { width } = useWindowDimensions();
  const twoCol = width >= 600;
  const renderData = useMemo<(ListEntry | { kind: 'pair'; key: string; left: ListEntry; right?: ListEntry })[]>(() => {
    if (!twoCol) return listData;
    const out: (ListEntry | { kind: 'pair'; key: string; left: ListEntry; right?: ListEntry })[] = [];
    for (let i = 0; i < listData.length; ) {
      const e = listData[i];
      if (e.kind === 'header') { out.push(e); i++; continue; }
      const right = listData[i + 1]?.kind === 'row' ? listData[i + 1] : undefined;
      out.push({ kind: 'pair', key: 'p:' + e.key, left: e, right });
      i += right ? 2 : 1;
    }
    return out;
  }, [listData, twoCol]);

  const ItemCard = (e: Extract<ListEntry, { kind: 'row' }>, fill?: boolean) => (
    <TouchableOpacity
      style={[styles.row, fill && { flex: 1 }]}
      activeOpacity={0.7}
      onPress={() => nav.navigate('ItemDetail', { category, id: e.it.id })}
    >
      <View style={[styles.bar, { backgroundColor: statusColor(e.status) }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {e.it.type || (e.it.no != null ? `#${e.it.no}` : 'Item')}
          </Text>
          {e.it.attachments && e.it.attachments.length > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📎 {e.it.attachments.length}</Text>
            </View>
          ) : null}
          {certItemIds.has(e.it.id) ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📜</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {[e.it.serial && `S/N ${e.it.serial}`, e.it.position].filter(Boolean).join(' · ') || '—'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {e.date ? <Text style={styles.rowDate}>{formatDate(e.date)}</Text> : null}
        <StatusPill status={e.status} />
      </View>
    </TouchableOpacity>
  );

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <View style={styles.head}>
        <CategoryBadge category={category} size={28} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{meta.label}</Text>
          <Text style={styles.sub}>{meta.group} · {(byCategory[category] ?? []).length} items</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() =>
            nav.navigate('ItemDetail', { category, id: null, newId: uid(category.slice(0, 3)) })
          }
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {category === 'fifi_ba' && prefs.compressorEnabled ? (
        <TouchableOpacity style={styles.compressorBtn} onPress={() => nav.navigate('Compressor')}>
          <Text style={styles.compressorEmoji}>⏱️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.compressorTitle}>BA Compressor log</Text>
            <Text style={styles.compressorSub}>Running-time counter · maintenance / service / inspection</Text>
          </View>
          <Text style={styles.compressorChev}>›</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.controlRow}>
        <TextInput
          style={[styles.search, { flex: 1, marginBottom: 0 }]}
          placeholder="Search type, serial, position…"
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
        />
        <TouchableOpacity style={styles.cycleBtn} onPress={cycleSort} activeOpacity={0.8}>
          <Text style={styles.cycleCaption}>SORT</Text>
          <Text style={styles.cycleValue} numberOfLines={1}>⟳ {SORT_LABEL[sortBy]}</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <Empty text="No items. Tap ＋ to add one, or import the workbook from Settings." />
      ) : (
        <FlatList
          data={renderData}
          keyExtractor={(e) => e.key}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          renderItem={({ item: e }) =>
            e.kind === 'header' ? (
              <View style={styles.posHeader}>
                <Text style={styles.posHeaderText} numberOfLines={1}>📍 {e.position}</Text>
                <Text style={styles.posHeaderCount}>{e.count}</Text>
              </View>
            ) : e.kind === 'pair' ? (
              <View style={styles.pairRow}>
                {ItemCard(e.left as Extract<ListEntry, { kind: 'row' }>, true)}
                {e.right ? ItemCard(e.right as Extract<ListEntry, { kind: 'row' }>, true) : <View style={{ flex: 1 }} />}
              </View>
            ) : (
              ItemCard(e)
            )
          }
        />
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.md, gap: SIZES.sm },
  emoji: { fontSize: 30 },
  title: { fontSize: SIZES.h3, fontWeight: '700', color: COLORS.textDark },
  sub: { fontSize: SIZES.small, color: COLORS.textLight },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: COLORS.textWhite, fontSize: 26, lineHeight: 28, fontWeight: '600' },
  search: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  cycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSolid,
  },
  cycleCaption: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '800', letterSpacing: 0.5 },
  cycleValue: { fontSize: SIZES.small, color: COLORS.primaryDark, fontWeight: '700' },
  posHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    marginBottom: SIZES.xs,
    marginTop: SIZES.xs,
  },
  posHeaderText: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primaryDark, flex: 1 },
  posHeaderCount: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textLight, marginLeft: SIZES.sm },
  pairRow: { flexDirection: 'row', gap: SIZES.sm, alignItems: 'stretch' },
  compressorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.md,
  },
  compressorEmoji: { fontSize: 22 },
  compressorTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primaryDark },
  compressorSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
  compressorChev: { fontSize: SIZES.h3, color: COLORS.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    paddingRight: SIZES.md,
    paddingLeft: 0,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark, flexShrink: 1 },
  badge: { backgroundColor: 'rgba(46,125,153,0.12)', borderRadius: SIZES.radiusSm, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: SIZES.tiny, color: COLORS.primaryDark, fontWeight: '700' },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.small, color: COLORS.text, marginBottom: 2 },
});
