// ===================================
// Fill in an engine-room round and sign it — or read back a completed one.
// New round: route params { templateId }
// Read-only: route params { entryId, templateId }
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { WatchEntry, WatchParam, WatchTemplate } from '../types/watchLog';
import { defaultTemplate, fmtValue, normalStatus, nowTime, todayStr } from '../services/watchLog';
import * as storage from '../services/storage';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { t, useT } from '../utils/i18n';

export default function WatchEntrySc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { watchTemplates, watchLog, saveRow } = useData();
  const { signer, picker } = useSigner('SIGNED BY');
  const confirmSign = useSignConfirm();

  const { entryId, templateId } = route.params ?? {};
  const readOnly = !!entryId;

  // Resolve existing entry (read-only mode).
  const existing = useMemo<WatchEntry | undefined>(
    () => (entryId ? watchLog.find((e) => e.id === entryId) : undefined),
    [entryId, watchLog]
  );

  // Resolve template.
  const template = useMemo<WatchTemplate>(() => {
    // In read-only mode: use the snapshot params from the entry; wrap as a template.
    if (existing) {
      return { id: existing.templateId, name: 'Engine Room Round', params: existing.params, updatedAt: 0 };
    }
    return watchTemplates.find((t) => t.id === templateId) ?? defaultTemplate();
  }, [existing, watchTemplates, templateId]);

  const params = readOnly && existing ? existing.params : template.params;

  // Mutable state for new entries.
  const [values, setValues] = useState<Record<string, string>>(() => {
    if (existing) return existing.values;
    return {};
  });
  const [saving, setSaving] = useState(false);

  const setValue = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  const sign = async () => {
    if (!signer) return Alert.alert(t('sign.noSigner'), t('we.chooseSigner'));
    if (saving) return;
    setSaving(true);
    try {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Engine room round — ${template.name}` });
      if (!sig) { setSaving(false); return; }
      const entry: WatchEntry = {
        id: uid(),
        templateId: template.id,
        params: template.params,
        values,
        date: todayStr(),
        time: nowTime(),
        by: signer.name,
        byRank: signer.rank,
        at: Date.now(),
        signedWith: sig.proof,
        updatedAt: Date.now(),
      };
      await saveRow(storage.WATCH_LOG_KEY, entry);
      goBackOr(nav, 'WatchLog');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton onPress={() => goBackOr(nav, 'WatchLog')} fav={false} />

          <Text style={styles.title}>{template.name}</Text>
          {existing ? (
            <Text style={styles.sub}>
              {uiDate(existing.date)} {existing.time} · {existing.by}{existing.byRank ? ` · ${existing.byRank}` : ''}
            </Text>
          ) : (
            <Text style={styles.sub}>New round · {uiDate(todayStr())} {nowTime()}</Text>
          )}

          {/* Readings */}
          <View style={styles.card}>
            {params.map((p, i) => {
              const raw = values[p.id] ?? '';
              const status = normalStatus(p, raw);
              const isLast = i === params.length - 1;
              return (
                <View key={p.id} style={[styles.paramRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paramName}>{p.name}</Text>
                    {p.unit ? <Text style={styles.paramUnit}>{p.unit}</Text> : null}
                    {p.normalMin != null || p.normalMax != null ? (
                      <Text style={styles.paramRange}>
                        normal: {p.normalMin != null ? `≥ ${p.normalMin}` : ''}{p.normalMin != null && p.normalMax != null ? ' – ' : ''}{p.normalMax != null ? `≤ ${p.normalMax}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  {readOnly ? (
                    <Text style={[styles.value, status === 'warn' && { color: COLORS.warning, fontWeight: '800' }]}>
                      {fmtValue(p, raw)}
                    </Text>
                  ) : (
                    <TextInput
                      style={[styles.input, status === 'warn' && { borderColor: COLORS.warning }]}
                      value={raw}
                      onChangeText={(v) => setValue(p.id, v)}
                      keyboardType={p.type === 'number' ? 'numeric' : 'default'}
                      placeholder={p.type === 'number' ? '0' : '…'}
                      placeholderTextColor={COLORS.textLight}
                      returnKeyType="next"
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Signer + sign button */}
          {!readOnly ? (
            <View style={styles.card}>
              {picker}
              <TouchableOpacity
                style={[styles.signBtn, { opacity: saving || !signer ? 0.5 : 1 }]}
                onPress={sign}
                disabled={saving || !signer}
                activeOpacity={0.8}
              >
                <MciIcon name="pencil" size={18} color={COLORS.textWhite} />
                <Text style={styles.signBtnText}>{saving ? t('common.saving') : t('we.sign')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    title: { fontSize: SIZES.h3, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.md },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4, marginBottom: SIZES.md },
    card: { ...COLORS.glassCard, borderRadius: SIZES.radiusLg, padding: SIZES.md, marginBottom: SIZES.md },
    paramRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 10 },
    paramName: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    paramUnit: { fontSize: SIZES.small, color: COLORS.textLight },
    paramRange: { fontSize: SIZES.small - 1, color: COLORS.textLight, marginTop: 2 },
    value: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '700', minWidth: 80, textAlign: 'right' },
    input: {
      minWidth: 80, borderWidth: 1, borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.sm, paddingVertical: 6,
      fontSize: SIZES.body, color: COLORS.textDark, backgroundColor: COLORS.cardSolid,
      textAlign: 'right',
    },
    signBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, backgroundColor: COLORS.success,
      borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, marginTop: SIZES.sm,
    },
    signBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
