// ===================================
// What a new revision changes (plan AI-5, services/smsAi.ts): the AI reads this
// revision against the one before and against the vessel's checklists and forms
// in the app. The officer sees what changed, the lines that now disagree (with
// the editor to open), the documents to look at, and a draft "What changed" for
// the crew — saved on the document only when the officer saves it. Nothing else
// is changed.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label } from './ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { DOC_CATEGORY_LABEL, IsmDoc } from '../types/docs';
import { personName } from '../types/role';
import { moduleOn } from '../constants/modules';
import { aiOrLater, removeAiJob } from '../services/aiQueue';
import { ensureLocalFile, toDataUri } from '../services/attachments';
import { RevInput, SmsAiReply, SmsList, changeNoteDraft, docsForAi, listsForAi, otherDocs, readSms, revText, vesselLists } from '../services/smsAi';
import { onWeb } from '../utils/fileShare';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';
import { currentLang, t, useT } from '../utils/i18n';

const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', es: 'Spanish', uk: 'Ukrainian', no: 'Norwegian', pt: 'Portuguese' };
/** A callable takes about 10 MB; two PDFs must fit together. */
const MAX_CHARS = 9_000_000;

/** A revision's PDF as the AI takes it — from the cloud, this device, or a data URI. Null for anything else. */
async function pdfForAi(uri: string | undefined, name: string | undefined): Promise<RevInput> {
  if (!uri || !/\.pdf$/i.test(name ?? '')) return null;
  let dataUri: string;
  if (/^https?:/i.test(uri) && onWeb) {
    const bytes = new Uint8Array(await (await fetch(uri)).arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    dataUri = `data:application/pdf;base64,${btoa(bin)}`;
  } else {
    const local = await ensureLocalFile(uri, name);
    dataUri = await toDataUri(local.uri, local.name);
  }
  return { mediaType: 'application/pdf', data: dataUri.slice(dataUri.indexOf(',') + 1) };
}

const size = (r: RevInput) => (!r ? 0 : 'text' in r ? r.text.length : r.data.length);

export function DocRevAiPanel({ doc, held, waited, waitedRev, waitedCompared, waitedLists, waitedDocs, jobId }: {
  doc: IsmDoc;
  /** The file this device attached and could not share yet. */
  held?: { uri: string; name: string } | null;
  waited?: SmsAiReply;
  waitedRev?: number;
  waitedCompared?: boolean;
  waitedLists?: string[];
  waitedDocs?: string[];
  jobId?: string;
}) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { docs, flat, templates, dpTemplates, watchTemplates, saveDoc } = useData();
  const sync = useSync();
  const [reply, setReply] = useState<{ r: SmsAiReply; rev: number; compared: boolean; lists: string[]; docs: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [crewNote, setCrewNote] = useState<string | null>(null);

  const lists = useMemo(() => vesselLists({ flat, templates, dpTemplates, watchTemplates, on: (m) => moduleOn(m as any) }), [flat, templates, dpTemplates, watchTemplates]);
  const others = useMemo(() => otherDocs(docs, doc.id), [docs, doc.id]);

  // An answer that waited for a connection (services/aiQueue.ts) opens here, once.
  const taken = useRef(false);
  useEffect(() => {
    if (!waited || taken.current) return;
    taken.current = true;
    setReply({ r: waited, rev: waitedRev ?? doc.revision, compared: !!waitedCompared, lists: waitedLists ?? [], docs: waitedDocs ?? [] });
    if (jobId) void removeAiJob(jobId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waited, jobId]);

  const read = useMemo(() => {
    if (!reply) return null;
    const byId = new Map<string, SmsList>(lists.map((l) => [l.id, l]));
    return readSms(reply.r, reply.lists.map((id) => byId.get(id)), reply.docs.map((id) => docs.find((d) => d.id === id)), reply.compared);
  }, [reply, lists, docs]);
  // The answer was for another revision: the document moved on since.
  const stale = !!reply && reply.rev !== doc.revision;

  useEffect(() => {
    if (read && crewNote === null) setCrewNote(changeNoteDraft(read));
  }, [read, crewNote]);

  const start = async () => {
    setBusy(true);
    setNote(null);
    try {
      const prev = doc.prev && doc.prev.revision < doc.revision ? doc.prev : undefined;
      const nowText = revText(doc);
      const now: RevInput = nowText ? { text: nowText } : await pdfForAi(doc.fileUri ?? held?.uri, doc.fileName ?? held?.name).catch(() => null);
      if (!now) return Alert.alert(t('dra.title'), t('dra.noNow'));
      const beforeText = prev ? revText(prev) : null;
      const before: RevInput = prev ? (beforeText ? { text: beforeText } : await pdfForAi(prev.fileUri, prev.fileName).catch(() => null)) : null;
      if (size(now) + size(before) > MAX_CHARS) return Alert.alert(t('dra.title'), t('ai.tooBig'));
      const sent = listsForAi(lists);
      const sentDocs = docsForAi(others);
      const meta = { rev: doc.revision, compared: !!before, lists: lists.map((l) => l.id), docs: others.map((d) => d.id) };
      const out = await aiOrLater<SmsAiReply>('sms', {
        now,
        ...(before ? { before } : {}),
        doc: { docNo: doc.docNo, title: doc.title, kind: DOC_CATEGORY_LABEL[doc.category], revNow: doc.revision, ...(prev ? { revBefore: prev.revision } : {}) },
        lists: sent,
        docs: sentDocs,
        lang: LANG_NAME[currentLang()],
      }, {
        label: `${[doc.docNo, doc.title].filter(Boolean).join(' ')} · Rev ${doc.revision}`,
        target: { docId: doc.id, rev: meta.rev, compared: meta.compared, listIds: meta.lists, docIds: meta.docs },
      });
      if ('queued' in out) setNote(t('ai.queued'));
      else {
        setCrewNote(null);
        setReply({ r: out.result, ...meta });
        if (prev && !before) setNote(t('dra.noBefore', { n: prev.revision }));
      }
    } catch (e: any) {
      Alert.alert(t('dra.title'), e?.message === 'ai.tooBig' ? t('ai.tooBig') : String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    const text = (crewNote ?? '').trim();
    if (!text || stale) return;
    const me = sync.me ? personName(sync.me) : '';
    await saveDoc({ ...doc, changeNote: { revision: doc.revision, text, ...(me ? { by: me } : {}), at: Date.now(), ai: true }, updatedAt: Date.now() });
    playSuccessSound();
    setNote(t('dra.noteSaved', { n: doc.revision }));
  };

  const open = (l: SmsList) => {
    if (l.kind === 'round' && l.category) nav.navigate('ChecklistEdit', { category: l.category, period: l.period });
    else if (l.kind === 'dp') nav.navigate('DpTemplates');
  };
  const canOpen = (l: SmsList) => (l.kind === 'round' && !!l.category) || (l.kind === 'dp' && moduleOn('dpEditor'));

  return (
    <Card style={{ marginTop: SIZES.md }}>
      <Label>{t('dra.title')}</Label>
      <Text style={styles.sub}>{doc.prev && doc.prev.revision < doc.revision ? t('dra.intro', { a: doc.prev.revision, b: doc.revision }) : t('dra.introAlone')}</Text>
      <View style={[styles.row, { gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void start()}>
          <Text style={styles.smallText}>{busy ? t('rfq.aiReading') : read ? t('dra.again') : t('dra.read')}</Text>
        </TouchableOpacity>
        {read ? <TouchableOpacity onPress={() => { setReply(null); setCrewNote(null); }}><Text style={[styles.link, { marginTop: 0 }]}>{t('ai.dismiss')}</Text></TouchableOpacity> : null}
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{note}</Text> : null}

      {read ? (
        <>
          {stale ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('dra.stale', { n: reply!.rev, m: doc.revision })}</Text> : null}
          {read.same !== 'yes' ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{read.same === 'no' ? t('dra.sameNo') : t('dra.sameUnclear')}</Text> : null}
          {read.summary ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{read.summary}</Text> : null}

          {read.compared ? (
            <>
              <Text style={[styles.name, { marginTop: SIZES.sm }]}>{read.changes.length ? t('dra.changes', { n: read.changes.length }) : t('dra.noChanges')}</Text>
              {read.changes.map((c, i) => (
                <View key={i} style={[styles.item, { borderLeftColor: c.crew ? COLORS.warning : COLORS.border, marginTop: SIZES.xs }]}>
                  <Text style={styles.sub}>{[c.section, t(`dra.kind.${c.kind}`), c.crew ? t('dra.crew') : null].filter(Boolean).join(' · ')}</Text>
                  {c.was ? <Text style={styles.sub}>{t('dra.was', { what: c.was })}</Text> : null}
                  {c.now ? <Text style={[styles.sub, { color: COLORS.textDark }]}>{t('dra.now', { what: c.now })}</Text> : null}
                </View>
              ))}
            </>
          ) : null}

          <Text style={[styles.name, { marginTop: SIZES.sm }]}>{read.issues.length ? t('dra.issues', { n: read.issues.length }) : t('dra.noIssues', { n: lists.length })}</Text>
          {read.issues.map((x, i) => (
            <View key={i} style={[styles.item, { borderLeftColor: x.issue === 'missing' ? COLORS.primary : COLORS.danger, marginTop: SIZES.xs }]}>
              <Text style={styles.name}>{x.list.title}</Text>
              <Text style={styles.sub}>{[t(`dra.issue.${x.issue}`), x.section].filter(Boolean).join(' · ')}</Text>
              {x.lines.map((l) => <Text key={l.n} style={styles.sub}>{`${l.n}. ${l.text}`}</Text>)}
              {/* The lines are the app's own words; the model's paraphrase only where there is no line. */}
              {x.issue === 'missing' && x.says ? <Text style={styles.sub}>{x.says}</Text> : null}
              <Text style={[styles.sub, { color: COLORS.textDark }]}>{t('dra.should', { what: x.should })}</Text>
              {canOpen(x.list) ? <TouchableOpacity onPress={() => open(x.list)}><Text style={styles.link}>{t('dra.openList')}</Text></TouchableOpacity> : null}
            </View>
          ))}

          {read.docs.length ? (
            <>
              <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dra.docs')}</Text>
              {read.docs.map((d) => (
                <TouchableOpacity key={d.doc.id} onPress={() => nav.push('Doc', { id: d.doc.id })} style={[styles.item, { borderLeftColor: COLORS.primary, marginTop: SIZES.xs }]}>
                  <Text style={styles.name}>{[d.doc.docNo, d.doc.title].filter(Boolean).join(' · ')}</Text>
                  <Text style={styles.sub}>{d.why}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}
          {read.unreadable ? <Text style={styles.sub}>{t('man.remark', { what: read.unreadable })}</Text> : null}

          {!stale ? (
            <>
              <Text style={[styles.name, { marginTop: SIZES.sm }]}>{t('dra.noteTitle', { n: doc.revision })}</Text>
              <Text style={styles.sub}>{t('dra.noteHint')}</Text>
              <TextInput style={[styles.input, { minHeight: 120 }]} value={crewNote ?? ''} onChangeText={setCrewNote} multiline />
              <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }, !(crewNote ?? '').trim() && { opacity: 0.4 }]} disabled={!(crewNote ?? '').trim()} onPress={() => void saveNote()}>
                <Text style={styles.smallText}>{t('dra.saveNote')}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
