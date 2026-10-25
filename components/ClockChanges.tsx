// ===================================
// Settings → Vessel → Clock changes (25 Oct 2026). The Master plans each change
// of ship's time ahead — "26 Oct 02:00, retard 1 h" — and it happens on time on
// every device (components/ClockKeeper). Made changes stay listed: they are the
// history the reports read past days by.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { Palette, SIZES } from '../theme';
import { uid } from '../utils/id';
import { t, tk, useT } from '../utils/i18n';
import { uiDate } from '../utils/dates';
import { ClockChange, clockShift, pastChanges, planChange, plannedChanges, shipAndUtc, shipAndUtcAt } from '../utils/shipTime';

/** "26 Oct 02:00 · UTC+02:00 → UTC+01:00 · −1 h" in the zone the clocks showed then. */
function line(c: ClockChange): string {
  const s = shipAndUtc(c.at, c.from);
  const sh = clockShift(c);
  return `${uiDate(s.ship.slice(0, 10))} ${s.ship.slice(11)} · UTC${c.from} → UTC${c.to} · ${sh.dir === 'retard' ? '−' : '+'}${sh.hours} h`;
}

export function ClockChanges() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel, setVessel } = useData();
  const sync = useSync();
  const now = Date.now();
  const tomorrow = shipAndUtcAt(now + 86400000, vessel).ship.slice(0, 10);
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState('02:00');
  const planned = plannedChanges(vessel, now);
  const past = pastChanges(vessel, now).slice(0, 5);

  const plan = async (hours: number) => {
    const by = sync.me ? [sync.me.firstName, sync.me.lastName].filter(Boolean).join(' ') : undefined;
    const c = planChange(vessel, date.trim(), time.trim().padStart(5, '0'), hours, uid('clk'), by || undefined);
    if (typeof c === 'string') return Alert.alert(t('clk.notPlanned'), tk(`clk.err.${c}`));
    await setVessel({ ...(vessel ?? {}), ship_time_changes: [...(vessel?.ship_time_changes ?? []), c] });
  };

  const cancel = (c: ClockChange) =>
    Alert.alert(t('clk.cancelTitle'), line(c), [
      { text: t('common.back'), style: 'cancel' },
      { text: t('clk.cancel'), style: 'destructive', onPress: () => void setVessel({ ...(vessel ?? {}), ship_time_changes: (vessel?.ship_time_changes ?? []).filter((x) => x.id !== c.id) }) },
    ]);

  return (
    <View style={{ marginTop: SIZES.md }}>
      <Label>{t('clk.title')}</Label>
      <Text style={styles.note}>{t('clk.note')}</Text>

      {planned.map((c) => (
        <View key={c.id} style={styles.row}>
          <MciIcon name="clock-alert-outline" size={18} color={COLORS.primary} />
          <Text style={[styles.text, { flex: 1 }]}>{line(c)}</Text>
          <TouchableOpacity onPress={() => cancel(c)} hitSlop={8} accessibilityLabel={t('clk.cancel')}>
            <MciIcon name="close-circle-outline" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.form}>
        <View style={{ flex: 1.4 }}>
          <Text style={styles.cap}>{t('clk.date')}</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textLight} accessibilityLabel={t('clk.date')} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cap}>{t('clk.time')}</Text>
          <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="02:00" placeholderTextColor={COLORS.textLight} accessibilityLabel={t('clk.time')} />
        </View>
      </View>
      <View style={styles.form}>
        <TouchableOpacity style={styles.btn} onPress={() => void plan(-1)}>
          <Text style={styles.btnText}>{t('clk.retard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => void plan(1)}>
          <Text style={styles.btnText}>{t('clk.advance')}</Text>
        </TouchableOpacity>
      </View>

      {past.length ? (
        <>
          <Text style={[styles.cap, { marginTop: SIZES.sm }]}>{t('clk.history')}</Text>
          {past.map((c) => (
            <Text key={c.id} style={styles.past}>{`${line(c)}${c.by ? ` · ${c.by}` : ''}`}</Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    note: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: SIZES.sm },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.borderLight,
    },
    text: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '600' },
    past: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    form: { flexDirection: 'row', gap: SIZES.sm, marginTop: SIZES.sm },
    cap: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: 2 },
    input: {
      borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.sm, paddingVertical: 6,
      fontSize: SIZES.body, color: COLORS.textDark, backgroundColor: COLORS.cardSolid,
    },
    btn: {
      flex: 1, alignItems: 'center', paddingVertical: SIZES.sm, borderRadius: SIZES.radiusMd,
      borderWidth: 1, borderColor: COLORS.primary,
    },
    btnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body },
  });
