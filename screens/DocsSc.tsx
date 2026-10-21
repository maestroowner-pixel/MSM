// ===================================
// Documents — the vessel's SMS, procedures, circulars and standing orders, and
// who has read and signed for each (types/docs.ts).
//
// Top of the screen is the question each crew member opens it with: "what have
// I still to read?" — worked out for the person this device signs as (its own
// account, or the name last picked on it). Below, every document with how many
// of the crew list have signed its current revision, so an officer sees at a
// glance which circular is still going round.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { DOC_CATEGORY_LABEL, DocCategory, IsmDoc } from '../types/docs';
import { personName, roleAtLeast } from '../types/role';
import { DocSort, docFromFileName, iHaveRead, matchExisting, readStatus, reviewState, searchDocs, snippet, sortDocs } from '../services/docs';
import { PickedFile, pickDocuments, toDataUri } from '../services/attachments';
import { shareDocFile } from '../services/docFiles';
import { pdfText } from '../utils/pdfText';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';
import { t, tn, useT } from '../utils/i18n';

export default function DocsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { docs, docAcks, crew, prefs, vessel, saveDoc } = useData();
  const sync = useSync();
  const [q, setQ] = useState('');
  const [num, setNum] = useState('');
  const [sortBy, setSortBy] = useState<DocSort>('number');
  const [cat, setCat] = useState<DocCategory | null>(null);
  const today = todayIso();

  // Who "I" am on this device: its account, else the crew member last picked.
  const me = useMemo(() => {
    if (sync.me) return { key: `device:${sync.me.id}`, name: personName(sync.me) };
    const c = crew.find((x) => x.id === prefs?.lastCrewId && !x.deleted);
    return c ? { key: c.id, name: c.name } : null;
  }, [sync.me, crew, prefs?.lastCrewId]);

  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  // Word search (title, number, type, text, file name, the PDF's own words) and
  // number search, then the type filter and the chosen order.
  const shown = useMemo(
    () => sortDocs(searchDocs(docs, q, num, (d) => DOC_CATEGORY_LABEL[d.category]).filter((d) => !cat || d.category === cat), sortBy),
    [docs, q, num, cat, sortBy]
  );
  const searching = !!(q.trim() || num.trim() || cat);
  const presentCats = useMemo(() => (Object.keys(DOC_CATEGORY_LABEL) as DocCategory[]).filter((c) => docs.some((d) => d.category === c)), [docs]);

  const mine = useMemo(
    () => (me ? shown.filter((d) => d.mustRead !== false && !iHaveRead(d, docAcks, me.key, me.name)) : []),
    [shown, docAcks, me]
  );

  const open = (d: IsmDoc) => nav.navigate('Doc', { id: d.id });

  // ---- Upload several documents at once ----
  type Batch = { file: PickedFile; parsed: { docNo?: string; title: string }; match?: IsmDoc }[];
  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchCat, setBatchCat] = useState<DocCategory>('procedure');
  const [batchMust, setBatchMust] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [batchDone, setBatchDone] = useState<string | null>(null);

  const pickBatch = async () => {
    setBatchDone(null);
    const files = await pickDocuments();
    if (!files.length) return;
    setBatch(files.map((file) => {
      const parsed = docFromFileName(file.name ?? 'Document');
      return { file, parsed, match: matchExisting(docs, parsed) };
    }));
  };

  const runBatch = async () => {
    if (!batch) return;
    let added = 0;
    let revised = 0;
    let pending = 0;
    for (let i = 0; i < batch.length; i++) {
      const { file, parsed, match } = batch[i];
      const name = file.name ?? 'Document';
      setUploading(t('docs.uploading', { k: i + 1, n: batch.length, name }));
      const id = match?.id ?? uid('doc');
      const revision = match ? match.revision + 1 : 1;
      const dataUri = await toDataUri(file.uri, name).catch(() => file.uri);
      const text = /\.pdf$/i.test(name) ? await pdfText(dataUri).catch(() => null) : null;
      const url = await shareDocFile(vessel?.imo, id, revision, { uri: file.uri, name });
      if (!url) pending += 1;
      const base: IsmDoc = match ?? { id, title: parsed.title, category: batchCat, revision: 1, issued: todayIso(), mustRead: batchMust, updatedAt: Date.now() };
      const out: IsmDoc = {
        ...base,
        ...(parsed.docNo && !base.docNo ? { docNo: parsed.docNo } : {}),
        ...(match ? {} : { category: batchCat, mustRead: batchMust }),
        revision,
        issued: todayIso(),
        fileName: name,
        filePending: !url,
        updatedAt: Date.now(),
      };
      if (url) out.fileUri = url;
      else delete out.fileUri;
      if (text) out.text = text;
      else delete out.text;
      await saveDoc(out);
      if (match) revised += 1;
      else added += 1;
    }
    setUploading(null);
    setBatch(null);
    setBatchDone(
      [`${added} added`, revised ? `${revised} new revision${revised === 1 ? '' : 's'}` : null, pending ? `${pending} file${pending === 1 ? '' : 's'} kept on this device until there is a connection` : null]
        .filter(Boolean)
        .join(' · ')
    );
  };

  const Row = ({ d, highlight }: { d: IsmDoc; highlight?: boolean }) => {
    const st = readStatus(d, docAcks, crew);
    const rv = reviewState(d, today);
    return (
      <TouchableOpacity style={styles.row} onPress={() => open(d)} activeOpacity={0.7}>
        <View style={[styles.bar, { backgroundColor: highlight ? COLORS.warning : rv === 'overdue' ? COLORS.danger : COLORS.primary }]} />
        <MciIcon name={d.fileUri || d.filePending ? 'file-pdf-box' : 'text-box-outline'} size={22} color={COLORS.textLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{d.title}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[d.docNo, t('docs.rev', { n: d.revision }), DOC_CATEGORY_LABEL[d.category], rv === 'overdue' ? t('docs.reviewOverdue') : rv === 'soon' ? t('docs.reviewDue') : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {q.trim() && snippet(d, q) ? <Text style={styles.snip} numberOfLines={2}>{snippet(d, q)}</Text> : null}
        </View>
        {d.mustRead !== false && st.required ? (
          <Text style={[styles.count, st.unread.length ? { color: COLORS.warning } : { color: COLORS.success }]}>
            {`${st.read.length}/${st.required}`}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle title={t('docs.title')} subtitle={t('docs.sub')} help="ISM documents" />

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.search, { flex: 2 }]}
          value={q}
          onChangeText={setQ}
          placeholder={t('docs.searchPh')}
          placeholderTextColor={COLORS.textLight}
        />
        <TextInput
          style={[styles.search, { flex: 1 }]}
          value={num}
          onChangeText={setNum}
          placeholder={t('docs.no')}
          placeholderTextColor={COLORS.textLight}
          autoCapitalize="characters"
        />
      </View>
      {/* Sort and type side by side, as drop-downs (components/Dropdown). */}
      <View style={styles.dropRow}>
        <Dropdown
          caption={t('docs.sort')}
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'number', label: t('docs.no') },
            { value: 'title', label: t('dpt.fTitle') },
            { value: 'issued', label: t('docs.newest') },
            { value: 'review', label: t('docs.reviewDueCap') },
          ]}
          style={{ flex: 1 }}
        />
        <Dropdown
          caption={t('docs.type')}
          value={cat}
          onChange={setCat}
          options={[{ value: null as DocCategory | null, label: t('docs.allTypes') }, ...presentCats.map((c) => ({ value: c as DocCategory | null, label: DOC_CATEGORY_LABEL[c] }))]}
          style={{ flex: 1 }}
        />
      </View>

      {canEdit ? (
        <View style={styles.uploadRow}>
          <TouchableOpacity style={styles.uploadBtn} onPress={() => void pickBatch()} disabled={!!uploading}>
            <MciIcon name="upload-multiple" size={18} color={COLORS.textWhite} />
            <Text style={styles.uploadText}>{t('docs.upload')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => nav.navigate('Doc', { id: uid('doc'), isNew: true })} hitSlop={10}>
            <Text style={styles.add}>{t('docs.write')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {batch ? (
        <View style={styles.batch}>
          <Text style={styles.title}>{t('docs.selected', { x: tn('n.file', batch.length) })}</Text>
          {batch.map((b) => (
            <View key={b.file.name} style={styles.batchRow}>
              <Text style={styles.batchName} numberOfLines={1}>{[b.parsed.docNo, b.parsed.title].filter(Boolean).join(' · ')}</Text>
              <Text style={[styles.batchTag, b.match ? { color: COLORS.warning } : { color: COLORS.success }]}>
                {b.match ? t('docs.newRev', { n: b.match.revision }) : t('docs.new')}
              </Text>
            </View>
          ))}
          <View style={styles.batchOpts}>
            <Dropdown
              caption={t('docs.type')}
              value={batchCat}
              onChange={setBatchCat}
              options={(Object.keys(DOC_CATEGORY_LABEL) as DocCategory[]).map((c) => ({ value: c, label: DOC_CATEGORY_LABEL[c] }))}
              style={{ flex: 1 }}
            />
            <View style={styles.mustRow}>
              <Text style={styles.sub}>{t('docs.mustRead')}</Text>
              <Switch value={batchMust} onValueChange={setBatchMust} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
            </View>
          </View>
          <Text style={styles.sub}>{t('docs.batchHint')}</Text>
          {uploading ? (
            <Text style={[styles.sub, { color: COLORS.primary, fontWeight: '700' }]}>{uploading}</Text>
          ) : (
            <View style={styles.uploadRow}>
              <TouchableOpacity style={styles.uploadBtn} onPress={() => void runBatch()}>
                <Text style={styles.uploadText}>{t('docs.uploadN', { n: batch.length })}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setBatch(null)} hitSlop={8}>
                <Text style={[styles.add, { color: COLORS.textLight }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}
      {batchDone ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.sm }]}>{`✓ ${batchDone}`}</Text> : null}

      {mine.length && !searching ? (
        <>
          <Label>{t('docs.toRead', { name: me!.name, n: mine.length })}</Label>
          {mine.map((d) => <Row key={`m${d.id}`} d={d} highlight />)}
        </>
      ) : me && docs.length && !searching ? (
        <Text style={styles.allRead}>✓ {me.name} has read every document that must be read.</Text>
      ) : null}


      <View style={styles.head}>
        <Label>{searching ? t('docs.found', { k: shown.length, n: docs.length }) : t('docs.all', { n: shown.length })}</Label>
      </View>
      {docs.length > 0 && shown.length === 0 ? <Empty text={t('docs.noMatch')} /> : null}
      {docs.length === 0 ? (
        <Empty
          text={
            canEdit
              ? t('docs.empty')
              : t('docs.emptyCrew')
          }
        />
      ) : (
        shown.map((d) => <Row key={d.id} d={d} />)
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    search: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text },
    searchRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
    dropRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
    snip: { fontSize: SIZES.small, color: COLORS.text, fontStyle: 'italic', marginTop: 2 },
    uploadRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginBottom: SIZES.sm },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md },
    uploadText: { color: COLORS.textWhite, fontWeight: '800' },
    batch: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md, gap: 4 },
    batchRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 3, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    batchName: { flex: 1, fontSize: SIZES.small, color: COLORS.textDark, fontWeight: '600' },
    batchTag: { fontSize: SIZES.tiny, fontWeight: '800' },
    batchOpts: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.sm },
    mustRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SIZES.md },
    add: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    allRead: { color: COLORS.success, fontWeight: '600', fontSize: SIZES.small, marginBottom: SIZES.sm },
    row: { flexDirection: 'row', alignItems: 'center', ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden', gap: SIZES.sm },
    bar: { width: 5, alignSelf: 'stretch', marginRight: 2 },
    title: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    count: { fontSize: SIZES.body, fontWeight: '800' },
  });
