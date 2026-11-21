// ===================================
// A person's duties at every alarm, from the muster list in force (types/stationBill.ts) —
// on "My documents" (their own) and on a crew member's card. Nothing when the module is off.
// ===================================

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { moduleOn } from '../constants/modules';
import { SIZES, Palette } from '../theme';
import { currentBill, rowsOf } from '../services/stationBill';
import { personLines } from '../services/stationBillRows';
import { t, tk, useT } from '../utils/i18n';

export function MyDuties({ id, name, own }: { id?: string; name?: string; own?: boolean }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { stationBills } = useData();
  if (!moduleOn('stationBill') || !moduleOn('crewCerts')) return null;
  const bill = currentBill(stationBills);
  if (!bill) return null;
  const rows = rowsOf(bill, { id, name });
  const lines = personLines(bill, rows);

  return (
    <>
      <Label>{own ? t('sb.my') : t('sb.theirs')}</Label>
      <Card>
        {rows.length ? (
          <>
            <Text style={styles.sub}>{t('sb.myRow', { row: rows.map((r) => `${r.no}. ${r.position}`).join(', '), rev: bill.rev })}</Text>
            {lines.map((l) => (
              <View key={l.key} style={styles.line}>
                <Text style={styles.key}>{tk(`sb.key.${l.key}`)}</Text>
                <Text style={styles.text}>{l.text}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.sub}>{t('sb.myNone')}</Text>
        )}
        <TouchableOpacity onPress={() => nav.navigate('StationBill')}>
          <Text style={styles.link}>{t('sb.title')} ›</Text>
        </TouchableOpacity>
      </Card>
    </>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    line: { marginTop: SIZES.sm },
    key: { color: COLORS.textDark, fontWeight: '800', fontSize: SIZES.small },
    text: { color: COLORS.text, fontSize: SIZES.small, marginTop: 2 },
    link: { color: COLORS.primary, fontWeight: '700', marginTop: SIZES.md },
  });
