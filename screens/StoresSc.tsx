// ===================================
// Stores (types/stores.ts) — the PPE store, the provisions and the vessel's own
// stores, one screen, a page each (menu → Stores → the store; route param `view`
// is the store's id). The gear on the menu entry (`view: 'manage'`) opens the
// stores themselves: components/StoreRooms.
//
//   Stock      every item with what is on hand, batch by batch (provisions by
//              best-before), below the minimum and out of date flagged.
//              Tap an item: receive, issue, return (PPE), count, dispose, edit.
//   Issue      PPE goes to a crew member, who signs for it on this device (PIN
//              or by hand); provisions go to the galley.
//   Crew (PPE) what each person holds, and their PPE record as a PDF.
//   Flags      the flag locker and the charts & publications count each item
//              by wear — new, good, poor (types/stores.ts Wear); poor is kept
//              apart and not serviceable.
//   Excel      template, import (matched by name and size, quantities counted
//              in), export; the list to order.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { isAboard } from '../types/crew';
import { BRIDGE_STARTER, FLAGS_STARTER, PPE_STARTER, STORE_CATEGORIES, StoreItem, StoreKind, StoreMove, StoreMoveKind, StoreRoom, WEARS, Wear, isBuiltinRoom, roomOf, storeItemTitle, storeRooms, wearKept } from '../types/stores';
import { StoreRooms } from '../components/StoreRooms';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { vesselHeader } from '../services/export';
import { proofShort } from '../services/signature';
import { Batch, batchLabel, expiryState, mmYY, normExpiry } from '../services/hospital';
import { StoreStatus, batchToIssue, byWear, heldByPerson, planStoreImport, readStoreSheet, storeCounts, storeDept, storeSheet, storeStatus, storeTemplateRows, storeUse, toOrder } from '../services/stores';
import { exportDocPdf } from '../services/hospitalReport';
import { pickSheetRows, saveSheet } from '../services/sheetFiles';
import { aiReadDocument, aiRenameHeadings } from '../services/aiImport';
import { aiReady } from '../services/ai';
import { pickDocForAi } from '../services/medFiles';
import { useSync } from '../contexts/SyncContext';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { moduleOn } from '../constants/modules';
import { deliveryDays, onOrder } from '../services/sparesNeed';
import { nextOrderNo } from '../services/orders';
import { ORDER_DEPTS, ORDER_DEPT_LABEL, PurchaseOrder } from '../types/orders';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, tn, useT } from '../utils/i18n';

type Show = 'all' | 'short' | 'expired' | 'soon' | 'poor';
type Act = { kind: StoreMoveKind; qty: string; expiry: string; to: string; note: string; batchKey?: string; wear?: Wear; byWear?: Record<Wear, string> };
const MOVE_TEXT: Record<StoreMoveKind, string> = { received: 'Received', issued: 'Issued', returned: 'Returned', disposed: 'Disposed', count: 'Counted' };

const ICONS: Record<string, string> = {
  Body: 'tshirt-crew-outline', Feet: 'shoe-formal', Hands: 'hand-back-left-outline', 'Eyes & face': 'safety-goggles', Head: 'hard-hat', Hearing: 'ear-hearing', Breathing: 'face-mask-outline', 'Fall protection': 'seatbelt', Water: 'lifebuoy',
  'Dry store': 'package-variant', Chilled: 'fridge-outline', Frozen: 'snowflake', Beverages: 'cup-water', Bakery: 'bread-slice-outline', 'Fresh fruit & veg': 'food-apple-outline', 'Cleaning & galley': 'spray-bottle',
  Letters: 'flag-variant-outline', Numerals: 'numeric', Special: 'flag-triangle', Countries: 'earth', Company: 'flag-outline', 'IMO publications': 'book-open-variant', 'Nautical publications': 'book-open-page-variant-outline', Charts: 'map-outline',
  Deck: 'anchor', 'Ropes & rigging': 'link-variant', Paint: 'format-paint', Engine: 'engine-outline', Electrical: 'flash-outline', Tools: 'wrench-outline', Cleaning: 'spray-bottle', Chemicals: 'flask-outline', Stationery: 'pencil-outline', Other: 'package-variant',
};

