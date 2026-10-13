// ===================================
// The medicine chest scale — taken from Marine Hospital Manager (the same
// author, /Volumes/Z/MarineHospitalManager, 13 Oct 2026: "there is a lot of
// information there already"). Regenerate rather than edit by hand.
//
//   MED_SCALE      75 medicines from WHO IMGS 3rd edition with the quantity
//                  required for each hospital category — C up to 20 persons,
//                  B 21–45, A 46 and more (Marshall Islands MN 7-042-1 per 10
//                  crew, scaled ×1.5 / ×3 / ×6); no quantity = not required in
//                  that category. ATC code; controlled drugs marked; the IMGS
//                  reference (indications, dosage, contraindications, consult a
//                  doctor) where there is one.
//   NURSING_SCALE  83 items of medical equipment and dressings, IMGS codes
//                  (II.x.xx), the legal quantity, and a note on use and care.
//
// A starting point: the flag state's own scale and the ship's supplier have
// the last word, and the vessel edits the quantities.
// ===================================

export type HospitalCategory = 'A' | 'B' | 'C';

export interface ScaleMedicine {
  name: string;
  /** Form and strength — "tablet 300mg". */
  strength: string;
  form: string;
  indication: string;
  group: string;
  atc?: string;
  who?: string;
  controlled?: boolean;
  req: Partial<Record<HospitalCategory, number>>;
  ref?: string;
}

export interface ScaleNursing {
  code: string;
  name: string;
  description: string;
  group: string;
  qty: number;
  ref?: string;
}

export const HOSPITAL_CATEGORY_LABEL: Record<HospitalCategory, string> = {
  C: 'Category C — up to 20 persons',
  B: 'Category B — 21 to 45 persons',
  A: 'Category A — 46 persons and more',
};

