// ===================================
// One vessel, from the office — the superintendent's view (screens/FleetSc).
//
// Three tabs, in the order a superintendent works a vessel:
//   Certificates  vessel, crew and equipment certificates with their expiry —
//                 added and edited here, saved on the server into the vessel's
//                 register (functions `shoreSaveCertificate`); the crew aboard
//                 receive the change on their next sync.
//   Documents     the ISM documents and who has not signed the current
//                 revision — added, edited and re-issued here.
//   Equipment     what is expired or due, read-only: the crew inspect it aboard.
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle, StatusPill } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import * as shore from '../services/shore';
import { moduleOn } from '../constants/modules';
import { VesselData } from '../services/fleetSummary';
import { readStatus } from '../services/docs';
import { pickDocument, toDataUri } from '../services/attachments';
import { pdfText } from '../utils/pdfText';
import { todayIso } from '../services/pms';
import { Certificate, CertificateScope, scopeOf } from '../types/certificate';
import { DOC_CATEGORY_LABEL, DocCategory, IsmDoc } from '../types/docs';
import { computeStatus, formatDate, statusFromDate } from '../utils/dates';
import { CATEGORY_MAP } from '../constants/categories';
import { uid } from '../utils/id';
import { t, tk, useT } from '../utils/i18n';

type Tab = 'certs' | 'docs' | 'equipment';
const SCOPES: { key: CertificateScope; label: string }[] = [
  { key: 'vessel', label: 'Vessel' },
  { key: 'crew', label: 'Crew' },
  { key: 'equipment', label: 'Equipment' },
];

