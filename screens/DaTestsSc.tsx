// ===================================
// Drug and alcohol tests (types/daTest.ts, plan item 42) — when the next
// unannounced test is due, what waits for the laboratory or for action, the
// vessel's policy (the Master sets how often and the alcohol limit), and every
// test, newest first. Each opens on DaTestSc. Entry: Crew → Drug and alcohol
// tests, the Board. Officers and the Master only.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { personName, roleAtLeast } from '../types/role';
import { DA_MONTHS, DaPolicy } from '../types/daTest';
import * as storage from '../services/storage';
import { actionsAwaited, labsAwaited, mgl, nextUnannounced, parseReading, policyOf, sortTests, testOutcome } from '../services/daTests';
import { shipToday } from '../utils/shipTime';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { daOutcomeColor } from './DaTestSc';
import { t, tk, useT } from '../utils/i18n';

export default function DaTestsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { daTests, daResults, daFollowUps, daPolicy, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const today = shipToday();
  const policy = policyOf(daPolicy);
  const due = nextUnannounced(daTests, policy, today);
  const labs = labsAwaited(daTests, daResults, daFollowUps);
  const acts = actionsAwaited(daTests, daResults, daFollowUps);
  const list = useMemo(() => sortTests(daTests), [daTests]);
  // The policy being changed (the Master).
  const [edit, setEdit] = useState<{ months: number; limit: string } | null>(null);

  if (!canEdit) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Crew')} />
        <Text style={styles.sub}>{t('da.officersOnly')}</Text>
      </Screen>
    );
  }

  const savePolicy = async () => {
    if (!edit) return;
    const limit = parseReading(edit.limit);
    if (limit == null || !Number.isFinite(limit) || limit <= 0 || limit > 1) return Alert.alert(t('da.limit'), t('da.limitBad'));
    const next: DaPolicy = { id: 'policy', months: edit.months, limit, ...(sync.me ? { by: personName(sync.me) } : {}), updatedAt: Date.now() };
    await saveRow(storage.DA_POLICY_KEY, JSON.parse(JSON.stringify(next)));
    setEdit(null);
    playSuccessSound();
  };

  const dueColor = due.state === 'overdue' ? COLORS.danger : due.state === 'ok' ? COLORS.success : COLORS.warning;
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Crew')} />
      <ScreenTitle title={t('da.title')} subtitle={t('da.sub')} help="Drug and alcohol tests" />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('DaTest', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('da.one')}`}</Text></TouchableOpacity>
      </View>

      <View style={[styles.item, { borderLeftColor: dueColor }]}>
        <Text style={[styles.name, { color: dueColor }]}>
          {due.state === 'never' ? t('da.dueNever') : t(due.state === 'overdue' ? 'da.dueOverdue' : 'da.dueBy', { date: uiDate(due.due!) })}
        </Text>
        <Text style={styles.sub}>{[due.last ? t('da.lastOn', { date: uiDate(due.last) }) : null, t('da.policyLine', { n: policy.months, limit: mgl(policy.limit) })].filter(Boolean).join(' · ')}</Text>
        {isMaster && !edit ? <TouchableOpacity onPress={() => setEdit({ months: policy.months, limit: mgl(policy.limit) })}><Text style={styles.link}>{t('da.policyEdit')}</Text></TouchableOpacity> : null}
      </View>

      {edit ? (
        <Card>
          <Label>{t('da.every')}</Label>
          <View style={styles.chips}>{DA_MONTHS.map((m) => chip(edit.months === m, t('da.months', { n: m }), () => setEdit({ ...edit, months: m }), String(m)))}</View>
          <Label>{t('da.limit')}</Label>
          <TextInput style={styles.input} value={edit.limit} onChangeText={(v) => setEdit({ ...edit, limit: v })} keyboardType="decimal-pad" />
          <Text style={styles.sub}>{t('da.limitHint')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void savePolicy()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {acts.length ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('da.actN', { n: acts.length })}</Text> : null}
      {labs.length ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('da.labN', { n: labs.length })}</Text> : null}

      {list.length ? <Label>{t('da.records')}</Label> : <Empty text={t('da.empty')} />}
      {list.map((x) => {
        const o = testOutcome(x, daResults, daFollowUps);
        const c = daOutcomeColor(COLORS, o);
        return (
          <TouchableOpacity key={x.id} style={[styles.item, { borderLeftColor: c }]} onPress={() => nav.navigate('DaTest', { id: x.id })} activeOpacity={0.7}>
            <Text style={styles.name}>{`${x.no} · ${uiDate(x.date)} · ${tk(`da.reason.${x.reason}`)}`}</Text>
            <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{`${tk(`da.out.${o}`)} · ${t('da.peopleN', { n: x.count })}`}</Text>
            <Text style={styles.sub}>{[x.alcohol ? t('da.alcohol') : null, x.drugs ? t('da.drugs') : null, x.tester].filter(Boolean).join(' · ')}</Text>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
