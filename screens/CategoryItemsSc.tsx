// ===================================
// Category items list
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, useWindowDimensions, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Screen, StatusPill, Empty, statusColor, CategoryBadge } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { HelpButton } from '../components/HelpButton';
import { SIZES, Palette, SCROLLBAR_GUTTER } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import * as storage from '../services/storage';
import * as snapshot from '../services/snapshot';
import { CATEGORY_MAP } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { worstRoundMark, RoundMark } from '../services/inspections';
import { complianceDate, computeStatus, daysUntil, formatDate } from '../utils/dates';
import { CategoryKey, ComplianceStatus, EquipmentItem } from '../types/equipment';
import { uid } from '../utils/id';
import { canAddItem } from '../services/trial';
import { itemLocation, itemNumber, typeWithSize } from '../utils/itemText';
import { compareNumber, groupByPlace, usesDecks } from '../services/placeGroups';

type SortBy = 'date' | 'position' | 'name' | 'type' | 'round';
const SORT_ORDER: SortBy[] = ['position', 'date', 'name', 'type', 'round'];
const SORT_LABEL: Record<SortBy, string> = {
  date: 'Expiry date',
  position: 'Position',
  name: 'Name',
  type: 'Type',
  round: 'This period',
};

/**
 * The round mark's colour. Red something is wrong, green signed and clear, amber
 * the period is closing, blue not inspected yet — blue rather than grey because
 * "not yet" is a normal state on a fresh month, not a disabled one.
 */
const ROUND_COLOR = (m: RoundMark, C: Palette) =>
  m === 'fail' ? C.danger : m === 'done' ? C.success : m === 'due' ? C.warning : C.primary;

const ROUND_GROUP: Record<RoundMark, string> = {
  fail: 'Failed — defect outstanding',
  due: 'Period closing — not inspected',
  open: 'Not inspected yet',
  done: 'Inspected this period',
};

const titleOf = (it: EquipmentItem) => (it.type || (it.no != null ? `#${it.no}` : '')).toLowerCase();
const NO_TYPE = '— No type';

interface Scored {
  it: EquipmentItem;
  status: ComplianceStatus;
  date?: string;
  days?: number;
  /** Where this item stands in the CURRENT round — see services/inspections. */
  round: RoundMark;
}
type ListEntry =
  | { kind: 'header'; key: string; position: string; count: number; icon: string }
  | ({ kind: 'row'; key: string } & Scored);