export const MED_SCALE: ScaleMedicine[] = [
 {
  "name": "Acetylsalicylic acid",
  "strength": "tablet 300mg",
  "form": "tablet",
  "indication": "pain, fever, inflammation, blood clots",
  "group": "Cardiovascular",
  "atc": "N02BA01",
  "who": "W.H.O. 2.1",
  "req": {
   "B": 150,
   "A": 300
  },
  "ref": "Also known as: Aspirin®, Aspro®\nForm & Strength: tablet 300 mg\nIndications: high dose (600–900 mg): to reduce pain, fever, inﬂammation; low dose (100–150 mg) to inhibit formation of blood clots in angina pectoris, myocardial infarction,; stroke\nContraindications: peptic ulcer, history of gastrointestinal bleeding, haemophilia, fever in patients under 18, trauma\nDosage: for pain and inﬂammation: 2–3 tablets every 4–6 hours; for thrombosis: half a tablet daily\nConsult doctor: no"
 },
 {
  "name": "Adrenaline",
  "strength": "ampoule 1:1000 (1mg/ml)",
  "form": "ampoule",
  "indication": "anaphylaxis, severe asthma",
  "group": "Cardiovascular",
  "atc": "C01CA24",
  "who": "W.H.O. 1.3.1",
  "req": {
   "C": 7,
   "B": 15,
   "A": 60
  },
  "ref": "Also known as: epinephrine, adrenaline 1:1000\nForm & Strength: ampoule 1 ml = 1 mg\nIndications: to raise blood pressure in anaphylaxis; to dilate airways in severe asthma or anaphylaxis\nContraindications: none in emergencies\nDosage: for anaphylaxis: 0.5 ml, IM, repeated every 5 minutes if needed; for severe asthma: 0.5 ml, IM, repeated every 5 minutes if needed\nConsult doctor: yes, if possible, but do not delay use in emergency"
 },
 {
  "name": "Atropine",
  "strength": "ampoule 1.2mg/ml or 0.5mg/ml",
  "form": "ampoule",
  "indication": "slow heart rate in MI, organophosphate poisoning",
  "group": "Cardiovascular",
  "atc": "A03BA01",
  "req": {
   "B": 15,
   "A": 60
  },
  "ref": "Form & Strength: ampoule 1.2 mg/ml\nIndications: to treat slow heart rate in myocardial infarction; to treat organophosphate insecticide poisoning\nContraindications: none in emergencies\nDosage: for slow heart rate in myocardial infarction: 0.6 mg IM or IV\nConsult doctor: no, in emergencies; yes, in organophosphate insecticide poisoning"
 },
 {
  "name": "Frusemide",
  "strength": "ampoule 40mg/4ml",
  "form": "ampoule",
  "indication": "pulmonary oedema, cardiac failure",
  "group": "Cardiovascular",
  "atc": "C03CA01",
  "req": {
   "B": 15,
   "A": 30
  },
  "ref": "Also known as: Lasix®, furosemide\nForm & Strength: ampoule 4 ml = 40 mg\nIndications: to treat severe ﬂuid retention in lungs (pulmonary oedema) due to cardiac failure\nContraindications: none in an emergency\nDosage: 40 mg IV over 10 minutes or (less desirable) IM; repeat in 1 hour if necessary\nConsult doctor: yes, after ﬁrst dose"
 },
 {
  "name": "Isosorbide dinitrate",
  "strength": "tablet 5mg sublingual",
  "form": "tablet",
  "indication": "angina pectoris, myocardial infarction",
  "group": "Cardiovascular",
  "atc": "C01DA08",
  "req": {
   "C": 7,
   "B": 30,
   "A": 60
  },
  "ref": "Also known as: Cedocard®, Isordil®\nForm & Strength: tablet 5 mg\nIndications: to treat angina pectoris (chest pain); to treat myocardial infarction\nContraindications: hypotension (low blood pressure); known heart valve disease; head injury; treatment with sildenaﬁl (Viagra) and similar drugs\nDosage: no; 1 tablet, sublingual, repeated once after 10 minutes if pain persists; to be used preventively if possible before activity likely to cause angina"
 },
 {
  "name": "Lidocaine 2%",
  "strength": "ampoule 2% (50mg/ml), 10ml",
  "form": "ampoule",
  "indication": "control of ventricular arrhythmias",
  "group": "Cardiovascular",
  "atc": "C01BB01",
  "req": {
   "B": 15,
   "A": 30
  }
 },
 {
  "name": "Bisacodyl",
  "strength": "tablet 5mg",
  "form": "tablet",
  "indication": "constipation",
  "group": "Gastrointestinal",
  "atc": "A06AB02",
  "req": {
   "C": 15,
   "B": 60,
   "A": 120
  }
 },
 {
  "name": "Hyoscine butylbromide",
  "strength": "tablet 10mg",
  "form": "tablet",
  "indication": "smooth muscle spasm, abdominal colic",
  "group": "Gastrointestinal",
  "atc": "A03BB01",
  "req": {
   "C": 15,
   "B": 60,
   "A": 120
  }
 },
 {
  "name": "Loperamide",
  "strength": "capsule 2mg",
  "form": "capsule",
  "indication": "diarrhoea",
  "group": "Gastrointestinal",
  "atc": "A07DA03",
  "req": {
   "C": 15,
   "B": 90,
   "A": 180
  },
  "ref": "Also known as: Imodium®, Diacure®\nForm & Strength: tablet 2 mg\nIndications: to treat symptoms of diarrhoea\nContraindications: bowel obstruction; dysentery; acute ulcerative colitis\nDosage: starting dose 4 mg; then 2 mg with each diarrhoeal motion up to 16 mg (= 8 capsules) per 24 hours\nConsult doctor: no"
 },
 {
  "name": "Omeprazole",
  "strength": "tablet 20mg",
  "form": "tablet",
  "indication": "gastro-oesophageal reflux, peptic ulcer",
  "group": "Gastrointestinal",
  "atc": "A02BC01",
  "req": {
   "B": 90,
   "A": 180
  },
  "ref": "Also known as: Losec®, Prilosec®\nForm & Strength: tablet 20 mg\nIndications: to treat gastro-oesophageal reﬂux; to treat peptic ulcer disease\nDosage: no; starting dose 20 mg once daily before a meal, preferably in the evening; dose increased to 40 mg daily if symptoms persist"
 },
 {
  "name": "Codeine",
  "strength": "tablet 30mg",
  "form": "tablet",
  "indication": "moderate pain",
  "group": "Pain & fever",
  "atc": "R05DA04",
  "controlled": true,
  "req": {
   "C": 22,
   "B": 90,
   "A": 300
  }
 },
 {
  "name": "Diclofenac",
  "strength": "tablet 50mg",
  "form": "tablet",
  "indication": "pain, inflammation",
  "group": "Pain & fever",
  "atc": "M01AB05",
  "req": {
   "C": 22,
   "B": 90,
   "A": 300
  }
 },
 {
  "name": "Morphine sulfate",
  "strength": "ampoule 10mg/ml",
  "form": "ampoule",
  "indication": "severe pain",
  "group": "Pain & fever",
  "atc": "N02AA01",
  "controlled": true,
  "req": {
   "B": 30,
   "A": 60
  }
 },
 {
  "name": "Paracetamol",
  "strength": "tablet 500mg",
  "form": "tablet",
  "indication": "pain, fever",
  "group": "Pain & fever",
  "atc": "N02BE01",
  "req": {
   "C": 37,
   "B": 150,
   "A": 600
  }
 },
 {
  "name": "Paracetamol/Codeine",
  "strength": "tablet 500/30mg",
  "form": "tablet",
  "indication": "moderate to severe pain",
  "group": "Pain & fever",
  "atc": "N02BE51",
  "controlled": true,
  "req": {
   "C": 22,
   "B": 90,
   "A": 300
  }
 },
 {
  "name": "Oral rehydration salts",
  "strength": "sachet per sachet",
  "form": "sachet",
  "indication": "diarrhoea, dehydration",
  "group": "Rehydration",
  "atc": "A07CA",
  "req": {
   "C": 15,
   "B": 150,
   "A": 450
  },
  "ref": "Also known as: Repolyte®, Gastrolyte®, Dioralyte®\nForm & Strength: sachets of powder for reconstitution\nIndications: to prevent or treat dehydration, especially due to diarrhoea\nDosage: no; as recommended in IMGS3; correct amount of boiled, cooled tap water (not less water than speciﬁed) to be added to the"
 },
 {
  "name": "Sodium chloride 0.9%",
  "strength": "IV solution 0.9% 1000ml",
  "form": "IV solution",
  "indication": "dehydration, shock",
  "group": "Rehydration",
  "atc": "B05BB01",
  "req": {
   "B": 3,
   "A": 30
  },
  "ref": "Also known as: NaCl 0.9%, saline solution\nForm & Strength: plastic bottle, 1 litre\nIndications: for ﬂuid replacement\nDosage: see appropriate IMGS3 text or as advised by a doctor\nConsult doctor: as soon as possible but not in emergencies if used in accordance with IMGS3 recommendations"
 },
 {
  "name": "Prednisolone",
  "strength": "tablet 5mg",
  "form": "tablet",
  "indication": "severe asthma, allergic reactions",
  "group": "Respiratory",
  "atc": "H02AB06",
  "req": {
   "B": 90,
   "A": 180
  }
 },
 {
  "name": "Salbutamol",
  "strength": "inhaler 100µg per dose",
  "form": "inhaler",
  "indication": "asthma, breathlessness",
  "group": "Respiratory",
  "atc": "R03AC02",
  "req": {
   "B": 3,
   "A": 6
  },
  "ref": "Also known as: albuterol, Ventolin®, Proventil®\nForm & Strength: inhaler 0.1 mg/dose with volume spacer\nIndications: to treat asthma; to treat chronic bronchitis; to treat emphysema; to treat other lung diseases\nDosage: for symptoms: 2 puﬀs every 4 hours up to 12 puﬀs maximum per day; in severe asthma, up to 10 puﬀs repeated every 15 minutes\nConsult doctor: no"
 },
 {
  "name": "Amoxicillin + clavulanate",
  "strength": "tablet 875mg/125mg",
  "form": "tablet",
  "indication": "infections responsive to antibiotic",
  "group": "Anti-infective",
  "atc": "J01CR02",
  "req": {
   "B": 30,
   "A": 120
  },
  "ref": "Dosage: one tablet twice daily, taken with food.\nConsult doctor: no, if used according to IMGS3 recommendations"
 },
 {
  "name": "Azithromycin",
  "strength": "tablet 500mg",
  "form": "tablet",
  "indication": "respiratory tract infections, sexually transmitted infections",
  "group": "Anti-infective",
  "atc": "J01FA10",
  "req": {
   "B": 15,
   "A": 60
  },
  "ref": "Also known as: Zithromax®\nForm & Strength: tablet 500 mg\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to erythromycin or similar (macrolide) antibiotics\nDosage: as recommended in IMGS3 for the speciﬁc infection\nConsult doctor: no, if used according to instructions in IMGS3"
 },
 {
  "name": "Ceftriaxone",
  "strength": "ampoule 1g per vial",
  "form": "ampoule",
  "indication": "severe bacterial infections",
  "group": "Anti-infective",
  "atc": "J01DD04",
  "req": {
   "B": 15,
   "A": 90
  },
  "ref": "Also known as: Rocephin®\nForm & Strength: ampoule 1 g powder for injection (dissolve in water for injection)\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to cephalosporin or penicillin antibiotics\nDosage: as recommended in IMGS3 for the speciﬁc infection\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Ciprofloxacin",
  "strength": "tablet 500mg",
  "form": "tablet",
  "indication": "urinary tract infections, bacterial diarrhoea",
  "group": "Anti-infective",
  "atc": "J01MA02",
  "req": {
   "B": 30,
   "A": 120
  }
 },
 {
  "name": "Clotrimazole",
  "strength": "cream 1%",
  "form": "cream",
  "indication": "fungal skin infections",
  "group": "Anti-infective",
  "atc": "D01AC01",
  "req": {
   "C": 15,
   "B": 60,
   "A": 120
  }
 },
 {
  "name": "Doxycycline",
  "strength": "capsule 100mg",
  "form": "capsule",
  "indication": "respiratory infections, malaria prophylaxis",
  "group": "Anti-infective",
  "atc": "J01AA02",
  "req": {
   "A": 60
  },
  "ref": "Dosage: no, if used according to IMGS3 instructions; as recommended in IMGS3 for the speciﬁc infection; 1 tablet with 300 ml water"
 },
 {
  "name": "Fluconazole",
  "strength": "capsule 150mg",
  "form": "capsule",
  "indication": "fungal infections",
  "group": "Anti-infective",
  "atc": "J02AC01",
  "req": {
   "B": 30,
   "A": 60
  }
 },
 {
  "name": "Metronidazole",
  "strength": "tablet 400mg",
  "form": "tablet",
  "indication": "protozoal infections, bacterial vaginosis",
  "group": "Anti-infective",
  "atc": "P01AB01",
  "req": {
   "B": 60,
   "A": 180
  },
  "ref": "Also known as: Flagyl®\nForm & Strength: tablet 500 mg\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to metronidazole\nDosage: as recommended in IMGS3 for the speciﬁc infection; to be taken with food if possible to minimize unwanted eﬀects\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Aciclovir",
  "strength": "tablet 400mg",
  "form": "tablet",
  "indication": "herpes simples/zoster",
  "group": "Anti-infective",
  "atc": "J05AB01",
  "req": {
   "B": 105,
   "A": 420
  },
  "ref": "Also known as: Zovirax®, acyclovir\nForm & Strength: tablet 400 mg\nIndications: treatment of primary or recurrent herpes simplex virus infection; may be useful for severe varicella and herpes zoster (doctor should be consulted)\nDosage: 400 mg 3 times daily for 5–10 days for primary infection or for 3–5 days for recurrence\nConsult doctor: not if used according to IMGS3 recommendations"
 },
 {
  "name": "Cetirizine",
  "strength": "tablet 10mg",
  "form": "tablet",
  "indication": "hay fever, hives, allergic dermatitis",
  "group": "Allergy",
  "atc": "R06AE07",
  "req": {
   "B": 90,
   "A": 180
  },
  "ref": "Also known as: Zyrtec®\nForm & Strength: tablet 10 mg\nIndications: to treat allergy symptoms in hay fever, hives, allergic dermatitis, etc.\nContraindications: allergy to cetirizine\nDosage: 10 mg daily up to a maximum of 20 mg daily\nConsult doctor: no"
 },
 {
  "name": "Chlorphenamine",
  "strength": "tablet 4mg",
  "form": "tablet",
  "indication": "allergy, allergic reactions",
  "group": "Allergy",
  "atc": "R06AB04",
  "req": {
   "C": 15,
   "B": 60,
   "A": 120
  }
 },
 {
  "name": "Hydrocortisone 1%",
  "strength": "cream 1%",
  "form": "cream",
  "indication": "inflammatory skin conditions",
  "group": "Allergy",
  "atc": "D07AA02",
  "req": {
   "B": 90,
   "A": 360
  },
  "ref": "Form & Strength: cream\nIndications: to treat allergy and some other inﬂammatory skin conditions\nContraindications: open wounds or skin infections caused by bacteria, viruses or fungi\nDosage: to be applied sparingly twice daily; after a few days, application to be reduced to once a day\nConsult doctor: no, unless use exceeds one week"
 },
 {
  "name": "Miconazole 2%",
  "strength": "cream 2%",
  "form": "cream",
  "indication": "fungal skin infections",
  "group": "Dermatology",
  "atc": "D01AC02",
  "req": {
   "B": 90,
   "A": 360
  },
  "ref": "Also known as: Daktarin®, Dermacure®, Monistat®\nForm & Strength: cream\nIndications: to treat fungal skin infections\nContraindications: allergy to miconazole\nDosage: a thin ﬁlm to be applied twice daily then for 2 weeks after symptoms have gone; hands should be washed promptly after use\nConsult doctor: no"
 },
 {
  "name": "Silver sulfadiazine 1%",
  "strength": "cream 1%",
  "form": "cream",
  "indication": "burns, infected wounds",
  "group": "Dermatology",
  "atc": "D06BA01",
  "req": {
   "C": 75,
   "B": 300,
   "A": 1200
  }
 },
 {
  "name": "Calamine lotion",
  "strength": "lotion per ml",
  "form": "lotion",
  "indication": "itching, sunburn",
  "group": "Dermatology",
  "atc": "D04",
  "req": {
   "C": 150,
   "B": 450,
   "A": 1200
  }
 },
 {
  "name": "Zinc oxide",
  "strength": "paste/ointment 20%",
  "form": "paste/ointment",
  "indication": "irritated skin",
  "group": "Dermatology",
  "atc": "D02AB",
  "req": {
   "C": 150,
   "B": 300,
   "A": 1200
  },
  "ref": "Form & Strength: paste or ointment, 20%\nIndications: protection of irritated skin\nDosage: apply liberally to aﬀected skin twice daily and after washing\nConsult doctor: no"
 },
 {
  "name": "Povidone iodine",
  "strength": "liquid 10%",
  "form": "liquid",
  "indication": "disinfect skin/wounds",
  "group": "Dermatology",
  "atc": "D08AG02",
  "req": {
   "C": 150,
   "B": 300,
   "A": 600
  },
  "ref": "Also known as: Betadine®, Povidine®\nForm & Strength: ointment, liquid\nIndications: to disinfect skin and wounds\nContraindications: allergy to iodine\nDosage: ointment to be applied thinly with gauze 1–2 times a day\nConsult doctor: no"
 },
 {
  "name": "Povidone iodine",
  "strength": "ointment 10%",
  "form": "ointment",
  "indication": "disinfect skin/wounds",
  "group": "Dermatology",
  "atc": "D08AG02",
  "req": {
   "B": 75,
   "A": 150
  },
  "ref": "Also known as: Betadine®, Povidine®\nForm & Strength: ointment, liquid\nIndications: to disinfect skin and wounds\nContraindications: allergy to iodine\nDosage: ointment to be applied thinly with gauze 1–2 times a day\nConsult doctor: no"
 },
 {
  "name": "Tetracycline 1%",
  "strength": "eye ointment 1% (5g)",
  "form": "eye ointment",
  "indication": "minor eye infections, prevent corneal infections",
  "group": "Eye & ear",
  "atc": "S01AA09",
  "req": {
   "C": 1,
   "B": 3,
   "A": 12
  },
  "ref": "Form & Strength: ointment\nIndications: to treat minor eye infections; to prevent infection following damage to the cornea\nContraindications: allergy to tetracyclines\nDosage: 1 cm ointment to be applied twice daily to inner surface of lower eyelid\nConsult doctor: not if used according to IMGS3 recommendations"
 },
 {
  "name": "Tropicamide 0.5%",
  "strength": "eye drops 0.5%",
  "form": "eye drops",
  "indication": "eye examinations",
  "group": "Eye & ear",
  "atc": "S01FA06",
  "req": {
   "B": 60,
   "A": 120
  }
 },
 {
  "name": "Fluorescein",
  "strength": "eye strips 1%",
  "form": "eye strips",
  "indication": "detect corneal damage",
  "group": "Eye & ear",
  "atc": "S01JA01",
  "req": {
   "B": 60,
   "A": 120
  }
 },
 {
  "name": "Cinnarizine",
  "strength": "tablet 15mg",
  "form": "tablet",
  "indication": "motion sickness, vertigo",
  "group": "Nervous system",
  "atc": "N07CA02",
  "req": {
   "C": 45,
   "B": 150,
   "A": 300
  }
 },
 {
  "name": "Diazepam",
  "strength": "tablet 5mg",
  "form": "tablet",
  "indication": "anxiety, muscle spasms, seizures",
  "group": "Nervous system",
  "atc": "N05BA01",
  "controlled": true,
  "req": {
   "B": 60,
   "A": 300
  },
  "ref": "Also known as: Valium®\nForm & Strength: tablet 5 mg\nIndications: to treat alcohol withdrawal\nContraindications: severe respiratory disease; opioid intoxication; severe liver disease; myasthenia gravis\nDosage: see IMGS3, Chapter 22, Tobacco, alcohol, and drug use\nConsult doctor: no"
 },
 {
  "name": "Diazepam",
  "strength": "ampoule 10mg/2ml",
  "form": "ampoule",
  "indication": "severe anxiety, status epilepticus",
  "group": "Nervous system",
  "atc": "N05BA01",
  "controlled": true,
  "req": {
   "B": 15,
   "A": 60
  },
  "ref": "Also known as: Valium®\nForm & Strength: tablet 5 mg\nIndications: to treat alcohol withdrawal\nContraindications: severe respiratory disease; opioid intoxication; severe liver disease; myasthenia gravis\nDosage: see IMGS3, Chapter 22, Tobacco, alcohol, and drug use\nConsult doctor: no"
 },
 {
  "name": "Haloperidol",
  "strength": "ampoule 5mg/ml",
  "form": "ampoule",
  "indication": "psychosis, severe agitation",
  "group": "Nervous system",
  "atc": "N05AD01",
  "req": {
   "B": 15,
   "A": 30
  },
  "ref": "Dosage: 2–10 mg IM, repeated every 2–6 hours if needed; maximum: 15 mg in 24 hours\nConsult doctor: yes, except in emergencies"
 },
 {
  "name": "Midazolam",
  "strength": "ampoule 5mg/ml",
  "form": "ampoule",
  "indication": "epileptic fits",
  "group": "Nervous system",
  "atc": "N05CD08",
  "req": {
   "B": 15,
   "A": 60
  },
  "ref": "Also known as: Hypnovel®\nForm & Strength: ampoule 1 ml (= 5 mg)\nIndications: to terminate epileptic ﬁts\nDosage: 0.1–0.2 mg/kg body weight IM or 10 mg intranasally; two ampoules should be opened and one drop allowed to drip into alternate nostrils until; ampoules are empty\nConsult doctor: no, for emergencies, yes, for repeated use"
 },
 {
  "name": "Glucose 10%",
  "strength": "IV solution 10% 500ml",
  "form": "IV solution",
  "indication": "hypoglycaemia",
  "group": "Emergency",
  "atc": "B05BA03",
  "req": {
   "B": 6,
   "A": 30
  }
 },
 {
  "name": "Activated charcoal",
  "strength": "powder 50g per dose",
  "form": "powder",
  "indication": "poisoning, drug overdose",
  "group": "Emergency",
  "atc": "A07BA01",
  "req": {
   "B": 360,
   "A": 720
  },
  "ref": "Form & Strength: 50 g in 300 ml puriﬁed water\nIndications: to absorb ingested poisons\nContraindications: bowel obstruction\nDosage: 1 g/kg orally up to a maximum of 100 g for ﬁrst dose; for repeat doses, 50 g every 4 hours, if advised by a doctor\nConsult doctor: yes"
 },
 {
  "name": "Glucagon",
  "strength": "ampoule 1mg",
  "form": "ampoule",
  "indication": "hypoglycaemia",
  "group": "Emergency",
  "atc": "H04AA01",
  "req": {
   "B": 3,
   "A": 6
  },
  "ref": "Also known as: Haldol®\nForm & Strength: ampoule 1 ml = 5 mg\nIndications: to treat psychotic hallucinations and delusions; to treat severe agitation and aggressiveness\nDosage: 1 mg IM or SC: response should occur within 15 minutes\nConsult doctor: not if used in accordance with IMGS3 recommendations"
 },
 {
  "name": "Naloxone",
  "strength": "ampoule 0.4mg/ml",
  "form": "ampoule",
  "indication": "opiate overdose",
  "group": "Emergency",
  "atc": "V03AB15",
  "req": {
   "B": 15,
   "A": 60
  },
  "ref": "Also known as: Narcan®\nForm & Strength: ampoule 1 ml (= 0.4 mg)\nIndications: to reverse eﬀects of opioids, especially in cases of overdose\nDosage: 0.4 mg IM, repeated as needed; response should be rapid: if no response to 5 doses, diagnosis is not opioid overdose\nConsult doctor: not in emergencies"
 },
 {
  "name": "Dexamethasone",
  "strength": "ampoule 4mg/ml",
  "form": "ampoule",
  "indication": "severe asthma, anaphylaxis",
  "group": "Emergency",
  "atc": "H02AB02",
  "req": {
   "B": 3,
   "A": 18
  },
  "ref": "Also known as: Decadron®\nForm & Strength: ampoule 4mg/ml\nIndications: to treat life-threatening and severe asthma; to treat anaphylaxis; to treat severe allergic reactions\nContraindications: none in emergencies\nDosage: for anaphylaxis and life-threatening asthma: 4 mg IM or IV; otherwise as advised by a doctor\nConsult doctor: not in anaphylaxis or in life-threatening asthma; yes, otherwise"
 },
 {
  "name": "Eugenol",
  "strength": "liquid 10ml",
  "form": "liquid",
  "indication": "dental pain relief",
  "group": "Dental",
  "atc": "N01BX02",
  "req": {
   "C": 15,
   "B": 30,
   "A": 60
  }
 },
 {
  "name": "Cloves, oil of",
  "strength": "liquid 10ml",
  "form": "liquid",
  "indication": "toothache",
  "group": "Dental",
  "atc": "N01BX",
  "req": {
   "B": 30,
   "A": 60
  },
  "ref": "Also known as: Syzygium aromaticum\nForm & Strength: oil\nIndications: toothache\nDosage: to be applied to aﬀected tooth with cotton wool soaked in oil of cloves\nConsult doctor: no"
 },
 {
  "name": "Tetanus toxoid",
  "strength": "ampoule 0.5ml",
  "form": "ampoule",
  "indication": "tetanus prevention",
  "group": "Vaccines",
  "atc": "J07AM01",
  "req": {
   "A": 30
  }
 },
 {
  "name": "Clotrimazole pessaries",
  "strength": "pessary 500mg",
  "form": "pessary",
  "indication": "vaginal thrush",
  "group": "Women's health",
  "atc": "G01AF02",
  "req": {
   "B": 18,
   "A": 72
  }
 },
 {
  "name": "Misoprostol",
  "strength": "tablet 200µg",
  "form": "tablet",
  "indication": "post-partum hemorrhage",
  "group": "Women's health",
  "atc": "A02BB01",
  "req": {
   "B": 9,
   "A": 18
  },
  "ref": "Also known as: Cytotec®\nForm & Strength: tablet 200 μg\nIndications: to prevent post-partum haemorrhage\nContraindications: none if given according to IMGS3 recommendations\nDosage: 600 μg orally immediately after delivery\nConsult doctor: no"
 },
 {
  "name": "Ibuprofen",
  "strength": "tablet 400mg",
  "form": "tablet",
  "indication": "inflammation, pain",
  "group": "Pain & fever",
  "atc": "M01AE01",
  "req": {
   "C": 75,
   "B": 150,
   "A": 600
  },
  "ref": "Also known as: Advil®, Actifen®, Nerofen®, Genpril®, Haltran®, Medipren®, Brufen®\nForm & Strength: coated tablet 400 mg\nIndications: to treat inﬂammation; to reduce mild-to-moderate pain, especially if associated with inﬂammation\nContraindications: peptic ulcer; gastrointestinal bleeding; kidney failure; liver failure\nDosage: no; 400–800 mg every 6 hours; maximum 3200 mg (= 8 tablets) per 24 hours"
 },
 {
  "name": "Ondansetron",
  "strength": "tablet 4mg",
  "form": "tablet",
  "indication": "vomiting, sea-sickness",
  "group": "Gastrointestinal",
  "atc": "A04AA01",
  "req": {
   "C": 15,
   "B": 30,
   "A": 60
  },
  "ref": "Also known as: Zofran®\nForm & Strength: tablet 4 mg\nIndications: to prevent vomiting; to prevent seasickness\nDosage: one tablet, preferably taken before the stimulus to vomiting\nConsult doctor: not for single doses"
 },
 {
  "name": "Permethrin 1%",
  "strength": "lotion 1%",
  "form": "lotion",
  "indication": "lice",
  "group": "Dermatology",
  "atc": "P03AC04",
  "req": {
   "B": 300,
   "A": 1200
  },
  "ref": "Also known as: Loxazol®, Elimite®, Nix®\nForm & Strength: lotion\nIndications: to eliminate hair, pubic, and body lice\nDosage: no; to be applied to washed, damp hair or skin, rubbed in, left for 10 minutes, then rinsed oﬀ; a ﬁne-tooth comb should be used to remove eggs"
 },
 {
  "name": "Permethrin 5%",
  "strength": "lotion 5%",
  "form": "lotion",
  "indication": "scabies",
  "group": "Dermatology",
  "atc": "P03AC04",
  "req": {
   "B": 300,
   "A": 1800
  }
 },
 {
  "name": "Prednisone",
  "strength": "tablet 25mg",
  "form": "tablet",
  "indication": "asthma, inflammatory conditions",
  "group": "Respiratory",
  "atc": "H02AB07",
  "req": {
   "B": 90,
   "A": 180
  },
  "ref": "Also known as: prednisolone\nForm & Strength: tablet 25 mg\nIndications: to treat severe asthma; to treat other inﬂammatory conditions (on medical advice)\nDosage: see under Asthma in IMGS3, Chapter 15, Respiratory diseases; to be taken with food\nConsult doctor: not if used in accordance with IMGS3 recommendations"
 },
 {
  "name": "Vitamin K",
  "strength": "ampoule 10mg/ml",
  "form": "ampoule",
  "indication": "reverse warfarin or similar",
  "group": "Cardiovascular",
  "atc": "B02BA01",
  "req": {
   "B": 6,
   "A": 12
  },
  "ref": "Also known as: Konakion®, phytomenadione\nForm & Strength: ampoule 1 ml = 10 mg\nIndications: to reverse excessive or unwanted eﬀect of warfarin or related drugs\nDosage: for life-threatening situations (trauma, major bleeding): 10 mg orally or IM; for minor bleeding: 1–2 mg orally\nConsult doctor: yes"
 },
 {
  "name": "Water for injection",
  "strength": "ampoule 5ml",
  "form": "ampoule",
  "indication": "reconstitute injection",
  "group": "Emergency",
  "atc": "V07AB",
  "req": {
   "B": 15,
   "A": 90
  },
  "ref": "Form & Strength: ampoule 5 ml\nIndications: reconstitution of injectable drugs provided as powders"
 },
 {
  "name": "Zidovudine + lamivudine",
  "strength": "tablet 300mg/150mg",
  "form": "tablet",
  "indication": "needle-stick injury prophylaxis",
  "group": "Anti-infective",
  "atc": "J05AR01",
  "req": {
   "B": 168,
   "A": 336
  },
  "ref": "Also known as: Combivir®\nForm & Strength: tablet, 300 mg + 150 mg\nIndications: prophylaxis against HIV infection after needle-stick injury\nContraindications: allergy to either component; pre-existing HIV infection\nDosage: one tablet twice daily for four weeks\nConsult doctor: yes"
 },
 {
  "name": "Mebendazole",
  "strength": "tablet 100mg",
  "form": "tablet",
  "indication": "intestinal worms",
  "group": "Anti-infective",
  "atc": "P02CA01",
  "req": {
   "B": 18,
   "A": 36
  },
  "ref": "Also known as: Vermox®\nForm & Strength: tablet 100 mg\nIndications: to treat intestinal worm infections; not eﬀective for tapeworm infection or hydatid disease\nContraindications: allergy to mebendazole\nDosage: as recommended in IMGS3 for the speciﬁc infection; to be taken with food\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Metoprolol",
  "strength": "tablet 100mg",
  "form": "tablet",
  "indication": "HTN, AF, angina, migraine",
  "group": "Cardiovascular",
  "atc": "C07AB02",
  "req": {
   "A": 360
  },
  "ref": "Also known as: Selokeen®, Lopresor®, Toprol XL®, Betaloc®\nForm & Strength: tablet 100 mg\nIndications: to treat hypertension (high blood pressure); to treat atrial ﬁbrillation (irregular or rapid heart rate); to treat angina pectoris (chest pain); to prevent migraine.\nContraindications: asthma; shock; heart rate less than 50 beats/min; cardiac failure\nDosage: yes; oral, with food; for hypertension: 100 mg once daily"
 },
 {
  "name": "Oxymetazoline",
  "strength": "nasal drop 0.50%",
  "form": "nasal drop",
  "indication": "nasal obstruction",
  "group": "Respiratory",
  "atc": "R01AA05",
  "req": {
   "B": 3,
   "A": 12
  },
  "ref": "Also known as: acetaminophen, Tylenol®, Panadol®\nForm & Strength: tablet 500 mg\nIndications: to reduce pain and fever (but not inﬂammation)\nContraindications: liver disease\nDosage: 1000 mg every 6 hours; maximum 4000 mg (= 8 tablets) per 24 hours\nConsult doctor: no"
 },
 {
  "name": "Ethanol hand cleanser",
  "strength": "gel 70%",
  "form": "gel",
  "indication": "hand cleaning",
  "group": "Dermatology",
  "atc": "D08AX08",
  "req": {
   "C": 150,
   "B": 1500,
   "A": 3000
  },
  "ref": "Form & Strength: gel\nIndications: an alternative to hand-washing when hands are not obviously soiled\nContraindications: soiled hands\nDosage: enough should be used to cover hands thoroughly and allowed to dry\nConsult doctor: no"
 },
 {
  "name": "Ethanol",
  "strength": "liquid 70%",
  "form": "liquid",
  "indication": "disinfect instruments",
  "group": "Dermatology",
  "atc": "D08AX08",
  "req": {
   "B": 300,
   "A": 3000
  },
  "ref": "Form & Strength: gel\nIndications: an alternative to hand-washing when hands are not obviously soiled\nContraindications: soiled hands\nDosage: enough should be used to cover hands thoroughly and allowed to dry\nConsult doctor: no"
 },
 {
  "name": "Docusate with senna",
  "strength": "tablet 50mg/8mg",
  "form": "tablet",
  "indication": "constipation",
  "group": "Gastrointestinal",
  "atc": "A06AB",
  "req": {
   "A": 180
  },
  "ref": "Also known as: Neo-Dagracycline®, Unidox®, Vibra-S®, Vibramycine®, Doryx®\nForm & Strength: tablet 100 mg\nIndications: as recommended in IMGS3 for the speciﬁc infection\nDosage: 1–2 tablets at bedtime, may be increased to up to 2 tablets twice daily if required\nConsult doctor: no"
 },
 {
  "name": "Erythromycin",
  "strength": "tablet 500mg",
  "form": "tablet",
  "indication": "infections",
  "group": "Anti-infective",
  "atc": "J01FA01",
  "req": {
   "A": 180
  }
 },
 {
  "name": "Cefuroxime",
  "strength": "injection 750mg",
  "form": "injection",
  "indication": "infections",
  "group": "Anti-infective",
  "atc": "J01DC02",
  "req": {
   "A": 60
  }
 },
 {
  "name": "Charcoal, activated",
  "strength": "powder 50g",
  "form": "powder",
  "indication": "poisoning",
  "group": "Emergency",
  "atc": "A07BA01",
  "req": {
   "B": 300,
   "A": 600
  },
  "ref": "Form & Strength: 50 g in 300 ml puriﬁed water\nIndications: to absorb ingested poisons\nContraindications: bowel obstruction\nDosage: 1 g/kg orally up to a maximum of 100 g for ﬁrst dose; for repeat doses, 50 g every 4 hours, if advised by a doctor\nConsult doctor: yes"
 },
 {
  "name": "Benzoyl peroxide",
  "strength": "gel 5%",
  "form": "gel",
  "indication": "acne",
  "group": "Dermatology",
  "atc": "D10AE01",
  "req": {
   "B": 90,
   "A": 300
  }
 },
 {
  "name": "Magnesium hydroxide",
  "strength": "liquid per ml",
  "form": "liquid",
  "indication": "antacid, laxative",
  "group": "Gastrointestinal",
  "atc": "A02AA04",
  "req": {
   "C": 75,
   "B": 300,
   "A": 1200
  }
 },
 {
  "name": "Glyceryl trinitrate",
  "strength": "sublingual spray 400µg per dose",
  "form": "sublingual spray",
  "indication": "angina",
  "group": "Cardiovascular",
  "atc": "C01DA02",
  "req": {
   "B": 300,
   "A": 1200
  }
 }
];

