// ===================================
// A page of a PDF as a picture, in the browser (utils/pdfPage.ts for phones):
// pdf.js from cdnjs (utils/pdfText.web.ts) draws it on a canvas, kept as a
// JPEG data: URI like any photo picked on the web. Null when pdf.js cannot load
// (offline, blocked) or the file is not a PDF it can read.
// ===================================

import { pdfjs } from './pdfText';

export const PAGE_EDGE = 2400;

export interface PageImage {
  uri: string;
  width: number;
  height: number;
}

export interface OpenedPdf {
  pages: number;
  render(n: number): Promise<PageImage>;
}

function bytesOf(dataUri: string): Uint8Array {
  const bin = atob(dataUri.slice(dataUri.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function openPdf(uri: string): Promise<OpenedPdf | null> {
  try {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: bytesOf(uri) }).promise;
    if (!doc.numPages) return null;
    const render = async (n: number): Promise<PageImage> => {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: PAGE_EDGE / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width);
      canvas.height = Math.round(vp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      return { uri: canvas.toDataURL('image/jpeg', 0.8), width: canvas.width, height: canvas.height };
    };
    return { pages: doc.numPages, render };
  } catch {
    return null;
  }
}

/** A data: URI needs no copy. */
export async function keepPage(uri: string): Promise<string> {
  return uri;
}
