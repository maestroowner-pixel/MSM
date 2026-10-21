// ===================================
// Permits — permits to work and risk assessments, one tab, two lists.
//
// Permits read in the order an officer of the watch needs them: what is open now
// (in progress, approved, waiting for approval), then the history. A permit past
// its window is marked — it must be closed or renewed.
// Risk assessments: the vessel's library (generic, copied for a job) and the
// assessments made for particular jobs. The starter library (constants/
// riskLibrary) is offered once, while the vessel's own library is empty.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { MonthPicker, monthName } from '../components/MonthPicker';
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { PERMIT_STATUS_LABEL, Permit, PermitType, RiskAssessment } from '../types/permits';
import { PERMIT_TYPES, PERMIT_TYPE_MAP } from '../constants/permitTypes';
import { RISK_LIBRARY } from '../constants/riskLibrary';
import { RISK_COLOR, RISK_LABEL, isOverdue, nowLocal, worstResidual } from '../services/permits';
import { uid } from '../utils/id';
import { t, tn, useT } from '../utils/i18n';

type Tab = 'permits' | 'risks';

export default function PermitsSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { permits, risks, saveRisk } = useData();
  const [tab, setTab] = useState<Tab>('permits');
  const [newType, setNewType] = useState<PermitType>('general');
  const now = nowLocal();

  const open = permits.filter((p) => ['draft', 'requested', 'approved', 'active'].includes(p.status));
  const rank = (p: Permit) => (isOverdue(p, now) ? 0 : p.status === 'active' ? 1 : p.status === 'approved' ? 2 : p.status === 'requested' ? 3 : 4);
  const openSorted = [...open].sort((a, b) => rank(a) - rank(b) || (a.from ?? '').localeCompare(b.from ?? ''));
  const history = permits.filter((p) => p.status === 'closed' || p.status === 'cancelled').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  // Archive: every permit of a month (by the start of the work, else when it
  // was raised), month by month.
  const [archive, setArchive] = useState(false);
  const [month, setMonth] = useState(now.slice(0, 7));
  const monthOf = (p: Permit) => (p.from ?? '').slice(0, 7) || new Date(p.createdAt - new Date(p.createdAt).getTimezoneOffset() * 60000).toISOString().slice(0, 7);
  const ofMonth = permits.filter((p) => !p.deleted && monthOf(p) === month).sort((a, b) => (b.from ?? '').localeCompare(a.from ?? '') || b.createdAt - a.createdAt);
  const permitCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of permits) if (!x.deleted) c[monthOf(x)] = (c[monthOf(x)] ?? 0) + 1;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permits]);
  const permitMonths = Object.keys(permitCounts);

  const library = risks.filter((r) => r.generic).sort((a, b) => a.title.localeCompare(b.title));
  const jobRisks = risks.filter((r) => !r.generic).sort((a, b) => b.updatedAt - a.updatedAt);

  const newPermit = () => nav.navigate('Permit', { id: uid('ptw'), isNew: true, type: newType });
  const newRisk = (generic: boolean) => nav.navigate('Risk', { id: uid('ra'), isNew: true, generic });

  const addStarterLibrary = async () => {
    const now = Date.now();
    for (const t of RISK_LIBRARY) {
      await saveRisk({
        id: uid('ra'),
        title: t.title,
        task: t.task,
        hazards: t.hazards.map((h) => ({ ...h, id: uid('hz') })),
        generic: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  };

  const PermitRow = ({ p }: { p: Permit }) => {
    const def = PERMIT_TYPE_MAP[p.type];
    const late = isOverdue(p, now);
    const color = late ? COLORS.danger : p.status === 'active' ? COLORS.success : p.status === 'approved' ? COLORS.primary : p.status === 'requested' ? COLORS.warning : COLORS.textLight;
    return (
      <TouchableOpacity style={styles.row} onPress={() => nav.navigate('Permit', { id: p.id })} activeOpacity={0.7}>
        <View style={[styles.bar, { backgroundColor: color }]} />
        <MciIcon name={def.icon} size={22} color={COLORS.textLight} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{p.work || def.label}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[p.no, def.label, p.location, p.from ? `${p.from.replace('T', ' ')} → ${(p.to ?? '').slice(11)}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Text style={[styles.status, { color }]}>{late ? t('permits.overdue') : PERMIT_STATUS_LABEL[p.status]}</Text>
      </TouchableOpacity>
    );
  };

  const RiskRow = ({ r }: { r: RiskAssessment }) => {
    const w = worstResidual(r);
    return (
      <TouchableOpacity style={styles.row} onPress={() => nav.navigate('Risk', { id: r.id })} activeOpacity={0.7}>
        <View style={[styles.bar, { backgroundColor: w ? RISK_COLOR[w] : COLORS.border }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>{r.title}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {[r.no, tn('n.hazard', r.hazards.length), r.approved ? t('permits.approvedBy', { by: r.approved.by }) : t('permits.notApproved')].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {w ? <Text style={[styles.status, { color: RISK_COLOR[w] }]}>{RISK_LABEL[w]}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle
        title={archive && tab === 'permits' ? t('permits.titleMonth', { month: monthName(month) }) : t('permits.title')}
        subtitle={archive && tab === 'permits' ? t('permits.archiveSub', { x: tn('n.permit', ofMonth.length) }) : t('permits.sub')}
        help="Permits to work and risk assessments"
        actions={archive && tab === 'permits' ? <MonthPicker value={month} onChange={setMonth} months={permitMonths} counts={permitCounts} /> : undefined}
      />
      <View style={styles.tabs}>
        {([['permits', t('permits.tabPermits', { n: open.length })], ['risks', t('permits.tabRisks', { n: risks.length })]] as [Tab, string][]).map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'permits' ? (
        <>
          <View style={styles.newRow}>
            <Dropdown
              caption={t('permits.newCap')}
              value={newType}
              onChange={setNewType}
              options={PERMIT_TYPES.map((t) => ({ value: t.key, label: t.label }))}
              style={{ flex: 1 }}
            />
            <TouchableOpacity style={styles.btn} onPress={newPermit}>
              <Text style={styles.btnText}>{t('permits.new')}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.archiveBtn, archive && styles.tabOn]} onPress={() => setArchive((v) => !v)}>
            <MciIcon name="archive-outline" size={18} color={archive ? COLORS.textWhite : COLORS.primary} />
            <Text style={[styles.tabText, archive && styles.tabTextOn]}>{archive ? t('permits.backOpen') : t('permits.archive')}</Text>
          </TouchableOpacity>
          {archive ? (
            <>
              {ofMonth.map((p) => <PermitRow key={p.id} p={p} />)}
              {!ofMonth.length ? <Empty text={t('permits.noneMonth')} /> : null}
            </>
          ) : (
            <>
              <Label>{t('common.openN', { n: open.length })}</Label>
              {openSorted.map((p) => <PermitRow key={p.id} p={p} />)}
              {!open.length ? <Empty text={t('permits.noneOpen')} /> : null}
              {history.length ? <Label>{t('permits.recent')}</Label> : null}
              {history.map((p) => <PermitRow key={p.id} p={p} />)}
            </>
          )}
        </>
      ) : (
        <>
          <View style={styles.newRow}>
            <TouchableOpacity style={styles.btn} onPress={() => newRisk(false)}>
              <Text style={styles.btnText}>{t('permits.forJob')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => newRisk(true)}>
              <Text style={styles.btnOutlineText}>{t('permits.libNew')}</Text>
            </TouchableOpacity>
          </View>
          <Label>{t('permits.forJobs', { n: jobRisks.length })}</Label>
          {jobRisks.map((r) => <RiskRow key={r.id} r={r} />)}
          {!jobRisks.length ? <Text style={styles.sub}>{t('permits.jobNote')}</Text> : null}
          <Label>{t('permits.library', { n: library.length })}</Label>
          {library.map((r) => <RiskRow key={r.id} r={r} />)}
          {!library.length ? (
            <View style={styles.starter}>
              <Text style={styles.sub}>{t('permits.libEmpty')}</Text>
              <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => void addStarterLibrary()}>
                <Text style={styles.btnText}>{t('permits.starter')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.md },
    tab: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    tabOn: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    tabTextOn: { color: COLORS.textWhite },
    newRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, paddingRight: SIZES.md, marginBottom: SIZES.sm, overflow: 'hidden' },
    bar: { width: 5, alignSelf: 'stretch', marginRight: 2 },
    title: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    status: { fontSize: SIZES.small, fontWeight: '800' },
    archiveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: COLORS.primary, borderRadius: 999, paddingVertical: 6, paddingHorizontal: SIZES.md, marginBottom: SIZES.sm },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: SIZES.sm },
    month: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    starter: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md },
  });
