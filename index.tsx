// ===================================
// Marine Safety Manager — entry point
// Providers + navigation (bottom tabs + stack modals + swipe between tabs).
// ===================================

import 'react-native-gesture-handler';
import './utils/webAlert'; // web: make Alert.alert use the browser dialog (no-op on native)
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Animated, Platform, Linking, useWindowDimensions } from 'react-native';
import { registerRootComponent } from 'expo';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, useNavigation, useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, TransitionPresets } from '@react-navigation/stack';
// The stack's own back button, used directly so it can be shown when the stack cannot go back.
import { HeaderBackButton } from '@react-navigation/elements';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MciIcon } from './components/MciIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SIZES, APP_CONFIG } from './theme';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { DataProvider, useData } from './contexts/DataContext';
import { SyncProvider, useSync } from './contexts/SyncContext';
import { SignConfirmProvider } from './components/SignConfirm';
import { PinChangeProvider } from './components/PinChange';
import { applyOrientationPolicy } from './utils/orientation';
import { goBackOr } from './utils/nav';
import { ensureTrialStarted } from './services/trial';
import { parseDeepLink, DeepLink } from './services/qrLabel';

import SplashSc from './screens/SplashSc';
import ConsentSc from './screens/ConsentSc';
import { LEGAL_ACCEPTED_KEY } from './constants/legal';
import DashboardSc from './screens/DashboardSc';
import BoardSc from './screens/BoardSc';
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
import HoursOfRestSc from './screens/HoursOfRestSc';
import RestDaySc from './screens/RestDaySc';
import MaintenanceSc from './screens/MaintenanceSc';
import MachineSc from './screens/MachineSc';
import PmsJobSc from './screens/PmsJobSc';
import PmsDefectSc from './screens/PmsDefectSc';
import PmsProjectsSc, { PmsProjectSc } from './screens/PmsProjectsSc';
import WatchLogSc from './screens/WatchLogSc';
import WatchEntrySc from './screens/WatchEntrySc';
import DeckLogSc from './screens/DeckLogSc';
import GmdssSc from './screens/GmdssSc';
import DeckEntrySc from './screens/DeckEntrySc';
import AuditsSc from './screens/AuditsSc';
import AuditSc from './screens/AuditSc';
import LandingsSc from './screens/LandingsSc';
import LandingReportSc from './screens/LandingReportSc';
import CompressorSc from './screens/CompressorSc';
import PaywallSc from './screens/PaywallSc';
import LabelSc from './screens/LabelSc';
import LabelBatchSc from './screens/LabelBatchSc';
import ScanSc from './screens/ScanSc';
import FlaggedSc from './screens/FlaggedSc';
import RecentScansSc from './screens/RecentScansSc';
import InspectionSc from './screens/InspectionSc';
import CrewSc from './screens/CrewSc';
import ChecklistsSc from './screens/ChecklistsSc';
import ScanRulesSc from './screens/ScanRulesSc';
import PhotoArchiveSc from './screens/PhotoArchiveSc';
import CategoriesEditSc from './screens/CategoriesEditSc';
import ChecklistEditSc from './screens/ChecklistEditSc';
import DefectsSc from './screens/DefectsSc';
import InspectionDetailSc from './screens/InspectionDetailSc';
import AccountsSc from './screens/AccountsSc';
import MasterSc from './screens/MasterSc';
import EmailReportSc from './screens/EmailReportSc';
import SparesSc from './screens/SparesSc';
import SparePartSc from './screens/SparePartSc';
import DocsSc from './screens/DocsSc';
import DocSc from './screens/DocSc';
import CrewMemberSc from './screens/CrewMemberSc';
import PermitsSc from './screens/PermitsSc';
import FuelSc from './screens/FuelSc';
import { swipeLock } from './utils/swipeLock';
import GarbageSc from './screens/GarbageSc';
import OrbSc from './screens/OrbSc';
import LogBookSc from './screens/LogBookSc';
import SopepSc from './screens/SopepSc';
import SecuritySc from './screens/SecuritySc';
import SurveysSc from './screens/SurveysSc';
import ReadinessSc from './screens/ReadinessSc';
import HandoverSc from './screens/HandoverSc';
import ServiceReportSc from './screens/ServiceReportSc';
import DpSc from './screens/DpSc';
import WatchChecksSc from './screens/WatchChecksSc';
import DpCheckSc from './screens/DpCheckSc';
import DpTemplatesSc from './screens/DpTemplatesSc';
import SafetySc from './screens/SafetySc';
import NcSc from './screens/NcSc';
import DrillsSc from './screens/DrillsSc';
import DrillSc from './screens/DrillSc';
import MeetingSc from './screens/MeetingSc';
import AskSc from './screens/AskSc';
import HospitalSc from './screens/HospitalSc';
import PassengersSc from './screens/PassengersSc';
import StoresSc from './screens/StoresSc';
import MedItemSc from './screens/MedItemSc';
import TreatmentSc from './screens/TreatmentSc';
import MedOrderSc from './screens/MedOrderSc';
import MedCountSc from './screens/MedCountSc';
import MedLandingSc from './screens/MedLandingSc';
import RoundsSc from './screens/RoundsSc';
import RoundSc from './screens/RoundSc';
import OrdersSc from './screens/OrdersSc';
import OrderSc from './screens/OrderSc';
import OrderGroupSc from './screens/OrderGroupSc';
import GalleyOrdersSc from './screens/GalleyOrdersSc';
import GalleyOrderSc from './screens/GalleyOrderSc';
import PermitSc from './screens/PermitSc';
import RiskSc from './screens/RiskSc';
import CrewMatrixSc from './screens/CrewMatrixSc';
import FleetSc from './screens/FleetSc';
import FleetVesselSc from './screens/FleetVesselSc';
import { OPTIONAL_TABS } from './constants/access';
import { FEW, MENU_WIDTH, NavMenuBar, PIN_WIDTH, flatGrouped, useNavPrefs } from './components/NavMenu';
import { FavStar } from './components/Favourites';
import { navRef } from './utils/favourites';
import { MENU_LABEL } from './utils/navOrder';
import { moduleOn } from './constants/modules';
import EnrolSc from './screens/EnrolSc';
import { recordScanProof } from './services/signingPolicy';

