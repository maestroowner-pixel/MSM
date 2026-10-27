// ===================================
// One oil sample (types/oil.ts), step by step:
//   taken     date, the machine's running hours, hours on the oil, top-up, bottle
//   sent      to the lab, on a date
//   result    typed in, or read from the lab's Excel / CSV export — by the bottle
//             number, the date taken, or picked from the file's rows; the lab
//             report photographed. Judged as it is typed (services/oil.ts assess).
//   review    an officer's: the verdict and what was done, signed. A reviewed
//             sample is frozen (the rules say the same). From a caution or an
//             action, a defect can be raised on the machine.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { PhotoPicker } from '../components/PhotoPicker';
import { EvidencePhoto } from '../components/EvidencePhoto';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { Attachment } from '../types/equipment';
import { OilResult, OilSample, PARAMS, ParamKey, VERDICTS, Verdict } from '../types/oil';
import * as storage from '../services/storage';
import * as photoQueue from '../services/photoQueue';
import { todayIso } from '../services/pms';
import { LabRow, assess, matchLabRow, pointTitle, previousResult, readLabSheet, resultFromRow, sampleProblem, samplesOf, stageOf } from '../services/oil';
import { pickSheetRows } from '../services/sheetFiles';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};
const str = (n?: number) => (n == null ? '' : String(n));
const GROUPS = ['wear', 'contamination', 'condition'] as const;

interface ResultDraft {
  date: string;
  labNo: string;
  values: Partial<Record<ParamKey, string>>;
  iso: string;
  labVerdict?: Verdict;
  labComment: string;
  from: 'typed' | 'sheet';
}

