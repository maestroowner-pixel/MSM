import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, Alert, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Card, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import {
  EmailReportSettings,
  getEmailReportSettings,
  saveEmailReportSettings,
  sendReportNow,
} from '../services/emailReportService';
import { currentVesselKey } from '../services/firebaseService';
import { formatDateTime } from '../utils/dates';
import { playSuccessSound, playErrorSound } from '../utils/sound';

export default function EmailReportSc() {
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const sync = useSync();

  const [settings, setSettings] = useState<EmailReportSettings>({ enabled: false, recipients: [] });
  const [recipientInput, setRecipientInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void getEmailReportSettings().then((s) => {
      if (s) setSettings(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const save = async (patch: Partial<EmailReportSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await saveEmailReportSettings(next);
      playSuccessSound();
    } catch (e: any) {
      playErrorSound();
      Alert.alert('Could not save', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (!email.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
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
      Alert.alert('No recipients', 'Add at least one email address first.');
      return;
    }
    Alert.alert(
      'Send report now?',
      `The monthly safety digest will be sent to ${settings.recipients.length} recipient${settings.recipients.length === 1 ? '' : 's'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setSending(true);
            try {
              const vessel = await currentVesselKey();
              if (!vessel) throw new Error('Not connected to a vessel.');
              await sendReportNow(vessel);
              playSuccessSound();
              const updated = await getEmailReportSettings();
              if (updated) setSettings(updated);
              Alert.alert('Sent', 'The safety report has been sent.');
            } catch (e: any) {
              playErrorSound();
              Alert.alert('Could not send', e?.message ?? String(e));
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
        <ScreenTitle title="Email Report" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title="Email Report" subtitle="Monthly safety digest" />

      <Card>
        <Label>Monthly digest</Label>
        <Text style={styles.body}>
          A summary of expired equipment, upcoming certificates, open defects, non-conformities,
          overdue drills and safety observations — sent to the owner or DPA on the 1st of each month at 08:00 UTC.
        </Text>
        <View style={styles.toggleRow}>
          <MciIcon name="email-outline" size={20} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Enable monthly email</Text>
            {settings.lastSentAt ? (
              <Text style={styles.rowSub}>Last sent: {formatDateTime(settings.lastSentAt)}</Text>
            ) : (
              <Text style={styles.rowSub}>Not sent yet</Text>
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
        <Label>Recipients</Label>
        <Text style={styles.body}>Who receives the digest — the owner, DPA or their office email.</Text>

        {settings.recipients.map((email) => (
          <View key={email} style={styles.recipientRow}>
            <MciIcon name="email-check-outline" size={18} color={COLORS.primary} />
            <Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{email}</Text>
            <TouchableOpacity onPress={() => removeRecipient(email)} hitSlop={8}>
              <Text style={{ color: COLORS.danger, fontWeight: '700' }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        {!settings.recipients.length ? (
          <Text style={styles.rowSub}>No recipients yet.</Text>
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
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
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
            <Text style={styles.sendBtnText}>Send report now</Text>
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
