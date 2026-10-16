// ===================================
// One DP checklist — worked and signed (route { templateId }), or read back
// (route { id }). A signed record keeps a copy of the lines it was signed
// against and is never edited (firestore.rules: dp_checks has no update).
// Where and when are REQUIRED (16 Oct 2026, the owner): the position is typed
// from the DGPS — never the phone's own GPS ("the information comes from the
// DGPS") — the date and time are the moment of signing — set
// by the app, shown in ship's time and UTC, not typed.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useSigner } from '../components/SignerChoice';
import { Dropdown } from '../components/Dropdown';
import { crewLabel, isAboard } from '../types/crew';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { ASOG_LABEL, answerIsBad, cellKey, checkOutcome, sectionCols, conditionsText, positionFromText, positionText, templatesNow } from '../services/dp';
import { PositionInput } from '../components/PositionInput';
import { shipAndUtc } from '../utils/shipTime';
import { exportDpCheckPdf } from '../services/dpReport';
import { AsogStatus, DpCheck, DpConditions, DpLine, DpResult } from '../types/dp';

// As the paper checklist lays them out: a value, then its direction, each with
// its name in front of the cell and its unit after it ("the operator is used to it").
const COND: { label: string; key: keyof DpConditions; unit: string; dir?: keyof DpConditions }[] = [
  { label: 'Water depth', key: 'waterDepth', unit: 'm' },
  { label: 'Wind speed', key: 'windSpeed', unit: 'kn', dir: 'windDir' },
  { label: 'Current speed', key: 'currentSpeed', unit: 'kn', dir: 'currentDir' },
  { label: 'Wave height', key: 'waveHeight', unit: 'm', dir: 'waveDir' },
];

/** One width for a column's heading and every cell under it — the table lines up. */
const colWidth = (col: { options?: string[] }) => (col.options ? col.options.reduce((w, o) => w + o.length * 6.6 + 18, 0) + (col.options.length - 1) * 3 : 90);

