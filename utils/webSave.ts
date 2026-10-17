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
export function currentSection(): string {
  return 'reports';
}
export const sectionName = (kind: string) => kind;
export async function rememberedFolders(): Promise<{ kind: string; name: string; folder: string }[]> {
  return [];
}
export async function saveFileWeb(_blob: Blob, _fileName: string, _kind?: string): Promise<string | null> {
  throw new Error('saveFileWeb is web-only.');
}
