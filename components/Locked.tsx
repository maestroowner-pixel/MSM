// ===================================
// Locked — what a module's screen shows on a device that has not joined a
// vessel (constants/modules moduleLocked, 14 Nov 2026): the menu lists the
// module, the screen keeps its content to itself and says how to try it:
// ask us for a trial, get the vessel's setup code, join the vessel.
//
// On the web only. In the store apps it says no more than "joins a vessel" and
// offers Join: no trial, no mail to us, no licence — a store app that points to
// selling outside the store is refused (App Store 3.1.1; the app is the
// enterprise kind, 3.1.3(c): the company buys, its people sign in).
const WEB = Platform.OS === 'web';
// ===================================

import React from 'react';
import { Alert, Linking, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Screen, ScreenTitle } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { APP_CONFIG, SIZES } from '../theme';
import { useData } from '../contexts/DataContext';
import { t, useT } from '../utils/i18n';

export default function Locked({ title }: { title?: string }) {
  useT();
  const c = useTheme();
  const nav = useNavigation<any>();
  const { vessel } = useData();
  const askTrial = () => {
    const who = [vessel?.vessel_name, vessel?.imo ? `IMO ${vessel.imo}` : ''].filter(Boolean).join(', ');
    const subject = encodeURIComponent(`ISMpilot trial${who ? ` — ${who}` : ''}`);
    const body = encodeURIComponent(t('lock.trialMail', { vessel: who || '—' }));
    void Linking.openURL(`mailto:${APP_CONFIG.email}?subject=${subject}&body=${body}`).catch(() => Alert.alert(t('lock.trial'), APP_CONFIG.email));
  };
  const step = (n: number, text: string) => (
    <View key={n} style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-start' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{n}</Text>
      </View>
      <Text style={{ flex: 1, color: c.text, lineHeight: 21 }}>{text}</Text>
    </View>
  );
  const button = (label: string, go: () => void, main: boolean) => (
    <TouchableOpacity
      onPress={go}
      activeOpacity={0.8}
      style={{ paddingVertical: SIZES.md, paddingHorizontal: SIZES.lg, borderRadius: 10, alignItems: 'center', backgroundColor: main ? c.primary : 'transparent', borderWidth: 1, borderColor: c.primary }}
    >
      <Text style={{ color: main ? '#fff' : c.primary, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <Screen scroll>
      {title ? <ScreenTitle title={title} /> : null}
      <Card>
        <View style={{ alignItems: 'center', paddingVertical: SIZES.lg, gap: SIZES.md }}>
          <MciIcon name="lock-outline" size={44} color={c.primary} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, textAlign: 'center' }}>{t('lock.title')}</Text>
          <Text style={{ color: c.textLight, textAlign: 'center', maxWidth: 460, lineHeight: 21 }}>{t('lock.body')}</Text>
          {WEB ? <View style={{ gap: SIZES.md, alignSelf: 'center', maxWidth: 460, width: '100%', marginTop: SIZES.sm }}>
            <Text style={{ fontWeight: '700', color: c.text }}>{t('lock.how')}</Text>
            {step(1, t('lock.step1', { email: APP_CONFIG.email }))}
            {step(2, t('lock.step2'))}
            {step(3, t('lock.step3'))}
          </View> : null}
          <View style={{ gap: SIZES.sm, alignSelf: 'center', maxWidth: 360, width: '100%', marginTop: SIZES.sm }}>
            {WEB ? button(t('lock.trial'), askTrial, true) : null}
            {button(t(WEB ? 'lock.join' : 'lock.joinApp'), () => nav.navigate('Enrol'), !WEB)}
          </View>
        </View>
      </Card>
    </Screen>
  );
}
