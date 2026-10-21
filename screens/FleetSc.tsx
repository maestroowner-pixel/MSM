// ===================================
// Fleet — the superintendent's console: every vessel they have been let into,
// worst first, with what is out of date on each.
//
// Not a device aboard: it signs in on its own Firebase app (services/shore.ts)
// with an invitation each vessel's Master issues as "Superintendent (shore)".
// Reads everything on those vessels; edits their documents and certificates
// (screens/FleetVesselSc). Meant for a laptop in the office — app.ismpilot.com
// /fleet — but nothing stops it on a tablet.
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import * as shore from '../services/shore';
import { moduleOn } from '../constants/modules';
import { Count, VesselSummary, fleetOrder, summarise } from '../services/fleetSummary';
import { formatDateTime } from '../utils/dates';
import { t, tn, useT } from '../utils/i18n';

export default function FleetSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const [session, setSession] = useState<shore.ShoreSession | null>(null);
  const [rows, setRows] = useState<VesselSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (s: shore.ShoreSession) => {
    setLoading(true);
    const out: VesselSummary[] = [];
    await Promise.all(
      s.vessels.map(async (imo) => {
        try {
          out.push(summarise(await shore.loadVessel(imo)));
        } catch (e: any) {
          console.warn(`[fleet] ${imo}: ${e?.message ?? e}`);
        }
      })
    );
    setRows(out.sort(fleetOrder));
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
      <ScreenTitle title="Fleet" subtitle={`${session.name || t('fleet.supt')} · ${tn('n.vessel', session.vessels.length)}`} help="Fleet console (superintendent)" />
      <View style={styles.tools}>
        <TouchableOpacity onPress={() => void load(session)} hitSlop={8}>
          <Text style={styles.link}>{loading ? t('common.loading') : t('fleet.refresh')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setAdding((v) => !v)} hitSlop={8}>
          <Text style={styles.link}>{adding ? t('common.cancel') : `+ ${t('fleet.add')}`}</Text>
        </TouchableOpacity>
      </View>
      {adding ? <JoinForm onJoined={onJoined} styles={styles} /> : null}

      {rows.length === 0 && !loading ? <Empty text={t('fleet.noneOpen')} /> : null}
      {rows.map((r) => (
        <TouchableOpacity key={r.imo} style={styles.vessel} onPress={() => nav.navigate('FleetVessel', { imo: r.imo })} activeOpacity={0.75}>
          <View style={styles.vesselHead}>
            <Text style={styles.vesselName} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.sub}>{`IMO ${r.imo} · synced ${r.registerAt ? formatDateTime(r.registerAt) : 'never'}`}</Text>
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
    pill: { fontSize: SIZES.tiny, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: SIZES.sm, overflow: 'hidden' },
  });
