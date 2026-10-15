// npm run check:surveys — survey windows and the next date.
import { addMonths, nextDue, surveyStatus } from '../services/surveys';
import { annualCoveredBy, certShort, certSurveySummary, defaultScheme, planForCertificate, renewedExpiry, validityYears, worstOf } from '../services/certSurveys';

let fail = 0;
const ok = (c: boolean, m: string) => { if (!c) { fail++; console.log('✗', m); } else console.log('✓', m); };
const S = (o: any): any => ({ id: 's', name: 'Class annual', due: '2026-12-15', before: 3, after: 3, repeat: 12, anniversary: true, order: 0, updatedAt: 0, ...o });
ok(addMonths('2026-01-31', 1) === '2026-02-28' && addMonths('2026-12-15', -3) === '2026-09-15', 'month arithmetic, end of month');
let st = surveyStatus(S({}), '2026-10-10');
ok(st.state === 'open' && st.opens === '2026-09-15' && st.closes === '2027-03-15', 'inside ±3 months of the anniversary = open');
st = surveyStatus(S({ due: '2027-03-01' }), '2026-10-10');
ok(st.state === 'soon' && st.days === 52, 'window opens in 52 days = soon');
st = surveyStatus(S({ due: '2027-08-01' }), '2026-10-10');
ok(st.state === 'planned', 'far away = planned');
st = surveyStatus(S({ due: '2026-06-01' }), '2026-10-10');
ok(st.state === 'overdue' && st.days === -39, '39 days past the window = overdue');
ok(nextDue(S({}), '2026-10-01') === '2027-12-15', 'anniversary-based: next anniversary whatever the day done');
ok(nextDue(S({ anniversary: false }), '2026-10-01') === '2027-10-01', 'interval-based: counted from the day done');
const once = S({ repeat: 0 });
ok(surveyStatus(once, '2026-10-10', [{ surveyId: 's', forDue: '2026-12-15' } as any]).state === 'done', 'once-only, carried out = done');

// ---- a vessel certificate's surveys (services/certSurveys.ts) ----
const cert = (o: any): any => ({ id: 'c1', scope: 'vessel', name: 'Safety Equipment Certificate', issueDate: '2024-06-20', expiryDate: '2029-06-19', itemIds: [], createdAt: 0, updatedAt: 0, ...o });
ok(defaultScheme('Safety Management Certificate (SMC)') === 'ism' && defaultScheme('International Ship Security Certificate (ISSC)') === 'ism' && defaultScheme('Maritime Labour Certificate (MLC)') === 'ism', 'SMC, ISSC, MLC: intermediate verification');
ok(defaultScheme('Document of Compliance (DOC)') === 'annual' && defaultScheme('Load Line Certificate') === 'annual', 'DOC, Load Line: annual');
ok(defaultScheme('Safety Equipment Certificate') === 'hssc' && defaultScheme('IOPP Certificate') === 'hssc' && defaultScheme('Class Certificate') === 'hssc', 'SEC, IOPP, class: annual + intermediate');
ok(defaultScheme('Certificate of Registry') === 'none' && defaultScheme('ISPP (Sewage) Certificate') === 'renewal', 'registry: nothing; ISPP: renewal only');
ok(certShort('Safety Management Certificate (SMC)') === 'SMC' && certShort('Load Line Certificate') === 'Load Line Certificate', 'short name from the brackets');
let plan = planForCertificate(cert({}), 'hssc', '2026-10-15', 1);
ok(plan.map((p) => p.survey.name).join(' | ') === 'Safety Equipment Certificate — 1st annual survey | Safety Equipment Certificate — 2nd annual survey | Safety Equipment Certificate — intermediate survey | Safety Equipment Certificate — 3rd annual survey | Safety Equipment Certificate — 4th annual survey | Safety Equipment Certificate — renewal survey', 'HSSC: four annuals, the intermediate, the renewal');
const inter = plan.find((p) => p.survey.kind === 'intermediate')!.survey;
ok(inter.due === '2026-06-19' && addMonths(inter.due, -inter.before) === '2026-03-19' && addMonths(inter.due, inter.after) === '2027-09-19', 'intermediate window: 3 months before the 2nd anniversary to 3 months after the 3rd');
ok(plan[0].survey.due === '2025-06-19' && !plan[0].include && !plan[1].include && plan[2].include && plan[3].include, 'annuals whose window has closed (1st, 2nd) are not planned by default; the intermediate and the 3rd are');
const ren = plan[plan.length - 1].survey;
ok(ren.due === '2029-06-19' && ren.before === 3 && ren.after === 0, 'renewal: in the 3 months before expiry');
plan = planForCertificate(cert({ name: 'Safety Management Certificate (SMC)' }), 'ism', '2026-10-15', 1);
ok(plan.length === 2 && plan[0].survey.name === 'SMC — intermediate verification' && plan[0].survey.due === '2026-06-19' && plan[0].survey.before === 0 && plan[0].survey.after === 12, 'SMC: intermediate verification between the 2nd and 3rd anniversary');
ok(planForCertificate(cert({ expiryDate: undefined }), 'hssc', '2026-10-15').length === 0 && planForCertificate(cert({}), 'none', '2026-10-15').length === 0, 'no expiry date or no scheme: nothing planned');
ok(planForCertificate(cert({}), 'annual', '2026-10-15', 1).filter((p) => p.survey.kind === 'annual').length === 4, 'annual scheme: one per anniversary, no intermediate');
// the summary and the intermediate taking the annual's place
const rows = planForCertificate(cert({}), 'hssc', '2026-10-15', 1).map((p) => p.survey);
let sum = certSurveySummary('c1', rows, [], '2026-10-15');
ok(sum.status === 'expired' && sum.next?.s.name.endsWith('1st annual survey') === true, 'an annual whose window closed un-endorsed: the certificate is no longer valid');
const done1 = [rows[0], rows[1]].map((r) => ({ surveyId: r.id, forDue: r.due }) as any);
sum = certSurveySummary('c1', rows, done1, '2026-10-15');
ok(sum.status === 'due' && sum.next?.s.kind === 'intermediate', 'next: the intermediate, window open');
const cov = annualCoveredBy(rows.find((r) => r.kind === 'intermediate')!, '2026-07-01', rows, [done1[0]]);
ok(cov?.name.endsWith('2nd annual survey') === true, 'an intermediate on 1 Jul 2026 takes the place of the 2nd annual');
const cov3 = annualCoveredBy(rows.find((r) => r.kind === 'intermediate')!, '2027-07-01', rows, done1);
ok(cov3?.name.endsWith('3rd annual survey') === true, '…and on 1 Jul 2027 the place of the 3rd');
ok(annualCoveredBy(rows[1], '2026-07-01', rows, done1) === undefined, 'an annual covers nothing');
ok(worstOf('ok', 'due') === 'due' && worstOf('expired', 'due') === 'expired', 'worst of expiry and surveys');
ok(renewedExpiry(cert({}), '2029-04-10') === '2034-06-19', 'renewal inside the 3 months before expiry: five years from the old expiry');
ok(renewedExpiry(cert({}), '2026-10-15') === '2031-10-15', 'renewal earlier than that: five years from the day it was completed');
ok(validityYears(cert({ issueDate: '2029-04-10', expiryDate: '2034-06-19' })) === 5 && validityYears(cert({ issueDate: '2026-10-15', expiryDate: '2031-10-15' })) === 5, 'a renewed certificate still reads as five years');
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
