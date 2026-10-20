// ===================================
// GMDSS service — equipment config, check schedules, journal text generation.
// ===================================

import { GmdssBattery, GmdssCheck, GmdssCheckItem, GmdssCheckPeriod,
  GmdssCheckStatus, GmdssEntry, GmdssEntryType, RadarBand } from '../types/gmdss';

// ─── Equipment definitions ───────────────────────────────────────────────────

export interface GmdssEquipmentDef {
  id: string;
  label: string;
  /** Which check periods include this item. */
  periods: GmdssCheckPeriod[];
  /** Hint shown under the checkbox (e.g. "Log MMSI of station called"). */
  hint?: string;
  /** True when a free-value field should appear (e.g. MMSI, frequency). */
  hasValue?: boolean;
  valueLabel?: string;
  valuePlaceholder?: string;
  valueWidth?: number;
  valueMaxLength?: number;
  /** Optional second value field (e.g. station name beside MMSI). */
  hasValue2?: boolean;
  value2Label?: string;
  value2Placeholder?: string;
  value2Width?: number;
  value2MaxLength?: number;
}

export const GMDSS_EQUIPMENT: GmdssEquipmentDef[] = [
  // ── Daily ──────────────────────────────────────────────────────────────────
  {
    id: 'vhf_watch', label: 'VHF watch',
    periods: ['daily', 'weekly', 'monthly'],
    hasValue: true, valueLabel: 'Ch', valuePlaceholder: '16',
    valueWidth: 48, valueMaxLength: 2,
  },
  {
    id: 'mf_watch', label: 'MF DSC watch',
    periods: ['daily', 'weekly', 'monthly'],
    hasValue: true, valueLabel: 'kHz', valuePlaceholder: '2187.5',
    valueWidth: 80, valueMaxLength: 8,
  },
  { id: 'navtex',      label: 'NAVTEX — self-test, msgs checked',   periods: ['daily', 'weekly', 'monthly'] },
  // ── Weekly ──────────────────────────────────────────────────────────────────
  {
    id: 'dsc_test_vhf', label: 'DSC test — VHF',
    periods: ['weekly', 'monthly'],
    hasValue: true,  valueLabel: 'MMSI',    valuePlaceholder: '002320992', valueWidth: 104, valueMaxLength: 9,
    hasValue2: true, value2Label: 'Station', value2Placeholder: 'station name', value2Width: 140, value2MaxLength: 20,
  },
  {
    id: 'dsc_test_mf',  label: 'DSC test — MF/HF',
    periods: ['weekly', 'monthly'],
    hasValue: true,  valueLabel: 'MMSI',    valuePlaceholder: '002320992', valueWidth: 104, valueMaxLength: 9,
    hasValue2: true, value2Label: 'Station', value2Placeholder: 'station name', value2Width: 140, value2MaxLength: 20,
  },
  { id: 'epirb_light', label: 'EPIRB — indicator light OK',       periods: ['weekly', 'monthly'] },
  { id: 'epirb_test',  label: 'EPIRB — self-test',               periods: ['weekly', 'monthly'] },
  { id: 'sart_test',   label: 'SART — self-test',                 periods: ['weekly', 'monthly'] },
  // ── Monthly ─────────────────────────────────────────────────────────────────
  { id: 'atis',        label: 'ATIS code programmed',             periods: ['monthly'] },
  { id: 'mmsi_prog',   label: 'Ship MMSI programmed — all sets',  periods: ['monthly'] },
  { id: 'ant_coax',    label: 'Antenna connections & coax',       periods: ['monthly'] },
  { id: 'ship_clocks', label: 'GMDSS clocks synchronised (UTC)',  periods: ['monthly'] },
  { id: 'log_check',   label: 'GMDSS log — previous entries OK',  periods: ['monthly'] },
];

// Default battery labels — vessel can override via stored entries
export const GMDSS_BATTERIES_DEFAULT: Omit<GmdssBattery, 'status' | 'voltageRaw'>[] = [
  { id: 'bat1', label: 'Main GMDSS battery' },
  { id: 'bat2', label: 'Reserve battery' },
];

// ─── Check period windows (calendar) ─────────────────────────────────────────

/** How many days may pass before the check is overdue. */
const PERIOD_DAYS: Record<GmdssCheckPeriod, number> = {
  daily:   1,
  weekly:  7,
  monthly: 31,
};

