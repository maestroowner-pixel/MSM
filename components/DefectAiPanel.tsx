// ===================================
// Diagnose a machinery defect (plan AI-6, services/defectAi.ts): the AI reads
// the open defect against the machine's own records — earlier defects (its
// sister units' too), work signed, jobs, spares, oil — and says what to check
// first. Guidance only: nothing is saved here. The plan's keeper may turn the
// checks into a one-off job, which opens on the job screen to be read and saved.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { VoiceInput } from './VoiceInput';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { Machine, PmsDefect } from '../types/pms';
import { moduleOn } from '../constants/modules';
import { aiOrLater, removeAiJob } from '../services/aiQueue';
import { checksAsNotes, DefectAiKeys, DefectAiReply, defectForAi, faultJobTitle, MAX_SEEN, readDiagnosis, Ref } from '../services/defectAi';
import { peopleOf } from '../services/incidentAi';
import { pickDocForAi, PickedMedFile } from '../services/medFiles';
import { todayIso } from '../services/pms';
import { stockByPart } from '../services/spares';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { makeStyles } from '../screens/SafetySc';
import { currentLang, t, tk, useT } from '../utils/i18n';

const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', es: 'Spanish', uk: 'Ukrainian', no: 'Norwegian', pt: 'Portuguese' };

