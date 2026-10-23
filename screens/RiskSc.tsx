// ===================================
// One risk assessment — hazards rated before and after their controls on a
// 5 × 5 matrix (likelihood × severity), and approved with a signature.
//
// A hazard still High or Extreme with the controls in place is called out: the
// job should not go ahead until more controls bring it down, or the Master
// accepts it knowingly (that is the approval). An approved assessment is
// edited by issuing it again — the approval is cleared when anything changes.
// ===================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Label } from '../components/ui';
import { useSignConfirm } from '../components/SignConfirm';
import { useSigner } from '../components/SignerChoice';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { Hazard, RiskAssessment } from '../types/permits';
import { RISK_COLOR, nextNumber, riskLevel, unacceptable, worstResidual } from '../services/permits';
import { roleAtLeast } from '../types/role';
import { uiDateTime } from '../utils/dates';
import { uid } from '../utils/id';
import { goBackOr } from '../utils/nav';
import { playSuccessSound } from '../utils/sound';
import { t, tk, tn, useT } from '../utils/i18n';

export default function RiskSc() {
  useT();
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { risks, saveRisk } = useData();
  const sync = useSync();
  const confirmSign = useSignConfirm();
  const { signer, picker } = useSigner();
  const officer = !sync.enrolled || roleAtLeast(sync.role, 'admin');

  const id: string = route.params?.id;
  const existing = risks.find((r) => r.id === id);
  const [r, setR] = useState<RiskAssessment>(
    existing ?? { id, title: '', hazards: [], generic: !!route.params?.generic, createdAt: Date.now(), updatedAt: Date.now() }
  );
  const touched = useRef(false);
  useEffect(() => {
    if (existing && !touched.current) setR(existing);
  }, [existing]);
  // Any change clears an approval: what was approved is no longer what is here.
  const set = (x: Partial<RiskAssessment>) => {
    touched.current = true;
    setR((v) => {
      const next = { ...v, ...x };
      if (v.approved && !('approved' in x)) delete next.approved;
      return next;
    });
  };
  const setHazard = (hid: string, x: Partial<Hazard>) => set({ hazards: r.hazards.map((h) => (h.id === hid ? { ...h, ...x } : h)) });

  const save = async () => {
    if (!r.title.trim()) return Alert.alert(t('risk.titleReq'), t('risk.nameTask'));
    const out = { ...r, title: r.title.trim(), no: r.no ?? (r.generic ? undefined : nextNumber('RA', new Date().getFullYear(), risks.map((x) => x.no))), updatedAt: Date.now() };
    if (!out.no) delete out.no;
    await saveRisk(out);
    setR(out);
    touched.current = false;
    playSuccessSound();
  };

  const approve = async () => {
    if (!officer) return Alert.alert(t('risk.approval'), t('risk.officerOnly'));
    if (!r.hazards.length) return Alert.alert(t('risk.noHaz'), t('risk.addHazFirst'));
    if (!signer) return Alert.alert(t('sign.who'), t('pd.chooseName'));
    const bad = unacceptable(r);
    const go = async () => {
      const sig = await confirmSign({ personKey: signer.key, name: signer.name, ownDevice: signer.own, what: `Approve the risk assessment — ${r.title}` });
      if (!sig) return;
      const out = { ...r, approved: { by: signer.name, ...(signer.rank ? { byRank: signer.rank } : {}), at: Date.now(), ...(sig.proof ? { signedWith: sig.proof } : {}) }, updatedAt: Date.now() };
      await saveRisk(out);
      setR(out);
      touched.current = false;
      playSuccessSound();
    };
    if (bad.length) {
      Alert.alert(t('risk.stillHigh'), tn('risk.stillHighBody', bad.length), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('risk.approve'), style: 'destructive', onPress: () => void go() },
      ]);
    } else await go();
  };

  const Scale = ({ value, onChange, labels }: { value?: number; onChange: (n: number) => void; labels: 'risk.lik' | 'risk.sev' }) => (
    <View style={styles.scale}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} style={[styles.scaleBtn, value === n && styles.scaleOn]} accessibilityLabel={tk(`${labels}.${n}`)}>
          <Text style={[styles.scaleText, value === n && { color: COLORS.textWhite }]}>{n}</Text>
        </TouchableOpacity>
      ))}
      <Text style={styles.scaleLabel} numberOfLines={1}>{value ? tk(`${labels}.${value}`) : ''}</Text>
    </View>
  );
  const Level = ({ l, s }: { l?: number; s?: number }) => {
    if (!l || !s) return null;
    const lvl = riskLevel(l, s);
    return <Text style={[styles.level, { backgroundColor: RISK_COLOR[lvl] }]}>{`${tk(`risk.lvl.${lvl}`)} · ${l * s}`}</Text>;
  };

  const worst = worstResidual(r);

  return (
    <LinearGradient colors={COLORS.bgGradient} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <BackButton onPress={() => goBackOr(nav)} />
          <Text style={styles.headerTitle} numberOfLines={1}>{r.no ?? (r.generic ? t('risk.lib') : t('risk.ra'))}</Text>
          <TouchableOpacity onPress={() => void save()} hitSlop={12}>
            <Text style={styles.save}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: SIZES.lg, paddingBottom: SIZES.xxxl }}>
          <Label>{t('risk.task')}</Label>
          <TextInput style={styles.input} value={r.title} onChangeText={(v) => set({ title: v })} placeholder={t('risk.taskPh')} placeholderTextColor={COLORS.textLight} />
          <Label>{t('risk.desc')}</Label>
          <TextInput style={styles.input} value={r.task ?? ''} onChangeText={(v) => set({ task: v })} placeholder={t('risk.descPh')} placeholderTextColor={COLORS.textLight} multiline />
          <Label>{t('risk.location')}</Label>
          <TextInput style={styles.input} value={r.location ?? ''} onChangeText={(v) => set({ location: v })} placeholder="—" placeholderTextColor={COLORS.textLight} />
          <View style={styles.toggle}>
            <Text style={[styles.sub, { flex: 1 }]}>{t('risk.keepLib')}</Text>
            <Switch value={r.generic} onValueChange={(v) => set({ generic: v })} trackColor={{ true: COLORS.primary, false: COLORS.border }} />
          </View>

          <View style={styles.summary}>
            <Text style={styles.sumText}>{tn('n.hazard', r.hazards.length)}</Text>
            {worst ? <Text style={[styles.level, { backgroundColor: RISK_COLOR[worst] }]}>{t('risk.residual', { level: tk(`risk.lvl.${worst}`) })}</Text> : null}
          </View>

          {r.hazards.map((h, i) => (
            <View key={h.id} style={styles.hazard}>
              <View style={styles.hazHead}>
                <Text style={styles.hazNo}>{i + 1}</Text>
                <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={h.hazard} onChangeText={(v) => setHazard(h.id, { hazard: v })} placeholder={t('risk.hazard')} placeholderTextColor={COLORS.textLight} />
                <TouchableOpacity onPress={() => set({ hazards: r.hazards.filter((x) => x.id !== h.id) })} hitSlop={8}>
                  <Text style={{ color: COLORS.danger, fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>
              <TextInput style={styles.input} value={h.consequence ?? ''} onChangeText={(v) => setHazard(h.id, { consequence: v })} placeholder={t('risk.conseqPh')} placeholderTextColor={COLORS.textLight} />
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>{t('risk.before')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.small}>{t('risk.likelihood')}</Text>
                  <Scale value={h.likelihood} onChange={(n) => setHazard(h.id, { likelihood: n })} labels="risk.lik" />
                  <Text style={styles.small}>{t('risk.severity')}</Text>
                  <Scale value={h.severity} onChange={(n) => setHazard(h.id, { severity: n })} labels="risk.sev" />
                </View>
                <Level l={h.likelihood} s={h.severity} />
              </View>
              <TextInput style={[styles.input, { minHeight: 50 }]} value={h.controls ?? ''} onChangeText={(v) => setHazard(h.id, { controls: v })} placeholder={t('risk.controlsPh')} placeholderTextColor={COLORS.textLight} multiline />
              <View style={styles.rateRow}>
                <Text style={styles.rateLabel}>{t('risk.withControls')}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.small}>{t('risk.likelihood')}</Text>
                  <Scale value={h.residualLikelihood} onChange={(n) => setHazard(h.id, { residualLikelihood: n })} labels="risk.lik" />
                  <Text style={styles.small}>{t('risk.severity')}</Text>
                  <Scale value={h.residualSeverity} onChange={(n) => setHazard(h.id, { residualSeverity: n })} labels="risk.sev" />
                </View>
                <Level l={h.residualLikelihood} s={h.residualSeverity} />
              </View>
            </View>
          ))}
          <TouchableOpacity onPress={() => set({ hazards: [...r.hazards, { id: uid('hz'), hazard: '', likelihood: 3, severity: 3 }] })} style={{ marginVertical: SIZES.md }}>
            <Text style={styles.link}>{t('risk.addHaz')}</Text>
          </TouchableOpacity>

          <Text style={styles.section}>{t('risk.approval')}</Text>
          {r.approved ? (
            <Text style={styles.stamp}>{`${t('risk.approved', { by: r.approved.byRank ? `${r.approved.by} (${r.approved.byRank})` : r.approved.by })} · ${uiDateTime(r.approved.at)}`}</Text>
          ) : (
            <>
              {picker ? (
                <>
                  <Label>{t('risk.signingAs')}</Label>
                  {picker}
                </>
              ) : null}
              <TouchableOpacity style={[styles.act, !officer && { opacity: 0.5 }]} onPress={() => void approve()}>
                <Text style={styles.actText}>{t('risk.approveAss')}</Text>
              </TouchableOpacity>
              <Text style={styles.sub}>{t('risk.saveFirst')}</Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SIZES.lg, paddingVertical: SIZES.md },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
    save: { fontSize: SIZES.h5, fontWeight: '700', color: COLORS.primary },
    input: { ...COLORS.glassInput, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, paddingVertical: SIZES.sm, fontSize: SIZES.body, color: COLORS.text, marginTop: 4, marginBottom: SIZES.sm },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginVertical: SIZES.sm },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    summary: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginVertical: SIZES.md },
    sumText: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark },
    hazard: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginBottom: SIZES.md },
    hazHead: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.xs },
    hazNo: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, backgroundColor: COLORS.primary, color: COLORS.textWhite, fontWeight: '800', overflow: 'hidden' },
    rateRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, marginBottom: SIZES.sm },
    rateLabel: { width: 70, fontSize: SIZES.small, fontWeight: '800', color: COLORS.textLight },
    small: { fontSize: SIZES.tiny, color: COLORS.textLight, marginTop: 2 },
    scale: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    scaleBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
    scaleOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    scaleText: { fontWeight: '800', color: COLORS.textDark, fontSize: SIZES.small },
    scaleLabel: { marginLeft: SIZES.xs, fontSize: SIZES.tiny, color: COLORS.textLight, flexShrink: 1 },
    level: { color: '#fff', fontWeight: '800', fontSize: SIZES.tiny, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.body },
    section: { fontSize: SIZES.h5, fontWeight: '800', color: COLORS.textDark, marginTop: SIZES.lg, marginBottom: SIZES.xs },
    stamp: { fontSize: SIZES.body, color: COLORS.textDark },
    act: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: SIZES.md, alignItems: 'center', marginTop: SIZES.md },
    actText: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.body },
  });
