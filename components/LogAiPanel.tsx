// ===================================
// Voice into the logs (plan AI-8, services/logAi.ts): the officer of the watch
// or the engineer says what happened and the figures, in any language; the AI
// gives the deck log's fields and events, or the round's readings and remarks.
// "Put into the entry" fills only empty boxes and adds the remarks under the
// ones there; the entry is then checked and signed as any other.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label } from './ui';
import { VoiceInput } from './VoiceInput';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import type { WatchParam } from '../types/watchLog';
import { aiOrLater, AiJob, removeAiJob } from '../services/aiQueue';
import { applyLog, DeckField, LogAiReply, MAX_SAID, paramsForAi, readDeck, readEngine } from '../services/logAi';
import { peopleOf, scrubNames } from '../services/incidentAi';
import { fmtValue } from '../services/watchLog';
import { shipHm, shipToday } from '../utils/shipTime';
import { makeStyles } from '../screens/SafetySc';
import { currentLang, t, tk, useT } from '../utils/i18n';

const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', es: 'Spanish', uk: 'Ukrainian', no: 'Norwegian', pt: 'Portuguese' };

const DECK_LABEL: Record<DeckField, string> = {
  latDeg: 'de.cLat', latMin: 'de.cLat', latHem: 'de.cLat', lonDeg: 'de.cLon', lonMin: 'de.cLon', lonHem: 'de.cLon',
  courseGyro: 'de.cGyro', courseMagnetic: 'de.cMag', speed: 'de.cSpd', distanceRun: 'de.cLog', rpm: 'de.cRpm',
  engLoadPort: 'de.cPort', engLoadStbd: 'de.cStbd', windDir: 'de.cWindDir', windBft: 'de.cBeaufort', seaState: 'de.cSeaState',
  visibility: 'de.cVisibility', pressure: 'de.cPres', tempAir: 'de.cAir', wxCondition: 'de.cConditions',
};

