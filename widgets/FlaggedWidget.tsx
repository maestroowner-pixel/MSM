// ===================================
// Android — the "Scan + Flagged" widget: the scanner button on the LEFT, and the
// three most-recently-touched flagged items as rows on the RIGHT. A tap on the
// button opens the scanner; a tap on a row opens that item.
//
// The rows are a WINDOW onto the flagged list, not the whole of it — the app
// exports up to FLAGGED_EXPORT_MAX and the OS refresh cadence rotates which
// three show. This component just renders whatever window it is handed.
// ===================================

import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

import {
  FLAGGED_WINDOW,
  FlaggedEntry,
  itemDeepLink,
  SCAN_DEEP_LINK,
  SCAN_ICON_SVG,
  WIDGET_COLORS as C,
} from './shared';

function ScanButton() {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: SCAN_DEEP_LINK }}
      accessibilityLabel="Scan a label"
      style={{
        height: 'match_parent',
        width: 88,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: C.primary,
        borderRadius: 20,
        marginRight: 12,
      }}
    >
      <SvgWidget svg={SCAN_ICON_SVG} style={{ width: 38, height: 38 }} />
      <TextWidget
        text="Scan"
        style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginTop: 2 }}
      />
    </FlexWidget>
  );
}

function FlaggedRow({ entry }: { entry: FlaggedEntry }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: itemDeepLink(entry.id) }}
      accessibilityLabel={`Open ${entry.name}`}
      style={{
        height: 'wrap_content',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
      }}
    >
      <TextWidget text="⚑" style={{ fontSize: 15, color: C.warning, marginRight: 6 }} />
      <FlexWidget
        style={{ flex: 1, height: 'wrap_content', flexDirection: 'column' }}
      >
        <TextWidget
          text={entry.name}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontWeight: '600', color: C.text }}
        />
        <TextWidget
          text={entry.sub}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 11, color: C.textLight }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export function FlaggedWidget({ flagged }: { flagged: FlaggedEntry[] }) {
  const rows = flagged.slice(0, FLAGGED_WINDOW);
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: C.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: C.border,
        padding: 12,
      }}
    >
      <ScanButton />
      <FlexWidget
        style={{ flex: 1, height: 'match_parent', flexDirection: 'column', justifyContent: 'center' }}
      >
        {rows.length === 0 ? (
          <TextWidget
            text="Nothing flagged"
            style={{ fontSize: 13, color: C.textLight }}
          />
        ) : (
          rows.map((entry) => <FlaggedRow key={entry.id} entry={entry} />)
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
