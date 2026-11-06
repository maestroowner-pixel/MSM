import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import {
  EmailReportSettings,
  getEmailReportSettings,
  notePending,
  saveEmailReportNote,
  saveEmailReportSettings,
  sendReportNow,
} from '../services/emailReportService';
import { useData } from '../contexts/DataContext';
import { BriefAiPanel } from '../components/BriefAiPanel';
import { aiReady } from '../services/ai';
import { monthFacts, monthForAi } from '../services/briefAi';
import { buildHandover } from '../services/handover';
import { peopleOf } from '../services/incidentAi';
import { pmsMonth } from '../services/pmsKpi';
import { todayIso } from '../services/pms';
import { personName } from '../types/role';
import { moduleOn } from '../constants/modules';
import { catLabel } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { CategoryKey } from '../types/equipment';
import { currentVesselKey } from '../services/firebaseService';
import { uiDateTime } from '../utils/dates';
import { playSuccessSound, playErrorSound } from '../utils/sound';
import { t, tn, useT } from '../utils/i18n';

export default function EmailReportSc() {
  useT();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const sync = useSync();
  const route = useRoute<any>();
  const data = useData();

  const [settings, setSettings] = useState<EmailReportSettings>({ enabled: false, recipients: [] });
  const [recipientInput, setRecipientInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // The Master's note (plan AI-7): goes with the next digest, written by hand or from the AI's draft.
  const [noteText, setNoteText] = useState('');
  const [noteAi, setNoteAi] = useState(false);

  useEffect(() => {
    void getEmailReportSettings().then((s) => {
      if (s) {
        setSettings(s);
        if (s.note && notePending(s)) {
          setNoteText(s.note.text);
          setNoteAi(!!s.note.ai);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const month = todayIso().slice(0, 7);
  const buildBrief = () => {
    const today = todayIso();
    const r = buildHandover({
      today,
      on: moduleOn,
      labelOf: (k: CategoryKey) => catLabel(data.categories.find((c) => c.key === k) ?? k),
      periodsOf: (k: CategoryKey) => periodsFor(k, data.templates),
      ...data,
    }, 30);
    const facts = monthFacts({
      month,
      ...(moduleOn('pms') ? { pms: pmsMonth(month, data.machines, data.pmsJobs, data.pmsDone, data.pmsDeferrals, today, moduleOn('critEq') ? data.pmsDefects : undefined), defects: data.pmsDefects } : {}),
      ncs: data.ncs,
      ...(moduleOn('drills') ? { drills: data.drills } : {}),
    });
    return monthForAi(r, month, facts, noteText, peopleOf(data));
  };
  const saveNote = async (text: string | null) => {
    setSaving(true);
    try {
      const note = text?.trim() ? { text: text.trim(), month, by: sync.me ? personName(sync.me) : 'Master', at: Date.now(), ...(noteAi ? { ai: true } : {}) } : null;
      await saveEmailReportNote(note);
      setSettings((s) => ({ ...s, note: note ?? undefined }));
      if (!note) {
        setNoteText('');
        setNoteAi(false);
      }
      playSuccessSound();
    } catch (e: any) {
      playErrorSound();
      Alert.alert(t('common.couldNotSave'), e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };
  const noteSaved = !!settings.note && notePending(settings) && settings.note.text === noteText.trim();

  const save = async (patch: Partial<EmailReportSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await saveEmailReportSettings(next);
      playSuccessSound();
    } catch (e: any) {
      playErrorSound();
      Alert.alert(t('common.couldNotSave'), e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email.includes('@')) {
      Alert.alert(t('email.invalid'), t('email.invalidBody'));
      return;
    }
    if (settings.recipients.includes(email)) {
      setRecipientInput('');
      return;
    }
    setRecipientInput('');
    void save({ recipients: [...settings.recipients, email] });
  };

  const removeRecipient = (email: string) => {
    void save({ recipients: settings.recipients.filter((r) => r !== email) });
  };

  const onSendNow = async () => {
    if (!settings.recipients.length) {
      Alert.alert(t('email.noRecip'), t('email.noRecipBody'));
      return;
    }
    Alert.alert(
      t('email.sendQ'),
      t('email.sendBody', { x: tn('n.recipient', settings.recipients.length) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('email.send'),
          onPress: async () => {
            setSending(true);
            try {
              const vessel = await currentVesselKey();
              if (!vessel) throw new Error('Not connected to a vessel.');
              await sendReportNow(vessel);
              playSuccessSound();
              const updated = await getEmailReportSettings();
              if (updated) setSettings(updated);
              Alert.alert(t('email.sent'), t('email.sentBody'));
            } catch (e: any) {
              playErrorSound();
              Alert.alert(t('email.couldNotSend'), e?.message ?? String(e));
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Screen>
        <ScreenTitle title={t('email.title')} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title={t('email.title')} subtitle={t('email.sub')} />

      <Card>
        <Label>{t('email.digest')}</Label>
        <Text style={styles.body}>
          {t('email.about')}
        </Text>
        <View style={styles.toggleRow}>
          <MciIcon name="email-outline" size={20} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('email.enable')}</Text>
            {settings.lastSentAt ? (
              <Text style={styles.rowSub}>{t('email.lastSent', { when: uiDateTime(settings.lastSentAt) })}</Text>
            ) : (
              <Text style={styles.rowSub}>{t('email.notSent')}</Text>
            )}
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={(v) => void save({ enabled: v })}
            trackColor={{ true: COLORS.primary, false: COLORS.border }}
            disabled={saving}
          />
        </View>
      </Card>

      <Card>
        <Label>{t('email.recipients')}</Label>
        <Text style={styles.body}>{t('email.who')}</Text>

        {settings.recipients.map((email) => (
          <View key={email} style={styles.recipientRow}>
            <MciIcon name="email-check-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{email}</Text>
            <TouchableOpacity onPress={() => removeRecipient(email)} hitSlop={8}>
              <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('common.remove')}</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!settings.recipients.length ? (
          <Text style={styles.rowSub}>{t('email.noneYet')}</Text>
        ) : null}

        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={recipientInput}
            onChangeText={setRecipientInput}
            placeholder="email@company.com"
            placeholderTextColor={COLORS.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={addRecipient}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addBtn, !recipientInput.includes('@') && { opacity: 0.4 }]}
            onPress={addRecipient}
            disabled={!recipientInput.includes('@')}
          >
            <Text style={styles.addBtnText}>{t('common.add')}</Text>
          </TouchableOpacity>
        </View>
      </Card>

      <Card>
        <Label>{t('email.note')}</Label>
        <Text style={styles.body}>{t('email.noteAbout')}</Text>
        <TextInput
          style={[styles.input, { minHeight: 110, textAlignVertical: 'top', marginBottom: SIZES.sm }]}
          value={noteText}
          onChangeText={setNoteText}
          placeholder={t('email.notePh')}
          placeholderTextColor={COLORS.textLight}
          multiline
        />
        {aiReady(sync.enrolled) ? (
          <BriefAiPanel
            kind="month"
            build={buildBrief}
            label={t('email.noteJob', { month })}
            month={month}
            current={noteText}
            onPut={(text) => {
              setNoteText(text);
              setNoteAi(true);
            }}
            waited={route.params?.aiBrief}
            waitedGaps={route.params?.aiGaps}
            jobId={route.params?.aiJob}
          />
        ) : null}
        <View style={[styles.addRow, { marginTop: 0 }]}>
          <TouchableOpacity
            style={[styles.addBtn, (saving || !noteText.trim() || noteSaved) && { opacity: 0.4 }]}
            onPress={() => void saveNote(noteText)}
            disabled={saving || !noteText.trim() || noteSaved}
          >
            <Text style={styles.addBtnText}>{t('email.noteSave')}</Text>
          </TouchableOpacity>
          {settings.note && notePending(settings) ? (
            <TouchableOpacity onPress={() => void saveNote(null)} hitSlop={8}>
              <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('common.remove')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.rowSub}>
          {settings.note && notePending(settings)
            ? t(noteSaved ? 'email.noteGoes' : 'email.noteEdited', { when: uiDateTime(settings.note.at) })
            : settings.note
              ? t('email.noteWent', { when: uiDateTime(settings.lastSentAt ?? settings.note.at) })
              : t('email.noteNone')}
        </Text>
      </Card>

      <TouchableOpacity
        style={[styles.sendBtn, (sending || !settings.recipients.length) && { opacity: 0.4 }]}
        onPress={onSendNow}
        disabled={sending || !settings.recipients.length}
      >
        {sending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <MciIcon name="send-outline" size={18} color="#fff" />
            <Text style={styles.sendBtnText}>{t('email.sendNow')}</Text>
          </>
        )}
      </TouchableOpacity>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    body: { fontSize: SIZES.small, color: COLORS.textLight, lineHeight: 18, marginBottom: SIZES.sm },
    toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
    recipientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
    rowTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
    rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    addRow: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm, alignItems: 'center' },
    input: {
      ...COLORS.glassInput,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      fontSize: SIZES.body,
      color: COLORS.text,
    },
    addBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.lg,
      paddingVertical: SIZES.sm,
      justifyContent: 'center',
    },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: SIZES.body },
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.md,
      marginTop: SIZES.sm,
    },
    sendBtnText: { color: '#fff', fontWeight: '700', fontSize: SIZES.body },
  });
