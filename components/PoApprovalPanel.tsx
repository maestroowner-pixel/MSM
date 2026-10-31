// ===================================
// A requisition's way through the Master and the office (services/poApproval,
// plan item 35, flag poApproval) — on the order, aboard, and in Fleet.
//
//   PoProgress       Sent to the office → Under review → Approved by the office →
//                    In work → Delivered, each with its date and who.
//   PoApprovalPanel  the progress line, why it came back, what the office cut,
//                    the vessel's next step (submit / send to the office / return /
//                    emergency) and every step so far.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Card, Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { SIZES, Palette } from '../theme';
import { PoStep, PurchaseOrder } from '../types/orders';
import { Mile, emergencyOpen, emergencySend, lastCuts, masterApprove, masterReturn, poStage, progress, returnedBy, submit, Who } from '../services/poApproval';
import { uiDate } from '../utils/dates';
import { t, tk, useT } from '../utils/i18n';

const day = (at?: number | string) => (at == null ? '' : uiDate(typeof at === 'number' ? new Date(at).toISOString().slice(0, 10) : at));
const whoOf = (s: PoStep) => (s.byRank ? `${s.by} (${s.byRank})` : s.by);

export function PoProgress({ o }: { o: PurchaseOrder }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const color = (m: Mile) => (m.state === 'done' ? COLORS.success : m.state === 'now' ? COLORS.primary : m.state === 'bad' ? COLORS.danger : COLORS.border);
  const miles = progress(o);
  return (
    <View>
      {miles.map((m, i) => (
        <View key={m.key} style={styles.mile}>
          <View style={styles.rail}>
            {/* "Now" is a ring: the step the order waits for, not one done. */}
            <View style={[styles.dot, { backgroundColor: m.state === 'todo' || m.state === 'now' ? 'transparent' : color(m), borderColor: color(m) }]}>
              {m.state === 'done' ? <MciIcon name="check" size={10} color={COLORS.cardSolid} /> : m.state === 'bad' ? <MciIcon name="close" size={10} color={COLORS.cardSolid} /> : null}
            </View>
            {i < miles.length - 1 ? <View style={[styles.line, { backgroundColor: miles[i + 1].state === 'todo' ? COLORS.border : color(miles[i + 1]) }]} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: SIZES.sm }}>
            <Text style={[styles.mileTitle, m.state === 'todo' && { color: COLORS.textLight, fontWeight: '600' }, m.state === 'now' && { color: COLORS.primary }, m.state === 'bad' && { color: COLORS.danger }]}>
              {m.key === 'approved' && m.state === 'bad' ? t('poa.m.rejected') : m.key === 'sent' && m.note ? t('poa.m.emergency') : tk(`poa.m.${m.key}`)}
            </Text>
            {m.state !== 'todo' && (m.at || m.by) ? <Text style={styles.sub}>{[day(m.at), m.by].filter(Boolean).join(' · ')}</Text> : null}
            {m.note && m.state !== 'todo' ? <Text style={[styles.sub, m.state === 'bad' && { color: COLORS.danger }]}>{m.note}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PoApprovalPanel({ o, who, officer, master, onSave }: { o: PurchaseOrder; who: Who; officer: boolean; master: boolean; onSave: (next: PurchaseOrder) => Promise<void> }) {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const stage = poStage(o);
  const back = returnedBy(o);
  const cuts = lastCuts(o);
  const steps = o.approval ?? [];

  const act = async (fn: () => PurchaseOrder, needsNote = false) => {
    if (needsNote && note.trim().length < 3) return Alert.alert(t('poa.title'), t('poa.needReason'));
    setBusy(true);
    try {
      await onSave(fn());
      setNote('');
    } catch (e: any) {
      Alert.alert(t('poa.title'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  const now = () => Date.now();
  const today = () => new Date().toISOString().slice(0, 10);

  const canSubmit = officer && !master && (stage === 'draft' || stage === 'returned');
  const canSend = master && (stage === 'draft' || stage === 'returned' || stage === 'master');
  const canReturn = master && stage === 'master';
  const canEmergency = master && o.urgency === 'emergency' && ['draft', 'returned', 'master', 'office', 'review', 'approved', 'rejected'].includes(stage);
  const needsInput = canReturn || canEmergency;

  return (
    <Card style={{ marginTop: SIZES.sm }}>
      <Label>{t('poa.title')}</Label>
      <PoProgress o={o} />

      {stage === 'master' ? <Text style={styles.info}>{t('poa.atMaster')}</Text> : null}
      {stage === 'approved' ? <Text style={[styles.info, { color: COLORS.success }]}>{t('poa.approvedPlace')}</Text> : null}
      {back ? (
        <View style={[styles.banner, { borderColor: COLORS.warning }]}>
          <Text style={[styles.bannerTitle, { color: COLORS.warning }]}>{back.kind === 'return' ? t('poa.returnedOffice') : t('poa.returnedMaster')}</Text>
          <Text style={styles.sub}>{`${back.note ?? ''}\n${day(back.at)} · ${whoOf(back)}`}</Text>
        </View>
      ) : null}
      {stage === 'rejected' ? (
        <View style={[styles.banner, { borderColor: COLORS.danger }]}>
          <Text style={[styles.bannerTitle, { color: COLORS.danger }]}>{t('poa.rejected')}</Text>
          <Text style={styles.sub}>{steps[steps.length - 1]?.note ?? ''}</Text>
        </View>
      ) : null}
      {emergencyOpen(o) ? <Text style={[styles.info, { color: COLORS.warning }]}>{t('poa.emergencyOpen')}</Text> : null}
      {cuts.length ? (
        <View style={[styles.banner, { borderColor: COLORS.primary }]}>
          <Text style={[styles.bannerTitle, { color: COLORS.primary }]}>{t('poa.cutsN', { n: cuts.length })}</Text>
          {cuts.map((c) => {
            const l = o.lines.find((x) => x.id === c.lineId);
            return <Text key={c.lineId} style={styles.sub}>{`• ${l?.description ?? '—'}: ${c.to === 0 ? t('poa.struck') : t('poa.qtyFromTo', { from: c.from, to: c.to })} — ${c.note}`}</Text>;
          })}
        </View>
      ) : null}

      {needsInput ? (
        <TextInput style={styles.input} value={note} onChangeText={setNote} multiline placeholder={t('poa.notePh')} placeholderTextColor={COLORS.textLight} />
      ) : null}
      <View style={styles.btns}>
        {canSubmit ? (
          <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => void act(() => submit(o, who, now()))}>
            <Text style={styles.btnText}>{t('poa.submit')}</Text>
          </TouchableOpacity>
        ) : null}
        {canSend ? (
          <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => void act(() => masterApprove(o, who, now()))}>
            <Text style={styles.btnText}>{t('poa.send')}</Text>
          </TouchableOpacity>
        ) : null}
        {canReturn ? (
          <TouchableOpacity style={styles.outline} disabled={busy} onPress={() => void act(() => masterReturn(o, who, note, now()), true)}>
            <Text style={styles.outlineText}>{t('poa.return')}</Text>
          </TouchableOpacity>
        ) : null}
        {canEmergency ? (
          <TouchableOpacity
            style={[styles.outline, { borderColor: COLORS.danger }]}
            disabled={busy}
            onPress={() =>
              note.trim().length < 3
                ? Alert.alert(t('poa.title'), t('poa.needReason'))
                : Alert.alert(t('poa.emergency'), t('poa.emergencyBody'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('poa.emergencyGo'), style: 'destructive', onPress: () => void act(() => emergencySend(o, who, note, now(), today()), true) },
                  ])
            }
          >
            <Text style={[styles.outlineText, { color: COLORS.danger }]}>{t('poa.emergency')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {steps.length ? (
        <>
          <Label style={{ marginTop: SIZES.sm }}>{t('poa.history')}</Label>
          {steps.map((s, i) => (
            <Text key={`${s.at}-${i}`} style={styles.sub}>{`${day(s.at)} · ${tk(`poa.k.${s.kind}`)} · ${whoOf(s)}${s.note ? ` — ${s.note}` : ''}`}</Text>
          ))}
        </>
      ) : null}
    </Card>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    mile: { flexDirection: 'row', gap: SIZES.sm },
    rail: { width: 18, alignItems: 'center' },
    dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    line: { width: 2, flex: 1, marginVertical: 2 },
    mileTitle: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    info: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.xs },
    banner: { borderLeftWidth: 3, paddingLeft: SIZES.sm, marginTop: SIZES.sm },
    bannerTitle: { fontSize: SIZES.small, fontWeight: '800' },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: SIZES.sm, minHeight: 44 },
    btns: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.sm, marginTop: SIZES.sm },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '700' },
    outline: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.sm, paddingHorizontal: SIZES.md },
    outlineText: { color: COLORS.primary, fontWeight: '700' },
  });
