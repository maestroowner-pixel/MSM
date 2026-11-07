// ===================================
// One chemical aboard (types/chemicals.ts, plan item 65): what the crew need at
// the moment of use — signal word, pictograms, hazards, PPE, first aid, fire,
// spill, storage — read off its safety data sheet, where it is kept and how
// much, and the SDS itself to open.
//
// The officers keep the card. The SDS (PDF or photo) goes to the vessel's files;
// with AI on, the AI reads it at once and its draft is shown beside the card —
// nothing changes until "Put into the card", and the card then waits for an
// officer to sign it as checked against the sheet. A new sheet or a changed
// hazard clears that check. With permits on: a risk assessment started from the
// card (open deck or an enclosed space), an ordinary one, approved as any other.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { moduleOn } from '../constants/modules';
import { CHEM_USES, Chemical, ChemStock, ChemUse, FirstAid, GHS, Ghs } from '../types/chemicals';
import { personName, roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { aiCall, aiReady } from '../services/ai';
import { uploadInline } from '../services/attachmentStorage';
import { openMedFile, pickDocForAi, sizeText } from '../services/medFiles';
import { applySds, chemIssues, raFor, readSds, SdsAiReply, SdsRead, sdsChanged, sdsReviewBy, stockLine } from '../services/chemicals';
import { RISK_COLOR, worstResidual } from '../services/permits';
import { todayIso } from '../services/pms';
import { uiDate, uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const MAX_SDS = 10 * 1024 * 1024;
const num = (v: string) => {
  const n = Number(v.replace(/\s/g, '').replace(',', '.'));
  return v.trim() && Number.isFinite(n) ? n : undefined;
};
const FA: (keyof FirstAid)[] = ['eyes', 'skin', 'inhaled', 'swallowed'];

export const signalColor = (C: { danger: string; warning: string; textLight: string }, s?: Chemical['signal']) => (s === 'danger' ? C.danger : s === 'warning' ? C.warning : C.textLight);

export default function ChemicalSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { chemicals, risks, saveRow, vessel } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isNew = route.params?.id === 'new';
  const stored = chemicals.find((c) => c.id === route.params?.id);
  const [draft, setDraft] = useState<Chemical | null>(() =>
    isNew ? { id: uid('chem'), name: '', use: 'cleaning', stock: [{ place: '' }], createdAt: Date.now(), updatedAt: 0 } : null);
  const [ai, setAi] = useState<SdsRead | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const back = () => goBackOr(nav, 'Permits', { tab: 'chem' });
  const today = todayIso();
  const ptw = moduleOn('ptw');

  const c = draft ?? stored;
  if (!c) {
    return (
      <Screen scroll>
        <BackButton onPress={back} />
        <Text style={styles.sub}>{t('chem.notHere')}</Text>
      </Screen>
    );
  }

  const set = (patch: Partial<Chemical>) => setDraft({ ...(draft ?? stored!), ...patch });
  const setStock = (i: number, patch: Partial<ChemStock>) => set({ stock: c.stock.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const chip = (on: boolean, label: string, onPress: () => void, key: string, color?: string) => (
    <TouchableOpacity key={key} style={[styles.chip, color ? { borderColor: color } : null, on && [styles.chipOn, color ? { backgroundColor: color } : null]]} onPress={onPress}>
      <Text style={[styles.chipText, color ? { color } : null, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );

  // ---- the SDS: kept, and read by the AI ----
  const addSds = async () => {
    const f = await pickDocForAi();
    if (!f) return;
    if (f.bytes > MAX_SDS) return Alert.alert(t('chem.sds'), t('chem.tooBig', { size: sizeText(f.bytes) }));
    setBusy('file');
    try {
      const imo = (vessel?.imo ?? '').replace(/\D/g, '');
      if (sync.enrolled && !imo) throw new Error(t('chem.noImo'));
      const url = sync.enrolled ? await uploadInline(imo, c.id, uid('sds'), f.dataUri) : f.dataUri;
      const who = sync.me ? personName(sync.me) : '';
      set({ sds: { url, name: f.name, addedAt: Date.now(), ...(who ? { by: who } : {}) } });
      setAi(null);
      if (aiReady(sync.enrolled)) {
        setBusy('ai');
        const comma = f.dataUri.indexOf(',');
        const r = await aiCall<SdsAiReply>('sds', { mediaType: f.dataUri.slice(5, f.dataUri.indexOf(';')), data: f.dataUri.slice(comma + 1), ...(c.name.trim() ? { name: c.name.trim() } : {}) });
        setAi(readSds(r));
      }
    } catch (e: any) {
      Alert.alert(t('chem.sds'), String(e?.message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return Alert.alert(t('chem.title'), t('chem.needName'));
    if (draft.sdsDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.sdsDate)) return Alert.alert(t('chem.sdsDate'), t('chem.dateBad'));
    const hazards = (draft.hazards ?? []).map((h) => h.trim()).filter(Boolean);
    const stock = draft.stock.map((s) => ({ place: s.place.trim(), ...(s.qty != null ? { qty: s.qty } : {}), ...(s.unit?.trim() ? { unit: s.unit.trim() } : {}) })).filter((s) => s.place || s.qty != null);
    const out: Chemical = JSON.parse(JSON.stringify({ ...draft, name, stock, hazards: hazards.length ? hazards : undefined, maker: draft.maker?.trim() || undefined, updatedAt: Date.now() }));
    // What was checked is no longer what is here.
    if (stored?.checked && sdsChanged(stored, out)) delete out.checked;
    await saveRow(storage.CHEMICALS_KEY, out);
    playSuccessSound();
    setDraft(null);
    setAi(null);
    if (isNew) nav.replace('Chemical', { id: out.id });
  };

  const check = async () => {
    if (!stored) return;
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Checked against the SDS — ${stored.name}` });
    if (!sig) return;
    await saveRow(storage.CHEMICALS_KEY, { ...stored, byAi: false, checked: { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) } });
    playSuccessSound();
  };

  const takeOff = () =>
    Alert.alert(t('chem.takeOff'), t('chem.takeOffBody', { name: c.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chem.takeOff'), style: 'destructive', onPress: () => void (async () => {
          await saveRow(storage.CHEMICALS_KEY, { ...stored!, deleted: true });
          back();
        })(),
      },
    ]);

  const newRa = (enclosed: boolean) => nav.navigate('Risk', { id: uid('ra'), chemId: c.id, enclosed: enclosed ? 1 : 0 });

  // ---- the AI's draft ----
  const aiPanel = ai ? (
    <Card>
      <Label>{t('chem.aiRead')}</Label>
      {!ai.isSds ? <Text style={[styles.sub, { color: COLORS.danger, fontWeight: '700' }]}>{t('chem.notSds')}</Text> : null}
      {ai.name || ai.maker ? <Text style={styles.name}>{[ai.name, ai.maker].filter(Boolean).join(' · ')}</Text> : null}
      <Text style={styles.sub}>{[ai.fields.sdsDate ? t('chem.sdsDated', { date: uiDate(ai.fields.sdsDate) }) : t('chem.sdsNoDate'), ai.fields.sdsLang].filter(Boolean).join(' · ')}</Text>
      {ai.fields.signal ? <Text style={[styles.body, { color: signalColor(COLORS, ai.fields.signal), fontWeight: '800' }]}>{tk(`chem.signal.${ai.fields.signal}`)}</Text> : null}
      {ai.fields.ghs?.length ? <Text style={styles.body}>{ai.fields.ghs.map((g) => `${g} ${tk(`chem.ghs.${g}`)}`).join(' · ')}</Text> : null}
      {(ai.fields.hazards ?? []).map((h) => <Text key={h} style={styles.sub}>{h}</Text>)}
      {ai.fields.ppe ? <Text style={styles.body}>{`${t('chem.ppe')}: ${ai.fields.ppe}`}</Text> : null}
      {ai.unreadable ? <Text style={[styles.sub, { color: COLORS.warning }]}>{t('chem.aiUnclear', { what: ai.unreadable })}</Text> : null}
      <Text style={styles.sub}>{t('chem.aiHint')}</Text>
      <View style={styles.row}>
        {ai.isSds ? (
          <TouchableOpacity style={styles.btn} onPress={() => { set(applySds(c, ai, isNew)); setAi(null); }}>
            <Text style={styles.btnText}>{t('chem.aiPut')}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setAi(null)}><Text style={styles.link}>{t('ai.dismiss')}</Text></TouchableOpacity>
      </View>
    </Card>
  ) : null;

  // ---- edit ----
  if (draft) {
    const txt = (k: 'ppe' | 'fire' | 'spill' | 'storage' | 'incompatible' | 'notes', label: string) => (
      <>
        <Label>{label}</Label>
        <TextInput style={styles.input} value={draft[k] ?? ''} onChangeText={(v) => set({ [k]: v || undefined } as Partial<Chemical>)} multiline />
      </>
    );
    return (
      <Screen scroll>
        <BackButton onPress={() => (isNew ? back() : setDraft(null))} />
        <ScreenTitle title={isNew ? t('chem.new') : draft.name} help="Chemicals and safety data sheets" />
        {aiPanel}
        <Card>
          <Label>{t('chem.name')}</Label>
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => set({ name: v })} placeholder={t('chem.namePh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('chem.maker')}</Label>
          <TextInput style={styles.input} value={draft.maker ?? ''} onChangeText={(v) => set({ maker: v })} />
          <Label>{t('chem.use')}</Label>
          <View style={styles.chips}>{CHEM_USES.map((u) => chip(draft.use === u, tk(`chem.use.${u}`), () => set({ use: u as ChemUse }), u))}</View>

          <Label>{t('chem.where')}</Label>
          {draft.stock.map((s, i) => (
            <View key={i} style={[styles.row, { marginVertical: 2, gap: 6 }]}>
              <TextInput style={[styles.input, { flex: 2, minWidth: 140 }]} value={s.place} onChangeText={(v) => setStock(i, { place: v })} placeholder={t('chem.placePh')} placeholderTextColor={COLORS.textLight} />
              <TextInput style={[styles.input, { width: 70 }]} value={s.qty == null ? '' : String(s.qty)} onChangeText={(v) => setStock(i, { qty: num(v) })} placeholder={t('chem.qty')} placeholderTextColor={COLORS.textLight} keyboardType="decimal-pad" />
              <TextInput style={[styles.input, { width: 70 }]} value={s.unit ?? ''} onChangeText={(v) => setStock(i, { unit: v })} placeholder={t('chem.unit')} placeholderTextColor={COLORS.textLight} />
              {draft.stock.length > 1 ? <TouchableOpacity onPress={() => set({ stock: draft.stock.filter((_, j) => j !== i) })}><Text style={[styles.link, { color: COLORS.danger, marginTop: 0 }]}>✕</Text></TouchableOpacity> : null}
            </View>
          ))}
          <TouchableOpacity onPress={() => set({ stock: [...draft.stock, { place: '' }] })}><Text style={styles.link}>{t('chem.addPlace')}</Text></TouchableOpacity>
        </Card>

        <Card>
          <Label>{t('chem.sds')}</Label>
          {draft.sds ? <Text style={styles.body}>{draft.sds.name}</Text> : <Text style={styles.sub}>{t('chem.noSdsYet')}</Text>}
          <Text style={styles.sub}>{aiReady(sync.enrolled) ? t('chem.sdsAiHint') : t('chem.sdsHint')}</Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.small} disabled={!!busy} onPress={() => void addSds()}>
              <Text style={styles.smallText}>{busy === 'file' ? t('chem.saving') : busy === 'ai' ? t('rfq.aiReading') : draft.sds ? t('chem.sdsNew') : t('chem.sdsAdd')}</Text>
            </TouchableOpacity>
          </View>
          <Label>{t('chem.sdsDate')}</Label>
          <TextInput style={styles.input} value={draft.sdsDate ?? ''} onChangeText={(v) => set({ sdsDate: v || undefined })} placeholder="yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
          <Label>{t('chem.signal')}</Label>
          <View style={styles.chips}>
            {chip(!draft.signal, t('chem.signal.none'), () => set({ signal: undefined }), 'none')}
            {chip(draft.signal === 'warning', t('chem.signal.warning'), () => set({ signal: 'warning' }), 'warning', COLORS.warning)}
            {chip(draft.signal === 'danger', t('chem.signal.danger'), () => set({ signal: 'danger' }), 'danger', COLORS.danger)}
          </View>
          <Label>{t('chem.ghsTitle')}</Label>
          <View style={styles.chips}>
            {GHS.map((g) => {
              const on = !!draft.ghs?.includes(g);
              return chip(on, `${g} ${tk(`chem.ghs.${g}`)}`, () => set({ ghs: on ? draft.ghs!.filter((x) => x !== g) : [...(draft.ghs ?? []), g as Ghs].sort() }), g);
            })}
          </View>
          <Label>{t('chem.hazards')}</Label>
          <TextInput style={styles.input} value={(draft.hazards ?? []).join('\n')} onChangeText={(v) => set({ hazards: v.split('\n').map((x) => x.trimStart()).filter((x, i, a) => x || i === a.length - 1) })} placeholder="H225 Highly flammable liquid and vapour" placeholderTextColor={COLORS.textLight} multiline />
          {txt('ppe', t('chem.ppe'))}
          {FA.map((k) => (
            <React.Fragment key={k}>
              <Label>{tk(`chem.fa.${k}`)}</Label>
              <TextInput style={styles.input} value={draft.firstAid?.[k] ?? ''} onChangeText={(v) => set({ firstAid: { ...draft.firstAid, [k]: v || undefined } })} multiline />
            </React.Fragment>
          ))}
          {txt('fire', t('chem.fire'))}
          {txt('spill', t('chem.spill'))}
          {txt('storage', t('chem.storage'))}
          {txt('incompatible', t('chem.incompatible'))}
          <Label>{t('chem.un')}</Label>
          <TextInput style={styles.input} value={draft.un ?? ''} onChangeText={(v) => set({ un: v.replace(/\D/g, '').slice(0, 4) || undefined })} keyboardType="number-pad" />
          {txt('notes', t('chem.notes'))}
        </Card>

        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} disabled={!!busy} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => (isNew ? back() : (setDraft(null), setAi(null)))}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
        </View>
      </Screen>
    );
  }

  // ---- the card ----
  const issues = chemIssues(c, risks, today, ptw);
  const ra = raFor(c, risks);
  const raWorst = ra ? worstResidual(ra) : null;
  const sig = signalColor(COLORS, c.signal);
  const para = (label: string, v?: string) => (v ? (
    <View style={{ marginTop: 6 }}>
      <Text style={[styles.sub, { fontWeight: '700' }]}>{label}</Text>
      <Text style={styles.body}>{v}</Text>
    </View>
  ) : null);

  return (
    <Screen scroll>
      <BackButton onPress={back} />
      <ScreenTitle title={c.name} subtitle={[c.maker, tk(`chem.use.${c.use}`), c.un ? `UN ${c.un}` : null].filter(Boolean).join(' · ')} help="Chemicals and safety data sheets" />

      {issues.filter((i) => i !== 'unchecked').map((i) => (
        <Text key={i} style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>
          {i === 'oldSds' ? t('chem.issue.oldSdsOn', { date: uiDate(sdsReviewBy(c.sdsDate!)) }) : tk(`chem.issue.${i}`)}
        </Text>
      ))}

      <View style={[styles.item, { borderLeftColor: sig }]}>
        {c.signal ? <Text style={[styles.name, { color: sig, fontSize: 18 }]}>{tk(`chem.signal.${c.signal}`)}</Text> : <Text style={styles.sub}>{t('chem.noSignal')}</Text>}
        {c.ghs?.length ? (
          <View style={styles.chips}>
            {c.ghs.map((g) => (
              <View key={g} style={[styles.chip, { borderColor: COLORS.danger }]}><Text style={[styles.chipText, { color: COLORS.danger }]}>{`${g} ${tk(`chem.ghs.${g}`)}`}</Text></View>
            ))}
          </View>
        ) : null}
        {(c.hazards ?? []).map((h) => <Text key={h} style={styles.body}>{h}</Text>)}
      </View>

      <Card>
        {para(t('chem.ppe'), c.ppe)}
        {FA.some((k) => c.firstAid?.[k]) ? <Label>{t('chem.firstAid')}</Label> : null}
        {FA.map((k) => <React.Fragment key={k}>{para(tk(`chem.fa.${k}`), c.firstAid?.[k])}</React.Fragment>)}
        {para(t('chem.fire'), c.fire)}
        {para(t('chem.spill'), c.spill)}
        {para(t('chem.storage'), c.storage)}
        {para(t('chem.incompatible'), c.incompatible)}
        {!c.ppe && !c.fire && !c.spill && !FA.some((k) => c.firstAid?.[k]) ? <Text style={styles.sub}>{t('chem.nothingYet')}</Text> : null}
      </Card>

      <Card>
        <Label>{t('chem.where')}</Label>
        {c.stock.length ? c.stock.map((s, i) => <Text key={i} style={styles.body}>{stockLine(s) || '—'}</Text>) : <Text style={styles.sub}>—</Text>}
        {para(t('chem.notes'), c.notes)}
      </Card>

      <Card>
        <Label>{t('chem.sds')}</Label>
        {c.sds ? (
          <>
            <TouchableOpacity onPress={() => void openMedFile(c.sds!.url, c.sds!.name).catch((e) => Alert.alert(t('chem.sds'), String(e?.message ?? e)))}>
              <Text style={styles.link}>{`📄 ${c.sds.name} ›`}</Text>
            </TouchableOpacity>
            <Text style={styles.sub}>{[c.sdsDate ? t('chem.sdsDated', { date: uiDate(c.sdsDate) }) : t('chem.sdsNoDate'), c.sdsLang].filter(Boolean).join(' · ')}</Text>
            {c.checked ? (
              <Text style={[styles.sub, { color: COLORS.success, fontWeight: '700' }]}>{t('chem.checkedBy', { by: c.checked.byRank ? `${c.checked.by} (${c.checked.byRank})` : c.checked.by, at: uiDateTime(c.checked.at) })}</Text>
            ) : (
              <Text style={[styles.sub, { color: COLORS.primary, fontWeight: '700' }]}>{c.byAi ? t('chem.byAiUnchecked') : t('chem.unchecked')}</Text>
            )}
            {officer && !c.checked ? (
              <>
                {picker ? <View style={{ marginTop: 6 }}>{picker}</View> : null}
                <TouchableOpacity style={[styles.small, { alignSelf: 'flex-start', marginTop: 6 }]} onPress={() => void check()}>
                  <Text style={styles.smallText}>{t('chem.check')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </>
        ) : <Text style={styles.sub}>{t('chem.noSdsYet')}</Text>}
      </Card>

      {ptw ? (
        <Card>
          <Label>{t('chem.ra')}</Label>
          {ra ? (
            <TouchableOpacity style={[styles.item, { borderLeftColor: raWorst ? RISK_COLOR[raWorst] : COLORS.border }]} onPress={() => nav.navigate('Risk', { id: ra.id })}>
              <Text style={styles.name}>{[ra.no, ra.title].filter(Boolean).join(' · ')}</Text>
              <Text style={styles.sub}>{ra.approved ? t('permits.approvedBy', { by: ra.approved.by }) : t('permits.notApproved')}</Text>
            </TouchableOpacity>
          ) : <Text style={styles.sub}>{c.signal ? t('chem.raNeeded') : t('chem.raNone')}</Text>}
          {officer ? (
            <View style={styles.row}>
              <TouchableOpacity style={styles.small} onPress={() => newRa(false)}><Text style={styles.smallText}>{t('chem.raOpen')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.small} onPress={() => newRa(true)}><Text style={styles.smallText}>{t('chem.raEnclosed')}</Text></TouchableOpacity>
            </View>
          ) : null}
        </Card>
      ) : null}

      {officer ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => setDraft({ ...stored!, stock: stored!.stock.length ? stored!.stock : [{ place: '' }] })}><Text style={styles.btnText}>{t('common.edit')}</Text></TouchableOpacity>
          <TouchableOpacity onPress={takeOff}><Text style={[styles.link, { color: COLORS.danger }]}>{t('chem.takeOff')}</Text></TouchableOpacity>
        </View>
      ) : null}
    </Screen>
  );
}
