// ===================================
// Nationality as the ISO 3166-1 alpha-2 code — "GB", "ES", "UA", "PH" — as crew
// lists, passports' machine-readable zones and port authorities write it
// (9 Oct 2026: "nationality as the two-letter code, as the whole world does").
//
// `toCountryCode` turns what people type into a spreadsheet — "British",
// "Spain", "ukrainian", "U.K." — into the code; anything it cannot place is
// returned as null and the caller says so rather than guessing.
// ===================================

/** Every assigned ISO 3166-1 alpha-2 code. */
const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT ' +
  'MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG ' +
  'UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';

export const COUNTRY_CODES = new Set(CODES.split(' '));

/** Names and nationality adjectives seen on crew lists → code. Lower-case keys. */
const NAMES: Record<string, string> = {
  'united kingdom': 'GB', uk: 'GB', 'u.k.': 'GB', 'great britain': 'GB', britain: 'GB', british: 'GB', england: 'GB', english: 'GB', scottish: 'GB', welsh: 'GB',
  'united states': 'US', usa: 'US', 'u.s.a.': 'US', american: 'US',
  spain: 'ES', spanish: 'ES', france: 'FR', french: 'FR', germany: 'DE', german: 'DE', italy: 'IT', italian: 'IT',
  portugal: 'PT', portuguese: 'PT', greece: 'GR', greek: 'GR', croatia: 'HR', croatian: 'HR', montenegro: 'ME', montenegrin: 'ME',
  netherlands: 'NL', dutch: 'NL', holland: 'NL', belgium: 'BE', belgian: 'BE', ireland: 'IE', irish: 'IE',
  sweden: 'SE', swedish: 'SE', norway: 'NO', norwegian: 'NO', denmark: 'DK', danish: 'DK', finland: 'FI', finnish: 'FI',
  poland: 'PL', polish: 'PL', romania: 'RO', romanian: 'RO', bulgaria: 'BG', bulgarian: 'BG', latvia: 'LV', latvian: 'LV',
  lithuania: 'LT', lithuanian: 'LT', estonia: 'EE', estonian: 'EE', ukraine: 'UA', ukrainian: 'UA', ukranian: 'UA', ukrane: 'UA', russia: 'RU', russian: 'RU',
  georgia: 'GE', georgian: 'GE', turkey: 'TR', turkish: 'TR', türkiye: 'TR', malta: 'MT', maltese: 'MT', cyprus: 'CY', cypriot: 'CY',
  switzerland: 'CH', swiss: 'CH', austria: 'AT', austrian: 'AT', slovenia: 'SI', slovenian: 'SI', serbia: 'RS', serbian: 'RS',
  philippines: 'PH', filipino: 'PH', filipina: 'PH', philippine: 'PH', phillipines: 'PH', india: 'IN', indian: 'IN', indonesia: 'ID', indonesian: 'ID',
  myanmar: 'MM', burmese: 'MM', china: 'CN', chinese: 'CN', vietnam: 'VN', 'viet nam': 'VN', vietnamese: 'VN',
  'sri lanka': 'LK', 'sri lankan': 'LK', thailand: 'TH', thai: 'TH', malaysia: 'MY', malaysian: 'MY', japan: 'JP', japanese: 'JP',
  'south africa': 'ZA', 'south african': 'ZA', australia: 'AU', australian: 'AU', 'new zealand': 'NZ', 'new zealander': 'NZ', kiwi: 'NZ',
  canada: 'CA', canadian: 'CA', brazil: 'BR', brazilian: 'BR', argentina: 'AR', argentinian: 'AR', argentine: 'AR', mexico: 'MX', mexican: 'MX',
  egypt: 'EG', egyptian: 'EG', morocco: 'MA', moroccan: 'MA', tunisia: 'TN', tunisian: 'TN', nigeria: 'NG', nigerian: 'NG', ghana: 'GH', ghanaian: 'GH',
  kenya: 'KE', kenyan: 'KE', 'united arab emirates': 'AE', uae: 'AE', emirati: 'AE', israel: 'IL', israeli: 'IL',
  monaco: 'MC', monegasque: 'MC', 'marshall islands': 'MH', bahamas: 'BS', bahamian: 'BS', jamaica: 'JM', jamaican: 'JM',
};

/** "GB", "british", "United Kingdom" → "GB"; null when it cannot be placed. */
export function toCountryCode(raw: string | undefined | null): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (up.length === 2 && COUNTRY_CODES.has(up)) return up;
  if (up === 'UK') return 'GB';
  return NAMES[s.toLowerCase().replace(/\s+/g, ' ')] ?? null;
}

export function isCountryCode(s: string | undefined | null): boolean {
  return !!s && COUNTRY_CODES.has(s.toUpperCase()) && s.length === 2;
}