/** A browser on a touch screen (tablet / phone) — swipe between screens works there. */
const touchScreen = Platform.OS === 'web' && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Dashboard and Equipment first, Settings last; the optional tabs between them
// in OPTIONAL_TABS order, each shown only if this device's access allows it
// (constants/access.ts, set by the Master on the Access screen).
const TAB_ICONS: Record<string, string> = {
  Dashboard: 'view-dashboard',
  Equipment: 'toolbox',
  Settings: 'cog',
  ...Object.fromEntries(OPTIONAL_TABS.map((t) => [t.route, t.icon])),
};
const OPTIONAL_SCREENS: Record<string, React.ComponentType> = {
  Certificates: CertificatesSc,
  Documents: DocsSc,
  Permits: PermitsSc,
  Fuel: FuelSc,
  Garbage: GarbageSc,
  OilRecord: OrbSc,
  Sewage: LogBookSc,
  Ballast: LogBookSc,
  Sopep: SopepSc,
  Security: SecuritySc,
  Surveys: SurveysSc,
  Readiness: ReadinessSc,
  Dp: DpSc,
  Watch: WatchChecksSc,
  Familiar: WatchChecksSc,
  Safety: SafetySc,
  Drills: DrillsSc,
  Hospital: HospitalSc,
  Passengers: PassengersSc,
  Stores: StoresSc,
  Rounds: RoundsSc,
  Orders: OrdersSc,
  DeckLog: DeckLogSc,
  WatchLog: WatchLogSc,
  Gmdss: GmdssSc,
  Maintenance: MaintenanceSc,
  HoursOfRest: HoursOfRestSc,
  Spares: SparesSc,
  Reports: ReportsSc,
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

// Full names for the menu, where there is room for them (components/NavMenu).
// The menu's names: utils/navOrder.ts MENU_LABEL (shared with the Master's page).

function MainTabs() {
  const navigation = useNavigation<any>();
  const currentName = useRef('Dashboard');
  const insets = useSafeAreaInsets();
  const COLORS = useTheme();
  const { tabs } = useSync();
  const shown = OPTIONAL_TABS.filter((t) => tabs.has(t.key));
  const tabOrder = ['Dashboard', 'Equipment', ...shown.map((t) => t.route), 'Settings'];
  // With every module on, eight tabs share a phone's width and the full labels
  // run into each other ("DashboardEquipmentCertificates"). Below ~72 px a tab,
  // the long ones are shortened; on a laptop they stay whole.
  const { width: screenW } = useWindowDimensions();
  const crowded = screenW / tabOrder.length < 72;
  const SHORT: Record<string, string> = { Dashboard: 'Home', Equipment: 'Equip', Certificates: 'Certs' };
  // Past FEW screens the tab bar gives way to the menu, in the person's own order.
  // The menu also lists screens that are not tabs — the crew matrix, under Crew.
  // Crew list (FAL Form 5, import) and the crew matrix — Officers and the Master
  // keep them, but everyone may look; the screens say what each rank can do.
  const menuExtras = moduleOn('crewCerts') ? ['Crew', 'CrewMatrix'] : [];
  const available = useMemo(() => [...tabOrder, ...menuExtras], [tabOrder.join('|'), menuExtras.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  const navPrefs = useNavPrefs(available);
  const many = tabOrder.length > FEW;
  // Swipes follow the menu's grouped order, tabs only.
  const order = many ? flatGrouped(navPrefs.order).filter((r) => tabOrder.includes(r)) : tabOrder;
  const docked = Platform.OS === 'web' && many && navPrefs.pinned && screenW >= PIN_WIDTH;
  const orderRef = useRef(order);
  orderRef.current = order;

  // Edge-to-edge is enabled, so the tab bar draws behind the Android system
  // navigation (3-button or gesture). Pad the bar by the bottom inset so the
  // tabs are never hidden under the navigation buttons.
  //
  // ON WEB THE BAR GOES ON TOP. A browser window is wide and shallow, the pointer
  // lives at the top of the page, and a row of tabs pinned to the bottom edge of
  // a laptop screen is a phone habit carried where it does not belong. On a phone
  // it stays where a thumb reaches it.
  //
  // bottom-tabs v6 has no `tabBarPosition` (that is v7), so this is done with the
  // two props it does have: the bar is drawn absolutely at the top, and the scene
  // is padded by its height so nothing hides underneath.
  const onWeb = Platform.OS === 'web';
  const barHeight = 60 + (onWeb ? insets.top : insets.bottom);

  const tabBarStyle = onWeb
    ? {
        backgroundColor: COLORS.tabBackground,
        borderTopWidth: 0,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.borderLight,
        position: 'absolute' as const,
        top: 0,
        left: 0,
        right: 0,
        height: barHeight,
        paddingTop: insets.top + 6,
        paddingBottom: 6,
      }
    : {
        backgroundColor: COLORS.tabBackground,
        borderTopColor: COLORS.borderLight,
        height: barHeight,
        paddingTop: 6,
        paddingBottom: insets.bottom + 6,
      };

  // Swipe left/right to move between tabs (gesture-handler, no reanimated needed).
  // Phones, and the browser on a touch screen (a tablet — 10 Oct 2026). Not
  // with a mouse: there the same drag is selecting text, a trackpad scrolling a
  // wide table sideways, a scrollbar being pulled — and the page jumped to the
  // next screen instead (9 Oct 2026). The web has the menu and the ← in the bar.
  const swipe = Gesture.Pan()
    .enabled(Platform.OS !== 'web' || touchScreen)
    .activeOffsetX([-25, 25])
    .failOffsetY([-15, 15])
    .minVelocityX(180)
    .onEnd((e) => {
      // A stroke on a signature pad is not a swipe (utils/swipeLock).
      if (swipeLock.held) return;
      // By name in the person's order, not by the navigator's index — with the
      // menu the two differ.
      const order = orderRef.current;
      const idx = order.indexOf(currentName.current);
      if (idx < 0) return;
      if (e.translationX < -45 && idx < order.length - 1) navigation.navigate(order[idx + 1]);
      else if (e.translationX > 45 && idx > 0) navigation.navigate(order[idx - 1]);
    })
    .runOnJS(true);

  return (
    // pan-y: the browser keeps vertical scrolling for itself; only a sideways
    // drag reaches the gesture.
    <GestureDetector gesture={swipe} touchAction={onWeb ? 'pan-y' : undefined}>
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          // ← in the web bar goes back through the screens visited, as a browser would.
          backBehavior="history"
          sceneContainerStyle={onWeb ? { paddingTop: barHeight, ...(docked ? { paddingLeft: MENU_WIDTH } : {}) } : undefined}
          screenListeners={{
            state: (e: any) => {
              const st = e.data?.state;
              const name = st?.routes?.[st.index]?.name;
              if (typeof name === 'string') currentName.current = name;
            },
          }}
          tabBar={
            many
              ? (p) => (
                  <NavMenuBar
                    {...p}
                    {...navPrefs}
                    icons={{ ...TAB_ICONS, Crew: 'clipboard-account-outline', CrewMatrix: 'table-account' }}
                    labelOf={(r) => MENU_LABEL[r] ?? r}
                  />
                )
              : undefined
          }
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: COLORS.tabActive,
            tabBarInactiveTintColor: COLORS.tabInactive,
            tabBarStyle: tabBarStyle as any,
            tabBarLabelStyle: { fontSize: SIZES.tiny, fontWeight: '600' },
            ...(crowded && SHORT[route.name] ? { tabBarLabel: SHORT[route.name] } : {}),
            tabBarIcon: ({ focused }) => <TabIcon route={route.name} focused={focused} />,
          })}
        >
          <Tab.Screen name="Dashboard">
            {() => <TabFade>{moduleOn('board') ? <BoardSc /> : <DashboardSc />}</TabFade>}
          </Tab.Screen>
          <Tab.Screen name="Equipment">
            {() => <TabFade><CategoriesSc /></TabFade>}
          </Tab.Screen>
          {shown.map((t) => {
            const Sc = OPTIONAL_SCREENS[t.route];
            return (
              <Tab.Screen key={t.route} name={t.route} options={{ tabBarLabel: t.label, title: t.label }}>
                {() => <TabFade><Sc /></TabFade>}
              </Tab.Screen>
            );
          })}
          <Tab.Screen name="Settings">
            {() => <TabFade><SettingsSc /></TabFade>}
          </Tab.Screen>
        </Tab.Navigator>
      </View>
    </GestureDetector>
  );
}


