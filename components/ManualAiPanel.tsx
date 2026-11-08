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
import { libraryForget, libraryLookup } from '../services/ai';
import { LibraryEntry, asManualReply, entryName, libraryFile, pairOf } from '../services/makerLibrary';
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
  const [reply, setReply] = useState<{ r: ManualAiReply; jobs: string[]; file?: string; lib?: boolean } | null>(null);
  // The makers' library (plan item 54): this maker and model read from a manual on any vessel.
  const pair = pairOf(machine);
  const [lib, setLib] = useState<LibraryEntry | null>(null);
  useEffect(() => {
    setLib(null);
    if (!pair) return;
    let live = true;
    libraryLookup([pair]).then((r) => live && setLib(r[pair] ?? null)).catch(() => {});
    return () => {
      live = false;
    };
  }, [pair]);
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

  const read = useMemo(
    () => (reply ? readManual(machine, pmsJobs, reply.r, reply.jobs, { untickNew: !!reply.lib && jobKeyIds(machine.id, pmsJobs).length > 0 }) : null),
    [machine, pmsJobs, reply]
  );
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
      // The read went into the library if it is for this model: ask it again next time.
      libraryForget(pair);
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
      const how = reply?.lib ? 'from the makers\' library, checked' : 'read by the AI, checked';
      return diff.length ? { ...j, changes: withChanges(was?.changes, diff, who, `${makerNote({ page: p.page }, reply?.file)} — ${how}`, now) } : j;
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
          <Text style={styles.smallText}>{busy ? t('rfq.aiReading') : read && !reply?.lib ? t('man.another') : t('man.read')}</Text>
        </TouchableOpacity>
        {lib && !reply?.lib ? (
          <TouchableOpacity style={styles.small} disabled={busy} onPress={() => { setOff({}); setNote(null); setReply({ r: asManualReply(lib), jobs: [], file: libraryFile(lib), lib: true }); }}>
            <Text style={styles.smallText}>{t('man.libCompare')}</Text>
          </TouchableOpacity>
        ) : null}
        {read ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {lib && !read ? <Text style={styles.sub}>{t('man.libHas', { name: entryName(lib), jobs: tn('n.job', lib.jobs.length), vessels: tn('n.vessel', lib.vessels) })}</Text> : null}
      {reply?.lib && lib ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{t('man.libFrom', { name: entryName(lib) })}</Text> : null}
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
