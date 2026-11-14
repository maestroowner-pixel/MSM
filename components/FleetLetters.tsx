// ===================================
// The vessel's correspondence register as the superintendent sees it in Fleet
// (FleetVesselSc tab "Correspondence"; types/correspondence.ts). The whole
// register, what the vessel still owes on top; a row opens the letter with its
// file and the letters on either side of it, and shares it as a PDF.
//
// "+ Letter to the vessel" writes a letter straight into the vessel's register
// (rules: shore create, incoming, kind superintendent): numbered on the vessel's
// IN- series from what this screen has read, with the file, an answer expected
// by a date, and — where it answers one — the vessel's letter it answers. Once
// sent the superintendent does not change it; the vessel answers or closes it.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Empty, Label } from './ui';
import SimpleDatePicker from './SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import * as shore from '../services/shore';
import { pickDocument, toDataUri } from '../services/attachments';
import { openMedFile } from '../services/medFiles';
import { letterState, nextLetterNo, repliesTo, sortLetters } from '../services/correspondence';
import { shareLetterPdf } from '../services/correspondenceReport';
import { todayIso } from '../services/pms';
import { Letter } from '../types/correspondence';
import { letterColor, stateLine } from '../screens/LettersSc';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { t, tk } from '../utils/i18n';

export function FleetLetters({ imo, vesselName, letters, onSent }: { imo: string; vesselName: string; letters: Letter[]; onSent: (l: Letter) => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const today = todayIso();
  const [open, setOpen] = useState<Letter | null>(null);
  const [writing, setWriting] = useState(false);
  const list = useMemo(() => sortLetters(letters, today), [letters, today]);

  return (
    <>
      <TouchableOpacity style={styles.btn} onPress={() => setWriting(true)}><Text style={styles.btnText}>{t('lt.fleetNew')}</Text></TouchableOpacity>
      {list.map((l) => {
        const s = letterState(l, letters, today);
        const c = l.cancelled ? COLORS.textLight : letterColor(COLORS, s);
        return (
          <TouchableOpacity key={l.id} style={[styles.row, { borderLeftColor: c }]} onPress={() => setOpen(l)}>
            <Text style={styles.title} numberOfLines={2}>{`${l.no} · ${l.subject}`}</Text>
            <Text style={styles.sub} numberOfLines={1}>{[`${l.dir === 'in' ? t('lt.from') : t('lt.to')} ${l.party}`, uiDate(l.date), l.file ? '📄' : null].filter(Boolean).join(' · ')}</Text>
            {l.dir === 'in' || l.cancelled ? <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{stateLine(l, s)}</Text> : null}
          </TouchableOpacity>
        );
      })}
      {!list.length ? <Empty text={t('lt.fleetEmpty')} /> : null}
      {open ? <LetterView letter={open} letters={letters} vesselName={vesselName} imo={imo} onClose={() => setOpen(null)} onOpen={setOpen} /> : null}
      {writing ? <NewLetter imo={imo} letters={letters} onClose={() => setWriting(false)} onSent={(l) => { setWriting(false); onSent(l); }} /> : null}
    </>
  );
}

function LetterView({ letter: l, letters, vesselName, imo, onClose, onOpen }: { letter: Letter; letters: Letter[]; vesselName: string; imo: string; onClose: () => void; onOpen: (l: Letter) => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const today = todayIso();
  const s = letterState(l, letters, today);
  const linked = [...(l.replyTo ? letters.filter((x) => x.id === l.replyTo) : []), ...repliesTo(l, letters)];
  const share = () => void shareLetterPdf(l, letters, { vessel_name: vesselName, imo } as any, today).catch((e: any) => Alert.alert(t('lt.share'), String(e?.message ?? e)));
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={[styles.link, { color: COLORS.textLight }]}>{t('common.close')}</Text></TouchableOpacity>
            <Text style={styles.sheetTitle} numberOfLines={2}>{`${l.no} · ${l.subject}`}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: SIZES.lg }}>
            <Text style={styles.title}>{`${l.dir === 'in' ? t('lt.from') : t('lt.to')} ${l.party}`}</Text>
            <Text style={styles.sub}>{[tk(`lt.dir.${l.dir}`), uiDate(l.date), tk(`lt.kind.${l.kind}`), l.ref ? t('lt.theirRef', { ref: l.ref }) : null, l.via ? tk(`lt.via.${l.via}`) : null].filter(Boolean).join(' · ')}</Text>
            {l.dir === 'in' || l.cancelled ? <Text style={[styles.body, { color: l.cancelled ? COLORS.textLight : letterColor(COLORS, s), fontWeight: '800' }]}>{stateLine(l, s)}</Text> : null}
            {l.actionBy ? <Text style={styles.sub}>{t('lt.actionByShort', { who: l.actionBy })}</Text> : null}
            {l.closed?.note ? <Text style={styles.body}>{l.closed.note}</Text> : null}
            {l.cancelled?.note ? <Text style={styles.body}>{l.cancelled.note}</Text> : null}
            {l.file ? (
              <TouchableOpacity onPress={() => void openMedFile(l.file!.url, l.file!.name).catch((e) => Alert.alert(t('lt.file'), String(e?.message ?? e)))}>
                <Text style={styles.link}>{`📄 ${l.file.name} ›`}</Text>
              </TouchableOpacity>
            ) : null}
            {l.notes ? <><Label>{t('lt.notes')}</Label><Text style={styles.body}>{l.notes}</Text></> : null}
            {linked.length ? <Label>{t('lt.answerTitle')}</Label> : null}
            {linked.map((x) => (
              <TouchableOpacity key={x.id} onPress={() => onOpen(x)}><Text style={styles.link}>{`${x.no} · ${uiDate(x.date)} · ${x.subject} ›`}</Text></TouchableOpacity>
            ))}
            <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('lt.enteredBy', { by: l.byRank ? `${l.by} (${l.byRank})` : l.by || '—' })}</Text>
            <TouchableOpacity style={[styles.small, { marginTop: SIZES.md }]} onPress={share}><Text style={styles.smallText}>{t('lt.share')}</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function NewLetter({ imo, letters, onClose, onSent }: { imo: string; letters: Letter[]; onClose: () => void; onSent: (l: Letter) => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const today = todayIso();
  const [id] = useState(() => uid('ltr'));
  const [subject, setSubject] = useState('');
  const [ref, setRef] = useState('');
  const [notes, setNotes] = useState('');
  const [needsReply, setNeedsReply] = useState(false);
  const [replyBy, setReplyBy] = useState<string | undefined>(undefined);
  const [actionBy, setActionBy] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>(undefined);
  const [file, setFile] = useState<Letter['file']>(undefined);
  const [busy, setBusy] = useState(false);
  // The vessel's letters an office letter may answer: the latest twenty it sent.
  const theirs = letters.filter((x) => x.dir === 'out' && !x.cancelled).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  const attach = async () => {
    const f = await pickDocument();
    if (!f) return;
    setBusy(true);
    try {
      const url = await shore.uploadFile(imo, id, uid('ltf'), await toDataUri(f.uri, f.name ?? 'letter.pdf'));
      setFile({ url, name: f.name ?? 'letter.pdf', addedAt: Date.now() });
    } catch (e: any) {
      Alert.alert(t('fv.notUploaded'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!subject.trim()) return Alert.alert(t('lt.fleetNewTitle'), t('lt.bad.subject'));
    if (needsReply && replyBy && replyBy < today) return Alert.alert(t('lt.fleetNewTitle'), t('lt.bad.replyBy'));
    setBusy(true);
    try {
      const name = (await shore.myName()) || 'Superintendent';
      const l: Letter = JSON.parse(JSON.stringify({
        id, dir: 'in', no: nextLetterNo(letters, 'in', today), date: today, party: name, kind: 'superintendent', subject: subject.trim(),
        ref: ref.trim() || undefined, via: 'portal', file, needsReply: needsReply || undefined, replyBy: needsReply ? replyBy : undefined,
        actionBy: actionBy.trim() || undefined, replyTo, notes: notes.trim() || undefined, by: name, byRank: 'Superintendent',
        createdAt: Date.now(), updatedAt: Date.now(),
      }));
      await shore.sendLetter(imo, l);
      Alert.alert(t('lt.fleetNewTitle'), t('lt.fleetSent', { no: l.no }));
      onSent(l);
    } catch (e: any) {
      Alert.alert(t('lt.fleetNewTitle'), t('lt.fleetFailed', { msg: e?.message ?? String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={[styles.link, { color: COLORS.textLight }]}>{t('common.cancel')}</Text></TouchableOpacity>
            <Text style={styles.sheetTitle}>{t('lt.fleetNewTitle')}</Text>
            <TouchableOpacity onPress={() => void send()} disabled={busy} hitSlop={8}><Text style={[styles.link, busy && { opacity: 0.5 }]}>{busy ? '…' : t('common.save')}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: SIZES.lg }}>
            <Text style={styles.sub}>{t('lt.fleetHint')}</Text>
            <Label>{t('lt.subject')}</Label>
            <TextInput style={styles.input} value={subject} onChangeText={setSubject} placeholder={t('lt.subjectPh')} placeholderTextColor={COLORS.textLight} multiline />
            <Label>{t('lt.ref')}</Label>
            <TextInput style={styles.input} value={ref} onChangeText={setRef} placeholder={t('lt.refPh')} placeholderTextColor={COLORS.textLight} />
            <Label>{t('lt.file')}</Label>
            {file ? <Text style={styles.body}>{file.name}</Text> : null}
            <TouchableOpacity style={styles.small} disabled={busy} onPress={() => void attach()}><Text style={styles.smallText}>{file ? t('lt.fileNew') : t('lt.fileAdd')}</Text></TouchableOpacity>
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>{t('lt.needsReply')}</Text>
              <Switch value={needsReply} onValueChange={setNeedsReply} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
            </View>
            {needsReply ? <SimpleDatePicker label={t('lt.replyBy')} value={replyBy} onChange={(v) => setReplyBy(v || undefined)} onClear={() => setReplyBy(undefined)} /> : null}
            <Label>{t('lt.actionBy')}</Label>
            <TextInput style={styles.input} value={actionBy} onChangeText={setActionBy} placeholder={t('lt.actionByPh')} placeholderTextColor={COLORS.textLight} />
            {theirs.length ? (
              <>
                <Label>{t('lt.fleetAnswers')}</Label>
                <View style={styles.chips}>
                  {chip(!replyTo, t('lt.answersNoneIn'), () => setReplyTo(undefined), 'none')}
                  {theirs.map((x) => chip(replyTo === x.id, `${x.no} · ${x.subject}`, () => setReplyTo(x.id), x.id))}
                </View>
              </>
            ) : null}
            <Label>{t('lt.notes')}</Label>
            <TextInput style={styles.input} value={notes} onChangeText={setNotes} multiline />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    btn: { alignSelf: 'flex-start', backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md, marginBottom: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    row: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs, borderLeftWidth: 4 },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    body: { fontSize: SIZES.body, color: COLORS.textDark, marginTop: 4 },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    link: { color: COLORS.primary, fontWeight: '700', marginTop: SIZES.xs },
    small: { alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: SIZES.sm, marginTop: SIZES.xs },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs, textAlignVertical: 'top' },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.md },
    toggleText: { flex: 1, fontSize: SIZES.small, color: COLORS.textDark },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md },
    sheet: { backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 560, maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm, marginBottom: SIZES.md },
    sheetTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
  });
