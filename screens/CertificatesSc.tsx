// ===================================
// Certificates — equipment, crew and vessel certificates, one tab each.
//
// One list underneath (types/certificate.ts says why); the tabs only filter it.
// The Crew tab groups by person, worst status first inside each, because the
// question asked of it is "whose papers run out", not "which papers exist".
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, SectionList, TouchableOpacity, TextInput, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, StatusPill, Empty, statusColor } from '../components/ui'
import { HelpButton } from '../components/HelpButton';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { statusFromDate, formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { Certificate, CertificateScope, scopeOf } from '../types/certificate';
import { crewLabel } from '../types/crew';
import { ComplianceStatus } from '../types/equipment';
import { canAddCertificate } from '../services/trial';
import { MciIcon } from '../components/MciIcon';
import { moduleOn } from '../constants/modules';
import { certSurveySummary, worstOf } from '../services/certSurveys';
import { todayIso } from '../services/pms';
import { t, tk, tn, useT } from '../utils/i18n';

export default function CertificatesSc() {
  useT();
  const { certificates, crew } = useData();
  const { modulesRev } = useSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const TABS = useMemo(tabsNow, [modulesRev]);
  const route = useRoute<any>();
  const [tab, setTab] = useState<CertificateScope>(
    TABS.some((x) => x.key === route.params?.tab) ? route.params.tab : 'equipment'
  );
  // Opened from a crew row ("3 certificates · 1 expired") with { tab: 'crew' }.
  useEffect(() => {
    const t = route.params?.tab;
    if (TABS.some((x) => x.key === t)) setTab(t);
  }, [route.params?.tab]);
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();
  const cols = width >= 600 ? 2 : 1;

  const counts = useMemo(() => {
    const n: Record<CertificateScope, number> = { equipment: 0, crew: 0, vessel: 0 };
    certificates.forEach((c) => (n[scopeOf(c)] += 1));
    return n;
  }, [certificates]);

  const crewById = useMemo(() => new Map(crew.map((m) => [m.id, m])), [crew]);
  const holderOf = (c: Certificate) => {
    const m = c.crewId ? crewById.get(c.crewId) : undefined;
    return m && !m.deleted ? crewLabel(m) : c.holderName || t('certs.noHolder');
  };

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const inTab = certificates.filter((c) => scopeOf(c) === tab);
    const filtered = needle
      ? inTab.filter((c) =>
          [c.name, c.number, c.issuer, tab === 'crew' ? holderOf(c) : undefined].some((v) => v?.toLowerCase().includes(needle))
        )
      : inTab;
    return [...filtered].sort((a, b) => {
      const da = a.expiryDate ?? '9999';
      const db = b.expiryDate ?? '9999';
      return da.localeCompare(db);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificates, q, tab, crewById]);

  /** Crew tab: one section per person, the person with the worst paper first. */
  const sections = useMemo(() => {
    if (tab !== 'crew') return [];
    const rank: Record<ComplianceStatus, number> = { expired: 0, due: 1, none: 2, ok: 3 };
    const groups = new Map<string, Certificate[]>();
    list.forEach((c) => {
      const k = holderOf(c);
      groups.set(k, [...(groups.get(k) ?? []), c]);
    });
    return [...groups.entries()]
      .map(([title, data]) => {
        const worst = data.reduce<ComplianceStatus>((w, c) => {
          const s = statusFromDate(c.expiryDate);
          return rank[s] < rank[w] ? s : w;
        }, 'ok');
        return { title, data, worst };
      })
      .sort((a, b) => rank[a.worst] - rank[b.worst] || a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, tab]);

  const addCertificate = async () => {
    if (!(await canAddCertificate(certificates.length))) {
      nav.navigate('Paywall');
      return;
    }
    const newCert: Certificate = {
      id: uid('cert'),
      scope: tab,
      name: '',
      itemIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    nav.navigate('CertificateDetail', { id: null, draft: newCert });
  };

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>

      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('fleet.certs')}</Text>
          <Text style={styles.sub}>{SUBTITLE[tab](counts[tab])}</Text>
        </View>
        <HelpButton section="Certificates" />
        <TouchableOpacity style={[styles.addBtn, { marginLeft: SIZES.sm }]} onPress={addCertificate}>
          <MciIcon name="plus" size={26} color={COLORS.textWhite} />
        </TouchableOpacity>
      </View>

      {TABS.length > 1 ? (
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabOn]}
            onPress={() => setTab(t.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>
              {tk(`certs.tab.${t.key}`)}{counts[t.key] ? ` · ${counts[t.key]}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      ) : null}

      {counts[tab] > 0 ? (
        <TextInput
          style={styles.search}
          placeholder={tab === 'crew' ? t('certs.searchCrew') : t('certs.search')}
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
        />
      ) : null}

      {tab === 'equipment' && moduleOn('serviceReport') ? (
        <TouchableOpacity onPress={() => nav.navigate('ServiceReport')} style={styles.svcRow} hitSlop={8}>
          <MciIcon name="file-certificate-outline" size={18} color={COLORS.primary} />
          <Text style={styles.svcText}>{t('certs.fromService')}</Text>
          <MciIcon name="chevron-right" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      ) : null}

      {tab === 'crew' ? (
        <TouchableOpacity onPress={() => nav.navigate('CrewMatrix')} style={{ alignSelf: 'flex-end', marginBottom: SIZES.sm }} hitSlop={8}>
          <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small }}>{`${t('cm.title')} ›`}</Text>
        </TouchableOpacity>
      ) : null}

      {list.length === 0 ? (
        <Empty text={tk(`certs.empty.${tab}`)} />
      ) : tab === 'crew' ? (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.personHead}>
              <MciIcon name="account" size={18} />
              <Text style={styles.personName} numberOfLines={1}>{section.title}</Text>
              <StatusPill status={section.worst} />
            </View>
          )}
          renderItem={({ item }) => <CertRow item={item} onPress={() => nav.navigate('CertificateDetail', { id: item.id })} />}
        />
      ) : (
        <FlatList
          data={list}
          key={cols}
          numColumns={cols}
          columnWrapperStyle={cols > 1 ? { gap: SIZES.sm } : undefined}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          renderItem={({ item }) => (
            <CertRow item={item} wide={cols > 1} onPress={() => nav.navigate('CertificateDetail', { id: item.id })} />
          )}
        />
      )}
    </Screen>
  );
}

// Crew and Vessel ship dark until `crewCerts` is on (constants/modules.ts);
// with Equipment alone there is nothing to switch between, so no tab row.
// A function, not a constant: crewCerts may be switched on for one pilot vessel
// after this file is loaded (constants/modules.ts, setVesselModules).
const tabsNow = (): { key: CertificateScope; label: string }[] => [
  { key: 'equipment', label: 'Equipment' },
  ...(moduleOn('crewCerts')
    ? ([
        { key: 'crew', label: 'Crew' },
        { key: 'vessel', label: 'Vessel' },
      ] as { key: CertificateScope; label: string }[])
    : []),
];

const SUBTITLE: Record<CertificateScope, (n: number) => string> = {
  equipment: (n) => `${n} certificate${n === 1 ? '' : 's'} · link items to a group certificate`,
  crew: (n) => `${n} crew certificate${n === 1 ? '' : 's'} · STCW, CoC, medical, passport`,
  vessel: (n) => `${n} vessel certificate${n === 1 ? '' : 's'} · registry, SMC, ISSC, MLC`,
};

const EMPTY: Record<CertificateScope, string> = {
  equipment: 'No certificates yet. Tap + to add one and link the items it covers.',
  crew: 'No crew certificates yet. Tap + to add one — STCW, CoC, medical, passport — and choose whose it is.',
  vessel: "No vessel certificates yet. Tap + to add the ship's own papers — registry, SMC, ISSC, MLC, load line.",
};

function CertRow({ item, wide, onPress }: { item: Certificate; wide?: boolean; onPress: () => void }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { surveys, surveysDone } = useData();
  const scope = scopeOf(item);
  // A vessel certificate is only as good as its last endorsement (services/certSurveys.ts).
  const sv = scope === 'vessel' && moduleOn('surveys') ? certSurveySummary(item.id, surveys, surveysDone, todayIso()) : undefined;
  const status = sv ? worstOf(statusFromDate(item.expiryDate), sv.status) : statusFromDate(item.expiryDate);
  const next = sv?.next;
  const nextLine = next
    ? `${next.s.name.split(' — ').slice(1).join(' — ').replace(/^./, (ch) => ch.toUpperCase())}: ${next.st.state === 'overdue' ? t('drills.overdueSince', { date: formatDate(next.st.closes) }) : next.st.state === 'open' ? t('certs.windowOpen', { date: formatDate(next.st.closes) }) : t('certs.windowOpens', { date: formatDate(next.st.opens) })}`
    : undefined;
  const sub =
    scope === 'equipment'
      ? [item.number && `№ ${item.number}`, tn('n.item', item.itemIds.length)]
      : [item.number && `№ ${item.number}`, item.issuer];
  return (
    <TouchableOpacity style={[styles.row, wide && { flex: 1 }]} activeOpacity={0.7} onPress={onPress}>
      <View style={[styles.bar, { backgroundColor: statusColor(status) }]} />
      <View style={{ marginRight: SIZES.sm }}>
        <MciIcon name={scope === 'crew' ? 'card-account-details' : scope === 'vessel' ? 'ferry' : 'certificate'} size={22} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.name || t('certs.untitled')}
        </Text>
        {sub.some(Boolean) ? (
          <Text style={styles.rowSub} numberOfLines={1}>
            {sub.filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {nextLine ? (
          <Text style={[styles.rowSub, { color: sv!.status === 'ok' ? COLORS.textLight : statusColor(sv!.status) }]} numberOfLines={1}>
            {nextLine}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {item.expiryDate ? <Text style={styles.rowDate}>{formatDate(item.expiryDate)}</Text> : null}
        <StatusPill status={status} />
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  svcRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm },
  svcText: { flex: 1, color: COLORS.primary, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.md },
  tab: { flex: 1, paddingVertical: SIZES.sm, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  tabOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: SIZES.small, fontWeight: '600', color: COLORS.text },
  tabTextOn: { color: COLORS.textWhite },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm, marginBottom: SIZES.xs },
  personName: { flex: 1, fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.md, gap: SIZES.sm },
  title: { fontSize: SIZES.h2, fontWeight: '700', color: COLORS.textDark },
  sub: { fontSize: SIZES.small, color: COLORS.textLight },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  search: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    paddingRight: SIZES.md,
    paddingLeft: 0,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.sm },
  rowEmoji: { fontSize: 22, marginRight: SIZES.sm },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.small, color: COLORS.text, marginBottom: 2 },
});
