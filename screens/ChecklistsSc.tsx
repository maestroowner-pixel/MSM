// ===================================
// Checklists — every round the vessel owes, and whose words it is put in.
//
// WHY THIS EXISTS. The checklists shipped with the app are written to SOLAS and
// the FSS Code, which is the right default and the wrong final answer: a vessel's
// SMS words its own checks, an operator adds ones nobody else asks for, and until
// this screen existed the only way to have your own wording was for us to write
// it into a release. That put a code change between an officer and a question
// they already knew they wanted asked.
//
// A vessel template REPLACES the built-in for its category and period rather than
// sitting beside it (see templatesFor). Two checklists offered for one monthly
// round is a question about which one the round means, and the officer standing
// at the equipment is the worst placed person to answer it.
//
// Editing here cannot reach into the past. Every signed record carries its own
// copy of the questions it was signed against (types/inspection.ts), so this
// screen edits what will be ASKED, never what was ANSWERED — which is the only
// reason it can be handed to an Officer at all.
// ===================================

import React, { useMemo } from 'react';
import { Alert, FlatList, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, CategoryBadge, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP, GROUP_LABEL, GROUP_ORDER, visibleCategories } from '../constants/categories';
import { CategoryKey } from '../types/equipment';
import { InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import {
  ChecklistTemplate,
  Round,
  VESSEL_TEMPLATE_PREFIX,
  roundsFor,
  templateFor,
  vesselRow,
} from '../constants/checklists';
import { uid } from '../utils/id';

/**
 * Which existing round a new one is copied from: the nearest shorter frequency,
 * because a quarterly check is the monthly one with fewer questions far more often
 * than it is a blank page.
 */
function seedPeriod(
  category: CategoryKey,
  templates: ChecklistTemplate[]
): InspectionPeriod | undefined {
  const have = roundsFor(category, templates).map((r) => r.period);
  return have.includes('monthly') ? 'monthly' : have[0];
}

type Row =
  | { kind: 'header'; key: string; header: string }
  /** One frequency for one category — worded here, switched on or off here. */
  | { kind: 'round'; key: string; category: CategoryKey; round: Round }
  /** Frequencies this category has no checklist for at all, offered to be added. */
  | { kind: 'add'; key: string; category: CategoryKey; periods: InspectionPeriod[] };

/**
 * The frequencies a vessel may work to.
 *
 * Quarterly was asked for by a vessel (25 Sep 2026): weekly and monthly alone
 * meant a quarterly check either became a monthly one nobody could complete, or
 * left the app altogether and went back onto paper. Annual is deliberately still
 * out — an annual service is a shore job with a certificate behind it, and the
 * Certificates tab is where that evidence belongs.
 */
const ADDABLE: InspectionPeriod[] = ['weekly', 'monthly', 'quarterly'];



export default function ChecklistsSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { templates, categories: ownCats, setRoundEnabled, saveTemplate } = useData();

  /**
   * An OFFICER may word a check; the crew list stays the Master's.
   *
   * Deliberately one rank lower than Accounts and Crew: wording a check is the
   * work of whoever runs the round, whereas deciding whose signature is valid at
   * all is not. firestore.rules enforces the same split, so a Crew device that
   * got here anyway would be refused by the server rather than by this flag.
   */
  const { role, enrolled } = useSync();
  // A device that has NOT joined a vessel answers to nobody — the same stance
  // Settings takes (`solo`) and signingPolicy takes for the Master's override.
  // Without this a standalone install could not word a check or set its own
  // schedule at all, which is not a rank decision, it is a bug: there is no
  // Master aboard to ask.
  const canEdit = !enrolled || role === 'admin' || role === 'superadmin';

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const group of GROUP_ORDER) {
      // A category the vessel has hidden owes no rounds, so it is not listed
      // here either — one decision, taken once, showing everywhere.
      const inGroup = visibleCategories().filter((c) => c.group === group);
      if (!inGroup.length) continue;
      out.push({ kind: 'header', key: `h:${group}`, header: GROUP_LABEL[group] });
      for (const meta of inGroup) {
        const rounds = roundsFor(meta.key, templates);
        for (const round of rounds) {
          out.push({ kind: 'round', key: `${meta.key}.${round.period}`, category: meta.key, round });
        }
        // A vessel whose SMS asks for a weekly EEBD check or a quarterly one on
        // its escape routes adds it here; it is not built in, because every other
        // vessel would then owe it too.
        const periods = ADDABLE.filter((p) => !rounds.some((r) => r.period === p));
        if (periods.length) out.push({ kind: 'add', key: `add:${meta.key}`, category: meta.key, periods });
      }
    }
    return out;
    // `ownCats` for the same reason as the equipment grid: CATEGORIES is mutated
    // in place, so a heading added by the vessel changes nothing React can see.
  }, [templates, ownCats]);

  /**
   * Switching a round off is a schedule decision, not an edit, so it says what it
   * means to the trail before it happens: nothing signed is touched, and the
   * report stops EXPECTING those items rather than forgetting the ones it has.
   */
  const toggleRound = (category: CategoryKey, round: Round) => {
    if (round.on) {
      const meta = CATEGORY_MAP[category];
      Alert.alert(
        `Stop the ${PERIOD_LABEL[round.period].toLowerCase()} round?`,
        `${meta?.label ?? 'This category'} will no longer be offered a ${PERIOD_LABEL[
          round.period
        ].toLowerCase()} inspection, and the ${PERIOD_LABEL[
          round.period
        ].toLowerCase()} report will stop counting it as due. Inspections already signed stay on file ` +
          'and still print. You can switch it back on at any time.',
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Switch off',
            style: 'destructive',
            onPress: () => void setRoundEnabled(category, round.period, false),
          },
        ]
      );
      return;
    }
    void setRoundEnabled(category, round.period, true);
  };

  /**
   * Give a category a frequency it does not have — one tap, not a form.
   *
   * The round starts from the checks the category already has, because a
   * quarterly check is the monthly one with fewer questions far more often than it
   * is a blank page, and typing twenty-seven lines back in is how a good idea
   * turns into a job nobody finishes. It is added ready to use; wording it is
   * offered, not required.
   */
  const addRound = async (category: CategoryKey, period: InspectionPeriod, thenEdit: boolean) => {
    const from = seedPeriod(category, templates);
    const src = templateFor(category, from ?? 'monthly', templates);
    const label = CATEGORY_MAP[category]?.label ?? src.title.split(' — ')[0];
    const row = vesselRow(category, period, templates);
    await saveTemplate({
      // Reuse the vessel's row for this period if one is lying about (a round
      // added and later withdrawn), so the list does not grow a second row for
      // the same question.
      id: row?.id ?? `${VESSEL_TEMPLATE_PREFIX}${category}.${period}.${uid()}`,
      version: (row?.version ?? 0) + 1,
      category,
      period,
      title: `${label} — ${PERIOD_LABEL[period].toLowerCase()}`,
      lines: src.lines.map((l) => ({ ...l })),
      off: false,
      standard: false,
    });
    if (thenEdit) nav.navigate('ChecklistEdit', { category, period });
  };

  const confirmAddRound = (category: CategoryKey, period: InspectionPeriod) => {
    const label = CATEGORY_MAP[category]?.label ?? 'this category';
    const p = PERIOD_LABEL[period].toLowerCase();
    Alert.alert(
      `Add a ${p} round?`,
      `${label} will owe a ${p} inspection from now on, starting from the checks it already has — ` +
        `so it is ready to use straight away. Word it whenever you like, and the switch on its row ` +
        `takes it off again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => void addRound(category, period, false) },
        { text: 'Add and word it', onPress: () => void addRound(category, period, true) },
      ]
    );
  };

  // Only wordings in force — a row that merely switches a round off, or one that
  // withdrew a wording, is a decision and not a checklist this vessel wrote.
  const ownCount = templates.filter((t) => !t.off && !t.standard && t.lines?.length).length;
  const offCount = templates.filter((t) => t.off).length;

  return (
    <Screen>
      <ScreenTitle
        title="Checklists"
        subtitle={
          [
            ownCount ? `${ownCount} written by this vessel` : 'The standard rounds',
            offCount ? `${offCount} switched off` : null,
            ownCount || offCount ? null : 'open one to word it, or switch one off',
          ]
            .filter(Boolean)
            .join(' · ')
        }
      />

      {!canEdit ? (
        <Card>
          <Label>Read only</Label>
          <Text style={styles.note}>
            An Officer or the Master edits the vessel's checklists. You can read every round
            here — this is what will be asked when you carry one out.
          </Text>
        </Card>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ paddingBottom: SIZES.xxl }}
        renderItem={({ item }) => {
          if (item.kind === 'header') return <Label style={styles.group}>{item.header}</Label>;

          if (item.kind === 'add') {
            if (!canEdit) return null;
            return (
              <View style={styles.addRow}>
                <Text style={styles.addLabel}>Add a round</Text>
                {item.periods.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={styles.addPill}
                    hitSlop={6}
                    accessibilityLabel={`Add a ${PERIOD_LABEL[p].toLowerCase()} round`}
                    onPress={() => confirmAddRound(item.category, p)}
                  >
                    <Text style={styles.addPillText}>＋ {PERIOD_LABEL[p]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          }

          const { round } = item;
          return (
            /* The row is a View with TWO controls, not a Touchable containing a
               Switch. Nesting them means one tap can do both things: on
               react-native-web the click on the switch bubbles to the row and the
               screen navigates away from the change just made (the same trap as
               the rename sheet's backdrop in AccountsSc). Opening the wording and
               setting the schedule are separate taps because they are separate
               decisions. */
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rowMain}
                onPress={() =>
                  nav.navigate('ChecklistEdit', { category: item.category, period: round.period })
                }
                activeOpacity={0.7}
              >
              <CategoryBadge category={item.category} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, !round.on && styles.rowOff]} numberOfLines={1}>
                  {round.template.title}
                </Text>
                <Text style={styles.rowSub}>
                  {round.on
                    ? `${PERIOD_LABEL[round.period]} · ${round.template.lines.length} lines` +
                      (round.own ? " · this vessel's" : '')
                    : `${PERIOD_LABEL[round.period]} · not required on this vessel`}
                </Text>
              </View>
              {round.own && round.on ? (
                <View style={styles.ownPill}>
                  {/* "Added" for a round the app does not ship at all, "Edited" for
                      one whose words this vessel changed — the two are different
                      facts and the pill is the only place either is said. */}
                  <Text style={styles.ownPillText}>{round.added ? 'Added' : 'Edited'}</Text>
                </View>
              ) : null}
              <MciIcon name="chevron-right" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
              {/* The switch is the schedule: whether this ship owes this frequency
                  for this category at all. Wording it is the row beside it. */}
              <Switch
                value={round.on}
                disabled={!canEdit}
                onValueChange={() => toggleRound(item.category, round)}
                trackColor={{ true: COLORS.primary, false: COLORS.border }}
              />
            </View>
          );
        }}
      />
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    note: { color: COLORS.textLight, fontSize: SIZES.small, lineHeight: 17, paddingTop: SIZES.xs },
    group: { marginTop: SIZES.lg, marginBottom: SIZES.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      paddingVertical: SIZES.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    /** The tappable part: everything except the schedule switch. */
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    rowTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.text },
    rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    ownPill: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 2,
    },
    ownPillText: { color: COLORS.textWhite, fontSize: SIZES.tiny, fontWeight: '800' },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SIZES.sm,
      paddingBottom: SIZES.md,
      paddingLeft: 30 + SIZES.md,
    },
    addLabel: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '700' },
    rowOff: { color: COLORS.textLight, textDecorationLine: 'line-through' },
    addPill: {
      borderRadius: SIZES.radiusRound,
      borderWidth: 1,
      borderColor: COLORS.primary,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 2,
    },
    addPillText: { color: COLORS.primary, fontSize: SIZES.tiny, fontWeight: '800' },
  });
