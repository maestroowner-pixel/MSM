// ===================================
// A page of a PDF as a picture, on the phone — the deck of a GA plan
// (screens/GaPlanSc.tsx). Drawn by the system (PDFKit / PdfRenderer) through
// the local module modules/pdf-page, so it works at sea without a connection.
// A build without the module (2.74 and older) gets null: the caller says a PDF
// cannot be used here and asks for a picture.
// Browser: utils/pdfPage.web.ts (pdf.js).
// ===================================

import PdfPage from '../modules/pdf-page';
import { persist } from '../services/attachments';

/** Long edge of a rendered page. More than a photo's 1600 (services/images.ts):
 *  a deck is a drawing read zoomed in, and it is sent once, not every month. */
export const PAGE_EDGE = 2400;

export interface PageImage {
  uri: string;
  width: number;
  height: number;
}

export interface OpenedPdf {
  pages: number;
  /** Page `n` (1-based) as a JPEG. Throws if it cannot be drawn. */
  render(n: number): Promise<PageImage>;
}

/** The PDF at `uri`, or null when this device cannot draw PDFs (or this one). */
export async function openPdf(uri: string): Promise<OpenedPdf | null> {
  const mod = PdfPage;
  if (!mod) return null;
  try {
    const pages = await mod.pageCount(uri);
    if (!pages) return null;
    return { pages, render: (n) => mod.render(uri, n, PAGE_EDGE) };
  } catch {
    return null;
  }
}

/** The rendered page sits in the cache folder; the deck keeps a copy among the attachments. */
export function keepPage(uri: string): Promise<string> {
  return persist(uri, 'jpg');
}
