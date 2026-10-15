// ===================================
// Searches — for stowaways before sailing, and after a bomb threat (15 Oct 2026,
// ISPS: "checklists and the allocation to teams — stowaway and bomb search").
//
//   SearchPlan      the vessel's areas to search, each given to a team, and the
//                   teams with their people. Kept by the officers (the SSO), one
//                   record. Starts from a typical yacht.
//   SecuritySearch  one search: its kind, why, the areas copied from the plan
//                   with their teams; each area marked clear or found as it is
//                   done; signed by whoever led it (the SSO / the Master).
//
// A search is worked from the phones in the teams' hands: an area is ticked by
// the person who searched it, so the record shows who looked where and when.
// ===================================

import type { SignProof } from '../services/signature';

export type SearchKind = 'stowaway' | 'bomb';
export const SEARCH_LABEL: Record<SearchKind, string> = { stowaway: 'Stowaway search', bomb: 'Bomb search' };

export interface SearchTeam {
  id: string;
  name: string;
  /** Crew names. */
  members: string[];
}

export interface SearchArea {
  id: string;
  name: string;
  /** SearchTeam id. */
  teamId?: string;
  /** Only in one kind of search — a tender garage is searched for stowaways, not always for a bomb. Absent = both. */
  only?: SearchKind;
}

export interface SearchPlan {
  id: string;
  teams: SearchTeam[];
  areas: SearchArea[];
  updatedAt: number;
}
export const PLAN_ID = 'plan';

export interface SearchAreaResult {
  areaId: string;
  name: string;
  team?: string;
  result?: 'clear' | 'found';
  note?: string;
  by?: string;
  at?: number;
}

export interface SecuritySearch {
  id: string;
  kind: SearchKind;
  date: string;
  /** hh:mm started. */
  time: string;
  /** Before departure from…, threat received by phone at…. */
  reason?: string;
  areas: SearchAreaResult[];
  /** Closed and signed by the one who led it. */
  closed?: { by: string; byRank?: string; at: number; signedWith?: SignProof; outcome: string };
  updatedAt: number;
}

export const DEFAULT_TEAMS: SearchTeam[] = [
  { id: 'deck', name: 'Deck team', members: [] },
  { id: 'engine', name: 'Engine team', members: [] },
  { id: 'interior', name: 'Interior team', members: [] },
];

/** A typical yacht, bow to stern — the officer edits it to the vessel's plan. */
export const DEFAULT_AREAS: SearchArea[] = [
  { id: 'a1', name: 'Chain locker and forepeak', teamId: 'deck' },
  { id: 'a2', name: 'Foredeck lockers, deck boxes, liferaft cradles', teamId: 'deck' },
  { id: 'a3', name: 'Mast, radar arch, flybridge', teamId: 'deck' },
  { id: 'a4', name: 'Tender garage and the tenders, jet skis', teamId: 'deck', only: 'stowaway' },
  { id: 'a5', name: 'Lazarette and swim platform', teamId: 'deck' },
  { id: 'a6', name: 'Engine room, bilges', teamId: 'engine' },
  { id: 'a7', name: 'Steering gear and shaft spaces', teamId: 'engine' },
  { id: 'a8', name: 'Workshop, technical stores, void spaces', teamId: 'engine' },
  { id: 'a9', name: 'Tanks hatches, cofferdams', teamId: 'engine' },
  { id: 'a10', name: 'Crew mess, crew cabins', teamId: 'interior' },
  { id: 'a11', name: 'Guest cabins and bathrooms', teamId: 'interior' },
  { id: 'a12', name: 'Galley, pantries, cold stores', teamId: 'interior' },
  { id: 'a13', name: 'Laundry, linen and interior stores', teamId: 'interior' },
  { id: 'a14', name: 'Saloons, lockers, behind panels', teamId: 'interior' },
  { id: 'a15', name: 'Bridge, electronics room, garbage store', teamId: 'deck' },
];

/** What every team is told before it starts — the checklist on the search's page. */
export const SEARCH_GUIDANCE: Record<SearchKind, string[]> = {
  stowaway: [
    'Before sailing from a port with a stowaway risk — and after any unauthorised boarding.',
    'Each team searches its areas, the hard-to-reach places first: voids, lockers, behind panels, tenders and their covers.',
    'Check seals and locks on every space that should be locked.',
    'Found someone: do not go near alone — keep them in sight, call the bridge, treat them humanely; the Master informs the port and the company (FAL Convention).',
    'Mark each area clear as it is done; the SSO signs when every area is clear.',
  ],
  bomb: [
    'A threat received: note the exact words, the time, the voice, the background — keep the caller talking.',
    'Do not use radios or mobile phones close to a suspect object.',
    'Search quietly, team by team, the public and unlocked spaces first. Look — do not touch, open, move or cut anything.',
    'Suspect object: leave it, note where it is, clear and close off the area, report to the bridge at once.',
    'Mark each area clear as it is done; the Master decides with the CSO and the port on evacuation.',
  ],
};

/** The areas a search of this kind covers, each with its team's name. */
export function areasFor(plan: SearchPlan, kind: SearchKind): SearchAreaResult[] {
  return plan.areas
    .filter((a) => !a.only || a.only === kind)
    .map((a) => ({ areaId: a.id, name: a.name, ...(plan.teams.find((t) => t.id === a.teamId) ? { team: plan.teams.find((t) => t.id === a.teamId)!.name } : {}) }));
}

export const defaultPlan = (): SearchPlan => ({ id: PLAN_ID, teams: DEFAULT_TEAMS, areas: DEFAULT_AREAS, updatedAt: 0 });

export const searchDone = (s: SecuritySearch) => s.areas.filter((a) => a.result).length;
