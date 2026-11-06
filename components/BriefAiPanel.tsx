// ===================================
// The AI's brief (plan AI-7, services/briefAi.ts): on the handover, what the
// relief needs most; on the monthly digest, the Master's note to the office.
// The draft is shown with the list lines each point stands on; "Put into the
// brief" copies it into the field the writer edits — nothing goes on the PDF
// or with the mail until they do.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';
import { aiOrLater, removeAiJob } from '../services/aiQueue';
import { BriefAiReply, BriefFor, BriefInput, BriefPoint, briefText, readBrief } from '../services/briefAi';
import { AiGap } from '../services/readinessAi';
import { makeStyles } from '../screens/SafetySc';
import { t, useT } from '../utils/i18n';

export function BriefAiPanel({ kind, build, label, month, current, onPut, waited, waitedGaps, jobId }: {
  kind: BriefFor;
  /** What goes to the AI now, and how many names became ranks. */
  build: () => { input: BriefInput; replaced: number };
  /** What the Ask list calls it while it waits. */
  label: string;
  month?: string;
  /** What the field holds now: replacing it asks first. */
  current: string;
  onPut: (text: string, points: BriefPoint[]) => void;
  waited?: BriefAiReply;
  waitedGaps?: AiGap[];
  jobId?: string;
}) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [reply, setReply] = useState<{ r: BriefAiReply; gaps: AiGap[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // A brief that waited for a connection (services/aiQueue.ts) opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || taken.current) return;
    taken.current = true;
    setReply({ r: waited, gaps: waitedGaps ?? [] });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  const points = useMemo(() => (reply ? readBrief(reply.r, reply.gaps) : null), [reply]);

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { input, replaced } = build();
      const out = await aiOrLater<BriefAiReply>('brief', input, { label, target: { kind, gaps: input.gaps, ...(month ? { month } : {}) } });
      if ('queued' in out) setNote(t('ai.queued'));
      else {
        setReply({ r: out.result, gaps: input.gaps });
        if (replaced) setNote(t('brief.replaced', { n: replaced }));
      }
    } catch (e: any) {
      Alert.alert(t('brief.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const put = () => {
    if (!points?.length) return;
    const go = () => {
      onPut(briefText(points), points);
      setReply(null);
      setNote(null);
    };
    if (!current.trim()) return go();
    Alert.alert(t('brief.replaceQ'), t('brief.replaceBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('brief.replace'), onPress: go },
    ]);
  };

  return (
    <View style={{ marginBottom: SIZES.sm }}>
      <View style={[styles.row, { gap: SIZES.md, flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void start()}>
          <Text style={styles.smallText}>{busy ? t('brief.reading') : points ? t('brief.again') : t('brief.go')}</Text>
        </TouchableOpacity>
        {points ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{note}</Text> : null}
      {points ? (
        <View style={{ marginTop: SIZES.sm }}>
          {points.length ? points.map((p, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.name}>{`${i + 1}. ${p.text}`}</Text>
              <Text style={styles.sub}>{p.from === 'list' ? p.lines.join(' · ') : t(p.from === 'notes' ? 'brief.fromNotes' : 'brief.fromFacts')}</Text>
            </View>
          )) : <Text style={styles.sub}>{t('brief.none')}</Text>}
          <Text style={[styles.sub, { marginTop: SIZES.xs }]}>{t('brief.english')}</Text>
          {points.length ? (
            <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={put}>
              <Text style={styles.smallText}>{t('brief.put')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
