// ===================================
// Security — ISPS Code: the digital gangway logbook and the security drills.
//
//   On board   persons on board now: crew (going ashore / back aboard by their
//              QR crew card or the watch's tap) and visitors signed on; sign a
//              visitor on — with their signature on the screen — and off.
//   Logbook    the book for a day or a month: visitors with their signatures,
//              crew ashore / back aboard; PDF and Excel.
//   Drills     security drills, at least every three months.
//
// The security level is a small switch in the corner (10 Oct 2026: "usually
// ISPS 1 — level 2 or 3 is out of the ordinary"); above 1 a line says so.
// Everything synchronises across the vessel's devices (services/firebaseService).
// ===================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { Dropdown } from '../components/Dropdown';
import { MonthPicker } from '../components/MonthPicker';
import { SignaturePad, SignatureView } from '../components/SignaturePad';
import { useSigner } from '../components/SignerChoice';
import { useSignConfirm } from '../components/SignConfirm';
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { current as latestVersions } from '../services/versions';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { CrewMove, LEVEL_TEXT, SECURITY_DRILL_DAYS, SECURITY_SCENARIOS, SecurityDrill, SecurityLevelRec, Visitor } from '../types/security';
import { isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { VISITOR_PHOTO_DAYS, isAshore, lastMoves, nextMove, personsOnBoard, photosToRemove } from '../services/gangway';
import { pickFromCamera } from '../services/attachments';
import { portraitDataUri } from '../services/images';
import { GANGWAY_STOCKS, crewCardSpecs, exportCrewCards, exportVisitorPasses, visitorPassSpecs } from '../services/crewCards';
import { GANGWAY_STOCK_MM } from '../services/gangwayLabels';
import { TsplLabelSpec, labelsToTspl } from '../services/tspl';
import { getSavedPrinter, printTspl, SavedPrinter } from '../services/blePrinter';
import { PrinterModal } from '../components/PrinterModal';
import SafetyFlashesSc from './SafetyFlashesSc';
import { samePass } from '../services/crewQr';
import { exportVisitorExcel, exportVisitorPdf, movesOf, visitsOf, vlogTitle } from '../services/visitorLog';
import { formatDate, formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

type Tab = 'board' | 'log' | 'drills';
const hhmm = () => new Date().toTimeString().slice(0, 5);
const ID_TYPES = ['Passport', 'ID card', 'Driving licence', "Seaman's book", 'Company ID'];

/** The menu's Security pages: gangway and drills here, the safety flashes on their own screen. */
export default function SecurityRoute() {
  const route = useRoute<any>();
  return route.params?.view === 'flashes' ? <SafetyFlashesSc /> : <SecuritySc />;
}

function SecuritySc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { visitors, securityLevels, securityDrills, crewMoves, crew, vessel, setVessel, saveRow, appendRow, versionsOf } = useData();
  const amend = useAmend();
  const allVisitors = versionsOf(storage.VISITORS_KEY) as Visitor[];
  const allDrills = versionsOf(storage.SECURITY_DRILLS_KEY) as SecurityDrill[];
  const visitorLine = (v: Visitor) => [v.company ? `${v.name} · ${v.company}` : v.name, `${v.timeIn} → ${v.timeOut ?? 'on board'}`, v.purpose, v.idNo ? `${v.idType} ${v.idNo}` : null, v.passNo ? `pass ${v.passNo}` : null].filter(Boolean).join(' · ');
  const sync = useSync();
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('WATCH');
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  // Two pages, as the menu's Security sub-items (and the chips on a phone):
  // the gangway logbook, and the drills.
  const route = useRoute<any>();
  const view: 'gangway' | 'drills' = route.params?.view === 'drills' ? 'drills' : 'gangway';
  const setView = (v: 'gangway' | 'drills') => nav.setParams({ view: v, pass: undefined });
  const [sub, setSub] = useState<'board' | 'log'>('board');
  const tab: Tab = view === 'drills' ? 'drills' : sub;
  const [saved, setSaved] = useState<string | null>(null);
  const done = (where: string | null | void) => {
    if (typeof where === 'string') setSaved(where === 'Downloads' ? 'Saved to Downloads' : `Saved to the folder “${where}”`);
  };
  const fail = (e: any) => Alert.alert('Security', String(e?.message ?? e));

  // ---- level ----
  const level = useMemo(() => [...securityLevels].sort((a, b) => b.since - a.since)[0], [securityLevels]);
  const current = (level?.level ?? 1) as 1 | 2 | 3;
  const levelColor = (l: number) => (l === 1 ? COLORS.success : l === 2 ? COLORS.warning : COLORS.danger);
  const setLevel = (l: 1 | 2 | 3) => {
    if (l === current) return;
    if (!officer) return Alert.alert('Security level', 'Set by the Master or the Ship Security Officer.');
    if (!signer) return Alert.alert('Who is setting it?', 'Choose the watch first.');
    const go = async () => {
      const r: SecurityLevelRec = { id: `level_${Date.now()}`, level: l, since: Date.now(), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), updatedAt: Date.now() };
      await appendRow(storage.SECURITY_LEVEL_KEY, r);
      playSuccessSound();
    };
    Alert.alert(`Security level ${l}`, LEVEL_TEXT[l], [{ text: 'Cancel', style: 'cancel' }, { text: `Set level ${l}`, onPress: () => void go() }]);
  };
  const levelSwitch = (
    <View style={styles.lvl}>
      <Text style={styles.lvlText}>ISPS</Text>
      {([1, 2, 3] as const).map((l) => (
        <TouchableOpacity key={l} onPress={() => setLevel(l)} hitSlop={4} accessibilityLabel={`Security level ${l}`} style={[styles.lvlBtn, current === l && { backgroundColor: levelColor(l), borderColor: levelColor(l) }]}>
          <Text style={[styles.lvlBtnText, current === l && { color: COLORS.textWhite }]}>{l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ---- on board ----
  const people = crew.filter(isAboard);
  const last = useMemo(() => lastMoves(crewMoves), [crewMoves]);
  const pob = useMemo(() => personsOnBoard(crew, crewMoves, visitors), [crew, crewMoves, visitors]);
  const onBoard = visitors.filter((v) => !v.timeOut).sort((a, b) => a.timeIn.localeCompare(b.timeIn));
  const moveCrew = async (id: string) => {
    const c = people.find((p) => p.id === id);
    if (!c) return;
    if (!signer) return Alert.alert('Gangway watch', 'Choose the watch first.');
    await appendRow(storage.CREW_MOVES_KEY, nextMove(c, crewMoves, signer.name, 'manual'));
    playSuccessSound();
  };

  // ---- new visitor ----
  const [adding, setAdding] = useState(false);
  const blank = { timeIn: hhmm(), name: '', company: '', purpose: '', idType: 'Passport', idNo: '', passNo: '', host: '', remarks: '', signature: '', photo: '' };
  const [f, setF] = useState(blank);
  const setSig = useCallback((signature: string) => setF((x) => ({ ...x, signature })), []);
  // A returning contractor: pick their earlier visit, the rest fills itself in.
  const known = useMemo(() => {
    const q = f.name.trim().toLowerCase();
    if (q.length < 2) return [];
    const seen = new Map<string, Visitor>();
    for (const v of [...visitors].sort((a, b) => b.updatedAt - a.updatedAt)) {
      const k = v.name.toLowerCase();
      if (k.includes(q) && k !== q && !seen.has(k)) seen.set(k, v);
    }
    return [...seen.values()].slice(0, 4);
  }, [f.name, visitors]);
  // Scanned a free visitor pass (ScanSc): open the sign-on form with its number.
  useEffect(() => {
    const p = route.params?.pass;
    if (!p) return;
    setSub('board');
    setAdding(true);
    setF((x) => ({ ...x, passNo: String(p) }));
    nav.setParams({ pass: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.pass]);

  // The visitor's photograph — the phone's camera, kept small on the record.
  const takePhoto = async () => {
    const shot = await pickFromCamera();
    if (!shot) return;
    const photo = await portraitDataUri(shot.uri);
    if (!photo) return Alert.alert('Photo', 'The photograph could not be used — try again.');
    setF((x) => ({ ...x, photo }));
  };

  // A pass scanned while in use (ScanSc): the holder's card, with the photograph.
  const [ident, setIdent] = useState<string | null>(null);
  useEffect(() => {
    const id = route.params?.visitor;
    if (!id) return;
    setSub('board');
    setIdent(String(id));
    nav.setParams({ visitor: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.visitor]);

  // Photographs are personal data: gone VISITOR_PHOTO_DAYS after the visit — the
  // log entry stays. Done by an Officer's or the Master's device when it opens
  // the screen, a few at a time.
  useEffect(() => {
    if (!officer) return;
    const due = photosToRemove(visitors, today).slice(0, 10);
    if (!due.length) return;
    void (async () => {
      for (const v of due) {
        const { photo: _drop, ...rest } = v;
        await saveRow(storage.VISITORS_KEY, { ...rest, photoRemovedAt: Date.now() });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officer, visitors.length, today]);

  const signOn = async () => {
    if (!signer) return Alert.alert('Gangway watch', 'Choose the watch first.');
    if (!f.name.trim() || !f.purpose.trim()) return Alert.alert('Visitor', 'Name and purpose of the visit are needed.');
    if (!/^\d{2}:\d{2}$/.test(f.timeIn)) return Alert.alert('Time in', 'The time the visitor came aboard, hh:mm.');
    if (!vessel?.port?.trim() || !vessel?.berth?.trim()) return Alert.alert('Port and berth', 'Enter the port and the berth at the top of the logbook first.');
    if (current >= 2 && !f.idNo.trim()) return Alert.alert('Identity', `At security level ${current} the identity document must be checked and recorded.`);
    const holder = f.passNo.trim() ? onBoard.find((v) => samePass(v.passNo, f.passNo)) : undefined;
    if (holder) return Alert.alert('Pass in use', `Pass ${f.passNo.trim()} is still with ${holder.name} (on board since ${holder.timeIn}). Sign them off first, or give another pass.`);
    const v: Visitor = {
      id: uid('vis'), date: today, timeIn: f.timeIn, name: f.name.trim(), purpose: f.purpose.trim(), inBy: signer.name, updatedAt: Date.now(),
      port: vessel.port.trim(), berth: vessel.berth.trim(),
      ...(f.company.trim() ? { company: f.company.trim() } : {}),
      ...(f.idNo.trim() ? { idType: f.idType, idNo: f.idNo.trim() } : {}),
      ...(f.passNo.trim() ? { passNo: f.passNo.trim() } : {}),
      ...(f.host ? { host: f.host } : {}),
      ...(f.remarks.trim() ? { remarks: f.remarks.trim() } : {}),
      ...(f.signature ? { signature: f.signature } : {}),
      ...(f.photo ? { photo: f.photo } : {}),
    };
    await saveRow(storage.VISITORS_KEY, v);
    setF(blank);
    setAdding(false);
    playSuccessSound();
  };
  // Signing off asks the time the visitor left — now by default.
  const [leaving, setLeaving] = useState<{ id: string; time: string } | null>(null);
  const signOff = async (v: Visitor, time: string) => {
    if (!signer) return Alert.alert('Gangway watch', 'Choose the watch first.');
    if (!/^\d{2}:\d{2}$/.test(time)) return Alert.alert('Time out', 'The time the visitor left, hh:mm.');
    await saveRow(storage.VISITORS_KEY, { ...v, timeOut: time, ...(v.date !== today ? { dateOut: today } : {}), outBy: signer.name });
    setLeaving(null);
    playSuccessSound();
  };
  // Port and berth of the vessel now — kept with the vessel's details, synced.
  const [portF, setPortF] = useState({ port: vessel?.port ?? '', berth: vessel?.berth ?? '' });
  useEffect(() => setPortF({ port: vessel?.port ?? '', berth: vessel?.berth ?? '' }), [vessel?.port, vessel?.berth]);
  const savePort = () => {
    if (portF.port.trim() === (vessel?.port ?? '') && portF.berth.trim() === (vessel?.berth ?? '')) return;
    void setVessel({ ...(vessel ?? {}), port: portF.port.trim(), berth: portF.berth.trim() });
  };

  // ---- logbook ----
  const [byMonth, setByMonth] = useState(false);
  const [day, setDay] = useState(today);
  const period = byMonth ? day.slice(0, 7) : day;
  // The book as it stands: amended visits in their latest version, deleted ones struck through.
  const book = useMemo(() => visitsOf(latestVersions(allVisitors), period), [allVisitors, period]);
  const bookMoves = useMemo(() => movesOf(crewMoves, period), [crewMoves, period]);
  const atEnd = period >= (byMonth ? today.slice(0, 7) : today);
  // Month picker in the title, like the other logs: the months the book has, with
  // how many visits and crew moves each — picking one shows that month whole.
  const logCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of latestVersions(allVisitors)) if (v.date) c[v.date.slice(0, 7)] = (c[v.date.slice(0, 7)] ?? 0) + 1;
    for (const m of crewMoves) if (m.date) c[m.date.slice(0, 7)] = (c[m.date.slice(0, 7)] ?? 0) + 1;
    return c;
  }, [allVisitors, crewMoves]);
  const pickMonth = (m: string) => {
    setByMonth(true);
    setDay(m === today.slice(0, 7) ? today : `${m}-01`);
  };
  const shift = (n: number) => {
    const d = new Date(`${day}T00:00:00Z`);
    if (byMonth) d.setUTCMonth(d.getUTCMonth() + n, 1);
    else d.setUTCDate(d.getUTCDate() + n);
    const iso = d.toISOString().slice(0, 10);
    setDay(iso > today ? today : iso);
  };

  // ---- drills ----
  const drills = useMemo(() => [...securityDrills].sort((a, b) => b.at - a.at), [securityDrills]);
  const drillsShown = useMemo(() => latestVersions(allDrills).sort((a, b) => b.at - a.at), [allDrills]);
  const nextDue = drills[0] ? new Date(Date.parse(`${drills[0].date}T00:00:00Z`) + SECURITY_DRILL_DAYS * 86400000).toISOString().slice(0, 10) : null;
  const drillLate = !nextDue || nextDue < today;
  const [d, setD] = useState({ scenario: SECURITY_SCENARIOS[0], minutes: '', findings: '', team: [] as string[] });
  const saveDrill = async () => {
    if (!signer) return Alert.alert('Who conducted it?', 'Choose the watch first.');
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

  const Chip = ({ on, label, onPress, warn }: { on: boolean; label: string; onPress: () => void; warn?: boolean }) => (
    <TouchableOpacity onPress={onPress} style={[styles.chip, on && styles.chipOn, warn && !on && { borderColor: COLORS.danger }]}>
      <Text style={[styles.chipText, on && styles.chipTextOn, warn && !on && { color: COLORS.danger }]}>{label}</Text>
    </TouchableOpacity>
  );

  // Crew cards and visitor passes on the label printer (Xprinter, Bluetooth) —
  // the same printer and rolls as the equipment labels.
  const [printerOpen, setPrinterOpen] = useState(false);
  const [pending, setPending] = useState<{ specs: TsplLabelSpec[]; what: string } | null>(null);
  const sendLabels = async (printer: SavedPrinter, job: { specs: TsplLabelSpec[]; what: string }) => {
    try {
      await printTspl(printer.id, labelsToTspl(job.specs));
      Alert.alert('Sent to printer', `${job.what} sent to ${printer.name}.`);
    } catch (e: any) {
      Alert.alert('Could not print to the Xprinter', String(e?.message ?? e));
    } finally {
      setPending(null);
    }
  };
  const pickSize = (make: (size: (typeof GANGWAY_STOCKS)[number]) => { specs: TsplLabelSpec[]; what: string }) =>
    Alert.alert('Label size', 'The roll loaded in the printer.', [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const job = make(sz);
          const printer = await getSavedPrinter();
          if (printer) return void sendLabels(printer, job);
          setPending(job);
          setPrinterOpen(true);
        },
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  const toXprinter = () =>
    Alert.alert('Print to Xprinter', 'Stickers with the gangway QR — for a card holder or a lanyard tag.', [
      { text: `Crew cards (${people.length})`, onPress: () => (people.length ? pickSize((sz) => ({ specs: crewCardSpecs(people, vessel, sz), what: `${people.length} crew card${people.length === 1 ? '' : 's'}` })) : Alert.alert('Crew cards', 'The crew list is empty.')) },
      { text: 'Visitor passes 01–20', onPress: () => pickSize((sz) => ({ specs: visitorPassSpecs(20, vessel, sz), what: '20 visitor passes' })) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <Screen scroll>
      <PrinterModal visible={printerOpen} onClose={() => { setPrinterOpen(false); setPending(null); }} onPicked={(p) => { setPrinterOpen(false); if (pending) void sendLabels(p, pending); }} />
      <ScreenTitle
        title={view === 'drills' ? 'Security drills' : 'Gangway logbook'}
        subtitle={view === 'drills' ? 'ISPS Code — at least one every three months' : 'ISPS Code — who is on board, visitors in and out'}
        help="Security (ISPS)"
        actions={
          view !== 'drills' && tab === 'log' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MonthPicker value={day.slice(0, 7)} onChange={pickMonth} months={Object.keys(logCounts)} counts={logCounts} />
              {levelSwitch}
            </View>
          ) : (
            levelSwitch
          )
        }
      />
      {current > 1 && level ? (
        <Text style={[styles.alert, { color: levelColor(current), borderColor: levelColor(current) }]}>
          {`Security level ${current} since ${formatDateTime(level.since)} — ${LEVEL_TEXT[current]}. Identity document required for every visitor.`}
        </Text>
      ) : null}

      {/* Gangway logbook and Drills are separate pages, reached from the menu (no chips here). */}
      {view === 'gangway' ? (
        <View style={styles.portRow}>
          <TextInput style={[styles.input, styles.portInput]} value={portF.port} onChangeText={(v) => setPortF({ ...portF, port: v })} onBlur={savePort} onSubmitEditing={savePort} placeholder="Port ★" placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.input, styles.portInput]} value={portF.berth} onChangeText={(v) => setPortF({ ...portF, berth: v })} onBlur={savePort} onSubmitEditing={savePort} placeholder="Berth / anchorage ★" placeholderTextColor={COLORS.textLight} />
          <Text style={styles.portDate}>{formatDate(today)}</Text>
        </View>
      ) : null}
      <View style={styles.topRow}>
        <View style={styles.chips}>
          {view === 'gangway' ? (
            <View style={styles.seg}>
              {([['board', `On board · ${pob.total}`], ['log', 'Log']] as const).map(([k, l]) => (
                <TouchableOpacity key={k} onPress={() => setSub(k)} style={[styles.segBtn, sub === k && styles.segOn]}>
                  <Text style={[styles.segText, sub === k && styles.segTextOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
        {picker ? <View style={{ minWidth: 240, flexShrink: 1 }}>{picker}</View> : null}
      </View>

      {tab === 'board' ? (
        <>
          <Text style={styles.pob}>{`${pob.total} persons on board — crew ${pob.crewAboard} of ${pob.crewTotal}${pob.visitors ? `, visitors ${pob.visitors}` : ''}`}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={() => { if (!adding) setF({ ...blank, timeIn: hhmm() }); setAdding((v) => !v); }}><Text style={styles.btnText}>{adding ? 'Close' : '+ Visitor'}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => nav.navigate('Scan')}>
              <MciIcon name="qrcode-scan" size={16} color={COLORS.primary} />
              <Text style={styles.btnOutlineText}>Scan card or pass</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => exportVisitorPasses(20, vessel).then(done, fail)}>
              <MciIcon name="badge-account-horizontal-outline" size={16} color={COLORS.primary} />
              <Text style={styles.btnOutlineText}>Print visitor passes</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => exportCrewCards(people, vessel).then(done, fail)}>
              <MciIcon name="card-account-details-outline" size={16} color={COLORS.primary} />
              <Text style={styles.btnOutlineText}>Print crew cards</Text>
            </TouchableOpacity>
            {Platform.OS === 'ios' || Platform.OS === 'android' ? (
              <TouchableOpacity style={styles.btnOutline} onPress={toXprinter}>
                <MciIcon name="bluetooth" size={16} color={COLORS.primary} />
                <Text style={styles.btnOutlineText}>Print to Xprinter</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}

          {adding ? (
            <Card>
              <View style={styles.pair}>
                <TextInput style={styles.input} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} placeholder="Full name ★" placeholderTextColor={COLORS.textLight} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SIZES.xs }}>
                  <Text style={styles.sub}>{`${formatDate(today)} · Time in ★`}</Text>
                  <TextInput style={[styles.input, { flex: 0, minWidth: 80, width: 80, marginTop: 0, textAlign: 'center' }]} value={f.timeIn} onChangeText={(v) => setF({ ...f, timeIn: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
                </View>
                <TextInput style={styles.input} value={f.company} onChangeText={(v) => setF({ ...f, company: v })} placeholder="Company" placeholderTextColor={COLORS.textLight} />
              </View>
              {known.length ? (
                <View style={styles.chips}>
                  {known.map((k) => (
                    <TouchableOpacity key={k.id} style={styles.known} onPress={() => setF({ ...f, name: k.name, company: k.company ?? '', purpose: k.purpose, idType: k.idType ?? f.idType, idNo: k.idNo ?? '', host: k.host ?? '', photo: k.photo ?? f.photo })}>
                      <Text style={styles.knownText}>{`↺ ${k.name}${k.company ? ` · ${k.company}` : ''}`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              <TextInput style={styles.input} value={f.purpose} onChangeText={(v) => setF({ ...f, purpose: v })} placeholder="Purpose of the visit ★" placeholderTextColor={COLORS.textLight} />
              <View style={styles.pair}>
                <Dropdown caption="ID" value={f.idType} onChange={(v) => setF({ ...f, idType: v })} options={ID_TYPES.map((t) => ({ value: t, label: t }))} style={{ flex: 1, minWidth: 180, marginTop: SIZES.xs }} />
                <TextInput style={styles.input} value={f.idNo} onChangeText={(v) => setF({ ...f, idNo: v })} placeholder={`Document No.${current >= 2 ? ' ★' : ''}`} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} value={f.passNo} onChangeText={(v) => setF({ ...f, passNo: v })} placeholder="Visitor pass No." placeholderTextColor={COLORS.textLight} />
              </View>
              <View style={styles.pair}>
                <Dropdown caption="HOST" value={f.host} onChange={(v) => setF({ ...f, host: v })} options={[{ value: '', label: '—' }, ...people.map((p) => ({ value: p.name, label: p.name }))]} style={{ flex: 1, minWidth: 180, marginTop: SIZES.xs }} />
                <TextInput style={[styles.input, { flex: 2 }]} value={f.remarks} onChangeText={(v) => setF({ ...f, remarks: v })} placeholder="Remarks — tools, bags searched, areas allowed" placeholderTextColor={COLORS.textLight} />
              </View>
              <View style={[styles.pair, { alignItems: 'center', marginTop: SIZES.sm }]}>
                {f.photo ? <Image source={{ uri: f.photo }} style={styles.thumbBig} /> : null}
                <TouchableOpacity style={styles.small} onPress={() => void takePhoto()}><Text style={styles.smallText}>{f.photo ? 'Retake photo' : '📷 Photo'}</Text></TouchableOpacity>
                {f.photo ? <TouchableOpacity onPress={() => setF({ ...f, photo: '' })}><Text style={[styles.smallText, { color: COLORS.danger }]}>Remove</Text></TouchableOpacity> : null}
                <Text style={[styles.sub, { flex: 1, minWidth: 160 }]}>{`So the crew can check who holds the pass. Kept ${VISITOR_PHOTO_DAYS} days after the visit — tell the visitor.`}</Text>
              </View>
              <SignaturePad value={f.signature} onChange={setSig} />
              <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void signOn()}><Text style={styles.btnText}>Sign on</Text></TouchableOpacity>
            </Card>
          ) : null}

          {(() => {
            const v = ident ? allVisitors.find((x) => x.id === ident) : undefined;
            if (!v) return null;
            const aboard = !v.timeOut;
            return (
              <Card>
                <View style={{ flexDirection: 'row', gap: SIZES.md, flexWrap: 'wrap' }}>
                  {v.photo ? <Image source={{ uri: v.photo }} style={styles.portrait} /> : <View style={[styles.portrait, { alignItems: 'center', justifyContent: 'center' }]}><MciIcon name="account" size={64} color={COLORS.textLight} /><Text style={styles.sub}>No photo</Text></View>}
                  <View style={{ flex: 1, minWidth: 180 }}>
                    <Text style={[styles.sub, { color: aboard ? COLORS.success : COLORS.danger, fontWeight: '800' }]}>{aboard ? `ON BOARD · pass ${v.passNo ?? '—'}` : `SIGNED OFF ${v.dateOut ? `${formatDate(v.dateOut)} ` : ''}${v.timeOut}`}</Text>
                    <Text style={[styles.name, { fontSize: 20 }]}>{v.name}</Text>
                    {v.company ? <Text style={styles.name}>{v.company}</Text> : null}
                    <Text style={styles.sub}>{v.purpose}</Text>
                    <Text style={styles.sub}>{[`in ${v.date !== today ? `${formatDate(v.date)} ` : ''}${v.timeIn}`, v.host ? `visiting ${v.host}` : null, `signed on by ${v.inBy}`].filter(Boolean).join(' · ')}</Text>
                    {v.idNo ? <Text style={styles.sub}>{`${v.idType ?? 'ID'} ${v.idNo}`}</Text> : null}
                    {v.remarks ? <Text style={styles.sub}>{v.remarks}</Text> : null}
                  </View>
                </View>
                <View style={[styles.pair, { marginTop: SIZES.md }]}>
                  {aboard ? (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.warning }]} onPress={() => { void signOff(v, hhmm()).then(() => setIdent(null)); }}><Text style={styles.btnText}>Sign off now — leaving the vessel</Text></TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={() => setIdent(null)}><Text style={styles.smallText}>Close</Text></TouchableOpacity>
                </View>
              </Card>
            );
          })()}

          <Label>{`Visitors on board (${onBoard.length})`}</Label>
          {onBoard.map((v) => (
            <View key={v.id} style={[styles.row, { borderLeftColor: COLORS.warning }]}>
              {v.photo ? <TouchableOpacity onPress={() => setIdent(v.id)}><Image source={{ uri: v.photo }} style={styles.thumb} /></TouchableOpacity> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{v.company ? `${v.name} · ${v.company}` : v.name}</Text>
                <Text style={styles.sub}>{[`in ${v.date !== today ? `${formatDate(v.date)} ` : ''}${v.timeIn}`, v.purpose, v.passNo ? `pass ${v.passNo}` : null, v.host ? `with ${v.host}` : null].filter(Boolean).join(' · ')}</Text>
              </View>
              {leaving?.id === v.id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <TextInput style={[styles.input, { flex: 0, minWidth: 80, width: 80, marginTop: 0, textAlign: 'center' }]} value={leaving.time} onChangeText={(t) => setLeaving({ ...leaving, time: t })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
                  <TouchableOpacity style={[styles.small, { backgroundColor: COLORS.primary }]} onPress={() => void signOff(v, leaving.time)}><Text style={[styles.smallText, { color: COLORS.textWhite }]}>Time out ✓</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.small} onPress={() => setLeaving({ id: v.id, time: hhmm() })}><Text style={styles.smallText}>Sign off</Text></TouchableOpacity>
              )}
            </View>
          ))}
          {!onBoard.length ? <Text style={styles.sub}>No visitors on board.</Text> : null}

          <Label>{`Crew (${pob.crewAboard} aboard${pob.ashore.length ? `, ${pob.ashore.length} ashore` : ''})`}</Label>
          {people.map((c) => {
            const away = isAshore(c.id, last);
            const m = last.get(c.id);
            const when = m ? `${m.date !== today ? `${formatDate(m.date)} ` : ''}${m.time}` : '';
            return (
              <View key={c.id} style={[styles.row, { borderLeftColor: away ? COLORS.textLight : COLORS.success }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, away && { color: COLORS.textLight }]}>{c.rank ? `${c.name} · ${c.rank}` : c.name}</Text>
                  <Text style={styles.sub}>{away ? `ashore since ${when}` : m ? `aboard since ${when}` : 'aboard'}</Text>
                </View>
                {/* Ashore yellow, back aboard green (11 Oct 2026). */}
                <TouchableOpacity style={[styles.small, { backgroundColor: away ? COLORS.success : COLORS.warning, borderColor: away ? COLORS.success : COLORS.warning }]} onPress={() => void moveCrew(c.id)}>
                  <Text style={[styles.smallText, { color: COLORS.textWhite }]}>{away ? 'Back aboard' : 'Ashore'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      ) : tab === 'log' ? (
        <>
          <View style={styles.periodRow}>
            <TouchableOpacity onPress={() => shift(-1)} hitSlop={10}><MciIcon name="chevron-left" size={26} color={COLORS.primary} /></TouchableOpacity>
            <Text style={styles.period}>{vlogTitle(period)}</Text>
            <TouchableOpacity onPress={() => shift(1)} disabled={atEnd} hitSlop={10}>
              <MciIcon name="chevron-right" size={26} color={atEnd ? COLORS.border : COLORS.primary} />
            </TouchableOpacity>
            <Dropdown caption="SHOW" value={byMonth ? 'm' : 'd'} onChange={(v) => setByMonth(v === 'm')} options={[{ value: 'd', label: 'Day' }, { value: 'm', label: 'Month' }]} style={{ minWidth: 150 }} />
            <TouchableOpacity style={styles.btnOutline} onPress={() => exportVisitorPdf(latestVersions(allVisitors), crewMoves, period, vessel).then(done, fail)}><Text style={styles.btnOutlineText}>PDF</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnOutline} onPress={() => exportVisitorExcel(latestVersions(allVisitors), crewMoves, period, vessel).then(done, fail)}><Text style={styles.btnOutlineText}>Excel</Text></TouchableOpacity>
          </View>
          {saved ? <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{`✓ ${saved}`}</Text> : null}

          <Label>{`Visitors (${book.length})`}</Label>
          {book.map((v, i) => (
            <View key={v.id} style={[styles.row, v.cancelled && { opacity: 0.6 }]}>
              <Text style={styles.no}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, v.cancelled && { textDecorationLine: 'line-through' }]}>{v.company ? `${v.name} · ${v.company}` : v.name}</Text>
                <Text style={styles.sub}>
                  {[byMonth ? formatDate(v.date) : null, [v.port, v.berth].filter(Boolean).join(' / ') || null, `${v.timeIn} → ${v.timeOut ?? 'on board'}`, v.purpose, v.idNo ? `${v.idType} ${v.idNo}` : null, v.passNo ? `pass ${v.passNo}` : null, v.host ? `with ${v.host}` : null, `watch ${v.outBy && v.outBy !== v.inBy ? `${v.inBy} / ${v.outBy}` : v.inBy}`].filter(Boolean).join(' · ')}
                </Text>
                <AmendNote rec={v} all={allVisitors} summary={visitorLine} />
              </View>
              {v.signature ? <SignatureView path={v.signature} height={34} /> : null}
              {!v.cancelled ? (
                <AmendButtons
                  isMaster={isMaster}
                  onEdit={() => amend.edit({ store: storage.VISITORS_KEY, record: v, what: `Visitor ${v.name}, ${formatDate(v.date)}`, fields: [{ key: 'name', label: 'Name' }, { key: 'company', label: 'Company' }, { key: 'purpose', label: 'Purpose' }, { key: 'idType', label: 'ID document' }, { key: 'idNo', label: 'Document No.' }, { key: 'passNo', label: 'Pass No.' }, { key: 'host', label: 'Host' }, { key: 'timeIn', label: 'Time in (hh:mm)' }, { key: 'timeOut', label: 'Time out (hh:mm)' }, { key: 'remarks', label: 'Remarks', kind: 'multiline' }] })}
                  onDelete={() => amend.remove({ store: storage.VISITORS_KEY, record: v, what: `Visitor ${v.name}, ${formatDate(v.date)}` })}
                />
              ) : null}
            </View>
          ))}
          {!book.length ? <Text style={styles.sub}>No visitors.</Text> : null}

          <Label>{`Crew ashore / back aboard (${bookMoves.length})`}</Label>
          {bookMoves.map((m: CrewMove) => (
            <Text key={m.id} style={styles.move}>
              {`${byMonth ? `${formatDate(m.date)} ` : ''}${m.time}  ${m.name} — ${m.dir === 'ashore' ? 'ashore' : 'back aboard'} · ${m.via === 'qr' ? 'card' : m.by}`}
            </Text>
          ))}
          {!bookMoves.length ? <Text style={styles.sub}>No crew movements.</Text> : null}
        </>
      ) : (
        <>
          <Text style={[styles.sub, drillLate && { color: COLORS.danger, fontWeight: '700' }]}>
            {nextDue ? `Next drill ${drillLate ? 'overdue since' : 'by'} ${formatDate(nextDue)} — ISPS: at least every three months.` : 'No security drill recorded yet — ISPS: at least every three months.'}
          </Text>
          <Card>
            <View style={styles.pair}>
              <Dropdown caption="SCENARIO" value={SECURITY_SCENARIOS.includes(d.scenario) ? d.scenario : ''} onChange={(v) => setD({ ...d, scenario: v || SECURITY_SCENARIOS[0] })} options={[...SECURITY_SCENARIOS.map((x) => ({ value: x, label: x })), { value: '', label: 'Other…' }]} style={{ flex: 1, minWidth: 260, marginTop: SIZES.xs }} />
              <TextInput style={[styles.input, { maxWidth: 140 }]} value={d.minutes} onChangeText={(v) => setD({ ...d, minutes: v })} placeholder="Minutes" placeholderTextColor={COLORS.textLight} keyboardType="number-pad" />
            </View>
            <TextInput style={styles.input} value={SECURITY_SCENARIOS.includes(d.scenario) ? '' : d.scenario} onChangeText={(v) => setD({ ...d, scenario: v || SECURITY_SCENARIOS[0] })} placeholder="…or describe another scenario" placeholderTextColor={COLORS.textLight} />
            <Text style={[styles.sub, { marginTop: SIZES.sm }]}>Who took part</Text>
            <View style={styles.chips}>
              {people.map((p) => <Chip key={p.id} on={d.team.includes(p.name)} label={p.name} onPress={() => setD({ ...d, team: d.team.includes(p.name) ? d.team.filter((n) => n !== p.name) : [...d.team, p.name] })} />)}
              {people.length ? <Chip on={false} label={d.team.length === people.length ? 'None' : 'All'} onPress={() => setD({ ...d, team: d.team.length === people.length ? [] : people.map((p) => p.name) })} /> : null}
            </View>
            <TextInput style={styles.input} value={d.findings} onChangeText={(v) => setD({ ...d, findings: v })} placeholder="Areas searched, findings, what to improve" placeholderTextColor={COLORS.textLight} multiline />
            <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void saveDrill()}><Text style={styles.btnText}>Sign the drill</Text></TouchableOpacity>
          </Card>
          {drillsShown.map((x) => (
            <View key={x.id} style={[styles.row, x.cancelled && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, x.cancelled && { textDecorationLine: 'line-through' }]}>{x.scenario}</Text>
                <Text style={styles.sub}>{[`${formatDate(x.date)} ${x.time ?? ''}`, `${x.participants.length} took part`, x.minutes ? `${x.minutes} min` : null, x.byRank ? `${x.by} (${x.byRank})` : x.by].filter(Boolean).join(' · ')}</Text>
                {x.findings ? <Text style={styles.sub}>{x.findings}</Text> : null}
                <AmendNote rec={x} all={allDrills} summary={(p) => [p.scenario, formatDate(p.date), p.minutes ? `${p.minutes} min` : null, p.findings].filter(Boolean).join(' · ')} />
              </View>
              {!x.cancelled ? (
                <AmendButtons
                  isMaster={isMaster}
                  onEdit={() => amend.edit({ store: storage.SECURITY_DRILLS_KEY, record: x, what: `Security drill ${formatDate(x.date)}`, fields: [{ key: 'scenario', label: 'Scenario' }, { key: 'minutes', label: 'Minutes', kind: 'number' }, { key: 'findings', label: 'Areas searched, findings', kind: 'multiline' }] })}
                  onDelete={() => amend.remove({ store: storage.SECURITY_DRILLS_KEY, record: x, what: `Security drill ${formatDate(x.date)}` })}
                />
              ) : null}
            </View>
          ))}
        </>
      )}
      {amend.ui}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    thumb: { width: 40, height: 40, borderRadius: 6, marginRight: SIZES.sm },
    thumbBig: { width: 64, height: 64, borderRadius: 8 },
    portrait: { width: 160, height: 160, borderRadius: 10, backgroundColor: COLORS.border },
    portRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, flexWrap: 'wrap', marginBottom: SIZES.sm },
    portInput: { flex: 1, minWidth: 160, marginTop: 0 },
    portDate: { fontSize: SIZES.body, fontWeight: '800', color: COLORS.textDark },
    seg: { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, overflow: 'hidden', marginLeft: SIZES.sm },
    segBtn: { paddingVertical: 5, paddingHorizontal: SIZES.md },
    segOn: { backgroundColor: COLORS.borderLight },
    segText: { fontSize: SIZES.small, fontWeight: '600', color: COLORS.textLight },
    segTextOn: { color: COLORS.textDark, fontWeight: '800' },
    lvl: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: SIZES.sm, marginTop: 4 },
    lvlText: { fontSize: SIZES.tiny, fontWeight: '800', color: COLORS.textLight, marginRight: 2 },
    lvlBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    lvlBtnText: { fontSize: SIZES.tiny, fontWeight: '900', color: COLORS.textLight },
    alert: { borderWidth: 1, borderRadius: SIZES.radiusMd, padding: SIZES.sm, fontWeight: '700', fontSize: SIZES.small, marginBottom: SIZES.md },
    topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SIZES.sm, marginBottom: SIZES.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    pob: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.sm },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginVertical: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 9, paddingHorizontal: SIZES.md },
    btnOutlineText: { color: COLORS.primary, fontWeight: '800' },
    small: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: SIZES.sm },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    pair: { flexDirection: 'row', gap: SIZES.sm, flexWrap: 'wrap', alignItems: 'center' },
    input: { flex: 1, minWidth: 140, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    known: { borderRadius: 999, backgroundColor: COLORS.borderLight, paddingVertical: 5, paddingHorizontal: SIZES.sm },
    knownText: { fontSize: SIZES.small, color: COLORS.textDark, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md, marginBottom: SIZES.xs, borderLeftWidth: 4, borderLeftColor: COLORS.borderLight },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    no: { width: 22, textAlign: 'right', fontWeight: '800', color: COLORS.textLight },
    periodRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.sm, marginVertical: SIZES.sm },
    period: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, minWidth: 140, textAlign: 'center' },
    move: { fontSize: SIZES.small, color: COLORS.textDark, paddingVertical: 3 },
  });
