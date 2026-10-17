// A hand-drawn signature (SVG path, 300 × 100 — components/SignaturePad) painted
// onto a canvas, as a PNG data URL for jsPDF. Browser only; phones print HTML
// with the path inline instead.
const W = 300;
const H = 100;
export function sigImage(path: string): string | null {
  try {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d');
    if (!g) return null;
    g.strokeStyle = '#0B2545';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // Fitted to the signature itself (17 Oct 2026): a small signature in a big
    // pad printed as a squiggle in an empty cell. The path's own box is scaled
    // to fill the image, keeping its shape.
    const pts = (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    const xs = pts.filter((_, i) => i % 2 === 0);
    const ys = pts.filter((_, i) => i % 2 === 1);
    if (xs.length > 1) {
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const pad = 8;
      const k = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1), (H - 2 * pad) / Math.max(y1 - y0, 1), 4);
      g.translate((W - (x1 - x0) * k) / 2 - x0 * k, (H - (y1 - y0) * k) / 2 - y0 * k);
      g.scale(k, k);
      g.lineWidth = 3 / k;
    } else g.lineWidth = 3;
    g.stroke(new Path2D(path));
    return cv.toDataURL('image/png');
  } catch {
    return null;
  }
}
