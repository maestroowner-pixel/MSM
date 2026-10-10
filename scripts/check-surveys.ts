// npm run check:surveys — survey windows and the next date.
import { addMonths, nextDue, surveyStatus } from '../services/surveys';

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
console.log(fail ? `${fail} failed` : 'all passed');
process.exit(fail ? 1 : 0);
