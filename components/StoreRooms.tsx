// ===================================
// Stores → the gear: the vessel's storerooms (types/stores.ts StoreRoom), as
// InventoryLens keeps its lockers (15 Oct 2026: "a gear on the Stores heading —
// add, location, make the QR, give it an ID, load its list from xlsx").
//
//   + New store   name, kind (PPE / provisions / general), where it is, its ID
//                 (ST-03 offered; letters, digits, - and _, unique).
//   Each store    open it, edit, its QR label (PDF, or the Xprinter), load its
//                 list from Excel (the template's columns, or the AI's), the
//                 template, remove (an empty store the vessel added).
//   Open by ID    the ID typed — for the worn label, or the store you are not at.
//
// The QR carries the store's own id, not its ID: a store renamed, moved or given
// another ID keeps the label on its door (only the printed text is old).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { PrinterModal } from './PrinterModal';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import * as storage from '../services/storage';
import { STORE_KIND_SUB, STORE_CODE_RE, STORE_LABEL, StoreKind, StoreRoom, isBuiltinRoom, nextRoomCode, roomByCode, roomOf, storeRooms } from '../types/stores';
import { storeCounts, storeStatus, storeTemplateRows } from '../services/stores';
import { exportStoreLabels, storeLabelSpecs, GANGWAY_STOCKS } from '../services/crewCards';
import { GANGWAY_STOCK_MM } from '../services/gangwayLabels';
import { TsplLabelSpec, labelsToTspl } from '../services/tspl';
import { getSavedPrinter, printTspl, SavedPrinter } from '../services/blePrinter';
import { saveSheet } from '../services/sheetFiles';
import { todayIso } from '../services/pms';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';

const KINDS: StoreKind[] = ['ppe', 'provisions', 'general'];
const KIND_ICON: Record<StoreKind, string> = { ppe: 'hard-hat', provisions: 'food-apple-outline', general: 'package-variant-closed' };

interface Props {
  /** Open a store's list. */
  onOpen: (id: string) => void;
  /** Load a store's list from Excel — the Stores screen's own import, into this store. */
  onImport: (room: StoreRoom) => void;
  done: (w: string | null | void) => void;
  fail: (e: any) => void;
}

