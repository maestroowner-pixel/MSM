// ===================================
// NavMenu — the app's navigation once there are more screens than a tab bar holds.
//
// Asked for on 9 Oct 2026, when the modules took the bar to nine tabs: "a panel on
// the left that hides itself and opens on a tap, where the screens can be put in
// the order you want — and then fill it without holding back".
//
//   Web / desktop   a top bar with ☰ and the current screen; the menu slides in
//                   from the left and closes on a choice. On a wide window it can
//                   be pinned open beside the content.
//   Phone           the bottom bar keeps the FIRST FOUR screens of the person's
//                   own order, plus "Menu" for all of them. So what a deckhand
//                   reaches with a thumb is what he put at the top.
//
// The order is the person's, per device (AsyncStorage `msm:nav_order`): a bosun
// and an engineer use the same app with different first screens. Changed with
// ↑ ↓ in "Edit order" — buttons rather than dragging, which needs gesture
// machinery this app does not carry and is fiddly with gloves.
//
// Up to FEW screens (the app with its modules off) none of this shows: the
// ordinary tab bar is kept, unchanged for vessels using it today.
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { ShipClock } from './ShipClock';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { MENU_CHILDREN, applyOrder, flatGrouped, grouped, move, moveInGroup } from '../utils/navOrder';
export { applyOrder, move, flatGrouped };

/**
 * Up to this many screens the plain tab bar is used. A phone still holds six
 * tabs (2.59: Dashboard, Equipment, Certificates, Rest, Reports, Settings); a
 * browser gets the menu from six, as asked for on the web.
 */
export const FEW = Platform.OS === 'web' ? 5 : 6;
/** Screens kept on a phone's bottom bar before "Menu". */
const ON_BAR = 4;
/** A window this wide may pin the menu open. */
export const PIN_WIDTH = 1100;
export const MENU_WIDTH = 248;

const ORDER_KEY = 'msm:nav_order';
const PIN_KEY = 'msm:nav_pinned';

/** The person's order and pin, remembered on this device. */
export function useNavPrefs(available: string[]) {
  const [saved, setSaved] = useState<string[] | null>(null);
  const [pinned, setPinnedState] = useState(false);
  useEffect(() => {
    AsyncStorage.multiGet([ORDER_KEY, PIN_KEY])
      .then(([[, o], [, p]]) => {
        if (o) setSaved(JSON.parse(o));
        setPinnedState(p === '1');
      })
      .catch(() => {});
  }, []);
  const order = useMemo(() => applyOrder(available, saved), [available, saved]);
  const setOrder = useCallback((o: string[]) => {
    setSaved(o);
    AsyncStorage.setItem(ORDER_KEY, JSON.stringify(o)).catch(() => {});
  }, []);
  const reset = useCallback(() => {
    setSaved(null);
    AsyncStorage.removeItem(ORDER_KEY).catch(() => {});
  }, []);
  const setPinned = useCallback((p: boolean) => {
    setPinnedState(p);
    AsyncStorage.setItem(PIN_KEY, p ? '1' : '0').catch(() => {});
  }, []);
  return { order, setOrder, reset, pinned, setPinned };
}

interface Props extends BottomTabBarProps {
  order: string[];
  setOrder: (o: string[]) => void;
  reset: () => void;
  pinned: boolean;
  setPinned: (p: boolean) => void;
  icons: Record<string, string>;
  labelOf: (route: string) => string;
}

