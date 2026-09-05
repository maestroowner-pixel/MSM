// ===================================
// Downscale a photo before it is stored.
//
// WHY THIS EXISTS. `expo-image-picker`'s `quality` option sets JPEG compression
// and NOTHING ELSE — the image keeps its full sensor resolution. A modern phone
// therefore hands us a 12-megapixel frame at quality 0.7, which is 2–3 MB, and
// the app was storing that as-is.
//
// The money is not Google's. Cloud Storage would charge single-digit dollars a
// month for a hundred vessels either way. The bill that hurts is the ship's own:
// these files leave the vessel over VSAT or Iridium, where a megabyte is priced
// like a phone call, and 40 photos a month at 2.5 MB is 100 MB of satellite
// airtime. Downscaling to 1600px on the long edge is roughly an eightfold cut in
// what crosses that link — and for a photograph of a pressure gauge or a cracked
// bracket, 1600px is not a compromise: nobody is printing it, they are looking
// to see the defect.
//
// It also shrinks the `.msm` backup, which embeds every photo as base64.
//
// Failure is never fatal. If resizing throws — an odd format, a platform without
// the native module — the ORIGINAL is used. A slightly expensive photo on file
// beats a crew member who could not attach evidence.
// ===================================

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Long edge, in pixels. 1600 keeps a legible gauge face and readable serial
 * plate while landing most photos between 200 and 450 KB.
 */
export const MAX_EDGE = 1600;

/** JPEG quality for the re-encode. 0.75 is past the point of visible artefacts
 *  on photographs of equipment, and well below the size of 0.9. */
const QUALITY = 0.75;

/**
 * Return a downscaled copy of `uri`, or the original uri when it is already
 * small enough or anything goes wrong.
 *
 * Only images: pass documents straight through (the caller knows which it has).
 */
export async function downscale(uri: string): Promise<string> {
  try {
    // Measure first. Resizing by width alone would UPSCALE an already-small
    // image to 1600px — more bytes than we started with, for no more detail.
    const measured = await ImageManipulator.manipulate(uri).renderAsync();
    const { width, height } = measured;
    if (!width || !height) return uri;
    if (Math.max(width, height) <= MAX_EDGE) return uri;

    // Constrain the LONG edge. Passing `width` on a portrait photo would set its
    // SHORT edge to 1600 and leave the long one at ~2130 — bigger than asked for.
    const target = width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };

    const image = await ImageManipulator.manipulate(uri).resize(target).renderAsync();
    const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: QUALITY });
    return result.uri || uri;
  } catch {
    return uri;
  }
}