/**
 * URL map — WEB ONLY.
 *
 * Without this the app never touches browser history: every screen lives at the
 * same URL, the browser's Back button leaves the site instead of going back a
 * screen, and a reload always lands on the Dashboard. Giving each screen a path
 * fixes all three at once and makes a screen linkable — "open this defect" can be
 * pasted into a message.
 *
 * DISABLED ON NATIVE on purpose. iOS and Android already handle `msm://` by hand
 * further up this file (getInitialURL + the 'url' event), because a scanned label
 * has to be resolved against the register before it can be navigated to — the
 * sticker carries an item id and NOT its category. Handing the same scheme to
 * React Navigation as well would mean two things racing to consume one link.
 */
const linking = {
  enabled: Platform.OS === 'web',
  prefixes: [],
  config: {
    screens: {
      Main: {
        screens: {
          Dashboard: '',
          Equipment: 'equipment',
          Certificates: 'certificates',
          Reports: 'reports',
          Maintenance: 'maintenance',
          HoursOfRest: 'rest',
          Spares: 'spares',
          Documents: 'documents',
          Permits: 'permits',
          Fuel: 'fuel',
          Garbage: 'garbage',
          OilRecord: 'oil-record',
          Sewage: 'sewage',
          Ballast: 'ballast-water',
          Sopep: 'sopep',
          Security: 'security',
          Surveys: 'surveys',
          Readiness: 'readiness',
          Dp: 'dp',
          Watch: 'checklists-watch',
          Familiar: 'familiarisation',
          Safety: 'safety',
          Drills: 'drills',
          Hospital: 'hospital',
          Passengers: 'passengers',
          Stores: 'stores',
          Rounds: 'rounds',
          Orders: 'orders',
          DeckLog: 'deck-log',
          WatchLog: 'watch-log',
          Gmdss: 'gmdss-log',
          Settings: 'settings',
        },
      },
      Handover: 'handover',
      ServiceReport: 'service-report',
      DpCheck: 'dp-check',
      DpTemplates: 'dp-checklists',
      CategoryItems: 'category/:category',
      ItemDetail: 'item/:category/:id',
      Import: 'import',
      Manual: 'manual',
      GettingStarted: 'getting-started',
      Legal: 'legal/:doc',
      Compressor: 'compressor',
      Paywall: 'pro',
      CertificateDetail: 'certificate/:id',
      Label: 'label',
      LabelBatch: 'labels',
      Scan: 'scan',
      Flagged: 'flagged',
      RecentScans: 'recent-scans',
      Inspection: 'inspect/:itemId',
      InspectionDetail: 'inspection/:id',
      Crew: 'crew',
      RestDay: 'rest/:crewId/:date',
      Machine: 'machine/:id',
      PmsJob: 'pms-job/:id',
      PmsDefect: 'pms-defect/:id',
      PmsProjects: 'pms-projects',
      PmsProject: 'pms-project/:id',
      WatchEntry: 'watch-entry',
      DeckEntry: 'deck-entry',
      InternalAudits: 'internal-audits',
      InternalAudit: 'internal-audit/:id',
      Landings: 'landings',
      LandingReport: 'landing-report/:id',
      Round: 'round/:id',
      Nc: 'nc/:id',
      Drill: 'drill/:id',
      Meeting: 'safety-meeting/:id',
      Ask: 'ask',
      MedItem: 'medicine/:id',
      Treatment: 'treatment/:id',
      MedOrder: 'medical-order/:id',
      MedCount: 'medical-inventory/:id',
      Order: 'order/:id',
      MedLanding: 'medical-landing/:id',
      SparePart: 'spare/:id',
      Doc: 'document/:id',
      CrewMember: 'crew/:id',
      Permit: 'permit/:id',
      Risk: 'risk/:id',
      CrewMatrix: 'crew-matrix',
      Fleet: 'fleet',
      FleetVessel: 'fleet/:imo',
      Defects: 'defects',
      Accounts: 'accounts',
      EmailReport: 'email-report',
      Access: 'access',
      MasterPage: 'master',
      Enrol: 'join',
    },
  },
} as const;