export default function StoresSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { storeItems, storeMoves, storeRoomList, crew, vessel, purchaseOrders, saveRow, saveRows, appendRow } = useData();
  const rooms = useMemo(() => storeRooms(storeRoomList), [storeRoomList]);
  const manage = route.params?.view === 'manage';
  // The store on screen: the one in the route (a menu entry, a scanned label), else the first.
  const room: StoreRoom = rooms.find((r) => r.id === route.params?.view) ?? rooms[0];
  const unknownRoom = !!route.params?.view && !manage && !rooms.some((r) => r.id === route.params?.view);
  const store: StoreKind = room.kind;
  const ppe = store === 'ppe';
  const general = store === 'general';
  const flags = store === 'flags';
  const bridge = store === 'bridge';
  const wear = wearKept(store);
  const confirmSign = useSignConfirm();
  const sync = useSync();
  const { signer, picker } = useSigner(ppe ? 'ISSUED BY' : 'SIGNING AS');
  const today = todayIso();
  const people = useMemo(() => crew.filter(isAboard), [crew]);

  const [page, setPage] = useState<'stock' | 'crew'>('stock');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [act, setAct] = useState<Act | null>(null);
  const [edit, setEdit] = useState<StoreItem | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Another store opened (the menu, a label): its own page, nothing left open from the last one.
  useEffect(() => {
    setOpen(null);
    setAct(null);
    setEdit(null);
    setCat('');
    setQ('');
    setShow('all');
  }, [room.id, manage]);
  const items = useMemo(() => storeItems.filter((i) => roomOf(i) === room.id), [storeItems, room.id]);
  const own = isBuiltinRoom(room.id) ? {} : { roomId: room.id };
  const moves = useMemo(() => storeMoves.filter((m) => items.some((i) => i.id === m.itemId)), [storeMoves, items]);
  const rows = useMemo(() => storeStatus(items, moves, today), [items, moves, today]);
  const counts = storeCounts(rows);
  // Below the minimum, less what is already on an open order (services/sparesNeed onOrder).
  // With use on record: at the re-order point (minimum + use during the lead time).
  const toBuy = useMemo(() => toOrder(rows, onOrder(purchaseOrders, 'storeItemId'), storeUse(moves, today), deliveryDays(purchaseOrders, 'storeItemId')), [rows, purchaseOrders, moves, today]);
  const cats = STORE_CATEGORIES[store];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows
    .filter((r) => !cat || (r.item.category ?? '') === cat)
    .filter((r) => show === 'all' || (show === 'short' ? r.short > 0 : show === 'expired' ? r.expired > 0 : show === 'poor' ? r.poor > 0 : r.soon))
    .filter((r) => words.every((w) => `${r.item.name} ${r.item.size ?? ''} ${r.item.category ?? ''} ${r.item.location ?? ''}`.toLowerCase().includes(w)))
    .sort((a, b) => (a.item.category ?? '~').localeCompare(b.item.category ?? '~') || a.item.name.localeCompare(b.item.name) || (a.item.size ?? '').localeCompare(b.item.size ?? '', undefined, { numeric: true }));
  const held = useMemo(() => heldByPerson(items, moves), [items, moves]);

  const done = (w: string | null | void) => typeof w === 'string' && setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  const fail = (e: any) => Alert.alert(room.name, String(e?.message ?? e));
  const color = (r: StoreStatus) => (r.expired || r.usable <= 0 ? COLORS.danger : r.short || r.soon || r.poor ? COLORS.warning : COLORS.success);
  const wearColor = (w: Wear) => (w === 'poor' ? COLORS.danger : w === 'good' ? COLORS.success : COLORS.primary);
  // A batch as the person reads it: the flag locker's by its wear, the rest by date and lot.
  const batchText = (b: Batch) => (b.wear ? [b.expiry ? mmYY(b.expiry) : null, tk(`st.wear.${b.wear}`)].filter(Boolean).join(' · ') : batchLabel(b));

  // ---- the list ----
  const addStarter = async () => {
    const now = Date.now();
    const out: StoreItem[] = [];
    const list: { name: string; category: string; sizes?: string[]; unit: string; min: number }[] = flags ? FLAGS_STARTER : bridge ? BRIDGE_STARTER : PPE_STARTER;
    for (const s of list) for (const size of s.sizes ?? [undefined]) out.push({ id: uid('sto'), store, ...own, name: s.name, category: s.category, ...(size ? { size } : {}), unit: s.unit, min: s.min, order: out.length, updatedAt: now });
    await saveRows(storage.STORE_ITEMS_KEY, out);
    setSaved(t('st.added', { n: out.length }));
  };
  const saveItem = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert(t('def.item'), t('mi.nameIt'));
    const clean = Object.fromEntries(Object.entries({ ...edit, name: edit.name.trim() }).filter(([, v]) => v !== '' && v !== undefined)) as unknown as StoreItem;
    await saveRow(storage.STORE_ITEMS_KEY, clean);
    setEdit(null);
    playSuccessSound();
  };

  // ---- moves ----
  const doMove = async (r: StoreStatus) => {
    if (!act) return;
    if (wear && act.kind === 'count') return countWear(r);
    const qty = Number(act.qty.replace(',', '.'));
    if (!(qty >= 0) || (act.kind !== 'count' && !(qty > 0))) return Alert.alert(tk(`st.move.${act.kind}`), t('mc.howMany'));
    if (!signer) return Alert.alert(t('sign.who'), t('round.chooseName'));
    let expiry = act.expiry.trim() ? normExpiry(act.expiry) : undefined;
    if (act.expiry.trim() && !expiry) return Alert.alert(t('st.bestBefore'), t('st.bbFmt'));
    let batchNo: string | undefined;
    let moveWear: Wear | undefined;
    if (act.kind === 'issued' || act.kind === 'disposed' || act.kind === 'count') {
      const b = act.batchKey ? r.batches.find((x) => x.key === act.batchKey) : act.kind === 'issued' ? batchToIssue(r.batches, today) : r.batches.length === 1 ? r.batches[0] : undefined;
      if (act.kind !== 'count' && !b) return Alert.alert(tk(`st.move.${act.kind}`), t('st.noneOnHand'));
      if (b) {
        if (act.kind !== 'count' && qty > b.qty) return Alert.alert(tk(`st.move.${act.kind}`), t('mi.only', { n: b.qty }));
        expiry = b.expiry;
        batchNo = b.batchNo;
        moveWear = b.wear;
      }
    }
    if (wear && act.kind === 'received') moveWear = act.wear ?? 'new';
    const person = ppe && (act.kind === 'issued' || act.kind === 'returned') ? people.find((p) => p.id === act.to) : undefined;
    if (ppe && (act.kind === 'issued' || act.kind === 'returned') && !person) return Alert.alert(tk(`st.move.${act.kind}`), ppe && act.kind === 'issued' ? t('st.whoReceives') : t('st.whoReturns'));
    const what = `${MOVE_TEXT[act.kind]} — ${storeItemTitle(r.item)} ${qty} ${r.item.unit}${moveWear ? ` (${moveWear})` : ''}${person ? ` · ${person.name}` : ''}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    // PPE handed over: the person receiving it signs for it, here.
    const rec = person && act.kind === 'issued' ? await confirmSign({ personKey: person.id, name: person.name, ownDevice: false, what: `Received — ${storeItemTitle(r.item)} ${qty} ${r.item.unit}`, always: true }) : null;
    if (person && act.kind === 'issued' && !rec) return;
    const now = Date.now();
    const m: StoreMove = {
      id: uid('stm'), itemId: r.item.id, kind: act.kind, qty, ...(batchNo ? { batchNo } : {}), ...(expiry ? { expiry } : {}), ...(moveWear ? { wear: moveWear } : {}), date: today,
      ...(person ? { to: person.name, toId: person.id } : {}), ...(rec?.proof ? { toWith: rec.proof } : {}), ...(act.note.trim() ? { note: act.note.trim() } : store === 'provisions' && act.kind === 'issued' ? { note: 'Galley' } : {}),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
    };
    await appendRow(storage.STORE_MOVES_KEY, m);
    setAct(null);
    playSuccessSound();
    setSaved(what);
  };

  // The flag locker counts an item by wear in one go — new, good, poor — and so moves a flag from good to poor.
  const countWear = async (r: StoreStatus) => {
    if (!act?.byWear) return;
    const n = Object.fromEntries(WEARS.map((w) => [w, Number((act.byWear![w] || '0').replace(',', '.'))])) as Record<Wear, number>;
    if (WEARS.some((w) => !Number.isFinite(n[w]) || n[w] < 0)) return Alert.alert(t('sop.count'), t('sp.everyLine'));
    if (!signer) return Alert.alert(t('sign.who'), t('round.chooseName'));
    const what = `Counted — ${storeItemTitle(r.item)}: ${WEARS.map((w) => `${n[w]} ${w}`).join(', ')}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const now = Date.now();
    const had = byWear(r.batches);
    const out: StoreMove[] = WEARS.filter((w) => n[w] > 0 || had[w] > 0).map((w) => ({
      id: uid('stm'), itemId: r.item.id, kind: 'count', qty: n[w], wear: w, date: today, ...(act.note.trim() ? { note: act.note.trim() } : {}),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
    }));
    if (out.length) await saveRows(storage.STORE_MOVES_KEY, out);
    setAct(null);
    playSuccessSound();
    setSaved(what);
  };

  // ---- Excel ----
  // Any list (the AI names the columns; the list stays here) or a photo / PDF of a paper one (the AI reads it).
  const importAi = async (how: 'sheet' | 'doc') => {
    try {
      if (how === 'sheet') {
        const file = await pickSheetRows();
        if (!file) return;
        setSaved(t('pax.aiReading'));
        const r = await aiRenameHeadings(file.rows, ppe ? 'ppe' : 'provisions');
        setSaved(null);
        return importSheet({ name: file.name, rows: r.rows }, `Columns read by the AI: ${r.mapped.map((m) => `${m.from} → ${m.to}`).join('; ')}.`);
      }
      const doc = await pickDocForAi();
      if (!doc) return;
      setSaved(t('st.aiReadingDoc', { name: doc.name }));
      const r = await aiReadDocument(doc.dataUri, ppe ? 'ppe' : 'provisions');
      setSaved(null);
      return importSheet({ name: doc.name, rows: r.rows }, `Read by the AI from the ${/pdf/.test(doc.dataUri.slice(0, 30)) ? 'PDF' : 'photo'} — check the lines before importing.${r.unreadable ? ` Not readable: ${r.unreadable}` : ''}`);
    } catch (e: any) {
      setSaved(null);
      Alert.alert(t('pax.import'), String(e?.message ?? e));
    }
  };

  const importSheet = async (given?: { name: string; rows: unknown[][] }, note?: string, into: StoreRoom = room) => {
    try {
      const picked = given ?? (await pickSheetRows());
      if (!picked) return;
      const lines = readStoreSheet(picked.rows);
      if (!lines.length) return Alert.alert(t('pax.import'), t('st.nothingFound', { file: picked.name }));
      const plan = planStoreImport(lines, storeItems, into);
      const apply = async () => {
        await saveRows(storage.STORE_ITEMS_KEY, plan.save);
        const now = Date.now();
        const by = signer?.name ?? 'Import';
        for (const c of plan.counts) await appendRow(storage.STORE_MOVES_KEY, { id: uid('stm'), itemId: c.itemId, kind: 'count', qty: c.qty, ...(c.expiry ? { expiry: c.expiry } : {}), ...(c.wear ? { wear: c.wear } : {}), date: today, note: `Imported from ${picked.name}`, by, at: now, updatedAt: now } as StoreMove);
        playSuccessSound();
        setSaved(`${into.name}: ${plan.added.length} added, ${plan.updated.length} updated, ${plan.counts.length} quantities counted — from “${picked.name}”`);
      };
      Alert.alert(t('st.importQ', { n: lines.length, file: picked.name, into: into.name }), [note ?? null, plan.added.length ? t('pax.new', { names: `${plan.added.slice(0, 12).join(', ')}${plan.added.length > 12 ? ` ${t('st.andMore', { n: plan.added.length - 12 })}` : ''}` }) : null, plan.updated.length ? t('st.updatedN', { n: plan.updated.length }) : null, plan.counts.length ? t('st.qtyCounted') : null].filter(Boolean).join('\n\n'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('pax.import'), onPress: () => void apply() }]);
    } catch (e: any) {
      Alert.alert(t('pax.importFailed'), String(e?.message ?? e));
    }
  };
  const orderSheet = () => saveSheet([['Item', 'Size', 'Category', 'Unit', 'On hand (in date)', 'Minimum', 'On order', 'To order'], ...toBuy.map((o) => { const r = rows.find((x) => x.item.id === o.item.id)!; return [o.item.name, o.item.size ?? '', o.item.category ?? '', o.item.unit, r.usable, o.item.min, o.onOrder || '', o.need]; })], 'To order', `${room.name} — to order ${today}`, vessel).then(done, fail);
  // Draft requisitions from a list to order — one per department (storeDept).
  const makeDrafts = async (list: ReturnType<typeof toOrder>, note: string): Promise<PurchaseOrder[]> => {
    let nos = purchaseOrders;
    const made: PurchaseOrder[] = [];
    for (const dept of ORDER_DEPTS.filter((d) => list.some((o) => storeDept(o.item) === d))) {
      const now = Date.now();
      const order: PurchaseOrder = {
        id: uid('po'), no: nextOrderNo(nos, dept), dept, status: 'draft', date: today, by: '', at: now, updatedAt: now, notes: note,
        lines: list.filter((o) => storeDept(o.item) === dept).map((o) => ({
          id: uid('ol'), description: storeItemTitle(o.item), qty: o.need, unit: o.item.unit, stockQty: o.usable, storeItemId: o.item.id,
          ...(o.daily ? { notes: `uses ~${Math.round(o.daily * 300) / 10}/month — re-order point ${o.rop}` } : {}),
        })),
      };
      await saveRow(storage.PURCHASE_ORDERS_KEY, order);
      nos = [...nos, order];
      made.push(order);
    }
    return made;
  };
  const draftOrder = () => {
    if (!toBuy.length) return Alert.alert(t('sp.newOrder'), t('sp.nothingToOrder'));
    const depts = ORDER_DEPTS.filter((d) => toBuy.some((o) => storeDept(o.item) === d));
    Alert.alert(t('sp.createOrders'), depts.map((d) => `${ORDER_DEPT_LABEL[d]}: ${tn('n.line', toBuy.filter((o) => storeDept(o.item) === d).length)}`).join('\n'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sp.create'),
        onPress: () => void (async () => {
          const made = await makeDrafts(toBuy, room.name);
          if (made.length) nav.navigate('Order', { id: made[0].id });
        })(),
      },
    ]);
  };

  // ---- stocktake: every batch of what is shown (a category, a search), signed once ----
  const [counting, setCounting] = useState<Record<string, string> | null>(null);
  // The flag locker: every item three lines — new, good, poor — whatever it held, so a flag gone poor is counted there.
  const countLines = useMemo(() => shown.flatMap((r): { r: StoreStatus; b?: Batch; key: string; w?: Wear }[] => (wear
    ? WEARS.map((w) => ({ r, b: r.batches.find((b) => b.wear === w), key: `${r.item.id}|w:${w}`, w }))
    : r.batches.length ? r.batches.map((b) => ({ r, b, key: `${r.item.id}|${b.key}` })) : [{ r, b: undefined, key: `${r.item.id}|` }])), [shown, wear]);
  const startCount = () => setCounting(Object.fromEntries(countLines.map((l) => [l.key, String(l.b?.qty ?? 0)])));
  const saveCount = async () => {
    if (!counting) return;
    const lines = countLines.filter((l) => counting[l.key] != null).map((l) => ({ ...l, n: Number(counting[l.key].replace(',', '.')) }));
    if (lines.some((l) => !counting[l.key].trim() || !Number.isFinite(l.n) || l.n < 0)) return Alert.alert(t('sp.stocktake'), t('sp.everyLine'));
    if (!signer) return Alert.alert(t('mc.whoCounted'), t('round.chooseName'));
    const where = cat ? `${room.name} · ${cat}` : room.name;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Stocktake: ${where} — ${lines.length} line${lines.length === 1 ? '' : 's'}` });
    if (!sig) return;
    const now = Date.now();
    // Every line counted is recorded — an unchanged count is the evidence it was checked.
    const counted: StoreMove[] = lines.filter((l) => l.n > 0 || l.b).map((l) => ({
      id: uid('stm'), itemId: l.r.item.id, kind: 'count', qty: l.n, ...(l.b?.batchNo ? { batchNo: l.b.batchNo } : {}), ...(l.b?.expiry ? { expiry: l.b.expiry } : {}), ...(l.w ? { wear: l.w } : {}), date: today, note: `Stocktake ${where}`,
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
    }));
    await saveRows(storage.STORE_MOVES_KEY, counted);
    setCounting(null);
    playSuccessSound();
    const diff = lines.filter((l) => l.n !== (l.b?.qty ?? 0)).length;
    const msg = t('sp.counted', { x: tn('n.line', lines.length), n: diff });
    if (!moduleOn('orders')) return Alert.alert(t('sp.stocktake'), msg);
    // What the count leaves at or below the re-order point goes straight into a draft.
    const ids = new Set(lines.map((l) => l.r.item.id));
    const after = [...moves, ...counted];
    const list = toOrder(storeStatus(items, after, today).filter((r) => ids.has(r.item.id)), onOrder(purchaseOrders, 'storeItemId'), storeUse(after, today), deliveryDays(purchaseOrders, 'storeItemId'));
    if (!list.length) return Alert.alert(t('sp.stocktake'), `${msg}\n\n${t('sp.countNoOrder')}`);
    const made = await makeDrafts(list, `From the stocktake of ${where}, ${uiDate(today)} — ${signer.name}`);
    Alert.alert(t('sp.stocktake'), `${msg}\n\n${t('sp.countDraft', { x: tn('n.line', list.length), nos: made.map((o) => o.no).join(', ') })}`, [
      { text: t('common.ok'), style: 'cancel' },
      { text: t('sp.openDraft'), onPress: () => nav.navigate('Order', { id: made[0].id }) },
    ]);
  };

  // ---- a person's PPE record ----
  const personPdf = (name: string) => {
    const mine = moves.filter((m) => m.to === name && (m.kind === 'issued' || m.kind === 'returned')).sort((a, b) => a.at - b.at);
    const title = (id: string) => { const it = items.find((i) => i.id === id); return it ? storeItemTitle(it) : '—'; };
    return exportDocPdf({
      title: `PPE record — ${name}`,
      vesselLine: vesselHeader(vessel),
      sections: [
        { title: 'Holds now', table: { head: ['Item', 'Qty', 'Since'], rows: (held.get(name) ?? []).map((h) => [storeItemTitle(h.item), `${h.qty} ${h.item.unit}`, h.last]) } },
        { title: 'Issued and returned', table: { head: ['Date', 'Item', 'Qty', 'Issued / returned', 'Signed for', 'By'], rows: mine.map((m) => [m.date, title(m.itemId), String(m.qty), MOVE_TEXT[m.kind], m.toWith ? proofShort(m.toWith) : m.kind === 'returned' ? '—' : 'not signed', `${m.by}${m.signedWith ? ` · ${proofShort(m.signedWith)}` : ''}`]) } },
        { title: 'Statement', text: 'I have received the personal protective equipment listed above, have been shown how to use and look after it, and will report any defect or loss.' },
        { title: 'Signature', signatures: [{ role: 'Crew member', name, detail: '' }, { role: 'Issued by', name: signer?.name ?? '', detail: '' }] },
      ],
    }, `PPE record ${name} ${today}`, vessel).then(done, fail);
  };

  const title = room.name;
  if (manage) {
    return (
      <Screen scroll>
        <ScreenTitle title={t('st.title')} subtitle={t('st.sub', { n: rooms.length })} help="Stores" />
        {!sync.canManage('stores') ? (
          <Text style={styles.sub}>{t('st.manageDenied')}</Text>
        ) : <StoreRooms onOpen={(id) => nav.setParams({ view: id })} onImport={(r) => void importSheet(undefined, undefined, r)} done={done} fail={fail} />}
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginTop: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}
      </Screen>
    );
  }
  return (
    <Screen scroll>
      <ScreenTitle title={title} subtitle={[room.code, room.location, tn('n.item', counts.items), counts.short ? t('st.belowMin', { n: counts.short }) : null, counts.poor ? t('st.poorN', { n: counts.poor }) : null, counts.expired ? t('st.outOfDate', { n: counts.expired }) : null, counts.soon ? t('st.expiringN', { n: counts.soon }) : null].filter(Boolean).join(' · ')} help="Stores" />
      {unknownRoom ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700', marginBottom: SIZES.sm }]}>{t('st.unknown')}</Text> : null}
      {ppe ? (
        <View style={styles.chips}>
          {(['stock', 'crew'] as const).map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, page === k && styles.chipOn]} onPress={() => setPage(k)}>
              <Text style={[styles.chipText, page === k && styles.chipTextOn]}>{k === 'stock' ? t('st.stock', { n: items.length }) : t('st.issuedCrew', { n: held.size })}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {page === 'crew' && ppe ? (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{t('st.crewHint')}</Text>
          {people.map((p) => {
            const list = held.get(p.name) ?? [];
            return (
              <View key={p.id} style={[styles.item, { borderLeftColor: list.length ? COLORS.primary : COLORS.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <Text style={[styles.name, { flex: 1 }]}>{[p.name, p.rank].filter(Boolean).join(' · ')}</Text>
                  <TouchableOpacity style={styles.small} onPress={() => void personPdf(p.name)}><Text style={styles.smallText}>{t('st.ppePdf')}</Text></TouchableOpacity>
                </View>
                <Text style={styles.sub}>{list.length ? list.map((h) => `${storeItemTitle(h.item)} × ${h.qty}`).join(' · ') : t('st.nothingIssued')}</Text>
              </View>
            );
          })}
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
        </>
      ) : (
        <>
          <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm, gap: SIZES.xs }]}>
            <TextInput style={[styles.input, { flex: 2, minWidth: 200, marginTop: 0 }]} value={q} onChangeText={setQ} placeholder={ppe ? t('st.searchPpe') : flags ? t('st.searchFlags') : bridge ? t('st.searchBridge') : general ? t('st.searchGen') : t('st.searchProv')} placeholderTextColor={COLORS.textLight} />
            <Dropdown caption={store !== 'provisions' ? t('docs.type') : t('st.section')} value={cat} onChange={setCat} style={{ flex: 1, minWidth: 200 }} options={[{ value: '', label: t('pax.showAll', { n: rows.length }) }, ...cats.map((c) => ({ value: c, label: `${c} · ${rows.filter((r) => r.item.category === c).length}`, icon: ICONS[c] }))]} />
            <Dropdown caption={t('pax.show')} value={show} onChange={setShow} style={{ flex: 1, minWidth: 200 }} options={[
              { value: 'all' as Show, label: t('lb.all') },
              { value: 'short' as Show, label: t('st.showShort', { n: counts.short }) },
              { value: 'expired' as Show, label: t('st.showExpired', { n: counts.expired }) },
              { value: 'soon' as Show, label: t('st.showSoon', { n: counts.soon }) },
              ...(wear ? [{ value: 'poor' as Show, label: t('st.showPoor', { n: counts.poor }) }] : []),
            ]} />
          </View>
          <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm }]}>
            <TouchableOpacity style={styles.btn} onPress={() => setEdit({ id: uid('sto'), store, ...own, name: '', unit: store === 'provisions' ? 'packs' : 'pcs', min: 0, order: items.length, updatedAt: Date.now(), ...(cat ? { category: cat } : {}) })}><Text style={styles.btnText}>{`+ ${t('def.item')}`}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} disabled={!toBuy.length} onPress={() => void orderSheet()}><Text style={styles.smallText}>{t('st.toOrder', { n: toBuy.length })}</Text></TouchableOpacity>
            {moduleOn('orders') && toBuy.length ? <TouchableOpacity style={styles.small} onPress={draftOrder}><Text style={styles.smallText}>{`→ ${t('sp.newOrder')}`}</Text></TouchableOpacity> : null}
            {shown.length && !counting ? <TouchableOpacity style={styles.small} onPress={startCount}><Text style={styles.smallText}>{t('sp.stocktake')}</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.small} onPress={() => void importSheet()}><Text style={styles.smallText}>{t('pax.fromExcel')}</Text></TouchableOpacity>
            {aiReady(sync.enrolled) ? (
              <>
                <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void importAi('sheet')}><MciIcon name="creation" size={14} color={COLORS.primary} /><Text style={styles.smallText}>{t('crw.anyList')}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void importAi('doc')}><MciIcon name="camera-outline" size={14} color={COLORS.primary} /><Text style={styles.smallText}>{t('common.photoPdfAi')}</Text></TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.small} onPress={() => saveSheet(storeSheet(rows), title, `${title} ${today}`, vessel).then(done, fail)}><Text style={styles.smallText}>{t('pax.toExcel')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => saveSheet(storeTemplateRows(store), title, `${title} template`, vessel).then(done, fail)}><Text style={styles.smallText}>{t('pax.template')}</Text></TouchableOpacity>
          </View>
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}

          {edit ? (
            <Card>
              <Label>{items.some((i) => i.id === edit.id) ? t('def.item') : t('mi.new')}</Label>
              <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder={ppe ? t('st.namePpe') : flags ? t('st.nameFlags') : bridge ? t('st.nameBridge') : general ? t('st.nameGen') : t('st.nameProv')} placeholderTextColor={COLORS.textLight} autoFocus />
              <View style={styles.row}>
                <Dropdown caption={store !== 'provisions' ? t('docs.type') : t('st.section')} value={edit.category ?? ''} onChange={(v: string) => setEdit({ ...edit, category: v || undefined })} options={[{ value: '', label: '—' }, ...cats.map((c) => ({ value: c, label: c, icon: ICONS[c] }))]} style={{ flex: 1, minWidth: 200 }} />
                {ppe || flags || bridge ? <TextInput style={[styles.input, { width: bridge ? 120 : 90, marginTop: 0 }]} value={edit.size ?? ''} onChangeText={(v) => setEdit({ ...edit, size: v })} placeholder={bridge ? t('st.edition') : t('st.size')} placeholderTextColor={COLORS.textLight} /> : null}
                <TextInput style={[styles.input, { width: 100, marginTop: 0 }]} value={edit.unit} onChangeText={(v) => setEdit({ ...edit, unit: v })} placeholder={t('st.unit')} placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { width: 110, marginTop: 0 }]} value={String(edit.min)} onChangeText={(v) => setEdit({ ...edit, min: Number(v.replace(',', '.')) || 0 })} keyboardType="number-pad" placeholder={t('st.minimum')} placeholderTextColor={COLORS.textLight} />
              </View>
              <Text style={styles.sub}>{t('st.minHint')}</Text>
              <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} placeholder={t('st.wherePh')} placeholderTextColor={COLORS.textLight} />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void saveItem()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                {items.some((i) => i.id === edit.id) ? <TouchableOpacity onPress={() => void saveRow(storage.STORE_ITEMS_KEY, { ...edit, deleted: true }).then(() => { setEdit(null); setOpen(null); })}><Text style={[styles.link, { color: COLORS.danger }]}>{t('common.remove')}</Text></TouchableOpacity> : null}
              </View>
            </Card>
          ) : null}

          {!items.length ? (
            <Card>
              <Text style={styles.sub}>{ppe ? t('st.emptyPpe') : flags ? t('st.emptyFlags') : bridge ? t('st.emptyBridge') : general ? t('st.emptyGen', { name: room.name }) : t('st.emptyProv')}</Text>
              {ppe || flags || bridge ? <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void addStarter()}><Text style={styles.btnText}>{flags ? t('st.addFlags') : bridge ? t('st.addBridge') : t('st.addPpe')}</Text></TouchableOpacity> : null}
            </Card>
          ) : null}

          {counting ? (
            <Card>
              <Label>{`${t('sp.stocktake')} · ${cat || room.name}`}</Label>
              <Text style={styles.sub}>{t('sp.countHint')}</Text>
              {wear ? shown.map((r) => (
                <View key={r.item.id} style={[styles.row, { alignItems: 'center' }]}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.name}>{storeItemTitle(r.item)}</Text>
                    <Text style={styles.sub}>{[r.item.location, r.item.unit].filter(Boolean).join(' · ')}</Text>
                  </View>
                  {WEARS.map((w) => (
                    <View key={w} style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: wearColor(w) }}>{tk(`st.wear.${w}`)}</Text>
                      <TextInput style={[styles.input, { width: 64, marginTop: 0, borderColor: wearColor(w) }]} value={counting[`${r.item.id}|w:${w}`] ?? ''} onChangeText={(v) => setCounting({ ...counting, [`${r.item.id}|w:${w}`]: v })} keyboardType="number-pad" selectTextOnFocus accessibilityLabel={`${storeItemTitle(r.item)} — ${tk(`st.wear.${w}`)}`} />
                    </View>
                  ))}
                </View>
              )) : countLines.map((l) => (
                <View key={l.key} style={[styles.row, { alignItems: 'center' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{storeItemTitle(l.r.item)}</Text>
                    <Text style={styles.sub}>{[l.b ? batchText(l.b) : null, l.r.item.location, l.r.item.unit].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <TextInput style={[styles.input, { width: 90, marginTop: 0 }]} value={counting[l.key] ?? ''} onChangeText={(v) => setCounting({ ...counting, [l.key]: v })} keyboardType="decimal-pad" selectTextOnFocus />
                </View>
              ))}
              {picker}
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void saveCount()}><Text style={styles.btnText}>{t('sp.record')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCounting(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </Card>
          ) : null}

          {counting ? null : shown.map((r, k) => {
            const head = (r.item.category ?? '') !== (shown[k - 1]?.item.category ?? (k ? '' : '§')) ? r.item.category ?? 'Other' : null;
            const isOpen = open === r.item.id;
            const last = moves.filter((m) => m.itemId === r.item.id).sort((a, b) => b.at - a.at).slice(0, 6);
            return (
              <React.Fragment key={r.item.id}>
                {head ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.md, marginBottom: 4 }}>
                    <MciIcon name={ICONS[head] ?? 'package-variant'} size={16} color={COLORS.textDark} />
                    <Text style={[styles.sub, { fontWeight: '800', color: COLORS.textDark, marginTop: 0 }]}>{head}</Text>
                  </View>
                ) : null}
                <TouchableOpacity style={[styles.item, { borderLeftColor: color(r) }]} onPress={() => { setOpen(isOpen ? null : r.item.id); setAct(null); }} activeOpacity={0.8}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap' }}>
                    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 }}>
                      <Text style={styles.name}>{storeItemTitle(r.item)}</Text>
                      <Text style={styles.sub}>{[r.item.location, t('st.minL', { n: r.item.min, unit: r.item.unit })].filter(Boolean).join(' · ')}</Text>
                      <Text style={[styles.sub, { color: color(r), fontWeight: '700' }]}>{[wear ? t('st.serviceable', { n: r.usable, unit: r.item.unit }) : t('st.inDate', { n: r.usable, unit: r.item.unit }), r.poor ? t('st.poorN', { n: r.poor }) : null, r.short ? t('st.belowMin', { n: r.short }) : null, r.expired ? t('st.outOfDate', { n: r.expired }) : r.soon && r.next ? t('crew.expires', { date: uiDate(r.next) }) : null].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
                      {r.batches.slice(0, 3).map((b) => {
                        const s = expiryState(today, b.expiry);
                        const c = s === 'expired' ? COLORS.danger : b.wear ? wearColor(b.wear) : (s === 'soon' || (b.expiry && r.soon && b.expiry === r.next)) ? COLORS.warning : COLORS.success;
                        return (
                          <View key={b.key} style={{ borderWidth: 1, borderColor: c, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 48, alignItems: 'center' }}>
                            <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: c }}>{b.qty}</Text>
                            {b.expiry ? <Text style={{ fontSize: 10, fontWeight: '700', color: c }}>{mmYY(b.expiry)}</Text> : null}
                            {b.wear ? <Text style={{ fontSize: 10, fontWeight: '700', color: c }}>{tk(`st.wear.${b.wear}`)}</Text> : null}
                          </View>
                        );
                      })}
                      {!r.batches.length ? <View style={{ borderWidth: 1, borderColor: COLORS.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 48, alignItems: 'center' }}><Text style={{ fontSize: SIZES.small, fontWeight: '800', color: COLORS.danger }}>0</Text></View> : null}
                    </View>
                  </View>
                </TouchableOpacity>
                {isOpen ? (
                  <Card>
                    <View style={styles.row}>
                      {(ppe ? (['received', 'issued', 'returned', 'count', 'disposed'] as StoreMoveKind[]) : flags ? (['received', 'count', 'disposed'] as StoreMoveKind[]) : (['received', 'issued', 'count', 'disposed'] as StoreMoveKind[])).map((k2) => (
                        <TouchableOpacity key={k2} style={[styles.small, act?.kind === k2 && { backgroundColor: COLORS.primary }]} onPress={() => {
                          // Disposing: what is out of date, else what is worn to poor, comes up first.
                          const expiredB = k2 === 'disposed' ? r.batches.find((b) => expiryState(today, b.expiry) === 'expired') : undefined;
                          const old = expiredB ?? (k2 === 'disposed' ? r.batches.find((b) => b.wear === 'poor') : undefined);
                          const had = byWear(r.batches);
                          setAct({ kind: k2, qty: k2 === 'count' ? String(r.onHand) : old ? String(old.qty) : '', expiry: '', to: '', note: expiredB ? 'Out of date' : old ? 'Worn — poor' : '', ...(old ? { batchKey: old.key } : {}), ...(wear && k2 === 'received' ? { wear: 'new' as Wear } : {}), ...(wear && k2 === 'count' ? { byWear: { new: String(had.new), good: String(had.good), poor: String(had.poor) } } : {}) });
                        }}>
                          <Text style={[styles.smallText, act?.kind === k2 && { color: COLORS.textWhite }]}>{k2 === 'received' ? t('st.receive') : k2 === 'issued' ? (ppe ? t('st.issueCrew') : store === 'provisions' ? t('st.issueGalley') : t('st.issue')) : k2 === 'returned' ? t('st.return') : k2 === 'count' ? t('sop.count') : t('mi.dispose')}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity onPress={() => setEdit(r.item)}><Text style={styles.link}>{t('common.edit')}</Text></TouchableOpacity>
                    </View>
                    {act ? (
                      <>
                        {act.byWear ? (
                          <View style={[styles.row, { marginTop: SIZES.xs }]}>
                            {WEARS.map((w) => (
                              <View key={w} style={{ alignItems: 'center' }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: wearColor(w) }}>{tk(`st.wear.${w}`)}</Text>
                                <TextInput style={[styles.input, { width: 72, marginTop: 0, borderColor: wearColor(w) }]} value={act.byWear![w]} onChangeText={(v) => setAct({ ...act, byWear: { ...act.byWear!, [w]: v } })} keyboardType="number-pad" selectTextOnFocus accessibilityLabel={tk(`st.wear.${w}`)} />
                              </View>
                            ))}
                          </View>
                        ) : <TextInput style={styles.input} value={act.qty} onChangeText={(v) => setAct({ ...act, qty: v })} keyboardType="decimal-pad" placeholder={t('mi.howMany', { unit: r.item.unit })} placeholderTextColor={COLORS.textLight} autoFocus />}
                        {act.byWear ? <Text style={styles.sub}>{t('st.wearHint')}</Text> : null}
                        {wear && act.kind === 'received' ? (
                          <View style={[styles.chips, { marginTop: SIZES.xs }]}>
                            {WEARS.map((w) => (
                              <TouchableOpacity key={w} style={[styles.chip, act.wear === w && styles.chipOn]} onPress={() => setAct({ ...act, wear: w })} accessibilityRole="radio" accessibilityState={{ selected: act.wear === w }}>
                                <Text style={[styles.chipText, act.wear === w && styles.chipTextOn]}>{tk(`st.wear.${w}`)}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : null}
                        {act.kind === 'received' && !wear ? <TextInput style={styles.input} value={act.expiry} onChangeText={(v) => setAct({ ...act, expiry: v })} placeholder={store === 'provisions' ? t('st.bbPh') : t('st.expPh')} placeholderTextColor={COLORS.textLight} /> : null}
                        {(act.kind === 'disposed' || (act.kind === 'count' && !act.byWear)) && r.batches.length > 1 ? (
                          <Dropdown caption={t('st.batch')} value={act.batchKey ?? ''} onChange={(v: string) => setAct({ ...act, batchKey: v || undefined, ...(act.kind === 'count' ? { qty: String(r.batches.find((b) => b.key === v)?.qty ?? act.qty) } : {}) })} options={[{ value: '', label: act.kind === 'count' ? t('st.newBatch') : t('common.choose') }, ...r.batches.map((b) => ({ value: b.key, label: `${batchText(b)} — ${b.qty} ${r.item.unit}` }))]} style={{ marginTop: SIZES.xs }} />
                        ) : null}
                        {ppe && (act.kind === 'issued' || act.kind === 'returned') ? (
                          <Dropdown caption={act.kind === 'issued' ? t('st.toCap') : t('st.fromCap')} value={act.to} onChange={(v: string) => setAct({ ...act, to: v })} options={[{ value: '', label: t('common.choose') }, ...people.map((p) => ({ value: p.id, label: p.rank ? `${p.name} · ${p.rank}` : p.name }))]} style={{ marginTop: SIZES.xs }} />
                        ) : null}
                        <TextInput style={styles.input} value={act.note} onChangeText={(v) => setAct({ ...act, note: v })} placeholder={act.kind === 'received' ? t('st.fromPh') : act.kind === 'disposed' ? t('st.whyPh') : !ppe && store !== 'provisions' && act.kind === 'issued' ? t('st.toWhomPh') : t('mo.note')} placeholderTextColor={COLORS.textLight} />
                        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                        {ppe && act.kind === 'issued' ? <Text style={styles.sub}>{t('st.crewSigns')}</Text> : null}
                        <View style={styles.row}>
                          <TouchableOpacity style={styles.btn} onPress={() => void doMove(r)}><Text style={styles.btnText}>{t('common.sign')}</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                        </View>
                      </>
                    ) : null}
                    {last.length ? <Label>{t('st.lastMoves')}</Label> : null}
                    {last.map((m) => (
                      <Text key={m.id} style={styles.sub}>{`${uiDate(m.date)} · ${MOVE_TEXT[m.kind]} ${m.qty} ${r.item.unit}${m.expiry ? ` · ${mmYY(m.expiry)}` : ''}${m.wear ? ` · ${tk(`st.wear.${m.wear}`)}` : ''}${m.to ? ` · ${m.to}${m.toWith ? ' (signed for)' : ''}` : ''}${m.note ? ` · ${m.note}` : ''} · ${m.by}`}</Text>
                    ))}
                  </Card>
                ) : null}
              </React.Fragment>
            );
          })}
          {items.length && !shown.length ? <Text style={styles.sub}>{t('st.nothingHere')}</Text> : null}
        </>
      )}
    </Screen>
  );
}
