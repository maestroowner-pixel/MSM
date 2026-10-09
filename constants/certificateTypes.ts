// ===================================
// Suggested names for crew and vessel certificates.
//
// Suggestions, not a closed list: a chip fills the name field and the officer can
// type anything else. The point is that the same document is spelt the same way
// on every device, so a list sorted or searched by name groups it together —
// "ENG1", "Eng 1 medical" and "Medical (ENG1)" are one certificate to a person
// and three to a search.
//
// Names follow what is printed on the document and what a PSC officer asks for,
// not an internal code. The crew list covers the yacht case first (STCW basic
// training, ENG1, CoC) because that is the first customer; a commercial ship adds
// its own by typing.
// ===================================

export const CREW_CERT_TYPES: string[] = [
  'STCW Basic Safety Training',
  'Proficiency in Security Awareness',
  'Advanced Fire Fighting',
  'Proficiency in Survival Craft (PSC&RB)',
  'Medical First Aid',
  'Medical Care',
  'Certificate of Competency (CoC)',
  'Endorsement (flag)',
  'GMDSS',
  'ENG1 / Seafarer medical',
  'Passport',
  "Seaman's book",
  'Visa',
];

export const VESSEL_CERT_TYPES: string[] = [
  'Certificate of Registry',
  'Safety Management Certificate (SMC)',
  'Document of Compliance (DOC)',
  'International Ship Security Certificate (ISSC)',
  'Maritime Labour Certificate (MLC)',
  'Load Line Certificate',
  'Safety Equipment Certificate',
  'Safety Construction Certificate',
  'Safety Radio Certificate',
  'IOPP Certificate',
  'ISPP (Sewage) Certificate',
  'IAPP Certificate',
  'Minimum Safe Manning Document',
  'Class Certificate',
  'Ship Radio Licence',
  'Insurance (P&I / Hull)',
];
