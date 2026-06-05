// ===================================
// Marine Safety Manager — entry point
// Providers + navigation (bottom tabs + stack modals + swipe between tabs).
// ===================================

import 'react-native-gesture-handler';
import React, { useRef, useState } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, SIZES } from './theme';
import { DataProvider } from './contexts/DataContext';

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

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const NavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent', card: COLORS.tabBackground, primary: COLORS.primary },
};

const TAB_ORDER = ['Dashboard', 'Equipment', 'Certificates', 'Reports', 'Settings'];
const TAB_ICONS: Record<string, string> = {
  Dashboard: '📊',
  Equipment: '🧰',
  Certificates: '📜',
  Reports: '📄',
  Settings: '⚙️',
};

function TabIcon({ route, focused }: { route: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 19, opacity: focused ? 1 : 0.6 }}>{TAB_ICONS[route]}</Text>
  );
}

function MainTabs() {
  const navigation = useNavigation<any>();
  const currentIdx = useRef(0);

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
            tabBarStyle: styles.tabBar,
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

function App() {
  const [showSplash, setShowSplash] = useState(true);
  // null = still loading the stored flag; false = must show; true = accepted
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);

  React.useEffect(() => {
    AsyncStorage.getItem(LEGAL_ACCEPTED_KEY)
      .then((v) => setLegalAccepted(v === '1'))
      .catch(() => setLegalAccepted(false));
  }, []);

  const acceptLegal = async () => {
    setLegalAccepted(true);
    try {
      await AsyncStorage.setItem(LEGAL_ACCEPTED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const showConsent = !showSplash && legalAccepted === false;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DataProvider>
          <NavigationContainer theme={NavTheme}>
            <StatusBar style={showSplash ? 'light' : 'dark'} />
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="CategoryItems" component={CategoryItemsSc} />
              <Stack.Screen
                name="ItemDetail"
                component={ItemDetailSc}
                options={{ presentation: 'modal' }}
              />
              <Stack.Screen name="Import" component={ImportSc} options={{ presentation: 'modal' }} />
              <Stack.Screen name="Manual" component={ManualSc} />
              <Stack.Screen name="Legal" component={LegalSc} />
              <Stack.Screen
                name="CertificateDetail"
                component={CertificateDetailSc}
                options={{ presentation: 'modal' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
          {showSplash ? (
            <View style={StyleSheet.absoluteFill}>
              <SplashSc onDone={() => setShowSplash(false)} />
            </View>
          ) : showConsent ? (
            <View style={StyleSheet.absoluteFill}>
              <ConsentSc onAccept={acceptLegal} />
            </View>
          ) : null}
        </DataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.tabBackground,
    borderTopColor: COLORS.borderLight,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingTop: 6,
  },
});

registerRootComponent(App);

export default App;
