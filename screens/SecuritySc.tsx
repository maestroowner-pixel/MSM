// ===================================
// Security — ISPS Code: the security level and the gangway / visitor log
// (types/security.ts).
//
// The gangway watch signs a visitor on — name, company, purpose, the identity
// document seen, the pass given, who receives them — and signs them off. "On
// board now" is every visitor not yet signed off, the first thing a Master
// asks at a muster. The log for any day or month goes out as Excel.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { LEVEL_TEXT, SECURITY_DRILL_DAYS, SECURITY_SCENARIOS, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
import { isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { vesselHeader } from '../services/export';
import { deliverFile, onWeb } from '../utils/fileShare';
import { saveFileWeb } from '../utils/webSave';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

const hhmm = () => new Date().toTimeString().slice(0, 5);
const ID_TYPES = ['Passport', 'ID card', 'Driving licence', "Seaman's book", 'Company ID'];

export default function SecuritySc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { visitors, securityLevels, securityDrills, crew, vessel, saveRow, appendRow } = useData();
  const confirmSign = useSignConfirm();
  const sync = useSync();
  const { signer, picker } = useSigner();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const [adding, setAdding] = useState(false);
  const [day, setDay] = useState(today);
  const [saved, setSaved] = useState<string | null>(null);

  const level = useMemo(() => [...securityLevels].sort((a, b) => b.since - a.since)[0], [securityLevels]);
  const current = level?.level ?? 1;
  const onBoard = visitors.filter((v) => !v.timeOut).sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  const ofDay = visitors.filter((v) => v.date === day).sort((a, b) => b.timeIn.localeCompare(a.timeIn));
  const people = crew.filter(isAboard);
  const [tab, setTab] = useState<'gangway' | 'drills'>('gangway');

  // ---- security drills ----
  const drills = useMemo(() => [...securityDrills].sort((a, b) => b.at - a.at), [securityDrills]);
  const nextDue = drills[0] ? new Date(Date.parse(`${drills[0].date}T00:00:00Z`) + SECURITY_DRILL_DAYS * 86400000).toISOString().slice(0, 10) : null;
  const drillLate = !nextDue || nextDue < today;
  const drillDue = nextDue ? `${drillLate ? 'overdue since' : 'next by'} ${formatDate(nextDue)}` : 'none yet';
  const [d, setD] = useState({ scenario: SECURITY_SCENARIOS[0], minutes: '', findings: '', team: [] as string[] });
  const saveDrill = async () => {
    if (!signer) return Alert.alert('Who conducted it?', 'Choose your name below.');
    if (!d.team.length) return Alert.alert('Drill', 'Mark who took part.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Security drill — ${d.scenario}` });
    if (!sig) return;
    const now = Date.now();
    const r: SecurityDrill = {
      id: uid('secd'), date: today, time: hhmm(), scenario: d.scenario, participants: d.team,
      ...(Number(d.minutes) > 0 ? { minutes: Number(d.minutes) } : {}), ...(d.findings.trim() ? { findings: d.findings.trim() } : {}),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, ...(sig.proof ? { signedWith: sig.proof } : {}), updatedAt: now,
    };
    await appendRow(storage.SECURITY_DRILLS_KEY, r);
    setD({ scenario: SECURITY_SCENARIOS[0], minutes: '', findings: '', team: [] });
    playSuccessSound();
  };

  const setLevel = (l: 1 | 2 | 3) => {
    if (!officer) return Alert.alert('Security level', 'Set by the Master or the Ship Security Officer.');
    if (!signer) return Alert.alert('Who is setting it?', 'Choose your name below.');
    if (l === current) return;
    const go = async () => {
      const r: SecurityLevelRec = { id: `level_${Date.now()}`, level: l, since: Date.now(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), updatedAt: Date.now() };
      await appendRow(storage.SECURITY_LEVEL_KEY, r);
      playSuccessSound();
    };
    Alert.alert(`Security level ${l}`, LEVEL_TEXT[l], [{ text: 'Cancel', style: 'cancel' }, { text: `Set level ${l}`, onPress: () => void go() }]);
  };

  // ---- new visitor ----
  const blank = { name: '', company: '', purpose: '', idType: 'Passport', idNo: '', passNo: '', host: '', remarks: '' };
  const [f, setF] = useState(blank);
  const signOn = async () => {
    if (!signer) return Alert.alert('Gangway watch', 'Choose your name below.');
    if (!f.name.trim() || !f.purpose.trim()) return Alert.alert('Visitor', 'Name and purpose of the visit are needed.');
    if (current >= 2 && !f.idNo.trim()) return Alert.alert('Identity', `At security level ${current} the identity document must be checked and recorded.`);
    const v: Visitor = {
      id: uid('vis'), date: today, timeIn: hhmm(), name: f.name.trim(), purpose: f.purpose.trim(), inBy: signer.name, updatedAt: Date.now(),
      ...(f.company.trim() ? { company: f.company.trim() } : {}),
      ...(f.idNo.trim() ? { idType: f.idType, idNo: f.idNo.trim() } : {}),
      ...(f.passNo.trim() ? { passNo: f.passNo.trim() } : {}),
      ...(f.host ? { host: f.host } : {}),
      ...(f.remarks.trim() ? { remarks: f.remarks.trim() } : {}),
    };
    await saveRow(storage.VISITORS_KEY, v);
    setF(blank);
    setAdding(false);
    playSuccessSound();
  };
  const signOff = async (v: Visitor) => {
    if (!signer) return Alert.alert('Gangway watch', 'Choose your name below.');
    await saveRow(storage.VISITORS_KEY, { ...v, timeOut: hhmm(), ...(v.date !== today ? { dateOut: today } : {}), outBy: signer.name });
    playSuccessSound();
  };

  const exportLog = async (month: boolean) => {
    const rows = visitors.filter((v) => (month ? v.date.startsWith(day.slice(0, 7)) : v.date === day)).sort((a, b) => `${a.date}${a.timeIn}`.localeCompare(`${b.date}${b.timeIn}`));
    const head = ['Date', 'Time in', 'Time out', 'Name', 'Company', 'Purpose', 'ID', 'ID No.', 'Pass No.', 'Host', 'Signed on by', 'Signed off by', 'Remarks'];
    const ws = XLSX.utils.aoa_to_sheet([[`Gangway / visitor log — ${month ? day.slice(0, 7) : day}`], [vesselHeader(vessel)], [], head, ...rows.map((v) => [v.date, v.timeIn, v.timeOut ? `${v.dateOut ? `${v.dateOut} ` : ''}${v.timeOut}` : 'ON BOARD', v.name, v.company ?? '', v.purpose, v.idType ?? '', v.idNo ?? '', v.passNo ?? '', v.host ?? '', v.inBy, v.outBy ?? '', v.remarks ?? ''])]);
    ws['!cols'] = head.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
    const v = (vessel?.vessel_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim();
    const name = `Visitor log-${month ? `${day.slice(5, 7)}${day.slice(2, 4)}` : `${day.slice(8, 10)}${day.slice(5, 7)}${day.slice(2, 4)}`}${v ? `-${v}` : ''}.xlsx`;
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (onWeb) {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const where = await saveFileWeb(new Blob([bytes], { type: mime }), name, 'reports');
      if (where) setSaved(where === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${where}”`);
    } else await deliverFile(name, b64, true, mime);
  };

  const shiftDay = (n: number) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    setDay(d.toISOString().slice(0, 10));
  };
  const levelColor = current === 1 ? COLORS.success : current === 2 ? COLORS.warning : COLORS.danger;

  return (
    <Screen scroll>
      <ScreenTitle title="Security" subtitle="ISPS Code — security level, gangway / visitor log, security drills" help="Security (ISPS)" />

      <Card>
        <View style={styles.levelRow}>
          <MciIcon name="shield-account" size={28} color={levelColor} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.levelTitle, { color: levelColor }]}>{`Security level ${current}`}</Text>
            <Text style={styles.sub}>{LEVEL_TEXT[current as 1 | 2 | 3]}</Text>
            {level ? <Text style={styles.sub}>{`Since ${formatDateTime(level.since)} · set by ${level.by}`}</Text> : null}
          </View>
          <View style={styles.levelBtns}>
            {([1, 2, 3] as const).map((l) => (
              <TouchableOpacity key={l} onPress={() => setLevel(l)} style={[styles.levelBtn, current === l && { backgroundColor: levelColor, borderColor: levelColor }]}>
                <Text style={[styles.levelBtnText, current === l && { color: COLORS.textWhite }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Card>

      <View style={styles.chips}>
        {([['gangway', `Gangway · ${onBoard.length} on board`], ['drills', `Drills · ${drillDue}`]] as ['gangway' | 'drills', string][]).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={[styles.chip, tab === k && styles.chipOn, k === 'drills' && drillLate && tab !== k && { borderColor: COLORS.danger }]}>
            <Text style={[styles.chipText, tab === k && styles.chipTextOn, k === 'drills' && drillLate && tab !== k && { color: COLORS.danger }]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'gangway' ? (
        <>
        <View style={styles.row}>
          <Label>{`On board now — ${onBoard.length} visitor${onBoard.length === 1 ? '' : 's'}`}</Label>
          <TouchableOpacity style={styles.btn} onPress={() => setAdding((v) => !v)}><Text style={styles.btnText}>{adding ? 'Close' : '+ Sign a visitor on'}</Text></TouchableOpacity>
        </View>

        {adding ? (
          <Card>
            <View style={styles.pair}>
              <TextInput style={styles.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Full name ★" placeholderTextColor={COLORS.textLight} />
              <TextInput style={styles.input} value={f.company} onChangeText={(v) => setF({ ...f, company: v })} placeholder="Company" placeholderTextColor={COLORS.textLight} />
            </View>
            <TextInput style={styles.input} value={f.purpose} onChangeText={(v) => setF({ ...f, purpose: v })} placeholder="Purpose of the visit ★ — e.g. engineer, AC service" placeholderTextColor={COLORS.textLight} />
            <View style={styles.chips}>
              {ID_TYPES.map((t) => (
                <TouchableOpacity key={t} onPress={() => setF({ ...f, idType: t })} style={[styles.chip, f.idType === t && styles.chipOn]}>
                  <Text style={[styles.chipText, f.idType === t && styles.chipTextOn]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pair}>
              <TextInput style={styles.input} value={f.idNo} onChangeText={(v) => setF({ ...f, idNo: v })} placeholder={`${f.idType} No.${current >= 2 ? ' ★' : ''}`} placeholderTextColor={COLORS.textLight} />
              <TextInput style={styles.input} value={f.passNo} onChangeText={(v) => setF({ ...f, passNo: v })} placeholder="Visitor pass No." placeholderTextColor={COLORS.textLight} />
            </View>
            <Text style={styles.sub}>Received / escorted by</Text>
            <View style={styles.chips}>
              {people.map((p) => (
                <TouchableOpacity key={p.id} onPress={() => setF({ ...f, host: f.host === p.name ? '' : p.name })} style={[styles.chip, f.host === p.name && styles.chipOn]}>
                  <Text style={[styles.chipText, f.host === p.name && styles.chipTextOn]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder="Remarks — tools, bags searched, areas allowed" placeholderTextColor={COLORS.textLight} />
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void signOn()}><Text style={styles.btnText}>Sign on</Text></TouchableOpacity>
          </Card>
        ) : null}

        {onBoard.map((v) => (
          <View key={v.id} style={[styles.visitor, { borderLeftColor: COLORS.warning }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vName}>{v.company ? `${v.name} · ${v.company}` : v.name}</Text>
              <Text style={styles.sub}>{[`in ${v.date !== today ? `${formatDate(v.date)} ` : ''}${v.timeIn}`, v.purpose, v.passNo ? `pass ${v.passNo}` : null, v.host ? `with ${v.host}` : null].filter(Boolean).join(' · ')}</Text>
            </View>
            <TouchableOpacity style={styles.btnOutline} onPress={() => void signOff(v)}><Text style={styles.btnOutlineText}>Sign off</Text></TouchableOpacity>
          </View>
        ))}
        {!onBoard.length ? <Text style={styles.sub}>No visitors on board.</Text> : null}

        {picker ? <><Text style={[styles.sub, { marginTop: SIZES.md }]}>Gangway watch</Text>{picker}</> : null}

        <View style={[styles.row, { marginTop: SIZES.lg }]}>
          <TouchableOpacity onPress={() => shiftDay(-1)} hitSlop={10}><MciIcon name="chevron-left" size={26} color={COLORS.primary} /></TouchableOpacity>
          <Text style={styles.dayTitle}>{`Log — ${formatDate(day)}`}</Text>
          <TouchableOpacity onPress={() => shiftDay(1)} disabled={day >= today} hitSlop={10}><MciIcon name="chevron-right" size={26} color={day >= today ? COLORS.border : COLORS.primary} /></TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => void exportLog(false)}><Text style={styles.btnOutlineText}>Excel — day</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => void exportLog(true)}><Text style={styles.btnOutlineText}>Excel — month</Text></TouchableOpacity>
        </View>
        {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}
        {ofDay.map((v) => (
          <View key={v.id} style={styles.visitor}>
            <View style={{ flex: 1 }}>
              <Text style={styles.vName}>{v.company ? `${v.name} · ${v.company}` : v.name}</Text>
              <Text style={styles.sub}>{[`${v.timeIn} → ${v.timeOut ?? 'on board'}`, v.purpose, v.idNo ? `${v.idType} ${v.idNo}` : null, v.passNo ? `pass ${v.passNo}` : null, v.host ? `with ${v.host}` : null, `on: ${v.inBy}`, v.outBy ? `off: ${v.outBy}` : null].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
        ))}
        {!ofDay.length ? <Text style={styles.sub}>No visitors this day.</Text> : null}
        </>
      ) : (
        <>
          <Card>
            <Label>Record a security drill — today</Label>
            <View style={styles.chips}>
              {SECURITY_SCENARIOS.map((x) => (
                <TouchableOpacity key={x} onPress={() => setD({ ...d, scenario: x })} style={[styles.chip, d.scenario === x && styles.chipOn]}>
                  <Text style={[styles.chipText, d.scenario === x && styles.chipTextOn]}>{x}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={styles.input} value={SECURITY_SCENARIOS.includes(d.scenario) ? '' : d.scenario} onChangeText={(v) => setD({ ...d, scenario: v || SECURITY_SCENARIOS[0] })} placeholder="…or describe another scenario" placeholderTextColor={COLORS.textLight} />
            <Text style={styles.sub}>Who took part</Text>
            <View style={styles.chips}>
              {people.map((p) => (
                <TouchableOpacity key={p.id} onPress={() => setD({ ...d, team: d.team.includes(p.name) ? d.team.filter((n) => n !== p.name) : [...d.team, p.name] })} style={[styles.chip, d.team.includes(p.name) && styles.chipOn]}>
                  <Text style={[styles.chipText, d.team.includes(p.name) && styles.chipTextOn]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.pair}>
              <TextInput style={[styles.input, { maxWidth: 140 }]} value={d.minutes} onChangeText={(v) => setD({ ...d, minutes: v })} placeholder="Minutes" placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
              <TextInput style={[styles.input, { flex: 3 }]} value={d.findings} onChangeText={(v) => setD({ ...d, findings: v })} placeholder="Areas searched, findings, what to improve" placeholderTextColor={COLORS.textLight} multiline />
            </View>
            {picker ? <><Text style={styles.sub}>Drill conducted by</Text>{picker}</> : null}
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start' }]} onPress={() => void saveDrill()}><Text style={styles.btnText}>Sign the drill</Text></TouchableOpacity>
          </Card>
          {drills.map((x) => (
            <View key={x.id} style={styles.visitor}>
              <View style={{ flex: 1 }}>
                <Text style={styles.vName}>{x.scenario}</Text>
                <Text style={styles.sub}>{[`${formatDate(x.date)} ${x.time ?? ''}`, `${x.participants.length} took part`, x.minutes ? `${x.minutes} min` : null, x.byRank ? `${x.by} (${x.byRank})` : x.by].filter(Boolean).join(' · ')}</Text>
                {x.findings ? <Text style={styles.sub}>{x.findings}</Text> : null}
              </View>
            </View>
          ))}
          {!drills.length ? <Text style={styles.sub}>No security drill recorded. ISPS: at least one every three months.</Text> : null}
        </>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    levelRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md },
    levelTitle: { fontSize: SIZES.h4, fontWeight: '900' },
    levelBtns: { flexDirection: 'row', gap: 6 },
    levelBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    levelBtnText: { fontWeight: '900', fontSize: SIZES.body, color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, justifyContent: 'space-between', marginVertical: SIZES.sm },
    dayTitle: { flex: 1, fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md, marginTop: SIZES.xs },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 8, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    pair: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap' },
    input: { flex: 1, minWidth: 140, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs, marginBottom: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    visitor: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs, borderLeftWidth: 4, borderLeftColor: COLORS.borderLight },
    vName: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
  });
