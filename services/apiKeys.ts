// ===================================
// The Master's keys to the vessel's API (functions/api.js, 28 Oct 2026).
// Issued and revoked by the server — the key exists in clear only in the reply
// to `issueApiKey`, shown once; the vessel keeps its hash.
// ===================================

import { getFunctions, httpsCallable } from 'firebase/functions';
import * as fb from './firebaseService';

const REGION = 'europe-west1';

function callable<Q, A>(name: string) {
  const app = fb.firebaseApp();
  if (!app) throw new Error('Firebase is not configured.');
  return httpsCallable<Q, A>(getFunctions(app, REGION), name);
}

export async function issueApiKey(label: string, write: boolean): Promise<{ key: string; keyId: string }> {
  const r = await callable<{ label: string; write: boolean }, { key: string; keyId: string }>('apiKeyCreate')({ label, write });
  return r.data;
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await callable<{ keyId: string }, { ok: boolean }>('apiKeyRevoke')({ keyId });
}

/** A ready-to-run example for whoever sets up the integration. */
export function curlExample(key: string): string {
  return `curl -H "Authorization: Bearer ${key}" ${fb.API_BASE_URL}/v1/due?days=90`;
}
