// ===================================
// Dashboard — inspection / expiry overview
// Flattens all items, sorts soonest-first, colour-codes by status.
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, StatusPill, Empty, statusColor } from '../components/ui';
import { COLORS, SIZES, GLASS } from '../theme';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { complianceDate, computeStatus, daysUntil, formatDate } from '../utils/dates';
import { ComplianceStatus, EquipmentItem, Group } from '../types/equipment';

type Filter = 'ALL' | Group | 'attention';

export default function DashboardSc() {
  const { flat, loading } = useData();
  const nav = useNavigation<any>();
  const [filter, setFilter] = useState<Filter>('ALL');

  const { rows, stats } = useMemo(() => {
    const withDates = flat
      .map((it) => ({ it, status: computeStatus(it), date: complianceDate(it), days: daysUntil(complianceDate(it)) }))
      .filter((r) => r.date != null);

    withDates.sort((a, b) => (a.days ?? 1e9) - (b.days ?? 1e9));

    const stats = {
      expired: withDates.filter((r) => r.status === 'expired').length,
      due: withDates.filter((r) => r.status === 'due').length,
      ok: withDates.filter((r) => r.status === 'ok').length,
    };

    let rows = withDates;
    if (filter === 'attention') rows = withDates.filter((r) => r.status === 'expired' || r.status === 'due');
    else if (filter !== 'ALL') rows = withDates.filter((r) => CATEGORY_MAP[r.it.category].group === filter);

    return { rows, stats };
  }, [flat, filter]);

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <ScreenTitle title="Dashboard" subtitle="Inspections & expiries, soonest first" />

      <View style={styles.statsRow}>
        <StatBox label="Expired" value={stats.expired} color={COLORS.danger} />
        <StatBox label="Due soon" value={stats.due} color={COLORS.warning} />
        <StatBox label="Valid" value={stats.ok} color={COLORS.success} />
      </View>

      <View style={styles.filterRow}>
        {(['ALL', 'attention', 'LSA', 'FFE', 'OTHER'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'attention' ? 'Needs attention' : f === 'ALL' ? 'All' : f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? null : rows.length === 0 ? (
        <Empty text="No items with dates yet. Import the LSA/FFE workbook from Settings." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.it.id}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          renderItem={({ item: r }) => (
            <DashRow
              item={r.it}
              status={r.status}
              date={r.date}
              days={r.days}
              onPress={() =>
                nav.navigate('ItemDetail', { category: r.it.category, id: r.it.id })
              }
            />
          )}
        />
      )}
    </Screen>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.statBox, { borderColor: color }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DashRow({
  item,
  status,
  date,
  days,
  onPress,
}: {
  item: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
  onPress: () => void;
}) {
  const meta = CATEGORY_MAP[item.category];
  const title = item.type || (item.no != null ? `#${item.no}` : meta.short);
  const daysText =
    days == null ? '' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `in ${days}d`;
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowBar, { backgroundColor: statusColor(status) }]} />
      <Text style={styles.rowEmoji}>{meta.emoji}</Text>
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

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  statBox: {
    flex: 1,
    ...GLASS.card,
    borderRadius: SIZES.radiusMd,
    borderLeftWidth: 4,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  statValue: { fontSize: SIZES.h2, fontWeight: '800' },
  statLabel: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.md },
  chip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: 6,
    borderRadius: SIZES.radiusRound,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: SIZES.small, color: COLORS.text, fontWeight: '600' },
  chipTextActive: { color: COLORS.textWhite },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...GLASS.card,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    paddingRight: SIZES.md,
    paddingLeft: 0,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  rowBar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  rowEmoji: { fontSize: 22, marginRight: SIZES.sm },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.body, fontWeight: '700' },
  rowDays: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
});
