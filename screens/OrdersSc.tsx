// ===================================
// Purchase orders — department folders and the requisition register.
//
// Five departments — Bridge, Engine, Deck, Accommodation, Galley — each shown
// as a tile with the count of open orders. Tapping one filters the list below.
// "All" shows every order: the journal/register view. A new order is a modal
// (OrderSc). An order is editable until received or cancelled.
// ===================================

import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle, StatusPill } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { roleAtLeast } from '../types/role';
import {
  ORDER_DEPT_ICON, ORDER_DEPT_LABEL, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL,
  OrderDept, OrderStatus, PurchaseOrder,
} from '../types/orders';
import { completionPct, journalOrders, ordersForDept } from '../services/orders';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { OrderGroup } from '../types/orders';
import { todayIso } from '../services/pms';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { t, tk, tn, useT } from '../utils/i18n';

const DEPTS: OrderDept[] = ['bridge', 'engine', 'deck', 'accommodation', 'medical'];

export default function OrdersSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { purchaseOrders, orderGroups } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const [dept, setDept] = useState<OrderDept | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  type SortMode = 'date-desc' | 'date-asc' | 'pct-asc' | 'pct-desc';
  const SORT_CYCLE: SortMode[] = ['date-desc', 'date-asc', 'pct-asc', 'pct-desc'];
  const SORT_LABEL: Record<SortMode, string> = {
    'date-desc': `${t('nc.date')} ↓`, 'date-asc': `${t('nc.date')} ↑`, 'pct-asc': '% ↑', 'pct-desc': '% ↓',
  };
  const [sort, setSort] = useState<SortMode>('date-desc');
  const cycleSort = () => setSort((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length]);

  const journal = useMemo(() => journalOrders(purchaseOrders), [purchaseOrders]);

  const visible = useMemo(() => {
    let list = dept === 'all' ? journal.filter((o) => DEPTS.includes(o.dept)) : journal.filter((o) => o.dept === dept);
    const q = searchQ.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        o.no.toLowerCase().includes(q) ||
        (o.supplier ?? '').toLowerCase().includes(q) ||
        o.lines.some((l) => l.description.toLowerCase().includes(q) || (l.impa ?? '').includes(q))
      );
    }
    if (filterFrom) list = list.filter((o) => o.date >= filterFrom);
    if (filterTo)   list = list.filter((o) => o.date <= filterTo);
    if (sort === 'date-desc') list = [...list].sort((a, b) => b.date.localeCompare(a.date));
    if (sort === 'date-asc')  list = [...list].sort((a, b) => a.date.localeCompare(b.date));
    if (sort === 'pct-asc')   list = [...list].sort((a, b) => completionPct(a) - completionPct(b));
    if (sort === 'pct-desc')  list = [...list].sort((a, b) => completionPct(b) - completionPct(a));
    return list;
  }, [journal, dept, searchQ, filterFrom, filterTo, sort]);

  const statusColor = (s: OrderStatus): string => {
    const c = ORDER_STATUS_COLOR[s];
    if (c === 'green') return COLORS.success;
    if (c === 'warn') return COLORS.warning;
    if (c === 'accent') return COLORS.primary;
    if (c === 'red') return COLORS.danger;
    return COLORS.textLight;
  };

  const newOrder = () =>
    nav.navigate('Order', { id: 'new', dept: dept === 'all' ? 'engine' : dept });

  return (
    <Screen scroll>
      <ScreenTitle title={t('ord.title')} subtitle={t('ord.sub')} />

      {/* Department tiles */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptRow}>
        <TouchableOpacity
          style={[styles.deptTile, dept === 'all' && styles.deptTileOn]}
          onPress={() => setDept('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.deptCount, dept === 'all' && styles.deptCountOn]}>{journal.filter((o) => DEPTS.includes(o.dept)).length}</Text>
          <Text style={[styles.deptLabel, dept === 'all' && styles.deptLabelOn]}>{t('lb.all')}</Text>
        </TouchableOpacity>
        {DEPTS.map((d) => {
          const cnt = ordersForDept(purchaseOrders, d).length;
          const on = dept === d;
          if (d === 'galley') {
            return (
              <TouchableOpacity
                key={d}
                style={styles.deptTile}
                onPress={() => nav.navigate('GalleyOrders')}
                activeOpacity={0.7}
              >
                <MciIcon name={ORDER_DEPT_ICON[d]} size={20} color={COLORS.primary} style={{ marginBottom: 4 }} />
                <Text style={styles.deptCount}>{cnt}</Text>
                <Text style={[styles.deptLabel, { color: COLORS.primary }]}>{tk(`od.${d}`)}</Text>
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              key={d}
              style={[styles.deptTile, on && styles.deptTileOn]}
              onPress={() => setDept(d)}
              activeOpacity={0.7}
            >
              <MciIcon name={ORDER_DEPT_ICON[d]} size={20} color={on ? COLORS.cardSolid : COLORS.primary} style={{ marginBottom: 4 }} />
              <Text style={[styles.deptCount, on && styles.deptCountOn]}>{cnt}</Text>
              <Text style={[styles.deptLabel, on && styles.deptLabelOn]}>{tk(`od.${d}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Groups */}
      <View style={styles.addRow}>
        <Label>{t('ord.groups')}</Label>
        {officer ? (
          <TouchableOpacity onPress={() => nav.navigate('OrderGroup', { id: 'new' })} hitSlop={10}>
            <Text style={styles.addBtn}>{`+ ${t('og.new')}`}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {orderGroups.length === 0 ? (
        <Text style={styles.emptyGroups}>{t('ord.groupsHint')}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', gap: SIZES.sm, paddingBottom: SIZES.sm }}>
          {orderGroups.map((grp) => {
            const grpOrders = purchaseOrders.filter((o) => grp.orderIds.includes(o.id));
            const totalQty = grpOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.qty, 0), 0);
            const totalRecv = grpOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + Math.min(l.qtyReceived ?? 0, l.qty), 0), 0);
            const pct = totalQty > 0 ? Math.round((totalRecv / totalQty) * 100) : 0;
            return (
              <TouchableOpacity key={grp.id} style={styles.groupCard} onPress={() => nav.navigate('OrderGroup', { id: grp.id })} activeOpacity={0.7}>
                <Text style={styles.groupName} numberOfLines={2}>{grp.name}</Text>
                <Text style={styles.groupSub}>{tn('n.order', grpOrders.length)}</Text>
                <View style={[styles.progressTrack, { marginTop: 6 }]}>
                  <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? COLORS.success : pct > 0 ? COLORS.warning : COLORS.border }]} />
                </View>
                <Text style={styles.groupPct}>{`${pct}%`}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Search + From + To + sort — one row */}
      <View style={styles.filterRow}>
        <TextInput
          style={styles.searchInput}
          value={searchQ}
          onChangeText={setSearchQ}
          placeholder={t('ord.searchPh')}
          placeholderTextColor={COLORS.textLight}
          returnKeyType="search"
        />
        <View style={styles.filterDate}>
          <SimpleDatePicker label="" showLabel={false} compact value={filterFrom} onChange={setFilterFrom} onClear={() => setFilterFrom('')} placeholder={`${t('common.from')}…`} />
        </View>
        <View style={styles.filterDate}>
          <SimpleDatePicker label="" showLabel={false} compact value={filterTo} onChange={setFilterTo} onClear={() => setFilterTo('')} placeholder={`${t('common.to')}…`} />
        </View>
        <TouchableOpacity style={styles.sortBtn} onPress={cycleSort} activeOpacity={0.7}>
          <MciIcon name="sort" size={14} color={COLORS.primary} />
          <Text style={styles.sortBtnText}>{SORT_LABEL[sort]}</Text>
        </TouchableOpacity>
      </View>

      {/* New order button */}
      {officer ? (
        <View style={styles.addRow}>
          <Label>{dept === 'all' ? t('galley.all') : t('ord.deptOrders', { dept: tk(`od.${dept}`) })}</Label>
          <TouchableOpacity onPress={newOrder} hitSlop={10}>
            <Text style={styles.addBtn}>{t('galley.new')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Label>{dept === 'all' ? t('galley.all') : t('ord.deptOrders', { dept: tk(`od.${dept}`) })}</Label>
      )}

      {/* Order list */}
      {visible.length === 0 ? (
        <Empty text={dept === 'all' ? t('ord.empty') : t('ord.emptyDept', { dept: tk(`od.${dept}`).toLowerCase() })} />
      ) : (
        visible.map((o) => (
          <TouchableOpacity
            key={o.id}
            style={[styles.row, { borderLeftColor: statusColor(o.status) }]}
            onPress={() => nav.navigate('Order', { id: o.id })}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.rowHead}>
                <Text style={styles.poNo}>{o.no}</Text>
                <View style={[styles.statusBadge, { borderColor: statusColor(o.status) }]}>
                  <Text style={[styles.statusText, { color: statusColor(o.status) }]}>{ORDER_STATUS_LABEL[o.status]}</Text>
                </View>
              </View>
              <Text style={styles.deptTag}>{ORDER_DEPT_LABEL[o.dept]}</Text>
              {o.supplier ? <Text style={styles.sub} numberOfLines={1}>{o.supplier}</Text> : null}
              <Text style={styles.sub}>{`${o.lines.length} line${o.lines.length === 1 ? '' : 's'} · ${uiDate(o.date)}`}</Text>
              {/* Chronology for closed orders */}
              {(o.status === 'received' || o.status === 'cancelled') ? (() => {
                const steps: string[] = [];
                if (o.sentAt) steps.push(t('galley.sent', { date: uiDate(o.sentAt) }));
                if (o.deliveries && o.deliveries.length > 0 && o.status === 'received') {
                  const firstPartial = o.deliveries[0];
                  if (firstPartial) steps.push(t('ord.part', { date: uiDate(firstPartial.date) }));
                }
                if (o.receivedAt) steps.push(t('galley.rcvd', { date: uiDate(o.receivedAt) }));
                if (o.cancelledAt) steps.push(t('galley.cancelled', { date: uiDate(o.cancelledAt) }));
                if (!steps.length) return null;
                return (
                  <Text style={styles.timeline} numberOfLines={2}>{steps.join(' → ')}</Text>
                );
              })() : null}
              {(o.status === 'sent' || o.status === 'partial' || o.status === 'received') ? (() => {
                const pct = completionPct(o);
                const doneLines = o.lines.filter((l) => (l.qtyReceived ?? 0) >= l.qty).length;
                const barColor = o.status === 'received' ? COLORS.success : pct > 0 ? COLORS.warning : COLORS.border;
                const hasAnyReceived = o.lines.some((l) => (l.qtyReceived ?? 0) > 0);
                return (
                  <View style={{ marginTop: 6 }}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[styles.sub, { marginTop: 2 }]}>{`${doneLines} of ${o.lines.length} line${o.lines.length === 1 ? '' : 's'} received (${pct}%)`}</Text>
                    {hasAnyReceived ? o.lines.map((l) => {
                      const r = l.qtyReceived ?? 0;
                      if (r === 0 && o.status !== 'received') return null;
                      const done = r >= l.qty;
                      return (
                        <View key={l.id} style={styles.lineQtyRow}>
                          <Text style={styles.lineQtyName} numberOfLines={1}>{l.description}</Text>
                          <Text style={[styles.lineQtyVal, { color: done ? COLORS.success : COLORS.warning }]}>
                            {done ? `✓ ${r}` : `${r} / ${l.qty}`} {l.unit}
                          </Text>
                        </View>
                      );
                    }) : null}
                  </View>
                );
              })() : null}
            </View>
            <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        ))
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    deptRow: {
      flexDirection: 'row',
      gap: SIZES.sm,
      paddingBottom: SIZES.sm,
      paddingTop: 4,
    },
    deptTile: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SIZES.sm,
      minWidth: 80,
      minHeight: 80,
    },
    deptTileOn: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    deptCount: {
      fontSize: 22,
      fontWeight: '700',
      color: COLORS.textDark,
      textAlign: 'center',
    },
    deptCountOn: {
      color: COLORS.cardSolid,
    },
    deptLabel: {
      fontSize: SIZES.small,
      color: COLORS.textDark,
      fontWeight: '600',
      marginTop: 2,
      textAlign: 'center',
    },
    deptLabelOn: {
      color: COLORS.cardSolid,
    },
    filterRow: {
      flexDirection: 'row',
      gap: SIZES.sm,
      marginTop: SIZES.sm,
      alignItems: 'center',
    },
    searchInput: {
      ...COLORS.glassInput,
      flex: 2,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: 8,
      fontSize: SIZES.body,
      color: COLORS.text,
    },
    filterDate: {
      flex: 1,
    },
    sortBtn: {
      ...COLORS.glassInput,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 8,
    },
    sortBtnText: {
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.primary,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SIZES.sm,
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
    deptTag: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      fontWeight: '600',
      marginTop: 1,
    },
    sub: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 2,
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
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: COLORS.border,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      borderRadius: 2,
    },
    lineQtyRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 3,
      gap: SIZES.sm,
    },
    lineQtyName: {
      flex: 1,
      fontSize: 11,
      color: COLORS.textLight,
    },
    lineQtyVal: {
      fontSize: 11,
      fontWeight: '700',
    },
    timeline: {
      fontSize: 11,
      color: COLORS.textLight,
      marginTop: 4,
      fontStyle: 'italic',
    },
    emptyGroups: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginBottom: SIZES.sm,
    },
    groupCard: {
      backgroundColor: COLORS.card,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SIZES.sm,
      width: 140,
    },
    groupName: {
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.textDark,
    },
    groupSub: {
      fontSize: 11,
      color: COLORS.textLight,
      marginTop: 2,
    },
    groupPct: {
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.primary,
      marginTop: 2,
    },
  });
