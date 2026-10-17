// ===================================
// AI for the vessel (14 Oct 2026: "1-3" — smart import, voice and photo on the
// round, questions to the vessel's data). One callable, four tasks, Claude
// behind it. The key never reaches the app: it is the secret
//   npx firebase-tools functions:secrets:set ANTHROPIC_API_KEY --project marine-safety-manager
//
//   map      a sheet's headings (+ a few masked sample rows) → which of our
//            columns each one is. The rows themselves never leave the device —
//            the app renames the headings and its own importer reads the file.
//   table    a photo or PDF of a paper list (equipment, stores, medicines) →
//            rows under our headings. Never for crew, passengers or patients.
//   inspect  what the inspector said (any language) and/or a photo of the item
//            → an answer per checklist line, a remark in English, a defect.
//   ask      a question about the vessel → an answer from the summary the app
//            sends (no patient or guest names in it — built on the device).
//   form     a photo or PDF of the vessel's own paper form (a DP checklist) →
//            the checklist in the app's wording (services/dp.ts parseLine), for
//            an officer to check in the editor. Only the form's structure: what
//            someone filled in — names, readings, ticks — is left out.
//
// Only an approved device of a vessel may call it; each vessel has a daily
// allowance (ai_usage/{yyyy-mm-dd}).
// ===================================

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const ROOT = 'safety_vessels';
const REGION = 'europe-west1';
// A day's allowance per vessel: the cheap tasks (fast model) generously, questions (the larger model, the vessel's records as context) less.
const DAILY = { map: 100, table: 100, inspect: 400, ask: 60, form: 20 };
const FAST = 'claude-haiku-5-5';
const SMART = 'claude-sonnet-5-5';

