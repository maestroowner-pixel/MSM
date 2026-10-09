// Native stub for utils/crewListPdf.web.ts — phones draw the HTML crew list with
// expo-print (services/crewListReport.ts), so jsPDF stays out of the native bundle.
export type { CrewListPdfData } from './crewListPdf.web';
export function crewListPdfBlob(_d: import('./crewListPdf.web').CrewListPdfData): Blob {
  throw new Error('crewListPdfBlob is web-only.');
}
