// ===================================
// A defect on machinery (ISM 10.1) — raised from the machine (or from a job
// done, in PmsJobSc), categorised safety-critical / class-affecting /
// operational, with photos; closed by an officer or the Master with what was
// done, signed. Never deleted; a closed defect stays in the machine's history
// and in the survey pack.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { RecordThread } from '../components/RecordThread';
import { DefectAiPanel } from '../components/DefectAiPanel';
import { aiReady } from '../services/ai';
import { defectTitle } from '../services/threads';
import { PhotoPicker } from '../components/PhotoPicker';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { EvidencePhoto } from '../components/EvidencePhoto';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { DEFECT_CATEGORY, DefectCategory, PmsDefect } from '../types/pms';
import { Attachment } from '../types/equipment';
import * as storage from '../services/storage';
import * as photoQueue from '../services/photoQueue';
import { scheduleLabel, todayIso } from '../services/pms';
import { plansPms } from '../types/role';
import { moduleOn } from '../constants/modules';
import { defectStage, needsPhoto, officeInLoop } from '../services/officeCheck';
import { alertWorthy, backOn, closeOut, downtimeDays, isOut, markBack, markOut } from '../services/critEq';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, useT } from '../utils/i18n';

export const categoryColor = (COLORS: Palette, c: DefectCategory) => (c === 'safety' ? COLORS.danger : c === 'class' ? COLORS.warning : COLORS.primary);

