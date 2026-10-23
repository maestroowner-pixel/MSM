// ===================================
// Monthly safety meetings (menu → Security → Monthly safety meeting): the one
// due this month, the actions still open, and the meetings held — each opens on
// MeetingSc (types/meetings.ts).
// ===================================

import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { todayIso } from '../services/pms';
import { heldMeetings, meetingDue, openActions } from '../services/meetings';
import { uiDate } from '../utils/dates';
import { makeStyles } from './SafetySc';
import { t, tn, useT } from '../utils/i18n';

export default function MeetingsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { safetyMeetings } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();

  const due = meetingDue(safetyMeetings, today);
  const open = openActions(safetyMeetings);
  const drafts = safetyMeetings.filter((m) => !m.doneAt && !m.deleted).sort((a, b) => b.date.localeCompare(a.date));
  const held = heldMeetings(safetyMeetings);

  return (
    <Screen scroll>
      <ScreenTitle title={t('meet.title')} subtitle={due.last ? t('meet.lastHeld', { date: uiDate(due.last.date), no: due.last.no }) : t('meet.noneYet')} help="Security (ISPS)" />
      <View style={[styles.item, { borderLeftColor: due.overdue ? COLORS.danger : due.due ? COLORS.warning : COLORS.success }]}>
        <Text style={styles.name}>{due.due ? (due.overdue ? t('meet.overdue') : t('meet.dueMonth')) : t('meet.heldMonth')}</Text>
        <Text style={styles.sub}>{t('meet.about')}</Text>
        {officer && !drafts.length ? (
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => nav.navigate('Meeting', { id: 'new' })}><Text style={styles.btnText}>{t('meet.new')}</Text></TouchableOpacity>
        ) : null}
      </View>

      {drafts.map((m) => (
        <TouchableOpacity key={m.id} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => nav.navigate('Meeting', { id: m.id })}>
          <Text style={styles.name}>{t('meet.draftRow', { no: m.no || t('meet.newName'), date: uiDate(m.date) })}</Text>
          <Text style={styles.sub}>{`${t('meet.present', { n: m.attendance.filter((a) => a.present).length })} · ${tn('n.action', m.actions.length)}`}</Text>
        </TouchableOpacity>
      ))}

      {open.length ? (
        <>
          <Label>{t('meet.openActions', { n: open.length })}</Label>
          {open.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 4 }}>
              <MciIcon name="checkbox-blank-outline" size={18} color={a.due && a.due < today ? COLORS.danger : COLORS.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.body}>{a.text}</Text>
                <Text style={[styles.sub, a.due && a.due < today ? { color: COLORS.danger, fontWeight: '700' } : null]}>{[a.who, a.due ? t('meet.by', { date: uiDate(a.due) }) : null, a.fromNo].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Label>{t('meet.held', { n: held.length })}</Label>
      {held.map((m) => (
        <TouchableOpacity key={m.id} style={[styles.item, { borderLeftColor: COLORS.success }]} onPress={() => nav.navigate('Meeting', { id: m.id })}>
          <Text style={styles.name}>{`${m.no} · ${uiDate(m.date)}`}</Text>
          <Text style={styles.sub}>{[t('meet.present', { n: m.attendance.filter((a) => a.present).length }), t('meet.newActions', { n: m.actions.length }), m.carried.length ? t('meet.carriedClosed', { done: m.carried.filter((c) => c.done).length, n: m.carried.length }) : null, m.doneBy ? t('meet.signedBy', { name: m.doneBy }) : null].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
      ))}
      {!held.length ? <Text style={styles.sub}>{t('meet.noneHeld')}</Text> : null}
    </Screen>
  );
}
