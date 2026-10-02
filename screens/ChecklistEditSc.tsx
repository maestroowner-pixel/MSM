// ===================================
// Checklist editor — word one round the way this vessel words it.
//
// THE RULE THAT MATTERS. A line's id is generated once and never changes, no
// matter how the text is re-worded. Ids are the keys of every stored `results`
// map, so deriving one from the text — the obvious shortcut — would mean that
// fixing a typo in June detached every March answer from the question it
// answered. Re-word freely; never re-use an id for a different question.
//
// Saving writes a NEW template id the first time (`v.<category>.<period>.<uid>`)
// rather than taking over the built-in's. Records signed before line snapshots
// existed still resolve their wording through `templateById`, and if a vessel's
// edit sat on the built-in id those old records would silently start displaying
// today's words under yesterday's signature.
//
// "Use the standard checklist again" deletes the vessel's copy. That is safe for
// the same reason everything here is: each signed record carries its own copy of
// the questions, so nothing in the trail depends on this row surviving.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CATEGORY_MAP } from '../constants/categories';
import { CategoryKey } from '../types/equipment';
import { InspectionPeriod, PERIOD_LABEL } from '../types/inspection';
import {
  ChecklistLine,
  ChecklistTemplate,
  VESSEL_TEMPLATE_PREFIX,
  isVesselTemplate,
  templateFor,
  vesselRow,
} from '../constants/checklists';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';

