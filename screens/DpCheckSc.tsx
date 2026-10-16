// ===================================
// One DP checklist — worked and signed (route { templateId }), or read back
// (route { id }). A signed record keeps a copy of the lines it was signed
// against and is never edited (firestore.rules: dp_checks has no update).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { ASOG_LABEL, checkOutcome, templatesNow } from '../services/dp';
import { exportDpCheckPdf } from '../services/dpReport';
import { AsogStatus, DpCheck, DpResult } from '../types/dp';

const RES: { key: DpResult; label: string }[] = [
  { key: 'pass', label: 'Yes' },
  { key: 'fail', label: 'No' },
  { key: 'na', label: 'N/A' },
];

export default function DpCheckSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { dpChecks, dpTemplates, vessel, saveRow } = useData();
  const { signer, picker } = useSigner();
  const done = dpChecks.find((c) => c.id === route.params?.id);
  const tpl = useMemo(() => templatesNow(dpTemplates).find((x) => x.id === route.params?.templateId), [dpTemplates, route.params?.templateId]);
  const [operation, setOperation] = useState('');
  const [asog, setAsog] = useState<AsogStatus | undefined>(undefined);
  const [results, setResults] = useState<Record<string, DpResult>>({});
  const [remarks, setRemarks] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  if (!moduleOn('dp')) return <Screen><Empty text="Not available on this vessel." /></Screen>;
  const c: DpCheck | null = done ?? (tpl ? { id: '', templateId: tpl.id, title: tpl.title, where: tpl.where, at: 0, operation, asog, lines: tpl.lines, results, remarks, by: '', updatedAt: 0 } : null);
  if (!c) return <Screen><Empty text="This checklist is not on this device." /></Screen>;
  const ro = !!done;
  const o = checkOutcome(c);

  const sign = async () => {
    if (!signer) return Alert.alert('DP checklist', 'Choose who signs.');
    const finish = async () => {
      const rec: DpCheck = { ...c, id: uid('dpc'), at: Date.now(), operation: operation.trim() || undefined, asog, remarks: remarks.trim() || undefined, by: signer.name, byRank: signer.rank, byKey: signer.key, updatedAt: Date.now() };
      await saveRow(storage.DP_CHECKS_KEY, rec);
      nav.replace('DpCheck', { id: rec.id });
    };
    const warn = [o.open ? `${o.open} not answered` : '', o.fail ? `${o.fail} answered No` : ''].filter(Boolean).join(', ');
    Alert.alert('Sign the checklist?', `${warn ? `${warn}. ` : ''}A signed checklist cannot be changed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign', onPress: () => void finish() },
    ]);
  };
  const pdf = async () => {
    try {
      const w = await exportDpCheckPdf(c, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      Alert.alert('DP checklist', String(e?.message ?? e));
    }
  };

  return (
    <Screen scroll>
      <ScreenTitle title={c.title} subtitle={ro ? `Signed by ${c.by}${c.byRank ? ` (${c.byRank})` : ''} · ${new Date(c.at).toISOString().slice(0, 16).replace('T', ' ')} UTC` : c.where === 'engine' ? 'Engine room' : 'Bridge'} help="Dynamic positioning" />

      <Label>Operation / field / installation</Label>
      {ro ? <Text style={styles.value}>{c.operation || '—'}</Text> : <TextInput style={styles.input} value={operation} onChangeText={setOperation} placeholder="e.g. ROV survey, Block 21/4" placeholderTextColor={COLORS.textLight} />}
      <Label>DP status (ASOG)</Label>
      <View style={styles.chips}>
        {(Object.keys(ASOG_LABEL) as AsogStatus[]).map((k) => {
          const on = (ro ? c.asog : asog) === k;
          const tone = { green: COLORS.success, blue: COLORS.primary, yellow: COLORS.warning, red: COLORS.danger }[k];
          return (
            <TouchableOpacity key={k} disabled={ro} style={[styles.chip, { borderColor: tone }, on && { backgroundColor: tone }]} onPress={() => setAsog(on ? undefined : k)}>
              <Text style={[styles.chipText, { color: on ? COLORS.textWhite : tone }]}>{ASOG_LABEL[k]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.headRow}>
        <Label>{`Items (${c.lines.length})`}</Label>
        {!ro ? (
          <TouchableOpacity onPress={() => setResults(Object.fromEntries(c.lines.map((l) => [l.id, results[l.id] ?? 'pass'])))}>
            <Text style={styles.link}>All yes — then change what is not</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {c.lines.map((l, i) => {
        const v = c.results[l.id];
        return (
          <View key={l.id} style={[styles.line, v === 'fail' && { borderColor: COLORS.danger }]}>
            <Text style={styles.lineText}>{`${i + 1}. ${l.text}`}</Text>
            <View style={styles.chips}>
              {RES.map((r) => (
                <TouchableOpacity key={r.key} disabled={ro} style={[styles.chip, v === r.key && styles.chipOn, v === r.key && r.key === 'fail' && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]} onPress={() => setResults((x) => ({ ...x, [l.id]: r.key }))}>
                  <Text style={[styles.chipText, v === r.key && styles.chipTextOn]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );
      })}

      <Label>Remarks</Label>
      {ro ? <Text style={styles.value}>{c.remarks || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 70 }]} value={remarks} onChangeText={setRemarks} multiline placeholder="What was found, what was done, who was told" placeholderTextColor={COLORS.textLight} />}

      <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{`${o.pass} yes · ${o.fail} no · ${o.na} n/a${o.open ? ` · ${o.open} not answered` : ''}`}</Text>
      {ro ? (
        <>
          <TouchableOpacity style={styles.btn} onPress={pdf}>
            <Text style={styles.btnText}>PDF</Text>
          </TouchableOpacity>
          {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
          <TouchableOpacity onPress={() => goBackOr(nav)} style={{ marginTop: SIZES.md }}>
            <Text style={styles.link}>← Dynamic positioning</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {picker}
          <TouchableOpacity style={styles.btn} onPress={sign}>
            <Text style={styles.btnText}>{signer ? `Sign as ${signer.name}` : 'Sign'}</Text>
          </TouchableOpacity>
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 5, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: SIZES.md },
    line: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs, borderWidth: 1, borderColor: 'transparent' },
    lineText: { color: COLORS.text },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm, textAlignVertical: 'top' },
    value: { color: COLORS.text, marginBottom: SIZES.sm },
    sub: { color: COLORS.textLight, fontSize: SIZES.small },
    link: { color: COLORS.primary, fontWeight: '700' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 12, marginTop: SIZES.sm },
    btnText: { color: COLORS.textWhite, fontWeight: '800', textAlign: 'center' },
  });
