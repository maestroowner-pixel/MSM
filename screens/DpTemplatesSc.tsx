// ===================================
// The vessel's DP checklists — set up by ISMpilot from the vessel's own forms
// (behind `dpEditor`, 17 Oct 2026: nobody aboard edits them). A line
// that keeps its text keeps its id (services/dp.ts linesFromText); signed
// records keep the lines they were signed against, so nothing here rewrites
// the past. A built-in is switched off, never deleted (rows merge by id).
// ===================================

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
import { aiCall, aiReady } from '../services/ai';
import { PickedFile, pickDocument, pickFromCamera, pickFromLibrary, toDataUri } from '../services/attachments';

const MAX_AI_BYTES = 10 * 1024 * 1024;
/** The editor's wording, line by line — what each form of line becomes. */
const SYNTAX: [string, string][] = [
  ['Thrusters tested on DP', 'a question: Yes / No / N/A'],
  ['Rotation centre {Fwd|Aft|Other}', 'one of these; Other opens a cell to write in'],
  ['Crane {Good|!No good}', '! marks the answer that means something is wrong'],
  ['Fanbeam range [m]', 'a reading'],
  ['## Sensors', 'a section heading'],
  ['## Sensors | Available {Yes|!No} | Value', 'a table: each line below it is a row with these columns'],
  ['Height (m) [0.0]', 'in a table heading: a number to one decimal'],
  ['Preferred {one}', 'in a table heading: only one row may be Yes'],
  ['## > Alarm limits | Warning | Alarm', 'this table sits beside the one before it'],
  ['DGPS 1 -[Mode]', 'this row has no cell in the Mode column'],
  ['~Bow AZI', 'hidden on this vessel — remove the ~ to show it again'],
  ['@field Location', 'a field at the top of the form'],
  ['@text Brief description', 'a paragraph to write'],
  ['@sketch Own vessel, rig, wind, current', 'a drawing, by stylus'],
  ['@sign SDPO', 'who signs (two lines; default: handing over, taking over)'],
];

