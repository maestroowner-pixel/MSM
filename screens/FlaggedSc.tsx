// ===================================
// Flagged items — everything the crew marked for a second look, across every
// category. Not a compliance list: an item here may be perfectly in date. It is
// the list of things a human decided are worth coming back to. (Ported from DEM.)
// ===================================

import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Screen, ScreenTitle, StatusPill, CategoryBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { computeStatus } from '../utils/dates';
import { EquipmentItem } from '../types/equipment';

export default function FlaggedSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const { flat, saveItem } = useData();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const { width } = useWindowDimensions();
  const cols = width >= 600 ? 2 : 1;

  const flagged = useMemo(
    () => flat.filter((i) => i.flagged).sort((a, b) => b.updatedAt - a.updatedAt),
    [flat]
  );

  const titleOf = (it: EquipmentItem) => {
    const meta = CATEGORY_MAP[it.category];
    return it.type || (it.no != null ? `#${it.no}` : meta.short);
  };

  return (
    <Screen>
      <ScreenTitle
        title="Flagged"
        subtitle={`${flagged.length} item${flagged.length === 1 ? '' : 's'} marked for a second look`}
      />
      <FlatList
        data={flagged}
        keyExtractor={(i) => i.id}
        key={cols}
        numColumns={cols}
        columnWrapperStyle={cols > 1 ? { gap: SIZES.sm } : undefined}
        contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
        ListEmptyComponent={
          <Empty text={'Nothing is flagged.\nOpen an item and tap the flag to mark it.'} />
        }
        renderItem={({ item }) => {
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
                {item.flagNote ? (
                  <Text style={styles.note} numberOfLines={2}>{item.flagNote}</Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: SIZES.xs }}>
                <StatusPill status={computeStatus(item)} />
                <TouchableOpacity onPress={() => void saveItem({ ...item, flagged: false, flagNote: undefined })}>
                  <Text style={styles.clear}>Clear flag</Text>
                </TouchableOpacity>
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
    note: { color: COLORS.warning, fontSize: SIZES.small, marginTop: 2 },
    clear: { color: COLORS.primary, fontSize: SIZES.small, fontWeight: '700' },
  });
