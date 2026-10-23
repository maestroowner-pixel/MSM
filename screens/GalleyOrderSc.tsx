// ===================================
// Galley order — compact table with sticky column header and group sections.
// 900+ products: SectionList for virtualization.
// ===================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert, Platform, SectionList, SectionListData, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Label, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { useSigner } from '../components/SignerChoice';
import { SIZES, Palette } from '../theme';
import { roleAtLeast } from '../types/role';
import { GALLEY_GROUPS, GalleyGroup, GalleyLine, GalleyOrder } from '../types/galley';
import {
  GALLEY_ORDERS_KEY, emptyGalleyLine, exportGalleyXlsx, galleyTotal,
  groupLines, importGalleyXlsx, importGalleyXlsxAI, nextGalleyNo,
} from '../services/galley';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, useT } from '../utils/i18n';

// Column widths — tight but readable
const W = { pack: 62, stock: 46, order: 46, price: 58 };

const STATUS_COLOR: Record<GalleyOrder['status'], string> = {
  draft: 'muted', sent: 'accent', received: 'green', cancelled: 'red',
} as any;

function emptyOrder(no: string, by: string, date: string): GalleyOrder {
  return {
    id: uid('go'), no, date, by, status: 'draft',
    lines: [], at: Date.now(), updatedAt: Date.now(),
  };
}

