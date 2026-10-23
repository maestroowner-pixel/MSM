import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { Dropdown } from '../components/Dropdown';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { isAboard, crewLabel } from '../types/crew';
import { shareDeckEntry } from '../services/deckLogReport';
import { SIZES, Palette } from '../theme';
import {
  DeckEntry, LatHem, LonHem,
  WATCH_PERIODS, Visibility, WindDir,
} from '../types/deckLog';
import {
  BEAUFORT_LABEL, PERIOD_LABEL, PERIOD_SHORT, SEA_STATE_LABEL, WIND_DIRS,
  currentPeriod, nowTime, todayStr,
} from '../services/deckLog';
import * as storage from '../services/storage';
import { setActiveWatch, clearActiveWatch, drainPendingEvents } from '../services/watchTracker';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { t, tk, useT } from '../utils/i18n';

// ─── Compact cell helpers (module-level so they don't reset focus) ────────────

function CellLabel({ text }: { text: string }) {
  const C = useTheme();
  return (
    <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: C.textLight, marginBottom: 3 }}>
      {text}
    </Text>
  );
}

interface CIProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'decimal-pad' | 'number-pad' | 'default';
  maxLength?: number;
  style?: object;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
}
function CI({ style, ...rest }: CIProps) {
  const C = useTheme();
  return (
    <TextInput
      style={[{
        backgroundColor: C.card,
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        paddingHorizontal: 7,
        paddingVertical: 7,
        color: C.text,
        fontSize: 14,
      }, style]}
      placeholderTextColor={C.textLight}
      {...rest}
    />
  );
}

function HemToggle({ value, onPress }: { value: string; onPress: () => void }) {
  const C = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: C.primary + '22',
        borderRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: C.primary,
        paddingHorizontal: 7,
        paddingVertical: 7,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 30,
      }}
    >
      <Text style={{ color: C.primary, fontWeight: '700', fontSize: 13 }}>{value}</Text>
    </TouchableOpacity>
  );
}

// Labels from services/deckLog stay English there (PDF); the screen shows them translated.
const perLabel = (p: string) => (p === 'noon' || p === 'other' || p === 'port' ? tk(`de.per.${p}`) : PERIOD_LABEL[p as keyof typeof PERIOD_LABEL] ?? p);
const perShort = (p: string) => (p === 'noon' || p === 'other' || p === 'port' ? tk(`de.per.${p}`) : PERIOD_SHORT[p as keyof typeof PERIOD_SHORT] ?? p);
const bftLabel = (n: number) => (BEAUFORT_LABEL[n] ? tk(`de.bft.${n}`) : String(n));
const ssLabel = (n: number) => (SEA_STATE_LABEL[n] ? tk(`de.ss.${n}`) : String(n));
const WX = ['Clear', 'Cloudy', 'Overcast', 'Rain', 'Drizzle', 'Fog', 'Mist', 'Snow', 'Thunder'];

