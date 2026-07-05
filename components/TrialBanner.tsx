// ===================================
// Trial reminder banner (web only).
// Shows the current MSM Pro trial state — days left + the exact end date — and
// routes to the paywall. Web-only because the trial is only enforced on web
// (see services/trial.ts ENFORCE_LIMITS); on native it renders nothing.
// Re-checks on focus so it disappears right after a license is activated.
// ===================================

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { getTrialInfo } from '../services/trial';
import { isSubscribed } from '../services/purchases';
import { LS_PRICE_STRING } from '../services/lemonSqueezy';
import { formatDate } from '../utils/dates';

const onWeb = Platform.OS === 'web';

type Kind = 'pro' | 'trial' | 'expired';
interface State {
  kind: Kind;
  daysLeft: number;
  endsAt: string; // formatted date
}

export function TrialBanner() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const focused = useIsFocused();
  const [state, setState] = useState<State | null>(null);

  const load = useCallback(async () => {
    if (!onWeb) return;
    try {
      if (await isSubscribed()) {
        setState({ kind: 'pro', daysLeft: 0, endsAt: '' });
        return;
      }
      const t = await getTrialInfo();
      const endsAt = t.endsAt ? formatDate(new Date(t.endsAt).toISOString().slice(0, 10)) : '';
      setState({ kind: t.expired ? 'expired' : 'trial', daysLeft: t.daysLeft, endsAt });
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    if (focused) load();
  }, [focused, load]);

  if (!onWeb || !state) return null;

  const styles = makeStyles(COLORS, state.kind);
  const go = () => nav.navigate('Paywall');

  if (state.kind === 'pro') {
    return (
      <View style={styles.wrap}>
        <MaterialCommunityIcons name="check-decagram" size={20} color={COLORS.success} />
        <Text style={styles.title}>MSM Pro is active — thank you!</Text>
      </View>
    );
  }

  const expired = state.kind === 'expired';
  return (
    <TouchableOpacity style={styles.wrap} onPress={go} activeOpacity={0.85}>
      <MaterialCommunityIcons
        name={expired ? 'lock-alert' : 'clock-outline'}
        size={20}
        color={expired ? COLORS.danger : COLORS.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {expired ? 'Free trial ended' : `Free trial · ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'} left`}
        </Text>
        <Text style={styles.sub}>
          {expired
            ? `Trial ended ${state.endsAt}. Subscribe to keep adding items & certificates.`
            : `Ends ${state.endsAt} · then ${LS_PRICE_STRING}/year. Tap to upgrade to Pro.`}
        </Text>
      </View>
      <Text style={styles.cta}>{expired ? 'Upgrade' : '›'}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette, kind: Kind) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: kind === 'expired' ? COLORS.danger : kind === 'pro' ? COLORS.success : COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      marginBottom: SIZES.md,
    },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    cta: { fontSize: SIZES.body, fontWeight: '800', color: kind === 'expired' ? COLORS.danger : COLORS.primary },
  });
