// ===================================
// One management of change (types/moc.ts, plan item 38) — new (`id: 'new'`) or
// an existing one.
//
// An officer writes the change, why, the ISM documents it touches and the
// actions, and submits it. The Master approves it — on an approved risk
// assessment made for it, frozen onto the record — returns it with the reason,
// or rejects it; where the office is in the loop it goes there next (Fleet).
// Once approved only the actions move: whoever an action was given to signs it
// done, and when all are done the Master closes it, signed, with a word on
// whether the change worked. Rejected, cancelled or closed, it is final.
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
import { moduleOn } from '../constants/modules';
import { SIZES } from '../theme';
import { ManagementOfChange, MocAction, MocKind, MocStepKind, MOC_KINDS } from '../types/moc';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { RISK_COLOR, worstResidual } from '../services/permits';
import { raSnapshot } from '../services/jobGate';
import { proofShort } from '../services/signature';
import { approveProblem, docsNotRevised, mocEditable, mocRa, mocStage, MocStage, nextMocNo, nextSteps, overdueActions, readyToClose, returnedBy, tempState, withStep } from '../services/moc';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

type ActDraft = { text: string; owner: string; due: string };

export const mocStageColor = (COLORS: any, st: MocStage, late: boolean): string =>
  late ? COLORS.danger : ({ draft: COLORS.textLight, master: COLORS.warning, office: COLORS.primary, returned: COLORS.warning, approved: COLORS.primary, closed: COLORS.success, rejected: COLORS.danger, cancelled: COLORS.textLight } as Record<MocStage, string>)[st];

