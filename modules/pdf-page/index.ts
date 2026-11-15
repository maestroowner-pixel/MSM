// A page of a PDF as a JPEG, on the phone itself — no network, no pdf.js
// (utils/pdfPage.ts). Optional: a build without the module (2.74 and older, the
// web, Windows) gets null and the caller says a PDF cannot be used here.
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface RenderedPage {
  uri: string;
  width: number;
  height: number;
}

interface PdfPageNative {
  pageCount(uri: string): Promise<number>;
  render(uri: string, page: number, maxEdge: number): Promise<RenderedPage>;
}

export default requireOptionalNativeModule<PdfPageNative>('PdfPage');
