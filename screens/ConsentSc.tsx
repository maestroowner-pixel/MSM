// ===================================
// Consent gate — shown once on first launch (after the splash).
//
// Three-step flow:
//   1. main   — disclaimer bullets + Privacy/Terms links + agree checkbox
//   2. role   — "Are you joining as Master?" Yes / No
//   3. guide  — role-specific instructions + action button
//
// Steps 2–3 were added Oct 2026: a new crew member had no idea what to do
// after accepting the policy — they found themselves on the Dashboard with
// no vessel data and no explanation. The guide names exactly one next action.
//
// onAccept(route) is called on the final button — route tells index.tsx
// where to navigate once the nav stack is ready.
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SIZES, Palette, APP_CONFIG } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { MciIcon } from '../components/MciIcon';
import { DISCLAIMER_POINTS, PRIVACY_POLICY, TERMS_OF_USE } from '../constants/legal';
import LegalBody from '../components/LegalBody';

type ConsentView = 'main' | 'privacy' | 'terms' | 'role' | 'guide';
type OnboardRole = 'master' | 'crew';

export default function ConsentSc({ onAccept }: { onAccept: (route: string) => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [view, setView] = useState<ConsentView>('main');
  const [agreed, setAgreed] = useState(false);
  const [role, setRole] = useState<OnboardRole | null>(null);

  // ── Legal document viewer ─────────────────────────────────────────────────
  if (view === 'privacy' || view === 'terms') {
    const doc = view === 'privacy' ? PRIVACY_POLICY : TERMS_OF_USE;
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
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

  // ── Step 2: role choice ───────────────────────────────────────────────────
  if (view === 'role') {
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
          <View style={styles.headerRow}>
            <MciIcon name="account-circle-outline" size={34} color={COLORS.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Your role on board</Text>
              <Text style={styles.subtitle}>Choose how you are joining</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            <TouchableOpacity
              style={[styles.roleCard, role === 'master' && styles.roleCardOn]}
              activeOpacity={0.85}
              onPress={() => setRole('master')}
            >
              <MciIcon name="star-circle-outline" size={32} color={role === 'master' ? COLORS.textWhite : COLORS.primary} />
              <View style={{ flex: 1, marginLeft: SIZES.sm }}>
                <Text style={[styles.roleTitle, role === 'master' && { color: COLORS.textWhite }]}>
                  Master / vessel manager
                </Text>
                <Text style={[styles.roleBody, role === 'master' && { color: COLORS.textWhite }]}>
                  Setting up the app for this vessel for the first time. You have the setup code from your licence email.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.roleCard, role === 'crew' && styles.roleCardOn]}
              activeOpacity={0.85}
              onPress={() => setRole('crew')}
            >
              <MciIcon name="account-outline" size={32} color={role === 'crew' ? COLORS.textWhite : COLORS.primary} />
              <View style={{ flex: 1, marginLeft: SIZES.sm }}>
                <Text style={[styles.roleTitle, role === 'crew' && { color: COLORS.textWhite }]}>
                  Officer / crew member
                </Text>
                <Text style={[styles.roleBody, role === 'crew' && { color: COLORS.textWhite }]}>
                  The Master already set up the vessel. You have the 8-digit PIN they issued to you.
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity
              style={[styles.acceptBtn, !role && styles.acceptBtnDisabled]}
              activeOpacity={0.85}
              disabled={!role}
              onPress={() => { if (role) setView('guide'); }}
            >
              <Text style={styles.acceptText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Step 3: role-specific guide ───────────────────────────────────────────
  if (view === 'guide') {
    const isMaster = role === 'master';
    const steps = isMaster
      ? [
          { icon: 'ferry',           text: 'Open Settings → Vessel and fill in the vessel name, IMO number, flag and call sign.' },
          { icon: 'key-variant',     text: 'Tap the Join this vessel card at the top of Settings, enter your first and last name, and the setup code from your licence email.' },
          { icon: 'check-circle-outline', text: 'The app creates the vessel account. All other devices join by entering their name and the PIN you issue them in Settings → Accounts.' },
        ]
      : [
          { icon: 'ferry',           text: 'Ask your Master for the vessel IMO number. Open Settings → Vessel and enter it.' },
          { icon: 'account-key-outline', text: 'Tap the Join this vessel card at the top of Settings and enter your first name, last name, and the 8-digit PIN your Master gave you.' },
          { icon: 'clock-check-outline', text: 'Your Master approves the request in Settings → Accounts. The app connects automatically — no restart needed.' },
        ];

    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
          <TouchableOpacity style={styles.back} onPress={() => setView('role')} hitSlop={12}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>

          <View style={[styles.headerRow, { paddingTop: SIZES.sm }]}>
            <MciIcon
              name={isMaster ? 'star-circle-outline' : 'account-outline'}
              size={34}
              color={COLORS.primaryDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {isMaster ? 'Setting up the vessel' : 'Joining the vessel'}
              </Text>
              <Text style={styles.subtitle}>Three steps to get started</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.card}>
              {steps.map((s, i) => (
                <View key={i} style={[styles.guideStep, i < steps.length - 1 && styles.guideStepBorder]}>
                  <View style={styles.guideNum}>
                    <Text style={styles.guideNumText}>{i + 1}</Text>
                  </View>
                  <MciIcon name={s.icon} size={22} color={COLORS.primary} style={{ marginTop: 2 }} />
                  <Text style={[styles.para, { flex: 1, marginLeft: SIZES.sm }]}>{s.text}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.card, { marginTop: SIZES.md, backgroundColor: COLORS.primaryDark + '18' }]}>
              <Text style={[styles.para, { color: COLORS.textLight, fontStyle: 'italic' }]}>
                {isMaster
                  ? 'You can change vessel details and invite crew at any time in Settings.'
                  : 'Your PIN can only be used once. Once you are enrolled, you sign with it on this device.'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerBar}>
            <TouchableOpacity
              style={styles.acceptBtn}
              activeOpacity={0.85}
              onPress={() => onAccept(isMaster ? 'Settings' : 'Enrol')}
            >
              <MciIcon name={isMaster ? 'cog-outline' : 'login'} size={18} color={COLORS.textWhite} />
              <Text style={[styles.acceptText, { marginLeft: 8 }]}>
                {isMaster ? 'Open Settings' : 'Join this vessel'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Step 1: disclaimer + consent ─────────────────────────────────────────
  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.headerRow}>
          <MciIcon name="anchor" size={34} color={COLORS.primaryDark} />
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
            onPress={() => setView('role')}
          >
            <Text style={styles.acceptText}>Agree &amp; continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.md,
    paddingBottom: SIZES.sm,
  },
  title: { fontSize: SIZES.h2, fontWeight: '800', color: COLORS.textDark },
  subtitle: { fontSize: SIZES.body, color: COLORS.textLight },
  scroll: { paddingHorizontal: SIZES.lg, paddingBottom: SIZES.lg },
  docScroll: { padding: SIZES.lg },
  card: { ...COLORS.glassCard, borderRadius: SIZES.radiusLg, padding: SIZES.lg },
  cardTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primaryDark, marginBottom: SIZES.sm },
  point: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  bullet: { fontSize: SIZES.h5, color: COLORS.primary, lineHeight: 21 },
  para: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 21 },
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
    backgroundColor: COLORS.cardSolid,
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
  footerBar: {
    paddingHorizontal: SIZES.lg,
    paddingTop: SIZES.sm,
    paddingBottom: SIZES.sm,
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  acceptBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.lg,
    ...COLORS.shadowMd,
  },
  acceptBtnDisabled: { backgroundColor: COLORS.borderDark, ...COLORS.shadowSm },
  acceptText: { color: COLORS.textWhite, fontSize: SIZES.h5, fontWeight: '700' },

  // Role selection cards
  roleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusLg,
    padding: SIZES.lg,
    marginBottom: SIZES.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  roleCardOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryDark,
  },
  roleTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
  roleBody: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 20 },

  // Guide steps
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SIZES.md,
    gap: SIZES.sm,
  },
  guideStepBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  guideNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  guideNumText: { color: COLORS.textWhite, fontSize: 12, fontWeight: '700' },
});
