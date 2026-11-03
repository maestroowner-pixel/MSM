// ===================================
// One crew appraisal (types/appraisal.ts, plan item 40) — new (`id: 'new'`,
// with `crewId` and `reason` when opened from a due line) or an existing one.
//
// The appraiser writes it while it is a draft — person, reason, period, a score
// per criterion, strengths, what to improve, training, re-hire, promotion — and
// signs it; from then on it does not change. The person appraised reads it on
// the same device and signs, agreeing or not, with a comment (their own PIN or
// a signature by hand), or the appraiser records that they would not sign. The
// Master countersigns, unless the Master was the appraiser. Officers and the
// Master only.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { Dropdown } from '../components/Dropdown';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { APPRAISAL_REASONS, AppraisalReason, AppraisalStepKind, CrewAppraisal, REHIRES, Score } from '../types/appraisal';
import { crewLabel, isAboard, liveCrew } from '../types/crew';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { apEditable, apStage, AppraisalStage, average, criteriaFor, isMasterRank, nextSteps, periodStart, signProblem, withStep } from '../services/appraisals';
import { exportAppraisalPdf } from '../services/appraisalReport';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

export const apStageColor = (COLORS: any, st: AppraisalStage): string =>
  ({ draft: COLORS.textLight, crew: COLORS.warning, master: COLORS.warning, done: COLORS.success, cancelled: COLORS.textLight } as Record<AppraisalStage, string>)[st];

const SCORES: Score[] = [1, 2, 3, 4, 5];

