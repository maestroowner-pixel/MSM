// ===================================
// Fuel → Daily report: the vessel's noon report — where she is (position cells,
// or the port), the fuel from the soundings, and the day on board from every
// log (services/dailyActivity.ts), as text to send and as PDF / Excel.
// Originally the fuel noon report, built from the soundings
// (services/fuelDaily.ts), with a remark and the sender's name; sent by
// e-mail, by the phone's share sheet (WhatsApp, Mail…), or copied.
// The addressees are remembered on this device. Every sending is logged —
// figures and text as they went — and the log syncs with the vessel.
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
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import * as storage from '../services/storage';
import { FuelDailySent } from '../types/fuel';
import { PositionInput } from './PositionInput';
import { shipAndUtc } from '../utils/shipTime';
import { moduleOn } from '../constants/modules';
import { CATEGORY_MAP } from '../constants/categories';
import { REPORT_LABEL, ReportKind, activityLines, dailyActivity, reportWindow } from '../services/dailyActivity';
import { exportDailyExcel, exportDailyPdf } from '../services/dailyReport';

const TO_KEY = 'msm:fuel_report_to';
const L = (n: number) => `${Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ')} L`;

export function FuelDaily({ onSounding }: { onSounding: () => void }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const data = useData();
  const { fuelTanks, fuelReadings, fuelBunkers, fuelDailySent, vessel, appendRow } = data;
  const [openLog, setOpenLog] = useState<string | null>(null);
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
  // Noon position or port — the last one sent for the day comes back.
  // Noon report (noon to noon) or midnight report (the calendar day) — 13 Oct 2026.
  const [kind, setKind] = useState<ReportKind>(() => (new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'midnight' : 'noon'));
  const [pos, setPos] = useState<{ position: string; port: string }>({ position: '', port: '' });
  useEffect(() => {
    const last = [...fuelDailySent].filter((x) => x.date === date && (x.kind ?? 'noon') === kind).sort((a, b) => b.sentAt - a.sentAt)[0];
    setPos({ position: last?.position ?? '', port: last?.port ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, kind]);
  const sections = useMemo(
    () => dailyActivity({ ...(data as any), date, ...reportWindow(kind, date, vessel?.ship_utc_offset), on: moduleOn, labelOf: (k: string) => data.categories.find((c: any) => c.key === k)?.label ?? (CATEGORY_MAP as any)[k]?.label ?? k, flat: data.flat, inspections: data.inspections }),
    [data, date, kind]
  );
  // The report's moment in ship's time and UTC — the end of its window (noon, or 24:00).
  const at = shipAndUtc(reportWindow(kind, date, vessel?.ship_utc_offset).to, vessel?.ship_utc_offset);
  const stamp = kind === 'midnight' ? `${date} 24:00 ship's time (${at.zone}) · ${at.utc} UTC` : at.line;
  const [openSec, setOpenSec] = useState<string | null>(null);
  const by = signer ? (signer.rank ? `${signer.name}, ${signer.rank}` : signer.name) : '';
  const text = fuelDailyText(r, vesselHeader(vessel), remarks, by || '…', { position: pos.position, port: pos.port, activity: activityLines(sections), kind, stamp });
  const subject = `${vessel?.vessel_name ?? 'Vessel'} — ${REPORT_LABEL[kind].toLowerCase()} ${formatDate(date)}`;
  const place = pos.position || (pos.port ? `in port ${pos.port}` : '');
  const doc = async (fmt: 'pdf' | 'xlsx') => {
    try {
      const d = { date, kind, stamp, place, fuel: r, sections, ...(remarks.trim() ? { remarks: remarks.trim() } : {}), ...(by ? { by } : {}) };
      const w = fmt === 'pdf' ? await exportDailyPdf(d, vessel) : await exportDailyExcel(d, vessel);
      if (typeof w === 'string') setNote(w === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${w}”`);
    } catch (e: any) {
      setNote(String(e?.message ?? e));
    }
  };
  const shift = (n: number) => {
    const d = new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    setDate(d > today ? today : d);
  };

  const ready = () => {
    if (!signer) {
      setNote('Choose who is sending it.');
      return false;
    }
    return true;
  };
  const log = async (channel: FuelDailySent['channel']) => {
    const now = Date.now();
    const row: FuelDailySent = {
      id: uid('fdr'), date, kind, sentAt: now, by: signer!.name, ...(signer!.rank ? { byRank: signer!.rank } : {}), channel,
      ...(channel === 'email' && to.trim() ? { to: to.trim() } : {}),
      ...(r.consumed != null ? { consumed: r.consumed } : {}), ...(r.rob != null ? { rob: r.rob } : {}),
      ...(r.avg7 != null ? { avg7: r.avg7 } : {}), ...(r.daysLeft != null ? { daysLeft: r.daysLeft } : {}),
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}), ...(pos.position ? { position: pos.position } : pos.port.trim() ? { port: pos.port.trim() } : {}), text, updatedAt: now,
    };
    await appendRow(storage.FUEL_DAILY_KEY, row);
  };
  const email = async () => {
    if (!ready()) return;
    try {
      await AsyncStorage.setItem(TO_KEY, to.trim());
    } catch {}
    await Linking.openURL(`mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`);
    await log('email');
  };
  const share = async () => {
    if (!ready()) return;
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (nav?.share) {
        try {
          await nav.share({ title: subject, text });
          await log('share');
          return;
        } catch {
          /* cancelled — fall through to copy */
        }
      }
      try {
        await nav?.clipboard?.writeText(text);
        await log('copy');
        setNote('Copied — paste it into the message.');
      } catch {
        setNote('Could not copy — select the text below.');
      }
      return;
    }
    const res = await Share.share({ title: subject, message: text });
    if (res.action !== Share.dismissedAction) await log('share');
  };
  const sentToday = fuelDailySent.filter((x) => x.date === date).sort((a, b) => a.sentAt - b.sentAt);
  const history = useMemo(() => [...fuelDailySent].sort((a, b) => b.sentAt - a.sentAt).slice(0, 30), [fuelDailySent]);
  const how = (x: FuelDailySent) => (x.channel === 'email' ? `e-mail${x.to ? ` → ${x.to}` : ''}` : x.channel === 'share' ? 'shared' : 'copied');
  const hm = (t: number) => new Date(t).toTimeString().slice(0, 5);

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

      <View style={{ flexDirection: 'row', gap: SIZES.xs, marginBottom: SIZES.sm }}>
        {(['noon', 'midnight'] as ReportKind[]).map((k) => (
          <TouchableOpacity key={k} onPress={() => setKind(k)} style={[styles.btnOutline, { paddingVertical: 6 }, kind === k && { backgroundColor: COLORS.primary }]}>
            <Text style={[styles.btnOutlineText, kind === k && { color: COLORS.textWhite }]}>{`${REPORT_LABEL[k]} · ${k === 'noon' ? 'noon to noon' : '00:00–24:00'}`}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Card>
        <Text style={[styles.sub, { marginTop: 0, marginBottom: SIZES.xs, fontWeight: '700' }]}>{stamp}</Text>
        <Label>{kind === 'noon' ? 'Noon position' : 'Midnight position'}</Label>
        <PositionInput position={pos.position} port={pos.port} onChange={(position, port) => setPos({ position, port })} />
      </Card>

      <Card>
        <Label>{`On board ${kind === 'noon' ? `noon ${formatDate(new Date(Date.parse(`${date}T00:00:00Z`) - 86400000).toISOString().slice(0, 10))} → noon ${formatDate(date)}` : formatDate(date)} · ${sections.reduce((n, s) => n + s.rows.length, 0)} entries`}</Label>
        {sections.map((s) => (
          <TouchableOpacity key={s.title} onPress={() => setOpenSec(openSec === s.title ? null : s.title)} activeOpacity={0.7} style={{ paddingVertical: 4 }}>
            <Text style={{ fontWeight: '700', color: COLORS.textDark }}>{`${openSec === s.title ? '▾' : '▸'} ${s.title} · ${s.rows.length}`}</Text>
            {openSec === s.title ? s.rows.map((row, i) => <Text key={i} style={styles.sub}>{row.filter(Boolean).join(' · ')}</Text>) : null}
          </TouchableOpacity>
        ))}
        {!sections.length ? <Text style={styles.sub}>Nothing recorded in any log for this day yet.</Text> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void doc('pdf')}><Text style={styles.btnText}>{`${REPORT_LABEL[kind]} (PDF)`}</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => void doc('xlsx')}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
        </View>
      </Card>

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
        {sentToday.length ? (
          <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700', marginTop: SIZES.sm }]}>
            {`✓ Sent for ${formatDate(date)}: ${sentToday.map((x) => `${hm(x.sentAt)} ${x.by} · ${how(x)}`).join('; ')}`}
          </Text>
        ) : null}
        <Text style={styles.preview} selectable>{text}</Text>
      </Card>

      <Label>{`Sent reports (${fuelDailySent.length})`}</Label>
      {history.map((x) => (
        <TouchableOpacity key={x.id} style={styles.logRow} onPress={() => setOpenLog(openLog === x.id ? null : x.id)} activeOpacity={0.7}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
            <Text style={styles.logDay}>{formatDate(x.date)}</Text>
            <Text style={[styles.sub, { flex: 1 }]} numberOfLines={1}>
              {[x.consumed != null ? `${L(x.consumed)} burnt` : null, x.rob != null ? `ROB ${L(x.rob)}` : null, `${formatDateTime(x.sentAt)} · ${x.byRank ? `${x.by} (${x.byRank})` : x.by} · ${how(x)}`].filter(Boolean).join(' · ')}
            </Text>
            <MciIcon name={openLog === x.id ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.textLight} />
          </View>
          {openLog === x.id ? <Text style={styles.preview} selectable>{x.text}</Text> : null}
        </TouchableOpacity>
      ))}
      {!history.length ? <Text style={styles.sub}>Nothing sent yet. Each report you send is kept here, as it went.</Text> : null}
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
    logRow: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md, marginBottom: SIZES.xs },
    logDay: { fontWeight: '800', color: COLORS.textDark, fontSize: SIZES.body, minWidth: 96 },
    preview: { marginTop: SIZES.md, padding: SIZES.md, borderRadius: SIZES.radiusMd, backgroundColor: COLORS.borderLight, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: SIZES.small, color: COLORS.textDark },
  });