export default function OilSampleSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { oilPoints, oilSamples, machines, saveRow, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();

  const isNew = route.params?.id === 'new';
  const stored = oilSamples.find((s) => s.id === route.params?.id);
  const point = oilPoints.find((p) => p.id === (stored?.pointId ?? route.params?.pointId));
  const machine = machines.find((m) => m.id === point?.machineId);
  const before = point ? samplesOf(point.id, oilSamples).filter((s) => s.id !== stored?.id && s.machineHours != null) : [];
  const lastHours = before.length ? before[before.length - 1].machineHours : undefined;

  const [taken, setTaken] = useState(() => ({ date: today, machineHours: str(machine?.hours), oilHours: '', topUp: '', bottle: '' }));
  const [sentDate, setSentDate] = useState(today);
  const [rd, setRd] = useState<ResultDraft | null>(null);
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [labRows, setLabRows] = useState<LabRow[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [action, setAction] = useState('');
  const [oilChanged, setOilChanged] = useState(false);
  const back = () => goBackOr(nav, point ? 'OilPoint' : 'OilAnalysis', point ? { id: point.id } : undefined);

  if (!point || (!isNew && !stored)) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('mo.notHere')}</Text>
      </Screen>
    );
  }

  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const vColor = (v?: Verdict | null) => (v === 'action' ? COLORS.danger : v === 'caution' ? COLORS.warning : v === 'normal' ? COLORS.success : COLORS.textLight);
  const me = signer?.name ?? 'Engineer';

  // ---- taken ----
  const take = async () => {
    if (!signer) return Alert.alert(t('oil.takeSample'), t('pd.chooseName'));
    const s: OilSample = {
      id: uid('oils'), pointId: point.id, ...(point.machineId ? { machineId: point.machineId } : {}),
      date: taken.date,
      ...(num(taken.machineHours) != null ? { machineHours: num(taken.machineHours) } : {}),
      ...(num(taken.oilHours) != null ? { oilHours: num(taken.oilHours) } : {}),
      ...(num(taken.topUp) ? { topUp: num(taken.topUp) } : {}),
      ...(taken.bottle.trim() ? { bottle: taken.bottle.trim() } : {}),
      takenBy: signer.name, ...(signer.rank ? { takenByRank: signer.rank } : {}), at: Date.now(), updatedAt: Date.now(),
    };
    const why = sampleProblem(s, today, lastHours);
    if (why) return Alert.alert(t('oil.takeSample'), tk(why, { h: lastHours ?? '' }));
    await saveRow(storage.OIL_SAMPLES_KEY, s);
    playSuccessSound();
    nav.replace('OilSample', { id: s.id });
  };

  if (isNew) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <ScreenTitle title={t('oil.takeSample')} subtitle={pointTitle(point)} help="Oil analysis" />
        <Card>
          <SimpleDatePicker label={t('oil.taken')} value={taken.date} onChange={(d) => d && setTaken({ ...taken, date: d })} />
          <Text style={styles.sub}>{t('oil.machineHours')}</Text>
          <TextInput style={[styles.input, { width: 160 }]} value={taken.machineHours} onChangeText={(v) => setTaken({ ...taken, machineHours: v })} keyboardType="decimal-pad" accessibilityLabel={t('oil.machineHours')} />
          {machine?.hoursDate ? <Text style={styles.sub}>{t('oil.counterRead', { h: machine.hours ?? '', date: machine.hoursDate })}</Text> : null}
          <Text style={styles.sub}>{t('oil.oilHours')}</Text>
          <TextInput style={[styles.input, { width: 160 }]} value={taken.oilHours} onChangeText={(v) => setTaken({ ...taken, oilHours: v })} keyboardType="decimal-pad" accessibilityLabel={t('oil.oilHours')} />
          <Text style={styles.sub}>{t('oil.topUp')}</Text>
          <TextInput style={[styles.input, { width: 160 }]} value={taken.topUp} onChangeText={(v) => setTaken({ ...taken, topUp: v })} keyboardType="decimal-pad" accessibilityLabel={t('oil.topUp')} />
          <Text style={styles.sub}>{t('oil.bottle')}</Text>
          <TextInput style={[styles.input, { width: 220 }]} value={taken.bottle} onChangeText={(v) => setTaken({ ...taken, bottle: v })} autoCapitalize="characters" accessibilityLabel={t('oil.bottle')} />
          {picker}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void take()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={back}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
          <Text style={styles.sub}>{t('oil.sampleHint')}</Text>
        </Card>
      </Screen>
    );
  }

  const s = stored!;
  const stage = stageOf(s);
  const prev = previousResult(s, oilSamples);
  const write = async (patch: Partial<OilSample>) => {
    const next = { ...s, ...patch, updatedAt: Date.now() };
    await saveRow(storage.OIL_SAMPLES_KEY, next);
    if (patch.photos?.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, next);
    playSuccessSound();
  };

  // ---- result ----
  const startResult = () => {
    const r = s.result;
    setRd({
      date: r?.date ?? today, labNo: r?.labNo ?? s.bottle ?? '',
      values: Object.fromEntries(Object.entries(r?.values ?? {}).map(([k, v]) => [k, str(v)])),
      iso: r?.iso ?? '', labVerdict: r?.labVerdict, labComment: r?.labComment ?? '', from: r?.from ?? 'typed',
    });
    setPhotos(s.photos ?? []);
  };
  const applyRow = (row: LabRow) => {
    const r = resultFromRow(row, me, today, Date.now());
    setRd({ date: r.date, labNo: r.labNo ?? s.bottle ?? '', values: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, str(v)])), iso: r.iso ?? '', labVerdict: r.labVerdict, labComment: r.labComment ?? '', from: 'sheet' });
    if (!photos.length) setPhotos(s.photos ?? []);
    setLabRows(null);
    setNote(t('oil.readN', { n: Object.keys(r.values).length }) + (row.unit ? ` · ${row.unit}` : '') + (row.date && row.date !== s.date ? ` · ${t('oil.otherDate', { date: row.date })}` : ''));
  };
  const fromFile = async () => {
    try {
      const f = await pickSheetRows({ csv: true });
      if (!f) return;
      const rows = readLabSheet(f.rows);
      if (!rows?.length) return Alert.alert(t('oil.fromFile'), t('oil.notLabFile'));
      const i = matchLabRow(rows, s);
      if (i >= 0) applyRow(rows[i]);
      else { setLabRows(rows); if (!rd) startResult(); }
    } catch (e: any) {
      Alert.alert(t('oil.fromFile'), String(e?.message ?? e));
    }
  };
  const draftResult = (d: ResultDraft): OilResult => ({
    date: d.date,
    ...(d.labNo.trim() ? { labNo: d.labNo.trim() } : {}),
    values: Object.fromEntries(Object.entries(d.values).map(([k, v]) => [k, num(v ?? '')]).filter(([, v]) => v != null)),
    ...(d.iso.trim() ? { iso: d.iso.trim() } : {}),
    ...(d.labVerdict ? { labVerdict: d.labVerdict } : {}),
    ...(d.labComment.trim() ? { labComment: d.labComment.trim() } : {}),
    from: d.from, by: me, at: Date.now(),
  });
  const saveResult = async () => {
    if (!rd) return;
    if (!signer) return Alert.alert(t('oil.result'), t('pd.chooseName'));
    const r = draftResult(rd);
    if (!Object.keys(r.values).length && !r.iso) return Alert.alert(t('oil.result'), t('oil.needValues'));
    if (r.date < s.date) return Alert.alert(t('oil.result'), t('oil.err.beforeTaken'));
    await write({ result: r, ...(photos.length ? { photos } : {}), ...(s.sent ? {} : { sent: { date: s.date, by: me } }) });
    setRd(null);
    setNote(null);
  };

  // ---- review ----
  const live = rd ? assess(point, draftResult(rd), prev) : s.result ? assess(point, s.result, prev) : null;
  const chosen = verdict ?? live?.verdict ?? 'normal';
  const review = async () => {
    if (!signer) return Alert.alert(t('oil.review'), t('pd.chooseName'));
    if (action.trim().length < 3) return Alert.alert(t('oil.review'), t('oil.needAction'));
    if (live && chosen !== live.verdict && live.level > 0 && chosen === 'normal' && action.trim().length < 15) return Alert.alert(t('oil.review'), t('oil.whyNormal'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Oil analysis review — ${pointTitle(point)} ${s.date}` });
    if (!sig) return;
    await write({ review: { date: today, verdict: chosen, action: action.trim(), ...(oilChanged ? { oilChanged: true } : {}), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) } });
  };
  const raiseDefect = () => point.machineId && nav.navigate('PmsDefect', {
    machineId: point.machineId,
    description: `Oil analysis ${s.date}, ${point.name}: ${(live?.findings ?? []).map((f) => f.text).join('; ')}`.slice(0, 400),
  });

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={`${t('oil.sample')} ${s.date}`} subtitle={pointTitle(point)} help="Oil analysis" />
      {note ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${note}`}</Text> : null}

      <Card>
        <Text style={styles.name}>{tk(`oil.stage.${stage}`)}</Text>
        <Text style={styles.sub}>{[
          s.machineHours != null ? `${t('oil.machineHours')}: ${s.machineHours}` : '',
          s.oilHours != null ? `${t('oil.oilHours')}: ${s.oilHours}` : '',
          s.topUp ? `${t('oil.topUp')}: ${s.topUp}` : '',
          s.bottle ? `${t('oil.bottle')}: ${s.bottle}` : '',
        ].filter(Boolean).join(' · ')}</Text>
        <Text style={styles.sub}>{t('oil.takenBy', { name: s.takenByRank ? `${s.takenBy} (${s.takenByRank})` : s.takenBy })}</Text>
        {s.sent ? <Text style={styles.sub}>{t('oil.sentOn', { date: s.sent.date })}</Text> : null}
      </Card>

      {stage === 'taken' ? (
        <Card>
          <SimpleDatePicker label={t('oil.sent')} value={sentDate} onChange={(d) => d && setSentDate(d)} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} onPress={() => (sentDate < s.date ? Alert.alert(t('oil.sent'), t('oil.err.beforeTaken')) : void write({ sent: { date: sentDate, by: me } }))}><Text style={styles.smallText}>{t('oil.markSent')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {!s.review && !rd ? (
        <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
          <TouchableOpacity style={styles.btn} onPress={() => void fromFile()}><Text style={styles.btnText}>{t('oil.fromFile')}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.small} onPress={startResult}><Text style={styles.smallText}>{s.result ? t('oil.editResult') : t('oil.typeResult')}</Text></TouchableOpacity>
        </View>
      ) : null}

      {labRows ? (
        <Card>
          <Label>{t('oil.whichRow')}</Label>
          {labRows.map((r, i) => (
            <TouchableOpacity key={i} style={[styles.item, { borderLeftColor: COLORS.primary }]} onPress={() => applyRow(r)}>
              <Text style={styles.name}>{[r.date ?? '', r.labNo ?? '', r.unit ?? ''].filter(Boolean).join(' · ') || `#${i + 1}`}</Text>
              <Text style={styles.sub}>{PARAMS.filter((d) => r.values[d.key] != null).slice(0, 6).map((d) => `${d.key.toUpperCase()} ${r.values[d.key]}`).join(' · ')}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setLabRows(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
        </Card>
      ) : null}

      {rd ? (
        <Card>
          <Label>{t('oil.result')}</Label>
          <SimpleDatePicker label={t('oil.reportDate')} value={rd.date} onChange={(d) => d && setRd({ ...rd, date: d })} />
          <Text style={styles.sub}>{t('oil.labNo')}</Text>
          <TextInput style={[styles.input, { width: 220 }]} value={rd.labNo} onChangeText={(v) => setRd({ ...rd, labNo: v })} accessibilityLabel={t('oil.labNo')} />
          {GROUPS.map((g) => (
            <View key={g}>
              <Text style={[styles.sub, { marginTop: SIZES.sm, fontWeight: '700' }]}>{tk(`oil.g.${g}`)}</Text>
              <View style={[styles.row, { marginTop: 0, flexWrap: 'wrap', gap: SIZES.xs }]}>
                {PARAMS.filter((d) => d.group === g).map((d) => {
                  const l = live?.byKey[d.key];
                  return (
                    <View key={d.key} style={{ width: 120 }}>
                      <Text style={[styles.sub, l ? { color: l === 2 ? COLORS.danger : COLORS.warning, fontWeight: '700' } : null]}>{`${tk(`oil.p.${d.key}`)}${d.unit ? ` (${d.unit})` : ''}`}</Text>
                      <TextInput style={[styles.input, { marginTop: 2 }, l ? { borderColor: l === 2 ? COLORS.danger : COLORS.warning } : null]} value={rd.values[d.key] ?? ''} onChangeText={(v) => setRd({ ...rd, values: { ...rd.values, [d.key]: v }, from: 'typed' })} keyboardType="decimal-pad" accessibilityLabel={d.label} />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
          {point.isoTarget || rd.iso || ['hydraulic', 'gear', 'thruster'].includes(point.compartment) ? (
            <>
              <Text style={styles.sub}>{`ISO 4406${point.isoTarget ? ` (${t('oil.isoTarget')} ${point.isoTarget})` : ''}`}</Text>
              <TextInput style={[styles.input, { width: 140 }]} value={rd.iso} onChangeText={(v) => setRd({ ...rd, iso: v })} placeholder="19/17/14" placeholderTextColor={COLORS.textLight} accessibilityLabel="ISO 4406" />
            </>
          ) : null}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('oil.labVerdict')}</Text>
          <View style={styles.chips}>{VERDICTS.map((v) => chip(rd.labVerdict === v, tk(`oil.v.${v}`), () => setRd({ ...rd, labVerdict: rd.labVerdict === v ? undefined : v }), v))}</View>
          <Text style={styles.sub}>{t('oil.labComment')}</Text>
          <TextInput style={styles.input} value={rd.labComment} onChangeText={(v) => setRd({ ...rd, labComment: v })} multiline accessibilityLabel={t('oil.labComment')} />
          <PhotoPicker photos={photos} onChange={setPhotos} hint={t('oil.reportPhoto')} />
          {picker}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void saveResult()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => void fromFile()}><Text style={styles.link}>{t('oil.fromFile')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setRd(null); setNote(null); setLabRows(null); }}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {live && (rd || s.result) ? (
        <Card>
          <Text style={[styles.name, { color: vColor(live.verdict) }]}>{`${t('oil.assessment')}: ${tk(`oil.v.${live.verdict}`)}`}</Text>
          {live.findings.length ? live.findings.map((f, i) => (
            <Text key={i} style={[styles.sub, { color: f.level === 2 ? COLORS.danger : COLORS.warning }]}>{`• ${f.text}`}</Text>
          )) : <Text style={styles.sub}>{t('oil.withinLimits')}</Text>}
          {s.result && !rd ? <Text style={styles.sub}>{t('oil.resultBy', { name: s.result.by, how: s.result.from === 'sheet' ? t('oil.howSheet') : t('oil.howTyped') })}</Text> : null}
        </Card>
      ) : null}

      {s.photos?.length && !rd ? <View style={[styles.row, { gap: SIZES.xs }]}>{s.photos.map((ph) => <EvidencePhoto key={ph.id} vessel={vessel?.imo ?? ''} inspectionId={s.id} photo={ph} />)}</View> : null}

      {s.review ? (
        <Card>
          <Label>{t('oil.review')}</Label>
          <Text style={[styles.name, { color: vColor(s.review.verdict) }]}>{tk(`oil.v.${s.review.verdict}`)}</Text>
          <Text style={styles.body}>{s.review.action}</Text>
          {s.review.oilChanged ? <Text style={styles.sub}>{t('oil.oilChanged')}</Text> : null}
          <Text style={styles.sub}>{`${s.review.byRank ? `${s.review.by} (${s.review.byRank})` : s.review.by} · ${s.review.date}${s.review.signedWith ? ' · ✓' : ''}`}</Text>
        </Card>
      ) : s.result && !rd ? (
        officer ? (
          <Card>
            <Label>{t('oil.review')}</Label>
            <View style={styles.chips}>{VERDICTS.map((v) => chip(chosen === v, tk(`oil.v.${v}`), () => setVerdict(v), v))}</View>
            <Text style={styles.sub}>{t('oil.action')}</Text>
            <TextInput style={styles.input} value={action} onChangeText={setAction} multiline placeholder={t('oil.actionEg')} placeholderTextColor={COLORS.textLight} accessibilityLabel={t('oil.action')} />
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>{t('oil.oilChanged')}</Text>
              <Switch value={oilChanged} onValueChange={setOilChanged} />
            </View>
            {picker}
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void review()}><Text style={styles.btnText}>{t('oil.signReview')}</Text></TouchableOpacity>
              {point.machineId && live && live.level > 0 ? <TouchableOpacity onPress={raiseDefect}><Text style={styles.link}>{t('oil.raiseDefect')}</Text></TouchableOpacity> : null}
            </View>
            <Text style={styles.sub}>{t('oil.reviewNote')}</Text>
          </Card>
        ) : <Text style={styles.sub}>{t('oil.officerReviews')}</Text>
      ) : null}
    </Screen>
  );
}
