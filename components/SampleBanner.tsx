// Sample data on the Dashboard (17 Nov 2026, services/sampleData): says the rows
// marked sample are there to try the app, and clears them in one tap. Only on a
// device without a vessel — the only place sample data can be.
import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { clearSampleData, hasSampleData } from '../services/sampleData';
import { playSuccessSound } from '../utils/sound';
import { t } from '../utils/i18n';

export function SampleBanner() {
  const COLORS = useTheme();
  const sync = useSync();
  const { reload, flat, certificates } = useData();
  const [show, setShow] = useState(false);
  // Looked at again when the lists change: the first start writes them just after the Dashboard opens.
  useFocusEffect(
    useCallback(() => {
      if (sync.enrolled) return setShow(false);
      void hasSampleData().then(setShow);
    }, [sync.enrolled, flat, certificates])
  );
  if (!show) return null;
  const clear = () =>
    Alert.alert(t('sample.clearQ'), t('sample.clearBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sample.clear'),
        style: 'destructive',
        onPress: async () => {
          await clearSampleData();
          await reload();
          setShow(false);
          playSuccessSound();
        },
      },
    ]);
  return (
    <View style={[styles.bar, { borderColor: COLORS.primary, backgroundColor: COLORS.cardSolid }]}>
      <MciIcon name="flask-outline" size={22} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: COLORS.textDark }]}>{t('sample.title')}</Text>
        <Text style={[styles.sub, { color: COLORS.textLight }]}>{t('sample.sub')}</Text>
      </View>
      <TouchableOpacity onPress={clear} style={[styles.btn, { backgroundColor: COLORS.primary }]} accessibilityRole="button">
        <Text style={[styles.btnText, { color: COLORS.textWhite }]}>{t('sample.clear')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderWidth: 1, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
  title: { fontWeight: '800', fontSize: SIZES.body },
  sub: { fontSize: SIZES.small, marginTop: 2 },
  btn: { borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm },
  btnText: { fontWeight: '700', fontSize: SIZES.small },
});
