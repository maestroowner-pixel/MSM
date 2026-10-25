// ===================================
// Fill in an engine-room round and sign it — or read back a completed one.
// New round: route params { templateId }
// Read-only: route params { entryId, templateId }
// Beside each reading: the previous round's figure and which way it moved.
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
import { WatchEntry, WatchTemplate } from '../types/watchLog';
import { WATCH_PERIODS, WatchPeriod } from '../types/deckLog';
import { PERIOD_LABEL, PERIOD_SHORT, currentPeriod } from '../services/deckLog';
import {
  defaultTemplate, fmtValue, normalStatus, nowTime, outOfRange, previous, rangeText, todayStr, trend,
} from '../services/watchLog';
import { shareWatchLogPage } from '../services/watchLogReport';
import * as storage from '../services/storage';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { t, tk, useT } from '../utils/i18n';

const ENGINE_PERIODS = WATCH_PERIODS.filter((p) => p !== 'noon');
const perShort = (p: WatchPeriod) => (p === 'other' ? tk('de.per.other') : PERIOD_SHORT[p]);
const perLabel = (p: WatchPeriod) => (p === 'other' ? tk('de.per.other') : PERIOD_LABEL[p]);
const ARROW = { up: '↑', down: '↓', same: '→' } as const;

export default function WatchEntrySc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { watchTemplates, watchLog, vessel, saveRow } = useData();
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
      return { id: existing.templateId, name: watchTemplates.find((x) => x.id === existing.templateId)?.name ?? defaultTemplate().name, params: existing.params, updatedAt: 0 };
    }
    return watchTemplates.find((x) => x.id === templateId) ?? watchTemplates[0] ?? defaultTemplate();
  }, [existing, watchTemplates, templateId]);

  const params = template.params;

  // Mutable state for new entries.
  const [values, setValues] = useState<Record<string, string>>(() => existing?.values ?? {});
  const [period, setPeriod] = useState<WatchPeriod>(() => existing?.period ?? currentPeriod());
  const [remarks, setRemarks] = useState(existing?.remarks ?? '');
  const [saving, setSaving] = useState(false);

  const setValue = (id: string, v: string) => setValues((prev) => ({ ...prev, [id]: v }));

  // The round this one follows — for a past round, the one before it.
  const before = existing?.at ?? Infinity;
  const prevOf = useMemo(() => {
    const m: Record<string, ReturnType<typeof previous>> = {};
    for (const q of params) m[q.id] = previous(q, watchLog, before);
    return m;
  }, [params, watchLog, before]);

  const sign = async () => {
    if (!signer) return Alert.alert(t('sign.noSigner'), t('we.chooseSigner'));
    if (saving) return;
    const off = outOfRange(params, values);
    if (off.length && !remarks.trim()) {
      const go = await new Promise<boolean>((resolve) => {
        Alert.alert(
          t('we.outTitle'),
          t('we.outBody', { list: off.map((q) => q.name).join(', ') }),
          [
            { text: t('we.addRemark'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('we.signAnyway'), onPress: () => resolve(true) },
          ],
        );
      });
      if (!go) return;
    }
    setSaving(true);
    try {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Engine room round — ${template.name}, ${PERIOD_LABEL[period]}` });
      if (!sig) { setSaving(false); return; }
      const entry: WatchEntry = {
        id: uid(),
        templateId: template.id,
        params: template.params,
        values,
        date: todayStr(),
        time: nowTime(),
        period,
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
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
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <BackButton onPress={() => goBackOr(nav, 'WatchLog')} fav={false} />
            {existing ? (
              <TouchableOpacity
                style={{ marginLeft: 'auto' }}
                hitSlop={8}
                accessibilityLabel={t('wl.share')}
                onPress={() => shareWatchLogPage([existing], existing.date, vessel).catch((e) => Alert.alert(t('common.error'), e?.message ?? String(e)))}
              >
                <MciIcon name="share-outline" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.title}>{template.name}</Text>
          {existing ? (
            <Text style={styles.sub}>
              {uiDate(existing.date)} {existing.time}{existing.period ? ` · ${perLabel(existing.period)}` : ''}
            </Text>
          ) : (
            <Text style={styles.sub}>{t('we.newRound', { date: uiDate(todayStr()), time: nowTime() })}</Text>
          )}

          {/* Watch period */}
          {!readOnly ? (
            <View style={styles.chips}>
              {ENGINE_PERIODS.map((p) => (
                <TouchableOpacity key={p} onPress={() => setPeriod(p)}
                  style={[styles.chip, period === p && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}>
                  <Text style={[styles.chipText, period === p && { color: COLORS.textWhite }]}>{perShort(p)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Readings */}
          <View style={styles.card}>
            {params.map((p, i) => {
              const raw = values[p.id] ?? '';
              const status = normalStatus(p, raw);
              const isLast = i === params.length - 1;
              const prev = prevOf[p.id];
              const dir = trend(raw, prev);
              const range = rangeText(p);
              return (
                <View key={p.id} style={[styles.paramRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paramName}>{p.name}</Text>
                    {p.unit ? <Text style={styles.paramUnit}>{p.unit}</Text> : null}
                    {range ? <Text style={styles.paramRange}>{t('we.normal', { range })}</Text> : null}
                    {prev ? (
                      <Text style={styles.paramRange}>
                        {t('we.prev', { v: fmtValue(p, String(prev.value)), time: prev.date === (existing?.date ?? todayStr()) ? prev.time : `${uiDate(prev.date)} ${prev.time}` })}
                        {dir ? `  ${ARROW[dir]}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  {readOnly ? (
                    <Text style={[styles.value, status === 'warn' && { color: COLORS.warning, fontWeight: '800' }]}>
                      {fmtValue(p, raw)}
                    </Text>
                  ) : (
                    <TextInput
                      style={[styles.input, status === 'warn' && { borderColor: COLORS.warning, color: COLORS.warning }]}
                      value={raw}
                      onChangeText={(v) => setValue(p.id, v)}
                      keyboardType={p.type === 'number' ? 'decimal-pad' : 'default'}
                      placeholder={p.type === 'number' ? '—' : '…'}
                      placeholderTextColor={COLORS.textLight}
                      accessibilityLabel={p.name}
                      returnKeyType="next"
                    />
                  )}
                </View>
              );
            })}
          </View>

          {/* Remarks */}
          {readOnly ? (
            existing?.remarks ? (
              <View style={styles.card}>
                <Label>{t('we.remarks')}</Label>
                <Text style={styles.remarks}>{existing.remarks}</Text>
              </View>
            ) : null
          ) : (
            <View style={styles.card}>
              <Label>{t('we.remarks')}</Label>
              <TextInput
                style={[styles.input, styles.remarksInput]}
                value={remarks}
                onChangeText={setRemarks}
                placeholder={t('we.remarksPh')}
                placeholderTextColor={COLORS.textLight}
                multiline
              />
            </View>
          )}

          {/* Signature, or signer + sign button */}
          {existing ? (
            <View style={styles.card}>
              <Label>{t('we.signedBy')}</Label>
              <Text style={styles.paramName}>{existing.by}{existing.byRank ? ` · ${existing.byRank}` : ''}</Text>
              <Text style={styles.paramUnit}>{uiDateTime(existing.at)}</Text>
            </View>
          ) : (
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
          )}
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
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SIZES.md },
    chip: {
      borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
      paddingHorizontal: 10, paddingVertical: 4, backgroundColor: COLORS.cardSolid,
    },
    chipText: { fontSize: SIZES.small, color: COLORS.textDark, fontWeight: '600' },
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
    remarksInput: { textAlign: 'left', minHeight: 64, marginTop: 4, textAlignVertical: 'top' },
    remarks: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 4 },
    signBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, backgroundColor: COLORS.success,
      borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, marginTop: SIZES.sm,
    },
    signBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