export default function MocSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { mocs, risks, docs, saveRow } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const raOn = moduleOn('ptw');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();

  // Once saved, the screen shows the stored record by its id (kept here, not in the route — see NcSc).
  const [savedId, setSavedId] = useState<string | null>(null);
  const isNew = route.params?.id === 'new' && !savedId;
  const stored = mocs.find((m) => m.id === (savedId ?? route.params?.id));
  const [draft, setDraft] = useState<ManagementOfChange | null>(() =>
    isNew
      ? { id: uid('moc'), no: '', kind: 'procedure', title: '', what: '', why: '', needsOffice: moduleOn('officeCheck'), actions: [], steps: [], raisedBy: '', at: Date.now(), updatedAt: Date.now() }
      : null
  );
  const [editing, setEditing] = useState(isNew);
  const [act, setAct] = useState<ActDraft | null>(null);
  const [doing, setDoing] = useState<{ id: string; note: string } | null>(null);
  // A step that takes a reason: return, reject, cancel, close.
  const [asking, setAsking] = useState<{ kind: MocStepKind; note: string } | null>(null);

  const m = editing ? draft : stored;
  if (!m) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav)} />
        <Text style={styles.sub}>{t('moc.notHere')}</Text>
      </Screen>
    );
  }
  const st = mocStage(m);
  const late = overdueActions(m, today).length > 0 || tempState(m, today) === 'over';
  const stColor = mocStageColor(COLORS, st, late);
  const set = (p: Partial<ManagementOfChange>) => setDraft({ ...(draft ?? m), ...p });
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
  const me = () => (signer ? { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}) } : null);
  const ra = mocRa(m, risks);
  const liveDocs = docs.filter((d) => !d.deleted);
  const notRevised = docsNotRevised(m, docs);
  const back = returnedBy(m);

  const write = async (next: ManagementOfChange) => {
    await saveRow(storage.MOCS_KEY, { ...next, updatedAt: Date.now() });
  };

  const save = async () => {
    const d = draft!;
    if (!d.title.trim() || !d.what.trim()) return Alert.alert(t('moc.one'), t('moc.needTitle'));
    if (d.until && !/^\d{4}-\d{2}-\d{2}$/.test(d.until)) return Alert.alert(t('moc.temporary'), t('moc.untilNeed'));
    let out: ManagementOfChange = { ...d, title: d.title.trim(), what: d.what.trim(), why: d.why.trim(), updatedAt: Date.now() };
    if (!stored) {
      const s = me();
      if (!s) return Alert.alert(t('moc.whoRaises'), t('round.chooseName'));
      out = { ...out, no: nextMocNo(mocs, today), raisedBy: s.name, ...(s.rank ? { raisedByRank: s.rank } : {}), at: Date.now() };
    }
    await saveRow(storage.MOCS_KEY, out);
    playSuccessSound();
    if (isNew) setSavedId(out.id);
    setDraft(null);
    setEditing(false);
  };

  const toggleDoc = (id: string) => {
    const cur = (draft ?? m).docs ?? [];
    if (cur.some((x) => x.id === id)) return set({ docs: cur.filter((x) => x.id !== id) });
    const d = liveDocs.find((x) => x.id === id)!;
    set({ docs: [...cur, { id: d.id, title: d.title, ...(d.docNo ? { docNo: d.docNo } : {}), rev: d.revision }] });
  };

  const addAction = async () => {
    if (!act) return;
    if (!act.text.trim() || !act.owner.trim() || !act.due) return Alert.alert(t('moc.action'), t('nc.actionNeed'));
    const a: MocAction = { id: uid('ma'), text: act.text.trim(), owner: act.owner.trim(), due: act.due };
    await write({ ...m, actions: [...m.actions, a] });
    setAct(null);
    playSuccessSound();
  };

  const actionDone = async (a: MocAction) => {
    if (!signer) return Alert.alert(t('nc.whoDid'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${m.no} — ${a.text} — done` });
    if (!sig) return;
    const note = doing?.note.trim();
    const done: MocAction = { ...a, doneAt: Date.now(), doneBy: signer.name, ...(signer.rank ? { doneByRank: signer.rank } : {}), ...(note ? { doneNote: note } : {}) };
    await write({ ...m, actions: m.actions.map((x) => (x.id === a.id ? done : x)) });
    setDoing(null);
    playSuccessSound();
  };

  /** One step on the way; the approval and the closure are signed. */
  const step = async (kind: MocStepKind, note?: string) => {
    if (kind === 'master') {
      const why = approveProblem(m, risks, raOn);
      if (why) return Alert.alert(t('moc.approve'), tk(`moc.need.${why}`));
    }
    const s = me();
    if (!s) return Alert.alert(t('sign.who'), t('round.chooseName'));
    let next = m;
    let proof;
    if (kind === 'master' || kind === 'close') {
      const sig = await confirmSign({ personKey: signer!.key, name: signer!.name, ownDevice: signer!.own, what: `${m.no} ${m.title} — ${kind === 'master' ? 'change approved' : 'closed'}` });
      if (!sig) return;
      proof = sig.proof;
      // The assessment as it was approved goes with the record — to the office and to the auditor.
      if (kind === 'master' && ra) next = { ...next, raId: ra.id, ra: raSnapshot(ra) };
    }
    try {
      next = withStep(next, kind, s, Date.now(), note, proof);
    } catch {
      return Alert.alert(tk(`moc.step.${kind}`), t('moc.needReason'));
    }
    await write(next);
    setAsking(null);
    playSuccessSound();
  };

  const ask = () => {
    if (!asking) return;
    if (asking.note.trim().length < 3) return Alert.alert(tk(`moc.step.${asking.kind}`), asking.kind === 'close' ? t('moc.closeNeed') : t('moc.needReason'));
    if (asking.kind === 'close' && notRevised.length) {
      return Alert.alert(t('moc.docsOpen'), t('moc.docsOpenBody', { docs: notRevised.map((d) => d.title).join(', ') }), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('moc.closeAnyway'), style: 'destructive', onPress: () => void step('close', asking.note) },
      ]);
    }
    void step(asking.kind, asking.note);
  };

  const newRa = () => nav.navigate('Risk', { id: uid('ra'), mocId: m.id, title: `${m.no} — ${m.title}` });

  const may = nextSteps(st);
  const btn = (kind: MocStepKind, label: string, primary = false) =>
    primary ? (
      <TouchableOpacity key={kind} style={styles.btn} onPress={() => (['masterReturn', 'reject', 'cancel', 'close'].includes(kind) ? setAsking({ kind, note: '' }) : void step(kind))}>
        <Text style={styles.btnText}>{label}</Text>
      </TouchableOpacity>
    ) : (
      <TouchableOpacity key={kind} onPress={() => setAsking({ kind, note: '' })}>
        <Text style={[styles.link, kind !== 'masterReturn' && { color: COLORS.danger }]}>{label}</Text>
      </TouchableOpacity>
    );

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Mocs')} />
      <ScreenTitle
        title={m.no ? `${m.no} · ${m.title || t('moc.one')}` : t('moc.new')}
        subtitle={m.no ? `${tk(`moc.st.${st}`)} · ${t('nc.raised', { date: uiDate(new Date(m.at).toISOString().slice(0, 10)), who: who(m.raisedBy, m.raisedByRank) })}` : t('moc.newSub')}
        help="Management of change"
      />

      {editing && draft ? (
        <Card>
          <Label>{t('moc.kind')}</Label>
          <View style={styles.chips}>
            {MOC_KINDS.map((k: MocKind) => (
              <TouchableOpacity key={k} style={[styles.chip, draft.kind === k && styles.chipOn]} onPress={() => set({ kind: k })}>
                <Text style={[styles.chipText, draft.kind === k && styles.chipTextOn]}>{tk(`moc.kind.${k}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} value={draft.title} onChangeText={(v) => set({ title: v })} placeholder={t('moc.titlePh')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.input, { minHeight: 70 }]} value={draft.what} onChangeText={(v) => set({ what: v })} multiline placeholder={t('moc.whatPh')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={[styles.input, { minHeight: 50 }]} value={draft.why} onChangeText={(v) => set({ why: v })} multiline placeholder={t('moc.whyPh')} placeholderTextColor={COLORS.textLight} />
          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { flex: 1 }]}>{t('moc.temporary')}</Text>
            <Switch value={draft.until != null} onValueChange={(v) => set({ until: v ? today : undefined })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {draft.until != null ? <SimpleDatePicker label={t('moc.until')} value={draft.until} onChange={(v) => set({ until: v })} /> : null}
          <View style={styles.toggle}>
            <Text style={[styles.toggleText, { flex: 1 }]}>{t('moc.needsOffice')}</Text>
            <Switch value={draft.needsOffice} onValueChange={(v) => set({ needsOffice: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          {moduleOn('docs') && liveDocs.length ? (
            <>
              <Label>{t('moc.docs')}</Label>
              <View style={styles.chips}>
                {liveDocs.map((d) => {
                  const on = (draft.docs ?? []).some((x) => x.id === d.id);
                  return (
                    <TouchableOpacity key={d.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleDoc(d.id)}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{`${d.docNo ? `${d.docNo} ` : ''}${d.title} · Rev ${d.revision}`}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}
          {!stored && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (!stored ? goBackOr(nav, 'Mocs') : (setDraft(null), setEditing(false)))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : (
        <View style={[styles.item, { borderLeftColor: stColor }]}>
          <Text style={[styles.sub, { color: stColor, fontWeight: '700' }]}>
            {[tk(`moc.st.${st}`), tk(`moc.kind.${m.kind}`), m.until ? t('moc.untilShort', { date: uiDate(m.until) }) : t('moc.permanent'), m.needsOffice ? t('moc.withOffice') : null].filter(Boolean).join(' · ')}
          </Text>
          <Text style={styles.body}>{m.what}</Text>
          {m.why ? <Text style={styles.sub}>{`${t('moc.why')}: ${m.why}`}</Text> : null}
          {back ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{`${tk(`moc.step.${back.kind}`)} · ${who(back.by, back.byRank)}: ${back.note ?? ''}`}</Text> : null}
          {canEdit && mocEditable(m) ? <TouchableOpacity onPress={() => { setDraft(m); setEditing(true); }}><Text style={styles.link}>{t('common.edit')}</Text></TouchableOpacity> : null}
        </View>
      )}

      {m.no && !editing ? (
        <>
          {m.docs?.length ? (
            <>
              <Label>{t('moc.docs')}</Label>
              {m.docs.map((d) => {
                const cur = docs.find((x) => x.id === d.id);
                const revised = !!cur && cur.revision > d.rev;
                return (
                  <TouchableOpacity key={d.id} style={[styles.item, { borderLeftColor: revised ? COLORS.success : COLORS.warning }]} onPress={() => cur && nav.navigate('Doc', { id: d.id })}>
                    <Text style={styles.name}>{`${d.docNo ? `${d.docNo} ` : ''}${d.title}`}</Text>
                    <Text style={[styles.sub, revised && { color: COLORS.success }]}>{revised ? t('moc.revised', { from: d.rev, to: cur!.revision }) : t('moc.notRevised', { rev: d.rev })}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}

          {raOn || m.ra ? (
            <>
              <Label>{t('moc.ra')}</Label>
              {m.ra ? (
                <TouchableOpacity style={[styles.item, { borderLeftColor: m.ra.worst ? RISK_COLOR[m.ra.worst] : COLORS.success }]} onPress={() => nav.navigate('Risk', { id: m.ra!.id })}>
                  <Text style={styles.name}>{`${m.ra.no ? `${m.ra.no} · ` : ''}${m.ra.title}`}</Text>
                  {m.ra.worst ? <Text style={[styles.sub, { color: RISK_COLOR[m.ra.worst], fontWeight: '800' }]}>{t('risk.residual', { level: tk(`risk.lvl.${m.ra.worst}`) })}</Text> : null}
                  <Text style={styles.sub}>{t('od.raApproved', { who: m.ra.approvedBy, when: uiDate(new Date(m.ra.approvedAt).toISOString().slice(0, 10)) })}</Text>
                </TouchableOpacity>
              ) : ra ? (
                <TouchableOpacity style={[styles.item, { borderLeftColor: COLORS.success }]} onPress={() => nav.navigate('Risk', { id: ra.id })}>
                  <Text style={styles.name}>{`✓ ${ra.no ? `${ra.no} · ` : ''}${ra.title}`}</Text>
                  {worstResidual(ra) ? <Text style={[styles.sub, { color: RISK_COLOR[worstResidual(ra)!], fontWeight: '800' }]}>{t('risk.residual', { level: tk(`risk.lvl.${worstResidual(ra)}`) })}</Text> : null}
                </TouchableOpacity>
              ) : (
                <>
                  {risks.filter((r) => r.mocId === m.id && !r.deleted).map((r) => (
                    <TouchableOpacity key={r.id} style={[styles.item, { borderLeftColor: COLORS.warning }]} onPress={() => nav.navigate('Risk', { id: r.id })}>
                      <Text style={styles.name}>{`${r.no ? `${r.no} · ` : ''}${r.title}`}</Text>
                      <Text style={[styles.sub, { color: COLORS.warning }]}>{t('moc.raNotApproved')}</Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={styles.sub}>{t('moc.raNone')}</Text>
                  {canEdit && mocEditable(m) && !risks.some((r) => r.mocId === m.id && !r.deleted) ? <TouchableOpacity onPress={newRa}><Text style={styles.link}>{`+ ${t('moc.raMake')}`}</Text></TouchableOpacity> : null}
                </>
              )}
            </>
          ) : null}

          <Label>{t('nc.actionsN', { k: m.actions.filter((a) => a.doneAt).length, n: m.actions.length })}</Label>
          {m.actions.map((a) => {
            const lateA = !a.doneAt && a.due < today;
            return (
              <View key={a.id} style={[styles.item, { borderLeftColor: a.doneAt ? COLORS.success : lateA ? COLORS.danger : COLORS.warning }]}>
                <Text style={styles.name}>{`${a.doneAt ? '✓ ' : ''}${a.text}`}</Text>
                <Text style={[styles.sub, lateA && { color: COLORS.danger, fontWeight: '700' }]}>{`${a.owner} · ${t('drills.nextBy', { date: uiDate(a.due) })}${lateA ? ` · ${t('moc.overdue')}` : ''}`}</Text>
                {a.doneAt ? <Text style={[styles.sub, { color: COLORS.success }]}>{`${t('nc.doneAt', { when: uiDateTime(a.doneAt) })} · ${who(a.doneBy, a.doneByRank)}${a.doneNote ? ` — ${a.doneNote}` : ''}`}</Text> : null}
                {!a.doneAt && st === 'approved' ? (
                  doing?.id === a.id ? (
                    <View>
                      <TextInput style={styles.input} value={doing.note} onChangeText={(v) => setDoing({ id: a.id, note: v })} placeholder={t('nc.donePh')} placeholderTextColor={COLORS.textLight} />
                      {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
                      <View style={styles.row}>
                        <TouchableOpacity style={styles.btn} onPress={() => void actionDone(a)}><Text style={styles.btnText}>{t('nc.signDone')}</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => setDoing(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => setDoing({ id: a.id, note: '' })}><Text style={styles.link}>{`${t('common.done')}…`}</Text></TouchableOpacity>
                  )
                ) : null}
                {canEdit && mocEditable(m) && !a.doneAt ? (
                  <TouchableOpacity onPress={() => void write({ ...m, actions: m.actions.filter((x) => x.id !== a.id) })}><Text style={[styles.link, { color: COLORS.danger }]}>{t('common.delete')}</Text></TouchableOpacity>
                ) : null}
              </View>
            );
          })}
          {!m.actions.length ? <Text style={styles.sub}>{t('moc.noAction')}</Text> : null}
          {canEdit && (mocEditable(m) || st === 'approved') ? (
            act ? (
              <Card>
                <TextInput style={[styles.input, { minHeight: 50 }]} value={act.text} onChangeText={(v) => setAct({ ...act, text: v })} multiline placeholder={t('moc.todoPh')} placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} value={act.owner} onChangeText={(v) => setAct({ ...act, owner: v })} placeholder={t('nc.ownerPh')} placeholderTextColor={COLORS.textLight} />
                <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('nc.byWhen')} value={act.due} onChange={(v) => setAct({ ...act, due: v })} /></View>
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void addAction()}><Text style={styles.btnText}>{t('nc.addAction')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setAct(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={() => setAct({ text: '', owner: '', due: '' })}><Text style={styles.smallText}>{`+ ${t('moc.action')}`}</Text></TouchableOpacity>
            )
          ) : null}

          {/* The way so far. */}
          {m.steps.length ? (
            <>
              <Label>{t('moc.history')}</Label>
              {m.steps.map((s, i) => (
                <Text key={i} style={styles.sub}>{`${uiDateTime(s.at)} · ${tk(`moc.step.${s.kind}`)} · ${who(s.by, s.byRank)}${s.signedWith ? ` · ${proofShort(s.signedWith)}` : ''}${s.note ? ` — ${s.note}` : ''}`}</Text>
              ))}
            </>
          ) : null}

          {/* What can be done next, by whom. */}
          {asking ? (
            <Card>
              <Label>{tk(`moc.step.${asking.kind}`)}</Label>
              <TextInput style={[styles.input, { minHeight: 50 }]} value={asking.note} onChangeText={(v) => setAsking({ ...asking, note: v })} multiline placeholder={asking.kind === 'close' ? t('moc.closePh') : t('moc.reasonPh')} placeholderTextColor={COLORS.textLight} />
              {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
              <View style={styles.row}>
                <TouchableOpacity style={styles.btn} onPress={ask}><Text style={styles.btnText}>{asking.kind === 'close' ? t('mo.signClose') : tk(`moc.step.${asking.kind}`)}</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setAsking(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
              </View>
            </Card>
          ) : (
            <View style={{ marginTop: SIZES.md }}>
              {picker && (isMaster || canEdit) && may.length ? <View style={{ marginBottom: SIZES.sm }}>{picker}</View> : null}
              <View style={styles.row}>
                {(st === 'draft' || st === 'returned') && isMaster ? btn('master', t('moc.approve'), true) : null}
                {(st === 'draft' || st === 'returned') && canEdit && !isMaster ? btn('submit', t('moc.submit'), true) : null}
                {st === 'master' && isMaster ? btn('master', t('moc.approve'), true) : null}
                {st === 'master' && isMaster ? btn('masterReturn', t('moc.step.masterReturn')) : null}
                {st === 'master' && isMaster ? btn('reject', t('moc.step.reject')) : null}
                {may.includes('cancel') && canEdit ? btn('cancel', t('moc.step.cancel')) : null}
                {readyToClose(m) && isMaster ? btn('close', t('moc.closeBtn'), true) : null}
              </View>
              {st === 'master' && !isMaster ? <Text style={styles.sub}>{t('moc.atMaster')}</Text> : null}
              {st === 'office' ? <Text style={styles.sub}>{t('moc.atOffice')}</Text> : null}
              {st === 'approved' && !readyToClose(m) ? <Text style={styles.sub}>{t('moc.inWork')}</Text> : null}
              {st === 'approved' && readyToClose(m) && !isMaster ? <Text style={styles.sub}>{t('moc.masterCloses')}</Text> : null}
            </View>
          )}
        </>
      ) : null}
    </Screen>
  );
}
