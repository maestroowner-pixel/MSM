// ===================================
// A vessel certificate's surveys, on the certificate (services/certSurveys.ts).
//
// The plan is drawn from the certificate's dates by its scheme — annual,
// intermediate, renewal, each in its window — shown first as a list to tick,
// then saved as rows of the Surveys plan. Carrying one out happens on the
// Surveys screen, where every survey is signed the same way.
// ===================================

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Label } from './ui';
import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { t, tk, useT } from '../utils/i18n';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES, Palette } from '../theme';
import { Certificate } from '../types/certificate';
import { roleAtLeast } from '../types/role';
import * as storage from '../services/storage';
import { todayIso } from '../services/pms';
import { SurveyState, surveyStatus } from '../services/surveys';
import { PlannedSurvey, SCHEMES, SurveyScheme, certRows, defaultScheme, planForCertificate } from '../services/certSurveys';
import { uiDate } from '../utils/dates';
import { playSuccessSound } from '../utils/sound';

/** The part after "SMC — ": the box it fills. */
const boxName = (name: string) => {
  const b = name.split(' — ').slice(1).join(' — ') || name;
  return b.charAt(0).toUpperCase() + b.slice(1);
};

/**
 * `cert` is the certificate as being edited (its dates draw the plan); `stored`
 * the one in the register, which takes the chosen scheme — so planning saves no
 * half-made edit — and `onScheme` hands it to the edit too.
 */