export default function PmsDefectSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { pmsDefects, machines, pmsJobs, pmsDone, saveRow, vessel } = useData();
  const sync = useSync();
  // Closing is an officer's or the Master's — the rules say the same.
  const canClose = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';
  // A corrective (one-off) job is part of the plan — the Master's or the superintendent's.
  const canPlan = plansPms(sync.enrolled, sync.role);
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const existing = pmsDefects.find((d) => d.id === route.params?.id);
  const machine = machines.find((m) => m.id === (existing?.machineId ?? route.params?.machineId));

  const [category, setCategory] = useState<DefectCategory>('operational');
  const [description, setDescription] = useState<string>(route.params?.description ?? '');
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [closeNote, setCloseNote] = useState('');
  const [closePhotos, setClosePhotos] = useState<Attachment[]>([]);
  // Verified by the office (services/officeCheck): responsible, awaiting spares, the office's answer.
  const office = moduleOn('officeCheck');
  const [responsible, setResponsible] = useState('');
  const [editResp, setEditResp] = useState<string | null>(null);
  // Critical equipment (services/critEq): downtime on the defect, the office mailed at once.
  const crit = moduleOn('critEq');
  const [outFrom, setOutFrom] = useState<string | null>(null);
  const [backDate, setBackDate] = useState<string | null>(null);

  const queuePhotos = async (rec: { id: string; photos?: Attachment[] }) => {
    if (rec.photos?.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, rec);
  };

  const raise = async () => {
    if (!machine) return;
    if (description.trim().length < 3) return Alert.alert(t('pd.defect'), t('pd.needDesc'));
    if (!signer) return Alert.alert(t('pd.whoReports'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Defect on ${machine.name}` });
    if (!sig) return;
    const now = Date.now();
    const d: PmsDefect = {
      id: uid('dft'), machineId: machine.id, machineName: machine.name, category, description: description.trim(), date: todayIso(),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}),
      ...(photos.length ? { photos } : {}), ...(office && responsible.trim() ? { responsible: responsible.trim() } : {}),
      ...(crit && outFrom ? { outOfService: { from: outFrom, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now } } : {}), updatedAt: now,
    };
    await saveRow(storage.PMS_DEFECTS_KEY, d);
    await queuePhotos(d);
    playSuccessSound();
    goBackOr(nav);
  };

  const close = async () => {
    if (!existing) return;
    if (closeNote.trim().length < 3) return Alert.alert(t('pd.rect'), t('pd.needDone'));
    if (office && needsPhoto(existing) && !closePhotos.length) return Alert.alert(t('pd.rect'), t('oc.needPhoto'));
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Close the defect on ${existing.machineName}` });
    if (!sig) return;
    const now = Date.now();
    const closed = {
      date: todayIso(), note: closeNote.trim(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now,
      ...(sig.proof ? { signedWith: sig.proof } : {}), ...(closePhotos.length ? { photos: closePhotos } : {}),
    };
    const { awaitingSpares: _s, ...rest } = existing;
    await saveRow(storage.PMS_DEFECTS_KEY, { ...rest, ...closeOut(existing, closed.date, { name: signer.name, rank: signer.rank }, now), closed, updatedAt: now });
    // The closing photos travel under their own id so they do not clash with the report's.
    await queuePhotos({ id: `${existing.id}-closed`, photos: closePhotos });
    playSuccessSound();
    goBackOr(nav);
  };

  const work = async (patch: Partial<PmsDefect>, drop?: 'awaitingSpares' | 'responsible') => {
    if (!existing) return;
    const next: PmsDefect = { ...existing, ...patch, updatedAt: Date.now() };
    if (drop) delete next[drop];
    await saveRow(storage.PMS_DEFECTS_KEY, next);
  };

  // Out of service / back in service: an officer's, signed like the rest of the record.
  const downtime = async (back: boolean) => {
    if (!existing) return;
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const date = back ? backDate ?? todayIso() : outFrom ?? todayIso();
    if (back && existing.outOfService && date < existing.outOfService.from) return Alert.alert(t('crq.oos'), t('crq.backBefore'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${back ? 'Back in service' : 'Out of service'}: ${existing.machineName}` });
    if (!sig) return;
    const who = { name: signer.name, rank: signer.rank };
    const now = Date.now();
    await saveRow(storage.PMS_DEFECTS_KEY, back ? markBack(existing, date, who, now) : markOut(existing, date, who, now));
    setOutFrom(null);
    setBackDate(null);
    playSuccessSound();
  };

  const imo = vessel?.imo ?? '';
  const stage = existing ? defectStage(existing) : 'open';
  const inLoop = officeInLoop(pmsDefects);
  const pickerTop = crit && !!existing && !existing.closed && canClose;
  return (
    <Screen scroll>
      <View style={{ alignSelf: 'flex-start', marginBottom: SIZES.sm }}><BackButton onPress={() => goBackOr(nav)} /></View>
      <ScreenTitle title={existing ? t('pd.defect') : t('pd.report')} subtitle={machine?.name ?? existing?.machineName ?? ''} />
      {existing ? (
        <>
          <Card>
            <View style={styles.headRow}>
              <Text style={[styles.cat, { backgroundColor: categoryColor(COLORS, existing.category) }]}>{tk(`pms.defcat.${existing.category}`)}</Text>
              <Text style={[styles.state, { color: existing.closed ? COLORS.success : COLORS.danger }]}>{office ? tk(`oc.stage.${stage}`) : existing.closed ? t('pd.closed') : t('pd.open')}</Text>
            </View>
            <Text style={styles.text}>{existing.description}</Text>
            <Text style={styles.sub}>{[uiDate(existing.date), existing.jobTitle ? t('pd.foundDoing', { job: existing.jobTitle }) : null, existing.byRank ? `${existing.by} (${existing.byRank})` : existing.by].filter(Boolean).join(' · ')}</Text>
            {existing.photos?.length ? (
              <View style={styles.photos}>{existing.photos.map((p) => <EvidencePhoto key={p.id} vessel={imo} inspectionId={existing.id} photo={p} />)}</View>
            ) : null}
          </Card>
          {office && existing.office?.result === 'returned' && !existing.closed ? (
            <Card>
              <Label>{t('oc.returned')}</Label>
              <Text style={styles.text}>{existing.office.note}</Text>
              <Text style={styles.sub}>{`${existing.office.byRank ? `${existing.office.by} (${existing.office.byRank})` : existing.office.by} · ${uiDateTime(existing.office.at)}`}</Text>
            </Card>
          ) : null}
          {office && !existing.closed ? (
            <Card>
              <Label>{t('oc.responsible')}</Label>
              {editResp !== null ? (
                <View style={styles.inline}>
                  <TextInput style={[styles.input, { flex: 1, marginTop: 0 }]} value={editResp} onChangeText={setEditResp} placeholder={t('oc.responsiblePh')} placeholderTextColor={COLORS.textLight} autoFocus />
                  <TouchableOpacity style={styles.smallBtn} onPress={() => { const v = editResp.trim(); setEditResp(null); void work(v ? { responsible: v } : {}, v ? undefined : 'responsible'); }}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity disabled={!canClose} onPress={() => setEditResp(existing.responsible ?? '')}>
                  <Text style={existing.responsible ? styles.text : styles.sub}>{existing.responsible ?? t('oc.noResponsible')}{canClose ? '  ✎' : ''}</Text>
                </TouchableOpacity>
              )}
              <View style={[styles.inline, { marginTop: SIZES.sm }]}>
                <Text style={[styles.text, { flex: 1 }]}>{existing.awaitingSpares ? t('oc.sparesSince', { date: uiDate(existing.awaitingSpares.since) }) : t('oc.spares')}</Text>
                {canClose ? (
                  <TouchableOpacity style={[styles.chip, existing.awaitingSpares && { backgroundColor: COLORS.warning, borderColor: COLORS.warning }]} onPress={() => void (existing.awaitingSpares ? work({}, 'awaitingSpares') : work({ awaitingSpares: { since: todayIso() } }))}>
                    <Text style={[styles.chipText, existing.awaitingSpares && { color: COLORS.textWhite }]}>{existing.awaitingSpares ? t('oc.sparesArrived') : t('oc.sparesMark')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </Card>
          ) : null}
          {/* One signer for downtime and closing — above both, so it is chosen before either button. */}
          {pickerTop && picker ? <View style={{ marginBottom: SIZES.sm }}>{picker}</View> : null}
          {crit && (existing.outOfService || (!existing.closed && canClose)) ? (
            <Card>
              <Label>{t('crq.oos')}</Label>
              {existing.outOfService ? (
                <>
                  <Text style={[styles.text, isOut(existing) && { color: COLORS.danger }]}>
                    {isOut(existing)
                      ? t('crq.outSince', { date: uiDate(existing.outOfService.from), n: downtimeDays(existing, todayIso()) })
                      : t('crq.outWas', { from: uiDate(existing.outOfService.from), to: uiDate(backOn(existing)!), n: downtimeDays(existing, todayIso()) })}
                  </Text>
                  <Text style={styles.sub}>{[existing.outOfService.byRank ? `${existing.outOfService.by} (${existing.outOfService.byRank})` : existing.outOfService.by, existing.outOfService.backBy ? t('crq.backBy', { who: existing.outOfService.backByRank ? `${existing.outOfService.backBy} (${existing.outOfService.backByRank})` : existing.outOfService.backBy }) : null].filter(Boolean).join(' · ')}</Text>
                  {isOut(existing) && canClose ? (
                    <>
                      <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('crq.backOn')} value={backDate ?? todayIso()} onChange={setBackDate} /></View>
                      <TouchableOpacity style={[styles.btn, { marginTop: SIZES.sm, backgroundColor: COLORS.success }]} onPress={() => void downtime(true)}><Text style={styles.btnText}>{t('crq.markBack')}</Text></TouchableOpacity>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.sub}>{t('crq.inService')}</Text>
                  <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('crq.outFrom')} value={outFrom ?? todayIso()} onChange={setOutFrom} /></View>
                  <TouchableOpacity style={[styles.btn, { marginTop: SIZES.sm, backgroundColor: COLORS.danger }]} onPress={() => void downtime(false)}><Text style={styles.btnText}>{t('crq.markOut')}</Text></TouchableOpacity>
                </>
              )}
            </Card>
          ) : null}
          {!existing.closed && canClose && machine && aiReady(sync.enrolled) ? (
            <DefectAiPanel defect={existing} machine={machine} canPlan={canPlan} waited={route.params?.aiDiag} waitedKeys={route.params?.aiKeys} jobId={route.params?.aiJob} />
          ) : null}
          <RecordThread rec="defect" recId={existing.id} title={defectTitle(existing)} />
          {(() => {
            const open = pmsJobs.filter((j) => j.defectId === existing.id);
            const done = pmsDone.filter((d) => d.forDefectId === existing.id);
            if (!open.length && !done.length && (existing.closed || !canPlan)) return null;
            return (
              <Card>
                <Label>{t('pd.corrective')}</Label>
                {open.map((j) => (
                  <TouchableOpacity key={j.id} onPress={() => nav.navigate('PmsJob', { id: j.id })}>
                    <Text style={styles.link}>{`${j.title} · ${scheduleLabel(j)}`}</Text>
                  </TouchableOpacity>
                ))}
                {done.map((d) => (
                  <Text key={d.id} style={styles.text}>{`✓ ${d.jobTitle} — done ${uiDate(d.date)} by ${d.byRank ? `${d.by} (${d.byRank})` : d.by}${d.note ? ` · ${d.note}` : ''}`}</Text>
                ))}
                {!existing.closed && canPlan && !open.length ? (
                  <TouchableOpacity onPress={() => nav.navigate('PmsJob', { id: uid('job'), machineId: existing.machineId, isNew: true, oneOff: true, defectId: existing.id, title: existing.description.slice(0, 80) })}>
                    <Text style={styles.link}>{t('pd.planCorrective')}</Text>
                  </TouchableOpacity>
                ) : null}
                {done.length && !existing.closed ? <Text style={styles.sub}>{t('pd.jobDone')}</Text> : null}
              </Card>
            );
          })()}
          {office && existing.closedBefore?.length ? (
            <Card>
              <Label>{t('oc.history')}</Label>
              {existing.closedBefore.map((c) => (
                <Text key={c.at} style={styles.sub}>{`${uiDate(c.date)} · ${c.byRank ? `${c.by} (${c.byRank})` : c.by}: ${c.note}`}</Text>
              ))}
            </Card>
          ) : null}
          {existing.closed ? (
            <Card>
              <Label>{t('pd.rectified')}</Label>
              <Text style={styles.text}>{existing.closed.note}</Text>
              <Text style={styles.sub}>{`${uiDate(existing.closed.date)} · ${existing.closed.byRank ? `${existing.closed.by} (${existing.closed.byRank})` : existing.closed.by} · signed ${uiDateTime(existing.closed.at)}`}</Text>
              {existing.closed.photos?.length ? (
                <View style={styles.photos}>{existing.closed.photos.map((p) => <EvidencePhoto key={p.id} vessel={imo} inspectionId={`${existing.id}-closed`} photo={p} />)}</View>
              ) : null}
              {office && existing.office?.result === 'verified' ? (
                <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`${t('oc.verifiedBy', { who: existing.office.byRank ? `${existing.office.by} (${existing.office.byRank})` : existing.office.by, when: uiDateTime(existing.office.at) })}${existing.office.note ? ` · ${existing.office.note}` : ''}`}</Text>
              ) : office && inLoop ? (
                <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('oc.awaiting')}</Text>
              ) : null}
            </Card>
          ) : canClose ? (
            <Card>
              <Label>{t('pd.closeHead')}</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={closeNote} onChangeText={setCloseNote} multiline placeholder={t('pd.donePh')} placeholderTextColor={COLORS.textLight} />
              <PhotoPicker photos={closePhotos} onChange={setClosePhotos} hint={office && needsPhoto(existing) ? t('oc.photoRequired') : t('pd.repairPhoto')} />
              {picker && !pickerTop ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
              <TouchableOpacity style={[styles.btn, { marginTop: SIZES.md }]} onPress={() => void close()}><Text style={styles.btnText}>{t('pd.signRect')}</Text></TouchableOpacity>
            </Card>
          ) : (
            <Text style={styles.sub}>{t('pd.officerCloses')}</Text>
          )}
        </>
      ) : (
        <Card>
          <Label>{t('pd.category')}</Label>
          <View style={styles.chips}>
            {(Object.keys(DEFECT_CATEGORY) as DefectCategory[]).map((c) => (
              <TouchableOpacity key={c} style={[styles.chip, category === c && { backgroundColor: categoryColor(COLORS, c), borderColor: categoryColor(COLORS, c) }]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, category === c && { color: COLORS.textWhite }]}>{tk(`pd.cat.${c}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sub}>{t('pd.safetyNote')}</Text>
          <TextInput style={[styles.input, { minHeight: 80 }]} value={description} onChangeText={setDescription} multiline placeholder={t('pd.whatWrong')} placeholderTextColor={COLORS.textLight} />
          <PhotoPicker photos={photos} onChange={setPhotos} hint={t('pd.photo')} />
          {office ? (
            <>
              <Label>{t('oc.responsible')}</Label>
              <TextInput style={styles.input} value={responsible} onChangeText={setResponsible} placeholder={t('oc.responsiblePh')} placeholderTextColor={COLORS.textLight} />
            </>
          ) : null}
          {crit ? (
            <>
              <View style={[styles.inline, { marginTop: SIZES.md }]}>
                <Text style={[styles.text, { flex: 1 }]}>{t('crq.oosQ')}</Text>
                <TouchableOpacity style={[styles.chip, outFrom !== null && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]} onPress={() => setOutFrom(outFrom === null ? todayIso() : null)}>
                  <Text style={[styles.chipText, outFrom !== null && { color: COLORS.textWhite }]}>{outFrom !== null ? t('crq.oosYes') : t('crq.oosNo')}</Text>
                </TouchableOpacity>
              </View>
              {outFrom !== null ? <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('crq.outFrom')} value={outFrom} onChange={setOutFrom} /></View> : null}
              {machine && alertWorthy({ category }, machine) ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('crq.officeMailed')}</Text> : null}
            </>
          ) : null}
          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <TouchableOpacity style={[styles.btn, { marginTop: SIZES.md }]} onPress={() => void raise()}><Text style={styles.btnText}>{t('pd.signReport')}</Text></TouchableOpacity>
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.sm },
    cat: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small, paddingHorizontal: SIZES.sm, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
    state: { fontWeight: '900' },
    text: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4 },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm, textAlignVertical: 'top' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 12, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    inline: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    smallBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body, marginTop: SIZES.xs },
  });