/** Grace window: check can be done this many days before the nominal date. */
const GRACE_DAYS: Record<GmdssCheckPeriod, number> = {
  daily:   0,
  weekly:  1,
  monthly: 3,
};

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function todayDate(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function daysDiff(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function gmdssCheckStatus(entries: GmdssEntry[], period: GmdssCheckPeriod): GmdssCheckStatus {
  const last = [...entries]
    .filter((e) => e.type === period)
    .sort((a, b) => b.at - a.at)[0];
  if (!last) return { lastDate: null, overdue: true, dueSoon: false };
  const lastDate = last.date;
  const today = todayDate();
  const lastDay = isoToDate(lastDate);
  const age = daysDiff(lastDay, today);       // days since last check
  const overdue = age > PERIOD_DAYS[period];
  const dueSoon = !overdue && age >= PERIOD_DAYS[period] - GRACE_DAYS[period];
  return { lastDate, overdue, dueSoon };
}

// ─── Voltage helpers ─────────────────────────────────────────────────────────

/** "130" → 130; "13.0" → 130; "13,0" → 130; "13" → 130 (treat as 13.0). */
export function parseVoltageInput(raw: string): number | undefined {
  const s = raw.trim().replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return undefined;
  // If no decimal in input, treat as tenths: "130" → 13.0 V → raw 130
  if (!s.includes('.')) {
    // "13" → probably 13.0 V → 130; "130" → 13.0 V → 130
    if (n < 30) return Math.round(n * 10); // "13" entered as volts
    return Math.round(n);                  // "130" entered as tenths
  }
  return Math.round(n * 10); // "13.0" → 130
}

export function formatVoltage(raw: number): string {
  return `${Math.floor(raw / 10)}.${raw % 10} V`;
}

// ─── Build check items for a given period ────────────────────────────────────

export function blankCheckItems(period: GmdssCheckPeriod): GmdssCheckItem[] {
  return GMDSS_EQUIPMENT.filter((e) => e.periods.includes(period)).map((e) => ({
    id: e.id,
    checked: false,
  }));
}

export function blankBatteries(): GmdssBattery[] {
  return GMDSS_BATTERIES_DEFAULT.map((b) => ({ ...b, status: 'ok' as const }));
}

// ─── Text generation (what goes into GmdssEntry.text) ─────────────────────────

function checkSummaryText(check: GmdssCheck): string {
  const defs = GMDSS_EQUIPMENT.filter((e) => e.periods.includes(check.period));
  const parts: string[] = [];

  for (const def of defs) {
    const item = check.items.find((i) => i.id === def.id);
    if (!item) continue;
    const tick = item.checked ? '✓' : '✗';
    let line = `${def.label} ${tick}`;
    if (item.value && def.hasValue) {
      const label = def.valueLabel ?? 'val';
      line += ` · ${label} ${item.value}`;
      if (item.value2 && def.hasValue2) line += ` "${item.value2}"`;
    }
    parts.push(line);
  }

  if (check.batteries?.length) {
    for (const bat of check.batteries) {
      const v = bat.voltageRaw !== undefined ? ` · ${formatVoltage(bat.voltageRaw)}` : '';
      const st = bat.status === 'charging' ? 'charging' : bat.status === 'charged' ? 'charged' : 'OK';
      parts.push(`${bat.label}: ${st}${v}`);
    }
  }

  if (check.note?.trim()) parts.push(`Note: ${check.note.trim()}`);
  return parts.join(' · ');
}

/** Compute journal text for any entry type. */
export function gmdssEntryText(opts: {
  type: GmdssEntryType;
  check?: GmdssCheck;
  band?: RadarBand;
  radioWatchClosed?: boolean;
  note?: string;
}): string {
  const { type, check, band, radioWatchClosed, note } = opts;

  switch (type) {
    case 'daily':
      return `GMDSS Daily check — ${check ? checkSummaryText(check) : ''}`;
    case 'weekly':
      return `GMDSS Weekly check — ${check ? checkSummaryText(check) : ''}`;
    case 'monthly':
      return `GMDSS Monthly inspection — ${check ? checkSummaryText(check) : ''}`;
    case 'radar_on': {
      const b = band === 'sband' ? 'S-band' : 'X-band';
      return `${b} radar — ON${note ? ` · ${note}` : ''}`;
    }
    case 'radar_off': {
      const b = band === 'sband' ? 'S-band' : 'X-band';
      const suffix = radioWatchClosed ? ' · Radio watch closed' : '';
      return `${b} radar — OFF${suffix}${note ? ` · ${note}` : ''}`;
    }
    case 'event':
      return note?.trim() || 'GMDSS event';
  }
}

// ─── Period label ─────────────────────────────────────────────────────────────

export const PERIOD_LABEL: Record<GmdssCheckPeriod, string> = {
  daily:   'Daily check',
  weekly:  'Weekly check',
  monthly: 'Monthly inspection',
};
