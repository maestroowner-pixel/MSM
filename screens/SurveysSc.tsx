// ===================================
// Surveys & audits — the plan of class, flag, ISM and dry-dock events
// (types/survey.ts, services/surveys.ts).
//
// Overdue and open windows first. "Carried out" records the occasion (signed)
// and moves the plan to the next date. Officers and the Master keep the plan.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useSignConfirm } from '../components/SignConfirm';
import { AmendButtons, AmendNote, useAmend } from '../components/Amend';
import { current as latestVersions } from '../services/versions';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { SURVEY_TEMPLATES, Survey, SurveyDone } from '../types/survey';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { SurveyState, nextDue, sortSurveys } from '../services/surveys';
import { formatDate } from '../utils/dates';
import { annualCoveredBy, defaultScheme, planForCertificate, renewedExpiry } from '../services/certSurveys';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';

const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

export default function SurveysSc() {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { surveys, surveysDone, saveRow, saveRows, appendRow, versionsOf, certificates, saveCertificate } = useData();
  const amend = useAmend();
  const allDone = versionsOf(storage.SURVEYS_DONE_KEY) as SurveyDone[];
  const doneLine = (h: SurveyDone) => [formatDate(h.date), h.ref ? `No. ${h.ref}` : null, h.byRank ? `${h.by} (${h.byRank})` : h.by, h.note].filter(Boolean).join(' · ');
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const isMaster = !sync.enrolled || sync.role === 'superadmin';
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const today = todayIso();
  const rows = useMemo(() => sortSurveys(surveys, today, surveysDone), [surveys, today, surveysDone]);

  const [edit, setEdit] = useState<Survey | null>(null);
  /** `expiry` / `number`: a certificate's renewal gives it new ones. */
  const [doing, setDoing] = useState<{ s: Survey; date: string; ref: string; note: string; expiry: string; number: string } | null>(null);
  const certOf = (sv: Survey) => (sv.certId ? certificates.find((c) => c.id === sv.certId) : undefined);
  const startDoing = (sv: Survey) => {
    const c = sv.kind === 'renewal' ? certOf(sv) : undefined;
    setDoing({ s: sv, date: today, ref: '', note: '', expiry: (c && renewedExpiry(c, today)) ?? '', number: '' });
  };
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const color: Record<SurveyState, string> = { overdue: COLORS.danger, open: COLORS.warning, soon: COLORS.primary, planned: COLORS.textLight, done: COLORS.success };
  const label = (st: ReturnType<typeof sortSurveys>[number]['st']) =>
    st.state === 'overdue' ? `Overdue — window closed ${formatDate(st.closes)}`
    : st.state === 'open' ? `Window open until ${formatDate(st.closes)} · ${st.days} days left`
    : st.state === 'soon' ? `Window opens ${formatDate(st.opens)} · in ${st.days} days`
    : st.state === 'done' ? 'Carried out'
    : `Window ${formatDate(st.opens)} – ${formatDate(st.closes)}`;

  const addTemplate = (t: (typeof SURVEY_TEMPLATES)[number]) => {
    setAdding(false);
    setEdit({ id: uid('sv'), name: t.name, due: '', before: t.before, after: t.after, repeat: t.repeat, anniversary: t.anniversary, ...(t.by ? { by: t.by } : {}), order: surveys.length, updatedAt: Date.now() });
  };
  const saveEdit = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert('Survey', 'Give it a name.');
    if (!isIso(edit.due)) return Alert.alert('Due date', edit.anniversary ? 'Enter the anniversary date, yyyy-mm-dd.' : 'Enter the due date, yyyy-mm-dd.');
    await saveRow(storage.SURVEYS_KEY, { ...edit, name: edit.name.trim() });
    setEdit(null);
    playSuccessSound();
  };
  const carriedOut = async () => {
    if (!doing) return;
    if (!isIso(doing.date) || doing.date > today) return Alert.alert('Date', 'The date it was carried out, yyyy-mm-dd — not in the future.');
    const renewing = doing.s.kind === 'renewal' ? certOf(doing.s) : undefined;
    if (renewing && (!isIso(doing.expiry) || doing.expiry <= doing.date)) return Alert.alert('New expiry', 'The renewed certificate’s expiry date, yyyy-mm-dd.');
    if (!signer) return Alert.alert('Who is recording it?', 'Choose your name below.');
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${doing.s.name} — carried out ${formatDate(doing.date)}` });
    if (!sig) return;
    const now = Date.now();
    const rec: SurveyDone = {
      id: uid('svd'), surveyId: doing.s.id, name: doing.s.name, date: doing.date, forDue: doing.s.due,
      ...(doing.ref.trim() ? { ref: doing.ref.trim() } : {}), ...(doing.note.trim() ? { note: doing.note.trim() } : {}),
      ...(doing.s.certId ? { certId: doing.s.certId } : {}), ...(doing.s.kind ? { kind: doing.s.kind } : {}),
      by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: now, updatedAt: now,
    };
    await appendRow(storage.SURVEYS_DONE_KEY, rec);
    if (doing.s.repeat) await saveRow(storage.SURVEYS_KEY, { ...doing.s, due: nextDue(doing.s, doing.date) });
    // The intermediate takes the place of that year's annual: recorded with it, under the same signature.
    const covered = annualCoveredBy(doing.s, doing.date, surveys, surveysDone);
    if (covered) {
      await appendRow(storage.SURVEYS_DONE_KEY, { ...rec, id: uid('svd'), surveyId: covered.id, name: covered.name, forDue: covered.due, kind: covered.kind, note: `Held with the intermediate survey${rec.note ? ` · ${rec.note}` : ''}` });
    }
    // A renewal: the certificate takes its new dates, and the next cycle is planned from them.
    if (renewing) {
      const renewed = { ...renewing, issueDate: doing.date, expiryDate: doing.expiry, ...(doing.number.trim() ? { number: doing.number.trim() } : {}), updatedAt: now };
      await saveCertificate(renewed);
      const scheme = renewing.surveyScheme ?? defaultScheme(renewing.name);
      const next = planForCertificate(renewed, scheme, today, now).filter((p) => p.include).map((p) => p.survey);
      // What the old cycle still owed is replaced by the new cycle; what it carried out stays.
      const nextIds = new Set(next.map((x) => x.id));
      const left = surveys.filter((x) => x.certId === renewing.id && !x.deleted && x.id !== doing.s.id && !nextIds.has(x.id) && !surveysDone.some((d) => d.surveyId === x.id && d.forDue === x.due)).map((x) => ({ ...x, deleted: true, updatedAt: now }));
      if (next.length + left.length) await saveRows(storage.SURVEYS_KEY, [...next, ...left]);
      Alert.alert('Certificate renewed', `${renewing.name}: valid to ${formatDate(doing.expiry)}; ${next.length} survey${next.length === 1 ? '' : 's'} planned for the new cycle. Attach the new certificate on its card.`);
    }
    setDoing(null);
    playSuccessSound();
  };

  const N = ({ v, on }: { v: number; on: (n: number) => void }) => (
    <TextInput style={[styles.input, styles.num]} value={String(v)} onChangeText={(t) => on(Math.max(0, Math.min(120, Number(t.replace(/\D/g, '')) || 0)))} keyboardType="number-pad" />
  );

  return (
    <Screen scroll>
      <ScreenTitle title="Surveys & audits" subtitle="Class, flag, ISM audits, dry-dock — windows and next dates" help="Surveys & audits" />

      {canEdit ? (
        <View style={styles.row}>
          <TouchableOpacity style={styles.btn} onPress={() => setAdding((v) => !v)}><Text style={styles.btnText}>{adding ? 'Close' : '+ Add'}</Text></TouchableOpacity>
        </View>
      ) : null}
      {adding ? (
        <Card>
          <Label>Choose what applies to the vessel</Label>
          <View style={styles.chips}>
            {SURVEY_TEMPLATES.filter((t) => !surveys.some((s) => s.name === t.name)).map((t) => (
              <TouchableOpacity key={t.name} style={styles.chip} onPress={() => addTemplate(t)}><Text style={styles.chipText}>{t.name}</Text></TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.chip, { borderStyle: 'dashed' }]} onPress={() => addTemplate({ name: '', before: 0, after: 0, repeat: 12, anniversary: false })}><Text style={styles.chipText}>Own…</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {edit ? (
        <Card>
          <TextInput style={styles.input} value={edit.name} onChangeText={(v) => setEdit({ ...edit, name: v })} placeholder="Name" placeholderTextColor={COLORS.textLight} />
          <View style={styles.pair}>
            <TextInput style={styles.input} value={edit.due} onChangeText={(v) => setEdit({ ...edit, due: v })} placeholder={edit.anniversary ? 'Anniversary date yyyy-mm-dd' : 'Due date yyyy-mm-dd'} placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={edit.by ?? ''} onChangeText={(v) => setEdit({ ...edit, by: v })} placeholder="By — class, flag, auditor" placeholderTextColor={COLORS.textLight} />
          </View>
          <View style={styles.pair}>
            <Text style={styles.sub}>Window, months before</Text><N v={edit.before} on={(n) => setEdit({ ...edit, before: n })} />
            <Text style={styles.sub}>after</Text><N v={edit.after} on={(n) => setEdit({ ...edit, after: n })} />
            <Text style={styles.sub}>Repeat every (months, 0 = once)</Text><N v={edit.repeat} on={(n) => setEdit({ ...edit, repeat: n })} />
          </View>
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>Anniversary-based — the next one stays on the anniversary date</Text>
            <Switch value={edit.anniversary} onValueChange={(v) => setEdit({ ...edit, anniversary: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void saveEdit()}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setEdit(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
            {surveys.some((s) => s.id === edit.id) ? (
              <TouchableOpacity onPress={() => Alert.alert('Remove', `Remove “${edit.name}” from the plan? What was carried out stays in the history.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void saveRow(storage.SURVEYS_KEY, { ...edit, deleted: true }); setEdit(null); } }])}>
                <Text style={[styles.link, { color: COLORS.danger }]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>
      ) : null}

      {doing ? (
        <Card>
          <Label>{`${doing.s.name} — carried out`}</Label>
          <View style={styles.pair}>
            <TextInput style={styles.input} value={doing.date} onChangeText={(v) => setDoing({ ...doing, date: v })} placeholder="yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
            <TextInput style={styles.input} value={doing.ref} onChangeText={(v) => setDoing({ ...doing, ref: v })} placeholder="Report / endorsement No." placeholderTextColor={COLORS.textLight} />
          </View>
          <TextInput style={styles.input} value={doing.note} onChangeText={(v) => setDoing({ ...doing, note: v })} placeholder="Findings, conditions of class, remarks" placeholderTextColor={COLORS.textLight} multiline />
          {doing.s.kind === 'renewal' && certOf(doing.s) ? (
            <>
              <Text style={styles.sub}>{`The renewed ${certOf(doing.s)!.name}`}</Text>
              <View style={styles.pair}>
                <TextInput style={styles.input} value={doing.expiry} onChangeText={(v) => setDoing({ ...doing, expiry: v })} placeholder="New expiry yyyy-mm-dd" placeholderTextColor={COLORS.textLight} />
                <TextInput style={styles.input} value={doing.number} onChangeText={(v) => setDoing({ ...doing, number: v })} placeholder="New certificate No." placeholderTextColor={COLORS.textLight} />
              </View>
            </>
          ) : null}
          {doing.s.kind === 'intermediate' && isIso(doing.date) && annualCoveredBy(doing.s, doing.date, surveys, surveysDone) ? (
            <Text style={styles.sub}>{`Also records the ${annualCoveredBy(doing.s, doing.date, surveys, surveysDone)!.name.split(' — ').pop()} — the intermediate takes its place.`}</Text>
          ) : null}
          {doing.s.repeat ? <Text style={styles.sub}>{`Next: ${formatDate(nextDue(doing.s, isIso(doing.date) ? doing.date : today))}`}</Text> : null}
          {picker ? <><Text style={styles.sub}>Recorded by</Text>{picker}</> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void carriedOut()}><Text style={styles.btnText}>Sign</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setDoing(null)}><Text style={styles.link}>Cancel</Text></TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {!rows.length && !edit ? <Empty text={canEdit ? 'Nothing planned yet. Tap + Add and choose the surveys and audits that apply to the vessel.' : 'Nothing planned yet.'} /> : null}
      {rows.map(({ s, st }) => {
        const hist = latestVersions(allDone).filter((d) => d.surveyId === s.id).sort((a, b) => b.date.localeCompare(a.date));
        return (
          <View key={s.id} style={[styles.item, { borderLeftColor: color[st.state] }]}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }} onPress={() => setOpen(open === s.id ? null : s.id)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={[styles.sub, { color: color[st.state], fontWeight: '700' }]}>{label(st)}</Text>
                <Text style={styles.sub}>{[`${s.anniversary ? 'Anniversary' : 'Due'} ${formatDate(s.due)}`, s.repeat ? `every ${s.repeat % 12 ? `${s.repeat} months` : `${s.repeat / 12} year${s.repeat > 12 ? 's' : ''}`}` : 'once', s.by].filter(Boolean).join(' · ')}</Text>
              </View>
              {canEdit && st.state !== 'done' ? (
                <TouchableOpacity style={styles.small} onPress={() => startDoing(s)}><Text style={styles.smallText}>Carried out</Text></TouchableOpacity>
              ) : null}
              {canEdit ? <TouchableOpacity onPress={() => setEdit(s)} hitSlop={8}><MciIcon name="pencil-outline" size={18} color={COLORS.textLight} /></TouchableOpacity> : null}
            </TouchableOpacity>
            {open === s.id ? (
              hist.length ? (
                hist.map((h) => (
                  <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SIZES.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.hist, h.cancelled && { textDecorationLine: 'line-through', color: COLORS.textLight }]}>{doneLine(h)}</Text>
                      <AmendNote rec={h} all={allDone} summary={doneLine} />
                    </View>
                    {!h.cancelled ? (
                      <AmendButtons
                        row
                        isMaster={isMaster}
                        onEdit={() => amend.edit({ store: storage.SURVEYS_DONE_KEY, record: h, what: `${h.name} — carried out ${formatDate(h.date)}`, fields: [{ key: 'date', label: 'Date carried out (yyyy-mm-dd)' }, { key: 'ref', label: 'Report / endorsement No.' }, { key: 'note', label: 'Findings, remarks', kind: 'multiline' }] })}
                        onDelete={() =>
                          amend.remove({
                            store: storage.SURVEYS_DONE_KEY,
                            record: h,
                            what: `${h.name} — carried out ${formatDate(h.date)}`,
                            // It did not happen: the plan goes back to the date it answered.
                            onDone: async () => {
                              if (s.repeat && s.due === nextDue({ ...s, due: h.forDue }, h.date)) await saveRow(storage.SURVEYS_KEY, { ...s, due: h.forDue });
                            },
                          })
                        }
                      />
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.hist}>Not carried out in the app yet.</Text>
              )
            ) : null}
          </View>
        );
      })}
      {amend.ui}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginVertical: SIZES.sm, flexWrap: 'wrap' },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    link: { color: COLORS.primary, fontWeight: '700' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    pair: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, alignItems: 'center' },
    input: { flex: 1, minWidth: 160, ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.xs },
    num: { flex: 0, minWidth: 56, width: 56, textAlign: 'center' },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    toggleText: { flex: 1, fontSize: SIZES.small, color: COLORS.textDark },
    item: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs, borderLeftWidth: 4 },
    name: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    small: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingVertical: 6, paddingHorizontal: SIZES.sm },
    smallText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    hist: { fontSize: SIZES.small, color: COLORS.textDark, marginTop: SIZES.xs, paddingLeft: SIZES.sm },
  });
