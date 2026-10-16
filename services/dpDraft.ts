// ===================================
// A DP checklist filled in but not signed and saved — kept on this device as a
// draft, one per checklist, and offered back the next time that checklist is
// opened (16 Oct 2026: "left without saving, it is kept as a draft; opening the
// same screen offers to restore it"). Signatures are never part of a draft:
// whoever saves signs again then.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

import { AsogStatus, DpConditions } from '../types/dp';

export interface DpDraft {
  at: number;
  operation: string;
  unit: string;
  cond: DpConditions;
  posT: string;
  asog?: AsogStatus;
  results: Record<string, string>;
  values: Record<string, string>;
  remarks: string;
}

const key = (templateId: string) => `msm:dp_draft:${templateId}`;

/** Nothing filled in — not worth keeping or offering. */
export function draftEmpty(d: Omit<DpDraft, 'at'>): boolean {
  const any = (r: Record<string, unknown>) => Object.values(r).some((v) => String(v ?? '').trim());
  return !d.operation.trim() && !d.unit.trim() && !d.posT.trim() && !d.asog && !d.remarks.trim() && !any(d.cond as Record<string, unknown>) && !any(d.results) && !any(d.values);
}

export async function loadDraft(templateId: string): Promise<DpDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(templateId));
    const d = raw ? (JSON.parse(raw) as DpDraft) : null;
    return d && !draftEmpty(d) ? d : null;
  } catch {
    return null;
  }
}

export async function saveDraft(templateId: string, d: Omit<DpDraft, 'at'>): Promise<void> {
  try {
    if (draftEmpty(d)) await AsyncStorage.removeItem(key(templateId));
    else await AsyncStorage.setItem(key(templateId), JSON.stringify({ ...d, at: Date.now() }));
  } catch {
    // A draft is a convenience; a full disk must not stop the checklist.
  }
}

export const clearDraft = (templateId: string) => AsyncStorage.removeItem(key(templateId)).catch(() => undefined);
