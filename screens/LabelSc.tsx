// ===================================
// Label (modal) — QR sticker preview, size choice, print.
//
// Reached from ItemDetail for one item, or from CategoryItems' multi-select for a
// batch. Both take the same route: the preview shows the FIRST label at true
// proportions, because a batch of eighty stickers is eighty copies of one layout,
// and the only thing worth checking before committing a roll is whether that
// layout fits.
// ===================================

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';

import { Card, Label, Screen, ScreenTitle } from '../components/ui';
// Direct MciIcon (as PaywallSc does) rather than ui.tsx's Glyph: Glyph maps the
// app's LEGACY section emojis onto glyphs and answers "help-circle-outline" for
// anything it has never heard of — a printer would come out as a question mark.
import { MciIcon } from '../components/MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { EquipmentItem } from '../types/equipment';
import { SIZES, Palette } from '../theme';
import {
  LABEL_SIZES,
  LABEL_STOCKS,
  LabelSize,
  QR_ECL,
  QUIET_ZONE,
  canPrintLabels,
  canSaveLabelsPdf,
  humanId,
  itemQrPayload,
  labelLines,
  labelTitle,
  printLabels,
  qrModuleCount,
  saveLabelsPdf,
} from '../services/qrLabel';

/** pt → mm, so the preview's type scales by the same rule as the printed sheet. */
const PT_MM = 25.4 / 72;

/**
 * React Native's density-independent pixel is defined against a 160 dpi baseline,
 * so this many dp make a millimetre on any screen. Which means the 50×30 preview
 * can be shown at true physical size — hold the phone next to the roll and it is
 * the sticker.
 */
const DP_PER_MM = 160 / 25.4;

/**
 * The preview. It mirrors services/qrLabel.ts's layout rather than sharing code
 * with it — one side is React Native, the other is print HTML. What holds them
 * together is the shared LABEL_STOCKS dimensions and the shared content helpers
 * (labelTitle/humanId/labelLines), so the two can disagree about pixels but never
 * about what the sticker SAYS.
 */
