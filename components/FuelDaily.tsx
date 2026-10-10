// ===================================
// Fuel → Daily report: the noon report, built from the soundings
// (services/fuelDaily.ts), with a remark and the sender's name; sent by
// e-mail, by the phone's share sheet (WhatsApp, Mail…), or copied.
// The addressees are remembered on this device.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { useSigner } from './SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { fuelDaily, fuelDailyText } from '../services/fuelDaily';
import { vesselHeader } from '../services/export';
import { todayIso } from '../services/pms';
import { formatDate } from '../utils/dates';

const TO_KEY = 'msm:fuel_report_to';
const L = (n: number) => `${Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ')} L`;

export function FuelDaily({ onSounding }: { onSounding: () => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { fuelTanks, fuelReadings, fuelBunkers, vessel } = useData();
  const { signer, picker } = useSigner('FROM');
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [remarks, setRemarks] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(TO_KEY).then((v) => v && setTo(v)).catch(() => {});
  }, []);

  const r = useMemo(() => fuelDaily(date, fuelTanks, fuelReadings, fuelBunkers), [date, fuelTanks, fuelReadings, fuelBunkers]);
  const by = signer ? (signer.rank ? `${signer.name}, ${signer.rank}` : signer.name) : '';
  const text = fuelDailyText(r, vesselHeader(vessel), remarks, by || '…');
  const subject = `${vessel?.vessel_name ?? 'Vessel'} — fuel daily report ${formatDate(date)}`;
  const shift = (n: number) => {
    const d = new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    setDate(d > today ? today : d);
  };

  const ready = () => {
    if (!r.reading) {
      setNote('Take the sounding for this day first.');
      return false;
    }
    if (!signer) {
      setNote('Choose who is sending it.');
      return false;
    }
    return true;
  };
  const email = async () => {
    if (!ready()) return;
    try {
      await AsyncStorage.setItem(TO_KEY, to.trim());
    } catch {}
    await Linking.openURL(`mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
  };
  const share = async () => {
    if (!ready()) return;
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: subject, text });
          return;
        } catch {
          /* cancelled — fall through to copy */
        }
      }
      try {
        await nav?.clipboard?.writeText(text);
        setNote('Copied — paste it into the message.');
      } catch {
        setNote('Could not copy — select the text below.');
      }
      return;
    }
    await Share.share({ title: subject, message: text });
  };

  return (
    <>
      <View style={styles.dayRow}>
        <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}><MciIcon name="chevron-left" size={28} color={COLORS.primary} /></TouchableOpacity>
        <Text style={styles.day}>{date === today ? `Today · ${formatDate(date)}` : formatDate(date)}</Text>
        <TouchableOpacity onPress={() => shift(1)} disabled={date >= today} hitSlop={10}>
          <MciIcon name="chevron-right" size={28} color={date >= today ? COLORS.border : COLORS.primary} />
        </TouchableOpacity>
      </View>

      {!r.reading ? (
        <Card>
          <Text style={styles.warn}>{`No sounding for ${formatDate(date)} yet — the report is made from it.`}</Text>
          <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={onSounding}><Text style={styles.btnText}>Go to Sounding</Text></TouchableOpacity>
        </Card>
      ) : (
        <>
          <View style={styles.stats}>
            <Stat label={r.previous ? `Consumed ${r.span && r.span > 1 ? `· ${r.span} days` : '· 24 h'}` : 'Consumed'} value={r.consumed != null ? L(r.consumed) : '—'} warn={r.suspect} styles={styles} COLORS={COLORS} />
            <Stat label="ROB" value={r.rob != null ? L(r.rob) : '—'} styles={styles} COLORS={COLORS} />
            <Stat label="Average, 7 days" value={r.avg7 != null ? `${L(r.avg7)}/day` : '—'} styles={styles} COLORS={COLORS} />
            <Stat label="Days at this rate" value={r.daysLeft != null ? String(r.daysLeft) : '—'} styles={styles} COLORS={COLORS} />
          </View>
          {r.suspect ? <Text style={styles.warn}>Consumption comes out negative — a sounding or a bunkering figure is wrong.</Text> : null}
          {!r.previous ? <Text style={styles.sub}>No earlier sounding — consumption shows from the second day.</Text> : null}
        </>
      )}

      <Card>
        <Label>Send</Label>
        {picker}
        <TextInput style={styles.input} value={remarks} onChangeText={setRemarks} placeholder="Remarks — at anchor, generators only, passage…" placeholderTextColor={COLORS.textLight} multiline />
        <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="To — office@…, captain@… (remembered)" placeholderTextColor={COLORS.textLight} autoCapitalize="none" keyboardType="email-address" />
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void email()}>
            <Text style={styles.btnText}>E-mail</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => void share()}>
            <Text style={styles.btnOutlineText}>{Platform.OS === 'web' ? 'Share / copy' : 'Share'}</Text>
          </TouchableOpacity>
        </View>
        {note ? <Text style={[styles.sub, { color: COLORS.primary, fontWeight: '700' }]}>{note}</Text> : null}
        <Text style={styles.preview} selectable>{text}</Text>
      </Card>
    </>
  );
}

function Stat({ label, value, warn, styles, COLORS }: { label: string; value: string; warn?: boolean; styles: any; COLORS: Palette }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statVal, warn && { color: COLORS.danger }]}>{value}</Text>
      <Text style={styles.sub}>{label}</Text>
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.md },
    day: { fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginBottom: SIZES.sm },
    stat: { flex: 1, minWidth: 140, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, alignItems: 'center' },
    statVal: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    warn: { color: COLORS.danger, fontWeight: '700', fontSize: SIZES.small, marginBottom: SIZES.sm },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm },
    row: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    preview: { marginTop: SIZES.md, padding: SIZES.md, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.borderLight, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: SIZES.small, color: COLORS.textDark },
  });
