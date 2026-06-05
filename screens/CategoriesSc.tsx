// ===================================
// Equipment — category grid
// One card per category with item count + worst-status indicator.
// ===================================

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, statusColor } from '../components/ui';
import { COLORS, SIZES, GLASS } from '../theme';
import { useData } from '../contexts/DataContext';
import { CATEGORIES } from '../constants/categories';
import { computeStatus } from '../utils/dates';
import { CategoryKey, ComplianceStatus, EquipmentItem, Group } from '../types/equipment';

const STATUS_RANK: Record<ComplianceStatus, number> = { expired: 3, due: 2, ok: 1, none: 0 };

function worstStatus(items: EquipmentItem[]): ComplianceStatus {
  return items.reduce<ComplianceStatus>((worst, it) => {
    const s = computeStatus(it);
    return STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst;
  }, 'none');
}

const GROUP_LABEL: Record<Group, string> = {
  LSA: 'Life-Saving Appliances',
  FFE: 'Fire-Fighting Equipment',
  OTHER: 'Other Safety Equipment',
};

export default function CategoriesSc() {
  const { byCategory } = useData();
  const nav = useNavigation<any>();

  const sections = useMemo(() => {
    const groups: Group[] = ['LSA', 'FFE', 'OTHER'];
    return groups.map((g) => ({
      group: g,
      items: CATEGORIES.filter((c) => c.group === g),
    }));
  }, []);

  return (
    <Screen scroll>
      <ScreenTitle title="Equipment" subtitle="Browse safety equipment by category" />
      {sections.map((sec) => (
        <View key={sec.group} style={{ marginBottom: SIZES.lg }}>
          <Text style={styles.groupTitle}>{GROUP_LABEL[sec.group]}</Text>
          <View style={styles.grid}>
            {sec.items.map((c) => {
              const items = byCategory[c.key] ?? [];
              const ws = worstStatus(items);
              return (
                <TouchableOpacity
                  key={c.key}
                  style={styles.tile}
                  activeOpacity={0.8}
                  onPress={() => nav.navigate('CategoryItems', { category: c.key })}
                >
                  <View style={styles.tileTop}>
                    <Text style={styles.emoji}>{c.emoji}</Text>
                    {ws !== 'none' && ws !== 'ok' ? (
                      <View style={[styles.badge, { backgroundColor: statusColor(ws) }]} />
                    ) : null}
                  </View>
                  <Text style={styles.tileLabel} numberOfLines={2}>
                    {c.short}
                  </Text>
                  <Text style={styles.tileCount}>{items.length} items</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: SIZES.h5,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: SIZES.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  tile: {
    width: '31%',
    ...GLASS.card,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  tileTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  emoji: { fontSize: 26 },
  badge: { width: 12, height: 12, borderRadius: 6 },
  tileLabel: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark, marginTop: SIZES.xs },
  tileCount: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2 },
});
