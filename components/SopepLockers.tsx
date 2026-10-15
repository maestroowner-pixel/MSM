// ===================================
// SOPEP → the gear: the vessel's SOPEP lockers (types/sopep.ts), kept as the
// stores are (components/StoreRooms, 15 Oct 2026: "on SOPEP a gear on the
// heading too").
//
//   + New locker  name, where it is, its ID (SP-02 offered; letters, digits,
//                 - and _, unique).
//   Each locker   open its list, edit, its QR label (PDF, or the Xprinter), load
//                 its list from Excel (services/sopepSheet), the template, remove
//                 (an empty locker other than the first).
//   Open by ID    the ID typed.
//
// The QR carries the locker's own id (msm://sopep/<id>), not its ID: a renamed
// or moved locker, or one given another ID, keeps its label.
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
import { MAIN_LOCKER, SopepLocker, lockerCode, lockerOf, nextLockerCode, sopepLockers } from '../types/sopep';
import { STORE_CODE_RE } from '../types/stores';
import { GANGWAY_STOCKS, exportLockerLabels, sopepLabelSpecs } from '../services/crewCards';
import { GANGWAY_STOCK_MM } from '../services/gangwayLabels';
import { TsplLabelSpec, labelsToTspl } from '../services/tspl';
import { getSavedPrinter, printTspl, SavedPrinter } from '../services/blePrinter';
import { pickSheetRows, saveSheet } from '../services/sheetFiles';
import { planSopepImport, readSopepSheet, sopepTemplateRows } from '../services/sopepSheet';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from '../screens/SafetySc';

interface Props {
  /** Open a locker's list on the inventory page. */
  onOpen: (id: string) => void;
  done: (w: string | null | void) => void;
  fail: (e: any) => void;
}

