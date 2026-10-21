// ===================================
// Printer picker — scan for the Bluetooth label printer, pick it, remember it.
//
// The keeper opens this once, taps their XP-420B, and it becomes the default for
// "Print to Xprinter". A saved printer is shown at the top so re-opening this is
// just confirmation, not a re-scan every time.
// ===================================

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { t, useT } from '../utils/i18n';
import { SIZES } from '../theme';
import {
  FoundDevice,
  SavedPrinter,
  clearSavedPrinter,
  getSavedPrinter,
  savePrinter,
  scanPrinters,
} from '../services/blePrinter';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after the keeper picks (and we save) a printer. */
  onPicked?: (printer: SavedPrinter) => void;
}

export function PrinterModal({ visible, onClose, onPicked }: Props) {
  const c = useTheme();
  useT();
  const [saved, setSaved] = useState<SavedPrinter | null>(null);
  const [devices, setDevices] = useState<FoundDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    if (!visible) return;
    getSavedPrinter().then(setSaved);
    startScan();
    return stopScan;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startScan = async () => {
    setError(null);
    setDevices([]);
    setScanning(true);
    stopRef.current = await scanPrinters(
      (d) => setDevices((prev) => (prev.some((x) => x.id === d.id) ? prev : [...prev, d])),
      (e) => {
        setError(e.message);
        setScanning(false);
      }
    );
    // BLE scans should not run forever — stop after 12s.
    setTimeout(stopScan, 12000);
  };

  const stopScan = () => {
    stopRef.current?.();
    stopRef.current = null;
    setScanning(false);
  };

  const pick = async (d: FoundDevice) => {
    stopScan();
    const printer = { id: d.id, name: d.name };
    await savePrinter(printer);
    setSaved(printer);
    onPicked?.(printer);
    onClose();
  };

  const forget = async () => {
    await clearSavedPrinter();
    setSaved(null);
  };

  const styles = makeStyles(c);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>{t('prn.title')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>

          {saved ? (
            <View style={styles.savedRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedLabel}>{t('prn.current')}</Text>
                <Text style={styles.savedName}>{saved.name}</Text>
              </View>
              <TouchableOpacity onPress={forget}>
                <Text style={styles.forget}>{t('prn.forget')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.scanRow}>
            <Text style={styles.scanLabel}>
              {scanning ? t('prn.scanning') : t('prn.nearby')}
            </Text>
            {scanning ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <TouchableOpacity onPress={startScan}>
                <Text style={styles.rescan}>{t('prn.rescan')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <FlatList
            data={devices}
            keyExtractor={(d) => d.id}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.device} onPress={() => pick(item)}>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceId}>{item.id}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !scanning ? (
                <Text style={styles.empty}>{t('prn.empty')}</Text>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: SIZES.radiusLg,
      borderTopRightRadius: SIZES.radiusLg,
      padding: SIZES.lg,
      paddingBottom: SIZES.xl,
    },
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: SIZES.md },
    title: { flex: 1, fontSize: SIZES.h4, fontWeight: '700', color: c.text },
    close: { color: c.primary, fontWeight: '700' },
    savedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.primary + '14',
      borderRadius: SIZES.radiusMd,
      padding: SIZES.md,
      marginBottom: SIZES.md,
    },
    savedLabel: { color: c.textLight, fontSize: SIZES.small },
    savedName: { color: c.text, fontSize: SIZES.body, fontWeight: '700', marginTop: 2 },
    forget: { color: c.danger, fontWeight: '700' },
    scanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SIZES.sm },
    scanLabel: { color: c.textLight, fontSize: SIZES.small },
    rescan: { color: c.primary, fontWeight: '700' },
    error: { color: c.danger, fontSize: SIZES.small, marginBottom: SIZES.sm },
    device: {
      paddingVertical: SIZES.md,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    deviceName: { color: c.text, fontSize: SIZES.body, fontWeight: '600' },
    deviceId: { color: c.textLight, fontSize: SIZES.tiny, marginTop: 2 },
    empty: { color: c.textLight, fontSize: SIZES.small, paddingVertical: SIZES.md, lineHeight: 18 },
  });
