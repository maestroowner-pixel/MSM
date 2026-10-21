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
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { chestStatus, issuedText, matchesSearch, nextMedNo, pickBatch, purposeIcon, purposeOf, returnedFor, scaleEntry } from '../services/hospital';
import { MciIcon } from '../components/MciIcon';
import { PickedMedFile, keepMedFile, openMedFile, photoMedFile, pickMedFile, sizeText } from '../services/medFiles';
import { exportTreatmentPdf } from '../services/hospitalReport';
import { nowHm } from '../services/drills';
import { MED_INFO_NOTICE, WHO_NOTICE } from '../constants/medNotice';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t as tt, tk, useT } from '../utils/i18n';

const VITALS: [keyof Vitals, string, string][] = [['temp', 'Temp °C', 'decimal-pad'], ['pulse', 'Pulse /min', 'number-pad'], ['bp', 'BP mmHg', 'numbers-and-punctuation'], ['rr', 'Resp /min', 'number-pad'], ['spo2', 'SpO2 %', 'number-pad']];
const OTHER = '__other';

export default function TreatmentSc() {
  useT();
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
  // Issue from the register (13 Oct 2026: "an Issue button on the item, opening an entry in the log").
  const preset = route.params?.issue ? medItems.find((i) => i.id === route.params.issue && !i.deleted) : undefined;
  const [d, setD] = useState<MedTreatment>(() => ({
    id: uid('trt'), no: '', date: today, time: nowHm(), patient: prior?.patient ?? '', ...(prior?.patientRank ? { patientRank: prior.patientRank } : {}),
    complaint: prior ? `Follow-up: ${prior.complaint}` : '', issued: preset ? [{ itemId: preset.id, name: [preset.name, preset.strength].filter(Boolean).join(' '), qty: 1, unit: preset.unit }] : [], outcome: 'fit', ...(prior ? { followUpOf: prior.id } : {}), by: '', at: 0, updatedAt: 0,
  }));
  const [patientPick, setPatientPick] = useState<string>(() => people.find((p) => p.name === prior?.patient)?.id ?? '');
  const [tmas, setTmas] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [refFor, setRefFor] = useState<string | null>(null);
  const [files, setFiles] = useState<PickedMedFile[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [ret, setRet] = useState<{ itemId: string; qty: string } | null>(null);

  const status = useMemo(() => chestStatus(medItems, medMoves, today), [medItems, medMoves, today]);
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');

  if (!officer) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>{tt('tr.officersOnly')}</Text>
      </Screen>
    );
  }

  // ---- a file, before or after signing ----
  const attach = async (how: 'file' | 'photo') => {
    try {
      setBusy(how === 'file' ? tt('tr.compressing') : tt('tr.taking'));
      const f = how === 'file' ? await pickMedFile() : await photoMedFile();
      setBusy(null);
      if (!f) return;
      if (!stored) return setFiles([...files, f]);
      setBusy(tt('tr.savingFile'));
      const fid = uid('mf');
      const url = await keepMedFile(vessel?.imo, sync.enrolled, stored.id, fid, f);
      const mf: MedFile = { id: fid, name: f.name, url, bytes: f.bytes, addedBy: signer?.name ?? 'Officer', addedAt: Date.now() };
      await saveRow(storage.MED_TREATMENTS_KEY, { ...stored, files: [...(stored.files ?? []), mf], updatedAt: Date.now() });
      setBusy(null);
      setSaved(`${f.name} kept${f.note ? ` — ${f.note}` : ''}`);
      playSuccessSound();
    } catch (e: any) {
      setBusy(null);
      Alert.alert(tt('tr.file'), String(e?.message ?? e));
    }
  };

  if (stored) {
    const t = stored;
    const v = t.vitals ?? {};
    const pdf = async () => {
      try {
        const w = await exportTreatmentPdf(t, vessel);
        if (typeof w === 'string') setSaved(w === 'Downloads' ? tt('common.savedDownloads') : tt('common.savedFolder', { folder: w }));
      } catch (e: any) {
        Alert.alert(tt('tr.report'), String(e?.message ?? e));
      }
    };
    const back = returnedFor(t.id, medMoves);
    const giveBack = async () => {
      if (!ret) return;
      const x = t.issued.find((y) => y.itemId === ret.itemId);
      if (!x) return;
      const qty = Number(ret.qty.replace(',', '.'));
      const left = x.qty - (back.get(x.itemId) ?? 0);
      if (!(qty > 0) || qty > left) return Alert.alert(tt('st.return'), tt('tr.between', { n: left, unit: x.unit }));
      if (!signer) return Alert.alert(tt('tr.whoTakesBack'), tt('tr.chooseOfficer'));
      const isCd = !!medItems.find((i) => i.id === x.itemId)?.controlled;
      if (isCd && !witness.picked) return Alert.alert(tt('mo.cd'), tt('mi.chooseWitness'));
      const what = `${t.no} — ${x.name} ${qty} ${x.unit} returned unused`;
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
      if (!sig) return;
      const w = isCd ? await witness.confirm(what) : null;
      if (isCd && !w) return;
      const now = Date.now();
      // Back into the batch it was given from; the patient's name stays in the log, not on the move.
      const m: MedMove = {
        id: uid('mmv'), itemId: x.itemId, kind: 'returned', qty, ...(x.batchNo ? { batchNo: x.batchNo } : {}), ...(x.expiry ? { expiry: x.expiry } : {}), date: today, note: `${t.no} returned unused`, treatmentId: t.id,
        by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), ...(w ?? {}), updatedAt: now,
      };
      await saveRow(storage.MED_MOVES_KEY, m);
      setRet(null);
      playSuccessSound();
      setSaved(`${x.name}: ${qty} ${x.unit} back in the chest`);
    };
    const line = (k: string, val?: string) => (val ? <Text style={styles.body}><Text style={{ color: COLORS.textLight }}>{`${k}: `}</Text>{val}</Text> : null);
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <ScreenTitle title={`${t.no} · ${t.patient}`} subtitle={`${formatDate(t.date)}${t.time ? ` ${t.time}` : ''} · ${tk(`tr.out.${t.outcome}`)} · ${tt('tr.confidential')}`} help="Hospital" />
        <Card>
          {line(tt('ho.rank'), t.patientRank)}
          {line(tt('tr.complaint'), t.complaint)}
          {line(tt('tr.history'), t.history)}
          {Object.keys(v).length ? line(tt('tr.vitals'), VITALS.filter(([k]) => v[k]).map(([k]) => `${tk(`tr.v.${k}`).split(' ')[0]} ${v[k]}`).join(' · ')) : null}
          {line(tt('tr.findings'), t.findings)}
          {line(tt('tr.diagnosis'), t.diagnosis)}
          {line(tt('tr.treatment'), t.treatment)}
          {t.issued.length ? line(tt('tr.medicines'), t.issued.map(issuedText).join('; ')) : null}
          {back.size ? line(tt('tr.returnedUnused'), t.issued.filter((x) => back.get(x.itemId)).map((x) => `${x.name} ${back.get(x.itemId)} ${x.unit}`).join('; ')) : null}
          {t.tmas ? line(tt('tr.tmas'), [t.tmas.centre, t.tmas.ref, t.tmas.advice].filter(Boolean).join(' · ')) : null}
          {line('Follow-up', t.followUp ? formatDate(t.followUp) : undefined)}
          {prior ? line(tt('tr.follows'), `${prior.no} ${prior.complaint}`) : null}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{`${tt('tr.signedBy', { who: who(t.by, t.byRank) })} · ${formatDateTime(t.at)}${t.signedWith ? ` · ${proofShort(t.signedWith)}` : ''}`}</Text>
          {t.witness ? <Text style={styles.sub}>{`${tt('med.witness', { who: who(t.witness, t.witnessRank) })}${t.witnessWith ? ` · ${proofShort(t.witnessWith)}` : ''}`}</Text> : null}
        </Card>
        {t.issued.some((x) => (back.get(x.itemId) ?? 0) < x.qty) ? (
          <Card>
            <Label>{tt('tr.returnHead')}</Label>
            <Text style={styles.sub}>{tt('tr.returnHint')}</Text>
            {ret ? (
              <>
                {(() => {
                  const x = t.issued.find((y) => y.itemId === ret.itemId)!;
                  const left = x.qty - (back.get(x.itemId) ?? 0);
                  return <Text style={[styles.name, { marginTop: SIZES.sm }]}>{`${x.name} — given ${x.qty} ${x.unit}, can return up to ${left}`}</Text>;
                })()}
                <TextInput style={styles.input} value={ret.qty} onChangeText={(v) => setRet({ ...ret, qty: v })} keyboardType="decimal-pad" placeholder={tt('tr.howManyBack')} placeholderTextColor={COLORS.textLight} />
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                {medItems.find((i) => i.id === ret.itemId)?.controlled ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void giveBack()}><Text style={styles.btnText}>{tt('tr.signReturn')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setRet(null)}><Text style={styles.link}>{tt('common.cancel')}</Text></TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.row}>
                {t.issued.filter((x) => (back.get(x.itemId) ?? 0) < x.qty).map((x) => (
                  <TouchableOpacity key={x.itemId} style={styles.small} onPress={() => setRet({ itemId: x.itemId, qty: String(x.qty - (back.get(x.itemId) ?? 0)) })}><Text style={styles.smallText}>{tt('tr.returnX', { name: x.name })}</Text></TouchableOpacity>
                ))}
              </View>
            )}
          </Card>
        ) : null}
        <Label>{tt('tr.filesN', { n: t.files?.length ?? 0 })}</Label>
        {(t.files ?? []).map((f) => (
          <TouchableOpacity key={f.id} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => void openMedFile(f.url, f.name).catch((e) => Alert.alert(tt('tr.file'), String(e?.message ?? e)))}>
            <Text style={styles.name}>{f.name}</Text>
            <Text style={styles.sub}>{`${sizeText(f.bytes)} · added by ${f.addedBy} ${formatDateTime(f.addedAt)}`}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.row}>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('file')}><Text style={styles.smallText}>{tt('tr.addAdvice')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('photo')}><Text style={styles.smallText}>{tt('tr.addPhoto')}</Text></TouchableOpacity>
        </View>
        {busy ? <Text style={styles.sub}>{busy}</Text> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void pdf()}><Text style={styles.btnText}>{tt('tr.reportPdf')}</Text></TouchableOpacity>
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
  // The whole chest in date, medicines first, A–Z — searched by name, indication, ATC, list No. (13 Oct 2026: "the list is not complete").
  const found = adding != null ? available.filter((r) => matchesSearch(r.item, adding)).sort((a, b) => (a.item.kind === 'medicine' ? 0 : 1) - (b.item.kind === 'medicine' ? 0 : 1) || a.item.name.localeCompare(b.item.name)) : [];
  const cdGiven = d.issued.some((x) => medItems.find((i) => i.id === x.itemId)?.controlled);

  const sign = async () => {
    const patient = d.patient.trim();
    if (!patient) return Alert.alert(tt('tr.patient'), tt('tr.whoPatient'));
    if (!d.complaint.trim()) return Alert.alert(tt('tr.complaint'), tt('tr.whatComplaint'));
    if (d.issued.some((x) => !(x.qty > 0))) return Alert.alert(tt('tr.medicines'), tt('tr.needQty'));
    for (const x of d.issued) {
      const r = status.find((s) => s.item.id === x.itemId);
      if (!r || r.usable < x.qty) return Alert.alert(tt('tr.medicines'), tt('tr.onlyInDate', { name: x.name, n: r?.usable ?? 0 }));
    }
    if (!signer) return Alert.alert(tt('tr.whoTreated'), tt('tr.chooseOfficer'));
    if (cdGiven && !witness.picked) return Alert.alert(tt('mo.cd'), tt('tr.witnessGiven'));
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
          Alert.alert(tt('tr.file'), `${f.name}: ${String(e?.message ?? e)} — ${tt('tr.addAgain')}`);
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
      <ScreenTitle title={prior ? `${tt('tr.followUp')} — ${prior.patient}` : tt('tr.new')} subtitle={tt('tr.sub')} help="Hospital" />
      {prior ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{`${tt('tr.followsOf', { no: prior.no, date: formatDate(prior.date) })}: ${prior.complaint}${prior.diagnosis ? ` — ${prior.diagnosis}` : ''}`}</Text> : null}
      <Card>
        <Label>{tt('tr.patient')}</Label>
        <Dropdown caption={tt('tr.patientCap')} value={patientPick} onChange={(v: string) => { setPatientPick(v); const p = people.find((x) => x.id === v); set(p ? { patient: p.name, ...(p.rank ? { patientRank: p.rank } : { patientRank: undefined }) } : { patient: '', patientRank: undefined }); }} options={[{ value: '', label: tt('common.choose') }, ...people.map((p) => ({ value: p.id, label: p.rank ? `${p.name} · ${p.rank}` : p.name })), { value: OTHER, label: 'Someone else — guest, contractor' }]} />
        {patientPick === OTHER ? (
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 2, minWidth: 150, marginTop: 0 }]} value={d.patient} onChangeText={(v) => set({ patient: v })} placeholder={tt('mt.namePh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 100, marginTop: 0 }]} value={d.patientRank ?? ''} onChangeText={(v) => set({ patientRank: v })} placeholder={tt('tr.rolePh')} placeholderTextColor={COLORS.textLight} />
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={{ flex: 1, minWidth: 160 }}><SimpleDatePicker label={tt('nc.date')} value={d.date} onChange={(v) => set({ date: v })} /></View>
          <TextInput style={[styles.input, { width: 80, marginTop: 0, textAlign: 'center' }]} value={d.time ?? ''} onChangeText={(v) => set({ time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
        </View>
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.complaint} onChangeText={(v) => set({ complaint: v })} multiline placeholder={tt('tr.complaintPh')} placeholderTextColor={COLORS.textLight} />
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.history ?? ''} onChangeText={(v) => set({ history: v })} multiline placeholder={tt('tr.historyPh')} placeholderTextColor={COLORS.textLight} />
      </Card>

      <Card>
        <Label>{tt('tr.vitals')}</Label>
        <View style={styles.row}>
          {VITALS.map(([k, l, kb]) => (
            <TextInput key={k} style={[styles.input, { width: 100, marginTop: 0 }]} value={d.vitals?.[k] ?? ''} onChangeText={(v) => setV(k, v)} placeholder={tk(`tr.v.${k}`)} placeholderTextColor={COLORS.textLight} keyboardType={kb as any} />
          ))}
        </View>
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.findings ?? ''} onChangeText={(v) => set({ findings: v })} multiline placeholder={tt('tr.findingsPh')} placeholderTextColor={COLORS.textLight} />
        <TextInput style={styles.input} value={d.diagnosis ?? ''} onChangeText={(v) => set({ diagnosis: v })} placeholder={tt('tr.diagnosisPh')} placeholderTextColor={COLORS.textLight} />
        <TextInput style={[styles.input, { minHeight: 50 }]} value={d.treatment ?? ''} onChangeText={(v) => set({ treatment: v })} multiline placeholder={tt('tr.treatmentPh')} placeholderTextColor={COLORS.textLight} />
      </Card>

      <Card>
        <Label>{tt('tr.givenN', { n: d.issued.length })}</Label>
        {d.issued.map((x) => {
          const item = medItems.find((i) => i.id === x.itemId);
          const ref = item ? scaleEntry(item) : {};
          return (
            <View key={x.itemId} style={{ marginBottom: SIZES.sm }}>
              <View style={styles.row}>
                <Text style={[styles.name, { flex: 1, minWidth: 150 }]}>{x.name}{item?.controlled ? ' ' : ''}{item?.controlled ? <MciIcon name="lock" size={14} color={COLORS.warning} /> : null}</Text>
                <TextInput style={[styles.input, { width: 70, marginTop: 0, textAlign: 'right' }]} value={x.qty ? String(x.qty) : ''} onChangeText={(v) => set({ issued: d.issued.map((y) => (y.itemId === x.itemId ? { ...y, qty: Number(v.replace(',', '.')) || 0 } : y)) })} keyboardType="decimal-pad" />
                <Text style={styles.sub}>{x.unit}</Text>
                <TouchableOpacity onPress={() => set({ issued: d.issued.filter((y) => y.itemId !== x.itemId) })}><Text style={[styles.link, { color: COLORS.danger }]}>✕</Text></TouchableOpacity>
              </View>
              <TextInput style={[styles.input, { marginTop: 4 }]} value={x.dose ?? ''} onChangeText={(v) => set({ issued: d.issued.map((y) => (y.itemId === x.itemId ? { ...y, dose: v } : y)) })} placeholder={tt('tr.dosePh')} placeholderTextColor={COLORS.textLight} />
              {ref.med?.ref ? (
                <TouchableOpacity onPress={() => setRefFor(refFor === x.itemId ? null : x.itemId)}><Text style={styles.link}>{refFor === x.itemId ? tt('tr.hideImgs') : tt('tr.showImgs')}</Text></TouchableOpacity>
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
            <TextInput style={styles.input} value={adding} onChangeText={setAdding} placeholder={tt('tr.findPh')} placeholderTextColor={COLORS.textLight} autoFocus />
            <Text style={styles.sub}>{`${found.length} in date aboard${adding ? ' — found' : ''}`}</Text>
            <ScrollView style={{ maxHeight: 420 }} nestedScrollEnabled>
              {found.map((r) => (
                <TouchableOpacity key={r.item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }} onPress={() => { set({ issued: [...d.issued, { itemId: r.item.id, name: [r.item.name, r.item.strength].filter(Boolean).join(' '), qty: 1, unit: r.item.unit }] }); setAdding(null); }}>
                  <MciIcon name={purposeIcon(purposeOf(r.item))} size={16} color={COLORS.primary} />
                  <Text style={[styles.body, { flexShrink: 1 }]}>{`${r.item.name}${r.item.strength ? ` · ${r.item.strength}` : ''} — ${r.usable} ${r.item.unit}`}</Text>
                  {r.item.controlled ? <MciIcon name="lock" size={14} color={COLORS.warning} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {adding && !found.length ? <Text style={styles.sub}>{tt('tr.noneByName')}</Text> : null}
            <TouchableOpacity onPress={() => setAdding(null)}><Text style={styles.link}>{tt('common.done')}</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity onPress={() => setAdding('')}><Text style={styles.link}>{tt('tr.addMed')}</Text></TouchableOpacity>
        )}
        {d.issued.length ? <Text style={styles.sub}>{tt('tr.fefo')}</Text> : null}
      </Card>

      <Card>
        <TouchableOpacity onPress={() => setTmas(!tmas)}><Text style={styles.link}>{tmas ? `− ${tt('tr.tmas')}` : `+ ${tt('tr.tmas')} (TMAS / CIRM)`}</Text></TouchableOpacity>
        {tmas ? (
          <>
            <TextInput style={styles.input} value={d.tmas?.centre ?? ''} onChangeText={(v) => set({ tmas: { ...(d.tmas ?? {}), centre: v } })} placeholder={tt('tr.centrePh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={d.tmas?.ref ?? ''} onChangeText={(v) => set({ tmas: { ...(d.tmas ?? {}), ref: v } })} placeholder={tt('tr.refPh')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { minHeight: 50 }]} value={d.tmas?.advice ?? ''} onChangeText={(v) => set({ tmas: { ...(d.tmas ?? {}), advice: v } })} multiline placeholder={tt('tr.advicePh')} placeholderTextColor={COLORS.textLight} />
          </>
        ) : null}
        <Label>{tt('tr.files')}</Label>
        {files.map((f, i) => <Text key={i} style={styles.sub}>{`${f.name} · ${sizeText(f.bytes)}${f.note ? ` · ${f.note}` : ''}`}</Text>)}
        <View style={styles.row}>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('file')}><Text style={styles.smallText}>{tt('tr.addAdvice')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void attach('photo')}><Text style={styles.smallText}>{tt('tr.addPhoto')}</Text></TouchableOpacity>
        </View>
        {busy ? <Text style={styles.sub}>{busy}</Text> : null}
      </Card>

      <Card>
        <Label>{tt('tr.outcome')}</Label>
        <View style={styles.chips}>
          {(Object.keys(OUTCOME_LABEL) as MedOutcome[]).map((k) => (
            <TouchableOpacity key={k} style={[styles.chip, d.outcome === k && styles.chipOn]} onPress={() => set({ outcome: k })}>
              <Text style={[styles.chipText, d.outcome === k && styles.chipTextOn]}>{tk(`tr.out.${k}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SimpleDatePicker label={tt('tr.followUp')} value={d.followUp} onChange={(v) => set({ followUp: v })} onClear={() => set({ followUp: undefined })} />
        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
        {cdGiven ? <View style={{ marginTop: SIZES.sm }}>{witness.picker}</View> : null}
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.success }]} onPress={() => void sign()}><Text style={styles.btnText}>{tt('book.signEntry')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => goBackOr(nav)}><Text style={styles.link}>{tt('common.cancel')}</Text></TouchableOpacity>
        </View>
        <Text style={styles.sub}>{tt('tr.signedNote')}</Text>
      </Card>
    </Screen>
  );
}
