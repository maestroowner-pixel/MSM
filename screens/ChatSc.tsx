// ===================================
// Chat (types/chat.ts, services/chat) — the vessel's channels: Crew (everyone
// aboard), Officers (officers and the Master) and Office (the officers with the
// office). A crew device shows only Crew, and holds only it: the other two are
// synced to officers' devices only and the rules say the same. Messages are the
// discussion's (ThreadPanel); the latest CHAT_PAGE show, older on request. A
// channel goes on paper for the last 30 days or all of it.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Text, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { ThreadPanel } from '../components/RecordThread';
import { useSigner } from '../components/SignerChoice';
import { Card, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { CHAT_PAGE, channelsFor, chatPeople, chatOf, makeChatMessage, recent, unreadChat } from '../services/chat';
import { exportChat, shareChat } from '../services/chatReport';
import { OFFICE_TAG } from '../services/threads';
import * as storage from '../services/storage';
import { ChatChannel } from '../types/chat';
import * as accounts from '../services/accounts';
import { isAboard, isOfficerRank } from '../types/crew';
import { EnrolledDevice, roleAtLeast } from '../types/role';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const KEY: Record<ChatChannel, string> = { crew: storage.CHAT_CREW_KEY, officers: storage.CHAT_OFFICERS_KEY, office: storage.CHAT_OFFICE_KEY };
const MONTH = 30 * 24 * 3600 * 1000;

/** In a browser, the first message sent asks whether replies may show while the tab is hidden (components/ChatNotifier). */
function askWebNotifications() {
  try {
    const N: any = Platform.OS === 'web' && typeof window !== 'undefined' ? (window as any).Notification : null;
    if (N?.permission === 'default') void N.requestPermission();
  } catch {
    /* ignore */
  }
}

export default function ChatSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const { chat, crew, vessel, saveRow, prefs, setPrefs } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const channels = channelsFor(officer);
  const asked: ChatChannel = route.params?.ch ?? route.params?.view;
  const [ch, setCh] = useState<ChatChannel>(channels.includes(asked) ? asked : 'crew');
  useEffect(() => {
    if (channels.includes(asked)) setCh(asked);
  }, [asked]); // eslint-disable-line react-hooks/exhaustive-deps
  const [limit, setLimit] = useState(CHAT_PAGE);
  useEffect(() => setLimit(CHAT_PAGE), [ch]);
  // Everyone aboard may write in Crew, on a shared tablet too; the other channels are the officers'.
  const { signer, picker } = useSigner(t('th.writingAs'), { anyAboard: ch === 'crew' });

  const all = useMemo(() => chatOf(chat, ch), [chat, ch]);
  const { shown, earlier } = recent(all, limit);
  // Who is connected to the vessel, to pick from under "Mention" (services/chat `chatPeople`).
  const imo = (vessel?.imo ?? '').replace(/\D/g, '');
  const [devices, setDevices] = useState<EnrolledDevice[]>([]);
  useEffect(() => {
    if (!sync.enrolled || !imo) return;
    try {
      return accounts.watchDevices(imo, setDevices);
    } catch {
      return undefined;
    }
  }, [sync.enrolled, imo]);
  const people = useMemo(() => {
    const aboard = crew.filter((c) => isAboard(c) && (ch === 'crew' || isOfficerRank(c.rank))).map((c) => ({ name: c.name, rank: c.rank }));
    return chatPeople(devices, aboard, ch);
  }, [devices, crew, ch]);
  const names = useMemo(() => people.map((p) => p.name), [people]);
  const ranks = useMemo(() => Object.fromEntries(people.filter((p) => p.rank).map((p) => [p.name, p.rank as string])), [people]);
  const latest = all.length ? all[all.length - 1].at : 0;
  useEffect(() => {
    if (latest > (prefs?.chatRead?.[ch] ?? 0)) void setPrefs({ chatRead: { ...prefs?.chatRead, [ch]: latest } });
  }, [latest, ch, prefs?.chatRead, setPrefs]);

  const send = async (text: string) => {
    if (!signer) {
      Alert.alert(t('chat.title'), t('th.chooseName'));
      return false;
    }
    askWebNotifications();
    await saveRow(KEY[ch], makeChatMessage({ ch, text, by: signer.name, byRank: signer.rank, side: 'vessel' }, names, Date.now()));
    return true;
  };
  const paper = (fn: typeof exportChat, from: number) => void fn(chat, ch, from, vessel).catch((e: any) => Alert.alert(t('chat.title'), String(e?.message ?? e)));

  return (
    <Screen scroll>
      <ScreenTitle title={t('chat.title')} subtitle={t('chat.sub')} help="Chat" />
      <View style={styles.chips}>
        {channels.map((c) => {
          const n = c === ch ? 0 : unreadChat(chat, c, signer?.name, prefs?.chatRead).length;
          return (
            <TouchableOpacity key={c} style={[styles.chip, c === ch && styles.chipOn]} onPress={() => setCh(c)}>
              <Text style={[styles.chipText, c === ch && styles.chipTextOn]}>{n ? `${tk(`chat.ch.${c}`)} · ${n}` : tk(`chat.ch.${c}`)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Card>
        <ThreadPanel
          messages={shown}
          tags={ch === 'office' ? [OFFICE_TAG, ...names] : names}
          tagRanks={ranks}
          onSend={send}
          picker={picker}
          english
          hint={`${tk(`chat.who.${ch}`)} ${t('chat.hint')}`}
          before={earlier ? (
            <TouchableOpacity onPress={() => setLimit((x) => x + CHAT_PAGE)} style={{ marginBottom: 8 }}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('chat.earlier', { n: earlier })}</Text>
            </TouchableOpacity>
          ) : null}
        />
      </Card>
      {all.length ? (
        <>
          <Text style={[styles.sub, { marginTop: 16, fontWeight: '700' }]}>{t('chat.paper')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => paper(exportChat, Date.now() - MONTH)}><Text style={styles.smallText}>{t('chat.pdf30')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => paper(exportChat, 0)}><Text style={styles.smallText}>{t('chat.pdfAll')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => paper(shareChat, Date.now() - MONTH)}><Text style={styles.smallText}>{t('chat.share')}</Text></TouchableOpacity>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
