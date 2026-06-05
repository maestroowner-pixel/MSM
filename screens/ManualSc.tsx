// ===================================
// Manual — in-app user guide (accordion sections).
// ===================================

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Screen, ScreenTitle } from '../components/ui';
import { COLORS, SIZES, GLASS, APP_CONFIG } from '../theme';
import { DUE_SOON_DAYS } from '../types/equipment';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface IntervalRow {
  k: string; // equipment
  v: string; // interval
  ref?: string; // regulatory reference
}

interface Section {
  emoji: string;
  title: string;
  body?: string[];
  note?: string; // highlighted caution at the top of the section
  rows?: IntervalRow[];
}

const SECTIONS: Section[] = [
  {
    emoji: '⚓',
    title: 'Getting started',
    body: [
      `${APP_CONFIG.name} keeps your vessel's Life-Saving Appliances (LSA) and Fire-Fighting Equipment (FFE/FIFI) in one place, with inspection and expiry tracking.`,
      'Equipment is grouped into 23 categories under three groups: LSA, FFE and Other. Each item has a type, serial/ID, position on the vessel, and the dates that drive compliance.',
      'Fastest way to begin: open Settings → Import from Excel and load your LSA / FFE Inventories workbook. All data stays on the device and can optionally sync to the cloud.',
    ],
  },
  {
    emoji: '📥',
    title: 'Importing from Excel',
    body: [
      'Settings → Import from Excel → choose your .xlsx workbook. Each worksheet (Liferafts, Lifejackets, Fire extinguishers, …) maps to a category automatically.',
      'You get a preview of how many items were found per category before anything is saved.',
      'Choose "Replace all" to overwrite the imported categories, or "Append" to add to what is already there.',
      'Dates written as Excel serials or years (e.g. "2034") are converted automatically. You can edit any item afterwards.',
    ],
  },
  {
    emoji: '🧰',
    title: 'Equipment & categories',
    body: [
      'The Equipment tab shows a grid of all categories with item counts and a coloured dot for the worst status inside.',
      'Tap a category to see its items; use the search box to filter by type, serial or position.',
      'Tap an item to view or edit it. Tap ＋ in a category to add a new item by hand.',
      'Dates (Manufacture, Next inspection, Expiry) are set with a calendar picker — tap the field, then choose year, month and day. No need to type the format by hand.',
      'In the category list, small badges next to an item show 📎 N (number of attached files) and 📜 (covered by a certificate).',
      'Checklist categories (Hydrants, BA Bottle Pressure, Fire Detectors) have monthly check toggles in the item screen — tap a month to mark it done.',
    ],
  },
  {
    emoji: '📎',
    title: 'Photos & documents',
    body: [
      'Each item can hold up to 4 attachments — photos or documents (PDF, etc.) — in the "Photos & documents" block of the item screen.',
      'Tap the dashed ＋ Add slot to attach: take a photo, pick from the library, or choose a document. Empty slots stay as dashed outlines until filled.',
      'Tap a photo thumbnail to open it full-screen; from there you can Open or Share it. Tap a document to open it in the system viewer.',
      'Remove an attachment with the ✕ on its thumbnail. Files are stored on the device with the item.',
    ],
  },
  {
    emoji: '📜',
    title: 'Certificates',
    body: [
      'The Certificates tab holds documents that cover many items at once — e.g. a single liferaft service certificate that applies to several rafts (a "group certificate").',
      'Open a certificate to set its number, issue/expiry dates and the attached file, and to link the items it covers.',
      'A certificate carries its own expiry status (red / amber / green) just like equipment, so it appears in your due-soon view.',
      'On an item screen, linked certificates are listed under the item; items covered by any certificate show a 📜 badge in the category list.',
    ],
  },
  {
    emoji: '📊',
    title: 'Dashboard & statuses',
    body: [
      'The Dashboard lists every item that has a date, sorted soonest-first, so the most urgent work is on top.',
      `Status colours: red = Expired (date in the past), amber = Due soon (within ${DUE_SOON_DAYS} days), green = Valid.`,
      'The three counters at the top summarise Expired / Due soon / Valid across the whole vessel.',
      'Use the filter chips (All · Needs attention · LSA · FFE · Other) to focus the list.',
    ],
  },
  {
    emoji: '🛟',
    title: 'Inspection intervals — LSA',
    note: 'Indicative only. Always verify against the vessel\'s flag State, classification society, the maker\'s instructions and the current SOLAS / LSA Code / MSC circulars. The app records dates — it does not enforce intervals.',
    rows: [
      { k: 'Inflatable liferafts', v: 'Service at an approved station every 12 months (extension possible under a flag-approved scheme).', ref: 'SOLAS III/20; LSA Code' },
      { k: 'Liferaft HRU (hydrostatic release)', v: 'Replace / service per maker; disposable types (e.g. Hammar H20) every 2 years.', ref: 'SOLAS III/20; maker' },
      { k: 'Lifejackets', v: 'Monthly visual; annual thorough inspection. Lights & inflatable units serviced annually; cartridge/battery replaced at expiry.', ref: 'SOLAS III/20; MSC.1/Circ.1304' },
      { k: 'Immersion / anti-exposure suits', v: 'Annual inspection; air-pressure (seam) test at intervals ≤ 3 years for applicable types.', ref: 'MSC.1/Circ.1047' },
      { k: 'Lifebuoys', v: 'Monthly inspection; self-igniting lights & smoke signals replaced at expiry.', ref: 'SOLAS III/20' },
      { k: 'EPIRB', v: 'Monthly self-test; annual performance test; shore-based maintenance and battery renewal within battery expiry (≤ 5 yr).', ref: 'SOLAS IV/15; MSC.1/Circ.1040' },
      { k: 'SART', v: 'Monthly check; battery replaced at expiry.', ref: 'SOLAS IV' },
      { k: 'Pyrotechnics (rockets, flares, smoke)', v: 'Replace by expiry — normally 3 years from manufacture.', ref: 'SOLAS III; LSA Code' },
      { k: 'Rescue / MOB boat + davit', v: 'Weekly & monthly checks; annual thorough examination + operational test; 5-yearly winch-brake dynamic test and release-gear overhaul.', ref: 'SOLAS III/20; Res. MSC.402(96)' },
      { k: 'Launching appliances / davits', v: 'Annual thorough examination; 5-yearly load test of winch brake.', ref: 'SOLAS III/20; MSC.402(96)' },
      { k: 'Harnesses / fall arresters', v: 'Inspected by a competent person at the maker\'s interval (commonly 6–12 months).', ref: 'maker / SMS' },
    ],
  },
  {
    emoji: '🧯',
    title: 'Inspection intervals — FFE',
    note: 'Indicative only. Verify against flag, class, maker and the current SOLAS Ch II-2 / FSS Code and MSC.1/Circ.1432 (as amended by MSC.1/Circ.1622).',
    rows: [
      { k: 'Portable fire extinguishers', v: 'Monthly visual; annual inspection/service; periodic discharge test & recharge; CO₂ cylinders hydrostatic test every 10 years.', ref: 'SOLAS II-2/14; FSS Code; MSC.1/Circ.1432' },
      { k: 'Fixed CO₂ / gas systems', v: 'Annual inspection; cylinders weighed (recharge if loss > 10%); 10-yearly hydrostatic test (or sampling); pipework blow-through.', ref: 'FSS Code Ch.5; MSC.1/Circ.1432' },
      { k: 'Fire detection & alarm', v: 'Periodic functional testing of detectors/MCPs; full system test annually.', ref: 'SOLAS II-2; FSS Code Ch.9' },
      { k: 'Fire dampers / flaps', v: 'Operational test periodically (typically annual).', ref: 'MSC.1/Circ.1432' },
      { k: 'Hydrants, hoses, fireboxes, nozzles', v: 'Monthly inspection; fire hoses pressure-tested annually.', ref: 'SOLAS II-2/14; MSC.1/Circ.1432' },
      { k: 'BA sets (SCBA)', v: 'Monthly cylinder pressure & function check; annual thorough check; cylinder hydrostatic test per maker (steel ~5 yr; composite per stamp).', ref: 'FSS Code Ch.3; maker' },
      { k: 'EEBD', v: 'Monthly check; annual inspection; replace at the marked life-date.', ref: 'SOLAS II-2/13; FSS Code Ch.3' },
      { k: 'Fireman\'s outfit / fire blanket / foam applicator', v: 'Annual inspection.', ref: 'FSS Code Ch.3; MSC.1/Circ.1432' },
    ],
  },
  {
    emoji: '🧪',
    title: 'Inspection intervals — Other',
    rows: [
      { k: 'Eye-wash stations', v: 'Periodic check; flushing bottles replaced at expiry.', ref: 'maker / SMS' },
      { k: 'First-aid / medical kits', v: 'Per flag State / MLC; contents replaced at expiry.', ref: 'flag; WHO IMGS' },
      { k: 'Gas detection meters', v: 'Bump test before use; calibration per maker (e.g. 6-monthly) with annual verification.', ref: 'maker / SMS' },
      { k: 'Chemical / gas-tight suits', v: 'Periodic pressure test per maker.', ref: 'maker' },
      { k: 'SOPEP locker', v: 'Periodic inventory check; absorbents/items replenished as used.', ref: 'MARPOL; SMS' },
    ],
  },
  {
    emoji: '📤',
    title: 'Reports & export',
    body: [
      'Reports → choose a scope (full register or a single category) → export as PDF or XLSX.',
      'The report includes each item\'s type, serial, position, dates and compliance status.',
      'Exports open your device\'s share sheet so you can email them or save to Files.',
    ],
  },
  {
    emoji: '☁️',
    title: 'Cloud sync',
    body: [
      'Enter your vessel IMO number in Settings → Save vessel info. The IMO is used as the cloud account for the vessel.',
      'Set a Connection password in Settings → Cloud sync. The first device sets it; every other device must enter the same password to join — so knowing the IMO alone is not enough.',
      'Tap Connect this device. The first device to connect becomes the Master. Additional devices appear as pending until the Master approves them (Settings → Cloud sync shows Approve / Reject).',
      'Once approved, Push uploads the current inventory to the cloud and Pull downloads it onto this device.',
      'The Master can disconnect a device at any time. Each vessel only sees its own data — inventories are isolated per IMO account.',
    ],
  },
  {
    emoji: 'ℹ️',
    title: 'About',
    body: [
      `${APP_CONFIG.name} v${APP_CONFIG.version} — ${APP_CONFIG.company}, ${APP_CONFIG.year}.`,
      'This app is a record-keeping aid. It does not replace the vessel\'s official safety documentation, statutory inspections or class/flag requirements. Always follow your company SMS and applicable regulations.',
    ],
  },
];

