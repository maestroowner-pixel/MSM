// ===================================
// Safety flashes — IMCA's lessons from incidents in the marine industry
// (13 Oct 2026: "in ISPS, a tab with IMCA flash from the site — see how it is
// done in the Drill Trainer"). As in the Drill Trainer, the page opens IMCA's
// own list in the browser: the flashes stay theirs, current, and searchable
// there. Reached from the menu under Security.
// ===================================

import React, { useMemo } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import { Card, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { makeStyles } from './SafetySc';
import { t, useT } from '../utils/i18n';

export const SAFETY_FLASHES_URL = 'https://www.imca-int.com/resources/safety/safety-flashes/';

export default function SafetyFlashesSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Screen scroll>
      <ScreenTitle title={t('flash.title')} subtitle={t('flash.subtitle')} help="Security (ISPS)" />
      <Card>
        <Text style={styles.body}>{t('flash.about')}</Text>
        <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }]} onPress={() => void Linking.openURL(SAFETY_FLASHES_URL)}>
          <MciIcon name="flash-alert-outline" size={18} color={COLORS.textWhite} />
          <Text style={styles.btnText}>{t('flash.open')}</Text>
        </TouchableOpacity>
        <View style={{ marginTop: SIZES.sm }}>
          <Text style={styles.sub}>{t('flash.net')}</Text>
          <Text style={styles.sub}>{t('flash.act')}</Text>
        </View>
      </Card>
    </Screen>
  );
}
