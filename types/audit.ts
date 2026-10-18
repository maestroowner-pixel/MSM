import type { SignProof } from '../services/signature';

export type AuditType = 'ism' | 'mlc' | 'custom';
export type AuditItemResult = 'ok' | 'observation' | 'nc' | 'na';

export interface AuditItem {
  id: string;
  ref: string;
  requirement: string;
  result: AuditItemResult;
  comment?: string;
}

export interface InternalAudit {
  id: string;
  type: AuditType;
  no: string;
  title: string;
  scope?: string;
  items: AuditItem[];
  startDate: string;
  closeDate?: string;
  by?: string;
  byRank?: string;
  signedWith?: SignProof;
  updatedAt: number;
  deleted?: boolean;
}

export const AUDIT_TYPE_LABEL: Record<AuditType, string> = {
  ism: 'ISM Internal Audit',
  mlc: 'MLC Compliance Audit',
  custom: 'Custom Audit',
};

export const AUDIT_ITEM_RESULT_LABEL: Record<AuditItemResult, string> = {
  ok: 'OK',
  observation: 'Observation',
  nc: 'NC / Finding',
  na: 'N/A',
};

export const AUDIT_ITEM_RESULT_SHORT: Record<AuditItemResult, string> = {
  ok: 'OK',
  observation: 'Obs',
  nc: 'NC',
  na: 'N/A',
};
