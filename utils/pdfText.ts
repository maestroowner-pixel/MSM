// Native stub for utils/pdfText.web.ts. Phones save the document without its
// text; it is still found by title, number and type, and a document uploaded
// from a computer carries its text to every device.
export const MAX_TEXT = 60000;
export async function pdfText(_dataUri: string): Promise<string | null> {
  return null;
}

export function pdfjs(): Promise<any> {
  return Promise.reject(new Error('pdf.js is web-only.'));
}
