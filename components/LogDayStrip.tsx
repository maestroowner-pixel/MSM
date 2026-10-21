// ===================================
// Shared day-navigation for Deck Log and Engine Log.
// Single row: ← tap-to-pick date → (arrows step one day, tap opens a picker modal).
// ===================================

import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { MciIcon } from './MciIcon';
import { Palette, SIZES } from '../theme';
import { currentLang, dateLocale, monthName, t, useT, weekdayName } from '../utils/i18n';

// ── Date helpers ──────────────────────────────────────────────────────────────

const WD  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'];

/** Today as local "YYYY-MM-DD". */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parse "YYYY-MM-DD" as local date (noon, avoids DST edge). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export interface DayLabel {
  weekday: string;
  weekdayS: string;
  dayNum: number;
  monthFull: string;
  year: number;
  full: string;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function isoLabel(iso: string): DayLabel {
  const d = parseISO(iso);
  return {
    weekday: weekdayName(d.getDay()),
    weekdayS: weekdayName(d.getDay(), 'short'),
    dayNum: d.getDate(),
    monthFull: monthName(d.getMonth()),
    year: d.getFullYear(),
    // Other languages decline the month inside a date ("3 апреля"), so Intl writes it whole.
    full: currentLang() === 'en'
      ? `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`
      : cap(d.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
  };
}

/** Build the set of days that have entries, plus today, for prev/next bounds. */
export function buildDays(entryDates: string[], _minDays = 7): string[] {
  // Only used for prev/next arrow enabling — kept for API compat with existing screens.
  // Returns a sorted unique set of entry dates + today, newest first.
  const set = new Set([todayISO(), ...entryDates]);
  return [...set].sort().reverse();
}

// ── DateNav (the single-row picker trigger + arrows) ─────────────────────────

export interface DateNavProps {
  selected: string;
  days: string[];    // for arrow bounds (unused in picker mode but kept for compat)
  onPrev: () => void;
  onNext: () => void;
  COLORS: Palette;
  /** Called when user picks a date in the modal (pass undefined to disable tap). */
  onPick?: (iso: string) => void;
}

export function DateNav({ selected, days, onPrev, onNext, COLORS, onPick }: DateNavProps) {
  useT();
  const lbl = isoLabel(selected);
  const today = parseISO(todayISO());
  const selDate = parseISO(selected);
  const canNext = selDate < today;

  const [open, setOpen] = useState(false);
  const [pickDay,   setPickDay]   = useState(selDate.getDate());
  const [pickMonth, setPickMonth] = useState(selDate.getMonth());
  const [pickYear,  setPickYear]  = useState(selDate.getFullYear());

  const openPicker = () => {
    const d = parseISO(selected);
    setPickDay(d.getDate());
    setPickMonth(d.getMonth());
    setPickYear(d.getFullYear());
    setOpen(true);
  };

  const confirm = () => {
    const maxDay = daysInMonth(pickYear, pickMonth);
    const safeDay = Math.min(pickDay, maxDay);
    const iso = `${pickYear}-${String(pickMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
    setOpen(false);
    onPick?.(iso);
  };

  const nowYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => nowYear - i);
  const maxDay = daysInMonth(pickYear, pickMonth);
  const dayNums = Array.from({ length: maxDay }, (_, i) => i + 1);

  return (
    <>
      <View style={[styles.nav, { borderBottomColor: COLORS.border }]}>
        <TouchableOpacity onPress={onPrev} hitSlop={10} style={styles.arrowBtn}>
          <MciIcon name="chevron-left" size={22} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPick ? openPicker : undefined}
          activeOpacity={onPick ? 0.6 : 1}
          style={styles.dateTap}
          hitSlop={6}
        >
          <Text style={[styles.dateLbl, { color: COLORS.text }]} numberOfLines={1}>
            {lbl.full}
          </Text>
          {!!onPick && (
            <MciIcon name="calendar-outline" size={14} color={COLORS.textLight} style={{ marginLeft: 4 }} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNext}
          disabled={!canNext}
          hitSlop={10}
          style={[styles.arrowBtn, !canNext && styles.arrowDis]}
        >
          <MciIcon name="chevron-right" size={22} color={canNext ? COLORS.primary : COLORS.textLight} />
        </TouchableOpacity>
      </View>

      {/* ── Date picker modal ── */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
              <Text style={[styles.sheetBtn, { color: COLORS.textLight }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={[styles.sheetTitle, { color: COLORS.text }]}>{t('sdp.selectT')}</Text>
            <TouchableOpacity onPress={confirm} hitSlop={8}>
              <Text style={[styles.sheetBtn, { color: COLORS.primary, fontWeight: '700' }]}>{t('common.done')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.wheels}>
            {/* Day */}
            <Picker
              style={styles.wheel}
              selectedValue={Math.min(pickDay, maxDay)}
              onValueChange={(v) => setPickDay(v as number)}
              itemStyle={[styles.wheelItem, { color: COLORS.text }]}
            >
              {dayNums.map((d) => (
                <Picker.Item key={d} label={String(d)} value={d} />
              ))}
            </Picker>

            {/* Month */}
            <Picker
              style={[styles.wheel, { flex: 1.6 }]}
              selectedValue={pickMonth}
              onValueChange={(v) => setPickMonth(v as number)}
              itemStyle={[styles.wheelItem, { color: COLORS.text }]}
            >
              {MON.map((m, i) => (
                <Picker.Item key={m} label={monthName(i)} value={i} />
              ))}
            </Picker>

            {/* Year */}
            <Picker
              style={styles.wheel}
              selectedValue={pickYear}
              onValueChange={(v) => setPickYear(v as number)}
              itemStyle={[styles.wheelItem, { color: COLORS.text }]}
            >
              {years.map((y) => (
                <Picker.Item key={y} label={String(y)} value={y} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── DayStrip (kept as no-op export so old imports don't break) ────────────────

export interface DayStripProps {
  days: string[];
  selected: string;
  entryCounts: Record<string, number>;
  onSelect: (date: string) => void;
  COLORS: Palette;
}

/** @deprecated Replaced by the date picker in DateNav. Renders nothing. */
export function DayStrip(_props: DayStripProps) {
  return null;
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  arrowBtn:  { padding: 6 },
  arrowDis:  { opacity: 0.25 },
  dateTap:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dateLbl:   { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  // modal
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg, paddingVertical: SIZES.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700' },
  sheetBtn:   { fontSize: 15 },
  wheels:     { flexDirection: 'row' },
  wheel:      { flex: 1 },
  wheelItem:  { fontSize: 16 },
});
