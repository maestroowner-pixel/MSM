// ===================================
// Recently scanned — every item opened by scanning its QR label or serial on THIS
// device, most recent first. The trail of what the crew was just handling, one tap
// from being picked back up. (Ported from DEM.)
// ===================================

import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Screen, ScreenTitle, StatusPill, CategoryBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { computeStatus, formatDateTime } from '../utils/dates';
import { EquipmentItem } from '../types/equipment';

/** "just now" / "12m ago" / "3h ago" / "2d ago". */
function relScanned(ts?: number): string {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function RecentScansSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const { flat, recentScans } = useData();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const { width } = useWindowDimensions();
  const cols = width >= 600 ? 2 : 1;

  // The trail (services/scanHistory) is already newest-first and holds ids only;
  // items deleted since the scan drop out rather than showing as empty rows.
  const scanned = useMemo(() => {
    const byId = new Map(flat.map((i) => [i.id, i]));
    return recentScans
      .map((e) => ({ it: byId.get(e.id), at: e.at }))
      .filter((r): r is { it: EquipmentItem; at: number } => r.it != null);
  }, [flat, recentScans]);

  const titleOf = (it: EquipmentItem) => {
    const meta = CATEGORY_MAP[it.category];
    return it.type || (it.no != null ? `#${it.no}` : meta.short);
  };

  return (
    <Screen>
      <ScreenTitle
        title="Recently scanned"
        subtitle={`${scanned.length} item${scanned.length === 1 ? '' : 's'} opened from a label`}
      />
      <FlatList
        data={scanned}
        keyExtractor={(r) => r.it.id}
        key={cols}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap: SIZES.sm } : undefined}
        contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
        ListEmptyComponent={
          <Empty text={'Nothing scanned yet.\nScan a label to jump back to it here.'} />
        }
        renderItem={({ item: { it: item, at } }) => {
          const meta = CATEGORY_MAP[item.category];
          return (
            <TouchableOpacity
              style={[styles.row, cols > 1 && { flex: 1 }]}
              onPress={() => nav.navigate('ItemDetail', { category: item.category, id: item.id })}
              activeOpacity={0.7}
            >
              <CategoryBadge category={item.category} size={22} />
              <View style={{ flex: 1, marginLeft: SIZES.md }}>
                <Text style={styles.title} numberOfLines={1}>{titleOf(item)}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {meta.short}
                  {item.position ? ` · ${item.position}` : ''}
                  {item.serial ? ` · ${item.serial}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: SIZES.xs }}>
                <StatusPill status={computeStatus(item)} />
                <Text style={styles.when}>{relScanned(at)}</Text>
                <Text style={styles.whenExact}>{formatDateTime(at)}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      ...COLORS.glassCard,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginBottom: SIZES.sm,
    },
    title: { color: COLORS.textDark, fontSize: SIZES.h5, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small },
    when: { color: COLORS.textDark, fontSize: SIZES.small, fontWeight: '700' },
    whenExact: { color: COLORS.textLight, fontSize: SIZES.tiny },
  });
