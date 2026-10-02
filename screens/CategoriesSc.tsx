// ===================================
// Equipment — category grid
// One card per category with item count + worst-status indicator.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, statusColor, CategoryBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORIES, CategoryMeta, GROUP_LABEL, GROUP_ORDER } from '../constants/categories';
import { useSync } from '../contexts/SyncContext';
import { MciIcon } from '../components/MciIcon';
import { computeStatus } from '../utils/dates';
import { CategoryKey, ComplianceStatus, EquipmentItem, Group } from '../types/equipment';

const STATUS_RANK: Record<ComplianceStatus, number> = { expired: 3, due: 2, ok: 1, none: 0 };

function worstStatus(items: EquipmentItem[]): ComplianceStatus {
  return items.reduce<ComplianceStatus>((worst, it) => {
    const s = computeStatus(it);
    return STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst;
  }, 'none');
}



export default function CategoriesSc() {
  const { byCategory, categories: ownCats, setCategoryHidden } = useData();
  const sync = useSync();
  /**
   * A Master (or a device on no vessel, which answers to nobody) may tidy the
   * grid from here. Asked for on this screen rather than in Settings because
   * this is where you notice that half of it is equipment you do not carry.
   */
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const [tidying, setTidying] = useState(false);
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // `ownCats` is in the deps for a reason that is invisible from here: CATEGORIES
  // is a registry mutated in place when a vessel adds a heading, so nothing about
  // reading it tells React that it changed. The context list is what does.
  const sections = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      group: g,
      // While tidying, the hidden ones come back — dimmed, with their switch —
      // because a list you cannot see is a list you cannot turn back on.
      items: CATEGORIES.filter((c) => c.group === g && (tidying || !c.hidden)),
    }));
  }, [ownCats, tidying]);

  const hiddenCount = useMemo(() => CATEGORIES.filter((c) => c.hidden).length, [ownCats, tidying]);

  const toggleHidden = (c: CategoryMeta) => {
    const count = (byCategory[c.key] ?? []).length;
    if (c.hidden) {
      void setCategoryHidden(c.key, false);
      return;
    }
    // Warned once, and only when it matters: "where did my lifebuoys go" is a bad
    // five minutes, and the answer — that nothing was deleted — has to be said
    // BEFORE the tile disappears rather than found afterwards.
    if (!count) {
      void setCategoryHidden(c.key, true);
      return;
    }
    Alert.alert(
      `Hide ${c.label}?`,
      `It holds ${count} item${count === 1 ? '' : 's'}. They stay on file with their history, ` +
        'labels and certificates — the heading is simply not shown, and the rounds and reports ' +
        'stop asking for it. You can bring it back here at any time.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Hide', onPress: () => void setCategoryHidden(c.key, true) },
      ]
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle
        title="Equipment"
        subtitle="Browse safety equipment by category"
        help={2}
        onScan={() => nav.navigate('Scan')}
        onLabels={() => nav.navigate('LabelBatch')}
      />
      {isMaster ? (
        <TouchableOpacity style={styles.tidyRow} onPress={() => setTidying((t) => !t)} activeOpacity={0.7}>
          <MciIcon name={tidying ? 'check' : 'eye-settings-outline'} size={18} color={COLORS.primary} />
          <Text style={styles.tidyText}>
            {tidying
              ? 'Done — tap a category to show or hide it'
              : hiddenCount
                ? `Show or hide categories · ${hiddenCount} hidden`
                : 'Show or hide categories'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {sections.map((sec) => (
        <View key={sec.group} style={{ marginBottom: SIZES.lg }}>
          <Text style={[styles.groupTitle, { color: COLORS.groupColors[sec.group] }]}>{GROUP_LABEL[sec.group]}</Text>
          <View style={styles.grid}>
            {sec.items.map((c) => {
              const items = byCategory[c.key] ?? [];
              const ws = worstStatus(items);
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.tile, tidying && c.hidden && styles.tileHidden]}
                  activeOpacity={0.8}
                  onPress={() =>
                    tidying ? toggleHidden(c) : nav.navigate('CategoryItems', { category: c.key })
                  }
                >
                  <View style={styles.tileTop}>
                    <CategoryBadge category={c.key} size={24} />
                    {tidying ? (
                      <MciIcon
                        name={c.hidden ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={c.hidden ? COLORS.textLight : COLORS.primary}
                      />
                    ) : ws !== 'none' && ws !== 'ok' ? (
                      <View style={[styles.badge, { backgroundColor: statusColor(ws) }]} />
                    ) : null}
                  </View>
                  {/* The name the vessel gave it, in full. The tile used to show a
                      short form of its own invention, so Settings and Equipment
                      disagreed about what a category was called. */}
                  <Text style={styles.tileLabel} numberOfLines={3}>
                    {c.label}
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

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  tidyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.sm,
    marginBottom: SIZES.xs,
  },
  tidyText: { color: COLORS.primary, fontSize: SIZES.small, fontWeight: '700' },
  tileHidden: { opacity: 0.45 },
  groupTitle: {
    fontSize: SIZES.h5,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginBottom: SIZES.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  tile: {
    width: '31%',
    ...COLORS.glassCard,
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
