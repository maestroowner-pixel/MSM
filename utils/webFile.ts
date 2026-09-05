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

/**
 * Ask the browser for a file BY EXTENSION, and return its text.
 *
 * `expo-document-picker` builds an `<input accept="…">` from MIME types, and
 * macOS greys out anything whose type it cannot match. `.msm` is our own
 * extension with no registered MIME type, so the file dialog showed the backup
 * sitting on the Desktop and refused to let it be selected — a catch-all entry
 * in the list did not save it, because the OS honours the specific entries too.
 *
 * HTML `accept` takes extensions directly, which is the one thing that works
 * here, so on web the picker is ours rather than the library's.
 *
 * Resolves null when the user cancels. Cancellation gives no event in most
 * browsers, so this leans on the window regaining focus — a dialog closed with
 * no file chosen would otherwise leave the caller waiting for ever.
 */
export interface PickedTextFile {
  name: string;
  size: number;
  text: string;
}

/**
 * Ask the browser for a file BY EXTENSION and return its text plus its name.
 *
 * `expo-document-picker` builds an `<input accept="…">` from MIME types, and
 * macOS greys out anything whose type it cannot match. `.msm` is our own
 * extension with no registered MIME type, so the file dialog showed the backup
 * sitting on the Desktop and refused to let it be selected — a catch-all entry
 * in the list did not save it, because the OS honours the specific entries too.
 * HTML `accept` takes extensions directly, so on web the picker is ours.
 *
 * CANCELLATION. This used to be inferred from the window regaining focus, and
 * that inference is the reason a restore could do nothing at all with no error:
 * a browser that delivered `focus` before `change` looked at an input that was
 * not populated yet and reported a cancel, and the caller returned silently.
 * `<input type=file>` now fires a real `cancel` event (Chrome 113+, Safari 17+),
 * so the guess is only a fallback — and it is now a slow one, because being late
 * to notice a cancel costs nothing while being early loses a good file.
 *
 * Resolves null ONLY on a genuine cancel. A file that cannot be read rejects, so
 * the caller can say which of the two happened instead of going quiet.
 */
export function pickTextFileWeb(accept: string): Promise<PickedTextFile | null> {
  return new Promise((resolve, reject) => {
    const doc: any = (globalThis as any).document;
    if (!doc) return resolve(null);

    const input = doc.createElement('input');
    input.type = 'file';
    input.accept = accept;
    // Off-screen rather than display:none — a hidden input is skipped by some
    // automation and accessibility layers, and this one has to be clickable.
    input.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;';

    let picked = false;
    let settled = false;
    let focusTimer: any = null;

    const cleanup = () => {
      if (focusTimer) clearTimeout(focusTimer);
      (globalThis as any).removeEventListener?.('focus', onFocus);
      try { input.remove(); } catch { /* already gone */ }
    };
    const finish = (value: PickedTextFile | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (e: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    };

    const read = (file: any) => {
      picked = true;
      // `File.text()` is the short road, but it is missing in older WebViews and
      // returns nothing useful when it is. FileReader is the one that works
      // everywhere, and a failure here must be reported, never swallowed.
      if (typeof file.text === 'function') {
        file.text()
          .then((text: string) => finish({ name: file.name, size: file.size, text }))
          .catch(() => readWithFileReader(file));
      } else {
        readWithFileReader(file);
      }
    };

    const readWithFileReader = (file: any) => {
      try {
        const fr = new (globalThis as any).FileReader();
        fr.onload = () => finish({ name: file.name, size: file.size, text: String(fr.result ?? '') });
        fr.onerror = () => fail(new Error(`Could not read "${file.name}" — the browser refused to open it.`));
        fr.readAsText(file);
      } catch (e) {
        fail(e);
      }
    };

    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return finish(null);
      read(file);
    };

    // The real thing, where the browser has it.
    input.oncancel = () => { if (!picked) finish(null); };

    // Fallback for browsers with no `cancel` event. Deliberately unhurried: a
    // late cancel is invisible to the user, an early one throws away their file.
    function onFocus() {
      focusTimer = setTimeout(() => { if (!picked) finish(null); }, 3000);
    }
    (globalThis as any).addEventListener?.('focus', onFocus, { once: true });

    doc.body.appendChild(input);
    input.click();
  });
}
