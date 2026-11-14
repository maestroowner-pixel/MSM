// ===================================
// The office channel of the chat as the superintendent sees it in Fleet
// (types/chat.ts): the vessel's officers and the office, the latest messages,
// older on request, a box to answer in. The office reads only this channel —
// Crew and Officers stay aboard (rules). Share PDF of the last 30 days.
// ===================================

import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { ThreadPanel } from './RecordThread';
import { useTheme } from '../contexts/ThemeContext';
import { CHAT_PAGE, chatOf, makeChatMessage, recent } from '../services/chat';
import { shareChat } from '../services/chatReport';
import * as shore from '../services/shore';
import { ChatMessage } from '../types/chat';
import { t } from '../utils/i18n';

const MONTH = 30 * 24 * 3600 * 1000;

export function FleetChat({ imo, vesselName, messages, people, onPosted }: { imo: string; vesselName: string; messages: ChatMessage[]; people: string[]; onPosted: (m: ChatMessage) => void }) {
  const COLORS = useTheme();
  const [limit, setLimit] = useState(CHAT_PAGE);
  const { shown, earlier } = recent(chatOf(messages, 'office'), limit);
  const send = async (text: string) => {
    try {
      const m = makeChatMessage({ ch: 'office', text, by: (await shore.myName()) || t('fv.supt'), byRank: t('oc.office'), side: 'office' }, people, Date.now());
      await shore.postChatMessage(imo, m);
      onPosted(m);
      return true;
    } catch {
      Alert.alert(t('chat.title'), t('th.failed'));
      return false;
    }
  };
  return (
    <View>
      <ThreadPanel
        messages={shown}
        tags={people}
        onSend={send}
        hint={`${t('chat.who.office')} ${t('chat.hint')}`}
        before={earlier ? (
          <TouchableOpacity onPress={() => setLimit((x) => x + CHAT_PAGE)} style={{ marginBottom: 8 }}>
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('chat.earlier', { n: earlier })}</Text>
          </TouchableOpacity>
        ) : null}
      />
      {shown.length ? (
        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => void shareChat(messages, 'office', Date.now() - MONTH, { vessel_name: vesselName, imo } as any).catch((e: any) => Alert.alert(t('chat.title'), String(e?.message ?? e)))}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('chat.share')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
