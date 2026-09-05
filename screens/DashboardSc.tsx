// ===================================
// Dashboard — inspection / expiry overview
// Flattens all items; filter by group + status (tap a counter), sort by expiry
// date or by position (grouped with location headers).
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen, ScreenTitle, Empty, statusColor, CategoryBadge, Glyph } from '../components/ui';
import { TrialBanner } from '../components/TrialBanner';
import { UpdateBanner } from '../components/UpdateBanner';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORY_MAP } from '../constants/categories';
import { gettingStarted } from '../constants/gettingStarted';
import { complianceDate, computeStatus, daysUntil, formatDate } from '../utils/dates';
import { ComplianceStatus, EquipmentItem, Group } from '../types/equipment';
import * as inspections from '../services/inspections';

type GroupFilter = 'ALL' | Group;
type StatusFilter = 'expired' | 'due' | 'ok' | null;
type SortBy = 'date' | 'position' | 'name' | 'type';

const NO_POSITION = '— No position';

const GROUP_ORDER: GroupFilter[] = ['ALL', 'LSA', 'FFE', 'OTHER'];
const GROUP_LABEL: Record<GroupFilter, string> = { ALL: 'All groups', LSA: 'LSA', FFE: 'FFE', OTHER: 'Other' };
const SORT_ORDER: SortBy[] = ['date', 'position', 'name', 'type'];
const SORT_LABEL: Record<SortBy, string> = { date: 'Expiry date', position: 'Position', name: 'Name', type: 'Type' };

const titleOf = (it: EquipmentItem) => (it.type || (it.no != null ? `#${it.no}` : '')).toLowerCase();

/** The Flagged / Recently-scanned strips are shortcuts, not registers — a few each. */
const STRIP_CAP = 5;

