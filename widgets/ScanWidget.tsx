// ===================================
// Android — the small "Scan" widget: one tap, straight into the in-app scanner.
//
// Rendered by react-native-android-widget from headless JS (see
// widget-task-handler), so it is built from the library's own primitives, not
// React Native views, and it carries no live data — only a deep link.
// ===================================

import React from 'react';
import { FlexWidget, ImageWidget, TextWidget } from 'react-native-android-widget';

import { SCAN_DEEP_LINK, WIDGET_COLORS as C } from './shared';

export function ScanWidget() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: SCAN_DEEP_LINK }}
      accessibilityLabel="Scan a label"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: C.primary,
        borderRadius: 24,
        padding: 12,
      }}
    >
      {/* The QR with the MSM cube in it, on a white tile. A widget lives on the
          user's own wallpaper among two dozen other icons, and a line-drawn
          viewfinder there reads as "some utility"; this one says what it opens
          and whose it is at a glance. The PNG's corners are already transparent
          so the tile keeps its shape against any wallpaper. */}
      <ImageWidget
        image={require('../assets/widget-scan-256.png')}
        imageWidth={54}
        imageHeight={54}
        radius={12}
      />
      <TextWidget
        text="Scan"
        style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 4 }}
      />
    </FlexWidget>
  );
}
