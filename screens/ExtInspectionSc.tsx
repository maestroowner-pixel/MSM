// ===================================
// One external inspection (types/extInspection.ts) — new (`id: 'new'`) or an
// existing one.
//
// New: who came, where, the report number, a detention — and the findings,
// written one by one. Saved and signed, the visit is recorded and every finding
// becomes an NC with its correction, its owner and its date (a PSC action code
// sets the date: 17 before departure, 16 within 14 days…; code 10 is already
// rectified). Afterwards the findings live on as NCs (NcSc); here they are
// listed with their state, more can be added, and the Master records the day a
// detention was lifted.
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
import { EXT_INSP_KINDS, ExternalInspection, ExtInspKind, PSC_ACTIONS } from '../types/extInspection';
import { NC_GRADES, NC_GRADE_LABEL, NonConformity } from '../types/safety';
import { plansPms, roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { proofShort } from '../services/signature';
import { NC_STATE_LABEL, NcState, ncState } from '../services/safety';
import { exportInspExcel, exportInspPdf } from '../services/extInspectionReport';
import { FindingDraft, dueForAction, findingProblem, findingsOf, findingsToNcs, inspStatus, nextInspNo } from '../services/extInspections';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const plus30 = (iso: string) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 30);
  return d.toISOString().slice(0, 10);
};
const blankFinding = (kind: ExtInspKind, date: string): FindingDraft => ({ text: '', grade: 'nc', due: kind === 'psc' ? '' : plus30(date), owner: '' });
const canDetain = (k: ExtInspKind) => k === 'psc' || k === 'flag';

