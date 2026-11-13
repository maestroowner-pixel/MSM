// ===================================
// The company's own appraisal form (types/appraisal.ts ApForm, 13 Nov 2026):
// its sections, criteria, scale and written questions — typed in the editor's
// wording, started from the app's standard form, or read from the company's
// paper form by the AI (functions/ai.js `apform`) and checked against the paper.
// The Master sets it (the office may too, rules `ap_form`); a new appraisal takes
// a copy, so a change here never rewrites one already written. A line that keeps
// its text keeps its id (services/appraisals.ts formFromText).
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Label, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import * as storage from '../services/storage';
import { ApForm } from '../types/appraisal';
import { STANDARD_FORM, apFormFromReply, ApFormReply, formFromText, formProblem, formText } from '../services/appraisals';
import { aiCall, aiReady } from '../services/ai';
import { PickedFile, pickDocument, pickFromCamera, pickFromLibrary, toDataUri } from '../services/attachments';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { makeStyles } from './SafetySc';
import { t, tk, useT } from '../utils/i18n';

const MAX_AI_BYTES = 10 * 1024 * 1024;
const SYNTAX: [string, string][] = [
  ['Scale: Poor | Fair | Good | Excellent', 'apf.syn.scale'],
  ['## Professional competence', 'apf.syn.section'],
  ['Knowledge of duties', 'apf.syn.criterion'],
  ['Leadership *officers', 'apf.syn.officers'],
  ['@text Training recommended', 'apf.syn.text'],
];

export default function ApFormSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { apForm, saveRow } = useData();
  const sync = useSync();
  // The Master's (or a device on no vessel); officers see it.
  const mayEdit = !sync.enrolled || sync.role === 'superadmin';
  const stored = apForm.find((f) => f.id === 'form');
  const [title, setTitle] = useState(stored?.title ?? '');
  const [text, setText] = useState(stored ? formText(stored) : '');
  const [on, setOn] = useState(stored ? !stored.off : true);
  const [busy, setBusy] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  useEffect(() => {
    if (!stored) return;
    setTitle(stored.title);
    setText(formText(stored));
    setOn(!stored.off);
  }, [stored?.updatedAt]);

  const parsed = useMemo(() => formFromText(text, stored?.items ?? [], () => uid('apf')), [text, stored?.items]);
  const counts = {
    s: parsed.items.filter((i) => i.kind === 'section').length,
    c: parsed.items.filter((i) => !i.kind).length,
    q: parsed.items.filter((i) => i.kind === 'text').length,
  };

  /** The company's paper form → the editor, through the AI; the Master checks it against the paper. */
  const readPaper = () => {
    const go = (picker: () => Promise<PickedFile | null>) => async () => {
      const f = await picker();
      if (!f) return;
      setBusy(t('dpt.reading'));
      try {
        const dataUri = await toDataUri(f.uri, f.name ?? 'form.pdf');
        const mediaType = dataUri.slice(5, dataUri.indexOf(';'));
        const data = dataUri.slice(dataUri.indexOf(',') + 1);
        if (data.length * 0.75 > MAX_AI_BYTES) throw new Error(t('dpt.tooBig'));
        const r = apFormFromReply(await aiCall<ApFormReply>('apform', { mediaType, data }));
        if (!r.lines) throw new Error(r.unreadable || t('dpt.unreadable'));
        if (r.title) setTitle(r.title);
        setText(r.text);
        setAiNote(`${t('dpt.readN', { n: r.lines })}${r.unreadable ? ` · ${t('dpt.couldNot', { what: r.unreadable })}` : ''}. ${t('dpt.checkPaper')}`);
      } catch (e: any) {
        Alert.alert(t('apf.paper'), String(e?.message ?? e));
      } finally {
        setBusy(null);
      }
    };
    Alert.alert(t('apf.paper'), t('apf.paperBody'), [
      { text: t('pick.document'), onPress: go(pickDocument) },
      { text: t('pick.library'), onPress: go(pickFromLibrary) },
      { text: t('pick.camera'), onPress: go(pickFromCamera) },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const save = async () => {
    const scale = parsed.scale ?? stored?.scale ?? [];
    const next: ApForm = { id: 'form', title: title.trim(), scale, items: parsed.items, ...(on ? {} : { off: true }), ...(sync.me ? { by: `${sync.me.firstName ?? ''} ${sync.me.lastName ?? ''}`.trim() } : {}), updatedAt: Date.now() };
    const why = formProblem(next);
    if (why && on) return Alert.alert(t('apf.title'), tk(`apf.need.${why}`));
    await saveRow(storage.AP_FORM_KEY, JSON.parse(JSON.stringify(next)));
    playSuccessSound();
    goBackOr(nav, 'Appraisals');
  };

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav, 'Appraisals')} />
      <ScreenTitle title={t('apf.title')} subtitle={t('apf.sub')} help="Crew appraisals" />
      {!mayEdit ? <Text style={[styles.sub, { marginBottom: SIZES.sm }]}>{t('apf.masterOnly')}</Text> : null}

      <Card>
        <View style={styles.toggle}>
          <Text style={[styles.toggleText, { flex: 1 }]}>{t('apf.use')}</Text>
          <Switch value={on} disabled={!mayEdit} onValueChange={setOn} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
        </View>
        {!on ? <Text style={styles.sub}>{t('apf.offHint')}</Text> : null}

        <Label>{t('apf.name')}</Label>
        <TextInput style={styles.input} value={title} editable={mayEdit} onChangeText={setTitle} placeholder={t('apf.namePh')} placeholderTextColor={COLORS.textLight} />

        {mayEdit ? (
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            {aiReady(sync.enrolled) ? (
              <TouchableOpacity style={styles.btn} onPress={readPaper} disabled={!!busy}><Text style={styles.btnText}>{t('apf.paper')}</Text></TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => { if (!title.trim()) setTitle(STANDARD_FORM.title); setText(formText(STANDARD_FORM)); }} disabled={!!busy}>
              <Text style={styles.link}>{t('apf.fromStandard')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {busy ? <View style={{ flexDirection: 'row', gap: SIZES.sm, alignItems: 'center', marginTop: SIZES.sm }}><ActivityIndicator color={COLORS.primary} /><Text style={styles.sub}>{busy}</Text></View> : null}
        {aiNote ? <Text style={[styles.sub, { color: COLORS.warning, fontWeight: '700' }]}>{aiNote}</Text> : null}

        <Label>{t('apf.form')}</Label>
        <TextInput
          style={[styles.input, { minHeight: 260, textAlignVertical: 'top', fontFamily: 'monospace' }]}
          value={text}
          editable={mayEdit}
          onChangeText={setText}
          multiline
          autoCapitalize="sentences"
          placeholder={SYNTAX.map(([x]) => x).join('\n')}
          placeholderTextColor={COLORS.textLight}
        />
        <Text style={[styles.sub, { fontWeight: '700' }]}>
          {t('apf.counts', { s: counts.s, c: counts.c, q: counts.q, n: (parsed.scale ?? stored?.scale ?? []).length })}
        </Text>
        {SYNTAX.map(([x, k]) => (
          <Text key={k} style={styles.sub}><Text style={{ fontFamily: 'monospace', color: COLORS.textDark }}>{x}</Text>{`  — ${tk(k)}`}</Text>
        ))}
        <Text style={styles.sub}>{t('apf.fixed')}</Text>

        {mayEdit ? (
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}><Text style={styles.btnText}>{t('common.save')}</Text></TouchableOpacity>
          </View>
        ) : null}
      </Card>
    </Screen>
  );
}
