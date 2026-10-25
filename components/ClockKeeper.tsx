// ===================================
// Applies the planned clock changes (utils/shipTime.ts). Ship's time is read
// from the history, so the clocks change on time by themselves; this keeps the
// vessel's plain offset in step for app versions that read only that, and
// writes each change into the Deck Log once, as the bridge would by hand.
// Renders nothing.
// ===================================

import { useEffect, useState } from 'react';

import { useData } from '../contexts/DataContext';
import { moduleOn } from '../constants/modules';
import * as storage from '../services/storage';
import { DeckEntry } from '../types/deckLog';
import { clockChangeText, offsetAt, pastChanges, shipAndUtc } from '../utils/shipTime';

const WEEK = 7 * 86400000;

export function ClockKeeper() {
  const { vessel, setVessel, deckLog, saveRow } = useData();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const changes = vessel?.ship_time_changes ?? [];
  const cur = offsetAt(now, vessel);
  useEffect(() => {
    if (!vessel || !changes.length || cur === vessel.ship_utc_offset) return;
    void setVessel({ ...vessel, ship_utc_offset: cur });
  }, [vessel, changes.length, cur, setVessel]);

  useEffect(() => {
    if (!moduleOn('deckLog')) return;
    for (const c of pastChanges(vessel, now)) {
      if (now - c.at > WEEK) break;
      if (deckLog.some((e) => e.clockRef === c.id)) continue;
      // The wall time the clocks showed when they were changed — the old zone's.
      const s = shipAndUtc(c.at, c.from);
      void saveRow(storage.DECK_LOG_KEY, {
        id: `dl-clock-${c.id}`,
        date: s.ship.slice(0, 10),
        time: s.ship.slice(11),
        period: 'other',
        remarks: `${clockChangeText(c)} at ${s.ship.slice(11)} ship's time (${s.utc.slice(11)} UTC)`,
        by: c.by || 'Master',
        at: c.at,
        clockRef: c.id,
        updatedAt: now,
      } as DeckEntry);
    }
  }, [vessel, now, deckLog, saveRow]);

  return null;
}
