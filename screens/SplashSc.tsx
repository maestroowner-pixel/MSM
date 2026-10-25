// ===================================
// Splash screen — shown on app start.
// The ISM AI Pilot logo on its own navy (8 Oct 2026): it scales and fades in, the
// ship's bell rings as it arrives, then the whole screen fades out and calls
// onDone. One phase — the octopus → MSM cube cross-fade it replaces belonged to
// the old KukaLab / MSM marks.
// On the web (25 Oct 2026) the splash is a video instead — the logo surfacing from
// the water, the ship's bell ringing once as it clears (in the video's own track,
// public/splash.mp4 of MSM Win Web). The logo splash stays as its fallback.
// ===================================

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, Pressable, useWindowDimensions } from 'react-native';
import { COLORS, SIZES, APP_CONFIG } from '../theme';
import { playShipBellSound, soundAllowed } from '../utils/sound';

const IN_MS = 700;    // logo fades/scales in
const HOLD_MS = 1900; // logo visible before finishing

// react-native-web has no native animation driver; using it there can leave the
// final fade's completion callback unfired, so the splash would never hand off.
// Drive on the JS thread on web, and never rely solely on the callback (below).
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ismpilot-logo-on-dark.png is 1280×400 with its own side margins.
const LOGO_RATIO = 400 / 1280;

// Once per launch. The splash's effect used to depend on `onDone`, which the
// parent passed as a fresh arrow on every render — and startup renders many
// times as each list loads, so the effect re-ran and the bell rang again each
// time (11 Oct 2026: "the bell rings over and over on the phone").
let bellRung = false;

export default function SplashSc({ onDone }: { onDone: () => void }) {
  const [videoFailed, setVideoFailed] = useState(false);
  if (Platform.OS === 'web' && !videoFailed) return <VideoSplash onDone={onDone} onFail={() => setVideoFailed(true)} />;
  return <LogoSplash onDone={onDone} />;
}

// The video, served at a stable path from the web project's public/ dir.
const VIDEO_URI = '/splash.mp4';
const VIDEO_START_MS = 4000;  // not playing by then (offline, slow link) → the logo splash
const VIDEO_SAFETY_MS = 12500; // the video is 10 s; never stay longer than this

function VideoSplash({ onDone, onFail }: { onDone: () => void; onFail: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;
  const container = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const finishRef = useRef<() => void>(() => {});

  useEffect(() => {
    const v = videoRef.current;
    let done = false;
    let fading = false;
    const handoff = () => {
      if (done) return;
      done = true;
      onDoneRef.current();
    };
    const fail = () => {
      if (done) return;
      done = true;
      onFailRef.current();
    };
    // The last frame is the app's own navy, so the fade lands on the same colour.
    const finish = () => {
      if (fading) return;
      fading = true;
      Animated.timing(container, { toValue: 0, duration: 400, useNativeDriver: false }).start(handoff);
      setTimeout(handoff, 600);
    };
    finishRef.current = finish;
    if (!v) {
      fail();
      return;
    }
    v.addEventListener('ended', finish);
    v.addEventListener('error', fail);
    const stalled = setTimeout(() => {
      if (!v.currentTime) fail();
    }, VIDEO_START_MS);
    const guarantee = setTimeout(finish, VIDEO_SAFETY_MS);

    // The frames are painted into a canvas over the video. Shown as a <video>,
    // Opera on macOS hands the picture to its hardware video path, and that drew
    // a thin vertical blue line across it (25 Oct 2026); a canvas is an ordinary
    // picture to the browser. The video stays underneath, covered — a browser
    // pauses a muted video it considers off screen.
    let raf = 0;
    const paint = () => {
      const c = canvasRef.current;
      if (c && v.readyState >= 2 && v.videoWidth) {
        const dpr = (globalThis as any).devicePixelRatio || 1;
        const cw = Math.round(c.clientWidth * dpr);
        const ch = Math.round(c.clientHeight * dpr);
        if (c.width !== cw || c.height !== ch) {
          c.width = cw;
          c.height = ch;
        }
        const ctx = c.getContext('2d');
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        // 16:9 fills a landscape window (the logo sits well inside the crop); a
        // portrait one would cut the logo off, so there it is letterboxed on the navy.
        const cover = cw / ch >= 4 / 3;
        const k = cover ? Math.max(cw / vw, ch / vh) : Math.min(cw / vw, ch / vh);
        const dw = vw * k;
        const dh = vh * k;
        ctx.fillStyle = COLORS.splashBackground;
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(v, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      }
      if (!done) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);

    // A browser lets a video autoplay WITH sound only on a site the user already
    // engages with; otherwise play() rejects, and the video plays muted rather
    // than not at all. The Sounds switch in Settings mutes it too.
    void soundAllowed().then(async (allowed) => {
      v.muted = !allowed;
      try {
        await v.play();
      } catch {
        v.muted = true;
        v.play()?.catch?.(fail);
      }
    });

    return () => {
      clearTimeout(stalled);
      clearTimeout(guarantee);
      cancelAnimationFrame(raf);
      v.removeEventListener('ended', finish);
      v.removeEventListener('error', fail);
      v.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.fill, { opacity: container }]}>
      {/* A tap skips the rest of the video. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => finishRef.current()} accessibilityLabel={`${APP_CONFIG.name} — ${APP_CONFIG.tagline}`}>
        {React.createElement('video', {
          ref: videoRef,
          src: VIDEO_URI,
          playsInline: true,
          preload: 'auto',
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
        } as any)}
        {React.createElement('canvas', {
          ref: canvasRef,
          style: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', backgroundColor: COLORS.splashBackground },
        } as any)}
      </Pressable>
      <Animated.Text style={styles.footer}>v{APP_CONFIG.version}</Animated.Text>
    </Animated.View>
  );
}

function LogoSplash({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
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
      onDoneRef.current();
    };

    // Best-effort on the web: a browser may hold the sound until first interaction.
    if (!bellRung) {
      bellRung = true;
      playShipBellSound();
    }
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
    // Once: the animated values are refs, and onDone is read through its ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
