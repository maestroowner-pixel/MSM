import { doc as fsDoc, getDoc as fsGetDoc, setDoc as fsSetDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebaseApp, firestoreDb, currentVesselKey } from './firebaseService';

const ROOT = 'safety_vessels';
const REGION = 'europe-west1';

export interface EmailReportSettings {
  enabled: boolean;
  recipients: string[];
  lastSentAt?: number;
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

export async function sendReportNow(vessel: string): Promise<void> {
  const app = firebaseApp();
  if (!app) throw new Error('Firebase not initialised.');
  await httpsCallable<{ vessel: string }, { ok: boolean }>(
    getFunctions(app, REGION),
    'sendReportNow'
  )({ vessel });
}
