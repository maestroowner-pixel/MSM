// ===================================
// Tiny module-level store backing the macOS <Modal> replacement (see PlatformModal).
// react-native-macos compiles out RCTModalHostView (#if !TARGET_OS_OSX), so `<Modal>`
// throws "No component found". PlatformModal registers its children here; a single
// <ModalOutlet/> at the app root renders them in a window-covering overlay. Using a
// store OUTSIDE the React tree means writing an overlay re-renders ONLY the outlet,
// not the modal's owner — so there's no mount→setState→re-render loop, and a deeply
// nested modal (e.g. the date picker inside a ScrollView form) still covers the window.
// ===================================

import type { ReactNode } from 'react';

type Entry = { id: string; node: ReactNode };

let entries: Entry[] = [];
const listeners = new Set<() => void>();

export const modalStore = {
  set(id: string, node: ReactNode) {
    entries = [...entries.filter((e) => e.id !== id), { id, node }];
    listeners.forEach((l) => l());
  },
  remove(id: string) {
    if (!entries.some((e) => e.id === id)) return;
    entries = entries.filter((e) => e.id !== id);
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  getSnapshot() {
    return entries;
  },
};