/** A reading named by its unit ([kn], [m]) shows the unit after the cell, as written on paper. */
const UNITS = ['kn', 'm', '°', '°/min', '%', 's', 'bar', 'rpm'];

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
  const { signer, picker } = useSigner('SIGNED BY — HANDING OVER');
  const { crew } = useData();
  const [secondId, setSecondId] = useState('');
  const done = dpChecks.find((c) => c.id === route.params?.id);
  const tpl = useMemo(() => templatesNow(dpTemplates).find((x) => x.id === route.params?.templateId), [dpTemplates, route.params?.templateId]);
  const [operation, setOperation] = useState('');
  const [asog, setAsog] = useState<AsogStatus | undefined>(undefined);
  const [results, setResults] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [unit, setUnit] = useState('');
  const [cond, setCond] = useState<DpConditions>({});
  // The same cells as the record books (Ballast, Garbage, Log book): deg, min, N/S · deg, min, E/W.
  const [posT, setPosT] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [done]);
  // The last checklist's place, offered (not filled in) — a vessel on DP stays put for days.
  const last = useMemo(() => [...dpChecks].sort((a, b) => b.at - a.at).find((x) => x.position), [dpChecks]);

  const aboard = useMemo(() => crew.filter(isAboard), [crew]);
  const second = aboard.find((p) => p.id === secondId);

  if (!moduleOn('dp')) return <Screen><Empty text="Not available on this vessel." /></Screen>;
  const here = positionFromText(posT);
  const lat = here?.lat;
  const lon = here?.lon;
  const offset = vessel?.ship_utc_offset;
  const c: DpCheck | null = done ?? (tpl ? { id: '', templateId: tpl.id, title: tpl.title, where: tpl.where, at: now, shipOffset: offset, position: { lat: lat ?? NaN, lon: lon ?? NaN }, operation, unit, conditions: cond, asog, lines: tpl.lines, results, values, remarks, by: '', updatedAt: 0 } : null);
  if (!c) return <Screen><Empty text="This checklist is not on this device." /></Screen>;
  const ro = !!done;
  const o = checkOutcome(c);
  const inTable = sectionCols(c.lines);
  const plainLines = c.lines.filter((l) => !l.head && !l.options && !l.value && !inTable.get(l.id));
  const sign = async () => {
    if (lat == null || lon == null) return Alert.alert('DP checklist', 'Enter the position the checklist is done at — latitude and longitude, degrees, minutes and N/S, E/W from the DGPS.');
    if (!signer) return Alert.alert('DP checklist', 'Choose who signs — handing over.');
    if (!second) return Alert.alert('DP checklist', 'Choose the second signature — taking over.');
    if (second.id === signer.key || second.name === signer.name) return Alert.alert('DP checklist', 'Two different people sign: the one handing over and the one taking over.');
    const finish = async () => {
      const clean = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const cc = clean(cond as Record<string, string>);
      const at = Date.now();
      const rec: DpCheck = { ...c, id: uid('dpc'), at, shipOffset: offset, position: { lat, lon }, operation: operation.trim() || undefined, unit: unit.trim() || undefined, conditions: Object.keys(cc).length ? cc : undefined, asog, values: Object.keys(clean(values)).length ? clean(values) : undefined, remarks: remarks.trim() || undefined, by: signer.name, byRank: signer.rank, byKey: signer.key, by2: second.name, by2Rank: second.rank || undefined, by2Key: second.id, updatedAt: at };
      if (!rec.by2Rank) delete rec.by2Rank;
      if (!rec.values) delete rec.values;
      if (!rec.conditions) delete rec.conditions;
      if (!rec.shipOffset) delete rec.shipOffset;
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
      <ScreenTitle title={c.title} subtitle={ro ? `Signed by ${c.by}${c.byRank ? ` (${c.byRank})` : ''}${c.by2 ? ` and ${c.by2}${c.by2Rank ? ` (${c.by2Rank})` : ''}` : ''}` : c.where === 'engine' ? 'Engine room' : 'Bridge'} help="Dynamic positioning" />

      <View style={styles.pair}>
        <View style={styles.half}>
          <Label>Field</Label>
          {ro ? <Text style={styles.value}>{c.operation || '—'}</Text> : <TextInput style={styles.input} value={operation} onChangeText={setOperation} />}
        </View>
        <View style={styles.half}>
          <Label>Offshore unit</Label>
          {ro ? <Text style={styles.value}>{c.unit || '—'}</Text> : <TextInput style={styles.input} value={unit} onChangeText={setUnit} />}
        </View>
      </View>
      <Label>Date and time ★</Label>
      <Text style={styles.value}>{`${shipAndUtc(c.at, c.shipOffset).line}${ro ? '' : ' — set when signed'}`}</Text>
      {ro ? (
        <>
          <Label>Position ★</Label>
          <Text style={styles.value}>{positionText(c.position)}</Text>
        </>
      ) : (
        <>
          <PositionInput label="Position ★ (from the DGPS)" portAllowed={false} position={posT} onChange={(v) => setPosT(v)} />
          <View style={styles.chips}>
            {last ? (
              <TouchableOpacity style={styles.chip} onPress={() => setPosT(positionText(last.position))}>
                <Text style={styles.chipText}>{`As the last checklist (${shipAndUtc(last.at, last.shipOffset).ship.slice(5)})`}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </>
      )}

      <Label>Conditions</Label>
      {ro ? (
        <Text style={styles.value}>{conditionsText(c.conditions) || '—'}</Text>
      ) : (
        <View>
          {COND.map((r) => (
            <View key={r.key} style={styles.condRow}>
              <Text style={styles.condLabel}>{r.label}</Text>
              <TextInput style={[styles.input, styles.cell]} value={cond[r.key] ?? ''} onChangeText={(v) => setCond((x) => ({ ...x, [r.key]: v }))} accessibilityLabel={r.label} />
              <Text style={styles.unit}>{r.unit}</Text>
              {r.dir ? (
                <>
                  <Text style={[styles.condLabel, styles.dirLabel]}>direction</Text>
                  <TextInput style={[styles.input, styles.cell]} value={cond[r.dir] ?? ''} onChangeText={(v) => setCond((x) => ({ ...x, [r.dir!]: v }))} accessibilityLabel={`${r.label.split(' ')[0]} direction`} />
                  <Text style={styles.unit}>°</Text>
                </>
              ) : null}
            </View>
          ))}
        </View>
      )}
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
        <Label>{`Items (${c.lines.filter((l) => !l.head).length})`}</Label>
        {!ro && plainLines.length ? (
          <TouchableOpacity onPress={() => setResults((x) => ({ ...x, ...Object.fromEntries(plainLines.map((l) => [l.id, x[l.id] ?? 'pass'])) }))}>
            <Text style={styles.link}>All Yes / No items yes — then change what is not</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {(() => {
        // Sections as on paper: a heading with columns is a table, the rest are cards.
        const secs: { head?: DpLine; lines: DpLine[] }[] = [];
        for (const l of c.lines) {
          if (l.head || !secs.length) secs.push({ head: l.head ? l : undefined, lines: [] });
          if (!l.head) secs[secs.length - 1].lines.push(l);
        }
        let n = 0;
        return secs.map((sec, si) => {
          const cols = sec.head?.cols;
          const title = sec.head ? <Text style={styles.head}>{sec.head.text}</Text> : null;
          if (cols?.length) {
            return (
              <View key={sec.head!.id}>
                {title}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.table}>
                    <View style={[styles.tr, styles.th]}>
                      <Text style={[styles.tdName, styles.thText]}> </Text>
                      {cols.map((col, ci) => (
                        <Text key={ci} style={[{ width: colWidth(col) }, styles.thText]}>{col.name}</Text>
                      ))}
                    </View>
                    {sec.lines.map((l) => {
                      n++;
                      const rowBad = cols.some((col, ci) => col.options && answerIsBad(c.results[cellKey(l.id, ci)], col));
                      return (
                        <View key={l.id} style={[styles.tr, rowBad && styles.trBad]}>
                          <Text style={styles.tdName}>{l.text}</Text>
                          {cols.map((col, ci) => {
                            const k = cellKey(l.id, ci);
                            if (!col.options) {
                              return ro ? (
                                <Text key={ci} style={[{ width: colWidth(col) }, styles.tdText]}>{c.values?.[k] || '—'}</Text>
                              ) : (
                                <TextInput key={ci} style={[styles.input, styles.tdInput, { width: colWidth(col) }]} value={values[k] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [k]: t }))} accessibilityLabel={`${l.text} ${col.name}`} />
                              );
                            }
                            const v = c.results[k];
                            return (
                              <View key={ci} style={[styles.optCell, { width: colWidth(col) }]}>
                                {col.options.map((o) => {
                                  const on = v === o;
                                  const red = on && answerIsBad(o, col);
                                  return (
                                    <TouchableOpacity key={o} disabled={ro} accessibilityLabel={`${l.text} ${col.name} ${o}`} onPress={() => setResults((x) => ({ ...x, [k]: x[k] === o ? '' : o }))} style={[styles.mini, on && styles.chipOn, red && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]}>
                                      <Text style={[styles.miniText, on && styles.chipTextOn]}>{o}</Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            );
                          })}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            );
          }
          return (
            <View key={sec.head?.id ?? `s${si}`}>
              {title}
              {sec.lines.map((l) => {
                n++;
                const v = c.results[l.id];
                const opts: { key: string; label: string }[] = l.options ? l.options.map((x) => ({ key: x, label: x })) : l.value ? [] : RES;
                const bad = answerIsBad(v, l);
                return (
                  <View key={l.id} style={[styles.line, bad && { borderColor: COLORS.danger }]}>
                    <Text style={styles.lineText}>{`${n}. ${l.text}`}</Text>
                    {opts.length ? (
                      <View style={styles.chips}>
                        {opts.map((r) => {
                          const on = v === r.key;
                          const red = on && answerIsBad(r.key, l);
                          return (
                            <TouchableOpacity key={r.key} disabled={ro} style={[styles.chip, on && styles.chipOn, red && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]} onPress={() => setResults((x) => ({ ...x, [l.id]: r.key }))}>
                              <Text style={[styles.chipText, on && styles.chipTextOn]}>{r.label}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                    {l.value ? (
                      ro ? (
                        <Text style={[styles.sub, { marginTop: 4 }]}>{`${l.value}: ${c.values?.[l.id] || '—'}`}</Text>
                      ) : (
                        <View style={styles.condRow}>
                          {UNITS.includes(l.value) ? null : <Text style={styles.readLabel}>{l.value}</Text>}
                          <TextInput style={[styles.input, styles.valueInput]} value={values[l.id] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [l.id]: t }))} accessibilityLabel={l.value} />
                          {UNITS.includes(l.value) ? <Text style={styles.unit}>{l.value}</Text> : null}
                        </View>
                      )
                    ) : null}
                  </View>
                );
              })}
            </View>
          );
        });
      })()}

      <Label>Remarks</Label>
      {ro ? <Text style={styles.value}>{c.remarks || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 70 }]} value={remarks} onChangeText={setRemarks} multiline />}

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
          <Dropdown
            caption="SIGNED BY — TAKING OVER"
            value={second ? secondId : ''}
            onChange={setSecondId}
            options={[{ value: '', label: 'Choose…' }, ...aboard.filter((p) => p.id !== signer?.key && p.name !== signer?.name).map((p) => ({ value: p.id, label: crewLabel(p) }))]}
            style={{ marginTop: SIZES.xs, maxWidth: 420 }}
          />
          <TouchableOpacity style={styles.btn} onPress={sign}>
            <Text style={styles.btnText}>{signer && second ? `Sign — ${signer.name} and ${second.name}` : 'Sign'}</Text>
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
    head: { color: COLORS.primary, fontWeight: '800', fontSize: SIZES.small, textTransform: 'uppercase', marginTop: SIZES.md, marginBottom: SIZES.xs },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    half: { flexGrow: 1, flexBasis: 220 },
    bad: { borderWidth: 1, borderColor: COLORS.danger },
    table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, overflow: 'hidden', marginBottom: SIZES.xs },
    tr: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 4, paddingHorizontal: 6, gap: 6 },
    th: { borderTopWidth: 0, backgroundColor: COLORS.glassCard?.backgroundColor ?? 'transparent' },
    thText: { color: COLORS.textLight, fontWeight: '700', fontSize: SIZES.small },
    trBad: { backgroundColor: 'rgba(231,76,60,0.12)' },
    tdName: { width: 150, color: COLORS.text, fontSize: SIZES.small, fontWeight: '600' },
    tdText: { color: COLORS.text, fontSize: SIZES.small },
    tdInput: { marginBottom: 0, paddingVertical: 4, paddingHorizontal: 6, fontSize: SIZES.small },
    optCell: { flexDirection: 'row', gap: 3 },
    mini: { paddingVertical: 3, paddingHorizontal: 7, borderRadius: 6, borderWidth: 1, borderColor: COLORS.primary },
    miniText: { color: COLORS.primary, fontWeight: '600', fontSize: 11 },
    condRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: SIZES.xs },
    condLabel: { width: 92, color: COLORS.text, fontSize: SIZES.small, fontWeight: '600' },
    dirLabel: { width: 'auto', marginLeft: 4 },
    readLabel: { minWidth: 60, color: COLORS.text, fontSize: SIZES.small, fontWeight: '600' },
    unit: { color: COLORS.textLight, fontSize: SIZES.small, minWidth: 14 },
    cell: { width: 58, marginBottom: 0, paddingVertical: 6, paddingHorizontal: SIZES.sm, textAlign: 'center' },
    valueInput: { flexGrow: 1, flexBasis: 120, marginBottom: 0, paddingVertical: 6 },
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
