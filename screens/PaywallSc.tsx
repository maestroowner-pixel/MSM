// ===================================
// Paywall — MSM Pro upsell. The 2-month free trial is the app's own auto counter
// (services/trial.ts, starts at install — no button); this screen sells the paid
// yearly subscription that unlocks everything once that trial has ended.
// Talks only to services/purchases (RevenueCat plugs in there later); prices
// shown here are the store-localized ones once RevenueCat is wired.
// Opened from Settings (does not gate the app yet).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, TextInput, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MciIcon } from '../components/MciIcon';
import { SIZES, Palette, APP_CONFIG } from '../theme';
import { useTheme, useThemeName } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { goBackOr } from '../utils/nav';
import {
  getOffer,
  purchaseYearly,
  restore,
  activateLicense,
  isSignedIn,
  isSubscribed,
  onEntitlementChange,
  Offer,
} from '../services/purchases';

const onWeb = Platform.OS === 'web';

type Feature = { icon: React.ComponentProps<typeof MciIcon>['name']; text: string };
const FEATURES: Feature[] = [
  { icon: 'clipboard-list-outline', text: 'Unlimited equipment & certificates' },
  { icon: 'cloud-sync-outline', text: "Cloud sync across the whole crew's devices" },
  { icon: 'file-export-outline', text: 'PDF · XLSX · ZIP register exports' },
  { icon: 'paperclip', text: 'Photo & document attachments' },
  { icon: 'bell-ring-outline', text: 'Inspection & expiry reminders' },
  { icon: 'ferry', text: 'One licence covers the vessel — every officer and device' },
];

