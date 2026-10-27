// ===================================
// Oil analysis — every sampling point of the vessel (types/oil.ts), the most
// urgent first: never sampled or overdue, then an ACTION verdict, a caution,
// results waiting for review, samples late from the lab. A point opens its
// trend and samples (OilPointSc); the officers add and edit points.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { Verdict } from '../types/oil';
import { todayIso } from '../services/pms';
import { PointStatus, pointStatus, pointTitle } from '../services/oil';
import { exportOilStatus } from '../services/oilReport';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const rank = (s: PointStatus) => (s.due === 'overdue' || s.due === 'never' ? 0 : s.verdict === 'action' ? 1 : s.verdict === 'caution' ? 2 : s.toReview ? 3 : s.late ? 4 : s.due === 'soon' ? 5 : 6);

export default function OilSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { oilPoints, oilSamples, machines, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [saved, setSaved] = useState<string | null>(null);
  const today = todayIso();
  const hoursOf = (id?: string) => machines.find((m) => m.id === id)?.hours;

  const rows = useMemo(
    () => oilPoints.map((p) => ({ p, s: pointStatus(p, oilSamples, machines.find((m) => m.id === p.machineId)?.hours, today) }))
      .sort((a, b) => rank(a.s) - rank(b.s) || pointTitle(a.p).localeCompare(pointTitle(b.p))),
    [oilPoints, oilSamples, machines, today],
  );
  const dueNow = rows.filter((r) => r.s.due === 'overdue' || r.s.due === 'never').length;
  const atLab = rows.reduce((n, r) => n + r.s.awaiting, 0);
  const toReview = rows.reduce((n, r) => n + r.s.toReview, 0);
  const action = rows.filter((r) => r.s.verdict === 'action').length;

  const vColor = (v: Verdict | null) => (v === 'action' ? COLORS.danger : v === 'caution' ? COLORS.warning : v === 'normal' ? COLORS.success : COLORS.textLight);
  const dueText = (s: PointStatus) =>
    s.due === 'never' ? t('oil.neverSampled')
      : [s.dueDate ? t('oil.dueOn', { date: s.dueDate }) : '', s.dueHours ? t('oil.dueAtH', { h: s.dueHours }) : ''].filter(Boolean).join(' · ');

  const pdf = async () => {
    try {
      const w = await exportOilStatus(rows.map((r) => r.p), oilSamples, hoursOf, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('oil.title'), String(e?.message ?? e));
    }
  };

  const Stat = ({ v, label, color }: { v: number; label: string; color: string }) => (
    <View style={{ alignItems: 'center', minWidth: 70 }}>
      <Text style={[styles.name, { fontSize: 22, color: v ? color : COLORS.textDark }]}>{v}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );

  return (
    <Screen scroll>
      <ScreenTitle title={t('oil.title')} subtitle={t('oil.subtitle')} help="Oil analysis" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: SIZES.sm }}>
          <Stat v={dueNow} label={t('oil.dueNow')} color={COLORS.danger} />
          <Stat v={action} label={t('oil.v.action')} color={COLORS.danger} />
          <Stat v={toReview} label={t('oil.toReview')} color={COLORS.warning} />
          <Stat v={atLab} label={t('oil.atLab')} color={COLORS.primary} />
        </View>
      </Card>

      <View style={[styles.row, { gap: SIZES.xs }]}>
        {officer ? <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('OilPoint', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('oil.newPoint')}`}</Text></TouchableOpacity> : null}
        {rows.length ? <TouchableOpacity style={styles.small} onPress={() => void pdf()}><Text style={styles.smallText}>{t('oil.statusPdf')}</Text></TouchableOpacity> : null}
      </View>

      {!rows.length ? <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{officer ? t('oil.empty') : t('oil.emptyCrew')}</Text> : null}

      {rows.map(({ p, s }) => (
        <TouchableOpacity key={p.id} style={[styles.item, { borderLeftColor: vColor(s.verdict) }]} onPress={() => nav.navigate('OilPoint', { id: p.id })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
            <MciIcon name="flask-outline" size={20} color={vColor(s.verdict)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{pointTitle(p)}</Text>
              <Text style={styles.sub}>{[tk(`oil.cmp.${p.compartment}`), p.oil ?? '', s.last ? t('oil.lastOn', { date: s.last.date }) : ''].filter(Boolean).join(' · ')}</Text>
              <Text style={[styles.sub, { color: s.due === 'overdue' || s.due === 'never' ? COLORS.danger : s.due === 'soon' ? COLORS.warning : COLORS.textLight }]}>
                {[dueText(s), s.awaiting ? t('oil.nAtLab', { n: s.awaiting }) : '', s.late ? t('oil.nLate', { n: s.late }) : '', s.toReview ? t('oil.nToReview', { n: s.toReview }) : ''].filter(Boolean).join(' · ')}
              </Text>
            </View>
            {s.verdict ? <Text style={[styles.badge, { color: vColor(s.verdict), borderColor: vColor(s.verdict) }]}>{tk(`oil.v.${s.verdict}`)}</Text> : null}
          </View>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}
