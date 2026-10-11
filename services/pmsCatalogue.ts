// ===================================
// The planned-maintenance catalogue — typical systems and their jobs, by
// department, to start a vessel's plan from.
//
// Built from research/superyacht-task-list.md (owner's folder, 9 Oct 2026): the
// full run of work on a superyacht, not just the engine room. A plan that holds
// only machinery leaves the tender, the galley, the network and the hull outside
// the system, and those are exactly the jobs that get forgotten.
//
// The intervals are TYPICAL, not the maker's: every job added from here says
// so in its notes, and the officer edits it like any other. Every system can
// also be added empty and filled by hand — the catalogue is a start, never a
// limit.
// ===================================

import { Dept, JobType } from '../types/pms';

export interface CatalogueJob {
  title: string;
  hours?: number;
  days?: number;
  /** Kind of job (types/pms JOB_TYPE). */
  type?: JobType;
}

export interface CatalogueSystem {
  key: string;
  dept: Dept;
  label: string;
  /** Has a running-hours counter (engines, generators, compressors…). */
  counter: boolean;
  /** Critical equipment by default (steering, propulsion, fire-fighting, safety). */
  critical?: boolean;
  jobs: CatalogueJob[];
}

const W = 7;
const M = 30;
const Q = 90;
const H = 180;
const Y = 365;