export function NavMenuBar(props: Props) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const { state, navigation, order, icons, labelOf, pinned } = props;
  const current = state.routes[state.index]?.name;
  const currentView: string | undefined = (state.routes[state.index]?.params as any)?.view;
  const go = (name: string, params?: object) => {
    navigation.navigate(name, params);
    setOpen(false);
  };
  const onWeb = Platform.OS === 'web';
  // Back: to the screen visited before (the navigator keeps the history), or
  // to the first screen when the page was opened straight on this one.
  const home = flatGrouped(order)[0] ?? state.routes[0]?.name;
  const back = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate(home));
  const docked = onWeb && pinned && width >= PIN_WIDTH;

  const list = <MenuList {...props} current={current} currentView={currentView} onPick={go} canPin={onWeb && width >= PIN_WIDTH} onClose={() => setOpen(false)} />;

  if (onWeb) {
    return (
      <>
        <View style={[styles.top, { paddingTop: insets.top, height: 60 + insets.top, left: docked ? MENU_WIDTH : 0 }]}>
          {current !== home ? (
            <TouchableOpacity onPress={back} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
              <MciIcon name="arrow-left" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {!docked ? (
            <TouchableOpacity onPress={() => setOpen(true)} hitSlop={10} style={styles.burger} accessibilityLabel="Menu">
              <MciIcon name="menu" size={26} color={COLORS.tabActive} />
            </TouchableOpacity>
          ) : null}
          <MciIcon name={icons[current] ?? 'circle-small'} size={22} color={COLORS.tabActive} />
          <Text style={styles.topTitle} numberOfLines={1}>{labelOf(current)}</Text>
          <ShipClock />
        </View>
        {docked ? <View style={[styles.dock, { paddingTop: insets.top }]}>{list}</View> : null}
        <Drawer open={open} onClose={() => setOpen(false)} styles={styles}>{list}</Drawer>
      </>
    );
  }

  const onBar = flatGrouped(order).slice(0, ON_BAR);
  const inMenu = !onBar.includes(current);
  return (
    <>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 6, height: 60 + insets.bottom }]}>
        {onBar.map((r) => (
          <BarItem key={r} icon={icons[r]} label={labelOf(r)} on={r === current} onPress={() => go(r)} styles={styles} COLORS={COLORS} />
        ))}
        <BarItem icon="menu" label={inMenu ? labelOf(current) : 'Menu'} on={inMenu} onPress={() => setOpen(true)} styles={styles} COLORS={COLORS} />
      </View>
      <Drawer open={open} onClose={() => setOpen(false)} styles={styles}>{list}</Drawer>
    </>
  );
}

