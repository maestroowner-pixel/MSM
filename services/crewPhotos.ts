// ===================================
// Crew photos for the ID card (17 Oct 2026) — kept on THIS device only, never
// synced: a face is personal data, and it stays aboard with the computer that
// prints the cards (the rule for documents and names, see constants/legal).
// One small JPEG per crew member (~480 px, 40–70 KB) as a data: URI.
// ===================================

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'msm:crew_photos';

export async function loadCrewPhotos(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function setCrewPhoto(id: string, dataUri: string | null): Promise<void> {
  const all = await loadCrewPhotos();
  if (dataUri) all[id] = dataUri;
  else delete all[id];
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
