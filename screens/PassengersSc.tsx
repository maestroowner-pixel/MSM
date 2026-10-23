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

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

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
import { PaxRow, paxSheet, paxTemplateRows, planPaxImport, readPaxRows } from '../services/passengerList';
import { pickSheetRows } from '../services/sheetFiles';
import { aiRenameHeadings } from '../services/aiImport';
import { aiReady } from '../services/ai';
import { pickPaxSheet, savePaxSheet } from '../services/passengerFiles';
import { formatDate, uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, useT } from '../utils/i18n';

type Show = 'aboard' | 'expected' | 'left' | 'all';
const ID_TYPES = ['Passport', 'ID card', 'Driving licence', 'Other'];
type Draft = Passenger & { priv: PassengerPrivate };

export default function PassengersSc() {
  useT();
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

  // A passenger card scanned anywhere but the gangway opens the passenger here (ScanSc).
  const route = useRoute<any>();
  const openId: string | undefined = route.params?.open;
  useEffect(() => {
    const p = openId ? passengers.find((x) => x.id === openId) : undefined;
    if (!p) return;
    setShow('all');
    if (officer) setDraft({ ...p, priv: passengersPrivate.find((x) => x.id === p.id) ?? { id: p.id, updatedAt: Date.now() } });
    else setQ(p.name);
    nav.setParams({ open: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);
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

  const done = (w: string | null | void) => typeof w === 'string' && setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  const fail = (e: any) => Alert.alert(t('pax.title'), String(e?.message ?? e));

  const cross = async (p: Passenger) => {
    if (!signer) return Alert.alert(t('pax.gangwayWatch'), t('pax.chooseWatch'));
    const m = nextMove(p, crewMoves, signer.name, 'manual');
    await appendRow(storage.CREW_MOVES_KEY, m);
    playSuccessSound();
    setSaved(`${p.name} — ${m.dir === 'ashore' ? t('pax.wentAshore') : t('pax.backAboard')} ${m.time}`);
  };

  const blank = (): Draft => ({ id: uid('pax'), name: '', embarked: today, addedAt: Date.now(), updatedAt: Date.now(), priv: { id: '', updatedAt: Date.now() } });
  const open = (p?: Passenger) => setDraft(p ? { ...p, priv: privOf(p.id) ?? { id: p.id, updatedAt: Date.now() } } : blank());
  const set = (patch: Partial<Draft>) => draft && setDraft({ ...draft, ...patch });
  const setP = (patch: Partial<PassengerPrivate>) => draft && setDraft({ ...draft, priv: { ...draft.priv, ...patch } });

  const save = async (extra?: Partial<Passenger>) => {
    if (!draft) return;
    if (!draft.name.trim()) return Alert.alert(t('pax.one'), t('pax.needName'));
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
    Alert.alert(t('pax.removeQ'), t('pax.removeBody', { name: draft.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => void save({ deleted: true }) },
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
  // Any guest list: the AI sees the headings and masked samples only — the guest list stays on board (services/aiImport).
  const importAi = async () => {
    try {
      const file = await pickSheetRows();
      if (!file) return;
      setSaved(t('pax.aiReading'));
      const r = await aiRenameHeadings(file.rows, 'passengers');
      setSaved(null);
      await importSheet({ name: file.name, rows: readPaxRows(r.rows) }, `Columns read by the AI: ${r.mapped.map((m) => `${m.from} → ${m.to}`).join('; ')}.`);
    } catch (e: any) {
      setSaved(null);
      Alert.alert(t('pax.import'), String(e?.message ?? e));
    }
  };

  const importSheet = async (given?: { name: string; rows: PaxRow[] }, note?: string) => {
    try {
      const picked = given ?? (await pickPaxSheet());
      if (!picked) return;
      if (!picked.rows.length) return Alert.alert(t('pax.import'), t('pax.noneFound', { file: picked.name }));
      const plan = planPaxImport(picked.rows, passengers, passengersPrivate, today);
      const apply = async () => {
        await saveRows(storage.PASSENGERS_KEY, plan.passengers);
        if (plan.privates.length) await saveRows(storage.PASSENGERS_PRIVATE_KEY, plan.privates);
        playSuccessSound();
        setSaved(`${plan.added.length} added, ${plan.updated.length} updated from “${picked.name}”`);
      };
      Alert.alert(t('pax.importQ', { n: picked.rows.length, file: picked.name }), [note ?? null, plan.added.length ? t('pax.new', { names: plan.added.join(', ') }) : null, plan.updated.length ? t('pax.updated', { names: plan.updated.join(', ') }) : null, t('pax.emptyCells')].filter(Boolean).join('\n\n'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('pax.import'), onPress: () => void apply() }]);
    } catch (e: any) {
      Alert.alert(t('pax.importFailed'), String(e?.message ?? e));
    }
  };

  const SHOW_OPTS: { value: Show; label: string }[] = [
    { value: 'aboard', label: t('pax.showAboard', { n: passengers.filter((p) => state(p) === 'aboard').length }) },
    { value: 'expected', label: t('pax.showExpected', { n: passengers.filter((p) => state(p) === 'expected').length }) },
    { value: 'left', label: t('pax.showLeft', { n: passengers.filter((p) => state(p) === 'left').length }) },
    { value: 'all', label: t('pax.showAll', { n: passengers.length }) },
  ];

  return (
    <Screen scroll>
      <ScreenTitle title={t('pax.title')} subtitle={`${t('cm.onBoard', { n: aboardList.length - ashore.length })}${ashore.length ? ` · ${t('pax.ashoreNow', { n: ashore.length })}` : ''}`} help="Passengers" onScan={() => nav.navigate('Scan')} />
      <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm, gap: SIZES.xs }]}>
        <TextInput style={[styles.input, { flex: 2, minWidth: 220, marginTop: 0 }]} value={q} onChangeText={setQ} placeholder={t('pax.searchPh')} placeholderTextColor={COLORS.textLight} />
        <Dropdown caption={t('pax.show')} value={show} onChange={setShow} options={SHOW_OPTS} style={{ flex: 1, minWidth: 200 }} />
        {picker ? <View style={{ flex: 1, minWidth: 220 }}>{picker}</View> : null}
      </View>
      <View style={[styles.row, { marginTop: 0, marginBottom: SIZES.sm }]}>
        {officer ? <TouchableOpacity style={styles.btn} onPress={() => open()}><Text style={styles.btnText}>{`+ ${t('pax.one')}`}</Text></TouchableOpacity> : null}
        <TouchableOpacity style={styles.small} onPress={() => nav.navigate('Main', { screen: 'Security', params: { view: 'gangway' } })}><Text style={styles.smallText}>{`${t('pax.gangway')} ›`}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} disabled={!aboardList.length} onPress={() => exportPassengerCards(aboardList, vessel).then(done, fail)}><Text style={styles.smallText}>{t('pax.cards')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => void listPdf()}><Text style={styles.smallText}>{t('pax.listPdf')}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.small} onPress={() => savePaxSheet(paxSheet(shown, passengersPrivate, officer), `Passenger list ${today}`, vessel).then(done, fail)}><Text style={styles.smallText}>{t('pax.toExcel')}</Text></TouchableOpacity>
        {officer ? <TouchableOpacity style={styles.small} onPress={() => void importSheet()}><Text style={styles.smallText}>{t('pax.fromExcel')}</Text></TouchableOpacity> : null}
        {officer && aiReady(sync.enrolled) ? <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={() => void importAi()}><MciIcon name="creation" size={14} color={COLORS.primary} /><Text style={styles.smallText}>Any list (AI)</Text></TouchableOpacity> : null}
        {officer ? <TouchableOpacity style={styles.small} onPress={() => savePaxSheet(paxTemplateRows(), 'Passenger list template', vessel).then(done, fail)}><Text style={styles.smallText}>{t('pax.template')}</Text></TouchableOpacity> : null}
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}

      {draft ? (
        <Card>
          <Label>{passengers.some((p) => p.id === draft.id) ? t('pax.one') : t('pax.newOne')}</Label>
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder={t('pax.namePh')} placeholderTextColor={COLORS.textLight} autoFocus />
          <View style={styles.row}>
            <Dropdown caption={t('pax.group')} value={draft.group ?? ''} onChange={(v: string) => set({ group: v || undefined })} options={[{ value: '', label: '—' }, ...PASSENGER_GROUPS.map((g) => ({ value: g, label: g }))]} style={{ flex: 1, minWidth: 200 }} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 120, marginTop: 0 }]} value={draft.cabin ?? ''} onChangeText={(v) => set({ cabin: v })} placeholder={t('pax.cabin')} placeholderTextColor={COLORS.textLight} />
            <TextInput style={[styles.input, { flex: 1, minWidth: 140, marginTop: 0 }]} value={draft.nationality ?? ''} onChangeText={(v) => set({ nationality: v })} placeholder={t('pax.nationality')} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label={t('pax.embarked')} value={draft.embarked} onChange={(v) => set({ embarked: v })} /></View>
            <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={draft.embarkPort ?? ''} onChangeText={(v) => set({ embarkPort: v })} placeholder={t('pax.portIn')} placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label={t('pax.disembarked')} value={draft.disembarked} onChange={(v) => set({ disembarked: v })} onClear={() => set({ disembarked: undefined })} placeholder={t('pax.stillAboard')} /></View>
            <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={draft.disembarkPort ?? ''} onChangeText={(v) => set({ disembarkPort: v })} placeholder={t('pax.portOut')} placeholderTextColor={COLORS.textLight} />
          </View>
          <TextInput style={styles.input} value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v })} placeholder={t('pax.notesPh')} placeholderTextColor={COLORS.textLight} />
          {officer ? (
            <>
              <Label>{t('pax.docs')}</Label>
              <View style={styles.row}>
                <Dropdown caption="ID" value={draft.priv.idType ?? 'Passport'} onChange={(v: string) => setP({ idType: v })} options={ID_TYPES.map((t) => ({ value: t, label: t }))} style={{ flex: 1, minWidth: 180 }} />
                <TextInput style={[styles.input, { flex: 1, minWidth: 150, marginTop: 0 }]} value={draft.priv.idNo ?? ''} onChangeText={(v) => setP({ idNo: v, idType: draft.priv.idType ?? 'Passport' })} placeholder={t('pax.docNo')} placeholderTextColor={COLORS.textLight} />
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label={t('pax.docExp')} value={draft.priv.idExpiry} onChange={(v) => setP({ idExpiry: v })} onClear={() => setP({ idExpiry: undefined })} /></View>
                <View style={{ flex: 1, minWidth: 200 }}><SimpleDatePicker label={t('pax.dob')} value={draft.priv.dateOfBirth} onChange={(v) => setP({ dateOfBirth: v })} onClear={() => setP({ dateOfBirth: undefined })} defaultYear={1980} /></View>
              </View>
              <View style={styles.row}>
                <TextInput style={[styles.input, { flex: 1, minWidth: 160 }]} value={draft.priv.phone ?? ''} onChangeText={(v) => setP({ phone: v })} placeholder={t('pax.phone')} placeholderTextColor={COLORS.textLight} />
                <TextInput style={[styles.input, { flex: 2, minWidth: 220 }]} value={draft.priv.emergencyContact ?? ''} onChangeText={(v) => setP({ emergencyContact: v })} placeholder={t('pax.contact')} placeholderTextColor={COLORS.textLight} />
              </View>
            </>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            {passengers.some((p) => p.id === draft.id) && !draft.disembarked ? <TouchableOpacity style={styles.small} onPress={() => void save({ disembarked: today })}><Text style={styles.smallText}>{t('pax.leftToday')}</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={() => setDraft(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
            {passengers.some((p) => p.id === draft.id) ? <TouchableOpacity onPress={remove}><Text style={[styles.link, { color: COLORS.danger }]}>{t('common.remove')}</Text></TouchableOpacity> : null}
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
              <Text style={styles.sub}>{[p.group, p.cabin ? t('pax.cabinN', { n: p.cabin }) : null, p.nationality].filter(Boolean).join(' · ') || '—'}</Text>
              <Text style={styles.sub}>{[p.embarked ? `${t('pax.embarkedL')} ${uiDate(p.embarked)}${p.embarkPort ? ` ${p.embarkPort}` : ''}` : null, p.disembarked ? `${st === 'left' ? t('pax.leftL') : t('pax.leavesL')} ${uiDate(p.disembarked)}${p.disembarkPort ? ` ${p.disembarkPort}` : ''}` : null].filter(Boolean).join(' · ')}</Text>
              {expiring ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('pax.docExpired', { doc: x?.idType ?? t('pax.document'), date: uiDate(x!.idExpiry!) })}</Text> : null}
              {st === 'aboard' ? <Text style={[styles.sub, { color: away ? COLORS.warning : COLORS.success, fontWeight: '700' }]}>{away ? t('pax.ashoreSince', { when: m?.date === today ? m.time : m ? `${uiDate(m.date)} ${m.time}` : '—' }) : t('pax.aboard')}</Text> : null}
            </View>
            {st === 'aboard' ? (
              <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: away ? COLORS.warning : COLORS.success, borderColor: away ? COLORS.warning : COLORS.success }]} onPress={() => void cross(p)} accessibilityLabel={`${p.name}: ${away ? t('pax.ashoreL') : t('pax.onBoardL')} — ${t('pax.tapChange')}`}>
                <MciIcon name="swap-horizontal" size={14} color={COLORS.textWhite} />
                <Text style={[styles.smallText, { color: COLORS.textWhite }]}>{away ? t('pax.ashore') : t('pax.onBoard')}</Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        );
      })}
      {!shown.length ? <Text style={styles.sub}>{passengers.length ? t('pax.nobody') : officer ? t('pax.empty') : t('pax.emptyCrew')}</Text> : null}
    </Screen>
  );
}
