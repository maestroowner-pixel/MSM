// The discussion on a record (services/threads): the messages, a box to write in,
// and the people to mention. ThreadPanel is both sides' — RecordThread is the
// vessel's, FleetVesselSc gives the office's its own sender.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useSigner } from './SignerChoice';
import { Card } from './ui';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import { moduleOn } from '../constants/modules';
import { OFFICE_TAG, THREAD_MAX, makeMessage, threadKey, threadOf } from '../services/threads';
import * as storage from '../services/storage';
import { SIZES, Palette } from '../theme';
import { isAboard } from '../types/crew';
import { ThreadMessage, ThreadRec } from '../types/thread';
import { t, useT } from '../utils/i18n';

const when = (at: number) => {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ThreadPanel({ messages, tags, onSend, picker }: {
  messages: ThreadMessage[];
  /** Who can be mentioned here, without the @. */
  tags: string[];
  /** Resolves true when the message went in; false leaves the text in the box. */
  onSend: (text: string) => Promise<boolean>;
  picker?: React.ReactElement | null;
}) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [text, setText] = useState('');
  const [tagging, setTagging] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      if (await onSend(text)) {
        setText('');
        setTagging(false);
      }
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {messages.length ? null : <Text style={styles.sub}>{t('th.empty')}</Text>}
      {messages.map((m) => (
        <View key={m.id} style={[styles.msg, m.side === 'office' && styles.msgOffice]}>
          <Text style={styles.sub}>{[m.by, m.byRank, when(m.at)].filter(Boolean).join(' · ')}</Text>
          <Text style={styles.text}>{m.text}</Text>
        </View>
      ))}
      {picker ?? null}
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={THREAD_MAX}
        placeholder={t('th.placeholder')}
        placeholderTextColor={COLORS.textLight}
      />
      {tagging ? (
        <View style={styles.tags}>
          {tags.map((n) => (
            <TouchableOpacity key={n} style={styles.tag} onPress={() => setText((x) => `${x}${x && !x.endsWith(' ') ? ' ' : ''}@${n} `)}>
              <Text style={styles.tagText}>{`@${n}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, (busy || !text.trim()) && { opacity: 0.5 }]} disabled={busy || !text.trim()} onPress={() => void send()}>
          <Text style={styles.btnText}>{t('th.send')}</Text>
        </TouchableOpacity>
        {tags.length ? (
          <TouchableOpacity onPress={() => setTagging((x) => !x)} hitSlop={8}>
            <Text style={styles.link}>{t('th.mention')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('th.hint')}</Text>
    </>
  );
}

/** The vessel's side, on a saved defect, NC or requisition. Off without the module. */
export function RecordThread({ rec, recId, title }: { rec: ThreadRec; recId: string; title: string }) {
  if (!moduleOn('threads')) return null;
  return <Thread rec={rec} recId={recId} title={title} />;
}

function Thread({ rec, recId, title }: { rec: ThreadRec; recId: string; title: string }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { threads, crew, saveRow, prefs, setPrefs } = useData();
  const { signer, picker } = useSigner(t('th.writingAs'));
  const messages = useMemo(() => threadOf(threads, rec, recId), [threads, rec, recId]);
  const names = useMemo(() => crew.filter(isAboard).map((c) => c.name), [crew]);
  const key = threadKey(rec, recId);
  const latest = messages.length ? messages[messages.length - 1].at : 0;
  useEffect(() => {
    if (latest > (prefs?.threadRead?.[key] ?? 0)) void setPrefs({ threadRead: { ...prefs?.threadRead, [key]: latest } });
  }, [latest, key, prefs?.threadRead, setPrefs]);

  const send = async (text: string) => {
    if (!signer) {
      Alert.alert(t('th.title'), t('th.chooseName'));
      return false;
    }
    await saveRow(storage.THREADS_KEY, makeMessage({ rec, recId, title, text, by: signer.name, byRank: signer.rank, side: 'vessel' }, names, Date.now()));
    return true;
  };
  return (
    <Card style={{ marginTop: SIZES.md }}>
      <Text style={styles.head}>{t('th.title')}</Text>
      <ThreadPanel messages={messages} tags={[OFFICE_TAG, ...names]} onSend={send} picker={picker} />
    </Card>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark, marginBottom: SIZES.sm },
    sub: { fontSize: SIZES.small, color: COLORS.textLight },
    text: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 2 },
    msg: { paddingVertical: SIZES.xs, paddingLeft: SIZES.sm, borderLeftWidth: 3, borderLeftColor: COLORS.border, marginBottom: SIZES.xs },
    msgOffice: { borderLeftColor: COLORS.primary },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SIZES.sm, minHeight: 60, color: COLORS.textDark, marginTop: SIZES.sm, textAlignVertical: 'top' },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.sm },
    tag: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 14, paddingHorizontal: SIZES.sm, paddingVertical: 4 },
    tagText: { fontSize: SIZES.small, color: COLORS.primary },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.sm },
    btn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm },
    btnText: { color: COLORS.textWhite, fontWeight: '700' },
    link: { color: COLORS.primary, fontWeight: '700' },
  });
