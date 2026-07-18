// ===================================
// Android — the small "Scan" widget: one tap, straight into the in-app scanner.
//
// Rendered by react-native-android-widget from headless JS (see
// widget-task-handler), so it is built from the library's own primitives, not
// React Native views, and it carries no live data — only a deep link.
// ===================================

import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import { SCAN_DEEP_LINK, SCAN_ICON_SVG, WIDGET_COLORS as C } from './shared';

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
      <SvgWidget svg={SCAN_ICON_SVG} style={{ width: 46, height: 46 }} />
      <TextWidget
        text="Scan"
        style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginTop: 4 }}
      />
    </FlexWidget>
  );
}
