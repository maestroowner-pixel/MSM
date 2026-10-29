// ===================================
// External inspections (types/extInspection.ts) — PSC, flag, class, the
// superintendent's visit, vetting, external audits. A detention not lifted
// first, then those with overdue findings, open ones, and the closed history.
// Each opens on ExtInspectionSc; its findings are NCs.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Empty, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { todayIso } from '../services/pms';
import { InspState, inspStatus, sortInspections } from '../services/extInspections';
import { exportInspExcel, exportInspPdf } from '../services/extInspectionReport';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

export default function ExtInspectionsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { extInspections, ncs, vessel } = useData();
  const [saved, setSaved] = useState<string | null>(null);
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const list = useMemo(() => sortInspections(extInspections, ncs, today), [extInspections, ncs, today]);

  const paper = async (kind: 'pdf' | 'xlsx') => {
    try {
      const byDate = [...extInspections].sort((a, b) => b.date.localeCompare(a.date));
      const w = kind === 'pdf' ? await exportInspPdf(byDate, ncs, today, vessel) : await exportInspExcel(byDate, ncs, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('ei.title'), String(e?.message ?? e));
    }
  };

  const color: Record<InspState, string> = { overdue: COLORS.danger, open: COLORS.warning, closed: COLORS.primary, verified: COLORS.success, clean: COLORS.success };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Safety')} />
      <ScreenTitle title={t('ei.title')} subtitle={t('ei.sub')} help="External inspections" />
      {canEdit ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('ExtInspection', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('ei.new')}`}</Text></TouchableOpacity>
        </View>
      ) : null}
      {!list.length ? <Empty text={t('ei.empty')} /> : null}
      {list.map((x) => {
        const s = inspStatus(x, ncs, today);
        const c = s.detainedNow ? COLORS.danger : color[s.state];
        return (
          <TouchableOpacity key={x.id} style={[styles.item, { borderLeftColor: c }]} onPress={() => nav.navigate('ExtInspection', { id: x.id })} activeOpacity={0.7}>
            <Text style={styles.name}>{[tk(`ei.kind.${x.kind}`), x.port].filter(Boolean).join(' · ')}</Text>
            <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>
              {[s.detainedNow ? t('ei.detainedNow') : x.detained ? t('ei.wasDetained', { date: uiDate(x.releasedOn!) }) : null, tk(`ei.state.${s.state}`), s.total ? t('ei.closedK', { k: s.closed, n: s.total }) : null, s.overdue ? t('ei.overdueN', { n: s.overdue }) : null].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.sub}>{[x.no, uiDate(x.date), x.authority, x.reportNo].filter(Boolean).join(' · ')}</Text>
          </TouchableOpacity>
        );
      })}
      {list.length ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void paper('pdf')}><Text style={styles.btnText}>{t('ei.reportPdf')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btn} onPress={() => void paper('xlsx')}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
          {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
        </View>
      ) : null}
    </Screen>
  );
}
