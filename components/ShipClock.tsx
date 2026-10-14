// ===================================
// Ship's time and UTC in the top line (13 Oct 2026: "add the clock to the top
// line"). Ship's time is Settings → Vessel → Ship's time (utils/shipTime.ts);
// unset, the device's zone. Ticks every second, with seconds shown (14 Oct 2026). A narrow window drops the
// date and the zone, keeping the two times.
// ===================================

import React, { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { MciIcon } from './MciIcon';
import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { SIZES } from '../theme';
import { shipAndUtc } from '../utils/shipTime';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function ShipClock() {
  const COLORS = useTheme();
  const { vessel } = useData();
  const { width } = useWindowDimensions();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = shipAndUtc(now, vessel?.ship_utc_offset);
  const day = `${Number(s.ship.slice(8, 10))} ${MON[Number(s.ship.slice(5, 7)) - 1]}`;
  const wide = width >= 720;
  // Ship's time is a whole-minute offset from UTC, so the seconds are the same in both.
  const sec = `:${String(new Date(now).getUTCSeconds()).padStart(2, '0')}`;
  return (
    <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: SIZES.sm }} accessibilityLabel={`Ship's time ${s.ship} ${s.zone}, ${s.utc} UTC`}>
      <MciIcon name="clock-outline" size={18} color={COLORS.textLight} />
      <Text style={{ fontSize: SIZES.small, fontWeight: '800', color: COLORS.tabActive, fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {wide ? `${day} ${s.ship.slice(11)}${sec} ship (${s.zone})` : `${s.ship.slice(11)}${sec} ship`}
      </Text>
      <Text style={{ fontSize: SIZES.small, color: COLORS.textLight, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{`· ${s.utc.slice(11)}${sec} UTC`}</Text>
    </View>
  );
}
