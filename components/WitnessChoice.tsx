// ===================================
// A witness for a controlled drug — the second person present, who signs too
// (PIN or by hand on this device; asked always). Hospital: receiving, giving,
// disposing of and counting morphine and the like.
//
//   const w = useWitness(signer?.name);
//   {w.picker}
//   const ok = await w.confirm('Morphine 10 mg — 1 issued');   // null = cancelled
// ===================================

import React, { useMemo, useState } from 'react';

import { Dropdown } from './Dropdown';
import { useSignConfirm } from './SignConfirm';
import { useData } from '../contexts/DataContext';
import { isAboard } from '../types/crew';
import { t, useT } from '../utils/i18n';
import type { SignProof } from '../services/signature';

export interface WitnessSign {
  witness: string;
  witnessRank?: string;
  witnessWith?: SignProof;
}

export function useWitness(signerName?: string, caption?: string) {
  useT();
  const { crew } = useData();
  const confirmSign = useSignConfirm();
  const people = useMemo(() => crew.filter(isAboard).filter((c) => c.name !== signerName), [crew, signerName]);
  const [id, setId] = useState('');
  const picked = people.find((p) => p.id === id);
  const picker = <Dropdown caption={caption ?? t('sch.witness')} value={picked ? id : ''} onChange={setId} options={[{ value: '', label: t('common.choose') }, ...people.map((p) => ({ value: p.id, label: p.rank ? `${p.name} · ${p.rank}` : p.name }))]} />;
  const confirm = async (what: string): Promise<WitnessSign | null> => {
    if (!picked) return null;
    const r = await confirmSign({ personKey: picked.id, name: picked.name, ownDevice: false, what: `Witness — ${what}`, always: true });
    if (!r) return null;
    return { witness: picked.name, ...(picked.rank ? { witnessRank: picked.rank } : {}), ...(r.proof ? { witnessWith: r.proof } : {}) };
  };
  return { picked, picker, confirm };
}
