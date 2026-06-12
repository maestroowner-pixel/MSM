// ===================================
// Marine Safety Manager — entry point
// Providers + navigation (bottom tabs + stack modals + swipe between tabs).
// ===================================

import 'react-native-gesture-handler';
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Image, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SIZES } from './theme';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DataProvider } from './contexts/DataContext';
import { applyOrientationPolicy } from './utils/orientation';
import { ensureTrialStarted } from './services/trial';

import ModalOutlet from './components/ModalOutlet';
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
import LegalSc from './screens/LegalSc';
import CertificatesSc from './screens/CertificatesSc';
import CertificateDetailSc from './screens/CertificateDetailSc';
import CompressorSc from './screens/CompressorSc';
import PaywallSc from './screens/PaywallSc';

// macOS asset fix — runs once at module load (after Expo's side-effects). Expo
// registers a custom asset source transformer that resolves require()'d images via
// `Asset.fromMetadata(...).uri`, which is EMPTY on react-native-macos (it needs the
// Expo manifest / expo-constants, unavailable here) → `<Image source={require(...)}>`
// renders nothing (e.g. the splash logo). Replace it with React Native's default
// resolver, which builds the correct dev-server (http) or bundled (file://) URI. See MACOS.md.
if (
  Platform.OS === 'macos' &&
  typeof (Image.resolveAssetSource as any)?.setCustomSourceTransformer === 'function'
) {
  (Image.resolveAssetSource as any).setCustomSourceTransformer((resolver: any) =>
    resolver.defaultAsset()
  );
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// macOS has no swipe-back gesture (gesture-handler swipe is touch-only), so pushed
// stack screens would be a dead end with the app's header-less design. On macOS show
// a minimal native header (just a back button) so every pushed/modal screen can be
// exited; iOS/Android keep the header-less swipe-back. See MACOS.md.
const onMacOS = Platform.OS === 'macos';

const TAB_ORDER = ['Dashboard', 'Equipment', 'Certificates', 'Reports', 'Settings'];
const TAB_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  Dashboard: 'view-dashboard',
  Equipment: 'toolbox',
  Certificates: 'certificate',
  Reports: 'file-document',
  Settings: 'cog',
};

function TabIcon({ route, focused }: { route: string; focused: boolean }) {
  const COLORS = useTheme();
  return (
    <MaterialCommunityIcons
      name={TAB_ICONS[route]}
      size={focused ? 26 : 23}
      color={focused ? COLORS.tabActive : COLORS.tabInactive}
    />
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
          <Tab.Screen name="Dashboard" component={DashboardSc} />
          <Tab.Screen name="Equipment" component={CategoriesSc} />
          <Tab.Screen name="Certificates" component={CertificatesSc} />
          <Tab.Screen name="Reports" component={ReportsSc} />
          <Tab.Screen name="Settings" component={SettingsSc} />
        </Tab.Navigator>
      </View>
    </GestureDetector>
  );
}

function Root() {
  const COLORS = useTheme();
  const [showSplash, setShowSplash] = useState(true);
  // null = still loading the stored flag; false = must show; true = accepted
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);

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

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={showSplash ? 'light' : COLORS.statusBar} />
      <Stack.Navigator
        screenOptions={{
          // Header-less everywhere on mobile (swipe-back). On macOS, show a minimal
          // back-button-only header on pushed screens so they can be dismissed.
          headerShown: onMacOS,
          headerTitle: '',
          headerBackTitle: 'Back',
          headerTintColor: COLORS.primary,
          headerStyle: { backgroundColor: COLORS.background, shadowColor: 'transparent', elevation: 0 },
        }}
      >
        {/* Root tabs never show the stack header. */}
        <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="CategoryItems" component={CategoryItemsSc} />
        <Stack.Screen name="ItemDetail" component={ItemDetailSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Import" component={ImportSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Manual" component={ManualSc} />
        <Stack.Screen name="Legal" component={LegalSc} />
        <Stack.Screen name="Compressor" component={CompressorSc} />
        <Stack.Screen name="Paywall" component={PaywallSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CertificateDetail" component={CertificateDetailSc} options={{ presentation: 'modal' }} />
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
      {/* Renders macOS modal overlays on top of everything (no-op on iOS/Android). */}
      <ModalOutlet />
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);

export default App;