export default function ManualSc() {
  const [open, setOpen] = useState<number | null>(0);

  const toggle = (i: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((cur) => (cur === i ? null : i));
  };

  return (
    <Screen scroll>
      <ScreenTitle title="User Manual" subtitle="How to use the app" />
      {SECTIONS.map((s, i) => {
        const expanded = open === i;
        return (
          <View key={s.title} style={styles.card}>
            <TouchableOpacity style={styles.header} activeOpacity={0.7} onPress={() => toggle(i)}>
              <Text style={styles.emoji}>{s.emoji}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
            </TouchableOpacity>
            {expanded ? (
              <View style={styles.body}>
                {s.note ? (
                  <View style={styles.note}>
                    <Text style={styles.noteText}>⚠️ {s.note}</Text>
                  </View>
                ) : null}
                {s.body?.map((p, j) => (
                  <Text key={`p${j}`} style={styles.para}>
                    {p}
                  </Text>
                ))}
                {s.rows?.map((r, j) => (
                  <View key={`r${j}`} style={[styles.intRow, j > 0 && styles.intRowDivider]}>
                    <Text style={styles.intK}>{r.k}</Text>
                    <Text style={styles.intV}>{r.v}</Text>
                    {r.ref ? <Text style={styles.intRef}>{r.ref}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { ...GLASS.card, borderRadius: SIZES.radiusMd, marginBottom: SIZES.sm, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SIZES.md, gap: SIZES.sm },
  emoji: { fontSize: 22 },
  title: { flex: 1, fontSize: SIZES.h5, fontWeight: '700', color: COLORS.textDark },
  chevron: { fontSize: SIZES.h5, color: COLORS.textLight },
  body: { paddingHorizontal: SIZES.md, paddingBottom: SIZES.md, gap: SIZES.sm },
  para: { fontSize: SIZES.body, color: COLORS.text, lineHeight: 20 },
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
  intRef: { fontSize: SIZES.tiny, color: COLORS.primary, fontWeight: '600', marginTop: 3 },
});
