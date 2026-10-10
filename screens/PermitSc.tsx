// ===================================
// One permit to work — from request to close, every step signed.
//
//   Draft      the person in charge fills it: work, place, window, team, the
//              precautions (Yes / No / N/A), gas readings, the risk assessment.
//   Requested  signed by the requester. Still editable.
//   Approved   signed by an Officer or the Master — only when nothing blocks it
//              (services/permits approvalBlockers): every precaution answered and
//              none "No", gas within limits, a risk assessment attached.
//   Active     signed when work starts. Gas can still be re-tested.
//   Closed     signed when the work is done and the area left safe.
//   Cancelled  at any open step, with a reason.
// Closed and cancelled permits are read-only.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { proofShort } from '../services/signature';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { Answer, GasTest, PERMIT_STATUS_LABEL, Permit, PermitType, SignStamp } from '../types/permits';
import { GAS_LIMITS, PERMIT_TYPE_MAP } from '../constants/permitTypes';
import { RISK_COLOR, RISK_LABEL, approvalBlockers, gasProblems, isOverdue, nextNumber, nowLocal, worstResidual } from '../services/permits';
import { isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { formatDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';

const plusHours = (iso: string, h: number) => nowLocal(new Date(Date.parse(iso) + h * 3600000));

export default function PermitSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { permits, risks, crew, savePermit, saveRisk } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const id: string = route.params?.id;
  const existing = permits.find((p) => p.id === id);
  const start = nowLocal();
  const type: PermitType = existing?.type ?? route.params?.type ?? 'hot';
  const def = PERMIT_TYPE_MAP[type];
  const [p, setP] = useState<Permit>(
    existing ?? { id, type, work: '', location: '', from: start, to: plusHours(start, Math.min(4, def.maxHours)), team: [], checks: {}, status: 'draft', createdAt: Date.now(), updatedAt: Date.now() }
  );
  const touched = useRef(false);
  useEffect(() => {
    if (existing && !touched.current) setP(existing);
  }, [existing]);
  const set = (x: Partial<Permit>) => {
    touched.current = true;
    setP((v) => ({ ...v, ...x }));
  };

  const final = p.status === 'closed' || p.status === 'cancelled';
  const editable = !final && (p.status === 'draft' || p.status === 'requested');
  const ra = risks.find((r) => r.id === p.raId);
  const blockers = approvalBlockers(p, !!ra);
  const people = crew.filter(isAboard);

  const persist = async (x: Permit) => {
    const out = { ...x, updatedAt: Date.now() };
    await savePermit(out);
    setP(out);
    touched.current = false;
  };

  const stamp = async (what: string): Promise<SignStamp | null> => {
    if (!signer) {
      Alert.alert('Who is signing?', 'Choose your name below.');
      return null;
    }
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${what} — ${p.no ?? def.label}` });
    if (!sig) return null;
    return { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) };
  };

  const act = async (kind: 'request' | 'approve' | 'start' | 'close' | 'cancel') => {
    if (kind === 'approve' && blockers.length) return Alert.alert('Not ready to approve', blockers.map((b) => `• ${b}`).join('\n'));
    if (kind === 'approve' && !officer) return Alert.alert('Approval', 'A permit is approved by an Officer or the Master.');
    const label = { request: 'Request the permit', approve: 'Approve the permit', start: 'Start the work', close: 'Close — work complete, area safe', cancel: 'Cancel the permit' }[kind];
    const s = await stamp(label);
    if (!s) return;
    const year = new Date().getFullYear();
    const next: Permit =
      kind === 'request'
        ? { ...p, status: 'requested', requested: s, no: p.no ?? nextNumber('PTW', year, permits.map((x) => x.no)) }
        : kind === 'approve'
        ? { ...p, status: 'approved', approved: s }
        : kind === 'start'
        ? { ...p, status: 'active', started: s }
        : kind === 'close'
        ? { ...p, status: 'closed', closed: s }
        : { ...p, status: 'cancelled', cancelled: s };
    await persist(next);
    playSuccessSound();
  };

  // Gas readings
  const [gas, setGas] = useState({ o2: '', lel: '', h2s: '', co: '', instrument: '' });
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));
  const addGas = async () => {
    if (!signer) return Alert.alert('Who measured?', 'Choose your name below.');
    const t: GasTest = { at: Date.now(), by: signer.name, ...Object.fromEntries(Object.entries({ o2: num(gas.o2), lel: num(gas.lel), h2s: num(gas.h2s), co: num(gas.co) }).filter(([, v]) => v != null && !Number.isNaN(v))), ...(gas.instrument.trim() ? { instrument: gas.instrument.trim() } : {}) };
    await persist({ ...p, gasTests: [...(p.gasTests ?? []), t] });
    setGas({ ...gas, o2: '', lel: '', h2s: '', co: '' });
  };

  // Risk assessment: attach one, or copy one from the library for this job
  const [raPick, setRaPick] = useState(false);
  const attachCopy = async (fromId: string) => {
    const src = risks.find((r) => r.id === fromId)!;
    const now = Date.now();
    const copy = { ...src, id: uid('ra'), generic: false, fromId: src.id, no: nextNumber('RA', new Date().getFullYear(), risks.map((r) => r.no)), title: `${src.title} — ${p.work || def.label}`, approved: undefined, createdAt: now, updatedAt: now, hazards: src.hazards.map((h) => ({ ...h, id: uid('hz') })) };
    delete (copy as any).approved;
    await saveRisk(copy);
    await persist({ ...p, raId: copy.id });
    setRaPick(false);
  };

  const now = nowLocal();
  const statusColor = isOverdue(p, now) ? COLORS.danger : p.status === 'active' ? COLORS.success : p.status === 'approved' ? COLORS.primary : p.status === 'requested' ? COLORS.warning : COLORS.textLight;

  const Stamp = ({ label, s }: { label: string; s?: SignStamp }) =>
    s ? (
      <Text style={styles.stamp}>{`${label}: ${s.byRank ? `${s.by} (${s.byRank})` : s.by} · ${formatDateTime(s.at)}${s.signedWith ? ` · ${proofShort(s.signedWith)}` : ''}`}</Text>
    ) : null;

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>{p.no ?? `New ${def.label.toLowerCase()} permit`}</Text>
          {editable ? (
            <TouchableOpacity onPress={() => void persist(p).then(() => playSuccessSound())} hitSlop={12}>
              <Text style={styles.save}>Save</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <View style={styles.typeRow}>
            <MciIcon name={def.icon} size={22} color={COLORS.primary} />
            <Text style={styles.typeText}>{def.label}</Text>
            <Text style={[styles.statusPill, { color: statusColor, borderColor: statusColor }]}>{isOverdue(p, now) ? 'Overdue — close or renew' : PERMIT_STATUS_LABEL[p.status]}</Text>
          </View>

          <Label>Work to be done ★</Label>
          <TextInput style={styles.input} value={p.work} onChangeText={(v) => set({ work: v })} editable={editable} placeholder="Weld bracket on the lazarette bulkhead" placeholderTextColor={COLORS.textLight} multiline />
          <Label>Location ★</Label>
          <TextInput style={styles.input} value={p.location} onChangeText={(v) => set({ location: v })} editable={editable} placeholder="Lazarette, port side" placeholderTextColor={COLORS.textLight} />
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Label>From (yyyy-mm-dd hh:mm)</Label>
              <TextInput style={styles.input} value={(p.from ?? '').replace('T', ' ')} onChangeText={(v) => set({ from: v.trim().replace(' ', 'T') })} editable={editable} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>{`To (max ${def.maxHours} h)`}</Label>
              <TextInput style={styles.input} value={(p.to ?? '').replace('T', ' ')} onChangeText={(v) => set({ to: v.trim().replace(' ', 'T') })} editable={editable} />
            </View>
          </View>

          <Label>Team ★</Label>
          <View style={styles.chips}>
            {people.map((c) => {
              const on = p.team.includes(c.name);
              return (
                <TouchableOpacity key={c.id} disabled={!editable} style={[styles.chip, on && styles.chipOn]} onPress={() => set({ team: on ? p.team.filter((n) => n !== c.name) : [...p.team, c.name] })}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.section}>Precautions</Text>
          {def.checks.map((c) => (
            <View key={c.id} style={styles.check}>
              <Text style={[styles.checkText, p.checks[c.id] === 'no' && { color: COLORS.danger }]}>{c.text}</Text>
              <View style={styles.answers}>
                {(['yes', 'no', 'na'] as Answer[]).map((a) => {
                  const on = p.checks[c.id] === a;
                  const col = a === 'yes' ? COLORS.success : a === 'no' ? COLORS.danger : COLORS.textLight;
                  return (
                    <TouchableOpacity key={a} disabled={!editable} onPress={() => set({ checks: { ...p.checks, [c.id]: a } })} style={[styles.ans, { borderColor: col }, on && { backgroundColor: col }]}>
                      <Text style={{ color: on ? COLORS.textWhite : col, fontWeight: '800', fontSize: SIZES.tiny }}>{a === 'na' ? 'N/A' : a.toUpperCase()}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {def.gas ? (
            <>
              <Text style={styles.section}>Gas readings</Text>
              <Text style={styles.sub}>{`Safe: O₂ ${GAS_LIMITS.o2Min}–${GAS_LIMITS.o2Max} % · LEL < ${GAS_LIMITS.lelMax} % · H₂S < ${GAS_LIMITS.h2sMax} ppm · CO < ${GAS_LIMITS.coMax} ppm`}</Text>
              {(p.gasTests ?? []).map((t, i) => {
                const bad = gasProblems(t);
                return (
                  <View key={i} style={styles.gasRow}>
                    <Text style={[styles.gasText, { color: bad.length ? COLORS.danger : COLORS.success }]}>
                      {`${formatDateTime(t.at)} — O₂ ${t.o2 ?? '–'} · LEL ${t.lel ?? '–'} · H₂S ${t.h2s ?? '–'} · CO ${t.co ?? '–'} · ${t.by}${t.instrument ? ` · ${t.instrument}` : ''}`}
                    </Text>
                    {bad.length ? <Text style={[styles.sub, { color: COLORS.danger }]}>{bad.join('; ')}</Text> : null}
                  </View>
                );
              })}
              {!final ? (
                <View style={styles.gasForm}>
                  {(['o2', 'lel', 'h2s', 'co'] as const).map((k) => (
                    <TextInput key={k} style={[styles.input, styles.gasInput]} value={gas[k]} onChangeText={(v) => setGas({ ...gas, [k]: v })} placeholder={{ o2: 'O₂ %', lel: 'LEL %', h2s: 'H₂S ppm', co: 'CO ppm' }[k]} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
                  ))}
                  <TextInput style={[styles.input, { flex: 2 }]} value={gas.instrument} onChangeText={(v) => setGas({ ...gas, instrument: v })} placeholder="Meter / serial" placeholderTextColor={COLORS.textLight} />
                  <TouchableOpacity style={styles.smallBtn} onPress={() => void addGas()}>
                    <Text style={styles.smallBtnText}>Record</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.section}>Risk assessment ★</Text>
          {ra ? (
            <TouchableOpacity style={styles.raRow} onPress={() => nav.navigate('Risk', { id: ra.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.raTitle}>{ra.title}</Text>
                <Text style={styles.sub}>{[ra.no, `${ra.hazards.length} hazards`, ra.approved ? 'approved' : 'not approved'].filter(Boolean).join(' · ')}</Text>
              </View>
              {worstResidual(ra) ? <Text style={{ color: RISK_COLOR[worstResidual(ra)!], fontWeight: '800' }}>{RISK_LABEL[worstResidual(ra)!]}</Text> : null}
            </TouchableOpacity>
          ) : (
            <Text style={styles.sub}>None attached yet.</Text>
          )}
          {editable ? (
            <TouchableOpacity onPress={() => setRaPick((v) => !v)} hitSlop={8}>
              <Text style={styles.link}>{raPick ? 'Close' : ra ? 'Replace the risk assessment' : 'Attach a risk assessment'}</Text>
            </TouchableOpacity>
          ) : null}
          {raPick ? (
            <View style={styles.raPick}>
              <Text style={styles.sub}>Copy from the library for this job (it can then be edited):</Text>
              {risks.filter((r) => r.generic).map((r) => (
                <TouchableOpacity key={r.id} style={styles.raOpt} onPress={() => void attachCopy(r.id)}>
                  <Text style={styles.link}>{`+ ${r.title}`}</Text>
                </TouchableOpacity>
              ))}
              {risks.filter((r) => !r.generic).length ? <Text style={[styles.sub, { marginTop: SIZES.sm }]}>Or attach one already made for a job:</Text> : null}
              {risks.filter((r) => !r.generic).map((r) => (
                <TouchableOpacity key={r.id} style={styles.raOpt} onPress={() => { set({ raId: r.id }); setRaPick(false); }}>
                  <Text style={styles.link}>{r.title}</Text>
                </TouchableOpacity>
              ))}
              {!risks.length ? <Text style={styles.sub}>No risk assessments yet — open Permits → Risk assessments and add the starter library.</Text> : null}
            </View>
          ) : null}

          <Text style={styles.section}>Isolations and notes</Text>
          <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={p.notes ?? ''} onChangeText={(v) => set({ notes: v })} editable={!final} multiline placeholder="Breaker 3-12 locked, tag 0451 · Fire watch: J. Dodd" placeholderTextColor={COLORS.textLight} />

          <Text style={styles.section}>Signatures</Text>
          <Stamp label="Requested" s={p.requested} />
          <Stamp label="Approved" s={p.approved} />
          <Stamp label="Work started" s={p.started} />
          <Stamp label="Closed" s={p.closed} />
          <Stamp label="Cancelled" s={p.cancelled} />

          {!final ? (
            <>
              {picker ? (
                <>
                  <Label>Signing as</Label>
                  {picker}
                </>
              ) : null}
              {p.status === 'requested' && blockers.length ? (
                <View style={styles.blockers}>
                  <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>Before it can be approved:</Text>
                  {blockers.map((b) => <Text key={b} style={styles.sub}>{`• ${b}`}</Text>)}
                </View>
              ) : null}
              <View style={styles.actions}>
                {p.status === 'draft' ? <Action label="Request the permit" onPress={() => void act('request')} styles={styles} /> : null}
                {p.status === 'requested' ? <Action label="Approve" onPress={() => void act('approve')} styles={styles} dim={!!blockers.length || !officer} /> : null}
                {p.status === 'approved' ? <Action label="Start the work" onPress={() => void act('start')} styles={styles} /> : null}
                {p.status === 'active' ? <Action label="Close — work complete, area safe" onPress={() => void act('close')} styles={styles} /> : null}
                {p.status !== 'draft' ? <Action label="Cancel the permit" onPress={() => void act('cancel')} styles={styles} outline /> : null}
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Action({ label, onPress, styles, outline, dim }: { label: string; onPress: () => void; styles: any; outline?: boolean; dim?: boolean }) {
  return (
    <TouchableOpacity style={[outline ? styles.actOutline : styles.act, dim && { opacity: 0.5 }]} onPress={onPress}>
      <Text style={outline ? styles.actOutlineText : styles.actText}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    typeRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
    typeText: { flex: 1, fontSize: SIZES.h4, fontWeight: '800', color: COLORS.textDark },
    statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: SIZES.sm, paddingVertical: 3, fontWeight: '800', fontSize: SIZES.small },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4, marginBottom: SIZES.sm },
    pair: { flexDirection: 'row', gap: SIZES.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    section: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.xl, marginBottom: SIZES.xs },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    check: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight },
    checkText: { flex: 1, fontSize: SIZES.body, color: COLORS.textDark },
    answers: { flexDirection: 'row', gap: 4 },
    ans: { minWidth: 40, alignItems: 'center', paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
    gasRow: { paddingVertical: 4 },
    gasText: { fontSize: SIZES.small, fontWeight: '700' },
    gasForm: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, alignItems: 'center', marginTop: SIZES.sm },
    gasInput: { width: 90 },
    smallBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 9, paddingHorizontal: SIZES.md },
    smallBtnText: { color: COLORS.textWhite, fontWeight: '800' },
    raRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.xs },
    raTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    raPick: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginTop: SIZES.xs },
    raOpt: { paddingVertical: 6 },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small, marginTop: SIZES.xs },
    stamp: { fontSize: SIZES.small, color: COLORS.textDark, marginTop: 2 },
    blockers: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginTop: SIZES.md },
    actions: { gap: SIZES.sm, marginTop: SIZES.lg },
    act: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    actText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
    actOutline: { borderWidth: 1, borderColor: COLORS.danger, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    actOutlineText: { color: COLORS.danger, fontWeight: '800', fontSize: SIZES.body },
  });