export const NURSING_SCALE: ScaleNursing[] = [
 {
  "code": "II.1.01",
  "name": "Resuscitation Bag White compl.",
  "description": "Resuscitation bag with demand valve and resuscitation mask",
  "group": "Resuscitation & Oxygen",
  "qty": 0,
  "ref": "Code: II.1.01\nPurpose: Manual positive-pressure ventilation for apnoeic or inadequately breathing patients during CPR or pre-hospital stabilisation.\nUse: Attach appropriate mask (adult/child); tilt head, lift chin, create seal; squeeze bag at 1 breath every 5–6 s (adult CPR) or every 3–5 s (rescue breathing); observe chest rise. Fit PEEP valve if available for severe respiratory failure.\nStorage: Clean, dry medical locker; inspect mask seal and valve function monthly; replace one-way valves per manufacturer schedule.\nNotes: IMGS3 Ch. 5 (Resuscitation). MLC 2006 mandatory item. Test dome valve and non-rebreath valve before use. Single-patient use for mask; bag may be disinfected between patients per manufacturer guidance."
 },
 {
  "code": "II.1.11",
  "name": "Oxygen Set Complete (NSI) bag",
  "description": "Portable oxygen case complete with accessories",
  "group": "Resuscitation & Oxygen",
  "qty": 1,
  "ref": "Code: II.1.11\nPurpose: Portable oxygen delivery system for casualty resuscitation, acute respiratory distress, and first-response oxygen therapy at sea.\nUse: Assemble per case instructions; connect regulator to cylinder; set flow rate (2–15 L/min depending on mask type and clinical need); apply mask to patient. High-flow (10–15 L/min) via non-rebreath mask for CO poisoning, severe hypoxia, anaphylaxis.\nStorage: Secured upright in dedicated bracket; away from heat, oil, and grease; valve caps fitted when not in use. Check contents pressure monthly.\nNotes: IMGS3 Ch. 5 & 15. NSI compliant. Cylinder must be in hydrostatic test date. Oil or grease near O2 fittings is a fire hazard. Never store near combustibles."
 },
 {
  "code": "II.1.12",
  "name": "Med O2 Cylinder (2 Ltrs)",
  "description": "Reserve oxygen cylinder 2L/200bar",
  "group": "Resuscitation & Oxygen",
  "qty": 1,
  "ref": "Code: II.1.12\nPurpose: Reserve / backup oxygen cylinder (2 L, 200 bar, approx. 400 L usable O2) for short-term oxygen therapy or during cylinder changeover.\nUse: Attach to compatible regulator; open valve slowly; verify pressure gauge; flow at 2–6 L/min via nasal cannula or up to 15 L/min via non-rebreath mask. At 6 L/min a 2 L cylinder lasts approximately 10–13 min — bridge supply only.\nStorage: Upright, secured, cool and ventilated space. Check hydrostatic test date sticker. Valve cap fitted when not in use.\nNotes: IMGS3 Ch. 5. Mandatory reserve. Inspect regulator thread and O-ring before fitting. Replace cylinder when pressure falls below 20 bar."
 },
 {
  "code": "II.1.13",
  "name": "Med O2 Cylinder (10 Ltrs)",
  "description": "Oxygen cylinder 10L/200bar, ready for use",
  "group": "Resuscitation & Oxygen",
  "qty": 1,
  "ref": "Code: II.1.13\nPurpose: Primary onboard oxygen supply (10 L, 200 bar, approx. 2 000 L usable O2) for sustained oxygen therapy, CPR support, and evacuation preparation.\nUse: Fit regulator; open valve slowly (back off quarter turn after full open); adjust flow to clinical requirement (1–2 L/min for maintenance, 10–15 L/min for high-flow therapy). At 10 L/min: approximately 30 min of high-flow use.\nStorage: Dedicated cylinder rack, valve upward, secured against movement in heavy weather. Away from heat sources above 50 C. Label MEDICAL OXYGEN — NO OIL.\nNotes: IMGS3 Ch. 5 & 15. MLC/SOLAS required. Hydrostatic test interval per flag-state regulation (typically 5 years). Carry one full replacement cylinder."
 },
 {
  "code": "II.1.14",
  "name": "Mechanical suction unit",
  "description": "Mechanical suction unit to clear the airway",
  "group": "Resuscitation & Oxygen",
  "qty": 1,
  "ref": "Code: II.1.14\nPurpose: Airway clearance of blood, vomit, secretions, or foreign material in unconscious or post-trauma patients.\nUse: Connect suction catheter (Yankauer tip for oropharynx); insert without suction active, apply suction on withdrawal; limit each pass to 15 s; use largest practical catheter size. Operate at 80–120 mmHg negative pressure.\nStorage: Clean dry medical locker; drain and flush reservoir with disinfectant after each use; check suction hose for cracks monthly.\nNotes: IMGS3 Ch. 5 (Airway management). Do not apply suction directly to trachea without training. Disposable catheters: single use. Reusable components: clean, disinfect, dry before stowing."
 },
 {
  "code": "II.1.15",
  "name": "Lifeway-Weinmann (CPR mask)",
  "description": "Aid for mouth-to-mouth resuscitation",
  "group": "Resuscitation & Oxygen",
  "qty": 1,
  "ref": "Code: II.1.15\nPurpose: Barrier device enabling safe and effective mouth-to-mask rescue breathing without direct contact, with optional O2 enrichment inlet.\nUse: Position patient supine; apply mask apex to nose bridge, base above chin; hook thumbs on mask flanges, fingers under jaw; tilt head, lift jaw into mask; deliver 1 s breaths observing chest rise. Attach O2 at 10–15 L/min for enriched ventilation.\nStorage: Sealed pouch in resuscitation bag; store at room temperature away from UV light; check seal integrity annually.\nNotes: IMGS3 Ch. 5. IIR-filtered one-way valve protects rescuer from secretions. Single-patient use for valve insert; mask body may be disinfected if reusable model."
 },
 {
  "code": "II.1.05.a",
  "name": "Guedel Airway, size 2",
  "description": "Guedel oropharyngeal airway size 2",
  "group": "Resuscitation & Oxygen",
  "qty": 0,
  "ref": "Code: II.1.05a (II.1.05.a)\nPurpose: Oropharyngeal airway adjunct (size 2, approx. 80 mm, medium adult) to maintain tongue displacement and patent airway in unconscious patients.\nUse: Measure from centre of mouth to angle of jaw to confirm size. Insert rotated 180 degrees (concave up) then rotate to correct position as it passes posterior tongue; or use tongue depressor to guide in directly. Use only in deeply unconscious patients — gag reflex must be absent.\nStorage: Sealed bag in resuscitation kit; wipe clean with 70% ethanol after use; replace if cracked.\nNotes: IMGS3 Ch. 5. Incorrect size causes airway obstruction. Never insert in conscious or semi-conscious patient."
 },
 {
  "code": "II.2.16",
  "name": "Guedel Airway, size 3",
  "description": "Guedel oropharyngeal airway size 3",
  "group": "Resuscitation & Oxygen",
  "qty": 0,
  "ref": "Code: II.2.16\nPurpose: Oropharyngeal airway adjunct (size 3, approx. 90 mm, large adult) for larger adult patients requiring airway patency maintenance during unconsciousness.\nUse: Measure from centre of mouth to angle of jaw; size 3 suits most average male adults. Insert technique as for size 2. Confirm by inspecting chest rise and auscultating breath sounds.\nStorage: Sealed bag in resuscitation kit; ethanol wipe after use; inspect for cracks before storage.\nNotes: IMGS3 Ch. 5. Stock all sizes (2, 3, 4) to match patient anatomy. If patient gags, remove immediately."
 },
 {
  "code": "II.2.17",
  "name": "Guedel Airway, size 4",
  "description": "Guedel oropharyngeal airway size 4",
  "group": "Resuscitation & Oxygen",
  "qty": 0,
  "ref": "Code: II.2.17\nPurpose: Oropharyngeal airway adjunct (size 4, approx. 100 mm, large/obese adult) for maintaining a patent airway in large or heavyset unconscious adults.\nUse: Confirm correct size by measuring mouth-corner to jaw angle. Insert with 180 degree rotation technique. Re-check position if ventilation is difficult. Suction airway before inserting if secretions present.\nStorage: Sealed bag with resuscitation equipment; label with size; check monthly for discolouration or cracking.\nNotes: IMGS3 Ch. 5. Oversized airway can obstruct larynx. Always confirm absence of gag reflex. Document airway size used in patient record."
 },
 {
  "code": "II.2.18",
  "name": "Oxygen Mask Venturi Disp Adult",
  "description": "Disposable oxygen masks (up to 60% oxygen) with flexible connection tubes",
  "group": "Resuscitation & Oxygen",
  "qty": 2,
  "ref": "Code: II.2.18\nPurpose: Controlled-concentration oxygen delivery (24–60% FiO2) for hypoxic patients where precise oxygen titration is needed (e.g. COPD exacerbation, pneumonia).\nUse: Select correct Venturi barrel colour for target FiO2 (24% blue, 28% white, 31% yellow, 35% red, 40% green, 60% orange — verify against mask markings). Set flowmeter to rate printed on barrel. Apply mask, adjust nose clip and elastic.\nStorage: Original packaging; room temperature; single-use disposable — do not reuse.\nNotes: IMGS3 Ch. 15 (Respiratory). Critical for COPD patients to avoid O2-driven hypercapnia (target SpO2 88–92%). Confirm SpO2 with pulse oximeter if available."
 },
 {
  "code": "II.2.21",
  "name": "Tourniquet",
  "description": "Tourniquet / constriction band",
  "group": "Bandages & Sutures",
  "qty": 1,
  "ref": "Code: II.2.21\nPurpose: Emergency control of life-threatening limb haemorrhage (traumatic amputation, arterial laceration) when direct pressure fails.\nUse: Apply 5–7 cm proximal to wound; tighten until bleeding stops and distal pulse is absent; note application time on patient's forehead or label. Do not remove at sea — maintain until surgical care available. Reassess every 30 min.\nStorage: Accessible first-aid kit, not buried under other equipment; inspect elastic/webbing for UV degradation annually.\nNotes: IMGS3 Ch. 6 (Haemorrhage). Tourniquet time must be documented. Limb ischaemia risk increases markedly after 2 h — consult CIRM/radio doctor if prolonged."
 },
 {
  "code": "II.2.22",
  "name": "Suture set",
  "description": "Suture set",
  "group": "Bandages & Sutures",
  "qty": 1,
  "ref": "Code: II.2.22\nPurpose: Sterile instrument set for wound closure by suturing when wound edges cannot be adequately held by steri-strips or tissue glue.\nUse: Clean and debride wound with saline; drape field; infiltrate with lignocaine 1%; use needle holder to place interrupted or simple sutures; tie with 3–4 throws; cut tails to 3–4 mm. Cover with non-adherent dressing.\nStorage: Sterile sealed packaging; inspect packaging integrity and expiry date before use; cool dry locker.\nNotes: IMGS3 Ch. 8 (Wounds). Use polysorb (absorbable) for deeper layers; dermalon (non-absorbable) for skin. Skin sutures typically removed at 7–10 days (face) or 10–14 days (extremities). Record suture type/size in medical log."
 },
 {
  "code": "II.2.23",
  "name": "Cohesive elastic bandage 4mx6cm",
  "description": "Self-adhesive elastic bandage 4m/6cm",
  "group": "Bandages & Sutures",
  "qty": 1,
  "ref": "Code: II.2.23\nPurpose: Self-adherent compression bandage for joint support, light compression of sprains, and secondary dressing retention — no clips required.\nUse: Apply with moderate tension starting distally; overlap each turn by half the width; do not apply circumferentially under tension to fingers or toes; check distal circulation (colour, capillary refill, sensation) after application.\nStorage: Original roll packaging; room temperature; avoid sustained compression in storage (store on end, not flat-stacked).\nNotes: IMGS3 Ch. 9 (Musculoskeletal). Useful for ankle sprains (figure-of-8). Does not substitute for rigid splinting in fractures. Latex-free variants available — check before use in latex-sensitive patients."
 },
 {
  "code": "II.2.24",
  "name": "Hydrophilic gauze bandage 4mx6cm",
  "description": "Hydrophilic gauze bandage 4m/6cm",
  "group": "Bandages & Sutures",
  "qty": 30,
  "ref": "Code: II.2.24\nPurpose: Universal absorbent, conforming bandage for primary wound dressing retention, open wound padding, and minor compression.\nUse: Apply over wound dressing starting distally; overlap each layer 50%; secure end with adhesive tape or clip. Change when visibly soiled or saturated.\nStorage: Original packaging; cool dry locker; check sterilisation expiry if sterile variant.\nNotes: IMGS3 Ch. 8. Keep stock of at least 30 rolls as per IMGS3 requirement. High-consumption item — monitor stock after trauma incidents."
 },
 {
  "code": "II.2.25",
  "name": "Tubinette No1, 20m",
  "description": "Tubular bandage for fingers with applicator, roll 5m",
  "group": "Bandages & Sutures",
  "qty": 4,
  "ref": "Code: II.2.25\nPurpose: Tubular stockinette for retaining finger or toe dressings without adhesive plaster, and for skin protection under casts or splints.\nUse: Cut appropriate length; slide over applicator; feed over finger/digit; secure proximal end with ring cut from tubinette or adhesive. Can be doubled back to form two-layer retention dressing.\nStorage: Sealed roll; cool dry location; no special temperature requirements.\nNotes: IMGS3 Ch. 8. Size 1 suitable for fingers and toes. Larger sizes (2–6) for limbs. Inspect for elastic integrity before use. Does not provide compression — for retention only."
 },
 {
  "code": "II.2.26",
  "name": "Gauze compress 5x5cm sterile",
  "description": "Sterile hydrophilic gauze 5x5cm, pack of 16",
  "group": "Bandages & Sutures",
  "qty": 10,
  "ref": "Code: II.2.26\nPurpose: Sterile wound contact layer for small wounds, abrasions, and post-procedural dressing; also used for wound cleaning and antiseptic application.\nUse: Open sterile packaging aseptically; apply directly to wound; secure with bandage or tape. For wound cleaning: moisten with saline or antiseptic; wipe once per compress and discard.\nStorage: Original sterile packaging; cool dry locker; do not use if packaging damaged or wet. Stock minimum 10 packs (16 per pack).\nNotes: IMGS3 Ch. 8. Do not reuse sterile compresses. Inspect packaging integrity before stowage replenishment."
 },
 {
  "code": "II.2.27",
  "name": "Non-woven compress 10x10cm sterile",
  "description": "Sterile hydrophilic gauze 10x10cm",
  "group": "Bandages & Sutures",
  "qty": 75,
  "ref": "Code: II.2.27\nPurpose: Larger sterile non-adherent compress for medium to large wound dressings, haemostasis padding, and surgical field preparation.\nUse: Open aseptically; apply to wound; absorptive surface against wound; secure with bandage. Replace when saturated or every 24–48 h. Use multiple layers for heavily exuding wounds.\nStorage: Cool dry locker; original sterile packaging; bulk stock (minimum 75 per IMGS3 requirement).\nNotes: IMGS3 Ch. 8. Non-woven material conforms well to wound contours. Disposable — single use only. High-volume item: check stock after each significant medical event."
 },
 {
  "code": "II.2.28",
  "name": "Paraffin gauze 10x10cm",
  "description": "Sterile paraffin gauze 10x10cm (Grassolind neutral)",
  "group": "Bandages & Sutures",
  "qty": 20,
  "ref": "Code: II.2.28\nPurpose: Non-adherent, moisture-retaining primary wound dressing for burns, abrasions, skin grafts, and wounds requiring non-stick coverage.\nUse: Open sterile foil packaging; apply directly to wound surface (paraffin-impregnated side to wound); cover with dry absorbent gauze; secure with bandage. Change every 2–5 days depending on exudate.\nStorage: Foil-sealed sterile packs; store below 25 C; away from direct sunlight; check expiry date.\nNotes: IMGS3 Ch. 7 (Burns) & Ch. 8. Grassolind Neutral or equivalent. Do not use on infected wounds without additional antimicrobial cover. Minimum 20 packs required (IMGS3)."
 },
 {
  "code": "II.2.29",
  "name": "Cotton wool bandage 100g",
  "description": "Hydrophilic cotton wool, 100g",
  "group": "Bandages & Sutures",
  "qty": 1,
  "ref": "Code: II.2.29\nPurpose: Soft padding layer under bandages, plaster casts, and splints to protect bony prominences and distribute pressure; also general wound padding.\nUse: Wrap loosely around limb before applying bandage or splint; ensure at least 2-layer thickness over bony prominences (malleoli, tibial crest, heel). Do not use as primary wound contact layer.\nStorage: Sealed packaging; dry locker; keep away from moisture which reduces padding effectiveness.\nNotes: IMGS3 Ch. 9. Hydrophilic cotton wool is absorbent — not suitable over clean sutured wounds where moisture accumulation is undesirable. Use synthetic wool (II.2.40) where moisture wicking is needed."
 },
 {
  "code": "II.2.30",
  "name": "Metalline 250x73cm Burn sheet",
  "description": "Sterile metalline sheet 73x250cm (burn sheet)",
  "group": "Bandages & Sutures",
  "qty": 1,
  "ref": "Code: II.2.30\nPurpose: Sterile metalline (aluminium/polyester) burn sheet providing non-adherent wound coverage, heat retention, and barrier protection for extensive burns.\nUse: Do not remove clothing stuck to burns — cut around if necessary; apply metalline sheet directly over burned areas; do not wrap tightly; do not apply creams or ointments underneath. Keep patient warm (hypothermia risk); give IV fluids per Parkland formula if more than 15% BSA.\nStorage: Sterile sealed packaging; room temperature; check packaging integrity; single use only.\nNotes: IMGS3 Ch. 7 (Burns). For burns above 10% BSA urgent MEDEVAC/CIRM consultation required. Do not burst blisters. Metalline reduces fluid loss and hypothermia. Record % BSA burned using Rule of Nines."
 },
 {
  "code": "II.2.31",
  "name": "Triangular bandage viscose",
  "description": "Triangular bandages (cotton)",
  "group": "Bandages & Sutures",
  "qty": 4,
  "ref": "Code: II.2.31\nPurpose: Multi-function bandage used as arm sling, broad arm sling, head bandage, wound covering, and improvised splint holder.\nUse: For arm sling: position forearm at 90 degrees flexion; place apex behind elbow; bring ends over each shoulder; tie in hollow above collarbone. For broad arm sling: fold bandage in half before applying to immobilise in position of comfort. Can be used unfolded as large wound cover.\nStorage: Folded in original packaging or resealable bag; cool dry locker.\nNotes: IMGS3 Ch. 9 & 10 (Fractures/Dislocations). Stock minimum 4 per IMGS3. Viscose variety. Check for tears or fraying before use. May be laundered and reused if not contaminated."
 },
 {
  "code": "II.2.32",
  "name": "Gloves disposable L 10pcs",
  "description": "Non-sterile disposable gloves, per pair",
  "group": "Bandages & Sutures",
  "qty": 12,
  "ref": "Code: II.2.32\nPurpose: Infection control barrier for all patient contact procedures, wound management, and body fluid handling. Non-sterile.\nUse: Don gloves before any patient contact; remove by peeling inside-out without touching outer surface; dispose immediately in clinical waste. Change gloves between patients and between different care tasks on the same patient.\nStorage: Original box; dry locker; room temperature; away from UV light and ozone sources. Nitrile preferred (latex-free).\nNotes: IMGS3 Ch. 29 (Infection control). Non-sterile gloves do not replace hand hygiene. Minimum 12 pairs (10 pcs = 10 pairs) per IMGS3 list. For sterile procedures use surgical gloves (II.2.33/34)."
 },
 {
  "code": "II.2.33",
  "name": "Glove surgical sterile size M",
  "description": "Sterile surgical gloves size M, per pair",
  "group": "Bandages & Sutures",
  "qty": 3,
  "ref": "Code: II.2.33\nPurpose: Sterile surgical gloves for aseptic wound closure, catheterisation, and other sterile procedures.\nUse: Perform hand hygiene; open outer packaging without contaminating inner; use closed-glove or open-glove technique to don without touching outer sterile surface. Discard if torn or contaminated.\nStorage: Sterile packaging; cool dry locker; check expiry date and packaging integrity before stowage.\nNotes: IMGS3 Ch. 8. Minimum 3 pairs size M. Latex allergy: use nitrile sterile alternative. Never reuse surgical gloves. Use correct size to maintain instrument handling precision."
 },
 {
  "code": "II.2.34",
  "name": "Glove surgical sterile size L",
  "description": "Sterile surgical gloves size L, per pair",
  "group": "Bandages & Sutures",
  "qty": 3,
  "ref": "Code: II.2.34\nPurpose: Sterile surgical gloves (size L) for aseptic procedures in larger-handed operators.\nUse: Same technique as size M surgical gloves. Correct size critical for dexterity during suturing and instrument handling.\nStorage: Sterile packaging; cool dry locker; check expiry and packaging integrity.\nNotes: IMGS3 Ch. 8. Minimum 3 pairs size L. Check glove size against personnel before voyage; ensure adequate stock of size(s) used by the medical officer. Powdered gloves: rinse thoroughly before patient contact."
 },
 {
  "code": "II.2.35",
  "name": "Plaster waterresistant 1mx6cm",
  "description": "Waterproof adhesive bandage 1m/6cm",
  "group": "Bandages & Sutures",
  "qty": 3,
  "ref": "Code: II.2.35\nPurpose: Waterproof adhesive retention bandage roll (1 m x 6 cm) for securing dressings in wet or humid environments (e.g. engine room, deck work).\nUse: Cut required length; apply to clean dry skin with moderate tension; smooth to eliminate air bubbles; avoid constrictive circular application. Can be pre-torn into strips. Waterproof — patients can shower with dressing intact.\nStorage: Original foil-wrapped roll; cool dry locker; once opened use promptly as adhesive degrades with humidity.\nNotes: IMGS3 Ch. 8. Minimum 3 rolls. Check adhesive quality during monthly stock inspection. Remove gently with one hand pressing skin flat to avoid tape-strip injury."
 },
 {
  "code": "II.2.36",
  "name": "First aid bandage nr 2 middle 8x10cm",
  "description": "Sterile first aid bandage no.2 medium 8x10cm",
  "group": "Bandages & Sutures",
  "qty": 10,
  "ref": "Code: II.2.36\nPurpose: Pre-assembled sterile first-aid wound dressing with integral fixation bandage for rapid application to lacerations and wounds in emergency situations.\nUse: Tear open outer wrapper; unfold dressing pad; apply pad directly to wound without touching sterile surface; wrap securing tails around limb/body and tie or clip. Can be used one-handed on own limb.\nStorage: Sterile sealed packaging; cool dry locker; minimum 10 dressings per IMGS3.\nNotes: IMGS3 Ch. 8. No.2 Middle = 8x10 cm pad. Do not remove pad once applied over bleeding wound — add second dressing on top if saturated. Document usage in medical log."
 },
 {
  "code": "II.2.37",
  "name": "Leukoplast washable 5mx1.25cm",
  "description": "Waterproof adhesive plaster 5m/1.25cm (Leukoplast)",
  "group": "Bandages & Sutures",
  "qty": 2,
  "ref": "Code: II.2.37\nPurpose: Narrow waterproof adhesive tape for securing cannulae, tubing, small dressings, and suture dressing edges.\nUse: Cut to required length; apply to clean, dry skin; press firmly along edges; do not apply under tension. For IV cannulae: use H-bridge technique to secure cannula hub and tubing.\nStorage: Original foil packaging; cool dry location; once opened store in resealable bag to preserve adhesive.\nNotes: IMGS3 Ch. 8 (Leukoplast/BSN equivalent). 5 m x 1.25 cm. Minimum 2 rolls. Check adhesive integrity at each monthly inspection. Avoid applying over broken or fragile skin."
 },
 {
  "code": "II.2.38",
  "name": "Steristrip butterfly 6x100mm",
  "description": "Sterile butterfly / steri-strip closures",
  "group": "Bandages & Sutures",
  "qty": 20,
  "ref": "Code: II.2.38\nPurpose: Sterile adhesive wound closure strips (butterfly / steri-strips) for closing small lacerations, reinforcing suture lines, and closing wounds in areas where suturing is impractical.\nUse: Clean and dry wound thoroughly; approximate wound edges with fingers; apply strips perpendicular to wound, starting at centre; space 3–4 mm apart; apply parallel reinforcing strips along wound edges. Keep dry for 48–72 h.\nStorage: Sterile foil packets; cool dry locker; check expiry; minimum 20 strips (approx. 4 packets of 5).\nNotes: IMGS3 Ch. 8. Do not use on wounds under significant tension or over joints alone. If wound gapes despite strips, suturing required. Leave in place until they fall off naturally (7–14 days)."
 },
 {
  "code": "II.2.39",
  "name": "Suture Polysorb 4-0 atraumatic",
  "description": "Atraumatic sutures Vicryl/Polysorb 4-0",
  "group": "Bandages & Sutures",
  "qty": 10,
  "ref": "Code: II.2.39\nPurpose: Absorbable synthetic braided suture (Polysorb/Vicryl 4-0) for deep tissue closure, subcutaneous layers, and buried knots in wound repair.\nUse: Load needle into holder; place interrupted or continuous sutures in deep tissue; tie with 4 throws; cut tails to 3 mm. Does not require removal — absorbed over 56–70 days (Polysorb).\nStorage: Sterile foil packaging; room temperature; protect from moisture and extremes of heat; check expiry date.\nNotes: IMGS3 Ch. 8. 4-0 gauge suitable for subcutaneous and dermal use. Minimum 10 sutures. If infected wound, avoid buried absorbable sutures — consult CIRM. Record suture type in medical log."
 },
 {
  "code": "II.2.13.d",
  "name": "Suture Dermalon 3-0 Ep2",
  "description": "Atraumatic sutures Ethilon/Dermalon 3-0",
  "group": "Bandages & Sutures",
  "qty": 0,
  "ref": "Code: II.2.13d (II.2.13.d)\nPurpose: Non-absorbable monofilament nylon suture (Dermalon/Ethilon 3-0, EP2) for skin closure requiring strong, low-reactivity sutures.\nUse: Use needle holder; place interrupted sutures 4–5 mm from wound edge; tie with 3–4 square knots; leave 3–4 mm tails. Remove at 7–10 days (face/scalp) or 10–14 days (trunk/extremity). In contaminated wounds, plan for early removal and secondary intention if infection develops.\nStorage: Sterile foil packaging; room temperature; check expiry; minimum stock as listed.\nNotes: IMGS3 Ch. 8. 3-0 calibre for skin — do not use in deep tissues (not absorbable). EP2 = metric 2 needle. Monofilament: cuts easily with scissors, minimal bacterial wicking."
 },
 {
  "code": "II.2.40",
  "name": "Cottonwool synthetic 2mx10cm",
  "description": "Synthetic cotton wool 2m/10cm",
  "group": "Bandages & Sutures",
  "qty": 2,
  "ref": "Code: II.2.40\nPurpose: Synthetic (non-cotton) orthopaedic wool roll for padding under plaster slabs, splints, and compression bandages, where lower moisture absorption and improved pressure distribution is required.\nUse: Wrap around limb before applying plaster or splint; 2–3 layers minimum over bony prominences; smooth out folds to prevent pressure sores. Do not apply so tightly as to impair circulation.\nStorage: Sealed roll packaging; cool dry locker. Minimum 2 rolls.\nNotes: IMGS3 Ch. 9. Synthetic wool retains shape better than cotton under bandages. Check capillary refill and sensation in digits after splint/cast application. Rewrap if patient reports increasing pain or paraesthesia under cast."
 },
 {
  "code": "II.2.41",
  "name": "Eyeshade",
  "description": "Eye patch / eyeshade",
  "group": "Bandages & Sutures",
  "qty": 2,
  "ref": "Code: II.2.41\nPurpose: Protective eye patch to cover an injured, post-procedure, or photophobic eye; prevents accidental rubbing and light-induced pain.\nUse: Ensure eye is closed before applying; position shield centred over eye; secure with adhesive tabs or bandage; do not apply pressure directly on eyeball (use cartella/rigid shield over perforating injuries). Change daily.\nStorage: Sterile or clean sealed packaging; cool dry locker. Minimum 2 patches.\nNotes: IMGS3 Ch. 13 (Eye conditions). For suspected penetrating eye injury use rigid fox shield (cartella) not soft patch. Document laterality (L/R) and reason in medical log."
 },
 {
  "code": "II.2.42",
  "name": "Eye compress 5.5x7.5cm",
  "description": "Eye compresses 5.5x7.5cm, pack of 5",
  "group": "Bandages & Sutures",
  "qty": 2,
  "ref": "Code: II.2.42\nPurpose: Sterile padded eye dressings (5.5 x 7.5 cm, pack of 5) for wound coverage after eye surgery or injury, and for moist compresses in eye conditions.\nUse: Apply over closed eye; for moist compress, moisten with sterile saline; secure with tape or bandage; change every 4–8 h or when soiled. For both eyes: use separate compresses.\nStorage: Sterile sealed packs; cool dry locker; minimum 2 packs. Check expiry.\nNotes: IMGS3 Ch. 13. Do not use one compress on both eyes to prevent cross-contamination. If chemical splash: irrigate eye thoroughly with saline/Diphoterine before applying compress."
 },
 {
  "code": "II.2.43",
  "name": "Safety pins nr.2, 12pcs",
  "description": "Stainless steel safety pins, 12pcs",
  "group": "Bandages & Sutures",
  "qty": 2,
  "ref": "Code: II.2.43\nPurpose: Securing triangular bandages, slings, and bulky dressings; utility fastening for improvised splint padding and bandage ends.\nUse: Insert pin parallel to skin surface to reduce risk of puncture; close latch fully; keep away from reach of disoriented or delirious patients. Stainless steel — may be flame-sterilised in emergencies.\nStorage: Original packet; cool dry locker; minimum 2 packs (24 pins). Inspect for rust or distortion annually.\nNotes: IMGS3 Ch. 9 & 10. Nr.2 = medium size. Ensure latch closes securely before use. Maintain two complete packs per IMGS3 list."
 },
 {
  "code": "II.3.11",
  "name": "Scalpel sterile disposable",
  "description": "Sterile disposable scalpel",
  "group": "Instruments",
  "qty": 3,
  "ref": "Code: II.3.11\nPurpose: Single-use sterile scalpel for incision and drainage of abscesses, wound debridement, and minor surgical procedures.\nUse: Remove from sterile packaging immediately before use; always use forceps or blade guard to mount/remove blade — never fingers; make controlled incisions with light pressure; dispose immediately into sharps container after use.\nStorage: Sterile sealed packaging; cool dry locker; check expiry. Minimum 3 scalpels.\nNotes: IMGS3 Ch. 8. Blade no. 22 common general-purpose size. NEVER recap or re-use. Sharps disposal: sealed rigid container until port disposal. Document procedure in medical log."
 },
 {
  "code": "II.3.12",
  "name": "SS box for surgical instruments",
  "description": "Stainless steel box for surgical instruments",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.12\nPurpose: Stainless steel sterilisation and storage container for reusable surgical instruments (scissors, forceps, needle holder) — protects sterility and organises equipment.\nUse: After cleaning instruments, arrange in open position in box; autoclave or disinfect with 70% ethanol and dry; close lid for storage; label with sterilisation date if applicable.\nStorage: Clean dry medical locker; inspect box hinges and lid seal quarterly.\nNotes: IMGS3 Ch. 8. Cannot autoclave at sea — chemical disinfection (70% ethanol or 2% glutaraldehyde equivalent) is standard practice. Log sterilisation method and date. Inspect instruments in box at each monthly medical equipment check."
 },
 {
  "code": "II.3.13",
  "name": "Scissors surgical stainless steel",
  "description": "Surgical scissors, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.13\nPurpose: Sharp/blunt or sharp/sharp surgical scissors for cutting sutures, dissecting tissue, and trimming wound edges during wound closure.\nUse: Use thumb and ring finger in rings; fine control via index finger on shank. Suture scissors: cut at 45 degrees to suture close to knot. Do not use surgical scissors to cut bandages or dressings — use Lister scissors (II.3.14).\nStorage: Stainless steel box (II.3.12); clean and dry after each use; ethanol disinfect; oil pivot point lightly annually.\nNotes: IMGS3 Ch. 8. Keep blade edges protected in storage box. Sharp end protector when stowed. Inspect cutting edges for nicks at each monthly check."
 },
 {
  "code": "II.3.14",
  "name": "Scissors bandage Lister 18cm",
  "description": "Lister bandage scissors 18cm, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.14\nPurpose: Angled Lister bandage scissors (18 cm) for rapidly cutting through dressings, bandages, and clothing without risk of skin injury — blunt lower blade slides safely under material.\nUse: Slide lower blunt probe-tip blade under bandage/clothing; cut away with controlled strokes. Do not use for cutting sutures (dulls cutting edge). Clean after use with soap and water then ethanol.\nStorage: Stainless steel box or hook in medical locker; clean and dry; do not stow loose with other instruments.\nNotes: IMGS3 Ch. 8. Critical trauma-kit instrument — must be accessible in emergency. Inspect pivot tension annually; tighten screw if blades splay. Lister-style 18 cm."
 },
 {
  "code": "II.3.15",
  "name": "Tweezers anatomical",
  "description": "Anatomical tweezers / forceps, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.15\nPurpose: Smooth-jawed (non-toothed) anatomical forceps for handling delicate tissue without crushing, picking up gauze and dressings, and wound cleansing.\nUse: Hold like a pencil between thumb and middle finger; use index for control. Use for grasping soft tissue or dressings — do not use for holding suture needles. Wipe with ethanol between uses on same patient.\nStorage: Stainless steel box; clean, dry, ethanol-wipe; protect tips from bending.\nNotes: IMGS3 Ch. 8. Anatomical (smooth) vs surgical (toothed) — use correct type for procedure. Inspect for tip alignment at each monthly check."
 },
 {
  "code": "II.3.16",
  "name": "Tweezers surgical",
  "description": "Surgical tweezers / forceps, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.16\nPurpose: Toothed surgical forceps for firm tissue handling, wound edge manipulation during suturing, and holding skin edges for needle passage.\nUse: Grasp wound edge gently with teeth for needle passage — minimal pressure to avoid tissue crush. Not to be used on fragile or ischaemic tissue. Sterilise before each use.\nStorage: Stainless steel box; clean, dry, ethanol-wipe; protect interlocking teeth from distortion.\nNotes: IMGS3 Ch. 8. Teeth allow grip without slipping — essential for proper suturing technique. Check tooth alignment (tip test: teeth should interdigitate cleanly) at monthly inspection."
 },
 {
  "code": "II.3.17",
  "name": "Haemostatic Forcep Kocher 14.5cm",
  "description": "Haemostatic forcep type Kocher 14.5cm, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.17\nPurpose: Ratcheted haemostatic clamp (Kocher, 14.5 cm, toothed tips) for clamping bleeding vessels, holding tissue pedicles, and securing drains.\nUse: Grasp vessel with minimum tissue; lock ratchet; leave in place until suture-ligation can be performed or bleeding vessel assessed. Unlock gently. Do not clamp blindly in deep wounds.\nStorage: Stainless steel box; clean, lubricate ratchet; ethanol disinfect; inspect ratchet function monthly.\nNotes: IMGS3 Ch. 8. Cross-serrated with teeth at tip (Kocher). Inspect ratchet for slippage at each maintenance check. Requires lignocaine and suture for definitive haemostasis."
 },
 {
  "code": "II.3.18",
  "name": "Needle holder Mathieu 17cm",
  "description": "Needle holder Mathieu 17cm, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.18\nPurpose: Spring-loaded Mathieu needle holder (17 cm) for controlled needle passage during wound suturing — self-locking palm-grip design.\nUse: Load needle at 2/3 from tip in holder jaws; position needle holder in palm; guide needle perpendicular to wound edge; release spring lock on completion. Do not use to tie knots — use fingers or instrument-tie technique.\nStorage: Stainless steel box; clean, dry; lightly oil joint; ethanol disinfect before use.\nNotes: IMGS3 Ch. 8. Mathieu holder: palm-grip with spring release, preferred for less-trained operators. Check jaw serrations for wear and spring tension at monthly check."
 },
 {
  "code": "II.3.19",
  "name": "Disposable shaver",
  "description": "Disposable razor / shaver",
  "group": "Instruments",
  "qty": 5,
  "ref": "Code: II.3.19\nPurpose: Skin preparation by hair removal before wound closure, IV insertion, splint application, or minor surgical procedures to improve visibility and adhesion.\nUse: Moisten skin; shave in direction of hair growth using minimal passes; do not nick skin (increases infection risk); clean shaved area with antiseptic before procedure. Single use only — dispose in sharps container.\nStorage: Dry locker; original packaging. Minimum 5 shavers.\nNotes: IMGS3 Ch. 8. Avoid shaving eyebrows (slow to regrow, landmarks needed). Shaving immediately pre-procedure preferred over hours earlier (reduces wound infection risk). Dispose as sharps."
 },
 {
  "code": "II.3.20",
  "name": "Splinter tweezers stainless steel",
  "description": "Splinter tweezers, stainless steel",
  "group": "Instruments",
  "qty": 1,
  "ref": "Code: II.3.20\nPurpose: Fine-tipped precision tweezers for removal of superficial splinters, thorns, fish hooks (partial), and small foreign bodies from skin.\nUse: Clean skin with antiseptic; grasp splinter at skin entry point; extract along the entry angle; squeeze wound gently to encourage bleeding and flush debris; apply antiseptic. If splinter deeply embedded, consider lignocaine infiltration before incision with scalpel.\nStorage: Stainless steel box or case; clean with ethanol; protect fine tips; inspect tip alignment monthly.\nNotes: IMGS3 Ch. 8. Ensure complete removal — document in patient log. Update tetanus prophylaxis history. If fishhook: consider advance-and-cut or string-yank technique depending on depth."
 },
 {
  "code": "II.4.11",
  "name": "Tongue depressors 100pcs",
  "description": "Disposable tongue depressors, 100pcs",
  "group": "Examination & Monitoring",
  "qty": 50,
  "ref": "Code: II.4.11\nPurpose: Disposable wooden tongue depressors for oral examination (tonsils, pharynx, teeth), immobilising soft palate, and assisting in throat swab collection.\nUse: Instruct patient to open wide and breathe through mouth; depress mid-tongue firmly but gently; examine pharynx and tonsils with penlight. Single use — dispose in clinical waste immediately.\nStorage: Original box; cool dry locker; away from moisture. Box of 100. Minimum 50 per IMGS3 (half a box).\nNotes: IMGS3 Ch. 16 (ENT). Do not use tongue depressor to examine patients with suspected epiglottitis — risk of precipitating complete airway obstruction."
 },
 {
  "code": "II.4.12",
  "name": "Combur Test urine strips",
  "description": "Urine analysis test strips (blood/glucose/protein/nitrite/leukocytes), 50 strips",
  "group": "Examination & Monitoring",
  "qty": 1,
  "ref": "Code: II.4.12\nPurpose: Semiquantitative urinalysis test strips for rapid detection of haematuria, glycosuria, proteinuria, nitrites (bacteriuria), leucocytes, ketones, bilirubin, and pH.\nUse: Collect mid-stream urine in clean container; dip strip for 1 s; remove and tap edge on container rim; read results at times specified on bottle (30 s–120 s depending on field). Compare pad colour against chart in good lighting.\nStorage: Original bottle with desiccant lid; tightly closed; store below 25 C; protect from humidity, heat, and direct light; discard if any pad is discoloured before use. Check expiry.\nNotes: IMGS3 Ch. 18 (Urological). Results guide antibiotic selection (UTI: positive nitrite/leucocytes). Positive blood: consider trauma, UTI, stones, or renal pathology. Consult CIRM for diagnostic interpretation. Minimum 1 bottle (50 strips)."
 },
 {
  "code": "II.4.13",
  "name": "Temperature & pulse record sheets",
  "description": "Sheets for recording body temperature and pulse",
  "group": "Examination & Monitoring",
  "qty": 20,
  "ref": "Code: II.4.13\nPurpose: Pre-formatted clinical observation charts for recording serial vital signs (temperature, pulse, respiration rate, blood pressure, SpO2) and tracking patient deterioration or improvement.\nUse: Record all observations with time and date; note any medications given; use sheets to identify trends (rising temperature, deteriorating HR). Pass completed records to shore medical authority at MEDEVAC.\nStorage: Dry medical locker; paper records in waterproof sleeve or sealed bag; minimum 20 sheets (per IMGS3).\nNotes: IMGS3 Ch. 1 (Medical management at sea). Legal medical record — keep originals. Record name, DOB, seafarer ID on each sheet. Forward copies to receiving hospital at evacuation."
 },
 {
  "code": "II.4.14",
  "name": "Medical card for evaluation",
  "description": "Medical card for patient evaluation information",
  "group": "Examination & Monitoring",
  "qty": 4,
  "ref": "Code: II.4.14\nPurpose: Standardised shipboard medical evaluation card for systematic history-taking, examination, and differential diagnosis — supports structured radio medical consultation.\nUse: Complete all sections (chief complaint, history, examination findings, vital signs, medications given, outcome); use as prompt for CIRM/radio doctor call; retain on board as part of medical log.\nStorage: Dry locker; waterproof sleeve; minimum 4 cards per IMGS3.\nNotes: IMGS3 Ch. 1. Completed cards constitute official medical log entries — store for minimum 5 years (MLC 2006 requirement). Available in multiple languages — carry cards appropriate to crew nationalities."
 },
 {
  "code": "II.4.15",
  "name": "Nurse Stethoscope",
  "description": "Stethoscope",
  "group": "Examination & Monitoring",
  "qty": 1,
  "ref": "Code: II.4.15\nPurpose: Acoustic stethoscope for auscultation of heart sounds, lung fields, bowel sounds, and blood pressure measurement (with sphygmomanometer).\nUse: Place eartips in ears angled forward; bell for low-pitched sounds (heart murmurs, bowel sounds); diaphragm for high-pitched sounds (lung fields, normal heart sounds). Warm diaphragm against hand before applying to skin. Clean earpieces and diaphragm with ethanol wipe between patients.\nStorage: Coiled in case or medical bag; protect from extreme heat and cold; do not hang loose (stretches tubing).\nNotes: IMGS3 Ch. 4 (Physical examination). Check tubing for cracks annually. Bilateral chest auscultation essential after any respiratory complaint and before/after pleural aspiration."
 },
 {
  "code": "II.4.16",
  "name": "Aneroid blood pressure monitor",
  "description": "Aneroid blood pressure monitor (preferably automatic)",
  "group": "Examination & Monitoring",
  "qty": 1,
  "ref": "Code: II.4.16\nPurpose: Manual aneroid sphygmomanometer for systolic and diastolic blood pressure measurement; essential for cardiovascular monitoring, shock assessment, and medication dosing decisions.\nUse: Patient seated or supine; arm at heart level; apply cuff 2–3 cm above antecubital fossa; inflate 20–30 mmHg above point where radial pulse disappears; deflate at 2–3 mmHg/s; record Korotkoff I (systolic) and V (diastolic). Take two readings 1–2 min apart.\nStorage: Protective case; avoid dropping (disrupts calibration); inspect gauge needle for zero at rest monthly.\nNotes: IMGS3 Ch. 4 & 11 (Cardiovascular). Re-calibrate against mercury standard if available at port. Cuff size matters: use large cuff for arm circumference above 33 cm."
 },
 {
  "code": "II.4.17",
  "name": "Fever thermometer",
  "description": "Fever thermometer",
  "group": "Examination & Monitoring",
  "qty": 3,
  "ref": "Code: II.4.17\nPurpose: Measurement of body temperature for fever detection (above 38.0 C), monitoring of sepsis, heat illness, and hypothermia screening.\nUse: Digital oral/axillary: insert under tongue or in axilla; wait for beep; read display. Normal oral: 36.5–37.5 C; axillary reading is 0.5 C lower. For suspected hypothermia use Thermoscan (II.4.18).\nStorage: Clean plastic case; wipe with ethanol after each use; store minimum 3 thermometers (one per sickbay, one resuscitation kit, one spare).\nNotes: IMGS3 Ch. 4. Temperature above 39 C requires clinical assessment and investigation. Rectal temperature most accurate for hypothermia screening but Thermoscan preferred at sea. Document route of measurement."
 },
 {
  "code": "II.4.18",
  "name": "Thermoscan (hypothermia)",
  "description": "Hypothermia thermometer (Thermoscan)",
  "group": "Examination & Monitoring",
  "qty": 1,
  "ref": "Code: II.4.18\nPurpose: Low-reading tympanic infrared thermometer capable of measuring temperatures down to 25 C — essential for hypothermia diagnosis in man-overboard and cold-exposure casualties.\nUse: Insert disposable probe cover; gently straighten ear canal (pull pinna up and back); insert probe snugly; press scan button; read display within 1 s. Take 3 readings — use lowest. Core temperature below 35 C = hypothermia; below 32 C = severe — CIRM consultation mandatory.\nStorage: Original case with probe covers; room temperature; replace batteries before long voyage; check calibration with normal-temperature patient.\nNotes: IMGS3 Ch. 21 (Hypothermia). Do not use in ears with wax impaction or otitis. Remove from cold environment before use (allow 5 min acclimatisation). Hypothermia management: gentle rewarming, horizontal positioning, ECG monitoring if available."
 },
 {
  "code": "II.4.19",
  "name": "Penlight Eye Light + Blue Cap",
  "description": "Penlight eye torch + blue cap",
  "group": "Examination & Monitoring",
  "qty": 2,
  "ref": "Code: II.4.19\nPurpose: Diagnostic penlight for pupillary light reflex assessment, anterior eye examination, oral cavity inspection, and wound illumination. Blue filter cap enables fluorescein-stained corneal lesion detection.\nUse: Standard examination: shine light from 45 degree angle across eye; observe direct and consensual pupillary response; note size, shape, and equality. With blue cap and fluorescein strip: wet strip with saline, touch lower conjunctiva; blue light reveals corneal abrasions as bright green.\nStorage: Pocket of medical bag or instrument locker; check battery monthly; spare batteries in medical stores.\nNotes: IMGS3 Ch. 13 (Eye). Unequal pupils (anisocoria above 1 mm new onset) with head injury = raised ICP — CIRM immediately. Blue cap essential for corneal abrasion diagnosis. Fluorescein strips stored separately."
 },
 {
  "code": "II.5.11",
  "name": "Urine bag with condom connection",
  "description": "Urine bag with condom connection",
  "group": "Injection & Catheterization",
  "qty": 2,
  "ref": "Code: II.5.11\nPurpose: External urinary drainage system (condom catheter + drainage bag) for incontinent male patients, monitoring urine output, and post-trauma urological assessment.\nUse: Clean and dry penis; roll condom catheter onto shaft; connect tubing to drainage bag; position bag below bladder level. Change condom catheter daily; inspect skin for maceration or pressure injury.\nStorage: Sterile packaging; cool dry locker; minimum 2 sets. Check expiry.\nNotes: IMGS3 Ch. 18. Condom catheter preferred over urethral catheter when possible (lower UTI risk). Monitor urine output: below 0.5 ml/kg/h = oliguria — assess fluid status and renal function. Measure output every 4–8 h."
 },
 {
  "code": "II.5.12",
  "name": "Catheter Thieman FG16 CH16 40cm",
  "description": "Sterile urinary catheter Thieman FG16 CH16 40cm",
  "group": "Injection & Catheterization",
  "qty": 1,
  "ref": "Code: II.5.12\nPurpose: Sterile Tiemann-tipped (curved tip) urethral catheter FG16/CH16, 40 cm for bladder drainage in urinary retention, output monitoring, and urological procedures.\nUse: Aseptic technique; sterile gloves; clean urethral meatus with saline; apply Instillagel lubricant (II.5.13) 3–5 min before insertion; advance catheter until urine flows; inflate balloon with 10 ml sterile water; connect to drainage bag. Confirm placement by free urine flow.\nStorage: Sterile packaging; room temperature; check expiry. Minimum 1 catheter per IMGS3.\nNotes: IMGS3 Ch. 18. Tiemann tip for male catheterisation of enlarged prostate. If resistance met, do not force — CIRM consultation. Record catheterisation date, catheter size, and output in medical log."
 },
 {
  "code": "II.5.13",
  "name": "Instillagel lubricant 6ml",
  "description": "Catheter lubricant gel Lidocaine 2% / Chlorhexidine 0.05%, 6ml syringe",
  "group": "Injection & Catheterization",
  "qty": 2,
  "ref": "Code: II.5.13\nPurpose: Pre-filled syringe of lidocaine 2% and chlorhexidine 0.05% gel — simultaneous lubricant and local anaesthetic for urethral catheterisation.\nUse: Clean urethral meatus; instil entire 6 ml syringe into urethra; hold meatus closed for 3–5 min before catheter insertion. Gel lubricates and anaesthetises urethral mucosa and disinfects field.\nStorage: Cool dry locker; sterile sealed syringe; check expiry date. Minimum 2 units.\nNotes: IMGS3 Ch. 18. Lidocaine component provides local anaesthesia — wait full 3–5 min before catheter insertion for effect. Single use — do not partially use and re-seal. Contraindicated in urethral trauma (do not insert gel under pressure)."
 },
 {
  "code": "II.5.14",
  "name": "Syringes 2ml sterile + needle",
  "description": "Sterile disposable syringes 2ml with needle 21G",
  "group": "Injection & Catheterization",
  "qty": 50,
  "ref": "Code: II.5.14\nPurpose: Sterile 2 ml disposable syringe with attached 21G needle for IM and SC drug injections, intradermal tests, and small-volume drug reconstitution.\nUse: Check drug, dose, and route; withdraw to prescribed volume; expel air; administer IM (deltoid/vastus lateralis) or SC at 45–90 degrees; aspirate to check non-vascular; inject slowly; remove and apply pressure. Dispose in sharps container immediately.\nStorage: Sterile packaging; dry locker; minimum 50 per IMGS3. Check expiry.\nNotes: IMGS3 Ch. 3 & passim. Never re-use syringes or needles. Two-syringe rule for controlled drugs (dilution). Needle gauge: 21G suitable for most IM drugs including reconstituted antibiotics."
 },
 {
  "code": "II.5.15",
  "name": "Syringes 5ml sterile",
  "description": "Sterile disposable syringes 5ml",
  "group": "Injection & Catheterization",
  "qty": 10,
  "ref": "Code: II.5.15\nPurpose: Sterile 5 ml disposable syringe (without fixed needle) for larger-volume IM/IV drug injections, balloon inflation during catheterisation, and wound irrigation.\nUse: Fit appropriate needle (21G IM, 25G SC, 18–23G IV); withdraw drug; expel air; administer per route. For wound irrigation: fit irrigation tip or large-bore needle; flush under moderate pressure with saline.\nStorage: Sterile sealed packaging; dry locker; minimum 10 per IMGS3. Check expiry.\nNotes: IMGS3 Ch. 3 & 8. 5 ml syringe with 21G needle suitable for ceftriaxone 1 g IM (reconstituted). Use for balloon inflation with sterile water (not saline — crystallises in balloon valve). Dispose as sharps."
 },
 {
  "code": "II.5.16",
  "name": "Needles SC 25Gx5/8 sterile",
  "description": "Sterile SC injection needles 25Gx5/8 (0.5x16mm)",
  "group": "Injection & Catheterization",
  "qty": 25,
  "ref": "Code: II.5.16\nPurpose: Sterile subcutaneous injection needles 25G x 5/8 inch (0.5 x 16 mm) for SC drug administration (insulin, heparin, adrenaline if only SC route feasible).\nUse: Pinch skin fold at injection site; insert at 45–90 degrees depending on tissue thickness; release skin; aspirate briefly; inject slowly; remove; apply pressure. Dispose immediately in sharps container.\nStorage: Sterile packaging; dry locker; minimum 25 needles per IMGS3. Check expiry.\nNotes: IMGS3 Ch. 3. 25G fine gauge: less discomfort for SC route. Do not use 25G for IM administration — too fine, too short. Ensure correct gauge selection before drawing up drug."
 },
 {
  "code": "II.5.17",
  "name": "Needles IM 21Gx1.5 sterile",
  "description": "Sterile IM injection needles 21Gx1.5 (0.8x40mm)",
  "group": "Injection & Catheterization",
  "qty": 50,
  "ref": "Code: II.5.17\nPurpose: Sterile IM injection needles 21G x 1.5 inch (0.8 x 40 mm) for intramuscular administration of most shipboard injectable drugs including antibiotics, antiemetics, analgesics, and emergency medications.\nUse: Select site (deltoid, vastus lateralis, or gluteus medius); cleanse with swab; stretch skin; insert at 90 degrees; aspirate 5–10 s; if no blood inject drug; withdraw; apply pressure. Dispose in sharps container.\nStorage: Sterile packaging; dry locker; minimum 50 per IMGS3. Check expiry.\nNotes: IMGS3 Ch. 3. 21G x 1.5 inch: standard IM needle adequate for most adult patients. For obese patients with thick subcutaneous fat, consider 21G x 2 inch if available. Never re-use needles."
 },
 {
  "code": "II.5.18",
  "name": "IV Catheter green 18G 1.2x45mm",
  "description": "Sterile IV cannula / catheter green 18G 1.2x45mm",
  "group": "Injection & Catheterization",
  "qty": 4,
  "ref": "Code: II.5.18\nPurpose: Sterile peripheral IV cannula (green 18G, 1.2 x 45 mm) for IV drug administration, fluid resuscitation, and blood sampling.\nUse: Apply tourniquet; identify vein; clean skin with alcohol swab; bevel up insertion at 15–30 degrees; advance until flashback in chamber; lower angle, advance cannula off needle; remove needle; connect giving set or cap; secure with Leukoplast.\nStorage: Sterile packaging; cool dry locker; minimum 4 cannulae per IMGS3. Check expiry.\nNotes: IMGS3 Ch. 5 & 6. Green 18G: suitable for most fluid resuscitation and drug administration. For rapid volume replacement in haemorrhage use largest bore available (14G grey or 16G grey if available). Replace cannula every 48–72 h or if signs of phlebitis."
 },
 {
  "code": "II.5.19",
  "name": "Infusion set sterile 1pc",
  "description": "Sterile infusion / IV drip set",
  "group": "Injection & Catheterization",
  "qty": 4,
  "ref": "Code: II.5.19\nPurpose: Sterile IV administration / drip set for delivering IV fluids (NaCl 0.9%, dextrose solutions) by gravity infusion.\nUse: Spike fluid bag aseptically; prime tubing by opening roller clamp until fluid free of air; attach to IV cannula; adjust drip rate using roller clamp (1 drip/s is approx. 60 ml/h for standard set; verify with set drop factor). Monitor bag and drip site hourly.\nStorage: Sterile packaging; cool dry locker; minimum 4 sets. Check expiry.\nNotes: IMGS3 Ch. 5 & 6. Standard drip set: 20 drops/ml. Calculate rate: (Volume ml x drop factor) divided by time in minutes = drops/min. Replace set every 24–72 h. Do not allow air into IV line — risk of air embolism."
 },
 {
  "code": "II.5.20",
  "name": "Kidney dish stainless 20/22cm",
  "description": "Kidney dish stainless steel 20/22cm",
  "group": "Injection & Catheterization",
  "qty": 2,
  "ref": "Code: II.5.20\nPurpose: Reusable stainless steel kidney-shaped emesis and procedural tray for collecting instruments, dressings, used sharps (interim), wound exudate, and patient vomit.\nUse: Use as sterile field for small procedures when covered with sterile drape. For emesis: position under chin; support for patient comfort. Wash and disinfect with 70% ethanol between patients.\nStorage: Clean dry medical locker; nest stacked with smallest inside; inspect for dents or cracks that impede cleaning.\nNotes: IMGS3 Ch. 8. Two dishes (20/22 cm) per IMGS3 requirement. Not for permanent sharps disposal (use approved sharps container). Autoclave or chemical disinfect before sterile procedures."
 },
 {
  "code": "ii.6.11",
  "name": "PPE Set: apron, goggles, mask",
  "description": "Personal protective equipment set: apron, protective goggles and face mask",
  "group": "Nursing Articles",
  "qty": 4,
  "ref": "Code: ii.6.11\nPurpose: Personal protective equipment set (disposable apron, protective goggles, and surgical/FFP2 mask) for standard and droplet/contact infection precautions.\nUse: Don in order: apron, mask, goggles; doff in reverse; perform hand hygiene after doffing. Use for all procedures with risk of splashing blood or body fluids, suspected infectious disease cases, and decontamination work.\nStorage: Sealed original packaging; dry accessible locker; minimum 4 sets. Check integrity of goggles seal and mask straps.\nNotes: IMGS3 Ch. 29 (Infection control) & MLC 2006. PPE does not replace hand hygiene. For suspected highly infectious disease (e.g. haemorrhagic fever): isolate patient, contact port health authority, and follow flag-state guidance. Stock surplus PPE for disease outbreaks."
 },
 {
  "code": "II.6.12",
  "name": "Support bedpan (plastic)",
  "description": "Bedpan (plastic)",
  "group": "Nursing Articles",
  "qty": 1,
  "ref": "Code: II.6.12\nPurpose: Slipper/fracture bedpan for bedridden patients unable to use toilet; minimises spinal movement in trauma or post-procedure patients.\nUse: Warm bedpan if cold; position under patient with flat end toward back; support patient during use; remove and dispose of waste; clean bedpan with detergent and disinfect with bleach solution (1:10 dilution) between patients.\nStorage: Clean dry utility area; stored inverted; minimum 1 per sickbay.\nNotes: IMGS3 Ch. 24 (Nursing care). Label for single-patient use where infection control requires. Inspect for cracks that impair cleaning. Plastic fracture pan allows use in supine position with less patient movement."
 },
 {
  "code": "II.6.13",
  "name": "Hot water bag",
  "description": "Hot water bottle / bag",
  "group": "Nursing Articles",
  "qty": 1,
  "ref": "Code: II.6.13\nPurpose: Rubber hot water bottle for application of superficial heat to relieve musculoskeletal pain, menstrual cramps, and colic; also for patient warming in mild hypothermia.\nUse: Fill two-thirds with hot water (not boiling — maximum 60 C); expel air; seal tightly; wrap in cloth cover before applying to skin (prevents burns). Do not apply to anaesthetised or insensate areas. Refill as required.\nStorage: Dry locker; store empty with cap loose; inspect rubber for cracks and perishing annually.\nNotes: IMGS3 Ch. 24. Do not use on confused patients who cannot report pain — risk of contact burns. Diabetic patients: reduced skin sensation — use cautiously. For hypothermia: prioritise gradual rewarming per IMGS3 Ch. 21 protocol."
 },
 {
  "code": "II.6.14",
  "name": "Urinal (glass)",
  "description": "Urinal bottle (glass)",
  "group": "Nursing Articles",
  "qty": 1,
  "ref": "Code: II.6.14\nPurpose: Glass urinal bottle for male bedridden patients to pass urine without leaving bed; essential for immobilised trauma or post-surgical patients.\nUse: Position patient in comfortable semi-recumbent position; insert penis into neck; remove when full; measure volume if monitoring urinary output; wash with detergent and disinfect between uses.\nStorage: Clean dry utility area; glass — store to prevent breakage; inspect for chips or cracks that impair cleaning.\nNotes: IMGS3 Ch. 24. Measure and record urine output in monitoring charts (II.4.13) for critically ill patients. If unable to void: assess for urinary retention (suprapubic tenderness, palpable bladder) — catheterisation (II.5.12) may be required."
 },
 {
  "code": "II.6.15",
  "name": "Cold/Hot pack large 16x26cm",
  "description": "Cold/hot pack large 16x26cm",
  "group": "Nursing Articles",
  "qty": 1,
  "ref": "Code: II.6.15\nPurpose: Reusable gel pack for application of cold (reduce swelling, acute injury) or heat (relieve chronic pain, muscle spasm) therapy.\nUse: Cold: freeze or chill; wrap in cloth; apply to injury for 15–20 min; remove for 20 min; repeat cycle. Do not apply frozen pack directly to skin (ice burn). Heat: immerse in hot water (60–70 C) or microwave per instructions; wrap and apply. Limit application to 20 min intervals.\nStorage: Seal checked; store as per manufacturer (refrigerator optional); room temperature acceptable for heat use. Inspect gel pack for leaks annually.\nNotes: IMGS3 Ch. 9. RICE protocol: Rest, Ice, Compression, Elevation for sprains/strains — apply cold pack within first 48 h. After 48 h, heat application may be beneficial."
 },
 {
  "code": "II.6.16",
  "name": "Rescue blanket aluminum foil",
  "description": "Emergency rescue blanket, aluminum foil",
  "group": "Nursing Articles",
  "qty": 1,
  "ref": "Code: II.6.16\nPurpose: Lightweight aluminium foil emergency blanket for prevention and treatment of hypothermia by reflecting radiated body heat and providing wind/rain barrier.\nUse: Wrap shiny side inward (reflecting heat back to patient); cover head if possible (high heat loss from scalp); ensure at least one dry layer under patient. Use in combination with insulating material. For immersion hypothermia: remove wet clothing first.\nStorage: Sealed foil packaging; compact and lightweight — stow in first-aid kit, survival craft kit, MOB kit. Single use — discard after use.\nNotes: IMGS3 Ch. 21 (Hypothermia) & SOLAS survival craft requirements. Does not actively warm — only retains existing heat. For severe hypothermia (below 32 C): minimal patient movement, horizontal position, avoid cardiac stimulation, CIRM consultation."
 },
 {
  "code": "II.6.17",
  "name": "Diphoterine 200ml (chemical wash)",
  "description": "Chemical decontamination solution for corrosive/irritant exposure, 200ml",
  "group": "Nursing Articles",
  "qty": 0,
  "ref": "Code: II.6.17\nPurpose: Amphoteric, polyvalent decontamination solution for emergency irrigation of eye and skin exposed to corrosive chemicals (acids, alkalis, solvents, oxidisers).\nUse: Immediately after chemical exposure: irrigate affected eye or skin with entire 200 ml bottle; remove contact lenses if present before irrigation; continue irrigation for minimum 15–30 min total (saline or water if Diphoterine exhausted). Remove contaminated clothing while irrigating skin.\nStorage: Accessible emergency location (near chemicals, engine room first-aid station); room temperature; check expiry; protect from freezing. IMDG/IMO chemical exposure emergency kit.\nNotes: IMGS3 Ch. 8 & 20 (Chemical injuries). More effective than water for chemical decontamination due to buffering and chelation. Begin irrigation within 10 s of exposure for best outcome. After irrigation: assess severity, cover with sterile dressing, consult CIRM. Document chemical name in medical log."
 },
 {
  "code": "II.7.11",
  "name": "Aluminium splint fingers/toes 30cm",
  "description": "Malleable aluminium finger/toe splint, 30cm",
  "group": "Immobilization",
  "qty": 2,
  "ref": "Code: II.7.11\nPurpose: Malleable aluminium foam-backed finger/toe splint (30 cm) for immobilising phalangeal and metacarpal/metatarsal fractures and dislocations.\nUse: Measure and cut to required length; mould to desired angle (neutral or functional position); pad bony prominences; apply over injured digit; secure with tubinette or bandage. Immobilise joint above and below fracture.\nStorage: Cool dry locker; store flat or rolled; minimum 2 splints per IMGS3.\nNotes: IMGS3 Ch. 10 (Fractures). Check capillary refill and sensation in distal digit after application. For mallet finger: position DIP in full extension. X-ray on arrival at port to confirm reduction. Document fracture site and splint applied."
 },
 {
  "code": "II.7.12",
  "name": "Wire splint forearm/leg 70cm set/6",
  "description": "Malleable wire splint forearm+hand / lower leg, 70cm, set of 6",
  "group": "Immobilization",
  "qty": 1,
  "ref": "Code: II.7.12\nPurpose: Set of 6 malleable wire (aluminium ladder) splints 70 cm for immobilising forearm/wrist/hand or lower leg/ankle fractures when vacuum splints unavailable.\nUse: Select appropriate length; pad with cotton wool (II.2.29) or synthetic wool (II.2.40); mould to limb contour in position of function; secure with bandage; check neurovascular status distally after application.\nStorage: Rolled or flat in original packaging; dry locker; minimum 1 set (6 splints) per IMGS3.\nNotes: IMGS3 Ch. 10. Wire splints require padding to prevent pressure injury — never apply unpadded. For femoral fractures: traction splint or vacuum splint required (wire splint inadequate). Check sensation and capillary refill every 30 min after application."
 },
 {
  "code": "II.7.13",
  "name": "Vacuum splints arm/leg + pump",
  "description": "Vacuum splints (half/full arm, half/full leg) with hand pump",
  "group": "Immobilization",
  "qty": 1,
  "ref": "Code: II.7.13\nPurpose: Vacuum-moulded inflatable splints (half arm, full arm, half leg, full leg) that harden around the injured limb on air evacuation, providing superior immobilisation for fractures and dislocations.\nUse: Position limb in anatomical position; place open vacuum splint under/around limb; connect pump; evacuate air until splint is firm; disconnect pump and secure valve. Re-check firmness every 30 min (may leak).\nStorage: Clean, dry, folded set in carrying bag; inspect airtightness annually by inflating and leaving 15 min; pump working order checked.\nNotes: IMGS3 Ch. 10. Excellent for femur shaft fractures (half-leg splint combined with traction). Monitor for compartment syndrome: increasing pain, paraesthesia, pallor despite adequate splinting = CIRM urgently. Do not apply over open fractures without wound dressing in place."
 },
 {
  "code": "II.7.14",
  "name": "Neck collar Stifneck Select adj.",
  "description": "Neck collar Stifneck Select or equivalent, adjustable",
  "group": "Immobilization",
  "qty": 2,
  "ref": "Code: II.7.14\nPurpose: Adjustable cervical collar (Stifneck Select or equivalent) for cervical spine immobilisation in suspected C-spine injury (trauma, fall, diving accident).\nUse: Measure collar size using Stifneck sizing guide (finger-width method); apply with patient in neutral position; chin fully seated in chin rest; collar should restrict flexion/extension while allowing normal breathing and swallowing. Maintain manual inline stabilisation until collar secured.\nStorage: In original box; clean with ethanol wipe after each use; inspect adjustment mechanism; minimum 2 collars (different sizes) per IMGS3.\nNotes: IMGS3 Ch. 10 & 11. Collar alone does not fully immobilise C-spine — supplement with vacuum mattress (II.7.15) and head blocks for full spinal precautions. Do not apply collar to conscious patient who adopts abnormal head position (may represent protective posture for incomplete fracture)."
 },
 {
  "code": "II.7.15",
  "name": "Vacuum shell mattress + foot pump",
  "description": "Vacuum shell mattress with foot pump",
  "group": "Immobilization",
  "qty": 1,
  "ref": "Code: II.7.15\nPurpose: Full-body vacuum mattress for total spinal immobilisation during transfer and evacuation — moulds to patient contour then hardens on air evacuation.\nUse: Place mattress flat on firm surface; position patient log-roll technique onto mattress with C-spine control; adjust granules around body; connect foot pump; evacuate air until mattress is rigid; strap patient with minimum 5 body straps.\nStorage: Clean, dry storage; inspect airtight valve and pump annually; check granule distribution for clumping.\nNotes: IMGS3 Ch. 10. Gold standard for shipboard spinal immobilisation and helicopter evacuation. Maintain inflation — if mattress softens during transport, re-evacuate. For helicopter hoist: confirm mattress fits hoist stretcher. Document mechanism of injury and neurological assessment (motor/sensory) before and after application."
 },
 {
  "code": "II.8.11",
  "name": "Hadex 2.5L drinking water disinfectant",
  "description": "Hadex 2.5L drinking water disinfectant suitable for human consumption",
  "group": "Disinfection & Protection",
  "qty": 2,
  "ref": "Code: II.8.11\nPurpose: Hadex sodium hypochlorite-based drinking water disinfectant for shipboard potable water chlorination, tank disinfection, and outbreak-response decontamination.\nUse: Potable water treatment: add 0.2 ml per 10 L for clear water; 0.4 ml per 10 L for turbid water; leave 30 min contact time; target free chlorine 0.2–0.5 mg/L. Tank disinfection: higher concentration per manufacturer protocol. Always test residual chlorine with test kit.\nStorage: Cool shaded locker; upright, tightly sealed; away from sunlight and heat (degrades NaOCl); minimum 2 bottles per IMGS3. Note manufacture date — chlorine concentration decreases with age.\nNotes: IMGS3 Ch. 28 (Water hygiene) & IHR 2005. Mandatory for flag-state certificate compliance. Do not use in higher concentrations for potable water (taste/toxicity). Log all water treatment in ship's sanitation log."
 },
 {
  "code": "II.8.12",
  "name": "Mosquito Repellent DEET 50% 50ml",
  "description": "Diethyltoluamide (DEET) 50% insect repellent, 50ml",
  "group": "Disinfection & Protection",
  "qty": 30,
  "ref": "Code: II.8.12\nPurpose: DEET 50% insect repellent lotion for personal protection against mosquitoes (malaria, dengue, Zika, chikungunya), ticks, and other biting arthropods in endemic regions.\nUse: Apply to exposed skin; avoid eyes, mouth, and broken skin; wash hands after application; reapply every 4–6 h; shower off after exposure period. For use under clothing: apply to fabric. Protect children's hands from self-contamination.\nStorage: Cool locker; avoid exposure to synthetic fabrics/plastics (DEET is a solvent); original sealed bottle; minimum 30 units per IMGS3 for crew voyaging to malaria-endemic areas.\nNotes: IMGS3 Ch. 23 (Infectious diseases — Malaria). 50% DEET provides up to 8–10 h protection. Not recommended for infants below 2 months. DEET damages some plastics — apply to skin not watch straps or spectacle frames."
 },
 {
  "code": "II.8.13",
  "name": "Biokill insect spray 400ml",
  "description": "Spray pesticide against flies and crawling insects",
  "group": "Disinfection & Protection",
  "qty": 2,
  "ref": "Code: II.8.13\nPurpose: Permethrin-based residual insecticide spray for control of flies, cockroaches, mosquitoes, and crawling insects aboard ship — vector control and infestation management.\nUse: Ventilate area; remove or cover food surfaces and food; spray into cracks, crevices, bilge areas, storage spaces; allow to dry before re-entry (minimum 30 min); do not spray directly on skin. Use PPE (gloves, mask) during application.\nStorage: Cool locker away from heat, ignition sources; upright; aerosol — do not puncture or incinerate. Minimum 2 cans per IMGS3.\nNotes: IMGS3 Ch. 28 (Pest control). Ship Sanitation Certificate requires evidence of pest-control programme. Biokill active for weeks on treated surfaces. Log all pest-control applications including date, area, product, and operative. Restricted use near water tanks."
 },
 {
  "code": "II.9.21",
  "name": "Body bag",
  "description": "Body bag",
  "group": "Various Supplies",
  "qty": 1,
  "ref": "Code: II.9.21\nPurpose: Sealed heavy-duty polyethylene/vinyl body bag for dignified containment and preservation of a deceased crew member pending repatriation or port disembarkation.\nUse: Place deceased in bag in supine position; zip fully sealed; label exterior with name, DOB, date/time of death, cause if known, ship name, and IMO number. Refrigerate (0–4 C) or store in coolest available space. Complete death documentation (death certificate, DMLC entries).\nStorage: Sealed in original packaging; stowed accessible but discreet location; minimum 1 bag per IMGS3.\nNotes: MLC 2006 Standard A4.1 — Repatriation of seafarer's remains. Notify flag state, port state, and master's port agent immediately. Complete official death log entry (time, cause, witnesses). Consult flag-state requirements for death certificate and consular notification."
 },
 {
  "code": "II.9.22",
  "name": "Medical Shipping Manual (last ed.)",
  "description": "Medical Handbook for Shipping (latest edition, incl. supplements)",
  "group": "Various Supplies",
  "qty": 1,
  "ref": "Code: II.9.22\nPurpose: Authoritative medical reference manual for the ship's medical officer — provides evidence-based protocols for diagnosis, treatment, and radio medical consultation for all conditions expected aboard.\nUse: Primary reference for all medical decisions at sea. Cross-reference with IMGS3 drug monographs, clinical chapters, and dosing tables. Use structured radio-medical consultation form from manual when contacting CIRM.\nStorage: Dry accessible locker; protected from moisture; supplements inserted into correct sections when issued. Minimum 1 copy (latest edition with all supplements) per IMGS3.\nNotes: IMGS3 Ch. 1. SOLAS & MLC 2006 mandatory reference. Supplements must be inserted promptly when received — outdated recommendations can lead to clinical errors. Replace when new edition issued. Ensure crew know its location."
 },
 {
  "code": "",
  "name": "Pulse Oximeter",
  "description": "Pulse oximeter for SpO2 measurement",
  "group": "Extra Items",
  "qty": 0,
  "ref": "Code: Extra (no IMGS code assigned)\nPurpose: Non-invasive measurement of peripheral oxygen saturation (SpO2) and pulse rate — essential for monitoring respiratory patients, guiding oxygen therapy, and detecting silent hypoxaemia.\nUse: Apply probe to clean, warm, non-nailpolished fingertip; ensure good waveform before reading; SpO2 below 94% requires clinical assessment; below 90% = significant hypoxia — start O2; below 85% = critical. Measure continuously in unstable patients.\nStorage: Protective case; check battery status monthly; keep spare batteries; clean probe with ethanol wipe between patients; protect from moisture.\nNotes: Not IMGS3-listed but widely recommended for maritime medicine. Unreliable in: poor peripheral perfusion, hypothermia, severe anaemia, nail polish, carbon monoxide poisoning (falsely high). In CO poisoning: SpO2 normal but patient hypoxic — use clinical judgement and give high-flow O2 regardless."
 },
 {
  "code": "",
  "name": "Cederroth Eye Wash 500ml",
  "description": "Eye wash solution 500ml",
  "group": "Extra Items",
  "qty": 0,
  "ref": "Code: Extra (no IMGS code assigned)\nPurpose: Isotonic sterile saline eyewash solution (500 ml) for emergency irrigation of eyes exposed to dust, chemicals, foreign bodies, and splashes.\nUse: Immediately irrigate affected eye: tilt head affected-side down; hold eyelid open; pour or pump saline across eye from inner to outer canthus for minimum 15 min (chemical splash) or until foreign body removed; repeat as needed. Do not use same bottle on both eyes.\nStorage: Accessible first-aid locker (engine room, deck station, medical office); protect from freezing; check expiry; replace after use.\nNotes: IMGS3 Ch. 13. For chemical splash Diphoterine (II.6.17) is more effective and should be used first where available; Cederroth eyewash for continued lavage. Remove contact lenses before irrigation. After irrigation: stain with fluorescein and inspect with blue penlight for corneal damage."
 },
 {
  "code": "",
  "name": "Burn Jel Burnshield Hydrogel",
  "description": "Burn shield hydrogel for burn treatment",
  "group": "Extra Items",
  "qty": 0,
  "ref": "Code: Extra (no IMGS code assigned)\nPurpose: Water-based hydrogel (Burnshield or equivalent) for first-aid cooling and pain relief of partial-thickness burns — stops burning process, maintains moist wound environment, and reduces pain.\nUse: Apply gel liberally to burned area within the first 10 min; do not wrap tightly; cover loosely with sterile dressing or leave gel-soaked dressing in place; do not remove cooled gel in transit. Do not apply to full-thickness (white/charred) burns or face without medical guidance.\nStorage: Cool dry locker; protect from freezing; check expiry; store gel sachets and dressings in original packaging.\nNotes: IMGS3 Ch. 7 (Burns). Do not use ice, butter, toothpaste, or other home remedies on burns — Burnshield gel only. For burns above 10% BSA, facial burns, or inhalation injury: CIRM immediately and prepare for MEDEVAC. Analgesics (morphine) required for significant burns."
 }
];

