// ===================================
// Management of change (types/moc.ts, plan item 38) — the vessel's changes:
// what waits for someone first (returned, with the Master, with the office),
// then those being carried out (late first), then the finished history. Each
// opens on MocSc. Entry: Safety → Non-conformities → Management of change.
// ===================================

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Empty, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { todayIso } from '../services/pms';
import { mocStage, nextActionDue, overdueActions, sortMocs, tempState } from '../services/moc';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { makeStyles } from './SafetySc';
import { mocStageColor } from './MocSc';
import { t, tk, useT } from '../utils/i18n';

export default function MocsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { mocs } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const list = useMemo(() => sortMocs(mocs, today), [mocs, today]);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Safety')} />
      <ScreenTitle title={t('moc.title')} subtitle={t('moc.sub')} help="Management of change" />
      {canEdit ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Moc', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('moc.one')}`}</Text></TouchableOpacity>
        </View>
      ) : null}
      {!list.length ? <Empty text={t('moc.empty')} /> : null}
      {list.map((m) => {
        const st = mocStage(m);
        const late = overdueActions(m, today);
        const temp = tempState(m, today);
        const c = mocStageColor(COLORS, st, late.length > 0 || temp === 'over');
        const done = m.actions.filter((a) => a.doneAt).length;
        const due = st === 'approved' ? nextActionDue(m) : undefined;
        return (
          <TouchableOpacity key={m.id} style={[styles.item, { borderLeftColor: c }]} onPress={() => nav.navigate('Moc', { id: m.id })} activeOpacity={0.7}>
            <Text style={styles.name}>{`${m.no} · ${m.title}`}</Text>
            <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>
              {[tk(`moc.st.${st}`), st === 'approved' && m.actions.length ? t('saf.actionsN', { k: done, n: m.actions.length }) : null, late.length ? t('moc.lateN', { n: late.length }) : null, temp === 'over' ? t('moc.tempOver') : null, due && !late.length ? t('drills.nextBy', { date: uiDate(due) }) : null].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.sub}>{[tk(`moc.kind.${m.kind}`), m.until ? t('moc.untilShort', { date: uiDate(m.until) }) : null, m.raisedByRank ? `${m.raisedBy} (${m.raisedByRank})` : m.raisedBy].filter(Boolean).join(' · ')}</Text>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