/** "just now" / "12m ago" / "3h ago" / "2d ago" — short, for the scanned strip. */
function relScanned(ts?: number): string {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

interface Scored {
  it: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
}
type ListEntry =
  | { kind: 'header'; key: string; position: string; count: number; icon: string }
  | ({ kind: 'row'; key: string } & Scored);

export default function DashboardSc() {
  const { flat, loading, certificates, isLocked, recentScans, inspections: trail } = useData();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useS();
  const certItemIds = useMemo(() => {
    const s = new Set<string>();
    certificates.forEach((c) => c.itemIds.forEach((id) => s.add(id)));
    return s;
  }, [certificates]);
  const [group, setGroup] = useState<GroupFilter>('ALL');
  const [status, setStatus] = useState<StatusFilter>(null);
  const [sortBy, setSortBy] = useState<SortBy>('date');

  const { listData, stats, total } = useMemo(() => {
    const withDates: Scored[] = flat
      .map((it) => ({ it, status: computeStatus(it), date: complianceDate(it), days: daysUntil(complianceDate(it)) }))
      .filter((r) => r.date != null);

    // Group scope drives the counters; the status filter then narrows the list.
    const scoped = group === 'ALL' ? withDates : withDates.filter((r) => CATEGORY_MAP[r.it.category].group === group);
    const stats = {
      expired: scoped.filter((r) => r.status === 'expired').length,
      due: scoped.filter((r) => r.status === 'due').length,
      ok: scoped.filter((r) => r.status === 'ok').length,
    };

    let rows = status ? scoped.filter((r) => r.status === status) : scoped;
    const byDays = (a: Scored, b: Scored) => (a.days ?? 1e9) - (b.days ?? 1e9);

    let listData: ListEntry[];
    if (sortBy === 'date') {
      rows = [...rows].sort(byDays);
      listData = rows.map((r) => ({ kind: 'row', key: r.it.id, ...r }));
    } else if (sortBy === 'name') {
      rows = [...rows].sort((a, b) => titleOf(a.it).localeCompare(titleOf(b.it)));
      listData = rows.map((r) => ({ kind: 'row', key: r.it.id, ...r }));
    } else {
      // Group with a header per location (position) or per equipment category (type).
      const byType = sortBy === 'type';
      const NONE = byType ? '— Other' : NO_POSITION;
      const keyOf = (r: Scored) =>
        byType ? CATEGORY_MAP[r.it.category].label : (r.it.position ?? '').trim() || NO_POSITION;
      const groups = new Map<string, Scored[]>();
      for (const r of rows) {
        const k = keyOf(r) || NONE;
        const arr = groups.get(k);
        if (arr) arr.push(r);
        else groups.set(k, [r]);
      }
      const keys = [...groups.keys()].sort((a, b) => {
        if (a === NONE) return 1;
        if (b === NONE) return -1;
        return a.localeCompare(b);
      });
      listData = [];
      for (const k of keys) {
        const items = groups.get(k)!.sort(byDays);
        listData.push({ kind: 'header', key: `h:${k}`, position: k, count: items.length, icon: byType ? '🏷️' : '📍' });
        for (const r of items) listData.push({ kind: 'row', key: r.it.id, ...r });
      }
    }

    return { listData, stats, total: rows.length };
  }, [flat, group, status, sortBy]);

  // Two quick-access strips above the list: things a human flagged to revisit, and
  // the labels just scanned on this device (ScanSc → services/scanHistory). Both are
  // shortcuts back to an item, capped short. Rendered as the list header so they
  // scroll away. The scan trail holds ids only — an entry whose item has since been
  // deleted simply drops out here.
  const flaggedRecent = useMemo(
    () => flat.filter((i) => i.flagged).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, STRIP_CAP),
    [flat]
  );

  // Defects raised by a failed inspection and not yet rectified. Distinct from
  // Flagged directly above it: a flag is a human saying "look at this again",
  // a defect is a signed record saying the equipment failed its check. They sit
  // next to each other because the crew needs both, and are never merged
  // because only one of the two is evidence.
  const openDefectItems = useMemo(() => {
    const byId = new Map(flat.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const out: EquipmentItem[] = [];
    for (const insp of inspections.openDefects(trail)) {
      if (seen.has(insp.itemId)) continue;
      seen.add(insp.itemId);
      const it = byId.get(insp.itemId);
      if (it) out.push(it);
      if (out.length >= STRIP_CAP) break;
    }
    return out;
  }, [flat, trail]);

  const openDefectCount = useMemo(
    () => new Set(inspections.openDefects(trail).map((i) => i.itemId)).size,
    [trail]
  );
  const recentScanned = useMemo(() => {
    const byId = new Map(flat.map((i) => [i.id, i]));
    return recentScans
      .map((e) => ({ it: byId.get(e.id), at: e.at }))
      .filter((r): r is { it: EquipmentItem; at: number } => r.it != null)
      .slice(0, STRIP_CAP);
  }, [flat, recentScans]);

  const toggleStatus = (s: Exclude<StatusFilter, null>) => setStatus((cur) => (cur === s ? null : s));
  const cycleGroup = () => setGroup((g) => GROUP_ORDER[(GROUP_ORDER.indexOf(g) + 1) % GROUP_ORDER.length]);
  const cycleSort = () => setSortBy((s) => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  // Tablets: two cards per row (location headers stay full-width).
  const { width } = useWindowDimensions();
  const twoCol = width >= 600;
  const renderData = useMemo<(ListEntry | { kind: 'pair'; key: string; left: ListEntry; right?: ListEntry })[]>(() => {
    if (!twoCol) return listData;
    const out: (ListEntry | { kind: 'pair'; key: string; left: ListEntry; right?: ListEntry })[] = [];
    for (let i = 0; i < listData.length; ) {
      const e = listData[i];
      if (e.kind === 'header') { out.push(e); i++; continue; }
      const right = listData[i + 1]?.kind === 'row' ? listData[i + 1] : undefined;
      out.push({ kind: 'pair', key: 'p:' + e.key, left: e, right });
      i += right ? 2 : 1;
    }
    return out;
  }, [listData, twoCol]);

  const rowOf = (e: Extract<ListEntry, { kind: 'row' }>, fill?: boolean) => (
    <DashRow
      item={e.it}
      status={e.status}
      date={e.date}
      days={e.days}
      fill={fill}
      hasCert={certItemIds.has(e.it.id)}
      locked={isLocked(e.it.id)}
      onPress={() =>
        isLocked(e.it.id)
          ? nav.navigate('Paywall')
          : nav.navigate('ItemDetail', { category: e.it.category, id: e.it.id })
      }
    />
  );

  const stripRow = (it: EquipmentItem, prefix: string, rightText?: string) => (
    <DashRow
      key={prefix + it.id}
      item={it}
      status={computeStatus(it)}
      date={complianceDate(it)}
      days={daysUntil(complianceDate(it))}
      rightText={rightText}
      locked={isLocked(it.id)}
      onPress={() =>
        isLocked(it.id)
          ? nav.navigate('Paywall')
          : nav.navigate('ItemDetail', { category: it.category, id: it.id })
      }
    />
  );

  // The two shortcut strips, rendered as the list header so they scroll with it.
  // Flagged hides when there's nothing flagged; Recently scanned always shows its
  // panel and just carries an empty line until the first scan.
  const strips = (
    <View>
      <UpdateBanner />
      {openDefectItems.length > 0 ? (
        <>
          <TouchableOpacity style={styles.posHeader} onPress={() => nav.navigate('Defects')} activeOpacity={0.7}>
            <Text style={styles.posHeaderText} numberOfLines={1}>🛠 Open defects</Text>
            <Text style={styles.posHeaderCount}>{openDefectCount}</Text>
            <Text style={styles.posHeaderChevron}>›</Text>
          </TouchableOpacity>
          {openDefectItems.map((it) => stripRow(it, 'd:'))}
        </>
      ) : null}
      {flaggedRecent.length > 0 ? (
        <>
          <TouchableOpacity style={styles.posHeader} onPress={() => nav.navigate('Flagged')} activeOpacity={0.7}>
            <Text style={styles.posHeaderText} numberOfLines={1}>🚩 Flagged</Text>
            <Text style={styles.posHeaderCount}>{flaggedRecent.length}</Text>
            <Text style={styles.posHeaderChevron}>›</Text>
          </TouchableOpacity>
          {flaggedRecent.map((it) => stripRow(it, 'f:'))}
        </>
      ) : null}
      <TouchableOpacity style={styles.posHeader} onPress={() => nav.navigate('RecentScans')} activeOpacity={0.7}>
        <Text style={styles.posHeaderText} numberOfLines={1}>📷 Recently scanned</Text>
        {recentScanned.length > 0 ? <Text style={styles.posHeaderCount}>{recentScanned.length}</Text> : null}
        <Text style={styles.posHeaderChevron}>›</Text>
      </TouchableOpacity>
      {recentScanned.length === 0 ? (
        <Text style={styles.stripEmpty}>Nothing scanned yet — scan a label to jump back to it here.</Text>
      ) : (
        recentScanned.map((r) => stripRow(r.it, 's:', relScanned(r.at)))
      )}
    </View>
  );

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <ScreenTitle
        title="Dashboard"
        subtitle="Inspections & expiries, soonest first"
        help={6}
        onScan={() => nav.navigate('Scan')}
      />

      <TrialBanner />

      <View style={styles.statsRow}>
        <StatBox label="Expired" value={stats.expired} color={COLORS.danger} active={status === 'expired'} onPress={() => toggleStatus('expired')} />
        <StatBox label="Due soon" value={stats.due} color={COLORS.warning} active={status === 'due'} onPress={() => toggleStatus('due')} />
        <StatBox label="Valid" value={stats.ok} color={COLORS.success} active={status === 'ok'} onPress={() => toggleStatus('ok')} />
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity style={styles.cycleBtn} onPress={cycleGroup} activeOpacity={0.8}>
          <Text style={styles.cycleCaption}>GROUP</Text>
          <Text style={styles.cycleValue} numberOfLines={1}>{GROUP_LABEL[group]}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cycleBtn} onPress={cycleSort} activeOpacity={0.8}>
          <Text style={styles.cycleCaption}>SORT</Text>
          <Text style={styles.cycleValue} numberOfLines={1}>{SORT_LABEL[sortBy]}</Text>
        </TouchableOpacity>
      </View>

      {loading ? null : flat.length === 0 ? (
        <GetStarted onStart={() => nav.navigate('GettingStarted')} />
      ) : (
        <FlatList
          data={renderData}
          keyExtractor={(e) => e.key}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl }}
          ListHeaderComponent={strips}
          ListEmptyComponent={
            <Empty text={status || group !== 'ALL' ? 'No items match the current filters.' : 'No items with dates yet. Import the LSA/FFE workbook from Settings.'} />
          }
          renderItem={({ item: e }) =>
            e.kind === 'header' ? (
              <View style={styles.posHeader}>
                <Text style={styles.posHeaderText} numberOfLines={1}>{e.icon} {e.position}</Text>
                <Text style={styles.posHeaderCount}>{e.count}</Text>
              </View>
            ) : e.kind === 'pair' ? (
              <View style={styles.pairRow}>
                {rowOf(e.left as Extract<ListEntry, { kind: 'row' }>, true)}
                {e.right ? rowOf(e.right as Extract<ListEntry, { kind: 'row' }>, true) : <View style={{ flex: 1 }} />}
              </View>
            ) : (
              rowOf(e)
            )
          }
        />
      )}
    </Screen>
  );
}

