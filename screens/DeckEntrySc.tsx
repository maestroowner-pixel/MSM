// ===================================
// Fill in a deck watch entry and sign it — or view a completed one.
// New entry: route params {}
// Read-only: route params { entryId }
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { SIZES, Palette } from '../theme';
import {
  DeckEntry, VISIBILITY_LABEL, WATCH_PERIODS, Visibility, WindDir,
} from '../types/deckLog';
import {
  BEAUFORT_LABEL, PERIOD_LABEL, SEA_STATE_LABEL, WIND_DIRS,
  currentPeriod, nowTime, todayStr,
} from '../services/deckLog';
import * as storage from '../services/storage';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ text }: { text: string }) {
  const C = useTheme();
  return (
    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: C.primary, marginTop: SIZES.lg, marginBottom: SIZES.xs ?? 4 }}>
      {text}
    </Text>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'flex-start' }}>{children}</View>;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DeckEntrySc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { deckLog, saveRow } = useData();
  const { signer, picker } = useSigner('WATCH OFFICER');
  const confirmSign = useSignConfirm();

  const { entryId } = route.params ?? {};
  const readOnly = !!entryId;

  const existing = useMemo<DeckEntry | undefined>(
    () => (entryId ? deckLog.find((e) => e.id === entryId) : undefined),
    [entryId, deckLog],
  );

  const [period, setPeriod] = useState(existing?.period ?? currentPeriod());
  const [date, setDate] = useState(existing?.date ?? todayStr());
  const [time, setTime] = useState(existing?.time ?? nowTime());
  const [lat, setLat] = useState(existing?.lat ?? '');
  const [lon, setLon] = useState(existing?.lon ?? '');
  const [course, setCourse] = useState(existing?.course?.toString() ?? '');
  const [speed, setSpeed] = useState(existing?.speed?.toString() ?? '');
  const [distanceRun, setDistanceRun] = useState(existing?.distanceRun?.toString() ?? '');
  const [rpm, setRpm] = useState(existing?.rpm?.toString() ?? '');
  const [windDir, setWindDir] = useState<WindDir | ''>(existing?.windDir ?? '');
  const [windBft, setWindBft] = useState(existing?.windBft?.toString() ?? '');
  const [seaState, setSeaState] = useState(existing?.seaState?.toString() ?? '');
  const [visibility, setVisibility] = useState<Visibility | ''>(existing?.visibility ?? '');
  const [pressure, setPressure] = useState(existing?.pressure?.toString() ?? '');
  const [tempAir, setTempAir] = useState(existing?.tempAir?.toString() ?? '');
  const [remarks, setRemarks] = useState(existing?.remarks ?? '');
  const [saving, setSaving] = useState(false);

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? undefined : n; };

  const sign = async () => {
    if (!signer) return Alert.alert('No signer', 'Choose the watch officer signing this entry.');
    if (saving) return;
    setSaving(true);
    try {
      const sig = await confirmSign({
        personKey: signer.key,
        name: signer.name,
        ownDevice: signer.own,
        what: `Deck log — ${PERIOD_LABEL[period]} ${date}`,
      });
      if (!sig) { setSaving(false); return; }
      const entry: DeckEntry = {
        id: uid(),
        date,
        time,
        period,
        lat: lat.trim() || undefined,
        lon: lon.trim() || undefined,
        course: num(course),
        speed: num(speed),
        distanceRun: num(distanceRun),
        rpm: num(rpm),
        windDir: (windDir as WindDir) || undefined,
        windBft: num(windBft),
        seaState: num(seaState),
        visibility: (visibility as Visibility) || undefined,
        pressure: num(pressure),
        tempAir: num(tempAir),
        remarks: remarks.trim() || undefined,
        by: signer.name,
        byRank: signer.rank,
        at: Date.now(),
        signedWith: sig.proof,
        updatedAt: Date.now(),
      };
      await saveRow(storage.DECK_LOG_KEY, entry);
      goBackOr(nav, 'DeckLog');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Read-only view ───────────────────────────────────────────────────────
  if (readOnly && existing) {
    const e = existing;
    const row = (label: string, val: string) => (
      <View style={styles.readRow}>
        <Text style={styles.readLabel}>{label}</Text>
        <Text style={styles.readVal}>{val}</Text>
      </View>
    );
    return (
      <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <BackButton onPress={() => goBackOr(nav, 'DeckLog')} fav={false} />
            <Text style={styles.titleText}>{PERIOD_LABEL[e.period]}</Text>
            <Text style={styles.sub}>{formatDate(e.date)} · {e.time}</Text>

            {(e.lat || e.lon) && (
              <>
                <SectionLabel text="Position" />
                {row('Lat', e.lat ?? '—')}
                {row('Lon', e.lon ?? '—')}
              </>
            )}
            {(e.course !== undefined || e.speed !== undefined || e.distanceRun !== undefined || e.rpm !== undefined) && (
              <>
                <SectionLabel text="Navigation" />
                {e.course !== undefined && row('Course', `${e.course}° T`)}
                {e.speed !== undefined && row('Speed', `${e.speed} kn`)}
                {e.distanceRun !== undefined && row('Dist run', `${e.distanceRun} nm`)}
                {e.rpm !== undefined && row('ME RPM', String(e.rpm))}
              </>
            )}
            {(e.windDir || e.windBft !== undefined || e.seaState !== undefined || e.visibility || e.pressure !== undefined || e.tempAir !== undefined) && (
              <>
                <SectionLabel text="Weather" />
                {e.windDir && row('Wind', `${e.windDir}${e.windBft !== undefined ? ' ' + BEAUFORT_LABEL[e.windBft] : ''}`)}
                {e.seaState !== undefined && row('Sea state', SEA_STATE_LABEL[e.seaState])}
                {e.visibility && row('Visibility', VISIBILITY_LABEL[e.visibility])}
                {e.pressure !== undefined && row('Pressure', `${e.pressure} hPa`)}
                {e.tempAir !== undefined && row('Air temp', `${e.tempAir}°C`)}
              </>
            )}
            {!!e.remarks && (
              <>
                <SectionLabel text="Events / Remarks" />
                <Text style={styles.remarkText}>{e.remarks}</Text>
              </>
            )}
            <SectionLabel text="Signed by" />
            {row('Name', e.by)}
            {e.byRank ? row('Rank', e.byRank) : null}
            <Text style={styles.sub}>{formatDateTime(e.at)}</Text>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── New entry form ───────────────────────────────────────────────────────
  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => goBackOr(nav, 'DeckLog')} fav={false} />
          <Text style={styles.titleText}>New Watch Entry</Text>

          {/* Watch period */}
          <SectionLabel text="Watch period" />
          <Dropdown
            caption="PERIOD"
            value={period}
            options={WATCH_PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
            onChange={(v) => setPeriod(v as typeof period)}
          />

          {/* Date / time */}
          <SectionLabel text="Date & time" />
          <Row2>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DATE</Text>
              <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>TIME (LOCAL)</Text>
              <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="HH:MM" placeholderTextColor={COLORS.textLight} />
            </View>
          </Row2>

          {/* Position */}
          <SectionLabel text="Position" />
          <Row2>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>LAT</Text>
              <TextInput style={styles.input} value={lat} onChangeText={setLat} placeholder="55°30.5'N" placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>LON</Text>
              <TextInput style={styles.input} value={lon} onChangeText={setLon} placeholder="012°30.5'E" placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
            </View>
          </Row2>

          {/* Navigation */}
          <SectionLabel text="Navigation" />
          <Row2>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>COURSE (°T)</Text>
              <TextInput style={styles.input} value={course} onChangeText={setCourse} keyboardType="decimal-pad" placeholder="270" placeholderTextColor={COLORS.textLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>SPEED (kn)</Text>
              <TextInput style={styles.input} value={speed} onChangeText={setSpeed} keyboardType="decimal-pad" placeholder="12.5" placeholderTextColor={COLORS.textLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>DIST RUN (nm)</Text>
              <TextInput style={styles.input} value={distanceRun} onChangeText={setDistanceRun} keyboardType="decimal-pad" placeholder="48" placeholderTextColor={COLORS.textLight} />
            </View>
          </Row2>
          <Text style={styles.fieldLabel}>ME RPM</Text>
          <TextInput style={styles.input} value={rpm} onChangeText={setRpm} keyboardType="decimal-pad" placeholder="105" placeholderTextColor={COLORS.textLight} />

          {/* Weather */}
          <SectionLabel text="Weather" />
          <Row2>
            <View style={{ flex: 1 }}>
              <Dropdown
                caption="WIND DIR"
                value={windDir}
                options={[{ value: '', label: '—' }, ...WIND_DIRS.map((d) => ({ value: d, label: d }))]}
                onChange={(v) => setWindDir(v as WindDir | '')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Dropdown
                caption="BEAUFORT"
                value={windBft}
                options={[{ value: '', label: '—' }, ...Array.from({ length: 13 }, (_, i) => ({ value: String(i), label: BEAUFORT_LABEL[i] }))]}
                onChange={setWindBft}
              />
            </View>
          </Row2>

          <Row2>
            <View style={{ flex: 1 }}>
              <Dropdown
                caption="SEA STATE"
                value={seaState}
                options={[{ value: '', label: '—' }, ...Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: SEA_STATE_LABEL[i] }))]}
                onChange={setSeaState}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Dropdown
                caption="VISIBILITY"
                value={visibility}
                options={[
                  { value: '', label: '—' },
                  { value: 'good', label: VISIBILITY_LABEL.good },
                  { value: 'moderate', label: VISIBILITY_LABEL.moderate },
                  { value: 'poor', label: VISIBILITY_LABEL.poor },
                  { value: 'fog', label: VISIBILITY_LABEL.fog },
                ]}
                onChange={(v) => setVisibility(v as Visibility | '')}
              />
            </View>
          </Row2>

          <Row2>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>PRESSURE (hPa)</Text>
              <TextInput style={styles.input} value={pressure} onChangeText={setPressure} keyboardType="decimal-pad" placeholder="1013" placeholderTextColor={COLORS.textLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>AIR TEMP (°C)</Text>
              <TextInput style={styles.input} value={tempAir} onChangeText={setTempAir} keyboardType="decimal-pad" placeholder="18" placeholderTextColor={COLORS.textLight} />
            </View>
          </Row2>

          {/* Events */}
          <SectionLabel text="Events / Remarks" />
          <TextInput
            style={[styles.input, styles.remarks]}
            value={remarks}
            onChangeText={setRemarks}
            multiline
            numberOfLines={4}
            placeholder="Altered course, passed vessel, changed speed, safety events…"
            placeholderTextColor={COLORS.textLight}
          />

          {/* Signer */}
          <SectionLabel text="Watch Officer" />
          {picker}

          {/* Sign button */}
          <TouchableOpacity
            style={[styles.signBtn, (!signer || saving) && styles.signBtnDisabled]}
            onPress={sign}
            disabled={!signer || saving}
            activeOpacity={0.8}
          >
            <MciIcon name="pen" size={18} color="#fff" />
            <Text style={styles.signText}>{saving ? 'Saving…' : 'Sign Watch Entry'}</Text>
          </TouchableOpacity>

          <View style={{ height: SIZES.xl }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    scroll: { padding: SIZES.lg, paddingBottom: SIZES.xxxl ?? SIZES.xl },
    titleText: { fontSize: 22, fontWeight: '700', color: C.text, marginTop: SIZES.sm },
    sub: { fontSize: 13, color: C.textLight, marginTop: 2, marginBottom: SIZES.sm },
    fieldLabel: {
      fontSize: 11, fontWeight: '700', letterSpacing: 0.6,
      textTransform: 'uppercase', color: C.textLight, marginBottom: 4,
    },
    input: {
      backgroundColor: C.card,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: C.border,
      paddingHorizontal: SIZES.sm,
      paddingVertical: 10,
      color: C.text,
      fontSize: 14,
      marginBottom: SIZES.sm,
    },
    remarks: { minHeight: 90, textAlignVertical: 'top' },
    signBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: SIZES.sm, backgroundColor: C.primary, borderRadius: 10,
      paddingVertical: 14, marginTop: SIZES.lg,
    },
    signBtnDisabled: { opacity: 0.4 },
    signText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    // read-only
    readRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
    readLabel: { width: 110, fontSize: 13, color: C.textLight },
    readVal: { flex: 1, fontSize: 13, color: C.text },
    remarkText: { fontSize: 14, color: C.text, lineHeight: 20 },
  });
}
