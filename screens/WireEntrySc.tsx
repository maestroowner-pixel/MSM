// ===================================
// One entry in a rope's log (types/wireLog.ts, plan item 67): a look at its
// condition (rating, the diameter measured, broken wires, what was found,
// photos), cut and slip, end for end, lubrication, a brake test, or the rope
// renewed. Signed, then never changed — a mistake is a new entry. A renewal is
// an officer's: with the same signature it writes the new rope onto the item.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { Card, Empty, Label, Screen, ScreenTitle } from '../components/ui';
import SimpleDatePicker from '../components/SimpleDatePicker';
import { PhotoPicker } from '../components/PhotoPicker';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { roleAtLeast } from '../types/role';
import { Attachment } from '../types/equipment';
import { WIRE_ENDS, WIRE_FINDINGS, WIRE_KINDS, WIRE_KIND_EN, WIRE_RATINGS, WireEnd, WireEntry, WireFinding, WireKind, WireRating } from '../types/wireLog';
import { isWire, renewItem, wireProblem, wireState } from '../services/wireLog';
import * as photoQueue from '../services/photoQueue';
import * as storage from '../services/storage';
import { CATEGORY_MAP } from '../constants/categories';
import { SIZES, Palette } from '../theme';
import { shipToday } from '../utils/shipTime';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, useT } from '../utils/i18n';

/** "28,5" → 28.5; empty or nonsense → none. */
export const decOf = (s: string): number | undefined => {
  const v = Number(s.replace(',', '.').replace(/[^0-9.]/g, ''));
  return s.trim() && isFinite(v) && v > 0 ? v : undefined;
};

export const RATING_COLOR: Record<WireRating, string> = { good: '#16a34a', fair: '#0d9488', poor: '#d97706', discard: '#dc2626' };

