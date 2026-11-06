import { deleteField, doc as fsDoc, getDoc as fsGetDoc, setDoc as fsSetDoc, updateDoc as fsUpdateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp, firestoreDb, currentVesselKey } from './firebaseService';

const ROOT = 'safety_vessels';
const REGION = 'europe-west1';

export interface EmailReportSettings {
  enabled: boolean;
  recipients: string[];
  lastSentAt?: number;
  /** The Master's note: goes with the next digest — one written after the last was sent (functions/emailReport.js). */
  note?: EmailReportNote;
}

export interface EmailReportNote {
  text: string;
  /** The month it speaks of, yyyy-mm. */
  month: string;
  by: string;
  at: number;
  /** Drafted by the AI (services/briefAi.ts) and edited by the Master. */
  ai?: boolean;
}

export async function getEmailReportSettings(): Promise<EmailReportSettings | null> {
  const uid = await currentVesselKey();
  if (!uid) return null;
  const snap = await fsGetDoc(fsDoc(firestoreDb(), ROOT, uid));
  if (!snap.exists()) return null;
  const er = (snap.data() as any).emailReport;
  if (!er) return { enabled: false, recipients: [] };
  return {
    enabled: !!er.enabled,
    recipients: Array.isArray(er.recipients) ? er.recipients : [],
    lastSentAt: er.lastSentAt ?? undefined,
    note: er.note?.text ? er.note : undefined,
  };
}

export async function saveEmailReportSettings(settings: EmailReportSettings): Promise<void> {
  const uid = await currentVesselKey();
  if (!uid) throw new Error('Not connected to a vessel.');
  await fsSetDoc(
    fsDoc(firestoreDb(), ROOT, uid),
    { emailReport: { enabled: settings.enabled, recipients: settings.recipients } },
    { merge: true }
  );
}

/** The note alone; null takes it off the next digest. */
export async function saveEmailReportNote(note: EmailReportNote | null): Promise<void> {
  const uid = await currentVesselKey();
  if (!uid) throw new Error('Not connected to a vessel.');
  await fsUpdateDoc(fsDoc(firestoreDb(), ROOT, uid), { 'emailReport.note': note ?? deleteField() });
}

/** Whether the note will go with the next digest: written after the last one was sent. */
export const notePending = (s: EmailReportSettings) => !!s.note && s.note.at > (s.lastSentAt ?? 0);

export async function sendReportNow(vessel: string): Promise<void> {
  const app = firebaseApp();
  if (!app) throw new Error('Firebase not initialised.');
  await httpsCallable<{ vessel: string }, { ok: boolean }>(
    getFunctions(app, REGION),
    'sendReportNow'
  )({ vessel });
}