function DegSym() {
  const C = useTheme();
  return <Text style={{ color: C.textLight, fontSize: 13, alignSelf: 'center', paddingBottom: 1 }}>°</Text>;
}
function MinSym() {
  const C = useTheme();
  return <Text style={{ color: C.textLight, fontSize: 13, alignSelf: 'center', paddingBottom: 1, marginLeft: 1 }}>'</Text>;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DeckEntrySc() {
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { deckLog, saveRow, crew, vessel } = useData();
  const { signer, picker } = useSigner(t('de.watchOfficer'), { forceDropdown: true });
  const confirmSign = useSignConfirm();

  const people = useMemo(() => crew.filter(isAboard), [crew]);
  const [masterPickedId, setMasterPickedId] = useState('');
  const [masterSaving, setMasterSaving] = useState(false);

  const backToDeckLog = () => {
    if (nav.canGoBack()) { nav.goBack(); return; }
    try { nav.navigate('Main', { screen: 'DeckLog' }); } catch { /* already there */ }
  };

  const { entryId } = route.params ?? {};
  const existing = useMemo<DeckEntry | undefined>(
    () => (entryId ? deckLog.find((e) => e.id === entryId) : undefined),
    [entryId, deckLog],
  );
  // Drafts open in the form so they can be completed and signed.
  const readOnly = !!entryId && !existing?.draft;

  // Row 1 — watch params
  const [date, setDate] = useState(existing?.date ?? todayStr());
  const [period, setPeriod] = useState(existing?.period ?? currentPeriod());
  const [distLog, setDistLog] = useState(existing?.distanceRun?.toString() ?? '');
  const [courseGyro, setCourseGyro] = useState((existing?.courseGyro ?? existing?.course)?.toString() ?? '');
  const [courseMag, setCourseMag] = useState(existing?.courseMagnetic?.toString() ?? '');
  const [variation, setVariation] = useState(existing?.variation?.toString() ?? '');
  const [deviation, setDeviation] = useState(existing?.deviation?.toString() ?? '');
  const [engLoadPort, setEngLoadPort] = useState(existing?.engLoadPort?.toString() ?? '');
  const [engLoadStbd, setEngLoadStbd] = useState(existing?.engLoadStbd?.toString() ?? '');

  // Row 2 — time + position + event
  const [time, setTime] = useState(existing?.time ?? nowTime());
  const [latDeg, setLatDeg] = useState(existing?.latDeg?.toString() ?? '');
  const [latMin, setLatMin] = useState(existing?.latMin?.toString() ?? '');
  const [latHem, setLatHem] = useState<LatHem>(existing?.latHem ?? 'N');
  const [lonDeg, setLonDeg] = useState(existing?.lonDeg?.toString() ?? '');
  const [lonMin, setLonMin] = useState(existing?.lonMin?.toString() ?? '');
  const [lonHem, setLonHem] = useState<LonHem>(existing?.lonHem ?? 'E');
  const [remarks, setRemarks] = useState(existing?.remarks ?? '');

  // Weather
  const [windDir, setWindDir] = useState<WindDir | ''>(existing?.windDir ?? '');
  const [windBft, setWindBft] = useState(existing?.windBft?.toString() ?? '');
  const [seaState, setSeaState] = useState(existing?.seaState?.toString() ?? '');
  const [visibility, setVisibility] = useState<Visibility | ''>(existing?.visibility ?? '');
  const [pressure, setPressure] = useState(existing?.pressure?.toString() ?? '');
  const [tempAir, setTempAir] = useState(existing?.tempAir?.toString() ?? '');
  const [speed, setSpeed] = useState(existing?.speed?.toString() ?? '');
  const [rpm, setRpm] = useState(existing?.rpm?.toString() ?? '');

  // Mode: at sea (full nav + watch periods) vs in port (time+event, simplified weather)
  const [portMode, setPortMode] = useState(existing?.mode === 'port');
  const [wxCondition, setWxCondition] = useState(existing?.wxCondition ?? '');

  const [saving, setSaving] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [autoTrack, setAutoTrack] = useState(false);
  // For a draft opened for editing, reuse its id so we overwrite rather than duplicate.
  const entryIdRef = useRef(existing?.draft ? existing.id : uid());

  // Start / stop active-watch tracking
  useEffect(() => {
    if (autoTrack) {
      setActiveWatch({ id: entryIdRef.current, period, date, startedAt: Date.now() });
    } else {
      clearActiveWatch();
    }
  }, [autoTrack, period, date]);

  // Always clear on unmount
  useEffect(() => () => { clearActiveWatch(); }, []);

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };
  // "300" → 30.0 (no decimal, ≥100): last digit is tenths, no need to type the dot
  const parseMin = (s: string) => { const n = parseFloat(s); if (isNaN(n)) return undefined; return (!s.includes('.') && n >= 100) ? n / 10 : n; };

  const sign = async () => {
    if (!signer) return Alert.alert(t('sign.noSigner'), t('de.chooseOfficer'));
    if (saving) return;

    // Required fields check
    const missing: string[] = [];
    if (!time.trim()) missing.push(t('de.time'));
    if (!remarks.trim()) missing.push(t('de.remarks'));
    if (missing.length > 0) {
      const ok = await new Promise<boolean>((resolve) => {
        Alert.alert(
          t('de.notAllFilled'),
          missing.length === 1 ? t('de.oneEmpty', { f: missing[0] }) : t('de.bothEmpty'),
          [
            { text: t('de.goBack'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('common.save'), onPress: () => resolve(true) },
          ],
        );
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      const sig = await confirmSign({
        personKey: signer.key,
        name: signer.name,
        ownDevice: signer.own,
        what: `Deck log — ${portMode ? 'Port' : PERIOD_LABEL[period]} ${date}`,
      });
      if (!sig) { setSaving(false); return; }
      const finalRemarks = await drainPendingEvents(remarks.trim());
      const entry: DeckEntry = {
        id: entryIdRef.current,
        date,
        time,
        period: portMode ? 'port' : period,
        mode: portMode ? 'port' : undefined,
        wxCondition: portMode ? (wxCondition || undefined) : undefined,
        distanceRun: portMode ? undefined : num(distLog),
        courseGyro: portMode ? undefined : num(courseGyro),
        courseMagnetic: portMode ? undefined : num(courseMag),
        variation: portMode ? undefined : num(variation),
        deviation: portMode ? undefined : num(deviation),
        latDeg: portMode ? undefined : num(latDeg),
        latMin: portMode ? undefined : parseMin(latMin),
        latHem: (portMode || !latDeg.trim()) ? undefined : latHem,
        lonDeg: portMode ? undefined : num(lonDeg),
        lonMin: portMode ? undefined : parseMin(lonMin),
        lonHem: (portMode || !lonDeg.trim()) ? undefined : lonHem,
        engLoadPort: portMode ? undefined : num(engLoadPort),
        engLoadStbd: portMode ? undefined : num(engLoadStbd),
        windDir: (windDir as WindDir) || undefined,
        windBft: num(windBft),
        seaState: portMode ? undefined : num(seaState),
        visibility: portMode ? undefined : ((visibility as Visibility) || undefined),
        pressure: portMode ? undefined : num(pressure),
        tempAir: num(tempAir),
        speed: portMode ? undefined : num(speed),
        rpm: portMode ? undefined : num(rpm),
        remarks: finalRemarks || undefined,
        by: signer.name,
        byRank: signer.rank,
        at: Date.now(),
        signedWith: sig.proof,
        updatedAt: Date.now(),
      };
      await saveRow(storage.DECK_LOG_KEY, entry);
      backToDeckLog();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = async () => {
    if (draftSaving) return;
    setDraftSaving(true);
    try {
      const draft: DeckEntry = {
        id: entryIdRef.current,
        date,
        time,
        period: portMode ? 'port' : period,
        mode: portMode ? 'port' : undefined,
        wxCondition: portMode ? (wxCondition || undefined) : undefined,
        distanceRun: portMode ? undefined : num(distLog),
        courseGyro: portMode ? undefined : num(courseGyro),
        courseMagnetic: portMode ? undefined : num(courseMag),
        variation: portMode ? undefined : num(variation),
        deviation: portMode ? undefined : num(deviation),
        latDeg: portMode ? undefined : num(latDeg),
        latMin: portMode ? undefined : parseMin(latMin),
        latHem: (portMode || !latDeg.trim()) ? undefined : latHem,
        lonDeg: portMode ? undefined : num(lonDeg),
        lonMin: portMode ? undefined : parseMin(lonMin),
        lonHem: (portMode || !lonDeg.trim()) ? undefined : lonHem,
        engLoadPort: portMode ? undefined : num(engLoadPort),
        engLoadStbd: portMode ? undefined : num(engLoadStbd),
        windDir: (windDir as WindDir) || undefined,
        windBft: num(windBft),
        seaState: portMode ? undefined : num(seaState),
        visibility: portMode ? undefined : ((visibility as Visibility) || undefined),
        pressure: portMode ? undefined : num(pressure),
        tempAir: num(tempAir),
        speed: portMode ? undefined : num(speed),
        rpm: portMode ? undefined : num(rpm),
        remarks: remarks.trim() || undefined,
        by: '',
        at: 0,
        draft: true,
        updatedAt: Date.now(),
      };
      await saveRow(storage.DECK_LOG_KEY, draft);
      backToDeckLog();
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? String(e));
    } finally {
      setDraftSaving(false);
    }
  };

  const signMaster = async (e: DeckEntry) => {
    const person = people.find((p) => p.id === masterPickedId);
    if (!person || masterSaving) return;
    setMasterSaving(true);
    try {
      const sig = await confirmSign({
        personKey: person.id,
        name: person.name,
        ownDevice: false,
        what: `Master review — ${PERIOD_LABEL[e.period]} ${e.date}`,
      });
      if (!sig) { setMasterSaving(false); return; }
      await saveRow(storage.DECK_LOG_KEY, {
        ...e,
        masterBy: person.name,
        masterByRank: person.rank,
        masterAt: Date.now(),
        masterSignedWith: sig.proof,
        updatedAt: Date.now(),
      });
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? String(err));
    } finally {
      setMasterSaving(false);
    }
  };

  // ── Read-only view ─────────────────────────────────────────────────────────
  if (readOnly && existing) {
    const e = existing;
    const row = (label: string, val: string) => (
      <View style={styles.readRow}>
        <Text style={styles.readLabel}>{label}</Text>
        <Text style={styles.readVal}>{val}</Text>
      </View>
    );
    const gyr = e.courseGyro ?? e.course;
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.sm }}>
              <BackButton onPress={backToDeckLog} fav={false} />
              <TouchableOpacity
                onPress={() => shareDeckEntry(e, vessel).catch((err) => Alert.alert(t('common.error'), err?.message ?? String(err)))}
                hitSlop={8}
                style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: COLORS.primary + '22', borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary,
                  paddingVertical: 5, paddingHorizontal: 10 }}
              >
                <MciIcon name="share-outline" size={16} color={COLORS.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: COLORS.primary }}>{t('de.share')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.titleText}>{perLabel(e.period)}</Text>
            <Text style={styles.sub}>{uiDate(e.date)} · {e.time}</Text>

            {(e.latDeg !== undefined || e.lat) && (
              <>
                <Text style={styles.sectionLbl}>{t('de.navigation')}</Text>
                {e.latDeg !== undefined && row(t('de.position'), `${e.latDeg}°${e.latMin?.toFixed(1) ?? '0'}'${e.latHem ?? 'N'}  ${String(e.lonDeg ?? 0).padStart(3,'0')}°${e.lonMin?.toFixed(1) ?? '0'}'${e.lonHem ?? 'E'}`)}
                {e.lat && !e.latDeg && row(t('de.position'), `${e.lat}  ${e.lon ?? ''}`)}
                {e.distanceRun !== undefined && row(t('de.distLog'), `${e.distanceRun} nm`)}
                {gyr !== undefined && row(t('de.gyro'), `${gyr}°T`)}
                {e.courseMagnetic !== undefined && row(t('de.magnetic'), `${e.courseMagnetic}°`)}
                {e.variation !== undefined && row(t('de.variation'), `${e.variation}°`)}
                {e.deviation !== undefined && row(t('de.deviation'), `${e.deviation}°`)}
              </>
            )}
            {(gyr !== undefined || e.distanceRun !== undefined) && !e.latDeg && !e.lat && (
              <>
                <Text style={styles.sectionLbl}>{t('de.navigation')}</Text>
                {e.distanceRun !== undefined && row(t('de.distLog'), `${e.distanceRun} nm`)}
                {gyr !== undefined && row(t('de.gyro'), `${gyr}°T`)}
                {e.courseMagnetic !== undefined && row(t('de.magnetic'), `${e.courseMagnetic}°`)}
                {e.variation !== undefined && row(t('de.variation'), `${e.variation}°`)}
                {e.deviation !== undefined && row(t('de.deviation'), `${e.deviation}°`)}
              </>
            )}
            {(e.windDir || e.windBft !== undefined || e.seaState !== undefined || e.visibility || e.pressure !== undefined || e.tempAir !== undefined) && (
              <>
                <Text style={styles.sectionLbl}>{t('de.weather')}</Text>
                {e.windDir && row(t('de.wind'), `${e.windDir}${e.windBft !== undefined ? ' ' + bftLabel(e.windBft) : ''}`)}
                {e.seaState !== undefined && row(t('de.seaState'), ssLabel(e.seaState))}
                {e.visibility && row(t('de.visibility'), tk(`de.vis.${e.visibility}`))}
                {e.pressure !== undefined && row(t('de.pressure'), `${e.pressure} hPa`)}
                {e.tempAir !== undefined && row(t('de.airTemp'), `${e.tempAir}°C`)}
              </>
            )}
            {(e.speed !== undefined || e.rpm !== undefined) && (
              <>
                <Text style={styles.sectionLbl}>{t('de.performance')}</Text>
                {e.speed !== undefined && row(t('de.speed'), `${e.speed} kn`)}
                {e.rpm !== undefined && row(t('de.meRpm'), String(e.rpm))}
              </>
            )}
            {!!e.remarks && (
              <>
                <Text style={styles.sectionLbl}>{t('de.events')}</Text>
                <Text style={styles.remarkText}>{e.remarks}</Text>
              </>
            )}
            <Text style={styles.sectionLbl}>{t('de.signedBy')}</Text>
            {row(t('de.name'), e.by)}
            {e.byRank ? row(t('de.rank'), e.byRank) : null}
            <Text style={styles.sub}>{uiDateTime(e.at)}</Text>

            <Text style={styles.sectionLbl}>{t('de.masterReview')}</Text>
            {e.masterAt ? (
              <>
                {row(t('de.name'), e.masterBy ?? '')}
                {e.masterByRank ? row(t('de.rank'), e.masterByRank) : null}
                <Text style={styles.sub}>{uiDateTime(e.masterAt)}</Text>
              </>
            ) : (
              <View style={[styles.logCard, { marginTop: 4 }]}>
                {people.length ? (
                  <Dropdown
                    caption={t('de.masterCaption')}
                    value={masterPickedId}
                    onChange={setMasterPickedId}
                    options={[{ value: '', label: t('common.choose') }, ...people.map((p) => ({ value: p.id, label: crewLabel(p) }))]}
                    style={{ maxWidth: 420 }}
                  />
                ) : (
                  <Text style={{ fontSize: 13, color: COLORS.textLight }}>{t('de.noCrew')}</Text>
                )}
                <TouchableOpacity
                  style={[styles.signBtn, { marginTop: SIZES.sm }, (!masterPickedId || masterSaving) && styles.signBtnDisabled]}
                  onPress={() => signMaster(e)}
                  disabled={!masterPickedId || masterSaving}
                  activeOpacity={0.8}
                >
                  <MciIcon name="pen" size={16} color="#fff" />
                  <Text style={styles.signText}>{masterSaving ? t('common.saving') : t('de.endorse')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── New entry form ─────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BackButton onPress={backToDeckLog} fav={false} />

          {/* ── Header: title + mode toggle + auto-track ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm }}>
            <Text style={[styles.titleText, { flex: 1, marginBottom: 0 }]}>{t('de.newTitle')}</Text>
            {/* At Sea / In Port toggle */}
            <TouchableOpacity
              onPress={() => setPortMode((v) => !v)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: portMode ? COLORS.warning + '22' : COLORS.primary + '22',
                borderRadius: 8, borderWidth: 1,
                borderColor: portMode ? COLORS.warning : COLORS.primary,
                paddingVertical: 5, paddingHorizontal: 10,
              }}
            >
              <MciIcon name={portMode ? 'anchor' : 'sail-boat'} size={15} color={portMode ? COLORS.warning : COLORS.primary} />
              <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: portMode ? COLORS.warning : COLORS.primary }}>
                {portMode ? t('de.inPort') : t('de.atSea')}
              </Text>
            </TouchableOpacity>
            {/* Auto-track (at sea only) */}
            {!portMode && (
              <TouchableOpacity
                onPress={() => setAutoTrack((v) => !v)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 5,
                  backgroundColor: autoTrack ? COLORS.primary + '22' : COLORS.card,
                  borderRadius: 8, borderWidth: 1,
                  borderColor: autoTrack ? COLORS.primary : COLORS.border,
                  paddingVertical: 5, paddingHorizontal: 10,
                }}
              >
                <MciIcon name="radar" size={15} color={autoTrack ? COLORS.primary : COLORS.textLight} />
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, color: autoTrack ? COLORS.primary : COLORS.textLight }}>
                  {autoTrack ? t('de.live') : t('de.auto')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Row 1: watch parameters (At Sea only) ── */}
          {!portMode && (
            <View style={styles.logCard}>
              <View style={styles.logRow}>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cDate')} />
                  <CI value={date} onChangeText={setDate} placeholder={t('de.datePh')} style={{ width: 112 }} />
                </View>
                <View style={{ marginRight: 8, width: 104 }}>
                  <CellLabel text={t('de.cPeriod')} />
                  <Dropdown
                    caption=""
                    value={period}
                    options={WATCH_PERIODS.filter((p) => p !== 'port').map((p) => ({ value: p, label: perShort(p) }))}
                    onChange={(v) => setPeriod(v as typeof period)}
                  />
                </View>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cLog')} />
                  <CI value={distLog} onChangeText={setDistLog} keyboardType="decimal-pad" placeholder="48.0" style={{ width: 64 }} />
                </View>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cGyro')} />
                  <CI value={courseGyro} onChangeText={setCourseGyro} keyboardType="decimal-pad" placeholder="270" style={{ width: 64 }} />
                </View>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cMag')} />
                  <CI value={courseMag} onChangeText={setCourseMag} keyboardType="decimal-pad" placeholder="272" style={{ width: 64 }} />
                </View>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cVar')} />
                  <CI value={variation} onChangeText={setVariation} keyboardType="decimal-pad" placeholder="2" style={{ width: 52 }} />
                </View>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cDev')} />
                  <CI value={deviation} onChangeText={setDeviation} keyboardType="decimal-pad" placeholder="-1" style={{ width: 52 }} />
                </View>
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cPort')} />
                  <CI value={engLoadPort} onChangeText={setEngLoadPort} keyboardType="decimal-pad" placeholder="85" style={{ width: 52 }} />
                </View>
                <View>
                  <CellLabel text={t('de.cStbd')} />
                  <CI value={engLoadStbd} onChangeText={setEngLoadStbd} keyboardType="decimal-pad" placeholder="85" style={{ width: 52 }} />
                </View>
              </View>
            </View>
          )}

          {/* ── Row 2: Weather ── */}
          <View style={[styles.logCard, { marginTop: portMode ? 0 : 6 }]}>
            <View style={[styles.logRow, { flexWrap: 'wrap', gap: 8 }]}>
              <View style={{ width: 96 }}>
                <CellLabel text={t('de.cWindDir')} />
                <Dropdown
                  caption=""
                  value={windDir}
                  options={[{ value: '', label: '—' }, ...WIND_DIRS.map((d) => ({ value: d, label: d }))]}
                  onChange={(v) => setWindDir(v as WindDir | '')}
                />
              </View>
              <View style={{ width: 80 }}>
                <CellLabel text={t('de.cBeaufort')} />
                <Dropdown
                  caption=""
                  value={windBft}
                  options={[{ value: '', label: '—' }, ...Array.from({ length: 13 }, (_, i) => ({ value: String(i), label: bftLabel(i), short: String(i) }))]}
                  onChange={setWindBft}
                />
              </View>
              {!portMode && (
                <View style={{ width: 80 }}>
                  <CellLabel text={t('de.cSeaState')} />
                  <Dropdown
                    caption=""
                    value={seaState}
                    options={[{ value: '', label: '—' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: ssLabel(i), short: String(i) }))]}
                    onChange={setSeaState}
                  />
                </View>
              )}
              {!portMode && (
                <View style={{ width: 120 }}>
                  <CellLabel text={t('de.cVisibility')} />
                  <Dropdown
                    caption=""
                    value={visibility}
                    options={[
                      { value: '', label: '—' },
                      { value: 'good', label: t('de.vis.good'), short: t('de.visS.good') },
                      { value: 'moderate', label: t('de.vis.moderate'), short: t('de.visS.moderate') },
                      { value: 'poor', label: t('de.vis.poor'), short: t('de.visS.poor') },
                      { value: 'fog', label: t('de.vis.fog'), short: t('de.visS.fog') },
                    ]}
                    onChange={(v) => setVisibility(v as Visibility | '')}
                  />
                </View>
              )}
              {portMode && (
                <View style={{ width: 130 }}>
                  <CellLabel text={t('de.cConditions')} />
                  <Dropdown
                    caption=""
                    value={wxCondition}
                    options={[
                      { value: '', label: '—' },
                      ...WX.map((w) => ({ value: w, label: tk(`de.wx.${w}`) })),
                    ]}
                    onChange={setWxCondition}
                  />
                </View>
              )}
              <View>
                <CellLabel text={t('de.cAir')} />
                <CI value={tempAir} onChangeText={setTempAir} keyboardType="decimal-pad" placeholder="18" style={{ width: 60 }} />
              </View>
              {!portMode && (
                <>
                  <View>
                    <CellLabel text={t('de.cPres')} />
                    <CI value={pressure} onChangeText={setPressure} keyboardType="decimal-pad" placeholder="1013" style={{ width: 72 }} />
                  </View>
                  <View>
                    <CellLabel text={t('de.cSpd')} />
                    <CI value={speed} onChangeText={setSpeed} keyboardType="decimal-pad" placeholder="12.5" style={{ width: 64 }} />
                  </View>
                  <View>
                    <CellLabel text={t('de.cRpm')} />
                    <CI value={rpm} onChangeText={setRpm} keyboardType="decimal-pad" placeholder="105" style={{ width: 60 }} />
                  </View>
                </>
              )}
            </View>
          </View>

          {/* ── Row 3: time + (position — at sea only) + event ── */}
          <View style={[styles.logCard, { marginTop: 6 }]}>
            <View style={[styles.logRow, { alignItems: 'flex-start', flexWrap: 'wrap' }]}>
              <View style={{ marginRight: 8 }}>
                <CellLabel text={t('de.cTime')} />
                <CI value={time} onChangeText={setTime} placeholder={t('de.timePh')} style={{ width: 66 }} />
              </View>
              {portMode && (
                <View style={{ marginRight: 8 }}>
                  <CellLabel text={t('de.cDate')} />
                  <CI value={date} onChangeText={setDate} placeholder={t('de.datePh')} style={{ width: 112 }} />
                </View>
              )}
              {!portMode && (
                <>
                  <View style={{ marginRight: 10 }}>
                    <CellLabel text={t('de.cLat')} />
                    <View style={styles.coordRow}>
                      <CI value={latDeg} onChangeText={setLatDeg} keyboardType="number-pad" placeholder="55" maxLength={2} style={{ width: 42 }} />
                      <DegSym />
                      <CI value={latMin} onChangeText={setLatMin} keyboardType="decimal-pad" placeholder="30.0" maxLength={5} style={{ width: 54, marginLeft: 2 }} />
                      <MinSym />
                      <View style={{ width: 6 }} />
                      <HemToggle value={latHem} onPress={() => setLatHem((h) => (h === 'N' ? 'S' : 'N'))} />
                    </View>
                  </View>
                  <View style={{ marginRight: 10 }}>
                    <CellLabel text={t('de.cLon')} />
                    <View style={styles.coordRow}>
                      <CI value={lonDeg} onChangeText={setLonDeg} keyboardType="number-pad" placeholder="012" maxLength={3} style={{ width: 48 }} />
                      <DegSym />
                      <CI value={lonMin} onChangeText={setLonMin} keyboardType="decimal-pad" placeholder="30.0" maxLength={5} style={{ width: 54, marginLeft: 2 }} />
                      <MinSym />
                      <View style={{ width: 6 }} />
                      <HemToggle value={lonHem} onPress={() => setLonHem((h) => (h === 'E' ? 'W' : 'E'))} />
                    </View>
                  </View>
                </>
              )}
              <View style={{ flex: 1, minWidth: 160 }}>
                <CellLabel text={t('de.cRemarks')} />
                <CI
                  value={remarks}
                  onChangeText={setRemarks}
                  multiline
                  numberOfLines={portMode ? 4 : 3}
                  placeholder={portMode ? t('de.portPh') : t('de.seaPh')}
                  style={{ minHeight: portMode ? 84 : 70, textAlignVertical: 'top' } as object}
                />
              </View>
            </View>
          </View>

          {/* ── Signer + Save draft + Sign ── */}
          <View style={[styles.logCard, { marginTop: 6, gap: SIZES.sm }]}>
            <View>{picker}</View>
            <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
              <TouchableOpacity
                style={[styles.saveBtn, draftSaving && styles.signBtnDisabled]}
                onPress={saveDraft}
                disabled={draftSaving}
                activeOpacity={0.8}
              >
                <MciIcon name="content-save-outline" size={16} color={COLORS.text} />
                <Text style={styles.saveText}>{draftSaving ? t('common.saving') : t('common.save')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.signBtn, { flex: 1 }, (!signer || saving) && styles.signBtnDisabled]}
                onPress={sign}
                disabled={!signer || saving}
                activeOpacity={0.8}
              >
                <MciIcon name="pen" size={16} color="#fff" />
                <Text style={styles.signText}>{saving ? t('common.saving') : t('common.sign')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: SIZES.xl }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    scroll: { padding: SIZES.md, paddingBottom: SIZES.xxxl ?? SIZES.xl },
    titleText: { fontSize: 20, fontWeight: '700', color: C.text, marginTop: SIZES.sm, marginBottom: SIZES.sm },
    sub: { fontSize: 13, color: C.textLight, marginBottom: SIZES.sm },
    sectionLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: C.primary, marginTop: SIZES.md, marginBottom: 4 },
    weatherLbl: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: C.textLight, marginBottom: 8 },
    logCard: {
      backgroundColor: C.card,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      padding: SIZES.sm,
    },
    logRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 0 },
    coordRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
    signBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, backgroundColor: C.primary, borderRadius: 10,
      paddingVertical: 14, marginTop: SIZES.md,
    },
    signBtnDisabled: { opacity: 0.4 },
    signText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    saveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, borderWidth: 1.5, borderColor: C.border,
      borderRadius: 10, paddingVertical: 14, marginTop: SIZES.md, flex: 1,
    },
    saveText: { color: C.text, fontWeight: '600', fontSize: 15 },
    // read-only
    readRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    readLabel: { width: 110, fontSize: 13, color: C.textLight },
    readVal: { flex: 1, fontSize: 13, color: C.text },
    remarkText: { fontSize: 14, color: C.text, lineHeight: 20 },
  });
}
