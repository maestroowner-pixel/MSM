// ===================================
// A portrait from a camera — the laptop's webcam or the phone's (17 Oct 2026:
// "the photo can be taken with the laptop's or the phone's camera"). The system
// photo picker on a computer only offers files; this window shows the camera
// itself (expo-camera, the scanner's own), an outline for head and shoulders,
// and Capture / Flip. The caller gets the picture's uri.
// ===================================

import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useTheme } from '../contexts/ThemeContext';
import { SIZES } from '../theme';

export function PhotoCamera({ visible, onTaken, onClose, title = 'Photo' }: { visible: boolean; onTaken: (uri: string) => void; onClose: () => void; title?: string }) {
  const COLORS = useTheme();
  const cam = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const capture = async () => {
    if (!cam.current || busy) return;
    setBusy(true);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.85 });
      if (pic?.uri) onTaken(pic.uri);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.back}>
        <View style={[s.card, { backgroundColor: COLORS.cardSolid }]}>
          <Text style={[s.title, { color: COLORS.text }]}>{title}</Text>
          {!permission ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : !permission.granted ? (
            <View style={{ gap: SIZES.sm }}>
              <Text style={{ color: COLORS.textLight }}>The camera is needed to take the photo.</Text>
              <TouchableOpacity style={[s.btn, { backgroundColor: COLORS.primary }]} onPress={() => void requestPermission()}>
                <Text style={s.btnText}>Allow the camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.frame}>
              {visible ? <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} /> : null}
              {/* Head and shoulders go in the outline — the card shows a 22 × 28 mm portrait. */}
              <View pointerEvents="none" style={s.guide} />
            </View>
          )}
          {err ? <Text style={{ color: COLORS.danger, marginTop: SIZES.xs }}>{err}</Text> : null}
          <View style={s.row}>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {permission?.granted ? (
              <>
                <TouchableOpacity onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} hitSlop={8}>
                  <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Flip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: COLORS.primary, opacity: busy ? 0.6 : 1 }]} onPress={() => void capture()} disabled={busy}>
                  <Text style={s.btnText}>{busy ? 'Taking…' : 'Capture'}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: SIZES.md },
  card: { width: '100%', maxWidth: 520, borderRadius: SIZES.radiusMd, padding: SIZES.md },
  title: { fontWeight: '800', fontSize: SIZES.body, marginBottom: SIZES.sm },
  frame: { width: '100%', aspectRatio: 4 / 5, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  guide: { width: '62%', height: '78%', borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', borderStyle: 'dashed' },
  row: { flexDirection: 'row', alignItems: 'center', gap: SIZES.md, marginTop: SIZES.md },
  btn: { borderRadius: SIZES.radiusMd, paddingVertical: 10, paddingHorizontal: SIZES.lg },
  btnText: { color: '#fff', fontWeight: '800' },
});
