// ===================================
// Label (modal) — QR sticker preview, size choice, print.
//
// Reached from ItemDetail for one item, or from CategoryItems' multi-select for a
// batch. Both take the same route: the preview shows the FIRST label at true
// proportions, because a batch of eighty stickers is eighty copies of one layout,
// and the only thing worth checking before committing a roll is whether that
// layout fits.
// ===================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
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
  LABEL_STYLE_LIMITS,
  LabelOverrides,
  LabelSize,
  LabelStyle,
  LabelText,
  QR_ECL,
  QUIET_ZONE,
  canPrintLabels,
  canSaveLabelsPdf,
  defaultLabelStyle,
  humanId,
  itemQrPayload,
  labelLines,
  labelTitle,
  printLabels,
  printedTitle,
  qrModuleCount,
  resolveLabelStyle,
  saveLabelsPdf,
} from '../services/qrLabel';
import { loadPrefs, savePrefs } from '../services/storage';

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
function LabelPreview({
  item,
  size,
  width,
  style,
  text,
}: {
  item: EquipmentItem;
  size: LabelSize;
  width: number;
  style: LabelStyle;
  text?: LabelText;
}) {
  const COLORS = useTheme();
  const stock = LABEL_STOCKS[size];
  const isQr = stock.layout === 'qr';
  const compact = stock.layout === 'compact';
  const tight = stock.layout === 'full' && stock.widthMm < 80;
  const v = style.vertical;

  // Everything below is expressed in millimetres and scaled once, exactly as the
  // print stylesheet does — driven by the SAME resolved LabelStyle as labelCss.
  const scale = width / stock.widthMm;
  const mm = (val: number) => val * scale;
  const pt = (val: number) => val * PT_MM * scale;
  const align = v ? 'center' : 'left';

  const payload = itemQrPayload(item.id);
  const qrPx = mm(style.qrMm);
  const { strong, weak } = labelLines(item);
  const note = text?.note?.trim();

  return (
    <View
      style={{
        width,
        height: mm(stock.heightMm),
        padding: mm(style.padMm),
        flexDirection: v ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: mm(style.gapMm),
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
      <View style={{ flex: v ? 0 : 1, minWidth: 0, width: v ? '100%' : undefined }}>
        <Text
          numberOfLines={style.nameLines}
          style={{ color: '#000', fontSize: pt(style.nameSize), fontWeight: 'bold', textAlign: align }}
        >
          {printedTitle(item, text)}
        </Text>
        {!isQr && note ? (
          <Text
            numberOfLines={2}
            style={{ color: '#000', fontSize: pt(style.idSize), marginTop: mm(compact ? 0.4 : 0.8), textAlign: align }}
          >
            {note}
          </Text>
        ) : null}
        {!isQr ? (
          <Text
            numberOfLines={1}
            style={{ color: '#000', fontSize: pt(style.idSize), marginTop: mm(compact ? 0.5 : 1), textAlign: align }}
          >
            {humanId(item)}
          </Text>
        ) : null}
        {stock.layout === 'full' && strong.length ? (
          <Text style={{ color: '#000', fontSize: pt(style.strongSize), fontWeight: 'bold', marginTop: mm(tight ? 0.8 : 1.2), textAlign: align }}>
            {strong.join('  ·  ')}
          </Text>
        ) : null}
        {stock.layout === 'full' && weak.length ? (
          <Text numberOfLines={2} style={{ color: '#000', fontSize: pt(6.5), marginTop: mm(1), textAlign: align }}>
            {weak.join('  ·  ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** One +/- control row in the label editor. */
function Stepper({
  label,
  display,
  onDec,
  onInc,
  disabled,
  styles,
  COLORS,
}: {
  label: string;
  display: string;
  onDec: () => void;
  onInc: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  COLORS: Palette;
}) {
  return (
    <View style={[styles.stepRow, disabled && { opacity: 0.4 }]}>
      <Text style={styles.stepLabel}>{label}</Text>
      <View style={styles.stepControls}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec} disabled={disabled}>
          <MciIcon name="minus" size={18} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.stepValue}>{display}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc} disabled={disabled}>
          <MciIcon name="plus" size={18} color={COLORS.text} />
        </TouchableOpacity>
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

  // Per-stock-size fine-tuning and per-item printed-text overrides, both persisted in
  // Prefs (local to the device) so a keeper's tweaks survive between prints.
  const [labelStyles, setLabelStyles] = useState<Record<string, LabelOverrides>>({});
  const [labelText, setLabelText] = useState<Record<string, LabelText>>({});
  useEffect(() => {
    let alive = true;
    loadPrefs().then((p) => {
      if (!alive) return;
      if (p.labelStyles) setLabelStyles(p.labelStyles);
      if (p.labelText) setLabelText(p.labelText);
    });
    return () => {
      alive = false;
    };
  }, []);

  const applyOverride = (patch: LabelOverrides | null) => {
    setLabelStyles((prev) => {
      const next = { ...prev };
      if (patch === null) delete next[size];
      else next[size] = { ...next[size], ...patch };
      void loadPrefs().then((p) => savePrefs({ ...p, labelStyles: next }));
      return next;
    });
  };

  const applyText = (itemId: string, patch: LabelText) => {
    setLabelText((prev) => {
      const next = { ...prev, [itemId]: { ...prev[itemId], ...patch } };
      void loadPrefs().then((p) => savePrefs({ ...p, labelText: next }));
      return next;
    });
  };

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
  const overrides = labelStyles[size];
  const style = resolveLabelStyle(stock, overrides);
  const defaults = defaultLabelStyle(stock);
  const isQr = stock.layout === 'qr';
  const tuned = overrides != null && Object.keys(overrides).length > 0;
  // Life size where it fits, screen-bounded where it does not — never larger. A
  // 50×30 sticker blown up to fill a phone teaches the wrong lesson about whether
  // the text fits; 100×50 will not fit on a phone, so it scales down and only
  // proportions can be judged.
  const previewW = Math.min(screenW - SIZES.lg * 4, stock.widthMm * DP_PER_MM);

  const run = async (mode: 'print' | 'pdf') => {
    setBusy(mode);
    try {
      if (mode === 'print') await printLabels(items, size, overrides, labelText);
      else await saveLabelsPdf(items, size, overrides, labelText);
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
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.toggleText, size === s && { color: COLORS.textWhite }]}
              >
                {s.replace('x', '×')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.note}>{stock.hint}</Text>
      </Card>

      <Card>
        <Label>Preview — actual proportions</Label>
        <View style={styles.previewWrap}>
          <LabelPreview item={items[0]} size={size} width={previewW} style={style} text={labelText[items[0].id]} />
        </View>
        <Text style={styles.note}>
          The QR carries {itemQrPayload(items[0].id)} — the item's permanent id. Reprint it as often
          as a sticker is lost or scraped: the code never changes, so a reprint can never split one
          item into two.
        </Text>
      </Card>

      {items.length === 1 ? (
        <Card>
          <View style={styles.tuneHead}>
            <Label>Label text</Label>
            {labelText[items[0].id]?.name || labelText[items[0].id]?.note ? (
              <TouchableOpacity onPress={() => applyText(items[0].id, { name: '', note: '' })}>
                <Text style={styles.reset}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <Text style={styles.fieldLabel}>Name on the sticker</Text>
          <TextInput
            style={styles.input}
            value={labelText[items[0].id]?.name ?? ''}
            onChangeText={(t) => applyText(items[0].id, { name: t })}
            placeholder={labelTitle(items[0])}
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={[styles.fieldLabel, { marginTop: SIZES.sm }]}>Extra line (optional)</Text>
          <TextInput
            style={styles.input}
            value={labelText[items[0].id]?.note ?? ''}
            onChangeText={(t) => applyText(items[0].id, { note: t })}
            placeholder="e.g. Bridge, port side"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.note}>
            Changes only what the sticker SAYS — the item in the register is untouched. Saved on this
            device for this item. Leave the name blank to print the item's own type.
          </Text>
        </Card>
      ) : null}

      <Card>
        <View style={styles.tuneHead}>
          <Label>Fine-tune this label</Label>
          {tuned ? (
            <TouchableOpacity onPress={() => applyOverride(null)}>
              <Text style={styles.reset}>Reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Stepper
          label="QR size"
          display={`${style.qrMm} mm`}
          onDec={() => applyOverride({ qrMm: style.qrMm - LABEL_STYLE_LIMITS.qrMm.step })}
          onInc={() => applyOverride({ qrMm: style.qrMm + LABEL_STYLE_LIMITS.qrMm.step })}
          styles={styles}
          COLORS={COLORS}
        />
        <Stepper
          label="Name font"
          display={`${style.nameSize} pt`}
          onDec={() => applyOverride({ nameSize: style.nameSize - LABEL_STYLE_LIMITS.nameSize.step })}
          onInc={() => applyOverride({ nameSize: style.nameSize + LABEL_STYLE_LIMITS.nameSize.step })}
          styles={styles}
          COLORS={COLORS}
        />
        <Stepper
          label="Serial font"
          display={isQr ? '—' : `${style.idSize} pt`}
          onDec={() => applyOverride({ idSize: style.idSize - LABEL_STYLE_LIMITS.idSize.step })}
          onInc={() => applyOverride({ idSize: style.idSize + LABEL_STYLE_LIMITS.idSize.step })}
          disabled={isQr}
          styles={styles}
          COLORS={COLORS}
        />

        <View style={styles.stepRow}>
          <Text style={styles.stepLabel}>QR position</Text>
          <View style={styles.posToggle}>
            {([['left', 'Left', false], ['top', 'Top', true]] as const).map(([key, lbl, vert]) => (
              <TouchableOpacity
                key={key}
                style={[styles.posBtn, style.vertical === vert && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                onPress={() => applyOverride({ vertical: vert })}
              >
                <Text style={[styles.posText, style.vertical === vert && { color: COLORS.textWhite }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.note}>
          {tuned
            ? `Custom for ${stock.label} (default was QR ${defaults.qrMm} mm, name ${defaults.nameSize} pt). Saved for next time.`
            : 'Adjust the QR and text for this stock size. Changes preview live and are saved per size.'}
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
    toggle: { flexDirection: 'row', gap: SIZES.xs, paddingTop: SIZES.sm },
    toggleBtn: {
      // Five chips share ONE row: equal width, minimal horizontal padding so the
      // dimension text ("40×30") stays legible without wrapping.
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusRound,
      paddingVertical: SIZES.md,
      paddingHorizontal: SIZES.xs,
      alignItems: 'center',
    },
    toggleText: { color: COLORS.text, fontWeight: '700', fontSize: SIZES.body, textAlign: 'center' },
    tuneHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reset: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.small },
    fieldLabel: { color: COLORS.textLight, fontSize: SIZES.small, fontWeight: '600', paddingTop: SIZES.sm },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusSm,
      paddingHorizontal: SIZES.md,
      paddingVertical: SIZES.sm,
      marginTop: SIZES.xs,
      color: COLORS.text,
      fontSize: SIZES.body,
      backgroundColor: COLORS.background,
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SIZES.sm,
    },
    stepLabel: { color: COLORS.text, fontSize: SIZES.body, fontWeight: '600' },
    stepControls: { flexDirection: 'row', alignItems: 'center', gap: SIZES.sm },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: SIZES.radiusRound,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepValue: { color: COLORS.text, fontSize: SIZES.body, fontWeight: '700', minWidth: 56, textAlign: 'center' },
    posToggle: { flexDirection: 'row', gap: SIZES.xs },
    posBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: SIZES.radiusRound,
      paddingVertical: SIZES.sm,
      paddingHorizontal: SIZES.md,
      alignItems: 'center',
    },
    posText: { color: COLORS.text, fontWeight: '700', fontSize: SIZES.small },
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
