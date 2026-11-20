// ===================================
// IMO signs — the catalogue (20 Nov 2026: "inventory — order IMO signs").
//
// The equipment location markings and escape route signs a vessel posts:
// life-saving and escape by IMO Res. A.1116(30), the fire-fighting ones by
// ISO 17631, first aid, eye wash and no smoking by ISO 7010. The ids are
// PERMANENT — they are on every check record, on the spare signs in the
// IMO signs store (StoreItem.signId) and on the order lines.
//
// No IMPA codes: the code differs by size and material and a wrong one on an
// order is worse than none — the vessel or the supplier fills it in.
// No imports, so types/stores.ts can build its starter list from it.
// ===================================

export type SignGroup = 'Life-saving' | 'Escape' | 'Fire' | 'Safety';

export interface ImoSign {
  id: string;
  /** The symbol's name, as the supplier's catalogue has it. */
  name: string;
  group: SignGroup;
  /** Where the symbol is defined. */
  ref: string;
  /** Posted all over the vessel — two spares rather than one. */
  common?: boolean;
}

const A1116 = 'IMO A.1116(30)';
const ISO17631 = 'ISO 17631';
const ISO7010 = 'ISO 7010';

export const IMO_SIGNS: ImoSign[] = [
  { id: 'lifeboat', name: 'Lifeboat', group: 'Life-saving', ref: A1116 },
  { id: 'rescue_boat', name: 'Rescue boat', group: 'Life-saving', ref: A1116 },
  { id: 'liferaft', name: 'Liferaft', group: 'Life-saving', ref: A1116 },
  { id: 'davit_liferaft', name: 'Davit-launched liferaft', group: 'Life-saving', ref: A1116 },
  { id: 'embarkation_ladder', name: 'Embarkation ladder', group: 'Life-saving', ref: A1116 },
  { id: 'evacuation_slide', name: 'Marine evacuation slide', group: 'Life-saving', ref: A1116 },
  { id: 'lifebuoy', name: 'Lifebuoy', group: 'Life-saving', ref: A1116, common: true },
  { id: 'lifebuoy_light', name: 'Lifebuoy with light', group: 'Life-saving', ref: A1116 },
  { id: 'lifebuoy_smoke', name: 'Lifebuoy with light and smoke', group: 'Life-saving', ref: A1116 },
  { id: 'lifebuoy_line', name: 'Lifebuoy with line', group: 'Life-saving', ref: A1116 },
  { id: 'lifejacket', name: 'Lifejacket', group: 'Life-saving', ref: A1116, common: true },
  { id: 'child_lifejacket', name: 'Child lifejacket', group: 'Life-saving', ref: A1116 },
  { id: 'infant_lifejacket', name: 'Infant lifejacket', group: 'Life-saving', ref: A1116 },
  { id: 'immersion_suit', name: 'Immersion suit', group: 'Life-saving', ref: A1116 },
  { id: 'radio', name: 'Survival craft portable radio', group: 'Life-saving', ref: A1116 },
  { id: 'epirb', name: 'EPIRB', group: 'Life-saving', ref: A1116 },
  { id: 'sart', name: 'Search and rescue transponder (SART)', group: 'Life-saving', ref: A1116 },
  { id: 'pyro', name: 'Survival craft distress pyrotechnics', group: 'Life-saving', ref: A1116 },
  { id: 'rocket', name: 'Rocket parachute flares', group: 'Life-saving', ref: A1116 },
  { id: 'line_throwing', name: 'Line-throwing appliance', group: 'Life-saving', ref: A1116 },
  { id: 'muster', name: 'Muster station', group: 'Life-saving', ref: A1116 },
  { id: 'stretcher', name: 'Stretcher', group: 'Life-saving', ref: A1116 },
  { id: 'eebd', name: 'Emergency escape breathing device (EEBD)', group: 'Escape', ref: A1116 },
  { id: 'exit', name: 'Emergency exit', group: 'Escape', ref: A1116 },
  { id: 'escape_left', name: 'Escape route — arrow left', group: 'Escape', ref: A1116, common: true },
  { id: 'escape_right', name: 'Escape route — arrow right', group: 'Escape', ref: A1116, common: true },
  { id: 'escape_up', name: 'Escape route — arrow up', group: 'Escape', ref: A1116 },
  { id: 'escape_down', name: 'Escape route — arrow down', group: 'Escape', ref: A1116 },
  { id: 'extinguisher', name: 'Fire extinguisher', group: 'Fire', ref: ISO17631, common: true },
  { id: 'fire_hose', name: 'Fire hose and nozzle', group: 'Fire', ref: ISO17631 },
  { id: 'hydrant', name: 'Fire hydrant', group: 'Fire', ref: ISO17631 },
  { id: 'fireman', name: "Fireman's outfit", group: 'Fire', ref: ISO17631 },
  { id: 'alarm_point', name: 'Fire alarm call point', group: 'Fire', ref: ISO17631 },
  { id: 'fixed_release', name: 'Fixed fire-extinguishing system release', group: 'Fire', ref: ISO17631 },
  { id: 'shore_connection', name: 'International shore connection', group: 'Fire', ref: ISO17631 },
  { id: 'first_aid', name: 'First aid', group: 'Safety', ref: ISO7010 },
  { id: 'eye_wash', name: 'Eye wash station', group: 'Safety', ref: ISO7010 },
  { id: 'no_smoking', name: 'No smoking', group: 'Safety', ref: ISO7010 },
];

export const SIGN_MAP: Record<string, ImoSign> = Object.fromEntries(IMO_SIGNS.map((s) => [s.id, s]));
export const SIGN_GROUPS: SignGroup[] = ['Life-saving', 'Escape', 'Fire', 'Safety'];
