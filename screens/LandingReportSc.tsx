// ===================================
// Landing Report — create / view (#27, Oct 2026)
//
// Creates a handover document when equipment is sent ashore for service or
// returned aboard. Each item in the report gets a movement record; the report
// itself can be printed as a PDF with per-item QR codes.
// ===================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Alert, ActivityIndicator, FlatList, Modal,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SIZES } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { BackButton, ScreenTitle, Label } from '../components/ui';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { uid } from '../utils/id';
import { formatDate } from '../utils/dates';
import { signatureLine } from '../types/crew';
import { useSigner, Signer } from '../components/SignerChoice';
import { useSignConfirm, SignResult } from '../components/SignConfirm';
import { ItemMovement, LandingReport, MovementDir, nextLandingNo, MOVEMENT_DIR_LABEL } from '../types/movement';
import { DeckEntry } from '../types/deckLog';
import * as storage from '../services/storage';
import { EquipmentItem } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';
import { readInspectLink } from '../services/firebaseService';
import { printLandingReport } from '../services/landingReport';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { t, useT } from '../utils/i18n';

export default function LandingReportSc() {
  useT();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const COLORS = useTheme();
  const { landings, itemMovements, saveLanding, saveItem, saveRow, flat, vessel } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const reportId: string = route.params?.id ?? 'new';
  const returnFrom: string | undefined = route.params?.returnFrom;
  const initDir: 'out' | 'in' | 'received' | undefined = route.params?.initDir;
  const isNew = reportId === 'new';

  const existing = isNew ? null : landings.find((r) => r.id === reportId) ?? null;
  const returnFromReport = returnFrom ? landings.find((r) => r.id === returnFrom) ?? null : null;

  const [dir, setDir] = useState<'out' | 'in' | 'received'>(
    existing?.dir ?? (returnFrom ? 'in' : (initDir ?? 'out'))
  );
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [port, setPort] = useState(existing?.port ?? '');
  const [to, setTo] = useState(existing?.to ?? (returnFromReport?.to ?? ''));
  const [supplier, setSupplier] = useState(existing?.supplier ?? '');
  const [invoiceRef, setInvoiceRef] = useState(existing?.invoiceRef ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
  const [itemServiceRefs, setItemServiceRefs] = useState<Record<string, string>>({});
  const [itemNewDates, setItemNewDates] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [inspectToken, setInspectToken] = useState<string | null>(null);

  const signer = useSigner();
  const confirmSign = useSignConfirm();

  const imo = vessel?.imo?.replace(/\D/g, '') ?? '';
  const vesselName = vessel?.vessel_name ?? `IMO ${imo}`;

  useEffect(() => {
    if (imo) readInspectLink(imo).then((t) => setInspectToken(t?.token ?? null)).catch(() => {});
  }, [imo]);

  // For an existing report, pre-load its movements.
  useEffect(() => {
    if (existing) {
      const movIds = new Set(existing.movementIds);
      const myMovs = itemMovements.filter((m) => movIds.has(m.id));
      const ids = new Set(myMovs.map((m) => m.itemId));
      setSelectedItemIds(ids);
      const reasons: Record<string, string> = {};
      const serviceRefs: Record<string, string> = {};
      const newDates: Record<string, string> = {};
      myMovs.forEach((m) => {
        reasons[m.itemId] = m.reason ?? '';
        serviceRefs[m.itemId] = m.serviceRef ?? '';
        newDates[m.itemId] = m.newInspectionDate ?? '';
      });
      setItemReasons(reasons);
      setItemServiceRefs(serviceRefs);
      setItemNewDates(newDates);
    }
  }, [existing]);

  // Pre-select items from the outgoing report when creating a return.
  useEffect(() => {
    if (returnFromReport && isNew) {
      const movIds = new Set(returnFromReport.movementIds);
      const outMovs = itemMovements.filter((m) => movIds.has(m.id));
      setSelectedItemIds(new Set(outMovs.map((m) => m.itemId)));
    }
  }, [returnFromReport?.id]);

  const itemsById = useMemo(() => {
    const map = new Map<string, EquipmentItem>();
    flat.forEach((it) => map.set(it.id, it));
    return map;
  }, [flat]);

  // Items available for this report type.
  const candidateItems = useMemo(() => {
    const active = itemMovements.filter((m) => !m.deleted);
    const ashore = active.reduce((acc, m) => {
      if (m.dir === 'ashore') acc.add(m.itemId);
      if (m.dir === 'return') acc.delete(m.itemId);
      if (m.dir === 'condemned') acc.add(m.itemId);
      return acc;
    }, new Set<string>());
    const decommissioned = new Set(active.filter((m) => m.dir === 'decommissioned').map((m) => m.itemId));
    if (dir === 'out') return flat.filter((it) => !ashore.has(it.id) && !decommissioned.has(it.id));
    if (dir === 'in') return flat.filter((it) => ashore.has(it.id));
    // received: items not yet formally received
    const received = new Set(active.filter((m) => m.dir === 'received').map((m) => m.itemId));
    return flat.filter((it) => !received.has(it.id));
  }, [flat, itemMovements, dir]);

  const toggleItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedItems = useMemo(
    () => flat.filter((it) => selectedItemIds.has(it.id)),
    [flat, selectedItemIds]
  );

  const movDir: MovementDir = dir === 'out' ? 'ashore' : dir === 'in' ? 'return' : 'received';

  const buildMovements = useCallback((): ItemMovement[] => {
    return selectedItems.map((item) => {
      const existingMov = itemMovements.find(
        (m) => m.itemId === item.id && m.landingId === reportId
      );
      const snap = [item.no, item.type ?? item.make].filter(Boolean).join(' ') || (CATEGORY_MAP[item.category]?.label ?? '');
      return {
        id: existingMov?.id ?? uid(),
        itemId: item.id,
        itemCategory: item.category,
        itemSnap: snap,
        dir: movDir,
        landingId: reportId,
        date,
        to: to.trim() || undefined,
        reason: itemReasons[item.id]?.trim() || undefined,
        serviceRef: itemServiceRefs[item.id]?.trim() || undefined,
        newInspectionDate: itemNewDates[item.id]?.trim() || undefined,
        by: signer.signer?.name ?? undefined,
        byRank: signer.signer?.rank ?? undefined,
        updatedAt: Date.now(),
      };
    });
  }, [selectedItems, itemMovements, movDir, date, to, itemReasons, itemServiceRefs, itemNewDates, signer, reportId]);

  const handleSave = async (signed = false) => {
    if (selectedItemIds.size === 0) {
      Alert.alert(t('lr.noItems'), t('lr.selectOne'));
      return;
    }
    setSaving(true);
    try {
      let proof = existing?.signedWith;
      let by = signer.signer?.name ?? existing?.by;
      let byRank = signer.signer?.rank ?? existing?.byRank;
      if (signed && signer.signer) {
        const sig: SignResult = await confirmSign({
          personKey: signer.signer.key,
          name: signer.signer.name,
          ownDevice: signer.signer.own,
          what: 'Sign landing report',
        });
        if (!sig) { setSaving(false); return; }
        proof = sig.proof;
        by = signer.signer.name;
        byRank = signer.signer.rank;
      }

      const id = isNew ? uid() : reportId;
      const all = [...landings.filter((r) => !r.deleted)];
      const movs = buildMovements().map((m) => ({ ...m, landingId: id }));

      const report: LandingReport = {
        id,
        no: existing?.no ?? nextLandingNo(all),
        dir,
        date,
        port: port.trim() || undefined,
        to: dir !== 'received' ? (to.trim() || undefined) : undefined,
        supplier: dir === 'received' ? (supplier.trim() || undefined) : undefined,
        invoiceRef: dir === 'received' ? (invoiceRef.trim() || undefined) : undefined,
        notes: notes.trim() || undefined,
        movementIds: movs.map((m) => m.id),
        by: by || undefined,
        byRank: byRank || undefined,
        signedWith: proof,
        updatedAt: Date.now(),
      };

      await saveLanding(report, movs);

      // Auto deck-log entry when a signed landing report is created.
      if (signed && by) {
        const dirWord = dir === 'out' ? 'sent ashore' : dir === 'in' ? 'returned aboard' : 'received aboard';
        const itemList = movs.map((m) => m.itemSnap).filter(Boolean).join('; ');
        const deckEntry: DeckEntry = {
          id: uid(), date, time: new Date().toTimeString().slice(0, 5), period: 'port', mode: 'port',
          remarks: `Landing Report ${report.no}: ${movs.length} item(s) ${dirWord}${report.to ? ` — ${report.to}` : ''}.${itemList ? ` Items: ${itemList}.` : ''}${report.notes ? ` ${report.notes}` : ''}`,
          landingRef: report.id,
          landingNo: report.no,
          by: by ?? '', byRank: byRank, at: Date.now(), updatedAt: Date.now(),
        };
        await saveRow(storage.DECK_LOG_KEY, deckEntry);
      }

      // For return reports, update each item's nextInspection date.
      if (dir === 'in') {
        const updates = movs.filter((m) => m.newInspectionDate);
        for (const m of updates) {
          const item = itemsById.get(m.itemId);
          if (item) await saveItem({ ...item, nextInspection: m.newInspectionDate });
        }
      }

      nav.goBack();
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!existing) { Alert.alert(t('lr.saveFirst'), t('lr.saveBefore')); return; }
    setPrinting(true);
    try {
      const movIds = new Set(existing.movementIds);
      const movs = itemMovements.filter((m) => movIds.has(m.id));
      await printLandingReport(existing, movs, itemsById, vesselName, imo, inspectToken);
    } catch (e: any) {
      Alert.alert(t('lr.printError'), e?.message ?? String(e));
    } finally {
      setPrinting(false);
    }
  };

  const styles = useStyles(COLORS);
  const isReadOnly = !canEdit || !isNew;
  const myMovements = existing
    ? itemMovements.filter((m) => existing.movementIds.includes(m.id))
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenTitle title={existing?.no ?? (dir === 'received' ? t('lr.newRecv') : t('lr.newLanding'))} />
      <BackButton onPress={() => nav.goBack()} fav={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Direction */}
        {isNew && (
          <View style={styles.field}>
            <Label style={styles.label}>{t('fv.type')}</Label>
            <View style={styles.segRow}>
              {(['out', 'in', 'received'] as const).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.seg, dir === d && { backgroundColor: COLORS.primary }]}
                  onPress={() => { setDir(d); setSelectedItemIds(new Set()); }}
                >
                  <Text style={[styles.segText, dir === d && { color: '#fff' }]}>
                    {d === 'out' ? t('lr.sendAshore') : d === 'in' ? t('lr.returnAboard') : t('st.receive')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Date */}
        <View style={styles.field}>
          <Label style={styles.label}>{t('nc.date')}</Label>
          {isReadOnly
            ? <Text style={styles.value}>{formatDate(date)}</Text>
            : <SimpleDatePicker label={t('nc.date')} value={date} onChange={setDate} />}
        </View>

        {/* Port */}
        <View style={styles.field}>
          <Label style={styles.label}>{t('lr.portLoc')}</Label>
          {isReadOnly
            ? <Text style={styles.value}>{existing?.port || '—'}</Text>
            : <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder={t('lr.portPh')} placeholderTextColor={COLORS.textLight} />}
        </View>

        {/* To / From / Supplier */}
        {dir !== 'received' ? (
          <View style={styles.field}>
            <Label style={styles.label}>{dir === 'out' ? t('lr.toStation') : t('lr.fromStation')}</Label>
            {isReadOnly
              ? <Text style={styles.value}>{existing?.to || '—'}</Text>
              : <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder={t('lr.stationPh')} placeholderTextColor={COLORS.textLight} />}
          </View>
        ) : (
          <>
            <View style={styles.field}>
              <Label style={styles.label}>{t('lr.supplier')}</Label>
              {isReadOnly
                ? <Text style={styles.value}>{existing?.supplier || '—'}</Text>
                : <TextInput style={styles.input} value={supplier} onChangeText={setSupplier} placeholder={t('lr.supplierPh')} placeholderTextColor={COLORS.textLight} />}
            </View>
            <View style={styles.field}>
              <Label style={styles.label}>{t('lr.invoice')}</Label>
              {isReadOnly
                ? <Text style={styles.value}>{existing?.invoiceRef || '—'}</Text>
                : <TextInput style={styles.input} value={invoiceRef} onChangeText={setInvoiceRef} placeholder="INV-2026-001" placeholderTextColor={COLORS.textLight} />}
            </View>
          </>
        )}

        {/* Items */}
        <Label style={[styles.label, { marginHorizontal: SIZES.md }]}>
          {isNew ? t('lr.itemsSel', { n: selectedItemIds.size }) : t('lr.items', { n: myMovements.length })}
        </Label>

        {isNew && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setPickerOpen(true)}>
            <Text style={styles.addBtnText}>{t('lr.selectItems')}</Text>
          </TouchableOpacity>
        )}

        {(isNew ? selectedItems : myMovements.map((m) => itemsById.get(m.itemId)).filter(Boolean) as EquipmentItem[]).map((item) => {
          const cat = CATEGORY_MAP[item.category]?.label ?? item.category;
          const desc = [item.no, item.type || item.make].filter(Boolean).join(' ');
          const mov = isNew ? null : myMovements.find((m) => m.itemId === item.id);
          return (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{desc || cat}</Text>
                  <Text style={styles.itemSub}>{cat} · SN {item.serial || '—'}</Text>
                </View>
                {isNew && (
                  <TouchableOpacity onPress={() => toggleItem(item.id)}>
                    <Text style={{ color: COLORS.danger, fontSize: 18 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              {isNew ? (
                <>
                  <TextInput
                    style={[styles.input, { marginTop: 4 }]}
                    value={itemReasons[item.id] ?? ''}
                    onChangeText={(v) => setItemReasons((p) => ({ ...p, [item.id]: v }))}
                    placeholder={t('lr.reasonPh')}
                    placeholderTextColor={COLORS.textLight}
                  />
                  {dir === 'in' && (
                    <>
                      <TextInput
                        style={[styles.input, { marginTop: 4 }]}
                        value={itemServiceRefs[item.id] ?? ''}
                        onChangeText={(v) => setItemServiceRefs((p) => ({ ...p, [item.id]: v }))}
                        placeholder={t('lr.certPh')}
                        placeholderTextColor={COLORS.textLight}
                      />
                      <SimpleDatePicker
                        label={t('lr.newNext')}
                        value={itemNewDates[item.id] ?? ''}
                        onChange={(v) => setItemNewDates((p) => ({ ...p, [item.id]: v }))}
                      />
                    </>
                  )}
                </>
              ) : (
                <>
                  {mov?.reason ? <Text style={styles.itemSub}>Reason: {mov.reason}</Text> : null}
                  {mov?.serviceRef ? <Text style={styles.itemSub}>Service ref: {mov.serviceRef}</Text> : null}
                  {mov?.newInspectionDate ? <Text style={styles.itemSub}>Next inspection: {formatDate(mov.newInspectionDate)}</Text> : null}
                </>
              )}
            </View>
          );
        })}

        {/* Notes */}
        <View style={styles.field}>
          <Label style={styles.label}>{t('og.notes')}</Label>
          {isReadOnly
            ? <Text style={styles.value}>{existing?.notes || '—'}</Text>
            : <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes} multiline placeholder={`${t('og.notes')}…`} placeholderTextColor={COLORS.textLight} />}
        </View>

        {/* Signature */}
        {existing?.by && (
          <View style={styles.field}>
            <Label style={styles.label}>{t('lr.signedBy')}</Label>
            <Text style={styles.value}>{signatureLine(existing.by, existing.byRank)}</Text>
          </View>
        )}

        {/* Actions */}
        {!isReadOnly && (
          <>
            <TouchableOpacity
              style={[styles.btn, saving && { opacity: 0.6 }]}
              onPress={() => handleSave(false)}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('common.save')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: '#22c55e', marginTop: SIZES.xs }]}
              onPress={() => handleSave(true)}
              disabled={saving}
            >
              <Text style={styles.btnText}>{t('lr.signSave')}</Text>
            </TouchableOpacity>
          </>
        )}

        {existing?.dir === 'out' && canEdit && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: '#22c55e', marginTop: SIZES.xs }]}
            onPress={() => nav.navigate('LandingReport', { id: 'new', returnFrom: existing.id })}
          >
            <Text style={styles.btnText}>{`↩ ${t('lr.returnThese')}`}</Text>
          </TouchableOpacity>
        )}

        {existing && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: COLORS.cardSolid, borderWidth: 1, borderColor: COLORS.primary }]}
            onPress={handlePrint}
            disabled={printing}
          >
            {printing
              ? <ActivityIndicator color={COLORS.primary} />
              : <Text style={[styles.btnText, { color: COLORS.primary }]}>{t('lr.print')}</Text>}
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* Item picker modal */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: SIZES.md, borderBottomWidth: 1, borderColor: COLORS.border }}>
            <Text style={{ flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.text }}>
              Select items ({selectedItemIds.size})
            </Text>
            <TouchableOpacity onPress={() => setPickerOpen(false)}>
              <Text style={{ color: COLORS.primary, fontSize: 16 }}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={candidateItems}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => {
              const selected = selectedItemIds.has(item.id);
              const cat = CATEGORY_MAP[item.category]?.label ?? item.category;
              const desc = [item.no, item.type || item.make].filter(Boolean).join(' ');
              return (
                <TouchableOpacity
                  style={{ flexDirection: 'row', padding: SIZES.md, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: selected ? '#e0f2fe' : COLORS.background }}
                  onPress={() => toggleItem(item.id)}
                >
                  <Text style={{ flex: 1, color: COLORS.text }}>{desc || cat}</Text>
                  <Text style={{ color: COLORS.textLight, fontSize: 12 }}>{cat} · {item.serial || '—'}</Text>
                  {selected && <Text style={{ color: COLORS.primary, marginLeft: 8 }}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function useStyles(COLORS: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.background },
    content: { padding: SIZES.md, paddingBottom: 40 },
    field: { marginBottom: SIZES.md },
    label: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
    value: { fontSize: 15, color: COLORS.text },
    input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: SIZES.sm, color: COLORS.text, backgroundColor: COLORS.cardSolid },
    segRow: { flexDirection: 'row', gap: 8 },
    seg: { flex: 1, padding: SIZES.sm, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center' },
    segText: { color: COLORS.primary, fontWeight: '600' },
    addBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, padding: SIZES.sm, marginBottom: SIZES.sm, alignItems: 'center' },
    addBtnText: { color: COLORS.primary, fontWeight: '600' },
    itemCard: { backgroundColor: COLORS.cardSolid, borderRadius: 8, padding: SIZES.sm, marginBottom: SIZES.xs },
    itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    itemName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    itemSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    btn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: SIZES.md, alignItems: 'center', marginBottom: SIZES.sm },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
