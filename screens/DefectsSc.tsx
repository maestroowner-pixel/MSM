// ===================================
// Defects — everything the vessel still owes work on.
//
// A defect is not a status on the item; it is the failed inspection that raised
// it, still open. Keeping it that way means the list can always answer the three
// questions that matter — what is wrong, who found it and when — by pointing at
// the signed record, instead of at a flag somebody could have set for any reason.
//
// Rectified defects stay reachable behind a toggle rather than vanishing: at an
// audit, "we found it and fixed it" is a better story than silence, and it is
// only tellable if the closed ones are still on file.
// ===================================

import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, CategoryBadge, Empty, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP } from '../constants/categories';
import { Group } from '../types/equipment';
import { Inspection, PERIOD_LABEL } from '../types/inspection';
import { signatureLine } from '../types/crew';
import { formatDateTime } from '../utils/dates';

type Filter = 'open' | 'closed';
const GROUPS: Array<Group | 'ALL'> = ['ALL', 'LSA', 'FFE'];

export default function DefectsSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { inspections: trail, flat } = useData();

  const [filter, setFilter] = useState<Filter>('open');
  const [group, setGroup] = useState<Group | 'ALL'>('ALL');

  const rows = useMemo(() => {
    return trail
      .filter((i) => !!i.defect && (filter === 'open' ? i.defect.open : !i.defect.open))
      .filter((i) => group === 'ALL' || CATEGORY_MAP[i.category]?.group === group)
      .sort((a, b) => b.at - a.at);
  }, [trail, filter, group]);

  const openCount = useMemo(() => trail.filter((i) => i.defect?.open).length, [trail]);

  const renderRow = ({ item: insp }: { item: Inspection }) => {
    const equip = flat.find((e) => e.id === insp.itemId);
    const meta = CATEGORY_MAP[insp.category];
    const age = Math.floor((Date.now() - insp.at) / 86_400_000);
    return (
      <TouchableOpacity onPress={() => nav.navigate('InspectionDetail', { id: insp.id })}>
        <Card>
          <View style={styles.row}>
            <CategoryBadge category={insp.category} size={22} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {equip?.type || equip?.serial || meta?.label || 'Item'}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {[meta?.label, equip?.position].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {insp.defect?.open ? (
              <View style={styles.agePill}>
                <Text style={styles.agePillText}>{age === 0 ? 'today' : `${age}d`}</Text>
              </View>
            ) : (
              <MciIcon name="check-decagram" size={20} color={COLORS.success} />
            )}
          </View>

          <Text style={styles.defect}>{insp.defect?.note}</Text>

          <View style={styles.footer}>
            <MciIcon name="account-check" size={14} color={COLORS.textLight} />
            <Text style={styles.footerText} numberOfLines={1}>
              {signatureLine(insp.by, insp.byRank)} · {formatDateTime(insp.at)} ·{' '}
              {PERIOD_LABEL[insp.period]}
            </Text>
          </View>

          {!insp.defect?.open && insp.defect?.closedBy ? (
            <View style={styles.footer}>
              <MciIcon name="wrench" size={14} color={COLORS.success} />
              <Text style={styles.footerText} numberOfLines={1}>
                Rectified by {insp.defect.closedBy} · {formatDateTime(insp.defect.closedAt)}
              </Text>
            </View>
          ) : null}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <ScreenTitle
        title="Defects"
        subtitle={
          openCount
            ? `${openCount} outstanding across the vessel`
            : 'Nothing outstanding — every defect has been rectified'
        }
      />

      <View style={styles.filters}>
        {(['open', 'closed'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipOn]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextOn]}>
              {f === 'open' ? 'Outstanding' : 'Rectified'}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {GROUPS.map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.chip, group === g && styles.chipOn]}
            onPress={() => setGroup(g)}
          >
            <Text style={[styles.chipText, group === g && styles.chipTextOn]}>{g}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(i) => i.id}
        renderItem={renderRow}
        ListEmptyComponent={
          <Empty
            text={
              filter === 'open'
                ? 'No outstanding defects.'
                : 'Nothing rectified yet.'
            }
          />
        }
        contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
      />
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    filters: { flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.md, alignItems: 'center' },
    chip: {
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      borderRadius: SIZES.radiusRound,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.cardSolid,
    },
    chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: SIZES.small, fontWeight: '600', color: COLORS.text },
    chipTextOn: { color: COLORS.textWhite },

    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    agePill: {
      backgroundColor: COLORS.danger,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.md,
      paddingVertical: 3,
    },
    agePillText: { color: COLORS.textWhite, fontSize: SIZES.small, fontWeight: '700' },

    defect: { fontSize: SIZES.body, color: COLORS.text, paddingTop: SIZES.md },
    footer: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, paddingTop: SIZES.sm },
    footerText: { flex: 1, fontSize: SIZES.small, color: COLORS.textLight },
  });
