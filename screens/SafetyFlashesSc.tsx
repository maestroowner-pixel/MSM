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

export const SAFETY_FLASHES_URL = 'https://www.imca-int.com/resources/safety/safety-flashes/';

export default function SafetyFlashesSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Screen scroll>
      <ScreenTitle title="Safety flashes" subtitle="IMCA — lessons from incidents in the marine industry" help="Security (ISPS)" />
      <Card>
        <Text style={styles.body}>IMCA (International Marine Contractors Association) publishes safety flashes: short reports of incidents and near misses — what happened, why, and what was done — free to read and to share at safety meetings and toolbox talks.</Text>
        <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }]} onPress={() => void Linking.openURL(SAFETY_FLASHES_URL)}>
          <MciIcon name="flash-alert-outline" size={18} color={COLORS.textWhite} />
          <Text style={styles.btnText}>Open IMCA safety flashes</Text>
        </TouchableOpacity>
        <View style={{ marginTop: SIZES.sm }}>
          <Text style={styles.sub}>Opens imca-int.com in the browser — needs an internet connection.</Text>
          <Text style={styles.sub}>A flash worth acting on aboard can be raised as an observation card or discussed at the monthly safety meeting.</Text>
        </View>
      </Card>
    </Screen>
  );
}
