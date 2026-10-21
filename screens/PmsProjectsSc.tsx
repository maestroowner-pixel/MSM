// ===================================
// Projects — a yard period, a dry dock: jobs the Master defers to one common
// date (TM Master's "postpone to project"). The list of projects with how many
// jobs wait in each; a new one (the Master or the superintendent); and, as the
// `PmsProject` route, one project with its yard list to print.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as XLSX from 'xlsx';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { PmsProject } from '../types/pms';
import { personName, plansPms, PLAN_LOCKED } from '../types/role';
import { projectJobs, yardList } from '../services/pmsProjects';
import { exportPmsHistory } from '../services/pmsHistoryReport';
import { vesselHeader } from '../services/export';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tn, useT } from '../utils/i18n';

export default function PmsProjectsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { pmsProjects, pmsJobs, machines, pmsDeferrals, pmsDone, saveRow } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', dueDate: '', description: '' });

  const create = async () => {
    if (!canPlan) return Alert.alert(t('prj.titles'), PLAN_LOCKED);
    if (!f.name.trim() || !f.dueDate) return Alert.alert(t('prj.title'), t('prj.needName'));
    const now = Date.now();
    const p: PmsProject = { id: uid('prj'), name: f.name.trim(), dueDate: f.dueDate, ...(f.description.trim() ? { description: f.description.trim() } : {}), createdBy: sync.me ? personName(sync.me) : 'Master', createdAt: now, updatedAt: now };
    await saveRow(storage.PMS_PROJECTS_KEY, p);
    setAdding(false);
    setF({ name: '', dueDate: '', description: '' });
    playSuccessSound();
  };

  const list = [...pmsProjects].sort((a, b) => Number(!!a.closedAt) - Number(!!b.closedAt) || a.dueDate.localeCompare(b.dueDate));
  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={t('prj.titles')} subtitle={t('prj.sub')} help="Planned maintenance" />
      {canPlan ? (
        adding ? (
          <Card>
            <TextInput style={styles.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder={t('prj.namePh')} placeholderTextColor={COLORS.textLight} />
            <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('prj.plannedFor')} value={f.dueDate} onChange={(v) => setF({ ...f, dueDate: v })} /></View>
            <TextInput style={[styles.input, { minHeight: 60 }]} value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline placeholder={t('prj.descPh')} placeholderTextColor={COLORS.textLight} />
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.btn} onPress={() => void create()}><Text style={styles.btnText}>{t('prj.create')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setAdding(false)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
            </View>
          </Card>
        ) : (
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginBottom: SIZES.md }]} onPress={() => setAdding(true)}><Text style={styles.btnText}>{t('prj.new')}</Text></TouchableOpacity>
        )
      ) : null}
      {list.map((p) => {
        const pj = projectJobs(p, pmsJobs, machines, pmsDeferrals, pmsDone);
        return (
          <TouchableOpacity key={p.id} style={[styles.row, !!p.closedAt && { opacity: 0.6 }]} onPress={() => nav.navigate('PmsProject', { id: p.id })} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{p.name}</Text>
              <Text style={styles.sub}>{`${formatDate(p.dueDate)} · ${t('prj.toDo', { n: pj.pending.length })} · ${t('prj.doneN', { n: pj.done.length })}${p.closedAt ? ` · ${t('prj.closed')}` : ''}`}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </TouchableOpacity>
        );
      })}
      {!list.length ? <Text style={styles.sub}>{t('prj.empty')}</Text> : null}
    </Screen>
  );
}

export function PmsProjectSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { pmsProjects, pmsJobs, machines, pmsDeferrals, pmsDone, saveRow, vessel } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);
  const p = pmsProjects.find((x) => x.id === route.params?.id);
  const [saved, setSaved] = useState<string | null>(null);
  if (!p) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>{t('prj.notHere')}</Text>
      </Screen>
    );
  }
  const pj = projectJobs(p, pmsJobs, machines, pmsDeferrals, pmsDone);
  const list = yardList(p, pj, todayIso());
  const stem = `Yard list ${p.name}`;
  const pdf = async () => {
    try {
      const w = await exportPmsHistory('Yard list', stem, vessel, [list]);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('prj.yardList'), String(e?.message ?? e));
    }
  };
  const excel = async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`Yard list — ${p.name}`], [vesselHeader(vessel)], list.facts, [], list.tables[0].head, ...list.tables[0].rows]), 'To be done');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([list.tables[1].head, ...list.tables[1].rows]), 'Done');
    const name = `${stem.replace(/[\\/:*?"<>|]+/g, ' ')}.xlsx`;
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (onWeb) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const w = await saveFileWeb(new Blob([bytes], { type: mime }), name, 'reports');
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
      return;
    }
    await deliverFile(name, b64, true, mime);
  };
  const close = () =>
    Alert.alert(t('prj.closeQ'), t('prj.closeBody', { n: pj.pending.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.close'), onPress: () => void saveRow(storage.PMS_PROJECTS_KEY, { ...p, closedAt: Date.now(), updatedAt: Date.now() }) },
    ]);

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={p.name} subtitle={`${t('prj.planned', { date: formatDate(p.dueDate) })}${p.description ? ` · ${p.description}` : ''}${p.closedAt ? ` · ${t('prj.closed')}` : ''}`} help="Planned maintenance" />
      <Label>{t('prj.toBeDone', { n: pj.pending.length })}</Label>
      {pj.pending.map(({ job, machine, deferral }) => (
        <TouchableOpacity key={job.id} style={styles.row} onPress={() => nav.navigate('PmsJob', { id: job.id })} activeOpacity={0.7}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{`${machine.critical ? '⚑ ' : ''}${job.title}`}</Text>
            <Text style={styles.sub} numberOfLines={2}>{[machine.name, job.classJob || machine.classItem ? 'CLASS' : null, deferral.reason].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
      {!pj.pending.length ? <Text style={styles.sub}>{t('prj.nothing')}</Text> : null}
      {pj.done.length ? <Label>{t('prj.doneHead', { n: pj.done.length })}</Label> : null}
      {pj.done.map(({ done }) => (
        <View key={done.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{`✓ ${done.jobTitle}`}</Text>
            <Text style={styles.sub}>{`${done.machineName} · ${formatDate(done.date)} · ${done.byRank ? `${done.by} (${done.byRank})` : done.by}`}</Text>
          </View>
        </View>
      ))}
      <View style={[styles.btnRow, { flexWrap: 'wrap' }]}>
        <TouchableOpacity style={styles.btn} onPress={() => void pdf()}><Text style={styles.btnText}>{t('prj.yardPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void excel()}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
        {canPlan && !p.closedAt ? <TouchableOpacity onPress={close}><Text style={[styles.link, { color: COLORS.danger }]}>{t('prj.close')}</Text></TouchableOpacity> : null}
        {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
      </View>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs },
    title: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '700' },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    chev: { fontSize: 22, color: COLORS.textLight },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm, textAlignVertical: 'top' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    link: { color: COLORS.primary, fontWeight: '700' },
  });
