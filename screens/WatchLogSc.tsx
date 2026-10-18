// ===================================
// Engine-room rounds / daily log — backlog #9, Oct 2026.
//
// Lists all signed rounds, newest first; lets any crew member start a new
// round. Officers and the Master can edit the round template.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { WatchEntry, WatchParam, WatchTemplate } from '../types/watchLog';
import { defaultTemplate, fmtValue, normalStatus } from '../services/watchLog';
import * as storage from '../services/storage';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';

// ─── Template editor modal ───────────────────────────────────────────────────

function ParamRow({
  param,
  onEdit,
  onDelete,
  canEdit,
  COLORS,
  styles,
}: {
  param: WatchParam;
  onEdit: (p: WatchParam) => void;
  onDelete: () => void;
  canEdit: boolean;
  COLORS: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.paramRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.paramName}>{param.name}</Text>
        <Text style={styles.paramUnit}>{param.unit || (param.type === 'text' ? 'text' : 'number')}</Text>
      </View>
      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
          <TouchableOpacity onPress={() => onEdit(param)} hitSlop={8}>
            <MciIcon name="pencil-outline" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={8}>
            <MciIcon name="minus-circle-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function TemplateEditor({
  template,
  onSave,
  onClose,
  COLORS,
  styles,
}: {
  template: WatchTemplate;
  onSave: (t: WatchTemplate) => void;
  onClose: () => void;
  COLORS: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const [params, setParams] = useState<WatchParam[]>(template.params);
  const [editingParam, setEditingParam] = useState<WatchParam | null>(null);
  const [draftName, setDraftName] = useState(template.name);

  const editParam = (p: WatchParam) => setEditingParam({ ...p });
  const addParam = () =>
    setEditingParam({ id: uid(), name: '', unit: '', type: 'number', normalMin: undefined, normalMax: undefined });

  const saveParam = (p: WatchParam) => {
    if (!p.name.trim()) return;
    setParams((prev) => {
      const i = prev.findIndex((x) => x.id === p.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = p;
        return next;
      }
      return [...prev, p];
    });
    setEditingParam(null);
  };

  if (editingParam) {
    return (
      <View style={styles.editor}>
        <Text style={styles.editorTitle}>{params.find((x) => x.id === editingParam.id) ? 'Edit parameter' : 'New parameter'}</Text>
        <Label>Name</Label>
        <TextInput
          style={styles.input}
          value={editingParam.name}
          onChangeText={(v) => setEditingParam({ ...editingParam, name: v })}
          placeholder="e.g. ME Cooling Water Temp In"
          placeholderTextColor={COLORS.textLight}
          autoFocus
        />
        <Label>Unit (leave blank for text)</Label>
        <TextInput
          style={styles.input}
          value={editingParam.unit}
          onChangeText={(v) =>
            setEditingParam({
              ...editingParam,
              unit: v,
              type: v.trim() === '' && editingParam.type === 'number' ? 'number' : editingParam.type,
            })
          }
          placeholder="°C / bar / rpm / kW / ..."
          placeholderTextColor={COLORS.textLight}
        />
        <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
          <View style={{ flex: 1 }}>
            <Label>Normal min</Label>
            <TextInput
              style={styles.input}
              value={editingParam.normalMin != null ? String(editingParam.normalMin) : ''}
              onChangeText={(v) => setEditingParam({ ...editingParam, normalMin: v.trim() ? parseFloat(v) : undefined })}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Label>Normal max</Label>
            <TextInput
              style={styles.input}
              value={editingParam.normalMax != null ? String(editingParam.normalMax) : ''}
              onChangeText={(v) => setEditingParam({ ...editingParam, normalMax: v.trim() ? parseFloat(v) : undefined })}
              keyboardType="numeric"
              placeholder="—"
              placeholderTextColor={COLORS.textLight}
            />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
          <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.primary }]} onPress={() => saveParam(editingParam)}>
            <Text style={styles.btnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.cardSolid }]} onPress={() => setEditingParam(null)}>
            <Text style={[styles.btnText, { color: COLORS.textDark }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.editor}>
      <Text style={styles.editorTitle}>Round template</Text>
      <Label>Template name</Label>
      <TextInput
        style={styles.input}
        value={draftName}
        onChangeText={setDraftName}
        placeholderTextColor={COLORS.textLight}
      />
      <Label style={{ marginTop: SIZES.sm }}>Parameters</Label>
      {params.map((p, i) => (
        <ParamRow
          key={p.id}
          param={p}
          onEdit={editParam}
          onDelete={() => setParams((prev) => prev.filter((x) => x.id !== p.id))}
          canEdit
          COLORS={COLORS}
          styles={styles}
        />
      ))}
      <TouchableOpacity style={styles.addParamBtn} onPress={addParam}>
        <MciIcon name="plus-circle-outline" size={18} color={COLORS.primary} />
        <Text style={[styles.paramName, { color: COLORS.primary }]}>Add parameter</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md }}>
        <TouchableOpacity
          style={[styles.btn, { flex: 1, backgroundColor: COLORS.primary }]}
          onPress={() => onSave({ ...template, name: draftName || template.name, params, updatedAt: Date.now() })}
        >
          <Text style={styles.btnText}>Save template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: COLORS.cardSolid }]} onPress={onClose}>
          <Text style={[styles.btnText, { color: COLORS.textDark }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Entry row ───────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onPress,
  COLORS,
  styles,
}: {
  entry: WatchEntry;
  onPress: () => void;
  COLORS: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  const hasWarn = entry.params.some((p) => normalStatus(p, entry.values[p.id] ?? '') === 'warn');
  return (
    <TouchableOpacity style={styles.entryRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.entryDot, { backgroundColor: hasWarn ? COLORS.warning : COLORS.success }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.entryDate}>{formatDate(entry.date)} {entry.time}</Text>
        <Text style={styles.entrySub}>{entry.by}{entry.byRank ? ` · ${entry.byRank}` : ''}</Text>
      </View>
      <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function WatchLogSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { watchTemplates, watchLog, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || sync.role === 'admin' || sync.role === 'superadmin';

  const [editingTemplate, setEditingTemplate] = useState(false);

  // Active template: first non-deleted, or the built-in default.
  const template = useMemo<WatchTemplate>(
    () => watchTemplates[0] ?? defaultTemplate(),
    [watchTemplates]
  );

  // Entries newest first.
  const entries = useMemo(
    () => [...watchLog].sort((a, b) => b.at - a.at),
    [watchLog]
  );

  const saveTemplate = async (t: WatchTemplate) => {
    await saveRow(storage.WATCH_TEMPLATES_KEY, t);
    setEditingTemplate(false);
  };

  return (
    <Screen scroll>
      <ScreenTitle title="Engine Room Log" help="Maintenance" onScan={undefined} />

      {editingTemplate ? (
        <Card>
          <TemplateEditor
            template={template}
            onSave={saveTemplate}
            onClose={() => setEditingTemplate(false)}
            COLORS={COLORS}
            styles={styles}
          />
        </Card>
      ) : (
        <>
          {/* Template info + edit */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.head}>{template.name}</Text>
                <Text style={styles.sub}>{template.params.length} parameter{template.params.length !== 1 ? 's' : ''}</Text>
              </View>
              {canEdit ? (
                <TouchableOpacity onPress={() => setEditingTemplate(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MciIcon name="pencil-outline" size={16} color={COLORS.primary} />
                  <Text style={{ color: COLORS.primary, fontSize: SIZES.small, fontWeight: '700' }}>Edit template</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </Card>

          {/* New round button */}
          <TouchableOpacity
            style={styles.newBtn}
            onPress={() => nav.navigate('WatchEntry', { templateId: template.id })}
            activeOpacity={0.8}
          >
            <MciIcon name="plus-circle-outline" size={20} color={COLORS.textWhite} />
            <Text style={styles.newBtnText}>Start new round</Text>
          </TouchableOpacity>

          {/* Entry list */}
          {entries.length === 0 ? (
            <Card>
              <Text style={[styles.sub, { textAlign: 'center', paddingVertical: SIZES.md }]}>No rounds recorded yet.</Text>
            </Card>
          ) : (
            <Card>
              {entries.map((e) => (
                <EntryRow
                  key={e.id}
                  entry={e}
                  onPress={() => nav.navigate('WatchEntry', { entryId: e.id, templateId: e.templateId })}
                  COLORS={COLORS}
                  styles={styles}
                />
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    newBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, marginBottom: SIZES.md,
    },
    newBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    entryRow: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm,
      paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight,
    },
    entryDot: { width: 10, height: 10, borderRadius: 5 },
    entryDate: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    entrySub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    paramRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight,
    },
    paramName: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    paramUnit: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 1 },
    addParamBtn: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm },
    editor: { paddingVertical: SIZES.xs },
    editorTitle: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginBottom: SIZES.sm },
    input: {
      borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm, paddingVertical: SIZES.xs,
      fontSize: SIZES.body, color: COLORS.textDark, backgroundColor: COLORS.cardSolid,
      marginTop: 4, marginBottom: SIZES.sm,
    },
    btn: {
      borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm,
      alignItems: 'center', justifyContent: 'center',
    },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
