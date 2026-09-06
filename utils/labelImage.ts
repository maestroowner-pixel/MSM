// ===================================
// Label → PNG. Native stub.
//
// Rasterising happens in a browser (see labelImage.web.ts). On a phone the PDF
// route already exists and every printer app takes a PDF, so there is nothing to
// fall back to here — the UI asks `canSaveLabelsPng` before offering the button
// rather than showing one that explains itself only after being pressed.
// ===================================

export const canSaveLabelsPng = false;

export async function saveLabelsPng(
  _html: string,
  _widthMm: number,
  _heightMm: number,
  _fileName: string,
  _dpi?: number
): Promise<void> {
  throw new Error('Saving labels as an image is available in the browser build.');
}
