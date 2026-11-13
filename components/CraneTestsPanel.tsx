// ===================================
// Crane load tests and examinations (types/craneLog.ts → CraneTest), the
// "Tests" tab of the crane log: per crane, the last test of each kind and the
// next due, worst first; the officer records a new one and signs it. A pass
// writes the certificate number and the next due onto the crane on the
// register (services/craneLog.ts applyTest), so Readiness and the Board see it.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Empty, Label } from './ui';
import SimpleDatePicker from './SimpleDatePicker';
import { useSignConfirm } from './SignConfirm';
import { useSigner } from './SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { isAboard } from '../types/crew';
import { CRANE_TEST_EN, CRANE_TEST_KINDS, CraneTest, CraneTestKind } from '../types/craneLog';
import { applyTest, craneSnap, testProblem, testsDue } from '../services/craneLog';
import * as storage from '../services/storage';
import { EquipmentItem } from '../types/equipment';
import { SIZES, Palette } from '../theme';
import { shipToday } from '../utils/shipTime';
import { uid } from '../utils/id';
import { playSuccessSound } from '../utils/sound';
import { t, tk, useT } from '../utils/i18n';

const dmy = (iso: string) => iso.split('-').reverse().join('.');
const LEVEL: Record<'red' | 'amber' | 'ok', string> = { red: '#dc2626', amber: '#d97706', ok: '#16a34a' };

