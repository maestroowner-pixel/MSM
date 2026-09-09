// ===================================
// Categories — the headings this vessel keeps its equipment under.
//
// The app ships 23, written from the LSA/FFE inventories every ship carries.
// They are not the whole job: a vessel that inspects emergency lighting, escape
// routes, alarm panels or anything else its SMS names has nowhere to put those
// but "Other Safety Equipment", where a hundred unrelated items pile up under
// one heading and the monthly list stops being readable.
//
// A heading added here behaves like any other: its own list, its own QR labels,
// its own checklists (Settings → Checklists), its own line in the reports.
//
// DELETING A HEADING DOES NOT DELETE ITS ITEMS. They stay in storage, and adding
// the heading back brings them straight back. Tidying up the list must not be a
// way to destroy a hundred inspected items — with signed history pointing at
// them — by tapping one button.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette, COLORS as THEME_COLORS } from '../theme';
import {
  CategoryMeta,
  GROUP_COLORS,
  VESSEL_CATEGORY_PREFIX,
  uniqueSheetName,
} from '../constants/categories';
import { Group } from '../types/equipment';
import { uid } from '../utils/id';

const GROUP_LABEL: Record<Group, string> = {
  LSA: 'Life-Saving',
  FFE: 'Fire-Fighting',
  OTHER: 'Other',
};

/**
 * The same glyph set the built-in categories draw from (MaterialCommunityIcons),
 * NOT emoji: a heading a vessel added sits in the same grid as the twenty-three
 * that ship with the app, and an emoji beside them reads as a different class of
 * thing — which is precisely what it must not be.
 *
 * Every name here is checked to exist in @mdi/js, because the web build renders
 * these as SVG paths and silently substitutes a question mark for a name it does
 * not know. Add to this list only after checking the same way.
 *
 * Kept short on purpose. A picker of three hundred icons is a decision nobody
 * wants at 0300; these cover the rounds vessels actually asked us for.
 */
const ICONS = [
  'toolbox',
  'lightbulb-on-outline',
  'ceiling-light',
  'exit-run',
  'door-open',
  'stairs',
  'sign-direction',
  'bell-ring-outline',
  'alarm-light-outline',
  'ladder',
  'power-plug-outline',
  'battery-charging',
  'flashlight',
  'hard-hat',
  'engine-outline',
  'water-pump',
  'pipe-valve',
  'gauge',
  'anchor',
  'shield-check-outline',
];

