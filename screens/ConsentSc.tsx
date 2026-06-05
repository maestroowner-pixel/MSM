// ===================================
// Consent gate — shown once on first launch (after the splash).
// User must agree to the Privacy Policy and Terms of Use to continue.
// ===================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, GLASS, SHADOWS, SCREEN_BG, APP_CONFIG } from '../theme';
import { DISCLAIMER_POINTS, PRIVACY_POLICY, TERMS_OF_USE } from '../constants/legal';
import LegalBody from '../components/LegalBody';

type View2 = 'main' | 'privacy' | 'terms';

export default function ConsentSc({ onAccept }: { onAccept: () => void }) {
  const [view, setView] = useState<View2>('main');
  const [agreed, setAgreed] = useState(false);

  if (view !== 'main') {
    const doc = view === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;
    return (
      <LinearGradient colors={SCREEN_BG.gradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
          <TouchableOpacity style={styles.back} onPress={() => setView('main')} hitSlop={12}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.docScroll} showsVerticalScrollIndicator>
            <View style={styles.card}>
              <LegalBody doc={doc} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={SCREEN_BG.gradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>⚓</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Welcome aboard</Text>
            <Text style={styles.subtitle}>{APP_CONFIG.name}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Before you start</Text>
            {DISCLAIMER_POINTS.map((p, i) => (
              <View key={i} style={styles.point}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.para}>{p}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.agreeRow}
            activeOpacity={0.8}
            onPress={() => setAgreed((v) => !v)}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
              {agreed ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
            <Text style={styles.agreeText}>
              I have read and agree to the{' '}
              <Text style={styles.link} onPress={() => setView('privacy')}>
                Privacy Policy
              </Text>{' '}
              and{' '}
              <Text style={styles.link} onPress={() => setView('terms')}>
                Terms of Use
              </Text>
              .
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footerBar}>
          <TouchableOpacity
            style={[styles.acceptBtn, !agreed && styles.acceptBtnDisabled]}
            activeOpacity={0.85}
            disabled={!agreed}
            onPress={onAccept}
          >
            <Text style={styles.acceptText}>Agree &amp; continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.md,
    paddingBottom: SIZES.sm,
  },
  icon: { fontSize: SIZES.h1 },
  title: { fontSize: SIZES.h2, fontWeight: '800', color: COLORS.textDark },
  subtitle: { fontSize: SIZES.body, color: COLORS.textLight },
  scroll: { paddingHorizontal: SIZES.lg, paddingBottom: SIZES.lg },
  docScroll: { padding: SIZES.lg },
  card: { ...GLASS.card, borderRadius: SIZES.radiusLg, padding: SIZES.lg },
  cardTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primaryDark, marginBottom: SIZES.sm },
  point: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  bullet: { fontSize: SIZES.h5, color: COLORS.primary, lineHeight: 21 },
  para: { flex: 1, fontSize: SIZES.body, color: COLORS.text, lineHeight: 21 },
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SIZES.sm,
    marginTop: SIZES.md,
    paddingHorizontal: SIZES.xs,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: SIZES.radiusSm,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: COLORS.primary },
  checkmark: { color: COLORS.textWhite, fontSize: SIZES.body, fontWeight: '800' },
  agreeText: { flex: 1, fontSize: SIZES.body, color: COLORS.text, lineHeight: 22 },
  link: { color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },
  back: { paddingHorizontal: SIZES.lg, paddingTop: SIZES.sm, paddingBottom: SIZES.xs },
  backText: { fontSize: SIZES.h5, color: COLORS.primary, fontWeight: '600' },
  footerBar: { paddingHorizontal: SIZES.lg, paddingTop: SIZES.sm, paddingBottom: SIZES.sm },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  acceptBtnDisabled: { backgroundColor: COLORS.borderDark, ...SHADOWS.small },
  acceptText: { color: COLORS.textWhite, fontSize: SIZES.h5, fontWeight: '700' },
});
