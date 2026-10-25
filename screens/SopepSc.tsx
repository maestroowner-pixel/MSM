// ===================================
// SOPEP — the oil-spill lockers and the drills (types/sopep.ts). One screen,
// a page per menu entry (15 Oct 2026; route param `view`):
//   inventory  the lockers' lists and the inventory check (below);
//   drills     the SOPEP drills — also listed under Drills in the menu;
//   docs       the plan's own papers, for the officers (components/OfficerDocs);
//   manage     the gear on the menu entry: the lockers themselves — ID, place,
//              QR label, list from Excel (components/SopepLockers).
//
//   Locker     the plan's list: item, quantity required, where. Starts from a
//              typical yacht list; edit it to the vessel's own SOPEP.
//   Check      count every line, mark what is damaged or out of date, sign.
//              The last check's shortages show on the locker list.
//   Drills     scenario, who took part, how long, lessons — signed.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { useSync } from '../contexts/SyncContext';
import { current } from '../services/versions';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { MAIN_LOCKER, SOPEP_STARTER, SopepCheck, SopepDrill, SopepItem, SopepLocker, lockerCode, lockerOf, nextLockerCode, sopepLockers } from '../types/sopep';
import { SopepLockers } from '../components/SopepLockers';
import { OfficerDocs } from '../components/OfficerDocs';
import { Dropdown } from '../components/Dropdown';
import { exportLockerLabels } from '../services/crewCards';
import { isAboard } from '../types/crew';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { formatDate, uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { t, tk, tn, useT } from '../utils/i18n';
import { shipHm } from '../utils/shipTime';

type Tab = 'locker' | 'check';
type View_ = 'inventory' | 'drills' | 'docs' | 'manage';

const SCENARIOS = ['Overflow / spill during bunkering', 'Hydraulic oil leak on deck', 'Leak from the hull or a fuel tank', 'Oil in the bilge discharged by mistake', 'Spill during oil change / transfer'];

export default function SopepSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { sopepItems: items, sopepLockers: lockerList, sopepChecks, sopepDrills, crew, vessel, saveRow, appendRow, versionsOf } = useData();
  const sync = useSync();
  // The lockers themselves — new, renamed, placed, removed — for those the Master allows (constants/access.ts canManage).
  const mayManage = sync.canManage('sopep');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const amend = useAmend();
  const allChecks = versionsOf(storage.SOPEP_CHECKS_KEY) as SopepCheck[];
  const allDrills = versionsOf(storage.SOPEP_DRILLS_KEY) as SopepDrill[];
  const checkLine = (c: SopepCheck) => `${uiDate(c.date)} · ${c.by}${items.filter((i) => (c.counted[i.id] ?? 0) < i.required).length ? ` · ${t('sop.short', { n: items.filter((i) => (c.counted[i.id] ?? 0) < i.required).length })}` : ` · ${t('sop.complete')}`}${c.remarks ? ` · ${c.remarks}` : ''}`;
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const [tab, setTab] = useState<Tab>('locker');
  // A locker's QR label scanned (ScanSc → Sopep { locker }): that locker opens.
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const view: View_ = (['drills', 'docs', 'manage'] as const).find((v) => v === route.params?.view) ?? 'inventory';
  const lockers = useMemo(() => sopepLockers(lockerList), [lockerList]);
  const [sel, setSel] = useState<string>(route.params?.locker ?? 'all');
  useEffect(() => {
    const id = route.params?.locker;
    if (!id) return;
    setSel(id);
    setTab('locker');
    nav.setParams({ locker: undefined, view: 'inventory' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.locker]);
  const unknownLocker = sel !== 'all' && !lockers.some((l) => l.id === sel);
  const shown = sel === 'all' || unknownLocker ? lockers : lockers.filter((l) => l.id === sel);
  const [saved, setSaved] = useState<string | null>(null);
  const done = (w: string | null | void) => typeof w === 'string' && setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
  const fail = (e: any) => Alert.alert('SOPEP', String(e?.message ?? e));
  const addLocker = async () => {
    const l: SopepLocker = { id: uid('lk'), name: `SOPEP locker ${lockers.length + 1}`, code: nextLockerCode(lockers), order: lockers.length, updatedAt: Date.now() };
    // The first one becomes a record too, so its name and place can be changed like the others'.
    if (!lockerList.some((x) => x.id === MAIN_LOCKER)) await saveRow(storage.SOPEP_LOCKERS_KEY, lockers[0]);
    await saveRow(storage.SOPEP_LOCKERS_KEY, l);
    setSel(l.id);
  };
  const today = todayIso();

  const lastCheck = useMemo(() => [...sopepChecks].sort((a, b) => b.at - a.at)[0], [sopepChecks]);
  const lastDrill = useMemo(() => [...sopepDrills].sort((a, b) => b.at - a.at)[0], [sopepDrills]);
  const short = (i: SopepItem) => lastCheck && (lastCheck.counted[i.id] ?? 0) < i.required;
  const shortCount = items.filter((i) => short(i)).length;

  const stamp = async (what: string) => {
    if (!signer) {
      Alert.alert(t('sign.who'), t('pd.chooseName'));
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
  // The check counts the locker chosen above (LOCKER), or every locker.
  const countLocker = sel !== 'all' ? lockers.find((l) => l.id === sel) : undefined;
  const countItems = countLocker ? items.filter((i) => lockerOf(i) === countLocker.id) : items;
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [bad, setBad] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const saveCheck = async () => {
    // One locker counted (14 Oct 2026): the others keep what the last check found.
    const counted: Record<string, number> = { ...(countItems.length < items.length ? lastCheck?.counted ?? {} : {}) };
    for (const i of countItems) {
      const v = Number((counts[i.id] ?? '').replace(',', '.'));
      if ((counts[i.id] ?? '').trim() === '' || !Number.isFinite(v)) return Alert.alert(t('mc.inventory'), t('mc.countIt', { name: i.name }));
      counted[i.id] = v;
    }
    const s = await stamp(countLocker ? `SOPEP inventory check — ${countLocker.name}` : 'SOPEP inventory check');
    if (!s) return;
    const note = [countLocker ? `${countLocker.name} only` : null, remarks.trim() || null].filter(Boolean).join(' · ');
    const keepBad = countLocker ? (lastCheck?.defective ?? []).filter((id) => !countItems.some((i) => i.id === id)) : [];
    const allBad = [...keepBad, ...bad];
    const c: SopepCheck = { id: uid('sopc'), date: today, counted, ...(allBad.length ? { defective: allBad } : {}), ...(note ? { remarks: note } : {}), ...s, updatedAt: Date.now() };
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
    if (!d.team.length) return Alert.alert(t('sop.drill'), t('mt.markWho'));
    const s = await stamp(`SOPEP drill — ${d.scenario}`);
    if (!s) return;
    const r: SopepDrill = {
      id: uid('sopd'), date: today, time: shipHm(), scenario: d.scenario, participants: d.team,
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
      <ScreenTitle
        title={view === 'drills' ? t('sop.tDrills') : view === 'docs' ? t('sop.tDocs') : view === 'manage' ? t('sop.tLockers') : t('sop.tStores')}
        subtitle={view === 'drills' ? t('sop.sDrills') : view === 'docs' ? t('sop.sDocs') : view === 'manage' ? t('sop.sLockers', { n: lockers.length }) : t('sop.sStores')}
        help="SOPEP"
      />
      {view === 'manage' && !mayManage ? (
        <Text style={styles.sub}>{t('sop.manageDenied')}</Text>
      ) : view === 'manage' ? (
        <SopepLockers onOpen={(id) => { setSel(id); setTab('locker'); nav.setParams({ view: 'inventory' }); }} done={done} fail={fail} />
      ) : view === 'docs' ? (
        <OfficerDocs shelf="sopep" intro={t('sop.docsIntro')} />
      ) : (<>
      <View style={styles.summary}>
        <Text style={[styles.sumItem, shortCount ? { color: COLORS.danger } : null]}>{lastCheck ? `${t('sop.lastCheck', { date: uiDate(lastCheck.date) })}${shortCount ? ` · ${t('sop.short', { n: shortCount })}` : ` · ${t('sop.complete')}`}` : t('sop.never')}</Text>
        <Text style={styles.sumItem}>{lastDrill ? t('sop.lastDrill', { date: uiDate(lastDrill.date) }) : t('sop.noDrill')}</Text>
      </View>
      {view === 'inventory' ? (
      <View style={styles.tabs}>
        {([['locker', `${t('sop.lockersN', { n: lockers.length })} · ${tn('n.item', items.length)}`], ['check', t('sop.invCheck')]] as [Tab, string][]).map(([k, l]) => (
          <Chip key={k} on={tab === k} label={l} onPress={() => setTab(k)} />
        ))}
      </View>
      ) : null}

      {view === 'inventory' && tab === 'locker' ? (
        <>
          {/* Several lockers, each named and placed, each with its QR label (14 Oct 2026). */}
          <View style={[styles.chips, { alignItems: 'center' }]}>
            <Dropdown caption={t('sop.locker')} value={sel} onChange={setSel} style={{ minWidth: 240, flexGrow: 1 }} options={[{ value: 'all', label: t('sop.allLockers', { n: lockers.length }) }, ...lockers.map((l) => ({ value: l.id, label: `${l.name} · ${items.filter((i) => lockerOf(i) === l.id).length}` }))]} />
            {mayManage ? <TouchableOpacity style={styles.btnOutline} onPress={() => void addLocker()}><Text style={styles.btnOutlineText}>{t('sop.newLocker')}</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.btnOutline} onPress={() => void exportLockerLabels(shown.map((l) => ({ ...l, code: lockerCode(l) })), vessel).then(done, fail)}>
              <MciIcon name="qrcode" size={16} color={COLORS.primary} />
              <Text style={styles.btnOutlineText}>{shown.length > 1 ? `QR labels (${shown.length})` : 'QR label'}</Text>
            </TouchableOpacity>
          </View>
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
          {unknownLocker ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('sop.unknown')}</Text> : null}
          {shown.map((l) => {
            const inIt = items.filter((i) => lockerOf(i) === l.id);
            return (
              <Card key={l.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                  <View style={{ borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary }}>{lockerCode(l) || '—'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput key={`n-${l.id}`} style={styles.lockerName} editable={mayManage} defaultValue={l.name} onBlur={(e: any) => { const v = String(e?.target?.value ?? e?.nativeEvent?.text ?? '').trim(); if (v && v !== l.name) void saveRow(storage.SOPEP_LOCKERS_KEY, { ...l, name: v }); }} onEndEditing={(e) => { const v = e.nativeEvent.text.trim(); if (v && v !== l.name) void saveRow(storage.SOPEP_LOCKERS_KEY, { ...l, name: v }); }} />
                    <TextInput key={`p-${l.id}`} style={styles.sub} editable={mayManage} defaultValue={l.location ?? ''} placeholder={t('sop.wherePh')} placeholderTextColor={COLORS.textLight} onBlur={(e: any) => { const v = String(e?.target?.value ?? e?.nativeEvent?.text ?? '').trim(); if (v !== (l.location ?? '')) void saveRow(storage.SOPEP_LOCKERS_KEY, { ...l, location: v }); }} onEndEditing={(e) => { const v = e.nativeEvent.text.trim(); if (v !== (l.location ?? '')) void saveRow(storage.SOPEP_LOCKERS_KEY, { ...l, location: v }); }} />
                  </View>
                  {inIt.length ? (
                    <TouchableOpacity style={styles.btnOutline} onPress={() => { setSel(l.id); setTab('check'); }} accessibilityLabel={t('sop.countL', { name: l.name })}>
                      <MciIcon name="counter" size={16} color={COLORS.primary} />
                      <Text style={styles.btnOutlineText}>{t('sop.count')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => void exportLockerLabels([{ ...l, code: lockerCode(l) }], vessel).then(done, fail)} hitSlop={8} accessibilityLabel={`QR label — ${l.name}`}>
                    <MciIcon name="qrcode" size={22} color={COLORS.primary} />
                  </TouchableOpacity>
                  {mayManage && l.id !== MAIN_LOCKER && !inIt.length ? (
                    <TouchableOpacity onPress={() => void saveRow(storage.SOPEP_LOCKERS_KEY, { ...l, deleted: true }).then(() => setSel('all'))} hitSlop={8} accessibilityLabel={`${t('sop.removeLocker')} — ${l.name}`}>
                      <MciIcon name="delete-outline" size={20} color={COLORS.textLight} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {inIt.map((i) => (
                  <View key={i.id} style={[styles.item, { flexWrap: 'wrap' }]}>
                    {/* Name and place first; the locker, count, quantity and unit beside it — or under it on a phone. */}
                    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 220, minWidth: 0 }}>
                      <TextInput style={styles.itemName} defaultValue={i.name} onEndEditing={(e) => e.nativeEvent.text.trim() && void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, name: e.nativeEvent.text.trim() })} onBlur={(e: any) => { const v = String(e?.target?.value ?? '').trim(); if (v && v !== i.name) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, name: v }); }} />
                      <TextInput style={styles.sub} defaultValue={i.location ?? ''} placeholder={t('sop.shelfPh')} placeholderTextColor={COLORS.textLight} onBlur={(e: any) => { const v = String(e?.target?.value ?? e?.nativeEvent?.text ?? '').trim(); if (v !== (i.location ?? '')) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, location: v }); }} onEndEditing={(e) => void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, location: e.nativeEvent.text.trim() })} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 1, maxWidth: '100%' }}>
                    {lockers.length > 1 ? (
                      <Dropdown caption="" value={lockerOf(i)} onChange={(v: string) => void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, lockerId: v })} options={lockers.map((x) => ({ value: x.id, label: x.name }))} style={{ minWidth: 118, maxWidth: 190, flexShrink: 1, paddingVertical: 4, paddingHorizontal: 8 }} />
                    ) : null}
                    {/* The quantity the plan requires and its unit, corrected here (14 Oct 2026); the count on hand comes from the last check. */}
                    {lastCheck ? <Text style={[styles.qty, { minWidth: 36, textAlign: 'right' }, short(i) ? { color: COLORS.danger } : null]} numberOfLines={1}>{`${lastCheck.counted[i.id] ?? 0} /`}</Text> : null}
                    <TextInput key={`q-${i.id}`} style={[styles.qtyInput, short(i) ? { borderColor: COLORS.danger } : null]} defaultValue={String(i.required)} keyboardType="number-pad" selectTextOnFocus accessibilityLabel={`${t('sop.qtyReq')} — ${i.name}`}
                      onBlur={(e: any) => { const v = Number(String(e?.target?.value ?? e?.nativeEvent?.text ?? '').replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== i.required) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, required: v }); }}
                      onEndEditing={(e) => { const v = Number(e.nativeEvent.text.replace(',', '.')); if (Number.isFinite(v) && v >= 0 && v !== i.required) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, required: v }); }} />
                    <TextInput key={`u-${i.id}`} style={styles.unitInput} defaultValue={i.unit ?? ''} placeholder={t('sop.unit')} placeholderTextColor={COLORS.textLight} accessibilityLabel={`${t('sop.unit')} — ${i.name}`}
                      onBlur={(e: any) => { const v = String(e?.target?.value ?? e?.nativeEvent?.text ?? '').trim(); if (v !== (i.unit ?? '')) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, unit: v }); }}
                      onEndEditing={(e) => { const v = e.nativeEvent.text.trim(); if (v !== (i.unit ?? '')) void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, unit: v }); }} />
                    <TouchableOpacity onPress={() => Alert.alert(t('common.remove'), t('sop.removeItem', { name: i.name }), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.remove'), style: 'destructive', onPress: () => void saveRow(storage.SOPEP_ITEMS_KEY, { ...i, deleted: true }) }])} hitSlop={8}>
                      <MciIcon name="delete-outline" size={20} color={COLORS.textLight} />
                    </TouchableOpacity>
                    </View>
                  </View>
                ))}
                {items.length || l.id !== MAIN_LOCKER ? (
                  <TouchableOpacity onPress={() => void saveRow(storage.SOPEP_ITEMS_KEY, { id: uid('sop'), name: 'New item', required: 1, order: items.length, ...(l.id !== MAIN_LOCKER ? { lockerId: l.id } : {}) } as any)}>
                    <Text style={styles.link}>{`+ Add an item to ${l.name}`}</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <Text style={styles.sub}>{t('sop.noList')}</Text>
                    <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void addStarter()}><Text style={styles.btnText}>{t('sop.addTypical')}</Text></TouchableOpacity>
                  </>
                )}
              </Card>
            );
          })}
          {lastCheck?.defective?.length ? <Text style={[styles.sub, { color: COLORS.warning }]}>{`${t('sop.toReplace')}: ${lastCheck.defective.map((id) => items.find((i) => i.id === id)?.name).filter(Boolean).join(', ')}`}</Text> : null}
        </>
      ) : view === 'inventory' ? (
        <Card>
          <Label>{countLocker ? t('sop.countL', { name: countLocker.name }) : t('sop.countAll')}</Label>
          {countLocker ? <Text style={styles.sub}>{t('sop.onlyThis', { name: `${countLocker.name}${countLocker.location ? ` (${countLocker.location})` : ''}` })}</Text> : null}
          {(countLocker ? [countLocker] : lockers).flatMap((l) => {
            const inIt = items.filter((i) => lockerOf(i) === l.id);
            return inIt.length && lockers.length > 1 ? [<Text key={`h-${l.id}`} style={[styles.sub, { fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.sm }]}>{`${l.name}${l.location ? ` · ${l.location}` : ''}`}</Text>, ...inIt] : inIt;
          }).map((i: any) => (React.isValidElement(i) ? i : (
            <View key={i.id} style={styles.countRow}>
              <Text style={styles.countName} numberOfLines={2}>{`${i.name} (${i.required} ${i.unit ?? ''})`}</Text>
              <TextInput style={styles.countInput} value={counts[i.id] ?? ''} onChangeText={(v) => setCounts({ ...counts, [i.id]: v })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={COLORS.textLight} />
              <TouchableOpacity onPress={() => setBad(bad.includes(i.id) ? bad.filter((x) => x !== i.id) : [...bad, i.id])} style={[styles.badBtn, bad.includes(i.id) && { backgroundColor: COLORS.warning, borderColor: COLORS.warning }]}>
                <Text style={[styles.badText, bad.includes(i.id) && { color: COLORS.textWhite }]}>{t('sop.replace')}</Text>
              </TouchableOpacity>
            </View>
          )))}
          <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder={t('book.remarks')} placeholderTextColor={COLORS.textLight} />
          {picker ? <><Text style={styles.sub}>{t('sop.checkedBy')}</Text>{picker}</> : null}
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveCheck()}><Text style={styles.btnText}>{t('sop.signCheck')}</Text></TouchableOpacity>
          {allChecks.length ? <Label>{t('sop.previous')}</Label> : null}
          {current(allChecks).sort((a, b) => b.at - a.at).map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sub, c.cancelled && { textDecorationLine: 'line-through' }]}>{checkLine(c)}</Text>
                <AmendNote rec={c} all={allChecks} summary={checkLine} />
              </View>
              {!c.cancelled ? (
                <AmendButtons
                  row
                  isMaster={isMaster}
                  onEdit={() => amend.edit({ store: storage.SOPEP_CHECKS_KEY, record: c, what: `SOPEP check ${formatDate(c.date)}`, fields: [...items.map((i) => ({ key: `counted.${i.id}`, label: `${i.name} (${i.required} ${i.unit ?? ''})`, kind: 'number' as const })), { key: 'remarks', label: t('book.remarks'), kind: 'multiline' }] })}
                  onDelete={() => amend.remove({ store: storage.SOPEP_CHECKS_KEY, record: c, what: `SOPEP check ${formatDate(c.date)}` })}
                />
              ) : null}
            </View>
          ))}
        </Card>
      ) : (
        <>
          <Card>
            <Label>{t('sop.recordDrill')}</Label>
            <View style={styles.chips}>
              {SCENARIOS.map((s, k) => <Chip key={s} on={d.scenario === s} label={tk(`sop.sc.${k}`)} onPress={() => setD({ ...d, scenario: s })} />)}
            </View>
            <TextInput style={styles.input} value={SCENARIOS.includes(d.scenario) ? '' : d.scenario} onChangeText={(v) => setD({ ...d, scenario: v || SCENARIOS[0] })} placeholder={t('sop.otherScenario')} placeholderTextColor={COLORS.textLight} />
            <Label>{t('sop.whoTook')}</Label>
            <View style={styles.chips}>
              {people.map((p) => <Chip key={p.id} on={d.team.includes(p.name)} label={p.name} onPress={() => setD({ ...d, team: d.team.includes(p.name) ? d.team.filter((n) => n !== p.name) : [...d.team, p.name] })} />)}
            </View>
            <View style={styles.pair}>
              <TextInput style={[styles.input, { maxWidth: 140 }]} value={d.minutes} onChangeText={(v) => setD({ ...d, minutes: v })} placeholder={t('sop.minutes')} placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
              <TextInput style={[styles.input, { flex: 3 }]} value={d.lessons} onChangeText={(v) => setD({ ...d, lessons: v })} placeholder={t('sop.lessons')} placeholderTextColor={COLORS.textLight} multiline />
            </View>
            {picker ? <><Text style={styles.sub}>{t('sop.conductedBy')}</Text>{picker}</> : null}
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveDrill()}><Text style={styles.btnText}>{t('sop.signDrill')}</Text></TouchableOpacity>
          </Card>
          {current(allDrills).sort((a, b) => b.at - a.at).map((x) => (
            <View key={x.id} style={[styles.item, x.cancelled && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, x.cancelled && { textDecorationLine: 'line-through' }]}>{x.scenario}</Text>
                <Text style={styles.sub}>{[`${uiDate(x.date)} ${x.time ?? ''}`, t('sop.tookPart', { n: x.participants.length }), x.minutes ? t('common.min', { n: x.minutes }) : null, x.by].filter(Boolean).join(' · ')}</Text>
                {x.lessons ? <Text style={styles.sub}>{x.lessons}</Text> : null}
                <AmendNote rec={x} all={allDrills} summary={(p) => [p.scenario, uiDate(p.date), p.minutes ? `${p.minutes} min` : null, p.lessons].filter(Boolean).join(' · ')} />
              </View>
              {!x.cancelled ? (
                <AmendButtons
                  isMaster={isMaster}
                  onEdit={() => amend.edit({ store: storage.SOPEP_DRILLS_KEY, record: x, what: `Oil-spill drill ${formatDate(x.date)}`, fields: [{ key: 'scenario', label: t('sop.scenario') }, { key: 'minutes', label: t('sop.minutes'), kind: 'number' }, { key: 'lessons', label: t('sop.lessons'), kind: 'multiline' }] })}
                  onDelete={() => amend.remove({ store: storage.SOPEP_DRILLS_KEY, record: x, what: `Oil-spill drill ${formatDate(x.date)}` })}
                />
              ) : null}
            </View>
          ))}
        </>
      )}
      </>)}
      {amend.ui}
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
    lockerName: { fontSize: SIZES.h4 ?? 18, fontWeight: '800', color: COLORS.textDark, paddingVertical: 2 },
    btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: 8 },
    btnOutlineText: { fontSize: SIZES.small, fontWeight: '800', color: COLORS.primary },
    itemTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    qty: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    qtyInput: { width: 58, textAlign: 'right', fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
    unitInput: { width: 54, fontSize: SIZES.small, color: COLORS.textDark, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
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
