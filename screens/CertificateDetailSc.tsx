// ===================================
// Certificate detail — edit, attach a file, link the items it covers, delete.
// ===================================

import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, GLASS, SCREEN_BG } from '../theme';
import { Label, StatusPill, CategoryBadge } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { Certificate } from '../types/certificate';
import { CATEGORY_MAP } from '../constants/categories';
import { statusFromDate, formatDate } from '../utils/dates';
import { pickDocument, pickFromLibrary, pickFromCamera, openFile, deleteFile, PickedFile } from '../services/attachments';
import { playSuccessSound } from '../utils/sound';

export default function CertificateDetailSc() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { certificates, flat, saveCertificate, removeCertificate } = useData();

  const id: string | null = route.params?.id ?? null;
  const existing = useMemo(() => certificates.find((c) => c.id === id), [certificates, id]);
  const [draft, setDraft] = useState<Certificate>(existing ?? route.params.draft);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const isNew = !existing;

  const set = (patch: Partial<Certificate>) => setDraft((d) => ({ ...d, ...patch }));

  const linkedItems = useMemo(
    () => flat.filter((it) => draft.itemIds.includes(it.id)),
    [flat, draft.itemIds]
  );

  const onSave = async () => {
    if (!draft.name.trim()) {
      Alert.alert('Name required', 'Give the certificate a name.');
      return;
    }
    await saveCertificate({ ...draft, updatedAt: Date.now() });
    playSuccessSound();
    nav.goBack();
  };

  const onDelete = () => {
    if (isNew) return nav.goBack();
    Alert.alert('Delete certificate', 'Remove this certificate? The items it covered are not deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteFile(draft.fileUri);
          await removeCertificate(draft.id);
          nav.goBack();
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
    Alert.alert('Attach file', 'Choose a source', [
      { text: 'Document (PDF…)', onPress: attach(pickDocument) },
      { text: 'Photo Library', onPress: attach(pickFromLibrary) },
      { text: 'Camera', onPress: attach(pickFromCamera) },
      { text: 'Cancel', style: 'cancel' },
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
          [it.type, it.serial, it.position, CATEGORY_MAP[it.category].short].some((v) =>
            v?.toLowerCase().includes(needle)
          )
        )
      : flat;
    return base.slice(0, 200);
  }, [flat, search]);

  const status = statusFromDate(draft.expiryDate);

  return (
    <LinearGradient colors={SCREEN_BG.gradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => (picking ? setPicking(false) : nav.goBack())} hitSlop={12}>
            <Text style={styles.headerBtn}>{picking ? '‹ Back' : '✕'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {picking ? 'Link items' : isNew ? 'New certificate' : 'Edit certificate'}
          </Text>
          {picking ? (
            <TouchableOpacity onPress={() => setPicking(false)} hitSlop={12}>
              <Text style={[styles.headerBtn, { color: COLORS.primary, fontWeight: '700' }]}>Done</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={onSave} hitSlop={12}>
              <Text style={[styles.headerBtn, { color: COLORS.primary, fontWeight: '700' }]}>Save</Text>
            </TouchableOpacity>
          )}
        </View>

        {picking ? (
          <>
            <TextInput
              style={[styles.input, { marginHorizontal: SIZES.lg }]}
              placeholder="Search items to link…"
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
                        {item.type || (item.no != null ? `#${item.no}` : meta.short)}
                      </Text>
                      <Text style={styles.pickSub} numberOfLines={1}>
                        {meta.short}
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
              <Text style={styles.emoji}>{draft.fileKind === 'photo' ? '🖼️' : '📜'}</Text>
              {!isNew ? <StatusPill status={status} /> : null}
            </View>

            <Field label="Certificate name ★" value={draft.name} onChange={(v) => set({ name: v })} />
            <Field label="Number" value={draft.number} onChange={(v) => set({ number: v })} />
            <Field label="Issuer / station" value={draft.issuer} onChange={(v) => set({ issuer: v })} />
            <DateField label="Issue date" value={draft.issueDate} onChange={(v) => set({ issueDate: v })} />
            <DateField label="Expiry date ★" value={draft.expiryDate} onChange={(v) => set({ expiryDate: v })} />

            {/* File */}
            <View style={styles.card}>
              <Label>Certificate file</Label>
              {draft.fileUri ? (
                <View style={{ marginTop: SIZES.sm }}>
                  {draft.fileKind === 'photo' ? (
                    <Image source={{ uri: draft.fileUri }} style={styles.preview} resizeMode="cover" />
                  ) : (
                    <View style={styles.docRow}>
                      <Text style={{ fontSize: 28 }}>📄</Text>
                      <Text style={styles.docName} numberOfLines={1}>
                        {draft.fileName ?? 'Document'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.fileBtns}>
                    <TouchableOpacity style={styles.smallBtn} onPress={() => openFile(draft.fileUri!)}>
                      <Text style={styles.smallBtnText}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.smallBtn} onPress={chooseFile}>
                      <Text style={styles.smallBtnText}>Replace</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.smallBtn, { borderColor: COLORS.danger }]}
                      onPress={async () => {
                        await deleteFile(draft.fileUri);
                        set({ fileUri: undefined, fileName: undefined, fileKind: undefined });
                      }}
                    >
                      <Text style={[styles.smallBtnText, { color: COLORS.danger }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={styles.attachBtn} onPress={chooseFile}>
                  <Text style={styles.attachText}>＋ Attach document or photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Linked items */}
            <View style={styles.card}>
              <View style={styles.linkHead}>
                <Label>Covered items ({draft.itemIds.length})</Label>
                <TouchableOpacity onPress={() => setPicking(true)}>
                  <Text style={styles.linkAdd}>＋ Link items</Text>
                </TouchableOpacity>
              </View>
              {linkedItems.length === 0 ? (
                <Text style={styles.empty}>No items linked. Tap “Link items” to attach this certificate to a group of items.</Text>
              ) : (
                linkedItems.map((it) => {
                  const meta = CATEGORY_MAP[it.category];
                  return (
                    <View key={it.id} style={styles.linkedRow}>
                      <CategoryBadge category={it.category} size={18} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.linkedTitle} numberOfLines={1}>
                          {it.type || (it.no != null ? `#${it.no}` : meta.short)}
                        </Text>
                        <Text style={styles.linkedSub} numberOfLines={1}>
                          {meta.short}
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

            <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
              <Text style={styles.deleteText}>{isNew ? 'Discard' : 'Delete certificate'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Field({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      <TextInput style={styles.input} value={value ?? ''} onChangeText={onChange} placeholder="—" placeholderTextColor={COLORS.textLight} />
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Label>{label} (YYYY-MM-DD)</Label>
      <TextInput
        style={styles.input}
        value={value ?? ''}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={COLORS.textLight}
        autoCapitalize="none"
      />
      {value ? <Text style={styles.dateHint}>{formatDate(value)}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.md,
  },
  headerBtn: { fontSize: SIZES.h5, color: COLORS.text },
  headerTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  emoji: { fontSize: 34 },
  fieldWrap: { marginBottom: SIZES.md },
  input: {
    ...GLASS.input,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginTop: 4,
  },
  dateHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2, marginLeft: 4 },
  card: { ...GLASS.card, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.sm },
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
  // picker
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...GLASS.card, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: COLORS.primary },
  checkMark: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small },
  pickEmoji: { width: 22, alignItems: 'center' },
  pickTitle: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
  pickSub: { fontSize: SIZES.tiny, color: COLORS.textLight },
});
