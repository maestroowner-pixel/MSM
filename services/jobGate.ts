// ===================================
// What a PMS job needs before it can be signed out (TM Master comparison, item
// 6): a permit to work of its type raised for this job in this cycle, and the
// person signing having read the current revision of its documents. Pure,
// tested (check:pms).
//
// Plan item 39: a job marked `raRequired` also needs a risk assessment made for
// it in this cycle and approved — its own, or the one on the permit it is done
// under. Deferring a job through the office needs one too, made after the
// job's last sign-out and its last deferral, so each deferral is assessed afresh.
// ===================================

import { PmsDeferral, PmsDone, PmsJob } from '../types/pms';
import { Permit, RaSnapshot, RiskAssessment } from '../types/permits';
import { riskLevel, worstResidual } from './permits';
import { DocAck, IsmDoc } from '../types/docs';

export interface JobGate {
  /** The permit that covers this sign-out, if the job needs one and there is one. */
  permit?: Permit;
  /** The job needs a permit and none covers it. */
  permitMissing: boolean;
  /** Documents the signer has not read in their current revision. */
  unread: IsmDoc[];
  /** The approved risk assessment that covers this sign-out, if the job needs one and there is one. */
  ra?: RiskAssessment;
  /** The job needs a fresh risk assessment and none is approved. */
  raMissing: boolean;
}

export function jobGate(
  job: Pick<PmsJob, 'id' | 'permitType' | 'docIds' | 'raRequired'>,
  o: { permits: Permit[]; done: PmsDone[]; docs: IsmDoc[]; acks: DocAck[]; personKey?: string; ptwOn: boolean; docsOn: boolean; risks?: RiskAssessment[] }
): JobGate {
  let permit: Permit | undefined;
  let permitMissing = false;
  // This cycle: raised after the job was last signed out.
  const since = lastDoneAt(job.id, o.done);
  if (job.permitType && o.ptwOn) {
    permit = o.permits
      .filter((p) => p.pmsJobId === job.id && p.type === job.permitType && ['approved', 'active', 'closed'].includes(p.status) && p.createdAt > since)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    permitMissing = !permit;
  }
  const unread =
    job.docIds?.length && o.docsOn
      ? o.docs.filter((d) => job.docIds!.includes(d.id) && !o.acks.some((a) => a.docId === d.id && a.revision === d.revision && a.personKey === o.personKey))
      : [];
  let ra: RiskAssessment | undefined;
  let raMissing = false;
  if (job.raRequired && o.ptwOn) {
    const risks = o.risks ?? [];
    ra = newestApproved(risks.filter((r) => r.pmsJobId === job.id && r.pmsFor !== 'deferral' && r.createdAt > since));
    // A permit raised for this job in this cycle carries its own assessment: that one counts.
    if (!ra) {
      const onPermit = o.permits
        .filter((p) => p.pmsJobId === job.id && p.raId && p.status !== 'cancelled' && p.createdAt > since)
        .map((p) => risks.find((r) => r.id === p.raId))
        .filter((r): r is RiskAssessment => !!r);
      ra = newestApproved(onPermit);
    }
    raMissing = !ra;
  }
  return { permit, permitMissing, unread, ra, raMissing };
}

function lastDoneAt(jobId: string, done: PmsDone[]): number {
  return Math.max(0, ...done.filter((d) => d.jobId === jobId).map((d) => d.at));
}

function newestApproved(rs: RiskAssessment[]): RiskAssessment | undefined {
  return rs.filter((r) => !r.deleted && !r.generic && r.approved).sort((a, b) => b.createdAt - a.createdAt)[0];
}

/** The approved assessment for deferring this job now: made after its last sign-out and its last deferral. */
export function deferralRa(jobId: string, o: { risks: RiskAssessment[]; done: PmsDone[]; deferrals: PmsDeferral[] }): RiskAssessment | undefined {
  const since = Math.max(lastDoneAt(jobId, o.done), ...o.deferrals.filter((d) => d.jobId === jobId).map((d) => d.at));
  return newestApproved(o.risks.filter((r) => r.pmsJobId === jobId && r.pmsFor === 'deferral' && r.createdAt > since));
}

/** The assessment as approved, frozen onto the deferral. */
export function raSnapshot(ra: RiskAssessment): RaSnapshot {
  return {
    id: ra.id,
    ...(ra.no ? { no: ra.no } : {}),
    title: ra.title,
    worst: worstResidual(ra),
    hazards: ra.hazards.map((h) => ({
      hazard: h.hazard,
      ...(h.controls ? { controls: h.controls } : {}),
      level: riskLevel(h.residualLikelihood ?? h.likelihood, h.residualSeverity ?? h.severity),
    })),
    approvedBy: ra.approved!.byRank ? `${ra.approved!.by} (${ra.approved!.byRank})` : ra.approved!.by,
    approvedAt: ra.approved!.at,
  };
}