function Root() {
  const COLORS = useTheme();
  // Shared with the favourites (utils/favourites), which open places from anywhere.
  const navigationRef = navRef;
  const { flat } = useData();
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);
  // null = still loading the stored flag; false = must show; true = accepted
  const [legalAccepted, setLegalAccepted] = useState<boolean | null>(null);
  // Route to navigate to right after the consent gate clears ('Settings' or 'Enrol').
  const [pendingOnboard, setPendingOnboard] = useState<string | null>(null);

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

  const acceptLegal = async (route: string) => {
    setPendingOnboard(route);
    setLegalAccepted(true);
    try {
      await AsyncStorage.setItem(LEGAL_ACCEPTED_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  // Navigate to the onboarding destination once the consent gate has cleared and
  // the navigator is mounted. We wait for legalAccepted to flip to true (the
  // consent screen is still covering everything at that point, so we need a tick
  // after it unmounts before the nav ref is usable).
  useEffect(() => {
    if (!pendingOnboard || legalAccepted !== true) return;
    const route = pendingOnboard;
    setPendingOnboard(null);
    // Give React one frame to unmount ConsentSc and mount the navigator.
    const t = setTimeout(() => {
      try {
        navigationRef.current?.navigate(route as never);
      } catch {
        /* navigator not ready yet — user can navigate manually */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pendingOnboard, legalAccepted]);

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
  // `back` is where the arrow goes when there is nothing behind the screen. The
  // stack's own arrow only appears when it can go back, and a reloaded page — or
  // a link opened straight to /category/fire_dampers — hands the stack exactly
  // one screen: the header then had a title and no way out at all.
  type Back = { screen: string; params?: object };
  const webHeader = (title: string, back: Back = { screen: 'Main' }) =>
    Platform.OS === 'web'
      ? ({ navigation }: { navigation: any }) => ({
          headerShown: true,
          title,
          headerStyle: { backgroundColor: COLORS.tabBackground },
          headerTintColor: COLORS.primary,
          headerTitleStyle: { color: COLORS.text },
          headerLeft: (props: any) => (
            <HeaderBackButton
              {...props}
              tintColor={COLORS.primary}
              // Drawn as an SVG icon, not the library's PNG. That PNG lives under
              // assets/node_modules/, which Hosting once refused to deploy; the
              // HTML it served instead was cached as "immutable" for a year, so a
              // browser that saw it once keeps an invisible arrow whatever is
              // deployed later. An inline icon has no file to go wrong.
              backImage={({ tintColor }: { tintColor?: string }) => (
                <MciIcon name="arrow-left" size={24} color={tintColor ?? COLORS.primary} style={{ marginHorizontal: 11 }} />
              )}
              onPress={() => goBackOr(navigation, back.screen, back.params)}
            />
          ),
          headerRight: () => (
            <View style={{ marginRight: 12 }}>
              <FavStar color={COLORS.primary} />
            </View>
          ),
        })
      : undefined;
  const toTab = (screen: string): Back => ({ screen: 'Main', params: { screen } });

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
        // The phone's own camera read the label and opened this link — a scan,
        // for "scan before you sign", recorded as such on the inspection.
        if (found) recordScanProof(found.id, 'qr-link');
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
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={linking as any}
      // Browser tab: "Dashboard · ISMpilot" rather than the bare screen name.
      documentTitle={{ formatter: (o, route) => `${o?.title ?? route?.name ?? 'Home'} · ${APP_CONFIG.name}` }}
    >
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
        <Stack.Screen name="CategoryItems" component={CategoryItemsSc} options={webHeader('Equipment', toTab('Equipment'))} />
        <Stack.Screen name="ItemDetail" component={ItemDetailSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Import" component={ImportSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Manual" component={ManualSc} options={webHeader('Manual')} />
        <Stack.Screen name="GettingStarted" component={GettingStartedSc} options={webHeader('Getting Started')} />
        <Stack.Screen name="Legal" component={LegalSc} options={webHeader('Legal')} />
        <Stack.Screen name="Compressor" component={CompressorSc} options={webHeader('BA Compressor', toTab('Settings'))} />
        <Stack.Screen name="Paywall" component={PaywallSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CertificateDetail" component={CertificateDetailSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Label" component={LabelSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="LabelBatch" component={LabelBatchSc} options={webHeader('QR labels', toTab('Equipment'))} />
        <Stack.Screen name="Scan" component={ScanSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Flagged" component={FlaggedSc} options={webHeader('Flagged')} />
        <Stack.Screen name="RecentScans" component={RecentScansSc} options={webHeader('Recently scanned')} />
        <Stack.Screen name="Inspection" component={InspectionSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="InspectionDetail" component={InspectionDetailSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Crew" component={CrewSc} options={webHeader(moduleOn('crewCerts') ? 'Crew list' : 'Crew', toTab('Settings'))} />
        <Stack.Screen name="RestDay" component={RestDaySc} options={{ presentation: 'modal' }} />
        {/* Access became part of the Master's page (15 Oct 2026); the old address opens it. */}
        <Stack.Screen name="Access" component={MasterSc} options={webHeader("Master's page", toTab('Settings'))} />
        <Stack.Screen name="MasterPage" component={MasterSc} options={webHeader("Master's page", toTab('Settings'))} />
        <Stack.Screen name="Machine" component={MachineSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PmsJob" component={PmsJobSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PmsDefect" component={PmsDefectSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PmsProjects" component={PmsProjectsSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="PmsProject" component={PmsProjectSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="WatchEntry" component={WatchEntrySc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="DeckEntry" component={DeckEntrySc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="InternalAudits" component={AuditsSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="InternalAudit" component={AuditSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Landings" component={LandingsSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="LandingReport" component={LandingReportSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Round" component={RoundSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Nc" component={NcSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Drill" component={DrillSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Meeting" component={MeetingSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Ask" component={AskSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MedItem" component={MedItemSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Treatment" component={TreatmentSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MedOrder" component={MedOrderSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MedCount" component={MedCountSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Order" component={OrderSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="OrderGroup" component={OrderGroupSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="GalleyOrders" component={GalleyOrdersSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="GalleyOrder" component={GalleyOrderSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="MedLanding" component={MedLandingSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="SparePart" component={SparePartSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Doc" component={DocSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CrewMember" component={CrewMemberSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Permit" component={PermitSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Risk" component={RiskSc} options={{ presentation: 'modal' }} />
        <Stack.Screen name="CrewMatrix" component={CrewMatrixSc} options={webHeader('Crew matrix')} />
        <Stack.Screen name="Fleet" component={FleetSc} options={webHeader('Fleet')} />
        <Stack.Screen name="FleetVessel" component={FleetVesselSc} options={webHeader('Vessel', { screen: 'Fleet' })} />
        <Stack.Screen name="Checklists" component={ChecklistsSc} options={webHeader('Checklists', toTab('Settings'))} />
        <Stack.Screen name="ScanRules" component={ScanRulesSc} options={webHeader('Scan by category', toTab('Settings'))} />
        <Stack.Screen name="PhotoArchive" component={PhotoArchiveSc} options={webHeader('Photo archive', toTab('Settings'))} />
        <Stack.Screen name="CategoriesEdit" component={CategoriesEditSc} options={webHeader('Categories', toTab('Settings'))} />
        <Stack.Screen name="ChecklistEdit" component={ChecklistEditSc} options={webHeader('Checklist', { screen: 'Checklists' })} />
        <Stack.Screen name="Defects" component={DefectsSc} options={webHeader('Open defects')} />
        <Stack.Screen name="Handover" component={HandoverSc} options={webHeader('Handover', { screen: 'Main', params: { screen: 'Readiness' } } as any)} />
        <Stack.Screen name="ServiceReport" component={ServiceReportSc} options={webHeader('Service report', { screen: 'Main', params: { screen: 'Certificates' } } as any)} />
        <Stack.Screen name="DpCheck" component={DpCheckSc} options={webHeader('Checklist')} />
        <Stack.Screen name="DpTemplates" component={DpTemplatesSc} options={webHeader('DP checklists', { screen: 'Main', params: { screen: 'Dp' } } as any)} />
        {/* With the notice board on, the old Dashboard — LSA / FFE / lifting by expiry — is this screen. */}
        <Stack.Screen name="Expiries" component={DashboardSc} options={webHeader('LSA / FFE expiries')} />
        <Stack.Screen name="Accounts" component={AccountsSc} options={webHeader('Accounts', toTab('Settings'))} />
        <Stack.Screen name="EmailReport" component={EmailReportSc} options={webHeader('Email Report', toTab('Settings'))} />
        <Stack.Screen name="Enrol" component={EnrolSc} options={webHeader('Join this vessel', toTab('Settings'))} />
      </Stack.Navigator>
      {showSplash ? (
        <View style={StyleSheet.absoluteFill}>
          <SplashSc onDone={hideSplash} />
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
            {/* Inside DataProvider: sync reads the register from it and writes
                remote changes back through reload(). */}
            <SyncProvider>
              {/* Inside both: confirmation reads the signing policy (data) and
                  this device's id. See components/SignConfirm. */}
              <SignConfirmProvider>
                <PinChangeProvider>
                <Root />
                </PinChangeProvider>
              </SignConfirmProvider>
            </SyncProvider>
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