export default function ChecklistEditSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { templates, saveTemplate, removeTemplate } = useData();
  const { role } = useSync();
  const canEdit = role === 'admin' || role === 'superadmin';

  const category: CategoryKey = route.params?.category;
  const period: InspectionPeriod = route.params?.period ?? 'monthly';
  const current = useMemo(
    () => templateFor(category, period, templates),
    [category, period, templates]
  );
  const isOwn = isVesselTemplate(current);
  /**
   * The vessel's row for this (category, period), in force or not.
   *
   * Saving reuses it rather than writing a second one, and that matters for more
   * than tidiness: the row also carries whether the round is switched ON
   * (`off`), so a fresh row would quietly restore a round the Master had stopped.
   */
  const row = useMemo(() => vesselRow(category, period, templates), [category, period, templates]);
  // No standard checklist exists for this period: the vessel is ADDING a round
  // (a weekly EEBD check, say), not rewording one. Removing it removes the round.
  const builtIn = templateFor(category, period);
  const noStandard = builtIn.id.endsWith('.generic');
  const adding = !isOwn && noStandard;
  // Start a new round from the category's existing checks rather than from the
  // generic lines — an EEBD weekly is the EEBD monthly with fewer questions.
  const seed = useMemo(() => {
    const from: InspectionPeriod | undefined = route.params?.seedFrom;
    if (!adding || !from) return current;
    const src = templateFor(category, from, templates);
    const label = CATEGORY_MAP[category]?.label ?? src.title.split(' — ')[0];
    return { ...current, title: `${label} — ${PERIOD_LABEL[period].toLowerCase()}`, lines: src.lines };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seeded from whatever is in force — the vessel's own if it has one, the
  // built-in if not. Nobody starts from a blank page: in practice a vessel
  // changes three lines out of thirty, and typing the other twenty-seven back in
  // is how a good idea turns into a job nobody finishes.
  const [title, setTitle] = useState(seed.title);
  const [lines, setLines] = useState<ChecklistLine[]>(seed.lines.map((l) => ({ ...l })));
  // A round being added has nothing saved yet, so it is saveable as it stands.
  const [dirty, setDirty] = useState(adding);

  const touch = () => setDirty(true);

  const setLineText = (id: string, text: string) => {
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, text } : l)));
    touch();
  };

  const addLine = () => {
    // A generated id, never one derived from the text — see the module header.
    setLines((ls) => [...ls, { id: `c_${uid()}`, text: '' }]);
    touch();
  };

  const removeLine = (id: string) => {
    setLines((ls) => ls.filter((l) => l.id !== id));
    touch();
  };

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= lines.length) return;
    setLines((ls) => {
      const next = [...ls];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    touch();
  };

  const onSave = async () => {
    const clean = lines.map((l) => ({ ...l, text: l.text.trim() })).filter((l) => l.text);
    if (!clean.length) {
      Alert.alert('Nothing to ask', 'A checklist needs at least one line.');
      return;
    }
    const next: ChecklistTemplate = {
      // Keep the id once it exists: it is what already-signed records point at,
      // and what the other devices are merging against.
      id: row?.id ?? `${VESSEL_TEMPLATE_PREFIX}${category}.${period}.${uid()}`,
      // Never backwards, even when the row currently in force is the built-in:
      // a record stores the version it was signed against, and re-using an
      // earlier number for a later set of questions would make that a lie.
      version: row ? Math.max(row.version ?? 1, current.version) + 1 : 1,
      category,
      period,
      title: title.trim() || current.title,
      lines: clean,
      // Saving a wording puts it in force; whether the ship owes this round at
      // all is the Checklists screen's switch, and is left exactly as it was.
      off: row?.off,
    };
    await saveTemplate(next);
    goBackOr(nav);
  };

  const onReset = () => {
    Alert.alert(
      noStandard ? `Remove the ${PERIOD_LABEL[period].toLowerCase()} round?` : 'Use the standard checklist again?',
      (noStandard
        ? 'This vessel added this round; removing it means it is no longer asked or reported. '
        : 'This vessel’s wording is removed and the round goes back to the checklist the app ships. ') +
        'Inspections already signed are untouched — each one carries the questions it was signed against.',
      [
        { text: 'Keep ours', style: 'cancel' },
        {
          text: noStandard ? 'Remove' : 'Use the standard',
          style: 'destructive',
          onPress: async () => {
            await removeTemplate(current.id);
            goBackOr(nav);
          },
        },
      ]
    );
  };

  const meta = CATEGORY_MAP[category];

  return (
    <Screen>
      <ScreenTitle
        title={meta?.label ?? 'Checklist'}
        subtitle={`${PERIOD_LABEL[period]} round · ${lines.length} lines`}
      />

      <Card>
        <Label>Title</Label>
        <TextInput
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            touch();
          }}
          editable={canEdit}
          style={styles.input}
          placeholder="Monthly check"
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={styles.note}>
          {adding
            ? `A new ${PERIOD_LABEL[period].toLowerCase()} round for ${meta?.label ?? 'this category'}, ` +
              'started from its existing checks. Remove or reword lines, then save — from then on it is ' +
              'offered when inspecting and appears in the ' + PERIOD_LABEL[period].toLowerCase() + ' report.'
            : isOwn
            ? 'This vessel wrote this checklist. Editing it changes what the next round asks; ' +
              'rounds already signed keep the questions they were signed against.'
            : 'This is the standard checklist. Saving any change makes a copy for this vessel — ' +
              'the standard one stays available underneath.'}
        </Text>
      </Card>

      <Label style={styles.linesLabel}>Lines</Label>
      <ScrollView keyboardShouldPersistTaps="handled">
        {lines.map((line, i) => (
          <View key={line.id} style={styles.lineRow}>
            <View style={styles.moveCol}>
              <TouchableOpacity onPress={() => move(i, -1)} disabled={!canEdit || i === 0} hitSlop={6}>
                <MciIcon
                  name="chevron-up"
                  size={20}
                  color={i === 0 ? COLORS.border : COLORS.textLight}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => move(i, 1)}
                disabled={!canEdit || i === lines.length - 1}
                hitSlop={6}
              >
                <MciIcon
                  name="chevron-down"
                  size={20}
                  color={i === lines.length - 1 ? COLORS.border : COLORS.textLight}
                />
              </TouchableOpacity>
            </View>
            <TextInput
              value={line.text}
              onChangeText={(v) => setLineText(line.id, v)}
              editable={canEdit}
              multiline
              style={[styles.input, styles.lineInput]}
              placeholder="What is checked"
              placeholderTextColor={COLORS.textLight}
            />
            {canEdit ? (
              <TouchableOpacity onPress={() => removeLine(line.id)} hitSlop={8}>
                <MciIcon name="close" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {canEdit ? (
          <TouchableOpacity style={styles.addBtn} onPress={addLine}>
            <MciIcon name="plus" size={18} color={COLORS.primary} />
            <Text style={styles.addBtnText}>Add a line</Text>
          </TouchableOpacity>
        ) : null}

        {canEdit ? (
          <TouchableOpacity
            style={[styles.saveBtn, !dirty && { opacity: 0.5 }]}
            onPress={onSave}
            disabled={!dirty}
          >
            <Text style={styles.saveBtnText}>Save for this vessel</Text>
          </TouchableOpacity>
        ) : null}

        {canEdit && isOwn ? (
          <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
            <Text style={styles.resetBtnText}>
              {noStandard ? `Remove this ${PERIOD_LABEL[period].toLowerCase()} round` : 'Use the standard checklist again'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    input: {
      backgroundColor: COLORS.card,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      color: COLORS.text,
      fontSize: SIZES.body,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
    },
    note: { color: COLORS.textLight, fontSize: SIZES.small, lineHeight: 17, paddingTop: SIZES.sm },
    linesLabel: { marginTop: SIZES.lg, marginBottom: SIZES.xs },
    lineRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm },
    moveCol: { alignItems: 'center' },
    lineInput: { flex: 1, minHeight: 44 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SIZES.xs,
      paddingVertical: SIZES.md,
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: COLORS.primary,
      marginTop: SIZES.xs,
    },
    addBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body },
    saveBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.md,
      alignItems: 'center',
      marginTop: SIZES.lg,
    },
    saveBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.body },
    resetBtn: {
      marginTop: SIZES.md,
      paddingVertical: SIZES.sm,
      alignItems: 'center',
    },
    resetBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small },
  });