export default function WireEntrySc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const params = useRoute<any>().params ?? {};
  const { flat, wireLog, vessel, appendRow, saveItem } = useData();
  const sync = useSync();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner(t('rope.signedBy'));
  const item = flat.find((x) => x.id === params.itemId);

  const [kind, setKind] = useState<WireKind>(WIRE_KINDS.includes(params.kind) ? params.kind : 'inspect');
  const [date, setDate] = useState(shipToday());
  const [rating, setRating] = useState<WireRating | undefined>();
  const [dia, setDia] = useState('');
  const [broken, setBroken] = useState('');
  const [findings, setFindings] = useState<WireFinding[]>([]);
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [cut, setCut] = useState('');
  const [end, setEnd] = useState<WireEnd>('outboard');
  const [brakeOk, setBrakeOk] = useState<boolean | undefined>();
  const [load, setLoad] = useState('');
  const [len, setLen] = useState('');
  const [diaNew, setDiaNew] = useState('');
  const [cert, setCert] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (!item) {
    return (
      <Screen>
        <ScreenTitle title={t('rope.title')} />
        <Empty text={t('rp.noItem')} />
      </Screen>
    );
  }
  const state = wireState(item, wireLog, date);
  const wire = isWire(item);
  const kinds = WIRE_KINDS.filter((k) => k !== 'renewed' || officer);
  const name = [item.type || item.make, item.marking, item.no != null ? `No. ${item.no}` : null].filter(Boolean).join(' ') || CATEGORY_MAP[item.category]?.label || '';

  const chip = (on: boolean, label: string, press: () => void, key: string, color?: string) => (
    <TouchableOpacity key={key} style={[styles.chip, color ? { borderColor: color } : null, on && [styles.chipOn, color ? { backgroundColor: color } : null]]} onPress={press}>
      <Text style={[styles.chipText, color ? { color } : null, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const num = (value: string, set: (s: string) => void, label: string, ph?: string) => (
    <View style={styles.flex}>
      <Text style={styles.small}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={set} keyboardType="decimal-pad" placeholder={ph ?? '—'} placeholderTextColor={COLORS.textLight} />
    </View>
  );

  const build = (): Omit<WireEntry, 'by' | 'at' | 'createdAt' | 'updatedAt'> => {
    const base = { id: uid('wl'), itemId: item.id, kind, date, ...(note.trim() ? { note: note.trim() } : {}) };
    if (kind === 'inspect') {
      const d = decOf(dia);
      const b = parseInt(broken, 10);
      return { ...base, ...(rating ? { rating } : {}), ...(d ? { diameterMm: d } : {}), ...(wire && broken.trim() && b >= 0 ? { brokenWires: b } : {}), ...(findings.length ? { findings } : {}), ...(photos.length ? { photos } : {}) };
    }
    if (kind === 'cutSlip') return { ...base, ...(decOf(cut) ? { cutM: decOf(cut) } : {}), end };
    if (kind === 'brake') return { ...base, ...(brakeOk != null ? { brakeOk } : {}), ...(load.trim() ? { brakeLoad: load.trim() } : {}) };
    if (kind === 'renewed') return { ...base, ...(decOf(len) ? { lengthM: decOf(len) } : {}), ...(decOf(diaNew) ? { diaNew: decOf(diaNew) } : {}), ...(cert.trim() ? { certNo: cert.trim() } : {}) };
    return base;
  };

  const save = async () => {
    const draft = build();
    const problem = wireProblem(draft, state.length);
    if (problem) return Alert.alert(t('rope.title'), tk(`rope.need.${problem}`));
    if (!signer) return Alert.alert(t('round.whoSigns'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${WIRE_KIND_EN[kind]} — ${name}` });
    if (!sig) return;
    setBusy(true);
    try {
      const now = Date.now();
      const e: WireEntry = { ...draft, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), at: now, createdAt: now, updatedAt: now };
      await appendRow(storage.WIRE_LOG_KEY, e);
      if (e.photos?.length && vessel?.imo) await photoQueue.enqueueInspection(vessel.imo, e);
      if (kind === 'renewed') await saveItem(renewItem(item, e, now));
      playSuccessSound();
      goBackOr(nav);
    } catch (err: any) {
      Alert.alert(t('rope.title'), String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (f: WireFinding) => setFindings((l) => (l.includes(f) ? l.filter((x) => x !== f) : [...l, f]));
  const cutNow = decOf(cut);

  return (
    <Screen scroll>
      <ScreenTitle title={t('rope.new')} subtitle={[CATEGORY_MAP[item.category]?.label, name, item.diameter].filter(Boolean).join(' · ')} help="Ropes and wires" />

      <Label>{t('rope.kind')}</Label>
      <View style={styles.chips}>{kinds.map((k) => chip(kind === k, tk(`rope.k.${k}`), () => setKind(k), k))}</View>
      <View style={{ marginTop: SIZES.sm }}>
        <SimpleDatePicker label={t('rope.date')} value={date} onChange={setDate} />
      </View>

      {kind === 'inspect' ? (
        <>
          <Label>{t('rope.rating')}</Label>
          <View style={styles.chips}>{WIRE_RATINGS.map((r) => chip(rating === r, tk(`rope.r.${r}`), () => setRating(r), r, RATING_COLOR[r]))}</View>
          <Card>
            <View style={styles.row}>
              {num(dia, setDia, t('rope.dia'), state.nominal ? t('rope.diaPh', { n: state.nominal }) : undefined)}
              {wire ? (
                <View style={styles.flex}>
                  <Text style={styles.small}>{t('rope.broken')}</Text>
                  <TextInput style={styles.input} value={broken} onChangeText={(s) => setBroken(s.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="—" placeholderTextColor={COLORS.textLight} />
                </View>
              ) : null}
            </View>
            {decOf(dia) && state.nominal ? (
              <Text style={[styles.small, { color: state.discardAt != null && decOf(dia)! <= state.discardAt ? '#dc2626' : COLORS.primary, fontWeight: '700' }]}>
                {t('rope.lossNow', { pct: Math.max(0, Math.round(((state.nominal - decOf(dia)!) / state.nominal) * 1000) / 10), at: state.discardAt ?? '—' })}
              </Text>
            ) : null}
            <Text style={styles.small}>{t('rope.diaHow')}</Text>
          </Card>
          <Label>{t('rope.found')}</Label>
          <View style={styles.chips}>
            {WIRE_FINDINGS.filter((f) => wire || (f !== 'birdcage' && f !== 'corrosion')).map((f) => chip(findings.includes(f), tk(`rope.f.${f}`), () => toggle(f), f))}
          </View>
          <PhotoPicker photos={photos} onChange={setPhotos} hint={t('rope.photo')} />
        </>
      ) : null}

      {kind === 'cutSlip' ? (
        <Card>
          <View style={styles.row}>{num(cut, setCut, t('rope.cut'))}</View>
          <View style={styles.chips}>{WIRE_ENDS.map((x) => chip(end === x, tk(`rope.end.${x}`), () => setEnd(x), x))}</View>
          {state.length != null ? (
            <Text style={styles.small}>{t('rope.lengthLeft', { now: state.length, after: cutNow ? Math.round((state.length - cutNow) * 10) / 10 : state.length })}{state.minLength != null ? ` · ${t('rope.minLen', { n: state.minLength })}` : ''}</Text>
          ) : (
            <Text style={styles.small}>{t('rope.noLength')}</Text>
          )}
        </Card>
      ) : null}

      {kind === 'brake' ? (
        <Card>
          <View style={styles.chips}>
            {chip(brakeOk === true, t('rope.brakeOk'), () => setBrakeOk(true), 'ok', '#16a34a')}
            {chip(brakeOk === false, t('rope.brakeFail'), () => setBrakeOk(false), 'fail', '#dc2626')}
          </View>
          <Text style={styles.small}>{t('rope.load')}</Text>
          <TextInput style={styles.input} value={load} onChangeText={setLoad} placeholder={t('rope.loadPh')} placeholderTextColor={COLORS.textLight} />
        </Card>
      ) : null}

      {kind === 'renewed' ? (
        <Card>
          <View style={styles.row}>
            {num(len, setLen, t('rope.newLen'), item.ropeLength ? String(item.ropeLength) : undefined)}
            {num(diaNew, setDiaNew, t('rope.newDia'), state.nominal ? String(state.nominal) : undefined)}
          </View>
          <Text style={styles.small}>{t('rope.cert')}</Text>
          <TextInput style={styles.input} value={cert} onChangeText={setCert} placeholder={item.testCertNo ?? '—'} placeholderTextColor={COLORS.textLight} />
          <Text style={[styles.small, { marginTop: SIZES.sm }]}>{t('rope.renewNote')}</Text>
        </Card>
      ) : null}

      {kind === 'endForEnd' ? <Text style={styles.small}>{t('rope.e4eNote')}</Text> : null}

      <Label>{t('rope.note')}</Label>
      <TextInput style={[styles.input, { minHeight: 60 }]} value={note} onChangeText={setNote} multiline placeholder={t('rope.notePh')} placeholderTextColor={COLORS.textLight} />

      {picker}
      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => void save()}>
        <Text style={styles.btnText}>{busy ? '…' : t('rope.sign')}</Text>
      </TouchableOpacity>
      <Text style={styles.small}>{t('rope.after')}</Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginVertical: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4 },
    row: { flexDirection: 'row', gap: SIZES.sm, marginBottom: SIZES.sm },
    flex: { flex: 1, minWidth: 0 },
    small: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    btn: { marginTop: SIZES.md, marginBottom: SIZES.sm, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
