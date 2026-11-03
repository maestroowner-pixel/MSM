// ===================================
// Crew appraisals (types/appraisal.ts, plan item 40) — who is due (the end of
// the contract, once a year), what waits for a signature, and the history.
// `crewId` narrows it to one person (from their crew card). Each opens on
// AppraisalSc. Entry: Crew → Appraisals, and the crew member's card. Officers
// and the Master only.
// ===================================

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { todayIso } from '../services/pms';
import { apStage, average, dueList, sortAppraisals } from '../services/appraisals';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { makeStyles } from './SafetySc';
import { apStageColor } from './AppraisalSc';
import { t, tk, useT } from '../utils/i18n';

export default function AppraisalsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, appraisals } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const crewId: string | undefined = route.params?.crewId;
  const person = crewId ? crew.find((c) => c.id === crewId) : undefined;
  const mine = useMemo(() => appraisals.filter((a) => !crewId || a.crewId === crewId), [appraisals, crewId]);
  const due = useMemo(() => dueList(crew, appraisals, today).filter((d) => !crewId || d.c.id === crewId), [crew, appraisals, today, crewId]);
  const list = useMemo(() => sortAppraisals(mine), [mine]);

  // A draft already started for the person opens instead of a second one.
  const open = (id: string, reason: string) => {
    const d = appraisals.find((a) => a.crewId === id && apStage(a) === 'draft');
    nav.navigate('Appraisal', d ? { id: d.id } : { id: 'new', crewId: id, reason });
  };

  if (!canEdit) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Crew')} />
        <Text style={styles.sub}>{t('ap.officersOnly')}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Crew')} />
      <ScreenTitle title={person ? `${t('ap.title')} · ${person.name}` : t('ap.title')} subtitle={t('ap.sub')} help="Crew appraisals" />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Appraisal', { id: 'new', ...(crewId ? { crewId } : {}) })}><Text style={styles.btnText}>{`+ ${t('ap.one')}`}</Text></TouchableOpacity>
      </View>

      {due.length ? <Label>{t('ap.dueN', { n: due.length })}</Label> : null}
      {due.map(({ c, due: d }) => {
        const col = d.state === 'overdue' ? COLORS.danger : COLORS.warning;
        return (
          <TouchableOpacity key={c.id} style={[styles.item, { borderLeftColor: col }]} onPress={() => open(c.id, d.reason)} activeOpacity={0.7}>
            <Text style={styles.name}>{c.rank ? `${c.name} · ${c.rank}` : c.name}</Text>
            <Text style={[styles.sub, { color: col, fontWeight: '700' }]}>{t(d.reason === 'contract' ? 'ap.dueContract' : 'ap.dueAnnual', { date: uiDate(d.date) })}{d.state === 'overdue' ? ` · ${t('moc.overdue')}` : ''}</Text>
          </TouchableOpacity>
        );
      })}

      {list.length ? <Label>{t('ap.records')}</Label> : null}
      {!list.length && !due.length ? <Empty text={t('ap.empty')} /> : null}
      {list.map((a) => {
        const st = apStage(a);
        const c = apStageColor(COLORS, st);
        const avg = average(a);
        return (
          <TouchableOpacity key={a.id} style={[styles.item, { borderLeftColor: c }]} onPress={() => nav.navigate('Appraisal', { id: a.id })} activeOpacity={0.7}>
            <Text style={styles.name}>{a.rank ? `${a.name} · ${a.rank}` : a.name}</Text>
            <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{[tk(`ap.st.${st}`), avg != null ? t('ap.avg', { n: avg.toFixed(1) }) : null, a.rehire && st !== 'draft' ? `${t('ap.rehire')}: ${tk(`ap.rehire.${a.rehire}`)}` : null].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.sub}>{`${tk(`ap.reason.${a.reason}`)} · ${uiDate(a.from)} – ${uiDate(a.to)}`}</Text>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
