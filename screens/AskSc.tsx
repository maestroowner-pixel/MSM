// ===================================
// Ask ISM AI Pilot (AI no. 3, 14 Oct 2026): a question in plain words — "what
// expires next month?", "when was the last enclosed space drill?" — answered
// from the vessel's own records (services/aiContext; no patients, no guests),
// with the lines it used. Questions and answers live on this screen only.
// ===================================

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { VoiceInput } from '../components/VoiceInput';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { moduleOn } from '../constants/modules';
import { CATEGORY_MAP } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { CategoryKey } from '../types/equipment';
import { personName } from '../types/role';
import { buildBoard } from '../services/board';
import { todayIso } from '../services/pms';
import { nowLocal } from '../services/permits';
import { aiReady } from '../services/ai';
import { aiOrLater, removeAiJob, useAiJobs } from '../services/aiQueue';
import { ASK_EXAMPLES, askContext } from '../services/aiContext';
import { goBackOr } from '../utils/nav';
import { uiDateTime } from '../utils/dates';
import { makeStyles } from './SafetySc';

import { t, t as tt, useT } from '../utils/i18n';

type Turn = { q: string; a?: string; refs?: string[]; error?: string };

export default function AskSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  const sync = useSync();
  const [q, setQ] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [openRefs, setOpenRefs] = useState<number | null>(null);
  const jobs = useAiJobs();
  const role = !sync.enrolled ? 'superadmin' : (sync.role as 'user' | 'admin' | 'superadmin');
  const labelOf = (k: string) => data.categories.find((c) => c.key === k)?.label ?? CATEGORY_MAP[k as CategoryKey]?.label ?? k;

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ('');
    setTurns((t) => [...t, { q: text }]);
    setBusy(true);
    try {
      const me = sync.me ? { key: `device:${sync.me.id}`, name: personName(sync.me) } : null;
      const board = buildBoard({ on: moduleOn, role, me, today: todayIso(), now: nowLocal(), labelOf: labelOf as any, periodsOf: (k: CategoryKey) => periodsFor(k, data.templates), ...data });
      const context = askContext({ vesselName: data.vessel?.vessel_name, today: todayIso(), board, flat: data.flat, labelOf, certificates: data.certificates, inspections: data.inspections, crew: data.crew, drills: data.drills });
      const out = await aiOrLater<{ answer?: string; refs?: string[] }>('ask', { question: text, context, today: todayIso(), role: role === 'superadmin' ? 'Master' : role === 'admin' ? 'officer' : 'crew' }, { label: text });
      // It went to the list above; it will be answered there.
      if ('queued' in out) {
        setTurns((t) => t.slice(0, -1));
        return;
      }
      const res = out.result;
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a: res.answer ?? '—', refs: res.refs ?? [] } : x)));
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: msg === 'ai.tooBig' ? tt('ai.tooBig') : msg } : x)));
    } finally {
      setBusy(false);
    }
  };

  if (!aiReady(sync.enrolled)) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title={t('ask.title')} subtitle={t('ask.subShort')} />
        <Text style={styles.sub}>{t('ask.needSync')}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={t('ask.title')} subtitle={t('ask.sub')} />
      {jobs.map((j) => (
        <Card key={j.id} style={{ marginBottom: SIZES.sm }}>
          <Text style={[styles.body, { fontWeight: '700' }]}>{j.task === 'cert' ? t('ai.certJob', { what: j.label }) : j.task === 'readiness' ? t('ai.readyJob', { what: j.label }) : j.task === 'quote' ? t('ai.quoteJob', { what: j.label }) : j.task === 'invoice' ? t('ai.invoiceJob', { what: j.label }) : j.label}</Text>
          <Text style={styles.sub}>{t(`ai.${j.status}`)} · {uiDateTime(j.at)}</Text>
          {j.task === 'ask' && j.result?.answer ? <Text style={[styles.body, { lineHeight: 21, marginTop: SIZES.xs }]}>{j.result.answer}</Text> : null}
          {j.task === 'ask' && j.result?.answer ? <Text style={styles.sub}>{t('ai.asOf')}</Text> : null}
          {j.error && j.status === 'failed' ? <Text style={[styles.sub, { color: COLORS.danger }]}>{j.error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.xs }}>
            {j.task === 'cert' && j.status === 'done' ? (
              <TouchableOpacity onPress={() => nav.navigate('CertificateDetail', { id: j.target?.certId, draft: j.target?.draft, aiResult: j.result, aiJob: j.id })}><Text style={styles.link}>{t('ai.open')}</Text></TouchableOpacity>
            ) : null}
            {j.task === 'readiness' && j.status === 'done' ? (
              <TouchableOpacity onPress={() => nav.navigate('Main', { screen: 'Readiness', params: { kind: j.target?.kind, date: j.target?.date, aiResult: j.result, aiJob: j.id } })}><Text style={styles.link}>{t('ai.openPlan')}</Text></TouchableOpacity>
            ) : null}
            {j.task === 'quote' && j.status === 'done' ? (
              <TouchableOpacity onPress={() => nav.navigate('Quote', { po: j.target?.po, id: j.target?.quoteId, aiResult: j.result, aiLines: j.target?.lineIds, aiJob: j.id })}><Text style={styles.link}>{t('ai.open')}</Text></TouchableOpacity>
            ) : null}
            {j.task === 'invoice' && j.status === 'done' ? (
              <TouchableOpacity onPress={() => nav.navigate('Order', { id: j.target?.po, aiInvoice: j.result, aiLines: j.target?.lineIds, aiJob: j.id })}><Text style={styles.link}>{t('ai.open')}</Text></TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => void removeAiJob(j.id)}><Text style={styles.link}>{t(j.status === 'waiting' ? 'common.cancel' : 'ai.dismiss')}</Text></TouchableOpacity>
          </View>
        </Card>
      ))}
      {!turns.length ? (
        <View style={[styles.chips, { marginBottom: SIZES.sm }]}>
          {ASK_EXAMPLES.map((x) => (
            <TouchableOpacity key={x} style={styles.chip} onPress={() => void ask(x)}><Text style={styles.chipText}>{x}</Text></TouchableOpacity>
          ))}
        </View>
      ) : null}
      {turns.map((t, i) => (
        <View key={i} style={{ marginBottom: SIZES.md }}>
          <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: COLORS.primary, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: COLORS.textWhite, fontSize: SIZES.body }}>{t.q}</Text>
          </View>
          <Card style={{ marginTop: SIZES.xs }}>
            {t.a ? <Text style={[styles.body, { lineHeight: 21 }]}>{t.a}</Text> : t.error ? <Text style={[styles.body, { color: COLORS.danger }]}>{t.error}</Text> : <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ActivityIndicator color={COLORS.primary} /><Text style={styles.sub}>{tt('ask.reading')}</Text></View>}
            {t.refs?.length ? (
              <TouchableOpacity onPress={() => setOpenRefs(openRefs === i ? null : i)}><Text style={[styles.link, { marginTop: SIZES.xs }]}>{openRefs === i ? tt('ask.hideRefs') : tt('ask.fromRefs', { n: t.refs.length })}</Text></TouchableOpacity>
            ) : null}
            {openRefs === i ? t.refs!.map((r, k) => <Text key={k} style={styles.sub}>{r}</Text>) : null}
          </Card>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextInput style={[styles.input, { flex: 1, minWidth: 220, marginTop: 0 }]} value={q} onChangeText={setQ} onSubmitEditing={() => void ask(q)} placeholder={t('ask.placeholder')} placeholderTextColor={COLORS.textLight} returnKeyType="send" />
        <VoiceInput onText={(t) => setQ((x) => (x ? `${x} ${t}` : t))} />
        <TouchableOpacity style={[styles.btn, { marginTop: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => void ask(q)}>
          <MciIcon name="send" size={16} color={COLORS.textWhite} />
          <Text style={styles.btnText}>{t('ask.ask')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('ask.foot')}</Text>
    </Screen>
  );
}
