// ===================================
// Certificate detail — edit, attach a file, delete; then by kind:
//   equipment — link the items it covers;
//   crew      — choose whose it is, from the crew list;
//   vessel    — nothing more: the ship holds it.
// A row of suggested names sits under the name field for crew and vessel, so the
// same document is spelt the same way everywhere (constants/certificateTypes.ts).
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { BackButton, CategoryBadge, Label, StatusPill } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useData } from '../contexts/DataContext';
import { Certificate, scopeOf } from '../types/certificate';
import { liveCrew, crewLabel } from '../types/crew';
import { CREW_CERT_TYPES, VESSEL_CERT_TYPES } from '../constants/certificateTypes';
import { CATEGORY_MAP, catShort } from '../constants/categories';
import { statusFromDate, formatDate } from '../utils/dates';
import { pickDocument, pickFromLibrary, pickFromCamera, openFile, deleteFile, resolveUri, toDataUri, PickedFile } from '../services/attachments';
import { playSuccessSound } from '../utils/sound';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { goBackOr } from '../utils/nav';
import { moduleOn } from '../constants/modules';
import { CertSurveys } from '../components/CertSurveys';
import { certSurveySummary, worstOf } from '../services/certSurveys';
import { todayIso } from '../services/pms';
import { aiCall, aiReady, CertAiResult } from '../services/ai';
import { useSync } from '../contexts/SyncContext';
import { t, useT } from '../utils/i18n';

