// ===================================
// SOPEP — the oil-spill locker and the drills (types/sopep.ts).
//
//   Locker     the plan's list: item, quantity required, where. Starts from a
//              typical yacht list; edit it to the vessel's own SOPEP.
//   Check      count every line, mark what is damaged or out of date, sign.
//              The last check's shortages show on the locker list.
//   Drills     scenario, who took part, how long, lessons — signed.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { SOPEP_STARTER, SopepCheck, SopepDrill, SopepItem } from '../types/sopep';
import { isAboard } from '../types/crew';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

type Tab = 'locker' | 'check' | 'drills';

const SCENARIOS = ['Overflow / spill during bunkering', 'Hydraulic oil leak on deck', 'Leak from the hull or a fuel tank', 'Oil in the bilge discharged by mistake', 'Spill during oil change / transfer'];

export default function SopepSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { sopepItems: items, sopepChecks, sopepDrills, crew, saveRow, appendRow } = useData();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const [tab, setTab] = useState<Tab>('locker');
  const today = todayIso();

  const lastCheck = useMemo(() => [...sopepChecks].sort((a, b) => b.at - a.at)[0], [sopepChecks]);
  const lastDrill = useMemo(() => [...sopepDrills].sort((a, b) => b.at - a.at)[0], [sopepDrills]);
  const short = (i: SopepItem) => lastCheck && (lastCheck.counted[i.id] ?? 0) < i.required;
  const shortCount = items.filter((i) => short(i)).length;

  const stamp = async (what: string) => {
    if (!signer) {
      Alert.alert('Who is signing?', 'Choose your name below.');
      return null;
    }
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
    if (!sig) return null;
    return { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) };
  };

  // ---- locker ----
  const addStarter = async () => {
    for (let i = 0; i < SOPEP_STARTER.length; i++) await saveRow(storage.SOPEP_ITEMS_KEY, { id: uid('sop'), ...SOPEP_STARTER[i], order: i } as any);
  };

  // ---- check ----
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const saveCheck = async () => {
    const counted: Record<string, number> = {};
    for (const i of items) {
      const v = Number((counts[i.id] ?? '').replace(',', '.'));
      if ((counts[i.id] ?? '').trim() === '' || !Number.isFinite(v)) return Alert.alert('Inventory', `Count “${i.name}”.`);
      counted[i.id] = v;
    }
    const s = await stamp('SOPEP inventory check');
    if (!s) return;
    const c: SopepCheck = { id: uid('sopc'), date: today, counted, ...(bad.length ? { defective: bad } : {}), ...(remarks.trim() ? { remarks: remarks.trim() } : {}), ...s, updatedAt: Date.now() };
    await appendRow(storage.SOPEP_CHECKS_KEY, c);
    setCounts({});
    setBad([]);
    setRemarks('');
    setTab('locker');
    playSuccessSound();
  };

  // ---- drill ----
  const [d, setD] = useState({ scenario: SCENARIOS[0], minutes: '', lessons: '', team: [] as string[] });
  const people = crew.filter(isAboard);
  const saveDrill = async () => {
    if (!d.team.length) return Alert.alert('Drill', 'Mark who took part.');
    const s = await stamp(`SOPEP drill — ${d.scenario}`);
    if (!s) return;
    const r: SopepDrill = {
      id: uid('sopd'), date: today, time: new Date().toTimeString().slice(0, 5), scenario: d.scenario, participants: d.team,
      ...(Number(d.minutes) > 0 ? { minutes: Number(d.minutes) } : {}), ...(d.lessons.trim() ? { lessons: d.lessons.trim() } : {}), ...s, updatedAt: Date.now(),
    };
    await appendRow(storage.SOPEP_DRILLS_KEY, r);
    setD({ scenario: SCENARIOS[0], minutes: '', lessons: '', team: [] });
    playSuccessSound();
  };

  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <ScreenTitle title="SOPEP" subtitle="Oil spill locker, inventory checks and drills" help="SOPEP" />
      <View style={styles.summary}>
        <Text style={[styles.sumItem, shortCount ? { color: COLORS.danger } : null]}>{lastCheck ? `Last check ${formatDate(lastCheck.date)}${shortCount ? ` · ${shortCount} short` : ' · complete'}` : 'Never checked'}</Text>
        <Text style={styles.sumItem}>{lastDrill ? `Last drill ${formatDate(lastDrill.date)}` : 'No drill recorded'}</Text>
      </View>
      <View style={styles.tabs}>
        {([['locker', `Locker · ${items.length}`], ['check', 'Inventory check'], ['drills', `Drills · ${sopepDrills.length}`]] as [Tab, string][]).map(([k, l]) => (
          <Chip key={k} on={tab === k} label={l} onPress={() => setTab(k)} />
        ))}
      </View>

      {tab === 'locker' ? (
        <>
          {items.map((i) => (
            <View key={i.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <TextInput style={styles.itemName} defaultValue={i.name} onEndEditing={(e) => e.nativeEvent.text.trim() && void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, name: e.nativeEvent.text.trim() })} onBlur={(e: any) => { const v = String(e?.target?.value ?? '').trim(); if (v && v !== i.name) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, name: v }); }} />
                <TextInput style={styles.sub} defaultValue={i.location ?? ''} placeholder="Location" placeholderTextColor={COLORS.textLight} onBlur={(e: any) => { const v = String(e?.target?.value ?? e?.nativeEvent?.text ?? '').trim(); if (v !== (i.location ?? '')) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, location: v }); }} onEndEditing={(e) => void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, location: e.nativeEvent.text.trim() })} />
              </View>
              <Text style={[styles.qty, short(i) ? { color: COLORS.danger } : null]}>
                {lastCheck ? `${lastCheck.counted[i.id] ?? 0} / ` : ''}{`${i.required} ${i.unit ?? ''}`}
              </Text>
              <TouchableOpacity onPress={() => Alert.alert('Remove', `Remove “${i.name}” from the locker list?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, deleted: true }) }])} hitSlop={8}>
                <MciIcon name="delete-outline" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
          ))}
          {items.length ? (
            <TouchableOpacity onPress={() => void saveRow(storage.SOPEP_ITEMS_KEY, { id: uid('sop'), name: 'New item', required: 1, order: items.length } as any)}>
              <Text style={styles.link}>+ Add an item</Text>
            </TouchableOpacity>
          ) : (
            <Card>
              <Text style={styles.sub}>No locker list yet. Start from a typical yacht SOPEP locker (16 items) and edit it to the vessel’s plan.</Text>
              <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void addStarter()}><Text style={styles.btnText}>Add the typical list</Text></TouchableOpacity>
            </Card>
          )}
          {lastCheck?.defective?.length ? <Text style={[styles.sub, { color: COLORS.warning }]}>{`To replace: ${lastCheck.defective.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean).join(', ')}`}</Text> : null}
        </>
      ) : tab === 'check' ? (
        <Card>
          <Label>Count the locker</Label>
          {items.map((i) => (
            <View key={i.id} style={styles.countRow}>
              <Text style={styles.countName} numberOfLines={2}>{`${i.name} (${i.required} ${i.unit ?? ''})`}</Text>
              <TextInput style={styles.countInput} value={counts[i.id] ?? ''} onChangeText={(v) => setCounts({ ...counts, [i.id]: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textLight} />
              <TouchableOpacity onPress={() => setBad(bad.includes(i.id) ? bad.filter((x) => x !== i.id) : [...bad, i.id])} style={[styles.badBtn, bad.includes(i.id) && { backgroundColor: COLORS.warning, borderColor: COLORS.warning }]}>
                <Text style={[styles.badText, bad.includes(i.id) && { color: COLORS.textWhite }]}>Replace</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder="Remarks" placeholderTextColor={COLORS.textLight} />
          {picker ? <><Text style={styles.sub}>Checked by</Text>{picker}</> : null}
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveCheck()}><Text style={styles.btnText}>Sign the check</Text></TouchableOpacity>
          {sopepChecks.length ? <Label>Previous checks</Label> : null}
          {[...sopepChecks].sort((a, b) => b.at - a.at).map((c) => (
            <Text key={c.id} style={styles.sub}>{`${formatDate(c.date)} · ${c.by}${items.filter((i) => (c.counted[i.id] ?? 0) < i.required).length ? ` · ${items.filter((i) => (c.counted[i.id] ?? 0) < i.required).length} short` : ' · complete'}${c.remarks ? ` · ${c.remarks}` : ''}`}</Text>
          ))}
        </Card>
      ) : (
        <>
          <Card>
            <Label>Record a drill — today</Label>
            <View style={styles.chips}>
              {SCENARIOS.map((s) => <Chip key={s} on={d.scenario === s} label={s} onPress={() => setD({ ...d, scenario: s })} />)}
            </View>
            <TextInput style={styles.input} value={SCENARIOS.includes(d.scenario) ? '' : d.scenario} onChangeText={(v) => setD({ ...d, scenario: v || SCENARIOS[0] })} placeholder="…or describe another scenario" placeholderTextColor={COLORS.textLight} />
            <Label>Who took part</Label>
            <View style={styles.chips}>
              {people.map((p) => <Chip key={p.id} on={d.team.includes(p.name)} label={p.name} onPress={() => setD({ ...d, team: d.team.includes(p.name) ? d.team.filter((n) => n !== p.name) : [...d.team, p.name] })} />)}
            </View>
            <View style={styles.pair}>
              <TextInput style={[styles.input, { maxWidth: 140 }]} value={d.minutes} onChangeText={(v) => setD({ ...d, minutes: v })} placeholder="Minutes" placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
              <TextInput style={[styles.input, { flex: 3 }]} value={d.lessons} onChangeText={(v) => setD({ ...d, lessons: v })} placeholder="Lessons learned, actions" placeholderTextColor={COLORS.textLight} multiline />
            </View>
            {picker ? <><Text style={styles.sub}>Drill conducted by</Text>{picker}</> : null}
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveDrill()}><Text style={styles.btnText}>Sign the drill</Text></TouchableOpacity>
          </Card>
          {[...sopepDrills].sort((a, b) => b.at - a.at).map((x) => (
            <View key={x.id} style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{x.scenario}</Text>
                <Text style={styles.sub}>{[`${formatDate(x.date)} ${x.time ?? ''}`, `${x.participants.length} took part`, x.minutes ? `${x.minutes} min` : null, x.by].filter(Boolean).join(' · ')}</Text>
                {x.lessons ? <Text style={styles.sub}>{x.lessons}</Text> : null}
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    summary: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.md, marginBottom: SIZES.sm },
    sumItem: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textDark },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    item: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md, marginBottom: SIZES.xs },
    itemName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark, paddingVertical: 2 },
    itemTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    qty: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    link: { color: COLORS.primary, fontWeight: '700', marginTop: SIZES.sm },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md, marginTop: SIZES.sm },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    countRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    countName: { flex: 1, fontSize: SIZES.body, color: COLORS.textDark },
    countInput: { width: 80, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.sm, paddingVertical: 6, fontSize: SIZES.body, color: COLORS.text, textAlign: 'right' },
    badBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
    badText: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight },
    pair: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },
    input: { flex: 1, minWidth: 120, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
  });
