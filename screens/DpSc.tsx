// ===================================
// Dynamic positioning (services/dp.ts) — three pages:
//   checklists  start one (field arrival, engine room, watch handover, leaving
//               the field, or the vessel's own); the signed ones below
//   time        each DPO's DP time: half-hours Active / Passive, day by day
//   letter      the confirmation letter for a DPO's DP certificate (Nautical
//               Institute, New or Old Scheme), from the DP time above
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { ASOG_LABEL, SLOTS, Scheme, buildLetter, checkOutcome, dayId, dpoTotals, emptySlots, hours, isDpDay, templatesNow, positionText } from '../services/dp';
import { shipAndUtc } from '../utils/shipTime';
import { exportDpLetter } from '../services/dpReport';
import { DpCheck, DpDay, DpInfo, DpSlot, bookOf } from '../types/dp';
import { loadOlder } from '../services/dpArchive';
import { DP_KEEP_DAYS } from '../services/firebaseService';
import { isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { t, tk, tn, useT } from '../utils/i18n';

type View_ = 'checklists' | 'time' | 'letter';
const VIEWS: { key: View_; label: string }[] = [
  { key: 'checklists', label: 'Checklists' },
  { key: 'time', label: 'DP time' },
  { key: 'letter', label: 'Confirmation letter' },
];
const dmy = (iso?: string) => (iso ? iso.split('-').reverse().join('.') : '');
const hhmm = (i: number) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`;

export default function DpSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { dpChecks, dpDays, dpInfo, dpTemplates, crew, crewPrivate, vessel, saveRow } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const [view, setView] = useState<View_>(VIEWS.find((v) => v.key === route.params?.view)?.key ?? 'checklists');
  useEffect(() => {
    const v = VIEWS.find((x) => x.key === route.params?.view)?.key;
    if (v) setView(v);
  }, [route.params?.view]);

  const today = todayIso();
  const templates = useMemo(() => [...templatesNow(dpTemplates), ...templatesNow(dpTemplates, 'fam-dp')], [dpTemplates]);
  // DP records only — the bridge and engine checklists share the store (17 Oct 2026).
  const signed = useMemo(() => dpChecks.filter((c) => bookOf(c) === 'dp').sort((a, b) => b.at - a.at), [dpChecks]);
  // The archive: checklists older than this device keeps, read from the cloud page by page.
  const [older, setOlder] = useState<DpCheck[]>([]);
  const [olderBusy, setOlderBusy] = useState(false);
  const [olderEnd, setOlderEnd] = useState(false);
  const [olderErr, setOlderErr] = useState<string | null>(null);
  const more = async () => {
    setOlderBusy(true);
    setOlderErr(null);
    try {
      const last = older[older.length - 1];
      const page = (await loadOlder(last ? last.updatedAt : undefined)).filter((c) => bookOf(c) === 'dp' && !dpChecks.some((x) => x.id === c.id));
      setOlder((x) => [...x, ...page]);
      if (page.length < 40) setOlderEnd(true);
    } catch (e: any) {
      setOlderErr(String(e?.message ?? e));
    } finally {
      setOlderBusy(false);
    }
  };
  const aboard = useMemo(() => crew.filter(isAboard).sort((a, b) => a.name.localeCompare(b.name)), [crew]);
  const totals = useMemo(() => dpoTotals(dpDays), [dpDays]);

  // ---- DP time ----
  const meId = useMemo(() => (sync.me ? aboard.find((c) => c.name.trim().toLowerCase() === `${sync.me!.firstName ?? ''} ${sync.me!.lastName ?? ''}`.trim().toLowerCase())?.id : undefined), [aboard, sync.me]);
  const [dpo, setDpo] = useState<string>('');
  const who = dpo || meId || aboard[0]?.id || '';
  const person = crew.find((c) => c.id === who);
  const [date, setDate] = useState(today);
  const stored = dpDays.find((d) => d.id === dayId(who, date));
  const slots: DpSlot[] = stored?.slots ?? emptySlots();
  const [brush, setBrush] = useState<DpSlot>(1);

  const saveDay = async (next: DpSlot[]) => {
    if (!person) return;
    const row: DpDay = { id: dayId(person.id, date), crewId: person.id, name: person.name, rank: person.rank, date, slots: next, updatedAt: Date.now() };
    await saveRow(storage.DP_DAYS_KEY, row);
  };
  const tap = (i: number) => {
    const next = [...slots] as DpSlot[];
    next[i] = next[i] === brush ? 0 : brush;
    void saveDay(next);
  };
  const removeDay = () =>
    stored &&
    Alert.alert(t('dp.removeDayQ'), `${person?.name ?? ''} · ${dmy(date)}`, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: () => void saveRow(storage.DP_DAYS_KEY, { ...stored, deleted: true, updatedAt: Date.now() }) },
    ]);

  // ---- letter ----
  const mine = dpDays.filter((d) => d.crewId === who && !d.deleted).sort((a, b) => a.date.localeCompare(b.date));
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scheme, setScheme] = useState<Scheme>('new');
  const [info, setInfo] = useState<Partial<DpInfo>>(dpInfo ?? {});
  useEffect(() => setInfo(dpInfo ?? {}), [dpInfo]);
  const letter = buildLetter({
    scheme,
    today,
    name: person?.name ?? '',
    dob: crewPrivate.find((p) => p.id === who)?.dateOfBirth,
    rank: person?.rank,
    vesselName: vessel?.vessel_name,
    imo: vessel?.imo,
    info,
    from: from || mine[0]?.date || today,
    to: to || mine[mine.length - 1]?.date || today,
    days: mine,
  });
  const saveInfo = async () => {
    await saveRow(storage.DP_INFO_KEY, { ...info, id: 'info', updatedAt: Date.now() });
    Alert.alert(t('dp.saved'), t('dp.savedBody'));
  };
  const [saved, setSaved] = useState<string | null>(null);
  const makeLetter = async () => {
    try {
      const w = await exportDpLetter(letter);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('dp.v.letter'), String(e?.message ?? e));
    }
  };

  if (!moduleOn('dp')) return <Screen><Empty text={t('common.notAvailable')} /></Screen>;

  const chip = (on: boolean, label: string, onPress: () => void, key?: string) => (
    <TouchableOpacity key={key ?? label} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const dpoChips = (
    <>
      <Label>DPO</Label>
      {aboard.length ? <View style={styles.chips}>{aboard.map((c) => chip(c.id === who, c.rank ? `${c.name} · ${c.rank}` : c.name, () => setDpo(c.id), c.id))}</View> : <Text style={styles.sub}>{t('dp.addCrew')}</Text>}
    </>
  );

  return (
    <Screen scroll>
      <ScreenTitle title={t('dp.title')} subtitle={t('dp.sub')} help="Dynamic positioning" />
      <View style={styles.chips}>{VIEWS.map((v) => chip(view === v.key, tk(`dp.v.${v.key}`), () => setView(v.key), v.key))}</View>

      {view === 'checklists' ? (
        <>
          <Label>{t('wc.start')}</Label>
          {templates.map((tp) => (
            <TouchableOpacity key={tp.id} style={styles.row} onPress={() => nav.navigate('DpCheck', { templateId: tp.id })} activeOpacity={0.7}>
              <MciIcon name={tp.where === 'engine' ? 'engine-outline' : 'ferry'} size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{tp.title}</Text>
                <Text style={styles.sub}>{`${tn('n.item', tp.lines.filter((l) => !l.head && !l.kind).length)} · ${tp.where === 'engine' ? t('dp.engineL') : t('dp.bridgeL')}`}</Text>
              </View>
              <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
          {officer && moduleOn('dpEditor') ? (
            <TouchableOpacity onPress={() => nav.navigate('DpTemplates')} style={{ marginVertical: SIZES.sm }}>
              <Text style={styles.link}>{t('dp.setUp')}</Text>
            </TouchableOpacity>
          ) : null}
          <Label style={{ marginTop: SIZES.md }}>{t('wc.signed')}</Label>
          {!signed.length ? <Text style={styles.sub}>{t('common.noneYet')}</Text> : null}
          {[...signed, ...older].map((c) => {
            const o = checkOutcome(c);
            return (
              <TouchableOpacity key={c.id} style={styles.row} onPress={() => nav.navigate('DpCheck', { id: c.id })} activeOpacity={0.7}>
                <View style={[styles.dot, { backgroundColor: o.fail ? COLORS.danger : o.open ? COLORS.warning : COLORS.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{c.title}</Text>
                  <Text style={styles.sub}>
                    {[t('wc.lt', { time: shipAndUtc(c.at, c.shipOffset).ship }), c.position ? positionText(c.position) : null, c.operation, c.asog ? ASOG_LABEL[c.asog] : null, c.by2 ? `${c.by} / ${c.by2}` : c.by, o.fail ? t('wc.no', { n: o.fail }) : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
              </TouchableOpacity>
            );
          })}
          {/* Older than a device keeps: from the cloud, on request (firebaseService DP_KEEP_DAYS). */}
          {sync.enrolled ? (
            <TouchableOpacity onPress={() => void more()} disabled={olderBusy || olderEnd} style={{ marginVertical: SIZES.sm }}>
              <Text style={[styles.link, (olderBusy || olderEnd) && { opacity: 0.5 }]}>
                {olderBusy ? t('common.loading') : olderEnd ? (older.length ? t('wc.noOlder') : t('dp.noneOlder', { n: DP_KEEP_DAYS })) : older.length ? t('dp.more') : t('wc.older', { n: DP_KEEP_DAYS })}
              </Text>
            </TouchableOpacity>
          ) : null}
          {olderErr ? <Text style={[styles.sub, { color: COLORS.danger }]}>{olderErr}</Text> : null}
        </>
      ) : null}

      {view === 'time' ? (
        <>
          {dpoChips}
          <SimpleDatePicker label={t('dp.day')} value={date} onChange={(d) => setDate(d || today)} />
          <View style={styles.chips}>
            {chip(brush === 1, t('dp.active'), () => setBrush(1))}
            {chip(brush === 2, t('dp.passive'), () => setBrush(2))}
          </View>
          <Text style={styles.sub}>{t('dp.tapHint')}</Text>
          <View style={styles.grid}>
            {Array.from({ length: SLOTS }, (_, i) => (
              <TouchableOpacity key={i} onPress={() => tap(i)} style={[styles.cell, slots[i] === 1 && { backgroundColor: COLORS.primary }, slots[i] === 2 && { backgroundColor: COLORS.warning }]}>
                <Text style={[styles.cellText, slots[i] ? { color: COLORS.textWhite } : null]}>{i % 2 ? '' : hhmm(i).slice(0, 2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.title, { marginTop: SIZES.sm, color: isDpDay(slots) ? COLORS.success : COLORS.textLight }]}>
            {`${t('dp.activePassive', { a: hours(slots, 1), p: hours(slots, 2) })} — ${isDpDay(slots) ? t('dp.isDay') : t('dp.notDay')}`}
          </Text>
          {stored ? (
            <TouchableOpacity onPress={removeDay}>
              <Text style={[styles.link, { color: COLORS.danger, marginTop: SIZES.xs }]}>{t('dp.removeDay')}</Text>
            </TouchableOpacity>
          ) : null}

          <Label style={{ marginTop: SIZES.md }}>{t('dp.timeOnBoard')}</Label>
          {!totals.length ? <Text style={styles.sub}>{t('dp.noneRecorded')}</Text> : null}
          {totals.map((x) => (
            <TouchableOpacity key={x.crewId} style={styles.row} onPress={() => { setDpo(x.crewId); if (x.last) setDate(x.last); }} activeOpacity={0.7}>
              <MciIcon name="account-tie-outline" size={20} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{x.rank ? `${x.name} · ${x.rank}` : x.name}</Text>
                <Text style={styles.sub}>{`${t('dp.totals', { d: x.dpDays, a: x.active, p: x.passive })} · ${dmy(x.first)} – ${dmy(x.last)}`}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </>
      ) : null}

      {view === 'letter' ? (
        <>
          {dpoChips}
          <View style={styles.pair}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <SimpleDatePicker label={t('common.from')} value={from || mine[0]?.date} onChange={(d) => setFrom(d || '')} />
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <SimpleDatePicker label={t('common.to')} value={to || mine[mine.length - 1]?.date} onChange={(d) => setTo(d || '')} />
            </View>
          </View>
          <Label>{t('dp.scheme')}</Label>
          <View style={styles.chips}>
            {chip(scheme === 'new', t('dp.newScheme'), () => setScheme('new'))}
            {chip(scheme === 'old', t('dp.oldScheme'), () => setScheme('old'))}
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{`${letter.row[6]} DP days · ${letter.row[4]} – ${letter.row[5]}`}</Text>
            {letter.dates.map(([k, v]) => (
              <Text key={k} style={styles.sub}>{`${k}: ${v}`}</Text>
            ))}
            {letter.missing.length ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('dp.missing', { what: letter.missing.join(', ') })}</Text> : null}
            <TouchableOpacity style={[styles.btn, { marginTop: SIZES.sm }]} onPress={makeLetter}>
              <Text style={styles.btnText}>{t('dp.makeLetter')}</Text>
            </TouchableOpacity>
            {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
            <Text style={styles.sub}>{t('dp.letterHint')}</Text>
          </View>

          <Label style={{ marginTop: SIZES.md }}>{t('dp.details')}</Label>
          {(
            [
              ['company', 'Company (employer)', 'Ocean Co Ltd'],
              ['dpClass', 'DP class', '2'],
              ['grt', 'GRT', '4 500'],
              ['signatoryName', 'Signed by', 'Name'],
              ['signatoryRank', 'Position', 'Master / Marine Superintendent'],
              ['contacts', 'Company contacts', 'Address, phone, email — one a line'],
            ] as [keyof DpInfo, string, string][]
          ).map(([k, label, ph]) => (
            <View key={k}>
              <Label>{tk(`dp.f.${k}`)}</Label>
              <TextInput
                style={[styles.input, k === 'contacts' && { minHeight: 70 }]}
                value={String(info[k] ?? '')}
                editable={officer}
                multiline={k === 'contacts'}
                onChangeText={(v) => setInfo((x) => ({ ...x, [k]: v }))}
                placeholder={tk(`dp.f.${k}.ph`)}
                placeholderTextColor={COLORS.textLight}
              />
            </View>
          ))}
          {officer ? (
            <TouchableOpacity style={styles.btnOutline} onPress={saveInfo}>
              <Text style={styles.link}>{t('dp.saveDetails')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.sub}>{t('dp.officersKeep')}</Text>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.sm, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    row: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
    card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginTop: SIZES.sm },
    dot: { width: 10, height: 10, borderRadius: 5 },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    link: { color: COLORS.primary, fontWeight: '700' },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: SIZES.sm },
    cell: { width: '7.6%', minWidth: 26, aspectRatio: 1, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    cellText: { fontSize: 9, color: COLORS.textLight },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm, textAlignVertical: 'top' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800', textAlign: 'center' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, alignItems: 'center', marginBottom: SIZES.lg },
  });
