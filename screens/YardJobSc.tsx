// ===================================
// One line of a yard period's work list (types/yard.ts YardJob): what is to be
// done and on what, by whom, the price; then started → done → accepted. The
// acceptance is an officer's (or the superintendent's) signature with a note
// and photos of the finished work; it can close the job's defect with the same
// signature. After it only the final price and the invoice may change (rules).
// A job is cancelled with the reason, never deleted. An accepted job with a
// warranty can raise a warranty claim.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { PhotoPicker } from '../components/PhotoPicker';
import { EvidencePhoto } from '../components/EvidencePhoto';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { personName, plansPms, roleAtLeast } from '../types/role';
import { Attachment } from '../types/equipment';
import { YARD_BYS, YARD_DEPTS, YardBy, YardDept, YardJob } from '../types/yard';
import * as storage from '../services/storage';
import * as photoQueue from '../services/photoQueue';
import { todayIso } from '../services/pms';
import { claimStage, coverState, jobCover, jobNo, jobProblem, jobStage, money, nextJobNo, yardDept } from '../services/yard';
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
const str = (n?: number) => (n == null ? '' : String(n));

interface Draft {
  title: string;
  spec: string;
  dept: YardDept;
  machineId: string;
  by: YardBy;
  contractor: string;
  classItem: boolean;
  quoted: string;
  warrantyMonths: string;
  notes: string;
  photos: Attachment[];
}
const toDraft = (j?: YardJob): Draft => ({
  title: j?.title ?? '', spec: j?.spec ?? '', dept: j?.dept ?? 'engine', machineId: j?.machineId ?? '', by: j?.by ?? 'yard', contractor: j?.contractor ?? '',
  classItem: !!j?.classItem, quoted: str(j?.quoted), warrantyMonths: str(j?.warrantyMonths), notes: j?.notes ?? '', photos: j?.photos ?? [],
});

