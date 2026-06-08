// ===================================
// SimpleDatePicker — tap-to-open calendar field
// Mirrors the picker used in the frontend DocumentsScreen:
// decade → year grid, month grid, day grid. Emits ISO `YYYY-MM-DD`.
// Themed with MSM tokens; no @expo/vector-icons dependency (text glyphs).
// ===================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, TouchableWithoutFeedback } from 'react-native';
import { SIZES, Palette } from '../theme';
import { useTheme } from '../contexts/ThemeContext';
import { formatDate } from '../utils/dates';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  label: string;
  value?: string;
  onChange: (date: string) => void;
  defaultYear?: number;
  disabled?: boolean;
}

const parseISODate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const SimpleDatePicker: React.FC<Props> = ({ label, value, onChange, defaultYear, disabled }) => {
  const COLORS = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [visible, setVisible] = useState(false);

  const initialDate = value ? parseISODate(value) : new Date();
  const startYear = value ? initialDate.getFullYear() : (defaultYear ?? initialDate.getFullYear());
  const [viewDate, setViewDate] = useState(value ? initialDate : new Date(startYear, 0, 1));
  const [decadeStart, setDecadeStart] = useState(Math.floor(startYear / 10) * 10);

  const days = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Monday-first
    const res: (number | null)[] = [];
    for (let i = 0; i < offset; i++) res.push(null);
    for (let d = 1; d <= daysInMonth; d++) res.push(d);
    return res;
  }, [viewDate]);

  const handleSelectDay = (day: number) => {
    const year = viewDate.getFullYear();
    const month = (viewDate.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = day.toString().padStart(2, '0');
    onChange(`${year}-${month}-${dayStr}`);
    setVisible(false);
  };

  return (
    <>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={styles.inputTrigger}
        disabled={disabled}
        onPress={() => !disabled && setVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]}>
          {value ? formatDate(value) : 'Select date'}
        </Text>
        <Text style={styles.triggerIcon}>📅</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerBox}>
                {/* Decade navigation */}
                <View style={styles.header}>
                  <TouchableOpacity onPress={() => setDecadeStart((d) => d - 10)} style={styles.navBtn} hitSlop={8}>
                    <Text style={styles.navText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.headerTitle}>{decadeStart} — {decadeStart + 9}</Text>
                  <TouchableOpacity onPress={() => setDecadeStart((d) => d + 10)} style={styles.navBtn} hitSlop={8}>
                    <Text style={styles.navText}>›</Text>
                  </TouchableOpacity>
                </View>

                {/* Years */}
                <View style={styles.yearsGrid}>
                  {Array.from({ length: 10 }).map((_, i) => {
                    const year = decadeStart + i;
                    const isActive = viewDate.getFullYear() === year;
                    return (
                      <TouchableOpacity
                        key={year}
                        onPress={() => {
                          const nd = new Date(viewDate);
                          nd.setFullYear(year);
                          setViewDate(nd);
                        }}
                        style={[styles.yearItem, isActive && styles.activeBtn]}
                      >
                        <Text style={[styles.itemText, isActive && styles.activeText]}>{year}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Months */}
                <View style={styles.monthsGrid}>
                  {MONTHS.map((m, i) => {
                    const isActive = viewDate.getMonth() === i;
                    return (
                      <TouchableOpacity
                        key={m}
                        onPress={() => {
                          const nd = new Date(viewDate);
                          nd.setMonth(i);
                          setViewDate(nd);
                        }}
                        style={[styles.monthItem, isActive && styles.activeBtn]}
                      >
                        <Text style={[styles.itemText, isActive && styles.activeText]}>{m}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Days */}
                <View style={styles.daysGrid}>
                  {days.map((d, i) => {
                    const isSelected =
                      d != null &&
                      value != null &&
                      (() => {
                        const sel = parseISODate(value);
                        return (
                          sel.getFullYear() === viewDate.getFullYear() &&
                          sel.getMonth() === viewDate.getMonth() &&
                          sel.getDate() === d
                        );
                      })();
                    return (
                      <TouchableOpacity
                        key={i}
                        disabled={d === null}
                        onPress={() => d && handleSelectDay(d)}
                        style={[styles.dayItem, isSelected && styles.activeBtn]}
                      >
                        <Text style={[styles.dayText, d == null && styles.dayEmpty, isSelected && styles.activeText]}>
                          {d ?? ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
};

const makeStyles = (COLORS: Palette) => StyleSheet.create({
  label: { fontSize: SIZES.small, color: COLORS.textLight, marginBottom: 6, marginTop: 6 },

  inputTrigger: {
    ...COLORS.glassInput,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: SIZES.radiusMd,
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    minHeight: 48,
    marginTop: 4,
  },
  triggerText: { fontSize: SIZES.body, color: COLORS.text },
  triggerPlaceholder: { color: COLORS.textLight },
  triggerIcon: { fontSize: 18 },

  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay ?? 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  pickerBox: {
    width: Dimensions.get('window').width - 40,
    borderRadius: SIZES.radiusXl,
    padding: SIZES.lg,
    backgroundColor: COLORS.cardSolid ?? '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SIZES.md },
  headerTitle: { color: COLORS.primary, fontWeight: '700', fontSize: SIZES.h5 },
  navBtn: { backgroundColor: COLORS.primaryLight ?? COLORS.borderLight, paddingHorizontal: 12, paddingVertical: 2, borderRadius: SIZES.radiusSm },
  navText: { color: COLORS.primary, fontSize: 24, fontWeight: '700', lineHeight: 28 },

  yearsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: SIZES.md },
  yearItem: { width: '18%', paddingVertical: 10, alignItems: 'center', borderRadius: SIZES.radiusSm, marginVertical: 2 },

  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SIZES.md,
    marginBottom: SIZES.md,
  },
  monthItem: { width: '23%', paddingVertical: 10, alignItems: 'center', borderRadius: SIZES.radiusSm, marginVertical: 2 },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayItem: { width: `${100 / 7}%`, paddingVertical: 10, alignItems: 'center', borderRadius: SIZES.radiusSm },
  dayText: { fontSize: SIZES.body, color: COLORS.textDark },
  dayEmpty: { color: 'transparent' },

  itemText: { color: COLORS.primary, fontSize: SIZES.small },
  activeBtn: { backgroundColor: COLORS.primary },
  activeText: { color: COLORS.textWhite, fontWeight: '700' },
});

export default SimpleDatePicker;
