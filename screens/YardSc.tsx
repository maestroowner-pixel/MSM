// ===================================
// Yard & warranty — the vessel's yard periods (the PMS projects, types/pms.ts)
// with how far each work list has got and what it costs, then what is under
// warranty from them (the soonest to run out first) and the warranty claims.
// The Master or the superintendent opens a project; the officers keep the work
// lists (YardProjectSc) and the claims (WarrantyClaimSc).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { plansPms, roleAtLeast } from '../types/role';
import { todayIso } from '../services/pms';
import { claimCover, claimStage, coverList, jobNo, money, projectPhase, projectTotals } from '../services/yard';
import { exportWarranty } from '../services/yardReport';
import { uiDate } from '../utils/dates';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

export default function YardSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { pmsProjects, yardJobs, warrantyClaims, vessel } = useData();
  const sync = useSync();
  const canPlan = plansPms(sync.enrolled, sync.role);
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [saved, setSaved] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const today = todayIso();

  const projects = useMemo(() => [...pmsProjects].sort((a, b) => Number(!!a.closedAt) - Number(!!b.closedAt) || (a.closedAt ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate))), [pmsProjects]);
  const open = projects.filter((p) => !p.closedAt);
  const closed = projects.filter((p) => p.closedAt);
  const cover = useMemo(() => coverList(yardJobs, pmsProjects, warrantyClaims, today), [yardJobs, pmsProjects, warrantyClaims, today]);
  const claims = useMemo(() => [...warrantyClaims].sort((a, b) => Number(!!a.closed) - Number(!!b.closed) || b.found.localeCompare(a.found)), [warrantyClaims]);
  const inYard = open.filter((p) => projectPhase(p) === 'inYard').length;
  const openJobs = open.reduce((n, p) => { const x = projectTotals(p, yardJobs); return n + x.live - x.count.accepted; }, 0);
  const expiring = cover.filter((r) => r.state === 'expiring').length;
  const openClaims = warrantyClaims.filter((c) => !c.closed).length;

  const pdf = async () => {
    try {
      const w = await exportWarranty(cover, warrantyClaims, yardJobs, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('yd.title'), String(e?.message ?? e));
    }
  };

  const Stat = ({ v, label, color }: { v: number; label: string; color: string }) => (
    <View style={{ alignItems: 'center', minWidth: 70 }}>
      <Text style={[styles.name, { fontSize: 22, color: v ? color : COLORS.textDark }]}>{v}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
  const phaseColor = (ph: string) => (ph === 'inYard' ? COLORS.warning : ph === 'planning' ? COLORS.primary : COLORS.textLight);
  const stateColor = (s: string) => (s === 'expiring' ? COLORS.warning : s === 'expired' ? COLORS.textLight : COLORS.success);
  const stageColor = (s: string) => (s === 'closed' ? COLORS.textLight : s === 'answered' ? COLORS.primary : s === 'submitted' ? COLORS.warning : COLORS.danger);

  const projectRow = (p: (typeof projects)[number]) => {
    const tot = projectTotals(p, yardJobs);
    const ph = projectPhase(p);
    return (
      <TouchableOpacity key={p.id} style={[styles.item, { borderLeftColor: phaseColor(ph) }, !!p.closedAt && { opacity: 0.6 }]} onPress={() => nav.navigate('YardProject', { id: p.id })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
          <MciIcon name="hammer-wrench" size={20} color={phaseColor(ph)} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.sub}>{[p.kind ? tk(`yd.kind.${p.kind}`) : '', p.yard ?? '', p.endDate ? `${uiDate(p.dueDate)} – ${uiDate(p.endDate)}` : uiDate(p.dueDate)].filter(Boolean).join(' · ')}</Text>
            <Text style={styles.sub}>{[
              t('yd.nJobs', { n: tot.live }),
              tot.live ? t('yd.pctAccepted', { n: Math.round(tot.accepted * 100) }) : '',
              tot.forecast ? money(tot.forecast, p.currency) : '',
              tot.budgetLeft != null && tot.budgetLeft < 0 ? t('yd.overBudget') : '',
            ].filter(Boolean).join(' · ')}</Text>
          </View>
          <Text style={[styles.badge, { color: phaseColor(ph), borderColor: phaseColor(ph) }]}>{tk(`yd.phase.${ph}`)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle title={t('yd.title')} subtitle={t('yd.subtitle')} help="Yard periods and warranty" />
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.xs }]}>{`✓ ${saved}`}</Text> : null}

      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: SIZES.sm }}>
          <Stat v={inYard} label={t('yd.phase.inYard')} color={COLORS.warning} />
          <Stat v={openJobs} label={t('yd.openJobs')} color={COLORS.primary} />
          <Stat v={expiring} label={t('yd.expiring')} color={COLORS.warning} />
          <Stat v={openClaims} label={t('yd.openClaims')} color={COLORS.danger} />
        </View>
      </Card>

      <Label style={{ marginTop: SIZES.md }}>{t('yd.projects')}</Label>
      {canPlan ? (
        <View style={[styles.row, { marginTop: 0 }]}>
          <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('YardProject', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('yd.newProject')}`}</Text></TouchableOpacity>
        </View>
      ) : null}
      {!open.length ? <Text style={[styles.sub, { marginVertical: SIZES.xs }]}>{canPlan ? t('yd.emptyProjects') : t('yd.emptyProjectsCrew')}</Text> : null}
      {open.map(projectRow)}
      {closed.length ? (
        <TouchableOpacity onPress={() => setShowClosed(!showClosed)} style={{ marginVertical: SIZES.xs }}>
          <Text style={styles.link}>{`${showClosed ? '▾' : '▸'} ${t('yd.closedN', { n: closed.length })}`}</Text>
        </TouchableOpacity>
      ) : null}
      {showClosed ? closed.map(projectRow) : null}

      <Label style={{ marginTop: SIZES.md }}>{t('yd.warranty')}</Label>
      <View style={[styles.row, { marginTop: 0, gap: SIZES.xs, flexWrap: 'wrap' }]}>
        {officer ? <TouchableOpacity style={styles.btn} onPress={() => nav.navigate('WarrantyClaim', { id: 'new' })}><Text style={styles.btnText}>{`+ ${t('yd.newClaim')}`}</Text></TouchableOpacity> : null}
        {cover.length || claims.length ? <TouchableOpacity style={styles.small} onPress={() => void pdf()}><Text style={styles.smallText}>{t('yd.warrantyPdf')}</Text></TouchableOpacity> : null}
      </View>
      {!cover.length ? <Text style={[styles.sub, { marginVertical: SIZES.xs }]}>{t('yd.noCover')}</Text> : null}
      {cover.map((r) => (
        <TouchableOpacity key={r.job.id} style={[styles.item, { borderLeftColor: stateColor(r.state) }, r.state === 'expired' && { opacity: 0.6 }]} onPress={() => nav.navigate('YardJob', { id: r.job.id })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
            <MciIcon name="shield-check-outline" size={20} color={stateColor(r.state)} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{`${jobNo(r.job)} ${r.job.title}`}</Text>
              <Text style={styles.sub}>{[r.job.machineName ?? '', r.project?.name ?? '', r.job.contractor ?? r.project?.yard ?? ''].filter(Boolean).join(' · ')}</Text>
              <Text style={[styles.sub, { color: stateColor(r.state) }]}>{[t('yd.until', { date: uiDate(r.until) }), r.claims.length ? t('yd.nClaims', { n: r.claims.length }) : ''].filter(Boolean).join(' · ')}</Text>
            </View>
            <Text style={[styles.badge, { color: stateColor(r.state), borderColor: stateColor(r.state) }]}>{tk(`yd.cover.${r.state}`)}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <Label style={{ marginTop: SIZES.md }}>{t('yd.claims')}</Label>
      {!claims.length ? <Text style={[styles.sub, { marginVertical: SIZES.xs }]}>{t('yd.noClaims')}</Text> : null}
      {claims.map((c) => {
        const st = claimStage(c);
        const cv = claimCover(c, yardJobs);
        return (
          <TouchableOpacity key={c.id} style={[styles.item, { borderLeftColor: stageColor(st) }, !!c.closed && { opacity: 0.7 }]} onPress={() => nav.navigate('WarrantyClaim', { id: c.id })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{`${c.no} · ${c.title}`}</Text>
                <Text style={styles.sub}>{[c.machineName ?? '', c.against, uiDate(c.found), cv ? t('yd.until', { date: uiDate(cv.until) }) : ''].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text style={[styles.badge, { color: stageColor(st), borderColor: stageColor(st) }]}>{c.answer && !c.closed ? tk(`yd.out.${c.answer.outcome}`) : tk(`yd.cst.${st}`)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </Screen>
  );
}
