// What a toolbox meeting goes through before a permitted job starts — the usual
// shipboard toolbox talk (Code of Safe Working Practices, company SMS forms).
import { tk } from '../utils/t';

export const TOOLBOX_TOPICS: { id: string; text: string }[] = [
  { id: 'scope', text: 'The job, its steps and who does what' },
  { id: 'hazards', text: 'Hazards from the risk assessment and their controls' },
  { id: 'permit', text: 'Permit conditions, precautions and isolations in place' },
  { id: 'ppe', text: 'PPE for the job' },
  { id: 'tools', text: 'Tools and equipment, checked' },
  { id: 'comms', text: 'Communication and signals' },
  { id: 'emergency', text: 'Emergency: alarm, escape, rescue, first aid' },
  { id: 'stop', text: 'Anyone may stop the job if it is unsafe' },
  { id: 'ops', text: 'Vessel operations, weather or sea state affecting the job' },
  { id: 'questions', text: 'Questions from the team answered' },
];

/** The topic in the interface language, for the screen; the permit report keeps `text`. */
export const toolboxText = (x: { id: string; text: string }) => tk(`tb.${x.id}`);