export const CATALOGUE: CatalogueSystem[] = [
  // ---- Engineering -------------------------------------------------------------
  { key: 'engine', dept: 'engineering', label: 'Diesel engine (main / auxiliary)', counter: true, jobs: [
    { title: 'Engine oil and oil filter change', hours: 250, days: Y },
    { title: 'Oil sample for analysis', hours: 250, days: H },
    { title: 'Fuel filters (primary and secondary)', hours: 500, days: Y },
    { title: 'Raw-water pump impeller', hours: 500, days: Y },
    { title: 'Air filter check / clean', hours: 250 },
    { title: 'Valve clearances check', hours: 1000 },
    { title: 'Coolant test / renewal', days: 730 },
    { title: 'Zinc anodes (heat exchanger, coolers)', days: H },
    { title: 'Drive belts check', hours: 250, days: H },
    { title: 'Heat exchanger / aftercooler clean', hours: 2000, days: 730 },
    { title: 'Alarm and shutdown tests', days: Q },
    { title: 'Engine mounts, flexible couplings, exhaust bellows', days: Y },
  ] },
  { key: 'gearbox', dept: 'engineering', label: 'Gearbox, shafts and propellers', counter: true, jobs: [
    { title: 'Gearbox oil and filter change', hours: 1000, days: Y },
    { title: 'Shaft seals check', days: W },
    { title: 'Cutless bearings and shaft alignment check', days: Y },
    { title: 'Propeller and shaft anodes (diver)', days: H },
  ] },
  { key: 'generator', dept: 'engineering', label: 'Generator', counter: true, jobs: [
    { title: 'Engine oil and oil filter change', hours: 250, days: Y },
    { title: 'Fuel filter', hours: 500, days: Y },
    { title: 'Raw-water pump impeller', hours: 500, days: Y },
    { title: 'Air filter', hours: 500 },
    { title: 'Anodes', days: H },
    { title: 'Valve clearances check', hours: 1000 },
    { title: 'Load test', days: Q },
    { title: 'Alternator insulation test, bearings, cleaning', days: Y },
  ] },
  { key: 'emergency_gen', dept: 'engineering', label: 'Emergency generator', counter: true, jobs: [
    { title: 'Run on load and auto-start test', days: M },
    { title: 'Oil and filter change', hours: 250, days: Y },
    { title: 'Starting batteries check', days: W },
  ] },
  { key: 'fuel', dept: 'engineering', label: 'Fuel system and separator', counter: false, jobs: [
    { title: 'Drain water from tanks and filters', days: W },
    { title: 'Separator bowl clean', days: M },
    { title: 'Quick-closing valves remote test', days: Q },
    { title: 'Bunkering hoses inspection', days: Y },
    { title: 'Fuel tank inspection / clean', days: 5 * Y },
  ] },
  { key: 'seawater', dept: 'engineering', label: 'Sea chests, strainers and seacocks', counter: false, jobs: [
    { title: 'Strainers inspect and clean', days: M },
    { title: 'Seacocks exercise', days: M },
    { title: 'Anti-fouling system (MGPS) check', days: M },
    { title: 'Seacocks overhaul (haul-out)', days: 2 * Y },
  ] },
  { key: 'compressor', dept: 'engineering', label: 'Air / BA / dive compressor', counter: true, jobs: [
    { title: 'Oil change', hours: 125, days: Y },
    { title: 'Filter cartridge', hours: 25 },
    { title: 'Air quality test', days: Q },
    { title: 'Safety valves test', days: Y },
    { title: 'Valve service', hours: 1000 },
  ] },
  { key: 'pump', dept: 'engineering', label: 'Pump (fire, bilge, ballast, transfer)', counter: false, jobs: [
    { title: 'Run test and pressure check', days: W },
    { title: 'Bilge alarms and float switches test', days: M },
    { title: 'Seal and bearing inspection', days: Y },
    { title: 'Impeller inspection', days: Y },
  ] },
  { key: 'watermaker', dept: 'engineering', label: 'Watermaker', counter: true, jobs: [
    { title: 'Product water TDS check', days: 1 },
    { title: 'Pre-filters change', hours: 100, days: M },
    { title: 'Membrane clean / pickling', days: H },
    { title: 'High-pressure pump oil change', hours: 500, days: Y },
  ] },
  { key: 'freshwater', dept: 'engineering', label: 'Fresh and hot water', counter: false, jobs: [
    { title: 'Chlorine / pH test', days: W },
    { title: 'Legionella: hot water ≥ 60 °C, flush dead legs', days: W },
    { title: 'Shower heads clean and disinfect', days: Q },
    { title: 'Potable water lab analysis', days: H },
    { title: 'UV sterilizer lamp', days: Y },
    { title: 'Tanks inspect, clean and disinfect', days: Y },
    { title: 'Calorifier anode and safety valve', days: Y },
  ] },
  { key: 'sewage', dept: 'engineering', label: 'Sewage, grey water and MARPOL', counter: false, jobs: [
    { title: 'Sewage plant check', days: W },
    { title: 'Vacuum toilet system pumps and valves', days: M },
    { title: 'Oily water separator and 15 ppm alarm test', days: M },
    { title: 'Holding tank sensors, vents, deodorizer filters', days: M },
    { title: '15 ppm monitor calibration', days: Y },
  ] },
  { key: 'hvac', dept: 'engineering', label: 'HVAC, chillers and refrigeration', counter: false, jobs: [
    { title: 'AHU / fan-coil filters clean', days: M },
    { title: 'Chiller pressures, temperatures, leak check', days: M },
    { title: 'Cold room and freezer alarms test', days: M },
    { title: 'Condensate trays clean and disinfect', days: Q },
    { title: 'Chilled-water pumps and strainers', days: Q },
    { title: 'Condensers, seawater side clean', days: Y },
    { title: 'Refrigerant (F-gas) leak test', days: Y },
  ] },
  { key: 'electrical', dept: 'engineering', label: 'Electrical: batteries, shore power, switchboards', counter: false, jobs: [
    { title: 'Battery banks: voltage, temperature', days: W },
    { title: 'Shore power cable, plugs, isolation transformer', days: M },
    { title: 'UPS test', days: H },
    { title: 'Switchboard thermography and tightening', days: Y },
    { title: 'Insulation resistance test', days: Y },
    { title: 'Battery capacity test', days: Y },
  ] },
  { key: 'hydraulics', dept: 'engineering', label: 'Hydraulic power pack', counter: true, jobs: [
    { title: 'Oil level and leaks', days: W },
    { title: 'Hydraulic filters', hours: 1000, days: Y },
    { title: 'Hydraulic oil sample / change', days: Y },
  ] },
  { key: 'fin_stabiliser', dept: 'engineering', label: 'Fin stabilisers (hydraulic)', counter: true, jobs: [
    { title: 'Hydraulic oil level and leaks', days: M },
    { title: 'Hydraulic filter change', hours: 1000, days: Y },
    { title: 'Hydraulic oil sample / change', days: 730 },
    { title: 'Fin shaft seals and bearings inspection', days: Y },
    { title: 'Fin anodes', days: Y },
  ] },
  { key: 'gyro_stabiliser', dept: 'engineering', label: 'Gyro stabiliser', counter: true, jobs: [
    { title: 'Glycol cooling level and pump check', days: M },
    { title: 'Seawater strainer clean', days: M },
    { title: 'Cooling-loop anode', days: Y },
    { title: "Bearing service (maker's interval)", hours: 4000 },
    { title: 'Vacuum check', days: Y },
  ] },
  { key: 'thruster', dept: 'engineering', label: 'Bow / stern thruster', counter: true, jobs: [
    { title: 'Run test both directions', days: W },
    { title: 'Gear-leg oil level / change', hours: 200, days: Y },
    { title: 'Propeller and anode inspection (haul-out)', days: Y },
    { title: 'Motor brushes and contactors (electric)', hours: 200, days: Y },
  ] },
  { key: 'steering', dept: 'engineering', label: 'Steering gear', counter: false, jobs: [
    { title: 'Steering gear test before departure', days: 1 },
    { title: 'Emergency steering changeover drill', days: Q },
    { title: 'Oil, rams, rudder bearings', days: Y },
  ] },

  // ---- Deck --------------------------------------------------------------------
  { key: 'anchoring', dept: 'deck', label: 'Anchoring and mooring', counter: false, jobs: [
    { title: 'Windlass and capstans: grease, brake, clutch, function', days: M },
    { title: 'Mooring lines and fenders condition', days: M },
    { title: 'Anchor swivel, shackles, chain stopper', days: H },
    { title: 'Windlass gearbox oil', days: Y },
    { title: 'Anchor chain inspect, mark, end-for-end', days: Y },
    { title: 'Bollards, fairleads, cleats', days: Y },
  ] },
  { key: 'crane', dept: 'deck', label: 'Crane / davit / passerelle', counter: false, jobs: [
    { title: 'Wire inspection and lubrication', days: M },
    { title: 'Passerelle and boarding ladder check', days: M },
    { title: 'Hydraulic oil and filters', days: Y },
    { title: 'Thorough examination (LOLER)', days: Y },
    { title: 'Load test', days: 5 * Y },
  ] },
  { key: 'tender', dept: 'deck', label: 'Tender', counter: true, jobs: [
    { title: 'Engine run, levels', days: W },
    { title: 'Safety kit: flares, VHF, anchor, kill cord', days: M },
    { title: 'Hull, tubes, valves, bilge pump', days: M },
    { title: 'Engine service: oil, filters, impeller, plugs', hours: 100, days: Y },
    { title: 'Jet drive / outdrive service', hours: 100, days: Y },
    { title: 'Lifting points and slings', days: Y },
  ] },
  { key: 'toys', dept: 'deck', label: 'Jet skis, Seabobs and water toys', counter: false, jobs: [
    { title: 'Rinse, charge, check after use', days: W },
    { title: 'Inflatables, slides, wakeboards condition', days: M },
    { title: 'Annual service', days: Y },
  ] },
  { key: 'dive', dept: 'deck', label: 'Dive equipment', counter: false, jobs: [
    { title: 'Regulators and BCDs service', days: Y },
    { title: 'Cylinders visual inspection', days: Y },
    { title: 'Cylinders hydrostatic test', days: 5 * Y },
  ] },
  { key: 'exterior', dept: 'deck', label: 'Exterior: paint, teak, glass', counter: false, jobs: [
    { title: 'Stainless polishing', days: W },
    { title: 'Teak deck clean', days: M },
    { title: 'Hatches, doors, window seals and drains', days: M },
    { title: 'Awnings, biminis and covers', days: M },
    { title: 'Paint / gelcoat polish and wax', days: Q },
    { title: 'Varnish / brightwork', days: H },
    { title: 'Teak caulking and fastenings', days: Y },
  ] },
  { key: 'garage', dept: 'deck', label: 'Swim platform and garage doors', counter: false, jobs: [
    { title: 'Seals, rams and safety stops', days: M },
    { title: 'Hydraulic service', days: Y },
  ] },
  { key: 'pool', dept: 'deck', label: 'Pool / jacuzzi', counter: false, jobs: [
    { title: 'Water chemistry', days: 1 },
    { title: 'Filters and pumps', days: W },
  ] },
  { key: 'rig', dept: 'deck', label: 'Rig and sails (sailing yacht)', counter: false, jobs: [
    { title: 'Rig inspection aloft', days: H },
    { title: 'Winches service', days: Y },
    { title: 'Running rigging', days: Y },
    { title: 'Sails inspection and repair', days: Y },
    { title: 'Standing rigging NDT / renewal', days: 5 * Y },
  ] },

  // ---- Safety (systems outside the LSA / FFE register) ---------------------------
  { key: 'safety_systems', dept: 'safety', label: 'Fire detection, emergency stops, watertight doors', counter: false, jobs: [
    { title: 'Fire detection zone test', days: W },
    { title: 'Watertight doors operation', days: W },
    { title: 'Emergency stops and remote shut-offs', days: Q },
    { title: 'Fire dampers operation', days: Q },
    { title: 'Gas detectors calibration', days: H },
    { title: 'Fire detection full test (service company)', days: Y },
  ] },

  // ---- Bridge & comms ----------------------------------------------------------
  { key: 'nav', dept: 'bridge', label: 'Navigation equipment', counter: false, jobs: [
    { title: 'Nav lights and sound signals test', days: 1 },
    { title: 'Chart and publication corrections', days: W },
    { title: 'Radar performance check', days: M },
    { title: 'BNWAS test', days: M },
    { title: 'Compass deviation card', days: Y },
    { title: 'AIS annual test', days: Y },
    { title: 'VDR annual performance test', days: Y },
  ] },
  { key: 'gmdss', dept: 'bridge', label: 'GMDSS and communications', counter: false, jobs: [
    { title: 'GMDSS daily test', days: 1 },
    { title: 'GMDSS batteries capacity', days: M },
    { title: 'SSAS test', days: Y },
    { title: 'Radio survey', days: Y },
  ] },

  // ---- Interior ----------------------------------------------------------------
  { key: 'galley', dept: 'interior', label: 'Galley', counter: false, jobs: [
    { title: 'Extraction hood grease filters', days: W },
    { title: 'Ovens and combi steamers descale', days: M },
    { title: 'Dishwashers descale', days: M },
    { title: 'Ice makers clean and sanitise', days: M },
    { title: 'Coffee machines descale', days: M },
    { title: 'Extraction duct clean (fire risk)', days: Y },
  ] },
  { key: 'laundry', dept: 'interior', label: 'Laundry', counter: false, jobs: [
    { title: 'Lint filters', days: 1 },
    { title: 'Drains and dryer ducts', days: M },
  ] },
  { key: 'guest', dept: 'interior', label: 'Guest areas and cabins', counter: false, jobs: [
    { title: 'Cabin AC grilles, shower drains, heads', days: M },
    { title: 'Marble, wood, leather care', days: M },
    { title: 'Carpets and upholstery shampoo', days: Q },
    { title: 'Pest control', days: Q },
  ] },
  { key: 'spa', dept: 'interior', label: 'Spa, sauna, gym', counter: false, jobs: [
    { title: 'Sauna / steam generator clean', days: W },
    { title: 'Gym equipment check', days: Q },
    { title: 'Heaters and generators service', days: Y },
  ] },

  // ---- AV / IT -----------------------------------------------------------------
  { key: 'network', dept: 'avit', label: 'Network, Wi-Fi and satellite', counter: false, jobs: [
    { title: 'Network and Wi-Fi health', days: W },
    { title: 'Firewall / router / switch firmware', days: M },
    { title: 'VSAT / Starlink terminal and cables', days: Q },
    { title: 'IT rack UPS batteries', days: H },
  ] },
  { key: 'it', dept: 'avit', label: 'Computers, backups and cyber security', counter: false, jobs: [
    { title: 'Backups — verify a restore', days: Q },
    { title: 'OS and antivirus updates', days: M },
    { title: 'Accounts and passwords review (crew change)', days: Q },
    { title: 'Cyber-risk assessment (ISM)', days: Y },
  ] },
  { key: 'av', dept: 'avit', label: 'AV, TV, CCTV and access control', counter: false, jobs: [
    { title: 'AV / TV systems check', days: M },
    { title: 'CCTV recording and cameras', days: M },
    { title: 'Access control and door locks', days: Q },
  ] },

  // ---- Hull & dry dock ---------------------------------------------------------
  { key: 'hull', dept: 'hull', label: 'Hull and underwater', counter: false, jobs: [
    { title: 'Hull anodes / ICCP check', days: M },
    { title: 'Diver inspection: hull, props, anodes', days: H },
    { title: 'Haul-out: antifouling, zincs, seacocks, transducers', days: Y },
    { title: 'Class bottom survey', days: 913 },
    { title: 'Thickness gauging (class)', days: 5 * Y },
  ] },
  // ---- Merchant vessels (11 Oct 2026, from the owner's typical list) -----------
  // Larger ships: slow / medium-speed main engines, boilers, purifiers, cargo
  // gear, hatches, holds. Intervals typical — the maker's manual and the ship's
  // PMS decide.
  { key: 'me_large', dept: 'engineering', label: 'Main engine — slow / medium speed (merchant)', counter: true, critical: true, jobs: [
    { title: 'Daily rounds: parameters, oil levels, leaks', days: 1, type: 'visual' },
    { title: 'Lube oil analysis; filters cleaned', hours: 500, type: 'measurement' },
    { title: 'Fuel injectors check / overhaul', hours: 2000, type: 'maintenance' },
    { title: 'Valve clearances check', hours: 2000, type: 'measurement' },
    { title: 'Turbocharger water washing (compressor / turbine side)', hours: 1000, type: 'maintenance' },
    { title: 'Piston overhaul: liners, rings, bearings inspected', hours: 8000, type: 'overhaul' },
    { title: 'Crankshaft deflections', hours: 4000, type: 'measurement' },
    { title: 'Major overhaul; turbocharger overhaul', hours: 16000, type: 'overhaul' },
    { title: 'Safety devices and shutdowns test', days: Q, type: 'safety' },
  ] },
  { key: 'aux_gen_large', dept: 'engineering', label: 'Auxiliary diesel generator (merchant)', counter: true, critical: true, jobs: [
    { title: 'Lube oil and filters change', hours: 500, type: 'maintenance' },
    { title: 'Fuel injectors check', hours: 2000, type: 'maintenance' },
    { title: 'Cylinder heads overhaul', hours: 8000, type: 'overhaul' },
    { title: 'Piston group overhaul', hours: 16000, type: 'overhaul' },
    { title: 'Protection test: overspeed, low lube oil pressure, high temperature', days: Q, type: 'safety' },
    { title: 'Generator insulation resistance', days: Q, type: 'megger' },
  ] },
  { key: 'boiler', dept: 'engineering', label: 'Boiler (auxiliary / exhaust gas)', counter: false, jobs: [
    { title: 'Boiler water analysis and treatment', days: W, type: 'measurement' },
    { title: 'Burner check and clean', days: Q, type: 'maintenance' },
    { title: 'Fire side / gas side cleaning', days: H, type: 'maintenance' },
    { title: 'Safety valves test (lifting)', days: Y, type: 'safety' },
    { title: 'Flame failure, low water level and pressure trips test', days: M, type: 'safety' },
    { title: 'Internal inspection (class)', days: 2 * Y + 6 * M, type: 'visual' },
  ] },
  { key: 'purifier', dept: 'engineering', label: 'Fuel / lube oil separator (purifier)', counter: true, jobs: [
    { title: 'Bowl cleaning', hours: 500, type: 'maintenance' },
    { title: 'Seals and O-rings renewal', hours: 4000, type: 'maintenance' },
    { title: 'Major overhaul (bearings, gear)', hours: 8000, type: 'overhaul' },
    { title: 'Alarms and shutdowns test', days: Q, type: 'safety' },
  ] },
  { key: 'start_air', dept: 'engineering', label: 'Starting air compressor and receivers', counter: true, critical: true, jobs: [
    { title: 'Compressor oil change', hours: 500, type: 'maintenance' },
    { title: 'Suction and delivery valves overhaul', hours: 1000, type: 'overhaul' },
    { title: 'Air receiver drain and inspection', days: M, type: 'visual' },
    { title: 'Safety valves test', days: Y, type: 'safety' },
  ] },
  { key: 'heat_exchangers', dept: 'engineering', label: 'Heat exchangers and coolers', counter: false, jobs: [
    { title: 'Cleaning (plate / tube)', days: Y, type: 'maintenance' },
    { title: 'Zinc anodes renewal', days: H, type: 'maintenance' },
    { title: 'Performance check: temperatures in / out', days: M, type: 'performance' },
  ] },
  { key: 'fwg', dept: 'engineering', label: 'Fresh water generator (evaporator)', counter: true, jobs: [
    { title: 'Cleaning / descaling', days: Q, type: 'maintenance' },
    { title: 'Salinometer check and calibration', days: M, type: 'calibration' },
    { title: 'Ejector and pump check', days: H, type: 'maintenance' },
  ] },
  { key: 'ows', dept: 'engineering', label: 'Oily water separator and 15 ppm alarm', counter: false, jobs: [
    { title: '15 ppm alarm and automatic stop test', days: M, type: 'safety' },
    { title: '15 ppm monitor calibration (certificate)', days: 5 * Y, type: 'calibration' },
    { title: 'Coalescer / filter elements', days: H, type: 'maintenance' },
  ] },
  { key: 'steering_merchant', dept: 'engineering', label: 'Steering gear (merchant)', counter: false, critical: true, jobs: [
    { title: 'Hydraulic oil level, leaks, linkages', days: W, type: 'visual' },
    { title: 'Steering gear test before departure', days: 1, type: 'performance' },
    { title: 'Emergency steering drill', days: Q, type: 'safety' },
    { title: 'Hydraulic oil analysis', days: Y, type: 'measurement' },
    { title: 'Motor insulation resistance', days: H, type: 'megger' },
  ] },
  { key: 'reefer', dept: 'engineering', label: 'Provision refrigeration and air conditioning plant', counter: true, jobs: [
    { title: 'Refrigerant leak check', days: M, type: 'safety' },
    { title: 'Compressor oil and filters', hours: 4000, type: 'maintenance' },
    { title: 'Condenser and evaporator cleaning', days: H, type: 'maintenance' },
    { title: 'Room temperatures and alarms check', days: W, type: 'performance' },
  ] },
  { key: 'mooring_merchant', dept: 'deck', label: 'Windlass and mooring winches (merchant)', counter: false, jobs: [
    { title: 'Lubrication (gears, bearings, brakes)', days: M, type: 'maintenance' },
    { title: 'Brake holding capacity test', days: Y, type: 'performance' },
    { title: 'Anchor chain and stoppers inspection', days: Y, type: 'visual' },
    { title: 'Mooring lines and wires inspection', days: M, type: 'visual' },
  ] },
  { key: 'cargo_cranes', dept: 'deck', label: 'Cargo cranes and derricks', counter: true, jobs: [
    { title: 'Wire ropes inspection and lubrication', days: M, type: 'maintenance' },
    { title: 'Limit switches and safety devices test', days: M, type: 'safety' },
    { title: 'Slewing bearing and hydraulics check', hours: 500, type: 'maintenance' },
    { title: 'Thorough examination (competent person)', days: Y, type: 'visual' },
    { title: 'Load test', days: 5 * Y, type: 'performance' },
  ] },
  { key: 'hatch_covers', dept: 'deck', label: 'Hatch covers', counter: false, jobs: [
    { title: 'Rubber seals and compression bars', days: Q, type: 'visual' },
    { title: 'Hydraulic system: oil, hoses, cylinders', days: Q, type: 'maintenance' },
    { title: 'Cleats and wedges', days: H, type: 'maintenance' },
    { title: 'Hose (water-tightness) test', days: Y, type: 'performance' },
  ] },
  { key: 'holds_tanks', dept: 'hull', label: 'Ballast tanks and cargo holds', counter: false, jobs: [
    { title: 'Coating and structure inspection', days: Y, type: 'visual' },
    { title: 'Anodes in ballast tanks', days: 2 * Y + 6 * M, type: 'visual' },
    { title: 'Bilge wells and sounding pipes', days: Q, type: 'maintenance' },
  ] },
  { key: 'closures', dept: 'deck', label: 'Air pipes, sounding pipes, watertight doors, portholes', counter: false, jobs: [
    { title: 'Air pipe heads (floats, gauzes)', days: Q, type: 'visual' },
    { title: 'Watertight doors operation and seals', days: W, type: 'safety' },
    { title: 'Portholes and deadlights', days: Q, type: 'visual' },
  ] },
  { key: 'ladders', dept: 'deck', label: 'Accommodation ladder, pilot ladder, railings', counter: false, jobs: [
    { title: 'Pilot ladder inspection (SOLAS V/23)', days: M, type: 'visual' },
    { title: 'Accommodation ladder and winch', days: M, type: 'maintenance' },
    { title: 'Accommodation ladder load test', days: 5 * Y, type: 'performance' },
    { title: 'Railings and lifelines', days: Q, type: 'visual' },
  ] },
  { key: 'lsa_ffe_merchant', dept: 'safety', label: 'LSA and FFE (merchant)', counter: false, critical: true, jobs: [
    { title: 'Lifeboats inspection; lifeboat engine run', days: W, type: 'safety' },
    { title: 'Emergency generator and emergency fire pump test', days: W, type: 'performance' },
    { title: 'Fire extinguishers, hoses and hydrants', days: M, type: 'visual' },
    { title: 'Breathing apparatus (BA sets)', days: M, type: 'safety' },
    { title: 'Emergency lighting', days: M, type: 'safety' },
    { title: 'Liferafts and hydrostatic releases service', days: Y, type: 'maintenance' },
    { title: 'Davits, winches and release gear (annual examination)', days: Y, type: 'safety' },
    { title: 'Fixed fire-fighting systems service', days: Y, type: 'maintenance' },
    { title: 'Lifeboat davits load test; on-load release', days: 5 * Y, type: 'performance' },
    { title: 'Cylinders hydrostatic test', days: 5 * Y, type: 'performance' },
  ] },
  { key: 'electrical_merchant', dept: 'engineering', label: 'Electrical and automation (merchant)', counter: false, jobs: [
    { title: 'Insulation resistance: motors and networks', days: Q, type: 'megger' },
    { title: 'Main and emergency switchboards: inspection, tighten connections', days: Y, type: 'maintenance' },
    { title: 'Batteries: electrolyte density and voltage', days: W, type: 'measurement' },
    { title: 'Main engine and boiler alarms and protections test', days: Q, type: 'safety' },
    { title: 'Fire detection, sensors and general alarm test', days: W, type: 'safety' },
    { title: 'Navigation lights check', days: 1, type: 'visual' },
  ] },
  { key: 'nav_merchant', dept: 'bridge', label: 'Navigation and GMDSS (merchant)', counter: false, jobs: [
    { title: 'GMDSS, EPIRB and SART tests', days: M, type: 'performance' },
    { title: 'Gyro, magnetic compass, radar, echo sounder, log check', days: M, type: 'performance' },
    { title: 'Compass deviation (swing)', days: Y, type: 'calibration' },
    { title: 'VDR annual performance test', days: Y, type: 'performance' },
    { title: 'EPIRB shore-based maintenance', days: 5 * Y, type: 'maintenance' },
  ] },
];

export function catalogueFor(dept: Dept): CatalogueSystem[] {
  return CATALOGUE.filter((c) => c.dept === dept);
}
