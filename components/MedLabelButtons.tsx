// ===================================
// QR labels for the medicine chest (17 Nov 2026: "labels and the scanner — the
// same in ISMPilot and MHM"). One item from MedItemSc, the whole chest from the
// Register: to the Xprinter (size first) or as a PDF sheet. The payload is
// msm://med/<id> — services/crewQr — which Marine Hospital Manager prints too.
// ===================================

import React, { useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import { MciIcon } from './MciIcon';
import { PrinterModal } from './PrinterModal';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { t, tn } from '../utils/i18n';
import { MedItem } from '../types/hospital';
import { exportMedLabels, medLabelSpecs, GANGWAY_STOCKS } from '../services/crewCards';
import { GANGWAY_STOCK_MM } from '../services/gangwayLabels';
import { TsplLabelSpec, labelsToTspl } from '../services/tspl';
import { getSavedPrinter, printTspl, SavedPrinter } from '../services/blePrinter';
import { makeStyles } from '../screens/SafetySc';

export function MedLabelButtons({ items }: { items: MedItem[] }) {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const { vessel } = useData();
  const [printerOpen, setPrinterOpen] = useState(false);
  const [pending, setPending] = useState<{ specs: TsplLabelSpec[]; what: string } | null>(null);
  if (!items.length) return null;
  const what = items.length === 1 ? t('sro.labelOf', { name: items[0].name }) : tn('n.medLabel', items.length);

  const send = async (printer: SavedPrinter, job: { specs: TsplLabelSpec[]; what: string }) => {
    try {
      await printTspl(printer.id, labelsToTspl(job.specs));
      Alert.alert(t('print.sent'), t('sro.sentTo', { what: job.what, printer: printer.name }));
    } catch (e: any) {
      Alert.alert(t('print.xprinterFail'), String(e?.message ?? e));
    } finally {
      setPending(null);
    }
  };

  const toXprinter = () =>
    Alert.alert(t('print.labelSize'), t('print.roll'), [
      ...GANGWAY_STOCKS.map((sz) => ({
        text: `${GANGWAY_STOCK_MM[sz].widthMm} × ${GANGWAY_STOCK_MM[sz].heightMm} mm`,
        onPress: async () => {
          const job = { specs: medLabelSpecs(items, sz), what };
          const printer = await getSavedPrinter();
          if (printer) return void send(printer, job);
          setPending(job);
          setPrinterOpen(true);
        },
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);

  const toPdf = () =>
    void exportMedLabels(items, vessel).catch((e: any) => Alert.alert(t('hos.labels'), String(e?.message ?? e)));

  return (
    <View style={[styles.row, { flexWrap: 'wrap' }]}>
      <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={toXprinter}>
        <MciIcon name="printer" size={14} color={COLORS.primary} />
        <Text style={styles.smallText}>{items.length === 1 ? t('hos.labelXprinter') : t('hos.labelsXprinter', { n: items.length })}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.small, { flexDirection: 'row', alignItems: 'center', gap: 4 }]} onPress={toPdf}>
        <MciIcon name="qrcode" size={14} color={COLORS.primary} />
        <Text style={styles.smallText}>{items.length === 1 ? t('pat.qrPdf') : t('hos.labelsPdf', { n: items.length })}</Text>
      </TouchableOpacity>
      <PrinterModal visible={printerOpen} onClose={() => { setPrinterOpen(false); setPending(null); }} onPicked={(p) => { setPrinterOpen(false); if (pending) void send(p, pending); }} />
    </View>
  );
}
