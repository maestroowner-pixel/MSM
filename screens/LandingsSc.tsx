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

export default function LandingsSc() {
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const { landings, itemMovements } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const sorted = [...landings].sort((a, b) => b.updatedAt - a.updatedAt);

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    list: { padding: SIZES.md },
    card: { backgroundColor: COLORS.cardSolid, borderRadius: 10, padding: SIZES.md, marginBottom: SIZES.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    no: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    dir: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    sub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    btn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: SIZES.md, margin: SIZES.md, marginTop: 0, alignItems: 'center' },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });

  const dirBg = (dir: 'out' | 'in') => dir === 'out' ? '#fef3c7' : '#dcfce7';
  const dirText = (dir: 'out' | 'in') => dir === 'out' ? '#92400e' : '#166534';
  const dirLabel = (dir: 'out' | 'in') => dir === 'out' ? 'Sent ashore' : 'Returned';

  const renderItem = ({ item: r }: { item: LandingReport }) => {
    const count = r.movementIds.length;
    const dest = r.to || r.port || '—';
    return (
      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('LandingReport', { id: r.id })}>
        <View style={styles.row}>
          <Text style={styles.no}>{r.no}</Text>
          <Text style={[styles.dir, { backgroundColor: dirBg(r.dir), color: dirText(r.dir) }]}>
            {dirLabel(r.dir)}
          </Text>
        </View>
        <Text style={styles.sub}>{r.date} · {dest} · {count} item{count !== 1 ? 's' : ''}</Text>
        {r.notes ? <Text style={[styles.sub, { marginTop: 3 }]}>{r.notes}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenTitle title="Landing Reports" />
      <BackButton onPress={() => nav.goBack()} fav={false} />
      {canEdit && (
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('LandingReport', { id: 'new' })}>
          <Text style={styles.btnText}>+ New landing report</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={sorted}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty text="No landing reports yet" />}
      />
    </SafeAreaView>
  );
}
