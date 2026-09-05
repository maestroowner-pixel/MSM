// ===================================
// "A newer version is available — Reload." Web only.
//
// Deliberately a quiet strip rather than a modal: a redeploy happens while
// somebody is halfway through a safety round, and interrupting that to announce
// a cosmetic change would be worse than the stale bundle. It waits to be tapped.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { CHECK_INTERVAL_MS, applyWebUpdate, isNewBuildAvailable, webUpdatesSupported } from '../utils/webUpdate';

export function UpdateBanner() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!webUpdatesSupported) return;
    let alive = true;
    const check = async () => {
      const isNew = await isNewBuildAvailable();
      if (alive && isNew) setAvailable(true);
    };
    void check(); // records the baseline
    const t = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!available) return null;

  return (
    <TouchableOpacity style={styles.bar} onPress={applyWebUpdate} accessibilityRole="button">
      <MciIcon name="cloud-download" size={18} color={COLORS.textWhite} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>A newer version is available</Text>
        <Text style={styles.sub}>Tap to reload — nothing you have entered is lost</Text>
      </View>
      <Text style={styles.action}>Reload</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginBottom: SIZES.md,
    },
    text: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.small },
    sub: { color: COLORS.textWhite, opacity: 0.85, fontSize: SIZES.tiny, marginTop: 1 },
    action: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small },
  });
