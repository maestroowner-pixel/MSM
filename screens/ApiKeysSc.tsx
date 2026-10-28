// ===================================
// Settings → API access — the Master's keys to the vessel's API (functions/api.js).
//
// A key is named for who uses it ("Office BI", "AMS PC") so revoking one stops
// one integration and nobody else. The key is shown ONCE, when issued: the vessel
// keeps only its hash, so a lost key is revoked and issued again, never recovered.
// A key reads by default; writing running hours is a separate choice, because a
// script that can write is a second engineer filling in the counters.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Clipboard, Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useSync } from '../contexts/SyncContext';
import { API_BASE_URL, ApiKeyRecord, ApiLogRow, currentVesselKey, subscribeApiKeys, subscribeApiLog } from '../services/firebaseService';
import { curlExample, issueApiKey, revokeApiKey } from '../services/apiKeys';
import { uiDateTime } from '../utils/dates';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { t, useT } from '../utils/i18n';

const mono = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function ApiKeysSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const sync = useSync();
  const [imo, setImo] = useState<string | null>(null);
  const isMaster = sync.enrolled && sync.role === 'superadmin';

  const [keys, setKeys] = useState<ApiKeyRecord[] | null>(null);
  const [log, setLog] = useState<ApiLogRow[]>([]);
  const [label, setLabel] = useState('');
  const [write, setWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ key: string; label: string } | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => { void currentVesselKey().then(setImo); }, [sync.status]);

  useEffect(() => {
    if (!imo || !isMaster) return;
    const a = subscribeApiKeys(imo, setKeys, () => setKeys([]));
    const b = subscribeApiLog(imo, setLog);
    return () => { a(); b(); };
  }, [imo, isMaster]);

  const copy = (text: string, what: string) => {
    Clipboard.setString(text);
    setCopied(what);
    setTimeout(() => setCopied(''), 2500);
  };

  const issue = async () => {
    const name = label.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const r = await issueApiKey(name, write);
      setFresh({ key: r.key, label: name });
      setLabel('');
      setWrite(false);
      playSuccessSound();
    } catch (e: any) {
      playErrorSound();
      Alert.alert(t('api.title'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const revoke = (k: ApiKeyRecord) => {
    Alert.alert(t('api.revokeQ', { label: k.label }), t('api.revokeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('api.revoke'),
        style: 'destructive',
        onPress: async () => {
          try { await revokeApiKey(k.id); } catch (e: any) { Alert.alert(t('api.title'), String(e?.message ?? e)); }
        },
      },
    ]);
  };

  if (!isMaster) {
    return (
      <Screen>
        <ScreenTitle title={t('api.title')} />
        <Card><Text style={styles.body}>{t('api.masterOnly')}</Text></Card>
      </Screen>
    );
  }

  const active = (keys ?? []).filter((k) => !k.revokedAt);
  const revoked = (keys ?? []).filter((k) => k.revokedAt);

  return (
    <Screen>
      <ScreenTitle title={t('api.title')} subtitle={t('api.sub')} />

      <Card>
        <Label>{t('api.whatTitle')}</Label>
        <Text style={styles.body}>{t('api.whatBody')}</Text>
        <Text style={styles.body}>{t('api.privacy')}</Text>
        <TouchableOpacity style={styles.urlRow} onPress={() => copy(API_BASE_URL, 'url')} hitSlop={6}>
          <Text style={styles.code} selectable numberOfLines={2}>{API_BASE_URL}</Text>
          <MciIcon name={copied === 'url' ? 'check' : 'content-copy'} size={16} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.small}>GET /v1/due · /v1/equipment · /v1/certificates · /v1/surveys · /v1/defects · /v1/machines{'\n'}POST /v1/machines/hours</Text>
      </Card>

      {fresh ? (
        <Card>
          <Label>{t('api.freshTitle', { label: fresh.label })}</Label>
          <Text style={[styles.body, { color: COLORS.danger }]}>{t('api.freshBody')}</Text>
          <TouchableOpacity style={styles.keyBox} onPress={() => copy(fresh.key, 'key')}>
            <Text style={styles.code} selectable>{fresh.key}</Text>
            <MciIcon name={copied === 'key' ? 'check' : 'content-copy'} size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => copy(curlExample(fresh.key), 'curl')} style={styles.linkLine}>
            <MciIcon name={copied === 'curl' ? 'check' : 'console'} size={16} color={COLORS.primary} />
            <Text style={styles.link}>{t('api.copyCurl')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setFresh(null)} style={styles.linkLine}>
            <MciIcon name="check-circle-outline" size={16} color={COLORS.primary} />
            <Text style={styles.link}>{t('api.freshDone')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      <Card>
        <Label>{t('api.newTitle')}</Label>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder={t('api.labelPh')}
          placeholderTextColor={COLORS.textLight}
          maxLength={60}
        />
        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{t('api.write')}</Text>
            <Text style={styles.rowSub}>{t('api.writeSub')}</Text>
          </View>
          <Switch value={write} onValueChange={setWrite} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
        </View>
        <TouchableOpacity style={[styles.btn, (!label.trim() || busy) && { opacity: 0.4 }]} onPress={() => void issue()} disabled={!label.trim() || busy}>
          {busy ? <ActivityIndicator color="#fff" size="small" /> : <><MciIcon name="key-plus" size={18} color="#fff" /><Text style={styles.btnText}>{t('api.issue')}</Text></>}
        </TouchableOpacity>
      </Card>

      <Card>
        <Label>{t('api.keysTitle')}</Label>
        {keys == null ? <ActivityIndicator color={COLORS.primary} /> : null}
        {keys != null && !active.length ? <Text style={styles.body}>{t('api.none')}</Text> : null}
        {active.map((k) => (
          <View key={k.id} style={styles.keyRow}>
            <MciIcon name={k.write ? 'key-change' : 'key-outline'} size={20} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{k.label}</Text>
              <Text style={[styles.rowSub, { fontFamily: mono }]}>{k.hint}</Text>
              <Text style={styles.rowSub}>
                {k.write ? t('api.canWrite') : t('api.readOnly')} · {t('api.issuedBy', { by: k.createdBy, at: uiDateTime(k.createdAt) })}
              </Text>
              <Text style={styles.rowSub}>
                {k.lastUsedAt ? t('api.lastUsed', { at: uiDateTime(k.lastUsedAt), n: k.calls ?? 0 }) : t('api.neverUsed')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => revoke(k)} hitSlop={8}>
              <Text style={styles.danger}>{t('api.revoke')}</Text>
            </TouchableOpacity>
          </View>
        ))}
        {revoked.length ? (
          <Text style={[styles.small, { marginTop: SIZES.sm }]}>
            {t('api.revoked')}: {revoked.map((k) => `${k.label} (${uiDateTime(k.revokedAt)})`).join(', ')}
          </Text>
        ) : null}
      </Card>

      {log.length ? (
        <Card>
          <Label>{t('api.logTitle')}</Label>
          {log.map((r) => (
            <View key={r.id} style={styles.logRow}>
              <Text style={styles.rowTitle}>{uiDateTime(r.at)} · {r.label}</Text>
              <Text style={styles.rowSub}>
                {r.taken.length ? r.taken.map((x) => `${x.name} ${x.hours} h`).join(', ') : t('api.nothingTaken')}
                {r.refused ? ` · ${t('api.refused', { n: r.refused })}` : ''}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    body: { fontSize: SIZES.small, color: COLORS.textLight, lineHeight: 18, marginBottom: SIZES.sm },
    small: { fontSize: SIZES.small, color: COLORS.textLight, lineHeight: 17 },
    code: { flex: 1, fontFamily: mono, fontSize: 12, color: COLORS.text },
    urlRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.xs, marginBottom: SIZES.xs },
    keyBox: {
      ...COLORS.glassInput,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginVertical: SIZES.sm,
    },
    linkLine: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, paddingVertical: SIZES.xs },
    link: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.body },
    input: {
      ...COLORS.glassInput,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      fontSize: SIZES.body,
      color: COLORS.text,
      marginTop: SIZES.xs,
    },
    toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SIZES.sm, gap: SIZES.sm },
    rowTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
    rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.md,
      marginTop: SIZES.sm,
    },
    btnText: { color: '#fff', fontWeight: '700', fontSize: SIZES.body },
    keyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.md,
      paddingVertical: SIZES.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    danger: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small },
    logRow: { paddingVertical: SIZES.xs },
  });