export default function CertificateDetailSc() {
  useT();
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useS();
  const { certificates, flat, crew, saveCertificate, removeCertificate, loading, surveys, surveysDone } = useData();

  const sync = useSync();
  const id: string | null = route.params?.id ?? null;
  const existing = useMemo(() => certificates.find((c) => c.id === id), [certificates, id]);
  const [aiScanning, setAiScanning] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  /**
   * A placeholder so that everything below can assume a certificate. It is never
   * shown and never saved: while `missing` is true the screen renders the held
   * frame below instead of the form.
   */
  const placeholder = (): Certificate => ({
    // A blank id on purpose: it must never equal the real certificate's, or the
    // adoption below would mistake the placeholder for an already-adopted draft.
    id: '',
    name: '',
    itemIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const seed: Certificate | undefined = existing ?? route.params?.draft;
  const [draft, setDraft] = useState<Certificate>(seed ?? placeholder);
  const missing = !seed && !existing;
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const isNew = !existing;

  /**
   * THE CERTIFICATE MAY ARRIVE AFTER THIS SCREEN DOES — same as ItemDetailSc, and
   * worse here: `draft` was seeded from `existing ?? route.params.draft`, and on a
   * cold start by URL (/certificate/<id> reloaded, bookmarked or pasted) BOTH are
   * undefined, so the next line read `draft.itemIds` and the screen went white.
   * Reproduced against production on 30 Sep 2026.
   */
  const touched = useRef(false);
  useEffect(() => {
    if (!existing || touched.current) return;
    setDraft((d) => (d.id === existing.id ? d : existing));
  }, [existing]);

  const set = (patch: Partial<Certificate>) => {
    touched.current = true;
    setDraft((d) => ({ ...d, ...patch }));
  };

  const linkedItems = useMemo(
    () => flat.filter((it) => draft.itemIds.includes(it.id)),
    [flat, draft.itemIds]
  );

  const scope = scopeOf(draft);
  const people = useMemo(
    () => liveCrew(crew).filter((m) => m.active || m.id === draft.crewId).sort((a, b) => a.name.localeCompare(b.name)),
    [crew, draft.crewId]
  );
  const holder = draft.crewId ? crew.find((m) => m.id === draft.crewId) : undefined;

  const onSave = async () => {
    if (!draft.name.trim()) {
      Alert.alert(t('crew.nameReq'), t('fv.nameCert'));
      return;
    }
    if (scope === 'crew' && !draft.crewId && !draft.holderName?.trim()) {
      Alert.alert(t('cd.whose'), t('cd.chooseHolder'));
      return;
    }
    // The holder's name travels with the certificate, so it still reads right on a
    // device whose crew list does not have this person (types/certificate.ts).
    const holderName = holder ? holder.name : draft.holderName;
    await saveCertificate({ ...draft, holderName, updatedAt: Date.now() });
    playSuccessSound();
    goBackOr(nav);
  };

  const onDelete = () => {
    if (isNew) return goBackOr(nav);
    Alert.alert(t('cd.delete'), t('cd.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteFile(draft.fileUri);
          await removeCertificate(draft.id);
          goBackOr(nav);
        },
      },
    ]);
  };

  const attach = (picker: () => Promise<PickedFile | null>) => async () => {
    const f = await picker();
    if (!f) return;
    if (draft.fileUri) await deleteFile(draft.fileUri);
    set({ fileUri: f.uri, fileName: f.name, fileKind: f.kind });
  };

  const chooseFile = () => {
    Alert.alert(t('cd.attach'), t('cd.source'), [
      { text: t('pick.document'), onPress: attach(pickDocument) },
      { text: t('pick.library'), onPress: attach(pickFromLibrary) },
      { text: t('pick.camera'), onPress: attach(pickFromCamera) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const scanCert = () => {
    Alert.alert(t('cd.scanAi'), t('cd.scanAiBody'), [
      {
        text: t('pick.camera'),
        onPress: async () => {
          const f = await pickFromCamera();
          if (!f) return;
          setAiScanning(true);
          setAiNote(null);
          try {
            const dataUri = await toDataUri(f.uri, f.name ?? 'cert.jpg');
            const mediaType = dataUri.slice(5, dataUri.indexOf(';'));
            const data = dataUri.slice(dataUri.indexOf(',') + 1);
            const res = await aiCall<CertAiResult>('cert', { mediaType, data, scope });
            const patch: Partial<typeof draft> = {};
            if (res.name && !draft.name) patch.name = res.name;
            if (res.number && !draft.number) patch.number = res.number;
            if (res.issuer && !draft.issuer) patch.issuer = res.issuer;
            if (res.issueDate && !draft.issueDate) patch.issueDate = res.issueDate;
            if (res.expiryDate && !draft.expiryDate) patch.expiryDate = res.expiryDate;
            if (res.holder && scope === 'crew' && !draft.crewId && !draft.holderName) patch.holderName = res.holder;
            set(patch);
            const fields = [res.name && 'name', res.number && 'number', res.issuer && 'issuer', res.issueDate && 'issue date', res.expiryDate && 'expiry'].filter(Boolean).join(', ');
            setAiNote(`${t('sr.read', { what: fields || t('cd.nothing') })}${res.unreadable ? ` · ${t('dpt.couldNot', { what: res.unreadable })}` : ''}. ${t('cd.checkFields')}`);
          } catch (e: any) {
            Alert.alert('AI scan', String(e?.message ?? e));
          } finally {
            setAiScanning(false);
          }
        },
      },
      {
        text: t('pick.library'),
        onPress: async () => {
          const f = await pickFromLibrary();
          if (!f) return;
          setAiScanning(true);
          setAiNote(null);
          try {
            const dataUri = await toDataUri(f.uri, f.name ?? 'cert.jpg');
            const mediaType = dataUri.slice(5, dataUri.indexOf(';'));
            const data = dataUri.slice(dataUri.indexOf(',') + 1);
            const res = await aiCall<CertAiResult>('cert', { mediaType, data, scope });
            const patch: Partial<typeof draft> = {};
            if (res.name && !draft.name) patch.name = res.name;
            if (res.number && !draft.number) patch.number = res.number;
            if (res.issuer && !draft.issuer) patch.issuer = res.issuer;
            if (res.issueDate && !draft.issueDate) patch.issueDate = res.issueDate;
            if (res.expiryDate && !draft.expiryDate) patch.expiryDate = res.expiryDate;
            if (res.holder && scope === 'crew' && !draft.crewId && !draft.holderName) patch.holderName = res.holder;
            set(patch);
            const fields = [res.name && 'name', res.number && 'number', res.issuer && 'issuer', res.issueDate && 'issue date', res.expiryDate && 'expiry'].filter(Boolean).join(', ');
            setAiNote(`${t('sr.read', { what: fields || t('cd.nothing') })}${res.unreadable ? ` · ${t('dpt.couldNot', { what: res.unreadable })}` : ''}. ${t('cd.checkFields')}`);
          } catch (e: any) {
            Alert.alert('AI scan', String(e?.message ?? e));
          } finally {
            setAiScanning(false);
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const toggleItem = (itemId: string) => {
    const has = draft.itemIds.includes(itemId);
    set({ itemIds: has ? draft.itemIds.filter((x) => x !== itemId) : [...draft.itemIds, itemId] });
  };

  const pickList = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = needle
      ? flat.filter((it) =>
          [it.type, it.serial, it.position, catShort(it.category)].some((v) =>
            v?.toLowerCase().includes(needle)
          )
        )
      : flat;
    return base.slice(0, 200);
  }, [flat, search]);

  const withSurveys = scope === 'vessel' && moduleOn('surveys');
  // A certificate whose survey window has closed un-endorsed is not valid, whatever its expiry says.
  const status = withSurveys
    ? worstOf(statusFromDate(draft.expiryDate), certSurveySummary(draft.id, surveys, surveysDone, todayIso()).status)
    : statusFromDate(draft.expiryDate);

  if (missing) {
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <BackButton onPress={() => goBackOr(nav)} />
            <Text style={styles.headerTitle} numberOfLines={1}>{t('fv.cert')}</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: SIZES.lg }}>
            {loading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={{ color: COLORS.textLight, textAlign: 'center' }}>
                {t('cd.gone')}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => (picking ? setPicking(false) : goBackOr(nav))} />
          <Text style={styles.headerTitle} numberOfLines={1}>
            {picking ? t('cd.linkItems') : t(`cd.h.${isNew ? 'new' : 'edit'}.${scope === 'crew' ? 'crew' : scope === 'vessel' ? 'vessel' : 'equipment'}` as any)}
          </Text>
          {picking ? (
            <TouchableOpacity onPress={() => setPicking(false)} hitSlop={12}>
              <Text style={[styles.headerBtn, { color: COLORS.primary, fontWeight: '700' }]}>{t('common.done')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onSave} hitSlop={12}>
              <Text style={[styles.headerBtn, { color: COLORS.primary, fontWeight: '700' }]}>{t('common.save')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {picking ? (
          <>
            <TextInput
              style={[styles.input, { marginHorizontal: SIZES.lg }]}
              placeholder={t('cd.searchPh')}
              placeholderTextColor={COLORS.textLight}
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={pickList}
              keyExtractor={(it) => it.id}
              contentContainerStyle={{ padding: SIZES.lg, paddingTop: SIZES.sm }}
              renderItem={({ item }) => {
                const on = draft.itemIds.includes(item.id);
                const meta = CATEGORY_MAP[item.category];
                return (
                  <TouchableOpacity style={styles.pickRow} onPress={() => toggleItem(item.id)} activeOpacity={0.7}>
                    <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                    <CategoryBadge category={item.category} size={18} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickTitle} numberOfLines={1}>
                        {item.type || (item.no != null ? `#${item.no}` : catShort(meta))}
                      </Text>
                      <Text style={styles.pickSub} numberOfLines={1}>
                        {catShort(meta)}
                        {item.serial ? ` · S/N ${item.serial}` : ''}
                        {item.position ? ` · ${item.position}` : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </>
        ) : (
          <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
            <View style={styles.titleRow}>
              <MciIcon name={scope === 'crew' ? 'card-account-details' : scope === 'vessel' ? 'ferry' : 'certificate'} size={32} />
              {!isNew ? <StatusPill status={status} /> : null}
              {aiReady(sync.enrolled) ? (
                <TouchableOpacity
                  style={styles.aiBtn}
                  onPress={aiScanning ? undefined : scanCert}
                  disabled={aiScanning}
                  hitSlop={10}
                >
                  {aiScanning
                    ? <ActivityIndicator size="small" color={COLORS.primary} />
                    : <><MciIcon name="camera-outline" size={16} color={COLORS.primary} /><Text style={styles.aiBtnText}>{` ${t('cd.scanWithAi')}`}</Text></>
                  }
                </TouchableOpacity>
              ) : null}
            </View>
            {aiNote ? <Text style={styles.aiNote}>{aiNote}</Text> : null}

            {scope === 'crew' ? (
              <View style={styles.fieldWrap}>
                <Label>{t('cd.holderReq')}</Label>
                {people.length === 0 ? (
                  // No crew list on this device (not joined to a vessel yet, or not
                  // synced): the holder is typed instead of picked, and the name is
                  // kept on the certificate either way.
                  <TextInput
                    style={styles.input}
                    value={draft.holderName ?? ''}
                    onChangeText={(v) => set({ holderName: v, crewId: undefined })}
                    placeholder={t('crw.fullName')}
                    placeholderTextColor={COLORS.textLight}
                  />
                ) : (
                  <View style={styles.chips}>
                    {people.map((m) => {
                      const on = m.id === draft.crewId;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => set({ crewId: m.id, holderName: m.name })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{crewLabel(m)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            <Field label={t('cd.nameReq')} value={draft.name} onChange={(v) => set({ name: v })} />
            {scope !== 'equipment' ? (
              <View style={[styles.chips, { marginTop: -SIZES.sm, marginBottom: SIZES.md }]}>
                {(scope === 'crew' ? CREW_CERT_TYPES : VESSEL_CERT_TYPES).map((t) => (
                  <TouchableOpacity key={t} style={[styles.chip, styles.chipSmall, draft.name === t && styles.chipOn]} onPress={() => set({ name: t })}>
                    <Text style={[styles.chipSmallText, draft.name === t && styles.chipTextOn]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <Field label={t('fv.number')} value={draft.number} onChange={(v) => set({ number: v })} />
            <Field
              label={scope === 'crew' ? t('cd.issuerCrew') : scope === 'vessel' ? t('cd.issuerVessel') : t('cd.issuerEq')}
              value={draft.issuer}
              onChange={(v) => set({ issuer: v })}
            />
            <DateField label={t('cd.issueDate')} value={draft.issueDate} onChange={(v) => set({ issueDate: v })} />
            <DateField label={t('cd.expiryReq')} value={draft.expiryDate} onChange={(v) => set({ expiryDate: v })} defaultYear={new Date().getFullYear() + 5} />

            {/* File */}
            <View style={styles.card}>
              <Label>{t('cd.file')}</Label>
              {draft.fileUri ? (
                <View style={{ marginTop: SIZES.sm }}>
                  {draft.fileKind === 'photo' ? (
                    <Image source={{ uri: resolveUri(draft.fileUri) }} style={styles.preview} resizeMode="cover" />
                  ) : (
                    <View style={styles.docRow}>
                      <MciIcon name="file-document" size={28} color={COLORS.primaryDark} />
                      <Text style={styles.docName} numberOfLines={1}>
                        {draft.fileName ?? t('pax.document')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.fileBtns}>
                    <TouchableOpacity style={styles.smallBtn} onPress={() => openFile(draft.fileUri!, draft.fileName)}>
                      <Text style={styles.smallBtnText}>{t('cd.open')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallBtn} onPress={chooseFile}>
                      <Text style={styles.smallBtnText}>{t('sop.replace')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: COLORS.danger }]}
                      onPress={async () => {
                        await deleteFile(draft.fileUri);
                        set({ fileUri: undefined, fileName: undefined, fileKind: undefined });
                      }}
                    >
                      <Text style={[styles.smallBtnText, { color: COLORS.danger }]}>{t('common.remove')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachBtn} onPress={chooseFile}>
                  <Text style={styles.attachText}>{t('cd.attachDoc')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {withSurveys ? <CertSurveys cert={draft} stored={existing} onScheme={(v) => set({ surveyScheme: v })} /> : null}

            {/* Linked items — equipment certificates only */}
            {scope === 'equipment' ? (
            <View style={styles.card}>
              <View style={styles.linkHead}>
                <Label>{t('cd.covered', { n: draft.itemIds.length })}</Label>
                <TouchableOpacity onPress={() => setPicking(true)}>
                  <Text style={styles.linkAdd}>{`+ ${t('cd.linkItems')}`}</Text>
                </TouchableOpacity>
              </View>
              {linkedItems.length === 0 ? (
                <Text style={styles.empty}>{t('cd.noLinked')}</Text>
              ) : (
                linkedItems.map((it) => {
                  const meta = CATEGORY_MAP[it.category];
                  return (
                    <View key={it.id} style={styles.linkedRow}>
                      <CategoryBadge category={it.category} size={18} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linkedTitle} numberOfLines={1}>
                          {it.type || (it.no != null ? `#${it.no}` : catShort(meta))}
                        </Text>
                        <Text style={styles.linkedSub} numberOfLines={1}>
                          {catShort(meta)}
                          {it.serial ? ` · S/N ${it.serial}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleItem(it.id)} hitSlop={10}>
                        <Text style={styles.unlink}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </View>
            ) : null}

            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteText}>{isNew ? t('doc.discard') : t('cd.delete')}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const COLORS = useTheme();
  const styles = useS();
  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={value ?? ''} onChangeText={onChange} placeholder="—" placeholderTextColor={COLORS.textLight} />
    </View>
  );
}

function DateField({
  label,
  value,
  onChange,
  defaultYear,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  defaultYear?: number;
}) {
  const styles = useS();
  return (
    <View style={styles.fieldWrap}>
      <SimpleDatePicker label={label} value={value} onChange={onChange} defaultYear={defaultYear} />
    </View>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
  },
  headerBtn: { fontSize: SIZES.h5, color: COLORS.text },
  headerTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.xs, flexWrap: 'wrap' },
  aiBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 999, paddingHorizontal: SIZES.sm, paddingVertical: 5, marginLeft: 'auto' },
  aiBtnText: { color: COLORS.primary, fontSize: SIZES.small, fontWeight: '600' },
  aiNote: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: SIZES.md, lineHeight: 18 },
  emoji: { fontSize: 34 },
  fieldWrap: { marginBottom: SIZES.md },
  input: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginTop: 4,
  },
  dateHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2, marginLeft: 4 },
  card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.sm },
  preview: { width: '100%', height: 200, borderRadius: SIZES.radiusSm, backgroundColor: COLORS.borderLight },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
  docName: { flex: 1, fontSize: SIZES.body, color: COLORS.text },
  fileBtns: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
  smallBtn: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: SIZES.radiusSm, borderWidth: 1, borderColor: COLORS.primary },
  smallBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
  attachBtn: {
    marginTop: SIZES.sm,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  attachText: { color: COLORS.primary, fontWeight: '600' },
  linkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.xs },
  linkAdd: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  empty: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.xs },
  linkedRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  linkedTitle: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
  linkedSub: { fontSize: SIZES.small, color: COLORS.textLight },
  unlink: { color: COLORS.danger, fontSize: SIZES.h5, fontWeight: '700' },
  deleteBtn: { marginTop: SIZES.lg, paddingVertical: SIZES.md, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.danger, alignItems: 'center' },
  deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
  chip: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary, maxWidth: '100%' },
  chipOn: { backgroundColor: COLORS.primary },
  chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
  chipTextOn: { color: COLORS.textWhite },
  chipSmall: { paddingVertical: 4, paddingHorizontal: SIZES.sm, borderColor: COLORS.border },
  chipSmallText: { color: COLORS.text, fontSize: SIZES.tiny },
  // picker
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: COLORS.primary },
  checkMark: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small },
  pickEmoji: { width: 22, alignItems: 'center' },
  pickTitle: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
  pickSub: { fontSize: SIZES.tiny, color: COLORS.textLight },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
