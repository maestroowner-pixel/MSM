// ===================================
// Galley orders — journal / list screen.
// Separate from department orders: shows galley requisitions only.
// ===================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Empty, Label, Screen, ScreenTitle, StatusPill } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { roleAtLeast } from '../types/role';
import { GalleyOrder } from '../types/galley';
import { galleyTotal } from '../services/galley';
import { formatDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';

export default function GalleyOrdersSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { galleyOrders } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const list = useMemo(
    () => (galleyOrders ?? []).filter((o) => !o.deleted).sort((a, b) => b.at - a.at),
    [galleyOrders],
  );

  const statusColor = (s: GalleyOrder['status']) => {
    if (s === 'received') return COLORS.success;
    if (s === 'sent') return COLORS.primary;
    if (s === 'cancelled') return COLORS.danger;
    return COLORS.textLight;
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Main', { screen: 'Orders' })} />
      <ScreenTitle title="Galley orders" subtitle="Food & beverage requisitions" />

      {officer ? (
        <View style={styles.addRow}>
          <Label>All orders</Label>
          <TouchableOpacity onPress={() => nav.navigate('GalleyOrder', { id: 'new' })} hitSlop={10}>
            <Text style={styles.addBtn}>+ New order</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Label>All orders</Label>
      )}

      {list.length === 0 ? (
        <Empty text={'No galley orders yet. Tap "+ New order" to create the first one.'} />
      ) : (
        list.map((o) => {
          const total = galleyTotal(o);
          const currency = o.lines.find((l) => l.currency)?.currency ?? '€';
          const color = statusColor(o.status);
          // Timeline for closed orders
          const timeline: string[] = [];
          if (o.sentAt) timeline.push(`Sent ${formatDate(o.sentAt)}`);
          if (o.receivedAt) timeline.push(`Rcvd ${formatDate(o.receivedAt)}`);
          if (o.cancelledAt) timeline.push(`Cancelled ${formatDate(o.cancelledAt)}`);

          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.row, { borderLeftColor: color }]}
              onPress={() => nav.navigate('GalleyOrder', { id: o.id })}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.rowHead}>
                  <Text style={styles.poNo}>{o.no}</Text>
                  <View style={[styles.statusBadge, { borderColor: color }]}>
                    <Text style={[styles.statusText, { color }]}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </Text>
                  </View>
                  {total > 0 ? (
                    <Text style={styles.totalVal}>{`${currency} ${total.toFixed(2)}`}</Text>
                  ) : null}
                </View>
                <Text style={styles.sub}>{`${o.lines.length} items · ${formatDate(o.date)}`}</Text>
                {timeline.length > 0 ? (
                  <Text style={styles.timeline}>{timeline.join(' → ')}</Text>
                ) : null}
              </View>
              <Text style={{ color: COLORS.textLight, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          );
        })
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    addBtn: {
      color: COLORS.primary,
      fontWeight: '700',
      fontSize: SIZES.body,
    },
    row: {
      ...COLORS.glassCard,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginBottom: SIZES.xs,
      borderLeftWidth: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
    },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      flexWrap: 'wrap',
    },
    poNo: {
      fontSize: SIZES.body,
      fontWeight: '700',
      color: COLORS.textDark,
    },
    statusBadge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    totalVal: {
      marginLeft: 'auto' as any,
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.success,
    },
    sub: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 2,
    },
    timeline: {
      fontSize: 11,
      color: COLORS.textLight,
      fontStyle: 'italic',
      marginTop: 3,
    },
  });
