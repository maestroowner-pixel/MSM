// ===================================
// One ISM document — read it, sign for it, see who else has.
//
// Everyone gets the reading view: the text and/or the file, the revision, and
// "I have read and understood" — a signature, confirmed like any other
// (components/SignConfirm), for the CURRENT revision only.
//
// Officers and the Master also edit: details, text, file, and "New revision",
// which moves the document to Rev N+1 and so puts it back on everyone's list.
// Editing the details of the same revision (a typo in the title) does not.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { DOC_CATEGORY_LABEL, DocAck, DocCategory, IsmDoc, ackId } from '../types/docs';
import { crewLabel } from '../types/crew';
import { personName, roleAtLeast } from '../types/role';
import { iHaveRead, readStatus } from '../services/docs';
import { pendingFile, shareDocFile } from '../services/docFiles';
import { openFile, pickDocument } from '../services/attachments';
import { todayIso } from '../services/pms';
import { formatDate, formatDateTime } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';

const CATEGORIES = Object.keys(DOC_CATEGORY_LABEL) as DocCategory[];

export default function DocSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { docs, docAcks, crew, vessel, prefs, setPrefs, saveDoc, addDocAck } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();

  const id: string = route.params?.id;
  const existing = docs.find((d) => d.id === id);
  const isNew = !existing;
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const blank: IsmDoc = { id, title: '', category: 'procedure', revision: 1, issued: todayIso(), mustRead: true, updatedAt: Date.now() };
  const [draft, setDraft] = useState<IsmDoc>(existing ?? blank);
  // From the route, not from `existing`: opened by link on a cold start the
  // document arrives a moment after the screen, and must not open in Edit.
  const [editing, setEditing] = useState(!!route.params?.isNew);
  const [newFile, setNewFile] = useState<{ uri: string; name: string } | null>(null);
  const [bumping, setBumping] = useState(false);
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  useEffect(() => {
    if (existing && !touched.current) setDraft(existing);
  }, [existing]);
  const set = (p: Partial<IsmDoc>) => {
    touched.current = true;
    setDraft((d) => ({ ...d, ...p }));
  };

  // A file this device attached but could not upload yet.
  const [heldHere, setHeldHere] = useState<{ uri: string; name: string } | null>(null);
  useEffect(() => {
    void pendingFile(id).then(setHeldHere);
  }, [id, existing?.filePending]);

  // Who signs on this device: its account, else a name from the crew list.
  const people = useMemo(() => crew.filter((c) => c.active && !c.deleted), [crew]);
  const meName = sync.me ? personName(sync.me) : '';
  // Starts on whoever last signed on this device, as an inspection does.
  const [signerId, setSignerId] = useState<string | undefined>(prefs?.lastCrewId);
  const picked = people.find((p) => p.id === signerId);
  const signer = meName && sync.me
    ? { key: `device:${sync.me.id}`, name: meName, rank: sync.me.position || undefined, own: true }
    : picked
    ? { key: picked.id, name: picked.name, rank: picked.rank, own: false }
    : null;

  const doc = existing ?? draft;
  const status = existing ? readStatus(existing, docAcks, crew) : null;
  const signerHasRead = existing && signer ? iHaveRead(existing, docAcks, signer.key, signer.name) : false;
  const history = useMemo(
    () => docAcks.filter((a) => a.docId === id).sort((a, b) => b.revision - a.revision || b.at - a.at),
    [docAcks, id]
  );

  const onOpenFile = async () => {
    const f = doc.fileUri ? { uri: doc.fileUri, name: doc.fileName ?? 'document.pdf' } : heldHere;
    if (f) await openFile(f.uri, f.name);
  };

  const onSign = async () => {
    if (!existing) return;
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Read and understood: ${existing.title} (Rev ${existing.revision})` });
    if (!sig) return;
    const now = Date.now();
    const ack: DocAck = {
      id: ackId(existing.id, existing.revision, signer.key),
      docId: existing.id,
      revision: existing.revision,
      docTitle: existing.title,
      personKey: signer.key,
      by: signer.name,
      ...(signer.rank ? { byRank: signer.rank } : {}),
      at: now,
      ...(sig.proof ? { signedWith: sig.proof } : {}),
      updatedAt: now,
    };
    await addDocAck(ack);
    if (!signer.own) await setPrefs({ lastCrewId: signer.key });
    playSuccessSound();
  };

  const onSave = async () => {
    if (!draft.title.trim()) return Alert.alert('Title required', 'Name the document — "Enclosed space entry procedure".');
    if (!draft.body?.trim() && !draft.fileUri && !newFile && !heldHere) {
      return Alert.alert('Nothing to read', 'Attach the file, or write the text of the document.');
    }
    const revision = bumping ? (existing?.revision ?? 1) + 1 : draft.revision;
    const doSave = async () => {
      setBusy(true);
      try {
        let fileUri = draft.fileUri;
        let fileName = draft.fileName;
        let filePending = draft.filePending;
        const toShare = newFile ?? (draft.filePending ? heldHere : null);
        if (toShare) {
          const url = await shareDocFile(vessel?.imo, id, revision, toShare);
          fileName = toShare.name;
          fileUri = url ?? undefined;
          filePending = !url;
        }
        const out: IsmDoc = {
          ...draft,
          title: draft.title.trim(),
          revision,
          issued: bumping ? todayIso() : draft.issued,
          ...(fileUri ? { fileUri } : {}),
          ...(fileName ? { fileName } : {}),
          filePending: !!filePending,
          ...(meName ? { by: meName } : {}),
          updatedAt: Date.now(),
        };
        if (!fileUri) delete out.fileUri;
        await saveDoc(out);
        playSuccessSound();
        if (filePending) {
          Alert.alert('Saved — file not shared yet', 'The document is saved, but its file could not be uploaded (no connection, or this device has not joined the vessel). It stays on this device; open the document again when connected and save to share it.');
        }
        setEditing(false);
        setBumping(false);
        setNewFile(null);
        touched.current = false;
        if (isNew) goBackOr(nav);
      } finally {
        setBusy(false);
      }
    };
    if (bumping && existing) {
      Alert.alert(
        `Issue Rev ${revision}`,
        'Everyone will be asked to read and sign again. Signatures for earlier revisions are kept in the history.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Issue', onPress: () => void doSave() }]
      );
    } else await doSave();
  };

  const onRemove = () => {
    if (!existing) return goBackOr(nav);
    Alert.alert('Withdraw document', 'Withdraw this document? It leaves the list; its signatures are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          await saveDoc({ ...existing, deleted: true, updatedAt: Date.now() });
          goBackOr(nav);
        },
      },
    ]);
  };

  const attach = async () => {
    const f = await pickDocument();
    if (f) {
      touched.current = true;
      setNewFile({ uri: f.uri, name: f.name ?? 'Document' });
    }
  };

  const fileLabel = newFile?.name ?? draft.fileName ?? heldHere?.name;

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => (editing && !isNew ? (setEditing(false), setBumping(false), setDraft(existing!)) : goBackOr(nav))} />
          <Text style={styles.headerTitle} numberOfLines={1}>{isNew ? 'New document' : editing ? (bumping ? `Rev ${doc.revision + 1}` : 'Edit') : 'Document'}</Text>
          {editing ? (
            <TouchableOpacity onPress={() => void onSave()} disabled={busy} hitSlop={12}>
              <Text style={[styles.save, busy && { opacity: 0.5 }]}>{busy ? 'Saving…' : bumping ? 'Issue' : 'Save'}</Text>
            </TouchableOpacity>
          ) : canEdit ? (
            <TouchableOpacity onPress={() => setEditing(true)} hitSlop={12}>
              <Text style={styles.save}>Edit</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          {editing ? (
            <>
              <Label>Title ★</Label>
              <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder="Enclosed space entry procedure" placeholderTextColor={COLORS.textLight} />
              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <Label>Document no.</Label>
                  <TextInput style={styles.input} value={draft.docNo ?? ''} onChangeText={(v) => set({ docNo: v })} placeholder="SMS-07-03" placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
                </View>
                <View style={{ width: 90 }}>
                  <Label>Revision</Label>
                  <Text style={styles.rev}>{bumping ? draft.revision + 1 : draft.revision}</Text>
                </View>
              </View>
              <View style={{ height: SIZES.md }} />
              <Label>Type</Label>
              <View style={styles.chips}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.chip, draft.category === c && styles.chipOn]} onPress={() => set({ category: c })}>
                    <Text style={[styles.chipText, draft.category === c && styles.chipTextOn]}>{DOC_CATEGORY_LABEL[c]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.pair}>
                <View style={{ flex: 1 }}>
                  <SimpleDatePicker label="Issued" value={bumping ? todayIso() : draft.issued} onChange={(v) => set({ issued: v })} disabled={bumping} />
                </View>
                <View style={{ flex: 1 }}>
                  <SimpleDatePicker label="Review due" value={draft.reviewDue} onChange={(v) => set({ reviewDue: v })} onClear={() => set({ reviewDue: undefined })} />
                </View>
              </View>
              <View style={{ height: SIZES.md }} />
              <Label>File (PDF from the office)</Label>
              <TouchableOpacity style={styles.fileBtn} onPress={() => void attach()}>
                <MciIcon name="paperclip" size={18} color={COLORS.primary} />
                <Text style={styles.fileText} numberOfLines={1}>{fileLabel ? `${fileLabel} — replace` : 'Attach a file'}</Text>
              </TouchableOpacity>
              <View style={{ height: SIZES.md }} />
              <Label>Text (for a circular or orders written aboard)</Label>
              <TextInput style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]} value={draft.body ?? ''} onChangeText={(v) => set({ body: v })} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />
              <View style={styles.toggle}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Crew must read and sign</Text>
                  <Text style={styles.sub}>Off for reference documents nobody has to sign for.</Text>
                </View>
                <Switch value={draft.mustRead !== false} onValueChange={(v) => set({ mustRead: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
              </View>
              {!isNew && !bumping ? (
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setBumping(true)}>
                  <Text style={styles.outlineText}>{`New revision (Rev ${draft.revision + 1})`}</Text>
                </TouchableOpacity>
              ) : null}
              {bumping ? <Text style={styles.warn}>{`Saving issues Rev ${draft.revision + 1}: everyone is asked to read and sign again.`}</Text> : null}
              <TouchableOpacity style={styles.deleteBtn} onPress={onRemove}>
                <Text style={styles.deleteText}>{isNew ? 'Discard' : 'Withdraw document'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.meta}>{[doc.docNo, DOC_CATEGORY_LABEL[doc.category]].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.docTitle}>{doc.title}</Text>
              <Text style={styles.sub}>
                {[`Rev ${doc.revision}`, `issued ${formatDate(doc.issued)}`, doc.reviewDue ? `review ${formatDate(doc.reviewDue)}` : null, doc.by ? `by ${doc.by}` : null].filter(Boolean).join(' · ')}
              </Text>

              {doc.fileUri || heldHere ? (
                <TouchableOpacity style={styles.fileBtn} onPress={() => void onOpenFile()}>
                  <MciIcon name="file-pdf-box" size={20} color={COLORS.primary} />
                  <Text style={styles.fileText} numberOfLines={1}>{`Open ${doc.fileName ?? heldHere?.name ?? 'file'}`}</Text>
                </TouchableOpacity>
              ) : doc.filePending ? (
                <Text style={styles.warn}>The file has not been shared yet by the device that attached it.</Text>
              ) : null}
              {heldHere && doc.filePending ? (
                <Text style={styles.sub}>Only this device has the file so far — Edit and Save when connected to share it with the vessel.</Text>
              ) : null}

              {doc.body ? <Text style={styles.body}>{doc.body}</Text> : null}

              {doc.mustRead !== false && existing ? (
                <View style={styles.signCard}>
                  {signerHasRead ? (
                    <Text style={styles.signed}>{`✓ ${signer!.name} has signed Rev ${existing.revision}`}</Text>
                  ) : (
                    <>
                      {!meName ? (
                        <>
                          <Label>Who is signing?</Label>
                          <View style={styles.chips}>
                            {people.map((p) => (
                              <TouchableOpacity key={p.id} style={[styles.chip, signerId === p.id && styles.chipOn]} onPress={() => setSignerId(p.id)}>
                                <Text style={[styles.chipText, signerId === p.id && styles.chipTextOn]}>{crewLabel(p)}</Text>
                              </TouchableOpacity>
                            ))}
                            {people.length === 0 ? <Text style={styles.sub}>The crew list is empty — the Master adds people in Settings → Crew.</Text> : null}
                          </View>
                        </>
                      ) : null}
                      <TouchableOpacity style={[styles.signBtn, !signer && { opacity: 0.5 }]} onPress={() => void onSign()}>
                        <MciIcon name="draw-pen" size={20} color={COLORS.textWhite} />
                        <Text style={styles.signText}>I have read and understood</Text>
                      </TouchableOpacity>
                      <Text style={styles.sub}>{`Signs for Rev ${existing.revision}${signer ? ` as ${signer.name}` : ''}. A signature cannot be withdrawn.`}</Text>
                    </>
                  )}
                </View>
              ) : null}

              {status && doc.mustRead !== false ? (
                <>
                  <Label>{`Read by ${status.read.length} of ${status.required}`}</Label>
                  {status.unread.length ? (
                    <Text style={styles.unread}>{`Not yet: ${status.unread.map((p) => p.name).join(', ')}`}</Text>
                  ) : status.required ? (
                    <Text style={styles.signed}>Everyone on the crew list has signed this revision.</Text>
                  ) : null}
                </>
              ) : null}

              {history.length ? (
                <>
                  <View style={{ height: SIZES.md }} />
                  <Label>Signatures</Label>
                  {history.map((a) => (
                    <View key={a.id} style={styles.histRow}>
                      <Text style={[styles.histName, a.revision !== doc.revision && { color: COLORS.textLight }]}>
                        {a.byRank ? `${a.by} (${a.byRank})` : a.by}
                      </Text>
                      <Text style={styles.sub}>
                        {[`Rev ${a.revision}`, formatDateTime(a.at), a.signedWith ? (a.signedWith.method === 'pin' ? 'PIN' : 'biometric') : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    pair: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md, alignItems: 'flex-end' },
    rev: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark, marginTop: 8, textAlign: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    fileBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginTop: SIZES.sm },
    fileText: { flex: 1, color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.lg },
    toggleTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4 },
    warn: { fontSize: SIZES.small, color: COLORS.warning, fontWeight: '600', marginTop: SIZES.sm },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    docTitle: { fontSize: SIZES.h3 ?? 24, fontWeight: '800', color: COLORS.textDark, marginTop: 4 },
    body: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 22, marginTop: SIZES.lg },
    signCard: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.lg },
    signBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.sm, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, marginTop: SIZES.md },
    signText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    signed: { color: COLORS.success, fontWeight: '700', fontSize: SIZES.body },
    unread: { color: COLORS.warning, fontSize: SIZES.small, fontWeight: '600', marginTop: 4 },
    histRow: { paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    histName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    outlineBtn: { marginTop: SIZES.xl, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
    outlineText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body },
    deleteBtn: { marginTop: SIZES.md, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
    deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
  });
