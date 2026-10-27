// ===================================
// One yard period (a PMS project, types/pms.ts, grown by types/yard.ts): the
// yard, the dates, the budget; the work list by department with each job's
// stage and price; what is still to be put on it — open defects and the PMS
// jobs deferred to this project; and its papers — the specification for the
// yards (PDF, and Excel they price and send back), the progress report.
// The Master or the superintendent sets the project up; officers keep the list.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { personName, plansPms, PLAN_LOCKED, roleAtLeast } from '../types/role';
import { PmsProject } from '../types/pms';
import { PROJECT_KINDS, ProjectKind, YardJob, YardStage } from '../types/yard';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { projectJobs } from '../services/pmsProjects';
import { pickSheetRows } from '../services/sheetFiles';
import {
  byDept, defectsToAdd, jobFromDefect, jobFromPms, jobNo, jobStage, jobsOf, money, nextJobNo, pmsToAdd, projectPhase, projectTotals, readSpecPrices, yardDept,
} from '../services/yard';
import { exportProgress, exportSpecification, specSheet } from '../services/yardReport';
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
  name: string;
  kind: ProjectKind;
  yard: string;
  place: string;
  dueDate: string;
  endDate: string;
  startedOn: string;
  finishedOn: string;
  currency: string;
  budget: string;
  description: string;
}
const toDraft = (p?: PmsProject): Draft => ({
  name: p?.name ?? '', kind: p?.kind ?? 'yard', yard: p?.yard ?? '', place: p?.place ?? '', dueDate: p?.dueDate ?? '', endDate: p?.endDate ?? '',
  startedOn: p?.startedOn ?? '', finishedOn: p?.finishedOn ?? '', currency: p?.currency ?? 'EUR', budget: str(p?.budget), description: p?.description ?? '',
});

type Filter = 'open' | 'all' | 'accepted' | 'cancelled';

