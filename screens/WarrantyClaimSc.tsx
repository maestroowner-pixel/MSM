// ===================================
// A warranty claim (types/yard.ts WarrantyClaim) against the yard, a contractor
// or the maker: the fault, when it was found, the warranty it falls under (an
// accepted yard job's, or the dates of a machine bought new) → submitted →
// their answer → closed with how it ended, signed. The claim PDF is what is
// sent. The officers keep it; a closed claim is frozen (rules). Never deleted.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { PhotoPicker } from '../components/PhotoPicker';
import { EvidencePhoto } from '../components/EvidencePhoto';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { personName, roleAtLeast } from '../types/role';
import { Attachment } from '../types/equipment';
import { CLAIM_OUTCOMES, CLAIM_SETTLEMENTS, ClaimOutcome, ClaimSettlement, WarrantyClaim } from '../types/yard';
import * as storage from '../services/storage';
import * as photoQueue from '../services/photoQueue';
import { todayIso } from '../services/pms';
import { claimCover, claimInCover, claimStage, jobCover, jobNo, nextClaimNo } from '../services/yard';
import { exportClaim } from '../services/yardReport';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const num = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};

interface Draft {
  title: string;
  machineId: string;
  against: string;
  coverFrom: string;
  coverUntil: string;
  found: string;
  description: string;
  photos: Attachment[];
}

