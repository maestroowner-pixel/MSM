// ===================================
// One internal audit — fill in results item by item, sign to close.
// Open: Officer can set result (OK / Observation / NC / N/A) and add a comment
//       per item; custom audits can also add items.
// Closed (signed): read-only; NC/Obs items show "Raise NC ›".
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { AUDIT_ITEM_RESULT_LABEL, AUDIT_ITEM_RESULT_SHORT, AUDIT_TYPE_LABEL, AuditItem, AuditItemResult, InternalAudit } from '../types/audit';
import { roleAtLeast } from '../types/role';
import { auditSummary, defaultItems } from '../services/audit';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';

const RESULTS: AuditItemResult[] = ['ok', 'observation', 'nc', 'na'];

const RESULT_COLOR: Record<AuditItemResult, string> = {
  ok: '#22c55e',
  observation: '#f59e0b',
  nc: '#ef4444',
  na: '#94a3b8',
};

export default function AuditSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { internalAudits, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const { signer, picker } = useSigner('AUDITOR');
  const confirmSign = useSignConfirm();

  const auditId: string = route.params?.id;
  const audit = internalAudits.find((a) => a.id === auditId);

  const closed = !!audit?.closeDate;
  const readOnly = closed || !canEdit;

  // Local edits (items + scope) — applied on save/sign.
  const [items, setItems] = useState<AuditItem[]>(() => audit?.items ?? []);
  const [scope, setScope] = useState(audit?.scope ?? '');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!audit) {
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <BackButton onPress={() => goBackOr(nav, 'InternalAudits')} fav={false} />
          <Text style={{ color: COLORS.textDark, padding: SIZES.lg }}>Audit not found.</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const setResult = (id: string, result: AuditItemResult) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, result } : it)));

  const setComment = (id: string, comment: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, comment: comment || undefined } : it)));

  const addCustomItem = () => {
    const newItem: AuditItem = { id: uid(), ref: '', requirement: '', result: 'ok' };
    setItems((prev) => [...prev, newItem]);
    setExpanded(newItem.id);
  };

  const updateCustomRef = (id: string, ref: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ref } : it)));

  const updateCustomReq = (id: string, requirement: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, requirement } : it)));

  const save = async (patch?: Partial<InternalAudit>) => {
    const updated: InternalAudit = { ...audit, items, scope: scope || undefined, updatedAt: Date.now(), ...patch };
    await saveRow(storage.INTERNAL_AUDITS_KEY, updated);
  };

  const sign = async () => {
    if (!signer) return Alert.alert('No auditor', 'Choose who is conducting this audit.');
    if (saving) return;
    setSaving(true);
    try {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Internal audit ${audit.no}` });
      if (!sig) { setSaving(false); return; }
      await save({ closeDate: todayIso(), by: signer.name, byRank: signer.rank, signedWith: sig.proof });
      goBackOr(nav, 'InternalAudits');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const { ncs, obs, na } = auditSummary({ ...audit, items });

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          <BackButton onPress={() => goBackOr(nav, 'InternalAudits')} fav={false} />

          <Text style={styles.no}>{audit.no}</Text>
          <Text style={styles.title}>{AUDIT_TYPE_LABEL[audit.type]}</Text>
          <Text style={styles.meta}>
            {formatDate(audit.startDate)}
            {closed && audit.by ? ` · Audited by ${audit.by}${audit.byRank ? ` (${audit.byRank})` : ''}` : ''}
            {closed ? ' · Closed' : ' · In progress'}
          </Text>

          {/* Scope */}
          {readOnly ? (
            audit.scope ? <Text style={styles.scope}>{audit.scope}</Text> : null
          ) : (
            <TextInput
              style={styles.scopeInput}
              value={scope}
              onChangeText={setScope}
              placeholder="Scope — areas, departments, time period covered…"
              placeholderTextColor={COLORS.textLight}
              multiline
              onBlur={() => save()}
            />
          )}

          {/* Summary strip when closed */}
          {closed ? (
            <View style={styles.summary}>
              {ncs > 0 ? <Text style={[styles.summaryText, { color: RESULT_COLOR.nc }]}>NC: {ncs}</Text> : null}
              {obs > 0 ? <Text style={[styles.summaryText, { color: RESULT_COLOR.observation }]}>Obs: {obs}</Text> : null}
              {na > 0  ? <Text style={[styles.summaryText, { color: RESULT_COLOR.na }]}>N/A: {na}</Text> : null}
              {ncs === 0 && obs === 0 ? <Text style={[styles.summaryText, { color: RESULT_COLOR.ok }]}>No findings</Text> : null}
            </View>
          ) : null}

          {/* Items */}
          <View style={styles.card}>
            {items.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                isLast={idx === items.length - 1}
                readOnly={readOnly}
                expanded={expanded === item.id}
                isCustom={audit.type === 'custom'}
                onToggleExpand={() => setExpanded((e) => (e === item.id ? null : item.id))}
                onResult={(r) => { setResult(item.id, r); save(); }}
                onComment={(c) => setComment(item.id, c)}
                onCommentBlur={() => save()}
                onRaiseNc={() => nav.navigate('Nc', { id: 'new' })}
                onRefChange={(v) => updateCustomRef(item.id, v)}
                onReqChange={(v) => updateCustomReq(item.id, v)}
                styles={styles}
                COLORS={COLORS}
              />
            ))}
          </View>

          {!readOnly && audit.type === 'custom' ? (
            <TouchableOpacity style={styles.addBtn} onPress={addCustomItem}>
              <MciIcon name="plus" size={16} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Add item</Text>
            </TouchableOpacity>
          ) : null}

          {/* Sign */}
          {!readOnly ? (
            <View style={styles.card}>
              {picker}
              <TouchableOpacity
                style={[styles.signBtn, { opacity: saving || !signer ? 0.5 : 1 }]}
                onPress={sign}
                disabled={saving || !signer}
                activeOpacity={0.8}
              >
                <MciIcon name="pencil" size={18} color={COLORS.textWhite} />
                <Text style={styles.signBtnText}>{saving ? 'Saving…' : 'Close & sign audit'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ItemRow({
  item, isLast, readOnly, expanded, isCustom,
  onToggleExpand, onResult, onComment, onCommentBlur, onRaiseNc,
  onRefChange, onReqChange,
  styles, COLORS,
}: {
  item: AuditItem; isLast: boolean; readOnly: boolean; expanded: boolean; isCustom: boolean;
  onToggleExpand: () => void; onResult: (r: AuditItemResult) => void;
  onComment: (c: string) => void; onCommentBlur: () => void; onRaiseNc: () => void;
  onRefChange: (v: string) => void; onReqChange: (v: string) => void;
  styles: ReturnType<typeof makeStyles>; COLORS: Palette;
}) {
  const hasFinding = item.result === 'nc' || item.result === 'observation';
  return (
    <View style={[styles.itemRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight }]}>
      <TouchableOpacity style={styles.itemHead} onPress={onToggleExpand} activeOpacity={0.7}>
        <View style={[styles.resultDot, { backgroundColor: RESULT_COLOR[item.result] }]} />
        <View style={{ flex: 1 }}>
          {isCustom ? (
            readOnly ? (
              <Text style={styles.itemRef}>{item.ref || '—'}</Text>
            ) : (
              <TextInput
                style={styles.refInput}
                value={item.ref}
                onChangeText={onRefChange}
                placeholder="Reference (e.g. ISM 10)"
                placeholderTextColor={COLORS.textLight}
              />
            )
          ) : (
            <Text style={styles.itemRef}>{item.ref}</Text>
          )}
          {isCustom && !readOnly ? (
            <TextInput
              style={[styles.refInput, { marginTop: 2 }]}
              value={item.requirement}
              onChangeText={onReqChange}
              placeholder="Requirement"
              placeholderTextColor={COLORS.textLight}
            />
          ) : (
            <Text style={styles.itemReq} numberOfLines={expanded ? undefined : 2}>{item.requirement}</Text>
          )}
        </View>
        <Text style={[styles.resultTag, { color: RESULT_COLOR[item.result] }]}>{AUDIT_ITEM_RESULT_SHORT[item.result]}</Text>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.itemBody}>
          {/* Result picker */}
          {!readOnly ? (
            <View style={styles.resultPicker}>
              {RESULTS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.resultChip, item.result === r && { backgroundColor: RESULT_COLOR[r] }]}
                  onPress={() => onResult(r)}
                >
                  <Text style={[styles.resultChipText, item.result === r && { color: '#fff' }]}>
                    {AUDIT_ITEM_RESULT_LABEL[r]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {/* Comment */}
          {readOnly ? (
            item.comment ? <Text style={styles.comment}>{item.comment}</Text> : null
          ) : (
            <TextInput
              style={styles.commentInput}
              value={item.comment ?? ''}
              onChangeText={onComment}
              onBlur={onCommentBlur}
              placeholder="Comment / evidence…"
              placeholderTextColor={COLORS.textLight}
              multiline
            />
          )}

          {/* Raise NC (closed audit only) */}
          {readOnly && hasFinding ? (
            <TouchableOpacity style={styles.raiseNc} onPress={onRaiseNc}>
              <Text style={styles.raiseNcText}>Raise NC / finding ›</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    no: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary, marginTop: SIZES.sm },
    title: { fontSize: SIZES.h3, fontWeight: '800', color: COLORS.textDark, marginTop: 2 },
    meta: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 4, marginBottom: SIZES.sm },
    scope: { fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm },
    scopeInput: {
      ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm,
      fontSize: SIZES.body, color: COLORS.textDark, marginBottom: SIZES.sm, minHeight: 56,
    },
    summary: { flexDirection: 'row', gap: SIZES.md, marginBottom: SIZES.sm },
    summaryText: { fontSize: SIZES.body, fontWeight: '800' },
    card: { ...COLORS.glassCard, borderRadius: SIZES.radiusLg, marginBottom: SIZES.md, overflow: 'hidden' },
    itemRow: { paddingVertical: 10, paddingHorizontal: SIZES.md },
    itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
    resultDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
    itemRef: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary, marginBottom: 2 },
    itemReq: { fontSize: SIZES.body, color: COLORS.textDark },
    resultTag: { fontSize: SIZES.small, fontWeight: '800', minWidth: 34, textAlign: 'right' },
    itemBody: { marginTop: SIZES.sm, gap: SIZES.xs },
    resultPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    resultChip: {
      borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm, paddingVertical: 5,
    },
    resultChipText: { fontSize: SIZES.small, color: COLORS.textLight, fontWeight: '600' },
    commentInput: {
      borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd,
      padding: SIZES.sm, fontSize: SIZES.body, color: COLORS.textDark,
      minHeight: 56,
    },
    comment: { fontSize: SIZES.body, color: COLORS.textLight, fontStyle: 'italic' },
    raiseNc: { alignSelf: 'flex-start' },
    raiseNcText: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.primary },
    refInput: {
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
      fontSize: SIZES.small, color: COLORS.textDark, paddingVertical: 2, fontWeight: '700',
    },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      marginBottom: SIZES.sm,
    },
    addBtnText: { fontSize: SIZES.small, color: COLORS.primary, fontWeight: '700' },
    signBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, marginTop: SIZES.sm,
    },
    signBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