export default function CategoryItemsSc() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const category: CategoryKey = route.params.category;
  const meta = CATEGORY_MAP[category];
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { byCategory, certificates, prefs, isLocked, templates, inspections: trail, vessel, reload } = useData();
  const sync = useSync();
  const certItemIds = useMemo(() => {
    const s = new Set<string>();
    certificates.forEach((c) => c.itemIds.forEach((id) => s.add(id)));
    return s;
  }, [certificates]);
  const [q, setQ] = useState('');
  // Position first, not expiry. A vessel asked for it (2 Oct 2026) and the reason
  // holds for every ship: this list is what a crew member walks a weekly round
  // with, deck by deck, and what is falling due already has the Dashboard.
  const [sortBy, setSortBy] = useState<SortBy>('position');

  // Label select-mode. Entered by long-pressing a row or via the tag button —
  // never on by default, because tapping a row to open it is what this screen is
  // for, and a permanent row of checkboxes would tax every visit for the sake of
  // the occasional label run.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const list = byCategory[category] ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((it) =>
      [it.type, it.serial, it.position, it.deck, it.make, it.size, it.no != null ? String(it.no) : undefined].some((v) => v?.toLowerCase().includes(needle))
    );
  }, [byCategory, category, q]);

  // Position headings are the vessel's DECKS when this category records any, with
  // the location saying where on the deck; a list with no decks keeps its location
  // headings. Asked from the whole category, not the search result, so the
  // headings do not change kind while somebody is typing.
  const byDeck = useMemo(() => usesDecks(byCategory[category] ?? []), [byCategory, category]);
  const deckHeadings = sortBy === 'position' && byDeck;

  // Sort by soonest expiry/inspection, or group by position with deck/location headers.
  const listData = useMemo<ListEntry[]>(() => {
    const periods = periodsFor(category, templates);
    const scored: Scored[] = filtered.map((it) => {
      const date = complianceDate(it);
      return {
        it,
        status: computeStatus(it),
        date,
        days: daysUntil(date),
        round: worstRoundMark(trail, it.id, periods),
      };
    });
    const byDays = (a: Scored, b: Scored) => (a.days ?? 1e9) - (b.days ?? 1e9);

    if (sortBy === 'date') {
      return [...scored].sort(byDays).map((r) => ({ kind: 'row', key: r.it.id, ...r }));
    }
    if (sortBy === 'name') {
      return [...scored]
        .sort((a, b) => titleOf(a.it).localeCompare(titleOf(b.it)))
        .map((r) => ({ kind: 'row', key: r.it.id, ...r }));
    }
    // By the current round. Worst first, because this list is read to find what
    // still needs doing before the period closes — the ones already signed are
    // the least interesting thing on the screen.
    if (sortBy === 'round') {
      const order: RoundMark[] = ['fail', 'due', 'open', 'done'];
      const out: ListEntry[] = [];
      for (const mark of order) {
        const rows = scored.filter((r) => r.round === mark).sort(byDays);
        if (!rows.length) continue;
        out.push({ kind: 'header', key: `h_${mark}`, position: ROUND_GROUP[mark], count: rows.length, icon: 'clipboard-text-outline' });
        rows.forEach((r) => out.push({ kind: 'row', key: r.it.id, ...r }));
      }
      return out;
    }
    // Group by the item's type/description, with a header per group. Items with
    // no value land in a trailing "—" group.
    if (sortBy === 'type') {
      const groups = new Map<string, Scored[]>();
      for (const r of scored) {
        const k = (r.it.type ?? '').toString().trim() || NO_TYPE;
        const arr = groups.get(k);
        if (arr) arr.push(r);
        else groups.set(k, [r]);
      }
      const keys = [...groups.keys()].sort((a, b) => {
        if (a === NO_TYPE) return 1;
        if (b === NO_TYPE) return -1;
        return a.localeCompare(b);
      });
      const out: ListEntry[] = [];
      for (const k of keys) {
        const group = groups.get(k)!.sort(byDays);
        out.push({ kind: 'header', key: `h:${k}`, position: k, count: group.length, icon: 'tag-outline' });
        for (const r of group) out.push({ kind: 'row', key: r.it.id, ...r });
      }
      return out;
    }
    // By position — see services/placeGroups.
    const out: ListEntry[] = [];
    // Under a location, by item number — the order a round is walked and ticked
    // off in; the soonest date only settles two items with the same number.
    const byNumber = (a: Scored, b: Scored) => compareNumber(a.it.no, b.it.no) || byDays(a, b);
    for (const g of groupByPlace(scored, (r) => r.it, byDeck, byNumber)) {
      out.push({ kind: 'header', key: `h:${g.key}`, position: g.label, count: g.rows.length, icon: byDeck ? 'layers-outline' : 'map-marker-outline' });
      for (const r of g.rows) out.push({ kind: 'row', key: r.it.id, ...r });
    }
    return out;
  }, [filtered, sortBy, byDeck]);

  const cycleSort = () => setSortBy((s) => SORT_ORDER[(SORT_ORDER.indexOf(s) + 1) % SORT_ORDER.length]);

  // Add a new item — gated by the free-tier list limit (a no-op until the trial
  // counter expires AND limits are enabled in services/trial; routes to paywall otherwise).
  const addItem = async () => {
    const count = byCategory[category]?.length ?? 0;
    if (!(await canAddItem(count))) {
      nav.navigate('Paywall');
      return;
    }
    nav.navigate('ItemDetail', { category, id: null, newId: uid(category.slice(0, 3)) });
  };

  /**
   * Clear the category — every item in it, at once.
   *
   * Asked for by a vessel that had tripled a few lists during setup (2 Oct 2026)
   * and did not want to delete ninety items one by one before loading the right
   * workbook. The Master's, like Reset and Restore in Settings and for the same
   * reason: on a syncing device it empties the category for the whole vessel. A
   * device on no vessel answers to nobody and may clear its own.
   *
   * A snapshot is taken first, so it can be rolled back from Settings → Data like
   * an import. Signed inspections are append-only and stay; what does NOT survive
   * is the item ids, so the printed labels of this category stop resolving —
   * said in the dialog, because that is the cost nobody thinks of.
   */
  const canClear = !sync.enrolled || sync.role === 'superadmin';
  const clearCategory = () => {
    const count = (byCategory[category] ?? []).length;
    if (!count) return;
    const syncing = sync.status === 'synced' || sync.status === 'pending';
    Alert.alert(
      `Clear ${meta.label}?`,
      `All ${count} item${count === 1 ? '' : 's'} in this category will be deleted` +
        (syncing ? ' — on the vessel and on every device aboard, not just this one' : '') +
        '.\n\nTheir photos, certificate links and printed QR labels go with them. Signed ' +
        'inspections stay on record. Other categories are not touched.\n\n' +
        'A copy of the register as it is now is kept in Settings → Data, so this can be rolled back.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Delete ${count} item${count === 1 ? '' : 's'}`,
          style: 'destructive',
          onPress: async () => {
            try {
              await snapshot.takeSnapshot(vessel).catch(() => null);
              await storage.replaceCategory(category, []);
              await reload();
            } catch (e: any) {
              Alert.alert('Could not clear', String(e?.message ?? e));
            }
          },
        },
      ]
    );
  };

  // Tablets: lay item cards out two-per-row (location headers stay full-width).
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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const printSelected = () => {
    // Hand the ids over in the list's own order, so what comes off the roll is
    // stacked the way the screen reads.
    const ids = filtered.filter((it) => selected.has(it.id)).map((it) => it.id);
    stopSelecting();
    nav.navigate('Label', { ids });
  };

  const ItemCard = (e: Extract<ListEntry, { kind: 'row' }>, fill?: boolean) => {
    // Free-tier overflow: locked items are read-only — tap routes to the paywall
    // instead of opening, and they can't be selected for bulk actions.
    const locked = isLocked(e.it.id);
    return (
    <TouchableOpacity
      style={[styles.row, fill && { flex: 1 }, selecting && selected.has(e.it.id) && styles.rowPicked, locked && styles.rowLocked]}
      activeOpacity={0.7}
      onPress={() =>
        locked
          ? nav.navigate('Paywall')
          : selecting
          ? toggle(e.it.id)
          : nav.navigate('ItemDetail', { category, id: e.it.id })
      }
      onLongPress={() => {
        if (locked) { nav.navigate('Paywall'); return; }
        if (selecting) toggle(e.it.id);
        else {
          setSelecting(true);
          setSelected(new Set([e.it.id]));
        }
      }}
    >
      <View style={[styles.bar, { backgroundColor: statusColor(e.status) }]} />
      {selecting ? (
        <MciIcon
          name={selected.has(e.it.id) ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={20}
          color={selected.has(e.it.id) ? COLORS.primary : COLORS.textLight}
          style={{ marginRight: SIZES.sm }}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {[itemNumber(e.it) && `No. ${itemNumber(e.it)}`, typeWithSize(e.it)].filter(Boolean).join(' — ') || 'Item'}
          </Text>
          {e.it.flagged ? (
            <View style={styles.flagBadge}>
              <MciIcon name="flag" size={12} color={COLORS.textWhite} />
            </View>
          ) : null}
          {e.it.attachments && e.it.attachments.length > 0 ? (
            <View style={styles.badge}>
              <MciIcon name="paperclip" size={12} color={COLORS.textLight} />
              {e.it.attachments.length > 1 ? (
                <Text style={styles.badgeText}>{e.it.attachments.length}</Text>
              ) : null}
            </View>
          ) : null}
          {certItemIds.has(e.it.id) ? (
            <View style={styles.badge}>
              <MciIcon name="certificate" size={12} color={COLORS.textLight} />
            </View>
          ) : null}
        </View>
        <Text style={styles.rowSub} numberOfLines={1}>
          {/* Under a deck heading the deck is already said; the location is what is left to say. */}
          {[e.it.serial && `S/N ${e.it.serial}`, deckHeadings ? e.it.position?.trim() : itemLocation(e.it)].filter(Boolean).join(' · ') || '—'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {locked ? (
          <MciIcon name="lock" size={20} color={COLORS.textLight} />
        ) : (
          <>
            {e.date ? <Text style={styles.rowDate}>{formatDate(e.date)}</Text> : null}
            <StatusPill status={e.status} />
          </>
        )}
      </View>
      {/* The round, on the RIGHT, mirroring the expiry bar on the left. Two
          different questions asked of the same item: the left says whether its
          certificate or service is still in date, this one whether the crew has
          walked up to it this month. An item can be perfectly in date and
          uninspected, which is exactly the case a mate needs to see. */}
      <View
        style={[styles.roundBar, { backgroundColor: ROUND_COLOR(e.round, COLORS) }]}
        accessibilityLabel={ROUND_GROUP[e.round]}
      />
    </TouchableOpacity>
    );
  };

  return (
    <Screen contentStyle={{ paddingBottom: 0 }}>
      <View style={styles.head}>
        <CategoryBadge category={category} size={28} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{selecting ? `${selected.size} selected` : meta.label}</Text>
          <Text style={styles.sub}>
            {selecting
              ? 'Tap items to select the labels to print'
              : `${meta.group} · ${(byCategory[category] ?? []).length} items`}
          </Text>
        </View>
        {selecting ? (
          <>
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={() =>
                setSelected(
                  selected.size === filtered.length
                    ? new Set()
                    : new Set(filtered.map((it) => it.id))
                )
              }
            >
              <Text style={styles.ghostBtnText}>
                {selected.size === filtered.length && filtered.length > 0 ? 'None' : 'All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={stopSelecting}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <HelpButton section={2} />
            <TouchableOpacity style={styles.iconBtn} onPress={() => nav.navigate('Scan')}>
              <MciIcon name="qrcode-scan" size={18} color={COLORS.primary} />
            </TouchableOpacity>
            {filtered.length > 0 ? (
              <TouchableOpacity style={styles.iconBtn} onPress={() => setSelecting(true)}>
                <MciIcon name="tag-multiple" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            ) : null}
            {canClear && (byCategory[category] ?? []).length > 0 ? (
              <TouchableOpacity style={styles.iconBtn} onPress={clearCategory} accessibilityLabel={`Clear ${meta.label}`}>
                <MciIcon name="delete-sweep-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.addBtn, { marginLeft: SIZES.sm }]} onPress={addItem}>
              {/* An icon, not a "+" glyph: a font's plus sits on its baseline, not in the
                  middle of its line box, so the text version rode low in the circle. */}
              <MciIcon name="plus" size={26} color={COLORS.textWhite} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {category === 'fifi_ba' && prefs.compressorEnabled ? (
        <TouchableOpacity style={styles.compressorBtn} onPress={() => nav.navigate('Compressor')}>
          <MciIcon name="timer-outline" size={22} color={COLORS.primaryDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.compressorTitle}>BA Compressor log</Text>
            <Text style={styles.compressorSub}>Running-time counter · maintenance / service / inspection</Text>
          </View>
          <Text style={styles.compressorChev}>›</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.controlRow}>
        <TextInput
          style={[styles.search, { flex: 1, marginBottom: 0 }]}
          placeholder="Search type, serial, position…"
          placeholderTextColor={COLORS.textLight}
          value={q}
          onChangeText={setQ}
        />
        <TouchableOpacity style={styles.cycleBtn} onPress={cycleSort} activeOpacity={0.8}>
          <Text style={styles.cycleCaption}>SORT</Text>
          <Text style={styles.cycleValue} numberOfLines={1}>{SORT_LABEL[sortBy]}</Text>
        </TouchableOpacity>
      </View>

      {filtered.length === 0 ? (
        <Empty text="No items. Tap + to add one, or import the workbook from Settings." />
      ) : (
        <FlatList
          data={renderData}
          keyExtractor={(e) => e.key}
          contentContainerStyle={{ paddingBottom: SIZES.xxxl, paddingRight: SCROLLBAR_GUTTER }}
          // No permanent stripe down the right of the list: on web the bar is
          // drawn inside the list's own box and covered the right-hand column.
          showsVerticalScrollIndicator={Platform.OS !== 'web'}
          renderItem={({ item: e }) =>
            e.kind === 'header' ? (
              <View style={styles.posHeader}>
                <MciIcon name={e.icon} size={15} color={COLORS.textLight} />
                <Text style={styles.posHeaderText} numberOfLines={1}>{e.position}</Text>
                <Text style={styles.posHeaderCount}>{e.count}</Text>
              </View>
            ) : e.kind === 'pair' ? (
              <View style={styles.pairRow}>
                {ItemCard(e.left as Extract<ListEntry, { kind: 'row' }>, true)}
                {e.right ? ItemCard(e.right as Extract<ListEntry, { kind: 'row' }>, true) : <View style={{ flex: 1 }} />}
              </View>
            ) : (
              ItemCard(e)
            )
          }
        />
      )}

      {selecting ? (
        <TouchableOpacity
          style={[styles.printBtn, selected.size === 0 && { opacity: 0.4 }]}
          disabled={selected.size === 0}
          onPress={printSelected}
        >
          <MciIcon name="printer" size={18} color={COLORS.textWhite} />
          <Text style={styles.printBtnText}>
            {selected.size === 0
              ? 'Select items to label'
              : `Print ${selected.size} label${selected.size === 1 ? '' : 's'}`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.md, gap: SIZES.sm },
  iconBtn: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: SIZES.radiusRound,
    padding: SIZES.sm,
  },
  ghostBtn: { paddingHorizontal: SIZES.sm, paddingVertical: SIZES.sm },
  ghostBtnText: { color: COLORS.primary, fontWeight: '700' },
  rowPicked: { borderWidth: 1, borderColor: COLORS.primary },
  rowLocked: { opacity: 0.55 },
  printBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SIZES.sm,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginTop: SIZES.sm,
    marginBottom: SIZES.md,
  },
  printBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  emoji: { fontSize: 30 },
  title: { fontSize: SIZES.h3, fontWeight: '700', color: COLORS.textDark },
  sub: { fontSize: SIZES.small, color: COLORS.textLight },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    ...COLORS.glassInput,
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    fontSize: SIZES.body,
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
  cycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardSolid,
  },
  cycleCaption: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '800', letterSpacing: 0.5 },
  cycleValue: { fontSize: SIZES.small, color: COLORS.primaryDark, fontWeight: '700' },
  posHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // The row now starts with a glyph rather than an emoji inside the text.
    gap: SIZES.xs,
    paddingHorizontal: SIZES.sm,
    paddingVertical: 6,
    marginBottom: SIZES.xs,
    marginTop: SIZES.xs,
  },
  posHeaderText: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primaryDark, flex: 1 },
  posHeaderCount: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textLight, marginLeft: SIZES.sm },
  pairRow: { flexDirection: 'row', gap: SIZES.sm, alignItems: 'stretch' },
  compressorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    marginBottom: SIZES.md,
  },
  compressorEmoji: { fontSize: 22 },
  compressorTitle: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primaryDark },
  compressorSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
  compressorChev: { fontSize: SIZES.h3, color: COLORS.primary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    ...COLORS.glassCard,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    // Both edges flush: the expiry bar on the left and the round bar on the
    // right are the same object seen twice, so neither may be inset. The gap
    // between the bars and the text is the bars' own margin.
    paddingRight: 0,
    paddingLeft: 0,
    marginBottom: SIZES.sm,
    overflow: 'hidden',
  },
  bar: { width: 5, alignSelf: 'stretch', marginRight: SIZES.md },
  roundBar: { width: 5, alignSelf: 'stretch', marginLeft: SIZES.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs },
  rowTitle: { fontSize: SIZES.h5, fontWeight: '600', color: COLORS.textDark, flexShrink: 1 },
  badge: { backgroundColor: 'rgba(46,125,153,0.12)', borderRadius: SIZES.radiusSm, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontSize: SIZES.tiny, color: COLORS.primaryDark, fontWeight: '700' },
  // Flag gets a warning-tinted chip (not the teal one) — it means "a human wants a
  // second look", a different signal from the neutral attachment/cert badges.
  flagBadge: { backgroundColor: 'rgba(214,158,46,0.16)', borderRadius: SIZES.radiusSm, paddingHorizontal: 6, paddingVertical: 1 },
  flagBadgeText: { fontSize: SIZES.tiny, fontWeight: '700' },
  rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
  rowDate: { fontSize: SIZES.small, color: COLORS.text, marginBottom: 2 },
});