export default function FleetVesselSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const imo: string = useRoute<any>().params?.imo;
  const [v, setV] = useState<VesselData | null>(null);
  const [tab, setTab] = useState<Tab>('certs');
  const [error, setError] = useState<string | null>(null);
  const [cert, setCert] = useState<Certificate | null>(null);
  const [docEdit, setDocEdit] = useState<{ doc: IsmDoc; isNew: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      setV(await shore.loadVessel(imo));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [imo]);

  useEffect(() => {
    if (!moduleOn('fleet')) return;
    void (async () => {
      // Opened by link: the console's session may not be up yet.
      try {
        await shore.resume();
      } catch {
        /* load() reports it */
      }
      await load();
    })();
  }, [load]);

  if (!v) {
    return (
      <Screen>
        <ScreenTitle title={t('certs.tab.vessel')} subtitle={`IMO ${imo}`} />
        {error ? <Text style={{ color: COLORS.danger }}>{error}</Text> : <ActivityIndicator color={COLORS.primary} />}
      </Screen>
    );
  }

  const certs = [...v.certificates].sort((a, b) => (a.expiryDate ?? '9999').localeCompare(b.expiryDate ?? '9999'));
  const docs = v.docs.filter((d) => !d.deleted).sort((a, b) => (a.docNo ?? a.title).localeCompare(b.docNo ?? b.title, undefined, { numeric: true }));
  const owed = v.items
    .map((it) => ({ it, st: computeStatus(it) }))
    .filter((x) => x.st === 'expired' || x.st === 'due')
    .sort((a, b) => (a.st === b.st ? 0 : a.st === 'expired' ? -1 : 1));

  return (
    <Screen scroll>
      <ScreenTitle title={v.name} subtitle={`IMO ${v.imo} · ${t('fv.supt')}`} />
      <View style={styles.tabs}>
        {([['certs', `${t('fleet.certs')} · ${certs.length}`], ['docs', `${t('docs.title')} · ${docs.length}`], ['equipment', `${t('cat.title')} · ${owed.length}`]] as [Tab, string][]).map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'certs' ? (
        <>
          <TouchableOpacity onPress={() => setCert({ id: uid('cert'), name: '', scope: 'vessel', itemIds: [], createdAt: Date.now(), updatedAt: Date.now() })} style={styles.addRow}>
            <Text style={styles.link}>{t('crew.addCert')}</Text>
          </TouchableOpacity>
          {SCOPES.map(({ key, label }) => {
            const list = certs.filter((c) => scopeOf(c) === key);
            if (!list.length) return null;
            return (
              <View key={key}>
                <Label>{label}</Label>
                {list.map((c) => (
                  <TouchableOpacity key={c.id} style={styles.row} onPress={() => setCert(c)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title} numberOfLines={1}>{c.name}</Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {[c.holderName, c.number, c.issuer, c.expiryDate ? t('crew.expires', { date: formatDate(c.expiryDate) }) : t('cm.noExpiry')].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <StatusPill status={statusFromDate(c.expiryDate)} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
          {!certs.length ? <Empty text={t('fv.noCerts')} /> : null}
        </>
      ) : tab === 'docs' ? (
        <>
          <TouchableOpacity
            onPress={() => setDocEdit({ isNew: true, doc: { id: uid('doc'), title: '', category: 'procedure', revision: 1, issued: todayIso(), mustRead: true, updatedAt: Date.now() } })}
            style={styles.addRow}
          >
            <Text style={styles.link}>{t('fv.addDoc')}</Text>
          </TouchableOpacity>
          {docs.map((d) => {
            const st = readStatus(d, v.acks, v.crew);
            return (
              <TouchableOpacity key={d.id} style={styles.row} onPress={() => setDocEdit({ doc: d, isNew: false })}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>{d.title}</Text>
                  <Text style={styles.sub} numberOfLines={2}>
                    {[d.docNo, t('docs.rev', { n: d.revision }), DOC_CATEGORY_LABEL[d.category]].filter(Boolean).join(' · ')}
                    {d.mustRead !== false && st.unread.length ? `\nNot signed: ${st.unread.map((p) => p.name).join(', ')}` : ''}
                  </Text>
                </View>
                {d.mustRead !== false && st.required ? (
                  <Text style={[styles.count, { color: st.unread.length ? COLORS.warning : COLORS.success }]}>{`${st.read.length}/${st.required}`}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          {!docs.length ? <Empty text={t('fv.noDocs')} /> : null}
        </>
      ) : (
        <>
          {owed.map(({ it, st }) => (
            <View key={it.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{(it as any).name || (it as any).description || (it as any).serial || t('def.item')}</Text>
                <Text style={styles.sub} numberOfLines={1}>{[CATEGORY_MAP[(it as any).category]?.label, (it as any).location].filter(Boolean).join(' · ')}</Text>
              </View>
              <StatusPill status={st} />
            </View>
          ))}
          {!owed.length ? <Empty text={t('fv.noOwed')} /> : null}
        </>
      )}

      {cert ? <CertEditor imo={imo} cert={cert} crew={v.crew} onClose={() => setCert(null)} onSaved={() => { setCert(null); void load(); }} /> : null}
      {docEdit ? <DocEditor imo={imo} start={docEdit.doc} isNew={docEdit.isNew} onClose={() => setDocEdit(null)} onSaved={() => { setDocEdit(null); void load(); }} /> : null}
    </Screen>
  );
}

// ---- certificate editor ---------------------------------------------------------

function CertEditor({ imo, cert, crew, onClose, onSaved }: { imo: string; cert: Certificate; crew: VesselData['crew']; onClose: () => void; onSaved: () => void }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [c, setC] = useState<Certificate>(cert);
  const [busy, setBusy] = useState(false);
  const isNew = !cert.name;
  const set = (p: Partial<Certificate>) => setC((x) => ({ ...x, ...p }));
  const people = crew.filter((p) => p.active && !p.deleted);

  const save = async (remove = false) => {
    if (!remove && !c.name.trim()) return Alert.alert(t('crew.nameReq'), t('fv.nameCert'));
    setBusy(true);
    try {
      await shore.saveCertificate(imo, { ...c, name: c.name.trim() }, remove);
      onSaved();
    } catch (e: any) {
      Alert.alert(t('fv.notSaved'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const attach = async () => {
    const f = await pickDocument();
    if (!f) return;
    setBusy(true);
    try {
      const url = await shore.uploadFile(imo, c.id, `cert_${c.id}`, await toDataUri(f.uri, f.name ?? 'file'));
      set({ fileUri: url, fileName: f.name ?? 'file', fileKind: f.kind });
    } catch (e: any) {
      Alert.alert(t('fv.notUploaded'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={isNew ? t('fv.newCert') : t('fv.cert')} onClose={onClose} onSave={() => void save()} busy={busy}>
      <Label>{t('fv.kind')}</Label>
      <View style={styles.chips}>
        {SCOPES.map((s) => (
          <TouchableOpacity key={s.key} style={[styles.chip, scopeOf(c) === s.key && styles.chipOn]} onPress={() => set({ scope: s.key })}>
            <Text style={[styles.chipText, scopeOf(c) === s.key && styles.chipTextOn]}>{tk(`certs.tab.${s.key}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {scopeOf(c) === 'crew' ? (
        <>
          <Label>{t('fv.holder')}</Label>
          <View style={styles.chips}>
            {people.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.chip, c.crewId === p.id && styles.chipOn]} onPress={() => set({ crewId: p.id, holderName: p.name })}>
                <Text style={[styles.chipText, c.crewId === p.id && styles.chipTextOn]}>{p.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
      <Label>{t('mt.namePh')}</Label>
      <TextInput style={styles.input} value={c.name} onChangeText={(t) => set({ name: t })} placeholder={t('fv.certPh')} placeholderTextColor={COLORS.textLight} />
      <Label>{t('fv.number')}</Label>
      <TextInput style={styles.input} value={c.number ?? ''} onChangeText={(t) => set({ number: t })} placeholder="—" placeholderTextColor={COLORS.textLight} />
      <Label>{t('fv.issuedBy')}</Label>
      <TextInput style={styles.input} value={c.issuer ?? ''} onChangeText={(t) => set({ issuer: t })} placeholder={t('fv.issuerPh')} placeholderTextColor={COLORS.textLight} />
      <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
        <View style={{ flex: 1 }}><SimpleDatePicker label={t('fv.issued')} value={c.issueDate} onChange={(d) => set({ issueDate: d })} /></View>
        <View style={{ flex: 1 }}><SimpleDatePicker label={t('fv.expires')} value={c.expiryDate} onChange={(d) => set({ expiryDate: d })} onClear={() => set({ expiryDate: undefined })} /></View>
      </View>
      <TouchableOpacity style={styles.fileBtn} onPress={() => void attach()}>
        <MciIcon name="paperclip" size={18} color={COLORS.primary} />
        <Text style={styles.link} numberOfLines={1}>{c.fileName ? `${c.fileName} — ${t('fv.replace')}` : t('fv.attachCert')}</Text>
      </TouchableOpacity>
      {!isNew ? (
        <TouchableOpacity
          style={styles.delete}
          onPress={() => Alert.alert(t('fv.removeCert'), t('fv.removeCertBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.remove'), style: 'destructive', onPress: () => void save(true) }])}
        >
          <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('fv.removeCert')}</Text>
        </TouchableOpacity>
      ) : null}
    </Sheet>
  );
}

// ---- document editor -------------------------------------------------------------

function DocEditor({ imo, start, isNew, onClose, onSaved }: { imo: string; start: IsmDoc; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [d, setD] = useState<IsmDoc>(start);
  const [bump, setBump] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<IsmDoc>) => setD((x) => ({ ...x, ...p }));
  const revision = bump ? start.revision + 1 : d.revision;

  const attach = async () => {
    const f = await pickDocument();
    if (!f) return;
    setBusy(true);
    try {
      const dataUri = await toDataUri(f.uri, f.name ?? 'document.pdf');
      const url = await shore.uploadFile(imo, d.id, `doc_${d.id}_r${revision}`, dataUri);
      // The words inside, so the crew can search the document by them.
      const text = await pdfText(dataUri).catch(() => null);
      set({ fileUri: url, fileName: f.name ?? 'document.pdf', filePending: false, ...(text ? { text } : {}) });
    } catch (e: any) {
      Alert.alert(t('fv.notUploaded'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const save = async (withdraw = false) => {
    if (!withdraw && !d.title.trim()) return Alert.alert(t('risk.titleReq'), t('fv.nameDoc'));
    if (!withdraw && !d.body?.trim() && !d.fileUri) return Alert.alert(t('fv.nothingRead'), t('fv.attachOrWrite'));
    setBusy(true);
    try {
      await shore.saveDoc(imo, {
        ...d,
        title: d.title.trim(),
        revision,
        issued: bump ? todayIso() : d.issued,
        ...(withdraw ? { deleted: true } : {}),
        updatedAt: Date.now(),
      });
      onSaved();
    } catch (e: any) {
      Alert.alert(t('fv.notSaved'), e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={isNew ? t('fv.newDoc') : bump ? t('fv.issueRev', { n: revision }) : t('pax.document')} onClose={onClose} onSave={() => void save()} busy={busy} saveLabel={bump ? t('fv.issue') : t('common.save')}>
      <Label>{t('fv.titleReq')}</Label>
      <TextInput style={styles.input} value={d.title} onChangeText={(t) => set({ title: t })} placeholder={t('fv.docPh')} placeholderTextColor={COLORS.textLight} />
      <Label>{t('docs.no')}</Label>
      <TextInput style={styles.input} value={d.docNo ?? ''} onChangeText={(t) => set({ docNo: t })} placeholder="SMS-07-03" placeholderTextColor={COLORS.textLight} />
      <Label>{t('fv.type')}</Label>
      <View style={styles.chips}>
        {(Object.keys(DOC_CATEGORY_LABEL) as DocCategory[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, d.category === k && styles.chipOn]} onPress={() => set({ category: k })}>
            <Text style={[styles.chipText, d.category === k && styles.chipTextOn]}>{DOC_CATEGORY_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ marginTop: SIZES.sm }}>
        <SimpleDatePicker label={t('docs.reviewDueCap')} value={d.reviewDue} onChange={(x) => set({ reviewDue: x })} onClear={() => set({ reviewDue: undefined })} />
      </View>
      <TouchableOpacity style={styles.fileBtn} onPress={() => void attach()}>
        <MciIcon name="paperclip" size={18} color={COLORS.primary} />
        <Text style={styles.link} numberOfLines={1}>{d.fileName ? `${d.fileName} — ${t('fv.replace')}` : t('fv.attachFile')}</Text>
      </TouchableOpacity>
      <Label>{t('fv.text')}</Label>
      <TextInput style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} value={d.body ?? ''} onChangeText={(t) => set({ body: t })} multiline placeholder="—" placeholderTextColor={COLORS.textLight} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: SIZES.md }}>
        <Text style={[styles.title, { flex: 1 }]}>{t('docs.mustRead')}</Text>
        <Switch value={d.mustRead !== false} onValueChange={(x) => set({ mustRead: x })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
      </View>
      {!isNew ? (
        <>
          <TouchableOpacity style={styles.outline} onPress={() => setBump((b) => !b)}>
            <Text style={styles.link}>{bump ? t('fv.keepRev', { n: start.revision }) : t('fv.newRev', { n: start.revision + 1 })}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.delete}
            onPress={() => Alert.alert(t('fv.withdraw'), t('fv.withdrawBody'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('fv.withdrawBtn'), style: 'destructive', onPress: () => void save(true) }])}
          >
            <Text style={{ color: COLORS.danger, fontWeight: '700' }}>{t('fv.withdraw')}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </Sheet>
  );
}

function Sheet({ title, children, onClose, onSave, busy, saveLabel = t('common.save') }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; busy: boolean; saveLabel?: string }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Text style={[styles.link, { color: COLORS.textLight }]}>{t('common.cancel')}</Text></TouchableOpacity>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onSave} disabled={busy} hitSlop={8}><Text style={[styles.link, busy && { opacity: 0.5 }]}>{busy ? '…' : saveLabel}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: SIZES.lg }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.md, flexWrap: 'wrap' },
    tab: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    tabOn: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    tabTextOn: { color: COLORS.textWhite },
    addRow: { alignSelf: 'flex-end', marginBottom: SIZES.sm },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    count: { fontSize: SIZES.body, fontWeight: '800' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4, marginBottom: SIZES.xs },
    fileBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.md },
    outline: { marginTop: SIZES.lg, padding: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
    delete: { marginTop: SIZES.md, padding: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md },
    sheet: { backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusLg, padding: SIZES.lg, width: '100%', maxWidth: 560, maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
    sheetTitle: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
  });