function LabelPreview({ item, size, width }: { item: EquipmentItem; size: LabelSize; width: number }) {
  const COLORS = useTheme();
  const stock = LABEL_STOCKS[size];
  const small = size === '50x30';

  // Everything below is expressed in millimetres and scaled once, exactly as the
  // print stylesheet does.
  const scale = width / stock.widthMm;
  const mm = (v: number) => v * scale;
  const pt = (v: number) => v * PT_MM * scale;

  const payload = itemQrPayload(item.id);
  const qrPx = mm(stock.qrMm);
  const { strong, weak } = labelLines(item);

  return (
    <View
      style={{
        width,
        height: mm(stock.heightMm),
        padding: mm(small ? 1.5 : 3),
        flexDirection: 'row',
        alignItems: 'center',
        gap: mm(small ? 1.5 : 3),
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
        borderWidth: 1,
        borderColor: COLORS.borderDark,
        overflow: 'hidden',
      }}
    >
      <QRCode
        value={payload}
        size={qrPx}
        ecl={QR_ECL}
        // The printed SVG spends `qrMm` on the code INCLUDING its quiet zone; this
        // component instead fits size + 2×quietZone modules' worth into `size`, so
        // the same margin has to be handed over in points. Without this the preview
        // draws noticeably fatter modules than the printer does.
        quietZone={(QUIET_ZONE * qrPx) / qrModuleCount(payload)}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ color: '#000', fontSize: pt(small ? 7.5 : 11), fontWeight: 'bold' }}>
          {labelTitle(item)}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: '#000', fontSize: pt(small ? 6 : 8.5), marginTop: mm(small ? 0.5 : 1) }}
        >
          {humanId(item)}
        </Text>
        {!small && strong.length ? (
          <Text style={{ color: '#000', fontSize: pt(9), fontWeight: 'bold', marginTop: mm(1.2) }}>
            {strong.join('  ·  ')}
          </Text>
        ) : null}
        {!small && weak.length ? (
          <Text numberOfLines={2} style={{ color: '#000', fontSize: pt(6.5), marginTop: mm(1) }}>
            {weak.join('  ·  ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function LabelSc() {
  const COLORS = useTheme();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const { flat } = useData();
  const { width: screenW } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);

  const [size, setSize] = useState<LabelSize>('100x50');
  const [busy, setBusy] = useState<null | 'print' | 'pdf'>(null);

  // One id or many — a batch of one is just a batch, so there is a single path.
  const ids: string[] = useMemo(() => {
    const raw = route.params?.ids ?? (route.params?.id ? [route.params.id] : []);
    return Array.isArray(raw) ? raw : [raw];
  }, [route.params]);

  const items: EquipmentItem[] = useMemo(
    () => ids.map((id) => flat.find((i) => i.id === id)).filter((i): i is EquipmentItem => !!i),
    [ids, flat]
  );

  if (items.length === 0) {
    return (
      <Screen>
        <ScreenTitle title="Nothing to label" subtitle="These items are no longer in the register." />
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </Screen>
    );
  }

  const stock = LABEL_STOCKS[size];
  // Life size where it fits, screen-bounded where it does not — never larger. A
  // 50×30 sticker blown up to fill a phone teaches the wrong lesson about whether
  // the text fits; 100×50 will not fit on a phone, so it scales down and only
  // proportions can be judged.
  const previewW = Math.min(screenW - SIZES.lg * 4, stock.widthMm * DP_PER_MM);

  const run = async (mode: 'print' | 'pdf') => {
    setBusy(mode);
    try {
      if (mode === 'print') await printLabels(items, size);
      else await saveLabelsPdf(items, size);
    } catch (e: any) {
      // A cancelled print dialog is not a failure; anything else the user needs to
      // know about, because a silent no-op looks exactly like a printed label.
      const msg = String(e?.message ?? e);
      if (!/cancel/i.test(msg)) Alert.alert('Could not print the labels', msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <ScreenTitle
            title={items.length === 1 ? 'Print label' : `Print ${items.length} labels`}
            subtitle={
              items.length === 1
                ? labelTitle(items[0])
                : 'Preview shows the first label — all use this layout.'
            }
          />
        </View>
        <TouchableOpacity onPress={() => nav.goBack()}>
          <Text style={{ color: COLORS.primary, fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </View>

      <Card>
        <Label>Label stock</Label>
        <View style={styles.toggle}>
          {LABEL_SIZES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.toggleBtn, size === s && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
              onPress={() => setSize(s)}
            >
              <Text style={[styles.toggleText, size === s && { color: COLORS.textWhite }]}>
                {LABEL_STOCKS[s].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.note}>{stock.hint}</Text>
      </Card>

      <Card>
        <Label>Preview — actual proportions</Label>
        <View style={styles.previewWrap}>
          <LabelPreview item={items[0]} size={size} width={previewW} />
        </View>
        <Text style={styles.note}>
          The QR carries {itemQrPayload(items[0].id)} — the item's permanent id. Reprint it as often
          as a sticker is lost or scraped: the code never changes, so a reprint can never split one
          item into two.
        </Text>
      </Card>

      {canPrintLabels ? (
        <>
          <TouchableOpacity style={styles.primaryBtn} disabled={!!busy} onPress={() => void run('print')}>
            {busy === 'print' ? (
              <ActivityIndicator color={COLORS.textWhite} />
            ) : (
              <>
                <MciIcon name="printer" size={18} color={COLORS.textWhite} />
                <Text style={styles.primaryBtnText}>
                  Print {items.length === 1 ? 'label' : `${items.length} labels`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {canSaveLabelsPdf ? (
            <TouchableOpacity style={styles.secondaryBtn} disabled={!!busy} onPress={() => void run('pdf')}>
              {busy === 'pdf' ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <Text style={styles.secondaryBtnText}>Save as PDF</Text>
              )}
            </TouchableOpacity>
          ) : null}

          <Text style={styles.note}>
            Print goes to the printer's dialog at {stock.label}.
            {canSaveLabelsPdf
              ? ' Save as PDF is the route to a printer this phone cannot see — the ship’s office, or the label stock’s own driver on a laptop.'
              : ' In the browser, use the print dialog’s own “Save as PDF” if you need a file.'}
          </Text>
        </>
      ) : (
        <Card>
          <Text style={styles.note}>
            Printing is not available on Windows — the same limit as the PDF report and the ZIP
            export. Print this item's label from the phone app.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const makeStyles = (COLORS: Palette) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'flex-start' },
    toggle: { flexDirection: 'row', gap: SIZES.sm, paddingTop: SIZES.sm },
    toggleBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusRound,
      paddingVertical: SIZES.sm,
      alignItems: 'center',
    },
    toggleText: { color: COLORS.text, fontWeight: '700', fontSize: SIZES.small },
    previewWrap: { alignItems: 'center', paddingVertical: SIZES.lg },
    note: { color: COLORS.textLight, fontSize: SIZES.small, paddingTop: SIZES.sm, lineHeight: 16 },
    primaryBtn: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: SIZES.sm,
      backgroundColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.lg,
      marginTop: SIZES.sm,
    },
    primaryBtnText: { color: COLORS.textWhite, fontWeight: '700', fontSize: SIZES.h5 },
    secondaryBtn: {
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: COLORS.primary,
      borderRadius: SIZES.radiusMd,
      padding: SIZES.lg,
      marginTop: SIZES.sm,
    },
    secondaryBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.h5 },
  });