export function DefectAiPanel({ defect, machine, canPlan, waited, waitedKeys, jobId }: {
  defect: PmsDefect;
  machine: Machine;
  canPlan: boolean;
  waited?: DefectAiReply;
  waitedKeys?: DefectAiKeys;
  jobId?: string;
}) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { machines, pmsDefects, pmsDone, pmsJobs, pmsDeferrals, spares, spareMoves, oilPoints, oilSamples, crew, passengers, medTreatments } = useData();
  const [seen, setSeen] = useState('');
  const [file, setFile] = useState<PickedMedFile | null>(null);
  const [reply, setReply] = useState<{ r: DefectAiReply; keys: DefectAiKeys } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const people = useMemo(() => peopleOf({ crew, passengers, medTreatments }), [crew, passengers, medTreatments]);
  const stock = useMemo(() => stockByPart(spareMoves), [spareMoves]);

  // A diagnosis that waited for a connection (services/aiQueue.ts) opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || !waitedKeys || taken.current) return;
    taken.current = true;
    setReply({ r: waited, keys: waitedKeys });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  const dg = useMemo(() => (reply ? readDiagnosis(reply.r, reply.keys, { defects: pmsDefects, jobs: pmsJobs, spares, stock }) : null), [reply, pmsDefects, pmsJobs, spares, stock]);

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { input, keys, replaced } = defectForAi({
        defect, machine, machines, defects: pmsDefects, done: pmsDone, jobs: pmsJobs, deferrals: pmsDeferrals,
        spares: moduleOn('spares') ? spares : [], stock,
        ...(moduleOn('oil') ? { oilPoints, oilSamples } : {}),
        people, today: todayIso(),
      }, seen);
      const comma = file ? file.dataUri.indexOf(',') : -1;
      const out = await aiOrLater<DefectAiReply>('diagnose', {
        ...input, lang: LANG_NAME[currentLang()],
        ...(file ? { mediaType: file.dataUri.slice(5, file.dataUri.indexOf(';')), data: file.dataUri.slice(comma + 1) } : {}),
      }, {
        label: `${machine.name} · ${defect.description.slice(0, 60)}`,
        target: { defectId: defect.id, defectIds: keys.defects, workIds: keys.work, jobIds: keys.jobs, partIds: keys.parts },
      });
      if (replaced) setNote(t('dga.replaced', { n: replaced }));
      if ('queued' in out) setNote(t('ai.queued'));
      else setReply({ r: out.result, keys });
    } catch (e: any) {
      Alert.alert(t('dga.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const open = (r: Ref) => {
    if (r.kind === 'defect') nav.push('PmsDefect', { id: r.id });
    else if (r.kind === 'job') nav.navigate('PmsJob', { id: r.id });
    else if (r.kind === 'part') nav.navigate('SparePart', { id: r.id });
  };
  const refLinks = (refs: Ref[]) =>
    refs.length ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm }}>
        {refs.map((r) => (r.kind === 'work' ? (
          <Text key={r.key} style={styles.sub}>{workLabel(r.id)}</Text>
        ) : (
          <TouchableOpacity key={r.key} onPress={() => open(r)}><Text style={[styles.link, { marginTop: 0 }]}>{refLabel(r)}</Text></TouchableOpacity>
        )))}
      </View>
    ) : null;
  const refLabel = (r: Ref) => {
    if (r.kind === 'defect') {
      const d = pmsDefects.find((x) => x.id === r.id);
      return d ? t('dga.refDefect', { date: uiDate(d.date) }) : r.key;
    }
    if (r.kind === 'job') return pmsJobs.find((x) => x.id === r.id)?.title ?? r.key;
    return spares.find((x) => x.id === r.id)?.name ?? r.key;
  };
  const workLabel = (id: string) => {
    const w = pmsDone.find((x) => x.id === id);
    return w ? `${w.jobTitle} · ${uiDate(w.date)}` : '';
  };

  const planJob = () => {
    if (!dg?.checks.length) return;
    nav.navigate('PmsJob', { id: uid('job'), machineId: machine.id, isNew: true, oneOff: true, defectId: defect.id, title: faultJobTitle(defect), notes: checksAsNotes(dg) });
  };

  return (
    <Card>
      <Label>{t('dga.title')}</Label>
      <Text style={styles.sub}>{t('dga.intro')}</Text>
      <TextInput
        style={[styles.input, { minHeight: 60 }]}
        value={seen}
        onChangeText={(v) => setSeen(v.slice(0, MAX_SEEN))}
        multiline
        placeholder={t('dga.seenPh')}
        placeholderTextColor={COLORS.textLight}
      />
      <View style={{ marginTop: SIZES.sm }}><VoiceInput onText={(v) => setSeen((x) => (x ? `${x} ${v}` : v).slice(0, MAX_SEEN))} /></View>
      <View style={[styles.row, { gap: SIZES.md, marginTop: SIZES.sm, flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void start()}>
          <Text style={styles.smallText}>{busy ? t('dga.reading') : dg ? t('dga.again') : t('dga.go')}</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={busy} onPress={() => void (file ? setFile(null) : pickDocForAi().then((f) => f && setFile(f)))}>
          <Text style={[styles.link, { marginTop: 0 }]}>{file ? t('dga.dropFile', { name: file.name }) : t('dga.addFile')}</Text>
        </TouchableOpacity>
        {dg ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{note}</Text> : null}

      {dg ? (
        <>
          {dg.stop ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('dga.stop', { what: dg.stop })}</Text> : null}
          {dg.summary ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{dg.summary}</Text> : null}

          {dg.causes.length ? <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dga.causes')}</Text> : null}
          {dg.causes.map((c, i) => (
            <View key={i} style={[styles.item, { borderLeftColor: c.likely === 'high' ? COLORS.danger : c.likely === 'medium' ? COLORS.warning : COLORS.border, marginTop: SIZES.xs }]}>
              <Text style={styles.name}>{`${c.cause} · ${tk(`dga.likely.${c.likely}`)}`}</Text>
              {c.why ? <Text style={styles.sub}>{c.why}</Text> : null}
              {refLinks(c.refs.filter((r) => r.kind !== 'part'))}
            </View>
          ))}

          {dg.checks.length ? <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dga.checks')}</Text> : null}
          {dg.checks.map((c, i) => (
            <View key={i} style={[styles.item, { marginTop: SIZES.xs }]}>
              <Text style={styles.name}>{`${i + 1}. ${c.step}`}</Text>
              {c.look ? <Text style={styles.sub}>{c.look}</Text> : null}
              {c.safety ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('dga.safety', { what: c.safety })}</Text> : null}
              {refLinks(c.refs.filter((r) => r.kind !== 'part'))}
            </View>
          ))}

          {dg.parts.length ? <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dga.parts')}</Text> : null}
          {dg.parts.map((p, i) => (
            <TouchableOpacity key={p.id ?? `n${i}`} disabled={!p.id} onPress={() => p.id && nav.navigate('SparePart', { id: p.id })} style={[styles.item, { borderLeftColor: p.id ? (p.low ? COLORS.danger : COLORS.success) : COLORS.border, marginTop: SIZES.xs }]}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={[styles.sub, p.low && { color: COLORS.danger, fontWeight: '700' }]}>{p.id ? t('dga.inStock', { n: p.stock ?? 0 }) : t('dga.notListed')}</Text>
              {p.why ? <Text style={styles.sub}>{p.why}</Text> : null}
            </TouchableOpacity>
          ))}

          {dg.similar.length ? <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dga.similar')}</Text> : null}
          {dg.similar.map((s) => {
            const d = pmsDefects.find((x) => x.id === s.id)!;
            return (
              <TouchableOpacity key={s.id} onPress={() => nav.push('PmsDefect', { id: s.id })} style={[styles.item, { marginTop: SIZES.xs }]}>
                <Text style={styles.name} numberOfLines={2}>{`${d.machineId !== machine.id ? `${d.machineName}: ` : ''}${d.description}`}</Text>
                <Text style={styles.sub}>{d.closed ? t('dga.fixed', { date: uiDate(d.closed.date), what: d.closed.note }) : t('dga.stillOpen', { date: uiDate(d.date) })}</Text>
                {s.why ? <Text style={styles.sub}>{s.why}</Text> : null}
              </TouchableOpacity>
            );
          })}

          {dg.jobs.length ? <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dga.jobs')}</Text> : null}
          {dg.jobs.map((j) => (
            <TouchableOpacity key={j.id} onPress={() => nav.navigate('PmsJob', { id: j.id })} style={[styles.item, { marginTop: SIZES.xs }]}>
              <Text style={styles.name}>{pmsJobs.find((x) => x.id === j.id)?.title ?? ''}</Text>
              {j.why ? <Text style={styles.sub}>{j.why}</Text> : null}
            </TouchableOpacity>
          ))}

          {dg.missing.length ? <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dga.missing')}</Text> : null}
          {dg.missing.map((q, i) => <Text key={i} style={styles.sub}>{`• ${q}`}</Text>)}

          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('dga.disclaimer')}</Text>
          {canPlan && dg.checks.length && !defect.closed ? (
            <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={planJob}>
              <Text style={styles.smallText}>{t('dga.planJob')}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
