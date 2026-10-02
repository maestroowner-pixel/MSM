// ===================================
// QR labels (batch) — print the stickers for a whole category, deck or group.
//
// The multi-select on a category list labels one category at a time, with a
// thumb; fitting out a vessel is a few hundred stickers in an afternoon, and
// the person doing it walks DECKS, not categories. This screen picks the set —
// group, categories, decks — shows how many that is, and hands the ids to the
// Label screen, which already knows how to put them on a roll, an A4 sheet, a
// PDF or the Xprinter. Nothing about the sticker itself is decided here.
//
// Not the Master's alone. Printing writes nothing to the register, so there is
// nothing here a Crew device could break — and the bosun with the label printer
// is exactly who prints them.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, CategoryBadge, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { CATEGORIES, visibleCategories } from '../constants/categories';
import { CategoryKey, Group } from '../types/equipment';
import { SIZES, Palette } from '../theme';
import { listDecks, selectLabelItems } from '../services/labelBatch';

type GroupPick = Group | 'ALL';

export default function LabelBatchSc() {
  const { flat, byCategory, categories: ownCats } = useData();
  const nav = useNavigation<any>();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { width } = useWindowDimensions();
  const twoCol = width >= 600;

  const [group, setGroup] = useState<GroupPick>('ALL');

  // Decks come from the register, not a list — the vessel's own words.
  const decks = useMemo(() => listDecks(flat), [flat]);
  const [deckSel, setDeckSel] = useState<Set<string> | null>(null); // null = every deck
  const deckOn = (key: string) => deckSel === null || deckSel.has(key);
  const toggleDeck = (key: string) => {
    setDeckSel((prev) => {
      const next = new Set(prev ?? decks.map((d) => d.key));
      next.has(key) ? next.delete(key) : next.add(key);
      // Everything back on is the same as no filter — keep it that way so the
      // summary can say "all decks" instead of listing them.
      return next.size === decks.length ? null : next;
    });
  };

  // Categories in the chosen group that have anything to print. `ownCats` in the
  // deps for the same reason as CategoriesSc: CATEGORIES is mutated in place when
  // a vessel adds a heading of its own.
  const inGroup = useMemo(
    () =>
      visibleCategories().filter(
        (c) => (group === 'ALL' || c.group === group) && (byCategory[c.key] ?? []).length > 0
      ),
    [group, byCategory, ownCats]
  );

  // Default: everything in the group. Re-filled when the group changes, until
  // the user has picked by hand within it.
  const [catSel, setCatSel] = useState<Set<CategoryKey>>(() => new Set(inGroup.map((c) => c.key)));
  const touched = useRef(false);
  useEffect(() => {
    touched.current = false;
    setCatSel(new Set(inGroup.map((c) => c.key)));
  }, [group]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!touched.current) setCatSel(new Set(inGroup.map((c) => c.key)));
  }, [inGroup]);

  const allCats = inGroup.length > 0 && inGroup.every((c) => catSel.has(c.key));
  const toggleCat = (key: CategoryKey) => {
    touched.current = true;
    setCatSel((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };
  const toggleAllCats = () => {
    touched.current = true;
    setCatSel(allCats ? new Set() : new Set(inGroup.map((c) => c.key)));
  };

  const query = useMemo(
    () => ({
      group: group === 'ALL' ? undefined : group,
      categories: [...catSel],
      decks: deckSel ? [...deckSel] : undefined,
    }),
    [group, catSel, deckSel]
  );

  // The list the Label screen will print — the count on the button IS its length.
  const picked = useMemo(() => selectLabelItems(flat, query), [flat, query]);

  // Per-category counts under the CURRENT deck filter, so a chip that says
  // "12 items" says how many labels ticking it adds.
  const countFor = (key: CategoryKey) =>
    selectLabelItems(byCategory[key] ?? [], { decks: query.decks }).length;

  const print = () => {
    if (!picked.length) return;
    nav.navigate('Label', { ids: picked.map((it) => it.id) });
  };

  if (!flat.length) {
    return (
      <Screen scroll>
        <ScreenTitle title="QR labels" subtitle="Print stickers for many items at once" help={7} />
        <Card>
          <Text style={styles.empty}>No equipment yet. Import or add items first, then print their labels.</Text>
        </Card>
      </Screen>
    );
  }

  const deckSummary =
    deckSel === null
      ? 'all decks'
      : deckSel.size === 0
        ? 'no deck selected'
        : decks.filter((d) => deckSel.has(d.key)).map((d) => d.label).join(', ');

  return (
    <Screen scroll>
      <ScreenTitle title="QR labels" subtitle="Print stickers for a category, a deck or a whole group at once" help={7} />

      <Text style={styles.sectionLabel}>Equipment group</Text>
      <View style={styles.chipRow}>
        {(['ALL', 'LSA', 'FFE', 'OTHER'] as GroupPick[]).map((g) => (
          <TouchableOpacity key={g} style={[styles.chip, group === g && styles.chipOn]} onPress={() => setGroup(g)}>
            <Text style={[styles.chipText, group === g && styles.chipTextOn]}>
              {g === 'ALL' ? 'All' : g === 'OTHER' ? 'Other' : g}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {decks.length ? (
        <>
          <View style={styles.headRow}>
            <Text style={styles.sectionLabel}>Decks</Text>
            {deckSel !== null ? (
              <TouchableOpacity onPress={() => setDeckSel(null)} hitSlop={8}>
                <Text style={styles.selectAll}>All decks</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.wrapRow}>
            {decks.map((d) => {
              const on = deckOn(d.key);
              return (
                <TouchableOpacity key={d.key} style={[styles.deckChip, on && styles.chipOn]} onPress={() => toggleDeck(d.key)}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                    {d.label}
                    <Text style={[styles.chipCount, on && styles.chipTextOn]}> {d.count}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.headRow}>
        <Text style={styles.sectionLabel}>
          Categories ({catSel.size}/{inGroup.length})
        </Text>
        <TouchableOpacity onPress={toggleAllCats} hitSlop={8}>
          <Text style={styles.selectAll}>{allCats ? 'Clear all' : 'Select all'}</Text>
        </TouchableOpacity>
      </View>

      <View style={twoCol ? styles.gridWrap : undefined}>
        {inGroup.map((c) => {
          const on = catSel.has(c.key);
          const count = countFor(c.key);
          return (
            <TouchableOpacity
              key={c.key}
              activeOpacity={0.8}
              onPress={() => toggleCat(c.key)}
              style={[styles.panel, on && styles.panelOn, twoCol && styles.panelTablet, count === 0 && { opacity: 0.5 }]}
            >
              <CategoryBadge category={c.key} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={styles.panelTitle} numberOfLines={1}>{c.label}</Text>
                <Text style={styles.panelSub}>
                  {count} label{count === 1 ? '' : 's'}
                  {deckSel !== null && count !== (byCategory[c.key]?.length ?? 0) ? ` of ${byCategory[c.key]?.length ?? 0}` : ''}
                </Text>
              </View>
              <View style={[styles.check, on && styles.checkOn]}>
                {on ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={[styles.printBtn, !picked.length && { opacity: 0.4 }]} disabled={!picked.length} onPress={print}>
        <MciIcon name="printer" size={18} color={COLORS.textWhite} />
        <Text style={styles.printText}>
          {picked.length ? `Print ${picked.length} label${picked.length === 1 ? '' : 's'}` : 'Nothing to print'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.help}>
        {picked.length} label{picked.length === 1 ? '' : 's'} — {deckSummary}, {catSel.size} categor{catSel.size === 1 ? 'y' : 'ies'}.
        Labels print deck by deck, then by category and item number, so a roll comes off in the order you walk
        the ship. The next screen chooses the sticker size and where to print: the Xprinter, a thermal roll,
        an A4 sheet on the office printer, or a PDF for another printer's app.
      </Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  sectionLabel: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '700' },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.sm, marginTop: SIZES.sm },
  selectAll: { fontSize: SIZES.small, color: COLORS.primary, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.md, marginTop: SIZES.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.md },
  chip: {
    flex: 1,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  deckChip: {
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radiusMd,
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    maxWidth: '100%',
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontWeight: '600', color: COLORS.text, fontSize: SIZES.small },
  chipCount: { fontWeight: '400', color: COLORS.textLight, fontSize: SIZES.tiny },
  chipTextOn: { color: COLORS.textWhite },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SIZES.sm,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radiusMd,
    backgroundColor: COLORS.cardSolid,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SIZES.sm,
  },
  panelOn: { borderColor: COLORS.primary },
  panelTablet: { flexBasis: '48%', flexGrow: 1, marginBottom: 0 },
  panelTitle: { fontSize: SIZES.h5, color: COLORS.textDark, fontWeight: '600' },
  panelSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardSolid,
  },
  checkOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkMark: { color: COLORS.textWhite, fontSize: 14, fontWeight: '800' },
  printBtn: {
    flexDirection: 'row',
    gap: SIZES.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.lg,
  },
  printText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
  help: { marginTop: SIZES.lg, color: COLORS.textLight, fontSize: SIZES.body, lineHeight: 20 },
  empty: { fontSize: SIZES.body, color: COLORS.textLight, lineHeight: 20 },
});