/** The WHO IMGS medicine reference, every entry (Marine Hospital Manager imgs-medicines.ts). */
export const IMGS_REFERENCE: { name: string; text: string }[] = [
 {
  "name": "Acetylsalicylic acid",
  "text": "Also known as: Aspirin®, Aspro®\nForm & Strength: tablet 300 mg\nIndications: high dose (600–900 mg): to reduce pain, fever, inﬂammation; low dose (100–150 mg) to inhibit formation of blood clots in angina pectoris, myocardial infarction,; stroke\nContraindications: peptic ulcer, history of gastrointestinal bleeding, haemophilia, fever in patients under 18, trauma\nDosage: for pain and inﬂammation: 2–3 tablets every 4–6 hours; for thrombosis: half a tablet daily\nConsult doctor: no"
 },
 {
  "name": "Aciclovir",
  "text": "Also known as: Zovirax®, acyclovir\nForm & Strength: tablet 400 mg\nIndications: treatment of primary or recurrent herpes simplex virus infection; may be useful for severe varicella and herpes zoster (doctor should be consulted)\nDosage: 400 mg 3 times daily for 5–10 days for primary infection or for 3–5 days for recurrence\nConsult doctor: not if used according to IMGS3 recommendations"
 },
 {
  "name": "Adrenaline",
  "text": "Also known as: epinephrine, adrenaline 1:1000\nForm & Strength: ampoule 1 ml = 1 mg\nIndications: to raise blood pressure in anaphylaxis; to dilate airways in severe asthma or anaphylaxis\nContraindications: none in emergencies\nDosage: for anaphylaxis: 0.5 ml, IM, repeated every 5 minutes if needed; for severe asthma: 0.5 ml, IM, repeated every 5 minutes if needed\nConsult doctor: yes, if possible, but do not delay use in emergency"
 },
 {
  "name": "Amethocaine 0.5% eye drops",
  "text": "Also known as: Augmentin®, co-amoxyclav\nForm & Strength: tablet 875 mg/125 mg\nIndications: to treat infections responsive to this antibiotic\nDosage: 2 drops inside lower eyelid\nConsult doctor: no"
 },
 {
  "name": "Amoxicillin + clavulanate",
  "text": "Dosage: one tablet twice daily, taken with food.\nConsult doctor: no, if used according to IMGS3 recommendations"
 },
 {
  "name": "Artemether",
  "text": "Also known as: Larither®\nForm & Strength: ampoule 1 ml (= 80 mg)\nIndications: treatment of severe malaria\nDosage: see under Malaria in IMGS3, Chapter 23, Infectious diseases\nConsult doctor: as soon as possible but, in emergencies, treatment must be carried out without delay in"
 },
 {
  "name": "Artemether + lumefantrine",
  "text": "Also known as: Riamet ®\nForm & Strength: tablets 20 mg + 120 mg\nIndications: treatment of malaria\nContraindications: not to be used in women in early pregnancy without medical advice\nDosage: see under Malaria in Chapter 23, Infectious diseases\nConsult doctor: not if used according to IMGS3 recommendation"
 },
 {
  "name": "Atropine",
  "text": "Form & Strength: ampoule 1.2 mg/ml\nIndications: to treat slow heart rate in myocardial infarction; to treat organophosphate insecticide poisoning\nContraindications: none in emergencies\nDosage: for slow heart rate in myocardial infarction: 0.6 mg IM or IV\nConsult doctor: no, in emergencies; yes, in organophosphate insecticide poisoning"
 },
 {
  "name": "Azithromycin",
  "text": "Also known as: Zithromax®\nForm & Strength: tablet 500 mg\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to erythromycin or similar (macrolide) antibiotics\nDosage: as recommended in IMGS3 for the speciﬁc infection\nConsult doctor: no, if used according to instructions in IMGS3"
 },
 {
  "name": "Ceftriaxone",
  "text": "Also known as: Rocephin®\nForm & Strength: ampoule 1 g powder for injection (dissolve in water for injection)\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to cephalosporin or penicillin antibiotics\nDosage: as recommended in IMGS3 for the speciﬁc infection\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Cetirizine",
  "text": "Also known as: Zyrtec®\nForm & Strength: tablet 10 mg\nIndications: to treat allergy symptoms in hay fever, hives, allergic dermatitis, etc.\nContraindications: allergy to cetirizine\nDosage: 10 mg daily up to a maximum of 20 mg daily\nConsult doctor: no"
 },
 {
  "name": "Charcoal, activated",
  "text": "Form & Strength: 50 g in 300 ml puriﬁed water\nIndications: to absorb ingested poisons\nContraindications: bowel obstruction\nDosage: 1 g/kg orally up to a maximum of 100 g for ﬁrst dose; for repeat doses, 50 g every 4 hours, if advised by a doctor\nConsult doctor: yes"
 },
 {
  "name": "Ciproﬂoxacin",
  "text": "Also known as: Ciproxin®, Cipro®\nForm & Strength: tablet 250 mg\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to quinolones\nDosage: as recommended in IMGS3 for the speciﬁc infection; to be taken 1 hour before or 2 hours after meals; milk and other dairy products to be avoided\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Cloves, oil of",
  "text": "Also known as: Syzygium aromaticum\nForm & Strength: oil\nIndications: toothache\nDosage: to be applied to aﬀected tooth with cotton wool soaked in oil of cloves\nConsult doctor: no"
 },
 {
  "name": "Dexamethasone",
  "text": "Also known as: Decadron®\nForm & Strength: ampoule 4mg/ml\nIndications: to treat life-threatening and severe asthma; to treat anaphylaxis; to treat severe allergic reactions\nContraindications: none in emergencies\nDosage: for anaphylaxis and life-threatening asthma: 4 mg IM or IV; otherwise as advised by a doctor\nConsult doctor: not in anaphylaxis or in life-threatening asthma; yes, otherwise"
 },
 {
  "name": "Diazepam",
  "text": "Also known as: Valium®\nForm & Strength: tablet 5 mg\nIndications: to treat alcohol withdrawal\nContraindications: severe respiratory disease; opioid intoxication; severe liver disease; myasthenia gravis\nDosage: see IMGS3, Chapter 22, Tobacco, alcohol, and drug use\nConsult doctor: no"
 },
 {
  "name": "Docusate with senna",
  "text": "Also known as: Neo-Dagracycline®, Unidox®, Vibra-S®, Vibramycine®, Doryx®\nForm & Strength: tablet 100 mg\nIndications: as recommended in IMGS3 for the speciﬁc infection\nDosage: 1–2 tablets at bedtime, may be increased to up to 2 tablets twice daily if required\nConsult doctor: no"
 },
 {
  "name": "Docusate with senna (or equivalent)",
  "text": "Also known as: Neo-Dagracycline®, Unidox®, Vibra-S®, Vibramycine®, Doryx®\nForm & Strength: tablet 100 mg\nIndications: as recommended in IMGS3 for the speciﬁc infection\nDosage: 1–2 tablets at bedtime, may be increased to up to 2 tablets twice daily if required\nConsult doctor: no"
 },
 {
  "name": "Doxycycline",
  "text": "Dosage: no, if used according to IMGS3 instructions; as recommended in IMGS3 for the speciﬁc infection; 1 tablet with 300 ml water"
 },
 {
  "name": "Ethanol 70%, hand cleanser gel",
  "text": "Form & Strength: gel\nIndications: an alternative to hand-washing when hands are not obviously soiled\nContraindications: soiled hands\nDosage: enough should be used to cover hands thoroughly and allowed to dry\nConsult doctor: no"
 },
 {
  "name": "Ethanol 70%, liquid",
  "text": "Form & Strength: liquid\nIndications: to disinfect instruments and surfaces"
 },
 {
  "name": "Frusemide",
  "text": "Also known as: Lasix®, furosemide\nForm & Strength: ampoule 4 ml = 40 mg\nIndications: to treat severe ﬂuid retention in lungs (pulmonary oedema) due to cardiac failure\nContraindications: none in an emergency\nDosage: 40 mg IV over 10 minutes or (less desirable) IM; repeat in 1 hour if necessary\nConsult doctor: yes, after ﬁrst dose"
 },
 {
  "name": "Glucagon, ready to use",
  "text": "Also known as: Haldol®\nForm & Strength: ampoule 1 ml = 5 mg\nIndications: to treat psychotic hallucinations and delusions; to treat severe agitation and aggressiveness\nDosage: 1 mg IM or SC: response should occur within 15 minutes\nConsult doctor: not if used in accordance with IMGS3 recommendations"
 },
 {
  "name": "Haloperidol",
  "text": "Dosage: 2–10 mg IM, repeated every 2–6 hours if needed; maximum: 15 mg in 24 hours\nConsult doctor: yes, except in emergencies"
 },
 {
  "name": "Hydrocortisone 1% cream",
  "text": "Form & Strength: cream\nIndications: to treat allergy and some other inﬂammatory skin conditions\nContraindications: open wounds or skin infections caused by bacteria, viruses or fungi\nDosage: to be applied sparingly twice daily; after a few days, application to be reduced to once a day\nConsult doctor: no, unless use exceeds one week"
 },
 {
  "name": "Ibuprofen",
  "text": "Also known as: Advil®, Actifen®, Nerofen®, Genpril®, Haltran®, Medipren®, Brufen®\nForm & Strength: coated tablet 400 mg\nIndications: to treat inﬂammation; to reduce mild-to-moderate pain, especially if associated with inﬂammation\nContraindications: peptic ulcer; gastrointestinal bleeding; kidney failure; liver failure\nDosage: no; 400–800 mg every 6 hours; maximum 3200 mg (= 8 tablets) per 24 hours"
 },
 {
  "name": "Isosorbide dinitrate",
  "text": "Also known as: Cedocard®, Isordil®\nForm & Strength: tablet 5 mg\nIndications: to treat angina pectoris (chest pain); to treat myocardial infarction\nContraindications: hypotension (low blood pressure); known heart valve disease; head injury; treatment with sildenaﬁl (Viagra) and similar drugs\nDosage: no; 1 tablet, sublingual, repeated once after 10 minutes if pain persists; to be used preventively if possible before activity likely to cause angina"
 },
 {
  "name": "Lignocaine 1%",
  "text": "Also known as: Xylocaine®, lidocaine\nForm & Strength: ampoule 5 ml\nIndications: for local anaesthesia when suturing wounds or performing minor surgery\nContraindications: allergy to local anaesthetics\nDosage: maximum 200 mg (20 ml of 1% solution); after maximum dose, give no more for 2 hours\nConsult doctor: no"
 },
 {
  "name": "Lignocaine 1% (without adrenaline)",
  "text": "Also known as: Xylocaine®, lidocaine\nForm & Strength: ampoule 5 ml\nIndications: for local anaesthesia when suturing wounds or performing minor surgery\nContraindications: allergy to local anaesthetics\nDosage: maximum 200 mg (20 ml of 1% solution); after maximum dose, give no more for 2 hours\nConsult doctor: no"
 },
 {
  "name": "Loperamide",
  "text": "Also known as: Imodium®, Diacure®\nForm & Strength: tablet 2 mg\nIndications: to treat symptoms of diarrhoea\nContraindications: bowel obstruction; dysentery; acute ulcerative colitis\nDosage: starting dose 4 mg; then 2 mg with each diarrhoeal motion up to 16 mg (= 8 capsules) per 24 hours\nConsult doctor: no"
 },
 {
  "name": "Mebendazole",
  "text": "Also known as: Vermox®\nForm & Strength: tablet 100 mg\nIndications: to treat intestinal worm infections; not eﬀective for tapeworm infection or hydatid disease\nContraindications: allergy to mebendazole\nDosage: as recommended in IMGS3 for the speciﬁc infection; to be taken with food\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Metoprolol",
  "text": "Also known as: Selokeen®, Lopresor®, Toprol XL®, Betaloc®\nForm & Strength: tablet 100 mg\nIndications: to treat hypertension (high blood pressure); to treat atrial ﬁbrillation (irregular or rapid heart rate); to treat angina pectoris (chest pain); to prevent migraine.\nContraindications: asthma; shock; heart rate less than 50 beats/min; cardiac failure\nDosage: yes; oral, with food; for hypertension: 100 mg once daily"
 },
 {
  "name": "Metronidazole",
  "text": "Also known as: Flagyl®\nForm & Strength: tablet 500 mg\nIndications: to treat infections responsive to this antibiotic\nContraindications: allergy to metronidazole\nDosage: as recommended in IMGS3 for the speciﬁc infection; to be taken with food if possible to minimize unwanted eﬀects\nConsult doctor: no, if used according to IMGS3 instructions"
 },
 {
  "name": "Miconazole 2% cream",
  "text": "Also known as: Daktarin®, Dermacure®, Monistat®\nForm & Strength: cream\nIndications: to treat fungal skin infections\nContraindications: allergy to miconazole\nDosage: a thin ﬁlm to be applied twice daily then for 2 weeks after symptoms have gone; hands should be washed promptly after use\nConsult doctor: no"
 },
 {
  "name": "Midazolam",
  "text": "Also known as: Hypnovel®\nForm & Strength: ampoule 1 ml (= 5 mg)\nIndications: to terminate epileptic ﬁts\nDosage: 0.1–0.2 mg/kg body weight IM or 10 mg intranasally; two ampoules should be opened and one drop allowed to drip into alternate nostrils until; ampoules are empty\nConsult doctor: no, for emergencies, yes, for repeated use"
 },
 {
  "name": "Misoprostol",
  "text": "Also known as: Cytotec®\nForm & Strength: tablet 200 μg\nIndications: to prevent post-partum haemorrhage\nContraindications: none if given according to IMGS3 recommendations\nDosage: 600 μg orally immediately after delivery\nConsult doctor: no"
 },
 {
  "name": "Morphine",
  "text": "Form & Strength: liquid 1 mg/ml\nIndications: to reduce severe pain likely to last several days in patients able to eat and drink\nContraindications: as for morphine given by injection\nDosage: see IMGS3, Chapter 3, Pain management\nConsult doctor: not if used according to IMGS3 recommendations"
 },
 {
  "name": "Morphine (injectable)",
  "text": "Form & Strength: ampoule 1 ml = 10 mg\nIndications: to reduce severe pain; to reduce pain not relieved by other analgesics\nContraindications: coma, unless the patient is dying of a clearly-documented illness, such as cancer; severe liver disease; asthma; severe respiratory disease except pneumonia or pleurisy associated with severe pain\nDosage: see IMGS3, Chapter 3, Pain management\nConsult doctor: yes, if doses exceeding those recommended in IMGS3 are needed or if duration of treatment"
 },
 {
  "name": "Morphine (oral)",
  "text": "Form & Strength: liquid 1 mg/ml\nIndications: to reduce severe pain likely to last several days in patients able to eat and drink\nContraindications: as for morphine given by injection\nDosage: see IMGS3, Chapter 3, Pain management\nConsult doctor: not if used according to IMGS3 recommendations"
 },
 {
  "name": "Naloxone",
  "text": "Also known as: Narcan®\nForm & Strength: ampoule 1 ml (= 0.4 mg)\nIndications: to reverse eﬀects of opioids, especially in cases of overdose\nDosage: 0.4 mg IM, repeated as needed; response should be rapid: if no response to 5 doses, diagnosis is not opioid overdose\nConsult doctor: not in emergencies"
 },
 {
  "name": "Omeprazole",
  "text": "Also known as: Losec®, Prilosec®\nForm & Strength: tablet 20 mg\nIndications: to treat gastro-oesophageal reﬂux; to treat peptic ulcer disease\nDosage: no; starting dose 20 mg once daily before a meal, preferably in the evening; dose increased to 40 mg daily if symptoms persist"
 },
 {
  "name": "Ondansetron",
  "text": "Also known as: Zofran®\nForm & Strength: tablet 4 mg\nIndications: to prevent vomiting; to prevent seasickness\nDosage: one tablet, preferably taken before the stimulus to vomiting\nConsult doctor: not for single doses"
 },
 {
  "name": "Oral rehydration salts",
  "text": "Also known as: Repolyte®, Gastrolyte®, Dioralyte®\nForm & Strength: sachets of powder for reconstitution\nIndications: to prevent or treat dehydration, especially due to diarrhoea\nDosage: no; as recommended in IMGS3; correct amount of boiled, cooled tap water (not less water than speciﬁed) to be added to the"
 },
 {
  "name": "Oxymetazoline 0.5%",
  "text": "Also known as: acetaminophen, Tylenol®, Panadol®\nForm & Strength: tablet 500 mg\nIndications: to reduce pain and fever (but not inﬂammation)\nContraindications: liver disease\nDosage: 1000 mg every 6 hours; maximum 4000 mg (= 8 tablets) per 24 hours\nConsult doctor: no"
 },
 {
  "name": "Oxymetazoline 0.5% (or equivalent)",
  "text": "Also known as: acetaminophen, Tylenol®, Panadol®\nForm & Strength: tablet 500 mg\nIndications: to reduce pain and fever (but not inﬂammation)\nContraindications: liver disease\nDosage: 1000 mg every 6 hours; maximum 4000 mg (= 8 tablets) per 24 hours\nConsult doctor: no"
 },
 {
  "name": "Permethrin 1% lotion",
  "text": "Also known as: Loxazol®, Elimite®, Nix®\nForm & Strength: lotion\nIndications: to eliminate hair, pubic, and body lice\nDosage: no; to be applied to washed, damp hair or skin, rubbed in, left for 10 minutes, then rinsed oﬀ; a ﬁne-tooth comb should be used to remove eggs"
 },
 {
  "name": "Permethrin 5% lotion",
  "text": "Also known as: Lyclear®\nForm & Strength: lotion\nIndications: to treat scabies"
 },
 {
  "name": "Povidone iodine ointment 10% and solution 10%",
  "text": "Also known as: Betadine®, Povidine®\nForm & Strength: ointment, liquid\nIndications: to disinfect skin and wounds\nContraindications: allergy to iodine\nDosage: ointment to be applied thinly with gauze 1–2 times a day\nConsult doctor: no"
 },
 {
  "name": "Prednisone",
  "text": "Also known as: prednisolone\nForm & Strength: tablet 25 mg\nIndications: to treat severe asthma; to treat other inﬂammatory conditions (on medical advice)\nDosage: see under Asthma in IMGS3, Chapter 15, Respiratory diseases; to be taken with food\nConsult doctor: not if used in accordance with IMGS3 recommendations"
 },
 {
  "name": "Salbutamol aerosol",
  "text": "Also known as: albuterol, Ventolin®, Proventil®\nForm & Strength: inhaler 0.1 mg/dose with volume spacer\nIndications: to treat asthma; to treat chronic bronchitis; to treat emphysema; to treat other lung diseases\nDosage: for symptoms: 2 puﬀs every 4 hours up to 12 puﬀs maximum per day; in severe asthma, up to 10 puﬀs repeated every 15 minutes\nConsult doctor: no"
 },
 {
  "name": "Sodium chloride 0.9% infusion",
  "text": "Also known as: NaCl 0.9%, saline solution\nForm & Strength: plastic bottle, 1 litre\nIndications: for ﬂuid replacement\nDosage: see appropriate IMGS3 text or as advised by a doctor\nConsult doctor: as soon as possible but not in emergencies if used in accordance with IMGS3 recommendations"
 },
 {
  "name": "Tetracycline 1% ointment",
  "text": "Form & Strength: ointment\nIndications: to treat minor eye infections; to prevent infection following damage to the cornea\nContraindications: allergy to tetracyclines\nDosage: 1 cm ointment to be applied twice daily to inner surface of lower eyelid\nConsult doctor: not if used according to IMGS3 recommendations"
 },
 {
  "name": "Vitamin k",
  "text": "Also known as: Konakion®, phytomenadione\nForm & Strength: ampoule 1 ml = 10 mg\nIndications: to reverse excessive or unwanted eﬀect of warfarin or related drugs\nDosage: for life-threatening situations (trauma, major bleeding): 10 mg orally or IM; for minor bleeding: 1–2 mg orally\nConsult doctor: yes"
 },
 {
  "name": "Water for injection",
  "text": "Form & Strength: ampoule 5 ml\nIndications: reconstitution of injectable drugs provided as powders"
 },
 {
  "name": "Zidovudine plus lamivudine",
  "text": "Also known as: Combivir®\nForm & Strength: tablet, 300 mg + 150 mg\nIndications: prophylaxis against HIV infection after needle-stick injury\nContraindications: allergy to either component; pre-existing HIV infection\nDosage: one tablet twice daily for four weeks\nConsult doctor: yes"
 },
 {
  "name": "Zinc oxide",
  "text": "Form & Strength: paste or ointment, 20%\nIndications: protection of irritated skin\nDosage: apply liberally to aﬀected skin twice daily and after washing\nConsult doctor: no"
 }
];