export function CertSurveys({ cert, stored, onScheme }: { cert: Certificate; stored?: Certificate; onScheme: (s: SurveyScheme) => void }) {
  const saved = !!stored;
  const COLORS = useTheme();
  useT();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const nav = useNavigation<any>();
  const { surveys, surveysDone, saveRow, saveRows, saveCertificate } = useData();
  const sync = useSync();
  const canEdit = !sync.enrolled || roleAtLeast(sync.role, 'admin');
  const today = todayIso();
  const rows = useMemo(() => certRows(cert.id, surveys), [cert.id, surveys]);
  const [planning, setPlanning] = useState<{ scheme: SurveyScheme; list: PlannedSurvey[] } | null>(null);

  const color: Record<SurveyState, string> = { overdue: COLORS.danger, open: COLORS.warning, soon: COLORS.primary, planned: COLORS.textLight, done: COLORS.success };

  const start = (scheme: SurveyScheme = cert.surveyScheme ?? defaultScheme(cert.name)) =>
    setPlanning({ scheme, list: planForCertificate(cert, scheme, today) });

  const save = async () => {
    if (!planning) return;
    const keep = planning.list.filter((p) => p.include).map((p) => p.survey);
    const ids = new Set(keep.map((s) => s.id));
    // A replan replaces what is still to come; what was carried out stays, with its history.
    const drop = rows.filter((s) => !ids.has(s.id) && surveyStatus(s, today, surveysDone).state !== 'done').map((s) => ({ ...s, deleted: true, updatedAt: Date.now() }));
    const kept = keep.map((s) => rows.find((r) => r.id === s.id) ?? s);
    if (kept.length + drop.length) await saveRows(storage.SURVEYS_KEY, [...kept, ...drop]);
    if (stored) await saveCertificate({ ...stored, surveyScheme: planning.scheme, updatedAt: Date.now() });
    onScheme(planning.scheme);
    setPlanning(null);
    playSuccessSound();
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Label>{t('tab.Surveys')}</Label>
        {canEdit && saved && cert.expiryDate && !planning ? (
          <TouchableOpacity onPress={() => start()} hitSlop={8}>
            <Text style={styles.link}>{rows.length ? t('cs2.replan') : t('cs2.plan')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!saved ? (
        <Text style={styles.empty}>{t('cs2.saveFirst')}</Text>
      ) : !cert.expiryDate ? (
        <Text style={styles.empty}>{t('cs2.needExpiry')}</Text>
      ) : planning ? (
        <View>
          <View style={styles.chips}>
            {SCHEMES.map((s) => (
              <TouchableOpacity key={s.key} style={[styles.chip, planning.scheme === s.key && styles.chipOn]} onPress={() => start(s.key)}>
                <Text style={[styles.chipText, planning.scheme === s.key && styles.chipTextOn]}>{tk(`cs2.sch.${s.key}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sub}>{tk(`cs2.sch.${planning.scheme}.sub`)}</Text>
          {planning.list.length === 0 ? <Text style={styles.empty}>{t('cs2.nothing')}</Text> : null}
          {planning.list.map((p, i) => (
            <TouchableOpacity
              key={p.survey.id}
              style={styles.row}
              onPress={() => setPlanning({ ...planning, list: planning.list.map((q, j) => (j === i ? { ...q, include: !q.include } : q)) })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: p.include }}
            >
              <View style={[styles.check, p.include && styles.checkOn]}>{p.include ? <Text style={styles.checkMark}>✓</Text> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{boxName(p.survey.name)}</Text>
                <Text style={styles.sub}>
                  {t('sv.window', { from: uiDate(surveyStatus(p.survey, today).opens), to: uiDate(surveyStatus(p.survey, today).closes) })}
                  {p.include ? '' : t('cs2.closed')}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          <View style={styles.btns}>
            <TouchableOpacity style={styles.btn} onPress={() => void save()}>
              <Text style={styles.btnText}>{t('cs2.planN', { n: planning.list.filter((p) => p.include).length })}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPlanning(null)}>
              <Text style={styles.link}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>
          {canEdit
            ? t('cs2.notPlanned')
            : t('cs2.noneCrew')}
        </Text>
      ) : (
        <View>
          {rows.map((s) => {
            const st = surveyStatus(s, today, surveysDone);
            const d = surveysDone.find((x) => x.surveyId === s.id && x.forDue === s.due && !x.cancelled);
            const line =
              st.state === 'done' ? `${t('cs2.endorsed', { date: d ? uiDate(d.date) : '' })}${d?.ref ? ` · ${t('ins.no', { n: d.ref })}` : ''}`
              : st.state === 'overdue' ? t('sv.overdue', { date: uiDate(st.closes) })
              : st.state === 'open' ? t('sv.open', { date: uiDate(st.closes), n: st.days })
              : t('sv.window', { from: uiDate(st.opens), to: uiDate(st.closes) });
            return (
              <TouchableOpacity key={s.id} style={[styles.row, styles.planned, { borderLeftColor: color[st.state] }]} onPress={() => nav.navigate('Surveys')} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{boxName(s.name)}</Text>
                  <Text style={[styles.sub, { color: color[st.state], fontWeight: st.state === 'planned' ? '400' : '700' }]}>{line}</Text>
                </View>
                {st.state !== 'done' ? <MciIcon name="chevron-right" size={18} color={COLORS.textLight} /> : <MciIcon name="check-circle" size={18} color={COLORS.success} />}
              </TouchableOpacity>
            );
          })}
          <Text style={styles.sub}>{t('cs2.carriedOn')}</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, padding: SIZES.md, marginVertical: SIZES.sm },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.xs },
    link: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    empty: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.xs },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
    chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1, borderColor: COLORS.primary },
    chipOn: { backgroundColor: COLORS.primary },
    chipText: { color: COLORS.primary, fontWeight: '600', fontSize: SIZES.small },
    chipTextOn: { color: COLORS.textWhite },
    row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingVertical: SIZES.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
    planned: { borderLeftWidth: 4, paddingLeft: SIZES.sm, borderTopWidth: 0, marginTop: SIZES.xs },
    name: { fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
    sub: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: 2 },
    check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    checkOn: { backgroundColor: COLORS.primary },
    checkMark: { color: COLORS.textWhite, fontWeight: '800', fontSize: SIZES.small },
    btns: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.sm },
    btn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.md },
    btnText: { color: COLORS.textWhite, fontWeight: '800' },
  });
