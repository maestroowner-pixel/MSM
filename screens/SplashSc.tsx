// ===================================
// Splash screen — shown on app start.
// Plays the ship's bell, fades/scales the MSM logo in, then calls onDone.
// ===================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, APP_CONFIG } from '../theme';
import { playShipBellSound } from '../utils/sound';

const HOLD_MS = 2200;

export default function SplashSc({ onDone }: { onDone: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ship's bell on launch (same as MHM).
    playShipBellSound();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, HOLD_MS);

    return () => clearTimeout(t);
  }, [onDone, opacity, scale, textOpacity]);

  return (
    <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.fill}>
      <Animated.View style={[styles.center, { opacity }]}>
        <Animated.Image
          source={require('../assets/msm-logo.png')}
          style={[styles.logo, { transform: [{ scale }] }]}
          resizeMode="contain"
        />
        <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
          <Text style={styles.title}>{APP_CONFIG.name}</Text>
          <Text style={styles.subtitle}>LSA · FFE · Inspections</Text>
        </Animated.View>
      </Animated.View>
      <Animated.Text style={[styles.footer, { opacity: textOpacity }]}>
        {APP_CONFIG.company} · v{APP_CONFIG.version}
      </Animated.Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.xl },
  logo: { width: 180, height: 180, marginBottom: SIZES.xl },
  title: { fontSize: SIZES.h1, fontWeight: '800', color: COLORS.textWhite, textAlign: 'center', letterSpacing: 0.5 },
  subtitle: { fontSize: SIZES.h5, color: 'rgba(255,255,255,0.85)', marginTop: SIZES.xs, letterSpacing: 2 },
  footer: {
    position: 'absolute',
    bottom: SIZES.xxxl,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: SIZES.small,
  },
});