export default function YardProjectSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { pmsProjects, pmsJobs, machines, pmsDeferrals, pmsDone, pmsDefects, yardJobs, suppliers, saveRow, vessel } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);
  const keeps = canPlan || !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const me = sync.me ? personName(sync.me) : 'Master';
  const isNew = route.params?.id === 'new';
  const stored = pmsProjects.find((p) => p.id === route.params?.id);
  const [draft, setDraft] = useState<Draft | null>(() => (isNew ? toDraft() : null));
  const [filter, setFilter] = useState<Filter>('open');
  const [adding, setAdding] = useState<'defects' | 'pms' | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string | null>(null);
  const today = todayIso();
  const back = () => goBackOr(nav, 'Yard');

  if (!draft && !stored) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('prj.notHere')}</Text>
      </Screen>
    );
  }
  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  // ---- edit ----
  if (draft) {
    const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
    const yardHints = draft.yard.trim().length >= 1
      ? suppliers.filter((s) => s.name.toLowerCase().includes(draft.yard.trim().toLowerCase()) && s.name !== draft.yard).slice(0, 5)
      : [];
    const save = async () => {
      if (!canPlan) return Alert.alert(t('prj.title'), PLAN_LOCKED);
      if (!draft.name.trim() || !draft.dueDate) return Alert.alert(t('prj.title'), t('prj.needName'));
      if (draft.endDate && draft.endDate < draft.dueDate) return Alert.alert(t('prj.title'), t('yd.endBeforeStart'));
      if (draft.finishedOn && draft.startedOn && draft.finishedOn < draft.startedOn) return Alert.alert(t('prj.title'), t('yd.endBeforeStart'));
      const now = Date.now();
      const base: PmsProject = stored ?? { id: uid('prj'), name: '', dueDate: '', createdBy: me, createdAt: now, updatedAt: now };
      const p: PmsProject = {
        ...base,
        name: draft.name.trim(), dueDate: draft.dueDate, kind: draft.kind,
        yard: draft.yard.trim() || undefined, place: draft.place.trim() || undefined, endDate: draft.endDate || undefined,
        startedOn: draft.startedOn || undefined, finishedOn: draft.finishedOn || undefined,
        currency: draft.currency.trim().toUpperCase() || undefined, budget: num(draft.budget), description: draft.description.trim() || undefined,
        updatedAt: now,
      };
      // Firestore takes no undefined — drop the cleared fields.
      const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as PmsProject;
      await saveRow(storage.PMS_PROJECTS_KEY, clean);
      playSuccessSound();
      if (isNew) nav.replace('YardProject', { id: clean.id });
      else setDraft(null);
    };
    const input = (value: string, onChange: (v: string) => void, label: string, opts: { width?: number; kb?: any; placeholder?: string; multiline?: boolean } = {}) => (
      <TextInput style={[styles.input, opts.width ? { width: opts.width } : null, opts.multiline ? { minHeight: 60 } : null]} value={value} onChangeText={onChange} keyboardType={opts.kb} placeholder={opts.placeholder} placeholderTextColor={COLORS.textLight} accessibilityLabel={label} multiline={opts.multiline} />
    );
    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setDraft(null))} />
        <ScreenTitle title={isNew ? t('yd.newProject') : stored!.name} subtitle={t('yd.title')} help="Yard periods and warranty" />
        <Card>
          <Text style={styles.sub}>{t('yd.projectName')}</Text>
          {input(draft.name, (v) => set({ name: v }), t('yd.projectName'), { placeholder: t('prj.namePh') })}
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.kind')}</Text>
          <View style={styles.chips}>{PROJECT_KINDS.map((k) => chip(draft.kind === k, tk(`yd.kind.${k}`), () => set({ kind: k }), k))}</View>
          <Text style={styles.sub}>{t('yd.yard')}</Text>
          {input(draft.yard, (v) => set({ yard: v }), t('yd.yard'), { placeholder: 'MB92 · Lürssen · Pendennis · Amico' })}
          {yardHints.length ? <View style={styles.chips}>{yardHints.map((s) => chip(false, s.name, () => set({ yard: s.name }), s.id))}</View> : null}
          <Text style={styles.sub}>{t('yd.place')}</Text>
          {input(draft.place, (v) => set({ place: v }), t('yd.place'), { placeholder: 'Barcelona' })}
          <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('yd.plannedFrom')} value={draft.dueDate} onChange={(v) => set({ dueDate: v })} /></View>
          <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('yd.plannedTo')} value={draft.endDate} onChange={(v) => set({ endDate: v })} onClear={() => set({ endDate: '' })} /></View>
          {!isNew ? (
            <>
              <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('yd.arrived')} value={draft.startedOn} onChange={(v) => set({ startedOn: v })} onClear={() => set({ startedOn: '' })} /></View>
              <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('yd.redelivered')} value={draft.finishedOn} onChange={(v) => set({ finishedOn: v })} onClear={() => set({ finishedOn: '' })} /></View>
            </>
          ) : null}
          <View style={[styles.row, { alignItems: 'flex-end', gap: SIZES.sm }]}>
            <View>
              <Text style={styles.sub}>{t('yd.currency')}</Text>
              {input(draft.currency, (v) => set({ currency: v }), t('yd.currency'), { width: 90, placeholder: 'EUR' })}
            </View>
            <View>
              <Text style={styles.sub}>{t('yd.budget')}</Text>
              {input(draft.budget, (v) => set({ budget: v }), t('yd.budget'), { width: 160, kb: 'decimal-pad' })}
            </View>
          </View>
          <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('yd.notes')}</Text>
          {input(draft.description, (v) => set({ description: v }), t('yd.notes'), { placeholder: t('prj.descPh'), multiline: true })}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew ? back() : setDraft(null))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      </Screen>
    );
  }

  // ---- view ----
  const p = stored!;
  const list = jobsOf(p.id, yardJobs);
  const tot = projectTotals(p, yardJobs);
  const phase = projectPhase(p);
  const pj = projectJobs(p, pmsJobs, machines, pmsDeferrals, pmsDone);
  const pmsLeft = pmsToAdd(pj.pending, p.id, yardJobs);
  const defectsLeft = defectsToAdd(pmsDefects, yardJobs);
  const cur = p.currency;
  const shown = list.filter((j) => {
    const s = jobStage(j);
    return filter === 'all' || (filter === 'open' ? s !== 'accepted' && s !== 'cancelled' : s === filter);
  });
  const stageColor = (s: YardStage) => (s === 'accepted' ? COLORS.success : s === 'done' ? COLORS.primary : s === 'progress' ? COLORS.warning : s === 'cancelled' ? COLORS.textLight : COLORS.textDark);
  const out = (w: string | null | void) => { if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w })); };
  const fail = (e: any) => Alert.alert(p.name, String(e?.message ?? e));

  const stamp = async (patch: Partial<PmsProject>) => {
    if (!canPlan) return Alert.alert(t('prj.title'), PLAN_LOCKED);
    await saveRow(storage.PMS_PROJECTS_KEY, { ...p, ...patch, updatedAt: Date.now() });
    playSuccessSound();
  };
  const close = () =>
    Alert.alert(t('prj.closeQ'), t('yd.closeBody', { n: tot.live - tot.count.accepted }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.close'), onPress: () => void stamp({ closedAt: Date.now(), ...(p.finishedOn ? {} : { finishedOn: today }) }) },
    ]);

  const addPicked = async () => {
    let no = nextJobNo(p.id, yardJobs);
    const now = Date.now();
    if (adding === 'defects') {
      for (const d of defectsLeft.filter((x) => picked.has(x.id))) {
        const m = machines.find((x) => x.id === d.machineId);
        await saveRow(storage.YARD_JOBS_KEY, jobFromDefect(d, p.id, no++, yardDept(m), me, now));
      }
    } else if (adding === 'pms') {
      for (const x of pmsLeft.filter((r) => picked.has(r.job.id))) await saveRow(storage.YARD_JOBS_KEY, jobFromPms(x.job, x.machine, p.id, no++, me, now));
    }
    playSuccessSound();
    setAdding(null);
    setPicked(new Set());
  };
  const toggle = (id: string) => { const n = new Set(picked); if (n.has(id)) n.delete(id); else n.add(id); setPicked(n); };

  const readPrices = async () => {
    try {
      const f = await pickSheetRows();
      if (!f) return;
      const { prices, error } = readSpecPrices(f.rows);
      if (error) return Alert.alert(t('yd.readPrices'), tk(error));
      let set = 0, skipped = 0, unknown = 0;
      for (const x of prices) {
        const j = list.find((y) => y.id === x.jobId);
        if (!j) { unknown++; continue; }
        // A signed-off job keeps the price it was accepted at; a cancelled one has none.
        if (j.accepted || j.cancelled) { skipped++; continue; }
        const notes = x.remark && !(j.notes ?? '').includes(x.remark) ? [j.notes, `Yard: ${x.remark}`].filter(Boolean).join('\n') : j.notes;
        await saveRow(storage.YARD_JOBS_KEY, { ...j, ...(x.price != null ? { quoted: x.price } : {}), ...(notes ? { notes } : {}), updatedAt: Date.now() });
        set++;
      }
      playSuccessSound();
      Alert.alert(t('yd.readPrices'), [t('yd.pricesRead', { n: set }), skipped ? t('yd.pricesSkipped', { n: skipped }) : '', unknown ? t('yd.pricesUnknown', { n: unknown }) : ''].filter(Boolean).join('\n'));
    } catch (e: any) {
      fail(e);
    }
  };

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={p.name} subtitle={[p.kind ? tk(`yd.kind.${p.kind}`) : t('yd.kind.yard'), tk(`yd.phase.${phase}`)].join(' · ')} help="Yard periods and warranty" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <Text style={styles.name}>{[p.yard ?? '', p.place ?? ''].filter(Boolean).join(', ') || t('yd.noYard')}</Text>
        <Text style={styles.sub}>{[
          t('yd.planned', { from: uiDate(p.dueDate), to: p.endDate ? uiDate(p.endDate) : '…' }),
          p.startedOn ? t('yd.inYardFrom', { from: uiDate(p.startedOn), to: p.finishedOn ? uiDate(p.finishedOn) : '…' }) : '',
        ].filter(Boolean).join(' · ')}</Text>
        {p.description ? <Text style={styles.sub}>{p.description}</Text> : null}
        <Text style={[styles.body, { marginTop: SIZES.xs }]}>{[
          t('yd.quotedSum', { v: money(tot.quoted, cur) || '0' }),
          t('yd.finalSum', { v: money(tot.final, cur) || '0' }),
          t('yd.forecastSum', { v: money(tot.forecast, cur) || '0' }),
        ].join(' · ')}</Text>
        {p.budget != null ? (
          <Text style={[styles.sub, { color: tot.budgetLeft! < 0 ? COLORS.danger : COLORS.success, fontWeight: '700' }]}>
            {tot.budgetLeft! < 0 ? t('yd.overBy', { v: money(-tot.budgetLeft!, cur), b: money(p.budget, cur) }) : t('yd.leftOf', { v: money(tot.budgetLeft, cur), b: money(p.budget, cur) })}
          </Text>
        ) : null}
        <Text style={styles.sub}>{[
          t('yd.nJobs', { n: tot.live }),
          `${tk('yd.st.planned')} ${tot.count.planned}`, `${tk('yd.st.progress')} ${tot.count.progress}`, `${tk('yd.st.done')} ${tot.count.done}`, `${tk('yd.st.accepted')} ${tot.count.accepted}`,
          tot.unpriced ? t('yd.unpriced', { n: tot.unpriced }) : '',
        ].filter(Boolean).join(' · ')}</Text>
      </Card>

      <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
        {keeps && !p.closedAt ? <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('YardJob', { id: 'new', projectId: p.id })}><Text style={styles.btnText}>{`+ ${t('yd.addJob')}`}</Text></TouchableOpacity> : null}
        {keeps && !p.closedAt && defectsLeft.length ? <TouchableOpacity style={styles.small} onPress={() => { setAdding(adding === 'defects' ? null : 'defects'); setPicked(new Set()); }}><Text style={styles.smallText}>{t('yd.addDefects', { n: defectsLeft.length })}</Text></TouchableOpacity> : null}
        {keeps && !p.closedAt && pmsLeft.length ? <TouchableOpacity style={styles.small} onPress={() => { setAdding(adding === 'pms' ? null : 'pms'); setPicked(new Set(pmsLeft.map((x) => x.job.id))); }}><Text style={styles.smallText}>{t('yd.addPms', { n: pmsLeft.length })}</Text></TouchableOpacity> : null}
      </View>

      {adding ? (
        <Card>
          <Label>{adding === 'defects' ? t('yd.pickDefects') : t('yd.pickPms')}</Label>
          {adding === 'defects'
            ? defectsLeft.map((d) => (
                <TouchableOpacity key={d.id} onPress={() => toggle(d.id)} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 6 }}>
                  <Text style={[styles.name, { color: picked.has(d.id) ? COLORS.primary : COLORS.textLight }]}>{picked.has(d.id) ? '☑' : '☐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.body}>{d.description}</Text>
                    <Text style={styles.sub}>{[d.machineName, tk(`pd.cat.${d.category}`), uiDate(d.date)].join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              ))
            : pmsLeft.map(({ job, machine, deferral }) => (
                <TouchableOpacity key={job.id} onPress={() => toggle(job.id)} style={{ flexDirection: 'row', gap: SIZES.sm, paddingVertical: 6 }}>
                  <Text style={[styles.name, { color: picked.has(job.id) ? COLORS.primary : COLORS.textLight }]}>{picked.has(job.id) ? '☑' : '☐'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.body}>{job.title}</Text>
                    <Text style={styles.sub}>{[machine.name, deferral.reason].filter(Boolean).join(' · ')}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, !picked.size && { opacity: 0.5 }]} disabled={!picked.size} onPress={() => void addPicked()}><Text style={styles.btnText}>{t('yd.addN', { n: picked.size })}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      <View style={[styles.row, { gap: SIZES.xs, flexWrap: 'wrap' }]}>
        {list.length ? <TouchableOpacity style={styles.small} onPress={() => exportSpecification(p, yardJobs, today, vessel).then(out).catch(fail)}><Text style={styles.smallText}>{t('yd.specPdf')}</Text></TouchableOpacity> : null}
        {list.length ? <TouchableOpacity style={styles.small} onPress={() => specSheet(p, yardJobs, vessel).then(out).catch(fail)}><Text style={styles.smallText}>{t('yd.specExcel')}</Text></TouchableOpacity> : null}
        {list.length && keeps ? <TouchableOpacity style={styles.small} onPress={() => void readPrices()}><Text style={styles.smallText}>{t('yd.readPrices')}</Text></TouchableOpacity> : null}
        {list.length ? <TouchableOpacity style={styles.small} onPress={() => exportProgress(p, yardJobs, today, vessel).then(out).catch(fail)}><Text style={styles.smallText}>{t('yd.progressPdf')}</Text></TouchableOpacity> : null}
      </View>

      <Label style={{ marginTop: SIZES.md }}>{t('yd.workList')}</Label>
      <View style={styles.chips}>
        {(['open', 'all', 'accepted', 'cancelled'] as Filter[]).map((f) => chip(filter === f, tk(`yd.f.${f}`), () => setFilter(f), f))}
      </View>
      {!list.length ? <Text style={styles.sub}>{keeps ? t('yd.emptyList') : t('yd.emptyListCrew')}</Text> : null}
      {list.length && !shown.length ? <Text style={styles.sub}>{t('yd.noneHere')}</Text> : null}
      {byDept(shown).map(({ dept, jobs }) => (
        <View key={dept}>
          <Text style={[styles.sub, { fontWeight: '800', marginTop: SIZES.sm }]}>{tk(`yd.dept.${dept}`)}</Text>
          {jobs.map((j: YardJob) => {
            const s = jobStage(j);
            return (
              <TouchableOpacity key={j.id} style={[styles.item, { borderLeftColor: stageColor(s) }, s === 'cancelled' && { opacity: 0.55 }]} onPress={() => nav.navigate('YardJob', { id: j.id })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{`${jobNo(j)} ${j.title}`}</Text>
                    <Text style={styles.sub}>{[j.machineName ?? '', j.by !== 'yard' ? `${tk(`yd.by.${j.by}`)}${j.contractor ? ` ${j.contractor}` : ''}` : '', j.classItem ? 'CLASS' : '', j.defectId ? t('yd.fromDefect') : '', j.pmsJobId ? 'PMS' : ''].filter(Boolean).join(' · ')}</Text>
                    {j.quoted != null || j.final != null ? <Text style={styles.sub}>{[j.quoted != null ? t('yd.quotedV', { v: money(j.quoted, cur) }) : '', j.final != null ? t('yd.finalV', { v: money(j.final, cur) }) : ''].filter(Boolean).join(' · ')}</Text> : null}
                  </View>
                  <Text style={[styles.badge, { color: stageColor(s), borderColor: stageColor(s) }]}>{tk(`yd.st.${s}`)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {pj.pending.length || pj.done.length ? (
        <TouchableOpacity onPress={() => nav.navigate('PmsProject', { id: p.id })} style={{ marginTop: SIZES.md }}>
          <Text style={styles.link}>{`${t('yd.pmsDeferred', { n: pj.pending.length, d: pj.done.length })} ›`}</Text>
        </TouchableOpacity>
      ) : null}

      {canPlan ? (
        <View style={[styles.row, { gap: SIZES.md, flexWrap: 'wrap', marginTop: SIZES.lg }]}>
          <TouchableOpacity style={styles.small} onPress={() => setDraft(toDraft(p))}><Text style={styles.smallText}>{t('common.edit')}</Text></TouchableOpacity>
          {!p.closedAt && !p.startedOn ? <TouchableOpacity style={styles.small} onPress={() => void stamp({ startedOn: today })}><Text style={styles.smallText}>{t('yd.arrivedToday')}</Text></TouchableOpacity> : null}
          {!p.closedAt && p.startedOn && !p.finishedOn ? <TouchableOpacity style={styles.small} onPress={() => void stamp({ finishedOn: today })}><Text style={styles.smallText}>{t('yd.redeliveredToday')}</Text></TouchableOpacity> : null}
          {!p.closedAt ? <TouchableOpacity onPress={close}><Text style={[styles.link, { color: COLORS.danger }]}>{t('prj.close')}</Text></TouchableOpacity> : null}
        </View>
      ) : null}
    </Screen>
  );
}
