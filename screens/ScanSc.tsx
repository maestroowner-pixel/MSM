// ===================================
// Scan (modal) — point the phone at a sticker, get the item.
//
// A match opens ItemDetail directly and REPLACES this screen in the stack: both
// lookup routes are exact string matches, so there is nothing to confirm, and
// "back" from the item should return to the list the user came from rather than to
// a camera they are finished with.
//
// The two failures are kept apart on purpose (see services/barcode.ts): a code we
// have never seen is simply not ours, whereas one of our own labels pointing at a
// missing item is a register problem worth saying out loud.
//
// Manual entry sits under the camera on every platform. It is not a web fallback
// bolted on — it is what is needed when a code is too scraped to scan and the
// digits are still readable, and it runs the identical lookup.
//
// Windows: expo-camera has no Windows build and is swapped for mocks/expo-camera.js
// by metro.config.js. The stub reports permission permanently denied, and the guard
// below turns the screen into manual entry — which still works, because the lookup
// is pure JS.
// ===================================

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SCAN_BARCODE_TYPES, ScanMatch, lookupScan } from '../services/barcode';
import { SIZES, Palette } from '../theme';

/** No expo-camera on Windows — see the module header. */
const HAS_CAMERA = Platform.OS !== 'windows';

export default function ScanSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { flat } = useData();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<ScanMatch | null>(null);
  const [manual, setManual] = useState('');

  // The scanner fires on every frame that holds a code — several times before any
  // state update lands. A ref is the only guard fast enough to keep one sticker
  // from opening one screen twice.
  const locked = useRef(false);

  const handle = useCallback(
    (code: string) => {
      if (locked.current) return;
      locked.current = true;

      const match = lookupScan(code, flat);
      if (match.kind === 'item') {
        // ItemDetail is keyed by {category, id}; the category came back from the
        // register, not from the sticker.
        nav.replace('ItemDetail', { category: match.category, id: match.item.id });
        return;
      }
      setResult(match);
    },
    [flat, nav]
  );

  const again = () => {
    locked.current = false;
    setResult(null);
    setManual('');
  };

  const submitManual = () => {
    const code = manual.trim();
    if (code) handle(code);
  };

  const cameraReady = HAS_CAMERA && permission?.granted && !result;

  return (
    <Screen scroll>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ScreenTitle title="Scan" subtitle="An MSM QR label, or a serial / asset tag." />
        </View>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </View>

      {!HAS_CAMERA ? (
        <Card>
          <Label>No camera here</Label>
          <Text style={styles.note}>
            Scanning is a phone job — this build has no camera. Type the code or the serial below
            instead; the lookup is exactly the one the scanner uses.
          </Text>
        </Card>
      ) : !permission ? null : !permission.granted ? (
        <Card>
          <Label>Camera access</Label>
          <Text style={styles.note}>
            MSM needs the camera to read QR labels and barcodes off equipment. Nothing is recorded —
            the frame is decoded and discarded.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void requestPermission()}>
            <Text style={styles.primaryBtnText}>Allow camera</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {cameraReady ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: SCAN_BARCODE_TYPES }}
            onBarcodeScanned={({ data }) => handle(data)}
          />
          <View style={styles.reticle} pointerEvents="none" />
        </View>
      ) : null}

      {result?.kind === 'stale' ? (
        <Card>
          <Label>This label is not in the register</Label>
          <Text style={styles.note}>
            The sticker is one of ours, but the item it points to is gone — deleted, or this device
            is holding an older copy of the register than the vessel is. Check the category list, and
            the sync state, before re-creating anything: re-adding it here would put back, as a new
            item, something somebody removed on purpose.
          </Text>
          <Text style={styles.code}>{result.itemId}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={again}>
            <Text style={styles.secondaryBtnText}>Scan again</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {result?.kind === 'unknown' ? (
        <Card>
          <Label>Not on file</Label>
          <Text style={styles.note}>
            Nothing in the register carries this code. If it is the maker's own barcode, open the
            item and put it in the “Serial / ID” field — then this code will find it next time.
          </Text>
          <Text style={styles.code}>{result.code}</Text>
          <TouchableOpacity style={styles.secondaryBtn} onPress={again}>
            <Text style={styles.secondaryBtnText}>Scan again</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {!result ? (
        <Card>
          <Label>Or type the code</Label>
          <Text style={styles.note}>
            For a label too scraped or faded to scan, if the characters are still readable.
          </Text>
          <View style={styles.manualRow}>
            <TextInput
              style={styles.input}
              value={manual}
              onChangeText={setManual}
              placeholder="Serial / ID number"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={submitManual}
            />
            <TouchableOpacity
              style={[styles.goBtn, !manual.trim() && { opacity: 0.4 }]}
              disabled={!manual.trim()}
              onPress={submitManual}
            >
              <MciIcon name="magnify" size={20} color={COLORS.textWhite} />
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'flex-start' },
    cameraBox: {
      height: 320,
      borderRadius: SIZES.radiusLg,
      overflow: 'hidden',
      backgroundColor: '#000',
      marginBottom: SIZES.md,
    },
    reticle: {
      position: 'absolute',
      top: '18%',
      left: '18%',
      right: '18%',
      bottom: '18%',
      borderWidth: 2,
      borderColor: COLORS.textWhite,
      borderRadius: SIZES.radiusMd,
      opacity: 0.9,
    },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    code: {
      color: COLORS.text,
      fontSize: SIZES.body,
      fontWeight: '700',
      paddingTop: SIZES.sm,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    manualRow: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm, paddingTop: SIZES.md },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusMd,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.md,
      color: COLORS.text,
      backgroundColor: COLORS.card,
    },
    goBtn: { backgroundColor: COLORS.primary, borderRadius: SIZES.radiusMd, padding: SIZES.md },
    primaryBtn: {
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.lg,
      alignItems: 'center',
      marginTop: SIZES.md,
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
    secondaryBtn: {
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      alignItems: 'center',
      marginTop: SIZES.sm,
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '700' },
  });
