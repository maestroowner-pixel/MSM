// ===================================
// Hours of rest — one person, one month.
//
// Opens on the person this device belongs to (its account, or whoever signed
// on it last), because the commonest use is a seafarer filling in their own
// day. Anyone may switch to another person: the Master reviews and corrects
// everybody's month from the same screen.
//
// Every day of the month up to today is a row — a missing day is shown as
// "not recorded" rather than skipped, because a gap in the record is the first
// thing an inspector asks about.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Empty, Screen, ScreenTitle, StatusPill } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { MonthPicker, monthName } from '../components/MonthPicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { crewLabel, CrewMember, isAboard } from '../types/crew';
import { personName, roleAtLeast } from '../types/role';
import { moduleOn } from '../constants/modules';
import { canRememberFolder, chooseFolder } from '../utils/webSave';
import { RestDay } from '../types/rest';
import { analyseRest, RULE_LABEL } from '../services/restHours';
import { exportRestPdf } from '../services/restReport';
import { RestBar } from '../components/RestBar';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}



export default function HoursOfRestSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, rest, vessel, prefs } = useData();
  const sync = useSync();

  // Those on board (types/crew isAboard): someone on leave keeps their past
  // months but is not asked for today's.
  const people = useMemo(
    () => crew.filter(isAboard).sort((a, b) => a.name.localeCompare(b.name)),
    [crew]
  );
  const canEditCrew = moduleOn('crewCerts') && (!sync.enrolled || roleAtLeast(sync.role, 'admin'));

  /** This device's own person: its account, else the last signer here. */
  const mine = useMemo<CrewMember | undefined>(() => {
    const own = sync.me ? personName(sync.me).trim().toLowerCase() : '';
    return (
      (own && people.find((c) => c.name.trim().toLowerCase() === own)) ||
      people.find((c) => c.id === prefs.lastCrewId) ||
      people[0]
    );
  }, [sync.me, people, prefs.lastCrewId]);

  const [personId, setPersonId] = useState<string | undefined>(route.params?.crewId);
  useEffect(() => {
    if (!personId && mine) setPersonId(mine.id);
  }, [mine, personId]);
  const person = people.find((c) => c.id === personId) ?? crew.find((c) => c.id === personId);

  const [savedTo, setSavedTo] = useState<string | null>(null);
  const today = todayIso();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  // Each person's month at a glance for the left column: recorded days and
  // days with a breach.
  const perPerson = useMemo(() => {
    const out = new Map<string, { recorded: number; days: number; breaches: number }>();
    if (!wide) return out;
    const last = month === today.slice(0, 7) ? today : (() => {
      const [y, m] = month.split('-').map(Number);
      return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
    })();
    if (`${month}-01` > today) return out;
    for (const c of people) {
      const sum = analyseRest(rest.filter((d) => d.crewId === c.id), `${month}-01`, last);
      out.set(c.id, { recorded: sum.filter((x) => x.recorded).length, days: sum.length, breaches: sum.filter((x) => x.violations.length).length });
    }
    return out;
  }, [wide, people, rest, month, today]);

  const mineDays = useMemo(() => rest.filter((d) => d.crewId === personId), [rest, personId]);
  const summary = useMemo(() => {
    const last = month === today.slice(0, 7) ? today : (() => {
      const [y, m] = month.split('-').map(Number);
      return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
    })();
    if (`${month}-01` > today) return [];
    return analyseRest(mineDays, `${month}-01`, last).reverse();
  }, [mineDays, month, today]);

  const recorded = summary.filter((s) => s.recorded).length;
  const badDays = summary.filter((s) => s.violations.length).length;
  const workTotal = summary.reduce((n, s) => n + s.workHours, 0);
  const byDate = useMemo(() => new Map(mineDays.map((d) => [d.date, d])), [mineDays]);

  const onReport = async () => {
    if (!person) return;
    try {
      const where = await exportRestPdf({
        holderName: person.name,
        rank: person.rank,
        month,
        days: mineDays,
        vessel,
      });
      if (typeof where === 'string') {
        setSavedTo(where === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${where}”`);
        setTimeout(() => setSavedTo(null), 6000);
      }
    } catch (e: any) {
      Alert.alert('Report', e?.message ?? 'Could not create the report.');
    }
  };

  if (!people.length) {
    return (
      <Screen>
        <ScreenTitle title="Hours of rest" subtitle="MLC 2006 · STCW A-VIII/1" />
        <Empty text="Nobody is on board in the crew list. The Master or an officer adds people and signs them on; each person then records their own hours here." />
        {canEditCrew ? (
          <TouchableOpacity onPress={() => nav.navigate('CrewMatrix')} style={{ alignSelf: 'center', marginTop: SIZES.md }}>
            <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Open the crew list</Text>
          </TouchableOpacity>
        ) : null}
      </Screen>
    );
  }

  return (
    // The page scrolls; the day list inside it does not (scrollEnabled false) —
    // without `scroll` here nothing moved at all, by wheel or by finger.
    <Screen scroll>
      <ScreenTitle
        title={`Hours of rest — ${monthName(month)}`}
        subtitle="MLC 2006 · STCW A-VIII/1 · ship's time"
        help="Hours of rest"
        actions={<MonthPicker value={month} onChange={setMonth} months={[...new Set(rest.map((d: any) => String(d.date).slice(0, 7)))]} />}
      />
      {canEditCrew ? (
        <TouchableOpacity onPress={() => nav.navigate('CrewMatrix')} style={{ alignSelf: 'flex-end', marginTop: -SIZES.sm, marginBottom: SIZES.sm }} hitSlop={8}>
          <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small }}>Crew on board — add / sign on / sign off ›</Text>
        </TouchableOpacity>
      ) : null}

      {/* Wide screens: the crew as a column on the left, the selected person's
          month on the right (9 Oct 2026) — the Master runs down the list and
          sees each one without hunting along a row of buttons. Phones keep
          the row: there is no width for two columns. */}
      <View style={wide ? styles.split : undefined}>
      {wide ? (
        <View style={styles.peopleCol}>
          {people.map((c) => {
            const on = c.id === personId;
            const st = perPerson.get(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.personRow, on && styles.personRowOn]}
                onPress={() => setPersonId(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personName, on && { color: COLORS.textWhite }]} numberOfLines={1}>
                    {c.id === mine?.id ? `${c.name} (you)` : c.name}
                  </Text>
                  <Text style={[styles.personSub, on && { color: COLORS.textWhite }]} numberOfLines={1}>
                    {[c.rank, st ? `${st.recorded}/${st.days} recorded` : null].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {st?.breaches ? <Text style={styles.breachBadge}>{st.breaches}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
      <>
      {/* flexShrink 0: in a browser a horizontal ScrollView inside the page's own
          scroll is squeezed to less than its content, and the names were cut in half. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.chips}>
        {people.map((c) => {
          const on = c.id === personId;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, on && styles.chipOn]}
              onPress={() => setPersonId(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>
                {c.id === mine?.id ? `${crewLabel(c)} (you)` : crewLabel(c)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      </>
      )}
      <View style={wide ? { flex: 1 } : undefined}>

      <Card>
        <View style={styles.stats}>
          <Stat label="Recorded" value={`${recorded}/${summary.length}`} />
          <Stat label="Days with a breach" value={String(badDays)} danger={badDays > 0} />
          <Stat label="Work this month" value={`${workTotal} h`} />
        </View>
        <TouchableOpacity style={styles.reportBtn} onPress={onReport}>
          <MciIcon name="file-pdf-box" size={18} color={COLORS.primary} />
          <Text style={styles.reportText}>Monthly record (PDF) for signature</Text>
        </TouchableOpacity>
        {savedTo ? <Text style={styles.savedTo}>{`✓ ${savedTo}`}</Text> : null}
        {canRememberFolder() ? (
          <TouchableOpacity
            onPress={() => void chooseFolder('rest').then((n) => n && setSavedTo(`Hours of rest files now go to the folder “${n}”`))}
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: SIZES.xs }}
          >
            <Text style={{ color: COLORS.textLight, fontSize: SIZES.small, fontWeight: '600' }}>Change folder</Text>
          </TouchableOpacity>
        ) : null}
      </Card>

      <FlatList
        data={summary}
        keyExtractor={(s) => s.date}
        scrollEnabled={false}
        renderItem={({ item: s }) => {
          const rec: RestDay | undefined = byDate.get(s.date);
          const d = new Date(`${s.date}T00:00:00Z`);
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => nav.navigate('RestDay', { crewId: personId, date: s.date })}
            >
              <View style={styles.dateCol}>
                <Text style={styles.dow}>{d.toLocaleString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</Text>
                <Text style={[styles.dom, s.date === today && { color: COLORS.primary }]}>{s.date.slice(8)}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                {rec ? <RestBar work={rec.work} height={12} /> : <Text style={styles.missing}>Not recorded — tap to fill in</Text>}
                {rec ? (
                  <Text style={styles.meta}>
                    {`Rest ${s.restHours} h · work ${s.workHours} h`}
                    {s.violations.length ? '' : ' · ✓'}
                  </Text>
                ) : null}
                {s.violations.map((v) => (
                  <Text key={v.rule} style={styles.breach} numberOfLines={2}>
                    {`${RULE_LABEL[v.rule]}: ${v.detail}`}
                  </Text>
                ))}
              </View>
              {s.violations.length ? <StatusPill status="expired" text="Breach" /> : null}
            </TouchableOpacity>
          );
        }}
      />
      </View>
      </View>
    </Screen>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const COLORS = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: SIZES.h4, fontWeight: '800', color: danger ? COLORS.danger : COLORS.textDark }}>{value}</Text>
      <Text style={{ fontSize: SIZES.tiny, color: COLORS.textLight, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { gap: SIZES.xs, paddingBottom: SIZES.sm, alignItems: 'center' },
    savedTo: { color: COLORS.success, fontSize: SIZES.small, fontWeight: '700', textAlign: 'center', marginTop: SIZES.sm },
    split: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.lg },
    peopleCol: { width: 250, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.xs, overflow: 'hidden' },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md },
    personRowOn: { backgroundColor: COLORS.primary },
    personName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    personSub: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 1 },
    breachBadge: { minWidth: 22, textAlign: 'center', color: '#fff', backgroundColor: COLORS.danger, borderRadius: 11, paddingHorizontal: 6, paddingVertical: 1, fontSize: SIZES.tiny, fontWeight: '800', overflow: 'hidden' },
    chip: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: SIZES.sm },
    month: { fontSize: SIZES.h4, fontWeight: '700', color: COLORS.textDark },
    stats: { flexDirection: 'row', gap: SIZES.sm },
    reportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SIZES.xs, marginTop: SIZES.md, paddingVertical: SIZES.sm, borderRadius: SIZES.radiusMd, borderWidth: 1, borderColor: COLORS.primary },
    reportText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.sm, marginBottom: SIZES.xs },
    dateCol: { width: 36, alignItems: 'center' },
    dow: { fontSize: SIZES.tiny, color: COLORS.textLight },
    dom: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    meta: { fontSize: SIZES.tiny, color: COLORS.textLight },
    missing: { fontSize: SIZES.small, color: COLORS.textLight, fontStyle: 'italic' },
    breach: { fontSize: SIZES.tiny, color: COLORS.danger, fontWeight: '600' },
  });
