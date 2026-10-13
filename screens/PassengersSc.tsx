// ===================================
// Passengers (types/passengers.ts) — the guests aboard, apart from the crew
// (13 Oct 2026: "besides the crew a yacht has passengers: a list, control at
// the gangway").
//
//   the list       on board / expected / disembarked / all, searched; name,
//                  group, cabin, nationality, embarked and left (date, port)
//   the gangway    where each one is — aboard, or ashore since when; the watch
//                  taps Ashore / Back aboard, or scans the passenger card
//                  (the crew card's QR scheme, msm://crew/<id>)
//   documents      ID, date of birth, contact ashore: officers and the Master
//                  only (passengers_private)
//   print          passenger cards, the passenger list (PDF)
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { Dropdown } from '../components/Dropdown';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { roleAtLeast } from '../types/role';
import { PASSENGER_GROUPS, Passenger, PassengerPrivate, passengerAboard } from '../types/passengers';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { isAshore, lastMoves, nextMove } from '../services/gangway';
import { exportPassengerCards } from '../services/crewCards';
import { exportPmsHistory } from '../services/pmsHistoryReport';
import { paxSheet, paxTemplateRows, planPaxImport } from '../services/passengerList';
import { pickPaxSheet, savePaxSheet } from '../services/passengerFiles';
import { formatDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';

type Show = 'aboard' | 'expected' | 'left' | 'all';
const ID_TYPES = ['Passport', 'ID card', 'Driving licence', 'Other'];
type Draft = Passenger & { priv: PassengerPrivate };

export default function PassengersSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { passengers, passengersPrivate, crewMoves, saveRow, saveRows, appendRow, vessel } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const { signer, picker } = useSigner('WATCH');
  const today = todayIso();

  const [show, setShow] = useState<Show>('aboard');
  const [q, setQ] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const last = useMemo(() => lastMoves(crewMoves), [crewMoves]);
  const privOf = (id: string) => passengersPrivate.find((x) => x.id === id);
  const state = (p: Passenger): Show => (p.disembarked && p.disembarked <= today ? 'left' : p.embarked && p.embarked > today ? 'expected' : 'aboard');
  const aboardList = passengers.filter((p) => passengerAboard(p, today));
  const ashore = aboardList.filter((p) => isAshore(p.id, last));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = passengers
    .filter((p) => show === 'all' || state(p) === show)
    .filter((p) => words.every((w) => `${p.name} ${p.cabin ?? ''} ${p.nationality ?? ''} ${p.group ?? ''}`.toLowerCase().includes(w)))
    .sort((a, b) => (a.cabin ?? '~').localeCompare(b.cabin ?? '~', undefined, { numeric: true }) || a.name.localeCompare(b.name));

  const done = (w: string | null | void) => typeof w === 'string' && setSaved(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
  const fail = (e: any) => Alert.alert('Passengers', String(e?.message ?? e));

  const cross = async (p: Passenger) => {
    if (!signer) return Alert.alert('Gangway watch', 'Choose the watch first.');
    const m = nextMove(p, crewMoves, signer.name, 'manual');
    await appendRow(storage.CREW_MOVES_KEY, m);
    playSuccessSound();
    setSaved(`${p.name} — ${m.dir === 'ashore' ? 'ashore' : 'back aboard'} ${m.time}`);
  };

  const blank = (): Draft => ({ id: uid('pax'), name: '', embarked: today, addedAt: Date.now(), updatedAt: Date.now(), priv: { id: '', updatedAt: Date.now() } });
  const open = (p?: Passenger) => setDraft(p ? { ...p, priv: privOf(p.id) ?? { id: p.id, updatedAt: Date.now() } } : blank());
  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const setP = (patch: Partial<PassengerPrivate>) => draft && setDraft({ ...draft, priv: { ...draft.priv, ...patch } });

  const save = async (extra?: Partial<Passenger>) => {
    if (!draft) return;
    if (!draft.name.trim()) return Alert.alert('Passenger', 'The full name, as in the passport.');
    const { priv, ...p } = { ...draft, ...extra };
    const clean = Object.fromEntries(Object.entries({ ...p, name: p.name.trim() }).filter(([, v]) => v !== '' && v !== undefined)) as unknown as Passenger;
    await saveRow(storage.PASSENGERS_KEY, clean);
    if (officer && Object.entries(priv).some(([k, v]) => k !== 'id' && k !== 'updatedAt' && v)) {
      await saveRow(storage.PASSENGERS_PRIVATE_KEY, Object.fromEntries(Object.entries({ ...priv, id: clean.id }).filter(([, v]) => v !== '' && v !== undefined)) as unknown as PassengerPrivate);
    }
    playSuccessSound();
    setDraft(null);
  };
  const remove = () =>
    draft &&
    Alert.alert('Remove passenger', `Remove “${draft.name}” from the list? A passenger who has left is better kept, with the date they left.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void save({ deleted: true }) },
    ]);

  const listPdf = () => {
    const rows = shown.map((p, i) => {
      const x = privOf(p.id);
      return [String(i + 1), p.name, p.group ?? '', p.cabin ?? '', p.nationality ?? '', ...(officer ? [x?.dateOfBirth ?? '', [x?.idType, x?.idNo].filter(Boolean).join(' '), x?.idExpiry ?? ''] : []), [p.embarked, p.embarkPort].filter(Boolean).join(' '), [p.disembarked, p.disembarkPort].filter(Boolean).join(' ')];
    });
    const head = ['#', 'Name', 'Group', 'Cabin', 'Nationality', ...(officer ? ['Date of birth', 'Identity document', 'Expires'] : []), 'Embarked', 'Disembarked'];
    return exportPmsHistory('Passenger list', `Passenger list ${today}`, vessel, [{ title: `Passenger list — ${formatDate(today)}`, facts: [`${aboardList.length - ashore.length} on board${ashore.length ? `, ${ashore.length} ashore now` : ''}`, show === 'all' ? 'all passengers' : show], tables: [{ title: 'Passengers', head, rows }] } as any]).then(done, fail);
  };

  // A filled-in sheet (the template's columns): matched by name — updated, or added (as the crew list).
  const importSheet = async () => {
    try {
      const picked = await pickPaxSheet();
      if (!picked) return;
      if (!picked.rows.length) return Alert.alert('Import', `No passengers found in “${picked.name}”. Use the passenger list template.`);
      const plan = planPaxImport(picked.rows, passengers, passengersPrivate, today);
      const apply = async () => {
        await saveRows(storage.PASSENGERS_KEY, plan.passengers);
        if (plan.privates.length) await saveRows(storage.PASSENGERS_PRIVATE_KEY, plan.privates);
        playSuccessSound();
        setSaved(`${plan.added.length} added, ${plan.updated.length} updated from “${picked.name}”`);
      };
      Alert.alert(`Import ${picked.rows.length} from “${picked.name}”?`, [plan.added.length ? `New: ${plan.added.join(', ')}.` : null, plan.updated.length ? `Updated (already on the list): ${plan.updated.join(', ')}.` : null, 'Empty cells leave what the app already has.'].filter(Boolean).join('\n\n'), [{ text: 'Cancel', style: 'cancel' }, { text: 'Import', onPress: () => void apply() }]);
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    }
  };

  const SHOW_OPTS: { value: Show; label: string }[] = [
    { value: 'aboard', label: `Current guests · ${passengers.filter((p) => state(p) === 'aboard').length}` },
    { value: 'expected', label: `Expected · ${passengers.filter((p) => state(p) === 'expected').length}` },
    { value: 'left', label: `Disembarked · ${passengers.filter((p) => state(p) === 'left').length}` },
    { value: 'all', label: `All · ${passengers.length}` },
  ];

  return (
    <Screen scroll>
      <ScreenTitle title="Passengers" subtitle={`${aboardList.length - ashore.length} on board${ashore.length ? ` · ${ashore.length} ashore now` : ''}`} help="Passengers" onScan={() => nav.navigate('Scan')} />
      <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm, gap: SIZES.xs }]}>
        <TextInput style={[styles.input, { flex: 2, minWidth: 220, marginTop: 0 }]} value={q} onChangeText={setQ} placeholder="Search — name, cabin, nationality" placeholderTextColor={COLORS.textLight} />
        <Dropdown caption="SHOW" value={show} onChange={setShow} options={SHOW_OPTS} style={{ flex: 1, minWidth: 200 }} />
        {picker ? <View style={{ flex: 1, minWidth: 220 }}>{picker}</View> : null}
      </View>
      <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm }]}>
        {officer ? <TouchableOpacity style={styles.btn} onPress={() => open()}><Text style={styles.btnText}>+ Passenger</Text></TouchableOpacity> : null}
        <TouchableOpacity style={styles.small} onPress={() => nav.navigate('Scan')}><Text style={styles.smallText}>Scan card</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} disabled={!aboardList.length} onPress={() => exportPassengerCards(aboardList, vessel).then(done, fail)}><Text style={styles.smallText}>Print passenger cards</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => void listPdf()}><Text style={styles.smallText}>Passenger list (PDF)</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => savePaxSheet(paxSheet(shown, passengersPrivate, officer), `Passenger list ${today}`, vessel).then(done, fail)}><Text style={styles.smallText}>Excel</Text></TouchableOpacity>
        {officer ? <TouchableOpacity style={styles.small} onPress={() => void importSheet()}><Text style={styles.smallText}>Import from Excel</Text></TouchableOpacity> : null}
        {officer ? <TouchableOpacity style={styles.small} onPress={() => savePaxSheet(paxTemplateRows(), 'Passenger list template', vessel).then(done, fail)}><Text style={styles.smallText}>Excel template</Text></TouchableOpacity> : null}
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}

      {draft ? (
        <Card>
          <Label>{passengers.some((p) => p.id === draft.id) ? 'Passenger' : 'New passenger'}</Label>
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="Full name as in the passport ★" placeholderTextColor={COLORS.textLight} autoFocus />
          <View style={styles.row}>
            <Dropdown caption="GROUP" value={draft.group ?? ''} onChange={(v: string) => set({ group: v || undefined })} options={[{ value: '', label: '—' }, ...PASSENGER_GROUPS.map((g) => ({ value: g, label: g }))]} style={{ flex: 1, minWidth: 200 }} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 120, marginTop: 0 }]} value={draft.cabin ?? ''} onChangeText={(v) => set({ cabin: v })} placeholder="Cabin" placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 140, marginTop: 0 }]} value={draft.nationality ?? ''} onChangeText={(v) => set({ nationality: v })} placeholder="Nationality" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label="Embarked" value={draft.embarked} onChange={(v) => set({ embarked: v })} /></View>
            <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={draft.embarkPort ?? ''} onChangeText={(v) => set({ embarkPort: v })} placeholder="Port embarked" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label="Disembarked" value={draft.disembarked} onChange={(v) => set({ disembarked: v })} onClear={() => set({ disembarked: undefined })} placeholder="Still aboard" /></View>
            <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={draft.disembarkPort ?? ''} onChangeText={(v) => set({ disembarkPort: v })} placeholder="Port disembarked" placeholderTextColor={COLORS.textLight} />
          </View>
          <TextInput style={styles.input} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} placeholder="Notes — diet, allergies told to the chef, mobility" placeholderTextColor={COLORS.textLight} />
          {officer ? (
            <>
              <Label>Documents — officers and the Master only</Label>
              <View style={styles.row}>
                <Dropdown caption="ID" value={draft.priv.idType ?? 'Passport'} onChange={(v: string) => setP({ idType: v })} options={ID_TYPES.map((t) => ({ value: t, label: t }))} style={{ flex: 1, minWidth: 180 }} />
                <TextInput style={[styles.input, { flex: 1, minWidth: 150, marginTop: 0 }]} value={draft.priv.idNo ?? ''} onChangeText={(v) => setP({ idNo: v, idType: draft.priv.idType ?? 'Passport' })} placeholder="Document No." placeholderTextColor={COLORS.textLight} />
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label="Document expires" value={draft.priv.idExpiry} onChange={(v) => setP({ idExpiry: v })} onClear={() => setP({ idExpiry: undefined })} /></View>
                <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label="Date of birth" value={draft.priv.dateOfBirth} onChange={(v) => setP({ dateOfBirth: v })} onClear={() => setP({ dateOfBirth: undefined })} defaultYear={1980} /></View>
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={draft.priv.phone ?? ''} onChangeText={(v) => setP({ phone: v })} placeholder="Phone" placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { flex: 2, minWidth: 220 }]} value={draft.priv.emergencyContact ?? ''} onChangeText={(v) => setP({ emergencyContact: v })} placeholder="Contact ashore — name, phone" placeholderTextColor={COLORS.textLight} />
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
            {passengers.some((p) => p.id === draft.id) && !draft.disembarked ? <TouchableOpacity style={styles.small} onPress={() => void save({ disembarked: today })}><Text style={styles.smallText}>Disembarked today</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={() => setDraft(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
            {passengers.some((p) => p.id === draft.id) ? <TouchableOpacity onPress={remove}><Text style={[styles.link, { color: COLORS.danger }]}>Remove</Text></TouchableOpacity> : null}
          </View>
        </Card>
      ) : null}

      {shown.map((p) => {
        const st = state(p);
        const away = st === 'aboard' && isAshore(p.id, last);
        const m = last.get(p.id);
        const x = officer ? privOf(p.id) : undefined;
        const expiring = x?.idExpiry && x.idExpiry <= today;
        return (
          <TouchableOpacity key={p.id} style={[styles.item, { borderLeftColor: st !== 'aboard' ? COLORS.border : away ? COLORS.warning : COLORS.success, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }]} onPress={() => officer && open(p)} activeOpacity={officer ? 0.7 : 1}>
            <MciIcon name={p.group === 'Owner' ? 'crown-outline' : 'account-outline'} size={20} color={COLORS.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.sub}>{[p.group, p.cabin ? `cabin ${p.cabin}` : null, p.nationality].filter(Boolean).join(' · ') || '—'}</Text>
              <Text style={styles.sub}>{[p.embarked ? `embarked ${formatDate(p.embarked)}${p.embarkPort ? ` ${p.embarkPort}` : ''}` : null, p.disembarked ? `${st === 'left' ? 'left' : 'leaves'} ${formatDate(p.disembarked)}${p.disembarkPort ? ` ${p.disembarkPort}` : ''}` : null].filter(Boolean).join(' · ')}</Text>
              {expiring ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{`${x?.idType ?? 'Document'} expired ${formatDate(x!.idExpiry!)}`}</Text> : null}
              {st === 'aboard' ? <Text style={[styles.sub, { color: away ? COLORS.warning : COLORS.success, fontWeight: '700' }]}>{away ? `Ashore since ${m?.date === today ? m.time : m ? `${formatDate(m.date)} ${m.time}` : '—'}` : 'Aboard'}</Text> : null}
            </View>
            {st === 'aboard' ? (
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: away ? COLORS.warning : COLORS.success, borderColor: away ? COLORS.warning : COLORS.success }]} onPress={() => void cross(p)} accessibilityLabel={`${p.name}: ${away ? 'ashore' : 'on board'} — tap to change`}>
                <MciIcon name="swap-horizontal" size={14} color={COLORS.textWhite} />
                <Text style={[styles.smallText, { color: COLORS.textWhite }]}>{away ? 'Ashore' : 'On board'}</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        );
      })}
      {!shown.length ? <Text style={styles.sub}>{passengers.length ? 'Nobody here.' : officer ? 'No passengers yet — add them as they join: the name as in the passport, the cabin.' : 'No passengers on the list.'}</Text> : null}
    </Screen>
  );
}
