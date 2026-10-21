// ===================================
// One order group — a named collection of purchase orders for a charter,
// drydock, or any other event. Orders are not moved, just referenced.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle, StatusPill } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { roleAtLeast } from '../types/role';
import { OrderGroup, ORDER_DEPT_LABEL, ORDER_STATUS_COLOR, ORDER_STATUS_LABEL, OrderStatus } from '../types/orders';
import { completionPct, journalOrders } from '../services/orders';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import * as storage from '../services/storage';
import { t, useT } from '../utils/i18n';

export default function OrderGroupSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { purchaseOrders, orderGroups, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const paramId = route.params?.id as string;
  const isNew = paramId === 'new';
  const stored = orderGroups.find((g) => g.id === paramId);

  const [draft, setDraft] = useState<OrderGroup | null>(() => {
    if (!isNew) return null;
    return { id: uid('og'), name: '', orderIds: [], updatedAt: Date.now() };
  });
  const [addingOrders, setAddingOrders] = useState(false);

  const g = draft ?? stored;
  if (!g) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={{ color: COLORS.textLight, marginTop: SIZES.md }}>{t('og.notFound')}</Text>
      </Screen>
    );
  }

  const set = (patch: Partial<OrderGroup>) => {
    const base = draft ?? { ...g };
    setDraft({ ...base, ...patch, updatedAt: Date.now() });
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return Alert.alert(t('og.group'), t('og.needName'));
    await saveRow(storage.ORDER_GROUPS_KEY, { ...draft, name: draft.name.trim() });
    setDraft(null);
    playSuccessSound();
  };

  const deleteGroup = () =>
    Alert.alert(t('og.delete'), t('og.deleteBody'), [
      { text: t('cat.keep'), style: 'cancel' },
      {
        text: t('og.delete'),
        style: 'destructive',
        onPress: async () => {
          await saveRow(storage.ORDER_GROUPS_KEY, { ...g, deleted: true, updatedAt: Date.now() });
          goBackOr(nav);
        },
      },
    ]);

  const toggleOrder = (id: string) => {
    const ids = g.orderIds.includes(id) ? g.orderIds.filter((x) => x !== id) : [...g.orderIds, id];
    set({ orderIds: ids });
  };

  const groupOrders = journalOrders(purchaseOrders).filter((o) => g.orderIds.includes(o.id));
  const allOrders = journalOrders(purchaseOrders);

  const statusColor = (s: OrderStatus): string => {
    const c = ORDER_STATUS_COLOR[s];
    if (c === 'green') return COLORS.success;
    if (c === 'warn') return COLORS.warning;
    if (c === 'accent') return COLORS.primary;
    if (c === 'red') return COLORS.danger;
    return COLORS.textLight;
  };

  // Overall completion: sum of all lines in group
  const totalQty = groupOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + l.qty, 0), 0);
  const totalRecv = groupOrders.reduce((s, o) => s + o.lines.reduce((ls, l) => ls + Math.min(l.qtyReceived ?? 0, l.qty), 0), 0);
  const overallPct = totalQty > 0 ? Math.round((totalRecv / totalQty) * 100) : 0;

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={isNew ? t('og.new') : g.name || t('og.group')} subtitle={t('og.sub')} />

      <Card>
        <Label>{t('mt.namePh')}</Label>
        {officer || draft ? (
          <TextInput
            style={styles.input}
            value={(draft ?? g).name}
            onChangeText={(v) => set({ name: v })}
            placeholder={t('og.namePh')}
            placeholderTextColor={COLORS.textLight}
          />
        ) : (
          <Text style={styles.fieldVal}>{g.name}</Text>
        )}

        <Label style={{ marginTop: SIZES.sm }}>{t('nc.date')}</Label>
        {officer || draft ? (
          <SimpleDatePicker label={t('nc.date')} value={(draft ?? g).date ?? todayIso()} onChange={(v) => set({ date: v })} />
        ) : g.date ? (
          <Text style={styles.fieldVal}>{formatDate(g.date)}</Text>
        ) : null}

        {(officer || draft) ? (
          <>
            <Label style={{ marginTop: SIZES.sm }}>{t('og.notes')}</Label>
            <TextInput
              style={[styles.input, { minHeight: 56 }]}
              value={(draft ?? g).notes ?? ''}
              onChangeText={(v) => set({ notes: v })}
              placeholder={t('og.notesPh')}
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          </>
        ) : g.notes ? (
          <>
            <Label style={{ marginTop: SIZES.sm }}>{t('og.notes')}</Label>
            <Text style={styles.fieldVal}>{g.notes}</Text>
          </>
        ) : null}
      </Card>

      {/* Overall completion */}
      {groupOrders.length > 0 ? (
        <View style={{ marginBottom: SIZES.sm }}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${overallPct}%` as any, backgroundColor: overallPct === 100 ? COLORS.success : COLORS.warning }]} />
          </View>
          <Text style={styles.progressLabel}>{`${totalRecv} of ${totalQty} items received across ${groupOrders.length} order${groupOrders.length === 1 ? '' : 's'} (${overallPct}%)`}</Text>
        </View>
      ) : null}

      {/* Orders in this group */}
      <View style={styles.sectionHead}>
        <Label>{t('og.orders', { n: g.orderIds.length })}</Label>
        {officer ? (
          <TouchableOpacity onPress={() => setAddingOrders((x) => !x)} hitSlop={10}>
            <Text style={styles.addLink}>{addingOrders ? t('common.done') : t('og.addRemove')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {addingOrders ? (
        allOrders.length === 0 ? (
          <Empty text={t('og.noOrders')} />
        ) : (
          allOrders.map((o) => {
            const on = g.orderIds.includes(o.id);
            return (
              <TouchableOpacity key={o.id} style={[styles.pickRow, on && styles.pickRowOn]} onPress={() => toggleOrder(o.id)} activeOpacity={0.7}>
                <MciIcon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={on ? COLORS.primary : COLORS.textLight} />
                <View style={{ flex: 1, marginLeft: SIZES.sm }}>
                  <Text style={styles.poNo}>{o.no}</Text>
                  <Text style={styles.poSub}>{`${ORDER_DEPT_LABEL[o.dept]} · ${ORDER_STATUS_LABEL[o.status]} · ${o.lines.length} lines`}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )
      ) : groupOrders.length === 0 ? (
        <Empty text={t('og.tapAdd')} />
      ) : (
        groupOrders.map((o) => {
          const pct = completionPct(o);
          const barColor = o.status === 'received' ? COLORS.success : pct > 0 ? COLORS.warning : COLORS.border;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.row, { borderLeftColor: statusColor(o.status) }]}
              onPress={() => nav.navigate('Order', { id: o.id })}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.rowHead}>
                  <Text style={styles.poNo}>{o.no}</Text>
                  <View style={[styles.badge, { borderColor: statusColor(o.status) }]}>
                    <Text style={[styles.badgeText, { color: statusColor(o.status) }]}>{ORDER_STATUS_LABEL[o.status]}</Text>
                  </View>
                </View>
                <Text style={styles.poSub}>{ORDER_DEPT_LABEL[o.dept]}{o.supplier ? ` · ${o.supplier}` : ''}</Text>
                {(o.status === 'sent' || o.status === 'partial' || o.status === 'received') ? (
                  <View style={{ marginTop: 4 }}>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.poSub}>{`${pct}% received`}</Text>
                  </View>
                ) : null}
              </View>
              <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          );
        })
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {draft != null ? (
          <TouchableOpacity style={styles.btn} onPress={() => void save()}>
            <Text style={styles.btnText}>{isNew ? t('og.create') : t('og.saveChanges')}</Text>
          </TouchableOpacity>
        ) : officer ? (
          <>
            <TouchableOpacity style={styles.btn} onPress={() => set({ name: g.name })}>
              <Text style={styles.btnText}>{t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDanger} onPress={deleteGroup}>
              <Text style={styles.btnDangerText}>{t('og.delete')}</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    input: {
      ...COLORS.glassInput,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      fontSize: SIZES.body,
      color: COLORS.text,
      marginTop: SIZES.xs,
      textAlignVertical: 'top',
    },
    fieldVal: {
      fontSize: SIZES.body,
      color: COLORS.textDark,
      fontWeight: '600',
      marginTop: 4,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    addLink: {
      color: COLORS.primary,
      fontWeight: '700',
      fontSize: SIZES.body,
    },
    pickRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SIZES.sm,
      borderRadius: SIZES.radiusMd,
      marginBottom: SIZES.xs,
      backgroundColor: COLORS.card,
    },
    pickRowOn: {
      backgroundColor: COLORS.primary + '18',
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
    poSub: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 2,
    },
    badge: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    badgeText: {
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
    progressLabel: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 3,
    },
    actions: {
      gap: SIZES.sm,
      marginTop: SIZES.md,
    },
    btn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: 12,
      alignItems: 'center',
    },
    btnText: {
      color: COLORS.cardSolid,
      fontWeight: '700',
      fontSize: SIZES.body,
    },
    btnDanger: {
      borderRadius: SIZES.radiusMd,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    btnDangerText: {
      color: COLORS.danger,
      fontWeight: '600',
      fontSize: SIZES.body,
    },
  });
