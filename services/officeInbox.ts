// ===================================
// The superintendent's attention list (plan items 37 + 45, 2 Nov 2026) — the
// first thing Fleet shows (screens/FleetSc), as pure functions over what
// services/shore.ts reads, checked by `npm run check:inbox`.
//
// Two parts, both across every vessel the account has been let into:
//   Waiting for you  every record that waits for the office's answer — PMS
//                    deferrals (item 32), closures to verify (31), NCs closed by
//                    the Master (31/33), requisitions sent to the office and
//                    emergencies sent without it (35), changes the Master
//                    approved (38), discussions that called on the office (43). Oldest first: what has
//                    waited longest is answered first. Each row opens the same
//                    sheet the vessel's tab does (FleetVesselSc `open`).
//   Red              only what is wrong now, per vessel: a detention not lifted,
//                    a critical machine out of service, defects open on critical
//                    machines, findings overdue, PMS jobs overdue, certificates
//                    and equipment expired. Amber ("due") is left to the vessel
//                    cards — a superintendent's morning starts with red.
//
// Nothing is stored: the list is read from the records, so answering a row on
// the vessel's own tab takes it off here too.
// ===================================

import type { VesselData } from './fleetSummary';
import { awaitsOffice, deferralsToAnswer, ncAwaitsOffice } from './officeCheck';
import { emergencyOpen, officeQueue, round } from './poApproval';
import { mocsToAnswer, sentToOffice } from './moc';
import { threadsToAnswer } from './threads';
import { critSummary } from './critEq';
import { inspStatus } from './extInspections';
import { activeDeferral, jobDue } from './pms';
import { ncState } from './safety';
import { scopeOf } from '../types/certificate';
import { computeStatus, statusFromDate } from '../utils/dates';

/** Which parts of the office loop are on for a vessel: the build's flag or the vessel's own module. */
export interface OfficeParts {
  office: boolean;
  po: boolean;
  crit: boolean;
  ext: boolean;
  moc: boolean;
  threads: boolean;
}

/** On for the build (`buildOn`, constants/modules moduleOn) or for this vessel as a pilot. */
export function officeParts(v: Pick<VesselData, 'modules'>, buildOn: (k: 'officeCheck' | 'poApproval' | 'critEq' | 'extInsp' | 'moc' | 'threads') => boolean): OfficeParts {
  const m = v.modules ?? {};
  return {
    office: buildOn('officeCheck') || m.officeCheck === true,
    po: buildOn('poApproval') || m.poApproval === true,
    crit: buildOn('critEq') || m.critEq === true,
    ext: buildOn('extInsp') || m.extInsp === true,
    moc: buildOn('moc') || m.moc === true,
    threads: buildOn('threads') || m.threads === true,
  };
}

export type InboxKind = 'deferral' | 'closure' | 'nc' | 'po' | 'emergency' | 'moc' | 'thread';
/** The vessel tab the row belongs to (FleetVesselSc `Tab`). */
export type InboxTab = 'verify' | 'po' | 'moc' | 'talk';

export interface InboxItem {
  imo: string;
  vessel: string;
  kind: InboxKind;
  /** The record's id — FleetVesselSc opens it. */
  id: string;
  title: string;
  /** Who asked (name and rank, as signed). */
  by?: string;
  /** Since when it waits, epoch ms. */
  since: number;
  tab: InboxTab;
}

const who = (by?: string, rank?: string) => (by ? (rank ? `${by} (${rank})` : by) : undefined);

/** One vessel's records waiting for the office, oldest first. */
export function inboxOf(v: VesselData, on: OfficeParts): InboxItem[] {
  const out: InboxItem[] = [];
  const base = { imo: v.imo, vessel: v.name };
  if (on.office) {
    for (const d of deferralsToAnswer(v.deferrals ?? [], v.jobs.filter((j) => !j.deleted))) {
      out.push({ ...base, kind: 'deferral', id: d.id, title: `${d.machineName} — ${d.jobTitle}`, by: who(d.by, d.byRank), since: d.at, tab: 'verify' });
    }
    for (const d of (v.defects ?? []).filter(awaitsOffice)) {
      out.push({ ...base, kind: 'closure', id: d.id, title: `${d.machineName} — ${d.description}`, by: who(d.closed!.by, d.closed!.byRank), since: d.closed!.at, tab: 'verify' });
    }
    for (const nc of (v.ncs ?? []).filter(ncAwaitsOffice)) {
      out.push({ ...base, kind: 'nc', id: nc.id, title: `${nc.no} — ${nc.title}`, by: who(nc.closedBy, nc.closedByRank), since: nc.closedAt!, tab: 'verify' });
    }
  }
  if (on.po) {
    for (const o of officeQueue(v.orders ?? [])) {
      const sent = round(o).find((x) => x.kind === 'master' || x.kind === 'emergency');
      out.push({ ...base, kind: emergencyOpen(o) ? 'emergency' : 'po', id: o.id, title: o.no, by: who(sent?.by ?? o.by, sent?.byRank ?? o.byRank), since: sent?.at ?? o.at, tab: 'po' });
    }
  }
  if (on.moc) {
    for (const m of mocsToAnswer(v.mocs ?? [])) {
      const sent = sentToOffice(m)!;
      out.push({ ...base, kind: 'moc', id: m.id, title: `${m.no} — ${m.title}`, by: who(sent.by, sent.byRank), since: sent.at, tab: 'moc' });
    }
  }
  if (on.threads) {
    for (const { last, since } of threadsToAnswer(v.threads ?? [])) {
      out.push({ ...base, kind: 'thread', id: last.recId, title: last.title, by: who(last.by, last.byRank), since, tab: 'talk' });
    }
  }
  return out.sort(byAge);
}

