// ===================================
// DP drill theory — the briefing read before a DP drill (13 Nov 2026). Written
// here, not in drillTheory.ts: that file is regenerated from the Drill Trainer app,
// which has no DP topics. Our own wording on general DP practice; the vessel's
// DPOM, FMEA and ASOG decide what is done. English: the working language on board.
// ===================================

import { DRILL_THEORY, DrillTheory } from './drillTheory';

const COMMON = 'Most DP drills on this vessel are desktop exercises: with operations running, nothing is switched off — the scenario is talked through on the bridge and in the ECR, and hands are put on the controls where it is safe. A desktop drill counts as a DP drill. When the vessel is setting up or off DP, the same scenario may be run live, if the Master agrees it is safe. A drill is for learning, not a trial of the system: say what you see, say what you would do, and say it out loud.';

export const DP_DRILL_THEORY: Record<string, DrillTheory> = {
  dpUps: {
    title: 'Loss of main DP system UPS',
    text: [
      COMMON,
      'The UPS feeds the DP controllers, operator stations, network, references and sensors. Its loss should be survivable on a redundant system — the drill checks that everyone knows what goes dark with it and what remains.',
      'Know how long each UPS lasts on battery, what each one feeds, and who restores the supply. A UPS on battery is a countdown. Bring equipment back on line and check it before it is reselected into DP.',
      'IMCA M273, Appendix A, is the reference for this drill.',
    ],
  },
  dpAutoManual: {
    title: 'Auto / manual — human intervention',
    text: [
      COMMON,
      'Switching essential DP equipment to local or manual — a thruster, an engine, a controller, a seawater pump — takes it out of the DP system\'s hands while the vessel is in auto DP. Done without the bridge knowing, it has caused DP incidents.',
      'The drill shows what happens and what the alarm looks like. Run live only in safe open water, with no risk of excessive excursion; otherwise as a desktop exercise.',
      'Agree the rule: nobody switches DP equipment to local without the DPO\'s agreement, except in an emergency — and then the bridge is told at once.',
    ],
  },
  dpDriftOff: {
    title: 'Consequence analysis — drift-off (DP2 / DP3)',
    text: [
      COMMON,
      'The consequence analysis looks at what would remain after the worst single failure and warns when that would not hold the vessel. Treat its warning as a status change in the ASOG, not as a nuisance alarm.',
      'Live, with the vessel on full auto DP and the analysis active, thrusters are deselected by redundant group (or generators on one bus shut down, the vessel beam on to the weather) until the drift-off warning appears. Wait several minutes between steps: the warning often comes with a delay.',
      'Talk through what the remaining thrust can hold, what the ASOG asks for, and which way is safe to move off.',
    ],
  },
  dpBlackout: {
    title: 'Recovery from a full blackout',
    text: [
      COMMON,
      'A blackout is run as a workshop on the bridge and in the ECR, unless a safe, manageable situation for a live test presents itself.',
      'Talk through: the first reaction on blackout; how it could be triggered on this vessel; whether people are directly at risk and have a clear escape route; how power comes back — standby generator, the order the buses are restored; and whether thrusters come back into DP control automatically or must be selected by hand.',
      'Close with what the FMEA and the ASOG say, and what to change.',
    ],
  },
  dpRefLoss: {
    title: 'Loss of all position references',
    text: [
      COMMON,
      'With no position reference data the DP control system keeps position on its model (dead reckoning) — for a short time only, and drifting. This is red in any ASOG.',
      'Stop the operation and make it safe, take the vessel on joystick or manual if position cannot be kept, and bring the references back one at a time, checking them against each other before auto DP again.',
      'Talk through which references this vessel has, what each depends on (power, network, a target, a transponder) and what could take them all out at once.',
    ],
  },
  dpRedGroup: {
    title: 'Loss of one redundant group',
    text: [
      COMMON,
      'A DP2 or DP3 vessel is designed to keep position after losing its worst-case redundant group — its thrusters, generators and auxiliaries together. The drill checks that the crew recognises it and acts as the ASOG says.',
      'State the status, tell the client or the work site, decide whether the operation continues or stops, and recover the group. Check what the FMEA describes as the worst-case failure.',
    ],
  },
  dpCooling: {
    title: 'Loss of seawater cooling pump redundancy',
    text: [
      COMMON,
      'Losing a standby seawater cooling pump changes nothing at first — and leaves one failure between the vessel and losing a redundant group. Loss of redundancy is a status change in most ASOGs.',
      'The engineers say what the pump cools and which group is exposed; the bridge sets the status and tells the client or the work site; the pump is restored or the standby lined up.',
    ],
  },
  dpDriveOff: {
    title: 'Drive-off from position',
    text: [
      COMMON,
      'A drive-off is the vessel pushed off position by its own thrust — a thruster running away, a wrong reference or sensor, a wrong command. It is fast, and DP may keep applying the wrong thrust.',
      'Recognise it (error growing with high thrust), declare red per the ASOG and tell the client or the work site to stop. Find the faulty thruster and take it out — deselect it, the emergency stop if it will not stop. Another option is the thruster in local control in the thruster room.',
      'Every DPO must know where each emergency stop is without looking. In the debrief: was the DP emergency procedure followed, did the equipment react as expected, how quickly was red called?',
    ],
  },
  dpThrustFull: {
    title: 'Thruster failure to full thrust',
    text: [
      COMMON,
      'A thruster failing to full thrust drives the vessel off unless it is recognised and stopped. The aim is to get back to a controllable condition.',
      'Run live only in safe open water with no risk of excessive excursion. Recognise it — feedback not following command — deselect and stop the thruster, regain control on the rest, then check it locally.',
    ],
  },
};

/** The briefing for a drill type — the Drill Trainer topics and the DP ones. */
export const theoryOf = (type: string): DrillTheory | undefined => DRILL_THEORY[type] ?? DP_DRILL_THEORY[type];