export default function YardJobSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { pmsProjects, yardJobs, warrantyClaims, machines, pmsDefects, saveRow, vessel } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const keeps = canPlan || officer;
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();
  const me = sync.me ? personName(sync.me) : signer?.name ?? 'Officer';

  const isNew = route.params?.id === 'new';
  const stored = yardJobs.find((j) => j.id === route.params?.id);
  const project = pmsProjects.find((p) => p.id === (stored?.projectId ?? route.params?.projectId));
  const [draft, setDraft] = useState<Draft | null>(() => (isNew ? toDraft() : null));
  const [accepting, setAccepting] = useState<{ note: string; final: string; invoice: string; photos: Attachment[]; closeDefect: boolean } | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cost, setCost] = useState<{ final: string; invoice: string } | null>(null);
  const back = () => goBackOr(nav, project ? 'YardProject' : 'Yard', project ? { id: project.id } : undefined);

  if (!project || (!draft && !stored)) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('mo.notHere')}</Text>
      </Screen>
    );
  }
  const cur = project.currency;
  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const input = (value: string, onChange: (v: string) => void, label: string, opts: { width?: number; kb?: any; placeholder?: string; multiline?: boolean } = {}) => (
    <TextInput style={[styles.input, opts.width ? { width: opts.width } : null, opts.multiline ? { minHeight: 70 } : null]} value={value} onChangeText={onChange} keyboardType={opts.kb} placeholder={opts.placeholder} placeholderTextColor={COLORS.textLight} accessibilityLabel={label} multiline={opts.multiline} />
  );
  const queue = async (rec: { id: string; photos?: Attachment[] }) => {
    if (rec.photos?.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, rec);
  };

  // ---- edit ----
  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    const live = machines.filter((m) => !m.scrapped).sort((a, b) => a.name.localeCompare(b.name));
    const pickMachine = (id: string) => {
      const m = machines.find((x) => x.id === id);
      // The department follows the machine until somebody picks one.
      set({ machineId: id, ...(m && (!draft.machineId || draft.dept === yardDept(machines.find((x) => x.id === draft.machineId))) ? { dept: yardDept(m) } : {}) });
    };
    const save = async () => {
      const m = machines.find((x) => x.id === draft.machineId);
      const now = Date.now();
      const base: YardJob = stored ?? { id: uid('yj'), projectId: project.id, no: nextJobNo(project.id, yardJobs), title: '', dept: 'engine', by: 'yard', createdBy: me, at: now, updatedAt: now };
      const j: YardJob = {
        ...base,
        title: draft.title.trim(), dept: draft.dept, by: draft.by,
        updatedAt: now,
      };
      const opt: Partial<YardJob> = {
        spec: draft.spec.trim() || undefined,
        machineId: m?.id ?? (draft.machineId ? base.machineId : undefined), machineName: m?.name ?? (draft.machineId ? base.machineName : undefined),
        contractor: draft.by !== 'yard' && draft.by !== 'crew' && draft.contractor.trim() ? draft.contractor.trim() : undefined,
        classItem: draft.classItem || undefined, quoted: num(draft.quoted), warrantyMonths: num(draft.warrantyMonths), notes: draft.notes.trim() || undefined,
        photos: draft.photos.length ? draft.photos : undefined,
      };
      const out = { ...j, ...opt };
      const why = jobProblem(out);
      if (why) return Alert.alert(t('yd.job'), tk(why));
      const clean = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as unknown as YardJob;
      await saveRow(storage.YARD_JOBS_KEY, clean);
      await queue(clean);
      playSuccessSound();
      if (isNew) nav.replace('YardJob', { id: clean.id });
      else setDraft(null);
    };
    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setDraft(null))} />
        <ScreenTitle title={isNew ? t('yd.addJob') : `${jobNo(stored!)} ${stored!.title}`} subtitle={project.name} help="Yard periods and warranty" />
        <Card>
          <Text style={styles.sub}>{t('yd.jobTitle')}</Text>
          {input(draft.title, (v) => set({ title: v }), t('yd.jobTitle'), { placeholder: t('yd.jobTitleEg') })}
          <Dropdown caption={t('yd.machine')} value={draft.machineId} onChange={pickMachine} options={[{ value: '', label: t('yd.noMachine') }, ...live.map((m) => ({ value: m.id, label: m.name }))]} style={{ maxWidth: 420, marginTop: SIZES.sm }} />
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.dept')}</Text>
          <View style={styles.chips}>{YARD_DEPTS.map((d) => chip(draft.dept === d, tk(`yd.dept.${d}`), () => set({ dept: d }), d))}</View>
          <Text style={styles.sub}>{t('yd.spec')}</Text>
          {input(draft.spec, (v) => set({ spec: v }), t('yd.spec'), { placeholder: t('yd.specEg'), multiline: true })}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.by')}</Text>
          <View style={styles.chips}>{YARD_BYS.map((b) => chip(draft.by === b, tk(`yd.by.${b}`), () => set({ by: b }), b))}</View>
          {draft.by === 'contractor' || draft.by === 'maker' ? (
            <>
              <Text style={styles.sub}>{draft.by === 'maker' ? t('yd.maker') : t('yd.contractor')}</Text>
              {input(draft.contractor, (v) => set({ contractor: v }), t('yd.contractor'))}
            </>
          ) : null}
          <View style={styles.chips}>{chip(draft.classItem, t('yd.classItem'), () => set({ classItem: !draft.classItem }), 'class')}</View>
          <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm, flexWrap: 'wrap' }]}>
            <View>
              <Text style={styles.sub}>{t('yd.quoted', { cur: cur ?? '' })}</Text>
              {input(draft.quoted, (v) => set({ quoted: v }), t('yd.quoted', { cur: cur ?? '' }), { width: 150, kb: 'decimal-pad' })}
            </View>
            <View>
              <Text style={styles.sub}>{t('yd.warrantyMonths')}</Text>
              {input(draft.warrantyMonths, (v) => set({ warrantyMonths: v }), t('yd.warrantyMonths'), { width: 110, kb: 'number-pad', placeholder: '12' })}
            </View>
          </View>
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.notes')}</Text>
          {input(draft.notes, (v) => set({ notes: v }), t('yd.notes'), { multiline: true })}
          <PhotoPicker photos={draft.photos} onChange={(ph) => set({ photos: ph })} hint={t('yd.photosHint')} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew ? back() : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      </Screen>
    );
  }

  // ---- view ----
  const j = stored!;
  const stage = jobStage(j);
  const defect = j.defectId ? pmsDefects.find((d) => d.id === j.defectId) : undefined;
  const cover = jobCover(j);
  const claims = warrantyClaims.filter((c) => c.yardJobId === j.id);
  const open = stage !== 'accepted' && stage !== 'cancelled' && !project.closedAt;
  const stageColor = stage === 'accepted' ? COLORS.success : stage === 'done' ? COLORS.primary : stage === 'progress' ? COLORS.warning : COLORS.textLight;
  const write = async (patch: Partial<YardJob>) => {
    await saveRow(storage.YARD_JOBS_KEY, { ...j, ...patch, updatedAt: Date.now() });
    playSuccessSound();
  };

  const accept = async () => {
    if (!accepting) return;
    if (accepting.note.trim().length < 3) return Alert.alert(t('yd.accept'), t('yd.needAcceptNote'));
    if (!signer) return Alert.alert(t('yd.accept'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Yard work accepted — ${project.name} item ${jobNo(j)} ${j.title}` });
    if (!sig) return;
    const now = Date.now();
    const closeIt = accepting.closeDefect && defect && !defect.closed;
    const accepted = {
      date: today, note: accepting.note.trim(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now,
      ...(sig.proof ? { signedWith: sig.proof } : {}), ...(accepting.photos.length ? { photos: accepting.photos } : {}), ...(closeIt ? { defectClosed: true } : {}),
    };
    const final = num(accepting.final);
    const next: YardJob = {
      ...j, accepted, ...(j.startedOn ? {} : { startedOn: j.doneOn ?? today }), ...(j.doneOn ? {} : { doneOn: today }),
      ...(final != null ? { final } : {}), ...(accepting.invoice.trim() ? { invoice: accepting.invoice.trim() } : {}), updatedAt: now,
    };
    await saveRow(storage.YARD_JOBS_KEY, next);
    await queue({ id: `${j.id}-accepted`, photos: accepting.photos });
    if (closeIt) {
      const note = `Repaired in ${project.name}${project.yard ? ` (${project.yard})` : ''}, item ${jobNo(j)}: ${accepting.note.trim()}`;
      await saveRow(storage.PMS_DEFECTS_KEY, { ...defect!, closed: { date: today, note, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}) }, updatedAt: now });
    }
    playSuccessSound();
    setAccepting(null);
  };
  const notDone = async () => {
    const next: YardJob = { ...j, updatedAt: Date.now() };
    delete next.doneOn;
    await saveRow(storage.YARD_JOBS_KEY, next);
  };
  const cancel = async () => {
    if (!cancelling || cancelling.trim().length < 3) return Alert.alert(t('yd.cancelJob'), t('yd.needReason'));
    await write({ cancelled: { date: today, reason: cancelling.trim(), by: me } });
    setCancelling(null);
  };
  const saveCost = async () => {
    if (!cost) return;
    const final = num(cost.final);
    if (final != null && final < 0) return Alert.alert(t('yd.job'), t('yd.negative'));
    const next: YardJob = { ...j, updatedAt: Date.now() };
    if (final != null) next.final = final; else delete next.final;
    if (cost.invoice.trim()) next.invoice = cost.invoice.trim(); else delete next.invoice;
    await saveRow(storage.YARD_JOBS_KEY, next);
    playSuccessSound();
    setCost(null);
  };

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={`${jobNo(j)} ${j.title}`} subtitle={`${project.name} · ${tk(`yd.dept.${j.dept}`)}`} help="Yard periods and warranty" />

      <Card>
        <Text style={[styles.name, { color: stageColor }]}>{tk(`yd.st.${stage}`)}</Text>
        <Text style={styles.sub}>{[
          j.machineName ?? '',
          j.by === 'yard' ? (project.yard ?? tk('yd.by.yard')) : `${tk(`yd.by.${j.by}`)}${j.contractor ? `: ${j.contractor}` : ''}`,
          j.classItem ? 'CLASS' : '',
          j.startedOn ? t('yd.startedOn', { date: uiDate(j.startedOn) }) : '',
          j.doneOn ? t('yd.doneOnD', { date: uiDate(j.doneOn) }) : '',
        ].filter(Boolean).join(' · ')}</Text>
        {j.spec ? <Text style={[styles.body, { marginTop: SIZES.xs }]}>{j.spec}</Text> : null}
        <Text style={[styles.body, { marginTop: SIZES.xs }]}>{[
          j.quoted != null ? t('yd.quotedV', { v: money(j.quoted, cur) }) : t('yd.notPriced'),
          j.final != null ? t('yd.finalV', { v: money(j.final, cur) }) : '',
          j.invoice ? t('yd.invoiceV', { v: j.invoice }) : '',
          j.warrantyMonths ? t('yd.warrantyV', { n: j.warrantyMonths }) : '',
        ].filter(Boolean).join(' · ')}</Text>
        {j.notes ? <Text style={styles.sub}>{j.notes}</Text> : null}
        {j.cancelled ? <Text style={[styles.sub, { color: COLORS.danger }]}>{t('yd.cancelledV', { date: uiDate(j.cancelled.date), reason: j.cancelled.reason, by: j.cancelled.by })}</Text> : null}
        {defect ? (
          <TouchableOpacity onPress={() => nav.navigate('PmsDefect', { id: defect.id })}>
            <Text style={[styles.link, { marginTop: SIZES.xs }]}>{`${t('yd.defect')}: ${defect.description.slice(0, 80)}${defect.closed ? ` · ${t('yd.defectClosed')}` : ''} ›`}</Text>
          </TouchableOpacity>
        ) : null}
        {j.pmsJobId ? (
          <TouchableOpacity onPress={() => nav.navigate('PmsJob', { id: j.pmsJobId })}>
            <Text style={[styles.link, { marginTop: SIZES.xs }]}>{`${t('yd.pmsJob')} ›`}</Text>
          </TouchableOpacity>
        ) : null}
        {j.photos?.length ? <View style={[styles.row, { gap: SIZES.xs }]}>{j.photos.map((ph) => <EvidencePhoto key={ph.id} vessel={vessel?.imo ?? ''} inspectionId={j.id} photo={ph} />)}</View> : null}
      </Card>

      {open && keeps && !accepting && cancelling == null ? (
        <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
          {stage === 'planned' ? <TouchableOpacity style={styles.btn} onPress={() => void write({ startedOn: today })}><Text style={styles.btnText}>{t('yd.start')}</Text></TouchableOpacity> : null}
          {stage === 'progress' ? <TouchableOpacity style={styles.btn} onPress={() => void write({ doneOn: today })}><Text style={styles.btnText}>{t('yd.markDone')}</Text></TouchableOpacity> : null}
          {stage === 'done' || stage === 'progress' ? (
            <TouchableOpacity style={stage === 'done' ? styles.btn : styles.small} onPress={() => setAccepting({ note: '', final: str(j.final ?? j.quoted), invoice: j.invoice ?? '', photos: [], closeDefect: !!defect && !defect.closed && officer })}>
              <Text style={stage === 'done' ? styles.btnText : styles.smallText}>{t('yd.accept')}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.small} onPress={() => setDraft(toDraft(j))}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity>
          {stage === 'done' ? <TouchableOpacity style={styles.small} onPress={() => void notDone()}><Text style={styles.smallText}>{t('yd.notDone')}</Text></TouchableOpacity> : null}
          <TouchableOpacity onPress={() => setCancelling('')}><Text style={[styles.link, { color: COLORS.danger }]}>{t('yd.cancelJob')}</Text></TouchableOpacity>
        </View>
      ) : null}

      {accepting ? (
        <Card>
          <Label>{t('yd.accept')}</Label>
          <Text style={styles.sub}>{t('yd.acceptNote')}</Text>
          {input(accepting.note, (v) => setAccepting({ ...accepting, note: v }), t('yd.acceptNote'), { placeholder: t('yd.acceptNoteEg'), multiline: true })}
          <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm, flexWrap: 'wrap' }]}>
            <View>
              <Text style={styles.sub}>{t('yd.final', { cur: cur ?? '' })}</Text>
              {input(accepting.final, (v) => setAccepting({ ...accepting, final: v }), t('yd.final', { cur: cur ?? '' }), { width: 150, kb: 'decimal-pad' })}
            </View>
            <View>
              <Text style={styles.sub}>{t('yd.invoice')}</Text>
              {input(accepting.invoice, (v) => setAccepting({ ...accepting, invoice: v }), t('yd.invoice'), { width: 180 })}
            </View>
          </View>
          <PhotoPicker photos={accepting.photos} onChange={(ph) => setAccepting({ ...accepting, photos: ph })} hint={t('yd.afterPhotos')} />
          {defect && !defect.closed && officer ? (
            <View style={styles.chips}>{chip(accepting.closeDefect, t('yd.closeDefect'), () => setAccepting({ ...accepting, closeDefect: !accepting.closeDefect }), 'cd')}</View>
          ) : null}
          {picker}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void accept()}><Text style={styles.btnText}>{t('yd.signAccept')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAccepting(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
          <Text style={styles.sub}>{t('yd.acceptHint')}</Text>
        </Card>
      ) : null}

      {cancelling != null ? (
        <Card>
          <Label>{t('yd.cancelJob')}</Label>
          {input(cancelling, setCancelling, t('yd.reason'), { placeholder: t('yd.reasonEg') })}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.danger }]} onPress={() => void cancel()}><Text style={styles.btnText}>{t('yd.cancelJob')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setCancelling(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {j.accepted ? (
        <Card>
          <Label>{t('yd.acceptance')}</Label>
          <Text style={styles.body}>{j.accepted.note}</Text>
          <Text style={styles.sub}>{`${j.accepted.byRank ? `${j.accepted.by} (${j.accepted.byRank})` : j.accepted.by} · ${uiDate(j.accepted.date)}${j.accepted.signedWith ? ' · ✓' : ''}${j.accepted.defectClosed ? ` · ${t('yd.defectClosedBy')}` : ''}`}</Text>
          {j.accepted.photos?.length ? <View style={[styles.row, { gap: SIZES.xs }]}>{j.accepted.photos.map((ph) => <EvidencePhoto key={ph.id} vessel={vessel?.imo ?? ''} inspectionId={`${j.id}-accepted`} photo={ph} />)}</View> : null}
          {cover ? (
            <Text style={[styles.sub, { marginTop: SIZES.xs, fontWeight: '700', color: coverState(cover.until, today) === 'active' ? COLORS.success : coverState(cover.until, today) === 'expiring' ? COLORS.warning : COLORS.textLight }]}>
              {`${t('yd.underWarranty', { from: uiDate(cover.from), to: uiDate(cover.until) })} · ${tk(`yd.cover.${coverState(cover.until, today)}`)}`}
            </Text>
          ) : null}
          {keeps && !cost ? (
            <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
              <TouchableOpacity style={styles.small} onPress={() => setCost({ final: str(j.final), invoice: j.invoice ?? '' })}><Text style={styles.smallText}>{t('yd.editCost')}</Text></TouchableOpacity>
              {officer && cover ? <TouchableOpacity style={styles.small} onPress={() => nav.navigate('WarrantyClaim', { id: 'new', jobId: j.id })}><Text style={styles.smallText}>{`+ ${t('yd.newClaim')}`}</Text></TouchableOpacity> : null}
            </View>
          ) : null}
          {cost ? (
            <View>
              <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm, flexWrap: 'wrap' }]}>
                <View>
                  <Text style={styles.sub}>{t('yd.final', { cur: cur ?? '' })}</Text>
                  {input(cost.final, (v) => setCost({ ...cost, final: v }), t('yd.final', { cur: cur ?? '' }), { width: 150, kb: 'decimal-pad' })}
                </View>
                <View>
                  <Text style={styles.sub}>{t('yd.invoice')}</Text>
                  {input(cost.invoice, (v) => setCost({ ...cost, invoice: v }), t('yd.invoice'), { width: 180 })}
                </View>
              </View>
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={() => void saveCost()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setCost(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      {claims.length ? (
        <>
          <Label style={{ marginTop: SIZES.md }}>{t('yd.claims')}</Label>
          {claims.map((c) => (
            <TouchableOpacity key={c.id} style={styles.item} onPress={() => nav.navigate('WarrantyClaim', { id: c.id })}>
              <Text style={styles.name}>{`${c.no} · ${c.title}`}</Text>
              <Text style={styles.sub}>{`${uiDate(c.found)} · ${tk(`yd.cst.${claimStage(c)}`)}`}</Text>
            </TouchableOpacity>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