export default function ExtInspectionSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { extInspections, ncs, saveRow, saveRows, vessel } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = plansPms(sync.enrolled, sync.role);
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();

  // As in NcSc: once saved, the screen shows the stored record by its id (kept here, not in the route).
  const [savedId, setSavedId] = useState<string | null>(null);
  const isNew = route.params?.id === 'new' && !savedId;
  const stored = extInspections.find((x) => x.id === (savedId ?? route.params?.id));
  const [draft, setDraft] = useState<ExternalInspection | null>(() =>
    isNew ? { id: uid('ei'), no: '', kind: 'psc', date: today, by: '', at: 0, updatedAt: 0 } : null,
  );
  const [findings, setFindings] = useState<FindingDraft[]>([]);
  const [fd, setFd] = useState<FindingDraft | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const x = editing ? draft : stored;
  if (!x) {
    return (
      <Screen scroll>
        <BackButton onPress={() => goBackOr(nav, 'ExtInspections')} />
        <Text style={styles.sub}>{t('ei.notHere')}</Text>
      </Screen>
    );
  }
  const set = (p: Partial<ExternalInspection>) => setDraft({ ...(draft ?? x), ...p });
  const who = (by?: string, rank?: string) => (rank ? `${by} (${rank})` : by ?? '');
  const list = stored ? findingsOf(stored, ncs) : [];
  const st = stored ? inspStatus(stored, ncs, today) : null;

  // ---- a finding: written here, an NC once saved ----
  const takeFinding = (): FindingDraft | null => {
    if (!fd) return null;
    const p = findingProblem(fd);
    if (p) {
      Alert.alert(t('ei.finding'), t(p === 'text' ? 'ei.needText' : p === 'due' ? 'ei.needDue' : 'ei.needOwner'));
      return null;
    }
    return fd;
  };
  const addToDraft = () => {
    const f = takeFinding();
    if (!f) return;
    setFindings([...findings, f]);
    setFd(null);
  };
  const addToStored = async () => {
    const f = takeFinding();
    if (!f || !stored) return;
    if (!signer) return Alert.alert(t('nc.whoRaises'), t('round.chooseName'));
    await saveRows(storage.NCS_KEY, findingsToNcs(stored, [f], ncs, { name: signer.name, rank: signer.rank }, Date.now()));
    setFd(null);
    playSuccessSound();
  };

  const save = async () => {
    const d = draft!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return Alert.alert(t('ei.date'), t('ei.needDate'));
    if (fd) return Alert.alert(t('ei.finding'), t('ei.findingOpen'));
    const clean = {
      ...d,
      port: d.port?.trim() || undefined, authority: d.authority?.trim() || undefined, inspector: d.inspector?.trim() || undefined,
      reportNo: d.reportNo?.trim() || undefined, note: d.note?.trim() || undefined,
      detained: canDetain(d.kind) && d.detained ? true : undefined,
    };
    const out = Object.fromEntries(Object.entries(clean).filter(([, v]) => v !== undefined)) as unknown as ExternalInspection;
    const now = Date.now();
    if (isNew && !stored) {
      if (!signer) return Alert.alert(t('ei.whoRecords'), t('round.chooseName'));
      const what = `${tk(`ei.kind.${d.kind}`)} ${uiDate(d.date)}${d.port ? ` ${d.port}` : ''} — ${findings.length ? t('ei.nFindings', { n: findings.length }) : t('ei.noFindings')}`;
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what });
      if (!sig) return;
      const rec: ExternalInspection = { ...out, no: nextInspNo(extInspections, d.date), by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), at: now, updatedAt: now };
      if (findings.length) await saveRows(storage.NCS_KEY, findingsToNcs(rec, findings, ncs, { name: signer.name, rank: signer.rank }, now));
      await saveRow(storage.EXT_INSP_KEY, rec);
      setSavedId(rec.id);
      setFindings([]);
    } else {
      await saveRow(storage.EXT_INSP_KEY, { ...out, updatedAt: now });
    }
    playSuccessSound();
    setDraft(null);
    setEditing(false);
  };

  const paper = async (kind: 'pdf' | 'xlsx') => {
    try {
      const w = kind === 'pdf' ? await exportInspPdf([stored!], ncs, today, vessel) : await exportInspExcel([stored!], ncs, today, vessel);
      if (typeof w === 'string') setSaved(w === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: w }));
    } catch (e: any) {
      Alert.alert(t('ei.title'), String(e?.message ?? e));
    }
  };

  const release = async () => {
    if (!stored || releasing === null) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(releasing)) return Alert.alert(t('ei.released'), t('ei.needDate'));
    await saveRow(storage.EXT_INSP_KEY, { ...stored, releasedOn: releasing, updatedAt: Date.now() });
    setReleasing(null);
    playSuccessSound();
  };

  const stateColor: Record<NcState, string> = { overdue: COLORS.danger, open: COLORS.warning, ready: COLORS.primary, closed: COLORS.success };
  const kind = (editing ? draft : stored)!.kind;
  const date = (editing ? draft : stored)!.date;

  const findingEditor = fd ? (
    <Card>
      <Label>{t('ei.finding')}</Label>
      <TextInput style={[styles.input, { minHeight: 70 }]} value={fd.text} onChangeText={(v) => setFd({ ...fd, text: v })} multiline placeholder={t('ei.textPh')} placeholderTextColor={COLORS.textLight} />
      <TextInput style={styles.input} value={fd.requirement ?? ''} onChangeText={(v) => setFd({ ...fd, requirement: v })} placeholder={t('nc.reqPh')} placeholderTextColor={COLORS.textLight} />
      <View style={styles.chips}>
        {NC_GRADES.map((g) => (
          <TouchableOpacity key={g.key} style={[styles.chip, fd.grade === g.key && styles.chipOn]} onPress={() => setFd({ ...fd, grade: g.key })}>
            <Text style={[styles.chipText, fd.grade === g.key && styles.chipTextOn]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {kind === 'psc' ? (
        <>
          <TextInput style={styles.input} value={fd.pscCode ?? ''} onChangeText={(v) => setFd({ ...fd, pscCode: v })} placeholder={t('ei.codePh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('ei.actionCode')}</Label>
          <View style={styles.chips}>
            {PSC_ACTIONS.map((a) => (
              <TouchableOpacity key={a.code} style={[styles.chip, fd.pscAction === a.code && styles.chipOn]} onPress={() => setFd({ ...fd, pscAction: a.code, due: dueForAction(a.code, date) ?? fd.due, ...(a.code === '30' ? { grade: 'major' } : {}) })}>
                <Text style={[styles.chipText, fd.pscAction === a.code && styles.chipTextOn]}>{`${a.code} · ${tk(`ei.act.${a.code}`)}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : null}
      <View style={{ marginTop: SIZES.sm }}><SimpleDatePicker label={t('ei.rectifyBy')} value={fd.due} onChange={(v) => setFd({ ...fd, due: v })} /></View>
      <TextInput style={styles.input} value={fd.owner} onChangeText={(v) => setFd({ ...fd, owner: v })} placeholder={t('nc.ownerPh')} placeholderTextColor={COLORS.textLight} />
      <TextInput style={styles.input} value={fd.todo ?? ''} onChangeText={(v) => setFd({ ...fd, todo: v })} placeholder={t('ei.todoPh')} placeholderTextColor={COLORS.textLight} />
      {!editing && picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => (editing ? addToDraft() : void addToStored())}><Text style={styles.btnText}>{editing ? t('ei.addFinding') : t('ei.raiseFinding')}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setFd(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'ExtInspections')} />
      <ScreenTitle
        title={stored && !isNew ? `${tk(`ei.kind.${stored.kind}`)}${stored.port ? ` · ${stored.port}` : ''}` : t('ei.new')}
        subtitle={stored && !isNew ? `${stored.no} · ${uiDate(stored.date)}` : t('ei.newSub')}
        help="External inspections"
      />

      {editing && draft ? (
        <Card>
          {isNew && !stored ? (
            <View style={styles.chips}>
              {EXT_INSP_KINDS.map((k) => (
                <TouchableOpacity key={k} style={[styles.chip, draft.kind === k && styles.chipOn]} onPress={() => set({ kind: k })}>
                  <Text style={[styles.chipText, draft.kind === k && styles.chipTextOn]}>{tk(`ei.kind.${k}`)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <SimpleDatePicker label={t('ei.date')} value={draft.date} onChange={(v) => set({ date: v })} />
          <TextInput style={styles.input} value={draft.port ?? ''} onChangeText={(v) => set({ port: v })} placeholder={t('ei.portPh')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.authority ?? ''} onChangeText={(v) => set({ authority: v })} placeholder={tk(`ei.authPh.${draft.kind}`)} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.inspector ?? ''} onChangeText={(v) => set({ inspector: v })} placeholder={t('ei.inspectorPh')} placeholderTextColor={COLORS.textLight} />
          <TextInput style={styles.input} value={draft.reportNo ?? ''} onChangeText={(v) => set({ reportNo: v })} placeholder={t('ei.reportPh')} placeholderTextColor={COLORS.textLight} />
          {canDetain(draft.kind) ? (
            <View style={styles.toggle}>
              <Text style={styles.toggleText}>{t('ei.detained')}</Text>
              <Switch value={!!draft.detained} onValueChange={(v) => set({ detained: v })} trackColor={{ true: COLORS.danger, false: COLORS.border }} />
            </View>
          ) : null}
          <TextInput style={[styles.input, { minHeight: 50 }]} value={draft.note ?? ''} onChangeText={(v) => set({ note: v })} multiline placeholder={t('ei.notePh')} placeholderTextColor={COLORS.textLight} />

          {isNew && !stored ? (
            <>
              <Label>{findings.length ? t('ei.findingsN', { n: findings.length }) : t('ei.findings')}</Label>
              {findings.map((f, i) => (
                <View key={i} style={[styles.item, { borderLeftColor: f.grade === 'major' ? COLORS.danger : COLORS.warning }]}>
                  <Text style={styles.name}>{f.text}</Text>
                  <Text style={styles.sub}>{[NC_GRADE_LABEL[f.grade], f.pscCode, f.pscAction ? `${f.pscAction} · ${tk(`ei.act.${f.pscAction}`)}` : null, `${f.owner} · ${uiDate(f.due)}`].filter(Boolean).join(' · ')}</Text>
                  <TouchableOpacity onPress={() => setFindings(findings.filter((_, k) => k !== i))}><Text style={styles.link}>{t('common.delete')}</Text></TouchableOpacity>
                </View>
              ))}
              {findingEditor ?? (
                <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={() => setFd(blankFinding(draft.kind, draft.date))}><Text style={styles.smallText}>{`+ ${t('ei.finding')}`}</Text></TouchableOpacity>
              )}
              {!findings.length && !fd ? <Text style={styles.sub}>{t('ei.cleanHint')}</Text> : null}
              {picker ? <View style={{ marginTop: SIZES.sm }}>{picker}</View> : null}
            </>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{isNew && !stored ? t('ei.signSave') : t('common.save')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => (isNew && !stored ? goBackOr(nav, 'ExtInspections') : (setDraft(null), setEditing(false)))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </Card>
      ) : stored && st ? (
        <>
          <View style={[styles.item, { borderLeftColor: st.detainedNow || st.state === 'overdue' ? COLORS.danger : st.state === 'open' ? COLORS.warning : COLORS.success }]}>
            <Text style={[styles.sub, { fontWeight: '700', color: st.detainedNow || st.state === 'overdue' ? COLORS.danger : st.state === 'open' ? COLORS.warning : COLORS.success }]}>
              {[st.detainedNow ? t('ei.detainedNow') : null, tk(`ei.state.${st.state}`), st.total ? t('ei.closedK', { k: st.closed, n: st.total }) : null, st.verified ? t('ei.verifiedK', { k: st.verified }) : null].filter(Boolean).join(' · ')}
            </Text>
            <Text style={styles.sub}>{[stored.authority, stored.inspector, stored.reportNo ? `${t('ei.report')} ${stored.reportNo}` : null].filter(Boolean).join(' · ')}</Text>
            {stored.detained && stored.releasedOn ? <Text style={[styles.sub, { color: COLORS.success }]}>{t('ei.wasDetained', { date: uiDate(stored.releasedOn) })}</Text> : null}
            {stored.note ? <Text style={styles.body}>{stored.note}</Text> : null}
            <Text style={styles.sub}>{`${t('ei.recorded', { who: who(stored.by, stored.byRank), when: uiDateTime(stored.at) })}${stored.signedWith ? ` · ${proofShort(stored.signedWith)}` : ''}`}</Text>
            {canEdit ? <TouchableOpacity onPress={() => { setDraft(stored); setEditing(true); }}><Text style={styles.link}>{t('common.edit')}</Text></TouchableOpacity> : null}
          </View>

          {st.detainedNow && isMaster ? (
            releasing !== null ? (
              <Card>
                <SimpleDatePicker label={t('ei.released')} value={releasing} onChange={setReleasing} />
                <View style={styles.row}>
                  <TouchableOpacity style={styles.btn} onPress={() => void release()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setReleasing(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
                </View>
              </Card>
            ) : (
              <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start' }]} onPress={() => setReleasing(today)}><Text style={styles.smallText}>{t('ei.liftBtn')}</Text></TouchableOpacity>
            )
          ) : null}

          <Label>{list.length ? t('ei.findingsN', { n: list.length }) : t('ei.findings')}</Label>
          {!list.length ? <Text style={styles.sub}>{t('ei.none')}</Text> : null}
          {list.map((n: NonConformity) => {
            const s = ncState(n, today);
            return (
              <TouchableOpacity key={n.id} style={[styles.item, { borderLeftColor: stateColor[s] }]} onPress={() => nav.navigate('Nc', { id: n.id })} activeOpacity={0.7}>
                <Text style={styles.name}>{`${n.no} · ${n.title}`}</Text>
                <Text style={[styles.sub, { color: stateColor[s], fontWeight: '700' }]}>{[NC_STATE_LABEL[s], n.office?.result === 'verified' ? t('ei.officeOk') : null].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.sub}>{[NC_GRADE_LABEL[n.grade], n.pscCode, n.pscAction ? `${n.pscAction} · ${tk(`ei.act.${n.pscAction}`)}` : null].filter(Boolean).join(' · ')}</Text>
              </TouchableOpacity>
            );
          })}
          {canEdit ? findingEditor ?? (
            <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: SIZES.xs }]} onPress={() => setFd(blankFinding(stored.kind, stored.date))}><Text style={styles.smallText}>{`+ ${t('ei.finding')}`}</Text></TouchableOpacity>
          ) : null}
          {true ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.btn} onPress={() => void paper('pdf')}><Text style={styles.btnText}>{t('ei.reportPdf')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={() => void paper('xlsx')}><Text style={styles.btnText}>Excel</Text></TouchableOpacity>
              {saved ? <Text style={[styles.sub, { color: COLORS.success }]}>{`✓ ${saved}`}</Text> : null}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