export function StoreRooms({ onOpen, onImport, done, fail }: Props) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { storeRoomList, storeItems, storeMoves, vessel, saveRow } = useData();
  const rooms = useMemo(() => storeRooms(storeRoomList), [storeRoomList]);
  const today = todayIso();
  const [edit, setEdit] = useState<StoreRoom | null>(null);
  const [typed, setTyped] = useState('');
  const [printerOpen, setPrinterOpen] = useState(false);
  const [pending, setPending] = useState<{ specs: TsplLabelSpec[]; what: string } | null>(null);

  const isNew = !!edit && !rooms.some((r) => r.id === edit.id);
  const code = edit?.code.trim() ?? '';
  const codeTaken = !!edit && rooms.some((r) => r.id !== edit.id && r.code.toUpperCase() === code.toUpperCase());
  const codeBad = !!edit && code !== '' && !STORE_CODE_RE.test(code);

  const startNew = () => setEdit({ id: uid('str'), code: nextRoomCode(rooms), name: '', kind: 'general', order: rooms.length, updatedAt: Date.now() });

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert('Store', 'Name it — Bosun’s store, Engine store, Paint locker.');
    if (!code || codeBad) return Alert.alert('ID', 'Letters, digits, - and _ only, up to 16 — ST-03, BOSUN, ER-2.');
    if (codeTaken) return Alert.alert('ID', `${code} is another store’s ID.`);
    const clean: StoreRoom = { ...edit, name: edit.name.trim(), code: code.toUpperCase(), ...(edit.location?.trim() ? { location: edit.location.trim() } : { location: undefined }) };
    await saveRow(storage.STORE_ROOMS_KEY, Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined)) as unknown as StoreRoom);
    setEdit(null);
    playSuccessSound();
    done(null);
  };

  const remove = (r: StoreRoom, n: number) => {
    if (n) return Alert.alert('Remove store', `${r.name} still has ${n} item${n === 1 ? '' : 's'} on its list. Remove them first, or load them into another store.`);
    Alert.alert('Remove store', `Remove ${r.name} (${r.code})? Its label stops opening anything.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void saveRow(storage.STORE_ROOMS_KEY, { ...r, deleted: true }).then(() => setEdit(null)) },
    ]);
  };

  // ---- labels ----
  const sendLabels = async (printer: SavedPrinter, job: { specs: TsplLabelSpec[]; what: string }) => {
    try {
      await printTspl(printer.id, labelsToTspl(job.specs));
      Alert.alert('Sent to printer', `${job.what} sent to ${printer.name}.`);
    } catch (e: any) {
      Alert.alert('Could not print to the Xprinter', String(e?.message ?? e));
    } finally {
      setPending(null);
    }
  };
  const toXprinter = (list: StoreRoom[]) =>
    Alert.alert('Label size', 'The roll loaded in the printer.', [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const job = { specs: storeLabelSpecs(list, vessel, sz), what: list.length === 1 ? `The label of ${list[0].name}` : `${list.length} store labels` };
          const printer = await getSavedPrinter();
          if (printer) return void sendLabels(printer, job);
          setPending(job);
          setPrinterOpen(true);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const openTyped = () => {
    const r = roomByCode(rooms, typed);
    if (!r) return Alert.alert('Open by ID', `No store with the ID ${typed.trim().toUpperCase()}.`);
    setTyped('');
    onOpen(r.id);
  };

  const form = edit ? (
    <Card>
      <Label>{isNew ? 'New store' : `Store — ${edit.code}`}</Label>
      <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder="Name ★ — Bosun’s store, Engine store, Paint locker" placeholderTextColor={COLORS.textLight} autoFocus={isNew} />
      {isNew ? (
        <>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <TouchableOpacity key={k} style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: 4 }, edit.kind === k && styles.chipOn]} onPress={() => setEdit({ ...edit, kind: k })} accessibilityRole="radio" accessibilityState={{ selected: edit.kind === k }}>
                <MciIcon name={KIND_ICON[k]} size={14} color={edit.kind === k ? COLORS.textWhite : COLORS.primary} />
                <Text style={[styles.chipText, edit.kind === k && styles.chipTextOn]}>{STORE_LABEL[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sub}>{STORE_KIND_SUB[edit.kind]}</Text>
        </>
      ) : (
        <Text style={styles.sub}>{`${STORE_LABEL[edit.kind]} — ${STORE_KIND_SUB[edit.kind].toLowerCase()}`}</Text>
      )}
      <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} placeholder="Where it is — fwd lazarette, engine room stbd, deck 2" placeholderTextColor={COLORS.textLight} />
      <View style={[styles.row, { marginTop: 0 }]}>
        <TextInput style={[styles.input, { width: 160 }]} value={edit.code} onChangeText={(v) => setEdit({ ...edit, code: v })} autoCapitalize="characters" autoCorrect={false} placeholder="ID ★" placeholderTextColor={COLORS.textLight} accessibilityLabel="Store ID" />
        <Text style={[styles.sub, { flex: 1, minWidth: 200 }, (codeBad || codeTaken) && { color: COLORS.danger, fontWeight: '700' }]}>
          {codeBad ? 'Letters, digits, - and _ only.' : codeTaken ? 'Another store has this ID.' : isNew ? 'Printed on its label and typed to open it.' : 'The QR on the door keeps working; reprint the label for the new ID.'}
        </Text>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  return (
    <>
      <PrinterModal visible={printerOpen} onClose={() => { setPrinterOpen(false); setPending(null); }} onPicked={(p) => { setPrinterOpen(false); if (pending) void sendLabels(p, pending); }} />
      <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>Each store has its own list, an ID and a QR label for its door: scanned, the label opens the list.</Text>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.btn} onPress={startNew}><Text style={styles.btnText}>+ New store</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => void exportStoreLabels(rooms, vessel).then(done, fail)}><Text style={styles.smallText}>{`QR labels — all (PDF) · ${rooms.length}`}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => toXprinter(rooms)}><Text style={styles.smallText}>Xprinter — all</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, marginLeft: 'auto' }}>
          <TextInput style={[styles.input, { width: 140, marginTop: 0 }]} value={typed} onChangeText={setTyped} onSubmitEditing={() => typed.trim() && openTyped()} autoCapitalize="characters" autoCorrect={false} placeholder="Open by ID" placeholderTextColor={COLORS.textLight} returnKeyType="go" accessibilityLabel="Open a store by its ID" />
          <TouchableOpacity style={[styles.small, !typed.trim() && { opacity: 0.4 }]} disabled={!typed.trim()} onPress={openTyped}><Text style={styles.smallText}>Open</Text></TouchableOpacity>
        </View>
      </View>
      {isNew ? form : null}

      {rooms.map((r) => {
        const inIt = storeItems.filter((i) => roomOf(i) === r.id);
        const c = storeCounts(storeStatus(inIt, storeMoves, today));
        const tone = c.expired ? COLORS.danger : c.short || c.soon ? COLORS.warning : inIt.length ? COLORS.success : COLORS.border;
        if (edit?.id === r.id) return <React.Fragment key={r.id}>{form}</React.Fragment>;
        return (
          <View key={r.id} style={[styles.item, { borderLeftColor: tone }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
              <View style={{ borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary, fontVariant: ['tabular-nums'] }}>{r.code}</Text>
              </View>
              <MciIcon name={KIND_ICON[r.kind]} size={18} color={COLORS.textDark} />
              <TouchableOpacity style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 }} onPress={() => onOpen(r.id)} accessibilityRole="link">
                <Text style={styles.name}>{r.name}</Text>
                <Text style={styles.sub}>{[STORE_LABEL[r.kind], r.location || 'place not set'].join(' · ')}</Text>
              </TouchableOpacity>
              <Text style={[styles.sub, { color: tone === COLORS.border ? COLORS.textLight : tone, fontWeight: '700' }]}>
                {inIt.length ? [`${inIt.length} item${inIt.length === 1 ? '' : 's'}`, c.short ? `${c.short} below min` : null, c.expired ? `${c.expired} out of date` : null].filter(Boolean).join(' · ') : 'empty'}
              </Text>
            </View>
            <View style={[styles.row, { gap: SIZES.xs, marginBottom: 0 }]}>
              <TouchableOpacity style={styles.small} onPress={() => onOpen(r.id)}><Text style={styles.smallText}>Open</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => setEdit(r)}><Text style={styles.smallText}>Edit — name, place, ID</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void exportStoreLabels([r], vessel).then(done, fail)}><MciIcon name="qrcode" size={14} color={COLORS.primary} /><Text style={styles.smallText}>QR label (PDF)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => toXprinter([r])}><Text style={styles.smallText}>Xprinter</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => onImport(r)}><MciIcon name="microsoft-excel" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Load list (Excel)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => saveSheet(storeTemplateRows(r.kind), r.name, `${r.name} template`, vessel).then(done, fail)}><Text style={styles.smallText}>Template</Text></TouchableOpacity>
              {!isBuiltinRoom(r.id) ? (
                <TouchableOpacity onPress={() => remove(r, inIt.length)} hitSlop={8} accessibilityLabel={`Remove store — ${r.name}`}>
                  <MciIcon name="trash-can-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </>
  );
}
