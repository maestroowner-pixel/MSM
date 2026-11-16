// ===================================
// Step by step — every screen, every action as a chain of steps.
// Content: constants/manualSteps.ts, generated from the Oxford manual/manual.html.
// English only: a step names the app's English labels; the place and the order
// are the same in every interface language. Opens at a screen with { id }.
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Screen, ScreenTitle, Empty } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { MANUAL_STEPS, StepScreen, StepWho } from '../constants/manualSteps';
import { t, useT } from '../utils/i18n';

const WHO: Record<StepWho, string> = { everyone: 'everyone', officers: 'officers', master: 'Master', office: 'superintendent' };

/** A step's text with **Label** shown as a key. */
function StepText({ s, style, keyStyle }: { s: string; style: any; keyStyle: any }) {
  const parts = s.split(/\*\*(.+?)\*\*/g);
  return <Text style={style}>{parts.map((p, i) => (i % 2 ? <Text key={i} style={keyStyle}>{` ${p} `}</Text> : p))}</Text>;
}

function matches(s: StepScreen, q: string) {
  return s.acts.filter((a) => !q || `${s.title} ${a.t} ${a.steps.join(' ')} ${a.note ?? ''}`.toLowerCase().includes(q));
}

export default function ManualStepsSc({ route }: any) {
  useT();
  const styles = useS();
  const COLORS = useTheme();
  const [q, setQ] = useState('');
  const [openScreen, setOpenScreen] = useState<string | null>(route?.params?.id ?? null);
  const [openAct, setOpenAct] = useState<string | null>(null);
  const query = q.trim().toLowerCase();

  const groups = useMemo(
    () => MANUAL_STEPS.map((g) => ({ title: g.title, screens: g.screens.map((s) => ({ s, acts: matches(s, query) })).filter((x) => x.acts.length) })).filter((g) => g.screens.length),
    [query],
  );
  const n = groups.reduce((a, g) => a + g.screens.reduce((b, x) => b + x.acts.length, 0), 0);

  return (
    <Screen scroll>
      <ScreenTitle title={t('ms.title')} subtitle={t('ms.sub')} />
      <Text style={styles.lead}>{t('ms.lead')}</Text>
      <View style={styles.searchRow}>
        <MciIcon name="magnify" size={18} color={COLORS.textLight} />
        <TextInput style={styles.search} value={q} onChangeText={setQ} placeholder={t('ms.search')} placeholderTextColor={COLORS.textLight} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" />
        <Text style={styles.count}>{query ? t('ms.found', { n }) : t('ms.actions', { n })}</Text>
      </View>
      {!groups.length ? <Empty text={t('ms.none')} /> : null}
      {groups.map((g) => (
        <View key={g.title}>
          <Text style={styles.group}>{g.title}</Text>
          {g.screens.map(({ s, acts }) => {
            const open = !!query || openScreen === s.id;
            return (
              <View key={s.id} style={styles.card}>
                <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => setOpenScreen(openScreen === s.id ? null : s.id)}>
                  <Text style={styles.title}>{s.title}</Text>
                  <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
                </TouchableOpacity>
                {open ? (
                  <View style={styles.body}>
                    <View style={styles.where}>
                      {s.path.map((p, i) => (
                        <React.Fragment key={i}>
                          {i ? <Text style={styles.arrow}>→</Text> : null}
                          <Text style={styles.key}>{p}</Text>
                        </React.Fragment>
                      ))}
                      <Text style={styles.who}>{WHO[s.who]}</Text>
                    </View>
                    {s.perVessel ? <Text style={styles.flag}>{t('ms.perVessel')}</Text> : null}
                    <StepText s={s.intro} style={styles.para} keyStyle={styles.inKey} />
                    {acts.map((a) => {
                      const k = `${s.id}/${a.t}`;
                      const aOpen = !!query || openAct === k;
                      return (
                        <View key={k} style={styles.act}>
                          <TouchableOpacity style={styles.actHead} activeOpacity={0.7} onPress={() => setOpenAct(openAct === k ? null : k)}>
                            <Text style={styles.chevSmall}>{aOpen ? '▾' : '▸'}</Text>
                            <Text style={styles.actTitle}>{a.t}</Text>
                            {a.who ? <Text style={styles.who}>{WHO[a.who]}</Text> : null}
                            {a.perVessel ? <Text style={styles.flagSmall}>{t('ms.perVesselShort')}</Text> : null}
                          </TouchableOpacity>
                          {aOpen ? (
                            <View style={styles.chain}>
                              {a.steps.map((st, i) => (
                                <View key={i} style={styles.stepRow}>
                                  <Text style={styles.num}>{i + 1}</Text>
                                  <StepText s={st} style={styles.step} keyStyle={styles.inKey} />
                                </View>
                              ))}
                              {a.note ? (
                                <View style={styles.note}>
                                  <StepText s={a.note} style={styles.noteText} keyStyle={styles.inKey} />
                                </View>
                              ) : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.foot}>{t('ms.foot')}</Text>
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  lead: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 20, marginBottom: SIZES.md },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, borderWidth: 1, borderColor: COLORS.border, borderRadius: SIZES.radiusMd, paddingHorizontal: SIZES.md, marginBottom: SIZES.md, ...COLORS.glassInput },
  search: { flex: 1, minWidth: 0, paddingVertical: 10, fontSize: SIZES.body, color: COLORS.textDark },
  count: { fontSize: SIZES.small, color: COLORS.textLight },
  group: { fontSize: SIZES.small, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: SIZES.md, marginBottom: SIZES.sm },
  card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, marginBottom: SIZES.sm, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SIZES.md, gap: SIZES.sm },
  title: { flex: 1, fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  chevron: { fontSize: SIZES.h5, color: COLORS.textLight },
  body: { paddingHorizontal: SIZES.md, paddingBottom: SIZES.md, gap: SIZES.sm },
  where: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  key: { fontSize: SIZES.small, fontWeight: '600', color: COLORS.textDark, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  arrow: { color: COLORS.textLight, fontSize: SIZES.small },
  who: { fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.primary, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, overflow: 'hidden', marginLeft: 4 },
  flag: { fontSize: SIZES.small, color: COLORS.textLight },
  flagSmall: { fontSize: SIZES.tiny, color: COLORS.textLight },
  para: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 20 },
  inKey: { fontWeight: '700', color: COLORS.textDark, backgroundColor: COLORS.border },
  act: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  actHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SIZES.xs, paddingVertical: SIZES.sm },
  chevSmall: { fontSize: SIZES.body, color: COLORS.textLight, width: 14 },
  actTitle: { flexShrink: 1, fontSize: SIZES.body, fontWeight: '600', color: COLORS.textDark },
  chain: { paddingLeft: SIZES.md, paddingBottom: SIZES.sm, gap: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SIZES.sm },
  num: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: COLORS.border, textAlign: 'center', lineHeight: 20, fontSize: SIZES.tiny, fontWeight: '700', color: COLORS.textDark, overflow: 'hidden' },
  step: { flex: 1, fontSize: SIZES.body, color: COLORS.text, lineHeight: 22 },
  note: { backgroundColor: 'rgba(243, 156, 18, 0.12)', borderLeftWidth: 3, borderLeftColor: COLORS.warning, borderRadius: SIZES.radiusSm, padding: SIZES.sm, marginTop: 2 },
  noteText: { fontSize: SIZES.small, color: COLORS.text, lineHeight: 19 },
  foot: { fontSize: SIZES.small, color: COLORS.textLight, marginTop: SIZES.lg, lineHeight: 18 },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
