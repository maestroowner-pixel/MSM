// ===================================
// Fleet summary — one line per vessel for the superintendent, as pure functions
// over what services/shore.ts reads. Kept free of Firebase so it can be checked
// under Node (`npm run check:fleet`).
// ===================================

import { Certificate, scopeOf } from '../types/certificate';
import { CrewMember } from '../types/crew';
import { DocAck, IsmDoc } from '../types/docs';
import { EquipmentItem } from '../types/equipment';
import { Machine, PmsJob } from '../types/pms';
import { SpareMove, SparePart } from '../types/spares';
import { computeStatus, statusFromDate } from '../utils/dates';
import { jobDue } from './pms';
import { readStatus } from './docs';
import { stockByPart, toOrderCounts } from './spares';

export interface VesselData {
  imo: string;
  name: string;
  /** When the register was last written, by anyone. */
  registerAt: number;
  items: EquipmentItem[];
  certificates: Certificate[];
  crew: CrewMember[];
  docs: IsmDoc[];
  acks: DocAck[];
  machines: Machine[];
  jobs: PmsJob[];
  spares: SparePart[];
  moves: SpareMove[];
}

export interface Count {
  expired: number;
  due: number;
}

export interface VesselSummary {
  imo: string;
  name: string;
  registerAt: number;
  items: number;
  equipment: Count;
  /** Equipment-scope certificates. */
  certs: Count;
  crewCerts: Count;
  vesselCerts: Count;
  pms: Count;
  sparesOut: number;
  sparesLow: number;
  docs: number;
  /** Documents that must be read where somebody on the crew list has not signed the current revision. */
  docsOutstanding: number;
  /** Total unsigned person-documents across those. */
  signaturesMissing: number;
}

function count<T>(list: T[], status: (x: T) => string): Count {
  let expired = 0;
  let due = 0;
  for (const x of list) {
    const s = status(x);
    if (s === 'expired') expired += 1;
    else if (s === 'due') due += 1;
  }
  return { expired, due };
}

export function summarise(v: VesselData): VesselSummary {
  const live = <T extends { deleted?: boolean }>(l: T[]) => l.filter((x) => !x.deleted);
  const certsBy = (scope: string) => v.certificates.filter((c) => scopeOf(c) === scope);
  const certStatus = (c: Certificate) => statusFromDate(c.expiryDate);
  const machines = new Map(live(v.machines).map((m) => [m.id, m]));
  const jobs = live(v.jobs).filter((j) => machines.has(j.machineId));
  const spares = live(v.spares);
  const order = toOrderCounts(spares, stockByPart(v.moves));
  const mustRead = live(v.docs).filter((d) => d.mustRead !== false);
  let docsOutstanding = 0;
  let signaturesMissing = 0;
  for (const d of mustRead) {
    const st = readStatus(d, v.acks, v.crew);
    if (st.unread.length) {
      docsOutstanding += 1;
      signaturesMissing += st.unread.length;
    }
  }
  return {
    imo: v.imo,
    name: v.name,
    registerAt: v.registerAt,
    items: v.items.length,
    equipment: count(v.items, computeStatus),
    certs: count(certsBy('equipment'), certStatus),
    crewCerts: count(certsBy('crew'), certStatus),
    vesselCerts: count(certsBy('vessel'), certStatus),
    pms: count(jobs, (j) => jobDue(j, machines.get(j.machineId)).status),
    sparesOut: order.out,
    sparesLow: order.low,
    docs: live(v.docs).length,
    docsOutstanding,
    signaturesMissing,
  };
}

/** Worst first: what a superintendent should look at before the coffee is cold. */
export function fleetOrder(a: VesselSummary, b: VesselSummary): number {
  const score = (s: VesselSummary) =>
    (s.equipment.expired + s.certs.expired + s.crewCerts.expired + s.vesselCerts.expired + s.pms.expired) * 1000 +
    (s.equipment.due + s.certs.due + s.crewCerts.due + s.vesselCerts.due + s.pms.due + s.sparesOut + s.docsOutstanding);
  return score(b) - score(a) || a.name.localeCompare(b.name);
}
