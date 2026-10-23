// ===================================
// Inspection readiness — what an inspector would find on a given day
// (services/readiness.ts). Pick the inspection (PSC / flag / class) and its
// date; every line opens the record that puts it right. PDF for the Master
// and the DPA.
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Clipboard, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { catLabel } from '../constants/categories';
import { periodsFor } from '../constants/checklists';
import { CategoryKey } from '../types/equipment';
import { todayIso } from '../services/pms';
import { KIND_LABEL, ReadinessKind, buildReadiness, verdict } from '../services/readiness';
import { buildCalendar, ICS_REMIND_DAYS } from '../services/calendarIcs';
import { exportCalendarIcs, exportReadinessPdf } from '../services/readinessReport';
import { ICS_BASE_URL, INSPECT_LINK_BASE, readIcsLink, readInspectLink, revokeIcsLink, revokeInspectLink, saveIcsLink, saveInspectLink } from '../services/firebaseService';
import { t, tn, useT } from '../utils/i18n';

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const SOON = [0, 7, 14, 30];
const onWebPlatform = Platform.OS === 'web';

const INSPECT_DAYS = [7, 30, 90] as const;
type InspectDays = typeof INSPECT_DAYS[number];

export default function ReadinessSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  const sync = useSync();
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((t) => t + 1), []));
  const today = todayIso();
  const [kind, setKind] = useState<ReadinessKind>('psc');
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState<string | null>(null);
  const isMaster = !sync.enrolled || sync.role === 'superadmin';

  // Inspector read-only link state.
  const [inspectLink, setInspectLink] = useState<{ token: string; expiry: number } | null | 'loading'>(sync.enrolled ? 'loading' : null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectDays, setInspectDays] = useState<InspectDays>(30);
  useEffect(() => {
    if (!sync.enrolled) return;
    const imo = data.vessel?.imo?.replace(/\D/g, '') ?? '';
    if (!imo) { setInspectLink(null); return; }
    readInspectLink(imo).then(setInspectLink).catch(() => setInspectLink(null));
  }, [sync.enrolled]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateInspectLink = async () => {
    const imo = data.vessel?.imo?.replace(/\D/g, '') ?? '';
    if (!imo) return Alert.alert(t('saf.noImo'), t('saf.setImo'));
    const token = Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const expiry = Date.now() + inspectDays * 86400000;
    await saveInspectLink(imo, token, expiry);
    setInspectLink({ token, expiry });
  };

  const doRevoke = () => {
    const imo = data.vessel?.imo?.replace(/\D/g, '') ?? '';
    if (!imo) return;
    Alert.alert(t('ready.revokeLinkQ'), t('ready.revokeLinkBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ready.revoke'), style: 'destructive', onPress: async () => { await revokeInspectLink(imo); setInspectLink(null); } },
    ]);
  };

  // Calendar subscription (webcal://) — ICS live feed.
  const [icsToken, setIcsToken] = useState<string | null | 'loading'>(sync.enrolled && isMaster ? 'loading' : null);
  const [icsOpen, setIcsOpen] = useState(false);
  useEffect(() => {
    if (!sync.enrolled || !isMaster) return;
    const imo = data.vessel?.imo?.replace(/\D/g, '') ?? '';
    if (!imo) { setIcsToken(null); return; }
    readIcsLink(imo).then(setIcsToken).catch(() => setIcsToken(null));
  }, [sync.enrolled, isMaster]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateIcsLink = async () => {
    const imo = data.vessel?.imo?.replace(/\D/g, '') ?? '';
    if (!imo) return Alert.alert(t('saf.noImo'), t('saf.setImo'));
    const token = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    await saveIcsLink(imo, token);
    setIcsToken(token);
  };

  const revokeIcs = () => {
    const imo = data.vessel?.imo?.replace(/\D/g, '') ?? '';
    if (!imo) return;
    Alert.alert(t('ready.revokeCalQ'), t('ready.revokeCalBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ready.revoke'), style: 'destructive', onPress: async () => { await revokeIcsLink(imo); setIcsToken(null); } },
    ]);
  };

  const when = date < today ? today : date;

  const r = useMemo(
    () =>
      buildReadiness({
        kind,
        date: when,
        today,
        on: moduleOn,
        labelOf: (k: CategoryKey) => catLabel(data.categories.find((c) => c.key === k) ?? k),
        periodsOf: (k: CategoryKey) => periodsFor(k, data.templates),
        ...data,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, kind, when, today, tick]
  );

  const pdf = async () => {
    try {
      const w = await exportReadinessPdf(r, data.vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('ready.title'), String(e?.message ?? e));
    }
  };

  // The calendar always looks a year ahead from today, whatever inspection is picked above.
  const calendar = async () => {
    try {
      const c = buildCalendar({
        today,
        on: moduleOn,
        labelOf: (k: CategoryKey) => catLabel(data.categories.find((x) => x.key === k) ?? k),
        periodsOf: (k: CategoryKey) => periodsFor(k, data.templates),
        ...data,
      });
      const { count, where } = await exportCalendarIcs(c, data.vessel);
      const place = typeof where === 'string' ? (where === 'Downloads' ? t('ready.toDownloads') : t('ready.toFolder', { folder: where })) : '';
      if (typeof where === 'string' || !onWebPlatform) setSaved(`${tn('ready.dueDates', count, { place })} — ${t('ready.openIn')}`);
    } catch (e: any) {
      Alert.alert(t('drills.calendar'), String(e?.message ?? e));
    }
  };

  const tone = r.red ? COLORS.danger : r.amber ? COLORS.warning : COLORS.success;
  return (
    <Screen scroll>
      <ScreenTitle title={t('ready.title')} subtitle={t('ready.sub')} help="Inspection readiness" />

      <View style={styles.chips}>
        {(Object.keys(KIND_LABEL) as ReadinessKind[]).map((k) => (
          <TouchableOpacity key={k} style={[styles.chip, kind === k && styles.chipOn]} onPress={() => setKind(k)}>
            <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{KIND_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.chips}>
        {SOON.map((n) => {
          const d = addDays(today, n);
          return (
            <TouchableOpacity key={n} style={[styles.chip, when === d && styles.chipOn]} onPress={() => setDate(d)}>
              <Text style={[styles.chipText, when === d && styles.chipTextOn]}>{n === 0 ? t('ready.today') : t('ready.inDays', { n })}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <SimpleDatePicker label={t('ready.date')} value={when} onChange={(d) => setDate(d || today)} />

      <View style={[styles.verdict, { borderColor: tone }]}>
        <MciIcon name={r.red ? 'alert-octagon-outline' : r.amber ? 'alert-outline' : 'check-decagram-outline'} size={26} color={tone} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.verdictText, { color: tone }]}>{verdict(r)}</Text>
          <Text style={styles.sub}>{`${KIND_LABEL[kind]} · ${when.split('-').reverse().join('.')} · ${r.sections.length} areas checked`}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={pdf}>
          <Text style={styles.btnText}>PDF</Text>
        </TouchableOpacity>
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}
      <TouchableOpacity style={styles.handover} onPress={() => nav.navigate('Handover')} activeOpacity={0.7}>
        <MciIcon name="swap-horizontal-bold" size={18} color={COLORS.primary} />
        <Text style={styles.handoverText}>{t('ready.handover')}</Text>
        <MciIcon name="chevron-right" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.handover} onPress={calendar} activeOpacity={0.7}>
        <MciIcon name="calendar-export" size={18} color={COLORS.primary} />
        <Text style={styles.handoverText}>{t('ready.ics', { n: ICS_REMIND_DAYS })}</Text>
        <MciIcon name="download" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      {isMaster && sync.enrolled ? (
        <View style={styles.inspectBox}>
          <TouchableOpacity style={styles.handover} onPress={() => setInspectOpen((v) => !v)} activeOpacity={0.7}>
            <MciIcon name="shield-account-outline" size={18} color={COLORS.primary} />
            <Text style={styles.handoverText}>{t('ready.link')}</Text>
            <MciIcon name={inspectOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
          </TouchableOpacity>
          {inspectOpen ? (
            inspectLink && inspectLink !== 'loading' ? (
              <View style={{ gap: SIZES.xs }}>
                <Text style={[styles.sub, { fontWeight: '700' }]}>{t('ready.validUntil', { date: new Date(inspectLink.expiry).toISOString().slice(0, 10).split('-').reverse().join('.') })}</Text>
                <Text style={[styles.sub, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} numberOfLines={2} selectable>{`${INSPECT_LINK_BASE}${inspectLink.token}`}</Text>
                <View style={{ flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.xs }}>
                  <TouchableOpacity onPress={() => { Clipboard.setString(`${INSPECT_LINK_BASE}${inspectLink.token}`); setSaved(t('ready.copied')); }} hitSlop={8}>
                    <Text style={styles.action}>{t('ready.copy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={doRevoke} hitSlop={8}>
                    <Text style={[styles.action, { color: COLORS.danger }]}>{t('ready.revoke')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ gap: SIZES.xs }}>
                <Text style={styles.sub}>{t('ready.linkHint')}</Text>
                <View style={[styles.inspectChips, { marginTop: SIZES.xs }]}>
                  {INSPECT_DAYS.map((d) => (
                    <TouchableOpacity key={d} style={[styles.chip, inspectDays === d && styles.chipOn]} onPress={() => setInspectDays(d)}>
                      <Text style={[styles.chipText, inspectDays === d && styles.chipTextOn]}>{`${d} days`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.genBtn} onPress={() => void generateInspectLink()}>
                  <Text style={styles.genBtnText}>{t('ready.gen')}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {isMaster && sync.enrolled ? (
        <View style={styles.inspectBox}>
          <TouchableOpacity style={styles.handover} onPress={() => setIcsOpen((v) => !v)} activeOpacity={0.7}>
            <MciIcon name="calendar-sync-outline" size={18} color={COLORS.primary} />
            <Text style={styles.handoverText}>{t('ready.calSub')}</Text>
            <MciIcon name={icsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.primary} />
          </TouchableOpacity>
          {icsOpen ? (
            icsToken && icsToken !== 'loading' ? (
              <View style={{ gap: SIZES.xs }}>
                <Text style={styles.sub}>{t('ready.calHint')}</Text>
                <Text style={[styles.sub, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }]} numberOfLines={3} selectable>{`${ICS_BASE_URL}${icsToken}`}</Text>
                <View style={{ flexDirection: 'row', gap: SIZES.md, marginTop: SIZES.xs, flexWrap: 'wrap' }}>
                  <TouchableOpacity onPress={() => { Clipboard.setString(`webcal://${ICS_BASE_URL.replace('https://', '')}${icsToken}`); setSaved(`webcal:// — ${t('ready.copied')}`); }} hitSlop={8}>
                    <Text style={styles.action}>{`${t('ready.copyL')} webcal://`}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { Clipboard.setString(`${ICS_BASE_URL}${icsToken}`); setSaved(`https:// — ${t('ready.copied')}`); }} hitSlop={8}>
                    <Text style={styles.action}>{`${t('ready.copyL')} https://`}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={revokeIcs} hitSlop={8}>
                    <Text style={[styles.action, { color: COLORS.danger }]}>{t('ready.revoke')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ gap: SIZES.xs }}>
                <Text style={styles.sub}>{t('ready.calPerm')}</Text>
                <TouchableOpacity style={styles.genBtn} onPress={() => void generateIcsLink()}>
                  <Text style={styles.genBtnText}>{t('ready.genCal')}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {r.sections.map((s) => (
        <View key={s.key} style={styles.block}>
          <View style={styles.headRow}>
            <MciIcon name={s.icon} size={18} color={COLORS.textLight} />
            <Text style={styles.head}>{s.title}</Text>
            {s.gaps.length ? (
              <Text style={[styles.count, { color: s.gaps.some((g) => g.level === 'red') ? COLORS.danger : COLORS.warning }]}>{s.gaps.length}</Text>
            ) : (
              <MciIcon name="check-circle-outline" size={18} color={COLORS.success} />
            )}
          </View>
          {s.gaps.map((g) => (
            <TouchableOpacity key={g.key} style={styles.row} onPress={() => nav.navigate(g.route, g.params)} activeOpacity={0.7}>
              <View style={[styles.dot, { backgroundColor: g.level === 'red' ? COLORS.danger : COLORS.warning }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{g.title}</Text>
                {g.sub ? <Text style={styles.sub}>{g.sub}</Text> : null}
              </View>
              <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          ))}
          {!s.gaps.length ? <Text style={[styles.sub, { color: COLORS.success }]}>{t('ready.nothing')}</Text> : null}
        </View>
      ))}
      <Text style={[styles.sub, { marginTop: SIZES.md }]}>
        Red — would be found on the day. Amber — runs out within 30 days after it, or still open. The list checks what the app holds; it is not the inspector’s checklist.
      </Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginBottom: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    verdict: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderWidth: 2, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.md },
    verdictText: { fontSize: SIZES.h3, fontWeight: '800' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    block: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.xs },
    head: { flex: 1, fontWeight: '800', color: COLORS.textDark, fontSize: SIZES.body },
    count: { fontWeight: '800', fontSize: SIZES.body },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
    dot: { width: 10, height: 10, borderRadius: 5 },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    handover: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
    handoverText: { flex: 1, color: COLORS.primary, fontWeight: '700' },
    inspectBox: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    inspectChips: { flexDirection: 'row', gap: SIZES.xs },
    genBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, alignItems: 'center', marginTop: SIZES.xs },
    genBtnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small },
    action: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
  });
