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
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useSignConfirm } from '../components/SignConfirm';
import { SignaturePad, SignatureView } from '../components/SignaturePad';
import { useSync } from '../contexts/SyncContext';
import { personName } from '../types/role';
import { SignProof, proofShort } from '../services/signature';
import { Dropdown } from '../components/Dropdown';
import { crewLabel, isAboard, isOfficerRank } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { ASOG_LABEL, answerIsBad, cellKey, checkOutcome, formatCell, isOther, otherKey, sectionCols, conditionsText, positionFromText, positionText, templatesNow } from '../services/dp';
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
const colWidth = (col: { options?: string[] }) => (col.options ? col.options.reduce((w, o) => w + o.length * 8.2 + 26, 0) + (col.options.length - 1) * 4 + (col.options.some(isOther) ? 104 : 0) : 100);

/** A reading named by its unit ([kn], [m]) shows the unit after the cell, as written on paper. */
const UNITS = ['kn', 'm', '°', '°/min', '%', 's', 'bar', 'rpm'];

/** The schematic's own box — wider than tall, as the space on the paper form. */
const SKETCH_W = 300;
const SKETCH_H = 200;

const ROLE = ['Handing over', 'Taking over'] as const;
interface Sig { key: string; name: string; rank?: string; proof?: SignProof; at: number }

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
  // Two signatures, each a person picked by name and confirmed by PIN or by hand
  // (16 Oct 2026: "the bridge pad cannot hold every officer's fingerprint") — the
  // device's own account is one of the names, and on an officer's own phone it may
  // use the fingerprint.
  const { crew } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const [sigs, setSigs] = useState<(Sig | null)[]>([null, null]);
  const [pickIds, setPickIds] = useState<string[]>(['', '']);
  const [sketchFor, setSketchFor] = useState<string | null>(null);
  const [sketchDraft, setSketchDraft] = useState('');
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

  const people = useMemo(() => {
    // Officers only — the DP checklists are the officers' (16 Oct 2026).
    const list: { id: string; name: string; rank?: string; own: boolean }[] = crew.filter((m) => isAboard(m) && isOfficerRank(m.rank)).map((m) => ({ id: m.id, name: m.name, rank: m.rank, own: false }));
    if (sync.me && roleAtLeast(sync.role, 'admin')) list.unshift({ id: `device:${sync.me.id}`, name: personName(sync.me), rank: sync.me.position || undefined, own: true });
    return list;
  }, [crew, sync.me, sync.role]);

  if (!moduleOn('dp')) return <Screen><Empty text="Not available on this vessel." /></Screen>;
  const here = positionFromText(posT);
  const lat = here?.lat;
  const lon = here?.lon;
  const offset = vessel?.ship_utc_offset;
  const c: DpCheck | null = done ?? (tpl ? { id: '', templateId: tpl.id, title: tpl.title, where: tpl.where, at: now, shipOffset: offset, position: { lat: lat ?? NaN, lon: lon ?? NaN }, operation, unit, conditions: cond, asog, lines: tpl.lines, results, values, remarks, by: '', updatedAt: 0 } : null);
  if (!c) return <Screen><Empty text="This checklist is not on this device." /></Screen>;
  const ro = !!done;
  const o = checkOutcome(c);
  const ownFields = c.lines.filter((l) => l.kind === 'field');
  const inTable = sectionCols(c.lines);
  const plainLines = c.lines.filter((l) => !l.head && !l.kind && !l.options && !l.value && !inTable.get(l.id));
  const signRow = async (row: 0 | 1) => {
    if (lat == null || lon == null) return Alert.alert('DP checklist', 'Enter the position first — degrees, minutes and N/S, E/W from the DGPS.');
    const p = people.find((x) => x.id === pickIds[row]);
    if (!p) return Alert.alert('DP checklist', `Choose the name — ${ROLE[row].toLowerCase()}.`);
    const other = sigs[1 - row];
    if (other && (other.key === p.id || other.name === p.name)) return Alert.alert('DP checklist', 'Two different people sign: the one handing over and the one taking over.');
    const res = await confirmSign({ personKey: p.id, name: p.name, ownDevice: p.own, what: `${c.title} — ${ROLE[row].toLowerCase()}`, always: true });
    if (!res) return;
    setSigs((x) => x.map((v, i) => (i === row ? { key: p.id, name: p.name, rank: p.rank, proof: res.proof, at: Date.now() } : v)));
  };
  const save = async () => {
    const [a, b] = sigs;
    if (lat == null || lon == null) return Alert.alert('DP checklist', 'Enter the position the checklist is done at — degrees, minutes and N/S, E/W from the DGPS.');
    if (!a || !b) return Alert.alert('DP checklist', 'Both sign before it is saved: the one handing over and the one taking over.');
    const finish = async () => {
      const clean = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const cc = clean(cond as Record<string, string>);
      const at = Date.now();
      const rec: DpCheck = { ...c, id: uid('dpc'), at, shipOffset: offset, position: { lat, lon }, operation: operation.trim() || undefined, unit: unit.trim() || undefined, conditions: Object.keys(cc).length ? cc : undefined, asog, values: Object.keys(clean(values)).length ? clean(values) : undefined, remarks: remarks.trim() || undefined, by: a.name, byRank: a.rank, byKey: a.key, byWith: a.proof, by2: b.name, by2Rank: b.rank, by2Key: b.key, by2With: b.proof, updatedAt: at };
      // Firestore takes no undefined.
      for (const k of Object.keys(rec) as (keyof DpCheck)[]) if (rec[k] === undefined) delete rec[k];
      await saveRow(storage.DP_CHECKS_KEY, rec);
      nav.replace('DpCheck', { id: rec.id });
    };
    const warn = [o.open ? `${o.open} not answered` : '', o.fail ? `${o.fail} answered No` : ''].filter(Boolean).join(', ');
    Alert.alert('Save the signed checklist?', `${warn ? `${warn}. ` : ''}A signed checklist cannot be changed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Save', onPress: () => void finish() },
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

      {ownFields.length ? (
        <View style={styles.pair}>
          {ownFields.map((l) => (
            <View key={l.id} style={styles.half}>
              <Label>{l.text}</Label>
              {ro ? <Text style={styles.value}>{c.values?.[l.id] || '—'}</Text> : <TextInput style={styles.input} value={values[l.id] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [l.id]: t }))} accessibilityLabel={l.text} />}
            </View>
          ))}
        </View>
      ) : (
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
      )}
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

      {ownFields.length ? null : <Label>Conditions</Label>}
      {ownFields.length ? null : ro ? (
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
        <Label>{`Items (${c.lines.filter((l) => !l.head && !l.kind).length})`}</Label>
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
          if (l.kind) continue;
          if (l.head || !secs.length) secs.push({ head: l.head ? l : undefined, lines: [] });
          if (!l.head && !l.kind) secs[secs.length - 1].lines.push(l);
        }
        let n = 0;
        const els = secs.map((sec, si) => {
          const cols = sec.head?.cols;
          const title = sec.head ? <Text style={styles.head}>{sec.head.text}</Text> : null;
          if (cols?.length) {
            const nameW = sec.lines.some((l) => l.text.length > 40) ? 320 : 170;
            const yesCol = cols.findIndex((x) => x.options?.includes('Yes'));
            return (
              <View key={sec.head!.id}>
                <View style={styles.headRow}>
                  {title}
                  {!ro && yesCol >= 0 ? (
                    <TouchableOpacity onPress={() => setResults((x) => ({ ...x, ...Object.fromEntries(sec.lines.map((l) => [cellKey(l.id, yesCol), x[cellKey(l.id, yesCol)] || 'Yes'])) }))} hitSlop={6}>
                      <Text style={styles.small}>{`All ${cols[yesCol].name} — Yes`}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.table}>
                    <View style={[styles.tr, styles.th]}>
                      <Text style={[styles.tdName, styles.thText, { width: nameW }]}> </Text>
                      {cols.map((col, ci) => (
                        <Text key={ci} style={[{ width: colWidth(col) }, styles.thText]}>{col.name}</Text>
                      ))}
                    </View>
                    {sec.lines.map((l) => {
                      n++;
                      const rowBad = cols.some((col, ci) => col.options && answerIsBad(c.results[cellKey(l.id, ci)], col));
                      return (
                        <View key={l.id} style={[styles.tr, rowBad && styles.trBad]}>
                          <Text style={[styles.tdName, { width: nameW }]}>{l.text}</Text>
                          {cols.map((col, ci) => {
                            const k = cellKey(l.id, ci);
                            if (!col.options) {
                              return ro ? (
                                <Text key={ci} style={[{ width: colWidth(col) }, styles.tdText]}>{c.values?.[k] || '—'}</Text>
                              ) : (
                                <TextInput key={ci} style={[styles.input, styles.tdInput, { width: colWidth(col) }]} value={values[k] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [k]: t }))} keyboardType={col.format ? 'decimal-pad' : undefined} onBlur={col.format ? () => setValues((x) => ({ ...x, [k]: formatCell(x[k] ?? '', col.format) })) : undefined} accessibilityLabel={`${l.text} ${col.name}`} />
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
                                {isOther(v) ? (
                                  ro ? (
                                    <Text style={styles.tdText}>{c.values?.[otherKey(k)] || ''}</Text>
                                  ) : (
                                    <TextInput style={[styles.input, styles.tdInput, { width: 90 }]} value={values[otherKey(k)] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [otherKey(k)]: t }))} accessibilityLabel={`${l.text} ${col.name} other`} autoFocus />
                                  )
                                ) : null}
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
                    {isOther(v) ? (
                      ro ? (
                        <Text style={[styles.sub, { marginTop: 4 }]}>{c.values?.[otherKey(l.id)] || '—'}</Text>
                      ) : (
                        <TextInput style={[styles.input, { marginTop: SIZES.xs, marginBottom: 0 }]} value={values[otherKey(l.id)] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [otherKey(l.id)]: t }))} accessibilityLabel={`${l.text} other`} autoFocus />
                      )
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
        // A section marked "beside" shares a row with the one before it (wraps on a phone).
        const rows: React.ReactNode[][] = [];
        secs.forEach((sec, i) => (sec.head?.beside && rows.length ? rows[rows.length - 1].push(els[i]) : rows.push([els[i]])));
        return rows.map((r, i) => (r.length === 1 ? r[0] : <View key={`row${i}`} style={styles.besideRow}>{r.map((e, j) => <View key={j} style={{ flexShrink: 1 }}>{e}</View>)}</View>));
      })()}

      {c.lines.filter((l) => l.kind === 'text' || l.kind === 'sketch').map((l) => (
        <View key={l.id}>
          <Label>{l.text}</Label>
          {l.kind === 'text' ? (
            ro ? <Text style={styles.value}>{c.values?.[l.id] || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 70 }]} value={values[l.id] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [l.id]: t }))} multiline accessibilityLabel={l.text} />
          ) : ro ? (
            c.values?.[l.id] ? <SignatureView path={c.values[l.id]} height={200} boxW={SKETCH_W} boxH={SKETCH_H} color={COLORS.textDark} /> : <Text style={styles.value}>—</Text>
          ) : (
            <View>
              {values[l.id] ? <SignatureView path={values[l.id]} height={140} boxW={SKETCH_W} boxH={SKETCH_H} color={COLORS.textDark} /> : null}
              <TouchableOpacity style={[styles.chip, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={() => { setSketchDraft(values[l.id] ?? ''); setSketchFor(l.id); }}>
                <Text style={styles.chipText}>{values[l.id] ? 'Redraw the schematic' : 'Draw the schematic'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <Label>Remarks</Label>
      {ro ? <Text style={styles.value}>{c.remarks || '—'}</Text> : <TextInput style={[styles.input, { minHeight: 70 }]} value={remarks} onChangeText={setRemarks} multiline />}

      <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{`${o.pass} yes · ${o.fail} no · ${o.na} n/a${o.open ? ` · ${o.open} not answered` : ''}`}</Text>
      {ro ? (
        <>
          <Label>Signatures</Label>
          {[
            { role: ROLE[0], name: c.by, rank: c.byRank, proof: c.byWith },
            { role: ROLE[1], name: c.by2, rank: c.by2Rank, proof: c.by2With },
          ].map((x) => (
            <View key={x.role} style={styles.sigRow}>
              <Text style={styles.sigRole}>{x.role}</Text>
              <View style={{ flex: 1, minWidth: 180 }}>
                <Text style={styles.value}>{x.name ? `${x.name}${x.rank ? ` (${x.rank})` : ''}${x.proof ? ` · ${proofShort(x.proof)}` : ''}` : '—'}</Text>
                {x.proof?.drawing ? <SignatureView path={x.proof.drawing} height={36} color={COLORS.textDark} /> : null}
              </View>
            </View>
          ))}
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
          <Label>Signatures ★</Label>
          {([0, 1] as const).map((row) => {
            const done = sigs[row];
            const taken = sigs[1 - row];
            return (
              <View key={row} style={styles.sigRow}>
                <Text style={styles.sigRole}>{ROLE[row]}</Text>
                {done ? (
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Text style={styles.value}>{`✓ ${done.name}${done.rank ? ` (${done.rank})` : ''} · ${proofShort(done.proof) || 'signed'}`}</Text>
                    {done.proof?.drawing ? <SignatureView path={done.proof.drawing} height={36} color={COLORS.textDark} /> : null}
                  </View>
                ) : (
                  <Dropdown
                    caption="NAME"
                    value={pickIds[row]}
                    onChange={(v: string) => setPickIds((x) => x.map((y, i) => (i === row ? v : y)))}
                    options={[{ value: '', label: 'Choose the name…' }, ...people.filter((p) => !taken || (p.id !== taken.key && p.name !== taken.name)).map((p) => ({ value: p.id, label: p.own ? `${crewLabel(p)} — this device` : crewLabel(p) }))]}
                    style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
                  />
                )}
                {done ? (
                  <TouchableOpacity onPress={() => setSigs((x) => x.map((v, i) => (i === row ? null : v)))} hitSlop={8}>
                    <Text style={styles.link}>Undo</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.signBtn, !pickIds[row] && { opacity: 0.5 }]} onPress={() => void signRow(row)}>
                    <Text style={styles.btnText}>Sign</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          {people.length < 2 ? <Text style={styles.sub}>Two officers sign — the crew list (Crew) needs the officers aboard with their rank (Master, Chief Officer, DPO, Engineer…).</Text> : null}
          <TouchableOpacity style={[styles.btn, !(sigs[0] && sigs[1]) && { opacity: 0.5 }]} onPress={save}>
            <Text style={styles.btnText}>Save the signed checklist</Text>
          </TouchableOpacity>
        </>
      )}
      {/* The schematic is drawn in its own window, big, with a stylus (16 Oct 2026). */}
      <Modal visible={!!sketchFor} transparent animationType="fade" onRequestClose={() => setSketchFor(null)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{c.lines.find((l) => l.id === sketchFor)?.text ?? 'Schematic'}</Text>
            <SignaturePad big hint="Own vessel, rig, wind and current" value={sketchDraft} onChange={setSketchDraft} boxW={SKETCH_W} boxH={SKETCH_H} />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => setSketchDraft('')} hitSlop={8}>
                <Text style={[styles.link, { color: COLORS.danger }]}>Clear</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setSketchFor(null)} hitSlop={8}>
                <Text style={styles.link}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.signBtn} onPress={() => { const id = sketchFor!; setValues((x) => ({ ...x, [id]: sketchDraft })); setSketchFor(null); }}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    tr: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.border, paddingVertical: 6, paddingHorizontal: 8, gap: 8 },
    th: { borderTopWidth: 0, backgroundColor: COLORS.glassCard?.backgroundColor ?? 'transparent' },
    thText: { color: COLORS.textLight, fontWeight: '700', fontSize: SIZES.body },
    trBad: { backgroundColor: 'rgba(231,76,60,0.12)' },
    tdName: { width: 170, color: COLORS.text, fontSize: SIZES.body, fontWeight: '600' },
    tdText: { color: COLORS.text, fontSize: SIZES.body },
    tdInput: { marginBottom: 0, paddingVertical: 7, paddingHorizontal: 8, fontSize: SIZES.body },
    optCell: { flexDirection: 'row', gap: 4 },
    mini: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary },
    miniText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
    small: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md },
    modalCard: { backgroundColor: COLORS.cardSolid, borderRadius: SIZES.radiusMd, padding: SIZES.md, width: '100%', maxWidth: 900 },
    modalTitle: { color: COLORS.text, fontWeight: '800', fontSize: SIZES.body },
    modalBtns: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md },
    besideRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: SIZES.lg, alignItems: 'flex-start' },
    sigRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.xs, paddingVertical: SIZES.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    sigRole: { width: 100, color: COLORS.text, fontWeight: '700', fontSize: SIZES.small },
    signBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 9, paddingHorizontal: SIZES.lg },
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
