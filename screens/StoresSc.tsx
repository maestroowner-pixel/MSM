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
import { PPE_STARTER, STORE_CATEGORIES, StoreItem, StoreKind, StoreMove, StoreMoveKind, StoreRoom, isBuiltinRoom, roomOf, storeItemTitle, storeRooms } from '../types/stores';
import { StoreRooms } from '../components/StoreRooms';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { vesselHeader } from '../services/export';
import { proofShort } from '../services/signature';
import { batchLabel, expiryState, mmYY, normExpiry } from '../services/hospital';
import { StoreStatus, batchToIssue, heldByPerson, planStoreImport, readStoreSheet, storeCounts, storeSheet, storeStatus, storeTemplateRows, toOrder } from '../services/stores';
import { exportDocPdf } from '../services/hospitalReport';
import { pickSheetRows, saveSheet } from '../services/sheetFiles';
import { aiReadDocument, aiRenameHeadings } from '../services/aiImport';
import { aiReady } from '../services/ai';
import { pickDocForAi } from '../services/medFiles';
import { useSync } from '../contexts/SyncContext';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Show = 'all' | 'short' | 'expired' | 'soon';
type Act = { kind: StoreMoveKind; qty: string; expiry: string; to: string; note: string; batchKey?: string };
const MOVE_TEXT: Record<StoreMoveKind, string> = { received: 'Received', issued: 'Issued', returned: 'Returned', disposed: 'Disposed', count: 'Counted' };

const ICONS: Record<string, string> = {
  Body: 'tshirt-crew-outline', Feet: 'shoe-formal', Hands: 'hand-back-left-outline', 'Eyes & face': 'safety-goggles', Head: 'hard-hat', Hearing: 'ear-hearing', Breathing: 'face-mask-outline', 'Fall protection': 'seatbelt', Water: 'lifebuoy',
  'Dry store': 'package-variant', Chilled: 'fridge-outline', Frozen: 'snowflake', Beverages: 'cup-water', Bakery: 'bread-slice-outline', 'Fresh fruit & veg': 'food-apple-outline', 'Cleaning & galley': 'spray-bottle',
  Deck: 'anchor', 'Ropes & rigging': 'link-variant', Paint: 'format-paint', Engine: 'engine-outline', Electrical: 'flash-outline', Tools: 'wrench-outline', Cleaning: 'spray-bottle', Chemicals: 'flask-outline', Other: 'package-variant',
};

