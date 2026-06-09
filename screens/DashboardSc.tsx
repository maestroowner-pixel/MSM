// ===================================
// Dashboard — inspection / expiry overview
// Flattens all items; filter by group + status (tap a counter), sort by expiry
// date or by position (grouped with location headers).
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Empty, statusColor, CategoryBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { complianceDate, computeStatus, daysUntil, formatDate } from '../utils/dates';
import { ComplianceStatus, EquipmentItem, Group } from '../types/equipment';

type GroupFilter = 'ALL' | Group;
type StatusFilter = 'expired' | 'due' | 'ok' | null;
type SortBy = 'date' | 'position';

const NO_POSITION = '— No position';

const GROUP_ORDER: GroupFilter[] = ['ALL', 'LSA', 'FFE', 'OTHER'];
const GROUP_LABEL: Record<GroupFilter, string> = { ALL: 'All groups', LSA: 'LSA', FFE: 'FFE', OTHER: 'Other' };
const SORT_ORDER: SortBy[] = ['date', 'position'];
const SORT_LABEL: Record<SortBy, string> = { date: 'Expiry date', position: 'Position' };

interface Scored {
  it: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
}
type ListEntry =
  | { kind: 'header'; key: string; position: string; count: number }
  | ({ kind: 'row'; key: string } & Scored);

export default function DashboardSc() {
  const { flat, loading } = useData();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useS();
  const [group, setGroup] = useState<GroupFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>(null);
  const [sortBy, setSortBy] = useState<SortBy>('date');

  const { listData, stats, total } = useMemo(() => {
    const withDates: Scored[] = flat
      .map((it) => ({ it, status: computeStatus(it), date: complianceDate(it), days: daysUntil(complianceDate(it)) }))
      .filter((r) => r.date != null);

    // Group scope drives the counters; the status filter then narrows the list.
    const scoped = group === 'ALL' ? withDates : withDates.filter((r) => CATEGORY_MAP[r.it.category].group === group);
    const stats = {
      expired: scoped.filter((r) => r.status === 'expired').length,
      due: scoped.filter((r) => r.status === 'due').length,
      ok: scoped.filter((r) => r.status === 'ok').length,
    };

    let rows = status ? scoped.filter((r) => r.status === status) : scoped;
    const byDays = (a: Scored, b: Scored) => (a.days ?? 1e9) - (b.days ?? 1e9);

    let listData: ListEntry[];
    if (sortBy === 'date') {
      rows = [...rows].sort(byDays);
      listData = rows.map((r) => ({ kind: 'row', key: r.it.id, ...r }));
    } else {
      // Group by position, alphabetical, with a header per location.
      const byPos = new Map<string, Scored[]>();
      for (const r of rows) {
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
      listData = [];
      for (const pos of positions) {
        const items = byPos.get(pos)!.sort(byDays);
        listData.push({ kind: 'header', key: `h:${pos}`, position: pos, count: items.length });
        for (const r of items) listData.push({ kind: 'row', key: r.it.id, ...r });
      }
    }

    return { listData, stats, total: rows.length };
  }, [flat, group, status, sortBy]);

  const toggleStatus = (s: Exclude<StatusFilter, null>) => setStatus((cur) => (cur === s ? null : s));
  const cycleGroup = () => setGroup((g) => GROUP_ORDER[(GROUP_ORDER.indexOf(g) + 1) % GROUP_ORDER.length]);
  const cycleSort = () => setSortBy((s) => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  // Tablets: two cards per row (location headers stay full-width).
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

  const rowOf = (e: Extract<ListEntry, { kind: 'row' }>, fill?: boolean) => (
    <DashRow
      item={e.it}
      status={e.status}
      date={e.date}
      days={e.days}
      fill={fill}
      onPress={() => nav.navigate('ItemDetail', { category: e.it.category, id: e.it.id })}
    />
  );

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <ScreenTitle title="Dashboard" subtitle="Inspections & expiries, soonest first" />

      <View style={styles.statsRow}>
        <StatBox label="Expired" value={stats.expired} color={COLORS.danger} active={status === 'expired'} onPress={() => toggleStatus('expired')} />
        <StatBox label="Due soon" value={stats.due} color={COLORS.warning} active={status === 'due'} onPress={() => toggleStatus('due')} />
        <StatBox label="Valid" value={stats.ok} color={COLORS.success} active={status === 'ok'} onPress={() => toggleStatus('ok')} />
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.cycleBtn} onPress={cycleGroup} activeOpacity={0.8}>
          <Text style={styles.cycleCaption}>GROUP</Text>
          <Text style={styles.cycleValue} numberOfLines={1}>{GROUP_LABEL[group]} ⟳</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cycleBtn} onPress={cycleSort} activeOpacity={0.8}>
          <Text style={styles.cycleCaption}>SORT</Text>
          <Text style={styles.cycleValue} numberOfLines={1}>⟳ {SORT_LABEL[sortBy]}</Text>
        </TouchableOpacity>
      </View>

      {loading ? null : total === 0 ? (
        <Empty text={status || group !== 'ALL' ? 'No items match the current filters.' : 'No items with dates yet. Import the LSA/FFE workbook from Settings.'} />
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
                {rowOf(e.left as Extract<ListEntry, { kind: 'row' }>, true)}
                {e.right ? rowOf(e.right as Extract<ListEntry, { kind: 'row' }>, true) : <View style={{ flex: 1 }} />}
              </View>
            ) : (
              rowOf(e)
            )
          }
        />
      )}
    </Screen>
  );
}

function StatBox({
  label,
  value,
  color,
  active,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  const COLORS = useTheme();
  const styles = useS();
  return (
    <TouchableOpacity
      style={[styles.statBox, { borderColor: color }, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.statValue, { color: active ? COLORS.textWhite : color }]}>{value}</Text>
      <Text style={[styles.statLabel, active && { color: COLORS.textWhite }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DashRow({
  item,
  status,
  date,
  days,
  onPress,
  fill,
}: {
  item: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
  onPress: () => void;
  fill?: boolean;
}) {
  const styles = useS();
  const meta = CATEGORY_MAP[item.category];
  const title = item.type || (item.no != null ? `#${item.no}` : meta.short);
  const daysText =
    days == null ? '' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `in ${days}d`;
  return (
    <TouchableOpacity style={[styles.row, fill && { flex: 1 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowBar, { backgroundColor: statusColor(status) }]} />
      <View style={styles.rowEmoji}><CategoryBadge category={item.category} size={20} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {meta.short}
          {item.position ? ` · ${item.position}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.rowDate, { color: statusColor(status) }]}>{formatDate(date)}</Text>
        <Text style={styles.rowDays}>{daysText}</Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    backgroundColor: COLORS.cardSolid,
    paddingVertical: 6,
    paddingHorizontal: SIZES.sm,
  },
  statValue: { fontSize: SIZES.h5, fontWeight: '800' },
  statLabel: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '600' },
  controlRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  cycleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSolid,
  },
  cycleCaption: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '800', letterSpacing: 0.5 },
  cycleValue: { fontSize: SIZES.small, color: COLORS.primaryDark, fontWeight: '700', flexShrink: 1 },
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
  rowBar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  rowEmoji: { marginRight: SIZES.sm, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.body, fontWeight: '700' },
  rowDays: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
