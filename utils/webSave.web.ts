// ===================================
// Save a file from the web build INTO A REMEMBERED FOLDER.
//
// Asked for on 9 Oct 2026: "make it remember where these files are saved". A
// browser's print-to-PDF and its downloads decide the folder themselves, and an
// officer filing a month of rest records for twelve people chose the same
// folder twelve times.
//
// Chromium browsers (Chrome, Opera, Edge — what ships' offices run) have the
// File System Access API: the first save asks for a FOLDER, the folder handle is
// kept in IndexedDB, and every later save writes straight into it. After a
// browser restart the browser asks once whether the site may still write there
// (that prompt is the browser's, and cannot be skipped). "Change folder" in
// Settings forgets it.
//
// Safari and Firefox have no such API: the file goes to Downloads under its
// proper name, which is the best a page can do there.
// ===================================

const DB = 'ismpilot-files';
const STORE = 'handles';

function idb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function getHandle(key: string): Promise<any | null> {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result ?? null);
      q.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

async function setHandle(key: string, h: any | null): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((res) => {
      const st = db.transaction(STORE, 'readwrite').objectStore(STORE);
      const q = h ? st.put(h, key) : st.delete(key);
      q.onsuccess = () => res();
      q.onerror = () => res();
    });
  } catch {
    /* nothing remembered — the next save asks again */
  }
}

// ---- a folder per section (17 Oct 2026: "each page its own folder, so DP does
// not mix with ISPS") ----------------------------------------------------------
//
// The section is read from the page's address when the file is saved: /dp and
// the DP checklist pages save to the DP folder, /security (gangway, searches,
// rounds, keys) to the Security folder, and so on. The first save in a section
// asks for its folder; the notice says where it went.

/** Pages that share a section's folder with another page. */
const ALIAS: Record<string, string> = { 'dp-check': 'dp', 'dp-checklists': 'dp', 'service-report': 'certificates', certificate: 'certificates', handover: 'readiness', 'oil-record': 'oil-record', labels: 'labels', label: 'labels' };
/** How a section is called in Settings and in the notice. */
const NAME: Record<string, string> = { dp: 'DP', security: 'Security (ISPS)', rest: 'Hours of rest', 'oil-record': 'Oil record book', 'ballast-water': 'Ballast water', pms: 'Maintenance', reports: 'Reports' };

/** The section of the page open now — the first part of its address. */
export function currentSection(): string {
  try {
    const seg = (globalThis.location?.pathname ?? '/').split('/').filter(Boolean)[0] ?? 'reports';
    return ALIAS[seg] ?? seg;
  } catch {
    return 'reports';
  }
}
export const sectionName = (kind: string) => NAME[kind] ?? kind.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Every section with a folder chosen on this computer. */
export async function rememberedFolders(): Promise<{ kind: string; name: string; folder: string }[]> {
  try {
    const db = await idb();
    const keys: string[] = await new Promise((res) => {
      const q = db.transaction(STORE).objectStore(STORE).getAllKeys();
      q.onsuccess = () => res((q.result as IDBValidKey[]).map(String));
      q.onerror = () => res([]);
    });
    const out: { kind: string; name: string; folder: string }[] = [];
    for (const k of keys) {
      const h = await getHandle(k);
      if (h?.name) out.push({ kind: k, name: sectionName(k), folder: h.name });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export function canRememberFolder(): boolean {
  return typeof (globalThis as any).showDirectoryPicker === 'function';
}

/** The remembered folder's name, for Settings. */
export async function rememberedFolder(kind = 'reports'): Promise<string | null> {
  const h = await getHandle(kind);
  return h?.name ?? null;
}

export async function forgetFolder(kind = 'reports'): Promise<void> {
  await setHandle(kind, null);
}

/** Ask for a folder now (Settings → Change folder). */
export async function chooseFolder(kind = 'reports'): Promise<string | null> {
  if (!canRememberFolder()) return null;
  try {
    const h = await (globalThis as any).showDirectoryPicker({ id: `ismpilot-${kind}`, mode: 'readwrite', startIn: 'documents' });
    await setHandle(kind, h);
    return h.name;
  } catch {
    return null; // cancelled
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/**
 * Save `blob` as `fileName`. Returns where it went: the folder's name, or
 * 'Downloads' when the browser decides. Null when the person cancelled.
 *
 * Call it straight from the click (no long awaits before it): asking for a
 * folder, or for permission to write to it again, needs the user's gesture.
 */
/**
 * Says where the file went, for a few seconds at the bottom of the screen (17 Oct
 * 2026: "the first time it asks for the folder, then — silence"). Every PDF and
 * sheet the web build saves comes through here, so every screen says it the same
 * way, wherever the page is scrolled to.
 */
function toast(fileName: string, where: string, newFor?: string): void {
  try {
    const id = 'ismpilot-save-toast';
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'status');
    el.textContent = `✓ ${fileName} — saved ${where === 'Downloads' ? 'to Downloads' : `to the folder “${where}”`}${newFor ? ` · ${newFor} files go there from now on (Settings → Folders)` : ''}`;
    Object.assign(el.style, {
      position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '99999',
      maxWidth: 'calc(100vw - 32px)', padding: '12px 18px', borderRadius: '10px',
      background: '#0B2545', color: '#fff', font: '600 14px -apple-system, Helvetica, Arial, sans-serif',
      boxShadow: '0 6px 24px rgba(0,0,0,.35)', overflowWrap: 'anywhere', transition: 'opacity .4s',
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    setTimeout(() => (el.style.opacity = '0'), newFor ? 7500 : 4500);
    setTimeout(() => el.remove(), newFor ? 8000 : 5000);
  } catch {
    /* no document (a test) — the screen's own line still says it */
  }
}

export async function saveFileWeb(blob: Blob, fileName: string, kind?: string): Promise<string | null> {
  // 'reports' was the one folder for everything; now the page's section decides.
  const section = !kind || kind === 'reports' ? currentSection() : kind;
  const first = canRememberFolder() && !(await getHandle(section));
  const where = await saveTo(blob, fileName, section);
  if (where) toast(fileName, where, first && where !== 'Downloads' ? sectionName(section) : undefined);
  return where;
}

async function saveTo(blob: Blob, fileName: string, kind: string): Promise<string | null> {
  if (!canRememberFolder()) {
    download(blob, fileName);
    return 'Downloads';
  }
  let dir = await getHandle(kind);
  if (dir) {
    try {
      let perm = await dir.queryPermission({ mode: 'readwrite' });
      if (perm === 'prompt') perm = await dir.requestPermission({ mode: 'readwrite' });
      if (perm !== 'granted') dir = null;
    } catch {
      dir = null; // folder moved or deleted — ask again
    }
  }
  if (!dir) {
    try {
      dir = await (globalThis as any).showDirectoryPicker({ id: `ismpilot-${kind}`, mode: 'readwrite', startIn: 'documents' });
      await setHandle(kind, dir);
    } catch {
      return null; // cancelled
    }
  }
  try {
    const fh = await dir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
    return dir.name;
  } catch {
    // Writing failed (read-only folder, disk full): never lose the file.
    download(blob, fileName);
    return 'Downloads';
  }
}