// Shown when the register is completely empty: a friendly welcome + a prominent
// "How to start?" button that opens the import guide.
function GetStarted({ onStart }: { onStart: () => void }) {
  const styles = useS();
  const content = useMemo(() => gettingStarted(), []);
  return (
    <View style={styles.getStarted}>
      <Glyph emoji="🚢" size={56} />
      <View style={{ height: SIZES.md }} />
      <Text style={styles.getStartedTitle}>{content.emptyTitle}</Text>
      <Text style={styles.getStartedBody}>{content.emptyBody}</Text>
      <TouchableOpacity style={styles.getStartedBtn} onPress={onStart} activeOpacity={0.85}>
        <Text style={styles.getStartedBtnText}>{content.ctaLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatBox({
  label,
  value,
  color,
  active,
  onPress,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  const COLORS = useTheme();
  const styles = useS();
  return (
    <TouchableOpacity
      style={[styles.statBox, { borderColor: color }, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.statValue, { color: active ? COLORS.textWhite : color }]}>{value}</Text>
      <Text style={[styles.statLabel, active && { color: COLORS.textWhite }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function DashRow({
  item,
  status,
  date,
  days,
  onPress,
  fill,
  hasCert,
  rightText,
  locked,
}: {
  item: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
  onPress: () => void;
  fill?: boolean;
  hasCert?: boolean;
  // When set (the Recently-scanned strip), replaces the date/days column with a
  // single muted line, e.g. "3h ago".
  rightText?: string;
  // Free-tier overflow lock — read-only; tap routes to the paywall.
  locked?: boolean;
}) {
  const styles = useS();
  const meta = CATEGORY_MAP[item.category];
  const title = item.type || (item.no != null ? `#${item.no}` : meta.short);
  const daysText =
    days == null ? '' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `in ${days}d`;
  const attCount = item.attachments?.length ?? 0;
  return (
    <TouchableOpacity style={[styles.row, fill && { flex: 1 }, locked && { opacity: 0.55 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowBar, { backgroundColor: statusColor(status) }]} />
      <View style={styles.rowEmoji}><CategoryBadge category={item.category} size={20} /></View>
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          {attCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{'📎'.repeat(attCount)}</Text>
            </View>
          ) : null}
          {hasCert ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📜</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {meta.short}
          {item.position ? ` · ${item.position}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {locked ? (
          <Text style={styles.rowDays}>🔒</Text>
        ) : rightText != null ? (
          <Text style={styles.rowDays}>{rightText}</Text>
        ) : (
          <>
            <Text style={[styles.rowDate, { color: statusColor(status) }]}>{formatDate(date)}</Text>
            <Text style={styles.rowDays}>{daysText}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  getStarted: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: SIZES.lg, paddingTop: SIZES.xxxl },
  getStartedEmoji: { fontSize: 52, marginBottom: SIZES.md },
  getStartedTitle: { fontSize: SIZES.h3, fontWeight: '800', color: COLORS.textDark, textAlign: 'center' },
  getStartedBody: { fontSize: SIZES.body, color: COLORS.textLight, textAlign: 'center', lineHeight: 21, marginTop: SIZES.sm, marginBottom: SIZES.xl },
  getStartedBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusRound,
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.xxl,
    alignItems: 'center',
  },
  getStartedBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  statsRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    backgroundColor: COLORS.cardSolid,
    paddingVertical: 6,
    paddingHorizontal: SIZES.sm,
  },
  statValue: { fontSize: SIZES.h5, fontWeight: '800' },
  statLabel: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '600' },
  controlRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md },
  cycleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSolid,
  },
  cycleCaption: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '800', letterSpacing: 0.5 },
  cycleValue: { fontSize: SIZES.small, color: COLORS.primaryDark, fontWeight: '700', flexShrink: 1 },
  posHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    marginBottom: SIZES.xs,
    marginTop: SIZES.xs,
  },
  posHeaderText: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primaryDark, flex: 1 },
  posHeaderCount: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textLight, marginLeft: SIZES.sm },
  posHeaderChevron: { fontSize: SIZES.h4, fontWeight: '700', color: COLORS.textLight, marginLeft: SIZES.xs },
  stripEmpty: { fontSize: SIZES.small, color: COLORS.textLight, fontStyle: 'italic', paddingHorizontal: SIZES.sm, paddingBottom: SIZES.sm, marginBottom: SIZES.xs },
  pairRow: { flexDirection: 'row', gap: SIZES.sm, alignItems: 'stretch' },
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
  rowBar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  rowEmoji: { marginRight: SIZES.sm, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark, flexShrink: 1 },
  badge: { backgroundColor: 'rgba(46,125,153,0.12)', borderRadius: SIZES.radiusSm, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: SIZES.tiny, color: COLORS.primaryDark, fontWeight: '700' },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.body, fontWeight: '700' },
  rowDays: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