/** The deck draft as lines to read: the position as one line, the rest one field a line. */
function deckLines(v: Record<string, string>): { key: string; label: string; text: string; fields: string[] }[] {
  const out: { key: string; label: string; text: string; fields: string[] }[] = [];
  const pos = (deg: string, min: string, hem: string, pad: number) => (v[deg] ? `${v[deg].padStart(pad, '0')}°${v[min] ? `${Number(v[min]).toFixed(1)}'` : ''}${v[hem] ?? ''}` : '');
  const lat = pos('latDeg', 'latMin', 'latHem', 2);
  const lon = pos('lonDeg', 'lonMin', 'lonHem', 3);
  if (lat) out.push({ key: 'lat', label: t('de.cLat'), text: lat, fields: ['latDeg', 'latMin', 'latHem'] });
  if (lon) out.push({ key: 'lon', label: t('de.cLon'), text: lon, fields: ['lonDeg', 'lonMin', 'lonHem'] });
  for (const [k, val] of Object.entries(v)) {
    if (/^(lat|lon)/.test(k)) continue;
    out.push({ key: k, label: tk(DECK_LABEL[k as DeckField]), text: k === 'visibility' ? tk(`de.vis.${val}`) : val, fields: [k] });
  }
  return out;
}

export function LogAiPanel({ kind, mode = 'sea', params, form, remarks, onApply, target, waited, waitedIds, jobId }: {
  kind: 'deck' | 'engine';
  mode?: 'sea' | 'port';
  /** engine: the round's readings. */
  params?: WatchParam[];
  /** What the boxes hold now: deck field → text, or reading id → text. */
  form: Record<string, string>;
  remarks: string;
  onApply: (values: Record<string, string>, remarks: string, time?: string) => void;
  /** Where a draft that waits for a connection opens again (services/aiQueue.ts). */
  target: AiJob['target'];
  waited?: LogAiReply;
  waitedIds?: string[];
  jobId?: string;
}) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { crew } = useData();
  const [said, setSaid] = useState('');
  const [reply, setReply] = useState<{ r: LogAiReply; ids: string[]; mode: 'sea' | 'port' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const people = useMemo(() => peopleOf({ crew }), [crew]);
  const scrubbed = useMemo(() => scrubNames(said.slice(0, MAX_SAID), people), [said, people]);

  // A draft that waited for a connection opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || taken.current) return;
    taken.current = true;
    setReply({ r: waited, ids: waitedIds ?? [], mode });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  const read = useMemo(() => {
    if (!reply) return null;
    return kind === 'engine' ? readEngine(reply.r, params ?? [], reply.ids) : readDeck(reply.r, reply.mode);
  }, [reply, kind, params]);
  const byId = useMemo(() => new Map((params ?? []).map((p) => [p.id, p])), [params]);

  const start = async () => {
    if (scrubbed.text.trim().length < 3) return Alert.alert(t('lai.title'), t('lai.tooShort'));
    setBusy(true);
    setNote(null);
    try {
      const sent = kind === 'engine' ? paramsForAi(params ?? []) : { params: [], ids: [] as string[] };
      const input = {
        kind, said: scrubbed.text, today: shipToday(), time: shipHm(), lang: LANG_NAME[currentLang()],
        ...(kind === 'engine' ? { params: sent.params } : { mode }),
      };
      const out = await aiOrLater<LogAiReply>('log', input, {
        label: scrubbed.text.slice(0, 80),
        target: { ...target, kind, date: shipToday(), time: shipHm(), mode, listIds: sent.ids },
      });
      if ('queued' in out) setNote(t('lai.queued'));
      else setReply({ r: out.result, ids: sent.ids, mode });
    } catch (e: any) {
      Alert.alert(t('lai.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    if (!read) return;
    const res = applyLog(form, remarks, read);
    const time = read.time;
    onApply(res.values, res.remarks, time);
    setReply(null);
    setSaid('');
    setNote(res.kept ? t('lai.usedKept', { n: res.kept }) : t('lai.used'));
  };

  // What the box already holds and the AI says otherwise: shown, and kept.
  const differs = (fields: string[]) => fields.some((f) => (form[f] ?? '').trim() && read && read.values[f] !== undefined && form[f].trim() !== read.values[f]);
  const lines = read
    ? kind === 'engine'
      ? Object.entries(read.values).map(([id, v]) => ({ key: id, label: byId.get(id)?.name ?? id, text: byId.get(id) ? fmtValue(byId.get(id)!, v) : v, fields: [id] }))
      : deckLines(read.values)
    : [];

  return (
    <Card>
      <Label>{t('lai.title')}</Label>
      <Text style={styles.sub}>{t(kind === 'engine' ? 'lai.introEngine' : 'lai.introDeck')}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.xs }}>
        <TextInput style={[styles.input, { flex: 1, minHeight: 70 }]} value={said} onChangeText={setSaid} multiline placeholder={t(kind === 'engine' ? 'lai.phEngine' : 'lai.phDeck')} placeholderTextColor={COLORS.textLight} />
        <View style={{ marginTop: SIZES.sm }}><VoiceInput onText={(v) => setSaid((x) => (x ? `${x} ${v}` : v))} /></View>
      </View>
      {scrubbed.replaced ? <Text style={styles.sub}>{t('inc.names', { n: scrubbed.replaced })}</Text> : null}
      <View style={[styles.row, { gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void start()}>
          <Text style={styles.smallText}>{busy ? t('lai.working') : t('lai.go')}</Text>
        </TouchableOpacity>
        {read ? <TouchableOpacity onPress={() => setReply(null)}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{note}</Text> : null}

      {read ? (
        <>
          <View style={[styles.item, { borderLeftColor: COLORS.primary, marginTop: SIZES.sm }]}>
            {read.time ? <Text style={styles.sub}>{`${t('de.cTime')}: ${read.time}`}</Text> : null}
            {lines.map((l) => (
              <Text key={l.key} style={[styles.sub, differs(l.fields) && { color: COLORS.warning }]}>
                {`${l.label}: ${l.text}${differs(l.fields) ? ` — ${t('lai.yours')}` : ''}`}
              </Text>
            ))}
            {read.remarks ? <Text style={[styles.body, { marginTop: SIZES.xs }]}>{read.remarks}</Text> : null}
            {!lines.length && !read.remarks ? <Text style={styles.sub}>{t('lai.nothing')}</Text> : null}
          </View>
          {read.unclear.length ? (
            <>
              <Text style={[styles.sub, { fontWeight: '700', marginTop: SIZES.sm }]}>{t('lai.unclear')}</Text>
              {read.unclear.map((m, i) => <Text key={i} style={styles.sub}>{`• ${m}`}</Text>)}
            </>
          ) : null}
          {read.dropped ? <Text style={styles.sub}>{t('lai.dropped', { n: read.dropped })}</Text> : null}
          <Text style={styles.sub}>{t('lai.check')}</Text>
          {lines.length || read.remarks ? (
            <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={use}>
              <Text style={styles.smallText}>{t('lai.use')}</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
