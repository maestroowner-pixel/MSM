// ===================================
// Web-only file helpers.
// On web there is no native share sheet / file system / native print, so file
// delivery is done through standard browser primitives: a Blob + <a download>
// for saving, and a hidden iframe for printing generated HTML (which the user
// can "Save as PDF" from the print dialog). These functions assume a browser
// environment and are only ever called behind a Platform.OS === 'web' guard.
// ===================================

/* eslint-disable @typescript-eslint/no-explicit-any */
const g: any = globalThis as any;

/** Decode a base64 string to a Blob of the given MIME type. */
function base64ToBlob(b64: string, mimeType: string): Blob {
  const bin = g.atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new g.Blob([bytes], { type: mimeType });
}

/** Trigger a browser download of the given content (base64 or plain text). */
export function downloadFileWeb(
  fileName: string,
  data: string,
  isBase64: boolean,
  mimeType: string
): void {
  const blob = isBase64 ? base64ToBlob(data, mimeType) : new g.Blob([data], { type: mimeType });
  const url = g.URL.createObjectURL(blob);
  const a = g.document.createElement('a');
  a.href = url;
  a.download = fileName;
  g.document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke a moment later so the download has certainly started.
  g.setTimeout(() => g.URL.revokeObjectURL(url), 1500);
}

/**
 * Print generated HTML via a hidden iframe (prints ONLY the report, never the
 * app screen). The browser print dialog lets the user "Save as PDF". Using an
 * iframe (not window.open) avoids popup blockers.
 */
export function printHtmlWeb(html: string): void {
  const iframe = g.document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } finally {
      // Keep the frame alive long enough for the print dialog to read it.
      g.setTimeout(() => iframe.remove(), 60000);
    }
  };
  // srcdoc fires a reliable load event once the document is parsed.
  iframe.srcdoc = html;
  g.document.body.appendChild(iframe);
}
