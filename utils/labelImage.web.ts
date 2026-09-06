// ===================================
// Label → PNG, in the browser.
//
// WHY AN IMAGE AT ALL. A PDF sized to the roll is the exact answer for a phone:
// every printer app takes one and lays it down 1:1. The browser build cannot make
// one for labels (expo-print's printToFileAsync has no web implementation), and a
// desk machine is precisely where somebody sits with a thermal printer from
// another maker and its own driver app. An image is the one format every such app
// accepts, so this closes the gap without asking anyone to buy our printer.
//
// RESOLUTION IS THE WHOLE POINT. CSS millimetres are rendered at 96 dpi, which
// puts a 50 mm label at 189 px — enough on screen, useless on a thermal head
// where a QR module would land on a fraction of a dot and scan as mush. The scale
// factor turns those CSS pixels into real ones: 300 dpi is the floor for a
// scannable code, 600 the safe default for small stock. The PNG carries its size
// in millimetres in the file name, because an image file has no page size and the
// receiving app has to be told what to print it at.
//
// html2canvas is already a dependency (the web PDF path uses it) — no new weight.
// ===================================

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any */

const g: any = globalThis as any;

/** CSS renders a millimetre at 96 dpi. Everything else is a multiple of that. */
const CSS_DPI = 96;

export const canSaveLabelsPng = true;

/**
 * Render label HTML to a PNG and hand it to the browser as a download.
 *
 * The HTML is the SAME document that drives printing, mounted off-screen rather
 * than rebuilt — a second renderer would be a second thing to keep in step, and
 * the one thing worse than a label that prints wrong is a preview that disagrees
 * with it.
 */
export async function saveLabelsPng(
  html: string,
  widthMm: number,
  heightMm: number,
  fileName: string,
  dpi = 600
): Promise<void> {
  const doc = g.document;
  if (!doc) throw new Error('No document to render into.');

  const html2canvas = require('html2canvas').default ?? require('html2canvas');

  // Off-screen, but REAL: html2canvas measures what the browser laid out, so the
  // node has to be in the document and visible to layout. Parked off to the left
  // rather than hidden with display:none, which would give it no size at all.
  const host = doc.createElement('div');
  host.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${widthMm}mm;height:${heightMm}mm;` +
    'background:#fff;overflow:hidden;';
  // The print document carries its own <style>; innerHTML keeps it with the body.
  host.innerHTML = html;
  doc.body.appendChild(host);

  try {
    // Give webfonts and the inline SVG QR a frame to settle before capture.
    await new Promise((r) => g.requestAnimationFrame?.(r) ?? setTimeout(r, 32));
    if (doc.fonts?.ready) await doc.fonts.ready.catch(() => {});

    const canvas = await html2canvas(host, {
      scale: dpi / CSS_DPI,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
    });

    const dataUrl: string = canvas.toDataURL('image/png');
    const b64 = dataUrl.split(',')[1] ?? '';
    if (!b64) throw new Error('The label rendered empty.');

    const bin = g.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new g.Blob([bytes], { type: 'image/png' });
    const url = g.URL.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = fileName;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    g.setTimeout(() => g.URL.revokeObjectURL(url), 1500);
  } finally {
    host.remove();
  }
}