export default function GalleyOrderSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { galleyOrders, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const { signer } = useSigner();
  const insets = useSafeAreaInsets();
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const paramId = route.params?.id as string;
  const id = savedId ?? paramId;
  const isNew = paramId === 'new';
  const stored = (galleyOrders ?? []).find((o) => o.id === id);

  const [draft, setDraft] = useState<GalleyOrder | null>(() => {
    if (!isNew) return null;
    return emptyOrder(
      nextGalleyNo(galleyOrders ?? []),
      signer?.name ?? '',
      today,
    );
  });

  const o = draft ?? stored;
  const editable = draft != null || (o != null && (o.status === 'draft' || o.status === 'sent'));

  // Inline-edited cell: 'stock:lineId' | 'order:lineId' | 'price:lineId' | null
  const [activeCell, setActiveCell] = useState<string | null>(null);
  // Pending text for the active cell (before commit)
  const [cellText, setCellText] = useState('');
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);

  const set = (patch: Partial<GalleyOrder>) => {
    const base = draft ?? { ...o! };
    setDraft({ ...base, ...patch, updatedAt: Date.now() });
  };

  const setLine = (lineId: string, patch: Partial<GalleyLine>) =>
    set({ lines: (draft ?? o)!.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) });

  const removeLine = (lineId: string) =>
    set({ lines: (draft ?? o)!.lines.filter((l) => l.id !== lineId) });

  const addLineToGroup = (group: string) => {
    const line = emptyGalleyLine(group as GalleyGroup);
    set({ lines: [...(draft ?? o)!.lines, line] });
  };

  const startEdit = (key: string, val: number | undefined) => {
    setActiveCell(key);
    setCellText(val != null && val !== 0 ? String(val) : '');
  };

  const commitCell = (key: string, text: string) => {
    const [field, lineId] = key.split(':');
    const num = text.trim() ? Number(text.replace(',', '.')) : (field === 'price' ? undefined : 0);
    if (field === 'stock') setLine(lineId, { stock: Number.isFinite(num as number) ? (num as number) : 0 });
    else if (field === 'order') setLine(lineId, { orderQty: Number.isFinite(num as number) ? (num as number) : 0 });
    else if (field === 'price') setLine(lineId, { price: num !== undefined && Number.isFinite(num as number) ? (num as number) : undefined });
    setActiveCell(null);
  };

  const save = async () => {
    if (!draft) return;
    const toSave: GalleyOrder = { ...draft, by: signer?.name ?? draft.by, updatedAt: Date.now() };
    await saveRow(GALLEY_ORDERS_KEY, toSave);
    setSavedId(toSave.id);
    setDraft(null);
    playSuccessSound();
  };

  const changeStatus = async (s: GalleyOrder['status']) => {
    if (!o || s === o.status) return;
    if (s === 'cancelled') {
      Alert.alert(t('go.cancelQ'), t('go.cancelBody'), [
        { text: t('cat.keep'), style: 'cancel' },
        { text: t('common.cancel'), style: 'destructive', onPress: async () => {
          await saveRow(GALLEY_ORDERS_KEY, { ...o, status: 'cancelled', cancelledAt: today, updatedAt: Date.now() });
          goBackOr(nav, 'Main', { screen: 'Orders' });
        }},
      ]);
      return;
    }
    const patch: Partial<GalleyOrder> = { status: s };
    if (s === 'sent' && !o.sentAt) { patch.sentAt = today; patch.sentBy = signer?.name ?? ''; }
    if (s === 'received') { patch.receivedAt = today; patch.receivedBy = signer?.name ?? ''; }
    await saveRow(GALLEY_ORDERS_KEY, { ...o, ...patch, updatedAt: Date.now() });
    playSuccessSound();
  };

  const aiEnabled = moduleOn('ai') && sync.enrolled;

  const doImport = async () => {
    try {
      setImporting(true);
      const picker = await import('expo-document-picker');
      const result = await picker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const uri = result.assets[0].uri;

      const { lines, warnings, groupCount } = aiEnabled
        ? await importGalleyXlsxAI(uri)
        : { ...(await importGalleyXlsx(uri)), groupCount: 0 };

      if (!lines.length) {
        Alert.alert(t('pax.import'), warnings.join('\n') || t('go.noProducts'));
        return;
      }

      const warnMsg = warnings.length ? `\n\n${warnings.join('\n')}` : '';
      const countMsg = aiEnabled && groupCount > 0
        ? t('go.foundGroups', { n: lines.length, g: groupCount })
        : t('go.found', { n: lines.length });

      Alert.alert(
        t('go.importQ'),
        `${countMsg}${warnMsg}\n\n${t('go.addToOrder')}`,
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.add'),
            onPress: () => {
              const base = draft ?? { ...o! };
              setDraft({ ...base, lines: [...base.lines, ...lines], updatedAt: Date.now() });
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert(t('go.importError'), e.message ?? t('go.couldNotRead'));
    } finally {
      setImporting(false);
    }
  };

  if (!o) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <BackButton onPress={() => goBackOr(nav, 'Main', { screen: 'Orders' })} />
        <Text style={{ color: COLORS.textLight, margin: SIZES.md }}>{t('go.notFound')}</Text>
      </View>
    );
  }

  const currency = o.lines.find((l) => l.currency)?.currency ?? '€';
  const total = galleyTotal(o);

  // Build sections — filtered by search
  const q = search.trim().toLowerCase();
  const allGrouped = groupLines((draft ?? o).lines);
  const sections = allGrouped
    .map(({ group, lines }) => ({
      title: group,
      data: q ? lines.filter((l) =>
        l.name.toLowerCase().includes(q) ||
        (l.pack ?? '').toLowerCase().includes(q)
      ) : lines,
    }))
    .filter((s) => s.data.length > 0);

  const renderItem = ({ item: l }: { item: GalleyLine }) => {
    const isStockActive = activeCell === `stock:${l.id}`;
    const isOrderActive = activeCell === `order:${l.id}`;
    const isPriceActive = activeCell === `price:${l.id}`;
    const lineTotal = l.price && l.orderQty > 0 ? l.orderQty * l.price : null;

    return (
      <View style={styles.row}>
        <Text style={styles.cellName} numberOfLines={1}>{l.name || <Text style={{ color: COLORS.textLight }}>—</Text>}</Text>
        <Text style={styles.cellPack} numberOfLines={1}>{l.pack ?? ''}</Text>

        {/* Stock */}
        {editable ? (
          isStockActive ? (
            <TextInput
              style={[styles.cellInput, styles.cellStock]}
              value={cellText}
              onChangeText={setCellText}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
              onBlur={() => commitCell(`stock:${l.id}`, cellText)}
              onSubmitEditing={() => commitCell(`stock:${l.id}`, cellText)}
            />
          ) : (
            <TouchableOpacity style={[styles.cellTap, styles.cellStock]} onPress={() => startEdit(`stock:${l.id}`, l.stock)} activeOpacity={0.7}>
              <Text style={[styles.cellNum, l.stock === 0 && styles.cellZero]}>{l.stock || '0'}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={[styles.cellNum, styles.cellStock, l.stock === 0 && styles.cellZero]}>{l.stock || '0'}</Text>
        )}

        {/* Order qty */}
        {editable ? (
          isOrderActive ? (
            <TextInput
              style={[styles.cellInput, styles.cellOrder, l.orderQty > 0 && styles.cellOrderActive]}
              value={cellText}
              onChangeText={setCellText}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
              onBlur={() => commitCell(`order:${l.id}`, cellText)}
              onSubmitEditing={() => commitCell(`order:${l.id}`, cellText)}
            />
          ) : (
            <TouchableOpacity style={[styles.cellTap, styles.cellOrder, l.orderQty > 0 && styles.cellOrderActive]} onPress={() => startEdit(`order:${l.id}`, l.orderQty)} activeOpacity={0.7}>
              <Text style={[styles.cellNum, l.orderQty > 0 && { color: COLORS.primary, fontWeight: '700' }]}>{l.orderQty || '—'}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={[styles.cellNum, styles.cellOrder, l.orderQty > 0 && { color: COLORS.primary, fontWeight: '700' }]}>{l.orderQty || '—'}</Text>
        )}

        {/* Price */}
        {editable ? (
          isPriceActive ? (
            <TextInput
              style={[styles.cellInput, styles.cellPrice]}
              value={cellText}
              onChangeText={setCellText}
              keyboardType="numeric"
              autoFocus
              selectTextOnFocus
              onBlur={() => commitCell(`price:${l.id}`, cellText)}
              onSubmitEditing={() => commitCell(`price:${l.id}`, cellText)}
            />
          ) : (
            <TouchableOpacity style={[styles.cellTap, styles.cellPrice]} onPress={() => startEdit(`price:${l.id}`, l.price)} activeOpacity={0.7}>
              <Text style={[styles.cellNum, !l.price && styles.cellZero]}>{l.price != null ? l.price.toFixed(2) : '—'}</Text>
            </TouchableOpacity>
          )
        ) : (
          <Text style={[styles.cellNum, styles.cellPrice, !l.price && styles.cellZero]}>{l.price != null ? l.price.toFixed(2) : '—'}</Text>
        )}

        {/* Line total */}
        <Text style={[styles.cellTotal, lineTotal == null && styles.cellZero]}>
          {lineTotal != null ? lineTotal.toFixed(2) : ''}
        </Text>

        {editable ? (
          <TouchableOpacity onPress={() => removeLine(l.id)} hitSlop={8} style={styles.removeBtn}>
            <MciIcon name="close" size={14} color={COLORS.danger} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const renderSectionHeader = ({ section }: { section: SectionListData<GalleyLine, { title: string }> }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length} items</Text>
      {editable && !q ? (
        <TouchableOpacity onPress={() => addLineToGroup(section.title)} hitSlop={8} style={{ marginLeft: SIZES.xs }}>
          <Text style={styles.addGroupBtn}>{`+ ${t('common.add')}`}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const colHeader = (
    <View style={styles.colHeader}>
      <Text style={[styles.colLabel, { flex: 1 }]}>{t('go.product')}</Text>
      <Text style={[styles.colLabel, { width: W.pack }]}>{t('go.pack')}</Text>
      <Text style={[styles.colLabel, { width: W.stock }, { textAlign: 'center' }]}>{t('go.stk')}</Text>
      <Text style={[styles.colLabel, { width: W.order }, { textAlign: 'center' }]}>{t('go.ord')}</Text>
      <Text style={[styles.colLabel, { width: W.price }, { textAlign: 'right' }]}>{currency}</Text>
      <Text style={[styles.colLabel, styles.colTotal]}>{t('go.total')}</Text>
      <View style={{ width: 22 }} />
    </View>
  );

  const listHeader = (
    <View>
      {/* Back + title */}
      <View style={styles.headerBar}>
        <BackButton onPress={() => goBackOr(nav, 'Main', { screen: 'Orders' })} />
        <View style={{ flex: 1, marginLeft: SIZES.sm }}>
          <Text style={styles.orderNo}>{o.no}</Text>
          <Text style={styles.orderMeta}>{`${uiDate(o.date)} · ${(draft ?? o).lines.length} items`}</Text>
        </View>
        {/* Grand total */}
        {total > 0 ? (
          <View style={styles.totalBadge}>
            <Text style={styles.totalLabel}>{t('go.total')}</Text>
            <Text style={styles.totalValue}>{`${currency} ${total.toFixed(2)}`}</Text>
          </View>
        ) : null}
      </View>

      {/* Status chips */}
      {!isNew ? (
        <View style={styles.statusRow}>
          {(['draft', 'sent', 'received', 'cancelled'] as GalleyOrder['status'][]).map((s) => {
            const active = o.status === s;
            const color = s === 'received' ? COLORS.success : s === 'sent' ? COLORS.primary : s === 'cancelled' ? COLORS.danger : COLORS.textLight;
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => { if (officer) void changeStatus(s); }}
                activeOpacity={officer ? 0.7 : 1}
              >
                <Text style={[styles.statusChipText, { color: active ? COLORS.cardSolid : color }]}>
                  {tk(`go.st.${s}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {/* Search */}
      <View style={styles.searchRow}>
        <MciIcon name="magnify" size={16} color={COLORS.textLight} style={{ marginRight: 6 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('go.searchPh')}
          placeholderTextColor={COLORS.textLight}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {editable ? (
          <TouchableOpacity
            style={styles.addGroupPick}
            onPress={() => {
              Alert.alert(
                t('go.addToGroup'),
                '',
                GALLEY_GROUPS.map((g) => ({ text: g, onPress: () => addLineToGroup(g) })).concat([{ text: t('common.cancel'), style: 'cancel' } as any]),
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.addGroupPickText}>{`+ ${t('go.product')}`}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  const listFooter = (
    <View style={{ paddingBottom: insets.bottom + SIZES.xl }}>
      {/* Action buttons */}
      <View style={styles.actions}>
        {draft != null ? (
          <TouchableOpacity style={styles.btn} onPress={() => void save()}>
            <Text style={styles.btnText}>{t('go.save')}</Text>
          </TouchableOpacity>
        ) : null}

        {!draft && !isNew ? (
          <TouchableOpacity style={styles.btnOutline} onPress={() => void exportGalleyXlsx(o)}>
            <Text style={styles.btnOutlineText}>{t('rep.exportXlsx')}</Text>
          </TouchableOpacity>
        ) : null}

        {editable && !isNew ? (
          <TouchableOpacity style={styles.btnOutline} onPress={() => void doImport()} disabled={importing}>
            <Text style={styles.btnOutlineText}>
              {importing ? t('go.importing') : aiEnabled ? t('go.aiImport') : t('go.importXlsx')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {!isNew && !draft && officer ? (
          <TouchableOpacity
            style={styles.btnDelete}
            onPress={() =>
              Alert.alert(t('common.delete'), t('go.deleteBody', { no: o.no }), [
                { text: t('cat.keep'), style: 'cancel' },
                { text: t('common.delete'), style: 'destructive', onPress: async () => {
                  await saveRow(GALLEY_ORDERS_KEY, { ...o, deleted: true, updatedAt: Date.now() });
                  goBackOr(nav, 'Main', { screen: 'Orders' });
                }},
              ])
            }
          >
            <Text style={styles.btnDeleteText}>{t('go.delete')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Audit trail */}
      {o.sentAt ? <Text style={styles.trail}>{t('galley.sent', { date: uiDate(o.sentAt) })}</Text> : null}
      {o.receivedAt ? <Text style={styles.trail}>{t('go.received', { date: uiDate(o.receivedAt) })}</Text> : null}
      {o.cancelledAt ? <Text style={styles.trail}>{t('galley.cancelled', { date: uiDate(o.cancelledAt) })}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Fixed column header bar — sits above the list */}
      {colHeader}
      <SectionList
        sections={sections}
        keyExtractor={(l) => l.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        stickySectionHeadersEnabled
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: SIZES.md }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', paddingVertical: SIZES.xl }}>
            <Text style={{ color: COLORS.textLight }}>
              {search ? t('go.noMatch') : t('go.empty')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: SIZES.sm,
      paddingBottom: SIZES.xs,
    },
    orderNo: {
      fontSize: SIZES.body,
      fontWeight: '700',
      color: COLORS.textDark,
    },
    orderMeta: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 1,
    },
    totalBadge: {
      alignItems: 'flex-end',
      marginLeft: SIZES.sm,
    },
    totalLabel: {
      fontSize: 10,
      color: COLORS.textLight,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    totalValue: {
      fontSize: SIZES.body,
      fontWeight: '800',
      color: COLORS.success,
    },
    statusRow: {
      flexDirection: 'row',
      gap: SIZES.xs,
      paddingBottom: SIZES.sm,
    },
    statusChip: {
      borderWidth: 1.5,
      borderRadius: 999,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 4,
      borderColor: COLORS.border,
    },
    statusChipText: {
      fontSize: 11,
      fontWeight: '700',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SIZES.xs,
      gap: SIZES.xs,
    },
    searchInput: {
      flex: 1,
      ...COLORS.glassInput,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 7,
      fontSize: SIZES.small,
      color: COLORS.text,
    },
    addGroupPick: {
      paddingHorizontal: SIZES.sm,
      paddingVertical: 7,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
    },
    addGroupPickText: {
      color: COLORS.cardSolid,
      fontWeight: '700',
      fontSize: SIZES.small,
    },
    // Column header
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.md,
      paddingVertical: 6,
      backgroundColor: COLORS.background,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    colLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: COLORS.textLight,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    colTotal: {
      width: 60,
      textAlign: 'right',
    },
    // Section header
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingHorizontal: 2,
      backgroundColor: COLORS.background,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      marginTop: SIZES.sm,
    },
    sectionTitle: {
      flex: 1,
      fontSize: SIZES.small,
      fontWeight: '800',
      color: COLORS.textDark,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    sectionCount: {
      fontSize: 11,
      color: COLORS.textLight,
    },
    addGroupBtn: {
      fontSize: 11,
      fontWeight: '700',
      color: COLORS.primary,
    },
    // Data row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 7,
      minHeight: 38,
    },
    divider: {
      height: 1,
      backgroundColor: COLORS.border,
      opacity: 0.5,
    },
    cellName: {
      flex: 1,
      fontSize: 13,
      color: COLORS.text,
      paddingRight: 4,
    },
    cellPack: {
      width: W.pack,
      fontSize: 11,
      color: COLORS.textLight,
      paddingRight: 4,
    },
    cellNum: {
      fontSize: 13,
      color: COLORS.text,
      textAlign: 'center',
    },
    cellZero: {
      color: COLORS.textLight,
    },
    cellStock: {
      width: W.stock,
      textAlign: 'center',
    },
    cellOrder: {
      width: W.order,
      textAlign: 'center',
      borderRadius: 4,
    },
    cellOrderActive: {
      backgroundColor: COLORS.primary + '18',
    },
    cellPrice: {
      width: W.price,
      textAlign: 'right',
    },
    cellTotal: {
      width: 60,
      fontSize: 12,
      fontWeight: '600',
      color: COLORS.success,
      textAlign: 'right',
    },
    cellTap: {
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 30,
      borderRadius: 4,
    },
    cellInput: {
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 3,
      fontSize: 13,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      textAlign: 'center',
    },
    removeBtn: {
      width: 22,
      alignItems: 'center',
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
    btnOutline: {
      borderRadius: SIZES.radiusMd,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    btnOutlineText: {
      color: COLORS.textDark,
      fontWeight: '600',
      fontSize: SIZES.body,
    },
    btnDelete: {
      borderRadius: SIZES.radiusMd,
      paddingVertical: 12,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.danger,
    },
    btnDeleteText: {
      color: COLORS.danger,
      fontWeight: '600',
      fontSize: SIZES.body,
    },
    trail: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 4,
    },
  });
