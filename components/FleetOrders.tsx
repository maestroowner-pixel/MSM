// ===================================
// The Master's orders as the superintendent sees them in Fleet (types/orderBook.ts):
// the standing orders in force and who aboard has not read them, then the last
// nights — who signed, which are not closed. Read only; Share PDF of a
// revision or of the book. The vessel writes, the office reads (rules).
// ===================================

import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Empty, Label } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { currentStanding, nightState, signStatus, sortNights, standingReaders } from '../services/orderBook';
import { shareNightBook, shareStanding } from '../services/orderBookReport';
import { todayIso } from '../services/pms';
import { nowLocal } from '../services/permits';
import { CrewMember } from '../types/crew';
import { NightOrder, OrderAck, StandingKind, StandingOrder } from '../types/orderBook';
import { nightColor } from '../screens/OrderBookSc';
import { uiDate } from '../utils/dates';
import { t, tk } from '../utils/i18n';

export function FleetOrders({ imo, vesselName, nights, standing, acks, crew, dp }: { imo: string; vesselName: string; nights: NightOrder[]; standing: StandingOrder[]; acks: OrderAck[]; crew: CrewMember[]; dp: boolean }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const today = todayIso();
  const now = nowLocal();
  const vessel = { vessel_name: vesselName, imo } as any;
  const fail = (e: any) => Alert.alert(t('lt.share'), String(e?.message ?? e));
  const kinds: StandingKind[] = dp ? ['master', 'dp'] : ['master'];
  const recent = sortNights(nights).slice(0, 14);

  return (
    <View>
      {kinds.map((k) => {
        const cur = currentStanding(standing, k);
        const st = cur ? signStatus(cur.id, standingReaders(crew, cur.readers), acks) : null;
        return (
          <View key={k} style={[styles.row, { borderLeftColor: st?.unsigned.length ? COLORS.warning : cur ? COLORS.success : COLORS.textLight }]}>
            <Text style={styles.title}>{t(`ob.view.${k}`)}</Text>
            {cur && st ? (
              <>
                <Text style={styles.sub}>{`${t('ob.revInForce', { rev: cur.rev, date: uiDate(cur.issued) })} · ${t('ob.signedOf', { n: st.signed.length, of: st.signed.length + st.unsigned.length })}`}</Text>
                {st.unsigned.length ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('ob.notYet', { names: st.unsigned.map((r) => r.name).join(', ') })}</Text> : null}
                <TouchableOpacity style={styles.small} onPress={() => void shareStanding(cur, standing, acks, crew, vessel, today, true).catch(fail)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
              </>
            ) : <Text style={styles.sub}>{t(k === 'dp' ? 'ob.dpEmpty' : 'ob.masterEmpty')}</Text>}
          </View>
        );
      })}
      <Label>{t('ob.view.night')}</Label>
      {recent.map((o) => {
        const s = nightState(o, now);
        const st = signStatus(o.id, o.watch, acks);
        return (
          <View key={o.id} style={[styles.row, { borderLeftColor: nightColor(COLORS, s) }]}>
            <Text style={styles.title}>{[t('ob.nightOf', { date: uiDate(o.date) }), o.where].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.sub} numberOfLines={2}>{o.text}</Text>
            <Text style={[styles.sub, { color: nightColor(COLORS, s), fontWeight: '700' }]}>{[tk(`ob.st.${s}`), o.watch.length ? t('ob.signedOf', { n: st.signed.length, of: o.watch.length }) : null].filter(Boolean).join(' · ')}</Text>
          </View>
        );
      })}
      {!recent.length ? <Empty text={t('ob.nightEmpty')} /> : (
        <TouchableOpacity style={styles.small} onPress={() => void shareNightBook(nights, acks, vessel, `${today.slice(0, 8)}01`, today, now).catch(fail)}><Text style={styles.smallText}>{`${t('lt.share')} · ${t('ob.thisMonth')}`}</Text></TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs, borderLeftWidth: 4 },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    small: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: SIZES.sm, marginTop: SIZES.xs },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
