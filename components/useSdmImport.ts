// The "Import SDM file" action, shared by Crew (finds or adds the person) and a
// crew member's screen (fills that person). Pick → plan → confirm → save.
// The rules of what goes where are in services/sdmImport.ts.

import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useData } from '../contexts/DataContext';
import { SdmPlan, parseSdm, planSdmImport } from '../services/sdmImport';
import { pickSdmFile } from '../services/crewListReport';
import { t, tn } from '../utils/i18n';

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
          Alert.alert(t('sdm.imported'), t('sdm.importedBody', { name: plan.member.name, certs: tn('n.certificate', plan.certificates.length) }));
        };
        Alert.alert(
          t('sdm.importQ', { file: f.name }),
          [
            ...plan.summary,
            plan.nationalityRaw ? t('sdm.nationality', { raw: plan.nationalityRaw }) : null,
            t('sdm.emptyKeep'),
          ]
            .filter(Boolean)
            .join('\n'),
          [{ text: t('common.cancel'), style: 'cancel' }, { text: t('slk.import'), onPress: () => void apply() }]
        );
      } catch (e: any) {
        Alert.alert(t('sdm.title'), String(e?.message ?? e));
      }
    },
    [crew, crewPrivate, certificates, saveCrewMember, saveCrewPrivate, saveCertificates]
  );
}
