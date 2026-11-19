// ===================================
// Chat news (19 Nov 2026): the count on the Chat entry of the menu
// (`useChatUnread`) and a strip at the top of any screen when a message comes
// in with the sync (`ChatNotifier`, beside the navigator). Tap opens the
// channel. Said once per device (`prefs.chatNotifiedAt`); the first run only
// sets the mark, so a device that joins is not shown the whole history. With
// the app in the background (or the browser tab hidden) it is a notification
// of the system instead, when reminders are on. Nothing is pushed by a server:
// it comes when the device has synced, as the chat says.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { moduleOn } from '../constants/modules';
import { channelsFor, chatToShow, unreadChat } from '../services/chat';
import { notifyNow } from '../services/notifications';
import { onPushTap, pushRegistered } from '../services/pushToken';
import { ChatChannel } from '../types/chat';
import { personName, roleAtLeast } from '../types/role';
import { SIZES, Palette } from '../theme';
import { t, tk, useT } from '../utils/i18n';

const SHOWN_MS = 7000;

/** Who this device is in the chat, and which channels it holds. */
function useChatMe() {
  const { crew, prefs } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const me = useMemo(() => {
    if (sync.me) return personName(sync.me);
    return crew.find((x) => x.id === prefs?.lastCrewId && !x.deleted)?.name;
  }, [sync.me, crew, prefs?.lastCrewId]);
  return { me, channels: channelsFor(officer) };
}

/** Messages this device has not opened, over the channels it holds. 0 with the module off. */
export function useChatUnread(): number {
  const { chat, prefs } = useData();
  const { me, channels } = useChatMe();
  return useMemo(
    () => (moduleOn('chat') ? channels.reduce((n, ch) => n + unreadChat(chat, ch, me, prefs?.chatRead).length, 0) : 0),
    [chat, prefs?.chatRead, me, channels]
  );
}

/** The red count on a menu icon. */
export function UnreadDot({ n, style }: { n: number; style?: any }) {
  const COLORS = useTheme();
  if (!n) return null;
  return (
    <View style={[{ position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ color: COLORS.textWhite, fontSize: 11, fontWeight: '800' }}>{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

const hidden = () => (Platform.OS === 'web' ? typeof document !== 'undefined' && document.visibilityState === 'hidden' : AppState.currentState !== 'active');

/** The browser's own notification, where the person already allowed it. */
function webNotify(title: string, body: string) {
  try {
    const W: any = typeof window !== 'undefined' ? window : null;
    if (W?.Notification?.permission === 'granted') new W.Notification(title, { body });
  } catch {
    /* ignore */
  }
}

export function ChatNotifier({ navigate, current }: { navigate: (route: string, params?: object) => void; current: () => { name?: string; ch?: string } | undefined }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { chat, prefs, setPrefs, loading } = useData();
  const { me, channels } = useChatMe();
  const [shown, setShown] = useState<{ title: string; body: string; ch: ChatChannel } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!moduleOn('chat') || loading || !prefs) return;
    const here = current();
    // The channel on screen marks itself read.
    const open = here?.name === 'Chat' ? ((here.ch as ChatChannel) ?? 'crew') : undefined;
    const { fresh, mark } = chatToShow(chat, channels, me, prefs.chatRead, prefs.chatNotifiedAt, open);
    if (mark === undefined) return;
    void setPrefs({ chatNotifiedAt: mark });
    if (!fresh.length || prefs.chatNotifiedAt === undefined) return;
    const last = fresh[0];
    const mention = fresh.find((m) => (m.mentions ?? []).some((n) => me && n.trim().toLowerCase() === me.trim().toLowerCase()));
    const title = mention
      ? t('b.chat.mention', { by: mention.by })
      : fresh.length === 1
        ? `${last.by} · ${tk(`chat.ch.${last.ch}`)}`
        : t('b.chat.new', { n: fresh.length, ch: tk(`chat.ch.${last.ch}`) });
    const body = (mention ?? last).text.length > 120 ? `${(mention ?? last).text.slice(0, 120)}…` : (mention ?? last).text;
    if (hidden()) {
      if (prefs.notificationsEnabled !== false) {
        if (Platform.OS === 'web') webNotify(title, body);
        // A phone the vessel pushes to hears it from the server (functions/chatPush) — not twice.
        else if (!pushRegistered()) void notifyNow(title, body);
      }
      return;
    }
    setShown({ title, body, ch: (mention ?? last).ch });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), SHOWN_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, me, channels.length, prefs?.chatRead, prefs?.chatNotifiedAt, loading]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // A tap on a chat push (services/pushToken) opens its channel. `navigate` is new on every render.
  const nav = useRef(navigate);
  nav.current = navigate;
  useEffect(() => onPushTap((ch) => nav.current('Chat', { ch })), []);

  if (!shown) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.toast}
        activeOpacity={0.85}
        onPress={() => {
          setShown(null);
          navigate('Chat', { ch: shown.ch });
        }}
        accessibilityRole="button"
      >
        <MciIcon name="chat-outline" size={22} color={COLORS.textWhite} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{shown.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{shown.body}</Text>
        </View>
        <TouchableOpacity onPress={() => setShown(null)} hitSlop={10} accessibilityLabel={t('common.close')}>
          <MciIcon name="close" size={18} color={COLORS.textWhite} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: SIZES.md, zIndex: 1000, elevation: 20 },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      width: '100%',
      maxWidth: 480,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.sm,
      paddingHorizontal: SIZES.md,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    title: { color: COLORS.textWhite, fontWeight: '800', fontSize: 14 },
    body: { color: COLORS.textWhite, fontSize: 13, marginTop: 2 },
  });
