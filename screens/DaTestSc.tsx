// ===================================
// One drug and alcohol test (types/daTest.ts, plan item 42) — new
// (`id: 'new'`) or recorded.
//
// New: why, when, which tests (breath alcohol, drug screen), the breathalyser
// and the kit, who carried it out and the witness; the people — everyone
// aboard, chosen, or n drawn at random — and each one's reading (a second,
// confirming reading is asked when the first is above the limit), screen, or
// refusal with the reason. One signature writes the test and every result;
// from then on nothing changes.
//
// Recorded: the results; for a non-negative screen the laboratory's result is
// added later, and for a positive or a refusal what was done — each signed,
// each a record of its own. Officers and the Master only. A result's name
// goes to the cloud masked: another officer's device shows "J…d".
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { DA_REASONS, DaFollowUp, DaReason, DaResult, DaTest, DrugScreen } from '../types/daTest';
import { isAboard, liveCrew } from '../types/crew';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { nextNo } from '../services/hospital';
import { proofShort } from '../services/signature';
import { actionsOf, DaOutcome, drawRandom, labOf, mgl, outcome, parseReading, policyOf, resultProblem, testProblem, wantsConfirm } from '../services/daTests';
import { exportDaTestPdf } from '../services/daTestReport';
import { shipHm, shipToday } from '../utils/shipTime';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

export const daOutcomeColor = (COLORS: any, o: DaOutcome): string =>
  ({ negative: COLORS.success, pending: COLORS.warning, positive: COLORS.danger, refused: COLORS.danger } as Record<DaOutcome, string>)[o];

/** One person's line while the test is being recorded — readings as typed. */
interface Line {
  crewId: string;
  name: string;
  rank?: string;
  alcohol: string;
  confirm: string;
  drugs?: DrugScreen;
  sample: string;
  /** null = tested; a string = refused, with the reason. */
  refused: string | null;
}

const lineOf = (c: { id: string; name: string; rank?: string }): Line => ({ crewId: c.id, name: c.name, ...(c.rank ? { rank: c.rank } : {}), alcohol: '', confirm: '', sample: '', refused: null });

