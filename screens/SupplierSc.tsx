// ===================================
// One supplier — the contact card (officers edit it) and its record worked out
// from the purchase orders (services/rfq.ts supplierStats): quotes asked,
// answered and won, days to answer, orders on time and complete, the last price
// charged per item, and the orders themselves.
// A supplier is retired, not deleted: orders keep naming it.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Linking, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { ORDER_DEPTS } from '../types/orders';
import { Supplier } from '../types/suppliers';
import { CURRENCIES } from '../types/finance';
import * as storage from '../services/storage';
import { money } from '../services/finance';
import { supplierStats } from '../services/rfq';
import { uid } from '../utils/id';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const pct = (k: number, n: number) => `${Math.round((k / n) * 100)} %`;

export default function SupplierSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { suppliers, purchaseOrders, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isNew = route.params?.id === 'new';
  const stored = suppliers.find((s) => s.id === route.params?.id);
  const [draft, setDraft] = useState<Supplier | null>(() => (isNew ? { id: uid('sup'), name: '', currency: 'EUR', updatedAt: Date.now() } : null));
  const [showAll, setShowAll] = useState(false);
  const back = () => goBackOr(nav, 'Suppliers');

  const s = draft ?? stored;
  const stats = useMemo(() => (stored ? supplierStats(stored, purchaseOrders) : null), [stored, purchaseOrders]);
  const theirOrders = useMemo(() => (stored ? purchaseOrders.filter((o) => !o.deleted && (o.supplierId ? o.supplierId === stored.id : o.supplier?.trim().toLowerCase() === stored.name.trim().toLowerCase())).sort((a, b) => b.date.localeCompare(a.date)) : []), [stored, purchaseOrders]);

  if (!s) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('mo.notHere')}</Text>
      </Screen>
    );
  }

  const set = (patch: Partial<Supplier>) => setDraft({ ...(draft ?? s), ...patch });
  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return Alert.alert(t('sup.title'), t('sup.needName'));
    if (suppliers.some((x) => x.id !== draft.id && x.name.trim().toLowerCase() === name.toLowerCase())) return Alert.alert(t('sup.title'), t('sup.dup', { name }));
    const clean = Object.fromEntries(Object.entries({ ...draft, name }).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || undefined : v])) as unknown as Supplier;
    await saveRow(storage.SUPPLIERS_KEY, clean);
    playSuccessSound();
    setDraft(null);
    if (isNew) nav.replace('Supplier', { id: clean.id });
  };
  const retire = () =>
    Alert.alert(t('sup.retireQ', { name: s.name }), t('sup.retireBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sup.retire'), style: 'destructive', onPress: async () => { await saveRow(storage.SUPPLIERS_KEY, { ...s, deleted: true }); back(); } },
    ]);

  const field = (key: keyof Supplier, label: string, opts: { kb?: any; multiline?: boolean } = {}) => (
    <>
      <Text style={styles.sub}>{label}</Text>
      <TextInput style={styles.input} value={(draft?.[key] as string) ?? ''} onChangeText={(v) => set({ [key]: v } as Partial<Supplier>)} keyboardType={opts.kb} multiline={opts.multiline} autoCapitalize={opts.kb ? 'none' : 'sentences'} accessibilityLabel={label} />
    </>
  );

  const shownPrices = stats ? (showAll ? stats.lastPrices : stats.lastPrices.slice(0, 15)) : [];

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={isNew ? t('sup.new') : s.name} subtitle={t('sup.title')} help="Suppliers and quotations" />

      {draft ? (
        <Card>
          {field('name', t('sup.name'))}
          {field('contact', t('sup.contact'))}
          {field('email', t('sup.email'), { kb: 'email-address' })}
          {field('phone', t('sup.phone'), { kb: 'phone-pad' })}
          {field('country', t('sup.country'))}
          {field('ports', t('sup.ports'))}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('sup.depts')}</Text>
          <View style={styles.chips}>
            {ORDER_DEPTS.map((d) => {
              const on = draft.depts?.includes(d);
              return (
                <TouchableOpacity key={d} style={[styles.chip, on && styles.chipOn]} onPress={() => set({ depts: on ? draft.depts!.filter((x) => x !== d) : [...(draft.depts ?? []), d] })}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{tk(`od.${d}`)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Dropdown caption={t('sup.currency')} value={draft.currency ?? 'EUR'} onChange={(c: string) => set({ currency: c })} options={CURRENCIES.map((c) => ({ value: c, label: c }))} style={{ width: 170 }} />
          {field('terms', t('sup.terms'))}
          {field('notes', t('fin.notes'), { multiline: true })}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew ? back() : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <Card>
          {s.contact ? <Text style={styles.body}>{s.contact}</Text> : null}
          {s.email ? <TouchableOpacity onPress={() => void Linking.openURL(`mailto:${s.email}`)}><Text style={styles.link}>{s.email}</Text></TouchableOpacity> : null}
          {s.phone ? <TouchableOpacity onPress={() => void Linking.openURL(`tel:${s.phone!.replace(/[^\d+]/g, '')}`)}><Text style={styles.link}>{s.phone}</Text></TouchableOpacity> : null}
          <Text style={styles.sub}>{[s.country, s.ports].filter(Boolean).join(' · ')}</Text>
          {s.depts?.length ? <Text style={styles.sub}>{s.depts.map((d) => tk(`od.${d}`)).join(', ')}</Text> : null}
          <Text style={styles.sub}>{[s.currency, s.terms].filter(Boolean).join(' · ')}</Text>
          {s.notes ? <Text style={styles.body}>{s.notes}</Text> : null}
          {officer ? (
            <View style={[styles.row, { gap: SIZES.sm }]}>
              <TouchableOpacity style={styles.small} onPress={() => setDraft(s)}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={retire}><Text style={[styles.link, { color: COLORS.danger, marginTop: 0 }]}>{t('sup.retire')}</Text></TouchableOpacity>
            </View>
          ) : null}
        </Card>
      )}

      {stats && !draft ? (
        <>
          <Label style={{ marginTop: SIZES.md }}>{t('sup.record')}</Label>
          <Card>
            <Text style={styles.body}>{stats.asked ? t('sup.quotesLine', { asked: stats.asked, ans: stats.answered, won: stats.won }) : t('sup.noQuotes')}</Text>
            {stats.replyDays != null ? <Text style={styles.sub}>{t('sup.replyDays', { n: stats.replyDays })}</Text> : null}
            <Text style={[styles.body, { marginTop: SIZES.sm }]}>{stats.orders ? t('sup.ordersLine', { n: stats.orders, rcv: stats.received }) : t('sup.noOrders')}</Text>
            {stats.withDate ? <Text style={styles.sub}>{t('sup.onTimeLine', { k: stats.onTime, n: stats.withDate, pct: pct(stats.onTime, stats.withDate) })}</Text> : null}
            {stats.received ? <Text style={styles.sub}>{t('sup.completeLine', { k: stats.complete, n: stats.received, pct: pct(stats.complete, stats.received) })}</Text> : null}
          </Card>

          {stats.lastPrices.length ? (
            <>
              <Label style={{ marginTop: SIZES.md }}>{t('sup.lastPrices')}</Label>
              {shownPrices.map((p) => (
                <View key={p.key} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
                  <Text style={[styles.sub, { flex: 1, color: COLORS.textDark }]} numberOfLines={1}>{p.description}</Text>
                  <Text style={[styles.sub, { fontWeight: '700', color: COLORS.textDark }]}>{money(p.price, p.currency)}</Text>
                  <Text style={[styles.sub, { width: 150, textAlign: 'right' }]} numberOfLines={1}>{`${uiDate(p.date)} · ${p.poNo}`}</Text>
                </View>
              ))}
              {stats.lastPrices.length > shownPrices.length ? <TouchableOpacity onPress={() => setShowAll(true)}><Text style={styles.link}>{t('fin.showAll', { n: stats.lastPrices.length })}</Text></TouchableOpacity> : null}
            </>
          ) : null}

          {theirOrders.length ? (
            <>
              <Label style={{ marginTop: SIZES.md }}>{t('sup.orders')}</Label>
              {theirOrders.slice(0, 30).map((o) => (
                <TouchableOpacity key={o.id} style={[styles.item, { borderLeftColor: o.status === 'received' ? COLORS.success : COLORS.primary }]} onPress={() => nav.navigate('Order', { id: o.id })}>
                  <Text style={styles.name}>{o.no}</Text>
                  <Text style={styles.sub}>{[uiDate(o.date), tk(`po.st.${o.status}`), o.deliveryDate ? `${t('po.deliveryDate')} ${uiDate(o.deliveryDate)}` : '', o.receivedAt ? `✓ ${uiDate(o.receivedAt)}` : ''].filter(Boolean).join(' · ')}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
