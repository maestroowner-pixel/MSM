// ===================================
// Make a PDF smaller in the browser (13 Oct 2026: the written medical advice
// attached to the medical log, "compressed"). A scanned or photographed advice
// is mostly images at full camera resolution; each page is drawn again with
// pdf.js at about 120 dpi and kept as a JPEG at quality 0.6, then put back
// together with jsPDF, page size as it was. The text becomes part of the
// picture — fine for a document to be read, not edited.
//
// Returns null when it cannot (pdf.js not loaded, a page fails) or when the
// result is not smaller — the caller then keeps the original.
// ===================================

/* eslint-disable @typescript-eslint/no-var-requires */
import { pdfjs } from './pdfText';

const SCALE = 120 / 72;
const QUALITY = 0.6;

export async function compressPdf(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const lib = await pdfjs();
    const src = await lib.getDocument({ data: bytes.slice() }).promise;
    const { jsPDF } = require('jspdf');
    let out: any = null;
    for (let p = 1; p <= src.numPages; p++) {
      const page = await src.getPage(p);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: SCALE });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const jpg = canvas.toDataURL('image/jpeg', QUALITY);
      const w = base.width;
      const h = base.height;
      const orientation = w > h ? 'landscape' : 'portrait';
      if (!out) out = new jsPDF({ unit: 'pt', format: [w, h], orientation, compress: true });
      else out.addPage([w, h], orientation);
      out.addImage(jpg, 'JPEG', 0, 0, w, h);
    }
    if (!out) return null;
    const result = new Uint8Array(out.output('arraybuffer'));
    return result.length < bytes.length ? result : null;
  } catch {
    return null;
  }
}
