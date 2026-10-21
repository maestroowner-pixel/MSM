// ===================================
// Deck watch log (вахтенный журнал мостика) — entries by day.
// Calendar strip at top: tap a day or use ← → arrows to navigate.
// Each day is one "page"; past entries live on their date's page.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MciIcon } from '../components/MciIcon';
import { DateNav, buildDays, todayISO } from '../components/LogDayStrip';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { DeckEntry } from '../types/deckLog';
import { PERIOD_LABEL, positionStr, sortDeckEntries, weatherSummary } from '../services/deckLog';
import { shareDeckLogPage } from '../services/deckLogReport';
import { seedDeckLog, clearDeckLog, seedInspectorVisit } from '../services/deckLogSeed';
import { t, useT } from '../utils/i18n';

export default function DeckLogSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { deckLog, vessel, saveRows, flat } = useData();

  const [selectedDate, setSelectedDate] = useState(todayISO);

  const sorted = useMemo(() => sortDeckEntries(deckLog), [deckLog]);

  const entryDates = useMemo(() => sorted.map((e) => e.date), [sorted]);

  const days = useMemo(() => buildDays(entryDates), [entryDates]);

  const entryCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of sorted) m[e.date] = (m[e.date] ?? 0) + 1;
    return m;
  }, [sorted]);

  const dayEntries = useMemo(
    () => sorted.filter((e) => e.date === selectedDate),
    [sorted, selectedDate],
  );

  const goPrev = () => {
    const i = days.indexOf(selectedDate);
    if (i < days.length - 1) setSelectedDate(days[i + 1]);
  };
  const goNext = () => {
    const i = days.indexOf(selectedDate);
    if (i > 0) setSelectedDate(days[i - 1]);
  };

  const renderItem = ({ item }: { item: DeckEntry }) => {
    const pos = positionStr(item);
    const weather = weatherSummary(item);
    const hasLink = !!(item.landingRef || item.attachmentUri);
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => nav.navigate('DeckEntry', { entryId: item.id })}
        activeOpacity={0.75}
      >
        <View style={styles.rowLeft}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.period}>{PERIOD_LABEL[item.period] ?? item.period}</Text>
            <View style={[styles.modeBadge, item.mode === 'port' ? styles.modeBadgePort : styles.modeBadgeSea]}>
              <Text style={[styles.modeText, item.mode === 'port' ? styles.modeTextPort : styles.modeTextSea]}>
                {item.mode === 'port' ? t('dl.inPort') : t('dl.atSea')}
              </Text>
            </View>
          </View>
          <Text style={styles.timeText}>{item.time}</Text>
          {!!pos && <Text style={styles.pos}>{pos}</Text>}
          {!!weather && <Text style={styles.weather}>{weather}</Text>}
          {!!item.remarks && (
            <Text style={styles.remarks} numberOfLines={2}>{item.remarks}</Text>
          )}
          {hasLink && (
            <TouchableOpacity
              style={styles.linkRow}
              hitSlop={6}
              activeOpacity={0.7}
              onPress={() => {
                if (item.landingRef) nav.navigate('LandingReport', { id: item.landingRef });
              }}
            >
              <MciIcon name="paperclip" size={12} color={COLORS.primary} />
              <Text style={[styles.linkText, { color: COLORS.primary }]}>
                {item.landingNo ?? item.attachmentName ?? t('dl.attached')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.rowRight}>
          {item.draft ? (
            <View style={styles.draftBadge}>
              <MciIcon name="pencil-outline" size={11} color={COLORS.textLight} />
              <Text style={styles.draftText}>{t('dl.unsigned')}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.signer}>{item.by}</Text>
              {!!item.byRank && <Text style={styles.rank}>{item.byRank}</Text>}
            </>
          )}
          <MciIcon name="chevron-right" size={16} color={COLORS.textLight} style={{ marginTop: 4 }} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <MciIcon name="book-open-outline" size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{t('dl.title')}</Text>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: SIZES.sm, alignItems: 'center' }}>
            {dayEntries.length > 0 && (
              <TouchableOpacity
                hitSlop={8}
                onPress={() => shareDeckLogPage(dayEntries, selectedDate, vessel).catch((e) => Alert.alert(t('common.error'), e?.message ?? String(e)))}
              >
                <MciIcon name="share-outline" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
            {__DEV__ && (
              <TouchableOpacity
                hitSlop={8}
                onPress={() =>
                  Alert.alert('Dev seed', 'Choose what to seed:', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: '5-day log',
                      onPress: async () => {
                        try {
                          await clearDeckLog();
                          await saveRows('msm:deck_log', seedDeckLog());
                        } catch (e: any) { Alert.alert('Error', e?.message ?? String(e)); }
                      },
                    },
                    {
                      text: 'PSC Inspector',
                      onPress: async () => {
                        try {
                          const { visitor, landings, movements, deckEntries } = seedInspectorVisit(flat);
                          await saveRows('msm:visitors', [visitor]);
                          await saveRows('msm:landings', landings);
                          await saveRows('msm:item_movements', movements);
                          await saveRows('msm:deck_log', deckEntries);
                          Alert.alert('Done', `Inspector Cpt. Stavros boarded.\n• 3 deck log entries\n• 1 visitor record\n• Landing Report LR-2026-01 (FE + EEBD ashore)`);
                        } catch (e: any) { Alert.alert('Error', e?.message ?? String(e)); }
                      },
                    },
                  ])
                }
              >
                <MciIcon name="database-refresh-outline" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => nav.navigate('DeckEntry', {})} hitSlop={8}>
              <MciIcon name="plus" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Date nav + picker ── */}
        <DateNav
          selected={selectedDate}
          days={days}
          onPrev={goPrev}
          onNext={goNext}
          onPick={setSelectedDate}
          COLORS={COLORS}
        />

        {/* ── Entries for selected day ── */}
        {dayEntries.length === 0 ? (
          <View style={styles.empty}>
            <MciIcon name="book-outline" size={44} color={COLORS.textLight} />
            <Text style={styles.emptyTitle}>{t('dl.noneDay')}</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => nav.navigate('DeckEntry', {})}
              activeOpacity={0.8}
            >
              <MciIcon name="plus-circle-outline" size={18} color={COLORS.textWhite} />
              <Text style={styles.emptyBtnText}>{t('dl.new')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={dayEntries}
            keyExtractor={(e) => e.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListFooterComponent={() => (
              <TouchableOpacity
                style={styles.addRow}
                onPress={() => nav.navigate('DeckEntry', {})}
                activeOpacity={0.75}
              >
                <MciIcon name="plus-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addRowText}>{t('dl.new')}</Text>
              </TouchableOpacity>
            )}
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
      gap: SIZES.sm,
      paddingHorizontal: SIZES.lg,
      paddingBottom: SIZES.sm,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: C.text },
    list: { padding: SIZES.md, gap: SIZES.sm, paddingBottom: SIZES.xxxl },
    empty: {
      flex: 1, justifyContent: 'center', alignItems: 'center',
      gap: SIZES.sm, padding: SIZES.xl,
    },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: C.textLight },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      backgroundColor: C.primary, borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.sm, paddingHorizontal: SIZES.lg,
      marginTop: SIZES.sm,
    },
    emptyBtnText: { color: C.textWhite, fontWeight: '700', fontSize: 14 },
    row: {
      backgroundColor: C.card,
      borderRadius: 10,
      padding: SIZES.md,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SIZES.md,
    },
    rowLeft:  { flex: 1, gap: 2 },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    period:   { fontSize: 15, fontWeight: '600', color: C.text },
    timeText: { fontSize: 12, color: C.textLight },
    pos:      { fontSize: 12, color: C.primary, fontVariant: ['tabular-nums'] },
    weather:  { fontSize: 12, color: C.textLight },
    remarks:  { fontSize: 12, color: C.textLight, marginTop: 2 },
    signer:   { fontSize: 12, fontWeight: '600', color: C.text },
    rank:     { fontSize: 11, color: C.textLight },
    draftBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, opacity: 0.6 },
    draftText:  { fontSize: 11, color: C.textLight, fontStyle: 'italic' },
    linkRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
    linkText: { fontSize: 11, fontWeight: '600', textDecorationLine: 'underline' },
    modeBadge:     { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
    modeBadgeSea:  { backgroundColor: 'rgba(11,37,69,0.12)' },
    modeBadgePort: { backgroundColor: 'rgba(39,174,96,0.15)' },
    modeText:      { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
    modeTextSea:   { color: C.primary },
    modeTextPort:  { color: '#1a8a40' },
    sep:      { height: StyleSheet.hairlineWidth, backgroundColor: C.border },
    addRow: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      paddingVertical: SIZES.md, justifyContent: 'center',
    },
    addRowText: { fontSize: 14, fontWeight: '600', color: C.primary },
  });
}
