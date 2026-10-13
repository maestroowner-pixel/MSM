// ===================================
// One entry of the medical log (types/hospital.ts MedTreatment) — new
// (`id: 'new'`, optionally `followUpOf`) or signed. The Master and the officers
// only: the crew and the shore never see it.
//
//   Patient, complaint, history, vital signs, findings, diagnosis, treatment.
//   Medicines given — taken from the chest, from the batch that expires first;
//   the WHO IMGS note on each is a tap away. A controlled drug needs a witness.
//   Radio medical advice (TMAS / CIRM): centre, reference, what was advised.
//   Outcome and follow-up.
//   Signed by the officer or the Master who treated (13 Oct 2026: "the log —
//   signed by an officer or the captain").
//   Files: the written medical advice as a PDF (compressed) or photographs of
//   it — they can be added after signing too; the entry itself never changes.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useWitness } from '../components/WitnessChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { isAboard } from '../types/crew';
import { Issued, MedFile, MedMove, MedOutcome, MedTreatment, OUTCOME_LABEL, Vitals } from '../types/hospital';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { chestStatus, issuedText, nextMedNo, pickBatch, scaleEntry } from '../services/hospital';
import { PickedMedFile, keepMedFile, openMedFile, photoMedFile, pickMedFile, sizeText } from '../services/medFiles';
import { exportTreatmentPdf } from '../services/hospitalReport';
import { nowHm } from '../services/drills';
import { MED_INFO_NOTICE, WHO_NOTICE } from '../constants/medNotice';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

const VITALS: [keyof Vitals, string, string][] = [['temp', 'Temp °C', 'decimal-pad'], ['pulse', 'Pulse /min', 'number-pad'], ['bp', 'BP mmHg', 'numbers-and-punctuation'], ['rr', 'Resp /min', 'number-pad'], ['spo2', 'SpO2 %', 'number-pad']];
const OTHER = '__other';

