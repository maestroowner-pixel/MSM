// ===================================
// PSC walk-round (services/pscWalk.ts, plan item 46): the findings port State
// inspectors write most often, by place, to walk the vessel with before the
// visit — OK or to put right, a note, and a link to where the app keeps the
// proof. Above it, what the region's inspectors found last year, from the MOUs'
// own annual reports. The marks stay on this device; the PDF goes to the Master.
// The checks and figures are English, as PSC works in English.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Empty, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES, Palette } from '../theme';
import { moduleOn } from '../constants/modules';
import { PLACES, PLACE_LABEL, PSC_CHECKS, PSC_STATS, PscCheck, PscWalk, emptyWalk, mark, noteOn, walkCount } from '../services/pscWalk';
import { exportWalkPdf, loadWalk, saveWalk } from '../services/pscWalkReport';
import { t, useT } from '../utils/i18n';

export default function PscWalkSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const data = useData();
  const [w, setW] = useState<PscWalk>(() => emptyWalk(Date.now()));
  const [region, setRegion] = useState(PSC_STATS[0].key);
  const [saved, setSaved] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    loadWalk().then((x) => {
      setW(x);
      loaded.current = true;
    });
  }, []);
  // Kept as it is marked: a walk takes the whole ship and is put down between other work.
  useEffect(() => {
    if (loaded.current) void saveWalk(w);
  }, [w]);

  const c = walkCount(w);
  const reg = PSC_STATS.find((r) => r.key === region) ?? PSC_STATS[0];
  const top = Math.max(...reg.areas.map((a) => a.pct));
  const canOpen = (x: PscCheck) => !!x.route && (!x.module || moduleOn(x.module));

  const pdf = async () => {
    try {
      const where = await exportWalkPdf(w, data.vessel);
      if (typeof where === 'string') setSaved(where === 'Downloads' ? t('common.savedDownloads') : t('common.savedFolder', { folder: where }));
    } catch (e: any) {
      Alert.alert(t('psc.title'), String(e?.message ?? e));
    }
  };
  const fresh = () =>
    Alert.alert(t('psc.newQ'), t('psc.newBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('psc.new'), style: 'destructive', onPress: () => setW(emptyWalk(Date.now())) },
    ]);

  if (!moduleOn('readiness')) return <Screen><Empty text={t('common.notAvailable')} /></Screen>;
  return (
    <Screen scroll>
      <ScreenTitle title={t('psc.title')} subtitle={t('psc.sub')} help="Inspection readiness" />

      <View style={styles.block}>
        <Text style={styles.head}>{t('psc.region')}</Text>
        <View style={styles.chips}>
          {PSC_STATS.map((r) => (
            <TouchableOpacity key={r.key} style={[styles.chip, region === r.key && styles.chipOn]} onPress={() => setRegion(r.key)}>
              <Text style={[styles.chipText, region === r.key && styles.chipTextOn]}>{`${r.name} ${r.year}`}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sub}>{reg.facts.join(' · ')}</Text>
        <Text style={[styles.label, { marginTop: SIZES.sm }]}>{t('psc.areas')}</Text>
        {reg.areas.map((a) => (
          <View key={a.label} style={styles.barRow}>
            <Text style={styles.barLabel} numberOfLines={2}>{a.label}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${Math.max(2, (a.pct / top) * 100)}%` }]} />
            </View>
            <Text style={styles.barVal}>{`${a.pct.toFixed(1)}%`}</Text>
          </View>
        ))}
        {reg.detainable.length ? (
          <>
            <Text style={[styles.label, { marginTop: SIZES.sm }]}>{t('psc.detainable')}</Text>
            {reg.detainable.map((d, i) => (
              <Text key={d.label} style={styles.sub}>{`${i + 1}. ${d.label} — ${d.n}`}</Text>
            ))}
          </>
        ) : null}
        <Text style={[styles.sub, { marginTop: SIZES.sm, fontStyle: 'italic' }]}>{t('psc.source', { source: reg.source })}</Text>
      </View>

      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.fix ? COLORS.danger : COLORS.text }]}>{t('psc.progress', { done: c.done, total: c.total, fix: c.fix })}</Text>
          <Text style={styles.sub}>{t('psc.local')}</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={pdf}>
          <Text style={styles.btnText}>PDF</Text>
        </TouchableOpacity>
      </View>
      {saved ? <Text style={[styles.sub, { color: COLORS.success, marginBottom: SIZES.sm }]}>{`✓ ${saved}`}</Text> : null}
      {c.done ? (
        <TouchableOpacity style={styles.link} onPress={fresh} activeOpacity={0.7}>
          <MciIcon name="restart" size={18} color={COLORS.primary} />
          <Text style={styles.linkText}>{t('psc.new')}</Text>
        </TouchableOpacity>
      ) : null}

      {PLACES.map((p) => (
        <View key={p} style={styles.block}>
          <Text style={styles.head}>{PLACE_LABEL[p]}</Text>
          {PSC_CHECKS.filter((x) => x.place === p).map((x) => {
            const m = w.marks[x.id];
            return (
              <View key={x.id} style={styles.row}>
                <Text style={styles.title}>{x.text}</Text>
                <Text style={styles.sub}>{x.ref}</Text>
                {x.stat ? <Text style={[styles.sub, { color: COLORS.warning }]}>{x.stat}</Text> : null}
                <View style={styles.actions}>
                  <TouchableOpacity style={[styles.mark, m?.s === 'ok' && { backgroundColor: COLORS.success, borderColor: COLORS.success }]} onPress={() => setW((v) => mark(v, x.id, 'ok', Date.now()))}>
                    <Text style={[styles.markText, m?.s === 'ok' && styles.markTextOn]}>{t('psc.ok')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.mark, m?.s === 'fix' && { backgroundColor: COLORS.danger, borderColor: COLORS.danger }]} onPress={() => setW((v) => mark(v, x.id, 'fix', Date.now()))}>
                    <Text style={[styles.markText, m?.s === 'fix' && styles.markTextOn]}>{t('psc.fix')}</Text>
                  </TouchableOpacity>
                  {canOpen(x) ? (
                    <TouchableOpacity onPress={() => nav.navigate(x.route!, x.params)} hitSlop={8} style={styles.open}>
                      <Text style={styles.linkText}>{t('psc.open')}</Text>
                      <MciIcon name="chevron-right" size={16} color={COLORS.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {m ? (
                  <TextInput
                    style={styles.note}
                    value={m.note ?? ''}
                    placeholder={t('psc.note')}
                    placeholderTextColor={COLORS.textLight}
                    onChangeText={(s) => setW((v) => noteOn(v, x.id, s, Date.now()))}
                    multiline
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginVertical: SIZES.sm },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    block: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    head: { fontWeight: '800', color: COLORS.textDark, fontSize: SIZES.body, marginBottom: SIZES.xs },
    label: { fontWeight: '700', color: COLORS.textDark, fontSize: SIZES.small, marginBottom: SIZES.xs },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginVertical: 3 },
    barLabel: { width: 150, color: COLORS.text, fontSize: SIZES.small },
    barTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: COLORS.borderLight, overflow: 'hidden' },
    bar: { height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
    barVal: { width: 48, textAlign: 'right', color: COLORS.textLight, fontSize: SIZES.small },
    summary: { ...COLORS.glassCard, flexDirection: 'row', alignItems: 'center', gap: SIZES.md, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
    link: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.md },
    linkText: { color: COLORS.primary, fontWeight: '700' },
    row: { paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.borderLight },
    title: { color: COLORS.text, fontWeight: '600' },
    sub: { color: COLORS.textLight, fontSize: SIZES.small, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginTop: SIZES.sm },
    mark: { paddingVertical: 6, paddingHorizontal: SIZES.md, borderRadius: 999, borderWidth: 1, borderColor: COLORS.borderLight },
    markText: { color: COLORS.text, fontWeight: '700', fontSize: SIZES.small },
    markTextOn: { color: COLORS.textWhite },
    open: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto' },
    note: { marginTop: SIZES.sm, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: SIZES.radiusSm, padding: SIZES.sm, color: COLORS.text, minHeight: 36 },
  });
