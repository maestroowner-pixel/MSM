// ===================================
// Starter risk assessments for a yacht — the jobs done every season. Copied into
// the vessel's library on first use and edited there; they are a starting point
// written to common practice (COSWP, IMO A.1050), not the vessel's own judgement.
// L = likelihood, S = severity (1–5); r = with the controls in place.
// ===================================

import { Hazard } from '../types/permits';

type H = Omit<Hazard, 'id'>;
const h = (hazard: string, consequence: string, L: number, S: number, controls: string, rL: number, rS: number): H => ({
  hazard, consequence, likelihood: L, severity: S, controls, residualLikelihood: rL, residualSeverity: rS,
});

export const RISK_LIBRARY: { key: string; title: string; task: string; hazards: H[] }[] = [
  {
    key: 'enclosed', title: 'Enclosed space entry', task: 'Entry into tanks, voids, cofferdams, chain locker',
    hazards: [
      h('Oxygen-deficient or toxic atmosphere', 'Asphyxiation, death', 3, 5, 'Ventilate; test O₂/LEL/H₂S/CO at all levels; re-test regularly; permit to work', 1, 5),
      h('Flammable atmosphere', 'Fire / explosion', 2, 5, 'Gas free; intrinsically safe lights and tools; no ignition sources', 1, 5),
      h('Collapse of entrant', 'Delayed rescue', 2, 5, 'Attendant at entrance; comms; rescue SCBA, harness, lifeline ready; rescue drill done', 1, 4),
      h('Slips and falls on ladders', 'Fracture', 3, 3, 'Three points of contact; lighting; clean footwear', 2, 2),
    ],
  },
  {
    key: 'hot', title: 'Hot work (welding, cutting, grinding)', task: 'Hot work outside the workshop',
    hazards: [
      h('Fire from sparks and heat', 'Fire on board', 3, 5, 'Clear combustibles; check other side; fire watch with extinguisher; 30 min watch after', 1, 4),
      h('Fumes', 'Respiratory harm', 3, 3, 'Ventilation / extraction; respirator', 1, 2),
      h('Burns and arc eye', 'Injury', 3, 3, 'Welding PPE; screens', 1, 2),
      h('Gas cylinders', 'Explosion', 1, 5, 'Secured upright; flashback arrestors; leak test', 1, 4),
    ],
  },
  {
    key: 'height', title: 'Working aloft and overside', task: 'Mast, radar arch, hull sides from staging or chair',
    hazards: [
      h('Fall from height', 'Major injury, death', 3, 5, 'Harness clipped on at all times; inspected gear; competent person; calm weather', 1, 4),
      h('Falling tools or objects', 'Injury to people below', 3, 4, 'Tool lanyards; area below barricaded', 1, 3),
      h('Fall overside into water', 'Drowning', 2, 5, 'Lifejacket; lifebuoy with line; tender standby; vessel stopped', 1, 4),
      h('Radar / radio emissions', 'RF burns', 2, 4, 'Radar and transmitters isolated and tagged', 1, 3),
    ],
  },
  {
    key: 'mooring', title: 'Mooring and anchoring operations', task: 'Berthing, unberthing, anchoring',
    hazards: [
      h('Snap-back of parting line', 'Major injury, death', 2, 5, 'Stay out of snap-back zones; inspect lines; brief the team', 1, 4),
      h('Hands caught in winch, capstan or fairlead', 'Crush injury, amputation', 3, 4, 'No gloves near drums; one person in charge; clear communication', 1, 3),
      h('Chain run-out at anchoring', 'Injury', 2, 4, 'Brake and stopper checked; stand clear of chain', 1, 3),
    ],
  },
  {
    key: 'tender', title: 'Tender launch and recovery', task: 'Crane / davit launch and recovery of the tender',
    hazards: [
      h('Load swing or drop', 'Crush, major injury', 2, 5, 'Crane inspected and certified; tag lines; nobody under the load; signaller', 1, 4),
      h('Fall between tender and yacht', 'Drowning, crush', 2, 4, 'Lifejackets; calm sea limits; boarding only when secured', 1, 3),
      h('Hook release failure', 'Tender dropped', 1, 5, 'Hook inspected; release tested; weight within SWL', 1, 4),
    ],
  },
  {
    key: 'bunkering', title: 'Bunkering', task: 'Taking fuel alongside or from a truck',
    hazards: [
      h('Oil spill', 'Pollution, fine', 3, 4, 'SOPEP kit ready; scuppers plugged; tank soundings; agreed rates and signals', 1, 3),
      h('Fire', 'Fire on board', 2, 5, 'No smoking / hot work; extinguishers ready; earth bonding', 1, 4),
      h('Hose failure', 'Spill, injury', 2, 4, 'Hoses inspected and certified; supported; watch kept', 1, 3),
    ],
  },
];
