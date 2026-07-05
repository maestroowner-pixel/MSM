// Native stub for the web-only PDF generator. On iOS/Android Metro loads THIS
// file (not webPdf.web.ts), so jspdf never enters the native bundle. Native uses
// expo-print for PDF, so this is never actually called there.
export function downloadPdfWeb(_r: any): void {
  throw new Error('downloadPdfWeb is web-only (native uses expo-print).');
}
