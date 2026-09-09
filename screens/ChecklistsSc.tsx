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
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, CategoryBadge, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORIES } from '../constants/categories';
import { CategoryKey } from '../types/equipment';
import { InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import { ChecklistTemplate, isVesselTemplate, periodsFor, templateFor } from '../constants/checklists';

type Row = {
  key: string;
  category: CategoryKey;
  period: InspectionPeriod;
  template: ChecklistTemplate;
};

const GROUP_LABEL: Record<string, string> = {
  LSA: 'Life-Saving Appliances',
  FFE: 'Fire-Fighting Equipment',
  OTHER: 'Other equipment',
};

export default function ChecklistsSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { templates, categories: ownCats } = useData();

  /**
   * An OFFICER may word a check; the crew list stays the Master's.
   *
   * Deliberately one rank lower than Accounts and Crew: wording a check is the
   * work of whoever runs the round, whereas deciding whose signature is valid at
   * all is not. firestore.rules enforces the same split, so a Crew device that
   * got here anyway would be refused by the server rather than by this flag.
   */
  const { role } = useSync();
  const canEdit = role === 'admin' || role === 'superadmin';

  const rows = useMemo<(Row | { key: string; header: string })[]>(() => {
    const out: (Row | { key: string; header: string })[] = [];
    for (const group of ['LSA', 'FFE', 'OTHER'] as const) {
      const inGroup = CATEGORIES.filter((c) => c.group === group);
      if (!inGroup.length) continue;
      out.push({ key: `h:${group}`, header: GROUP_LABEL[group] });
      for (const meta of inGroup) {
        for (const period of periodsFor(meta.key, templates)) {
          out.push({
            key: `${meta.key}.${period}`,
            category: meta.key,
            period,
            template: templateFor(meta.key, period, templates),
          });
        }
      }
    }
    return out;
    // `ownCats` for the same reason as the equipment grid: CATEGORIES is mutated
    // in place, so a heading added by the vessel changes nothing React can see.
  }, [templates, ownCats]);

  const ownCount = templates.length;

  return (
    <Screen>
      <ScreenTitle
        title="Checklists"
        subtitle={
          ownCount
            ? `${ownCount} written by this vessel; the rest are the standard rounds`
            : 'The standard rounds — open one to word it yourself'
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
          if ('header' in item) return <Label style={styles.group}>{item.header}</Label>;
          const own = isVesselTemplate(item.template);
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                nav.navigate('ChecklistEdit', { category: item.category, period: item.period })
              }
              activeOpacity={0.7}
            >
              <CategoryBadge category={item.category} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.template.title}
                </Text>
                <Text style={styles.rowSub}>
                  {PERIOD_LABEL[item.period]} · {item.template.lines.length} lines
                  {own ? " · this vessel's" : ''}
                </Text>
              </View>
              {own ? (
                <View style={styles.ownPill}>
                  <Text style={styles.ownPillText}>Edited</Text>
                </View>
              ) : null}
              <MciIcon name="chevron-right" size={22} color={COLORS.textLight} />
            </TouchableOpacity>
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
      gap: SIZES.md,
      paddingVertical: SIZES.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    rowTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.text },
    rowSub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    ownPill: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 2,
    },
    ownPillText: { color: COLORS.textWhite, fontSize: SIZES.tiny, fontWeight: '800' },
  });
