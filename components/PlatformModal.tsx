// ===================================
// Drop-in replacement for react-native's <Modal>.
// iOS/Android: the real <Modal>. macOS: react-native-macos has NO RCTModalHostView
// (compiled out with #if !TARGET_OS_OSX) so <Modal> throws "No component found" —
// instead we register the children into modalStore and render them via <ModalOutlet/>
// (at the app root) as a window-covering overlay. Callers already provide their own
// full-screen backdrop child, so this is a transparent swap. See modalStore.ts.
// ===================================

import React, { useEffect, useRef } from 'react';
import { Modal as RNModal, Platform, ModalProps } from 'react-native';
import { modalStore } from './modalStore';

const onMacOS = Platform.OS === 'macos';

export default function PlatformModal(props: ModalProps & { children?: React.ReactNode }) {
  if (!onMacOS) {
    return <RNModal {...props} />;
  }
  return <MacModal visible={!!props.visible}>{props.children}</MacModal>;
}

function MacModal({ visible, children }: { visible: boolean; children?: React.ReactNode }) {
  const idRef = useRef<string>('m' + Math.random().toString(36).slice(2));
  // No dependency array: re-publish the (possibly updated) children every render so the
  // overlay stays live as the modal's own state changes. This only notifies ModalOutlet,
  // never this component's owner, so there's no render loop.
  useEffect(() => {
    const id = idRef.current;
    if (visible) modalStore.set(id, children);
    else modalStore.remove(id);
    return () => modalStore.remove(id);
  });
  return null;
}
