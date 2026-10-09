// ===================================
// Legal content — Privacy Policy, Terms of Use, and the disclaimer points
// shown in the first-launch consent gate. Bump LEGAL_VERSION to force re-consent.
// ===================================

import { APP_CONFIG } from '../theme';

// 2 (7 Oct 2026): who KukaLab is, Feedback, governing law — everyone accepts again.
export const LEGAL_VERSION = 2;
export const LEGAL_ACCEPTED_KEY = `msm:legal_accepted_v${LEGAL_VERSION}`;
export const EFFECTIVE_DATE = '9 October 2026';

/**
 * Who provides the app — required in both documents (Spain's LSSI art. 10 for
 * the Terms, GDPR art. 13 for the Privacy Policy). One place, so moving to a
 * business address later is a one-line change here.
 */
export const PROVIDER = {
  name: 'Mykhaylo Osypov',
  status: 'self-employed (autónomo), Spain',
  nif: 'ESZ0095260E',
  address: 'Rúa Uruguai 8, 5, 15404 Ferrol, Spain',
};
const PROVIDER_LINE = `${PROVIDER.name}, ${PROVIDER.status} — NIF ${PROVIDER.nif} — ${PROVIDER.address}`;

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
        'Crew records the vessel chooses to keep: crew names and ranks, the accounts the Master issues (a name and an 8-digit PIN), the name, date and time on every signed inspection, and crew certificates — the type of document, its number, issuer, issue and expiry dates, and a scan or photo if one is attached. These are entered by the vessel, for the vessel\'s own compliance records.',
        'No email address, phone number or location is required to use the app, and the app does not collect them.',
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
        'When a device joins a vessel, the register, certificates (including crew certificates and their attached files), inspection records, crew list and vessel information are sent to and retrieved from Google Firebase (Authentication, Firestore and Cloud Storage), stored under an account tied to the vessel\'s IMO number. Google processes this data as our infrastructure provider, subject to Google\'s terms.',
        'A random device identifier is generated so the Master can approve each device.',
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
        `The data controller is ${PROVIDER_LINE}, trading as ${APP_CONFIG.company}. For privacy questions write to ${APP_CONFIG.email} (${APP_CONFIG.website}).`,
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
        `${APP_CONFIG.company} is the trading name of Mykhaylo Osypov, a self-employed developer (autónomo) registered in Spain, who provides the app. "${APP_CONFIG.company}", "we" and "us" in these Terms mean him.`,
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
      heading: '6. Feedback',
      paragraphs: [
        `If you send us suggestions, ideas, feature requests or other feedback about the app ("Feedback"), you assign to ${APP_CONFIG.company} all rights in that Feedback, and we may use, change and include it in the app or any other product without restriction, payment or attribution. Where such an assignment is not possible under applicable law, you grant us a perpetual, irrevocable, worldwide, royalty-free licence to do so.`,
        'Please do not include in Feedback anything you are not free to share, such as confidential information of your vessel, its owner or your employer.',
      ],
    },
    {
      heading: '7. Governing law',
      paragraphs: [
        'These Terms are governed by the laws of Spain. If you use the app as a consumer, this does not take away the protection of the mandatory laws of the country where you live, and you may bring a claim in its courts.',
      ],
    },
    {
      heading: '8. Changes',
      paragraphs: [
        'We may update these Terms and the app. Continued use after an update constitutes acceptance of the revised Terms.',
      ],
    },
    {
      heading: '9. Contact',
      paragraphs: [`${APP_CONFIG.company} — ${PROVIDER_LINE} — ${APP_CONFIG.email} — ${APP_CONFIG.website}.`],
    },
  ],
};
