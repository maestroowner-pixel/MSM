// ===================================
// One DP checklist — worked and signed (route { templateId }), or read back
// (route { id }). A signed record keeps a copy of the lines it was signed
// against and is never edited (firestore.rules: dp_checks has no update).
// Where and when are REQUIRED (16 Oct 2026, the owner): the position is typed
// or taken from the device, the date and time are the moment of signing — set
// by the app, shown in ship's time and UTC, not typed.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
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
import { ASOG_LABEL, BAD_ANSWERS, checkOutcome, conditionsText, coordText, parseCoord, positionText, templatesNow } from '../services/dp';
import { shipAndUtc } from '../utils/shipTime';
import { exportDpCheckPdf } from '../services/dpReport';
import { AsogStatus, DpCheck, DpConditions, DpResult } from '../types/dp';

const COND: [keyof DpConditions, string, string][] = [
  ['waterDepth', 'Water depth', 'm'],
  ['windSpeed', 'Wind speed', 'kn'],
  ['windDir', 'Wind direction', '°'],
  ['currentSpeed', 'Current speed', 'kn'],
  ['currentDir', 'Current direction', '°'],
  ['waveHeight', 'Wave height', 'm'],
  ['waveDir', 'Wave direction', '°'],
];

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
  const [results, setResults] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [unit, setUnit] = useState('');
  const [cond, setCond] = useState<DpConditions>({});
  const [latT, setLatT] = useState('');
  const [lonT, setLonT] = useState('');
  const [gps, setGps] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, [done]);
  // The last checklist's place, offered (not filled in) — a vessel on DP stays put for days.
  const last = useMemo(() => [...dpChecks].sort((a, b) => b.at - a.at).find((x) => x.position), [dpChecks]);

  if (!moduleOn('dp')) return <Screen><Empty text="Not available on this vessel." /></Screen>;
  const lat = parseCoord(latT, 'lat');
  const lon = parseCoord(lonT, 'lon');
  const offset = vessel?.ship_utc_offset;
  const c: DpCheck | null = done ?? (tpl ? { id: '', templateId: tpl.id, title: tpl.title, where: tpl.where, at: now, shipOffset: offset, position: { lat: lat ?? NaN, lon: lon ?? NaN }, operation, unit, conditions: cond, asog, lines: tpl.lines, results, values, remarks, by: '', updatedAt: 0 } : null);
  if (!c) return <Screen><Empty text="This checklist is not on this device." /></Screen>;
  const ro = !!done;
  const o = checkOutcome(c);
  const setPos = (a: number, b: number) => {
    setLatT(coordText(a, 'lat'));
    setLonT(coordText(b, 'lon'));
  };
  const geo: any = typeof navigator !== 'undefined' ? (navigator as any).geolocation : undefined;
  const fromDevice = () => {
    setGps('Reading the position…');
    geo.getCurrentPosition(
      (p: any) => {
        setPos(p.coords.latitude, p.coords.longitude);
        setGps(`From this device, ±${Math.round(p.coords.accuracy)} m — check it against the DP position.`);
      },
      (e: any) => setGps(`No position from this device (${e?.message || 'refused'}) — type it in.`),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  const sign = async () => {
    if (lat == null || lon == null) return Alert.alert('DP checklist', 'Enter the position the checklist is done at — latitude and longitude, e.g. 57 12.345 N and 001 23.456 E.');
    if (!signer) return Alert.alert('DP checklist', 'Choose who signs.');
    const finish = async () => {
      const clean = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const cc = clean(cond as Record<string, string>);
      const at = Date.now();
      const rec: DpCheck = { ...c, id: uid('dpc'), at, shipOffset: offset, position: { lat, lon }, operation: operation.trim() || undefined, unit: unit.trim() || undefined, conditions: Object.keys(cc).length ? cc : undefined, asog, values: Object.keys(clean(values)).length ? clean(values) : undefined, remarks: remarks.trim() || undefined, by: signer.name, byRank: signer.rank, byKey: signer.key, updatedAt: at };
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
      <ScreenTitle title={c.title} subtitle={ro ? `Signed by ${c.by}${c.byRank ? ` (${c.byRank})` : ''}` : c.where === 'engine' ? 'Engine room' : 'Bridge'} help="Dynamic positioning" />

      <Label>Date and time ★</Label>
      <Text style={styles.value}>{`${shipAndUtc(c.at, c.shipOffset).line}${ro ? '' : ' — set when signed'}`}</Text>
      <Label>Position ★</Label>
      {ro ? (
        <Text style={styles.value}>{positionText(c.position)}</Text>
      ) : (
        <>
          <View style={styles.pair}>
            <TextInput style={[styles.input, styles.half, latT && lat == null && styles.bad]} value={latT} onChangeText={setLatT} placeholder="Latitude  57 12.345 N" placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
            <TextInput style={[styles.input, styles.half, lonT && lon == null && styles.bad]} value={lonT} onChangeText={setLonT} placeholder="Longitude  001 23.456 E" placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
          </View>
          {lat != null && lon != null ? <Text style={[styles.sub, { marginBottom: SIZES.xs }]}>{`✓ ${positionText({ lat, lon })}`}</Text> : null}
          <View style={styles.chips}>
            {geo ? (
              <TouchableOpacity style={styles.chip} onPress={fromDevice}>
                <Text style={styles.chipText}>Use this device's position</Text>
              </TouchableOpacity>
            ) : null}
            {last ? (
              <TouchableOpacity style={styles.chip} onPress={() => setPos(last.position.lat, last.position.lon)}>
                <Text style={styles.chipText}>{`As the last checklist (${shipAndUtc(last.at, last.shipOffset).ship.slice(5)})`}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {gps ? <Text style={[styles.sub, { marginTop: 4 }]}>{gps}</Text> : null}
        </>
      )}

      <View style={styles.pair}>
        <View style={styles.half}>
          <Label>Field</Label>
          {ro ? <Text style={styles.value}>{c.operation || '—'}</Text> : <TextInput style={styles.input} value={operation} onChangeText={setOperation} placeholder="e.g. Block 21/4, ROV survey" placeholderTextColor={COLORS.textLight} />}
        </View>
        <View style={styles.half}>
          <Label>Offshore unit</Label>
          {ro ? <Text style={styles.value}>{c.unit || '—'}</Text> : <TextInput style={styles.input} value={unit} onChangeText={setUnit} placeholder="Installation / rig / FPSO" placeholderTextColor={COLORS.textLight} />}
        </View>
      </View>
      <Label>Conditions</Label>
      {ro ? (
        <Text style={styles.value}>{conditionsText(c.conditions) || '—'}</Text>
      ) : (
        <View style={styles.condGrid}>
          {COND.map(([k, label, ph]) => (
            <TextInput key={k} style={[styles.input, styles.cond]} value={cond[k] ?? ''} onChangeText={(v) => setCond((x) => ({ ...x, [k]: v }))} placeholder={`${label} ${ph}`} placeholderTextColor={COLORS.textLight} />
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
        {!ro ? (
          <TouchableOpacity onPress={() => setResults((x) => ({ ...x, ...Object.fromEntries(c.lines.filter((l) => !l.head && !l.options && !l.value).map((l) => [l.id, x[l.id] ?? 'pass'])) }))}>
            <Text style={styles.link}>All Yes / No items yes — then change what is not</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {(() => {
        let n = 0;
        return c.lines.map((l) => {
          if (l.head) return <Text key={l.id} style={styles.head}>{l.text}</Text>;
          n++;
          const v = c.results[l.id];
          const opts: { key: string; label: string }[] = l.options ? l.options.map((x) => ({ key: x, label: x })) : l.value ? [] : RES;
          const bad = !!v && BAD_ANSWERS.includes(v);
          return (
            <View key={l.id} style={[styles.line, bad && { borderColor: COLORS.danger }]}>
              <Text style={styles.lineText}>{`${n}. ${l.text}`}</Text>
              {opts.length ? (
                <View style={styles.chips}>
                  {opts.map((r) => {
                    const on = v === r.key;
                    const red = on && BAD_ANSWERS.includes(r.key);
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
                  <TextInput style={[styles.input, styles.valueInput]} value={values[l.id] ?? ''} onChangeText={(t) => setValues((x) => ({ ...x, [l.id]: t }))} placeholder={l.value} placeholderTextColor={COLORS.textLight} />
                )
              ) : null}
            </View>
          );
        });
      })()}

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
    head: { color: COLORS.primary, fontWeight: '800', fontSize: SIZES.small, textTransform: 'uppercase', marginTop: SIZES.md, marginBottom: SIZES.xs },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    half: { flexGrow: 1, flexBasis: 220 },
    bad: { borderWidth: 1, borderColor: COLORS.danger },
    condGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
    cond: { flexGrow: 1, flexBasis: 140, marginBottom: 0 },
    valueInput: { marginTop: SIZES.xs, marginBottom: 0, paddingVertical: 6 },
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
