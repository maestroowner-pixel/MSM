// ===================================
// Legal content — Privacy Policy, Terms of Use, and the disclaimer points
// shown in the first-launch consent gate. Bump LEGAL_VERSION to force re-consent.
// ===================================

import { APP_CONFIG } from '../theme';

export const LEGAL_VERSION = 1;
export const LEGAL_ACCEPTED_KEY = `msm:legal_accepted_v${LEGAL_VERSION}`;
export const EFFECTIVE_DATE = '5 June 2026';

export interface LegalSection {
  heading?: string;
  paragraphs: string[];
}

export interface LegalDoc {
  title: string;
  effectiveDate: string;
  sections: LegalSection[];
}

export const DISCLAIMER_POINTS: string[] = [
  `${APP_CONFIG.name} is a record-keeping and reminder aid only. It does not replace the vessel's official safety documentation, certificates, statutory inspections, or your company Safety Management System (SMS).`,
  'Inspection and expiry intervals shown in the app are indicative. You must verify every requirement against the current SOLAS / LSA Code / FSS Code and applicable MSC circulars, your flag State, your classification society, and each maker\'s instructions.',
  'You are responsible for the accuracy of the data you enter or import, and for carrying out and recording the actual inspections, services and tests.',
];

export const PRIVACY_POLICY: LegalDoc = {
  title: 'Privacy Policy',
  effectiveDate: EFFECTIVE_DATE,
  sections: [
    {
      paragraphs: [
        `This Privacy Policy explains how ${APP_CONFIG.name} ("the app", "we") handles information. By using the app you agree to this policy.`,
      ],
    },
    {
      heading: '1. What we process',
      paragraphs: [
        'The app stores the safety-equipment records you create or import: equipment types, serial/ID numbers, positions on the vessel, quantities, inspection and expiry dates, remarks, and vessel details such as name, IMO, flag, call sign and MMSI.',
        'No personal account, name, email or location is required to use the app.',
      ],
    },
    {
      heading: '2. Local storage',
      paragraphs: [
        'By default all data is stored only on your device. It is not transmitted anywhere unless you enable cloud sync.',
      ],
    },
    {
      heading: '3. Optional cloud sync',
      paragraphs: [
        'If you enable sync, your inventory and vessel info are sent to and retrieved from Google Firebase (Authentication and Realtime Database), stored under an account derived from your vessel IMO number. This is processed by Google as our infrastructure provider and is subject to Google\'s terms.',
        'A random device identifier is generated to support the multi-device approval feature. You choose when to push to or pull from the cloud.',
      ],
    },
    {
      heading: '4. What we do NOT do',
      paragraphs: [
        'We do not sell your data, show advertising, or share your data with third parties other than the cloud infrastructure you opt into. The app does not run usage analytics or tracking.',
      ],
    },
    {
      heading: '5. Retention & deletion',
      paragraphs: [
        'Data remains until you delete it. You can remove items in the app, and cloud data is held under your vessel node until removed. Uninstalling the app clears local data on the device.',
      ],
    },
    {
      heading: '6. Contact',
      paragraphs: [
        `For privacy questions contact ${APP_CONFIG.company} at ${APP_CONFIG.email} (${APP_CONFIG.website}).`,
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDoc = {
  title: 'Terms of Use',
  effectiveDate: EFFECTIVE_DATE,
  sections: [
    {
      paragraphs: [
        `These Terms govern your use of ${APP_CONFIG.name}. By installing or using the app you accept these Terms. If you do not agree, do not use the app.`,
      ],
    },
    {
      heading: '1. Licence',
      paragraphs: [
        `${APP_CONFIG.company} grants you a personal, non-exclusive, non-transferable, revocable licence to use the app for managing your vessel's safety-equipment records. The app and its content are proprietary and protected by law.`,
      ],
    },
    {
      heading: '2. Acceptable use',
      paragraphs: [
        'You agree not to reverse engineer, decompile, resell, sublicense, or use the app for any unlawful purpose, and not to interfere with its operation or security.',
      ],
    },
    {
      heading: '3. Not a compliance system',
      paragraphs: [
        'The app is a record-keeping aid. It does not replace statutory inspections, certificates, your SMS, or flag/class requirements, and it does not enforce compliance or notify any authority. You remain responsible for actual inspections and regulatory compliance.',
      ],
    },
    {
      heading: '4. No warranty',
      paragraphs: [
        'The app is provided "as is" and "as available", without warranties of any kind, express or implied, including fitness for a particular purpose and accuracy of any indicative interval or status.',
      ],
    },
    {
      heading: '5. Limitation of liability',
      paragraphs: [
        `To the maximum extent permitted by law, ${APP_CONFIG.company} shall not be liable for any indirect, incidental or consequential loss, or any loss of data, arising from use of or inability to use the app.`,
      ],
    },
    {
      heading: '6. Changes',
      paragraphs: [
        'We may update these Terms and the app. Continued use after an update constitutes acceptance of the revised Terms.',
      ],
    },
    {
      heading: '7. Contact',
      paragraphs: [`${APP_CONFIG.company} — ${APP_CONFIG.email} — ${APP_CONFIG.website}.`],
    },
  ],
};
