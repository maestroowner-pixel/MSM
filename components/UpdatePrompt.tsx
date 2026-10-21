// ===================================
// "A new version is available — update now, or remind me later."
//
// Phone: asked at start (and on coming back after half a day — a vessel leaves
// the app open for days) when the store has a newer version (utils/appUpdate).
// "Later" holds it until the next start; on Android the back button that would
// close the app asks once more. iOS gives an app no moment before it closes,
// so there the next start is the reminder.
//
// Web: asked when the site has been redeployed (utils/webUpdate); "later"
// asks again in two hours. No reminder on closing the tab — the next tab
// opens the new version anyway. The quiet strip on the dashboard
// (UpdateBanner) stays as well.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { APP_CONFIG, SIZES, Palette } from '../theme';
import { useT } from '../utils/i18n';
import { isNewer, openStore, storeVersion } from '../utils/appUpdate';
import { CHECK_INTERVAL_MS, applyWebUpdate, isNewBuildAvailable } from '../utils/webUpdate';
import { navRef } from '../utils/favourites';

const onWeb = Platform.OS === 'web';
const WEB_REMIND_MS = 2 * 60 * 60 * 1000;
const NATIVE_RECHECK_MS = 12 * 60 * 60 * 1000;

type Ask = null | 'new' | 'closing';

export function UpdatePrompt() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const t = useT();
  const [ask, setAsk] = useState<Ask>(null);
  const [version, setVersion] = useState<string | null>(null);
  // Web: when "later" was pressed. Native: whether it was put off this run.
  const later = useRef(0);
  const lastCheck = useRef(0);

  // Web: the redeploy check, every half hour.
  useEffect(() => {
    if (!onWeb) return;
    let alive = true;
    const check = async () => {
      if (!(await isNewBuildAvailable()) || !alive) return;
      if (Date.now() - later.current >= WEB_REMIND_MS) setAsk((a) => a ?? 'new');
    };
    void check(); // records the baseline
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Phone: the store, at start and on coming back after a long while.
  useEffect(() => {
    if (onWeb) return;
    const check = async () => {
      lastCheck.current = Date.now();
      const v = await storeVersion();
      if (!v || !isNewer(v, APP_CONFIG.version)) return;
      setVersion(v);
      if (!later.current) setAsk((a) => a ?? 'new');
    };
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastCheck.current >= NATIVE_RECHECK_MS) {
        later.current = 0;
        void check();
      }
    });
    return () => sub.remove();
  }, []);

  // Android: the back button that would close the app asks once more.
  useEffect(() => {
    if (Platform.OS !== 'android' || !version) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ask || (navRef.isReady() && navRef.canGoBack())) return false;
      setAsk('closing');
      return true;
    });
    return () => sub.remove();
  }, [version, ask]);

  if (!ask) return null;

  const now = () => {
    setAsk(null);
    if (onWeb) applyWebUpdate();
    else void openStore();
  };
  const putOff = () => {
    later.current = Date.now();
    if (ask === 'closing') BackHandler.exitApp();
    setAsk(null);
  };

  const closing = ask === 'closing';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={putOff}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <View style={styles.head}>
            <MciIcon name="cloud-download" size={24} color={COLORS.primary} />
            <Text style={styles.title}>{closing ? t('update.closingTitle') : t('update.title')}</Text>
          </View>
          <Text style={styles.body}>
            {onWeb
              ? t('update.bodyWeb')
              : closing
                ? t('update.closingBody', { version: version ?? '' })
                : t('update.body', { version: version ?? '', current: APP_CONFIG.version })}
          </Text>
          <TouchableOpacity style={styles.primary} onPress={now} accessibilityRole="button">
            <Text style={styles.primaryText}>{onWeb ? t('update.reload') : t('update.now')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={putOff} accessibilityRole="button">
            <Text style={styles.secondaryText}>{closing ? t('update.close') : t('update.later')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: SIZES.lg },
    card: {
      width: '100%', maxWidth: 400, backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusMd, padding: SIZES.lg,
      shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 18, elevation: 14,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm },
    title: { flex: 1, fontWeight: '800', fontSize: SIZES.body, color: COLORS.textDark },
    body: { color: COLORS.textDark, fontSize: SIZES.small, lineHeight: 20, marginBottom: SIZES.lg },
    primary: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 12, alignItems: 'center' },
    primaryText: { color: COLORS.textWhite, fontWeight: '800' },
    secondary: { paddingVertical: 12, alignItems: 'center', marginTop: SIZES.xs },
    secondaryText: { color: COLORS.primary, fontWeight: '700' },
  });
