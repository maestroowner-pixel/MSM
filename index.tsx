// ===================================
// Marine Safety Manager — entry point
// Providers + navigation (bottom tabs + stack modals + swipe between tabs).
// ===================================

import 'react-native-gesture-handler';
import './utils/webAlert'; // web: make Alert.alert use the browser dialog (no-op on native)
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Platform, Linking } from 'react-native';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation, useIsFocused, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MciIcon } from './components/MciIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SIZES } from './theme';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DataProvider, useData } from './contexts/DataContext';
import { applyOrientationPolicy } from './utils/orientation';
import { ensureTrialStarted } from './services/trial';
import { parseDeepLink, DeepLink } from './services/qrLabel';

import SplashSc from './screens/SplashSc';
import ConsentSc from './screens/ConsentSc';
import { LEGAL_ACCEPTED_KEY } from './constants/legal';
import DashboardSc from './screens/DashboardSc';
import CategoriesSc from './screens/CategoriesSc';
import CategoryItemsSc from './screens/CategoryItemsSc';
import ItemDetailSc from './screens/ItemDetailSc';
import ImportSc from './screens/ImportSc';
import ReportsSc from './screens/ReportsSc';
import SettingsSc from './screens/SettingsSc';
import ManualSc from './screens/ManualSc';
import GettingStartedSc from './screens/GettingStartedSc';
import LegalSc from './screens/LegalSc';
import CertificatesSc from './screens/CertificatesSc';
import CertificateDetailSc from './screens/CertificateDetailSc';
import CompressorSc from './screens/CompressorSc';
import PaywallSc from './screens/PaywallSc';
import LabelSc from './screens/LabelSc';
import ScanSc from './screens/ScanSc';
import FlaggedSc from './screens/FlaggedSc';
import RecentScansSc from './screens/RecentScansSc';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ORDER = ['Dashboard', 'Equipment', 'Certificates', 'Reports', 'Settings'];
const TAB_ICONS: Record<string, string> = {
  Dashboard: 'view-dashboard',
  Equipment: 'toolbox',
  Certificates: 'certificate',
  Reports: 'file-document',
  Settings: 'cog',
};

