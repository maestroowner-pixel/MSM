// ===================================
// Edit the ID card photo before it is kept (17 Oct 2026): brightness, contrast,
// saturation, and "Remove background" — the person on a plain light background
// (utils/photoEdit). Browser only: the cards are printed from the computer; a
// phone keeps the picture as taken.
// ===================================

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { t, t as tr, tk, useT } from '../utils/i18n';
import { SIZES } from '../theme';
import { Adjust, NO_ADJUST, renderPhoto } from '../utils/photoEdit';

const SLIDERS: { key: keyof Adjust; label: string }[] = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
];

export function PhotoEditor({ src, onDone, onClose }: { src: string | null; onDone: (dataUri: string) => void; onClose: () => void }) {
  const COLORS = useTheme();
  useT();
  const [a, setA] = useState<Adjust>(NO_ADJUST);
  const [cutout, setCutout] = useState(false);
  const [view, setView] = useState<string | null>(src);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setA(NO_ADJUST);
    setCutout(false);
    setView(src);
    setErr(null);
  }, [src]);

  // Redraw after each change (a short pause, so dragging a slider stays smooth).
  useEffect(() => {
    if (!src) return;
    let live = true;
    const t = setTimeout(() => {
      if (cutout) setBusy(tr('pe.removing'));
      renderPhoto(src, a, cutout)
        .then((u) => live && setView(u))
        .catch((e) => {
          if (!live) return;
          setErr(String(e?.message ?? e));
          setCutout(false);
        })
        .finally(() => live && setBusy(null));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [src, a, cutout]);

  if (!src) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.back}>
        <View style={[s.card, { backgroundColor: COLORS.cardSolid }]}>
          <Text style={[s.title, { color: COLORS.text }]}>{t('pe.title')}</Text>
          <View style={s.body}>
            <View style={s.preview}>
              {view ? <Image source={{ uri: view }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
              {busy ? (
                <View style={s.busy}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 220, gap: SIZES.sm }}>
              {SLIDERS.map((sl) => (
                <View key={sl.key}>
                  <Text style={{ color: COLORS.textLight, fontSize: SIZES.small, fontWeight: '700' }}>{`${tk(`pe.${sl.key}`)} · ${Math.round(a[sl.key] * 100)}%`}</Text>
                  {/* A plain range input — this window only opens in the browser. */}
                  {React.createElement('input', {
                    type: 'range',
                    min: 50,
                    max: 150,
                    step: 1,
                    value: Math.round(a[sl.key] * 100),
                    'aria-label': tk(`pe.${sl.key}`),
                    onChange: (e: any) => setA((x) => ({ ...x, [sl.key]: Number(e.target.value) / 100 })),
                    style: { width: '100%', accentColor: COLORS.primary },
                  })}
                </View>
              ))}
              <TouchableOpacity style={[s.chip, { borderColor: COLORS.primary }, cutout && { backgroundColor: COLORS.primary }]} onPress={() => setCutout((v) => !v)} disabled={!!busy}>
                <Text style={{ color: cutout ? '#fff' : COLORS.primary, fontWeight: '700' }}>{cutout ? t('pe.removed') : t('pe.remove')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setA(NO_ADJUST); setCutout(false); }} hitSlop={6}>
                <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>{t('pe.reset')}</Text>
              </TouchableOpacity>
              {busy ? <Text style={{ color: COLORS.textLight, fontSize: SIZES.small }}>{busy}</Text> : null}
              {err ? <Text style={{ color: COLORS.danger, fontSize: SIZES.small }}>{err}</Text> : null}
            </View>
          </View>
          <View style={s.row}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={[s.btn, { backgroundColor: COLORS.primary, opacity: busy || !view ? 0.6 : 1 }]} disabled={!!busy || !view} onPress={() => view && onDone(view)}>
              <Text style={s.btnText}>{t('pe.use')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md },
  card: { width: '100%', maxWidth: 640, borderRadius: SIZES.radiusMd, padding: SIZES.md },
  title: { fontWeight: '800', fontSize: SIZES.body, marginBottom: SIZES.sm },
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.md },
  preview: { width: 220, aspectRatio: 22 / 28, borderRadius: 8, overflow: 'hidden', backgroundColor: '#ddd' },
  busy: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: SIZES.md, alignSelf: 'flex-start', marginTop: SIZES.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md },
  btn: { borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.lg },
  btnText: { color: '#fff', fontWeight: '800' },
});
