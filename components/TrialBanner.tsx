// ===================================
// Trial reminder banner. Shows the MSM Pro trial state — days left and the exact
// end date — and routes to the paywall. Re-checks on focus so it disappears right
// after a licence is activated.
//
// IT SHOWS WHEREVER THE TRIAL IS ENFORCED, and that condition is READ FROM
// `ENFORCE_LIMITS` rather than restated here. It used to be a local
// `Platform.OS === 'web'`, written when web was the only enforced platform; iOS
// was switched on later and this copy was not, so an iPhone silently hit the
// free-tier caps on day 61 with no warning at any point — the equipment simply
// stopped being addable. Duplicating the condition is what allowed the two to
// drift, so the duplicate is gone.
//
// On Android it still renders nothing, correctly: limits are not enforced there
// (no Play product yet), and warning about an expiry that will not happen would
// be worse than saying nothing.
// ===================================

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { MciIcon } from './MciIcon';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { ENFORCE_LIMITS, getTrialInfo } from '../services/trial';
import { getOffer, isSubscribed, onEntitlementChange } from '../services/purchases';
import { formatDate } from '../utils/dates';

/** The one condition — see the header. */
const showBanner = ENFORCE_LIMITS;

type Kind = 'trial' | 'expired';
interface State {
  kind: Kind;
  daysLeft: number;
  endsAt: string; // formatted date
  /** Localized, PER PLATFORM — see the load() note. */
  priceString: string;
}

export function TrialBanner() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const focused = useIsFocused();
  const [state, setState] = useState<State | null>(null);

  const load = useCallback(async () => {
    if (!showBanner) return;
    try {
      // Paid up: show NOTHING. A banner is a call to act, and there is nothing
      // left to do — thanking the crew for the purchase on every launch of the
      // Dashboard just takes a strip of the screen away from the expiries the
      // screen exists to show.
      if (await isSubscribed()) {
        setState(null);
        return;
      }
      const t = await getTrialInfo();
      // The price comes from services/purchases, which answers per platform — the
      // App Store's localized string on iOS, LemonSqueezy's on web. This banner
      // used to import the LemonSqueezy string directly, which was right while it
      // was web-only and became wrong the moment it started showing on iOS: it
      // quoted the web price (€9.99) beside a paywall charging the store price.
      const offer = await getOffer();
      const endsAt = t.endsAt ? formatDate(new Date(t.endsAt).toISOString().slice(0, 10)) : '';
      setState({
        kind: t.expired ? 'expired' : 'trial',
        daysLeft: t.daysLeft,
        endsAt,
        priceString: offer.priceString,
      });
    } catch {
      setState(null);
    }
  }, []);

  useEffect(() => {
    if (focused) load();
  }, [focused, load]);

  // Focus is not enough: a licence is activated on the paywall, which sits over
  // this screen, so the Dashboard may never lose and regain focus and the banner
  // would keep showing a trial that has just been paid for.
  useEffect(() => onEntitlementChange(() => void load()), [load]);

  if (!showBanner || !state) return null;

  const styles = makeStyles(COLORS, state.kind);
  const go = () => nav.navigate('Paywall');

  const expired = state.kind === 'expired';
  return (
    <TouchableOpacity style={styles.wrap} onPress={go} activeOpacity={0.85}>
      <MciIcon
        name={expired ? 'lock-alert' : 'clock-outline'}
        size={20}
        color={expired ? COLORS.danger : COLORS.primary}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>
          {expired ? 'Free trial ended' : `Free trial · ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'} left`}
        </Text>
        <Text style={styles.sub}>
          {expired
            ? `Trial ended ${state.endsAt}. Subscribe to keep adding items & certificates.`
            : `Ends ${state.endsAt} · then ${state.priceString}/year per vessel. Tap to upgrade to Pro.`}
        </Text>
      </View>
      <Text style={styles.cta}>{expired ? 'Upgrade' : '›'}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette, kind: Kind) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: kind === 'expired' ? COLORS.danger : COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      marginBottom: SIZES.md,
    },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    cta: { fontSize: SIZES.body, fontWeight: '800', color: kind === 'expired' ? COLORS.danger : COLORS.primary },
  });
