// ===================================
// Manual — in-app user guide (accordion sections).
// Localized to the device language (ru/es/uk) when set, else English.
// Content lives in constants/manual.ts; language is picked by utils/locale.
// ===================================

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager, Linking, Image } from 'react-native';
import { Screen, ScreenTitle, GlyphBadge } from '../components/ui';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { MANUAL } from '../constants/manual';
import { manualLang } from '../utils/locale';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A reference token is a recognisable standard (vs a generic note like "maker").
const STANDARD_RE = /SOLAS|FSS\s*Code|LSA\s*Code|MSC|MARPOL|MLC|WHO|Res\./i;

/** Search URL for a regulatory reference (no public per-article deep links exist). */
function refUrl(token: string): string | null {
  const t = token.trim();
  if (!STANDARD_RE.test(t)) return null;
  const q = /WHO/i.test(t) ? 'WHO International Medical Guide for Ships' : `${t} IMO`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Render a `ref` string as tappable links per standard, separated by " · ". */
function RefLinks({ refStr }: { refStr: string }) {
  const styles = useS();
  const tokens = refStr.split(';').map((t) => t.trim()).filter(Boolean);
  return (
    <View style={styles.refRow}>
      {tokens.map((t, i) => {
        const url = refUrl(t);
        const sep = i < tokens.length - 1 ? '  ·  ' : '';
        return url ? (
          <TouchableOpacity key={i} onPress={() => Linking.openURL(url)} hitSlop={6}>
            <Text style={styles.refLink}>{t}{sep}</Text>
          </TouchableOpacity>
        ) : (
          <Text key={i} style={styles.refPlain}>{t}{sep}</Text>
        );
      })}
    </View>
  );
}

export default function ManualSc() {
  const styles = useS();
  const content = useMemo(() => MANUAL[manualLang()], []);
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === i ? null : i));
  };

  return (
    <Screen scroll>
      <ScreenTitle title={content.screenTitle} subtitle={content.screenSubtitle} />
      {content.sections.map((s, i) => {
        const expanded = open === i;
        return (
          <View key={s.title} style={styles.card}>
            <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => toggle(i)}>
              <GlyphBadge emoji={s.emoji} size={20} />
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
            </TouchableOpacity>
            {expanded ? (
              <View style={styles.body}>
                {s.octopus ? (
                  <Image source={require('../assets/octopus.png')} style={styles.octopus} resizeMode="contain" />
                ) : null}
                {s.note ? (
                  <View style={styles.note}>
                    <Text style={styles.noteText}>⚠️ {s.note}</Text>
                  </View>
                ) : null}
                {s.body?.map((p, j) => (
                  <Text key={`p${j}`} style={[styles.para, s.octopus && styles.paraCenter]}>
                    {p}
                  </Text>
                ))}
                {s.rows?.map((r, j) => (
                  <View key={`r${j}`} style={[styles.intRow, j > 0 && styles.intRowDivider]}>
                    <Text style={styles.intK}>{r.k}</Text>
                    <Text style={styles.intV}>{r.v}</Text>
                    {r.ref ? <RefLinks refStr={r.ref} /> : null}
                  </View>
                ))}
                {s.link ? (
                  <TouchableOpacity onPress={() => Linking.openURL(`https://${s.link}`)} hitSlop={8}>
                    <Text style={[styles.link, s.octopus && styles.paraCenter]}>{s.link}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  card: { ...COLORS.glassCard, borderRadius: SIZES.radiusMd, marginBottom: SIZES.sm, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SIZES.md, gap: SIZES.sm },
  emoji: { fontSize: 22 },
  title: { flex: 1, fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  chevron: { fontSize: SIZES.h5, color: COLORS.textLight },
  body: { paddingHorizontal: SIZES.md, paddingBottom: SIZES.md, gap: SIZES.sm, position: 'relative' },
  octopus: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.32 },
  para: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 20 },
  paraCenter: { textAlign: 'center' },
  note: {
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.warning,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
  },
  noteText: { fontSize: SIZES.small, color: COLORS.text, lineHeight: 18 },
  intRow: { paddingVertical: SIZES.sm },
  intRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  intK: { fontSize: SIZES.body, fontWeight: '700', color: COLORS.textDark },
  intV: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 19, marginTop: 2 },
  refRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 3 },
  refLink: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '700', textDecorationLine: 'underline' },
  refPlain: { fontSize: SIZES.tiny, color: COLORS.textLight, fontWeight: '600' },
  link: { fontSize: SIZES.body, color: COLORS.primary, fontWeight: '700', marginTop: SIZES.xs },
});

function useS() {
  const c = useTheme();
  return useMemo(() => makeStyles(c), [c]);
}
