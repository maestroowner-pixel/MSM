// ===================================
// One purchase order — new or existing.
//
// Workflow: an officer raises a draft (department + lines), marks it sent to
// the supplier, then confirms receipt line by line (full or short delivery).
// A received or cancelled order is read-only. A draft or sent order can still
// be edited: add lines, update supplier, adjust quantities before it is ordered.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { useSigner } from '../components/SignerChoice';
import { SIZES, Palette } from '../theme';
import { roleAtLeast } from '../types/role';
import {
  Delivery, ORDER_DEPTS, ORDER_STATUS_COLOR,
  OrderDept, OrderLine, OrderStatus, PurchaseOrder,
} from '../types/orders';
import { allReceived, completionPct, copyOrder, derivedStatus, lineCount, nextOrderNo, orderValue, priceStr, lineTotalStr } from '../services/orders';
import { exportOrderPdf, printBoxQrLabel } from '../services/orderSheet';
import { todayIso } from '../services/pms';
import * as storage from '../services/storage';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, tn, useT } from '../utils/i18n';
import { MciIcon } from '../components/MciIcon';
import { searchPorts } from '../constants/ports';

const CURRENCIES = ['€', '$', '£', '¥'];
const URGENCY_LEVELS = [
  { key: 'routine', color: 'textLight' },
  { key: 'urgent', color: 'warning' },
  { key: 'emergency', color: 'danger' },
] as const;
type UrgencyKey = 'routine' | 'urgent' | 'emergency';

const ORDER_UNITS = [
  'pcs', 'set', 'pair',
  'kg', 'g', 't',
  'L', 'mL', 'gal',
  'm', 'cm', 'ft',
  'm²', 'm³',
  'box', 'pack', 'roll',
  'can', 'drum', 'bag', 'bottle', 'tube', 'spool',
];

/** Statuses the officer can set directly. Partial can be set manually or auto-derived. */
const SETTABLE_STATUSES: OrderStatus[] = ['draft', 'standby', 'sent', 'partial', 'received', 'cancelled'];

// ORDER_DEPT_LABEL / ORDER_STATUS_LABEL (types/orders) stay English for the PDF; the screen translates.
const deptName = (d: string) => tk(`od.${d}`);
const urgName = (u: string) => tk(`po.urg.${u}`);

function emptyLine(): OrderLine {
  return { id: uid('ol'), description: '', qty: 1, unit: 'pcs' };
}

