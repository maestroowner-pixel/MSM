// ===================================
// The ID card photo, edited in the browser (17 Oct 2026: "remove the background
// straight away, or brightness / contrast / saturation").
//
//   adjust     brightness, contrast, saturation — the canvas's own filters.
//   background the person cut out with MediaPipe's selfie segmenter (Google,
//              made for head-and-shoulders pictures) and set on a plain light
//              background, as on a document photo. It runs on this computer:
//              the picture is not sent anywhere. The library and its model
//              (a few MB) load from the CDN on first use, as pdf.js does
//              (utils/pdfText.web.ts) — an office computer is online.
// ===================================

const VER = '0.10.14';
const LIB = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite';
/** The plain background put behind the person. */
export const PHOTO_BG = '#EEF2F6';

export interface Adjust {
  brightness: number; // 1 = as taken
  contrast: number;
  saturation: number;
}
export const NO_ADJUST: Adjust = { brightness: 1, contrast: 1, saturation: 1 };

export const canEditPhotos = () => typeof document !== 'undefined';

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('The picture could not be read.'));
    im.src = src;
  });
}

let segmenter: Promise<any> | null = null;
/** MediaPipe's image segmenter, loaded once. */
function getSegmenter(): Promise<any> {
  if (segmenter) return segmenter;
  segmenter = (async () => {
    // A module script that hands the library to the page (Metro does not bundle remote imports).
    const g: any = globalThis as any;
    if (!g.__mpVision) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.type = 'module';
        s.textContent = `import * as v from '${LIB}/vision_bundle.mjs'; window.__mpVision = v; window.dispatchEvent(new Event('mp-vision'));`;
        const t = setTimeout(() => reject(new Error('The background tool could not be loaded — is this computer online?')), 30000);
        window.addEventListener('mp-vision', () => { clearTimeout(t); resolve(); }, { once: true });
        document.head.appendChild(s);
      });
    }
    const v = g.__mpVision;
    const files = await v.FilesetResolver.forVisionTasks(`${LIB}/wasm`);
    return v.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
  })().catch((e) => {
    segmenter = null;
    throw e;
  });
  return segmenter;
}

/**
 * The photo with the adjustments, and — when `cutout` — the person on the plain
 * background. Returns a JPEG data: URI the size of the source.
 */
export async function renderPhoto(src: string, a: Adjust, cutout: boolean): Promise<string> {
  const im = await load(src);
  const W = im.naturalWidth;
  const H = im.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.filter = `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturation})`;
  g.drawImage(im, 0, 0);
  g.filter = 'none';
  if (cutout) {
    const seg = await getSegmenter();
    const res = seg.segment(im);
    const mask: Float32Array = res.confidenceMasks[0].getAsFloat32Array();
    const mw = res.confidenceMasks[0].width;
    const mh = res.confidenceMasks[0].height;
    const px = g.getImageData(0, 0, W, H);
    const bg = [parseInt(PHOTO_BG.slice(1, 3), 16), parseInt(PHOTO_BG.slice(3, 5), 16), parseInt(PHOTO_BG.slice(5, 7), 16)];
    for (let y = 0; y < H; y++) {
      const my = Math.min(mh - 1, Math.floor((y * mh) / H));
      for (let x = 0; x < W; x++) {
        const mx = Math.min(mw - 1, Math.floor((x * mw) / W));
        // The selfie model gives the PERSON's confidence; soften the edge a little.
        const p = Math.max(0, Math.min(1, (mask[my * mw + mx] - 0.25) / 0.5));
        const i = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) px.data[i + c] = Math.round(px.data[i + c] * p + bg[c] * (1 - p));
      }
    }
    g.putImageData(px, 0, 0);
    res.close?.();
  }
  return cv.toDataURL('image/jpeg', 0.85);
}
