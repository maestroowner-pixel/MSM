// ===================================
// Splash screen — shown on app start.
// Phase 1: holds the octopus (rescue mascot) on white for a beat.
// Phase 2: plays the ship's bell, fades/scales the MSM logo in, then onDone.
// ===================================

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Image, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, APP_CONFIG } from '../theme';
import { playShipBellSound } from '../utils/sound';

const OCTOPUS_MS = 2000; // how long the octopus lingers up front
const HOLD_MS = 1800;    // how long the MSM logo stays before finishing

export default function SplashSc({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'octopus' | 'logo'>('octopus');

  const octoOpacity = useRef(new Animated.Value(0)).current;
  const octoScale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  // Phase 1 — octopus fades in, holds, then hands over to the logo phase.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(octoOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(octoScale, { toValue: 1, friction: 7, tension: 40, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(octoOpacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setPhase('logo');
      });
    }, OCTOPUS_MS);

    return () => clearTimeout(t);
  }, [octoOpacity, octoScale]);

  // Phase 2 — ship's bell + MSM logo, then finish.
  useEffect(() => {
    if (phase !== 'logo') return;

    playShipBellSound();

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, HOLD_MS);

    return () => clearTimeout(t);
  }, [phase, onDone, opacity, scale, textOpacity]);

  if (phase === 'octopus') {
    return (
      <View style={styles.octoFill}>
        <Animated.Image
          source={require('../assets/splash.png')}
          style={[styles.octopus, { opacity: octoOpacity, transform: [{ scale: octoScale }] }]}
          resizeMode="contain"
        />
      </View>
    );
  }

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
  octoFill: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  octopus: { width: 260, height: 260 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.xl },
  logo: { width: 243, height: 243, marginBottom: SIZES.xl },
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
