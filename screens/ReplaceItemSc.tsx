// ===================================
// Replaced — the signed record that a piece of equipment, or a part of it, was
// replaced (services/replacements.ts; Sven, 3 Nov 2026). Opened from the item's
// lifecycle card. The new details are written onto the item with the same
// signature; the item keeps its id and label; an open defect can be closed here.
// Officers and the Master (rules: item_movements).
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { signatureLine } from '../types/crew';
import { ReplaceSnap } from '../types/movement';
import { SIZES, Palette } from '../theme';
import { COMMON_PARTS, REPLACE_REASONS, ReplaceForm, ReplaceReason, changeLine, changesOf, formProblem, replace, snapOf } from '../services/replacements';
import * as inspections from '../services/inspections';
import { CATEGORY_MAP } from '../constants/categories';
import { shipToday } from '../utils/shipTime';
import { uiDate } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { t, tk, useT } from '../utils/i18n';

export default function ReplaceItemSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { id } = useRoute<any>().params ?? {};
  const { flat, inspections: trail, saveItem, saveMovement, saveInspection } = useData();
  const sync = useSync();
  const canRecord = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner('REPLACED BY');
  const item = flat.find((x) => x.id === id);
  const open = useMemo(() => (item ? inspections.openDefectsForItem(trail, item.id) : []), [trail, item]);

  const [what, setWhat] = useState<'unit' | 'part'>('unit');
  const [part, setPart] = useState('');
  const [reason, setReason] = useState<ReplaceReason>('expired');
  const [date, setDate] = useState(shipToday());
  const [note, setNote] = useState('');
  const [after, setAfter] = useState<ReplaceSnap>({});
  const [closes, setCloses] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!item) {
    return (
      <Screen>
        <ScreenTitle title={t('rp.title')} />
        <Empty text={t('rp.noItem')} />
      </Screen>
    );
  }
  if (!canRecord) {
    return (
      <Screen>
        <ScreenTitle title={t('rp.title')} />
        <Empty text={t('rp.officers')} />
      </Screen>
    );
  }

  const was = snapOf(item);
  const set = (p: ReplaceSnap) => setAfter((a) => ({ ...a, ...p }));
  const form: ReplaceForm = {
    what,
    ...(what === 'part' ? { part } : {}),
    reason,
    date,
    note,
    after,
    ...(open.length && closes ? { defectInspId: open[0].id } : {}),
  };
  const preview = changeLine(changesOf(item, after));

  const save = async () => {
    const problem = formProblem(item, form);
    if (problem) return Alert.alert(t('rp.title'), tk(`rp.need.${problem}`));
    if (!signer) return Alert.alert(t('round.whoSigns'), t('round.chooseName'));
    const name = [item.no, item.type ?? item.make].filter(Boolean).join(' ') || CATEGORY_MAP[item.category]?.label || '';
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${what === 'part' ? part.trim() : 'Unit'} replaced — ${name}` });
    if (!sig) return;
    setBusy(true);
    try {
      const now = Date.now();
      const r = replace(item, form, { name: signer.name, ...(signer.rank ? { rank: signer.rank } : {}) }, now, uid, sig.proof);
      await saveMovement(r.movement);
      await saveItem(r.item);
      if (form.defectInspId) {
        const insp = open[0];
        const how = [what === 'part' ? `${part.trim()} replaced` : 'Unit replaced', preview, note.trim()].filter(Boolean).join(' — ');
        await saveInspection(inspections.closeDefect(insp, signatureLine(signer.name, signer.rank), how, now, sig.proof));
      }
      goBackOr(nav);
    } catch (e: any) {
      Alert.alert(t('rp.title'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean, label: string, press: () => void) => (
    <TouchableOpacity key={label} style={[styles.chip, on && styles.chipOn]} onPress={press}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const field = (k: keyof ReplaceSnap, label: string) => (
    <View style={styles.flex}>
      <Text style={styles.small}>{label}</Text>
      <TextInput style={styles.input} value={after[k] ?? ''} onChangeText={(x) => set({ [k]: x })} placeholder={was[k] ?? '—'} placeholderTextColor={COLORS.textLight} />
    </View>
  );
  const dateField = (k: keyof ReplaceSnap, label: string) => (
    <View style={styles.flex}>
      <SimpleDatePicker label={label} value={after[k]} onChange={(d) => set({ [k]: d })} onClear={() => set({ [k]: undefined })} />
      {was[k] ? <Text style={styles.small}>{t('rp.was', { v: uiDate(was[k]!) })}</Text> : null}
    </View>
  );

  return (
    <Screen scroll>
      <ScreenTitle
        title={t('rp.title')}
        subtitle={[CATEGORY_MAP[item.category]?.label, item.no != null ? `No. ${item.no}` : null, item.type ?? item.make, item.serial].filter(Boolean).join(' · ')}
        help="Equipment & categories"
      />
      <Text style={styles.lead}>{t('rp.lead')}</Text>

      <Label>{t('rp.what')}</Label>
      <View style={styles.chips}>
        {chip(what === 'unit', t('rp.unit'), () => setWhat('unit'))}
        {chip(what === 'part', t('rp.part'), () => setWhat('part'))}
      </View>
      {what === 'part' ? (
        <>
          <View style={styles.chips}>{COMMON_PARTS.map((p) => chip(part === p, p, () => setPart(p)))}</View>
          <TextInput style={styles.input} value={part} onChangeText={setPart} placeholder={t('rp.partPh')} placeholderTextColor={COLORS.textLight} />
        </>
      ) : null}

      <Label>{t('rp.why')}</Label>
      <View style={styles.chips}>{REPLACE_REASONS.map((r) => chip(reason === r, tk(`rp.reason.${r}`), () => setReason(r)))}</View>

      <View style={{ marginTop: SIZES.sm }}>
        <SimpleDatePicker label={t('rp.date')} value={date} onChange={setDate} />
      </View>

      <Label>{what === 'unit' ? t('rp.newUnit') : t('rp.newDates')}</Label>
      <Card>
        {what === 'unit' ? (
          <>
            <View style={styles.row}>
              {field('make', t('rp.make'))}
              {field('type', t('rp.type'))}
            </View>
            <View style={styles.row}>{field('serial', t('rp.serial'))}</View>
            <View style={styles.row}>{dateField('manufactureDate', t('rp.made'))}</View>
          </>
        ) : null}
        <View style={styles.row}>{dateField('expiry', t('rp.expiry'))}</View>
        <View style={styles.row}>{dateField('nextInspection', t('rp.nextInsp'))}</View>
        {preview ? <Text style={styles.preview}>{preview}</Text> : null}
      </Card>

      <Label>{t('rp.note')}</Label>
      <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote} multiline placeholder={t('rp.notePh')} placeholderTextColor={COLORS.textLight} />

      {open.length ? (
        <View style={styles.defect}>
          <View style={styles.flex}>
            <Text style={styles.title}>{t('rp.closesDefect')}</Text>
            <Text style={styles.small} numberOfLines={2}>{open[0].defect?.note}</Text>
          </View>
          <Switch value={closes} onValueChange={setCloses} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
        </View>
      ) : null}

      {picker}
      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => void save()}>
        <Text style={styles.btnText}>{busy ? '…' : t('rp.sign')}</Text>
      </TouchableOpacity>
      <Text style={styles.small}>{t('rp.after')}</Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    lead: { fontSize: SIZES.body, color: COLORS.text, marginBottom: SIZES.sm, lineHeight: 21 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginVertical: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    row: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
    // minWidth 0: a web input will not shrink below its default width otherwise.
    flex: { flex: 1, minWidth: 0 },
    small: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    title: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    preview: { fontSize: SIZES.small, color: COLORS.primary, fontWeight: '700', marginTop: SIZES.xs },
    defect: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.md },
    btn: { marginTop: SIZES.md, marginBottom: SIZES.sm, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
