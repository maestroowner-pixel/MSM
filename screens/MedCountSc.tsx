// ===================================
// An inventory of the medicine chest (types/hospital.ts MedCheck) — new
// (`id: 'new'`) or one already signed.
//
// Every batch the books show, with the quantity filled in from the books; the
// officer changes only what differs, adds a batch found that the books did not
// know, and signs — with a witness when controlled drugs are among them (the
// Master's monthly count). Each line writes a `count` move, so the books then
// say what was counted.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useWitness } from '../components/WitnessChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { CheckLine, MedCheck, MedMove } from '../types/hospital';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { chestStatus, checkLinesFor, expiryState, nextNo, normExpiry } from '../services/hospital';
import { exportCheckPdf } from '../services/hospitalReport';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Row = CheckLine & { key: string; text: string; found?: boolean };

export default function MedCountSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { medItems, medMoves, medChecks, saveRow, saveRows, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('COUNTED BY');
  const witness = useWitness(signer?.name);
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const id = savedId ?? route.params?.id;
  const stored = medChecks.find((c) => c.id === id);
  const statuses = useMemo(() => chestStatus(medItems, medMoves, today), [medItems, medMoves, today]);
  const [rows, setRows] = useState<Row[] | null>(() => (id === 'new' ? checkLinesFor(statuses).map((l, i) => ({ ...l, key: `l${i}`, text: String(l.counted) })) : null));
  const [q, setQ] = useState('');
  const [onlyCd, setOnlyCd] = useState(false);
  const [note, setNote] = useState('');
  const [found, setFound] = useState<{ itemId: string; batchNo: string; expiry: string; qty: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const itemOf = (itemId: string) => medItems.find((i) => i.id === itemId);
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');

  if (stored) {
    const diff = stored.lines.filter((l) => l.counted !== l.expected);
    const pdf = async () => {
      try {
        const w = await exportCheckPdf(stored, vessel);
        if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
      } catch (e: any) {
        Alert.alert('Inventory', String(e?.message ?? e));
      }
    };
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title={`Inventory ${stored.no}`} subtitle={`${formatDate(stored.date)} · ${stored.lines.length} lines · ${diff.length ? `${diff.length} differences` : 'as the books'}`} help="Hospital" />
        <View style={[styles.item, { borderLeftColor: diff.length ? COLORS.warning : COLORS.success }]}>
          <Text style={styles.sub}>{`Counted by ${who(stored.by, stored.byRank)} · ${formatDateTime(stored.at)}${stored.signedWith ? ` · ${proofShort(stored.signedWith)}` : ''}`}</Text>
          {stored.witness ? <Text style={styles.sub}>{`Witness ${who(stored.witness, stored.witnessRank)}${stored.witnessWith ? ` · ${proofShort(stored.witnessWith)}` : ''}`}</Text> : null}
          {stored.note ? <Text style={styles.body}>{stored.note}</Text> : null}
        </View>
        <Label>{diff.length ? 'Differences' : 'Counted'}</Label>
        {(diff.length ? diff : stored.lines).map((l, i) => (
          <Text key={i} style={[styles.body, { paddingVertical: 2 }]}>{`${l.name}${l.batchNo ? ` · ${l.batchNo}` : ''}${l.expiry ? ` · ${l.expiry.slice(0, 7)}` : ''} — books ${l.expected}, counted ${l.counted}`}</Text>
        ))}
        <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void pdf()}><Text style={styles.btnText}>Inventory (PDF)</Text></TouchableOpacity>
        {saved ? <Text style={styles.sub}>{saved}</Text> : null}
      </Screen>
    );
  }
  if (!rows || !officer) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>{officer ? 'This inventory is not on this device yet — it arrives with the next sync.' : 'An officer or the Master counts the chest.'}</Text>
      </Screen>
    );
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const visible = rows.filter((r) => (!onlyCd || itemOf(r.itemId)?.controlled) && words.every((w) => r.name.toLowerCase().includes(w)));
  const changed = rows.filter((r) => Number(r.text.replace(',', '.')) !== r.expected).length;
  const cdCounted = rows.some((r) => itemOf(r.itemId)?.controlled);

  const setText = (key: string, text: string) => setRows(rows.map((r) => (r.key === key ? { ...r, text } : r)));
  const addFound = () => {
    if (!found) return;
    const qty = Number(found.qty.replace(',', '.'));
    const expiry = found.expiry.trim() ? normExpiry(found.expiry) : undefined;
    if (!(qty > 0)) return Alert.alert('Found', 'How many?');
    if (found.expiry.trim() && !expiry) return Alert.alert('Expiry', 'Write it as 2027-03, 03/2027 or 2027-03-31.');
    const it = itemOf(found.itemId);
    if (!it) return;
    setRows([...rows, { itemId: it.id, name: it.name, ...(found.batchNo.trim() ? { batchNo: found.batchNo.trim() } : {}), ...(expiry ? { expiry } : {}), expected: 0, counted: qty, key: `f${rows.length}`, text: String(qty), found: true }]);
    setFound(null);
  };

  const sign = async () => {
    // The Master's count of the controlled drugs signs those lines only.
    const use = onlyCd ? rows.filter((r) => itemOf(r.itemId)?.controlled) : rows;
    if (!use.length) return Alert.alert('Inventory', 'Nothing to count.');
    const bad = use.find((r) => r.text.trim() === '' || !Number.isFinite(Number(r.text.replace(',', '.'))) || Number(r.text.replace(',', '.')) < 0);
    if (bad) return Alert.alert('Inventory', `Count “${bad.name}”.`);
    if (!signer) return Alert.alert('Who counted?', 'Choose your name.');
    const cdIn = use.some((r) => itemOf(r.itemId)?.controlled);
    if (cdIn && !witness.picked) return Alert.alert('Controlled drugs', 'They are counted with a witness — choose the second person present.');
    const no = nextNo('INV', medChecks, today);
    const what = `${onlyCd ? 'Controlled drugs count' : 'Medicine chest inventory'} ${no}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const w = cdIn ? await witness.confirm(what) : null;
    if (cdIn && !w) return;
    const now = Date.now();
    const lines: CheckLine[] = use.map(({ key, text, found: _f, ...l }) => ({ ...l, counted: Number(text.replace(',', '.')) }));
    const c: MedCheck = { id: uid('inv'), no, date: today, lines, ...(note.trim() ? { note: note.trim() } : {}), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(w ?? {}), updatedAt: now };
    await saveRow(storage.MED_CHECKS_KEY, c);
    const counts: MedMove[] = [];
    for (const l of lines) {
      if (l.counted === 0 && l.expected === 0) continue;
      const m: MedMove = {
        id: uid('mmv'), itemId: l.itemId, kind: 'count', qty: l.counted, ...(l.batchNo ? { batchNo: l.batchNo } : {}), ...(l.expiry ? { expiry: l.expiry } : {}), date: today, checkId: c.id, note: no,
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(itemOf(l.itemId)?.controlled && w ? w : {}), updatedAt: now,
      };
      counts.push(m);
    }
    await saveRows(storage.MED_MOVES_KEY, counts);
    playSuccessSound();
    setSavedId(c.id);
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title="Inventory" subtitle={`${rows.length} lines from the books — change only what differs${changed ? ` · ${changed} changed` : ''}`} help="Hospital" />
      <TextInput style={[styles.input, { marginTop: 0 }]} value={q} onChangeText={setQ} placeholder="Find an item" placeholderTextColor={COLORS.textLight} />
      <View style={styles.toggle}>
        <Text style={styles.toggleText}>Controlled drugs only (the Master’s monthly count)</Text>
        <Switch value={onlyCd} onValueChange={setOnlyCd} />
      </View>
      {visible.map((r) => {
        const diff = Number(r.text.replace(',', '.')) !== r.expected;
        const s = expiryState(today, r.expiry);
        return (
          <View key={r.key} style={[styles.row, { marginVertical: 2, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight, paddingBottom: 4 }]}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <Text style={styles.name}>{`${r.name}${itemOf(r.itemId)?.controlled ? ' · CD' : ''}${r.found ? ' · found' : ''}`}</Text>
              <Text style={[styles.sub, s === 'expired' ? { color: COLORS.danger, fontWeight: '700' } : null]}>{[r.batchNo ? `batch ${r.batchNo}` : null, r.expiry ? `exp ${r.expiry.slice(0, 7)}${s === 'expired' ? ' OUT OF DATE' : ''}` : null, `books ${r.expected}`].filter(Boolean).join(' · ')}</Text>
            </View>
            <TextInput style={[styles.input, { width: 80, marginTop: 0, textAlign: 'right' }, diff && { borderColor: COLORS.warning, borderWidth: 2 }]} value={r.text} onChangeText={(v) => setText(r.key, v)} keyboardType="decimal-pad" selectTextOnFocus />
          </View>
        );
      })}
      {found ? (
        <Card>
          <Label>A batch the books did not know</Label>
          <TextInput style={styles.input} value={medItems.find((i) => i.id === found.itemId)?.name ?? ''} editable={false} />
          <View style={styles.row}>
            <TextInput style={[styles.input, { width: 80, marginTop: 0 }]} value={found.qty} onChangeText={(v) => setFound({ ...found, qty: v })} keyboardType="decimal-pad" placeholder="Qty" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 90, marginTop: 0 }]} value={found.batchNo} onChangeText={(v) => setFound({ ...found, batchNo: v })} placeholder="Batch" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 90, marginTop: 0 }]} value={found.expiry} onChangeText={(v) => setFound({ ...found, expiry: v })} placeholder="Expiry 2027-03" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={addFound}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setFound(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </View>
        </Card>
      ) : q.trim() && visible.length ? (
        <TouchableOpacity onPress={() => setFound({ itemId: visible[0].itemId, batchNo: '', expiry: '', qty: '' })}><Text style={styles.link}>{`+ Another batch of ${visible[0].name} found`}</Text></TouchableOpacity>
      ) : (
        <Text style={styles.sub}>Found a batch the books did not know? Find the item above, then add it.</Text>
      )}
      <Card>
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Remarks — damaged boxes, what was moved" placeholderTextColor={COLORS.textLight} />
        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
        {cdCounted ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void sign()}><Text style={styles.btnText}>Sign the inventory</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goBackOr(nav)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </View>
      </Card>
    </Screen>
  );
}
