// ===================================
// One letter of the correspondence register (types/correspondence.ts): in or
// out, its number, from / to, subject, their reference, how it came, the file.
//
// An incoming letter may expect an answer by a date and name who aboard acts on
// it; "Answer" opens an outgoing letter to the same party, "Re:" its subject,
// which answers it once saved. Or an officer closes it without a letter, saying
// how ("by phone", "acted on"). The number is given at the first save and never
// changes; a letter entered in error is cancelled with a reason, never deleted.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { LETTER_VIA, Letter, LetterDir, LetterStamp, PARTY_KINDS } from '../types/correspondence';
import { personName, roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { uploadInline } from '../services/attachmentStorage';
import { openMedFile, pickDocForAi, sizeText } from '../services/medFiles';
import { shareLetterPdf } from '../services/correspondenceReport';
import { isOpen, letterProblem, letterState, nextLetterNo, repliesTo, replyDraft } from '../services/correspondence';
import { todayIso } from '../services/pms';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { letterColor, stateLine } from './LettersSc';
import { t, tk, useT } from '../utils/i18n';

const MAX_FILE = 10 * 1024 * 1024;

export default function LetterSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { letters, saveRow, vessel, crew } = useData();
  const sync = useSync();
  const { signer, picker } = useSigner();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const isNew = route.params?.id === 'new';
  const stored = letters.find((l) => l.id === route.params?.id);
  const [draft, setDraft] = useState<Letter | null>(() => {
    if (!isNew) return null;
    const by = sync.me ? personName(sync.me) : '';
    const answering = route.params?.replyTo ? letters.find((l) => l.id === route.params.replyTo) : undefined;
    if (answering) return replyDraft(answering, uid('ltr'), today, by, sync.me?.position || undefined);
    const dir: LetterDir = route.params?.dir === 'out' ? 'out' : 'in';
    return { id: uid('ltr'), dir, no: '', date: today, party: '', kind: 'office', subject: '', via: 'email', by, createdAt: Date.now(), updatedAt: 0 };
  });
  const [busy, setBusy] = useState(false);
  // Closing without a letter, or cancelling an entry: the note being typed.
  const [ending, setEnding] = useState<{ what: 'close' | 'cancel'; note: string } | null>(null);
  const back = () => goBackOr(nav, 'Letters');

  const l = draft ?? stored;
  if (!l || !officer) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{officer ? t('lt.notHere') : t('lt.officersOnly')}</Text>
      </Screen>
    );
  }

  const set = (patch: Partial<Letter>) => setDraft({ ...(draft ?? stored!), ...patch });
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  // A name when there is one to give: a device on its own with no crew list still keeps its register.
  const who = (): { by: string; byRank?: string } | null => {
    if (signer) return { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}) };
    if (crew.length) {
      Alert.alert(t('sign.who'), t('pd.chooseName'));
      return null;
    }
    return { by: '' };
  };
  const stamp = (note?: string): LetterStamp | null => {
    const w = who();
    return w ? { ...w, at: Date.now(), ...(note?.trim() ? { note: note.trim() } : {}) } : null;
  };

  // ---- the file: to the vessel's files, or kept in the record on a device on its own ----
  const addFile = async () => {
    const f = await pickDocForAi();
    if (!f) return;
    if (f.bytes > MAX_FILE) return Alert.alert(t('lt.file'), t('chem.tooBig', { size: sizeText(f.bytes) }));
    setBusy(true);
    try {
      const imo = (vessel?.imo ?? '').replace(/\D/g, '');
      if (sync.enrolled && !imo) throw new Error(t('chem.noImo'));
      const url = sync.enrolled ? await uploadInline(imo, l.id, uid('ltf'), f.dataUri) : f.dataUri;
      const who = sync.me ? personName(sync.me) : signer?.name ?? '';
      set({ file: { url, name: f.name, addedAt: Date.now(), ...(who ? { by: who } : {}) } });
    } catch (e: any) {
      Alert.alert(t('lt.file'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    const bad = letterProblem(draft);
    if (bad) return Alert.alert(t('lt.title'), tk(`lt.bad.${bad}`));
    let by = draft.by;
    let byRank = draft.byRank;
    if (!by) {
      const w = who();
      if (!w) return;
      by = w.by;
      byRank = w.byRank;
    }
    const trim = (v?: string) => v?.trim() || undefined;
    const inbound = draft.dir === 'in';
    const out: Letter = JSON.parse(JSON.stringify({
      ...draft,
      no: draft.no || nextLetterNo(letters, draft.dir, draft.date),
      party: draft.party.trim(), subject: draft.subject.trim(), ref: trim(draft.ref), notes: trim(draft.notes),
      actionBy: inbound ? trim(draft.actionBy) : undefined,
      needsReply: inbound && draft.needsReply ? true : undefined,
      replyBy: inbound && draft.needsReply ? draft.replyBy || undefined : undefined,
      by, byRank, updatedAt: Date.now(),
    }));
    await saveRow(storage.LETTERS_KEY, out);
    playSuccessSound();
    setDraft(null);
    if (isNew) nav.replace('Letter', { id: out.id });
  };

  const finish = async () => {
    if (!stored || !ending) return;
    if (ending.note.trim().length < 3) return Alert.alert(t('lt.title'), t(ending.what === 'close' ? 'lt.closeNote' : 'lt.cancelNote'));
    const s = stamp(ending.note);
    if (!s) return;
    await saveRow(storage.LETTERS_KEY, { ...stored, ...(ending.what === 'close' ? { closed: s } : { cancelled: s }) });
    playSuccessSound();
    setEnding(null);
  };

  // ---- edit ----
  if (draft) {
    const inbound = draft.dir === 'in';
    // Incoming letters still waiting: what an outgoing one can answer.
    const answerable = inbound
      // An answer from the other side to one of ours: the latest twenty sent.
      ? letters.filter((x) => x.dir === 'out' && !x.cancelled).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20)
      : letters.filter((x) => x.dir === 'in' && !x.cancelled && (x.id === draft.replyTo || isOpen(letterState(x, letters, today))));
    const answersCard = answerable.length ? (
      <Card>
        <Label>{t('lt.answers')}</Label>
        <View style={styles.chips}>
          {chip(!draft.replyTo, inbound ? t('lt.answersNoneIn') : t('lt.answersNone'), () => set({ replyTo: undefined }), 'none')}
          {answerable.map((x) => chip(draft.replyTo === x.id, `${x.no} · ${x.party}`, () => set({ replyTo: x.id, ...(draft.party ? {} : { party: x.party, kind: x.kind }) }), x.id))}
        </View>
      </Card>
    ) : null;
    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setDraft(null))} />
        <ScreenTitle title={draft.no || (inbound ? t('lt.newIn') : t('lt.newOut'))} subtitle={draft.no ? undefined : t('lt.noOnSave')} help="Correspondence register" />
        <Card>
          {isNew && !route.params?.replyTo ? (
            <View style={styles.chips}>
              {chip(inbound, t('lt.dir.in'), () => set({ dir: 'in' }), 'in')}
              {chip(!inbound, t('lt.dir.out'), () => set({ dir: 'out', needsReply: undefined, replyBy: undefined }), 'out')}
            </View>
          ) : null}
          <SimpleDatePicker label={inbound ? t('lt.dateIn') : t('lt.dateOut')} value={draft.date} onChange={(v) => set({ date: v || today })} />
          <Label>{inbound ? t('lt.from') : t('lt.to')}</Label>
          <TextInput style={styles.input} value={draft.party} onChangeText={(v) => set({ party: v })} placeholder={t('lt.partyPh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.chips}>{PARTY_KINDS.map((k) => chip(draft.kind === k, tk(`lt.kind.${k}`), () => set({ kind: k }), k))}</View>
          <Label>{t('lt.subject')}</Label>
          <TextInput style={styles.input} value={draft.subject} onChangeText={(v) => set({ subject: v })} placeholder={t('lt.subjectPh')} placeholderTextColor={COLORS.textLight} multiline />
          <Label>{t('lt.ref')}</Label>
          <TextInput style={styles.input} value={draft.ref ?? ''} onChangeText={(v) => set({ ref: v })} placeholder={t('lt.refPh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('lt.via')}</Label>
          <View style={styles.chips}>{LETTER_VIA.map((k) => chip(draft.via === k, tk(`lt.via.${k}`), () => set({ via: k }), k))}</View>
        </Card>

        <Card>
          <Label>{t('lt.file')}</Label>
          {draft.file ? <Text style={styles.body}>{draft.file.name}</Text> : <Text style={styles.sub}>{t('lt.noFile')}</Text>}
          <Text style={styles.sub}>{t('lt.fileHint')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void addFile()}>
              <Text style={styles.smallText}>{busy ? t('chem.saving') : draft.file ? t('lt.fileNew') : t('lt.fileAdd')}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {inbound ? (
          <Card>
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>{t('lt.needsReply')}</Text>
              <Switch value={!!draft.needsReply} onValueChange={(v) => set({ needsReply: v || undefined })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
            </View>
            {draft.needsReply ? (
              <SimpleDatePicker label={t('lt.replyBy')} value={draft.replyBy} onChange={(v) => set({ replyBy: v || undefined })} onClear={() => set({ replyBy: undefined })} />
            ) : null}
            <Label>{t('lt.actionBy')}</Label>
            <TextInput style={styles.input} value={draft.actionBy ?? ''} onChangeText={(v) => set({ actionBy: v })} placeholder={t('lt.actionByPh')} placeholderTextColor={COLORS.textLight} />
          </Card>
        ) : null}
        {answersCard}

        <Card>
          <Label>{t('lt.notes')}</Label>
          <TextInput style={styles.input} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} multiline />
          {!draft.by && picker ? <View style={{ marginTop: 6 }}>{picker}</View> : null}
        </Card>

        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => (isNew ? back() : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ---- the letter ----
  const s = letterState(l, letters, today);
  const c = l.cancelled ? COLORS.textLight : letterColor(COLORS, s);
  const answers = repliesTo(l, letters);
  const answering = l.replyTo ? letters.find((x) => x.id === l.replyTo) : undefined;
  const sharePdf = () => void shareLetterPdf(l, letters, vessel, today).catch((e: any) => Alert.alert(t('lt.share'), String(e?.message ?? e)));
  const whoOf = (x: { by: string; byRank?: string }) => (x.byRank ? `${x.by} (${x.byRank})` : x.by || '—');
  const linkRow = (x: Letter) => (
    <TouchableOpacity key={x.id} onPress={() => nav.push('Letter', { id: x.id })}>
      <Text style={styles.link}>{`${x.no} · ${uiDate(x.date)} · ${x.subject} ›`}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={`${l.no} · ${l.subject}`} subtitle={[tk(`lt.dir.${l.dir}`), uiDate(l.date), l.via ? tk(`lt.via.${l.via}`) : null].filter(Boolean).join(' · ')} help="Correspondence register" />

      <View style={[styles.item, { borderLeftColor: c }]}>
        <Text style={styles.name}>{`${l.dir === 'in' ? t('lt.from') : t('lt.to')} ${l.party}`}</Text>
        <Text style={styles.sub}>{[tk(`lt.kind.${l.kind}`), l.ref ? t('lt.theirRef', { ref: l.ref }) : null].filter(Boolean).join(' · ')}</Text>
        {l.dir === 'in' || l.cancelled ? <Text style={[styles.body, { color: c, fontWeight: '800' }]}>{stateLine(l, s)}</Text> : null}
        {l.actionBy ? <Text style={styles.sub}>{t('lt.actionByShort', { who: l.actionBy })}</Text> : null}
      </View>

      {l.cancelled ? (
        <Card>
          <Text style={[styles.sub, { fontWeight: '700' }]}>{t('lt.cancelledBy', { by: whoOf(l.cancelled), at: uiDateTime(l.cancelled.at) })}</Text>
          {l.cancelled.note ? <Text style={styles.body}>{l.cancelled.note}</Text> : null}
        </Card>
      ) : null}

      <Card>
        <Label>{t('lt.file')}</Label>
        {l.file ? (
          <TouchableOpacity onPress={() => void openMedFile(l.file!.url, l.file!.name).catch((e) => Alert.alert(t('lt.file'), String(e?.message ?? e)))}>
            <Text style={styles.link}>{`📄 ${l.file.name} ›`}</Text>
          </TouchableOpacity>
        ) : <Text style={styles.sub}>{t('lt.noFile')}</Text>}
        {l.notes ? <><Label>{t('lt.notes')}</Label><Text style={styles.body}>{l.notes}</Text></> : null}
        <Text style={[styles.sub, { marginTop: 8 }]}>{t('lt.enteredBy', { by: whoOf(l) })}</Text>
      </Card>

      {l.dir === 'in' && !l.cancelled ? (
        <Card>
          <Label>{t('lt.answerTitle')}</Label>
          {answers.map(linkRow)}
          {l.closed ? (
            <>
              <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{t('lt.closedBy', { by: whoOf(l.closed), at: uiDateTime(l.closed.at) })}</Text>
              {l.closed.note ? <Text style={styles.body}>{l.closed.note}</Text> : null}
            </>
          ) : null}
          {!answers.length && !l.closed ? <Text style={styles.sub}>{l.needsReply ? t('lt.noAnswerYet') : t('lt.infoOnly')}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => nav.push('Letter', { id: 'new', replyTo: l.id })}><Text style={styles.smallText}>{t('lt.reply')}</Text></TouchableOpacity>
            {!l.closed && !answers.length && !ending ? (
              <TouchableOpacity style={styles.small} onPress={() => setEnding({ what: 'close', note: '' })}><Text style={styles.smallText}>{t('lt.close')}</Text></TouchableOpacity>
            ) : null}
          </View>
        </Card>
      ) : null}

      {answering ? (
        <Card>
          <Label>{t('lt.answersIn')}</Label>
          {linkRow(answering)}
        </Card>
      ) : null}

      {l.dir === 'out' && answers.length ? (
        <Card>
          <Label>{t('lt.answerTitle')}</Label>
          {answers.map(linkRow)}
        </Card>
      ) : null}

      {ending ? (
        <Card>
          <Label>{ending.what === 'close' ? t('lt.closeHow') : t('lt.cancelWhy')}</Label>
          <TextInput style={styles.input} value={ending.note} onChangeText={(v) => setEnding({ ...ending, note: v })} multiline autoFocus placeholder={ending.what === 'close' ? t('lt.closePh') : t('lt.cancelPh')} placeholderTextColor={COLORS.textLight} />
          {picker ? <View style={{ marginTop: 6 }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, ending.what === 'cancel' ? { backgroundColor: COLORS.danger } : null]} onPress={() => void finish()}>
              <Text style={styles.btnText}>{ending.what === 'close' ? t('lt.close') : t('lt.cancelEntry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEnding(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {!ending ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.small} onPress={sharePdf}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
        </View>
      ) : null}

      {!l.cancelled && !ending ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => setDraft({ ...stored! })}><Text style={styles.btnText}>{t('common.edit')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setEnding({ what: 'cancel', note: '' })}><Text style={[styles.link, { color: COLORS.danger }]}>{t('lt.cancelEntry')}</Text></TouchableOpacity>
        </View>
      ) : null}
    </Screen>
  );
}
