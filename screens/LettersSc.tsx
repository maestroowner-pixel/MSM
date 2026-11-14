// ===================================
// The correspondence register (types/correspondence.ts) — letters in and out.
// Three pages: To answer (what the vessel owes, the most urgent on top), In and
// Out (newest first). Each row opens on LetterSc. The register goes on paper for
// the year, last year or all dates, PDF or Excel. Officers and the Master only —
// the rules say the same; a crew device holds none of it.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Empty, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { Letter } from '../types/correspondence';
import { isOpen, letterMatches, letterState, LetterState, sortLetters } from '../services/correspondence';
import { exportLettersExcel, exportLettersPdf, shareLettersPdf } from '../services/correspondenceReport';
import { todayIso } from '../services/pms';
import { uiDate } from '../utils/dates';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

type Tab = 'open' | 'in' | 'out';
type Period = 'year' | 'last' | 'all';

export const letterColor = (C: { danger: string; warning: string; primary: string; success: string; textLight: string }, s: LetterState) =>
  s === 'overdue' ? C.danger : s === 'soon' ? C.warning : s === 'waiting' ? C.primary : s === 'answered' || s === 'closed' ? C.success : C.textLight;

/** The line under a letter: where it stands, by when, who acts. */
export function stateLine(l: Letter, s: LetterState): string {
  if (l.cancelled) return t('lt.cancelledShort');
  if (s === 'overdue') return t('lt.overdueSince', { date: uiDate(l.replyBy!) });
  if (s === 'soon' || (s === 'waiting' && l.replyBy)) return t('lt.answerBy', { date: uiDate(l.replyBy!) });
  return tk(`lt.st.${s}`);
}

export default function LettersSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { letters, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const [tab, setTab] = useState<Tab>(route.params?.tab === 'in' || route.params?.tab === 'out' ? route.params.tab : 'open');
  const [q, setQ] = useState('');
  const [period, setPeriod] = useState<Period>('year');

  const sorted = useMemo(() => sortLetters(letters, today), [letters, today]);
  const open = sorted.filter((l) => isOpen(letterState(l, letters, today)));
  const shown = (tab === 'open' ? open : sorted.filter((l) => l.dir === tab)).filter((l) => letterMatches(l, q));

  if (!officer) {
    return (
      <Screen scroll>
        <ScreenTitle title={t('lt.title')} help="Correspondence register" />
        <Text style={styles.sub}>{t('lt.officersOnly')}</Text>
      </Screen>
    );
  }

  const y = Number(today.slice(0, 4));
  const range: Record<Period, [string, string]> = { year: [`${y}-01-01`, `${y}-12-31`], last: [`${y - 1}-01-01`, `${y - 1}-12-31`], all: ['', ''] };
  const report = (fn: typeof exportLettersPdf) => void fn(letters, vessel, range[period][0], range[period][1], today).catch((e: any) => Alert.alert(t('lt.title'), String(e?.message ?? e)));
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenTitle title={t('lt.title')} subtitle={t('lt.sub')} help="Correspondence register" />
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Letter', { id: 'new', dir: 'in' })}><Text style={styles.btnText}>{t('lt.addIn')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('Letter', { id: 'new', dir: 'out' })}><Text style={styles.btnText}>{t('lt.addOut')}</Text></TouchableOpacity>
      </View>

      <View style={styles.chips}>
        {chip(tab === 'open', t('lt.tabOpen', { n: open.length }), () => setTab('open'), 'open')}
        {chip(tab === 'in', t('lt.tabIn', { n: letters.filter((l) => l.dir === 'in').length }), () => setTab('in'), 'in')}
        {chip(tab === 'out', t('lt.tabOut', { n: letters.filter((l) => l.dir === 'out').length }), () => setTab('out'), 'out')}
      </View>
      {letters.length > 6 ? <TextInput style={styles.input} value={q} onChangeText={setQ} placeholder={t('lt.search')} placeholderTextColor={COLORS.textLight} /> : null}

      {shown.map((l) => {
        const s = letterState(l, letters, today);
        const c = l.cancelled ? COLORS.textLight : letterColor(COLORS, s);
        return (
          <TouchableOpacity key={l.id} style={[styles.item, { borderLeftColor: c }, l.cancelled ? { opacity: 0.6 } : null]} onPress={() => nav.navigate('Letter', { id: l.id })} activeOpacity={0.7}>
            <Text style={styles.name}>{`${l.no} · ${l.subject}`}</Text>
            <Text style={styles.sub}>{[`${l.dir === 'in' ? t('lt.from') : t('lt.to')} ${l.party}`, uiDate(l.date), l.ref, l.file ? '📄' : null].filter(Boolean).join(' · ')}</Text>
            {l.dir === 'in' || l.cancelled ? <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{[stateLine(l, s), l.actionBy && isOpen(s) ? t('lt.actionByShort', { who: l.actionBy }) : null].filter(Boolean).join(' · ')}</Text> : null}
          </TouchableOpacity>
        );
      })}
      {!shown.length ? <Empty text={!letters.length ? t('lt.empty') : tab === 'open' && !q ? t('lt.noneOpen') : t('lt.noneFound')} /> : null}

      {letters.length ? (
        <>
          <Text style={[styles.sub, { marginTop: 16, fontWeight: '700' }]}>{t('lt.register')}</Text>
          <View style={styles.chips}>
            {chip(period === 'year', String(y), () => setPeriod('year'), 'year')}
            {chip(period === 'last', String(y - 1), () => setPeriod('last'), 'last')}
            {chip(period === 'all', t('lt.allDates'), () => setPeriod('all'), 'all')}
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => report(exportLettersPdf)}><Text style={styles.smallText}>PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => report(exportLettersExcel)}><Text style={styles.smallText}>Excel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => report(shareLettersPdf)}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
