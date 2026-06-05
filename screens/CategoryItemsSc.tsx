// ===================================
// Category items list
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, StatusPill, Empty, statusColor } from '../components/ui';
import { COLORS, SIZES, GLASS } from '../theme';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { complianceDate, computeStatus, formatDate } from '../utils/dates';
import { CategoryKey } from '../types/equipment';
import { uid } from '../utils/id';

export default function CategoryItemsSc() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const category: CategoryKey = route.params.category;
  const meta = CATEGORY_MAP[category];
  const { byCategory, certificates } = useData();
  const certItemIds = useMemo(() => {
    const s = new Set<string>();
    certificates.forEach((c) => c.itemIds.forEach((id) => s.add(id)));
    return s;
  }, [certificates]);
  const [q, setQ] = useState('');

  const items = useMemo(() => {
    const list = byCategory[category] ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((it) =>
      [it.type, it.serial, it.position, String(it.no)].some((v) => v?.toLowerCase().includes(needle))
    );
  }, [byCategory, category, q]);

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <View style={styles.head}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
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

      <TextInput
        style={styles.search}
        placeholder="Search type, serial, position…"
        placeholderTextColor={COLORS.textLight}
        value={q}
        onChangeText={setQ}
      />

      {items.length === 0 ? (
        <Empty text="No items. Tap ＋ to add one, or import the workbook from Settings." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          renderItem={({ item }) => {
            const status = computeStatus(item);
            const date = complianceDate(item);
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.7}
                onPress={() => nav.navigate('ItemDetail', { category, id: item.id })}
              >
                <View style={[styles.bar, { backgroundColor: statusColor(status) }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {item.type || (item.no != null ? `#${item.no}` : 'Item')}
                    </Text>
                    {item.attachments && item.attachments.length > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>📎 {item.attachments.length}</Text>
                      </View>
                    ) : null}
                    {certItemIds.has(item.id) ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>📜</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[item.serial && `S/N ${item.serial}`, item.position].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {date ? <Text style={styles.rowDate}>{formatDate(date)}</Text> : null}
                  <StatusPill status={status} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    ...GLASS.input,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
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
  bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark, flexShrink: 1 },
  badge: { backgroundColor: 'rgba(46,125,153,0.12)', borderRadius: SIZES.radiusSm, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: SIZES.tiny, color: COLORS.primaryDark, fontWeight: '700' },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.small, color: COLORS.text, marginBottom: 2 },
});