function BarItem({ icon, label, on, onPress, styles, COLORS }: { icon: string; label: string; on: boolean; onPress: () => void; styles: any; COLORS: Palette }) {
  return (
    <TouchableOpacity style={styles.barItem} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <MciIcon name={icon} size={24} color={on ? COLORS.tabActive : COLORS.tabInactive} />
      <Text style={[styles.barLabel, { color: on ? COLORS.tabActive : COLORS.tabInactive }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Drawer({ open, onClose, children, styles }: { open: boolean; onClose: () => void; children: React.ReactNode; styles: any }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={styles.drawer}>{children}</View>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}

function MenuList({
  order,
  setOrder,
  reset,
  pinned,
  setPinned,
  icons,
  labelOf,
  current,
  currentView,
  onPick,
  canPin,
  onClose,
}: Props & { current: string; currentView?: string; onPick: (r: string, params?: object) => void; canPin: boolean; onClose: () => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  // Entries with sub-items open on a tap; the one on screen starts open.
  const [openParents, setOpenParents] = useState<string[]>(MENU_CHILDREN[current] ? [current] : []);
  const toggle = (r: string) => setOpenParents((o) => (o.includes(r) ? o.filter((x) => x !== r) : [...o, r]));
  return (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + SIZES.md, paddingBottom: SIZES.xl }}>
      <View style={styles.menuHead}>
        <Text style={styles.menuTitle}>ISMpilot</Text>
        <View style={{ flexDirection: 'row', gap: SIZES.md }}>
          {canPin ? (
            <TouchableOpacity onPress={() => { setPinned(!pinned); onClose(); }} hitSlop={8} accessibilityLabel={pinned ? 'Unpin menu' : 'Pin menu'}>
              <MciIcon name={pinned ? 'pin-off-outline' : 'pin-outline'} size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={() => setEditing((e) => !e)} hitSlop={8}>
            <Text style={styles.edit}>{editing ? 'Done' : 'Edit order'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {Platform.OS !== 'web' && !editing ? <Text style={styles.hint}>The first four are on the bar below.</Text> : null}
      {grouped(order).map(({ group, routes }) => (
        <View key={group.key}>
          {group.label ? <Text style={styles.groupHead}>{group.label}</Text> : <View style={styles.sep} />}
          {routes.map((r, i) => {
            const kids = MENU_CHILDREN[r];
            const expanded = !!kids && openParents.includes(r) && !editing;
            const on = r === current && !kids;
            return (
              <View key={r}>
              <TouchableOpacity style={[styles.item, on && !editing && styles.itemOn]} onPress={() => (editing ? undefined : kids ? toggle(r) : onPick(r))} disabled={editing} activeOpacity={0.7} accessibilityState={kids ? { expanded } : undefined}>
                <MciIcon name={icons[r] ?? 'circle-small'} size={22} color={on || (kids && r === current) ? COLORS.primary : COLORS.textLight} />
                <Text style={[styles.itemText, (on || (kids && r === current)) && { color: COLORS.primary }]} numberOfLines={1}>{labelOf(r)}</Text>
                {kids && !editing ? <MciIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textLight} /> : null}
                {editing && routes.length > 1 ? (
                  <View style={{ flexDirection: 'row', gap: SIZES.xs }}>
                    <TouchableOpacity onPress={() => setOrder(moveInGroup(order, r, -1))} disabled={i === 0} hitSlop={6} style={[styles.arrow, i === 0 && { opacity: 0.25 }]} accessibilityLabel={`Move ${labelOf(r)} up`}>
                      <MciIcon name="arrow-up" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setOrder(moveInGroup(order, r, 1))} disabled={i === routes.length - 1} hitSlop={6} style={[styles.arrow, i === routes.length - 1 && { opacity: 0.25 }]} accessibilityLabel={`Move ${labelOf(r)} down`}>
                      <MciIcon name="arrow-down" size={18} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </TouchableOpacity>
              {expanded
                ? kids!.map((k, j) => {
                    const kon = r === current && (currentView ?? kids![0].view) === k.view;
                    return (
                      <TouchableOpacity key={k.view} style={[styles.item, styles.child, kon && styles.itemOn]} onPress={() => onPick(r, { view: k.view })} activeOpacity={0.7}>
                        <MciIcon name={k.icon} size={18} color={kon ? COLORS.primary : COLORS.textLight} />
                        <Text style={[styles.itemText, styles.childText, kon && { color: COLORS.primary }]} numberOfLines={1}>{k.label}</Text>
                      </TouchableOpacity>
                    );
                  })
                : null}
              </View>
            );
          })}
        </View>
      ))}
      {editing ? (
        <TouchableOpacity onPress={reset} style={{ padding: SIZES.md }}>
          <Text style={[styles.edit, { color: COLORS.textLight }]}>Reset to the standard order</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    child: { paddingLeft: SIZES.lg + 22, paddingVertical: 8 },
    childText: { fontSize: SIZES.small },
    top: {
      position: 'absolute', top: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      paddingHorizontal: SIZES.lg, backgroundColor: COLORS.tabBackground,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight,
    },
    burger: { marginRight: SIZES.sm },
    back: { marginRight: SIZES.sm, paddingRight: SIZES.xs },
    topTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.tabActive },
    dock: {
      position: 'absolute', top: 0, left: 0, bottom: 0, width: MENU_WIDTH, backgroundColor: COLORS.cardSolid,
      borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: COLORS.borderLight,
    },
    bottom: {
      flexDirection: 'row', paddingTop: 6, backgroundColor: COLORS.tabBackground,
      borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight,
    },
    barItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
    barLabel: { fontSize: SIZES.tiny, fontWeight: '600' },
    drawer: { width: MENU_WIDTH + 24, maxWidth: '85%', backgroundColor: COLORS.cardSolid, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 },
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    menuHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, marginBottom: SIZES.sm },
    menuTitle: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    edit: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    hint: { fontSize: SIZES.tiny, color: COLORS.textLight, paddingHorizontal: SIZES.lg, marginBottom: SIZES.xs },
    groupHead: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: SIZES.lg, marginTop: SIZES.md, marginBottom: 2 },
    sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.borderLight, marginVertical: SIZES.xs, marginHorizontal: SIZES.lg },
    item: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, paddingVertical: 11, paddingHorizontal: SIZES.lg },
    itemOn: { backgroundColor: COLORS.primary + '14' },
    itemText: { flex: 1, fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
    arrow: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  });
