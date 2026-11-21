// The browser's half of services/manualFile.ts: the file's bytes come from the
// browser's own picker; a device on no vessel keeps it as a data URI in the record,
// so there the old 12 MB stays (the whole machine list is rewritten on each save).

import { pickBinaryFileWeb } from '../utils/webFile';

export interface PickedManual {
  name: string;
  size: number;
  mime: string;
  uri: string;
  bytes?: ArrayBuffer;
}

export const MANUAL_MAX = 200 * 1024 * 1024;
export const MANUAL_MAX_LOCAL = 12 * 1024 * 1024 - 1;

export async function pickManual(): Promise<PickedManual | null> {
  const f = await pickBinaryFileWeb('.pdf,application/pdf,image/*');
  if (!f?.bytes) return null;
  const ext = f.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : /^(jpe?g)$/.test(ext) ? 'image/jpeg' : 'application/octet-stream';
  return { name: f.name, size: f.bytes.byteLength, mime, uri: '', bytes: f.bytes };
}

export async function manualBlob(p: PickedManual): Promise<Blob> {
  return new Blob([p.bytes!], { type: p.mime });
}

export async function keepManualLocally(p: PickedManual): Promise<string> {
  const blob = await manualBlob(p);
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
