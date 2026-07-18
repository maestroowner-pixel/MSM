// ===================================
// Android — the headless entry point react-native-android-widget calls whenever a
// widget is added, resized, or asked to refresh. It runs OUTSIDE the app's React
// tree (no DataContext), so it reads the flagged snapshot the app last wrote to
// AsyncStorage (services/widgetBridge) and renders the matching widget.
//
// registerMsmWidgets() must run at the top of the JS entry (index.tsx) so the
// handler is registered in BOTH the app process and the headless task process.
// ===================================

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  registerWidgetTaskHandler,
  WidgetTaskHandlerProps,
} from 'react-native-android-widget';

import { ScanWidget } from './ScanWidget';
import { FlaggedWidget } from './FlaggedWidget';
import { FLAGGED_KEY, FlaggedEntry } from './shared';

async function readFlagged(): Promise<FlaggedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(FLAGGED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const handler = async ({ widgetInfo, renderWidget }: WidgetTaskHandlerProps) => {
  switch (widgetInfo.widgetName) {
    case 'Scan':
      renderWidget(<ScanWidget />);
      break;
    case 'Flagged':
      renderWidget(<FlaggedWidget flagged={await readFlagged()} />);
      break;
    default:
      break;
  }
};

/** Wire the MSM widgets into react-native-android-widget's headless runner. */
export function registerMsmWidgets() {
  registerWidgetTaskHandler(handler);
}