export function SopepLockers({ onOpen, done, fail }: Props) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { sopepLockers: lockerList, sopepItems: items, vessel, saveRow, saveRows } = useData();
  const lockers = useMemo(() => sopepLockers(lockerList).map((l) => ({ ...l, code: lockerCode(l) })), [lockerList]);
  const [edit, setEdit] = useState<SopepLocker | null>(null);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [printerOpen, setPrinterOpen] = useState(false);
  const [pending, setPending] = useState<{ specs: TsplLabelSpec[]; what: string } | null>(null);

  const isNew = !!edit && !lockers.some((l) => l.id === edit.id);
  const code = (edit?.code ?? '').trim();
  const codeTaken = !!edit && lockers.some((l) => l.id !== edit.id && l.code.toUpperCase() === code.toUpperCase());
  const codeBad = !!edit && code !== '' && !STORE_CODE_RE.test(code);

  const startNew = () => setEdit({ id: uid('lk'), name: '', code: nextLockerCode(lockers), order: lockers.length, updatedAt: Date.now() });

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert('Locker', 'Name it — Bunker station locker, Engine room stbd.');
    if (!code || codeBad) return Alert.alert('ID', 'Letters, digits, - and _ only, up to 16 — SP-02, BOW.');
    if (codeTaken) return Alert.alert('ID', `${code} is another locker’s ID.`);
    // The first locker becomes a record the first time it is changed, like the others.
    const row: SopepLocker = { id: edit.id, name: edit.name.trim(), code: code.toUpperCase(), order: edit.order, updatedAt: Date.now(), ...(edit.location?.trim() ? { location: edit.location.trim() } : {}) };
    await saveRow(storage.SOPEP_LOCKERS_KEY, row);
    setEdit(null);
    playSuccessSound();
  };

  const remove = (l: SopepLocker, n: number) => {
    if (n) return Alert.alert('Remove locker', `${l.name} still has ${n} item${n === 1 ? '' : 's'} on its list. Move or remove them first.`);
    Alert.alert('Remove locker', `Remove ${l.name}? Its label stops opening anything.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void saveRow(storage.SOPEP_LOCKERS_KEY, { ...l, deleted: true }) },
    ]);
  };

  const importInto = async (l: SopepLocker) => {
    try {
      const picked = await pickSheetRows();
      if (!picked) return;
      const lines = readSopepSheet(picked.rows);
      if (!lines.length) return Alert.alert('Import', `Nothing found in “${picked.name}”. Use the template.`);
      const plan = planSopepImport(lines, items, l.id, MAIN_LOCKER);
      Alert.alert(`Import ${lines.length} lines from “${picked.name}” into ${l.name}?`, [plan.added.length ? `New: ${plan.added.slice(0, 12).join(', ')}${plan.added.length > 12 ? ` and ${plan.added.length - 12} more` : ''}.` : null, plan.updated.length ? `Updated (quantity, unit, place): ${plan.updated.length}.` : null].filter(Boolean).join('\n\n'), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            if (l.id === MAIN_LOCKER && !lockerList.some((x) => x.id === MAIN_LOCKER)) await saveRow(storage.SOPEP_LOCKERS_KEY, { id: l.id, name: l.name, order: 0, updatedAt: Date.now() });
            await saveRows(storage.SOPEP_ITEMS_KEY, plan.save);
            playSuccessSound();
            setNote(`${l.name}: ${plan.added.length} added, ${plan.updated.length} updated — from “${picked.name}”`);
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    }
  };

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
  const toXprinter = (list: (SopepLocker & { code: string })[]) =>
    Alert.alert('Label size', 'The roll loaded in the printer.', [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const job = { specs: sopepLabelSpecs(list, vessel, sz), what: list.length === 1 ? `The label of ${list[0].name}` : `${list.length} locker labels` };
          const printer = await getSavedPrinter();
          if (printer) return void sendLabels(printer, job);
          setPending(job);
          setPrinterOpen(true);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const openTyped = () => {
    const l = lockers.find((x) => x.code.toUpperCase() === typed.trim().toUpperCase());
    if (!l) return Alert.alert('Open by ID', `No SOPEP locker with the ID ${typed.trim().toUpperCase()}.`);
    setTyped('');
    onOpen(l.id);
  };

  const form = edit ? (
    <Card>
      <Label>{isNew ? 'New SOPEP locker' : `Locker — ${lockerCode(edit)}`}</Label>
      <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder="Name ★ — Bunker station locker, Engine room stbd" placeholderTextColor={COLORS.textLight} autoFocus={isNew} />
      <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} placeholder="Where it is — main deck aft, by the bunker manifold" placeholderTextColor={COLORS.textLight} />
      <View style={[styles.row, { marginTop: 0 }]}>
        <TextInput style={[styles.input, { width: 160 }]} value={edit.code ?? ''} onChangeText={(v) => setEdit({ ...edit, code: v })} autoCapitalize="characters" autoCorrect={false} placeholder="ID ★" placeholderTextColor={COLORS.textLight} accessibilityLabel="Locker ID" />
        <Text style={[styles.sub, { flex: 1, minWidth: 200 }, (codeBad || codeTaken) && { color: COLORS.danger, fontWeight: '700' }]}>
          {codeBad ? 'Letters, digits, - and _ only.' : codeTaken ? 'Another locker has this ID.' : isNew ? 'Printed on its label and typed to open it.' : 'The QR on the locker keeps working; reprint the label for the new ID.'}
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
      <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>Each locker has its own list, an ID and a QR label: scanned, the label opens what should be in it.</Text>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.btn} onPress={startNew}><Text style={styles.btnText}>+ New locker</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => void exportLockerLabels(lockers, vessel).then(done, fail)}><Text style={styles.smallText}>{`QR labels — all (PDF) · ${lockers.length}`}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => toXprinter(lockers)}><Text style={styles.smallText}>Xprinter — all</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, marginLeft: 'auto' }}>
          <TextInput style={[styles.input, { width: 140, marginTop: 0 }]} value={typed} onChangeText={setTyped} onSubmitEditing={() => typed.trim() && openTyped()} autoCapitalize="characters" autoCorrect={false} placeholder="Open by ID" placeholderTextColor={COLORS.textLight} returnKeyType="go" accessibilityLabel="Open a locker by its ID" />
          <TouchableOpacity style={[styles.small, !typed.trim() && { opacity: 0.4 }]} disabled={!typed.trim()} onPress={openTyped}><Text style={styles.smallText}>Open</Text></TouchableOpacity>
        </View>
      </View>
      {note ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.sm }]}>{`✓ ${note}`}</Text> : null}
      {isNew ? form : null}

      {lockers.map((l) => {
        const n = items.filter((i) => !i.deleted && lockerOf(i) === l.id).length;
        if (edit?.id === l.id) return <React.Fragment key={l.id}>{form}</React.Fragment>;
        return (
          <View key={l.id} style={[styles.item, { borderLeftColor: n ? COLORS.primary : COLORS.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
              <View style={{ borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary }}>{l.code}</Text>
              </View>
              <MciIcon name="archive-outline" size={18} color={COLORS.textDark} />
              <TouchableOpacity style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 }} onPress={() => onOpen(l.id)} accessibilityRole="link">
                <Text style={styles.name}>{l.name}</Text>
                <Text style={styles.sub}>{l.location || 'place not set'}</Text>
              </TouchableOpacity>
              <Text style={[styles.sub, { fontWeight: '700' }]}>{n ? `${n} item${n === 1 ? '' : 's'}` : 'empty'}</Text>
            </View>
            <View style={[styles.row, { gap: SIZES.xs, marginBottom: 0 }]}>
              <TouchableOpacity style={styles.small} onPress={() => onOpen(l.id)}><Text style={styles.smallText}>Open</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => setEdit(l)}><Text style={styles.smallText}>Edit — name, place, ID</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void exportLockerLabels([l], vessel).then(done, fail)}><MciIcon name="qrcode" size={14} color={COLORS.primary} /><Text style={styles.smallText}>QR label (PDF)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => toXprinter([l])}><Text style={styles.smallText}>Xprinter</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void importInto(l)}><MciIcon name="microsoft-excel" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Load list (Excel)</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => saveSheet(sopepTemplateRows(), 'SOPEP', `${l.name} template`, vessel).then(done, fail)}><Text style={styles.smallText}>Template</Text></TouchableOpacity>
              {l.id !== MAIN_LOCKER ? (
                <TouchableOpacity onPress={() => remove(l, n)} hitSlop={8} accessibilityLabel={`Remove locker — ${l.name}`}>
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
