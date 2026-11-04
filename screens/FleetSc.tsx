// ===================================
// Fleet — the superintendent's console: every vessel they have been let into,
// worst first, with what is out of date on each.
//
// Not a device aboard: it signs in on its own Firebase app (services/shore.ts)
// with an invitation each vessel's Master issues as "Superintendent (shore)".
// Opens on "Needs attention" (services/officeInbox): what waits for the office's
// answer across the fleet, oldest first, and only what is red on each vessel;
// "Vessels" is the card per vessel.
// Reads everything on those vessels; edits their documents and certificates
// (screens/FleetVesselSc). Meant for a laptop in the office — app.ismpilot.com
// /fleet — but nothing stops it on a tablet.
// ===================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import * as shore from '../services/shore';
import { moduleOn } from '../constants/modules';
import { Count, VesselData, VesselSummary, fleetOrder, summarise } from '../services/fleetSummary';
import { InboxItem, RedLine, fleetInbox, fleetRed, officeParts } from '../services/officeInbox';
import { todayIso } from '../services/pms';
import { uiDate, uiDateTime } from '../utils/dates';
import { MciIcon } from '../components/MciIcon';
import { t, tk, tn, useT } from '../utils/i18n';

export default function FleetSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const [session, setSession] = useState<shore.ShoreSession | null>(null);
  const [rows, setRows] = useState<VesselSummary[]>([]);
  const [data, setData] = useState<VesselData[]>([]);
  const [view, setView] = useState<'attention' | 'vessels'>('attention');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (s: shore.ShoreSession) => {
    setLoading(true);
    const out: VesselSummary[] = [];
    const all: VesselData[] = [];
    await Promise.all(
      s.vessels.map(async (imo) => {
        try {
          const v = await shore.loadVessel(imo);
          all.push(v);
          out.push(summarise(v));
        } catch (e: any) {
          console.warn(`[fleet] ${imo}: ${e?.message ?? e}`);
        }
      })
    );
    setRows(out.sort(fleetOrder));
    setData(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!moduleOn('fleet')) return;
    void (async () => {
      try {
        const s = await shore.resume();
        setSession(s);
        if (s) await load(s);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  // Re-read on coming back from a vessel: an answer given there leaves the list here.
  // The first focus is the first load (above), so only later ones re-read.
  const focused = useRef(false);
  const live = useRef<shore.ShoreSession | null>(null);
  live.current = session;
  useFocusEffect(
    useCallback(() => {
      if (focused.current && live.current) void load(live.current);
      focused.current = true;
    }, [load])
  );

  const parts = useMemo(() => data.map((v) => ({ v, on: officeParts(v, moduleOn) })), [data]);
  const inbox = useMemo(() => fleetInbox(parts), [parts]);
  const red = useMemo(() => fleetRed(parts, todayIso()), [parts]);

  const onJoined = async (s: shore.ShoreSession) => {
    setSession(s);
    setAdding(false);
    await load(s);
  };

  // Ships dark (constants/modules.ts `fleet`): by link too, until it is released.
  if (!moduleOn('fleet')) {
    return (
      <Screen>
        <ScreenTitle title={t('fleet.title')} subtitle={t('fleet.sub')} />
        <Empty text={t('fleet.notYet')} />
      </Screen>
    );
  }

  if (loading && !session) {
    return (
      <Screen>
        <ScreenTitle title={t('fleet.title')} subtitle={t('fleet.sub')} />
        <ActivityIndicator color={COLORS.primary} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen scroll>
        <ScreenTitle title={t('fleet.title')} subtitle={t('fleet.sub')} help="Fleet console (superintendent)" />
        {error ? <Text style={styles.err}>{error}</Text> : null}
        <Text style={styles.lead}>
          {t('fleet.lead')}
        </Text>
        <JoinForm onJoined={onJoined} styles={styles} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <ScreenTitle title={t('fleet.title')} subtitle={`${session.name || t('fleet.supt')} · ${tn('n.vessel', session.vessels.length)}`} help="Fleet console (superintendent)" />
      <View style={styles.tools}>
        <TouchableOpacity onPress={() => void load(session)} hitSlop={8}>
          <Text style={styles.link}>{loading ? t('common.loading') : t('fleet.refresh')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAdding((v) => !v)} hitSlop={8}>
          <Text style={styles.link}>{adding ? t('common.cancel') : `+ ${t('fleet.add')}`}</Text>
        </TouchableOpacity>
      </View>
      {adding ? <JoinForm onJoined={onJoined} styles={styles} /> : null}

      <View style={styles.tabs}>
        {([['attention', `${t('ia.tab')} · ${inbox.length}`], ['vessels', `${t('ia.vessels')} · ${rows.length}`]] as const).map(([k, l]) => (
          <TouchableOpacity key={k} style={[styles.tab, view === k && styles.tabOn]} onPress={() => setView(k)}>
            <Text style={[styles.tabText, view === k && styles.tabTextOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {rows.length === 0 && !loading ? <Empty text={t('fleet.noneOpen')} /> : null}
      {view === 'attention' && rows.length ? (
        <>
          <Label>{t('ia.waiting')}</Label>
          {inbox.map((x) => <InboxRow key={`${x.imo}/${x.kind}/${x.id}`} x={x} styles={styles} COLORS={COLORS} onPress={() => nav.navigate('FleetVessel', { imo: x.imo, tab: x.tab, open: x.id })} />)}
          {!inbox.length && !loading ? <Empty text={t('ia.nothingWaiting')} /> : null}
          <Label style={{ marginTop: SIZES.md }}>{t('ia.red')}</Label>
          {red.map((r) => (
            <View key={r.imo} style={styles.vessel}>
              <TouchableOpacity onPress={() => nav.navigate('FleetVessel', { imo: r.imo })} hitSlop={6}>
                <Text style={styles.vesselName} numberOfLines={1}>{r.vessel}</Text>
              </TouchableOpacity>
              {r.lines.map((l) => (
                <TouchableOpacity key={l.kind} style={styles.redLine} onPress={() => nav.navigate('FleetVessel', { imo: r.imo, tab: l.tab })}>
                  <Text style={[styles.redText, { color: COLORS.danger }]}>{redText(l)}</Text>
                  <MciIcon name="chevron-right" size={16} color={COLORS.textLight} />
                </TouchableOpacity>
              ))}
            </View>
          ))}
          {!red.length && !loading ? <Empty text={t('ia.allClear')} /> : null}
        </>
      ) : null}
      {view === 'vessels' && rows.map((r) => (
        <TouchableOpacity key={r.imo} style={styles.vessel} onPress={() => nav.navigate('FleetVessel', { imo: r.imo })} activeOpacity={0.75}>
          <View style={styles.vesselHead}>
            <Text style={styles.vesselName} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.sub}>{`IMO ${r.imo} · synced ${r.registerAt ? uiDateTime(r.registerAt) : 'never'}`}</Text>
          </View>
          <View style={styles.chips}>
            <Pill label={t('cat.title')} c={r.equipment} styles={styles} COLORS={COLORS} />
            <Pill label={t('fleet.certs')} c={r.certs} styles={styles} COLORS={COLORS} />
            <Pill label={t('fleet.vesselCerts')} c={r.vesselCerts} styles={styles} COLORS={COLORS} />
            <Pill label={t('fleet.crewCerts')} c={r.crewCerts} styles={styles} COLORS={COLORS} />
            <Pill label="PMS" c={r.pms} styles={styles} COLORS={COLORS} />
            {r.sparesOut + r.sparesLow ? (
              <Text style={[styles.pill, { color: r.sparesOut ? COLORS.danger : COLORS.warning, borderColor: r.sparesOut ? COLORS.danger : COLORS.warning }]}>
                {t('fleet.spares', { out: r.sparesOut, low: r.sparesLow })}
              </Text>
            ) : null}
            {r.critOn && (r.crit.defects || r.crit.out.length) ? (
              <Text style={[styles.pill, { color: r.crit.out.some((o) => o.critical) || r.crit.defects ? COLORS.danger : COLORS.warning, borderColor: r.crit.out.some((o) => o.critical) || r.crit.defects ? COLORS.danger : COLORS.warning }]}>
                {[r.crit.defects ? t('fleet.critDefects', { n: r.crit.defects }) : null, r.crit.out.length ? t('fleet.outOfService', { names: r.crit.out.map((o) => `${o.critical ? '⚑ ' : ''}${o.name}`).join(', ') }) : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {r.poOn && (r.po.waiting || r.po.emergency) ? (
              <Text style={[styles.pill, { color: r.po.emergency ? COLORS.warning : COLORS.primary, borderColor: r.po.emergency ? COLORS.warning : COLORS.primary }]}>
                {[r.po.waiting ? t('fleet.poWaiting', { n: r.po.waiting }) : null, r.po.emergency ? t('fleet.poEmergency', { n: r.po.emergency }) : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {r.ext.detained ? (
              <Text style={[styles.pill, { color: COLORS.danger, borderColor: COLORS.danger }]}>{t('fleet.detained')}</Text>
            ) : null}
            {r.ext.open ? (
              <Text style={[styles.pill, { color: r.ext.overdue ? COLORS.danger : COLORS.warning, borderColor: r.ext.overdue ? COLORS.danger : COLORS.warning }]}>
                {[t('fleet.extOpen', { n: r.ext.open }), r.ext.overdue ? t('ei.overdueN', { n: r.ext.overdue }) : null].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {r.ext.lastPsc ? (
              <Text style={[styles.pill, { color: COLORS.textLight, borderColor: COLORS.border }]}>
                {t('fleet.lastPsc', { date: uiDate(r.ext.lastPsc.date), port: r.ext.lastPsc.port ?? '', n: r.ext.lastPsc.findings })}
              </Text>
            ) : null}
            {r.docsOutstanding ? (
              <Text style={[styles.pill, { color: COLORS.warning, borderColor: COLORS.warning }]}>
                {t('fleet.docs', { x: tn('n.signature', r.signaturesMissing) })}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity onPress={() => void shore.forget().then(() => { setSession(null); setRows([]); })} style={{ marginTop: SIZES.xl }}>
        <Text style={[styles.link, { color: COLORS.textLight }]}>{t('fleet.signOut')}</Text>
      </TouchableOpacity>
    </Screen>
  );
}

/** "3 d", "5 h" — how long a record has waited for the office. */
function waited(since: number): string {
  const h = Math.max(0, Math.floor((Date.now() - since) / 3600000));
  return h < 48 ? t('ia.hours', { n: h }) : t('ia.days', { n: Math.floor(h / 24) });
}

function InboxRow({ x, styles, COLORS, onPress }: { x: InboxItem; styles: any; COLORS: Palette; onPress: () => void }) {
  const urgent = x.kind === 'emergency';
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{x.title}</Text>
        <Text style={[styles.sub, urgent && { color: COLORS.warning, fontWeight: '700' }]} numberOfLines={2}>
          {[x.vessel, tk(`ia.kind.${x.kind}`), x.by, waited(x.since)].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <MciIcon name="chevron-right" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

/** One red line: what, how many, the first names — "+2" for the rest. */
function redText(l: RedLine): string {
  const names = l.names.length ? `${l.names.join(', ')}${l.more ? ` +${l.more}` : ''}` : '';
  return tk(`ia.red.${l.kind}`, { n: l.n, names, date: l.since ? uiDate(l.since) : '' });
}

function Pill({ label, c, styles, COLORS }: { label: string; c: Count; styles: any; COLORS: Palette }) {
  if (!c.expired && !c.due) return null;
  const color = c.expired ? COLORS.danger : COLORS.warning;
  return (
    <Text style={[styles.pill, { color, borderColor: color }]}>
      {[label, c.expired ? `${c.expired} expired` : null, c.due ? `${c.due} due` : null].filter(Boolean).join(' · ')}
    </Text>
  );
}

function JoinForm({ onJoined, styles }: { onJoined: (s: shore.ShoreSession) => void; styles: any }) {
  const COLORS = useTheme();
  const [imo, setImo] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = imo.replace(/\D/g, '').length >= 7 && first.trim() && last.trim() && pin.trim().length >= 8;
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      onJoined(await shore.join(imo, first, last, pin));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <Label>{t('fleet.addHead')}</Label>
      <TextInput style={styles.input} value={imo} onChangeText={setImo} placeholder={t('fleet.imo')} placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', gap: SIZES.sm }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={first} onChangeText={setFirst} placeholder={t('common.firstName')} placeholderTextColor={COLORS.textLight} />
        <TextInput style={[styles.input, { flex: 1 }]} value={last} onChangeText={setLast} placeholder={t('common.lastName')} placeholderTextColor={COLORS.textLight} />
      </View>
      <TextInput style={styles.input} value={pin} onChangeText={(t) => setPin(t.replace(/\D/g, ''))} placeholder={t('fleet.pin')} placeholderTextColor={COLORS.textLight} keyboardType="number-pad" secureTextEntry />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      <TouchableOpacity style={[styles.btn, (!ready || busy) && { opacity: 0.5 }]} disabled={!ready || busy} onPress={() => void go()}>
        <Text style={styles.btnText}>{busy ? t('common.checking') : t('fleet.add')}</Text>
      </TouchableOpacity>
    </Card>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    lead: { fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.md, lineHeight: 21 },
    err: { color: COLORS.danger, fontSize: SIZES.small, marginVertical: SIZES.sm },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm },
    btn: { marginTop: SIZES.md, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    tools: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SIZES.md },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    vessel: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    vesselHead: { marginBottom: SIZES.sm },
    vesselName: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
    tabs: { flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.md, flexWrap: 'wrap' },
    tab: { paddingVertical: 7, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    tabOn: { backgroundColor: COLORS.primary },
    tabText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    tabTextOn: { color: COLORS.textWhite },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.sm },
    rowTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    redLine: { flexDirection: 'row', alignItems: 'center', gap: SIZES.xs, paddingVertical: 6 },
    redText: { flex: 1, fontSize: SIZES.small, fontWeight: '700' },
    pill: { fontSize: SIZES.tiny, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: SIZES.sm, overflow: 'hidden' },
  });
