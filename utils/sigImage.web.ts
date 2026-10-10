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
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.stroke(new Path2D(path));
    return cv.toDataURL('image/png');
  } catch {
    return null;
  }
}