export default function StoresSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const { storeItems, storeMoves, storeRoomList, crew, vessel, saveRow, saveRows, appendRow } = useData();
  const rooms = useMemo(() => storeRooms(storeRoomList), [storeRoomList]);
  const manage = route.params?.view === 'manage';
  // The store on screen: the one in the route (a menu entry, a scanned label), else the first.
  const room: StoreRoom = rooms.find((r) => r.id === route.params?.view) ?? rooms[0];
  const unknownRoom = !!route.params?.view && !manage && !rooms.some((r) => r.id === route.params?.view);
  const store: StoreKind = room.kind;
  const ppe = store === 'ppe';
  const general = store === 'general';
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
  const cats = STORE_CATEGORIES[store];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = rows
    .filter((r) => !cat || (r.item.category ?? '') === cat)
    .filter((r) => show === 'all' || (show === 'short' ? r.short > 0 : show === 'expired' ? r.expired > 0 : r.soon))
    .filter((r) => words.every((w) => `${r.item.name} ${r.item.size ?? ''} ${r.item.category ?? ''} ${r.item.location ?? ''}`.toLowerCase().includes(w)))
    .sort((a, b) => (a.item.category ?? '~').localeCompare(b.item.category ?? '~') || a.item.name.localeCompare(b.item.name) || (a.item.size ?? '').localeCompare(b.item.size ?? '', undefined, { numeric: true }));
  const held = useMemo(() => heldByPerson(items, moves), [items, moves]);

  const done = (w: string | null | void) => typeof w === 'string' && setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
  const fail = (e: any) => Alert.alert(room.name, String(e?.message ?? e));
  const color = (r: StoreStatus) => (r.expired || r.usable <= 0 ? COLORS.danger : r.short || r.soon ? COLORS.warning : COLORS.success);

  // ---- the list ----
  const addStarter = async () => {
    const now = Date.now();
    const out: StoreItem[] = [];
    for (const s of PPE_STARTER) for (const size of s.sizes ?? [undefined]) out.push({ id: uid('sto'), store, ...own, name: s.name, category: s.category, ...(size ? { size } : {}), unit: s.unit, min: s.min, order: out.length, updatedAt: now });
    await saveRows(storage.STORE_ITEMS_KEY, out);
    setSaved(`${out.length} lines added — edit the minimums to the vessel's needs`);
  };
  const saveItem = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert('Item', 'Name it.');
    const clean = Object.fromEntries(Object.entries({ ...edit, name: edit.name.trim() }).filter(([, v]) => v !== '' && v !== undefined)) as unknown as StoreItem;
    await saveRow(storage.STORE_ITEMS_KEY, clean);
    setEdit(null);
    playSuccessSound();
  };

  // ---- moves ----
  const doMove = async (r: StoreStatus) => {
    if (!act) return;
    const qty = Number(act.qty.replace(',', '.'));
    if (!(qty >= 0) || (act.kind !== 'count' && !(qty > 0))) return Alert.alert(MOVE_TEXT[act.kind], 'How many?');
    if (!signer) return Alert.alert('Who is signing?', 'Choose your name.');
    let expiry = act.expiry.trim() ? normExpiry(act.expiry) : undefined;
    if (act.expiry.trim() && !expiry) return Alert.alert('Best before', 'Write it as 11/27, 2027-11 or 30.11.2027.');
    let batchNo: string | undefined;
    if (act.kind === 'issued' || act.kind === 'disposed' || act.kind === 'count') {
      const b = act.batchKey ? r.batches.find((x) => x.key === act.batchKey) : act.kind === 'issued' ? batchToIssue(r.batches, today) : r.batches.length === 1 ? r.batches[0] : undefined;
      if (act.kind !== 'count' && !b) return Alert.alert(MOVE_TEXT[act.kind], 'None on hand.');
      if (b) {
        if (act.kind !== 'count' && qty > b.qty) return Alert.alert(MOVE_TEXT[act.kind], `Only ${b.qty} in that batch.`);
        expiry = b.expiry;
        batchNo = b.batchNo;
      }
    }
    const person = ppe && (act.kind === 'issued' || act.kind === 'returned') ? people.find((p) => p.id === act.to) : undefined;
    if (ppe && (act.kind === 'issued' || act.kind === 'returned') && !person) return Alert.alert(MOVE_TEXT[act.kind], ppe && act.kind === 'issued' ? 'Who receives it?' : 'Who returns it?');
    const what = `${MOVE_TEXT[act.kind]} — ${storeItemTitle(r.item)} ${qty} ${r.item.unit}${person ? ` · ${person.name}` : ''}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    // PPE handed over: the person receiving it signs for it, here.
    const rec = person && act.kind === 'issued' ? await confirmSign({ personKey: person.id, name: person.name, ownDevice: false, what: `Received — ${storeItemTitle(r.item)} ${qty} ${r.item.unit}`, always: true }) : null;
    if (person && act.kind === 'issued' && !rec) return;
    const now = Date.now();
    const m: StoreMove = {
      id: uid('stm'), itemId: r.item.id, kind: act.kind, qty, ...(batchNo ? { batchNo } : {}), ...(expiry ? { expiry } : {}), date: today,
      ...(person ? { to: person.name, toId: person.id } : {}), ...(rec?.proof ? { toWith: rec.proof } : {}), ...(act.note.trim() ? { note: act.note.trim() } : store === 'provisions' && act.kind === 'issued' ? { note: 'Galley' } : {}),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
    };
    await appendRow(storage.STORE_MOVES_KEY, m);
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
        setSaved('The AI is reading the columns…');
        const r = await aiRenameHeadings(file.rows, ppe ? 'ppe' : 'provisions');
        setSaved(null);
        return importSheet({ name: file.name, rows: r.rows }, `Columns read by the AI: ${r.mapped.map((m) => `${m.from} → ${m.to}`).join('; ')}.`);
      }
      const doc = await pickDocForAi();
      if (!doc) return;
      setSaved(`The AI is reading “${doc.name}”…`);
      const r = await aiReadDocument(doc.dataUri, ppe ? 'ppe' : 'provisions');
      setSaved(null);
      return importSheet({ name: doc.name, rows: r.rows }, `Read by the AI from the ${/pdf/.test(doc.dataUri.slice(0, 30)) ? 'PDF' : 'photo'} — check the lines before importing.${r.unreadable ? ` Not readable: ${r.unreadable}` : ''}`);
    } catch (e: any) {
      setSaved(null);
      Alert.alert('Import', String(e?.message ?? e));
    }
  };

  const importSheet = async (given?: { name: string; rows: unknown[][] }, note?: string, into: StoreRoom = room) => {
    try {
      const picked = given ?? (await pickSheetRows());
      if (!picked) return;
      const lines = readStoreSheet(picked.rows);
      if (!lines.length) return Alert.alert('Import', `Nothing found in “${picked.name}”. Use the template.`);
      const plan = planStoreImport(lines, storeItems, into);
      const apply = async () => {
        await saveRows(storage.STORE_ITEMS_KEY, plan.save);
        const now = Date.now();
        const by = signer?.name ?? 'Import';
        for (const c of plan.counts) await appendRow(storage.STORE_MOVES_KEY, { id: uid('stm'), itemId: c.itemId, kind: 'count', qty: c.qty, ...(c.expiry ? { expiry: c.expiry } : {}), date: today, note: `Imported from ${picked.name}`, by, at: now, updatedAt: now } as StoreMove);
        playSuccessSound();
        setSaved(`${into.name}: ${plan.added.length} added, ${plan.updated.length} updated, ${plan.counts.length} quantities counted — from “${picked.name}”`);
      };
      Alert.alert(`Import ${lines.length} lines from “${picked.name}” into ${into.name}?`, [note ?? null, plan.added.length ? `New: ${plan.added.slice(0, 12).join(', ')}${plan.added.length > 12 ? ` and ${plan.added.length - 12} more` : ''}.` : null, plan.updated.length ? `Updated: ${plan.updated.length}.` : null, plan.counts.length ? `Quantities in the sheet are counted into the store (by best-before).` : null].filter(Boolean).join('\n\n'), [{ text: 'Cancel', style: 'cancel' }, { text: 'Import', onPress: () => void apply() }]);
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    }
  };
  const orderSheet = () => saveSheet([['Item', 'Size', 'Category', 'Unit', 'On hand (in date)', 'Minimum', 'To order'], ...toOrder(rows).map((o) => { const r = rows.find((x) => x.item.id === o.item.id)!; return [o.item.name, o.item.size ?? '', o.item.category ?? '', o.item.unit, r.usable, o.item.min, o.need]; })], 'To order', `${room.name} — to order ${today}`, vessel).then(done, fail);

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
        <ScreenTitle title="Stores" subtitle={`${rooms.length} stores · IDs, places, QR labels, lists`} help="Stores" />
        {!sync.canManage('stores') ? (
          <Text style={styles.sub}>Managing the stores — adding one, its ID, its label, loading its list — is for those the Master allows (Settings → Access).</Text>
        ) : <StoreRooms onOpen={(id) => nav.setParams({ view: id })} onImport={(r) => void importSheet(undefined, undefined, r)} done={done} fail={fail} />}
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginTop: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}
      </Screen>
    );
  }
  return (
    <Screen scroll>
      <ScreenTitle title={title} subtitle={[room.code, room.location, `${counts.items} items`, counts.short ? `${counts.short} below minimum` : null, counts.expired ? `${counts.expired} out of date` : null, counts.soon ? `${counts.soon} expiring` : null].filter(Boolean).join(' · ')} help="Stores" />
      {unknownRoom ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700', marginBottom: SIZES.sm }]}>That label is not a store of this vessel (another vessel’s, or the store was removed) — showing the first store.</Text> : null}
      {ppe ? (
        <View style={styles.chips}>
          {(['stock', 'crew'] as const).map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, page === k && styles.chipOn]} onPress={() => setPage(k)}>
              <Text style={[styles.chipText, page === k && styles.chipTextOn]}>{k === 'stock' ? `Stock · ${items.length}` : `Issued to crew · ${held.size}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {page === 'crew' && ppe ? (
        <>
          <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>What each person holds from the PPE store — issued less returned, each issue signed for by the person on this device.</Text>
          {people.map((p) => {
            const list = held.get(p.name) ?? [];
            return (
              <View key={p.id} style={[styles.item, { borderLeftColor: list.length ? COLORS.primary : COLORS.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <Text style={[styles.name, { flex: 1 }]}>{[p.name, p.rank].filter(Boolean).join(' · ')}</Text>
                  <TouchableOpacity style={styles.small} onPress={() => void personPdf(p.name)}><Text style={styles.smallText}>PPE record (PDF)</Text></TouchableOpacity>
                </View>
                <Text style={styles.sub}>{list.length ? list.map((h) => `${storeItemTitle(h.item)} × ${h.qty}`).join(' · ') : 'Nothing issued'}</Text>
              </View>
            );
          })}
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
        </>
      ) : (
        <>
          <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm, gap: SIZES.xs }]}>
            <TextInput style={[styles.input, { flex: 2, minWidth: 200, marginTop: 0 }]} value={q} onChangeText={setQ} placeholder={ppe ? 'Search — item, size, place' : general ? 'Search — item, kind, shelf' : 'Search — item, section, place'} placeholderTextColor={COLORS.textLight} />
            <Dropdown caption={ppe || general ? 'TYPE' : 'SECTION'} value={cat} onChange={setCat} style={{ flex: 1, minWidth: 200 }} options={[{ value: '', label: `All · ${rows.length}` }, ...cats.map((c) => ({ value: c, label: `${c} · ${rows.filter((r) => r.item.category === c).length}`, icon: ICONS[c] }))]} />
            <Dropdown caption="SHOW" value={show} onChange={setShow} style={{ flex: 1, minWidth: 200 }} options={[
              { value: 'all' as Show, label: 'All' },
              { value: 'short' as Show, label: `Below minimum · ${counts.short}` },
              { value: 'expired' as Show, label: `Out of date · ${counts.expired}` },
              { value: 'soon' as Show, label: `Expiring · ${counts.soon}` },
            ]} />
          </View>
          <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm }]}>
            <TouchableOpacity style={styles.btn} onPress={() => setEdit({ id: uid('sto'), store, ...own, name: '', unit: store === 'provisions' ? 'packs' : 'pcs', min: 0, order: items.length, updatedAt: Date.now(), ...(cat ? { category: cat } : {}) })}><Text style={styles.btnText}>+ Item</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} disabled={!counts.short} onPress={() => void orderSheet()}><Text style={styles.smallText}>{`To order (Excel) · ${counts.short}`}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => void importSheet()}><Text style={styles.smallText}>Import from Excel</Text></TouchableOpacity>
            {aiReady(sync.enrolled) ? (
              <>
                <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void importAi('sheet')}><MciIcon name="creation" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Any list (AI)</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void importAi('doc')}><MciIcon name="camera-outline" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Photo / PDF (AI)</Text></TouchableOpacity>
              </>
            ) : null}
            <TouchableOpacity style={styles.small} onPress={() => saveSheet(storeSheet(rows), title, `${title} ${today}`, vessel).then(done, fail)}><Text style={styles.smallText}>Export to Excel</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => saveSheet(storeTemplateRows(store), title, `${title} template`, vessel).then(done, fail)}><Text style={styles.smallText}>Excel template</Text></TouchableOpacity>
          </View>
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}

          {edit ? (
            <Card>
              <Label>{items.some((i) => i.id === edit.id) ? 'Item' : 'New item'}</Label>
              <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder={ppe ? 'Name ★ — Coveralls' : general ? 'Name ★ — Shackle, galvanised 16 mm' : 'Name ★ — Pasta, penne 500 g'} placeholderTextColor={COLORS.textLight} autoFocus />
              <View style={styles.row}>
                <Dropdown caption={ppe || general ? 'TYPE' : 'SECTION'} value={edit.category ?? ''} onChange={(v: string) => setEdit({ ...edit, category: v || undefined })} options={[{ value: '', label: '—' }, ...cats.map((c) => ({ value: c, label: c, icon: ICONS[c] }))]} style={{ flex: 1, minWidth: 200 }} />
                {ppe ? <TextInput style={[styles.input, { width: 90, marginTop: 0 }]} value={edit.size ?? ''} onChangeText={(v) => setEdit({ ...edit, size: v })} placeholder="Size" placeholderTextColor={COLORS.textLight} /> : null}
                <TextInput style={[styles.input, { width: 100, marginTop: 0 }]} value={edit.unit} onChangeText={(v) => setEdit({ ...edit, unit: v })} placeholder="Unit" placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { width: 110, marginTop: 0 }]} value={String(edit.min)} onChangeText={(v) => setEdit({ ...edit, min: Number(v.replace(',', '.')) || 0 })} keyboardType="number-pad" placeholder="Minimum" placeholderTextColor={COLORS.textLight} />
              </View>
              <Text style={styles.sub}>Minimum — keep at least this many; below it the item goes on the list to order.</Text>
              <TextInput style={styles.input} value={edit.location ?? ''} onChangeText={(v) => setEdit({ ...edit, location: v })} placeholder="Where — store, shelf" placeholderTextColor={COLORS.textLight} />
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void saveItem()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                {items.some((i) => i.id === edit.id) ? <TouchableOpacity onPress={() => void saveRow(storage.STORE_ITEMS_KEY, { ...edit, deleted: true }).then(() => { setEdit(null); setOpen(null); })}><Text style={[styles.link, { color: COLORS.danger }]}>Remove</Text></TouchableOpacity> : null}
              </View>
            </Card>
          ) : null}

          {!items.length ? (
            <Card>
              <Text style={styles.sub}>{ppe ? 'No PPE on the list yet. Start from a typical yacht PPE store (coveralls and boots in sizes, gloves, glasses, hearing, breathing, harnesses), load it from Excel, or add items one by one.' : general ? `Nothing on the list of ${room.name} yet. Load its list from Excel (Import from Excel — the template has the columns), or add items one by one.` : 'No provisions on the list yet. Load the provision list from Excel (the template has the columns: name, section, unit, minimum, place, quantity, best before), or add items one by one.'}</Text>
              {ppe ? <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void addStarter()}><Text style={styles.btnText}>Add the typical PPE list</Text></TouchableOpacity> : null}
            </Card>
          ) : null}

          {shown.map((r, k) => {
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
                      <Text style={styles.sub}>{[r.item.location, `min ${r.item.min} ${r.item.unit}`].filter(Boolean).join(' · ')}</Text>
                      <Text style={[styles.sub, { color: color(r), fontWeight: '700' }]}>{[`${r.usable} ${r.item.unit} in date`, r.short ? `${r.short} below minimum` : null, r.expired ? `${r.expired} out of date` : r.soon && r.next ? `expires ${formatDate(r.next)}` : null].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }}>
                      {r.batches.slice(0, 3).map((b) => {
                        const s = expiryState(today, b.expiry);
                        const c = s === 'expired' ? COLORS.danger : (s === 'soon' || (b.expiry && r.soon && b.expiry === r.next)) ? COLORS.warning : COLORS.success;
                        return (
                          <View key={b.key} style={{ borderWidth: 1, borderColor: c, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, minWidth: 48, alignItems: 'center' }}>
                            <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: c }}>{b.qty}</Text>
                            {b.expiry ? <Text style={{ fontSize: 10, fontWeight: '700', color: c }}>{mmYY(b.expiry)}</Text> : null}
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
                      {(ppe ? (['received', 'issued', 'returned', 'count', 'disposed'] as StoreMoveKind[]) : (['received', 'issued', 'count', 'disposed'] as StoreMoveKind[])).map((k2) => (
                        <TouchableOpacity key={k2} style={[styles.small, act?.kind === k2 && { backgroundColor: COLORS.primary }]} onPress={() => { const old = k2 === 'disposed' ? r.batches.find((b) => expiryState(today, b.expiry) === 'expired') : undefined; setAct({ kind: k2, qty: k2 === 'count' ? String(r.onHand) : old ? String(old.qty) : '', expiry: '', to: '', note: old ? 'Out of date' : '', ...(old ? { batchKey: old.key } : {}) }); }}>
                          <Text style={[styles.smallText, act?.kind === k2 && { color: COLORS.textWhite }]}>{k2 === 'received' ? 'Receive' : k2 === 'issued' ? (ppe ? 'Issue to crew' : general ? 'Issue' : 'Issue to galley') : k2 === 'returned' ? 'Return' : k2 === 'count' ? 'Count' : 'Dispose'}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity onPress={() => setEdit(r.item)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
                    </View>
                    {act ? (
                      <>
                        <TextInput style={styles.input} value={act.qty} onChangeText={(v) => setAct({ ...act, qty: v })} keyboardType="decimal-pad" placeholder={`How many ${r.item.unit} ★`} placeholderTextColor={COLORS.textLight} autoFocus />
                        {act.kind === 'received' ? <TextInput style={styles.input} value={act.expiry} onChangeText={(v) => setAct({ ...act, expiry: v })} placeholder={store === 'provisions' ? 'Best before — 11/27' : 'Expiry if it has one — 11/31'} placeholderTextColor={COLORS.textLight} /> : null}
                        {(act.kind === 'disposed' || act.kind === 'count') && r.batches.length > 1 ? (
                          <Dropdown caption="BATCH" value={act.batchKey ?? ''} onChange={(v: string) => setAct({ ...act, batchKey: v || undefined, ...(act.kind === 'count' ? { qty: String(r.batches.find((b) => b.key === v)?.qty ?? act.qty) } : {}) })} options={[{ value: '', label: act.kind === 'count' ? 'New batch' : 'Choose…' }, ...r.batches.map((b) => ({ value: b.key, label: `${batchLabel(b)} — ${b.qty} ${r.item.unit}` }))]} style={{ marginTop: SIZES.xs }} />
                        ) : null}
                        {ppe && (act.kind === 'issued' || act.kind === 'returned') ? (
                          <Dropdown caption={act.kind === 'issued' ? 'TO' : 'FROM'} value={act.to} onChange={(v: string) => setAct({ ...act, to: v })} options={[{ value: '', label: 'Choose…' }, ...people.map((p) => ({ value: p.id, label: p.rank ? `${p.name} · ${p.rank}` : p.name }))]} style={{ marginTop: SIZES.xs }} />
                        ) : null}
                        <TextInput style={styles.input} value={act.note} onChangeText={(v) => setAct({ ...act, note: v })} placeholder={act.kind === 'received' ? 'From — supplier, delivery note' : act.kind === 'disposed' ? 'Why — out of date, damaged' : general && act.kind === 'issued' ? 'To whom, what for' : 'Note'} placeholderTextColor={COLORS.textLight} />
                        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                        {ppe && act.kind === 'issued' ? <Text style={styles.sub}>The crew member signs for it on this device after you — PIN or by hand.</Text> : null}
                        <View style={styles.row}>
                          <TouchableOpacity style={styles.btn} onPress={() => void doMove(r)}><Text style={styles.btnText}>Sign</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
                        </View>
                      </>
                    ) : null}
                    {last.length ? <Label>Last moves</Label> : null}
                    {last.map((m) => (
                      <Text key={m.id} style={styles.sub}>{`${formatDate(m.date)} · ${MOVE_TEXT[m.kind]} ${m.qty} ${r.item.unit}${m.expiry ? ` · ${mmYY(m.expiry)}` : ''}${m.to ? ` · ${m.to}${m.toWith ? ' (signed for)' : ''}` : ''}${m.note ? ` · ${m.note}` : ''} · ${m.by}`}</Text>
                    ))}
                  </Card>
                ) : null}
              </React.Fragment>
            );
          })}
          {items.length && !shown.length ? <Text style={styles.sub}>Nothing here.</Text> : null}
        </>
      )}
    </Screen>
  );
}
