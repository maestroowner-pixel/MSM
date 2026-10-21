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
import { PhotoPicker } from '../components/PhotoPicker';
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
import { scheduleText, todayIso } from '../services/pms';
import { plansPms } from '../types/role';
import { formatDate, formatDateTime } from '../utils/dates';
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
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [closeNote, setCloseNote] = useState('');
  const [closePhotos, setClosePhotos] = useState<Attachment[]>([]);

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
      ...(photos.length ? { photos } : {}), updatedAt: now,
    };
    await saveRow(storage.PMS_DEFECTS_KEY, d);
    await queuePhotos(d);
    playSuccessSound();
    goBackOr(nav);
  };

  const close = async () => {
    if (!existing) return;
    if (closeNote.trim().length < 3) return Alert.alert(t('pd.rect'), t('pd.needDone'));
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Close the defect on ${existing.machineName}` });
    if (!sig) return;
    const now = Date.now();
    const closed = {
      date: todayIso(), note: closeNote.trim(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now,
      ...(sig.proof ? { signedWith: sig.proof } : {}), ...(closePhotos.length ? { photos: closePhotos } : {}),
    };
    await saveRow(storage.PMS_DEFECTS_KEY, { ...existing, closed, updatedAt: now });
    // The closing photos travel under their own id so they do not clash with the report's.
    await queuePhotos({ id: `${existing.id}-closed`, photos: closePhotos });
    playSuccessSound();
    goBackOr(nav);
  };

  const imo = vessel?.imo ?? '';
  return (
    <Screen scroll>
      <View style={{ alignSelf: 'flex-start', marginBottom: SIZES.sm }}><BackButton onPress={() => goBackOr(nav)} /></View>
      <ScreenTitle title={existing ? t('pd.defect') : t('pd.report')} subtitle={machine?.name ?? existing?.machineName ?? ''} />
      {existing ? (
        <>
          <Card>
            <View style={styles.headRow}>
              <Text style={[styles.cat, { backgroundColor: categoryColor(COLORS, existing.category) }]}>{DEFECT_CATEGORY[existing.category]}</Text>
              <Text style={[styles.state, { color: existing.closed ? COLORS.success : COLORS.danger }]}>{existing.closed ? t('pd.closed') : t('pd.open')}</Text>
            </View>
            <Text style={styles.text}>{existing.description}</Text>
            <Text style={styles.sub}>{[formatDate(existing.date), existing.jobTitle ? t('pd.foundDoing', { job: existing.jobTitle }) : null, existing.byRank ? `${existing.by} (${existing.byRank})` : existing.by].filter(Boolean).join(' · ')}</Text>
            {existing.photos?.length ? (
              <View style={styles.photos}>{existing.photos.map((p) => <EvidencePhoto key={p.id} vessel={imo} inspectionId={existing.id} photo={p} />)}</View>
            ) : null}
          </Card>
          {(() => {
            const open = pmsJobs.filter((j) => j.defectId === existing.id);
            const done = pmsDone.filter((d) => d.forDefectId === existing.id);
            if (!open.length && !done.length && (existing.closed || !canPlan)) return null;
            return (
              <Card>
                <Label>{t('pd.corrective')}</Label>
                {open.map((j) => (
                  <TouchableOpacity key={j.id} onPress={() => nav.navigate('PmsJob', { id: j.id })}>
                    <Text style={styles.link}>{`${j.title} · ${scheduleText(j)}`}</Text>
                  </TouchableOpacity>
                ))}
                {done.map((d) => (
                  <Text key={d.id} style={styles.text}>{`✓ ${d.jobTitle} — done ${formatDate(d.date)} by ${d.byRank ? `${d.by} (${d.byRank})` : d.by}${d.note ? ` · ${d.note}` : ''}`}</Text>
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
          {existing.closed ? (
            <Card>
              <Label>{t('pd.rectified')}</Label>
              <Text style={styles.text}>{existing.closed.note}</Text>
              <Text style={styles.sub}>{`${formatDate(existing.closed.date)} · ${existing.closed.byRank ? `${existing.closed.by} (${existing.closed.byRank})` : existing.closed.by} · signed ${formatDateTime(existing.closed.at)}`}</Text>
              {existing.closed.photos?.length ? (
                <View style={styles.photos}>{existing.closed.photos.map((p) => <EvidencePhoto key={p.id} vessel={imo} inspectionId={`${existing.id}-closed`} photo={p} />)}</View>
              ) : null}
            </Card>
          ) : canClose ? (
            <Card>
              <Label>{t('pd.closeHead')}</Label>
              <TextInput style={[styles.input, { minHeight: 70 }]} value={closeNote} onChangeText={setCloseNote} multiline placeholder={t('pd.donePh')} placeholderTextColor={COLORS.textLight} />
              <PhotoPicker photos={closePhotos} onChange={setClosePhotos} hint={t('pd.repairPhoto')} />
              {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
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
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body, marginTop: SIZES.xs },
  });
