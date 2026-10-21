// ===================================
// A month, picked from a short list — in a screen's title, beside the "?"
// (10 Oct 2026: "not a long row of arrows; just the month at the top, a
// drop-down to change it; months of another year with the year").
//
// The list is the months that hold records, and the current one, newest first.
// A month of the current year reads "October"; of another year, "December 2025".
// ===================================

import React, { useMemo } from 'react';

import { Dropdown } from './Dropdown';
import { monthName as uiMonth } from '../utils/i18n';

export function monthName(month: string, thisYear = new Date().getFullYear()): string {
  const [y, m] = month.split('-').map(Number);
  return y === thisYear ? uiMonth(m - 1) : `${uiMonth(m - 1)} ${y}`;
}

/** The months to offer: those with records, the current one and the one picked, newest first. */
export function monthOptions(withData: string[], current: string, picked: string): string[] {
  return [...new Set([...withData.filter(Boolean), current, picked])].sort((a, b) => b.localeCompare(a));
}

export function MonthPicker({ value, onChange, months, counts }: { value: string; onChange: (m: string) => void; months: string[]; counts?: Record<string, number> }) {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const opts = useMemo(() => monthOptions(months, current, value), [months, current, value]);
  return (
    <Dropdown
      caption=""
      value={value}
      onChange={onChange}
      options={opts.map((m) => ({ value: m, label: `${monthName(m)}${counts?.[m] ? ` · ${counts[m]}` : ''}` }))}
      style={{ paddingVertical: 6, minWidth: 130, marginRight: 8 }}
    />
  );
}
