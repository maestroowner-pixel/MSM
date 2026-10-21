// Who is signing on this device — its own account when it has joined a vessel,
// otherwise a name picked from the crew on board (remembered as the last signer).
// Shared by permits, risk assessments and any other signed step.
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Dropdown } from './Dropdown';

import { useTheme } from '../contexts/ThemeContext';
import { t, useT } from '../utils/i18n';
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

/** The name last chosen on this device — kept while the app is open, so moving between screens does not ask again. */
let lastPicked = '';

export function useSigner(caption?: string, { forceDropdown = false } = {}): { signer: Signer | null; picker: React.ReactElement | null } {
  const COLORS = useTheme();
  useT();
  const { crew, prefs } = useData();
  const sync = useSync();
  const people = useMemo(() => crew.filter(isAboard), [crew]);
  const [pickedId, setPicked] = useState<string>(lastPicked || prefs?.lastCrewId || '');
  const setPickedId = (id: string) => {
    lastPicked = id;
    setPicked(id);
  };
  if (sync.me && !forceDropdown) {
    return { signer: { key: `device:${sync.me.id}`, name: personName(sync.me), rank: sync.me.position || undefined, own: true }, picker: null };
  }
  const picked = people.find((p) => p.id === pickedId);
  // One drop-down, not a row of every name (10 Oct 2026: "a drop-down is enough
  // and minimal").
  const picker = people.length ? (
    <Dropdown
      caption={caption ?? t('sch.signingAs')}
      value={picked ? pickedId : ''}
      onChange={setPickedId}
      options={[{ value: '', label: t('common.choose') }, ...people.map((p) => ({ value: p.id, label: crewLabel(p) }))]}
      style={styles.drop}
    />
  ) : (
    <Text style={{ color: COLORS.textLight, fontSize: SIZES.small }}>{t('sch.nobody')}</Text>
  );
  return { signer: picked ? { key: picked.id, name: picked.name, rank: picked.rank, own: false } : null, picker };
}

const styles = StyleSheet.create({
  drop: { marginTop: SIZES.xs, maxWidth: 420 },
});
