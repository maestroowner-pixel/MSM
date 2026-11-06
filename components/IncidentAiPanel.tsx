// ===================================
// Draft an NC from what happened (plan AI-4, services/incidentAi.ts): typed or
// said, in any language. Names go to the AI as ranks. The draft fills only the
// NC's empty fields and the ticked actions; the officer reads it, corrects it,
// and raises or saves the NC as any other. Past NCs that look alike are shown
// as links, nothing is copied from them.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { VoiceInput } from './VoiceInput';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { CAPA_KIND_LABEL, NC_GRADE_LABEL, NC_SOURCE_LABEL, NonConformity, OBS_KIND_LABEL, SafetyObservation } from '../types/safety';
import { aiOrLater, removeAiJob } from '../services/aiQueue';
import { applyIncident, IncidentAiReply, MAX_ACCOUNT, pastForAi, peopleOf, readIncident, scrubNames } from '../services/incidentAi';
import { todayIso } from '../services/pms';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { makeStyles } from '../screens/SafetySc';
import { currentLang, t, useT } from '../utils/i18n';

const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', es: 'Spanish', uk: 'Ukrainian', no: 'Norwegian', pt: 'Portuguese' };

export function IncidentAiPanel({ nc, isNew, obs, onApply, waited, waitedNcs, jobId }: {
  nc: NonConformity;
  isNew: boolean;
  obs?: SafetyObservation;
  onApply: (next: NonConformity) => void;
  waited?: IncidentAiReply;
  waitedNcs?: string[];
  jobId?: string;
}) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { ncs, crew, passengers, medTreatments } = useData();
  const today = todayIso();
  const [account, setAccount] = useState(() => (obs ? [obs.what, obs.action ? `Done on the spot: ${obs.action}` : ''].filter(Boolean).join('\n') : ''));
  const [reply, setReply] = useState<{ r: IncidentAiReply; ids: string[] } | null>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const people = useMemo(() => peopleOf({ crew, passengers, medTreatments }), [crew, passengers, medTreatments]);
  const scrubbed = useMemo(() => scrubNames(account.slice(0, MAX_ACCOUNT), people), [account, people]);

  // A draft that waited for a connection (services/aiQueue.ts) opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || taken.current) return;
    taken.current = true;
    setReply({ r: waited, ids: waitedNcs ?? [] });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  const read = useMemo(() => (reply ? readIncident(reply.r, ncs, reply.ids, today) : null), [reply, ncs, today]);
  const picked = read ? read.actions.filter((a) => !off[a.id]) : [];

  const start = async () => {
    if (scrubbed.text.trim().length < 15) return Alert.alert(t('inc.title'), t('inc.tooShort'));
    setBusy(true);
    setNote(null);
    try {
      const { past, ids } = pastForAi(ncs, people, nc.id);
      const out = await aiOrLater<IncidentAiReply>('incident', { account: scrubbed.text, today, past, lang: LANG_NAME[currentLang()], ...(obs ? { card: OBS_KIND_LABEL[obs.kind] } : {}) }, {
        label: scrubbed.text.slice(0, 80),
        target: { ncId: isNew ? 'new' : nc.id, ...(obs ? { obsId: obs.id } : {}), ncIds: ids },
      });
      if ('queued' in out) setNote(t('ai.queued'));
      else {
        setOff({});
        setReply({ r: out.result, ids });
      }
    } catch (e: any) {
      Alert.alert(t('inc.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    if (!read) return;
    const { nc: next, kept } = applyIncident(nc, read, picked, { kind: isNew && !obs }, uid);
    onApply(next);
    setReply(null);
    setOff({});
    setNote(kept ? t('inc.usedKept', { n: kept }) : t('inc.used'));
  };

  const line = (label: string, v?: string) => (v ? <Text style={styles.sub}>{`${label}: ${v}`}</Text> : null);

  return (
    <Card>
      <Label>{t('inc.title')}</Label>
      <Text style={styles.sub}>{t('inc.intro')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.xs }}>
        <TextInput style={[styles.input, { flex: 1, minHeight: 90 }]} value={account} onChangeText={setAccount} multiline placeholder={t('inc.ph')} placeholderTextColor={COLORS.textLight} />
        <View style={{ marginTop: SIZES.sm }}><VoiceInput onText={(v) => setAccount((x) => (x ? `${x} ${v}` : v))} /></View>
      </View>
      {scrubbed.replaced ? <Text style={styles.sub}>{t('inc.names', { n: scrubbed.replaced })}</Text> : null}
      <View style={[styles.row, { gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void start()}>
          <Text style={styles.smallText}>{busy ? t('inc.drafting') : read ? t('inc.again') : t('inc.draft')}</Text>
        </TouchableOpacity>
        {read ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{note}</Text> : null}

      {read ? (
        <>
          <View style={[styles.item, { borderLeftColor: COLORS.primary, marginTop: SIZES.sm }]}>
            {read.title ? <Text style={styles.name}>{read.title}</Text> : null}
            {isNew && !obs && (read.source || read.grade) ? <Text style={styles.sub}>{[read.grade ? NC_GRADE_LABEL[read.grade] : '', read.source ? NC_SOURCE_LABEL[read.source] : ''].filter(Boolean).join(' · ')}</Text> : null}
            {read.what ? <Text style={styles.body}>{read.what}</Text> : null}
            {line(t('nc.where'), read.where)}
            {line(t('nc.requirement'), read.requirement)}
            {line(t('nc.rootCause'), read.rootCause)}
          </View>

          {read.actions.length ? <Text style={[styles.sub, { fontWeight: '700', marginTop: SIZES.sm }]}>{t('inc.actions')}</Text> : null}
          {read.actions.map((a) => {
            const on = !off[a.id];
            return (
              <TouchableOpacity key={a.id} activeOpacity={0.7} onPress={() => setOff((cur) => ({ ...cur, [a.id]: on }))} style={[styles.item, { borderLeftColor: on ? COLORS.success : COLORS.border, marginTop: SIZES.xs }]}>
                <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 18 }}>{on ? '☑' : '☐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{`${CAPA_KIND_LABEL[a.kind]}: ${a.text}`}</Text>
                    <Text style={styles.sub}>{`${a.owner} · by ${uiDate(a.due)}`}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {read.similar.length ? (
            <>
              <Text style={[styles.sub, { fontWeight: '700', marginTop: SIZES.sm }]}>{t('inc.similar')}</Text>
              {read.similar.map((s) => (
                <TouchableOpacity key={s.nc.id} onPress={() => nav.push('Nc', { id: s.nc.id })}>
                  <Text style={styles.link}>{`→ ${s.nc.no} ${s.nc.title} · ${uiDate(s.nc.date)}${s.nc.closedAt ? '' : ` · ${t('inc.open')}`}`}</Text>
                  {s.why ? <Text style={styles.sub}>{s.why}</Text> : null}
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          {read.missing.length ? (
            <>
              <Text style={[styles.sub, { fontWeight: '700', marginTop: SIZES.sm }]}>{t('inc.missing')}</Text>
              {read.missing.map((m, i) => <Text key={i} style={styles.sub}>{`• ${m}`}</Text>)}
            </>
          ) : null}

          <Text style={styles.sub}>{t('inc.check')}</Text>
          <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={use}>
            <Text style={styles.smallText}>{t('inc.use', { n: picked.length })}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </Card>
  );
}
