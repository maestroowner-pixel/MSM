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
import { Answer, GasTest, Permit, PermitType, SignStamp, ToolboxMeeting } from '../types/permits';
import { GAS_LIMITS, PERMIT_TYPE_MAP } from '../constants/permitTypes';
import { RISK_COLOR, approvalBlockers, gasProblems, isOverdue, nextNumber, nowLocal, startBlockers, worstResidual } from '../services/permits';
import { TOOLBOX_TOPICS, toolboxText } from '../constants/toolbox';
import { exportPermitPdf } from '../services/permitReport';
import { isAboard } from '../types/crew';
import { roleAtLeast } from '../types/role';
import { uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, tn, useT } from '../utils/i18n';

const plusHours = (iso: string, h: number) => nowLocal(new Date(Date.parse(iso) + h * 3600000));

export default function PermitSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { permits, risks, crew, savePermit, saveRisk , vessel } = useData();
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
    existing ?? { id, type, work: route.params?.work ?? '', location: route.params?.location ?? '', ...(route.params?.pmsJobId ? { pmsJobId: route.params.pmsJobId } : {}), from: start, to: plusHours(start, Math.min(4, def.maxHours)), team: [], checks: {}, status: 'draft', createdAt: Date.now(), updatedAt: Date.now() }
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
      Alert.alert(t('sign.who'), t('pd.chooseName'));
      return null;
    }
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${what} — ${p.no ?? def.label}` });
    if (!sig) return null;
    return { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) };
  };

  // Closing: the date and time the work was finished — now, or earlier if it
  // is signed afterwards; never before the work started or in the future.
  const [closing, setClosing] = useState<string | null>(null);
  const closeProblem = (v: string) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return t('ptw.dtFmt');
    if (v > nowLocal()) return t('ptw.notFuture');
    const startedAt = p.started ? nowLocal(new Date(p.started.at)) : p.from;
    if (startedAt && v < startedAt) return t('ptw.notBefore', { when: startedAt.replace('T', ' ') });
    return null;
  };

  const act = async (kind: 'request' | 'approve' | 'start' | 'close' | 'cancel') => {
    if (kind === 'close') {
      const prob = closing == null ? t('ptw.enterClosing') : closeProblem(closing);
      if (prob) return Alert.alert(t('ptw.closingTime'), prob);
    }
    if (kind === 'approve' && blockers.length) return Alert.alert(t('ptw.notReadyApprove'), blockers.map((b) => `• ${b}`).join('\n'));
    if (kind === 'approve' && !officer) return Alert.alert(t('risk.approval'), t('ptw.officerApproves'));
    if (kind === 'start' && startBlockers(p).length) return Alert.alert(t('ptw.notReadyStart'), startBlockers(p).map((b) => `• ${b}`).join('\n'));
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
        ? { ...p, status: 'closed', closed: s, closedAt: closing! }
        : { ...p, status: 'cancelled', cancelled: s };
    await persist(next);
    playSuccessSound();
  };

  // Toolbox meeting — held before the work, with everyone on it marked.
  const [tb, setTb] = useState<{ open: boolean; present: string[]; extra: string[]; topics: string[]; concerns: string }>({ open: false, present: [], extra: [], topics: [], concerns: '' });
  const openToolbox = () =>
    setTb({ open: true, present: p.toolbox ? p.toolbox.attendees.filter((a) => a.present).map((a) => a.name) : [], extra: p.toolbox ? p.toolbox.attendees.map((a) => a.name).filter((n) => !p.team.includes(n)) : [], topics: p.toolbox?.topics ?? [], concerns: p.toolbox?.concerns ?? '' });
  const holdToolbox = async () => {
    if (!p.work.trim() || !p.location.trim()) return Alert.alert(t('ptw.toolbox'), t('ptw.writeFirst'));
    const names = [...p.team, ...tb.extra.filter((n) => !p.team.includes(n))];
    const missing = p.team.filter((n) => !tb.present.includes(n));
    const go = async () => {
      const s = await stamp('Toolbox meeting held');
      if (!s) return;
      const t: ToolboxMeeting = {
        at: s.at, location: p.location.trim(), work: p.work.trim(),
        attendees: names.map((n) => ({ name: n, present: tb.present.includes(n) })),
        topics: tb.topics, ...(tb.concerns.trim() ? { concerns: tb.concerns.trim() } : {}),
        by: s.by, ...(s.byRank ? { byRank: s.byRank } : {}), ...(s.signedWith ? { signedWith: s.signedWith } : {}),
      };
      await persist({ ...p, toolbox: t });
      setTb({ ...tb, open: false });
      playSuccessSound();
    };
    if (missing.length) Alert.alert(t('ptw.notEveryone'), t('ptw.notEveryoneBody', { names: missing.join(', ') }), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('gb.record'), onPress: () => void go() }]);
    else await go();
  };

  // Gas readings
  const [gas, setGas] = useState({ o2: '', lel: '', h2s: '', co: '', instrument: '' });
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));
  const addGas = async () => {
    if (!signer) return Alert.alert(t('ptw.whoMeasured'), t('pd.chooseName'));
    const test: GasTest = { at: Date.now(), by: signer.name, ...Object.fromEntries(Object.entries({ o2: num(gas.o2), lel: num(gas.lel), h2s: num(gas.h2s), co: num(gas.co) }).filter(([, v]) => v != null && !Number.isNaN(v))), ...(gas.instrument.trim() ? { instrument: gas.instrument.trim() } : {}) };
    await persist({ ...p, gasTests: [...(p.gasTests ?? []), test] });
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
      <Text style={styles.stamp}>{`${tk(`ptw.st.${label}`)}: ${s.byRank ? `${s.by} (${s.byRank})` : s.by} · ${uiDateTime(s.at)}${s.signedWith ? ` · ${proofShort(s.signedWith)}` : ''}`}</Text>
    ) : null;

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>{p.no ?? t('ptw.newPermit', { kind: tk(`ptw.kind.${def.key}`).toLowerCase() })}</Text>
          {/* The permit with its toolbox meeting report, as a document (services/permitReport). */}
          {existing ? (
            <TouchableOpacity
              onPress={() =>
                exportPermitPdf(p, ra, vessel).then(
                  (w) => typeof w === 'string' && Alert.alert(t('ptw.pdf'), w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w })),
                  (e) => Alert.alert(t('ptw.pdf'), String(e?.message ?? e))
                )
              }
              hitSlop={12}
              style={{ marginRight: SIZES.md }}
              accessibilityLabel={t('ptw.asPdf')}
            >
              <MciIcon name="file-pdf-box" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          ) : null}
          {editable ? (
            <TouchableOpacity onPress={() => void persist(p).then(() => playSuccessSound())} hitSlop={12}>
              <Text style={styles.save}>{t('common.save')}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 40 }} />}
        </View>

        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <View style={styles.typeRow}>
            <MciIcon name={def.icon} size={22} color={COLORS.primary} />
            <Text style={styles.typeText}>{tk(`ptw.kind.${def.key}`)}</Text>
            <Text style={[styles.statusPill, { color: statusColor, borderColor: statusColor }]}>{isOverdue(p, now) ? t('ptw.overdue') : tk(`ptw.status.${p.status}`)}</Text>
          </View>

          <Label>{t('ptw.work')}</Label>
          <TextInput style={styles.input} value={p.work} onChangeText={(v) => set({ work: v })} editable={editable} placeholder={t('ptw.workPh')} placeholderTextColor={COLORS.textLight} multiline />
          <Label>{t('ptw.location')}</Label>
          <TextInput style={styles.input} value={p.location} onChangeText={(v) => set({ location: v })} editable={editable} placeholder={t('ptw.locationPh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Label>{t('ptw.validFrom')}</Label>
              <TextInput style={styles.input} value={(p.from ?? '').replace('T', ' ')} onChangeText={(v) => set({ from: v.trim().replace(' ', 'T') })} editable={editable} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>{t('ptw.validUntil', { n: def.maxHours })}</Label>
              <TextInput style={styles.input} value={(p.to ?? '').replace('T', ' ')} onChangeText={(v) => set({ to: v.trim().replace(' ', 'T') })} editable={editable} />
            </View>
          </View>

          <Label>{t('ptw.team')}</Label>
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

          <Text style={styles.section}>{t('ptw.precautions')}</Text>
          {def.checks.map((c) => (
            <View key={c.id} style={styles.check}>
              <Text style={[styles.checkText, p.checks[c.id] === 'no' && { color: COLORS.danger }]}>{tk(`ptw.chk.${def.key}.${c.id}`)}</Text>
              <View style={styles.answers}>
                {(['yes', 'no', 'na'] as Answer[]).map((a) => {
                  const on = p.checks[c.id] === a;
                  const col = a === 'yes' ? COLORS.success : a === 'no' ? COLORS.danger : COLORS.textLight;
                  return (
                    <TouchableOpacity key={a} disabled={!editable} onPress={() => set({ checks: { ...p.checks, [c.id]: a } })} style={[styles.ans, { borderColor: col }, on && { backgroundColor: col }]}>
                      <Text style={{ color: on ? COLORS.textWhite : col, fontWeight: '800', fontSize: SIZES.tiny }}>{tk(`ptw.ans.${a}`)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {def.gas ? (
            <>
              <Text style={styles.section}>{t('ptw.gas')}</Text>
              <Text style={styles.sub}>{`${t('ptw.safe')}: O₂ ${GAS_LIMITS.o2Min}–${GAS_LIMITS.o2Max} % · LEL < ${GAS_LIMITS.lelMax} % · H₂S < ${GAS_LIMITS.h2sMax} ppm · CO < ${GAS_LIMITS.coMax} ppm`}</Text>
              {(p.gasTests ?? []).map((t, i) => {
                const bad = gasProblems(t);
                return (
                  <View key={i} style={styles.gasRow}>
                    <Text style={[styles.gasText, { color: bad.length ? COLORS.danger : COLORS.success }]}>
                      {`${uiDateTime(t.at)} — O₂ ${t.o2 ?? '–'} · LEL ${t.lel ?? '–'} · H₂S ${t.h2s ?? '–'} · CO ${t.co ?? '–'} · ${t.by}${t.instrument ? ` · ${t.instrument}` : ''}`}
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
                  <TextInput style={[styles.input, { flex: 2 }]} value={gas.instrument} onChangeText={(v) => setGas({ ...gas, instrument: v })} placeholder={t('ptw.meterPh')} placeholderTextColor={COLORS.textLight} />
                  <TouchableOpacity style={styles.smallBtn} onPress={() => void addGas()}>
                    <Text style={styles.smallBtnText}>{t('gb.record')}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          ) : null}

          <Text style={styles.section}>{t('ptw.ra')}</Text>
          {ra ? (
            <TouchableOpacity style={styles.raRow} onPress={() => nav.navigate('Risk', { id: ra.id })}>
              <View style={{ flex: 1 }}>
                <Text style={styles.raTitle}>{ra.title}</Text>
                <Text style={styles.sub}>{[ra.no, tn('n.hazard', ra.hazards.length), ra.approved ? t('ptw.approvedL') : t('permits.notApproved')].filter(Boolean).join(' · ')}</Text>
              </View>
              {worstResidual(ra) ? <Text style={{ color: RISK_COLOR[worstResidual(ra)!], fontWeight: '800' }}>{tk(`risk.lvl.${worstResidual(ra)!}`)}</Text> : null}
            </TouchableOpacity>
          ) : (
            <Text style={styles.sub}>{t('ptw.noneAttached')}</Text>
          )}
          {editable ? (
            <TouchableOpacity onPress={() => setRaPick((v) => !v)} hitSlop={8}>
              <Text style={styles.link}>{raPick ? t('common.close') : ra ? t('ptw.replaceRa') : t('ptw.attachRa')}</Text>
            </TouchableOpacity>
          ) : null}
          {raPick ? (
            <View style={styles.raPick}>
              <Text style={styles.sub}>{t('ptw.copyLib')}</Text>
              {risks.filter((r) => r.generic).map((r) => (
                <TouchableOpacity key={r.id} style={styles.raOpt} onPress={() => void attachCopy(r.id)}>
                  <Text style={styles.link}>{`+ ${r.title}`}</Text>
                </TouchableOpacity>
              ))}
              {risks.filter((r) => !r.generic).length ? <Text style={[styles.sub, { marginTop: SIZES.sm }]}>{t('ptw.orAttach')}</Text> : null}
              {risks.filter((r) => !r.generic).map((r) => (
                <TouchableOpacity key={r.id} style={styles.raOpt} onPress={() => { set({ raId: r.id }); setRaPick(false); }}>
                  <Text style={styles.link}>{r.title}</Text>
                </TouchableOpacity>
              ))}
              {!risks.length ? <Text style={styles.sub}>{t('ptw.noRa')}</Text> : null}
            </View>
          ) : null}

          <Text style={styles.section}>{t('ptw.isolations')}</Text>
          <TextInput style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]} value={p.notes ?? ''} onChangeText={(v) => set({ notes: v })} editable={!final} multiline placeholder={t('ptw.isolationsPh')} placeholderTextColor={COLORS.textLight} />

          <Text style={styles.section}>{t('ptw.toolbox')}</Text>
          {p.toolbox && !tb.open ? (
            <View style={styles.tbBox}>
              <Text style={styles.tbLine}>{`${uiDateTime(p.toolbox.at)} · ${t('ptw.heldBy', { name: p.toolbox.byRank ? `${p.toolbox.by} (${p.toolbox.byRank})` : p.toolbox.by })}${p.toolbox.signedWith ? ` · ${proofShort(p.toolbox.signedWith)}` : ''}`}</Text>
              <Text style={styles.tbLine}>{`${t('ptw.place')}: ${p.toolbox.location}`}</Text>
              <Text style={styles.tbLine}>{`${t('ptw.job')}: ${p.toolbox.work}`}</Text>
              <Text style={styles.tbLine}>{`${t('ptw.present')}: ${p.toolbox.attendees.filter((a) => a.present).map((a) => a.name).join(', ') || '—'}`}</Text>
              {p.toolbox.attendees.some((a) => !a.present) ? <Text style={[styles.tbLine, { color: COLORS.danger }]}>{`${t('ptw.absent')}: ${p.toolbox.attendees.filter((a) => !a.present).map((a) => a.name).join(', ')}`}</Text> : null}
              <Text style={styles.tbLine}>{`${t('ptw.covered')}: ${TOOLBOX_TOPICS.filter((t) => p.toolbox!.topics.includes(t.id)).map(toolboxText).join('; ') || '—'}`}</Text>
              {p.toolbox.concerns ? <Text style={styles.tbLine}>{`${t('ptw.raised')}: ${p.toolbox.concerns}`}</Text> : null}
              {startBlockers(p).length && !final && p.status !== 'active' ? <Text style={[styles.tbLine, { color: COLORS.warning, fontWeight: '700' }]}>{startBlockers(p).join(' · ')}</Text> : null}
              {!final && p.status !== 'active' ? (
                <TouchableOpacity onPress={openToolbox}><Text style={styles.link}>{t('ptw.holdAgain')}</Text></TouchableOpacity>
              ) : null}
            </View>
          ) : !final && p.status !== 'active' ? (
            tb.open ? (
              <View style={styles.tbBox}>
                <Text style={styles.tbLine}>{`${t('ptw.place')}: ${p.location || '—'}`}</Text>
                <Text style={styles.tbLine}>{`${t('ptw.job')}: ${p.work || '—'}`}</Text>
                <Label>{t('ptw.presentTap')}</Label>
                <View style={styles.chips}>
                  {[...p.team, ...tb.extra.filter((n) => !p.team.includes(n))].map((n) => {
                    const on = tb.present.includes(n);
                    return (
                      <TouchableOpacity key={n} style={[styles.chip, on && styles.chipOn]} onPress={() => setTb({ ...tb, present: on ? tb.present.filter((x) => x !== n) : [...tb.present, n] })}>
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{`${on ? '✓ ' : ''}${n}${p.team.includes(n) ? '' : ` (${t('ptw.alsoPresentTag')})`}`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.sub}>{t('ptw.alsoPresent')}</Text>
                <View style={styles.chips}>
                  {people.filter((c) => !p.team.includes(c.name) && !tb.extra.includes(c.name)).map((c) => (
                    <TouchableOpacity key={c.id} style={styles.chip} onPress={() => setTb({ ...tb, extra: [...tb.extra, c.name], present: [...tb.present, c.name] })}>
                      <Text style={styles.chipText}>{`+ ${c.name}`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Label>{t('ptw.covered')}</Label>
                {TOOLBOX_TOPICS.map((t) => {
                  const on = tb.topics.includes(t.id);
                  return (
                    <TouchableOpacity key={t.id} style={styles.tbTopic} onPress={() => setTb({ ...tb, topics: on ? tb.topics.filter((x) => x !== t.id) : [...tb.topics, t.id] })}>
                      <MciIcon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={on ? COLORS.success : COLORS.textLight} />
                      <Text style={styles.tbTopicText}>{toolboxText(t)}</Text>
                    </TouchableOpacity>
                  );
                })}
                {ra?.hazards.length ? (
                  <Text style={styles.sub}>{`${t('ptw.from', { ra: ra.no ?? t('ptw.theRa') })}: ${ra.hazards.map((h) => h.hazard).join(' · ')}`}</Text>
                ) : null}
                <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={tb.concerns} onChangeText={(v) => setTb({ ...tb, concerns: v })} multiline placeholder={t('ptw.concernsPh')} placeholderTextColor={COLORS.textLight} />
                <View style={styles.actions}>
                  <Action label={t('ptw.signToolbox')} onPress={() => void holdToolbox()} styles={styles} />
                  <Action label={t('common.cancel')} onPress={() => setTb({ ...tb, open: false })} styles={styles} outline />
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={openToolbox}>
                <Text style={styles.link}>{t('ptw.holdToolbox')}</Text>
                <Text style={styles.sub}>{t('ptw.toolboxHint')}</Text>
              </TouchableOpacity>
            )
          ) : (
            <Text style={styles.sub}>{t('ptw.noToolbox')}</Text>
          )}

          <Text style={styles.section}>{t('doc.signatures')}</Text>
          <Stamp label="requested" s={p.requested} />
          <Stamp label="approved" s={p.approved} />
          <Stamp label="started" s={p.started} />
          <Stamp label="closed" s={p.closed} />
          {p.closedAt ? <Text style={styles.stamp}>{t('ptw.closedAt', { when: p.closedAt.replace('T', ' ') })}</Text> : null}
          <Stamp label="cancelled" s={p.cancelled} />

          {!final ? (
            <>
              {picker ? (
                <>
                  <Label>{t('risk.signingAs')}</Label>
                  {picker}
                </>
              ) : null}
              {p.status === 'requested' && blockers.length ? (
                <View style={styles.blockers}>
                  <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('ptw.beforeApprove')}</Text>
                  {blockers.map((b) => <Text key={b} style={styles.sub}>{`• ${b}`}</Text>)}
                </View>
              ) : null}
              {p.status === 'approved' && startBlockers(p).length ? (
                <View style={styles.blockers}>
                  <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{t('ptw.beforeStart')}</Text>
                  {startBlockers(p).map((b) => <Text key={b} style={styles.sub}>{`• ${b}`}</Text>)}
                </View>
              ) : null}
              <View style={styles.actions}>
                {p.status === 'draft' ? <Action label={t('ptw.request')} onPress={() => void act('request')} styles={styles} /> : null}
                {p.status === 'requested' ? <Action label={t('risk.approve')} onPress={() => void act('approve')} styles={styles} dim={!!blockers.length || !officer} /> : null}
                {p.status === 'approved' ? <Action label={t('ptw.start')} onPress={() => void act('start')} styles={styles} dim={!!startBlockers(p).length} /> : null}
                {p.status === 'active' && closing == null ? <Action label={t('ptw.close')} onPress={() => setClosing(nowLocal())} styles={styles} /> : null}
                {p.status === 'active' && closing != null ? (
                  <View style={styles.blockers}>
                    <Label>{t('ptw.closedAtLabel')}</Label>
                    <TextInput style={styles.input} value={closing.replace('T', ' ')} onChangeText={(v) => setClosing(v.trim().replace(' ', 'T'))} />
                    {closeProblem(closing) ? <Text style={[styles.sub, { color: COLORS.danger }]}>{closeProblem(closing)}</Text> : null}
                    <Action label={t('ptw.signClose')} onPress={() => void act('close')} styles={styles} dim={!!closeProblem(closing)} />
                    <TouchableOpacity onPress={() => setClosing(null)}><Text style={styles.link}>{t('pa.notYet')}</Text></TouchableOpacity>
                  </View>
                ) : null}
                {p.status !== 'draft' ? <Action label={t('ptw.cancel')} onPress={() => void act('cancel')} styles={styles} outline /> : null}
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
    tbBox: { borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: SIZES.radiusMd, padding: SIZES.md, gap: 4 },
    tbLine: { fontSize: SIZES.small, color: COLORS.textDark },
    tbTopic: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 4 },
    tbTopicText: { flex: 1, fontSize: SIZES.small, color: COLORS.textDark },
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
