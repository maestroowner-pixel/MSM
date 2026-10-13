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
import { formatDate } from '../utils/dates';
import { makeStyles } from './SafetySc';

export default function MeetingsSc() {
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
      <ScreenTitle title="Monthly safety meeting" subtitle={due.last ? `Last held ${formatDate(due.last.date)} · ${due.last.no}` : 'None held yet'} help="Security (ISPS)" />
      <View style={[styles.item, { borderLeftColor: due.overdue ? COLORS.danger : due.due ? COLORS.warning : COLORS.success }]}>
        <Text style={styles.name}>{due.due ? (due.overdue ? 'Overdue — no meeting for more than a month' : 'Due this month') : 'Held this month'}</Text>
        <Text style={styles.sub}>The safety committee meets every month: the agenda, who took part (each signs his own line), what was said and the actions — who does what by when. Signed by the Master, the record is final; open actions come back at the next meeting.</Text>
        {officer && !drafts.length ? (
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => nav.navigate('Meeting', { id: 'new' })}><Text style={styles.btnText}>+ New meeting</Text></TouchableOpacity>
        ) : null}
      </View>

      {drafts.map((m) => (
        <TouchableOpacity key={m.id} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => nav.navigate('Meeting', { id: m.id })}>
          <Text style={styles.name}>{`${m.no || 'New meeting'} · ${formatDate(m.date)} — not signed yet`}</Text>
          <Text style={styles.sub}>{`${m.attendance.filter((a) => a.present).length} present · ${m.actions.length} actions`}</Text>
        </TouchableOpacity>
      ))}

      {open.length ? (
        <>
          <Label>{`Open actions · ${open.length}`}</Label>
          {open.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 4 }}>
              <MciIcon name="checkbox-blank-outline" size={18} color={a.due && a.due < today ? COLORS.danger : COLORS.textLight} />
              <View style={{ flex: 1 }}>
                <Text style={styles.body}>{a.text}</Text>
                <Text style={[styles.sub, a.due && a.due < today ? { color: COLORS.danger, fontWeight: '700' } : null]}>{[a.who, a.due ? `by ${formatDate(a.due)}` : null, a.fromNo].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Label>{`Meetings held · ${held.length}`}</Label>
      {held.map((m) => (
        <TouchableOpacity key={m.id} style={[styles.item, { borderLeftColor: COLORS.success }]} onPress={() => nav.navigate('Meeting', { id: m.id })}>
          <Text style={styles.name}>{`${m.no} · ${formatDate(m.date)}`}</Text>
          <Text style={styles.sub}>{[`${m.attendance.filter((a) => a.present).length} present`, `${m.actions.length} new actions`, m.carried.length ? `${m.carried.filter((c) => c.done).length} of ${m.carried.length} carried closed` : null, m.doneBy ? `signed by ${m.doneBy}` : null].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
      ))}
      {!held.length ? <Text style={styles.sub}>No meeting held yet.</Text> : null}
    </Screen>
  );
}
