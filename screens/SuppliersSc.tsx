// ===================================
// Supplier directory (types/suppliers.ts) — the list, searchable, each with its
// record from the orders (services/rfq.ts supplierStats): quotes won of asked,
// orders on time. Tap opens the supplier (screens/SupplierSc).
// ===================================

import React, { useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { findSuppliers, supplierStats } from '../services/rfq';
import { goBackOr } from '../utils/nav';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

export default function SuppliersSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { suppliers, purchaseOrders } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [query, setQuery] = useState('');

  const list = useMemo(() => findSuppliers(suppliers, query), [suppliers, query]);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Main', { screen: 'Orders' })} />
      <ScreenTitle title={t('sup.title')} subtitle={t('sup.sub')} help="Suppliers and quotations" />
      <View style={[styles.row, { gap: SIZES.xs }]}>
        <TextInput style={[styles.input, { flex: 1, minWidth: 200, marginTop: 0 }]} value={query} onChangeText={setQuery} placeholder={t('sup.searchPh')} accessibilityLabel={t('sup.search')} />
        {officer ? <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Supplier', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('sup.new')}`}</Text></TouchableOpacity> : null}
      </View>
      {!suppliers.length ? <Text style={styles.sub}>{t('sup.empty')}</Text> : null}
      {suppliers.length && !list.length ? <Text style={styles.sub}>{t('sup.noMatch')}</Text> : null}
      {list.map((s) => {
        const st = supplierStats(s, purchaseOrders);
        const facts = [
          st.asked ? t('sup.wonOf', { k: st.won, n: st.asked }) : '',
          st.withDate ? t('sup.onTime', { pct: Math.round((st.onTime / st.withDate) * 100) }) : '',
          st.orders ? t('sup.ordersN', { n: st.orders }) : '',
        ].filter(Boolean);
        return (
          <TouchableOpacity key={s.id} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => nav.navigate('Supplier', { id: s.id })}>
            <Text style={styles.name}>{s.name}</Text>
            <Text style={styles.sub}>{[s.country, s.ports, (s.depts ?? []).map((d) => tk(`od.${d}`)).join(', ')].filter(Boolean).join(' · ') || s.email || s.phone || ''}</Text>
            {facts.length ? <Text style={styles.sub}>{facts.join(' · ')}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