function TabIcon({ route, focused }: { route: string; focused: boolean }) {
  const COLORS = useTheme();
  // The active tab gently "breathes" (pulsing scale); inactive tabs settle a
  // touch smaller. Plain RN Animated — no reanimated (matches the swipe gesture).
  const scale = useRef(new Animated.Value(focused ? 1 : 0.9)).current;

  React.useEffect(() => {
    if (focused) {
      scale.setValue(1);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.0, duration: 700, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <MciIcon
        name={TAB_ICONS[route]}
        size={24}
        color={focused ? COLORS.tabActive : COLORS.tabInactive}
      />
    </Animated.View>
  );
}

// bottom-tabs v6 has no built-in scene transition, so each tab screen fades +
// slides in whenever it gains focus (tap or swipe). Plain RN Animated.
function TabFade({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();
  const a = useRef(new Animated.Value(focused ? 1 : 0)).current;
  React.useEffect(() => {
    if (!focused) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [focused, a]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: a,
        transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function MainTabs() {
  const navigation = useNavigation<any>();
  const currentIdx = useRef(0);
  const insets = useSafeAreaInsets();
  const COLORS = useTheme();

  // Edge-to-edge is enabled, so the tab bar draws behind the Android system
  // navigation (3-button or gesture). Pad the bar by the bottom inset so the
  // tabs are never hidden under the navigation buttons.
  const tabBarStyle = {
    backgroundColor: COLORS.tabBackground,
    borderTopColor: COLORS.borderLight,
    height: 60 + insets.bottom,
    paddingTop: 6,
    paddingBottom: insets.bottom + 6,
  };

  // Swipe left/right to move between tabs (gesture-handler, no reanimated needed).
  const swipe = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-15, 15])
    .minVelocityX(180)
    .onEnd((e) => {
      const idx = currentIdx.current;
      if (e.translationX < -45 && idx < TAB_ORDER.length - 1) navigation.navigate(TAB_ORDER[idx + 1]);
      else if (e.translationX > 45 && idx > 0) navigation.navigate(TAB_ORDER[idx - 1]);
    })
    .runOnJS(true);

  return (
    <GestureDetector gesture={swipe}>
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          screenListeners={{
            state: (e: any) => {
              const idx = e.data?.state?.index;
              if (typeof idx === 'number') currentIdx.current = idx;
            },
          }}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: COLORS.tabActive,
            tabBarInactiveTintColor: COLORS.tabInactive,
            tabBarStyle: tabBarStyle as any,
            tabBarLabelStyle: { fontSize: SIZES.tiny, fontWeight: '600' },
            tabBarIcon: ({ focused }) => <TabIcon route={route.name} focused={focused} />,
          })}
        >
          <Tab.Screen name="Dashboard">
            {() => <TabFade><DashboardSc /></TabFade>}
          </Tab.Screen>
          <Tab.Screen name="Equipment">
            {() => <TabFade><CategoriesSc /></TabFade>}
          </Tab.Screen>
          <Tab.Screen name="Certificates">
            {() => <TabFade><CertificatesSc /></TabFade>}
          </Tab.Screen>
          <Tab.Screen name="Reports">
            {() => <TabFade><ReportsSc /></TabFade>}
          </Tab.Screen>
          <Tab.Screen name="Settings">
            {() => <TabFade><SettingsSc /></TabFade>}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
    </GestureDetector>
  );
}

function Root() {
  const COLORS = useTheme();
  const navigationRef = useNavigationContainerRef<any>();
  const { flat } = useData();
  const [showSplash, setShowSplash] = useState(true);
  // null = still loading the stored flag; false = must show; true = accepted
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);

  // A MSM sticker's QR is `msm://item/<id>`, and `msm` is this app's URL scheme
  // (app.json), so scanning it with the PHONE'S camera opens the app. The home-
  // screen widgets speak the same scheme with two extra verbs — `msm://scan` and
  // `msm://flagged` — so a tap on a widget lands in the app the same way a scanned
  // label does. Capture whichever link brought us here, both on a cold start
  // (getInitialURL) and while the app is already open (the 'url' event).
  const [pendingLink, setPendingLink] = useState<DeepLink | null>(null);
  useEffect(() => {
    const take = (url: string | null) => {
      const link = url ? parseDeepLink(url) : null;
      if (link) setPendingLink(link);
    };
    Linking.getInitialURL().then(take).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => take(e.url));
    return () => sub.remove();
  }, []);

  React.useEffect(() => {
    AsyncStorage.getItem(LEGAL_ACCEPTED_KEY)
      .then((v) => setLegalAccepted(v === '1'))
      .catch(() => setLegalAccepted(false));
    // Phones: portrait only. Tablets (iPad / large Android): allow rotation.
    applyOrientationPolicy();
    // Start the free-trial counter on first launch (records the date only;
    // limits stay OFF until services/trial ENFORCE_LIMITS is enabled).
    ensureTrialStarted();
  }, []);

  const acceptLegal = async () => {
    setLegalAccepted(true);
    try {
      await AsyncStorage.setItem(LEGAL_ACCEPTED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: COLORS.background,
      card: COLORS.tabBackground,
      primary: COLORS.primary,
      text: COLORS.text,
      border: COLORS.border,
    },
  };

  const showConsent = !showSplash && legalAccepted === false;

  // Web has no swipe-back gesture, and these pushed screens draw no back button
  // of their own, so on web they'd be a dead end. Show a native stack header
  // (with the automatic back arrow) for them on web only. Modals keep their own
  // close controls, and the tab host (Main) stays header-less. On native this is
  // null → unchanged (swipe-back as before).
  const webHeader = (title: string) =>
    Platform.OS === 'web'
      ? {
          headerShown: true,
          title,
          headerStyle: { backgroundColor: COLORS.tabBackground },
          headerTintColor: COLORS.primary,
          headerTitleStyle: { color: COLORS.text },
        }
      : undefined;

  // Follow the pending link once the app is usable (splash gone, consent given)
  // and the navigator is ready. A link that arrives earlier waits here rather than
  // being lost. An item link needs a {category, id}: the sticker carries only the
  // id, so the category is recovered from the register (same as a scanned code) —
  // if the id is unknown, fall back to the scanner so the user can look manually.
  useEffect(() => {
    if (showSplash || legalAccepted !== true || !pendingLink) return;
    let cancelled = false;
    const open = () => {
      if (cancelled) return;
      if (!navigationRef.isReady()) {
        setTimeout(open, 100);
        return;
      }
      if (pendingLink.type === 'scan') navigationRef.navigate('Scan');
      else if (pendingLink.type === 'flagged') navigationRef.navigate('Flagged');
      else {
        const found = flat.find((i) => i.id === pendingLink.id);
        if (found) navigationRef.navigate('ItemDetail', { category: found.category, id: found.id });
        else navigationRef.navigate('Scan');
      }
      setPendingLink(null);
    };
    open();
    return () => {
      cancelled = true;
    };
  }, [showSplash, legalAccepted, pendingLink, flat]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={showSplash ? 'light' : COLORS.statusBar} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          // On web a pushed card's height otherwise collapses to its content, so
          // a Screen's ScrollView has no bounded height to scroll within (the
          // body itself is overflow:hidden). flex:1 makes each card fill the
          // viewport → inner ScrollViews scroll (e.g. the Manual). No-op on native.
          cardStyle: Platform.OS === 'web' ? { flex: 1 } : undefined,
          // Smooth horizontal slide between pushed screens (modals keep their
          // own slide-up via presentation: 'modal').
          ...TransitionPresets.SlideFromRightIOS,
        }}
      >
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="CategoryItems" component={CategoryItemsSc} options={webHeader('Equipment')} />
        <Stack.Screen name="ItemDetail" component={ItemDetailSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Import" component={ImportSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Manual" component={ManualSc} options={webHeader('Manual')} />
        <Stack.Screen name="GettingStarted" component={GettingStartedSc} options={webHeader('Getting Started')} />
        <Stack.Screen name="Legal" component={LegalSc} options={webHeader('Legal')} />
        <Stack.Screen name="Compressor" component={CompressorSc} options={webHeader('BA Compressor')} />
        <Stack.Screen name="Paywall" component={PaywallSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CertificateDetail" component={CertificateDetailSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Label" component={LabelSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Scan" component={ScanSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Flagged" component={FlaggedSc} options={webHeader('Flagged')} />
        <Stack.Screen name="RecentScans" component={RecentScansSc} options={webHeader('Recently scanned')} />
      </Stack.Navigator>
      {showSplash ? (
        <View style={StyleSheet.absoluteFill}>
          <SplashSc onDone={() => setShowSplash(false)} />
        </View>
      ) : showConsent ? (
        <View style={StyleSheet.absoluteFill}>
          <ConsentSc onAccept={acceptLegal} />
        </View>
      ) : null}
    </NavigationContainer>
  );
}

function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DataProvider>
            <Root />
          </DataProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Android home-screen widgets run their render in a headless JS task; the handler
// has to be registered at the top of the entry file so both the app process and
// that task pick it up. Required lazily so react-native-android-widget (an
// Android-only module) is never even imported on iOS or web.
if (Platform.OS === 'android') {
  require('./widgets/widget-task-handler').registerMsmWidgets();
}

registerRootComponent(App);

export default App;
