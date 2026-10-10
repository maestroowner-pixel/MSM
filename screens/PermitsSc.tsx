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
import { Dropdown } from '../components/Dropdown';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { PERMIT_STATUS_LABEL, Permit, PermitType, RiskAssessment } from '../types/permits';
import { PERMIT_TYPES, PERMIT_TYPE_MAP } from '../constants/permitTypes';
import { RISK_LIBRARY } from '../constants/riskLibrary';
import { RISK_COLOR, RISK_LABEL, isOverdue, nowLocal, worstResidual } from '../services/permits';
import { uid } from '../utils/id';

type Tab = 'permits' | 'risks';

export default function PermitsSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { permits, risks, saveRisk } = useData();
  const [tab, setTab] = useState<Tab>('permits');
  const [newType, setNewType] = useState<PermitType>('hot');
  const now = nowLocal();

  const open = permits.filter((p) => ['draft', 'requested', 'approved', 'active'].includes(p.status));
  const rank = (p: Permit) => (isOverdue(p, now) ? 0 : p.status === 'active' ? 1 : p.status === 'approved' ? 2 : p.status === 'requested' ? 3 : 4);
  const openSorted = [...open].sort((a, b) => rank(a) - rank(b) || (a.from ?? '').localeCompare(b.from ?? ''));
  const history = permits.filter((p) => p.status === 'closed' || p.status === 'cancelled').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);

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
        <Text style={[styles.status, { color }]}>{late ? 'Overdue' : PERMIT_STATUS_LABEL[p.status]}</Text>
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
            {[r.no, `${r.hazards.length} hazard${r.hazards.length === 1 ? '' : 's'}`, r.approved ? `approved by ${r.approved.by}` : 'not approved'].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {w ? <Text style={[styles.status, { color: RISK_COLOR[w] }]}>{RISK_LABEL[w]}</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Screen scroll>
      <ScreenTitle title="Permits" subtitle="Permits to work and risk assessments" help="Permits to work and risk assessments" />
      <View style={styles.tabs}>
        {([['permits', `Permits to work · ${open.length} open`], ['risks', `Risk assessments · ${risks.length}`]] as [Tab, string][]).map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, tab === k && styles.tabOn]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'permits' ? (
        <>
          <View style={styles.newRow}>
            <Dropdown
              caption="NEW"
              value={newType}
              onChange={setNewType}
              options={PERMIT_TYPES.map((t) => ({ value: t.key, label: t.label }))}
              style={{ flex: 1 }}
            />
            <TouchableOpacity style={styles.btn} onPress={newPermit}>
              <Text style={styles.btnText}>+ New permit</Text>
            </TouchableOpacity>
          </View>
          <Label>{`Open (${open.length})`}</Label>
          {openSorted.map((p) => <PermitRow key={p.id} p={p} />)}
          {!open.length ? <Empty text="No open permits. Choose the kind of work and tap “New permit”." /> : null}
          {history.length ? <Label>History</Label> : null}
          {history.map((p) => <PermitRow key={p.id} p={p} />)}
        </>
      ) : (
        <>
          <View style={styles.newRow}>
            <TouchableOpacity style={styles.btn} onPress={() => newRisk(false)}>
              <Text style={styles.btnText}>+ For a job</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => newRisk(true)}>
              <Text style={styles.btnOutlineText}>+ Library assessment</Text>
            </TouchableOpacity>
          </View>
          <Label>{`For jobs (${jobRisks.length})`}</Label>
          {jobRisks.map((r) => <RiskRow key={r.id} r={r} />)}
          {!jobRisks.length ? <Text style={styles.sub}>A job’s assessment is usually a copy of one in the library, made from the permit.</Text> : null}
          <Label>{`Library (${library.length})`}</Label>
          {library.map((r) => <RiskRow key={r.id} r={r} />)}
          {!library.length ? (
            <View style={styles.starter}>
              <Text style={styles.sub}>The vessel’s library is empty. Start from six common assessments — enclosed space, hot work, working aloft, mooring, tender, bunkering — and edit them to the vessel.</Text>
              <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.sm }]} onPress={() => void addStarterLibrary()}>
                <Text style={styles.btnText}>Add the starter library</Text>
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
    starter: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md },
  });