export default function WarrantyClaimSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { warrantyClaims, yardJobs, pmsProjects, machines, suppliers, saveRow, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();
  const me = sync.me ? personName(sync.me) : signer?.name ?? 'Officer';

  const isNew = route.params?.id === 'new';
  const stored = warrantyClaims.find((c) => c.id === route.params?.id);
  const job = yardJobs.find((j) => j.id === (stored?.yardJobId ?? route.params?.jobId));
  const project = pmsProjects.find((p) => p.id === (stored?.projectId ?? job?.projectId));
  const [draft, setDraft] = useState<Draft | null>(() => (isNew ? {
    title: '', machineId: job?.machineId ?? '', against: job?.contractor ?? project?.yard ?? '', coverFrom: '', coverUntil: '', found: today, description: '', photos: [],
  } : null));
  const [answer, setAnswer] = useState<{ outcome: ClaimOutcome; note: string; theirRef: string; date: string } | null>(null);
  const [closing, setClosing] = useState<{ how: ClaimSettlement; note: string; cost: string } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const back = () => goBackOr(nav, 'Yard');

  if (!draft && !stored) {
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
  const input = (value: string, onChange: (v: string) => void, label: string, opts: { width?: number; kb?: any; placeholder?: string; multiline?: boolean } = {}) => (
    <TextInput style={[styles.input, opts.width ? { width: opts.width } : null, opts.multiline ? { minHeight: 70 } : null]} value={value} onChangeText={onChange} keyboardType={opts.kb} placeholder={opts.placeholder} placeholderTextColor={COLORS.textLight} accessibilityLabel={label} multiline={opts.multiline} />
  );

  // ---- edit ----
  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    const hints = draft.against.trim() ? suppliers.filter((s) => s.name.toLowerCase().includes(draft.against.trim().toLowerCase()) && s.name !== draft.against).slice(0, 5) : [];
    const jc = job ? jobCover(job) : null;
    const save = async () => {
      if (!officer) return;
      if (draft.title.trim().length < 3) return Alert.alert(t('yd.claim'), t('yd.needTitle'));
      if (!draft.against.trim()) return Alert.alert(t('yd.claim'), t('yd.needAgainst'));
      if (draft.description.trim().length < 10) return Alert.alert(t('yd.claim'), t('yd.needFault'));
      if (draft.coverFrom && draft.coverUntil && draft.coverUntil < draft.coverFrom) return Alert.alert(t('yd.claim'), t('yd.endBeforeStart'));
      const m = machines.find((x) => x.id === draft.machineId);
      const now = Date.now();
      const base: WarrantyClaim = stored ?? {
        id: uid('wc'), no: nextClaimNo(warrantyClaims, today.slice(0, 4)), title: '', against: '', found: today, description: '', createdBy: me, at: now, updatedAt: now,
        ...(job ? { yardJobId: job.id, projectId: job.projectId } : {}),
      };
      const c: WarrantyClaim = {
        ...base, title: draft.title.trim(), against: draft.against.trim(), found: draft.found || today, description: draft.description.trim(), updatedAt: now,
      };
      if (m) { c.machineId = m.id; c.machineName = m.name; } else if (!draft.machineId) { delete c.machineId; delete c.machineName; }
      if (!job && draft.coverUntil) { c.coverUntil = draft.coverUntil; if (draft.coverFrom) c.coverFrom = draft.coverFrom; else delete c.coverFrom; } else { delete c.coverUntil; delete c.coverFrom; }
      if (draft.photos.length) c.photos = draft.photos; else delete c.photos;
      await saveRow(storage.WARRANTY_CLAIMS_KEY, c);
      if (c.photos?.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, c);
      playSuccessSound();
      if (isNew) nav.replace('WarrantyClaim', { id: c.id });
      else setDraft(null);
    };
    const live = machines.filter((m) => !m.scrapped).sort((a, b) => a.name.localeCompare(b.name));
    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setDraft(null))} />
        <ScreenTitle title={isNew ? t('yd.newClaim') : `${stored!.no} · ${stored!.title}`} subtitle={t('yd.warranty')} help="Yard periods and warranty" />
        <Card>
          {job ? <Text style={[styles.sub, { fontWeight: '700' }]}>{t('yd.claimOnJob', { no: jobNo(job), title: job.title, project: project?.name ?? '' })}</Text> : null}
          {jc ? <Text style={styles.sub}>{t('yd.underWarranty', { from: uiDate(jc.from), to: uiDate(jc.until) })}</Text> : null}
          <Text style={styles.sub}>{t('yd.claimTitle')}</Text>
          {input(draft.title, (v) => set({ title: v }), t('yd.claimTitle'), { placeholder: t('yd.claimTitleEg') })}
          <Dropdown caption={t('yd.machine')} value={draft.machineId} onChange={(v: string) => set({ machineId: v })} options={[{ value: '', label: t('yd.noMachine') }, ...live.map((m) => ({ value: m.id, label: m.name }))]} style={{ maxWidth: 420, marginTop: SIZES.sm }} />
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.against')}</Text>
          {input(draft.against, (v) => set({ against: v }), t('yd.against'), { placeholder: t('yd.againstEg') })}
          {hints.length ? <View style={styles.chips}>{hints.map((s) => chip(false, s.name, () => set({ against: s.name }), s.id))}</View> : null}
          {!job ? (
            <>
              <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.coverHint')}</Text>
              <View style={{ marginTop: SIZES.xs }}><SimpleDatePicker label={t('yd.coverFrom')} value={draft.coverFrom} onChange={(v) => set({ coverFrom: v })} onClear={() => set({ coverFrom: '' })} /></View>
              <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('yd.coverUntil')} value={draft.coverUntil} onChange={(v) => set({ coverUntil: v })} onClear={() => set({ coverUntil: '' })} /></View>
            </>
          ) : null}
          <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('yd.found')} value={draft.found} onChange={(v) => v && set({ found: v })} /></View>
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.fault')}</Text>
          {input(draft.description, (v) => set({ description: v }), t('yd.fault'), { placeholder: t('yd.faultEg'), multiline: true })}
          <PhotoPicker photos={draft.photos} onChange={(ph) => set({ photos: ph })} hint={t('yd.claimPhotos')} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew ? back() : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      </Screen>
    );
  }

  // ---- view ----
  const c = stored!;
  const stage = claimStage(c);
  const cv = claimCover(c, yardJobs);
  const inCover = claimInCover(c, yardJobs);
  const write = async (patch: Partial<WarrantyClaim>) => {
    await saveRow(storage.WARRANTY_CLAIMS_KEY, { ...c, ...patch, updatedAt: Date.now() });
    playSuccessSound();
  };
  const pdf = async () => {
    try {
      const w = await exportClaim(c, yardJobs, pmsProjects, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('yd.claim'), String(e?.message ?? e));
    }
  };
  const saveAnswer = async () => {
    if (!answer) return;
    if (answer.note.trim().length < 3) return Alert.alert(t('yd.answer'), t('yd.needAnswer'));
    await write({ answer: { date: answer.date || today, outcome: answer.outcome, note: answer.note.trim(), ...(answer.theirRef.trim() ? { theirRef: answer.theirRef.trim() } : {}) } });
    setAnswer(null);
  };
  const close = async () => {
    if (!closing) return;
    if (closing.note.trim().length < 3) return Alert.alert(t('yd.closeClaim'), t('yd.needCloseNote'));
    if (!signer) return Alert.alert(t('yd.closeClaim'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Warranty claim ${c.no} closed` });
    if (!sig) return;
    const cost = num(closing.cost);
    await write({ closed: { date: today, how: closing.how, note: closing.note.trim(), ...(cost ? { cost } : {}), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) } });
    setClosing(null);
  };
  const stageColor = stage === 'closed' ? COLORS.textLight : stage === 'answered' ? COLORS.primary : stage === 'submitted' ? COLORS.warning : COLORS.danger;

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={`${c.no} · ${c.title}`} subtitle={`${t('yd.warranty')} · ${c.against}`} help="Yard periods and warranty" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <Text style={[styles.name, { color: stageColor }]}>{tk(`yd.cst.${stage}`)}</Text>
        <Text style={styles.sub}>{[c.machineName ?? '', t('yd.foundOn', { date: uiDate(c.found) }), c.createdBy].filter(Boolean).join(' · ')}</Text>
        {job ? (
          <TouchableOpacity onPress={() => nav.navigate('YardJob', { id: job.id })}>
            <Text style={[styles.link, { marginTop: SIZES.xs }]}>{`${t('yd.claimOnJob', { no: jobNo(job), title: job.title, project: project?.name ?? '' })} ›`}</Text>
          </TouchableOpacity>
        ) : null}
        {cv ? (
          <Text style={[styles.sub, { color: inCover === false ? COLORS.danger : COLORS.success, fontWeight: '700' }]}>
            {`${cv.from ? t('yd.underWarranty', { from: uiDate(cv.from), to: uiDate(cv.until) }) : t('yd.until', { date: uiDate(cv.until) })}${inCover === false ? ` · ${t('yd.outsideCover')}` : ''}`}
          </Text>
        ) : <Text style={[styles.sub, { color: COLORS.warning }]}>{t('yd.noCoverDates')}</Text>}
        <Text style={[styles.body, { marginTop: SIZES.xs }]}>{c.description}</Text>
        {c.photos?.length ? <View style={[styles.row, { gap: SIZES.xs }]}>{c.photos.map((ph) => <EvidencePhoto key={ph.id} vessel={vessel?.imo ?? ''} inspectionId={c.id} photo={ph} />)}</View> : null}
      </Card>

      <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.small} onPress={() => void pdf()}><Text style={styles.smallText}>{t('yd.claimPdf')}</Text></TouchableOpacity>
        {officer && stage !== 'closed' && !answer && !closing ? (
          <>
            {stage === 'draft' ? <TouchableOpacity style={styles.btn} onPress={() => void write({ submitted: { date: today, to: c.against, by: me } })}><Text style={styles.btnText}>{t('yd.markSubmitted')}</Text></TouchableOpacity> : null}
            {stage === 'submitted' || stage === 'answered' ? <TouchableOpacity style={stage === 'submitted' ? styles.btn : styles.small} onPress={() => setAnswer({ outcome: c.answer?.outcome ?? 'accepted', note: c.answer?.note ?? '', theirRef: c.answer?.theirRef ?? '', date: c.answer?.date ?? today })}><Text style={stage === 'submitted' ? styles.btnText : styles.smallText}>{t('yd.answer')}</Text></TouchableOpacity> : null}
            <TouchableOpacity style={stage === 'answered' ? styles.btn : styles.small} onPress={() => setClosing({ how: c.answer?.outcome === 'rejected' ? 'refused' : 'repaired', note: '', cost: '' })}><Text style={stage === 'answered' ? styles.btnText : styles.smallText}>{t('yd.closeClaim')}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.small} onPress={() => setDraft({ title: c.title, machineId: c.machineId ?? '', against: c.against, coverFrom: c.coverFrom ?? '', coverUntil: c.coverUntil ?? '', found: c.found, description: c.description, photos: c.photos ?? [] })}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity>
          </>
        ) : null}
      </View>

      {c.submitted ? <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.submittedV', { date: uiDate(c.submitted.date), to: c.submitted.to ?? c.against, by: c.submitted.by })}</Text> : null}
      {c.answer && !answer ? (
        <Card>
          <Label>{t('yd.answer')}</Label>
          <Text style={styles.name}>{tk(`yd.out.${c.answer.outcome}`)}</Text>
          <Text style={styles.body}>{c.answer.note}</Text>
          <Text style={styles.sub}>{[uiDate(c.answer.date), c.answer.theirRef ? t('yd.theirRefV', { v: c.answer.theirRef }) : ''].filter(Boolean).join(' · ')}</Text>
        </Card>
      ) : null}

      {answer ? (
        <Card>
          <Label>{t('yd.answer')}</Label>
          <View style={styles.chips}>{CLAIM_OUTCOMES.map((o) => chip(answer.outcome === o, tk(`yd.out.${o}`), () => setAnswer({ ...answer, outcome: o }), o))}</View>
          <SimpleDatePicker label={t('yd.answerDate')} value={answer.date} onChange={(v) => v && setAnswer({ ...answer, date: v })} />
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.answerNote')}</Text>
          {input(answer.note, (v) => setAnswer({ ...answer, note: v }), t('yd.answerNote'), { multiline: true })}
          <Text style={styles.sub}>{t('yd.theirRef')}</Text>
          {input(answer.theirRef, (v) => setAnswer({ ...answer, theirRef: v }), t('yd.theirRef'), { width: 220 })}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void saveAnswer()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAnswer(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {closing ? (
        <Card>
          <Label>{t('yd.closeClaim')}</Label>
          <View style={styles.chips}>{CLAIM_SETTLEMENTS.map((h) => chip(closing.how === h, tk(`yd.how.${h}`), () => setClosing({ ...closing, how: h }), h))}</View>
          <Text style={styles.sub}>{t('yd.closeNote')}</Text>
          {input(closing.note, (v) => setClosing({ ...closing, note: v }), t('yd.closeNote'), { multiline: true })}
          {closing.how === 'refused' || closing.how === 'withdrawn' ? (
            <>
              <Text style={styles.sub}>{t('yd.ourCost', { cur: project?.currency ?? '' })}</Text>
              {input(closing.cost, (v) => setClosing({ ...closing, cost: v }), t('yd.ourCost', { cur: '' }), { width: 150, kb: 'decimal-pad' })}
            </>
          ) : null}
          {picker}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void close()}><Text style={styles.btnText}>{t('yd.signClose')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {c.closed ? (
        <Card>
          <Label>{t('yd.closedHead')}</Label>
          <Text style={styles.name}>{tk(`yd.how.${c.closed.how}`)}</Text>
          <Text style={styles.body}>{c.closed.note}</Text>
          <Text style={styles.sub}>{`${c.closed.byRank ? `${c.closed.by} (${c.closed.byRank})` : c.closed.by} · ${uiDate(c.closed.date)}${c.closed.signedWith ? ' · ✓' : ''}${c.closed.cost ? ` · ${t('yd.ourCostV', { v: c.closed.cost })}` : ''}`}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