export default function AppraisalSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, appraisals, vessel, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();

  // Once saved, the screen shows the stored record by its id (kept here, not in the route — see NcSc).
  const [savedId, setSavedId] = useState<string | null>(null);
  const isNew = route.params?.id === 'new' && !savedId;
  const stored = appraisals.find((a) => a.id === (savedId ?? route.params?.id));
  const people = useMemo(() => liveCrew(crew).filter((c) => isAboard(c) || c.id === stored?.crewId), [crew, stored?.crewId]);
  const [draft, setDraft] = useState<CrewAppraisal | null>(() => {
    if (!isNew) return null;
    const c = crew.find((x) => x.id === route.params?.crewId);
    const reason: AppraisalReason = APPRAISAL_REASONS.includes(route.params?.reason) ? route.params.reason : 'annual';
    return {
      id: uid('ap'), crewId: c?.id ?? '', name: c?.name ?? '', ...(c?.rank ? { rank: c.rank } : {}), reason,
      from: periodStart(c, appraisals, today), to: reason === 'contract' && c?.contractEnd && c.contractEnd < today ? c.contractEnd : today,
      scores: [], steps: [], by: '', at: Date.now(), updatedAt: Date.now(),
    };
  });
  // The person's own answer and comment, before they sign.
  const [answer, setAnswer] = useState<{ agree?: boolean; note: string }>({ note: '' });
  // A step that takes a reason or a remark: refused, cancel, the countersignature.
  const [asking, setAsking] = useState<{ kind: AppraisalStepKind; note: string } | null>(null);

  // A draft is edited in place: the stored one, or the new one.
  const a = draft ?? stored;
  if (!a) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Appraisals')} />
        <Text style={styles.sub}>{t('ap.notHere')}</Text>
      </Screen>
    );
  }
  if (!canEdit) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Crew')} />
        <Text style={styles.sub}>{t('ap.officersOnly')}</Text>
      </Screen>
    );
  }
  const st = apStage(a);
  const editing = apEditable(a);
  const stColor = apStageColor(COLORS, st);
  const set = (p: Partial<CrewAppraisal>) => setDraft({ ...a, ...p });
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
  const me = () => (signer ? { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}) } : null);
  const criteria = criteriaFor(a.rank, a);
  const avg = average(a);
  const period = `${uiDate(a.from)} – ${uiDate(a.to)}`;

  // Firestore refuses undefined.
  const write = async (next: CrewAppraisal) => {
    await saveRow(storage.APPRAISALS_KEY, JSON.parse(JSON.stringify({ ...next, updatedAt: Date.now() })));
  };

  const pickPerson = (id: string) => {
    const c = crew.find((x) => x.id === id);
    if (!c) return set({ crewId: '', name: '' });
    set({ crewId: c.id, name: c.name, rank: c.rank, from: periodStart(c, appraisals, today) });
  };

  const setScore = (id: string, score: Score | undefined) => {
    const rest = a.scores.filter((s) => s.id !== id);
    const cur = a.scores.find((s) => s.id === id);
    set({ scores: [...rest, { ...(cur ?? { id }), id, score }].filter((s) => s.score || s.note) });
  };
  const setNote = (id: string, note: string) => {
    const rest = a.scores.filter((s) => s.id !== id);
    const cur = a.scores.find((s) => s.id === id);
    set({ scores: [...rest, { ...(cur ?? { id }), note }].filter((s) => s.score || s.note) });
  };

  /** Save the draft; with `sign`, the appraiser signs it too. */
  const save = async (sign: boolean) => {
    if (!a.crewId) return Alert.alert(t('ap.one'), t('ap.needPerson'));
    let out: CrewAppraisal = { ...a, strengths: a.strengths?.trim() || undefined, improve: a.improve?.trim() || undefined, training: a.training?.trim() || undefined, reasonNote: a.reason === 'other' ? a.reasonNote?.trim() || undefined : undefined };
    const s = me();
    if (!out.by) {
      if (!s) return Alert.alert(t('ap.appraiser'), t('round.chooseName'));
      out = { ...out, by: s.name, ...(s.rank ? { byRank: s.rank } : {}), at: Date.now() };
    }
    if (sign) {
      const why = signProblem(out);
      if (why) return Alert.alert(t('ap.signAppraiser'), tk(`ap.need.${why}`));
      if (!s) return Alert.alert(t('ap.appraiser'), t('round.chooseName'));
      if (signer!.key === out.crewId) return Alert.alert(t('ap.signAppraiser'), t('ap.notSelf'));
      const sig = await confirmSign({ personKey: signer!.key, name: signer!.name, ownDevice: signer!.own, what: `${t('ap.one')} — ${out.name}, ${period}`, always: true });
      if (!sig) return;
      const asMaster = sync.enrolled ? sync.role === 'superadmin' : isMasterRank(signer!.rank);
      out = withStep(out, 'appraiser', s, Date.now(), { asMaster, signedWith: sig.proof });
    }
    await write(out);
    playSuccessSound();
    if (isNew) setSavedId(out.id);
    setDraft(null);
  };

  /** The person appraised signs — their own PIN or by hand, on this device. */
  const crewSigns = async () => {
    if (typeof answer.agree !== 'boolean') return Alert.alert(t('ap.crewSign'), t('ap.needAgree'));
    const sig = await confirmSign({ personKey: a.crewId, name: a.name, ownDevice: false, what: `${t('ap.one')} ${period} — ${answer.agree ? t('ap.agree') : t('ap.disagree')}`, always: true });
    if (!sig) return;
    await write(withStep(a, 'crew', { name: a.name, rank: a.rank }, Date.now(), { agree: answer.agree, note: answer.note, signedWith: sig.proof }));
    setAnswer({ note: '' });
    playSuccessSound();
  };

  const step = async (kind: AppraisalStepKind, note: string) => {
    const s = me();
    if (!s) return Alert.alert(t('sign.who'), t('round.chooseName'));
    if ((kind === 'refused' || kind === 'cancel') && note.trim().length < 3) return Alert.alert(tk(`ap.step.${kind}`), t('moc.needReason'));
    let proof;
    if (kind === 'master') {
      // On a device on no vessel the name is picked: only the Master countersigns.
      if (!sync.enrolled && !isMasterRank(signer!.rank)) return Alert.alert(t('ap.countersign'), t('ap.masterOnly'));
      const sig = await confirmSign({ personKey: signer!.key, name: signer!.name, ownDevice: signer!.own, what: `${t('ap.one')} — ${a.name}, ${period} — ${t('ap.step.master')}`, always: true });
      if (!sig) return;
      proof = sig.proof;
    }
    const base = stored ?? a;
    if (kind === 'cancel' && !stored) return goBackOr(nav, 'Appraisals');
    await write(withStep(base, kind, s, Date.now(), { note, signedWith: proof }));
    setAsking(null);
    setDraft(null);
    playSuccessSound();
  };

  const pdf = () => void exportAppraisalPdf(a, vessel).catch((e) => Alert.alert('PDF', String(e?.message ?? e)));
  const may = nextSteps(st);
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Appraisals')} />
      <ScreenTitle
        title={a.name ? `${t('ap.one')} · ${a.name}` : t('ap.new')}
        subtitle={[tk(`ap.st.${st}`), a.rank, tk(`ap.reason.${a.reason}`), period].filter(Boolean).join(' · ')}
        help="Crew appraisals"
      />

      {editing ? (
        <Card>
          {!stored ? (
            <Dropdown caption={t('ap.person')} value={a.crewId} onChange={pickPerson} options={[{ value: '', label: t('common.choose') }, ...people.map((c) => ({ value: c.id, label: crewLabel(c) }))]} />
          ) : null}
          <Label>{t('ap.reason')}</Label>
          <View style={styles.chips}>{APPRAISAL_REASONS.map((r) => chip(a.reason === r, tk(`ap.reason.${r}`), () => set({ reason: r }), r))}</View>
          {a.reason === 'other' ? <TextInput style={styles.input} value={a.reasonNote ?? ''} onChangeText={(v) => set({ reasonNote: v })} placeholder={t('ap.reasonPh')} placeholderTextColor={COLORS.textLight} /> : null}
          <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
            <View style={{ flex: 1 }}><SimpleDatePicker label={t('ap.from')} value={a.from} onChange={(v) => set({ from: v })} /></View>
            <View style={{ flex: 1 }}><SimpleDatePicker label={t('ap.to')} value={a.to} onChange={(v) => set({ to: v })} /></View>
          </View>

          <Label>{t('ap.scores')}</Label>
          <Text style={styles.sub}>{t('ap.scale')}</Text>
          {criteria.map((c) => {
            const s = a.scores.find((x) => x.id === c.id);
            return (
              <View key={c.id} style={{ marginTop: SIZES.sm }}>
                <Text style={styles.name}>{tk(`ap.crit.${c.id}`)}</Text>
                <View style={styles.chips}>
                  {SCORES.map((n) => chip(s?.score === n, String(n), () => setScore(c.id, n), `${c.id}${n}`))}
                  {chip(!s?.score, t('ap.na'), () => setScore(c.id, undefined), `${c.id}na`)}
                </View>
                <TextInput style={styles.input} value={s?.note ?? ''} onChangeText={(v) => setNote(c.id, v)} placeholder={t('ap.notePh')} placeholderTextColor={COLORS.textLight} />
              </View>
            );
          })}
          <Text style={[styles.sub, { fontWeight: '700', marginTop: SIZES.sm }]}>{avg != null ? t('ap.avg', { n: avg.toFixed(1) }) : t('ap.noScores')}</Text>

          <Label>{t('ap.strengths')}</Label>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={a.strengths ?? ''} onChangeText={(v) => set({ strengths: v })} multiline placeholder={t('ap.strengthsPh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('ap.improve')}</Label>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={a.improve ?? ''} onChangeText={(v) => set({ improve: v })} multiline placeholder={t('ap.improvePh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('ap.training')}</Label>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={a.training ?? ''} onChangeText={(v) => set({ training: v })} multiline placeholder={t('ap.trainingPh')} placeholderTextColor={COLORS.textLight} />

          <Label>{t('ap.rehire')}</Label>
          <View style={styles.chips}>{REHIRES.map((r) => chip(a.rehire === r, tk(`ap.rehire.${r}`), () => set({ rehire: r }), r))}</View>
          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { flex: 1 }]}>{t('ap.promote')}</Text>
            <Switch value={!!a.promote} onValueChange={(v) => set({ promote: v || undefined })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>

          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save(true)}><Text style={styles.btnText}>{t('ap.signAppraiser')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => void save(false)}><Text style={styles.link}>{t('ap.saveDraft')}</Text></TouchableOpacity>
            {stored ? <TouchableOpacity onPress={() => setAsking({ kind: 'cancel', note: '' })}><Text style={[styles.link, { color: COLORS.danger }]}>{t('ap.step.cancel')}</Text></TouchableOpacity> : null}
          </View>
          <Text style={styles.sub}>{t('ap.signHint')}</Text>
        </Card>
      ) : (
        <View style={[styles.item, { borderLeftColor: stColor }]}>
          <Text style={[styles.sub, { color: stColor, fontWeight: '700' }]}>
            {[tk(`ap.st.${st}`), avg != null ? t('ap.avg', { n: avg.toFixed(1) }) : null, a.rehire ? `${t('ap.rehire')}: ${tk(`ap.rehire.${a.rehire}`)}` : null, a.promote ? t('ap.promoteShort') : null].filter(Boolean).join(' · ')}
          </Text>
          {a.reasonNote ? <Text style={styles.sub}>{a.reasonNote}</Text> : null}
          {criteria.map((c) => {
            const s = a.scores.find((x) => x.id === c.id);
            return <Text key={c.id} style={styles.body}>{`${tk(`ap.crit.${c.id}`)}: ${s?.score ? `${s.score} — ${tk(`ap.score.${s.score}`)}` : t('ap.na')}${s?.note ? ` · ${s.note}` : ''}`}</Text>;
          })}
          {a.strengths ? <Text style={styles.sub}>{`${t('ap.strengths')}: ${a.strengths}`}</Text> : null}
          {a.improve ? <Text style={styles.sub}>{`${t('ap.improve')}: ${a.improve}`}</Text> : null}
          {a.training ? <Text style={styles.sub}>{`${t('ap.training')}: ${a.training}`}</Text> : null}
          <TouchableOpacity onPress={pdf}><Text style={styles.link}>PDF</Text></TouchableOpacity>
        </View>
      )}

      {a.steps.length ? (
        <>
          <Label>{t('ap.signatures')}</Label>
          {a.steps.map((s, i) => (
            <Text key={i} style={styles.sub}>{`${uiDateTime(s.at)} · ${tk(`ap.step.${s.kind}`)} · ${who(s.by, s.byRank)}${s.signedWith ? ` · ${proofShort(s.signedWith)}` : ''}${s.kind === 'crew' ? ` · ${s.agree ? t('ap.agree') : t('ap.disagree')}` : ''}${s.note ? ` — ${s.note}` : ''}`}</Text>
          ))}
        </>
      ) : null}

      {asking ? (
        <Card>
          <Label>{asking.kind === 'master' ? t('ap.countersign') : tk(`ap.step.${asking.kind}`)}</Label>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={asking.note} onChangeText={(v) => setAsking({ ...asking, note: v })} multiline placeholder={asking.kind === 'master' ? t('ap.masterPh') : asking.kind === 'refused' ? t('ap.refusedPh') : t('moc.reasonPh')} placeholderTextColor={COLORS.textLight} />
          {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void step(asking.kind, asking.note)}><Text style={styles.btnText}>{asking.kind === 'master' ? t('ap.countersign') : tk(`ap.step.${asking.kind}`)}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAsking(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : st === 'crew' ? (
        <Card>
          <Label>{t('ap.crewSignFor', { name: a.name })}</Label>
          <Text style={styles.sub}>{t('ap.crewHint')}</Text>
          <View style={styles.chips}>
            {chip(answer.agree === true, t('ap.agree'), () => setAnswer({ ...answer, agree: true }), 'y')}
            {chip(answer.agree === false, t('ap.disagree'), () => setAnswer({ ...answer, agree: false }), 'n')}
          </View>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={answer.note} onChangeText={(v) => setAnswer({ ...answer, note: v })} multiline placeholder={t('ap.crewNotePh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void crewSigns()}><Text style={styles.btnText}>{t('ap.crewSign')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAsking({ kind: 'refused', note: '' })}><Text style={styles.link}>{`${t('ap.step.refused')}…`}</Text></TouchableOpacity>
            {may.includes('cancel') ? <TouchableOpacity onPress={() => setAsking({ kind: 'cancel', note: '' })}><Text style={[styles.link, { color: COLORS.danger }]}>{t('ap.step.cancel')}</Text></TouchableOpacity> : null}
          </View>
        </Card>
      ) : st === 'master' ? (
        isMaster ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => setAsking({ kind: 'master', note: '' })}><Text style={styles.btnText}>{t('ap.countersign')}</Text></TouchableOpacity>
          </View>
        ) : (
          <Text style={[styles.sub, { marginTop: SIZES.md }]}>{t('ap.atMaster')}</Text>
        )
      ) : null}
    </Screen>
  );
}