async function claude(key, model, system, content, maxTokens = 2000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('[ai] claude', res.status, t.slice(0, 400));
    throw new HttpsError('unavailable', res.status === 429 || res.status === 529 ? 'The AI is busy — try again in a minute.' : 'The AI did not answer — try again.');
  }
  const j = await res.json();
  return (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

/** The first JSON object or array in a reply — the model is asked for JSON only, but a fence slips in. */
function json(text) {
  const s = String(text);
  const a = Math.min(...['{', '['].map((c) => (s.indexOf(c) < 0 ? Infinity : s.indexOf(c))));
  const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (!Number.isFinite(a) || b < a) throw new HttpsError('internal', 'The AI answer could not be read — try again.');
  try {
    return JSON.parse(s.slice(a, b + 1));
  } catch {
    throw new HttpsError('internal', 'The AI answer could not be read — try again.');
  }
}

async function allowance(vessel, task) {
  const day = new Date().toISOString().slice(0, 10);
  const ref = admin.firestore().doc(`${ROOT}/${vessel}/ai_usage/${day}`);
  return admin.firestore().runTransaction(async (tx) => {
    const n = (await tx.get(ref)).data()?.[task] || 0;
    if (n >= DAILY[task]) throw new HttpsError('resource-exhausted', `Today's AI allowance for the vessel (${DAILY[task]} × ${task}) is used up — it renews at midnight UTC.`);
    tx.set(ref, { [task]: n + 1, at: Date.now() }, { merge: true });
  });
}

const str = (v, max) => String(v ?? '').slice(0, max);

const TASKS = {
  async map(key, d) {
    const fields = (d.fields || []).slice(0, 40).map((f) => `- ${str(f, 120)}`).join('\n');
    const headers = (d.headers || []).slice(0, 80).map((h, i) => `${i}: ${str(h, 80)}`).join('\n');
    const samples = (d.samples || []).slice(0, 5).map((r) => (r || []).slice(0, 80).map((c) => str(c, 40)).join(' | ')).join('\n');
    const text = `A ${str(d.target, 40)} list from a ship is being imported.\n\nOur columns (name — meaning):\n${fields}\n\nThe sheet's columns (index: heading):\n${headers}\n\nA few rows (values masked: letters kept to first and last, digits kept):\n${samples}\n\nReturn JSON only: {"mapping": {"<sheet column index>": "<our column name exactly as given, or null>"}, "nameParts": {"given": <index or null>, "family": <index or null>}} — map every sheet column you are confident about, at most one sheet column per our column (except when a name is split into given and family names: then put them in nameParts and do not map them).`;
    return json(await claude(key, FAST, 'You map spreadsheet columns for a maritime safety app. Answer with JSON only.', text, 1200));
  },

  async table(key, d) {
    if (['crew', 'passengers', 'patients'].includes(String(d.target))) throw new HttpsError('permission-denied', 'Personal lists are not sent to the AI — use the Excel template.');
    const media = String(d.mediaType || '');
    if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(media)) throw new HttpsError('invalid-argument', 'A photo (JPEG, PNG) or a PDF.');
    const data = String(d.data || '');
    if (data.length > 14_000_000) throw new HttpsError('invalid-argument', 'The file is too large — under 10 MB.');
    const block = media === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: media, data } } : { type: 'image', source: { type: 'base64', media_type: media, data } };
    const fields = (d.fields || []).slice(0, 40).map((f) => `- ${str(f, 120)}`).join('\n');
    const text = `This is a ${str(d.target, 40)} list from a ship (a photo of a paper list, or a PDF). Read every line into rows with our columns:\n${fields}\n\nDates as yyyy-mm-dd (a month alone as yyyy-mm, a year alone as yyyy-12). Numbers as numbers. What the title or a heading of the list says for all its lines (a deck, a location, a section) goes into every row it covers. Leave a column out of a row when the list does not say it. Do not invent anything.\nReturn JSON only: {"rows": [{"<our column>": value, ...}, ...], "unreadable": "<what could not be read, or empty>"}`;
    return json(await claude(key, FAST, 'You transcribe ship inventories exactly. Answer with JSON only.', [block, { type: 'text', text }], 8000));
  },

  async inspect(key, d) {
    const lines = (d.checklist || []).slice(0, 60).map((c) => `${str(c.id, 40)}: ${str(c.text, 200)}`).join('\n');
    const item = d.item || {};
    const content = [];
    if (d.image?.data) content.push({ type: 'image', source: { type: 'base64', media_type: str(d.image.mediaType, 30) || 'image/jpeg', data: str(d.image.data, 14_000_000) } });
    content.push({ type: 'text', text: `Equipment: ${str(item.name, 120)}${item.number ? ` No. ${str(item.number, 40)}` : ''}${item.category ? ` (${str(item.category, 60)})` : ''}${item.location ? `, ${str(item.location, 80)}` : ''}.\nChecklist (id: line):\n${lines}\n\n${d.text ? `What the inspector said (any language): """${str(d.text, 2000)}"""\n\n` : ''}${d.image?.data ? 'A photo of the item is attached.\n\n' : ''}For each checklist line decide pass, fail or na — only where the words or the photo show it; otherwise null. Write the remark in plain English as an officer would log it (what was found, nothing invented). If something is wrong, a short defect line.\nReturn JSON only: {"answers": {"<id>": "pass"|"fail"|"na"|null}, "remark": "<English>", "defect": "<English, or empty>", "seen": "<what the photo shows, one line, or empty>"}` });
    return json(await claude(key, FAST, 'You help a ship\'s officer record a safety equipment inspection. Be strict: never mark pass without evidence. Answer with JSON only.', content, 1500));
  },

  async form(key, d) {
    const media = String(d.mediaType || '');
    if (!/^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(media)) throw new HttpsError('invalid-argument', 'A photo (JPEG, PNG) or a PDF.');
    const data = String(d.data || '');
    if (data.length > 14_000_000) throw new HttpsError('invalid-argument', 'The file is too large — under 10 MB.');
    const block = media === 'application/pdf' ? { type: 'document', source: { type: 'base64', media_type: media, data } } : { type: 'image', source: { type: 'base64', media_type: media, data } };
    const text = `This is a ship's own paper form — a ${str(d.target, 60) || 'DP checklist'}. Write it out as a checklist in the wording below, one line per line, in the form's order, so it looks like the paper.

THE WORDING
- A section heading:            ## Sensors
- A section that is a TABLE:    ## Sensors | Available {Yes|!No} | Value | Deviation
  then each row of the table on its own line (just the row's name): Gyro 1
  Columns: "Name {A|B|C}" = choose one of these; "Name" alone = a cell to write in.
  "!" before an option marks the answer that means something is wrong: {Yes|!No}, {Good|!No good}.
  A number cell with a fixed format: "Height (m) [0.0]".
  A row with no cell in a column: "DGPS 1 -[Mode]".
  A table set beside the one before it on the paper: "## > Alarm limits | Warning | Alarm".
- A plain question answered Yes / No / N/A:   Vessel set up as per ASOG
- A question with its own options:            Rotation centre {Fwd|Midship|Aft|Other}
- A question with a reading:                  Fanbeam range [m]
- A header field at the top of the form:      @field Location
- A paragraph to write:                       @text Brief description of the operation in progress
- A drawing box:                              @sketch Own vessel, rig, wind and current
- Who signs (one line each):                  @sign SDPO

RULES
- Prefer tables wherever the paper has columns. Units in the column or row name, e.g. "Speed (kn)".
- Lines of the same kind answered the same way (OS1 Yes/No, OS2 Yes/No; Gyro 1, Gyro 2…) are ONE table with a row each, never separate questions.
- Weather and sea readings (wind, current, waves, swell) are tables, not header fields: "## Wind | Speed (kn) | Direction (deg)" with one row, and the next ones beside it ("## > Current | …", "## > Waves | Height (m) [0.0] | Direction (deg)").
- @field is only for what names the job: location, field, project, client, offshore unit.
- Yes/No columns on the paper become {Yes|!No} unless "No" is not a fault there (then {Yes|No}).
- Leave out: the form's revision block, document numbers, page numbers, company names and logos, date and time (the app sets them), the vessel's position (the app asks for it).
- Leave out EVERYTHING somebody filled in: names, signatures, ticks, readings, dates, comments. Only the blank form.
- Do not invent lines that are not on the paper.

Return JSON only: {"title": "<the form's title, short>", "where": "bridge" | "engine", "lines": ["<line>", ...], "unreadable": "<what could not be read, or empty>"}`;
    return json(await claude(key, SMART, 'You turn a ship\'s paper checklist into the wording of a maritime safety app, exactly and without inventing. Answer with JSON only.', [block, { type: 'text', text }], 8000));
  },

  async ask(key, d) {
    const text = `The vessel's records, as of ${str(d.today, 20)}:\n<records>\n${str(d.context, 60000)}\n</records>\n\nQuestion from the ${str(d.role, 20) || 'crew'}: ${str(d.question, 1000)}\n\nAnswer from the records only, briefly, in the language of the question. Name the items, dates and people as the records give them. If the records do not say, say so. Return JSON only: {"answer": "<text>", "refs": ["<record line you used>", ...]}`;
    return json(await claude(key, SMART, 'You are ISMpilot, the safety-records assistant of a ship. You answer only from the records given. Answer with JSON only.', text, 1500));
  },
};

exports.ai = onCall({ secrets: [ANTHROPIC_API_KEY], region: REGION, timeoutSeconds: 120, memory: '512MiB' }, async (req) => {
  const t = (req.auth && req.auth.token) || {};
  if (!t.vessel || t.approved !== true) throw new HttpsError('permission-denied', 'The AI works for an approved device of the vessel.');
  const { task, input } = req.data || {};
  const run = TASKS[task];
  if (!run) throw new HttpsError('invalid-argument', `Unknown task ${task}`);
  await allowance(String(t.vessel), task);
  const out = await run(ANTHROPIC_API_KEY.value(), input || {});
  console.log(`[ai] ${t.vessel} ${task}`);
  return out;
});

// For scripts/ai-check (the prompts against the real model, from a Mac) — not a function.
exports._tasks = TASKS;
