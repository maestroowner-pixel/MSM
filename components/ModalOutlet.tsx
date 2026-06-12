// ===================================
// Renders the active macOS modal overlays (registered via PlatformModal → modalStore).
// Place ONE <ModalOutlet/> at the app root, on top of everything. On iOS/Android it
// renders nothing (PlatformModal uses the real <Modal> there). See modalStore.ts.
// ===================================

import React, { useSyncExternalStore } from 'react';
import { View, StyleSheet } from 'react-native';
import { modalStore } from './modalStore';

export default function ModalOutlet() {
  const entries = useSyncExternalStore(modalStore.subscribe, modalStore.getSnapshot, modalStore.getSnapshot);
  if (!entries.length) return null;
  return (
    <>
      {entries.map((e) => (
        <View key={e.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {e.node}
        </View>
      ))}
    </>
  );
}
