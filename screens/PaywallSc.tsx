// ===================================
// Paywall — MSM Pro upsell. 2-month free trial, then a yearly subscription.
// Talks only to services/purchases (RevenueCat plugs in there later); prices
// shown here are the store-localized ones once RevenueCat is wired.
// Opened from Settings (does not gate the app yet).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SIZES, Palette, APP_CONFIG } from '../theme';
import { useTheme, useThemeName } from '../contexts/ThemeContext';
import { getOffer, purchaseYearly, restore, openManageSubscriptions, activateLicenseWeb, isSignedIn, Offer } from '../services/purchases';

const onWeb = Platform.OS === 'web';

type Feature = { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; text: string };
const FEATURES: Feature[] = [
  { icon: 'clipboard-list-outline', text: 'Unlimited equipment & certificates' },
  { icon: 'cloud-sync-outline', text: 'Cloud sync across all your devices' },
  { icon: 'file-export-outline', text: 'PDF · XLSX · ZIP register exports' },
  { icon: 'paperclip', text: 'Photo & document attachments' },
  { icon: 'bell-ring-outline', text: 'Inspection & expiry reminders' },
];

export default function PaywallSc() {
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const { name: themeName } = useThemeName();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  // Colorful theme: tint each feature icon with a group colour (green/red/teal);
  // in light/dark they're all the teal primary, so the paywall stays monochrome.
  const accents =
    themeName === 'colorful'
      ? [COLORS.groupColors.LSA, COLORS.groupColors.FFE, COLORS.groupColors.OTHER]
      : null;
  const featureColor = (i: number) => (accents ? accents[i % accents.length] : COLORS.primary);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState(false);
  // Web: LemonSqueezy license activation.
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [signedIn, setSignedIn] = useState(isSignedIn());

  useEffect(() => {
    getOffer().then(setOffer).catch(() => {});
  }, []);

  const onActivate = async () => {
    if (!signedIn && !isSignedIn()) {
      Alert.alert(
        'Sign in first',
        'Your MSM Pro license is tied to your vessel account. Connect Cloud sync in Settings (IMO + connection password), then activate your key here.'
      );
      return;
    }
    setActivating(true);
    try {
      const res = await activateLicenseWeb(licenseKey);
      if (res.ok) {
        Alert.alert('MSM Pro activated', 'Thank you! Your license is active on this vessel.');
        nav.goBack();
      } else {
        Alert.alert('Could not activate', res.message ?? 'Please check your license key.');
      }
    } finally {
      setActivating(false);
    }
  };

  const priceLine = offer ? `${offer.priceString} / year` : '…';
  const trialDays = offer?.trialDays ?? 60;
  const trialLabel =
    trialDays % 30 === 0 ? `${trialDays / 30} month${trialDays / 30 > 1 ? 's' : ''}` : `${trialDays} days`;

  const onSubscribe = async () => {
    if (!offer?.available) {
      Alert.alert('Coming soon', 'Subscriptions are not available yet — this update only previews the plan.');
      return;
    }
    if (onWeb) {
      // Opens the LemonSqueezy checkout in a new tab; the license key arrives by
      // email, then the user activates it in the field below.
      await purchaseYearly();
      Alert.alert(
        'Checkout opened',
        'Complete your purchase in the new tab. You\'ll get a license key by email — paste it below and tap "Activate license".'
      );
      return;
    }
    setBusy(true);
    try {
      const ok = await purchaseYearly();
      if (ok) {
        Alert.alert('Welcome to MSM Pro', 'Your subscription is active. Thank you!');
        nav.goBack();
      } else {
        Alert.alert('Not completed', 'The purchase was not completed.');
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    if (!offer?.available) {
      Alert.alert('Coming soon', 'Purchases are not available yet.');
      return;
    }
    setBusy(true);
    try {
      const ok = await restore();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Your subscription was restored.' : 'No active subscription found for this account.');
      if (ok) nav.goBack();
    } catch (e: any) {
      Alert.alert('Restore failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <TouchableOpacity style={styles.close} onPress={() => nav.goBack()} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={26} color={COLORS.textLight} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Image source={require('../assets/msm-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{APP_CONFIG.name} Pro</Text>
          <Text style={styles.subtitle}>Everything you need to keep the ship's LSA & FFE register in order.</Text>

          <View style={styles.card}>
            {FEATURES.map((f, i) => (
              <View key={f.text} style={styles.featureRow}>
                <MaterialCommunityIcons name={f.icon} size={22} color={featureColor(i)} style={{ width: 28 }} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.planCard}>
            <View style={styles.trialPill}>
              <Text style={styles.trialPillText}>{trialLabel} free</Text>
            </View>
            <Text style={styles.planPrice}>{priceLine}</Text>
            <Text style={styles.planNote}>Free for the first {trialLabel}, then billed yearly. Auto-renews — cancel anytime.</Text>
          </View>

          {onWeb && (
            <View style={styles.licenseCard}>
              <Text style={styles.licenseTitle}>Already bought? Activate your license</Text>
              {!signedIn && (
                <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Settings' })}>
                  <Text style={styles.signinHint}>
                    Sign in to your vessel (Settings → Cloud sync) so the license is tied to your account. Tap to open Settings.
                  </Text>
                </TouchableOpacity>
              )}
              <TextInput
                value={licenseKey}
                onChangeText={setLicenseKey}
                placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.licenseInput}
              />
              <TouchableOpacity
                style={[styles.activateBtn, (activating || !licenseKey.trim()) && { opacity: 0.5 }]}
                onPress={onActivate}
                disabled={activating || !licenseKey.trim()}
                activeOpacity={0.85}
              >
                {activating ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Text style={styles.activateText}>Activate license</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={onSubscribe} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.ctaText}>{onWeb ? `Get MSM Pro — ${priceLine}` : `Start ${trialLabel} free trial`}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={onRestore} hitSlop={8} disabled={busy}>
              <Text style={styles.restore}>Restore purchase</Text>
            </TouchableOpacity>
            {!onWeb && (
              <>
                <Text style={styles.legalDot}>·</Text>
                <TouchableOpacity onPress={() => openManageSubscriptions()} hitSlop={8}>
                  <Text style={styles.restore}>Manage subscription</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={styles.fine}>
            {onWeb
              ? 'Purchase is handled securely by LemonSqueezy. Your license unlocks MSM Pro on your vessel account across devices.'
              : 'Payment is charged to your store account at confirmation. The subscription renews automatically unless cancelled at least 24h before the period ends; manage it in your store account settings.'}
          </Text>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => nav.navigate('Legal', { doc: 'terms' })} hitSlop={8}>
              <Text style={styles.legalLink}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => nav.navigate('Legal', { doc: 'privacy' })} hitSlop={8}>
              <Text style={styles.legalLink}>Privacy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    close: { alignSelf: 'flex-end', padding: SIZES.md },
    scroll: { paddingHorizontal: SIZES.xl, paddingBottom: SIZES.lg, alignItems: 'center' },
    logo: { width: 96, height: 96, marginTop: SIZES.sm, marginBottom: SIZES.md },
    title: { fontSize: SIZES.h1, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },
    subtitle: {
      fontSize: SIZES.body,
      color: COLORS.textLight,
      textAlign: 'center',
      marginTop: SIZES.xs,
      marginBottom: SIZES.lg,
      lineHeight: 20,
    },
    card: {
      ...COLORS.glassCard,
      alignSelf: 'stretch',
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      gap: SIZES.md,
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    featureText: { flex: 1, fontSize: SIZES.body, color: COLORS.text },
    planCard: {
      ...COLORS.glassCardStrong,
      alignSelf: 'stretch',
      borderRadius: SIZES.radiusLg,
      borderWidth: 1.5,
      borderColor: COLORS.primary,
      padding: SIZES.lg,
      marginTop: SIZES.lg,
      alignItems: 'center',
    },
    trialPill: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.md,
      paddingVertical: 3,
      marginBottom: SIZES.sm,
    },
    trialPillText: { color: COLORS.textWhite, fontSize: SIZES.small, fontWeight: '800' },
    planPrice: { fontSize: SIZES.h2, fontWeight: '800', color: COLORS.textDark },
    planNote: { fontSize: SIZES.small, color: COLORS.textLight, textAlign: 'center', marginTop: SIZES.xs, lineHeight: 18 },
    licenseCard: {
      ...COLORS.glassCard,
      alignSelf: 'stretch',
      borderRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      marginTop: SIZES.lg,
      gap: SIZES.sm,
    },
    licenseTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' },
    signinHint: { fontSize: SIZES.small, color: COLORS.primary, textAlign: 'center', lineHeight: 17 },
    licenseInput: {
      ...COLORS.glassInput,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      fontSize: SIZES.body,
      color: COLORS.textDark,
      textAlign: 'center',
    },
    activateBtn: {
      borderWidth: 1.5,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.md,
      alignItems: 'center',
    },
    activateText: { color: COLORS.primary, fontSize: SIZES.body, fontWeight: '700' },
    footer: { paddingHorizontal: SIZES.xl, paddingTop: SIZES.sm, gap: SIZES.sm },
    cta: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.lg,
      alignItems: 'center',
      ...COLORS.shadowMd,
    },
    ctaText: { color: COLORS.textWhite, fontSize: SIZES.h5, fontWeight: '700' },
    linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SIZES.sm },
    restore: { color: COLORS.primary, fontSize: SIZES.body, fontWeight: '700', textAlign: 'center', paddingVertical: SIZES.xs },
    fine: { fontSize: SIZES.tiny, color: COLORS.textLight, textAlign: 'center', lineHeight: 15 },
    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SIZES.xs, paddingBottom: SIZES.xs },
    legalLink: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '700' },
    legalDot: { color: COLORS.textLight },
  });
