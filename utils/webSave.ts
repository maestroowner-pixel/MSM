// Native stub for utils/webSave.web.ts. On iOS / Android a file goes out through
// the share sheet, and "Save to Files" there remembers its own last folder.
export function canRememberFolder(): boolean {
  return false;
}
export async function rememberedFolder(_kind = 'reports'): Promise<string | null> {
  return null;
}
export async function forgetFolder(_kind = 'reports'): Promise<void> {}
export async function chooseFolder(_kind = 'reports'): Promise<string | null> {
  return null;
}
export async function saveFileWeb(_blob: Blob, _fileName: string, _kind = 'reports'): Promise<string | null> {
  throw new Error('saveFileWeb is web-only.');
}