export default function CategoriesEditSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { categories, byCategory, saveVesselCategory, removeVesselCategory } = useData();
  const { role } = useSync();
  const canEdit = role === 'admin' || role === 'superadmin';

  const [label, setLabel] = useState('');
  const [group, setGroup] = useState<Group>('OTHER');
  const [icon, setIcon] = useState(ICONS[0]);
  const [editing, setEditing] = useState<string | null>(null);

  const reset = () => {
    setLabel('');
    setGroup('OTHER');
    setIcon(ICONS[0]);
    setEditing(null);
  };

  const onSave = async () => {
    const name = label.trim();
    if (!name) {
      Alert.alert('Name it first', 'A heading needs a name — "Emergency Lighting", say.');
      return;
    }
    const meta: CategoryMeta = {
      // Generated once and never derived from the name: the key is written onto
      // every item and every inspection in this category, so renaming the
      // heading must not orphan them.
      key: editing ?? `${VESSEL_CATEGORY_PREFIX}${uid()}`,
      label: name,
      short: name.length > 12 ? `${name.slice(0, 11)}…` : name,
      group,
      color: GROUP_COLORS[group],
      icon,
      // A worksheet name, so the heading appears in the blank import template and
      // the importer can find it — without one, the only way to fill a new
      // heading is to add every item by hand. It follows the label rather than
      // the key because it is what a person reads on an Excel tab; the key, which
      // nothing may rename, is what the items actually point at.
      sheet: uniqueSheetName(name, editing ?? undefined),
      // Kept in step for the few places that still render the emoji form; the
      // grid, the badges and the reports all use `icon`.
      emoji: '🧰',
      // Routine vessel checks are driven by when they were last done, not by a
      // printed expiry — an escape route has no expiry date.
      dateField: 'nextInspection',
    };
    await saveVesselCategory(meta);
    reset();
  };

  const onEdit = (c: CategoryMeta) => {
    setEditing(String(c.key));
    setLabel(c.label);
    setGroup(c.group);
    setIcon(c.icon);
  };

  const onDelete = (c: CategoryMeta) => {
    const count = (byCategory as any)[c.key]?.length ?? 0;
    Alert.alert(
      `Remove "${c.label}"?`,
      count
        ? `The heading goes, and the ${count} item${count === 1 ? '' : 's'} under it stay in storage ` +
          'along with their inspection history. Adding the heading back brings them back.'
        : 'The heading is removed. Nothing else changes.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeVesselCategory(String(c.key));
            if (editing === String(c.key)) reset();
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <ScreenTitle
        title="Categories"
        subtitle={
          categories.length
            ? `${categories.length} added by this vessel, on top of the 23 built in`
            : 'Add headings of your own, on top of the 23 built in'
        }
      />

      {!canEdit ? (
        <Card>
          <Label>Read only</Label>
          <Text style={styles.note}>An Officer or the Master adds headings.</Text>
        </Card>
      ) : (
        <Card>
          <Label>{editing ? 'Rename this heading' : 'New heading'}</Label>
          <TextInput
            value={label}
            onChangeText={setLabel}
            style={styles.input}
            placeholder="Emergency Lighting"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.fieldLabel}>Group</Text>
          <View style={styles.chipRow}>
            {(['LSA', 'FFE', 'OTHER'] as Group[]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.chip, group === g && { backgroundColor: GROUP_COLORS[g] }]}
                onPress={() => setGroup(g)}
              >
                <Text style={[styles.chipText, group === g && { color: THEME_COLORS.textWhite }]}>
                  {GROUP_LABEL[g]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.note}>
            The group decides which report the heading is printed in — LSA, FFE, or Other.
          </Text>

          <Text style={styles.fieldLabel}>Icon</Text>
          <View style={styles.chipRow}>
            {ICONS.map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.iconChip, icon === n && styles.iconChipOn]}
                onPress={() => setIcon(n)}
              >
                <MciIcon
                  name={n}
                  size={22}
                  color={icon === n ? GROUP_COLORS[group] : COLORS.textLight}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formBtns}>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
              <Text style={styles.saveBtnText}>{editing ? 'Save changes' : 'Add heading'}</Text>
            </TouchableOpacity>
            {editing ? (
              <TouchableOpacity style={styles.cancelBtn} onPress={reset}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
      )}

      <Label style={styles.listLabel}>This vessel's headings</Label>
      <FlatList
        data={categories}
        keyExtractor={(c) => String(c.key)}
        ListEmptyComponent={<Empty text="None yet — the 23 built-in categories are all in use." />}
        renderItem={({ item }) => {
          const count = (byCategory as any)[item.key]?.length ?? 0;
          return (
            <View style={styles.row}>
              <MciIcon name={item.icon} size={22} color={GROUP_COLORS[item.group]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.label}</Text>
                <Text style={styles.rowSub}>
                  {GROUP_LABEL[item.group]} · {count} item{count === 1 ? '' : 's'}
                </Text>
              </View>
              {canEdit ? (
                <>
                  <TouchableOpacity onPress={() => onEdit(item)} hitSlop={8}>
                    <MciIcon name="pencil" size={20} color={COLORS.textLight} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onDelete(item)} hitSlop={8}>
                    <MciIcon name="close" size={20} color={COLORS.danger} />
                  </TouchableOpacity>
                </>
              ) : null}
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
    fieldLabel: {
      color: COLORS.textLight,
      fontSize: SIZES.small,
      fontWeight: '700',
      marginTop: SIZES.md,
      marginBottom: SIZES.xs,
    },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
      marginTop: SIZES.sm,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    chip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusRound,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.xs,
    },
    chipText: { color: COLORS.text, fontWeight: '700', fontSize: SIZES.small },
    iconChip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm,
      paddingVertical: SIZES.sm,
    },
    iconChipOn: { borderColor: COLORS.primary, borderWidth: 2 },
    formBtns: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.lg },
    saveBtn: {
      flex: 1,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      paddingVertical: SIZES.md,
      alignItems: 'center',
    },
    saveBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.body },
    cancelBtn: {
      borderRadius: SIZES.radiusMd,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingVertical: SIZES.md,
      paddingHorizontal: SIZES.lg,
      alignItems: 'center',
    },
    cancelBtnText: { color: COLORS.textLight, fontWeight: '700', fontSize: SIZES.body },
    listLabel: { marginTop: SIZES.lg, marginBottom: SIZES.xs },
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
  });
