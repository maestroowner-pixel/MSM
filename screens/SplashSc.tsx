// ===================================
// Splash screen — shown on app start.
// Seamless single splash: the octopus (matching the native splash, on white)
// holds for a beat, then CROSS-FADES into the MSM logo on teal — no white gap,
// no hard phase switch. Plays the ship's bell as the logo arrives, then fades
// the whole thing out and calls onDone.
// ===================================

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, SIZES, APP_CONFIG } from '../theme';
import { playShipBellSound } from '../utils/sound';

const OCTOPUS_MS = 1800; // octopus visible before the logo cross-fades in
const HOLD_MS = 1500;    // logo visible before finishing

// react-native-web has no native animation driver; using it there can leave the
// final fade's completion callback unfired, so the splash would never hand off
// (the app appears stuck on the dark teal logo screen). Drive on the JS thread
// on web, and never rely solely on the animation callback for onDone (below).
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export default function SplashSc({ onDone }: { onDone: () => void }) {
  const container = useRef(new Animated.Value(1)).current; // whole-screen fade-out
  const octoOpacity = useRef(new Animated.Value(0)).current;
  const octoScale = useRef(new Animated.Value(0.9)).current;
  const logoLayer = useRef(new Animated.Value(0)).current; // teal+logo overlay cross-fade
  const logoScale = useRef(new Animated.Value(0.86)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let done = false;
    const handoff = () => {
      if (done) return;
      done = true;
      onDone();
    };

    // Octopus fades/scales in (continues seamlessly from the native splash).
    Animated.parallel([
      Animated.timing(octoOpacity, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(octoScale, { toValue: 1, friction: 7, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    // After the hold, cross-fade to the MSM logo layer (octopus stays underneath,
    // so there's no white flash) and ring the bell.
    const toLogo = setTimeout(() => {
      // Ring the ship's bell as the logo arrives. On the desktop (Electron) build
      // this plays on the splash; a real browser may block it until first
      // interaction (autoplay policy) — best-effort.
      playShipBellSound();
      Animated.parallel([
        Animated.timing(logoLayer, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(textOpacity, { toValue: 1, duration: 700, delay: 200, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
    }, OCTOPUS_MS);

    // Finish: fade the whole splash out, then hand off.
    const finish = setTimeout(() => {
      Animated.timing(container, { toValue: 0, duration: 400, useNativeDriver: USE_NATIVE_DRIVER }).start(handoff);
    }, OCTOPUS_MS + HOLD_MS);

    // Safety net: never let the app get stuck on the splash if the animation's
    // completion callback doesn't fire (a real hazard on web). Hand off after the
    // full sequence + fade regardless.
    const guarantee = setTimeout(handoff, OCTOPUS_MS + HOLD_MS + 600);

    return () => {
      clearTimeout(toLogo);
      clearTimeout(finish);
      clearTimeout(guarantee);
    };
  }, [container, octoOpacity, octoScale, logoLayer, logoScale, textOpacity, onDone]);

  return (
    <Animated.View style={[styles.fill, { opacity: container }]}>
      {/* Base layer — the octopus on the SAME teal as the MSM cube that follows.
          It sat on the app's pale background, which made the sequence two
          different screens: a pale one, then a teal one, with the cross-fade
          reading as a change of scene rather than one screen resolving into the
          next. One ground for both, and the fade does what it was written to do.
          The native splash and the web page paint the same colour underneath, so
          nothing flashes before React arrives. */}
      <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.octoFill}>
        {/* Clipped and rounded on purpose. splash.png is OPAQUE (no alpha) and
            carries ~19% white margin on every side, so drawn straight onto the
            app's pale background it read as a hard-edged white square with a
            small octopus adrift in the middle. The image is rendered larger than
            its window, so the window trims about half that margin; the radius
            turns what is left into a card rather than a seam. */}
        <View style={styles.octoClip}>
          <Animated.Image
            source={require('../assets/splash.png')}
            style={[styles.octopus, { opacity: octoOpacity, transform: [{ scale: octoScale }] }]}
            resizeMode="contain"
          />
        </View>
      </LinearGradient>

      {/* Overlay — MSM logo on teal, cross-fades in over the octopus. */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: logoLayer }]} pointerEvents="none">
        <LinearGradient colors={[COLORS.primaryDark, COLORS.primary]} style={styles.fill}>
          <View style={styles.center}>
            <Animated.Image
              source={require('../assets/msm-logo.png')}
              style={[styles.logo, { transform: [{ scale: logoScale }] }]}
              resizeMode="contain"
            />
            <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
              <Text style={styles.title}>{APP_CONFIG.name}</Text>
              <Text style={styles.subtitle}>LSA · FFE · Inspections</Text>
            </Animated.View>
          </View>
          <Animated.Text style={[styles.footer, { opacity: textOpacity }]}>
            {APP_CONFIG.company} · v{APP_CONFIG.version}
          </Animated.Text>
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.background },
  octoFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // The window: what the viewer sees. Rounded, and it clips.
  octoClip: {
    width: 260,
    height: 260,
    borderRadius: 56,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The image, deliberately larger than the window above — the difference IS the
  // crop. 328/260 leaves the octopus at ~78% of the frame instead of 62%.
  octopus: { width: 328, height: 328 },
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
