// The Master's reminder on the Dashboard while the Master PIN on this device is
// still the default 0000 (10 Oct 2026). Until it is changed anyone who reads the
// manual can set or change a crew member's signing PIN. Taps through to the
// Crew matrix, where the 🔒 Master PIN is changed. Shown to the Master only,
// and only where confirmed signatures are in use.
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { moduleOn } from '../constants/modules';
import { adminPinIsDefault } from '../services/signature';

export function MasterPinBanner() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const sync = useSync();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const [show, setShow] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (!isMaster || !moduleOn('signConfirm')) return setShow(false);
      void adminPinIsDefault().then(setShow);
    }, [isMaster])
  );
  if (!show) return null;
  return (
    <TouchableOpacity onPress={() => nav.navigate('CrewMatrix')} activeOpacity={0.8} style={[styles.bar, { borderColor: COLORS.warning, backgroundColor: COLORS.cardSolid }]}>
      <MciIcon name="lock-alert" size={22} color={COLORS.warning} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: COLORS.textDark }]}>The Master PIN is still 0000</Text>
        <Text style={[styles.sub, { color: COLORS.textLight }]}>Change it on this device — until then anyone can set or change a crew member’s signing PIN. Crew matrix → 🔒 Master PIN.</Text>
      </View>
      <MciIcon name="chevron-right" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderWidth: 1, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
  title: { fontWeight: '800', fontSize: SIZES.body },
  sub: { fontSize: SIZES.small, marginTop: 2 },
});
