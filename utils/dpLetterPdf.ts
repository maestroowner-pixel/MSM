// Native stub for utils/dpLetterPdf.web.ts — phones print the letter's HTML with
// expo-print (services/dpReport.ts), so jsPDF stays out of the native bundle.
export function dpLetterPdfBlob(_l: import('../services/dp').Letter): Blob {
  throw new Error('dpLetterPdfBlob is web-only.');
}