export function CraneTestsPanel({ cranes, officer }: { cranes: EquipmentItem[]; officer: boolean }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { crew, craneTests, appendRow, saveItem } = useData();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner(t('crane.confirmedBy'));
  const today = shipToday();
  const aboard = useMemo(() => crew.filter(isAboard).sort((a, b) => a.name.localeCompare(b.name)), [crew]);

  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState('');
  const [kind, setKind] = useState<CraneTestKind>('annual');
  const [date, setDate] = useState(today);
  const [load, setLoad] = useState('');
  const [pct, setPct] = useState('');
  const [radius, setRadius] = useState('');
  const [result, setResult] = useState<'pass' | 'fail'>('pass');
  const [examiner, setExaminer] = useState('');
  const [cert, setCert] = useState('');
  const [due, setDue] = useState('');
  const [crewId, setCrewId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const item = cranes.find((c) => c.id === itemId) ?? (cranes.length === 1 ? cranes[0] : undefined);

  const chip = (on: boolean, label: string, press: () => void, key: string, color?: string) => (
    <TouchableOpacity key={key} style={[styles.chip, color ? { borderColor: color } : null, on && [styles.chipOn, color ? { backgroundColor: color } : null]]} onPress={press}>
      <Text style={[styles.chipText, color ? { color } : null, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
  const field = (value: string, set: (s: string) => void, label: string, ph?: string, numeric?: boolean) => (
    <View style={styles.flex}>
      <Text style={styles.small}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={numeric ? (s) => set(s.replace(/[^\d.,]/g, '')) : set} keyboardType={numeric ? 'decimal-pad' : 'default'} placeholder={ph ?? '—'} placeholderTextColor={COLORS.textLight} />
    </View>
  );

  const save = async () => {
    if (!item) return Alert.alert(t('crane.tests'), tk('crane.tneed.crane'));
    const person = crew.find((c) => c.id === crewId);
    const p = parseFloat(pct.replace(',', '.'));
    const draft = {
      id: uid('ct'),
      itemId: item.id,
      crane: craneSnap(item),
      kind,
      date,
      ...(load.trim() ? { testLoad: load.trim() } : {}),
      ...(pct.trim() && Number.isFinite(p) ? { pctSwl: p } : {}),
      ...(radius.trim() ? { radius: radius.trim() } : {}),
      result,
      ...(examiner.trim() ? { examiner: examiner.trim() } : {}),
      ...(cert.trim() ? { certNo: cert.trim() } : {}),
      ...(due ? { nextDue: due } : {}),
      ...(person ? { crewId: person.id, name: person.name, ...(person.rank ? { rank: person.rank } : {}) } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    const problem = testProblem(draft, today);
    if (problem) return Alert.alert(t('crane.tests'), tk(`crane.tneed.${problem}`));
    if (!signer) return Alert.alert(t('round.whoSigns'), t('round.chooseName'));
    const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `${CRANE_TEST_EN[kind]} — ${draft.crane.label}` });
    if (!sig) return;
    setBusy(true);
    try {
      const now = Date.now();
      const x: CraneTest = { ...draft, by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), ...(sig.proof ? { signedWith: sig.proof } : {}), at: now, createdAt: now, updatedAt: now };
      await appendRow(storage.CRANE_TESTS_KEY, x);
      const next = applyTest(item, x, now);
      if (next) await saveItem(next);
      playSuccessSound();
      setOpen(false);
      setLoad('');
      setPct('');
      setRadius('');
      setCert('');
      setDue('');
      setNote('');
      setResult('pass');
    } catch (err: any) {
      Alert.alert(t('crane.tests'), String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {officer && !open ? (
        <TouchableOpacity style={styles.btn} onPress={() => setOpen(true)}>
          <Text style={styles.btnText}>{t('crane.newTest')}</Text>
        </TouchableOpacity>
      ) : null}
      {open ? (
        <Card>
          <Label>{t('crane.crane')}</Label>
          {cranes.length ? <View style={styles.chips}>{cranes.map((c) => chip(item?.id === c.id, craneSnap(c).label, () => setItemId(c.id), c.id))}</View> : <Text style={styles.small}>{t('crane.noCranes')}</Text>}
          {item ? <Text style={styles.small}>{[item.make, item.type, item.swl ? `SWL ${item.swl}` : t('crane.noSwl')].filter(Boolean).join(' · ')}</Text> : null}
          <Label>{t('crane.testKind')}</Label>
          <View style={styles.chips}>{CRANE_TEST_KINDS.map((k) => chip(kind === k, tk(`crane.t.${k}`), () => setKind(k), k))}</View>
          <View style={{ marginTop: SIZES.sm }}>
            <SimpleDatePicker label={t('crane.testDate')} value={date} onChange={(d) => setDate(d || today)} />
          </View>
          <View style={styles.row}>
            {field(load, setLoad, t('crane.testLoad'), '15 t')}
            {field(pct, setPct, t('crane.pctSwl'), '125', true)}
            {field(radius, setRadius, t('crane.radius'), '18 m')}
          </View>
          <Label>{t('crane.result')}</Label>
          <View style={styles.chips}>
            {chip(result === 'pass', t('crane.pass'), () => setResult('pass'), 'pass', LEVEL.ok)}
            {chip(result === 'fail', t('crane.fail'), () => setResult('fail'), 'fail', LEVEL.red)}
          </View>
          <View style={styles.row}>
            {field(examiner, setExaminer, t('crane.examiner'), t('crane.examinerPh'))}
            {field(cert, setCert, t('crane.cert'), item?.testCertNo)}
          </View>
          <SimpleDatePicker label={t('crane.nextDue')} value={due} onChange={(d) => setDue(d || '')} />
          <Label>{t('crane.testOperator')}</Label>
          <View style={styles.chips}>
            {chip(!crewId, t('crane.noOperator'), () => setCrewId(''), 'none')}
            {aboard.map((c) => chip(crewId === c.id, c.rank ? `${c.name} · ${c.rank}` : c.name, () => setCrewId(c.id), c.id))}
          </View>
          <Text style={styles.small}>{t('crane.note')}</Text>
          <TextInput style={[styles.input, { minHeight: 50 }]} value={note} onChangeText={setNote} multiline />
          {result === 'pass' ? <Text style={styles.small}>{t('crane.passNote')}</Text> : <Text style={[styles.small, { color: LEVEL.red }]}>{t('crane.failNote')}</Text>}
          {picker}
          <TouchableOpacity style={[styles.btn, busy && { opacity: 0.5 }]} disabled={busy} onPress={() => void save()}>
            <Text style={styles.btnText}>{busy ? '…' : t('crane.sign')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
            <Text style={[styles.link, { textAlign: 'center' }]}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {cranes.map((c) => {
        const rows = testsDue(craneTests, c.id, today);
        return (
          <Card key={c.id}>
            <Text style={styles.title}>{craneSnap(c).label}</Text>
            <Text style={styles.small}>{[c.make, c.type, c.swl ? `SWL ${c.swl}` : null, c.testCertNo ? `cert. ${c.testCertNo}` : null].filter(Boolean).join(' · ')}</Text>
            {rows.length ? (
              rows.map((r) => (
                <View key={r.kind} style={styles.testRow}>
                  <View style={[styles.dot, { backgroundColor: LEVEL[r.level] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.text}>{tk(`crane.t.${r.kind}`)}</Text>
                    <Text style={styles.small}>
                      {[`${dmy(r.last.date)} — ${r.last.result === 'pass' ? t('crane.pass') : t('crane.fail')}`, r.last.testLoad, r.last.pctSwl ? `${r.last.pctSwl}% SWL` : null, r.last.examiner, r.due ? t('crane.dueOn', { date: dmy(r.due) }) : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.small}>{t('crane.noTests')}</Text>
            )}
          </Card>
        );
      })}
      {!cranes.length ? <Empty text={t('crane.noCranes')} /> : null}
    </>
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
    row: { flexDirection: 'row', gap: SIZES.sm, marginVertical: SIZES.sm },
    flex: { flex: 1, minWidth: 0 },
    small: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    text: { color: COLORS.text, fontWeight: '600' },
    title: { color: COLORS.text, fontWeight: '700' },
    link: { color: COLORS.primary, fontWeight: '700', marginVertical: SIZES.sm },
    testRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight, marginTop: SIZES.xs },
    dot: { width: 10, height: 10, borderRadius: 5 },
    btn: { marginTop: SIZES.md, marginBottom: SIZES.sm, backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center' },
    btnText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
