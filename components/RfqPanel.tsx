// ===================================
// Quotations on a purchase order (types/orders.ts Quote / Award, services/rfq.ts).
//
// Before the order is sent: ask suppliers (from the directory or by name), give
// each the request as PDF or Excel, enter their quotes (screens/QuoteSc), see the
// quotes side by side — the lowest price per line starred, totals, complete or
// not — and award the order. Awarding writes the supplier and their prices onto
// the order; anyone but the cheapest complete quote needs a reason. Once the
// order is sent the panel is the record and is read only.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import SimpleDatePicker from './SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { PurchaseOrder, Quote } from '../types/orders';
import { Supplier } from '../types/suppliers';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { money } from '../services/finance';
import { awardOrder, awardProblem, compareQuotes, findSuppliers, quoteTotal } from '../services/rfq';
import { comparisonSheet, exportComparison, exportRfq, rfqSheet } from '../services/rfqSheet';
import { uid } from '../utils/id';
import { uiDate } from '../utils/dates';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';
import { t, tk, useT } from '../utils/i18n';

export function RfqPanel({ o, editable, by }: { o: PurchaseOrder; editable: boolean; by: string }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { suppliers, saveRow, vessel } = useData();
  const [query, setQuery] = useState('');
  const [awarding, setAwarding] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const quotes = o.quotes ?? [];
  const c = useMemo(() => compareQuotes(o), [o]);
  const asked = new Set(quotes.map((q) => (q.supplierId ?? q.supplier.trim().toLowerCase())));
  const matches = query.trim() ? findSuppliers(suppliers, query).filter((s) => !asked.has(s.id)).slice(0, 6) : [];
  const exact = suppliers.some((s) => !s.deleted && s.name.trim().toLowerCase() === query.trim().toLowerCase());

  const save = (patch: Partial<PurchaseOrder>) => saveRow(storage.PURCHASE_ORDERS_KEY, { ...o, ...patch, updatedAt: Date.now() });
  const done = (w: string | null | void) => {
    if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  };
  const fail = (e: any) => Alert.alert(t('rfq.title'), String(e?.message ?? e));

  const ask = async (s: Supplier | null, name: string) => {
    const n = (s?.name ?? name).trim();
    if (!n) return;
    if (asked.has(s?.id ?? n.toLowerCase())) return;
    const q: Quote = { id: uid('qt'), supplier: n, ...(s ? { supplierId: s.id } : {}), askedAt: todayIso(), currency: s?.currency ?? quotes[0]?.currency ?? 'EUR', prices: {} };
    await save({ quotes: [...quotes, q] });
    setQuery('');
  };
  const remove = (q: Quote) =>
    Alert.alert(t('rfq.removeQ', { name: q.supplier }), t('rfq.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void save({ quotes: quotes.filter((x) => x.id !== q.id) }) },
    ]);

  const award = async (q: Quote) => {
    const why = awardProblem(o, q.id, reason);
    if (why) return Alert.alert(t('rfq.award'), tk(why));
    const next = awardOrder(o, q.id, by, todayIso(), c.cheapestId === q.id ? undefined : reason);
    await saveRow(storage.PURCHASE_ORDERS_KEY, next);
    playSuccessSound();
    setAwarding(null);
    setReason('');
    const t2 = quoteTotal(o, q);
    if (t2.unavailable.length || t2.missing.length) Alert.alert(t('rfq.award'), t('rfq.gapsAfterAward', { n: t2.unavailable.length + t2.missing.length, name: q.supplier }));
  };

  const all = [...c.ranked, ...c.other];
  const stateOf = (q: Quote) => {
    if (!q.receivedAt) return { text: t('rfq.waiting', { date: uiDate(q.askedAt) }), color: COLORS.warning };
    if (q.declined) return { text: t('rfq.declined'), color: COLORS.textLight };
    const tt = quoteTotal(o, q);
    const tail = tt.complete ? '' : ` · ${t('rfq.priced', { k: tt.priced, n: o.lines.length })}`;
    return { text: `${money(tt.total, q.currency)}${tail}`, color: c.cheapestId === q.id ? COLORS.success : COLORS.textDark };
  };

  return (
    <Card style={{ marginTop: SIZES.md }}>
      <Label>{t('rfq.title')}</Label>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
      {!quotes.length ? <Text style={styles.sub}>{editable ? t('rfq.intro') : t('rfq.none')}</Text> : null}

      {editable ? (
        <>
          <View style={{ maxWidth: 220 }}>
            <SimpleDatePicker label={t('rfq.quoteBy')} value={o.quoteBy ?? ''} onChange={(d) => void save({ quoteBy: d || undefined })} onClear={() => void save({ quoteBy: undefined })} placeholder="—" />
          </View>
          <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder={t('rfq.askPh')} accessibilityLabel={t('rfq.ask')} onSubmitEditing={() => void ask(matches[0] ?? null, query)} />
          {query.trim() ? (
            <View style={styles.chips}>
              {matches.map((s) => (
                <TouchableOpacity key={s.id} style={styles.chip} onPress={() => void ask(s, s.name)}>
                  <Text style={styles.chipText}>{`+ ${s.name}${s.country ? ` · ${s.country}` : ''}`}</Text>
                </TouchableOpacity>
              ))}
              {!exact ? (
                <TouchableOpacity style={styles.chip} onPress={() => void ask(null, query)}>
                  <Text style={styles.chipText}>{t('rfq.askNew', { name: query.trim() })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </>
      ) : o.quoteBy ? <Text style={styles.sub}>{`${t('rfq.quoteBy')}: ${uiDate(o.quoteBy)}`}</Text> : null}

      {quotes.map((q) => {
        const st = stateOf(q);
        const won = o.award?.quoteId === q.id;
        return (
          <View key={q.id} style={[styles.item, { borderLeftColor: won ? COLORS.success : st.color, marginTop: SIZES.xs }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{`${q.supplier}${won ? `  ✓ ${t('rfq.awarded')}` : c.cheapestId === q.id && c.ranked.length > 1 ? `  ★ ${t('rfq.cheapest')}` : ''}`}</Text>
                <Text style={[styles.sub, { color: st.color }]}>{st.text}</Text>
                {q.receivedAt && !q.declined ? (
                  <Text style={styles.sub}>{[q.leadDays != null ? t('rfq.leadN', { n: q.leadDays }) : '', q.validUntil ? t('rfq.validTo', { date: uiDate(q.validUntil) }) : '', q.ref ?? '', c.other.some((x) => x.q.id === q.id) ? t('rfq.otherCur', { cur: c.currency ?? '' }) : ''].filter(Boolean).join(' · ')}</Text>
                ) : null}
              </View>
            </View>
            <View style={[styles.row, { gap: SIZES.xs, marginBottom: 0 }]}>
              {editable ? <TouchableOpacity style={styles.small} onPress={() => void exportRfq(o, q, vessel).then(done, fail)}><Text style={styles.smallText}>{t('rfq.rfqPdf')}</Text></TouchableOpacity> : null}
              {editable ? <TouchableOpacity style={styles.small} onPress={() => void rfqSheet(o, q, vessel).then(done, fail)}><Text style={styles.smallText}>{t('rfq.rfqExcel')}</Text></TouchableOpacity> : null}
              {editable ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('Quote', { po: o.id, id: q.id })}><Text style={styles.smallText}>{q.receivedAt ? t('rfq.editQuote') : t('rfq.enterQuote')}</Text></TouchableOpacity> : null}
              {editable && q.receivedAt && !q.declined && !won ? (
                <TouchableOpacity style={styles.small} onPress={() => { setAwarding(awarding === q.id ? null : q.id); setReason(''); }}><Text style={styles.smallText}>{t('rfq.award')}</Text></TouchableOpacity>
              ) : null}
              {editable && !won ? <TouchableOpacity onPress={() => remove(q)}><Text style={[styles.link, { color: COLORS.danger, marginTop: 0 }]}>{t('common.delete')}</Text></TouchableOpacity> : null}
            </View>
            {awarding === q.id ? (
              <View>
                {c.cheapestId !== q.id ? (
                  <>
                    <Text style={[styles.sub, { color: COLORS.warning }]}>{c.cheapestId ? t('rfq.notCheapest') : t('rfq.noComplete')}</Text>
                    <TextInput style={styles.input} value={reason} onChangeText={setReason} placeholder={t('rfq.reasonPh')} accessibilityLabel={t('rfq.reason')} />
                  </>
                ) : null}
                <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => void award(q)}>
                  <Text style={styles.btnText}>{t('rfq.awardTo', { name: q.supplier })}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        );
      })}

      {all.length ? (
        <>
          <Text style={[styles.sub, { marginTop: SIZES.sm, fontWeight: '700' }]}>{t('rfq.compare')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[styles.sub, { width: 180, fontWeight: '700' }]}>{t('mo.lines')}</Text>
                {all.map(({ q }) => <Text key={q.id} numberOfLines={1} style={[styles.sub, { width: 110, textAlign: 'right', fontWeight: '700' }]}>{q.supplier}</Text>)}
              </View>
              {o.lines.map((l) => (
                <View key={l.id} style={{ flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingVertical: 2 }}>
                  <Text numberOfLines={1} style={[styles.sub, { width: 180, color: COLORS.textDark }]}>{`${l.description || l.impa || ''} × ${l.qty}`}</Text>
                  {all.map(({ q }) => {
                    const na = q.unavailable?.includes(l.id);
                    const p = q.prices[l.id];
                    const best = c.ranked.length > 1 && c.bestByLine[l.id]?.includes(q.id);
                    return (
                      <Text key={q.id} style={[styles.sub, { width: 110, textAlign: 'right', color: best ? COLORS.success : COLORS.textDark, fontWeight: best ? '800' : '400' }]}>
                        {na ? 'n/a' : p != null ? `${money(p, '').trim()}${best ? ' ★' : ''}` : '—'}
                      </Text>
                    );
                  })}
                </View>
              ))}
              <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 2 }}>
                <Text style={[styles.sub, { width: 180, fontWeight: '700' }]}>{t('rfq.total')}</Text>
                {all.map(({ q, t: tt }) => <Text key={q.id} style={[styles.sub, { width: 110, textAlign: 'right', fontWeight: '800', color: c.cheapestId === q.id ? COLORS.success : COLORS.textDark }]}>{money(tt.total, q.currency)}</Text>)}
              </View>
            </View>
          </ScrollView>
          <Text style={styles.sub}>{t('rfq.compareNote')}</Text>
        </>
      ) : null}

      {o.award ? (
        <Text style={[styles.sub, { marginTop: SIZES.sm, color: COLORS.textDark }]}>
          {`${t('rfq.awardedTo', { name: o.award.supplier, sum: money(o.award.total, o.award.currency), date: uiDate(o.award.at), by: o.award.by })}${o.award.reason ? ` · ${t('rfq.reason')}: ${o.award.reason}` : ''}`}
        </Text>
      ) : null}

      {quotes.length ? (
        <View style={[styles.row, { gap: SIZES.xs }]}>
          <TouchableOpacity style={styles.small} onPress={() => void exportComparison(o, vessel).then(done, fail)}><Text style={styles.smallText}>{t('rfq.comparePdf')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} onPress={() => void comparisonSheet(o, vessel).then(done, fail)}><Text style={styles.smallText}>{t('rfq.compareExcel')}</Text></TouchableOpacity>
        </View>
      ) : null}
    </Card>
  );
}
