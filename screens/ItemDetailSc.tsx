// ===================================
// Item detail / edit
// View + manual edit of a single equipment item.
// Monthly-check toggles for checklist categories.
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, Platform } from 'react-native';
import PlatformModal from '../components/PlatformModal';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { StatusPill, Label, statusColor, CategoryBadge } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { Attachment, CategoryKey, EquipmentItem } from '../types/equipment';
import { computeStatus, statusFromDate, formatDate } from '../utils/dates';
import { playSuccessSound } from '../utils/sound';
import { uid } from '../utils/id';
import { pickDocument, pickFromLibrary, pickFromCamera, openFile, deleteFile, PickedFile } from '../services/attachments';
import SimpleDatePicker from '../components/SimpleDatePicker';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MAX_ATTACHMENTS = 4;

export default function ItemDetailSc() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useS();
  const { byCategory, saveItem, removeItem, certificates } = useData();

  const category: CategoryKey = route.params.category;
  const id: string | null = route.params.id ?? null;
  const meta = CATEGORY_MAP[category];

  const existing = useMemo(
    () => (id ? (byCategory[category] ?? []).find((x) => x.id === id) : undefined),
    [byCategory, category, id]
  );

  const [draft, setDraft] = useState<EquipmentItem>(
    existing ?? {
      id: route.params.newId ?? `${category}_new`,
      category,
      updatedAt: Date.now(),
    }
  );
  const isNew = !existing;
  const [preview, setPreview] = useState<Attachment | null>(null);
  // Attachment slot size is computed from the grid width so the 4 slots fill
  // the row evenly (no fixed width → no empty gap on the right).
  const [slot, setSlot] = useState(78);

  const set = (patch: Partial<EquipmentItem>) => setDraft((d) => ({ ...d, ...patch }));

  const linkedCerts = useMemo(
    () => certificates.filter((c) => c.itemIds.includes(draft.id)),
    [certificates, draft.id]
  );

  const addAttachment = (picker: () => Promise<PickedFile | null>) => async () => {
    const f = await picker();
    if (!f) return;
    const att: Attachment = { id: uid('att'), kind: f.kind, uri: f.uri, name: f.name, addedAt: Date.now() };
    set({ attachments: [...(draft.attachments ?? []), att] });
  };

  const chooseAttachment = () => {
    Alert.alert('Add attachment', 'Choose a source', [
      // macOS has no camera — omit that source there.
      ...(Platform.OS === 'macos' ? [] : [{ text: 'Camera', onPress: addAttachment(pickFromCamera) }]),
      { text: 'Photo Library', onPress: addAttachment(pickFromLibrary) },
      { text: 'Document (PDF…)', onPress: addAttachment(pickDocument) },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const removeAttachment = async (att: Attachment) => {
    await deleteFile(att.uri);
    set({ attachments: (draft.attachments ?? []).filter((a) => a.id !== att.id) });
  };

  const onSave = async () => {
    await saveItem({ ...draft, updatedAt: Date.now() });
    playSuccessSound();
    nav.goBack();
  };

  const onDelete = () => {
    if (isNew) return nav.goBack();
    Alert.alert('Delete item', 'Remove this item permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeItem(category, draft.id);
          nav.goBack();
        },
      },
    ]);
  };

  const year = new Date().getFullYear();
  const toggleMonth = (m: number) => {
    const key = `${year}-${String(m + 1).padStart(2, '0')}`;
    const mc = { ...(draft.monthlyChecks ?? {}) };
    mc[key] = !mc[key];
    set({ monthlyChecks: mc });
  };

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} hitSlop={12}>
            <Text style={styles.headerBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isNew ? 'New item' : 'Edit item'}
          </Text>
          <TouchableOpacity onPress={onSave} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: COLORS.primary, fontWeight: '700' }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <View style={styles.titleRow}>
            <CategoryBadge category={meta.key} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={styles.catLabel}>{meta.label}</Text>
              {!isNew ? <StatusPill status={computeStatus(draft)} /> : null}
            </View>
          </View>

          <Field label="Type / Description" value={draft.type} onChange={(v) => set({ type: v })} />
          <Field label="No." value={draft.no != null ? String(draft.no) : ''} onChange={(v) => set({ no: v })} />
          <Field label="Serial / ID" value={draft.serial} onChange={(v) => set({ serial: v })} />
          <Field label="Position on vessel" value={draft.position} onChange={(v) => set({ position: v })} />

          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <NumField label="Quantity" value={draft.quantity} onChange={(n) => set({ quantity: n })} />
            </View>
            <View style={{ flex: 1 }}>
              <NumField label="Persons" value={draft.persons} onChange={(n) => set({ persons: n })} />
            </View>
          </View>

          <DateField label="Manufacture date" value={draft.manufactureDate} onChange={(v) => set({ manufactureDate: v })} />
          <DateField
            label={meta.dateField === 'nextInspection' ? 'Next inspection ★' : 'Next inspection'}
            value={draft.nextInspection}
            onChange={(v) => set({ nextInspection: v })}
          />
          <DateField
            label={meta.dateField === 'expiry' ? 'Expiry ★' : 'Expiry'}
            value={draft.expiry}
            onChange={(v) => set({ expiry: v })}
          />

          <Field label="Remarks" value={draft.remarks} onChange={(v) => set({ remarks: v })} multiline />

          {meta.monthly ? (
            <View style={styles.card}>
              <Label>Monthly checks · {year}</Label>
              <View style={styles.months}>
                {MONTHS.map((m, i) => {
                  const key = `${year}-${String(i + 1).padStart(2, '0')}`;
                  const on = !!draft.monthlyChecks?.[key];
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.month, on && styles.monthOn]}
                      onPress={() => toggleMonth(i)}
                    >
                      <Text style={[styles.monthText, on && styles.monthTextOn]}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {draft.extra && Object.keys(draft.extra).length ? (
            <View style={styles.card}>
              <Label>Additional fields (from import)</Label>
              {Object.entries(draft.extra).map(([k, v]) => (
                <View key={k} style={styles.extraRow}>
                  <Text style={styles.extraKey}>{k}</Text>
                  <Text style={styles.extraVal}>{formatExtra(v)}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Photos & documents — up to 4 files, fixed 4-slot grid */}
          <View style={styles.card}>
            <Label>Photos &amp; documents</Label>
            <View
              style={styles.attGrid}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                const s = Math.floor((w - SIZES.sm * (MAX_ATTACHMENTS - 1)) / MAX_ATTACHMENTS);
                if (s > 0 && s !== slot) setSlot(s);
              }}
            >
              {Array.from({ length: MAX_ATTACHMENTS }).map((_, i) => {
                const list = draft.attachments ?? [];
                const a = list[i];
                const box = { width: slot, height: slot };
                if (a) {
                  return (
                    <View key={a.id} style={styles.attItem}>
                      <TouchableOpacity
                        onPress={() => (a.kind === 'photo' ? setPreview(a) : openFile(a.uri))}
                        activeOpacity={0.8}
                      >
                        {a.kind === 'photo' ? (
                          <Image source={{ uri: a.uri }} style={[styles.attThumb, box]} resizeMode="cover" />
                        ) : (
                          <View style={[styles.attThumb, box, styles.attDoc]}>
                            <Text style={{ fontSize: 24 }}>📄</Text>
                            <Text style={styles.attDocName} numberOfLines={1}>
                              {a.name ?? 'Doc'}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.attRemove} onPress={() => removeAttachment(a)} hitSlop={8}>
                        <Text style={styles.attRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
                // first empty slot = Add button; the rest = dashed placeholders
                if (i === list.length) {
                  return (
                    <TouchableOpacity key={`add${i}`} style={[styles.attAdd, box]} onPress={chooseAttachment}>
                      <Text style={styles.attAddPlus}>＋</Text>
                      <Text style={styles.attAddText}>Add</Text>
                    </TouchableOpacity>
                  );
                }
                return <View key={`empty${i}`} style={[styles.attEmpty, box]} />;
              })}
            </View>
            <Text style={styles.attHint}>Up to {MAX_ATTACHMENTS} files</Text>
          </View>

          {/* Linked certificates */}
          <View style={styles.card}>
            <View style={styles.certHead}>
              <Label>Certificates ({linkedCerts.length})</Label>
              <TouchableOpacity onPress={() => nav.navigate('Certificates')}>
                <Text style={styles.certManage}>Manage ›</Text>
              </TouchableOpacity>
            </View>
            {linkedCerts.length === 0 ? (
              <Text style={styles.certEmpty}>No certificates cover this item. Add one in the Certificates tab and link this item to it.</Text>
            ) : (
              linkedCerts.map((c) => {
                const st = statusFromDate(c.expiryDate);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.certRow}
                    onPress={() => nav.navigate('CertificateDetail', { id: c.id })}
                  >
                    <View style={[styles.certDot, { backgroundColor: statusColor(st) }]} />
                    <Text style={{ fontSize: 18 }}>{c.fileKind === 'photo' ? '🖼️' : '📜'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.certName} numberOfLines={1}>{c.name || 'Certificate'}</Text>
                      <Text style={styles.certSub} numberOfLines={1}>
                        {[c.number && `№ ${c.number}`, c.expiryDate && formatDate(c.expiryDate)].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Text style={styles.certChev}>›</Text>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
            <Text style={styles.deleteText}>{isNew ? 'Discard' : 'Delete item'}</Text>
          </TouchableOpacity>
        </ScrollView>

        <PlatformModal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
          <View style={styles.lbBackdrop}>
            <TouchableOpacity style={styles.lbClose} onPress={() => setPreview(null)} hitSlop={12}>
              <Text style={styles.lbCloseText}>✕</Text>
            </TouchableOpacity>
            {preview ? <Image source={{ uri: preview.uri }} style={styles.lbImage} resizeMode="contain" /> : null}
            <View style={styles.lbBar}>
              {preview?.name ? (
                <Text style={styles.lbName} numberOfLines={1}>
                  {preview.name}
                </Text>
              ) : null}
              <TouchableOpacity style={styles.lbOpen} onPress={() => preview && openFile(preview.uri)}>
                <Text style={styles.lbOpenText}>Open / Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </PlatformModal>
      </SafeAreaView>
    </LinearGradient>
  );
}

function formatExtra(v: any): string {
  if (v == null) return '—';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatDate(v);
  return String(v);
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const COLORS = useTheme();
  const styles = useS();
  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      <TextInput
        style={[styles.input, multiline && { height: 72, textAlignVertical: 'top' }]}
        value={value ?? ''}
        onChangeText={onChange}
        multiline={multiline}
        placeholder="—"
        placeholderTextColor={COLORS.textLight}
      />
    </View>
  );
}

function NumField({ label, value, onChange }: { label: string; value?: number; onChange: (n?: number) => void }) {
  const COLORS = useTheme();
  const styles = useS();
  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      <TextInput
        style={styles.input}
        value={value != null ? String(value) : ''}
        onChangeText={(t) => {
          const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
          onChange(isNaN(n) ? undefined : n);
        }}
        keyboardType="number-pad"
        placeholder="—"
        placeholderTextColor={COLORS.textLight}
      />
    </View>
  );
}

function DateField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const styles = useS();
  return (
    <View style={styles.fieldWrap}>
      <SimpleDatePicker label={label} value={value} onChange={onChange} />
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
  headerBtn: { fontSize: SIZES.h4, color: COLORS.text },
  headerTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  emoji: { fontSize: 34 },
  catLabel: { fontSize: SIZES.h4, fontWeight: '700', color: COLORS.textDark, marginBottom: 4 },
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
  twoCol: { flexDirection: 'row', gap: SIZES.sm },
  card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.sm },
  months: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.sm },
  month: {
    width: '15%',
    paddingVertical: 6,
    borderRadius: SIZES.radiusSm,
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  monthOn: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  monthText: { fontSize: SIZES.tiny, color: COLORS.text, fontWeight: '600' },
  monthTextOn: { color: COLORS.textWhite },
  extraRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, gap: SIZES.md },
  extraKey: { fontSize: SIZES.small, color: COLORS.textLight, flex: 1 },
  extraVal: { fontSize: SIZES.small, color: COLORS.text, flex: 1, textAlign: 'right' },
  attGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.sm },
  attItem: { position: 'relative' },
  attThumb: { borderRadius: SIZES.radiusSm, backgroundColor: COLORS.borderLight, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border },
  attDoc: { alignItems: 'center', justifyContent: 'center', padding: 4 },
  attDocName: { fontSize: 8, color: COLORS.textLight, marginTop: 2, maxWidth: 70 },
  lbBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  lbClose: { position: 'absolute', top: 56, right: 24, zIndex: 2 },
  lbCloseText: { color: '#fff', fontSize: 28, fontWeight: '700' },
  lbImage: { width: '100%', height: '74%' },
  lbBar: { position: 'absolute', bottom: 48, width: '100%', alignItems: 'center', gap: SIZES.sm },
  lbName: { color: 'rgba(255,255,255,0.8)', fontSize: SIZES.small, paddingHorizontal: SIZES.lg },
  lbOpen: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.xl },
  lbOpenText: { color: '#fff', fontWeight: '700', fontSize: SIZES.body },
  attRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attRemoveText: { color: COLORS.textWhite, fontSize: 12, fontWeight: '800' },
  attAdd: {
    borderRadius: SIZES.radiusSm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attAddPlus: { fontSize: 24, color: COLORS.primary, lineHeight: 26 },
  attAddText: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '600' },
  attEmpty: {
    borderRadius: SIZES.radiusSm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.textLight,
  },
  attHint: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: SIZES.sm },
  certHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  certManage: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  certEmpty: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.xs },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  certDot: { width: 10, height: 10, borderRadius: 5 },
  certName: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
  certSub: { fontSize: SIZES.tiny, color: COLORS.textLight },
  certChev: { fontSize: SIZES.h4, color: COLORS.textLight },
  deleteBtn: {
    marginTop: SIZES.lg,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.danger,
    alignItems: 'center',
  },
  deleteText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.body },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
