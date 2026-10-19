// ===================================
// Deck watch log (вахтенный журнал мостика) — list of signed entries.
// Bridge watch officer fills one entry per watch period: position,
// course, speed, weather conditions, remarks — then signs.
// ===================================

import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { DeckEntry } from '../types/deckLog';
import { PERIOD_LABEL, positionStr, sortDeckEntries, weatherSummary } from '../services/deckLog';
import { formatDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';

export default function DeckLogSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { deckLog } = useData();

  const sorted = useMemo(() => sortDeckEntries(deckLog), [deckLog]);

  const renderItem = ({ item }: { item: DeckEntry }) => {
    const pos = positionStr(item);
    const weather = weatherSummary(item);
    return (
      <TouchableOpacity style={styles.row} onPress={() => nav.navigate('DeckEntry', { entryId: item.id })} activeOpacity={0.75}>
        <View style={styles.rowLeft}>
          <Text style={styles.period}>{PERIOD_LABEL[item.period]}</Text>
          <Text style={styles.dateText}>{formatDate(item.date)} · {item.time}</Text>
          {!!pos && <Text style={styles.pos}>{pos}</Text>}
          <Text style={styles.weather}>{weather}</Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={styles.signer}>{item.by}</Text>
          {!!item.byRank && <Text style={styles.rank}>{item.byRank}</Text>}
          <MciIcon name="chevron-right" size={16} color={COLORS.textLight} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav, 'Maintenance')} fav={false} />
          <Text style={styles.headerTitle}>Deck Watch Log</Text>
          <TouchableOpacity onPress={() => nav.navigate('DeckEntry', {})} hitSlop={8} style={{ marginLeft: 'auto' }}>
            <MciIcon name="plus" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.empty}>
            <MciIcon name="book-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>No watch entries yet</Text>
            <Text style={styles.emptySub}>Tap + to record the first watch.</Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(e) => e.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.lg,
      paddingBottom: SIZES.sm,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: C.text, marginLeft: SIZES.sm },
    list: { padding: SIZES.md, gap: SIZES.sm },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SIZES.sm, padding: SIZES.xl },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textLight },
    emptySub: { fontSize: 13, color: C.textLight, textAlign: 'center' },
    row: {
      backgroundColor: C.card,
      borderRadius: 10,
      padding: SIZES.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SIZES.md,
    },
    rowLeft: { flex: 1, gap: 2 },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    period: { fontSize: 15, fontWeight: '600', color: C.text },
    dateText: { fontSize: 12, color: C.textLight },
    pos: { fontSize: 12, color: C.primary, fontVariant: ['tabular-nums'] },
    weather: { fontSize: 12, color: C.textLight },
    signer: { fontSize: 12, fontWeight: '600', color: C.text },
    rank: { fontSize: 11, color: C.textLight },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
  });
}
