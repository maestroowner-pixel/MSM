// The "Import SDM file" action, shared by Crew (finds or adds the person) and a
// crew member's screen (fills that person). Pick → plan → confirm → save.
// The rules of what goes where are in services/sdmImport.ts.

import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useData } from '../contexts/DataContext';
import { SdmPlan, parseSdm, planSdmImport } from '../services/sdmImport';
import { pickSdmFile } from '../services/crewListReport';

export function useSdmImport() {
  const { crew, crewPrivate, certificates, saveCrewMember, saveCrewPrivate, saveCertificates } = useData();

  return useCallback(
    /** Resolves with what was imported once it is saved (null when cancelled), so an open form can show it. */
    async (targetId?: string, onImported?: (plan: SdmPlan) => void): Promise<void> => {
      try {
        const f = await pickSdmFile();
        if (!f) return;
        const plan = planSdmImport(parseSdm(f.text), crew, crewPrivate, certificates, targetId);
        const apply = async () => {
          // Certificates first, in one write: they were saved one by one, each with a
          // full reload, and a reload that failed part-way left a 27-document file
          // with one certificate in (11 Oct 2026).
          await saveCertificates(plan.certificates.map((c) => JSON.parse(JSON.stringify(c))));
          await saveCrewMember(plan.member);
          await saveCrewPrivate(JSON.parse(JSON.stringify(plan.priv)));
          onImported?.(plan);
          Alert.alert('Imported', `${plan.member.name}: ${plan.certificates.length} certificate${plan.certificates.length === 1 ? '' : 's'} added or updated.`);
        };
        Alert.alert(
          `Import “${f.name}”?`,
          [
            ...plan.summary,
            plan.nationalityRaw ? `Nationality “${plan.nationalityRaw}” not recognised — enter the 2-letter code by hand.` : null,
            'Fields the file leaves empty keep what the app already has.',
          ]
            .filter(Boolean)
            .join('\n'),
          [{ text: 'Cancel', style: 'cancel' }, { text: 'Import', onPress: () => void apply() }]
        );
      } catch (e: any) {
        Alert.alert('SDM import', String(e?.message ?? e));
      }
    },
    [crew, crewPrivate, certificates, saveCrewMember, saveCrewPrivate, saveCertificates]
  );
}