type FormReply = { title?: string; where?: string; lines?: string[]; unreadable?: string };

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
  const [busy, setBusy] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const ai = aiReady(sync.enrolled);

  /**
   * The vessel's own paper form → a checklist (16 Oct 2026): a PDF or a photo of
   * the blank form goes to the AI (functions/ai.js `form`), which writes it in the
   * editor's wording; the officer checks it against the paper and saves. A second
   * page is read the same way and added at the end.
   */
  const readForm = (add: boolean) => {
    const go = (picker: () => Promise<PickedFile | null>) => async () => {
      const f = await picker();
      if (!f) return;
      setBusy('The AI is reading the form — about half a minute a page…');
      try {
        const dataUri = await toDataUri(f.uri, f.name ?? 'form.pdf');
        const mediaType = dataUri.slice(5, dataUri.indexOf(';'));
        const data = dataUri.slice(dataUri.indexOf(',') + 1);
        if (data.length * 0.75 > MAX_AI_BYTES) throw new Error('The file is over 10 MB — a smaller scan or one page at a time.');
        const r = await aiCall<FormReply>('form', { target: 'DP checklist', mediaType, data });
        const lines = (r.lines ?? []).map((x) => String(x)).filter((x) => x.trim());
        if (!lines.length) throw new Error(r.unreadable || 'Nothing could be read — try a sharper photo or the PDF.');
        if (add && editing) setText((t) => `${t.trimEnd()}\n${lines.join('\n')}`);
        else {
          setEditing({ id: uid('dpt'), title: '', where: 'bridge', lines: [], updatedAt: 0 });
          setTitle(String(r.title ?? '').trim());
          setWhere(r.where === 'engine' ? 'engine' : 'bridge');
          setText(lines.join('\n'));
        }
        setAiNote(`Read by the AI: ${lines.length} lines${r.unreadable ? ` · could not read: ${r.unreadable}` : ''}. Check every line against the paper before saving.`);
      } catch (e: any) {
        Alert.alert('The vessel’s form', String(e?.message ?? e));
      } finally {
        setBusy(null);
      }
    };
    Alert.alert(add ? 'The next page of the form' : 'The vessel’s form', 'A PDF, or a photo of the blank form. Only its layout is read — what is filled in on it is left out.', [
      { text: 'Document (PDF…)', onPress: go(pickDocument) },
      { text: 'Photo Library', onPress: go(pickFromLibrary) },
      { text: 'Camera', onPress: go(pickFromCamera) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Ours, not the vessel's: switched on for a vessel only while ISMpilot sets its checklists up.
  if (!moduleOn('dp') || !moduleOn('dpEditor')) return <Screen><Empty text="The vessel's DP checklists are set up by ISMpilot from the vessel's own forms." /></Screen>;
  if (!officer) return <Screen><Empty text="The officers and the Master word the DP checklists." /></Screen>;

  const open = (t: DpTemplate) => {
    setAiNote(null);
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
        <TextInput style={styles.input} value={title} onChangeText={setTitle} accessibilityLabel="Title" />
        <Label>Where</Label>
        <View style={styles.chips}>
          {(['bridge', 'engine'] as DpWhere[]).map((w) => (
            <TouchableOpacity key={w} style={[styles.chip, where === w && styles.chipOn]} onPress={() => setWhere(w)}>
              <Text style={[styles.chipText, where === w && styles.chipTextOn]}>{w === 'engine' ? 'Engine room' : 'Bridge'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {aiNote ? <Text style={[styles.sub, { color: COLORS.warning, marginBottom: SIZES.xs }]}>{aiNote}</Text> : null}
        <Label>Items — one a line</Label>
        {/* How to write a line — folded away, opened when needed (17 Oct 2026). */}
        <TouchableOpacity onPress={() => setHelpOpen((v) => !v)} hitSlop={6} style={{ marginBottom: SIZES.xs }}>
          <Text style={styles.link}>{helpOpen ? '▾ How to write a line' : '▸ How to write a line'}</Text>
        </TouchableOpacity>
        {helpOpen ? (
          <View style={styles.helpBox}>
            {SYNTAX.map(([ex, what]) => (
              <View key={ex} style={styles.helpRow}>
                <Text style={styles.helpEx}>{ex}</Text>
                <Text style={styles.helpWhat}>{what}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <TextInput style={[styles.input, { minHeight: 260 }]} value={text} onChangeText={setText} multiline accessibilityLabel="Items" />
        {ai && aiNote ? (
          <TouchableOpacity onPress={() => readForm(true)} disabled={!!busy} style={{ marginBottom: SIZES.sm }}>
            <Text style={styles.link}>+ Add the next page of the form (AI)</Text>
          </TouchableOpacity>
        ) : null}
        {busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.sub}>{busy}</Text>
          </View>
        ) : null}
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
              <Text style={styles.sub}>{`${t.lines.filter((l) => !l.head && !l.kind).length} items · ${builtIn ? (changed ? 'reworded' : 'as shipped') : 'the vessel’s own'}${t.off ? ' · off' : ''}`}</Text>
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
      {ai ? (
        <TouchableOpacity style={[styles.btnOutline, { marginTop: SIZES.sm }]} onPress={() => readForm(false)} disabled={!!busy}>
          <Text style={styles.btnOutlineText}>From the vessel’s form — PDF or photo (AI)</Text>
        </TouchableOpacity>
      ) : null}
      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={COLORS.primary} />
          <Text style={styles.sub}>{busy}</Text>
        </View>
      ) : null}
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
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 12 },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800', textAlign: 'center' },
    helpBox: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.sm, gap: 4 },
    helpRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    helpEx: { width: 300, color: COLORS.text, fontFamily: 'monospace', fontSize: SIZES.small },
    helpWhat: { flex: 1, minWidth: 200, color: COLORS.textLight, fontSize: SIZES.small },
    busy: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginVertical: SIZES.sm },
    btnText: { color: COLORS.textWhite, fontWeight: '800', textAlign: 'center' },
  });