export default function OrderSc() {
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { purchaseOrders, saveRow, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const { signer, picker } = useSigner();
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const paramId = route.params?.id as string;
  const id = savedId ?? paramId;
  const isNew = paramId === 'new';
  const stored = purchaseOrders.find((o) => o.id === id);

  const [draft, setDraft] = useState<PurchaseOrder | null>(() => {
    if (!isNew) return null;
    const dept: OrderDept = (route.params?.dept as OrderDept) ?? 'engine';
    return {
      id: uid('po'),
      no: nextOrderNo(purchaseOrders, dept),
      dept,
      status: 'draft',
      date: today,
      by: '',
      lines: [emptyLine()],
      at: Date.now(),
      updatedAt: Date.now(),
    };
  });

  const [receiving, setReceiving] = useState(false);
  const [received, setReceived] = useState<Record<string, string>>({});
  const [unitPickerFor, setUnitPickerFor] = useState<string | null>(null);
  const [lineSearch, setLineSearch] = useState('');
  const [lineSort, setLineSort] = useState<'default' | 'alpha' | 'price'>('default');
  const [portQuery, setPortQuery] = useState('');
  const [showPortDrop, setShowPortDrop] = useState(false);
  const [showUrgencyDrop, setShowUrgencyDrop] = useState(false);
  const [currencyPickerFor, setCurrencyPickerFor] = useState<string | null>(null);

  const o = draft ?? stored;
  if (!o) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Main', { screen: 'Orders' })} />
        <Text style={{ color: COLORS.textLight, marginTop: SIZES.md }}>{t('mo.notHere')}</Text>
      </Screen>
    );
  }

  const editable = !receiving && ((draft != null) || (o.status === 'draft' || o.status === 'standby' || o.status === 'sent' || o.status === 'partial'));

  const rawLines = (draft ?? o).lines;
  const filteredLines = lineSearch.trim()
    ? (() => { const q = lineSearch.toLowerCase(); return rawLines.filter((l) =>
        l.description.toLowerCase().includes(q) ||
        (l.partNo ?? '').toLowerCase().includes(q) ||
        (l.impa ?? '').toLowerCase().includes(q) ||
        (l.maker ?? '').toLowerCase().includes(q)); })()
    : rawLines;
  const displayLines = lineSort === 'alpha'
    ? [...filteredLines].sort((a, b) => a.description.localeCompare(b.description))
    : lineSort === 'price'
    ? [...filteredLines].sort((a, b) => (b.unitPrice ?? 0) - (a.unitPrice ?? 0))
    : filteredLines;
  const final = o.status === 'received' || o.status === 'cancelled';

  // Checked = key present in `received`. Value is the qty string (may be < ordered = partial).
  // Decoupled from value so typing a smaller qty never unchecks the item.
  const isLineChecked = (l: OrderLine) => Object.prototype.hasOwnProperty.call(received, l.id);
  const toggleLineCheck = (l: OrderLine) => {
    if (isLineChecked(l)) {
      setReceived((r) => { const n = { ...r }; delete n[l.id]; return n; });
    } else {
      setReceived((r) => ({ ...r, [l.id]: String(l.qty) }));
    }
  };
  const allChecked = receiving && o.lines.length > 0 && o.lines.every(isLineChecked);
  const checkAll = () => {
    if (allChecked) {
      setReceived({});
    } else {
      const updates: Record<string, string> = {};
      o.lines.forEach((l) => { updates[l.id] = String(l.qty); });
      setReceived(updates);
    }
  };

  const statusColor = (s: OrderStatus): string => {
    const c = ORDER_STATUS_COLOR[s];
    if (c === 'green') return COLORS.success;
    if (c === 'warn') return COLORS.warning;
    if (c === 'accent') return COLORS.primary;
    if (c === 'red') return COLORS.danger;
    return COLORS.textLight;
  };

  const set = (patch: Partial<PurchaseOrder>) => {
    const base = draft ?? { ...o };
    const next = { ...base, ...patch, updatedAt: Date.now() };
    // Recalculate order number when dept changes on a new order
    if (isNew && patch.dept && patch.dept !== base.dept) {
      next.no = nextOrderNo(purchaseOrders, patch.dept);
    }
    setDraft(next);
  };

  const setLine = (lineId: string, patch: Partial<OrderLine>) =>
    set({ lines: (draft ?? o).lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) });

  const removeLine = (lineId: string) =>
    set({ lines: (draft ?? o).lines.filter((l) => l.id !== lineId) });

  const addLine = () => set({ lines: [...(draft ?? o).lines, emptyLine()] });

  const save = async () => {
    if (!draft) return;
    if (!draft.lines.length) return Alert.alert(t('mo.order'), t('po.needLine'));
    const noId = draft.lines.find((l) => !l.description.trim() && !l.impa?.trim());
    if (noId) return Alert.alert(t('mo.order'), t('po.lineNeedsId', { n: draft.lines.indexOf(noId) + 1 }));
    const toSave: PurchaseOrder = { ...draft, by: signer?.name ?? draft.by };
    await saveRow(storage.PURCHASE_ORDERS_KEY, toSave);
    setSavedId(toSave.id);
    setDraft(null);
    playSuccessSound();
  };

  const changeStatus = async (newStatus: OrderStatus) => {
    if (newStatus === o.status) return;
    if (newStatus === 'received') {
      setReceiving(true);
      return;
    }
    if (newStatus === 'cancelled') {
      Alert.alert(t('go.cancelQ'), t('po.cancelBody'), [
        { text: t('po.keep'), style: 'cancel' },
        {
          text: t('go.cancelQ'),
          style: 'destructive',
          onPress: async () => {
            await saveRow(storage.PURCHASE_ORDERS_KEY, { ...o, status: 'cancelled', cancelledAt: today, updatedAt: Date.now() });
            goBackOr(nav, 'Main', { screen: 'Orders' });
          },
        },
      ]);
      return;
    }
    const toSave: PurchaseOrder = {
      ...o,
      status: newStatus,
      ...(newStatus === 'sent' && !o.sentAt ? { sentAt: today, sentBy: signer?.name ?? '' } : {}),
      updatedAt: Date.now(),
    };
    await saveRow(storage.PURCHASE_ORDERS_KEY, toSave);
    playSuccessSound();
  };

  const confirmReceive = async () => {
    const deliveryLines: Record<string, number> = {};
    const updates: OrderLine[] = o.lines.map((l) => {
      const v = Number(received[l.id] ?? '');
      const newTotal = Number.isFinite(v) && v >= 0 ? v : (l.qtyReceived ?? 0);
      const prev = l.qtyReceived ?? 0;
      const delta = Math.max(0, newTotal - prev);
      if (delta > 0) deliveryLines[l.id] = delta;
      return { ...l, qtyReceived: newTotal };
    });
    const delivery: Delivery = { date: today, by: signer?.name ?? '', lines: deliveryLines };
    const updated: PurchaseOrder = {
      ...o,
      lines: updates,
      deliveries: [...(o.deliveries ?? []), delivery],
      receivedAt: today,
      receivedBy: signer?.name ?? '',
      updatedAt: Date.now(),
      status: 'received',
    };
    updated.status = derivedStatus(updated);
    if (updated.status === 'partial') updated.receivedAt = undefined;
    await saveRow(storage.PURCHASE_ORDERS_KEY, updated);
    setReceiving(false);
    setReceived({});
    playSuccessSound();
  };

  const doCopy = async () => {
    const newOrder = copyOrder(o, purchaseOrders);
    await saveRow(storage.PURCHASE_ORDERS_KEY, newOrder);
    nav.replace('Order', { id: newOrder.id });
  };

  const val = orderValue(o);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Main', { screen: 'Orders' })} />
      <ScreenTitle title={isNew ? t('po.new') : o.no} subtitle={deptName(o.dept)} />

      {/* Status chips */}
      {!isNew ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
          {SETTABLE_STATUSES.map((s) => {
            const active = o.status === s;
            const color = statusColor(s);
            return (
              <TouchableOpacity
                key={s}
                style={[styles.statusChip, active && { backgroundColor: color, borderColor: color }]}
                onPress={() => { if (!final && officer) void changeStatus(s); }}
                activeOpacity={final || !officer ? 1 : 0.7}
              >
                <Text style={[styles.statusChipText, { color: active ? COLORS.cardSolid : color }]}>
                  {tk(`po.st.${s}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      <Card>
        {/* Department */}
        <Label>{t('po.dept')}</Label>
        {editable ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {ORDER_DEPTS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, (draft ?? o).dept === d && styles.chipOn]}
                onPress={() => set({ dept: d })}
                activeOpacity={0.7}
              >
                <Text style={(draft ?? o).dept === d ? styles.chipTextOn : styles.chipText}>{deptName(d)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.fieldVal}>{deptName(o.dept)}</Text>
        )}

        {/* Date · Supplier · Supplier Ref — one row */}
        <View style={styles.headerFields}>
          <View style={styles.headerColDate}>
            <Label>{t('nc.date')}</Label>
            {editable ? (
              <SimpleDatePicker label={t('nc.date')} showLabel={false} compact value={(draft ?? o).date} onChange={(v) => set({ date: v })} />
            ) : (
              <Text style={styles.fieldVal}>{uiDate(o.date)}</Text>
            )}
          </View>
          <View style={styles.headerColSupplier}>
            <Label>{t('spp.supplier')}</Label>
            {editable ? (
              <TextInput
                style={styles.input}
                value={(draft ?? o).supplier ?? ''}
                onChangeText={(v) => set({ supplier: v })}
                placeholder={t('lr.supplierPh')}
                placeholderTextColor={COLORS.textLight}
              />
            ) : o.supplier ? (
              <Text style={styles.fieldVal}>{o.supplier}</Text>
            ) : (
              <Text style={styles.fieldVal2}>{t('po.notSet')}</Text>
            )}
          </View>
          <View style={styles.headerColRef}>
            <Label>{t('po.ref')}</Label>
            {editable ? (
              <TextInput
                style={styles.input}
                value={(draft ?? o).supplierRef ?? ''}
                onChangeText={(v) => set({ supplierRef: v })}
                placeholder={t('po.refPh')}
                placeholderTextColor={COLORS.textLight}
              />
            ) : o.supplierRef ? (
              <Text style={styles.fieldVal}>{o.supplierRef}</Text>
            ) : (
              <Text style={styles.fieldVal2}>—</Text>
            )}
          </View>
        </View>

        {/* Delivery date · Port · Urgency — one row */}
        <View style={styles.deliveryFields}>
          {/* Delivery date */}
          <View style={styles.delivColDate}>
            <Label>{t('po.deliveryDate')}</Label>
            {editable ? (
              <SimpleDatePicker
                label={t('po.deliveryDate')}
                showLabel={false}
                compact
                value={(draft ?? o).deliveryDate ?? ''}
                onChange={(v) => set({ deliveryDate: v })}
                onClear={() => set({ deliveryDate: undefined })}
                placeholder="—"
              />
            ) : (draft ?? o).deliveryDate ? (
              <Text style={styles.fieldVal}>{uiDate((draft ?? o).deliveryDate!)}</Text>
            ) : (
              <Text style={styles.fieldVal2}>—</Text>
            )}
          </View>

          {/* Port */}
          <View style={styles.delivColPort}>
            <Label>{t('po.port')}</Label>
            {editable ? (
              <View>
                <TextInput
                  style={styles.input}
                  value={portQuery || ((draft ?? o).deliveryPort ?? '')}
                  onChangeText={(v) => {
                    setPortQuery(v);
                    set({ deliveryPort: v });
                    setShowPortDrop(v.length > 0);
                  }}
                  onFocus={() => setShowPortDrop(((draft ?? o).deliveryPort ?? '').length > 0)}
                  onBlur={() => setTimeout(() => setShowPortDrop(false), 150)}
                  placeholder={t('po.startTyping')}
                  placeholderTextColor={COLORS.textLight}
                  returnKeyType="done"
                />
                {showPortDrop && searchPorts((draft ?? o).deliveryPort ?? '').length > 0 ? (
                  <View style={styles.portDropdown}>
                    {searchPorts((draft ?? o).deliveryPort ?? '').map((p) => (
                      <TouchableOpacity
                        key={p}
                        style={styles.portOption}
                        onPress={() => {
                          set({ deliveryPort: p });
                          setPortQuery('');
                          setShowPortDrop(false);
                        }}
                      >
                        <MciIcon name="anchor" size={13} color={COLORS.textLight} style={{ marginRight: 6 }} />
                        <Text style={styles.portOptionText}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (draft ?? o).deliveryPort ? (
              <Text style={styles.fieldVal}>{(draft ?? o).deliveryPort}</Text>
            ) : (
              <Text style={styles.fieldVal2}>—</Text>
            )}
          </View>

          {/* Urgency */}
          <View style={[styles.delivColUrgency, { zIndex: 15 }]}>
            <Label>{t('po.urgency')}</Label>
            {editable ? (
              <View>
                <TouchableOpacity
                  style={styles.urgencyTrigger}
                  onPress={() => setShowUrgencyDrop((v) => !v)}
                  activeOpacity={0.7}
                >
                  {(() => {
                    const u = (draft ?? o).urgency;
                    const lvl = URGENCY_LEVELS.find((l) => l.key === u);
                    const c = lvl ? (COLORS[lvl.color as keyof typeof COLORS] as string ?? COLORS.textLight) : COLORS.textLight;
                    return (
                      <>
                        <Text style={[styles.urgencyTriggerText, { color: lvl ? c : COLORS.textLight }]}>
                          {lvl ? urgName(lvl.key) : '—'}
                        </Text>
                        <MciIcon name={showUrgencyDrop ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.textLight} />
                      </>
                    );
                  })()}
                </TouchableOpacity>
                {showUrgencyDrop ? (
                  <View style={styles.urgencyDropdown}>
                    {[{ key: undefined, color: 'textLight' as const }, ...URGENCY_LEVELS].map(({ key, color }) => {
                      const c = COLORS[color as keyof typeof COLORS] as string ?? COLORS.textLight;
                      const active = (draft ?? o).urgency === key;
                      return (
                        <TouchableOpacity
                          key={key ?? 'none'}
                          style={[styles.urgencyOption, active && styles.urgencyOptionActive]}
                          onPress={() => {
                            set({ urgency: key as UrgencyKey | undefined });
                            setShowUrgencyDrop(false);
                          }}
                        >
                          <Text style={[styles.urgencyOptionText, { color: c }]}>{key ? urgName(key) : '—'}</Text>
                          {active ? <MciIcon name="check" size={14} color={c} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : (draft ?? o).urgency ? (
              <Text style={styles.fieldVal}>{urgName((draft ?? o).urgency!)}</Text>
            ) : (
              <Text style={styles.fieldVal2}>—</Text>
            )}
          </View>
        </View>

        {/* Notes */}
        {(editable || o.notes) ? (
          <>
            <Label style={{ marginTop: SIZES.sm }}>{t('og.notes')}</Label>
            {editable ? (
              <TextInput
                style={[styles.input, { minHeight: 44 }]}
                value={(draft ?? o).notes ?? ''}
                onChangeText={(v) => set({ notes: v })}
                placeholder={t('po.notesPh')}
                placeholderTextColor={COLORS.textLight}
                multiline
              />
            ) : (
              <Text style={styles.fieldVal}>{o.notes}</Text>
            )}
          </>
        ) : null}

        {/* "All items received" — select-all checkbox shown only in receive mode */}
        {receiving ? (
          <TouchableOpacity style={styles.checkAllRow} onPress={checkAll} activeOpacity={0.7}>
            <View style={[styles.checkbox, allChecked && styles.checkboxOn]}>
              {allChecked ? <MciIcon name="check" size={14} color={COLORS.cardSolid} /> : null}
            </View>
            <Text style={styles.checkAllLabel}>{t('po.allReceived')}</Text>
          </TouchableOpacity>
        ) : null}
      </Card>

      {/* Lines */}
      <View style={styles.linesHead}>
        <Label>
          {rawLines.length > 0
            ? (lineSearch.trim() && filteredLines.length !== rawLines.length
                ? t('po.linesOf', { k: filteredLines.length, n: rawLines.length })
                : t('po.linesN', { n: rawLines.length }))
            : t('mo.lines')}
        </Label>
        {editable ? (
          <TouchableOpacity onPress={addLine} hitSlop={10}>
            <Text style={styles.addLine}>{t('po.addLine')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Search + sort */}
      {rawLines.length > 1 ? (
        <View style={styles.lineFilterRow}>
          <TextInput
            style={styles.lineSearchInput}
            value={lineSearch}
            onChangeText={setLineSearch}
            placeholder={t('po.searchLines')}
            placeholderTextColor={COLORS.textLight}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {(['default', 'alpha', 'price'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.sortChip, lineSort === s && styles.sortChipOn]}
              onPress={() => setLineSort(lineSort === s && s !== 'default' ? 'default' : s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortChipText, lineSort === s && styles.sortChipTextOn]}>
                {s === 'default' ? '—' : s === 'alpha' ? 'A–Z' : '€↓'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {displayLines.map((l, i) => (
        <Card key={l.id} style={{ marginBottom: SIZES.xs }}>
          {editable ? (
            <View>
              <View style={styles.lineHeader}>
                <Text style={styles.lineNo}>{t('po.line', { n: i + 1 })}</Text>
                {(draft ?? o).lines.length > 1 ? (
                  <TouchableOpacity onPress={() => removeLine(l.id)} hitSlop={10}>
                    <MciIcon name="close" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* Description */}
              <TextInput
                style={styles.input}
                value={l.description}
                onChangeText={(v) => setLine(l.id, { description: v })}
                placeholder={t('po.descPh')}
                placeholderTextColor={COLORS.textLight}
              />
              {/* Qty · Part No. · IMPA · 🔍 · Maker · Price · Currency */}
              <View style={styles.qtyRow}>
                <TextInput
                  style={[styles.input, { width: 64 }]}
                  value={String(l.qty)}
                  onChangeText={(v) => setLine(l.id, { qty: Number(v.replace(',', '.')) || 1 })}
                  placeholder={t('mc.qty')}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textLight}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={l.partNo ?? ''}
                  onChangeText={(v) => setLine(l.id, { partNo: v })}
                  placeholder={t('po.partNo')}
                  placeholderTextColor={COLORS.textLight}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={l.impa ?? ''}
                  onChangeText={(v) => setLine(l.id, { impa: v })}
                  placeholder="IMPA"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={styles.impaSearchBtn}
                  onPress={() => {
                    const impa = l.impa?.trim();
                    const desc = l.description?.trim();
                    if (!impa && !desc) {
                      Alert.alert(t('po.shipserv'), t('po.shipservBody'));
                      return;
                    }
                    void Linking.openURL(`https://www.shipserv.com/search?q=${encodeURIComponent(impa || desc || '')}`);
                  }}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <MciIcon name="magnify" size={16} color={COLORS.textWhite ?? '#fff'} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={l.maker ?? ''}
                  onChangeText={(v) => setLine(l.id, { maker: v })}
                  placeholder={t('spp.maker')}
                  placeholderTextColor={COLORS.textLight}
                />
                <TextInput
                  style={[styles.input, { width: 80 }]}
                  value={l.unitPrice != null ? String(l.unitPrice) : ''}
                  onChangeText={(v) => setLine(l.id, { unitPrice: v ? Number(v.replace(',', '.')) : undefined })}
                  placeholder={t('po.price')}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textLight}
                />
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={[styles.input, styles.unitBtn, { width: 56 }]}
                    onPress={() => setCurrencyPickerFor(currencyPickerFor === l.id ? null : l.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.unitBtnText}>{l.currency ?? '€'}</Text>
                    <MciIcon name={currencyPickerFor === l.id ? 'chevron-up' : 'chevron-down'} size={12} color={COLORS.textLight} />
                  </TouchableOpacity>
                  {currencyPickerFor === l.id ? (
                    <View style={[styles.unitDropdown, { width: 64 }]}>
                      {CURRENCIES.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.unitOption, (l.currency ?? '€') === c && styles.unitOptionOn]}
                          onPress={() => { setLine(l.id, { currency: c }); setCurrencyPickerFor(null); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.unitOptionText, (l.currency ?? '€') === c && styles.unitOptionTextOn]}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
              {/* Stock · Unit · Budget — second row */}
              <View style={[styles.qtyRow, { marginTop: 4 }]}>
                <TextInput
                  style={[styles.input, { width: 80 }]}
                  value={l.stockQty != null ? String(l.stockQty) : ''}
                  onChangeText={(v) => setLine(l.id, { stockQty: v ? Number(v.replace(',', '.')) : undefined })}
                  placeholder={t('po.stock')}
                  keyboardType="numeric"
                  placeholderTextColor={COLORS.textLight}
                />
                <TouchableOpacity
                  style={[styles.input, styles.unitBtn, { width: 72 }]}
                  onPress={() => setUnitPickerFor(unitPickerFor === l.id ? (null) : l.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.unitBtnText, !l.unit && { color: COLORS.textLight }]} numberOfLines={1}>{l.unit || t('po.unit')}</Text>
                  <MciIcon name={unitPickerFor === l.id ? 'chevron-up' : 'chevron-down'} size={12} color={COLORS.textLight} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={l.budget ?? ''}
                  onChangeText={(v) => setLine(l.id, { budget: v })}
                  placeholder={t('po.budget')}
                  placeholderTextColor={COLORS.textLight}
                />
              </View>
              {unitPickerFor === l.id ? (
                <View style={styles.unitDropdown}>
                  {ORDER_UNITS.map((u) => (
                    <TouchableOpacity
                      key={u}
                      style={[styles.unitOption, l.unit === u && styles.unitOptionOn]}
                      onPress={() => { setLine(l.id, { unit: u }); setUnitPickerFor(null); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.unitOptionText, l.unit === u && styles.unitOptionTextOn]}>{u}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {/* Line comment */}
              <TextInput
                style={styles.input}
                value={l.notes ?? ''}
                onChangeText={(v) => setLine(l.id, { notes: v })}
                placeholder={t('po.comment')}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          ) : (
            <View>
              <View style={styles.lineViewHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{l.description}</Text>
                  <Text style={styles.lineSub}>
                    {[
                      `${l.qty} ${l.unit}`,
                      l.partNo && t('po.pn', { pn: l.partNo }),
                      l.impa && `IMPA: ${l.impa}`,
                      l.maker,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                  {l.unitPrice != null ? (
                    <Text style={styles.lineSub}>{t('po.priceLine', { price: priceStr(l), unit: l.unit, total: lineTotalStr(l) })}</Text>
                  ) : null}
                  {l.notes ? <Text style={styles.lineSub}>{l.notes}</Text> : null}
                  {l.qtyReceived != null && !receiving ? (() => {
                    const done = l.qtyReceived >= l.qty;
                    const outstanding = l.qty - l.qtyReceived;
                    return (
                      <Text style={[styles.lineSub, { color: done ? COLORS.success : COLORS.warning }]}>
                        {done
                          ? t('po.allRcvd', { n: l.qty, unit: l.unit })
                          : t('po.partRcvd', { n: l.qtyReceived, unit: l.unit, k: outstanding })}
                      </Text>
                    );
                  })() : null}
                </View>
                {/* Per-line checkbox in receive mode */}
                {receiving ? (
                  <TouchableOpacity
                    style={[styles.checkbox, isLineChecked(l) && styles.checkboxOn]}
                    onPress={() => toggleLineCheck(l)}
                    activeOpacity={0.7}
                    hitSlop={10}
                  >
                    {isLineChecked(l) ? <MciIcon name="check" size={16} color={COLORS.cardSolid} /> : null}
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* Partial qty input — shown when checked but need to adjust */}
              {receiving && isLineChecked(l) ? (
                <View style={styles.receiveRow}>
                  <Text style={styles.lineSub}>{`${t('mc.qty')}:`}</Text>
                  <TextInput
                    style={styles.receiveQtyInput}
                    value={received[l.id] ?? String(l.qty)}
                    onChangeText={(v) => setReceived((r) => ({ ...r, [l.id]: v }))}
                    keyboardType="numeric"
                    editable
                    selectTextOnFocus
                    placeholderTextColor={COLORS.textLight}
                  />
                  <Text style={styles.lineSub}>{t('po.ofQty', { n: l.qty, unit: l.unit })}</Text>
                </View>
              ) : null}
            </View>
          )}
        </Card>
      ))}

      {/* Total value */}
      {val != null ? (
        <Text style={styles.total}>{t('po.total', { sum: `${o.lines.find((l) => l.currency)?.currency ?? '€'} ${val.toFixed(2)}` })}</Text>
      ) : null}

      {/* Signer */}
      {officer && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        {draft != null ? (
          <TouchableOpacity style={styles.btn} onPress={() => void save()}>
            <Text style={styles.btnText}>{t('go.save')}</Text>
          </TouchableOpacity>
        ) : null}

        {!draft && !receiving && (o.status === 'sent' || o.status === 'partial') && officer ? (
          <TouchableOpacity style={styles.btn} onPress={() => setReceiving(true)}>
            <Text style={styles.btnText}>{o.status === 'partial' ? t('po.continueRcv') : t('po.confirmRcpt')}</Text>
          </TouchableOpacity>
        ) : null}

        {!draft && receiving ? (
          <>
            <TouchableOpacity style={styles.btn} onPress={() => void confirmReceive()}>
              <Text style={styles.btnText}>{t('po.confirmDelivery')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => { setReceiving(false); setReceived({}); }}>
              <Text style={styles.btnOutlineText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {!isNew && !draft ? (
          <TouchableOpacity style={styles.btnOutline} onPress={() => void doCopy()}>
            <Text style={styles.btnOutlineText}>{t('po.copy')}</Text>
          </TouchableOpacity>
        ) : null}

        {!isNew && !draft ? (
          <TouchableOpacity style={styles.btnOutline} onPress={() => void exportOrderPdf(o, vessel)}>
            <Text style={styles.btnOutlineText}>{t('po.pdf')}</Text>
          </TouchableOpacity>
        ) : null}

        {!isNew && !draft && o.dept !== 'galley' ? (
          <TouchableOpacity style={styles.btnOutline} onPress={() => void printBoxQrLabel(o, vessel)}>
            <Text style={styles.btnOutlineText}>{t('po.boxLabel')}</Text>
          </TouchableOpacity>
        ) : null}

        {!isNew && !draft && officer ? (
          <TouchableOpacity
            style={styles.btnDelete}
            onPress={() =>
              Alert.alert(t('go.delete'), t('po.deleteBody', { no: o.no }), [
                { text: t('po.keep'), style: 'cancel' },
                {
                  text: t('common.delete'),
                  style: 'destructive',
                  onPress: async () => {
                    await saveRow(storage.PURCHASE_ORDERS_KEY, { ...o, deleted: true, updatedAt: Date.now() });
                    goBackOr(nav, 'Main', { screen: 'Orders' });
                  },
                },
              ])
            }
          >
            <Text style={styles.btnDeleteText}>{t('go.delete')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Delivery history — compact: date + signer + total items received per event */}
      {o.deliveries && o.deliveries.length > 0 ? (
        <>
          <Label style={{ marginTop: SIZES.md }}>{t('po.history')}</Label>
          {o.deliveries.map((d, i) => {
            const totalReceived = Object.values(d.lines).reduce((s, q) => s + q, 0);
            return (
              <View key={i} style={styles.deliveryRow}>
                <View style={styles.deliveryDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.deliveryDate}>{`${uiDate(d.date)}${d.by ? ` · ${d.by}` : ''}`}</Text>
                  <Text style={styles.deliveryLine}>{tn('n.unitRcvd', totalReceived)}</Text>
                </View>
              </View>
            );
          })}
        </>
      ) : null}

      {/* Completion bar */}
      {(o.status === 'sent' || o.status === 'partial' || o.status === 'received') ? (() => {
        const pct = completionPct(o);
        const doneLines = o.lines.filter((l) => (l.qtyReceived ?? 0) >= l.qty).length;
        const barColor = o.status === 'received' ? COLORS.success : pct > 0 ? COLORS.warning : COLORS.border;
        return (
          <View style={{ marginTop: SIZES.sm }}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
            </View>
            <Text style={styles.trail}>{tn('n.lineRcvd', o.lines.length, { k: doneLines, pct })}</Text>
          </View>
        );
      })() : null}

      {/* Audit trail */}
      {o.sentAt ? <Text style={styles.trail}>{t('galley.sent', { date: uiDate(o.sentAt) }) + (o.sentBy ? t('po.by', { who: o.sentBy }) : '')}</Text> : null}
      {o.receivedAt ? <Text style={styles.trail}>{t('po.fullyRcvd', { date: uiDate(o.receivedAt) }) + (o.receivedBy ? t('po.by', { who: o.receivedBy }) : '')}</Text> : null}

      {/* QR code — delivery receipt label (all depts except galley) */}
      {!isNew && o.dept !== 'galley' ? (
        <Card style={{ marginTop: SIZES.md, alignItems: 'center' }}>
          <Label style={{ marginBottom: SIZES.sm }}>{t('po.qr')}</Label>
          <QRCode
            value={`po:${o.id}`}
            size={140}
            color={COLORS.textDark}
            backgroundColor="transparent"
          />
          <Text style={[styles.trail, { marginTop: SIZES.sm, textAlign: 'center' }]}>
            {`${o.no} · ${deptName(o.dept)}`}
          </Text>
          {o.supplier ? <Text style={[styles.trail, { textAlign: 'center' }]}>{o.supplier}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    statusRow: {
      flexDirection: 'row',
      gap: SIZES.xs,
      paddingBottom: SIZES.sm,
    },
    statusChip: {
      borderWidth: 1.5,
      borderRadius: 999,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 5,
      borderColor: COLORS.border,
    },
    statusChipText: {
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.textLight,
    },
    chipRow: {
      flexDirection: 'row',
      gap: SIZES.xs,
      marginTop: SIZES.xs,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: SIZES.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.primary,
    },
    chipOn: {
      backgroundColor: COLORS.primary,
    },
    chipText: {
      color: COLORS.primary,
      fontWeight: '600',
      fontSize: SIZES.small,
    },
    chipTextOn: {
      color: COLORS.cardSolid,
      fontWeight: '600',
      fontSize: SIZES.small,
    },
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
    fieldVal2: {
      fontSize: SIZES.body,
      color: COLORS.textLight,
      marginTop: 4,
    },
    linesHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    addLine: {
      color: COLORS.primary,
      fontWeight: '700',
      fontSize: SIZES.body,
    },
    lineHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    lineViewHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SIZES.sm,
    },
    checkAllRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      marginTop: SIZES.md,
      paddingTop: SIZES.sm,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    checkAllLabel: {
      fontSize: SIZES.body,
      fontWeight: '700',
      color: COLORS.textDark,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    checkboxOn: {
      borderColor: COLORS.success,
      backgroundColor: COLORS.success,
    },
    lineNo: {
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.textLight,
    },
    lineName: {
      fontSize: SIZES.body,
      fontWeight: '700',
      color: COLORS.textDark,
    },
    lineSub: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 2,
    },
    qtyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SIZES.sm,
    },
    qtyInput: {
      flex: 1,
    },
    unitInput: {
      flex: 1,
    },
    impaSearchBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusSm,
      padding: 7,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerFields: {
      flexDirection: 'row',
      gap: SIZES.sm,
      marginTop: SIZES.sm,
      alignItems: 'flex-start',
    },
    headerColDate: {
      flex: 1,
      minWidth: 0,
    },
    headerColSupplier: {
      flex: 1.6,
      minWidth: 0,
    },
    headerColRef: {
      flex: 1,
      minWidth: 0,
    },
    deliveryFields: {
      flexDirection: 'row',
      gap: SIZES.sm,
      marginTop: SIZES.sm,
      alignItems: 'flex-start',
      zIndex: 10,
    },
    delivColDate: {
      flex: 1,
      minWidth: 0,
    },
    delivColPort: {
      flex: 1.4,
      minWidth: 0,
      zIndex: 20,
    },
    delivColUrgency: {
      flex: 1,
      minWidth: 0,
    },
    urgencyTrigger: {
      ...COLORS.glassInput,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 8,
      marginTop: 2,
    },
    urgencyTriggerText: {
      fontSize: SIZES.body,
      flex: 1,
    },
    urgencyDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      zIndex: 100,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
      marginTop: 2,
    },
    urgencyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.sm,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    urgencyOptionActive: {
      backgroundColor: COLORS.primaryLight ?? COLORS.borderLight,
    },
    urgencyOptionText: {
      fontSize: SIZES.body,
      fontWeight: '600',
    },
    portDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      zIndex: 100,
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 6,
    },
    portOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.sm,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    portOptionText: {
      fontSize: SIZES.body,
      color: COLORS.text,
    },
    unitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SIZES.xs,
    },
    unitBtnText: {
      fontSize: SIZES.body,
      color: COLORS.text,
    },
    unitDropdown: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SIZES.xs,
      marginTop: SIZES.xs,
      padding: SIZES.sm,
      backgroundColor: COLORS.card,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    unitOption: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    unitOptionOn: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    unitOptionText: {
      fontSize: SIZES.small,
      color: COLORS.textDark,
      fontWeight: '600',
    },
    unitOptionTextOn: {
      color: COLORS.cardSolid,
    },
    makerPriceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.xs,
      marginTop: SIZES.xs,
    },
    currChip: {
      borderWidth: 1,
      borderRadius: 999,
      borderColor: COLORS.border,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    currChipOn: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary + '22',
    },
    currChipText: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      fontWeight: '600',
    },
    currChipTextOn: {
      color: COLORS.primary,
    },
    receiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      marginTop: SIZES.sm,
    },
    receiveInput: {
      width: 80,
    },
    receiveQtyInput: {
      width: 80,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.primary,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 6,
      fontSize: SIZES.body,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      textAlign: 'center',
    },
    total: {
      fontSize: SIZES.body,
      fontWeight: '700',
      color: COLORS.textDark,
      textAlign: 'right',
      marginTop: SIZES.sm,
    },
    actions: {
      gap: SIZES.sm,
      marginTop: SIZES.md,
      marginBottom: SIZES.sm,
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
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: COLORS.border,
      overflow: 'hidden',
      marginTop: SIZES.xs,
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
    },
    deliveryRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SIZES.sm,
      marginBottom: SIZES.sm,
    },
    deliveryDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.primary,
      marginTop: 5,
    },
    deliveryDate: {
      fontSize: SIZES.small,
      fontWeight: '700',
      color: COLORS.textDark,
    },
    deliveryLine: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      marginTop: 1,
    },
    lineFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.xs,
      marginBottom: SIZES.xs,
    },
    lineSearchInput: {
      ...COLORS.glassInput,
      flex: 1,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: 7,
      fontSize: SIZES.small,
      color: COLORS.text,
    },
    sortChip: {
      borderWidth: 1,
      borderRadius: 999,
      borderColor: COLORS.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    sortChipOn: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary + '22',
    },
    sortChipText: {
      fontSize: SIZES.small,
      color: COLORS.textLight,
      fontWeight: '600',
    },
    sortChipTextOn: {
      color: COLORS.primary,
    },
  });
