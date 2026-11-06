// A crew member's identity and medical documents: number and scan not in the
// register (types/certificate.ts, the same words; npm run check:closedcerts).
const CLOSED_CERT_SOURCE = "passport|pasaporte|passaporte|passeport|reisepass|паспорт|seaman|seafarer'?s? (book|medical)|discharge book|libreta|sjømannsbok|\\bvisa\\b|виза|віза|eng ?1\\b|medical (fitness|certificate|exam)|fit(ness)? for duty|медкомисс|медична довідка|медицинская справка";
const CLOSED_CERT = new RegExp(CLOSED_CERT_SOURCE, 'i');

const isClosedCert = (c) => !!c && c.scope === 'crew' && CLOSED_CERT.test(c.name || '');

module.exports = { CLOSED_CERT_SOURCE, isClosedCert };