/** Emergencies (already sent without the office) first, then oldest first. */
function byAge(a: InboxItem, b: InboxItem): number {
  return Number(b.kind === 'emergency') - Number(a.kind === 'emergency') || a.since - b.since || a.vessel.localeCompare(b.vessel);
}

/** Every vessel's waiting records in one list. */
export function fleetInbox(list: { v: VesselData; on: OfficeParts }[]): InboxItem[] {
  return list.flatMap(({ v, on }) => inboxOf(v, on)).sort(byAge);
}

export type RedKind = 'detained' | 'critOut' | 'critDefects' | 'findingsOverdue' | 'pmsOverdue' | 'certsExpired' | 'equipmentExpired';
/** Where on the vessel the line is read (FleetVesselSc tab). */
export type RedTab = 'insp' | 'crit' | 'certs' | 'equipment' | 'pms';

export interface RedLine {
  kind: RedKind;
  n: number;
  /** The first few names (machines, jobs, certificates) — enough to know without opening. */
  names: string[];
  /** Names not shown ("+2") — of names, not of `n`: two defects on one machine are one name. */
  more: number;
  /** Since when (yyyy-mm-dd): the detention, the longest-out machine. */
  since?: string;
  tab: RedTab;
}

const NAMES = 3;
const named = (l: string[]) => {
  const u = [...new Set(l)];
  return { names: u.slice(0, NAMES), more: Math.max(0, u.length - NAMES) };
};

/** What is red on one vessel today, worst kind first. Empty = nothing for the office this morning. */
export function redOf(v: VesselData, today: string, on: OfficeParts): RedLine[] {
  const out: RedLine[] = [];
  const live = <T extends { deleted?: boolean }>(l: T[]) => l.filter((x) => !x.deleted);
  if (on.ext) {
    const insps = v.extInspections ?? [];
    const held = insps.filter((x) => inspStatus(x, v.ncs ?? [], today).detainedNow).sort((a, b) => a.date.localeCompare(b.date));
    if (held.length) out.push({ kind: 'detained', n: held.length, ...named(held.map((x) => x.port ?? x.no)), since: held[0].date, tab: 'insp' });
  }
  const machines = live(v.machines);
  if (on.crit) {
    const c = critSummary(machines, v.defects ?? []);
    const out1 = c.out.filter((o) => o.critical);
    if (out1.length) out.push({ kind: 'critOut', n: out1.length, ...named(out1.map((o) => o.name)), since: out1.map((o) => o.since).sort()[0], tab: 'crit' });
    if (c.defects) {
      const crit = new Set(machines.filter((m) => m.critical).map((m) => m.id));
      out.push({ kind: 'critDefects', n: c.defects, ...named((v.defects ?? []).filter((d) => !d.closed && crit.has(d.machineId)).map((d) => d.machineName)), tab: 'crit' });
    }
  }
  if (on.ext) {
    const ids = new Set((v.extInspections ?? []).map((x) => x.id));
    const late = (v.ncs ?? []).filter((n) => n.inspId && ids.has(n.inspId) && ncState(n, today) === 'overdue');
    if (late.length) out.push({ kind: 'findingsOverdue', n: late.length, ...named(late.map((n) => n.no)), tab: 'insp' });
  }
  const byId = new Map(machines.map((m) => [m.id, m]));
  const jobs = live(v.jobs).filter((j) => byId.has(j.machineId));
  const overdue = jobs.filter((j) => jobDue(j, byId.get(j.machineId), today, activeDeferral(j, v.deferrals ?? [])).status === 'expired');
  if (overdue.length) out.push({ kind: 'pmsOverdue', n: overdue.length, ...named(overdue.map((j) => `${byId.get(j.machineId)!.name} — ${j.title}`)), tab: 'pms' });
  const certs = v.certificates.filter((c) => statusFromDate(c.expiryDate) === 'expired').sort((a, b) => (a.expiryDate ?? '').localeCompare(b.expiryDate ?? ''));
  if (certs.length) {
    // A crew certificate is named by its holder too — the office knows who to call.
    out.push({ kind: 'certsExpired', n: certs.length, ...named(certs.map((c) => (scopeOf(c) === 'crew' && c.holderName ? `${c.name} · ${c.holderName}` : c.name))), tab: 'certs' });
  }
  const items = v.items.filter((it) => computeStatus(it) === 'expired');
  if (items.length) out.push({ kind: 'equipmentExpired', n: items.length, names: [], more: 0, tab: 'equipment' });
  return out;
}

export interface VesselRed {
  imo: string;
  vessel: string;
  lines: RedLine[];
}

const WEIGHT: Record<RedKind, number> = { detained: 100, critOut: 50, critDefects: 10, findingsOverdue: 10, pmsOverdue: 2, certsExpired: 2, equipmentExpired: 1 };

/** Vessels with anything red, worst first; clean vessels are left out. */
export function fleetRed(list: { v: VesselData; on: OfficeParts }[], today: string): VesselRed[] {
  const score = (r: VesselRed) => r.lines.reduce((s, l) => s + WEIGHT[l.kind] * (1 + Math.min(l.n, 20) / 20), 0);
  return list
    .map(({ v, on }) => ({ imo: v.imo, vessel: v.name, lines: redOf(v, today, on) }))
    .filter((r) => r.lines.length)
    .sort((a, b) => score(b) - score(a) || a.vessel.localeCompare(b.vessel));
}
