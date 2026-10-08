// ===================================
// Splash screen — shown on app start.
// The ISMpilot logo on its own navy (8 Oct 2026): it scales and fades in, the
// ship's bell rings as it arrives, then the whole screen fades out and calls
// onDone. One phase — the octopus → MSM cube cross-fade it replaces belonged to
// the old KukaLab / MSM marks.
// ===================================

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, useWindowDimensions } from 'react-native';
import { COLORS, SIZES, APP_CONFIG } from '../theme';
import { playShipBellSound } from '../utils/sound';

const IN_MS = 700;    // logo fades/scales in
const HOLD_MS = 1900; // logo visible before finishing

// react-native-web has no native animation driver; using it there can leave the
// final fade's completion callback unfired, so the splash would never hand off.
// Drive on the JS thread on web, and never rely solely on the callback (below).
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ismpilot-logo-on-dark.png is 1280×400 with its own side margins.
const LOGO_RATIO = 400 / 1280;

export default function SplashSc({ onDone }: { onDone: () => void }) {
  const { width } = useWindowDimensions();
  const logoW = Math.min(width * 0.86, 520);
  const container = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const footOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let done = false;
    const handoff = () => {
      if (done) return;
      done = true;
      onDone();
    };

    // Best-effort on the web: a browser may hold the sound until first interaction.
    playShipBellSound();
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: IN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(footOpacity, { toValue: 1, duration: 700, delay: 400, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    const finish = setTimeout(() => {
      Animated.timing(container, { toValue: 0, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }).start(handoff);
    }, IN_MS + HOLD_MS);
    // Safety net: never stay on the splash if the completion callback is lost.
    const guarantee = setTimeout(handoff, IN_MS + HOLD_MS + 600);

    return () => {
      clearTimeout(finish);
      clearTimeout(guarantee);
    };
  }, [container, logoOpacity, logoScale, footOpacity, onDone]);

  return (
    <Animated.View style={[styles.fill, { opacity: container }]}>
      <View style={styles.center}>
        <Animated.Image
          source={require('../assets/ismpilot-logo-on-dark.png')}
          style={{ width: logoW, height: logoW * LOGO_RATIO, opacity: logoOpacity, transform: [{ scale: logoScale }] }}
          resizeMode="contain"
          accessibilityLabel={`${APP_CONFIG.name} — ${APP_CONFIG.tagline}`}
        />
      </View>
      <Animated.Text style={[styles.footer, { opacity: footOpacity }]}>v{APP_CONFIG.version}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.splashBackground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.lg },
  footer: {
    position: 'absolute',
    bottom: SIZES.xxxl,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.6)',
    fontSize: SIZES.small,
  },
});