export default function PaywallSc() {
  const nav = useNavigation<any>();
  const { refreshLocks } = useData();
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
  // Whether this vessel already holds a licence. The screen never asked before,
  // so after activating a key it went on advertising the plan as if nothing had
  // happened — the one moment the user is certain to be looking at it.
  const [licensed, setLicensed] = useState(false);

  useEffect(() => {
    getOffer().then(setOffer).catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => { void isSubscribed().then(setLicensed).catch(() => {}); };
    check();
    return onEntitlementChange(check);
  }, []);

  const onActivate = async () => {
    // The licence attaches to the VESSEL, so this device has to be on one. The
    // old text sent people to "Cloud sync (IMO + connection password)", which no
    // longer exists — joining is now name + PIN, or the setup code on the first
    // device.
    if (!signedIn && !isSignedIn()) {
      Alert.alert(
        'Join the vessel first',
        'The licence attaches to the ship, not to this device, so this device has to be on the ' +
          'vessel before it can carry one.\n\nSettings → Vessel → Join this vessel, then ' +
          'come back here.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => nav.navigate('Enrol') },
        ]
      );
      return;
    }
    setActivating(true);
    try {
      const res = await activateLicense(licenseKey);
      if (res.ok) {
        // Refresh the free-tier locks too: items beyond the cap were read-only a
        // moment ago and must open up without a restart.
        await refreshLocks().catch(() => {});
        setLicenseKey('');
        Alert.alert('MSM Pro activated', 'The licence is active on this vessel. Every enrolled device now has full access.');
        goBackOr(nav);
      } else {
        Alert.alert('Could not activate', res.message ?? 'Please check your license key.');
      }
    } finally {
      setActivating(false);
    }
  };

  // The UNIT belongs in the price. MSM Pro is licensed per VESSEL — the account
  // is the ship, keyed by its IMO, and every enrolled device on board is
  // covered by the one subscription. A bare "/ year" beside a single figure reads
  // as a per-person price, which is what it used to be.
  const priceLine = offer ? `${offer.priceString} / year` : '…';
  const priceUnit = 'per vessel — covers every device on board';

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
        await refreshLocks(); // lift the free-tier overflow lock immediately
        Alert.alert('Welcome to MSM Pro', 'Your subscription is active. Thank you!');
        goBackOr(nav);
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
      if (ok) await refreshLocks();
      Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Your subscription was restored.' : 'No active subscription found for this account.');
      if (ok) goBackOr(nav);
    } catch (e: any) {
      Alert.alert('Restore failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <TouchableOpacity style={styles.close} onPress={() => goBackOr(nav)} hitSlop={12}>
          <MciIcon name="close" size={26} color={COLORS.textLight} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Image source={require('../assets/msm-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{APP_CONFIG.name} Pro</Text>
          <Text style={styles.subtitle}>Everything you need to keep the ship's LSA & FFE register in order.</Text>

          <View style={styles.card}>
            {FEATURES.map((f, i) => (
              <View key={f.text} style={styles.featureRow}>
                <MciIcon name={f.icon} size={22} color={featureColor(i)} style={{ width: 28 }} />
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          {licensed ? (
            <View style={styles.planCard}>
              <View style={[styles.trialPill, { backgroundColor: COLORS.success }]}>
                <Text style={styles.trialPillText}>Active</Text>
              </View>
              <Text style={styles.planUnit}>
                MSM Pro is active on this vessel. Every enrolled device — this one included — has
                full access, and nothing further is needed here.
              </Text>
              <Text style={styles.planNote}>
                A yearly subscription — it renews on its own, and the licence follows the ship, so a
                new phone joining the vessel inherits it. Manage or cancel it from the LemonSqueezy
                receipt you were emailed.
              </Text>
            </View>
          ) : onWeb ? (
            <View style={styles.planCard}>
              <View style={styles.trialPill}>
                <Text style={styles.trialPillText}>Full access</Text>
              </View>
              <Text style={styles.planPrice}>{priceLine}</Text>
              <Text style={styles.planUnit}>{priceUnit}</Text>
              <Text style={styles.planNote}>Billed yearly. Auto-renews — cancel anytime.</Text>
            </View>
          ) : (
            <View style={styles.planCard}>
              <View style={styles.trialPill}>
                <Text style={styles.trialPillText}>Vessel licence</Text>
              </View>
              <Text style={styles.planUnit}>
                MSM Pro is licensed to the vessel. Once the licence is on this ship's account, every
                enrolled device — this one included — has full access.
              </Text>
              <Text style={styles.planNote}>
                Ask whoever manages the vessel's licence for the key, or sign in on a device that
                already has it.
              </Text>
            </View>
          )}

          {/* Licence activation everywhere. MSM Pro is a per-vessel licence bought
              once by the operator; a crew phone does not buy anything, it enters
              the key (or simply inherits it from the vessel account). */}
          {licensed ? null : (
          <View style={styles.licenseCard}>
            <Text style={styles.licenseTitle}>
              {onWeb ? 'Already bought? Activate your licence' : 'Activate the vessel licence'}
            </Text>
              {!signedIn && (
                <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Settings' })}>
                  <Text style={styles.signinHint}>
                    Join this vessel first (Settings → Vessel → Join this vessel) so the licence attaches to
                    the ship rather than to this handset. Tap to open Settings.
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
                  <Text style={styles.activateText}>Activate licence</Text>
                )}
              </TouchableOpacity>
          </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {/* NO BUY BUTTON, NO PRICE, NO LINK OUT ON iOS/ANDROID — deliberate.
              The vessel licence is bought by the operator on the web; an app that
              sends a user from inside iOS to an outside checkout is what App Store
              review rejects (guideline 3.1.1). What is allowed is the shape used
              here: the app is free, says nothing about where to pay, and simply
              accepts a licence key the operator was given. The store listing, not
              the app, is where the commercial arrangement is described. */}
          {onWeb && !licensed ? (
            <TouchableOpacity style={styles.cta} onPress={onSubscribe} disabled={busy} activeOpacity={0.85}>
              {busy ? (
                <ActivityIndicator color={COLORS.textWhite} />
              ) : (
                <Text style={styles.ctaText}>{`Get MSM Pro — ${priceLine}`}</Text>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={onRestore} hitSlop={8} disabled={busy}>
              <Text style={styles.restore}>
                {onWeb ? 'Restore purchase' : 'Restore the vessel licence'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fine}>
            {onWeb
              ? 'Purchase is handled securely by LemonSqueezy. Your license unlocks MSM Pro on your vessel account across devices.'
              : // Apple's IAP disclosure belongs on a screen that SELLS through IAP.
                // This one does not any more — nothing is charged to a store account
                // here — so saying it would be plainly untrue to the person reading it.
                'MSM Pro is licensed to the vessel, not to this device or to your store account. ' +
                'Nothing is purchased here: enter the licence key the vessel was issued, or open ' +
                'the app on a device already signed in to a licensed vessel.'}
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
    planUnit: {
      fontSize: SIZES.small,
      color: COLORS.primaryDark,
      textAlign: 'center',
      fontWeight: '600',
      marginTop: SIZES.xs,
    },
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
