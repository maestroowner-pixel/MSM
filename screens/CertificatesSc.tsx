// ===================================
// Certificates — list of certificates (each can cover one or many items).
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, StatusPill, Empty, statusColor } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { statusFromDate, formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { Certificate } from '../types/certificate';

export default function CertificatesSc() {
  const { certificates } = useData();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();
  const cols = width >= 600 ? 2 : 1;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? certificates.filter((c) =>
          [c.name, c.number, c.issuer].some((v) => v?.toLowerCase().includes(needle))
        )
      : certificates;
    return [...filtered].sort((a, b) => {
      const da = a.expiryDate ?? '9999';
      const db = b.expiryDate ?? '9999';
      return da.localeCompare(db);
    });
  }, [certificates, q]);

  const newCert: Certificate = {
    id: uid('cert'),
    name: '',
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Certificates</Text>
          <Text style={styles.sub}>{certificates.length} certificates · link items to a group certificate</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => nav.navigate('CertificateDetail', { id: null, draft: newCert })}
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {certificates.length > 0 ? (
        <TextInput
          style={styles.search}
          placeholder="Search name, number, issuer…"
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
        />
      ) : null}

      {list.length === 0 ? (
        <Empty text="No certificates yet. Tap ＋ to add one and link the items it covers." />
      ) : (
        <FlatList
          data={list}
          key={cols}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? { gap: SIZES.sm } : undefined}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          renderItem={({ item }) => {
            const status = statusFromDate(item.expiryDate);
            return (
              <TouchableOpacity
                style={[styles.row, cols > 1 && { flex: 1 }]}
                activeOpacity={0.7}
                onPress={() => nav.navigate('CertificateDetail', { id: item.id })}
              >
                <View style={[styles.bar, { backgroundColor: statusColor(status) }]} />
                <Text style={styles.rowEmoji}>{item.fileKind === 'photo' ? '🖼️' : '📜'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.name || 'Untitled certificate'}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[item.number && `№ ${item.number}`, `${item.itemIds.length} item${item.itemIds.length === 1 ? '' : 's'}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.expiryDate ? <Text style={styles.rowDate}>{formatDate(item.expiryDate)}</Text> : null}
                  <StatusPill status={status} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.md, gap: SIZES.sm },
  title: { fontSize: SIZES.h2, fontWeight: '700', color: COLORS.textDark },
  sub: { fontSize: SIZES.small, color: COLORS.textLight },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: COLORS.textWhite, fontSize: 26, lineHeight: 28, fontWeight: '600' },
  search: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    paddingRight: SIZES.md,
    paddingLeft: 0,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.sm },
  rowEmoji: { fontSize: 22, marginRight: SIZES.sm },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.small, color: COLORS.text, marginBottom: 2 },
});
