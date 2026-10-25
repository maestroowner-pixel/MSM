// ===================================
// Running hours from the AMS — pick the export (CSV or Excel), see what each
// line will do, save the readings that pass. Matching and checks are in
// services/amsHours.ts; a line the file could not match is matched here by
// hand, and every match is remembered on the machine (amsTag) for next time.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { BackButton, Card, Screen, ScreenTitle } from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { hasCounter } from '../types/pms';
import { personName } from '../types/role';
import { AmsRow, readAms } from '../services/amsHours';
import { todayIso, withReading } from '../services/pms';
import { pickSheetRows } from '../services/sheetFiles';
import { uiDate } from '../utils/dates';
import { goBackOr } from '../utils/nav';
import { playErrorSound, playSuccessSound } from '../utils/sound';
import { t, useT } from '../utils/i18n';

export default function AmsHoursSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { machines, saveMachine } = useData();
  const sync = useSync();
  const [file, setFile] = useState<{ name: string; rows: unknown[][] } | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [choosing, setChoosing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const today = todayIso();

  const res = useMemo(() => (file ? readAms(file.rows, machines, today, picked) : null), [file, machines, today, picked]);
  const byId = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);
  const counters = useMemo(() => machines.filter((m) => !m.deleted && hasCounter(m) && !m.followsParent).sort((a, b) => a.name.localeCompare(b.name)), [machines]);
  const toSave = res?.rows.filter((r) => r.status === 'ok') ?? [];

  const pick = async () => {
    try {
      const f = await pickSheetRows({ csv: true });
      if (!f) return;
      setFile(f);
      setPicked({});
      setChoosing(null);
      setSaved(null);
    } catch (e: any) {
      playErrorSound();
      Alert.alert(t('ams.title'), String(e?.message ?? e));
    }
  };

  const save = async () => {
    if (!res || busy) return;
    setBusy(true);
    try {
      const me = sync.me ? personName(sync.me) : '';
      const by = me ? `${me} · AMS` : 'AMS';
      let n = 0;
      for (const r of res.rows) {
        const m = r.machineId ? byId.get(r.machineId) : undefined;
        if (!m || r.status === 'dup' || r.status === 'unmatched') continue;
        // Every match is remembered, so the next file finds the machine by its tag.
        const tagged = m.amsTag === r.key ? m : { ...m, amsTag: r.key, updatedAt: Date.now() };
        if (r.status === 'ok' && r.total != null) {
          await saveMachine(withReading(tagged, r.date, r.total, { by }));
          n++;
        } else if (tagged !== m) {
          await saveMachine(tagged);
        }
      }
      playSuccessSound();
      setSaved(t('ams.saved', { n }));
      setFile(null);
    } catch (e: any) {
      playErrorSound();
      Alert.alert(t('ams.title'), String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const line = (r: AmsRow) => {
    const m = r.machineId ? byId.get(r.machineId) : undefined;
    if (r.status === 'unmatched') return t('ams.unmatched');
    if (r.status === 'same') return t('ams.same');
    if (r.status === 'ok') return m?.hours != null ? t('ams.change', { from: m.hours, to: r.total ?? '', date: uiDate(r.date) }) : t('ams.first', { to: r.total ?? '', date: uiDate(r.date) });
    return r.why ?? '';
  };
  const tone = (r: AmsRow) => (r.status === 'ok' ? COLORS.success : r.status === 'same' ? COLORS.textLight : r.status === 'unmatched' ? COLORS.warning : COLORS.danger);
  const taken = new Set(res?.rows.map((r) => r.machineId).filter(Boolean));

  return (
    <Screen scroll>
      <BackButton onPress={() => goBackOr(nav)} />
      <ScreenTitle title={t('ams.title')} subtitle={t('ams.sub')} help="Planned maintenance" />
      <Card>
        <Text style={styles.sub}>{t('ams.how')}</Text>
        <TouchableOpacity style={[styles.btn, { alignSelf: 'flex-start', marginTop: SIZES.md }]} onPress={() => void pick()}>
          <Text style={styles.btnText}>{t('ams.pick')}</Text>
        </TouchableOpacity>
      </Card>
      {saved ? <Text style={[styles.title, { color: COLORS.success, marginVertical: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}

      {file && res ? (
        <>
          <Text style={[styles.sub, { marginVertical: SIZES.sm }]}>{t('ams.file', { name: file.name })}</Text>
          {res.rows.map((r) => {
            const m = r.machineId ? byId.get(r.machineId) : undefined;
            const canChoose = r.status === 'unmatched' || r.how === 'hand';
            const onPress = canChoose ? () => setChoosing(choosing === r.key ? null : r.key) : r.status === 'doubt' && m ? () => nav.navigate('Machine', { id: m.id }) : undefined;
            return (
              <View key={r.key}>
                <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>{m ? m.name : r.key}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{[r.key, r.label, `${r.shows} h`].filter((x) => x && x !== m?.name).join(' · ')}</Text>
                    <Text style={[styles.sub, { color: tone(r), fontWeight: '700' }]}>{line(r)}</Text>
                    {r.status === 'doubt' && m && !canChoose ? <Text style={[styles.sub, { color: COLORS.primary }]}>{t('ams.openToEnter')}</Text> : null}
                  </View>
                  {onPress ? <Text style={styles.chev}>›</Text> : null}
                </TouchableOpacity>
                {choosing === r.key ? (
                  <Card>
                    <Text style={[styles.title, { marginBottom: SIZES.sm }]}>{t('ams.choose')}</Text>
                    <View style={styles.chips}>
                      {counters.filter((c) => !taken.has(c.id) || c.id === r.machineId).map((c) => (
                        <TouchableOpacity key={c.id} style={[styles.chip, c.id === r.machineId && { backgroundColor: COLORS.primary }]} onPress={() => { setPicked({ ...picked, [r.key]: c.id }); setChoosing(null); }}>
                          <Text style={[styles.chipText, c.id === r.machineId && { color: COLORS.textWhite }]}>{c.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </Card>
                ) : null}
              </View>
            );
          })}
          {res.skipped.length ? (
            <Card>
              <Text style={styles.title}>{t('ams.notRead', { n: res.skipped.length })}</Text>
              {res.skipped.slice(0, 20).map((s) => <Text key={s} style={styles.sub}>{s}</Text>)}
              {res.skipped.length > 20 ? <Text style={styles.sub}>…</Text> : null}
            </Card>
          ) : null}
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, (!toSave.length || busy) && { opacity: 0.4 }]} disabled={!toSave.length || busy} onPress={() => void save()}>
              <Text style={styles.btnText}>{toSave.length ? t('ams.save', { n: toSave.length }) : t('ams.nothing')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setFile(null)}><Text style={styles.link}>{t('common.cancel')}</Text></TouchableOpacity>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.xs },
    title: { fontSize: SIZES.body, color: COLORS.textDark, fontWeight: '700' },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    chev: { fontSize: 22, color: COLORS.textLight },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs },
    chip: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingVertical: 6, paddingHorizontal: SIZES.sm },
    chipText: { color: COLORS.textDark, fontWeight: '600', fontSize: SIZES.small },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    link: { color: COLORS.primary, fontWeight: '700' },
  });
