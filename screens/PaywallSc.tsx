// ===================================
// Paywall — MSM Pro upsell. 1-month free trial, then a yearly subscription.
// Talks only to services/purchases (RevenueCat plugs in there later); prices
// shown here are the store-localized ones once RevenueCat is wired.
// Opened from Settings (does not gate the app yet).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SIZES, Palette, APP_CONFIG } from '../theme';
import { useTheme, useThemeName } from '../contexts/ThemeContext';
import { getOffer, purchaseYearly, restore, openManageSubscriptions, Offer } from '../services/purchases';

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

  useEffect(() => {
    getOffer().then(setOffer).catch(() => {});
  }, []);

  const priceLine = offer ? `${offer.priceString} / year` : '…';

  const onSubscribe = async () => {
    if (!offer?.available) {
      Alert.alert('Coming soon', 'Subscriptions are not available yet — this update only previews the plan.');
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
              <Text style={styles.trialPillText}>{offer?.trialDays ?? 30} days free</Text>
            </View>
            <Text style={styles.planPrice}>{priceLine}</Text>
            <Text style={styles.planNote}>Free for the first month, then billed yearly. Auto-renews — cancel anytime.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cta} onPress={onSubscribe} disabled={busy} activeOpacity={0.85}>
            {busy ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <Text style={styles.ctaText}>Start {offer?.trialDays ?? 30}-day free trial</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={onRestore} hitSlop={8} disabled={busy}>
              <Text style={styles.restore}>Restore purchase</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => openManageSubscriptions()} hitSlop={8}>
              <Text style={styles.restore}>Manage subscription</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fine}>
            Payment is charged to your store account at confirmation. The subscription renews automatically
            unless cancelled at least 24h before the period ends; manage it in your store account settings.
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
