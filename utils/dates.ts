// ===================================
// Date helpers
// Excel serial <-> ISO, days-until, compliance status.
// ===================================

import { ComplianceStatus, DUE_SOON_DAYS, EquipmentItem } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';

// Excel's epoch is 1899-12-30 (accounting for the 1900 leap-year bug).
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86400000;

/** Convert an Excel date serial number to an ISO yyyy-mm-dd string. */
export function excelSerialToISO(serial: number): string | undefined {
  if (typeof serial !== 'number' || !isFinite(serial)) return undefined;
  // Real maritime inspection/expiry dates land ~2000 (36526) to ~2060 (58484).
  // Reject small numbers — they are bare years or codes, not date serials, and
  // would otherwise map to bogus 1900s dates (e.g. 2034 -> 1905).
  if (serial < 20000 || serial > 80000) return undefined;
  const ms = EXCEL_EPOCH_MS + Math.round(serial) * MS_PER_DAY;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Best-effort parse of a cell value that might be a date:
 * Excel serial number, a Date, an ISO string, "MM/YYYY", "DD/MM/YYYY",
 * "Mon-YY", or a bare "YYYY".
 */
export function parseDateCell(raw: any): string | undefined {
  if (raw == null || raw === '') return undefined;

  if (raw instanceof Date) return raw.toISOString().slice(0, 10);

  if (typeof raw === 'number') {
    // A 4-digit number in 1900..2099 is a bare year (e.g. a "Next Pressure Test"
    // of 2034), not an Excel serial. Treat it as end-of-year.
    if (Number.isInteger(raw) && raw >= 1900 && raw <= 2099) return `${raw}-12-31`;
    return excelSerialToISO(raw);
  }

  const s = String(raw).trim();
  if (!s) return undefined;

  // Already ISO
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }

  // MM/YYYY or MM-YYYY  -> last day handling not needed, use first day
  m = s.match(/^(\d{1,2})[/.\-](\d{4})$/);
  if (m) {
    const mo = m[1].padStart(2, '0');
    return `${m[2]}-${mo}-01`;
  }

  // MM/YY
  m = s.match(/^(\d{1,2})[/.\-](\d{2})$/);
  if (m) {
    const mo = m[1].padStart(2, '0');
    return `20${m[2]}-${mo}-01`;
  }

  // Mon-YY or Mon-YYYY (e.g. "Mar-26", "Oct-2026")
  m = s.match(/^([A-Za-z]{3})[-/ ](\d{2,4})$/);
  if (m) {
    const monthIdx = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3));
    if (monthIdx >= 0) {
      const year = m[2].length === 2 ? `20${m[2]}` : m[2];
      const mo = String(monthIdx + 1).padStart(2, '0');
      return `${year}-${mo}-01`;
    }
  }

  // Bare year
  m = s.match(/^(20\d{2})$/);
  if (m) return `${m[1]}-12-31`;

  return undefined;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Whole days from today until the given ISO date (negative = past). */
export function daysUntil(iso?: string): number | undefined {
  if (!iso) return undefined;
  const target = new Date(iso + 'T00:00:00').getTime();
  if (isNaN(target)) return undefined;
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - todayUtc) / MS_PER_DAY);
}

/** The compliance-driving date for an item, per its category. */
export function complianceDate(item: EquipmentItem): string | undefined {
  const meta = CATEGORY_MAP[item.category];
  const primary = meta?.dateField ?? 'nextInspection';
  // Prefer the category's primary field, then fall back to the other.
  return item[primary] ?? item.nextInspection ?? item.expiry;
}

/** Compliance status from any expiry/inspection ISO date. */
export function statusFromDate(iso?: string): ComplianceStatus {
  const d = daysUntil(iso);
  if (d == null) return 'none';
  if (d < 0) return 'expired';
  if (d <= DUE_SOON_DAYS) return 'due';
  return 'ok';
}

/** Compliance status for an item based on its driving date. */
export function computeStatus(item: EquipmentItem): ComplianceStatus {
  return statusFromDate(complianceDate(item));
}

/** Human-friendly date for display. */
export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
