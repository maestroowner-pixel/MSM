// ===================================
// Permit types and their precaution checklists.
//
// Drawn from the usual shipboard forms (Code of Safe Working Practices for
// Merchant Seafarers, IMO Res. A.1050(27) on enclosed spaces, company SMS
// permits). They are a sound starting set, not a substitute for the vessel's
// own SMS form — the checklist items are what the officer ticks; anything the
// company adds goes in the permit's notes until the vessel's own lists can be
// edited.
// ===================================

import { PermitType } from '../types/permits';

export interface CheckItem {
  id: string;
  text: string;
}

export interface PermitTypeDef {
  key: PermitType;
  label: string;
  icon: string;
  /** Maximum validity in hours before the permit must be renewed. */
  maxHours: number;
  /** Gas readings required before work starts. */
  gas: boolean;
  checks: CheckItem[];
}

export const PERMIT_TYPES: PermitTypeDef[] = [
  {
    // Work that needs control but none of the specialised permits below
    // (10 Oct 2026: "add a general permit"). A specialised hazard found while
    // planning gets its own permit as well.
    key: 'general', label: 'General permit to work', icon: 'clipboard-text-outline', maxHours: 12, gas: false,
    checks: [
      { id: 'scope', text: 'Job, place and limits of the work explained to everyone involved' },
      { id: 'ra', text: 'Risk assessment reviewed with the team; hazards and controls understood' },
      { id: 'special', text: 'No hot work, enclosed space, height, electrical isolation or diving involved — or the specific permit is also issued' },
      { id: 'isolate', text: 'Equipment / systems affected isolated and tagged where needed' },
      { id: 'ppe', text: 'Correct PPE worn for the job' },
      { id: 'tools', text: 'Tools and equipment checked and fit for use' },
      { id: 'area', text: 'Work area barriered / signed; other departments affected informed' },
      { id: 'bridge', text: 'Officer of the watch / Chief Engineer informed' },
      { id: 'comms', text: 'Means of communication agreed' },
    ],
  },
  {
    key: 'hot', label: 'Hot work', icon: 'fire', maxHours: 12, gas: true,
    checks: [
      { id: 'area', text: 'Area cleared of combustibles; adjacent spaces and the other side of bulkheads checked' },
      { id: 'tanks', text: 'Nearby tanks and pipes free of flammable vapour (gas free)' },
      { id: 'detect', text: 'Fire detection in the area isolated, and the bridge informed' },
      { id: 'watch', text: 'Fire watch posted, with extinguisher and hose ready; stays 30 min after work' },
      { id: 'equip', text: 'Welding / cutting equipment inspected, cylinders secured, flashback arrestors fitted' },
      { id: 'ppe', text: 'Welding PPE worn: visor, gloves, leather apron, boots' },
      { id: 'vent', text: 'Ventilation adequate for fumes' },
      { id: 'ra', text: 'Risk assessment reviewed with the team' },
    ],
  },
  {
    key: 'enclosed', label: 'Enclosed space entry', icon: 'door-closed-lock', maxHours: 8, gas: true,
    checks: [
      { id: 'isolate', text: 'Space isolated: pipelines blanked / valves locked, machinery stopped and tagged' },
      { id: 'vent', text: 'Space ventilated, and ventilation continues during entry' },
      { id: 'test', text: 'Atmosphere tested at different levels with a calibrated meter' },
      { id: 'standby', text: 'Attendant at the entrance for the whole entry, in contact with those inside' },
      { id: 'comms', text: 'Communication agreed and tested (radio / signals)' },
      { id: 'rescue', text: 'Rescue equipment at the entrance: SCBA, harness and lifeline, stretcher' },
      { id: 'lighting', text: 'Adequate lighting (intrinsically safe where required)' },
      { id: 'bridge', text: 'Officer of the watch informed' },
      { id: 'ra', text: 'Risk assessment reviewed with the team' },
    ],
  },
  {
    key: 'height', label: 'Work at height / overside', icon: 'ladder', maxHours: 12, gas: false,
    checks: [
      { id: 'harness', text: 'Full-body harness worn and attached to a strong point' },
      { id: 'gear', text: 'Ladders, staging, bosun’s chair inspected' },
      { id: 'tools', text: 'Tools secured against falling; area below barricaded' },
      { id: 'weather', text: 'Weather and vessel motion suitable' },
      { id: 'overside', text: 'Overside: lifejacket worn, lifebuoy with line ready, vessel not under way' },
      { id: 'radar', text: 'Radar / radio aerials isolated where work is near them' },
      { id: 'ra', text: 'Risk assessment reviewed with the team' },
    ],
  },
  {
    key: 'electrical', label: 'Electrical / isolation (LOTO)', icon: 'flash', maxHours: 12, gas: false,
    checks: [
      { id: 'isolate', text: 'Circuit isolated at the breaker and the isolation proved dead' },
      { id: 'lock', text: 'Lock and tag applied by each person working' },
      { id: 'stored', text: 'Stored energy released (capacitors, hydraulics, springs)' },
      { id: 'ppe', text: 'Insulated tools and PPE in use' },
      { id: 'notice', text: 'Notices posted at the switchboard and the equipment' },
      { id: 'ra', text: 'Risk assessment reviewed with the team' },
    ],
  },
  {
    key: 'cold', label: 'Cold work / machinery', icon: 'wrench', maxHours: 12, gas: false,
    checks: [
      { id: 'isolate', text: 'Machinery stopped, isolated and tagged out' },
      { id: 'pressure', text: 'Systems depressurised and drained' },
      { id: 'ppe', text: 'PPE suitable for the task' },
      { id: 'ra', text: 'Risk assessment reviewed with the team' },
    ],
  },
  {
    key: 'diving', label: 'Diving operations', icon: 'diving-scuba-tank', maxHours: 6, gas: false,
    checks: [
      { id: 'props', text: 'Main engines, thrusters and propellers isolated and tagged; bridge controls notices posted' },
      { id: 'intakes', text: 'Sea suctions and discharges near the diver isolated' },
      { id: 'flag', text: 'Diving flag (A) displayed; harbour authority informed' },
      { id: 'standby', text: 'Standby diver and tender ready' },
      { id: 'equipment', text: 'Diving equipment inspected, air quality certificate valid' },
      { id: 'ra', text: 'Risk assessment reviewed with the team' },
    ],
  },
];

export const PERMIT_TYPE_MAP: Record<PermitType, PermitTypeDef> = Object.fromEntries(PERMIT_TYPES.map((t) => [t.key, t])) as any;

/**
 * Safe limits for entry (IMO A.1050(27) and common company practice): oxygen
 * 20.8 % – 21.5 %, flammable < 1 % LEL, H₂S < 5 ppm, CO < 25 ppm.
 */
export const GAS_LIMITS = { o2Min: 20.8, o2Max: 21.5, lelMax: 1, h2sMax: 5, coMax: 25 };
