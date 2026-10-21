// ===================================
// Landings — list of landing / handover reports (#27, Oct 2026)
// ===================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SIZES } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { BackButton, Empty, ScreenTitle } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { LandingReport } from '../types/movement';
import { t, tn, useT, type UiKey } from '../utils/i18n';

const DIR_CFG: Record<'out' | 'in' | 'received', { bg: string; text: string; label: UiKey }> = {
  out:      { bg: '#fef3c7', text: '#92400e', label: 'land.dir.out' },
  in:       { bg: '#dcfce7', text: '#166534', label: 'land.dir.in' },
  received: { bg: '#dbeafe', text: '#1e40af', label: 'land.dir.received' },
};

export default function LandingsSc() {
  useT();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const { landings } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const sorted = [...landings].filter((r) => !r.deleted).sort((a, b) => b.updatedAt - a.updatedAt);

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    list: { padding: SIZES.md },
    card: { backgroundColor: COLORS.cardSolid, borderRadius: 10, padding: SIZES.md, marginBottom: SIZES.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    no: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    dir: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    sub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    btnRow: { flexDirection: 'row', gap: SIZES.sm, margin: SIZES.md, marginTop: 0 },
    btn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 10, padding: SIZES.md, alignItems: 'center' },
    btn2: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, padding: SIZES.md, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  });

  const renderItem = ({ item: r }: { item: LandingReport }) => {
    const cfg = DIR_CFG[r.dir] ?? DIR_CFG.out;
    const count = r.movementIds.length;
    const dest = r.supplier || r.to || r.port || '—';
    return (
      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('LandingReport', { id: r.id })}>
        <View style={styles.row}>
          <Text style={styles.no}>{r.no}</Text>
          <Text style={[styles.dir, { backgroundColor: cfg.bg, color: cfg.text }]}>{t(cfg.label)}</Text>
        </View>
        <Text style={styles.sub}>{r.date} · {dest} · {tn('n.item', count)}</Text>
        {r.notes ? <Text style={[styles.sub, { marginTop: 3 }]}>{r.notes}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenTitle title={t('land.title')} />
      <BackButton onPress={() => nav.goBack()} fav={false} />
      {canEdit && (
        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('LandingReport', { id: 'new' })}>
            <Text style={styles.btnText}>{t('land.newLanding')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btn2} onPress={() => nav.navigate('LandingReport', { id: 'new', initDir: 'received' })}>
            <Text style={styles.btnText}>{t('land.newReceiving')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={sorted}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty text={t('land.empty')} />}
      />
    </SafeAreaView>
  );
}
