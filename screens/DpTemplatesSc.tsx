// ===================================
// The vessel's DP checklists — the four the app ships, worded to the vessel's
// DP Operations Manual and ASOG, and its own. Officers and the Master. A line
// that keeps its text keeps its id (services/dp.ts linesFromText); signed
// records keep the lines they were signed against, so nothing here rewrites
// the past. A built-in is switched off, never deleted (rows merge by id).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { uid } from '../utils/id';
import { DP_TEMPLATES, lineSource, linesFromText } from '../services/dp';
import { DpTemplate, DpWhere } from '../types/dp';
import { roleAtLeast } from '../types/role';

export default function DpTemplatesSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { dpTemplates, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  // Every checklist, switched off ones included, so a built-in can be switched back on.
  const all = useMemo(() => {
    const own = new Map(dpTemplates.map((x) => [x.id, x]));
    return [...DP_TEMPLATES.map((b) => own.get(b.id) ?? b), ...dpTemplates.filter((x) => !DP_TEMPLATES.some((b) => b.id === x.id))];
  }, [dpTemplates]);
  const [editing, setEditing] = useState<DpTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [where, setWhere] = useState<DpWhere>('bridge');

  if (!moduleOn('dp')) return <Screen><Empty text="Not available on this vessel." /></Screen>;
  if (!officer) return <Screen><Empty text="The officers and the Master word the DP checklists." /></Screen>;

  const open = (t: DpTemplate) => {
    setEditing(t);
    setTitle(t.title);
    setWhere(t.where);
    setText(t.lines.map(lineSource).join('\n'));
  };
  const save = async () => {
    if (!editing) return;
    if (!title.trim()) return Alert.alert('DP checklists', 'Give it a title.');
    const lines = linesFromText(text, editing.lines, editing.id);
    if (!lines.length) return Alert.alert('DP checklists', 'Write at least one line.');
    await saveRow(storage.DP_TEMPLATES_KEY, { ...editing, title: title.trim(), where, lines, updatedAt: Date.now() });
    setEditing(null);
  };
  const toggle = (t: DpTemplate) => void saveRow(storage.DP_TEMPLATES_KEY, { ...t, off: !t.off, updatedAt: Date.now() });
  const standard = (t: DpTemplate) => {
    const b = DP_TEMPLATES.find((x) => x.id === t.id);
    if (b) void saveRow(storage.DP_TEMPLATES_KEY, { ...b, off: t.off, updatedAt: Date.now() });
  };

  if (editing) {
    const builtIn = DP_TEMPLATES.some((b) => b.id === editing.id);
    return (
      <Screen scroll>
        <ScreenTitle title={builtIn ? 'Word the checklist' : 'Your checklist'} subtitle="One item a line. Signed checklists keep the words they were signed with." help="Dynamic positioning" />
        <Label>Title</Label>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={COLORS.textLight} placeholder="Pre-ROV launch DP check" />
        <Label>Where</Label>
        <View style={styles.chips}>
          {(['bridge', 'engine'] as DpWhere[]).map((w) => (
            <TouchableOpacity key={w} style={[styles.chip, where === w && styles.chipOn]} onPress={() => setWhere(w)}>
              <Text style={[styles.chipText, where === w && styles.chipTextOn]}>{w === 'engine' ? 'Engine room' : 'Bridge'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Label>Items — one a line</Label>
        <Text style={styles.sub}>{'Plain line → Yes / No / N/A.  {Good|!No good} → one of these (! = wrong).  [Hdg] → a reading.  ## Sensors → a heading.  ## Sensors | Available {Yes|!No} | Value → a table: each line below is a row with these columns.'}</Text>
        <TextInput style={[styles.input, { minHeight: 260 }]} value={text} onChangeText={setText} multiline placeholderTextColor={COLORS.textLight} placeholder={'## Sensors\nGyro 1 {Available|Priority|Not available} [Hdg]\nPosition gain [setting]\nThrusters tested on DP'} />
        <TouchableOpacity style={styles.btn} onPress={save}>
          <Text style={styles.btnText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditing(null)} style={{ marginTop: SIZES.md }}>
          <Text style={styles.link}>Cancel</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title="DP checklists" subtitle="A starting point from IMCA M 103, MSC.1/Circ.1580 and the MTS guidance — word them to your DP Operations Manual and ASOG" help="Dynamic positioning" />
      {all.map((t) => {
        const builtIn = DP_TEMPLATES.find((b) => b.id === t.id);
        const changed = builtIn && dpTemplates.some((x) => x.id === t.id && (x.title !== builtIn.title || JSON.stringify(x.lines) !== JSON.stringify(builtIn.lines)));
        return (
          <View key={t.id} style={[styles.row, t.off && { opacity: 0.5 }]}>
            <MciIcon name={t.where === 'engine' ? 'engine-outline' : 'ferry'} size={20} color={COLORS.primary} />
            <TouchableOpacity style={{ flex: 1 }} onPress={() => open(t)}>
              <Text style={styles.title}>{t.title}</Text>
              <Text style={styles.sub}>{`${t.lines.filter((l) => !l.head).length} items · ${builtIn ? (changed ? 'reworded' : 'as shipped') : 'the vessel’s own'}${t.off ? ' · off' : ''}`}</Text>
            </TouchableOpacity>
            {changed ? (
              <TouchableOpacity onPress={() => standard(t)} hitSlop={8}>
                <Text style={styles.small}>Standard</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => toggle(t)} hitSlop={8}>
              <Text style={styles.small}>{t.off ? 'Switch on' : 'Switch off'}</Text>
            </TouchableOpacity>
          </View>
        );
      })}
      <TouchableOpacity style={[styles.btn, { marginTop: SIZES.md }]} onPress={() => open({ id: uid('dpt'), title: '', where: 'bridge', lines: [], updatedAt: 0 })}>
        <Text style={styles.btnText}>+ New checklist</Text>
      </TouchableOpacity>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.sm, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    row: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    small: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    link: { color: COLORS.primary, fontWeight: '700' },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm, textAlignVertical: 'top' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 12 },
    btnText: { color: COLORS.textWhite, fontWeight: '800', textAlign: 'center' },
  });
