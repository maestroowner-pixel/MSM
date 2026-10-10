// Who is signing on this device — its own account when it has joined a vessel,
// otherwise a name picked from the crew on board (remembered as the last signer).
// Shared by permits, risk assessments and any other signed step.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../contexts/ThemeContext';
import { useData } from '../contexts/DataContext';
import { useSync } from '../contexts/SyncContext';
import { SIZES } from '../theme';
import { crewLabel, isAboard } from '../types/crew';
import { personName } from '../types/role';

export interface Signer {
  key: string;
  name: string;
  rank?: string;
  /** The device's own account — fingerprint allowed (components/SignConfirm). */
  own: boolean;
}

export function useSigner(): { signer: Signer | null; picker: React.ReactElement | null } {
  const COLORS = useTheme();
  const { crew, prefs } = useData();
  const sync = useSync();
  const people = useMemo(() => crew.filter(isAboard), [crew]);
  const [pickedId, setPickedId] = useState<string | undefined>(prefs?.lastCrewId);
  if (sync.me) {
    return { signer: { key: `device:${sync.me.id}`, name: personName(sync.me), rank: sync.me.position || undefined, own: true }, picker: null };
  }
  const picked = people.find((p) => p.id === pickedId);
  const picker = (
    <View style={styles.chips}>
      {people.map((p) => {
        const on = p.id === pickedId;
        return (
          <TouchableOpacity key={p.id} onPress={() => setPickedId(p.id)} style={[styles.chip, { borderColor: COLORS.primary }, on && { backgroundColor: COLORS.primary }]}>
            <Text style={{ color: on ? COLORS.textWhite : COLORS.primary, fontWeight: '600', fontSize: SIZES.small }}>{crewLabel(p)}</Text>
          </TouchableOpacity>
        );
      })}
      {!people.length ? <Text style={{ color: COLORS.textLight, fontSize: SIZES.small }}>Nobody is on board in the crew list.</Text> : null}
    </View>
  );
  return { signer: picked ? { key: picked.id, name: picked.name, rank: picked.rank, own: false } : null, picker };
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SIZES.xs, marginTop: SIZES.xs },
  chip: { paddingVertical: 6, paddingHorizontal: SIZES.sm, borderRadius: 999, borderWidth: 1 },
});
