// ===================================
// Widget bridge — the ONE place the app pushes a flagged snapshot out to the
// home-screen widgets. The app owns the data; the widgets only ever read what
// this writes.
//
//   • iOS     — write into the App Group's UserDefaults (ExtensionStorage) and
//               ask WidgetKit to reload the timelines.
//   • Android — write the snapshot to AsyncStorage (the headless widget task
//               reads it, see widgets/widget-task-handler) and ask
//               react-native-android-widget to re-render the Flagged widget now.
//   • web / Windows / Expo Go — no widgets, so this is a silent no-op.
//
// Everything is wrapped so a missing native module (Expo Go, web, Windows) can
// never take the app down: a widget that fails to update is never worth a crash.
// ===================================

import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EquipmentItem } from '../types/equipment';
import { CATEGORY_MAP } from '../constants/categories';
import {
  APP_GROUP,
  buildFlaggedSnapshot,
  FLAGGED_KEY,
  FlaggedEntry,
} from '../widgets/shared';

/** The two display lines for a flagged row: the item's type/name, and the
 *  category (+ position) beneath it — MSM's stand-in for DEM's store line. */
function describe(item: EquipmentItem): { name: string; sub: string } {
  const meta = CATEGORY_MAP[item.category];
  const name = item.type || meta?.label || 'Item';
  const sub = [meta?.short, item.position].filter(Boolean).join(' · ');
  return { name, sub };
}

async function syncIOS(snapshot: FlaggedEntry[]) {
  const { ExtensionStorage } = require('@bacons/apple-targets');
  const store = new ExtensionStorage(APP_GROUP);
  // Store a JSON string (not the raw array) so the Swift side decodes one known
  // shape with JSONDecoder — no ambiguity in how an array of dicts bridges.
  store.set(FLAGGED_KEY, JSON.stringify(snapshot));
  ExtensionStorage.reloadWidget();
}

async function syncAndroid(snapshot: FlaggedEntry[]) {
  await AsyncStorage.setItem(FLAGGED_KEY, JSON.stringify(snapshot));
  const { requestWidgetUpdate } = require('react-native-android-widget');
  const { FlaggedWidget } = require('../widgets/FlaggedWidget');
  await requestWidgetUpdate({
    widgetName: 'Flagged',
    renderWidget: () => React.createElement(FlaggedWidget, { flagged: snapshot }),
    // No Flagged widgets on the home screen — nothing to update, and that is fine.
    widgetNotFound: () => {},
  });
}

/**
 * Recompute the flagged snapshot and hand it to the platform's widgets. Safe to
 * call on every data change: cheap, debounced by the caller, and a no-op where
 * there are no widgets.
 */
export async function syncFlaggedWidget(items: EquipmentItem[]): Promise<void> {
  const snapshot = buildFlaggedSnapshot(items, describe);
  try {
    if (Platform.OS === 'ios') await syncIOS(snapshot);
    else if (Platform.OS === 'android') await syncAndroid(snapshot);
  } catch {
    // No widget support in this build (Expo Go, web, Windows) or the native
    // module is absent — the app carries on regardless.
  }
}
