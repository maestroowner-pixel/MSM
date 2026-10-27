// ===================================
// One supplier's quote on a purchase order (types/orders.ts Quote).
//
// Typed in line by line — a unit price, or "can't supply" — with delivery,
// discount, lead time, validity and their reference; or read from the Excel
// request the supplier filled in (services/rfq.ts quoteFromSheet). "Declined"
// records that they will not quote. The order itself is changed only by the
// award (components/RfqPanel), never here.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { Quote } from '../types/orders';
import { CURRENCIES } from '../types/finance';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { money } from '../services/finance';
import { quoteFromSheet, quoteTotal } from '../services/rfq';
import { pickSheetRows } from '../services/sheetFiles';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, useT } from '../utils/i18n';

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};
const str = (n?: number) => (n == null ? '' : String(n));

export default function QuoteSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { purchaseOrders, saveRow } = useData();
  const o = purchaseOrders.find((x) => x.id === route.params?.po);
  const stored = o?.quotes?.find((q) => q.id === route.params?.id);

  const [q, setQ] = useState<Quote | null>(() => (stored ? { ...stored, receivedAt: stored.receivedAt ?? todayIso() } : null));
  // Prices as typed, so "12," is not turned into 12 under the cursor.
  const [typed, setTyped] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(stored?.prices ?? {}).map(([k, v]) => [k, String(v)])));
  const [extra, setExtra] = useState(() => ({ delivery: str(stored?.delivery), discount: str(stored?.discountPct), lead: str(stored?.leadDays) }));
  const [note, setNote] = useState<string | null>(null);

  const back = () => goBackOr(nav, 'Order', { id: route.params?.po });
  if (!o || !q) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('mo.notHere')}</Text>
      </Screen>
    );
  }

  const set = (patch: Partial<Quote>) => setQ({ ...q, ...patch });
  const prices = () => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(typed)) { const n = num(v); if (n != null && n >= 0) out[k] = n; }
    return out;
  };
  const current: Quote = {
    ...q, prices: prices(),
    delivery: num(extra.delivery), discountPct: num(extra.discount), leadDays: num(extra.lead),
  };
  const tt = quoteTotal(o, current);
  const toggleNa = (id: string) => {
    const na = new Set(q.unavailable ?? []);
    if (na.has(id)) na.delete(id); else na.add(id);
    set({ unavailable: [...na] });
  };

  const fromExcel = async () => {
    try {
      const f = await pickSheetRows();
      if (!f) return;
      const r = quoteFromSheet(o, f.rows);
      if (!r) return Alert.alert(t('rfq.fromExcel'), t('rfq.noLineId'));
      if (!r.matched) return Alert.alert(t('rfq.fromExcel'), t('rfq.otherOrder'));
      setTyped({ ...typed, ...Object.fromEntries(Object.entries(r.prices).map(([k, v]) => [k, String(v)])) });
      set({ unavailable: [...new Set([...(q.unavailable ?? []).filter((id) => r.prices[id] == null), ...r.unavailable])], ...(r.ref ? { ref: r.ref } : {}) });
      setExtra({ delivery: r.delivery != null ? String(r.delivery) : extra.delivery, discount: r.discountPct != null ? String(r.discountPct) : extra.discount, lead: r.leadDays != null ? String(r.leadDays) : extra.lead });
      setNote(t('rfq.readN', { k: Object.keys(r.prices).length, n: o.lines.length, na: r.unavailable.length }) + (r.foreign ? ` ${t('rfq.foreignRows', { n: r.foreign })}` : ''));
    } catch (e: any) {
      Alert.alert(t('rfq.fromExcel'), String(e?.message ?? e));
    }
  };

  const save = async () => {
    const quote: Quote = {
      ...current,
      unavailable: (q.unavailable ?? []).filter((id) => o.lines.some((l) => l.id === id)),
      ref: q.ref?.trim() || undefined,
      notes: q.notes?.trim() || undefined,
    };
    if (!quote.declined && !Object.keys(quote.prices).length && !quote.unavailable?.length) return Alert.alert(t('rfq.quote'), t('rfq.needPrice'));
    await saveRow(storage.PURCHASE_ORDERS_KEY, { ...o, quotes: (o.quotes ?? []).map((x) => (x.id === quote.id ? quote : x)), updatedAt: Date.now() });
    playSuccessSound();
    back();
  };

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={q.supplier} subtitle={`${t('rfq.quote')} · ${o.no}`} help="Suppliers and quotations" />

      <Card>
        <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm }]}>
          <View style={{ minWidth: 170 }}><SimpleDatePicker label={t('rfq.received')} value={q.receivedAt ?? todayIso()} onChange={(d) => d && set({ receivedAt: d })} /></View>
          <Dropdown caption={t('fin.currency')} value={q.currency} onChange={(c: string) => set({ currency: c })} options={[...new Set([q.currency, ...CURRENCIES])].map((c) => ({ value: c, label: c }))} style={{ width: 150 }} />
          <TouchableOpacity style={styles.small} onPress={() => void fromExcel()}><Text style={styles.smallText}>{t('rfq.fromExcel')}</Text></TouchableOpacity>
        </View>
        {note ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${note}`}</Text> : null}
        <TouchableOpacity style={styles.toggle} onPress={() => set({ declined: !q.declined })}>
          <Text style={{ fontSize: 18 }}>{q.declined ? '☑' : '☐'}</Text>
          <Text style={styles.toggleText}>{t('rfq.declinedQ')}</Text>
        </TouchableOpacity>
      </Card>

      {!q.declined ? (
        <>
          <Label style={{ marginTop: SIZES.md }}>{t('rfq.unitPrices', { cur: q.currency })}</Label>
          {o.lines.map((l, i) => {
            const na = q.unavailable?.includes(l.id);
            return (
              <View key={l.id} style={[styles.item, { borderLeftColor: na ? COLORS.textLight : typed[l.id] ? COLORS.success : COLORS.warning }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, na ? { color: COLORS.textLight, textDecorationLine: 'line-through' } : null]}>{`${i + 1}. ${l.description || l.impa || ''}`}</Text>
                    <Text style={styles.sub}>{[`${l.qty} ${l.unit}`, l.partNo, l.impa ? `IMPA ${l.impa}` : '', l.maker].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {!na ? (
                    <TextInput
                      style={[styles.input, { width: 110, marginTop: 0, textAlign: 'right' }]}
                      value={typed[l.id] ?? ''}
                      onChangeText={(v) => setTyped({ ...typed, [l.id]: v })}
                      keyboardType="decimal-pad"
                      placeholder={t('po.price')}
                      accessibilityLabel={`${t('po.price')} ${i + 1}`}
                    />
                  ) : null}
                </View>
                <TouchableOpacity onPress={() => toggleNa(l.id)}>
                  <Text style={[styles.link, { fontSize: SIZES.small }]}>{na ? t('rfq.canSupply') : t('rfq.cantSupply')}</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <Card>
            <View style={[styles.row, { gap: SIZES.sm, marginVertical: 0 }]}>
              <View><Text style={styles.sub}>{t('rfq.delivery')}</Text><TextInput style={[styles.input, { width: 120 }]} value={extra.delivery} onChangeText={(v) => setExtra({ ...extra, delivery: v })} keyboardType="decimal-pad" accessibilityLabel={t('rfq.delivery')} /></View>
              <View><Text style={styles.sub}>{t('rfq.discount')}</Text><TextInput style={[styles.input, { width: 90 }]} value={extra.discount} onChangeText={(v) => setExtra({ ...extra, discount: v })} keyboardType="decimal-pad" accessibilityLabel={t('rfq.discount')} /></View>
              <View><Text style={styles.sub}>{t('rfq.lead')}</Text><TextInput style={[styles.input, { width: 90 }]} value={extra.lead} onChangeText={(v) => setExtra({ ...extra, lead: v })} keyboardType="number-pad" accessibilityLabel={t('rfq.lead')} /></View>
              <View style={{ minWidth: 170 }}><SimpleDatePicker label={t('rfq.valid')} value={q.validUntil ?? ''} onChange={(d) => set({ validUntil: d || undefined })} onClear={() => set({ validUntil: undefined })} placeholder="—" /></View>
            </View>
            <Text style={styles.sub}>{t('rfq.theirRef')}</Text>
            <TextInput style={[styles.input, { maxWidth: 260 }]} value={q.ref ?? ''} onChangeText={(v) => set({ ref: v })} accessibilityLabel={t('rfq.theirRef')} />
            <Text style={[styles.name, { marginTop: SIZES.md }]}>{`${t('rfq.total')}: ${money(tt.total, q.currency)}`}</Text>
            <Text style={styles.sub}>{`${t('rfq.goods')} ${money(tt.goods, q.currency)}${tt.discount ? ` − ${money(tt.discount, q.currency)}` : ''}${tt.delivery ? ` + ${t('rfq.delivery').toLowerCase()} ${money(tt.delivery, q.currency)}` : ''}`}</Text>
            <Text style={[styles.sub, { color: tt.complete ? COLORS.success : COLORS.warning }]}>{tt.complete ? t('rfq.complete') : t('rfq.priced', { k: tt.priced, n: o.lines.length })}</Text>
          </Card>
        </>
      ) : null}

      <Text style={styles.sub}>{t('fin.notes')}</Text>
      <TextInput style={styles.input} value={q.notes ?? ''} onChangeText={(v) => set({ notes: v })} multiline accessibilityLabel={t('fin.notes')} />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
        <TouchableOpacity onPress={back}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
      </View>
    </Screen>
  );
}
