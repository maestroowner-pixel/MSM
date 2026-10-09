// ===================================
// Text out of a PDF, in the browser — so an ISM document can be searched by any
// word in it, not just by its title (9 Oct 2026: "search by word, search by
// number").
//
// pdf.js is loaded from cdnjs on first use rather than bundled: its module
// build needs a worker file and `import.meta`, which Metro's web export does not
// carry, and an office computer uploading the SMS manual is online anyway. If
// it cannot load (offline, blocked), the document is saved without its text and
// is still found by title, number and type.
//
// The text is capped: it travels inside the document's record, and a Firestore
// record stops at 1 MiB.
// ===================================

const VER = '3.11.174';
const BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${VER}`;
export const MAX_TEXT = 60000;

let loading: Promise<any> | null = null;

function pdfjs(): Promise<any> {
  const g: any = globalThis as any;
  if (g.pdfjsLib) return Promise.resolve(g.pdfjsLib);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `${BASE}/pdf.min.js`;
    s.async = true;
    s.onload = () => {
      const lib = g.pdfjsLib;
      if (!lib) return reject(new Error('pdf.js did not load'));
      lib.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.js`;
      resolve(lib);
    };
    s.onerror = () => {
      loading = null;
      reject(new Error('pdf.js could not be loaded'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

function bytesOf(dataUri: string): Uint8Array {
  const b64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The PDF's text, pages joined, whitespace folded, at most MAX_TEXT chars. Null if it cannot be read. */
export async function pdfText(dataUri: string): Promise<string | null> {
  if (!/^data:application\/pdf/i.test(dataUri)) return null;
  try {
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: bytesOf(dataUri) }).promise;
    let text = '';
    for (let p = 1; p <= doc.numPages && text.length < MAX_TEXT; p++) {
      const page = await doc.getPage(p);
      const c = await page.getTextContent();
      text += ' ' + c.items.map((i: any) => i.str).join(' ');
    }
    return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) || null;
  } catch {
    return null;
  }
}
