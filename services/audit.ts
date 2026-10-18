import { AuditItem, AuditType, InternalAudit } from '../types/audit';

const ISM_ELEMENTS: Pick<AuditItem, 'id' | 'ref' | 'requirement'>[] = [
  { id: 'ism_1',  ref: 'ISM 1',  requirement: 'General — objectives and application' },
  { id: 'ism_2',  ref: 'ISM 2',  requirement: 'Safety and environmental protection policy' },
  { id: 'ism_3',  ref: 'ISM 3',  requirement: 'Company responsibilities and authority' },
  { id: 'ism_4',  ref: 'ISM 4',  requirement: 'Designated person ashore (DPA)' },
  { id: 'ism_5',  ref: 'ISM 5',  requirement: "Master's responsibility and authority" },
  { id: 'ism_6',  ref: 'ISM 6',  requirement: 'Resources and personnel' },
  { id: 'ism_7',  ref: 'ISM 7',  requirement: 'Ship operations plans' },
  { id: 'ism_8',  ref: 'ISM 8',  requirement: 'Emergency preparedness' },
  { id: 'ism_9',  ref: 'ISM 9',  requirement: 'Reports and analysis of non-conformities, accidents and hazardous occurrences' },
  { id: 'ism_10', ref: 'ISM 10', requirement: 'Maintenance of the ship and equipment' },
  { id: 'ism_11', ref: 'ISM 11', requirement: 'Documentation' },
  { id: 'ism_12', ref: 'ISM 12', requirement: 'Company verification, review and evaluation' },
];

const MLC_ELEMENTS: Pick<AuditItem, 'id' | 'ref' | 'requirement'>[] = [
  { id: 'mlc_1_1', ref: 'MLC 1.1', requirement: 'Minimum age' },
  { id: 'mlc_1_2', ref: 'MLC 1.2', requirement: 'Medical certificate' },
  { id: 'mlc_1_3', ref: 'MLC 1.3', requirement: 'Training and qualifications' },
  { id: 'mlc_1_4', ref: 'MLC 1.4', requirement: 'Recruitment and placement' },
  { id: 'mlc_2_1', ref: 'MLC 2.1', requirement: "Seafarers' employment agreements" },
  { id: 'mlc_2_2', ref: 'MLC 2.2', requirement: 'Wages' },
  { id: 'mlc_2_3', ref: 'MLC 2.3', requirement: 'Hours of work and rest' },
  { id: 'mlc_2_4', ref: 'MLC 2.4', requirement: 'Entitlement to leave' },
  { id: 'mlc_2_5', ref: 'MLC 2.5', requirement: 'Repatriation' },
  { id: 'mlc_2_7', ref: 'MLC 2.7', requirement: 'Manning levels' },
  { id: 'mlc_3_1', ref: 'MLC 3.1', requirement: 'Accommodation and recreational facilities' },
  { id: 'mlc_3_2', ref: 'MLC 3.2', requirement: 'Food and catering' },
  { id: 'mlc_4_1', ref: 'MLC 4.1', requirement: 'Medical care on board' },
  { id: 'mlc_4_3', ref: 'MLC 4.3', requirement: 'Health and safety protection and accident prevention' },
  { id: 'mlc_5_1', ref: 'MLC 5.1', requirement: 'Flag state responsibilities (DMLC Part I & II)' },
];

export function defaultItems(type: AuditType): AuditItem[] {
  const base = type === 'mlc' ? MLC_ELEMENTS : type === 'ism' ? ISM_ELEMENTS : [];
  return base.map((e) => ({ ...e, result: 'ok' as const }));
}

export function nextAuditNo(existing: InternalAudit[]): string {
  const year = new Date().getFullYear();
  const count = existing.filter((a) => !a.deleted && a.no.includes(String(year))).length;
  return `IA-${year}-${String(count + 1).padStart(2, '0')}`;
}

export function auditSummary(audit: InternalAudit) {
  const ncs = audit.items.filter((i) => i.result === 'nc').length;
  const obs = audit.items.filter((i) => i.result === 'observation').length;
  const na  = audit.items.filter((i) => i.result === 'na').length;
  return { ncs, obs, na };
}