export default function DaTestSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { crew, vessel, daTests, daResults, daFollowUps, daPolicy, appendRow, saveRows } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const policy = policyOf(daPolicy);

  const [savedId, setSavedId] = useState<string | null>(null);
  const isNew = route.params?.id === 'new' && !savedId;
  const stored = daTests.find((x) => x.id === (savedId ?? route.params?.id));
  const aboard = useMemo(() => liveCrew(crew).filter(isAboard), [crew]);

  const [draft, setDraft] = useState<DaTest>(() => ({
    id: uid('da'), no: '', date: shipToday(), time: shipHm(), reason: 'unannounced', alcohol: true, drugs: false,
    limit: policy.limit, tester: '', count: 0, by: '', at: 0, updatedAt: 0,
  }));
  const [lines, setLines] = useState<Line[]>([]);
  const [drawN, setDrawN] = useState('');
  // A laboratory result or an action being written for one result.
  const [follow, setFollow] = useState<{ resultId: string; kind: 'lab' | 'action'; lab?: 'neg' | 'pos'; ref: string; note: string } | null>(null);

  if (!canEdit) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'Crew')} />
        <Text style={styles.sub}>{t('da.officersOnly')}</Text>
      </Screen>
    );
  }
  if (!isNew && !stored) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'DaTests')} />
        <Text style={styles.sub}>{t('da.notHere')}</Text>
      </Screen>
    );
  }

  const me = () => (signer ? { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}) } : null);
  const set = (p: Partial<DaTest>) => setDraft({ ...draft, ...p });
  const setLine = (crewId: string, p: Partial<Line>) => setLines(lines.map((l) => (l.crewId === crewId ? { ...l, ...p } : l)));
  const chip = (on: boolean, label: string, onPress: () => void, key: string) => (
    <TouchableOpacity key={key} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  // ---- recording a new test ----
  if (isNew) {
    const chosen = new Set(lines.map((l) => l.crewId));
    const toggle = (c: (typeof aboard)[number]) => {
      setLines(chosen.has(c.id) ? lines.filter((l) => l.crewId !== c.id) : [...lines, lineOf(c)]);
      if (draft.drawn) set({ drawn: undefined });
    };
    const all = () => { setLines(aboard.map(lineOf)); set({ drawn: undefined }); };
    const draw = () => {
      const n = Number(drawN);
      if (!Number.isInteger(n) || n < 1 || n > aboard.length) return Alert.alert(t('da.draw'), t('da.drawBad', { n: aboard.length }));
      setLines(drawRandom(aboard, n).map(lineOf));
      set({ reason: 'random', drawn: { n, of: aboard.length } });
    };
    const resultOf = (l: Line, testId: string, at: number): DaResult => {
      const r: DaResult = { id: uid('dar'), testId, crewId: l.crewId, name: l.name, ...(l.rank ? { rank: l.rank } : {}), at, updatedAt: at };
      if (l.refused != null) return { ...r, refused: l.refused.trim() };
      const a = parseReading(l.alcohol), c = parseReading(l.confirm);
      return {
        ...r,
        ...(draft.alcohol && a !== undefined ? { alcohol: a } : {}),
        ...(draft.alcohol && c !== undefined ? { confirm: c } : {}),
        ...(draft.drugs && l.drugs ? { drugs: l.drugs } : {}),
        ...(draft.drugs && l.drugs === 'nonNeg' && l.sample.trim() ? { sample: l.sample.trim() } : {}),
      };
    };

    const sign = async () => {
      const s = me();
      if (!s) return Alert.alert(t('da.sign'), t('round.chooseName'));
      const at = Date.now();
      const results = lines.map((l) => resultOf(l, draft.id, at));
      const tp = testProblem(draft, results);
      if (tp) return Alert.alert(t('da.sign'), tk(`da.need.${tp}`));
      for (const r of results) {
        const why = resultProblem(draft, r);
        if (why) return Alert.alert(t('da.sign'), `${r.name}: ${tk(`da.needR.${why}`)}`);
      }
      const unconfirmed = draft.alcohol ? results.filter((r) => wantsConfirm(r, draft.limit)) : [];
      if (unconfirmed.length) {
        const go = await new Promise<boolean>((res) =>
          Alert.alert(t('da.confirmTitle'), t('da.confirmAsk', { names: unconfirmed.map((r) => r.name).join(', ') }), [
            { text: t('common.cancel'), style: 'cancel', onPress: () => res(false) },
            { text: t('da.signAnyway'), onPress: () => res(true) },
          ]),
        );
        if (!go) return;
      }
      const sig = await confirmSign({ personKey: signer!.key, name: signer!.name, ownDevice: signer!.own, what: `${t('da.one')} ${uiDate(draft.date)} — ${t('da.peopleN', { n: results.length })}`, always: true });
      if (!sig) return;
      const test: DaTest = {
        ...draft, no: nextNo('DA', daTests, draft.date), ref: draft.ref?.trim() || undefined, device: draft.alcohol ? draft.device?.trim() || undefined : undefined,
        kit: draft.drugs ? draft.kit?.trim() || undefined : undefined, tester: draft.tester.trim(), witness: draft.witness?.trim() || undefined,
        limit: draft.limit, count: results.length, by: s.name, ...(s.rank ? { byRank: s.rank } : {}), at, signedWith: sig.proof, updatedAt: at,
      };
      // Results first: a test whose people never arrived would read as a test of nobody.
      await saveRows(storage.DA_RESULTS_KEY, results.map((r) => JSON.parse(JSON.stringify(r))));
      await appendRow(storage.DA_TESTS_KEY, JSON.parse(JSON.stringify(test)));
      playSuccessSound();
      setSavedId(test.id);
    };

    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'DaTests')} />
        <ScreenTitle title={t('da.new')} subtitle={t('da.newSub')} help="Drug and alcohol tests" />
        <Card>
          <Label>{t('da.reason')}</Label>
          <View style={styles.chips}>{DA_REASONS.map((r: DaReason) => chip(draft.reason === r, tk(`da.reason.${r}`), () => set({ reason: r }), r))}</View>
          {draft.reason !== 'unannounced' && draft.reason !== 'random' ? (
            <TextInput style={styles.input} value={draft.ref ?? ''} onChangeText={(v) => set({ ref: v })} placeholder={t('da.refPh')} placeholderTextColor={COLORS.textLight} />
          ) : null}
          <View style={{ flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm }}>
            <View style={{ flex: 1 }}><SimpleDatePicker label={t('da.date')} value={draft.date} onChange={(v) => set({ date: v })} /></View>
            <View style={{ width: 90 }}>
              <Label>{t('da.time')}</Label>
              <TextInput style={styles.input} value={draft.time ?? ''} onChangeText={(v) => set({ time: v })} placeholder="hh:mm" placeholderTextColor={COLORS.textLight} />
            </View>
          </View>

          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { flex: 1 }]}>{t('da.alcoholTest')}</Text>
            <Switch value={draft.alcohol} onValueChange={(v) => set({ alcohol: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {draft.alcohol ? (
            <>
              <TextInput style={styles.input} value={draft.device ?? ''} onChangeText={(v) => set({ device: v })} placeholder={t('da.devicePh')} placeholderTextColor={COLORS.textLight} />
              <Text style={styles.sub}>{t('da.limitIs', { limit: mgl(draft.limit) })}</Text>
            </>
          ) : null}
          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { flex: 1 }]}>{t('da.drugTest')}</Text>
            <Switch value={draft.drugs} onValueChange={(v) => set({ drugs: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {draft.drugs ? <TextInput style={styles.input} value={draft.kit ?? ''} onChangeText={(v) => set({ kit: v })} placeholder={t('da.kitPh')} placeholderTextColor={COLORS.textLight} /> : null}

          <Label>{t('da.tester')}</Label>
          <TextInput style={styles.input} value={draft.tester} onChangeText={(v) => set({ tester: v })} placeholder={t('da.testerPh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { flex: 1 }]}>{t('da.external')}</Text>
            <Switch value={!!draft.external} onValueChange={(v) => set({ external: v || undefined })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          <TextInput style={styles.input} value={draft.witness ?? ''} onChangeText={(v) => set({ witness: v })} placeholder={t('da.witnessPh')} placeholderTextColor={COLORS.textLight} />
        </Card>

        <Label>{t('da.people')}</Label>
        <View style={styles.row}>
          <TouchableOpacity onPress={all}><Text style={styles.link}>{t('da.allAboard', { n: aboard.length })}</Text></TouchableOpacity>
          <TextInput style={[styles.input, { width: 60 }]} value={drawN} onChangeText={setDrawN} keyboardType="number-pad" placeholder="n" placeholderTextColor={COLORS.textLight} />
          <TouchableOpacity onPress={draw}><Text style={styles.link}>{t('da.draw')}</Text></TouchableOpacity>
        </View>
        {draft.drawn ? <Text style={styles.sub}>{t('da.drawn', { n: draft.drawn.n, of: draft.drawn.of })}</Text> : null}
        <View style={styles.chips}>{aboard.map((c) => chip(chosen.has(c.id), c.rank ? `${c.name} · ${c.rank}` : c.name, () => toggle(c), c.id))}</View>

        {lines.map((l) => {
          const a = parseReading(l.alcohol);
          const over = draft.alcohol && a != null && a > draft.limit;
          return (
            <Card key={l.crewId}>
              <Text style={styles.name}>{l.rank ? `${l.name} · ${l.rank}` : l.name}</Text>
              {l.refused == null ? (
                <>
                  {draft.alcohol ? (
                    <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'center' }}>
                      <TextInput style={[styles.input, { flex: 1 }, over ? { borderColor: COLORS.danger } : null]} value={l.alcohol} onChangeText={(v) => setLine(l.crewId, { alcohol: v })} keyboardType="decimal-pad" placeholder={t('da.readingPh')} placeholderTextColor={COLORS.textLight} />
                      {over ? <TextInput style={[styles.input, { flex: 1 }]} value={l.confirm} onChangeText={(v) => setLine(l.crewId, { confirm: v })} keyboardType="decimal-pad" placeholder={t('da.confirmPh')} placeholderTextColor={COLORS.textLight} /> : null}
                    </View>
                  ) : null}
                  {over ? <Text style={[styles.sub, { color: COLORS.danger }]}>{t('da.overHint')}</Text> : null}
                  {draft.drugs ? (
                    <View style={styles.chips}>
                      {chip(l.drugs === 'neg', t('da.screen.neg'), () => setLine(l.crewId, { drugs: 'neg' }), 'n')}
                      {chip(l.drugs === 'nonNeg', t('da.screen.nonNeg'), () => setLine(l.crewId, { drugs: 'nonNeg' }), 'p')}
                    </View>
                  ) : null}
                  {draft.drugs && l.drugs === 'nonNeg' ? <TextInput style={styles.input} value={l.sample} onChangeText={(v) => setLine(l.crewId, { sample: v })} placeholder={t('da.samplePh')} placeholderTextColor={COLORS.textLight} /> : null}
                  <TouchableOpacity onPress={() => setLine(l.crewId, { refused: '' })}><Text style={[styles.link, { color: COLORS.danger }]}>{`${t('da.refused')}…`}</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  <TextInput style={styles.input} value={l.refused} onChangeText={(v) => setLine(l.crewId, { refused: v })} placeholder={t('da.refusedPh')} placeholderTextColor={COLORS.textLight} />
                  <TouchableOpacity onPress={() => setLine(l.crewId, { refused: null })}><Text style={styles.link}>{t('da.notRefused')}</Text></TouchableOpacity>
                </>
              )}
            </Card>
          );
        })}

        {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => void sign()}><Text style={styles.btnText}>{t('da.sign')}</Text></TouchableOpacity>
        </View>
        <Text style={styles.sub}>{t('da.signHint')}</Text>
      </Screen>
    );
  }

  // ---- a recorded test ----
  const x = stored!;
  const mine = daResults.filter((r) => r.testId === x.id).sort((a, b) => a.name.localeCompare(b.name));

  const writeFollow = async () => {
    if (!follow) return;
    const s = me();
    if (!s) return Alert.alert(t('sign.who'), t('round.chooseName'));
    if (follow.kind === 'lab' && !follow.lab) return Alert.alert(t('da.labResult'), t('da.needLab'));
    if (follow.kind === 'action' && follow.note.trim().length < 3) return Alert.alert(t('da.action'), t('da.needAction'));
    const r = mine.find((m) => m.id === follow.resultId)!;
    const sig = await confirmSign({ personKey: signer!.key, name: signer!.name, ownDevice: signer!.own, what: `${x.no} — ${r.name} — ${follow.kind === 'lab' ? t('da.labResult') : t('da.action')}`, always: true });
    if (!sig) return;
    const at = Date.now();
    const f: DaFollowUp = {
      id: uid('daf'), testId: x.id, resultId: r.id, kind: follow.kind,
      ...(follow.kind === 'lab' ? { lab: follow.lab } : {}), ...(follow.ref.trim() ? { ref: follow.ref.trim() } : {}), ...(follow.note.trim() ? { note: follow.note.trim() } : {}),
      by: s.name, ...(s.rank ? { byRank: s.rank } : {}), at, signedWith: sig.proof, updatedAt: at,
    };
    await appendRow(storage.DA_FOLLOWUPS_KEY, JSON.parse(JSON.stringify(f)));
    setFollow(null);
    playSuccessSound();
  };
  const pdf = () => void exportDaTestPdf(x, daResults, daFollowUps, vessel).catch((e) => Alert.alert('PDF', String(e?.message ?? e)));

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'DaTests')} />
      <ScreenTitle title={`${t('da.one')} ${x.no}`} subtitle={[uiDate(x.date), x.time, tk(`da.reason.${x.reason}`)].filter(Boolean).join(' · ')} help="Drug and alcohol tests" />
      <View style={[styles.item, { borderLeftColor: COLORS.primary }]}>
        {x.ref ? <Text style={styles.body}>{x.ref}</Text> : null}
        {x.drawn ? <Text style={styles.sub}>{t('da.drawn', { n: x.drawn.n, of: x.drawn.of })}</Text> : null}
        <Text style={styles.sub}>{[x.alcohol ? `${t('da.alcohol')} (${t('da.limitIs', { limit: mgl(x.limit) })})` : null, x.drugs ? t('da.drugs') : null].filter(Boolean).join(' · ')}</Text>
        {x.device ? <Text style={styles.sub}>{`${t('da.device')}: ${x.device}`}</Text> : null}
        {x.kit ? <Text style={styles.sub}>{`${t('da.kit')}: ${x.kit}`}</Text> : null}
        <Text style={styles.sub}>{`${t('da.tester')}: ${x.tester}${x.external ? ` (${t('da.externalShort')})` : ''}${x.witness ? ` · ${t('da.witness')}: ${x.witness}` : ''}`}</Text>
        <Text style={styles.sub}>{`${uiDateTime(x.at)} · ${x.byRank ? `${x.by} (${x.byRank})` : x.by}${x.signedWith ? ` · ${proofShort(x.signedWith)}` : ''}`}</Text>
        <TouchableOpacity onPress={pdf}><Text style={styles.link}>PDF</Text></TouchableOpacity>
      </View>

      <Label>{t('da.results', { n: mine.length })}</Label>
      {mine.length < x.count ? <Text style={styles.sub}>{t('da.missing', { n: x.count - mine.length })}</Text> : null}
      {mine.map((r) => {
        const o = outcome(r, x.limit, daFollowUps);
        const c = daOutcomeColor(COLORS, o);
        const lab = labOf(r, daFollowUps);
        const acts = actionsOf(r, daFollowUps);
        const bits = r.refused
          ? [`${t('da.refused')}: ${r.refused}`]
          : [
              x.alcohol && r.alcohol != null ? `${t('da.alcohol')} ${mgl(r.alcohol)}${r.confirm != null ? ` / ${mgl(r.confirm)}` : ''} mg/l` : null,
              x.drugs && r.drugs ? `${t('da.drugs')}: ${t(`da.screen.${r.drugs}`)}${r.sample ? ` (${r.sample})` : ''}` : null,
              lab ? `${t('da.lab')}: ${t(lab.lab === 'pos' ? 'da.lab.pos' : 'da.lab.neg')}${lab.ref ? ` (${lab.ref})` : ''}` : null,
            ];
        return (
          <View key={r.id} style={[styles.item, { borderLeftColor: c }]}>
            <Text style={styles.name}>{r.rank ? `${r.name} · ${r.rank}` : r.name}</Text>
            <Text style={[styles.sub, { color: c, fontWeight: '700' }]}>{tk(`da.out.${o}`)}</Text>
            <Text style={styles.sub}>{bits.filter(Boolean).join(' · ')}</Text>
            {acts.map((f) => <Text key={f.id} style={styles.sub}>{`${uiDateTime(f.at)} · ${f.byRank ? `${f.by} (${f.byRank})` : f.by} — ${f.note ?? ''}`}</Text>)}
            {follow?.resultId === r.id ? null : (
              <View style={styles.row}>
                {o === 'pending' ? <TouchableOpacity onPress={() => setFollow({ resultId: r.id, kind: 'lab', ref: '', note: '' })}><Text style={styles.link}>{`${t('da.labResult')}…`}</Text></TouchableOpacity> : null}
                {o === 'positive' || o === 'refused' ? <TouchableOpacity onPress={() => setFollow({ resultId: r.id, kind: 'action', ref: '', note: '' })}><Text style={[styles.link, { color: acts.length ? COLORS.primary : COLORS.danger }]}>{`${t('da.action')}…`}</Text></TouchableOpacity> : null}
              </View>
            )}
            {follow?.resultId === r.id ? (
              <Card>
                <Label>{follow.kind === 'lab' ? t('da.labResult') : t('da.action')}</Label>
                {follow.kind === 'lab' ? (
                  <>
                    <View style={styles.chips}>
                      {chip(follow.lab === 'neg', t('da.lab.neg'), () => setFollow({ ...follow, lab: 'neg' }), 'n')}
                      {chip(follow.lab === 'pos', t('da.lab.pos'), () => setFollow({ ...follow, lab: 'pos' }), 'p')}
                    </View>
                    <TextInput style={styles.input} value={follow.ref} onChangeText={(v) => setFollow({ ...follow, ref: v })} placeholder={t('da.labRefPh')} placeholderTextColor={COLORS.textLight} />
                  </>
                ) : (
                  <TextInput style={[styles.input, { minHeight: 50 }]} value={follow.note} onChangeText={(v) => setFollow({ ...follow, note: v })} multiline placeholder={t('da.actionPh')} placeholderTextColor={COLORS.textLight} />
                )}
                {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void writeFollow()}><Text style={styles.btnText}>{t('da.signIt')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setFollow(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </Card>
            ) : null}
          </View>
        );
      })}
      <Text style={[styles.sub, { marginTop: SIZES.md }]}>{t('da.private')}</Text>
    </Screen>
  );
}
