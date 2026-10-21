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
import { t, tk, tn, useT } from '../utils/i18n';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import * as storage from '../services/storage';
import { STORE_CODE_RE, StoreKind, StoreRoom, isBuiltinRoom, nextRoomCode, roomByCode, roomOf, storeRooms } from '../types/stores';
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
  useT();
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
    if (!edit.name.trim()) return Alert.alert(t('sro.store'), t('sro.nameIt'));
    if (!code || codeBad) return Alert.alert(t('sro.id'), t('sro.idRule'));
    if (codeTaken) return Alert.alert(t('sro.id'), t('sro.idOther', { code }));
    const clean: StoreRoom = { ...edit, name: edit.name.trim(), code: code.toUpperCase(), ...(edit.location?.trim() ? { location: edit.location.trim() } : { location: undefined }) };
    await saveRow(storage.STORE_ROOMS_KEY, Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined)) as unknown as StoreRoom);
    setEdit(null);
    playSuccessSound();
    done(null);
  };

  const remove = (r: StoreRoom, n: number) => {
    if (n) return Alert.alert(t('sro.removeT'), t('sro.stillHas', { name: r.name, items: tn('n.item', n) }));
    Alert.alert(t('sro.removeT'), t('sro.removeQ', { name: r.name, code: r.code }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => void saveRow(storage.STORE_ROOMS_KEY, { ...r, deleted: true }).then(() => setEdit(null)) },
    ]);
  };

  // ---- labels ----
  const sendLabels = async (printer: SavedPrinter, job: { specs: TsplLabelSpec[]; what: string }) => {
    try {
      await printTspl(printer.id, labelsToTspl(job.specs));
      Alert.alert(t('print.sent'), t('sro.sentTo', { what: job.what, printer: printer.name }));
    } catch (e: any) {
      Alert.alert(t('print.xprinterFail'), String(e?.message ?? e));
    } finally {
      setPending(null);
    }
  };
  const toXprinter = (list: StoreRoom[]) =>
    Alert.alert(t('print.labelSize'), t('print.roll'), [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const job = { specs: storeLabelSpecs(list, vessel, sz), what: list.length === 1 ? t('sro.labelOf', { name: list[0].name }) : tn('n.storeLabel', list.length) };
          const printer = await getSavedPrinter();
          if (printer) return void sendLabels(printer, job);
          setPending(job);
          setPrinterOpen(true);
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);

  const openTyped = () => {
    const r = roomByCode(rooms, typed);
    if (!r) return Alert.alert(t('sro.openById'), t('sro.noSuch', { code: typed.trim().toUpperCase() }));
    setTyped('');
    onOpen(r.id);
  };

  const form = edit ? (
    <Card>
      <Label>{isNew ? t('sro.new') : t('sro.storeCode', { code: edit.code })}</Label>
      <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder={t('sro.namePh')} placeholderTextColor={COLORS.textLight} autoFocus={isNew} />
      {isNew ? (
        <>
          <View style={styles.chips}>
            {KINDS.map((k) => (
              <TouchableOpacity key={k} style={[styles.chip, { flexDirection: 'row', alignItems: 'center', gap: 4 }, edit.kind === k && styles.chipOn]} onPress={() => setEdit({ ...edit, kind: k })} accessibilityRole="radio" accessibilityState={{ selected: edit.kind === k }}>
                <MciIcon name={KIND_ICON[k]} size={14} color={edit.kind === k ? COLORS.textWhite : COLORS.primary} />
                <Text style={[styles.chipText, edit.kind === k && styles.chipTextOn]}>{tk(`sro.kind.${k}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sub}>{tk(`sro.sub.${edit.kind}`)}</Text>
        </>
      ) : (
        <Text style={styles.sub}>{`${tk(`sro.kind.${edit.kind}`)} — ${tk(`sro.sub.${edit.kind}`).toLowerCase()}`}</Text>
      )}
      <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} placeholder={t('sro.wherePh')} placeholderTextColor={COLORS.textLight} />
      <View style={[styles.row, { marginTop: 0 }]}>
        <TextInput style={[styles.input, { width: 160 }]} value={edit.code} onChangeText={(v) => setEdit({ ...edit, code: v })} autoCapitalize="characters" autoCorrect={false} placeholder={t('sro.idPh')} placeholderTextColor={COLORS.textLight} accessibilityLabel={t('sro.idA11y')} />
        <Text style={[styles.sub, { flex: 1, minWidth: 200 }, (codeBad || codeTaken) && { color: COLORS.danger, fontWeight: '700' }]}>
          {codeBad ? t('sro.idBad') : codeTaken ? t('sro.idTaken') : isNew ? t('sro.idNew') : t('sro.idChanged')}
        </Text>
      </View>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  return (
    <>
      <PrinterModal visible={printerOpen} onClose={() => { setPrinterOpen(false); setPending(null); }} onPicked={(p) => { setPrinterOpen(false); if (pending) void sendLabels(p, pending); }} />
      <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{t('sro.intro')}</Text>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs }]}>
        <TouchableOpacity style={styles.btn} onPress={startNew}><Text style={styles.btnText}>{t('sro.add')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => void exportStoreLabels(rooms, vessel).then(done, fail)}><Text style={styles.smallText}>{`QR labels — all (PDF) · ${rooms.length}`}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => toXprinter(rooms)}><Text style={styles.smallText}>{t('sro.xpAll')}</Text></TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, marginLeft: 'auto' }}>
          <TextInput style={[styles.input, { width: 140, marginTop: 0 }]} value={typed} onChangeText={setTyped} onSubmitEditing={() => typed.trim() && openTyped()} autoCapitalize="characters" autoCorrect={false} placeholder={t('sro.openById')} placeholderTextColor={COLORS.textLight} returnKeyType="go" accessibilityLabel={t('sro.openA11y')} />
          <TouchableOpacity style={[styles.small, !typed.trim() && { opacity: 0.4 }]} disabled={!typed.trim()} onPress={openTyped}><Text style={styles.smallText}>{t('odc.open')}</Text></TouchableOpacity>
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
                <Text style={styles.sub}>{[tk(`sro.kind.${r.kind}`), r.location || t('sro.noPlace')].join(' · ')}</Text>
              </TouchableOpacity>
              <Text style={[styles.sub, { color: tone === COLORS.border ? COLORS.textLight : tone, fontWeight: '700' }]}>
                {inIt.length ? [tn('n.item', inIt.length), c.short ? t('sro.belowMin', { n: c.short }) : null, c.expired ? t('sro.outOfDate', { n: c.expired }) : null].filter(Boolean).join(' · ') : t('sro.empty')}
              </Text>
            </View>
            <View style={[styles.row, { gap: SIZES.xs, marginBottom: 0 }]}>
              <TouchableOpacity style={styles.small} onPress={() => onOpen(r.id)}><Text style={styles.smallText}>{t('odc.open')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => setEdit(r)}><Text style={styles.smallText}>{t('sro.editBtn')}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void exportStoreLabels([r], vessel).then(done, fail)}><MciIcon name="qrcode" size={14} color={COLORS.primary} /><Text style={styles.smallText}>{t('pat.qrPdf')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => toXprinter([r])}><Text style={styles.smallText}>Xprinter</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => onImport(r)}><MciIcon name="microsoft-excel" size={14} color={COLORS.primary} /><Text style={styles.smallText}>{t('sro.load')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => saveSheet(storeTemplateRows(r.kind), r.name, `${r.name} template`, vessel).then(done, fail)}><Text style={styles.smallText}>{t('sro.template')}</Text></TouchableOpacity>
              {!isBuiltinRoom(r.id) ? (
                <TouchableOpacity onPress={() => remove(r, inIt.length)} hitSlop={8} accessibilityLabel={`${t('sro.removeT')} — ${r.name}`}>
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
