// Native stub for utils/restPdf.web.ts — iOS / Android print the HTML record with
// expo-print (services/restReport.ts), so jsPDF never enters the native bundle.
export type { RestPdfData, RestPdfRow } from './restPdf.web';
export function restPdfBlob(_d: import('./restPdf.web').RestPdfData): Blob {
  throw new Error('restPdfBlob is web-only.');
}
