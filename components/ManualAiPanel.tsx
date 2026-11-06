// ===================================
// Jobs from the maker's manual (plan AI-3, services/manualAi.ts): the AI reads
// the manual's maintenance schedule for this machine; the plan's keeper ticks
// what to add or change, and only then is anything saved. A change of interval
// goes into the job's change log with the manual as the reason, like any other.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { Card, Label } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { Machine } from '../types/pms';
import { personName } from '../types/role';
import { aiOrLater, removeAiJob } from '../services/aiQueue';
import { pickDocForAi } from '../services/medFiles';
import { applyManual, jobKeyIds, jobsForAi, machineForAi, makerNote, ManualAiReply, readManual } from '../services/manualAi';
import { scheduleLabel } from '../services/pms';
import { JOB_FIELDS, planDiff, withChanges } from '../services/planLog';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';
import { t, tn, useT } from '../utils/i18n';

const every = (p: { hours?: number; days?: number }) => scheduleLabel({ intervalHours: p.hours, intervalDays: p.days });

export function ManualAiPanel({ machine, waited, waitedJobs, waitedFile, jobId }: { machine: Machine; waited?: ManualAiReply; waitedJobs?: string[]; waitedFile?: string; jobId?: string }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { pmsJobs, savePlan } = useData();
  const sync = useSync();
  const [reply, setReply] = useState<{ r: ManualAiReply; jobs: string[]; file?: string } | null>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // A manual that waited for a connection (services/aiQueue.ts) opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || taken.current) return;
    taken.current = true;
    setReply({ r: waited, jobs: waitedJobs ?? jobKeyIds(machine.id, pmsJobs), file: waitedFile });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  const read = useMemo(() => (reply ? readManual(machine, pmsJobs, reply.r, reply.jobs) : null), [machine, pmsJobs, reply]);
  // A tick is the proposal's own until the person changes it.
  const ticked = (id: string, pick: boolean) => (id in off ? !off[id] : pick);
  const picked = read ? read.proposals.filter((p) => ticked(p.id, p.pick)) : [];

  const start = async () => {
    const f = await pickDocForAi();
    if (!f) return;
    setBusy(true);
    setNote(null);
    try {
      const comma = f.dataUri.indexOf(',');
      const jobs = jobKeyIds(machine.id, pmsJobs);
      const out = await aiOrLater<ManualAiReply>('manual', { mediaType: f.dataUri.slice(5, f.dataUri.indexOf(';')), data: f.dataUri.slice(comma + 1), machine: machineForAi(machine), jobs: jobsForAi(machine.id, pmsJobs) }, {
        label: `${machine.name} · ${f.name}`,
        target: { machineId: machine.id, jobIds: jobs, file: f.name },
      });
      if ('queued' in out) setNote(t('ai.queued'));
      else {
        setOff({});
        setReply({ r: out.result, jobs, file: f.name });
      }
    } catch (e: any) {
      Alert.alert(t('man.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!read || !picked.length) return;
    const now = Date.now();
    const { add: fresh, change } = applyManual(machine, pmsJobs, picked, reply?.file, uid, now);
    const me = sync.me ? personName(sync.me) : '';
    const who = { by: me || 'Master', ...(sync.me?.position ? { byRank: sync.me.position } : {}) };
    // The change log as PmsJobSc writes it: the manual is the reason.
    const logged = change.map((j) => {
      const was = pmsJobs.find((x) => x.id === j.id);
      const p = picked.find((x) => x.jobId === j.id)!;
      const diff = planDiff(was, j, JOB_FIELDS);
      return diff.length ? { ...j, changes: withChanges(was?.changes, diff, who, `${makerNote({ page: p.page }, reply?.file)} — read by the AI, checked`, now) } : j;
    });
    await savePlan([], [...fresh, ...logged]);
    playSuccessSound();
    setReply(null);
    setOff({});
    setNote(t('man.added', { a: fresh.length, c: logged.length }));
  };

  return (
    <Card style={{ marginTop: SIZES.md }}>
      <Label>{t('man.title')}</Label>
      <Text style={styles.sub}>{t('man.intro')}</Text>
      <View style={[styles.row, { gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void start()}>
          <Text style={styles.smallText}>{busy ? t('rfq.aiReading') : read ? t('man.another') : t('man.read')}</Text>
        </TouchableOpacity>
        {read ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{note}</Text> : null}

      {read ? (
        <>
          {read.covers !== 'yes' ? (
            <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>
              {read.covers === 'no'
                ? t('man.coversNo', { model: read.model || '—', mine: [machine.maker, machine.model].filter(Boolean).join(' ') || machine.name })
                : read.model ? t('man.coversUnclear', { model: read.model }) : t('man.coversUnknown')}
            </Text>
          ) : read.model ? <Text style={styles.sub}>{t('man.forModel', { model: read.model })}</Text> : null}
          {!read.proposals.length ? <Text style={[styles.sub, { fontWeight: '700' }]}>{read.same ? t('man.nothingNew') : t('man.none')}</Text> : null}

          {read.proposals.map((p) => {
            const on = ticked(p.id, p.pick);
            return (
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.7}
                onPress={() => setOff((cur) => ({ ...cur, [p.id]: on }))}
                style={[styles.item, { borderLeftColor: on ? COLORS.success : COLORS.border, marginTop: SIZES.xs }]}
              >
                <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 18 }}>{on ? '☑' : '☐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{p.title}</Text>
                    <Text style={styles.sub}>
                      {p.jobId ? t('man.change', { was: every(p.was ?? {}), now: every(p) }) : `${t('man.new')} · ${every(p)}`}
                      {p.page ? ` · ${t('man.page', { p: p.page })}` : ''}
                    </Text>
                    {p.parts ? <Text style={styles.sub}>{p.parts}</Text> : null}
                    {p.daily ? <Text style={styles.sub}>{t('man.daily')}</Text> : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}

          {read.same ? <Text style={styles.sub}>{t('man.same', { x: tn('n.job', read.same) })}</Text> : null}
          {read.noInterval.length ? <Text style={styles.sub}>{t('man.noInterval', { n: read.noInterval.length, what: read.noInterval.slice(0, 4).join('; ') })}</Text> : null}
          {read.unreadable ? <Text style={styles.sub}>{t('man.remark', { what: read.unreadable })}</Text> : null}
          {read.proposals.length ? (
            <>
              <Text style={styles.sub}>{t('man.check')}</Text>
              <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }, !picked.length && { opacity: 0.4 }]} disabled={!picked.length} onPress={() => void add()}>
                <Text style={styles.smallText}>{t('man.add', { n: picked.length })}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
