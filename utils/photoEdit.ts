// Native stub for utils/photoEdit.web.ts — the photo is edited on the computer that prints the cards.
export const PHOTO_BG = '#EEF2F6';
export interface Adjust {
  brightness: number;
  contrast: number;
  saturation: number;
}
export const NO_ADJUST: Adjust = { brightness: 1, contrast: 1, saturation: 1 };
export const canEditPhotos = () => false;
export async function renderPhoto(src: string, _a: Adjust, _cutout: boolean): Promise<string> {
  return src;
}
