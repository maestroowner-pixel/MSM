// ===================================
// Paywall — ISM AI Pilot Pro upsell. The 2-month free trial is the app's own auto counter
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
import { BackButton } from '../components/ui';
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
import { t, tk, useT } from '../utils/i18n';

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
  useT();
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
        t('pw.joinFirst'),
        t('pw.joinFirstBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('cs.openSettings'), onPress: () => nav.navigate('Enrol') },
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
        Alert.alert(t('pw.activated'), t('pw.activatedBody'));
        goBackOr(nav);
      } else {
        Alert.alert(t('pw.couldNot'), res.message ?? t('pw.checkKey'));
      }
    } finally {
      setActivating(false);
    }
  };

  // The UNIT belongs in the price. ISM AI Pilot Pro is licensed per VESSEL — the account
  // is the ship, keyed by its IMO, and every enrolled device on board is
  // covered by the one subscription. A bare "/ year" beside a single figure reads
  // as a per-person price, which is what it used to be.
  const priceLine = offer ? t('pw.perYear', { price: offer.priceString }) : '…';
  const priceUnit = t('pw.unit');

  const onSubscribe = async () => {
    if (!offer?.available) {
      Alert.alert(t('pw.soon'), t('pw.soonBody'));
      return;
    }
    if (onWeb) {
      // Opens the LemonSqueezy checkout in a new tab; the license key arrives by
      // email, then the user activates it in the field below.
      await purchaseYearly();
      Alert.alert(
        t('pw.checkout'),
        t('pw.checkoutBody')
      );
      return;
    }
    setBusy(true);
    try {
      const ok = await purchaseYearly();
      if (ok) {
        await refreshLocks(); // lift the free-tier overflow lock immediately
        Alert.alert(t('pw.welcome'), t('pw.welcomeBody'));
        goBackOr(nav);
      } else {
        Alert.alert(t('pw.notCompleted'), t('pw.notCompletedBody'));
      }
    } catch (e: any) {
      Alert.alert(t('pw.failed'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    // NO STORE GATE HERE. `offer.available` means "the store still sells a
    // subscription product", and since the licence moved to LemonSqueezy it is
    // false on iOS and Android — which silently killed the one button a crew
    // member actually needs. Restoring reads the entitlement off the VESSEL and
    // re-checks the key; the store is not involved, and `restore()` falls back
    // to it only for the vessels that bought one before licences existed.
    setBusy(true);
    try {
      const ok = await restore();
      if (ok) await refreshLocks();
      Alert.alert(
        ok ? t('pw.restored') : t('pw.nothingRestore'),
        ok
          ? t('pw.restoredBody')
          : signedIn
            ? t('pw.noLicence')
            : t('pw.joinToRestore')
      );
      if (ok) goBackOr(nav);
    } catch (e: any) {
      Alert.alert(t('pw.restoreFailed'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right', 'bottom']}>
        <BackButton onPress={() => goBackOr(nav)} style={styles.close} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Image source={require('../assets/msm-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>{APP_CONFIG.name} Pro</Text>
          <Text style={styles.subtitle}>{t('pw.subtitle')}</Text>

          <View style={styles.card}>
            {FEATURES.map((f, i) => (
              <View key={f.text} style={styles.featureRow}>
                <MciIcon name={f.icon} size={22} color={featureColor(i)} style={{ width: 28 }} />
                <Text style={styles.featureText}>{tk(`pw.f.${i}`)}</Text>
              </View>
            ))}
          </View>

          {licensed ? (
            <View style={styles.planCard}>
              <View style={[styles.trialPill, { backgroundColor: COLORS.success }]}>
                <Text style={styles.trialPillText}>{t('pw.active')}</Text>
              </View>
              <Text style={styles.planUnit}>
                {t('pw.activeBody')}
              </Text>
              <Text style={styles.planNote}>
                {t('pw.yearlyNote')}
              </Text>
            </View>
          ) : onWeb ? (
            <View style={styles.planCard}>
              <View style={styles.trialPill}>
                <Text style={styles.trialPillText}>{t('pw.full')}</Text>
              </View>
              <Text style={styles.planPrice}>{priceLine}</Text>
              <Text style={styles.planUnit}>{priceUnit}</Text>
              <Text style={styles.planNote}>{t('pw.billed')}</Text>
            </View>
          ) : (
            <View style={styles.planCard}>
              <View style={styles.trialPill}>
                <Text style={styles.trialPillText}>{t('pw.vesselLicence')}</Text>
              </View>
              <Text style={styles.planUnit}>
                {t('pw.licensedBody')}
              </Text>
              <Text style={styles.planNote}>
                {t('pw.askKey')}
              </Text>
            </View>
          )}

          {/* Licence activation everywhere. ISM AI Pilot Pro is a per-vessel licence bought
              once by the operator; a crew phone does not buy anything, it enters
              the key (or simply inherits it from the vessel account). */}
          {licensed ? null : (
          <View style={styles.licenseCard}>
            <Text style={styles.licenseTitle}>
              {onWeb ? t('pw.alreadyBought') : t('pw.activateVessel')}
            </Text>
              {!signedIn && (
                <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Settings' })}>
                  <Text style={styles.signinHint}>
                    {t('pw.joinHint')}
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
                  <Text style={styles.activateText}>{t('pw.activate')}</Text>
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
                <Text style={styles.ctaText}>{t('pw.get', { price: priceLine })}</Text>
              )}
            </TouchableOpacity>
          ) : null}

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={onRestore} hitSlop={8} disabled={busy}>
              <Text style={styles.restore}>
                {onWeb ? t('pw.restore') : t('pw.restoreVessel')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fine}>
            {onWeb
              ? t('pw.lsNote')
              : // Apple's IAP disclosure belongs on a screen that SELLS through IAP.
                // This one does not any more — nothing is charged to a store account
                // here — so saying it would be plainly untrue to the person reading it.
                t('pw.nativeNote')}
          </Text>
          <View style={styles.legalRow}>
            <TouchableOpacity onPress={() => nav.navigate('Legal', { doc: 'terms' })} hitSlop={8}>
              <Text style={styles.legalLink}>{t('pw.terms')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => nav.navigate('Legal', { doc: 'privacy' })} hitSlop={8}>
              <Text style={styles.legalLink}>{t('pw.privacy')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    close: { alignSelf: 'flex-start', paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm },
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
