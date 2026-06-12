// ===================================
// Legal doc screen — view Privacy Policy or Terms of Use from Settings.
// route.params.doc = 'privacy' | 'terms'
// ===================================

import React from 'react';
import { useRoute } from '@react-navigation/native';
import { Screen } from '../components/ui';
import LegalBody from '../components/LegalBody';
import { PRIVACY_POLICY, TERMS_OF_USE } from '../constants/legal';

export default function LegalSc() {
  const route = useRoute<any>();
  const doc = route.params?.doc === 'terms' ? TERMS_OF_USE : PRIVACY_POLICY;
  return (
    <Screen scroll>
      <LegalBody doc={doc} />
    </Screen>
  );
}
