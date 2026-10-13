// ===================================
// A landing report (types/hospital.ts MedCheck, kind landing / landing-cd) —
// out-of-date stock handed ashore for destruction (13 Oct 2026: "landing report
// — expired stock to the shore with handed over / received signatures, and
// separately for drugs / narcotic / controlled items").
//
// New (`id: 'new'`, `mode: 'cd'` for the controlled drugs): every out-of-date
// batch on the books is listed; a damaged or recalled batch may be added. The
// officer hands over and signs — with a witness for controlled drugs — and the
// person ashore signs by hand on this device. Each line writes a `disposed`
// move, so the books and the controlled drugs register follow. The PDF carries
// the three signatures.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { CheckLine, LANDING_REASON_LABEL, LandingReason, MedCheck, MedMove } from '../types/hospital';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { batchLabel, chestStatus, expiryState, landingLine, landingLinesFor, nextNo } from '../services/hospital';
import { exportLandingPdf } from '../services/hospitalReport';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Row = CheckLine & { key: string; text: string };
const REASONS: LandingReason[] = ['expired', 'damaged', 'recalled', 'other'];

export default function MedLandingSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { medItems, medMoves, medChecks, saveRow, saveRows, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const cd = route.params?.mode === 'cd';
  const { signer, picker } = useSigner('HANDED OVER BY');
  const witness = useWitness(signer?.name, 'WITNESS');
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const id = savedId ?? route.params?.id;
  const stored = medChecks.find((c) => c.id === id);
  const statuses = useMemo(() => chestStatus(medItems, medMoves, today), [medItems, medMoves, today]);
  // From an item's Dispose → "Landed ashore": that batch alone; otherwise every out-of-date batch.
  const [rows, setRows] = useState<Row[]>(() => {
    if (id !== 'new') return [];
    const one = route.params?.item ? statuses.find((r) => r.item.id === route.params.item) : undefined;
    const lines = one
      ? one.batches.filter((b) => b.qty > 0 && (!route.params?.batch || b.key === route.params.batch)).map((b) => landingLine(one, b, expiryState(today, b.expiry) === 'expired' ? 'expired' : 'damaged'))
      : landingLinesFor(statuses, today, cd);
    return lines.map((l, i) => ({ ...l, key: `l${i}`, text: String(l.counted) }));
  });
  const [q, setQ] = useState('');
  const [port, setPort] = useState('');
  const [receiver, setReceiver] = useState('');
  const [receiverRole, setReceiverRole] = useState('');
  const [receiverOrg, setReceiverOrg] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const title = cd ? 'Landing report — controlled drugs' : 'Landing report — expired';

  if (stored) {
    const total = stored.lines.reduce((n, l) => n + l.counted, 0);
    const scd = stored.kind === 'landing-cd';
    const pdf = async () => {
      try {
        const w = await exportLandingPdf(stored, vessel);
        if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
      } catch (e: any) {
        Alert.alert('Landing report', String(e?.message ?? e));
      }
    };
    const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title={`${scd ? 'Landing report — controlled drugs' : 'Landing report'} ${stored.no}`} subtitle={`${formatDate(stored.date)}${stored.port ? ` · ${stored.port}` : ''} · ${stored.lines.length} lines · ${total} units`} help="Hospital" />
        <View style={[styles.item, { borderLeftColor: COLORS.success }]}>
          <Text style={styles.sub}>{`Handed over by ${who(stored.by, stored.byRank)} · ${formatDateTime(stored.at)}${stored.signedWith ? ` · ${proofShort(stored.signedWith)}` : ''}`}</Text>
          {stored.witness ? <Text style={styles.sub}>{`Witness ${who(stored.witness, stored.witnessRank)}${stored.witnessWith ? ` · ${proofShort(stored.witnessWith)}` : ''}`}</Text> : null}
          <Text style={styles.sub}>{`Received ashore by ${[stored.receiver, stored.receiverRole, stored.receiverOrg].filter(Boolean).join(', ')}${stored.receivedWith ? ` · ${proofShort(stored.receivedWith)}` : ''}`}</Text>
          {stored.note ? <Text style={styles.body}>{stored.note}</Text> : null}
        </View>
        <Label>Landed</Label>
        {stored.lines.map((l, i) => (
          <Text key={i} style={[styles.body, { paddingVertical: 2 }]}>{`${l.listNo ? `${l.listNo} · ` : ''}${l.name}${l.strength ? ` ${l.strength}` : ''} · ${batchLabel(l)} — ${l.counted} ${l.unit ?? ''} · ${LANDING_REASON_LABEL[l.reason ?? 'expired']}`}</Text>
        ))}
        <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void pdf()}><Text style={styles.btnText}>Landing report (PDF)</Text></TouchableOpacity>
        {saved ? <Text style={styles.sub}>{saved}</Text> : null}
      </Screen>
    );
  }
  if (id !== 'new' || !officer) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>{officer ? 'This landing report is not on this device yet — it arrives with the next sync.' : 'An officer or the Master lands the medical stores.'}</Text>
      </Screen>
    );
  }

  // Another batch to land — damaged, recalled: found by name, of the same kind (controlled or not).
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const inList = new Set(rows.map((r) => `${r.itemId}|${r.batchNo ?? ''}|${r.expiry ?? ''}`));
  const more = words.length
    ? statuses
        .filter((s) => !!s.item.controlled === cd && words.every((w) => `${s.item.name} ${s.item.strength ?? ''}`.toLowerCase().includes(w)))
        .flatMap((s) => s.batches.filter((b) => b.qty > 0 && !inList.has(`${s.item.id}|${b.batchNo ?? ''}|${b.expiry ?? ''}`)).map((b) => ({ s, b })))
        .slice(0, 8)
    : [];

  const set = (key: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const total = rows.reduce((n, r) => n + (Number(r.text.replace(',', '.')) || 0), 0);

  const sign = async () => {
    if (!rows.length) return Alert.alert('Landing report', 'Nothing to land.');
    for (const r of rows) {
      const n = Number(r.text.replace(',', '.'));
      if (!(n > 0) || n > r.expected) return Alert.alert('Landing report', `“${r.name}” — between 1 and ${r.expected} ${r.unit ?? ''}.`);
    }
    if (!receiver.trim()) return Alert.alert('Received by', 'Who receives it ashore — the name.');
    if (!signer) return Alert.alert('Handed over by', 'Choose your name.');
    if (cd && !witness.picked) return Alert.alert('Controlled drugs', 'They are handed over with a witness — choose the second person present.');
    const no = nextNo('LND', medChecks, today);
    const what = `${title} ${no}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Handed over — ${what}`, always: true });
    if (!sig) return;
    const w = cd ? await witness.confirm(what) : null;
    if (cd && !w) return;
    // The person ashore has no PIN here: a hand-drawn signature on this screen.
    const rec = await confirmSign({ personKey: `shore:${receiver.trim().toLowerCase()}`, name: [receiver.trim(), receiverOrg.trim()].filter(Boolean).join(' · '), ownDevice: false, what: `Received ashore — ${what}`, always: true, handOnly: true });
    if (!rec) return;
    const now = Date.now();
    const lines: CheckLine[] = rows.map(({ key: _k, text, ...l }) => ({ ...l, counted: Number(text.replace(',', '.')) }));
    const c: MedCheck = {
      id: uid('inv'), no, kind: cd ? 'landing-cd' : 'landing', date: today, lines,
      ...(port.trim() ? { port: port.trim() } : {}), receiver: receiver.trim(), ...(receiverRole.trim() ? { receiverRole: receiverRole.trim() } : {}), ...(receiverOrg.trim() ? { receiverOrg: receiverOrg.trim() } : {}), ...(rec.proof ? { receivedWith: rec.proof } : {}),
      ...(note.trim() ? { note: note.trim() } : {}), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(w ?? {}), updatedAt: now,
    };
    await saveRow(storage.MED_CHECKS_KEY, c);
    const moves: MedMove[] = lines.map((l) => ({
      id: uid('mmv'), itemId: l.itemId, kind: 'disposed', qty: l.counted, ...(l.batchNo ? { batchNo: l.batchNo } : {}), ...(l.expiry ? { expiry: l.expiry } : {}), date: today, checkId: c.id,
      note: `${no} landed ashore${port.trim() ? ` at ${port.trim()}` : ''} — ${LANDING_REASON_LABEL[l.reason ?? 'expired'].toLowerCase()}, received by ${receiver.trim()}`,
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(l.controlled && w ? w : {}), updatedAt: now,
    }));
    await saveRows(storage.MED_MOVES_KEY, moves);
    playSuccessSound();
    setSavedId(c.id);
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={title} subtitle={`${rows.length} ${rows.length === 1 ? 'line' : 'lines'} · ${total} units`} help="Hospital" />
      <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>
        {cd
          ? 'Out-of-date controlled drugs handed ashore for destruction — a pharmacy, a doctor or the authority. Count them with a witness; you sign as handing over, the witness signs, the person ashore signs by hand on this screen. The register shows them as disposed of.'
          : 'Out-of-date medicines and medical stores handed ashore for destruction — the agent, a pharmacy or the port reception. You sign as handing over, the person ashore signs by hand on this screen. The books show them as disposed of. Controlled drugs go on their own report.'}
      </Text>
      {!rows.length ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{cd ? 'No controlled drug is out of date.' : 'Nothing is out of date.'} Add a damaged or recalled batch below if there is one.</Text> : null}
      {rows.map((r) => {
        const diff = Number(r.text.replace(',', '.')) !== r.expected;
        return (
          <View key={r.key} style={[styles.row, { marginVertical: 2, borderBottomWidth: 0.5, borderBottomColor: COLORS.borderLight, paddingBottom: 6, alignItems: 'center' }]}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={styles.name}>{`${r.listNo ? `${r.listNo} · ` : ''}${r.name}${r.strength ? ` ${r.strength}` : ''}${r.controlled ? ' · CD' : ''}`}</Text>
              <Text style={[styles.sub, expiryState(today, r.expiry) === 'expired' ? { color: COLORS.danger, fontWeight: '700' } : null]}>{`${batchLabel(r)} · on the books ${r.expected} ${r.unit ?? ''}${r.place ? ` · ${r.place}` : ''}`}</Text>
              <View style={[styles.row, { marginTop: 4, gap: 4 }]}>
                {REASONS.map((x) => (
                  <TouchableOpacity key={x} style={[styles.chip, r.reason === x && styles.chipOn]} onPress={() => set(r.key, { reason: x })}>
                    <Text style={[styles.chipText, r.reason === x && styles.chipTextOn]}>{LANDING_REASON_LABEL[x]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TextInput style={[styles.input, { width: 80, marginTop: 0, textAlign: 'right' }, diff && { borderColor: COLORS.warning, borderWidth: 2 }]} value={r.text} onChangeText={(v) => set(r.key, { text: v })} keyboardType="decimal-pad" selectTextOnFocus />
            <TouchableOpacity onPress={() => setRows(rows.filter((x) => x.key !== r.key))} hitSlop={8}><Text style={[styles.link, { color: COLORS.danger }]}>✕</Text></TouchableOpacity>
          </View>
        );
      })}
      <TextInput style={[styles.input, { marginTop: SIZES.md }]} value={q} onChangeText={setQ} placeholder={cd ? 'Add another controlled drug batch — damaged, recalled' : 'Add another batch — damaged, recalled'} placeholderTextColor={COLORS.textLight} />
      {more.map(({ s, b }) => (
        <TouchableOpacity key={`${s.item.id}|${b.batchNo ?? ''}|${b.expiry ?? ''}`} onPress={() => { setRows([...rows, { ...landingLine(s, b, expiryState(today, b.expiry) === 'expired' ? 'expired' : 'damaged'), key: `a${Date.now()}`, text: String(b.qty) }]); setQ(''); }}>
          <Text style={styles.link}>{`+ ${s.item.name}${s.item.strength ? ` ${s.item.strength}` : ''} · ${batchLabel(b)} · ${b.qty} ${s.item.unit}`}</Text>
        </TouchableOpacity>
      ))}
      <Card>
        <Label>Received ashore by</Label>
        <TextInput style={styles.input} value={receiver} onChangeText={setReceiver} placeholder="Name" placeholderTextColor={COLORS.textLight} />
        <View style={styles.row}>
          <TextInput style={[styles.input, { flex: 1, minWidth: 140 }]} value={receiverRole} onChangeText={setReceiverRole} placeholder="Position — pharmacist, agent" placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.input, { flex: 1, minWidth: 140 }]} value={receiverOrg} onChangeText={setReceiverOrg} placeholder="Company / authority" placeholderTextColor={COLORS.textLight} />
        </View>
        <TextInput style={styles.input} value={port} onChangeText={setPort} placeholder="Port" placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Remarks — receipt No., how it will be destroyed" placeholderTextColor={COLORS.textLight} />
        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
        {cd ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void sign()}><Text style={styles.btnText}>Sign the landing</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goBackOr(nav)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </View>
        <Text style={styles.sub}>{cd ? 'Signing order: you, the witness, then the person ashore by hand.' : 'Signing order: you, then the person ashore by hand.'}</Text>
      </Card>
    </Screen>
  );
}
