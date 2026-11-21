// ===================================
// Ship's time and UTC in the top line (13 Oct 2026: "add the clock to the top
// line"). Ship's time is Settings → Vessel → Ship's time (utils/shipTime.ts);
// unset, the device's zone. Ticks every second, with seconds shown (14 Oct 2026). A narrow window drops the
// date and the zone, keeping the two times. After them, the time SOURCE (21 Nov 2026, ISO 21745 §4.2.1 —
// services/clockCheck): UTC checked, the device clock off by so much, or not checked; a tap says it in full.
// ===================================

import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { MciIcon } from './MciIcon';
import { monthAbbr, t } from '../utils/i18n';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { nextChangeSoon, shipAndUtcAt } from '../utils/shipTime';
import { clockState, skewText, useClockCheck } from '../services/clockCheck';

export function ShipClock() {
  const COLORS = useTheme();
  const { vessel } = useData();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());
  const [full, setFull] = useState(false);
  const cs = clockState(useClockCheck(), now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = shipAndUtcAt(now, vessel);
  // A planned clock change within 12 hours (Settings → Vessel → Clock changes); a narrow window has no room — the Deck Log says it.
  const soon = nextChangeSoon(vessel, now);
  const day = `${Number(s.ship.slice(8, 10))} ${monthAbbr(Number(s.ship.slice(5, 7)) - 1)}`;
  const wide = width >= 720;
  // Ship's time is a whole-minute offset from UTC, so the seconds are the same in both.
  const sec = `:${String(new Date(now).getUTCSeconds()).padStart(2, '0')}`;
  const ago = cs.kind === 'unchecked' ? '' : `${new Date(cs.check.at).toISOString().slice(11, 16)} UTC`;
  const src = {
    synced: { icon: 'check-circle-outline', color: COLORS.success, short: t('clock.synced'), long: cs.kind === 'unchecked' ? '' : t('clock.syncedLong', { at: ago, skew: skewText(cs.check.skewMs) }) },
    off: { icon: 'alert-circle-outline', color: Math.abs(cs.kind === 'off' ? cs.check.skewMs : 0) >= 60_000 ? COLORS.danger : COLORS.warning, short: cs.kind === 'unchecked' ? '' : t('clock.off', { skew: skewText(cs.check.skewMs) }), long: cs.kind === 'unchecked' ? '' : t('clock.offLong', { at: ago, skew: skewText(cs.check.skewMs) }) },
    stale: { icon: 'help-circle-outline', color: COLORS.textLight, short: t('clock.unchecked'), long: t('clock.staleLong', { at: ago }) },
    unchecked: { icon: 'help-circle-outline', color: COLORS.textLight, short: t('clock.unchecked'), long: t('clock.uncheckedLong') },
  }[cs.kind];
  return (
    <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: SIZES.sm }} accessibilityLabel={`Ship's time ${s.ship} ${s.zone}, ${s.utc} UTC`}>
      <MciIcon name="clock-outline" size={18} color={COLORS.textLight} />
      <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: COLORS.tabActive, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {wide ? `${day} ${s.ship.slice(11)}${sec} ${t('clock.ship')} (${s.zone})` : `${s.ship.slice(11)}${sec} ${t('clock.ship')}`}
      </Text>
      <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{`· ${s.utc.slice(11)}${sec} UTC`}</Text>
      <TouchableOpacity onPress={() => setFull((v) => !v)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 }} accessibilityLabel={src.long}>
        <MciIcon name={src.icon as any} size={15} color={src.color} />
        {wide || full ? <Text style={{ fontSize: SIZES.small, fontWeight: '700', color: src.color, flexShrink: 1 }} numberOfLines={full ? 3 : 1}>{full ? src.long : src.short}</Text> : null}
      </TouchableOpacity>
      {soon && wide ? (
        <Text style={{ fontSize: SIZES.small, fontWeight: '700', color: COLORS.warning }} numberOfLines={1}>{`· ${t('clk.soon', { time: soon.time, to: soon.change.to })}`}</Text>
      ) : null}
    </View>
  );
}
