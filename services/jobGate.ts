// ===================================
// What a PMS job needs before it can be signed out (TM Master comparison, item
// 6): a permit to work of its type raised for this job in this cycle, and the
// person signing having read the current revision of its documents. Pure,
// tested (check:pms).
// ===================================

import { PmsDone, PmsJob } from '../types/pms';
import { Permit } from '../types/permits';
import { DocAck, IsmDoc } from '../types/docs';

export interface JobGate {
  /** The permit that covers this sign-out, if the job needs one and there is one. */
  permit?: Permit;
  /** The job needs a permit and none covers it. */
  permitMissing: boolean;
  /** Documents the signer has not read in their current revision. */
  unread: IsmDoc[];
}

export function jobGate(
  job: Pick<PmsJob, 'id' | 'permitType' | 'docIds'>,
  o: { permits: Permit[]; done: PmsDone[]; docs: IsmDoc[]; acks: DocAck[]; personKey?: string; ptwOn: boolean; docsOn: boolean }
): JobGate {
  let permit: Permit | undefined;
  let permitMissing = false;
  if (job.permitType && o.ptwOn) {
    // This cycle: raised after the job was last signed out.
    const since = Math.max(0, ...o.done.filter((d) => d.jobId === job.id).map((d) => d.at));
    permit = o.permits
      .filter((p) => p.pmsJobId === job.id && p.type === job.permitType && ['approved', 'active', 'closed'].includes(p.status) && p.createdAt > since)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    permitMissing = !permit;
  }
  const unread =
    job.docIds?.length && o.docsOn
      ? o.docs.filter((d) => job.docIds!.includes(d.id) && !o.acks.some((a) => a.docId === d.id && a.revision === d.revision && a.personKey === o.personKey))
      : [];
  return { permit, permitMissing, unread };
}