export default function TreatmentSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { medItems, medMoves, medTreatments, crew, saveRow, saveRows, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('SIGNED BY — OFFICER OR MASTER');
  const witness = useWitness(signer?.name);
  const today = todayIso();

  const [savedId, setSavedId] = useState<string | null>(null);
  const id = savedId ?? route.params?.id;
  const stored = medTreatments.find((t) => t.id === id);
  const prior = medTreatments.find((t) => t.id === route.params?.followUpOf);
  const people = useMemo(() => crew.filter(isAboard), [crew]);
  const [d, setD] = useState<MedTreatment>(() => ({
    id: uid('trt'), no: '', date: today, time: nowHm(), patient: prior?.patient ?? '', ...(prior?.patientRank ? { patientRank: prior.patientRank } : {}),
    complaint: prior ? `Follow-up: ${prior.complaint}` : '', issued: [], outcome: 'fit', ...(prior ? { followUpOf: prior.id } : {}), by: '', at: 0, updatedAt: 0,
  }));
  const [patientPick, setPatientPick] = useState<string>(() => people.find((p) => p.name === prior?.patient)?.id ?? '');
  const [tmas, setTmas] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [refFor, setRefFor] = useState<string | null>(null);
  const [files, setFiles] = useState<PickedMedFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const status = useMemo(() => chestStatus(medItems, medMoves, today), [medItems, medMoves, today]);
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');

  if (!officer) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>The medical log is kept by the Master and the officers.</Text>
      </Screen>
    );
  }

  // ---- a file, before or after signing ----
  const attach = async (how: 'file' | 'photo') => {
    try {
      setBusy(how === 'file' ? 'Compressing…' : 'Taking the photo…');
      const f = how === 'file' ? await pickMedFile() : await photoMedFile();
      setBusy(null);
      if (!f) return;
      if (!stored) return setFiles([...files, f]);
      setBusy('Saving the file…');
      const fid = uid('mf');
      const url = await keepMedFile(vessel?.imo, sync.enrolled, stored.id, fid, f);
      const mf: MedFile = { id: fid, name: f.name, url, bytes: f.bytes, addedBy: signer?.name ?? 'Officer', addedAt: Date.now() };
      await saveRow(storage.MED_TREATMENTS_KEY, { ...stored, files: [...(stored.files ?? []), mf], updatedAt: Date.now() });
      setBusy(null);
      setSaved(`${f.name} kept${f.note ? ` — ${f.note}` : ''}`);
      playSuccessSound();
    } catch (e: any) {
      setBusy(null);
      Alert.alert('File', String(e?.message ?? e));
    }
  };

  if (stored) {
    const t = stored;
    const v = t.vitals ?? {};
    const pdf = async () => {
      try {
        const w = await exportTreatmentPdf(t, vessel);
        if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
      } catch (e: any) {
        Alert.alert('Medical report', String(e?.message ?? e));
      }
    };
    const line = (k: string, val?: string) => (val ? <Text style={styles.body}><Text style={{ color: COLORS.textLight }}>{`${k}: `}</Text>{val}</Text> : null);
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title={`${t.no} · ${t.patient}`} subtitle={`${formatDate(t.date)}${t.time ? ` ${t.time}` : ''} · ${OUTCOME_LABEL[t.outcome]} · confidential`} help="Hospital" />
        <Card>
          {line('Rank', t.patientRank)}
          {line('Complaint', t.complaint)}
          {line('History', t.history)}
          {Object.keys(v).length ? line('Vital signs', VITALS.filter(([k]) => v[k]).map(([k, l]) => `${l.split(' ')[0]} ${v[k]}`).join(' · ')) : null}
          {line('Findings', t.findings)}
          {line('Diagnosis', t.diagnosis)}
          {line('Treatment', t.treatment)}
          {t.issued.length ? line('Medicines', t.issued.map(issuedText).join('; ')) : null}
          {t.tmas ? line('Radio medical advice', [t.tmas.centre, t.tmas.ref, t.tmas.advice].filter(Boolean).join(' · ')) : null}
          {line('Follow-up', t.followUp ? formatDate(t.followUp) : undefined)}
          {prior ? line('Follows', `${prior.no} ${prior.complaint}`) : null}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{`Signed by ${who(t.by, t.byRank)} · ${formatDateTime(t.at)}${t.signedWith ? ` · ${proofShort(t.signedWith)}` : ''}`}</Text>
          {t.witness ? <Text style={styles.sub}>{`Witness ${who(t.witness, t.witnessRank)}${t.witnessWith ? ` · ${proofShort(t.witnessWith)}` : ''}`}</Text> : null}
        </Card>
        <Label>{`Files · ${t.files?.length ?? 0}`}</Label>
        {(t.files ?? []).map((f) => (
          <TouchableOpacity key={f.id} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => void openMedFile(f.url, f.name).catch((e) => Alert.alert('File', String(e?.message ?? e)))}>
            <Text style={styles.name}>{f.name}</Text>
            <Text style={styles.sub}>{`${sizeText(f.bytes)} · added by ${f.addedBy} ${formatDateTime(f.addedAt)}`}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.row}>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('file')}><Text style={styles.smallText}>+ Medical advice (PDF)</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('photo')}><Text style={styles.smallText}>+ Photograph it</Text></TouchableOpacity>
        </View>
        {busy ? <Text style={styles.sub}>{busy}</Text> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void pdf()}><Text style={styles.btnText}>Medical report (PDF)</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} onPress={() => nav.navigate('Treatment', { id: 'new', followUpOf: t.id })}><Text style={styles.smallText}>Follow-up…</Text></TouchableOpacity>
        </View>
        {saved ? <Text style={styles.sub}>{saved}</Text> : null}
      </Screen>
    );
  }

  // ---- a new entry ----
  const set = (p: Partial<MedTreatment>) => setD({ ...d, ...p });
  const setV = (k: keyof Vitals, val: string) => set({ vitals: { ...(d.vitals ?? {}), [k]: val } });
  const available = status.filter((r) => r.usable > 0 && !d.issued.some((x) => x.itemId === r.item.id));
  const found = adding != null ? available.filter((r) => `${r.item.name} ${r.item.strength ?? ''}`.toLowerCase().includes(adding.toLowerCase())).slice(0, 12) : [];
  const cdGiven = d.issued.some((x) => medItems.find((i) => i.id === x.itemId)?.controlled);

  const sign = async () => {
    const patient = d.patient.trim();
    if (!patient) return Alert.alert('Patient', 'Who is the patient?');
    if (!d.complaint.trim()) return Alert.alert('Complaint', 'What is the complaint or the injury?');
    if (d.issued.some((x) => !(x.qty > 0))) return Alert.alert('Medicines', 'Each medicine given needs a quantity.');
    for (const x of d.issued) {
      const r = status.find((s) => s.item.id === x.itemId);
      if (!r || r.usable < x.qty) return Alert.alert('Medicines', `${x.name}: only ${r?.usable ?? 0} in date aboard.`);
    }
    if (!signer) return Alert.alert('Who treated?', 'Choose your name — an officer or the Master.');
    if (cdGiven && !witness.picked) return Alert.alert('Controlled drug', 'Choose the witness — the second person present when it was given.');
    const no = nextMedNo(medTreatments, d.date);
    const what = `${no} — ${patient}`;
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return;
    const w = cdGiven ? await witness.confirm(`${what}: ${d.issued.filter((x) => medItems.find((i) => i.id === x.itemId)?.controlled).map(issuedText).join(', ')}`) : null;
    if (cdGiven && !w) return;
    const now = Date.now();
    // The batch each medicine came from — the one in date that expires first.
    const issued: Issued[] = d.issued.map((x) => {
      const b = pickBatch(status.find((s) => s.item.id === x.itemId)?.batches ?? [], x.qty, today);
      return { ...x, ...(b?.batchNo ? { batchNo: b.batchNo } : {}), ...(b?.expiry ? { expiry: b.expiry } : {}) };
    });
    const vit = Object.fromEntries(Object.entries(d.vitals ?? {}).filter(([, val]) => String(val ?? '').trim())) as Vitals;
    const t: MedTreatment = {
      ...d, no, patient, complaint: d.complaint.trim(), issued, ...(Object.keys(vit).length ? { vitals: vit } : { vitals: undefined }),
      ...(tmas && (d.tmas?.centre || d.tmas?.ref || d.tmas?.advice) ? {} : { tmas: undefined }),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(w ?? {}), updatedAt: now,
    };
    const clean = Object.fromEntries(Object.entries(t).filter(([, val]) => val !== undefined && val !== '')) as MedTreatment;
    await saveRow(storage.MED_TREATMENTS_KEY, clean);
    const out: MedMove[] = [];
    for (const x of issued) {
      const isCd = medItems.find((i) => i.id === x.itemId)?.controlled;
      const m: MedMove = {
        id: uid('mmv'), itemId: x.itemId, kind: 'issued', qty: x.qty, ...(x.batchNo ? { batchNo: x.batchNo } : {}), ...(x.expiry ? { expiry: x.expiry } : {}), date: d.date, note: no, treatmentId: clean.id,
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(isCd && w ? w : {}), updatedAt: now,
      };
      out.push(m);
    }
    await saveRows(storage.MED_MOVES_KEY, out);
    // Files picked before signing go now.
    if (files.length) {
      const kept: MedFile[] = [];
      for (const f of files) {
        try {
          const fid = uid('mf');
          kept.push({ id: fid, name: f.name, url: await keepMedFile(vessel?.imo, sync.enrolled, clean.id, fid, f), bytes: f.bytes, addedBy: signer.name, addedAt: now });
        } catch (e: any) {
          Alert.alert('File', `${f.name}: ${String(e?.message ?? e)} — add it again from the entry.`);
        }
      }
      if (kept.length) await saveRow(storage.MED_TREATMENTS_KEY, { ...clean, files: kept, updatedAt: Date.now() });
    }
    playSuccessSound();
    setSavedId(clean.id);
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={prior ? `Follow-up — ${prior.patient}` : 'New treatment'} subtitle="Medical log — confidential, the Master and the officers only" help="Hospital" />
      {prior ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{`Follows ${prior.no} of ${formatDate(prior.date)}: ${prior.complaint}${prior.diagnosis ? ` — ${prior.diagnosis}` : ''}`}</Text> : null}
      <Card>
        <Label>Patient</Label>
        <Dropdown caption="PATIENT" value={patientPick} onChange={(v: string) => { setPatientPick(v); const p = people.find((x) => x.id === v); set(p ? { patient: p.name, ...(p.rank ? { patientRank: p.rank } : { patientRank: undefined }) } : { patient: '', patientRank: undefined }); }} options={[{ value: '', label: 'Choose…' }, ...people.map((p) => ({ value: p.id, label: p.rank ? `${p.name} · ${p.rank}` : p.name })), { value: OTHER, label: 'Someone else — guest, contractor' }]} />
        {patientPick === OTHER ? (
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 2, minWidth: 150, marginTop: 0 }]} value={d.patient} onChangeText={(v) => set({ patient: v })} placeholder="Name ★" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={d.patientRank ?? ''} onChangeText={(v) => set({ patientRank: v })} placeholder="Role / company" placeholderTextColor={COLORS.textLight} />
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 160 }}><SimpleDatePicker label="Date" value={d.date} onChange={(v) => set({ date: v })} /></View>
          <TextInput style={[styles.input, { width: 80, marginTop: 0, textAlign: 'center' }]} value={d.time ?? ''} onChangeText={(v) => set({ time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
        </View>
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.complaint} onChangeText={(v) => set({ complaint: v })} multiline placeholder="Complaint or injury ★" placeholderTextColor={COLORS.textLight} />
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.history ?? ''} onChangeText={(v) => set({ history: v })} multiline placeholder="How it happened, history, allergies, medicines taken" placeholderTextColor={COLORS.textLight} />
      </Card>

      <Card>
        <Label>Vital signs</Label>
        <View style={styles.row}>
          {VITALS.map(([k, l, kb]) => (
            <TextInput key={k} style={[styles.input, { width: 100, marginTop: 0 }]} value={d.vitals?.[k] ?? ''} onChangeText={(v) => setV(k, v)} placeholder={l} placeholderTextColor={COLORS.textLight} keyboardType={kb as any} />
          ))}
        </View>
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.findings ?? ''} onChangeText={(v) => set({ findings: v })} multiline placeholder="Examination — what was found" placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} value={d.diagnosis ?? ''} onChangeText={(v) => set({ diagnosis: v })} placeholder="Diagnosis (working)" placeholderTextColor={COLORS.textLight} />
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.treatment ?? ''} onChangeText={(v) => set({ treatment: v })} multiline placeholder="Treatment given — wound cleaned and closed, splint, rest…" placeholderTextColor={COLORS.textLight} />
      </Card>

      <Card>
        <Label>{`Medicines given · ${d.issued.length}`}</Label>
        {d.issued.map((x) => {
          const item = medItems.find((i) => i.id === x.itemId);
          const ref = item ? scaleEntry(item) : {};
          return (
            <View key={x.itemId} style={{ marginBottom: SIZES.sm }}>
              <View style={styles.row}>
                <Text style={[styles.name, { flex: 1, minWidth: 150 }]}>{`${x.name}${item?.controlled ? ' · CD' : ''}`}</Text>
                <TextInput style={[styles.input, { width: 70, marginTop: 0, textAlign: 'right' }]} value={x.qty ? String(x.qty) : ''} onChangeText={(v) => set({ issued: d.issued.map((y) => (y.itemId === x.itemId ? { ...y, qty: Number(v.replace(',', '.')) || 0 } : y)) })} keyboardType="decimal-pad" />
                <Text style={styles.sub}>{x.unit}</Text>
                <TouchableOpacity onPress={() => set({ issued: d.issued.filter((y) => y.itemId !== x.itemId) })}><Text style={[styles.link, { color: COLORS.danger }]}>✕</Text></TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { marginTop: 4 }]} value={x.dose ?? ''} onChangeText={(v) => set({ issued: d.issued.map((y) => (y.itemId === x.itemId ? { ...y, dose: v } : y)) })} placeholder="Dose and how — 1 g orally every 6 h for 3 days" placeholderTextColor={COLORS.textLight} />
              {ref.med?.ref ? (
                <TouchableOpacity onPress={() => setRefFor(refFor === x.itemId ? null : x.itemId)}><Text style={styles.link}>{refFor === x.itemId ? 'Hide the IMGS note' : 'IMGS note — dosage, cautions'}</Text></TouchableOpacity>
              ) : null}
              {refFor === x.itemId && ref.med?.ref ? (
                <>
                  <Text style={[styles.sub, { lineHeight: 19 }]}>{ref.med.ref}</Text>
                  <Text style={[styles.sub, { fontSize: 11 }]}>{`${MED_INFO_NOTICE} ${WHO_NOTICE}`}</Text>
                </>
              ) : null}
            </View>
          );
        })}
        {adding != null ? (
          <>
            <TextInput style={styles.input} value={adding} onChangeText={setAdding} placeholder="Find in the chest" placeholderTextColor={COLORS.textLight} autoFocus />
            {found.map((r) => (
              <TouchableOpacity key={r.item.id} onPress={() => { set({ issued: [...d.issued, { itemId: r.item.id, name: [r.item.name, r.item.strength].filter(Boolean).join(' '), qty: 1, unit: r.item.unit }] }); setAdding(null); }}>
                <Text style={[styles.body, { paddingVertical: 4 }]}>{`+ ${r.item.name}${r.item.strength ? ` · ${r.item.strength}` : ''} — ${r.usable} ${r.item.unit}`}</Text>
              </TouchableOpacity>
            ))}
            {adding && !found.length ? <Text style={styles.sub}>Nothing in date aboard by that name.</Text> : null}
            <TouchableOpacity onPress={() => setAdding(null)}><Text style={styles.link}>Done</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={() => setAdding('')}><Text style={styles.link}>+ A medicine from the chest</Text></TouchableOpacity>
        )}
        {d.issued.length ? <Text style={styles.sub}>Taken from the batch that expires first; the chest goes down when the entry is signed.</Text> : null}
      </Card>

      <Card>
        <TouchableOpacity onPress={() => setTmas(!tmas)}><Text style={styles.link}>{tmas ? '− Radio medical advice' : '+ Radio medical advice (TMAS / CIRM)'}</Text></TouchableOpacity>
        {tmas ? (
          <>
            <TextInput style={styles.input} value={d.tmas?.centre ?? ''} onChangeText={(v) => set({ tmas: { ...(d.tmas ?? {}), centre: v } })} placeholder="Centre — CIRM Rome, Radio Medico Spain…" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={d.tmas?.ref ?? ''} onChangeText={(v) => set({ tmas: { ...(d.tmas ?? {}), ref: v } })} placeholder="Reference / case number" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { minHeight: 50 }]} value={d.tmas?.advice ?? ''} onChangeText={(v) => set({ tmas: { ...(d.tmas ?? {}), advice: v } })} multiline placeholder="What was advised" placeholderTextColor={COLORS.textLight} />
          </>
        ) : null}
        <Label>Files</Label>
        {files.map((f, i) => <Text key={i} style={styles.sub}>{`${f.name} · ${sizeText(f.bytes)}${f.note ? ` · ${f.note}` : ''}`}</Text>)}
        <View style={styles.row}>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('file')}><Text style={styles.smallText}>+ Medical advice (PDF)</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('photo')}><Text style={styles.smallText}>+ Photograph it</Text></TouchableOpacity>
        </View>
        {busy ? <Text style={styles.sub}>{busy}</Text> : null}
      </Card>

      <Card>
        <Label>Outcome</Label>
        <View style={styles.chips}>
          {(Object.keys(OUTCOME_LABEL) as MedOutcome[]).map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, d.outcome === k && styles.chipOn]} onPress={() => set({ outcome: k })}>
              <Text style={[styles.chipText, d.outcome === k && styles.chipTextOn]}>{OUTCOME_LABEL[k]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SimpleDatePicker label="Follow-up" value={d.followUp} onChange={(v) => set({ followUp: v })} onClear={() => set({ followUp: undefined })} />
        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
        {cdGiven ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => void sign()}><Text style={styles.btnText}>Sign the entry</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goBackOr(nav)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
        </View>
        <Text style={styles.sub}>Signed, the entry does not change; files can still be added to it.</Text>
      </Card>
    </Screen>
  );
}
