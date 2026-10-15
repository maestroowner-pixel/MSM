# Changelog

Kept by hand. Each entry says what changed and, where it matters, **why** — the reasoning is
the part that stops the next person undoing it.

## 2.59 (20592) — 10 Oct 2026

- **Held back (user):** Crew list / certificate matrix and Hours of rest join the other hidden
  modules — 2.59 ships what 2.58 has plus fixes. Only `lifting` is on.
- Studio renamed **Kuka Soft** (`APP_CONFIG.company`; legal texts, Settings footer, manual).
- Settings → Reports folder only shows when a report that uses it is on.
- Build 20592 (20591 was built with crew + rest on — not to be uploaded).

## Next — after 2.62

- **Master's page — everything that can be allowed or delegated, in one table** (dark, `access`; 15 Oct 2026). **Settings → Master's page**, the Master only. Rows follow the menu — each group, each entry, the pages under it, the ⚙ gear on it, and what the rank decides there (planning drills, closing a search, the officers' documents); columns are the devices aboard, with their **rank** on top (tap: Crew ↔ Officer). A dot **glows** when the device has it and is **dim** when not; tap to switch. Entries are the device's tabs; **pages** under an entry can now be taken off one device's menu too (`EnrolledDevice.hidePages`, "Security:searches"; an entry whose pages are all hidden opens its screen directly); the gear is `manage`; officers-only pages are locked off for crew; rows set by rank are shown, not switched. Under the table, the vessel's signing rules (scan before signing, sign as the device's account, confirm every signature) as lit / dim switches, and a link to Accounts. Rows and cells in `services/masterPage.ts`; a device cannot change its own `hidePages` — **deploy rules**; rules tests 191/191, `check:access` +9.

- **The gears — only for whom the Master allows** (15 Oct 2026). Managing the places — the gear beside **Stores** and **SOPEP** in the menu (adding a store or a locker, its ID, place and label, loading its list) — is now closed by default: the Master's device always has it, and a device not joined to a vessel (its own Master); every other device only once the Master switches it on. **Settings → Access** has two new columns, **STO ⚙** and **SOPEP ⚙**, red until tapped. Without it the gear is not in the menu, its page says who to ask, and on the SOPEP inventory page the locker's name and place are read-only, with no + New locker or remove. Kept on the device record as `manage` (`constants/access.ts` `canManage`); a device cannot give it to itself — **deploy rules**; rules tests 189/189, `check:access` +5.

- **Drills: the calendar — the year's plan month by month** (dark, `drills`; 15 Oct 2026). **Calendar** tab on Drills, and **Drill calendar** under Drills in the menu: each drill a row, the twelve months across — ✓ carried out (SOPEP and ISPS drills recorded on their own screens count), ● in the year's plan, ◆ planned on a day (with the day), ! in the plan and missed; this month marked. **Draw up <year>** draws the plan from the schedule — every drill from the month it is next due (this month when overdue or never held), then every interval as months (30 d monthly, 60 d every 2, 90 d quarterly, 365 d yearly); nothing before this month, a past year not drawn up; ‹ › to the next year. Tap an empty month to add the drill, a planned one to **plan it on a day** (the drill opens dated in that month) or take it off; **+ Add a drill to <year>** brings in another (man overboard, blackout) by its own interval. **Plan (PDF)** — the year in a table, with the figures and boxes for the Master's approval. One record per year in the new collection `drill_plans` (officers write, all read) — **deploy rules**; rules tests 187/187; `services/drillPlan.ts`, `check:drills` +12.

- **SOPEP in three pages, the lockers behind a gear; every drill under Drills; the Ship Security Plan and searches on Security** (dark: `sopep`, `security`, `drills`; 15 Oct 2026). Menu: **SOPEP** opens to **SOPEP stores (inventory)** (the lockers and the inventory check — no drills tab there now), **SOPEP drills**, **SOPEP docs** (officers only); the **gear** beside SOPEP opens the lockers, kept as the stores are: **+ New locker** with name, place and an **ID** (SP-01 for the first, SP-02… offered), **QR label (PDF)** / **Xprinter**, **Load list (Excel)** into that locker (Item / Quantity / Unit / Place, other people's headings read — `services/sopepSheet.ts`), **Template**, Open by ID; the scanner opens a locker from its ID typed. **Drills** in the menu lists **Drills & schedule**, **SOPEP drills** and **ISPS drills** (a menu child may now open another screen — `MenuChild.route`; officers-only children — `officers`). **Security** adds **Searches — stowaway, bomb**: the plan of areas and teams (a typical yacht to start, the tender garage for stowaways only), a search started with its guidance on top, areas grouped by team and marked Clear / Found with a note by whoever searched them from their phone, closed and signed by the SSO / Master, PDF (`types/searches.ts`, `screens/SearchesSc.tsx`); and **Ship Security Plan** — documents for the Master and the officers only (ISPS A/9.7): number, revision, review date, the file (PDF or photo) in an officers-only folder of Storage. SOPEP docs the same (`types/officerDocs.ts`, `components/OfficerDocs.tsx`). New collections `sopep_docs`, `ssp_docs` (officers only, synced only to their devices), `search_plan` (officers write), `searches` (anyone aboard); Storage path `restricted/` — **deploy Firestore and Storage rules**; rules tests 184/184; `check:gangway` +11; backup carries them.

- **Stores: the vessel's own stores, with an ID, a place and a QR label** (dark, `stores`; 15 Oct 2026, as InventoryLens keeps its lockers). A **gear** on the Stores entry of the menu opens the stores: **+ New store** — name, kind (PPE store / Provisions / **General stores**, the new kind for the bosun's, engine and paint stores: items, minimums, issued and counted), where it is, and a short **ID** (ST-01 offered; letters, digits, - and _, unique; PPE and PROV for the two built-in stores). Each store: **Open**, **Edit**, **QR label (PDF)** or **Xprinter** (one or all), **Load list (Excel)** straight into that store, **Template**, remove (an empty store the vessel added). The label carries `msm://store/<id>` — the store's own id, so a renamed or moved store, or a new ID, keeps the label; the scanner opens the store from the label, or from its ID typed. Every store is listed under Stores in the menu, its page shows its ID and place; the Board tells the officers what is short or past expiry in a general store. New collection `store_rooms` (items carry `roomId`; the two built-in stores keep theirs without one) — **deploy rules**; rules tests 173/173; `check:board` +11; backup carries the stores.

- **PMS: components, and the change log of the plan** (dark, `pms`; 15 Oct 2026, TM Master V2 comparison, items 6 and 7). A system can be **Part of** another — the turbocharger of the main engine — and listed under it (↳ on Maintenance, **Components** on its parent with **+ Add component**). **Running hours from <parent>**: each reading of the parent adds the same hours to the component, from its own figure (a turbocharger fitted new starts at 0), and on to its own components; one with its own counter is left alone (`followerReadings`, applied in `saveMachine`). **Change log**: changing a job's title, interval, due, fixed schedule, type, class or permit, or a machine's name, critical / class item / class code, parent, department, maker, model or serial is recorded on the record — when, who, from → to — and an interval, due date, class, critical or permit change asks for the **reason** first ("Interval, hours: 250 h → 500 h — Maker bulletin MB-12"); **Show the change log** on the job and the machine. Kept on the record (last 100), no new collection or rule. `services/planLog.ts`; `check:pms` +13.

- **PMS: done, then signed; several signed together; same as last time** (dark, `pms`; 15 Oct 2026, TM Master V2 comparison, item 5). In "Record as done", **Done — for an officer to sign** saves the write-up (date, counter, condition, man-hours, notes, parts) on the job as *prepared*: the job shows "Done … by … — awaiting sign-off", Maintenance lists **Awaiting sign-off**, the Board tells the officers. **Review and sign** opens it filled in; the officer checks it, adds the photos and signs — the record carries both names ("done by Liam Carter; signed out by Ann Lee"). **Same as last time** copies the last sign-out's note, condition and man-hours. **Sign several…** on Owed now: routine jobs of one type, by the calendar, not on critical equipment, with no permit, documents, parts or write-up waiting (`multiSignable`) — ticked, one signature, each recorded on its own. Rules: a member may change `prepared` on a job (cleared as null on sign-out, so a merge-write clears it too) — **deploy rules**; rules tests 169/169.
- **PMS: class survey pack** (dark, `pms`; TM Master V2 comparison, item 4: what a class surveyor asks for at a periodical survey). **Class pack (PDF)** on Maintenance, three pages: class items (by class code) and class jobs with where each stands; every overdue job, the deferrals in force and the open defects; the class jobs done and the corrective / unplanned work of the last 12 months. A class job is one marked so or on a class item; scrapped machines are left out. `classPack` in services/pmsHistory.ts; `check:pmshistory` +5.

- **Spares: order to max, suppliers, shelf life, stocktake by location** (dark, `spares`; 15 Oct 2026, TM Master V2 comparison, item 3). A part has **Order up to** (the maximum) beside its re-order level: at or below it, the order is the maximum less what is on hand ("order 4 pcs (up to the maximum)"); an **IMPA / ISSA No.**; **suppliers** — the usual one first — with their reference, price and currency (dated when entered) and days to deliver. **Received** takes an expiry date; what is on the shelf is worked out by batch, used from the one that expires first (`batchesOnHand`), and the first expiry shows on the part and under its line, with **Expiring ≤ 90 d** on the Spares stats. **Used** per year for the last three years on the part. **Stocktake** on a location's heading counts every line there at once, prefilled with the book, signed once — each line recorded as counted, the differences as stocktake movements. The **requisition** orders up to the maximum (for jobs ahead: enough for the jobs and back to the maximum) and carries IMPA, the usual supplier, their reference, unit price, line total and lead time. `check:spares` +7.

- **PMS: a machine copied, replaced, scrapped** (dark, `pms`; 15 Oct 2026, TM Master V2 comparison, item 2). On a system: **Copy this system** (details, recurring jobs, the spares that fit it — not its serial, counter or last-done dates: two identical generators set up once); **Copy jobs to…** other systems (a job a system already has by that name is skipped); **Scrap / replace…** with the date and the reason — replaced: a new record takes the old one's details, jobs (counted from the day it was fitted, its counter from the hours entered) and spares, and links back ("Fitted 15 Oct 2026 — it replaced: S/N K-111 · its history →"); the old unit is scrapped, not deleted: off the plan, the due lists and the Board, its jobs off, its record and history under **Scrapped** on Maintenance with "Replaced by S/N K-222 →". Why not edit the serial: the old unit's history would become the new one's (TM Master's own warning). **Remove** is for a system entered by mistake only — one with a history of work is scrapped instead. `services/pmsMachines.ts`; `check:pms` +10.

- **A vessel certificate's surveys** (dark, `crewCerts` + `surveys`; 15 Oct 2026, TM Master V2 comparison, item 1: "annual / intermediate / renewal with a window, not only an expiry date"). On a vessel certificate, **Plan surveys** draws its endorsements from its dates by scheme — annual + intermediate (HSSC: annual ±3 months, intermediate from 3 months before the 2nd anniversary to 3 months after the 3rd, renewal in the 3 months before expiry), annual (DOC, Load Line, radio), intermediate between the 2nd and 3rd anniversary (SMC, ISSC, MLC), renewal only (ISPP), none (registry, licences) — chosen from the name, changeable; windows already closed are left unticked. Each occasion is a once-only row of Surveys & audits ("SMC — intermediate verification"), so the Board and the Surveys screen show it unchanged. The certificate's status is the worse of its expiry and its surveys: a window closed un-endorsed makes it **expired**; the list shows the next survey under each. An intermediate carried out also records the annual it replaces; a renewal takes the new expiry (5 years from the old expiry, or from the day when done earlier) and number, and plans the next cycle. `services/certSurveys.ts`, `components/CertSurveys.tsx`; `check:surveys` 29.

- **Sewage: every discharge at sea has its start and its end** (13 Oct 2026: "for sewage add the time and coordinates of the end of the discharge, and the ship's speed"). STP, COM and HT: Start (time + Now + position) and End (time + Now + position) blocks, and the ship's speed — required, after the MARPOL distance / speed checks; the speed goes into the line in the book. The same Start / End layout serves Ballast discharge. `check:logbooks` 13.
- **Hospital** (dark, `hospital`; 13 Oct 2026: "hospital — the next module"; "an order register — not everything comes on time, nor at once; Hospital in the menu: register, orders + archive, inventory, log; the log signed by an officer or the Master, with the medical advice PDF attached, compressed"; "look in Marine Hospital Manager — there is a lot there"). Menu → Hospital: **Register** (items with what is aboard and in date vs the scale, batches with expiry, short, on order; controlled filter and register PDF), **Orders** / **Orders archive** (lines; each delivery received against its lines with batch and expiry, signed — "6 of 10" until the rest comes; overdue on the Board; complete → archive, or closed saying what never came; Order PDF), **Inventory** (every batch from the books, change what differs, add found batches, signed; count moves; Master's monthly controlled-drugs count with a witness), **Medical log** (Master and officers only — `officers` sync, rules read isAdmin, never the shore: patient, complaint, vitals, findings, diagnosis, treatment, medicines from the chest — batch expiring first — radio medical advice, outcome, follow-up; signed by the officer or Master; written advice attached as PDF — compressed in the browser by re-rendering pages at ~120 dpi JPEG — or photographed, into an officers-only Storage folder; files can be added after signing, the entry never changes; Medical report PDF; log PDF / Excel), **Medicine reference** (WHO IMGS entries, scale A/B/C, equipment notes — for information only, with the WHO notice). Controlled drugs: every move signed by two (witness, `useWitness`). Stock kept as append-only moves. The scale and the reference come from Marine Hospital Manager (`constants/medScale.ts`: 75 medicines with A/B/C quantities, 83 equipment items, 56 IMGS entries; two name-only matches with a different form left without a note). WHO notice wherever its content shows (`constants/medNotice.ts`): used with permission, for information only, WHO bears no responsibility. Excel list in / out in one layout. Rules + 21 tests (143/143), storage rule `medical/`; `npm run check:hospital` (30). `deploy:storage` script.
- **Batched saves** (`saveRows`): many rows written together and loaded back once — saving the 97-item scale row by row ran React into error 185 again.
- **Security → Safety flashes (IMCA)** — as in the Drill Trainer: IMCA's safety flashes opened on imca-int.com (`screens/SafetyFlashesSc.tsx`).

- **Drills** (dark, `drills`; 13 Oct 2026: "reports with the list of who took part — a separate attendance list too — the topic, the content, a scenario minute by minute, and the theory"; "the officer writes the scenario himself, but the interface must make it easy"). Schedule of every drill SOLAS / ISPS / MARPOL requires (muster, abandon ship, fire monthly; enclosed space 2-monthly; steering, security, oil spill 3-monthly) plus any other once held — overdue on the Board; SOPEP and Security drills count. A drill: type, topic, date, start / end (Now), place; content a point per line (+ the Drill Trainer's checklist in one tap); **scenario editor** — timed steps T+min / action / who, new step 5 min after the last with the cursor in it, − / + a minute, nine common steps one tap each, "Start from the last one" copies the previous drill of that kind, clock time per step, "Done now" stamps the actual time; theory briefing from the Drill Trainer (20 drills, constants/drillTheory.ts) readable on screen and printed as the annex; attendance from the crew aboard (All present, reason for the absent, guests by name); debrief; saves as typed; signed as carried out = final. PDFs: drill report (plan before, report after), attendance list with a signature column, drill register PDF / Excel (drills, schedule, attendance by person). Rules + 7 tests (122/122); `npm run check:drills` (29).
- **Drills — your own drill** (13 Oct 2026: "besides the drills in the list, let her create her own — one Other at the end with fields to edit"). "Other — your own drill" closes the list: name, required by, how often (monthly … yearly, or not on a cycle), and the officer's own theory briefing, printed as the annex. Once held it joins the schedule under its name (one row per name), and planning the next one from there brings back the name, requirement, interval and briefing; "Start from the last one" copies its scenario. `check:drills` 38.
- **Drills — archive, and the attendance list signed digitally** (13 Oct 2026: "drill archive, and the attendance list signed digitally, PIN and bio"). Signed on the bridge device or the officer's ("they sign on the bridge's or the officer's device"): each person present signs his own line — his signing PIN on that device, or by hand; the fingerprint only for the device's own account (a shared device cannot tell whose finger it is). A bridge device on a crew account may sign lines and nothing else (rules: a member changes only the attendance, until the drill is signed). Asked always, whatever the confirmed-signatures switch (`SignRequest.always`). Unticking takes the signature off. Signing the drill with lines unsigned asks first. The list / report print "signed by PIN · 10:07" or the hand signature. Archive tab: drills carried out by year and month, filter by drill, search (number, topic, place, debrief, names); the register exports what it shows. Tabs now Schedule / Planned / Archive. Rules 125/125, `check:drills` 49.

## 2.63 (20632) — 14 Oct 2026

What the crew sees: **Security (ISPS) switched on for everyone** (user, 14 Oct 2026: "do it for all — for now it is one vessel", DreamBoat's trial for Jez): the gangway logbook — visitors with photo, ID and signature, numbered visitor passes, crew cards; who is on board and who is ashore, the button showing where each person is now (On board / Ashore, ⇄ to change); crossings recorded only from the gangway page; ISPS drills (renamed from Drills); the security level; IMCA safety flashes. Modules on: lifting, rounds, security.

Dark behind their flags (shipped in the code, not shown): hospital (landing report, issue / return, WHO reference), passengers, monthly safety meeting, drills, SOPEP lockers with QR, QHSE, the Board and the rest. Firestore rules for all of them deployed 14 Oct 2026. The guest list and patient names never leave the vessel (masked on the cloud).

Web deployed first, the same day; store builds (20632) uploaded 14 Oct 2026.

Also in 2.63 — **inspection rounds: no more duplicates** (Jez, 14 Oct 2026: two identical rounds open on the phone). Start locks against a second tap and asks the vessel's latest rounds before creating one; two open rounds covering the same show a warning with Close the duplicate. The server closes a duplicate whatever app made it (`roundsDedupOnCreate` on a new round, `roundsDedupSweep` hourly) — deployed 14 Oct; DreamBoat's duplicate closed by the first sweep. Stores and AI are in the code, dark (`stores`, `ai`).

## 2.62 (20621) — 13 Oct 2026

- **Released 14 Oct 2026:** App Store and Google Play approved; web deployed the same day from the release commit `72ff642` (not the branch head — the work since stays dark behind its flags), https://ismpilot.web.app, version.json 2.62.

What the crew sees: **inspection rounds as Jez asked** — the report in the Reports layout with a final Officer / Master sign-off, Deck → Location → number, and an inspection counts towards the matching round from anywhere (Dashboard, scanner, widget); **the fix for React error 185 after saving**; records say how they were signed ("signed by PIN" …); a crew card or visitor pass scanned without gangway control says so. Modules on: lifting, rounds — unchanged. Everything else below is dark (QHSE, gangway photo, SDM import with crew certificates).

**Server rules deployed 13 Oct 2026** (before 2.62 reaches the crews): rounds accept the final sign-off fields and a closed round is final; `observations` and `ncs` for QHSE. Backward compatible with 2.61.

### Since 2.61

- **Gangway — Jez's point 4** (dark with `security`): a **photograph** of the visitor on sign-on (phone camera, 240 px JPEG kept on the visit record, removed automatically 90 days after the visit — `photosToRemove`); scanning a pass in use opens the holder's **identity card** (photo, name, company, purpose, host, time aboard) instead of signing them off, and the watch signs off from there (Sign off now); returning contractors bring their photo with them.
- **Inspection rounds — Jez's points 1–3** (13 Oct 2026). (1) The round report is the Reports-tab report — same layout, PDF and Excel — scoped to the round (`services/reportData.ts`), with who did each inspection and, at the foot, the round's **final sign-off**: closing a round is now signing it off as reviewed and completed (Officer or Master, PIN / fingerprint / hand, remarks required when items are left). (2) Outstanding items read like Equipment: **Deck → Location → number** (`walkGroups`). (3) An inspection counts towards the open round of the **same period** that covers its category **from anywhere** — Dashboard, scanner, widget, any device (`roundFor`); two open rounds of one period and category can no longer be started. Report stats count items, not records. Rules: the sign-off fields, and a closed round is final (115/115).
- **QHSE: safety observation cards and non-conformities (NC / CAPA)** (dark, `qhse`). Anyone hands in a card — unsafe condition / act, near miss, good practice; topic, where, what was done, Stop Work, optionally anonymous (the name is not stored). Officers review it or raise an NC from it. NCs: number NC-YYYY-NNN, source (audit, PSC, flag/class, incident, card…), grade, requirement, root cause; actions (correction / corrective / preventive) with owner and date, signed done by whoever did them; closed only by the Master (or shore), signed, with an effectiveness note and a root cause required; a closed NC is final. Board: overdue actions (red), NCs to close (Master), new cards (officers), Safety tile. QHSE register PDF / Excel. Firestore rules + 11 rules tests (114/114); `npm run check:safety`.
- **Fix: React error 185 after saving** — `DataContext` set ~40 lists one by one with an `await` between each, so each committed on its own; two more lists pushed it over React's nested-update limit. Both loaders now read everything first and set it in one synchronous block.
- **How a record was signed, in words** (user, 11 Oct 2026): every way stays open (PIN, fingerprint, by hand); records now say "signed by PIN", "signed biometrically" or "signed by hand" (`proofShort` / `proofText`; PMS history and report, permits, documents, garbage PDF), and the inspection's own screen shows the line (it showed nothing). Permit PDFs: column "Signed".
- **Gangway logbook: month picker in the title** (dark with `security`) — the book's months with their count of visits and crew moves; picking one shows that month whole; Day with the arrows stays.
- **Scanner: a crew card or visitor pass on a vessel without gangway control** (user, 11 Oct 2026). With `security` off the code used to fall through to the register search — "Not on file" and the advice to file it as an item's serial (which would make a crew card open an item). It now says "Crew card" / "Visitor pass" — "Gangway control is not switched on for this vessel — nothing is recorded." Checked in the browser with release flags.
- **Fix: SDM import kept one certificate out of 27, and the form could write the imported details back over** (user, 11 Oct 2026, a real 29-document SDM backup). The certificates were saved one by one, each followed by a full data reload; the reloads overlapped and React stopped on "maximum update depth" after the first, so the rest of the loop never ran. Now all certificates go in one write (`saveCertificates`) with one reload, before the person and their private details. And the crew member's form takes the imported record (`onImported`), so a Save afterwards — after anything was typed before importing — no longer overwrites it with what the form held. Checked in the browser with the real file: all personal fields, next of kin and 27 certificates kept, also after Save.

## 2.61 (20611) — 11 Oct 2026

What the crew sees: **the ship's bell rings once on launch** (it repeated on phones in 2.60). Modules on: lifting, rounds — unchanged. Everything below since 2.60 is dark.

### Since 2.60 (dark unless said above)

- **Fix: the ship's bell rang over and over on launch** (user, 11 Oct 2026, phone). The splash's effect depended on `onDone`, passed as a new arrow on every render of the root; startup renders many times as lists load (more with every module), so the effect re-ran — bell, animation and timers restarting each time. The splash now runs its effect once, reads `onDone` through a ref, rings the bell at most once per launch; index.tsx passes a stable `hideSplash`. Checked in the browser: 1 bell per launch. Present in 2.60 — ships with the next build.
- **PMS: cancel a wrong sign-out** (TM Master comparison, item 7; dark with `pms`). The Master cancels a completion within 30 days (`cancellable`) from the machine's Recent work, with reason and signature — a cancelling version (services/versions; `PmsDone` is versioned now, `pmsDone` in DataContext is `live`), shown struck through with who and why; the job goes back to its earlier baseline — the latest remaining sign-out, or what it had before (`prevLastDoneDate/Hours`, now kept on each completion) — so a finished one-off reopens (`jobAfterCancel`). Spares taken stay out. **Rules: pms_done cancelling versions are the Master's — deploy needed.** Rules 101/101; check:pms.
- **PMS job needs a permit / documents read** (TM Master comparison, item 6; dark with `pms`, `ptw`, `docs`). Job: Requires permit (type) and Read before doing (ISM documents). Sign-out is refused until a permit of that type raised for the job in this cycle is approved / active / closed (`Permit.pmsJobId`, created after the last sign-out) and the signer has acked the current revision of each document (`jobGate`, services/jobGate). Raise a permit opens a new permit filled with the job, machine and location. The completion keeps `permitId` / `permitNo` (shown in the surveyor's history). No rule changes. check:pms.
- **PMS class flag, filters, plan ahead** (TM Master comparison, item 5; dark with `pms`). Machine: Class item + class code; job: Class job — marked "(class)" / "CLASS code" in the surveyor's history. Maintenance: ⚑ Critical and Class filters; Plan ahead · 3 / 6 / 12 months — jobs due month by month, hours jobs on the date the counter is estimated to reach at the running rate, overdue first (`jobsAhead`). check:pms.
- **PMS fixed schedule and own warning** (TM Master comparison, item 4; dark with `pms`). A job can run on a fixed schedule: due on `anchorDate` + n × interval (calendar months for multiples of 30 days, years for 365; month-end kept) and `anchorHours` + n × intervalHours, whenever it was actually done (`nextDueDate`, `nextDueHours`, `addInterval`); otherwise counted from the last done, in plain days as before. `warnDays` / `warnHours` replace the last-tenth rule for when a job turns due soon. Job form: Fixed schedule (Due dates from, First at … h) and Warn before due; schedule reads "Every 1 mo · fixed". Plan fields — no rule changes. check:pms.
- **Gangway QR on the Xprinter** (user, 11 Oct 2026; dark with `security`). Gangway logbook → Print to Xprinter (phone / tablet): crew cards or visitor passes 01–20 as TSPL stickers (100×50, 60×40, 50×30) over Bluetooth, the same printer flow as equipment labels (PrinterModal, saved printer). services/gangwayLabels (pure; check:gangway checks the QR payloads in the TSPL).
- **PMS fuller sign-out** (TM Master comparison, item 3; dark with `pms`). Recording a job done asks the condition before and after (`Condition`: Good / Fair / Poor / Out of service — out of service needs a defect), man-hours, and a note for next time (`PmsDone.nextNote`, shown at the top of the next sign-out — `noteForNext`). The machine shows its last condition (`lastCondition`); the surveyor's history gains Condition and Man-h columns and "Last condition"; the monthly report gains Condition after and Man-h columns and the month's man-hours. All on the signed completion record — no rule changes. check:pms, check:pmshistory.

## 2.60 (20601) — 11 Oct 2026

What the crew sees (from Jez's letter of 11 Oct 2026 and the DreamBoat data):
- **Inspection rounds — on** (`rounds: true`): shared weekly / monthly to-do lists (entry below).
- **Register protection:** Replace all keeps matched items' ids; a copy before every import; Settings → Data → Save a copy as a file; each inspection keeps the item's details (entry below).
- **Inspection report** marks photos ("Photos: N", Excel column).
- Everything in 2.59 (only `lifting` on among the newer modules). The other modules below stay dark.
- **User manual reorganised** (user, 11 Oct 2026): settings topics first, then the screens in menu order; new sections "Settings — what is where" and "Moving around the app" (menu groups, Edit order, back arrow and swipe, ? help); 4 languages, same order (manual sections of dark modules stay hidden by position).

Rules deployed by the user on 11 Oct 2026 (99/99).

Store text — App Store (167 chars): "Inspection rounds: shared weekly and monthly to-do lists across all devices. Safer Excel import that keeps your inspection history. Photo counts in inspection reports." Google Play (411 chars) and the long version: `/Users/Oxford/MarineSafetyManager/stores/release-2.60.md`. Site manual reorganised with "What's new in 2.60" (site/manual.html, deployed by the user with wrangler).

### Since 2.59 (dark unless said above)

- **Inspection rounds (dark, `rounds`; Jez, 11 Oct 2026).** A round = one period's window + categories, started and closed by an officer or the Master (types/round.ts; rules: create/close isAdmin, only closedAt/closedBy change). Shared to-do list on every device: outstanding items in walking order (deck → category → number; `sortByDeck`, shared with label batches), progress "N / M", category filter, done items with name, rank, date, time. Only inspections signed in the round (`Inspection.roundId`) count; opening a round makes it this device's round, so a scanned and signed item counts and the inspection screen says so (`roundTakes`, services/activeRound). Round report PDF / Excel (services/roundReport) with per-category totals and who did how many. Menu: Inspections → Inspection rounds. Rules 99/99; check:rounds.
- **Inspection report shows photos** (Jez, 11 Oct 2026). The Comments cell ends with "Photos: N" when the inspection has photographs (PDF on phone and web, Excel); the Excel sheet has a Photos column. An inspection whose item is no longer in the register is described from the record's own item snapshot when it has one.
- **Register protection (DreamBoat, 5 Oct 2026: a register replaced from Excel without MSM IDs unlinked 229 of 355 inspections).** "Replace all" now matches the file against the register like Update (`planUpdate`, built-in categories): matched items keep their ids, labels, inspections and defects; only items not in the file are removed; the confirmation counts the signed inspections that would be unlinked (also for Update with "remove missing"). Before every import, and before clearing a category, a copy is kept on a separate snapshot shelf (`takeImportSnapshot`) that launches do not rotate. Settings → Data → "Save a copy as a file" saves any copy (launch or import) as .msm without rolling back (`saveCopyAsFile`). Each new inspection carries the item as it stood (`item`: no, type, make, size, serial, deck, position — `itemSnapshot`). check:register.
- **PMS counter readings checked; counter replaced** (TM Master comparison, item 2). A reading lower than the last, or more hours than the calendar allows since it (+12 h), is saved only with a reason (`checkReading`), kept on the reading with who entered it. "Counter replaced…" sets `Machine.counterOffset` (machine hours − what the new counter shows) so the jobs' due hours carry on; later readings add it. The daily rate is counted after the last adjustment; a same-day reading no longer wipes an adjustment. Members may change `counterOffset` (rules, partial sync). Rules 95/95; check:pms.
- **PMS one-off and unplanned work** (from the TM Master comparison). A job can be one-off (corrective): due by a date and / or a counter reading, no interval (`oneOff`, `dueDate`, `dueHours`; `jobDue`, `scheduleText`); recording it as done sets `lastDoneDate`, which takes it off the plan (`finishedOneOff`) — so the crew's rights and the rules are unchanged. Machine: "+ One-off" (planners) and "+ Unplanned work" (everyone: a signed record with no job — `PmsDone.unplanned`, a report note required). A defect gets "+ Plan a corrective job"; the job's completion carries `forDefectId` and shows on the defect. One-offs are left out of the plan template; history shows "Unplanned:". check:pms.
- **PMS evidence, machinery defects, survey pack** (after marineinspection.app's ISM-10 PMS article). Recording a job done takes up to 4 photos (PhotoPicker; at least one on critical equipment), queued to the cloud like inspection photos (photoQueue now takes any record id; EvidencePhoto moved to components/). "Found a defect" raises a PmsDefect with the completion; machines have "+ Report defect" (screens/PmsDefectSc): safety-critical / class-affecting / operational, photos; closed by an officer or the Master with what was done, signed. Open defects on the machine and on Maintenance; safety-critical on the board for all, class-affecting for officers. "History for the surveyor (PDF)" per machine and "Survey pack (PDF)" for every critical machine: planned jobs and status, work done and signed (counter, photos), deferrals, defects (services/pmsHistory, check:pmshistory). Rules: pms_defects created by members without `closed`, closed once by an officer or the Master. Rules 94/94.
- **PMS plan: Master / superintendent only, and loaded from a template.** Adding, changing and removing systems and jobs (and typical jobs from the catalogue) is the Master's or the shore superintendent's (`plansPms`); everyone still records work done and counter readings. Maintenance → Plan: Template (Excel) downloads the current plan (or examples) with a Help sheet; Load plan (Excel) adds new systems and jobs and updates same-named ones, never removes, lists unreadable rows before loading (services/pmsImport, check:pmsimport; `savePlan` bulk save). Rules: pms_machines / pms_jobs created and changed by the Master or shore; members may change only counter / last-done fields; the sync sends just those fields when a whole record is refused and takes the vessel's copy back (`partial`). Rules 88/88.
- **Sewage record and Ballast Water Record Book (dark, `sewage`, `ballast`).** One shared screen (screens/LogBookSc) driven by a spec per book (services/logbooks): codes, the fields each asks for, rule checks before signing (sewage: comminuted ≥ 3 nm, untreated ≥ 12 nm and ≥ 4 kn; ballast exchange D-1: ≥ 50 nm and ≥ 200 m), the book line. Officer signs each entry, Master signs the month and alone amends/deletes (versions); PDF/Excel; month picker. Menu: Environment. Rules 79/79; check:logbooks.
- **Oil Record Book Part I (dark, `orb`).** MARPOL Annex I machinery-space operations, codes A–I (types/orb.ts); the form asks what each code needs (`ORB_FIELDS`, `orbProblem`) and builds the book line with item numbers (`orbText`, tested — check:orb); H takes a Fuel bunkering in one tap; officer signs each entry, Master signs the month; Edit / Delete Master only with the reason (versions); PDF (A4, the book's columns) and Excel; month picker. Rules: entries create-only, versions and month signatures the Master's. Menu: Environment → Oil record book. Rules 75/75.
- **Hours of rest:** month picker in the title (arrow row removed).
- **Spares for jobs ahead** (services/sparesNeed.ts, tested): parts the PMS jobs due / overdue within 30 / 60 / 90 days will use, against the stock, keeping the re-order level — "need · have · order" with the jobs; **Requisition (Excel)** with those and the parts below re-order level.
- **Gangway logbook:** Gangway logbook / Drills chips removed (menu sub-items do it); Port ★ and Berth ★ at the top (kept with the vessel's details, synced; required to sign a visitor on) with the date; every visit stores port and berth (new column in the log, PDF and Excel); Time in ★ in the form (now by default, editable) and Time out asked at sign-off (now by default); crew buttons coloured — Ashore yellow, Back aboard green.
- **PMS monthly report** (services/pmsKpi.ts pure + services/pmsReport.ts, utils/pmsPdf.web.ts): completion % (done ÷ done + overdue) all and critical, done (signed), deferrals, overdue now; PDF (A4 landscape) and Excel; month picker, KPI and buttons on the Maintenance screen. Tested.
- **PMS catalogue + merchant systems (18):** large main engine, aux generators, boiler, purifier, starting air, heat exchangers, FWG, OWS / 15 ppm, steering (merchant), reefer, windlass & winches, cargo cranes, hatch covers, ballast tanks & holds, air/sounding pipes & WT doors, ladders, LSA/FFE by period, electrical & automation, navigation & GMDSS incl. VDR — every job with its type; critical systems marked. 57 systems.
- **Board layout:** Sections (tiles) at the top, Needs attention under them; Today and the Plan stay in the right column.
- **PMS: job types, critical equipment, deferrals.** `PmsJob.type` (Maintenance, Performance test, Safety check, Measurement, Visual check, Calibration, Megger, Overhaul — drop-down in the job); `Machine.critical` (switch; ⚑ CRITICAL in the lists). Deferral = `pms_deferrals` record (Master only, reason ★, until date and/or counter reading, signed, append-only; never on critical equipment); it holds for the job's current cycle and replaces the interval in `jobDue` everywhere (lists, sorting, board, dashboard). Rules 70/70. (Monthly PMS report — not yet.)
- **Signing: the signer chooses** — "How do you sign?" with big PIN / Sign by hand / Fingerprint (own device with a sensor) buttons; "Another way" goes back. Sign by hand opens a wide window (pad up to half the screen height, 3 : 1) with big Delete and Sign buttons; offered on every device.
- **Edit / Delete in every log — Master only, reason + signature, versions kept.** services/versions.ts
  (`current`, `live`, `previous`, `amended`, `cancelled`) + components/Amend.tsx (dialog with the
  record's fields, reason ★, signer, confirmed signature; AmendButtons greyed out for non-Masters;
  AmendNote with the history). Fuel (soundings — today's no longer overwritten — bunkerings,
  transfers), SOPEP (checks, drills), gangway visitor log (PDF/Excel marked), security drills,
  surveys carried out (deleting one moves the plan back). DataContext gives live lists to every
  calculation and `versionsOf(key)` for the history. Rules: a version (`supersedes`) is the
  Master's in all of them; fuel records updated by the Master only; visitors' sign-off still open
  to the watch. Garbage: the four total tiles removed. Rules 67/67, `check:versions`.
- **Garbage Edit / Delete: Master only.** Greyed-out, disabled buttons for everyone else; rules: a version carrying `supersedes` is created by the Master only. Rules 61/61.
- **Garbage: Edit and Delete with reason and signature.** Versions kept append-only: an amendment is a new entry `supersedes` the old one with `editReason`; Delete is a `cancelled` version (struck through, out of the totals). Both need a reason and a confirmed signature. "Amended / Cancelled … by … — reason · n earlier versions" with the history on tap; PDF/Excel remarks say so. `currentEntries`, `previousVersions` tested; board and month counts use the current book.
- **Every signature is confirmed** (PIN / fingerprint / by hand) whenever `signConfirm` is on — the Settings switch is gone (an info line instead). Fuel soundings, bunkerings and transfers and defect rectifications now go through it too and keep `signedWith` / `closedWith`.
- **Month picker in the title** (components/MonthPicker): "October ▾" beside the ?, a list of the months with records (+ the current), newest first, "December 2025" for another year, with counts. Replaces the arrow rows on the permits archive, Garbage and Fuel. Dropdown keeps its list on screen at the right edge.
- **Garbage: one entry, several categories.** `items` [{category, volume}] — tap every category in the operation, an amount each; one line on screen, in PDF and Excel; totals per category; sea-discharge rules checked per category (named). Older single-category entries read as one item (`entryItems`).
- **Permit PDF with the toolbox meeting report** (services/permitReport.ts → utils/permitPdf.web.ts / HTML print): the work, precautions with answers (NO in red), gas, isolations, RA hazards with residual risk, toolbox report (held, place, job, attendees with attendance and a column to sign by hand, topics ticked, raised/agreed), signatures incl. closing time and hand-drawn signatures as images. PDF button in the permit header. Shared `utils/sigImage`.
- **Permits: toolbox meeting report in every permit.** Place and job copied from the permit; team
  members marked present (+ others present), topics covered (constants/toolbox.ts), RA hazards shown,
  concerns/agreed, signed by the leader. "Start the work" is blocked until everyone on the team is
  marked present and the place/job still match (`startBlockers`, tested).
- **Permits: closing date and time.** Window fields read "Valid from" / "Valid until — permit closes";
  closing asks "Closed at" (now by default, not in the future, not before the start), stored as
  `closedAt` and shown with the signatures.
- **Permits: General permit to work** — first in the list and the default; checklist for work that needs control but no specialised permit (scope, RA, no special hazard or that permit also issued, isolation, PPE, tools, area, OOW/CE informed, comms).
- **Security split: Gangway logbook / Drills** (menu sub-items, chips on a phone; On board / Log inside
  the logbook). **Visitor passes:** reusable numbered passes VISITOR 01–20 with QR `msm://pass/NN`
  (Print visitor passes, same 10-per-A4 sheet as crew cards). Scanning a free pass opens the sign-on
  form with its number; scanning a pass held by a visitor on board signs them off. A pass still out
  cannot be given again. Board's drill notices open Drills.
- **Settings → signing: set / change PINs.** My signing PIN (an enrolled device's own account), Master PIN (0000 until changed, flagged), Crew signing PINs → Crew matrix; reset list leaves out the Master PIN. Wording without "face".
- **Notice board (dark, `board`).** The Dashboard tab becomes the vessel's board across every module
  (services/board.ts → screens/BoardSc.tsx): status line (ISPS, persons on board, ROB ≈ days), Needs
  attention (register by category, defects, vessel/equipment/crew certificates, PMS, spares, documents
  to read, permits, fuel sounding / noon report / low fuel, garbage month unsigned / accidental,
  SOPEP check / shortages / drill, ISPS level / drill, surveys) filtered by rank, Plan (week / month /
  quarter / year rounds with progress, survey windows, equipment services ≤ 60 days), Today, and a
  tile per module on. The old expiry list is the "Expiries" screen (LSA / FFE tile). Menu label Board.
- **Surveys & audits (dark, `surveys`).** Class / flag / ISM / dry-dock plan with due date or
  anniversary, window (±months), repeat; Carried out (signed, append-only history) moves the plan on.
  11 templates. Rules: plan and records by Officers/Master. `check:surveys`, `check:board`; rules 59/59.
- **Dashboard reminder: "The Master PIN is still 0000"** (components/MasterPinBanner) — Master only,
  only with confirmed signatures on, re-checked on focus; taps through to the Crew matrix. The
  Crew matrix 🔒 locks and Master PIN link are now hidden with `signConfirm` (the matrix itself
  ships in 2.59).
- **Master PIN defaults to 0000** until the Master changes it (checkPin accepts the default for
  `ADMIN_KEY` while none is stored; same lockout). So a first PIN always needs the Master PIN. Crew
  matrix shows the Master "Master PIN is 0000 — change it"; the unlock card only says it is still
  the default, without the digits.
- **Signing PINs under a lock — in the Crew matrix.** 🔒 by each name (green = PIN set on this
  device). Master PIN (`ADMIN_KEY`, set first by the Master, changed with the old one). No PIN yet →
  the Master PIN opens it; PIN set → the owner's own PIN or the Master PIN; then the new PIN twice
  (components/PinChange, same lockout as signing). A first signature without a PIN asks for the
  Master PIN when one exists (SignConfirm step `admin`); without a Master PIN on the device the old
  behaviour stays (the person chooses their own).
- **Signatures: PIN, fingerprint, or by hand — no Face ID.** Biometrics = fingerprint only: native
  `biometricKind()` offers it only when a fingerprint sensor is enrolled (Face ID / face / iris →
  PIN), Android requires class-3 biometrics; on the web only a Mac's Touch ID (iPad / phone / Windows
  Hello may be a face). New method **Sign by hand** on phones, tablets and touch-screen browsers:
  finger or stylus on SignaturePad, kept in the proof (`method: 'drawn'`, `drawing` SVG path). The
  confirm card offers the other ways as links. `faceIDPermission: false`, NSFaceIDUsageDescription
  removed. Records print "PIN / fingerprint / handwritten" (`proofShort`).
- **Fuel daily report — Sent reports log.** Each sending (e-mail opened / shared / copied) is kept
  with the day, sender, time, addressees, figures and the text as it went (`fuel_daily`, append-only
  rule; synced, in backups). The day shows "✓ Sent …"; the log lists the last 30, tap for the text.
  Rules 55/55.
- **Menu sub-items; Fuel → Sounding / Daily report (dark, `fuel`).** `MENU_CHILDREN` in
  utils/navOrder: an entry with sub-items opens on tap (the current one starts open), each opens the
  screen on a page (`view` param). Fuel's chips do the same on the phone. **Daily report** = noon
  report from the soundings: consumed since the previous sounding (24 h / n days), ROB by tank,
  received, 7-day average and days of fuel at that rate, month to date, remark, sender — sent by
  e-mail (addressees remembered on the device), share sheet, or copied. `npm run check:fueldaily`.
- **Security = digital gangway logbook (dark, `security`).** Tabs On board / Logbook / Drills.
  ISPS level is a small 1·2·3 switch in the title corner (warning line above level 1). Gangway
  watch is a drop-down (signer picker is now a drop-down on every screen, remembered while the app
  is open). Visitors sign on with their own signature drawn on the screen (components/SignaturePad,
  SVG path), returning visitors auto-fill. **Crew QR cards** (credit-card size, 10 per A4,
  `msm://crew/<id>`): the Scan screen records ashore / back aboard (double scan within 60 s
  ignored); the watch can also tap. Persons on board = crew aboard + visitors. Logbook for a day or
  month as PDF (signatures drawn in) and Excel, with crew movements. New list `crew_moves`
  (append-only rule). `npm run check:gangway`; rules 53/53.
- **SOPEP (dark, `sopep`).** Oil-spill locker list (typical yacht starter, editable, location per item),
  signed inventory checks with counts and "to replace" marks (shortages shown on the list), signed
  oil-spill drills (scenario, participants, minutes, lessons). Checks and drills append-only.
- **Security — ISPS (dark, `security`).** Security level 1/2/3 with history (Officer/Master only by
  rules); gangway visitor log: sign on (name, company, purpose, ID type/No. — required at level ≥ 2,
  pass No., host) and sign off; "On board now"; day/month Excel. Menu groups "Environment"
  (Fuel, Garbage, SOPEP) and "Security". Rules 49/49.
- **Permits: Archive by month.** "Archive — by month" button with month arrows lists every permit of
  the month; the open list keeps the 5 most recently closed.
- **Garbage Record Book, Part I (dark, `garbage`).** MARPOL Annex V, form of MEPC.295(71):
  entries by category A–I with amount (m³), to reception facility / into sea / incinerated /
  accidental, port or position and distance from land, container No., receipt No., remarks, signed
  by the officer in charge (SignConfirm). Sea-discharge rules checked (A, C–F, H, I prohibited; food
  ≥ 12 nm, 3 nm comminuted; carcasses ≥ 100 nm) — warned, not blocked, accidental always recordable.
  Append-only (rules: create only); the Master signs each month (rules: Master only). Month totals;
  the page as PDF (A4 landscape) and Excel (Part I + Totals). `npm run check:garbage`; rules 43/43.
- **Fuel (dark, `fuel`).** Diesel only, litres (owner's decision, 10 Oct 2026; petrol for tenders
  later). Tanks: two to start (port, starboard), rename / capacity / add / remove. The day's sounding
  tank by tank (signed by name); bunkerings — port, supplier, litres, density, sulphur, BDN, litres
  per tank — written as Oil Record Book Part I code H entries; transfers between tanks. Consumption is
  computed (ROB before + received − ROB after), gaps put on the next sounding, impossible figures
  flagged. Month: opening / received / consumed / closing, day by day; report as PDF (jsPDF on the
  web into the remembered folder, expo-print on phones) and Excel (Summary, Daily, Bunkering,
  Transfers). Synced `fuel_tanks|readings|bunkers|transfers`; rules (39 emulator cases); backups;
  `npm run check:fuel`. Menu: Inspections & maintenance. Crew list as its own menu item.
- **Permits to work and risk assessments (dark, `ptw`).** Permits tab (menu: Documents & permits):
  hot work, enclosed space, height/overside, electrical isolation, cold work, diving — each with its
  precaution checklist (Yes / No / N/A) and maximum window. Draft → Requested → Approved → In progress
  → Closed / Cancelled, every step signed (SignConfirm); numbers PTW-yyyy-nnn. Approval by an Officer
  or the Master only, blocked until every precaution is answered and none is No, the window fits, gas
  is within limits (O₂ 20.8–21.5 %, LEL < 1 %, H₂S < 5 ppm, CO < 25 ppm) and a risk assessment is
  attached; overdue permits flagged. Risk assessments: hazards on a 5 × 5 matrix before and after
  controls, High / Extreme residuals called out, signed approval cleared by any change; a vessel
  library (six starter assessments) copied per job. Synced `permits`, `risk_assessments`; rules (35
  emulator cases); backups; `npm run check:permits` (17).
- Documents: upload several at once (number and title from file names, matches become new
  revisions, PDF text indexed). Menu grouped by purpose; crew matrix in the menu.
- **Documents (dark, `docs`): readable, searchable, sortable.** A PDF or image is shown on the
  page (web: the browser's viewer in a frame; phones keep "Open"). On upload from a computer the
  PDF's text is read (pdf.js from cdnjs, utils/pdfText) and stored with the document (≤ 60 000
  chars), also when a superintendent uploads in Fleet. Two searches — by word (title, number, type,
  text, file name and the PDF's own words, all words must match, with the passage shown) and by
  document number (separators ignored) — plus sort by number / title / newest / review due and a
  type filter. `check:docs` +7.
## 2.59 — 9 Oct 2026

- **Crew list (IMO FAL Form 5)** as PDF from Settings → Crew — port and date of arrival/departure,
  everyone on board, Master first; saved into the remembered folder on the web. Crew member gains
  place of birth, passport expiry, port of embarkation; nationality is the ISO 3166-1 alpha-2 code
  (names and adjectives converted on import). Next of kin: family and given names, phone, home
  address, email optional.
- **Load the crew from Excel** (template download + import; merged by name, empty cells never wipe,
  everyone in the sheet signed on) **or from a seafarer's SDM backup (.sdm)** — personal details,
  passport, seaman's book, next of kin and certificates in one go; a second import only updates.
- **Warnings**: ⚠ by a name in Crew, the crew matrix and the person's screen when a certificate or
  the passport is expired or due, or crew-list / next-of-kin details are missing (private-data checks
  only on Officers' devices). `npm run check:crewlist` (28 cases).

**Released in this version: crew list & certificate matrix (`crewCerts`) and Hours of rest
(`rest`).** Everything else below stays dark behind its flag. Needs `npm run deploy:rules` BEFORE
the app reaches users (crew written by Officers, `crew_private`, `rest`); rules tested in the
emulator — scripts/rules-test.mjs, 29 cases. Phone keeps a six-tab bar (menu from seven); the web
uses the left menu from six screens.

- **Reports saved into a remembered folder (web).** Chrome / Opera / Edge: the first save asks for a
  folder, its handle is kept in IndexedDB, later saves write straight into it (the browser asks once
  per session whether the site may still write there); Settings → Reports folder shows and changes
  it. Safari / Firefox: the file goes to Downloads under its proper name (utils/webSave).
- The web Hours of rest record is now drawn as a real PDF in the browser (jsPDF, utils/restPdf)
  instead of being printed — no print dialog, no browser header, and "Saved to the folder …" below
  the button. Phones keep expo-print and the share sheet.
- Hours of rest PDF: saved as "Name-mmyy-Vessel_Hours of rest report.pdf" (the browser's Save as PDF
  takes the page title, which is set for the print); fixed column widths so rows no longer stretch;
  breach codes on one line ("10h/24h"), full wording in the list below; a wide Note column; no
  browser header/footer (date, tab title, address) on the page.
- Hours of rest on a wide screen (≥ 900 px): the crew as a column on the left — rank, days recorded
  this month, a red count of days with a breach — and the selected person's month on the right.
  Phones keep the row of names.
- Web: no swipe between screens (it fought text selection, sideways scrolling and scrollbars; the
  menu does the job). Crew list scrolls with the page instead of a squeezed strip under the form.
- **Crew list and crew certificate matrix (dark, `crewCerts`).** The crew list is kept by the Master
  AND the Officers (rules: crew write `isAdmin`; the client pushes it from an Officer only with the
  module on). A crew member has on board / signed off with sign-on and sign-off dates; Hours of rest
  shows only those aboard, with a link to the crew list. Crew member screen: rank, aboard, personal
  details and next of kin (date of birth, nationality, passport, seaman's book, contacts) stored
  apart in `crew_private` — Officers and the Master only, in rules and in sync — and the person's
  certificates. Crew matrix screen: people × certificates with the expiry in each cell, tap to open
  or add; signed-off people keep their row and come back with "Sign on", nothing retyped.
- Hours of rest page scrolls (it did not move at all in a browser); person chips no longer cut.
- **Menu instead of a tab bar past five screens** (components/NavMenu). Web: top bar with ☰ and the
  current screen; the menu slides in from the left and closes on a choice; on windows ≥ 1100 px it
  can be pinned open beside the content. Phone: the first four screens of the person's order on the
  bottom bar plus "Menu". "Edit order" with ↑ ↓; the order and the pin are per device
  (`msm:nav_order`, `msm:nav_pinned`). Swipe follows the person's order. Up to five screens (modules
  off) the plain tab bar is unchanged.
- **PMS for the whole vessel, by department (dark, `pms`).** Systems carry a department
  (Engineering, Deck, Safety, Bridge & comms, Interior, AV / IT, Hull & dry dock) and an optional
  running-hours counter (calendar-only systems hide every hours field). Maintenance groups systems by
  department, each with its own "+ Add", and filters by department. The typical-jobs catalogue
  (services/pmsCatalogue.ts) grows from 6 machine types to 38 systems / 181 jobs, offered per
  department, from the superyacht task list. Older machine records read as Engineering with a counter.
- Sync: only the collections of switched-on modules are read and written.
- **Fleet console for superintendents (dark, `fleet`; server NOT deployed).** New role `shore`
  ("Superintendent (shore)") a Master issues in Accounts. functions/index.js: `enrolShore` (IMO +
  name + PIN of a shore invitation; one browser account, its own secret, vessels added one by one
  with that secret), `refreshShore` (token `shore: true, fleet: {imo: true}` for vessels whose
  shore device is still approved), `shoreSaveCertificate` (one certificate merged into the register
  in a transaction, new `registerUpdatedAt` → devices take it via the three-way merge). Shore
  invitations are refused on the vessel `enrol` path. firestore.rules: `shore(v)`/`reader(v)` —
  read every vessel collection, write `ism_docs`; storage.rules: read + upload attachments.
  Client: a second Firebase app 'shore' (services/shore.ts) so a browser can be a vessel device and
  a console at once; /fleet (vessels worst first: equipment, certificates by scope, PMS, spares,
  unsigned documents) and /fleet/:imo (edit certificates incl. file, edit/re-issue documents,
  equipment read-only). Shore rows hidden from Access. `npm run check:fleet`.
  **Release needs:** `npm run deploy:rules`, storage rules, `cd functions && npm run deploy`.
- **ISM documents with read-and-sign (dark, `docs`).** Docs tab: controlled documents (SMS manual,
  procedures, circulars, standing orders, policies, forms) with number, revision, issue and review
  dates; a PDF from the office, text written aboard, or both. "To read" for the person on the
  device; "I have read and understood" signs the CURRENT revision (confirmed via SignConfirm), one
  signature per person per revision, append-only. Read-by count and "not yet" names from the crew
  list (by id, or by name for device accounts). New revision → everyone signs again; old signatures
  kept. Officers/Master edit (rules: `isAdmin`). Files go to Cloud Storage; offline, the file stays
  on the attaching device (`filePending`) and is never pushed inside the record. Dashboard line
  "N documents to read". Synced as `ism_docs` + `ism_doc_acks`; in backups. `npm run check:docs`.
- **Confirmed signatures (dark, `signConfirm`; Master's `confirmSignature`, off).** One confirmation
  for every signed act (components/SignConfirm): fingerprint / face on the signer's OWN device
  (expo-local-authentication, device passcode not accepted), WebAuthn platform authenticator on the
  web (Touch ID, Windows Hello), otherwise the signer's own 4–6 digit signing PIN — chosen by them,
  stored only as a salted iterated SHA-256 in SecureStore, 5 tries then a 5-minute lock, reset by
  the Master in Settings. Records carry `signedWith` {method, deviceId, at}; the inspection report
  shows "· PIN" / "· biometric". Wired into inspections, PMS completions and stores movements.
  **Needs a new store build** for biometrics (new native module); `npm run check:signature`.
- **Spare parts (dark, `spares`).** Spares tab: lines with part no., maker, location, unit,
  re-order level and the machines they fit; grouped by location, out/low first, "To order" filter.
  Stock is the SUM of signed, append-only movements (received / used / stocktake as a difference),
  so concurrent devices never lose a booking. PMS jobs list the parts they take and "Record as done"
  takes them from the stores (quantities editable, 0 = not used). Machine screen lists its spares;
  Dashboard line when anything is out or low. Synced as `spares` + `spare_moves` (rules added);
  in backups. `npm run check:spares` (13 cases).
- Machine templates: "Stabilisers / thrusters" split into fin stabilisers, gyro stabiliser and
  bow/stern thruster.
- **Everything below ships dark** (owner's call, 9 Oct 2026): crew/vessel certificates, Hours of
  rest, PMS and Access are behind `crewCerts`, `rest`, `pms`, `access` in constants/modules.ts, all
  off. Off, a module has no tab, card, link, Settings row or manual section (`releasedManual`); its
  code, sync and stored records stay. Release = flag on + `npm run deploy:rules` + site manual.
- **Access — tabs per device.** Settings → Access (Master only): a table of the vessel's devices
  against the optional tabs (Certificates, PMS, Rest, Reports), a green or red dot in each cell; a tap
  switches the tab on that device, which follows on its next sync. Stored on the device record
  (`tabs`), which a device may not edit on itself (firestore.rules). Dashboard, Equipment and
  Settings are always on; a Master's device always shows everything; a device never set shows every
  tab. Remembered on the device for a launch with no signal. `npm run check:access`.
- **PMS and Hours of rest are tabs now**, not cards in Settings.
- **Planned maintenance (PMS).** Settings → Maintenance, and a Maintenance strip on the Dashboard
  once the vessel has machinery in the plan.
  - Machine (name, location, maker, model, serial, running-hours counter with its date and the last
    30 readings), PmsJob (interval in hours and/or days, last done date and counter), PmsDone (a
    signed completion: date, counter, who, note) — `types/pms.ts`.
  - A job falls due on WHICHEVER COMES FIRST, hours or calendar, compared as a fraction of each
    interval. Hours are judged against the last counter reading; the readings give a running rate,
    so an hours job also shows "≈ N d at the current rate". "Due soon" is the last 10 % of the
    interval, not the register's 60 days, which would make a monthly job due from the day it was
    done (`services/pms.ts`, `npm run check:pms`).
  - A counter reading lower than the last is refused: a replaced counter is a new machine.
  - "Record as done" signs a completion and moves the job's baseline in one step; a higher counter
    entered there also becomes the machine's reading. Completions are append-only (rules: create
    only), like inspections. Removing a machine or job is a tombstone; history stays.
  - Typical jobs for six kinds of machinery (diesel engine, generator, watermaker, compressor, pump,
    stabilisers), marked to be checked against the maker's manual.
  - **Sync: three new collections `pms_machines`, `pms_jobs`, `pms_done`, on the same incremental
    path as hours of rest** — `pushRest/pullRest` became `pushLists/pullLists` over a table of
    collections (same storage keys, so nothing already sent is sent again). Pulled records are
    marked as sent, and append-only records go one document at a time, so a completion re-sent
    after a restore from backup is recognised as already there instead of failing its batch.
    **firestore.rules gains the three collections — deploy before release.**
  - In the .msm backup and in Reset all data. Manual section "Planned maintenance" in 4 languages.
  - Machine and job screens adopt their record when it arrives after the screen (opened by URL on a
    cold start), as CertificateDetailSc does — found on the first screenshot, where the fields of a
    machine opened by link were empty.

- **Hours of rest (MLC 2006 Reg. 2.3, STCW A-VIII/1).** Settings → Hours of rest.
  - One record per person per day: 48 half-hour cells, '1' work / '0' rest, ship's time
    (`types/rest.ts`). The day editor sets cells with a pen (Work / Rest) rather than toggling, so a
    slip of the finger is not the opposite of what was meant; patterns fill a day in one tap (day
    work, the three watches, day off, same as previous day). Leaving a day for the next saves it.
  - The rules (`services/restHours.ts`, `npm run check:rest`): 10 h rest in ANY 24 h and 77 h in
    ANY 7 days, on rolling half-hour windows so a breach across midnight is caught; rest in at most
    two periods with one of 6 h, read as "the two longest periods must reach 10 h" because window
    edges cut every night's sleep in two; no more than 14 h between rest periods. An unrecorded day
    is never rest — a window touching one is not judged and the day shows "Not recorded".
  - Month view per person: recorded days, days with a breach, work total, each day's bar and
    breaches. Monthly record PDF in the ILO/IMO layout with signature lines for seafarer and Master.
  - **Sync is a new `rest` collection, one document per person-day, incremental both ways**
    (pushed-since map, pulled-since timestamp) — a year of a 20-person crew is ~7 000 documents.
    A refusal there never fails the sync: **`firestore.rules` gains `match /rest/{id}` and must be
    deployed (`npm run deploy:rules`) before release**, until then records stay queued on the device.
  - Included in the .msm backup and in Reset all data.
- **The "?" buttons name their manual section by English title, not by position.** Inserting
  "Lifting & Mooring" above "Certificates" (8f4b101) had shifted every index after it, so the ? on
  Certificates opened Lifting, on Dashboard opened Certificates' neighbour, and so on.
  `npm run check:help` fails if a ? names a section that does not exist or a language has a
  different number of sections.
- Manual (en / ru / es / uk): new section "Hours of rest".

- **Crew and vessel certificates.** The Certificates tab has three tabs — Equipment, Crew, Vessel.
  - A crew certificate belongs to a PERSON (STCW, CoC, ENG1 / medical, passport, seaman's book,
    visa): the holder is picked from the crew list, or typed on a device that has no crew list yet.
    The Crew tab groups by person, worst status first, because the question asked of it is "whose
    papers run out". Settings → Crew shows "3 certificates · 1 expired" on each row and opens the tab.
  - A vessel certificate is the ship's own paper (registry, SMC, DOC, ISSC, MLC, load line…).
  - **One record, not three.** `Certificate` gains `scope`, `crewId` and `holderName`; a record
    without `scope` reads as `equipment`, so nothing already on a vessel changes meaning, and the
    new kinds ride the existing sync (register blob), backup, file attachments and status rule.
    `holderName` is kept on the certificate because the crew list can lose the person.
  - Suggested names (constants/certificateTypes.ts) fill the name field with one tap, so "ENG1" is
    not spelt three ways and a search finds all of them.
  - Expiry reminders now cover crew and vessel certificates (60 / 30 / 7 days). Equipment
    certificates are still left out: the items they cover already carry the date.
  - The item screen's "Link certificates" offers equipment certificates only.
  - Privacy Policy (in-app and ismpilot.com) names the crew data now held: crew certificates with
    number, dates and scan. It also stops describing the retired Realtime Database and push/pull.
  - Manual (en / ru / es / uk): the Certificates section explains the three tabs.

- **Manual (en / ru / es / uk) brought up to date with the app.**
  - New section **Lifting & Mooring**: the eight categories, the annual round every one of them
    owes (the examination the certificate rests on) and the quarterly round for Mooring and
    Working Aloft. The module has been on since 2.52, but the manual still described "24
    categories under three groups" — it now says four registers.
  - Rounds now read Weekly / Monthly / Quarterly / **Annual**, since Lifting brought the annual one.
  - "an MSM QR" → "an ISMpilot QR". `MSM ID`, `MSM_report_…` and `.msm` stay: they are the real
    names of the column and the files, and the manual has to say what the user actually sees.
  - Licence: no price and no "60 days free, with no key and no card". The price is changing (full
    PMS + ISM is planned) and must not be promised in a manual that ships for months; "no card"
    read as a promise about checkout, where LemonSqueezy does ask for a card. The free period is
    stated as it works in `services/trial.ts`: 60 days for the VESSEL before the
    15-items-per-category limit applies. Pricing questions go to mail@ismpilot.com.
  - The web manual at ismpilot.com/manual carries the same content.

## 2.58 — 8 October 2026

Android versionCode 20581 · iOS build 20581.

- **Marine Safety Manager is now ISMpilot** (tagline "Marine Safety Manager") — the same app,
  renamed IN PLACE. Same bundle id `com.kukalab.msm`, same store listings, same Firebase project:
  people get an ordinary update and keep their data, vessel enrolment, licence, ratings and
  reviews. A new app under a new id would have meant reinstalling, re-enrolling every device and
  starting the reviews from zero. Kept on purpose: the `msm://` QR scheme (printed labels), the
  MSM ID Excel column, `msm:` storage keys and `.msm` backups.
- Name under the icon "ISMpilot" (app.json `name`, Android `app_name`, iOS `CFBundleDisplayName`),
  permission prompts reworded to match. NOTE: `expo.name` also drives the native PROJECT name on a
  fresh `expo prebuild --clean` — the iOS project would come out as `ISMpilot.xcodeproj`, and
  `scripts/patch-native-version.js`, `patch-ios-version-phase.js` and `patch-ios-scene-lifecycle.js`
  hard-code `MarineSafetyManager`. Update those paths (and the archive name) if that ever happens.
- New icon (navy shield with the orange tick, `assets/icon.png`; Android adaptive foreground on
  navy `#0B2545`). The native splash is plain navy, so the animated ISMpilot logo (SplashSc) fades
  in on the same colour with no flash of the old pale blue.
- Home-screen widgets in ISMpilot navy; the Scan tile is a real QR (`msm://scan`, ECC H) with the
  app icon in the middle, replacing the decorative one with the MSM cube; labels "ISMpilot · Scan".
- Everything from the web rebrand of the same day (colours, logo, shield watermark, "ISMpilot Pro").

## 2.57 — 8 October 2026

Android versionCode 20571 · iOS build 20571. Submitted to the App Store and Google Play 8 October 2026.

- **Duplicate item** (bottom of the item screen, `services/duplicateItem.ts`). Asked for by a vessel
  adding dive cylinders one at a time (8 Oct 2026). Opens a NEW, unsaved item seeded from this one
  — passed by id (`copyOf`), not as a param object, because on the web route params live in the
  URL. Copied: what describes the kind of item and where it lives, dates, comments, extra columns.
  Not copied: id (the QR label), serial, photos and documents, flag, monthly ticks — and so no
  certificate links and no inspection history, which hang off the id. The item number steps to the
  next one free in the category, keeping its padding ("01-DT" → "02-DT"); a number with no digits
  is left empty. Duplicates the SAVED item: with unsaved edits it asks to Save first. Subject to the
  same free-tier item limit as ＋. Checked in `npm run check:bulk`.

- **A date can be cleared** — the × at the end of a set date field on the item screen
  (`SimpleDatePicker` `onClear`, every `DateField` in ItemDetail), and **Clear this date on all
  selected** in Set dates (`BulkPatch` field `null`). Asked for by a vessel (8 Oct 2026) that had
  put next inspection dates where the expiry belonged and could only replace them, never remove
  them. Cleared to a missing key, never `''`: `complianceDate` falls back with `??`, so an empty
  string would have left the item judged by a date it no longer has. Open to every role that can
  edit an item, not only the Master — anyone who can change a date to any other value can already
  do more harm than removing it, and the snapshot taken before Set dates covers a slip.

## 2.56 — 8 October 2026

Android versionCode 20561 · iOS build 20561. Built but never submitted — everything in it shipped in 2.57.

- **Set dates on several items at once** (`services/bulkEdit.ts`, the multi-select on a category
  list — long-press an item or the tag button, then **Set dates** beside Print labels). Asked for by
  a vessel (8 Oct 2026) for the weeks after annual servicing, when thirty or forty items come back
  with the same inspection date. Sets next inspection and/or expiry and can add a comment under each
  item's own; a field left blank keeps every item's value. Edits the items in place — same id, so
  the printed QR labels, photos, certificate links and signed inspections stay exactly where they
  were — and takes a snapshot first, like an import, so it can be rolled back from Settings → Data.
  An item that already holds the date is not touched (no `updatedAt` bump, so sync sees no edit).
  `npm run check:bulk`.
- **Terms of Use, version 2** (`constants/legal.ts`, `LEGAL_VERSION` 1 → 2, so every user accepts
  them again on the next launch — the consent screen is the explicit acceptance). Three additions:
  who provides the app (KukaLab is the trading name of Mykhaylo Osypov, autónomo in Spain — a
  trading name owns nothing, so the Terms must name the person); **Feedback** — suggestions and
  ideas users send are assigned to him, with a perpetual licence as the fallback where assignment
  is not possible, and a request not to send the vessel's or employer's confidential information;
  **Governing law** — Spain, without taking away a consumer's mandatory home-country protection.
  Both documents now name the provider in full — name, NIF and address (`PROVIDER`), as Spain's
  LSSI art. 10 asks of the Terms and GDPR art. 13 of the Privacy Policy's controller. One constant,
  so a move to a business address is a one-line change. Both dated 7 October 2026.

## 2.55 — 7 October 2026

Android versionCode 20551 · iOS build 20551. Submitted to the App Store and Google Play 7 October 2026.

- **Two more icons for a vessel's own headings: dive equipment and cylinders** (Settings →
  Categories, `ICONS` in `CategoriesEditSc`). Asked for by a vessel adding its dive locker
  (7 Oct 2026). `diving-snorkel` rather than `diving-scuba-mask`, which at picker size reads as a
  box on a hose; `gas-cylinder` — a bottle with its valve, as the vessel drew it — rather than
  `diving-scuba-tank`, whose regulator hose makes it a dive set only.
- `npm run check:icons` now checks the picker list too. It used to cover the built-in categories
  and the glyph map only, so a mistyped picker name would have shown as a question mark on the web
  with nothing to say so.

## 2.54 — 5 October 2026

Android versionCode 20541 · iOS build 20541. Submitted to the App Store and Google Play 5 October 2026.

- **Under a deck, items run by their item number** (`compareNumber` inside `groupByPlace`, 5 Oct
  2026). A vessel that numbers its gear numbers it in walking order ("14-BD … 18-BD" along the
  Bridge Deck); under a deck the rows ran by location name A–Z and then by soonest date, so its own
  screenshot read 17, 16, 15, 14, 18. Now: number first; location (under a deck) and date only for
  what is left equal; unnumbered items after the numbered ones. A series code after the number
  counts as the series — "17-BD" sorts as "BD 17" — so 01-BD … 18-BD run together and the fire
  blankets 01-FB … follow as their own run instead of interleaving. Natural number order throughout
  (2 before 10). The first attempt the same morning ordered by number only WITHIN one location,
  which did not touch this case; it never reached the stores.

## 2.53 — 5 October 2026

Android versionCode 20531 · iOS build 20531. Submitted to the App Store and Google Play 5 October 2026.

### Asked for by a vessel going through 2.52 (3 October 2026)

- **Position headings are the DECKS** (`services/placeGroups.ts`, `CategoryItemsSc`). The vessel
  keeps its equipment as Deck → Location → item ("Main Deck → Main Deck Aft → Lifebuoy No. 1"); the
  list grouped by the Location column alone, so the Deck column it had filled in showed nowhere as
  a heading. Sorted by Position, a category that records any deck is now headed deck by deck, the
  rows under a deck run location by location, and the row's second line says the location only (the
  heading has said the deck). Items with no deck go last under "— No deck". A category with no
  decks at all — the reference workbook has no such column — keeps its location headings.
  Headings are in natural order (`comparePlace`): "Deck 2" before "Deck 10", "01 Sun Deck" before
  "02 Bridge Deck", so a vessel orders its decks by numbering them in Excel. Two spellings of one
  deck are one heading (`deckKey`, the same rule the label batches use). The Dashboard's own
  Position sort is unchanged.
- **The blank template has Expiry AND Next Inspection, and a Quantity, on every sheet**
  (`templateHeadings` in `services/registerSheet.ts`). It offered only the date its category is
  judged by, and Persons instead of Quantity, so the Liferafts sheet had no column for an HRU's
  expiry or how many there are. Nothing changed in the importer — it has always read both headings,
  so a vessel can also just add those two columns to the workbook it already has. A row with only
  an Expiry is judged by it (`complianceDate` falls back); a row with both is still judged by its
  category's own date, and the other is kept on the item screen.
- `npm run check:places` covers both: the headings, and a Liferafts sheet built from the template
  (raft + HRU) through the real importer and through Update.

## 2.52 — 2 October 2026

Android versionCode 20521 · iOS build 20521.

### Lifting & Mooring is switched on

`MODULES.lifting` is now `true` (constants/modules.ts): the eight lifting and mooring categories,
their checklists, the LIFTING group in reports and the second import template exist for every
vessel on every platform. `check:inspections` was still asserting the first draft's schedule
(monthly + quarterly everywhere); it now asserts the one agreed with the vessel — annual for all,
quarterly as well for mooring and working aloft, nothing monthly — and the general invariant reads
"every category offers at least one round" rather than "at least monthly".

### Asked for by a vessel after its first weeks aboard (2 October 2026)

- **A category opens sorted by Position, not Expiry date** (`CategoryItemsSc`). The list is what a
  crew member walks a weekly or monthly round with, deck by deck; what is falling due already has
  the Dashboard. Position is also first in the sort cycle now. The Dashboard itself still opens on
  Expiry date — that is its job.
- **A revoked account can be deleted** (Accounts → a revoked account → Delete). Revoke was the only
  way to retire an invitation, so the list grew at every crew change and stopped reading as "who is
  aboard". Offered only AFTER revoking, so a working account cannot be deleted by a slip, and it
  replaces "New PIN" on that dialog to stay within Android's three buttons. It deletes the
  invitation only; its devices are removed under Devices → Remove from list, and the dialog says so.
- **The Crew row says when it is not in use.** With "Sign as the device's account" on, signatures
  come from the device's account and the crew list is not consulted — the row's subtitle now says
  that instead of "Who can sign an inspection".

### A register that tripled, and a way to clear a category (2 October 2026)

- **Update from Excel no longer re-adds rows that have neither a number nor a location**
  (`twinKey` in `services/registerUpdate.ts`). Such a row matched nothing — `detailsKey` refuses it,
  rightly, as an identity — so it was ADDED on every update while the copy already held was listed
  as "not in this file". Load the same workbook three times and the category held three of
  everything; and once copies existed, a serial stopped being unique and stopped matching too.
  Those rows are now paired, in order, with an item that says exactly the same (type, make, size,
  serial, deck) — the answer the ten identical lifejackets in one locker already got. The existing
  check "a serial shared by two items matches neither" changed with it: still no match BY SERIAL,
  but the row is no longer added as a third copy. `npm run check:register` has the tripled case.
  The repair for a vessel already affected is the screen it already has: Update → "In the register,
  not in this file" → Remove these N. The originals are the ones kept, so labels and history hold.
- **Clear category** (the sweep icon on a category's list, Master only — or a device on no vessel).
  Asked for by the same vessel, and useful during setup generally. Takes a snapshot first (Settings
  → Data rolls it back), says how many items go and that on a syncing device they go for the whole
  vessel, and says what nobody thinks of: the printed labels of that category stop resolving.
  Signed inspections stay.

## 2.50 — 29 September 2026

Android versionCode 20410 · iOS build 20410.

### The lifting register: its own template, its own fields on screen

- **A separate import template** (Settings → Data). The vessel asked for one and the columns settle
  it: the lifting book has SWL, breaking load, diameter, material, two certificate numbers and three
  dates, and shares almost nothing with the LSA/FFE sheet. `exportTemplate(group)` builds either;
  the lifting book is `MSM_Lifting_Template.xlsx`, one sheet per category, with the vessel's own
  column names so the register they already keep imports without being retyped. The second download
  row appears only when the module is on.
- **The item screen shows the lifting fields for lifting categories only** — markings, SWL/WLL,
  breaking load, diameter, material, both certificate numbers, installed and last-inspection dates —
  in the order the vessel's register has them. Quantity, Persons and Manufacture date are not asked
  there: a form full of fields that never apply is a form people stop reading.
- **The label carries the SWL and the colour code.** The vessel said the first few columns of their
  register are the identification, and on a sling that is what the sticker is for: the SWL joins the
  compliance date as a prominent line, and the whipping colour sits with the category and location.

### The lifting register reads the vessel's own spreadsheet

The vessel sent its real lifting and mooring register — 16 columns, three sections, and the units a
ship actually writes ("22 kN", "140kg", "9.9 t", "2200kg", "31 -37 KN"). It is kept at
`design/jez-lifting-register.tsv` and `npm run check:lifting` imports it through the real importer,
because a mapper proved against invented data is worth nothing.

- **Nine typed fields** on `EquipmentItem`: `swl`, `mbl`, `diameter`, `material`, `marking`,
  `mfrCertNo`, `testCertNo`, `installedDate`, `lastInspection`. Asked for by the vessel, and right:
  a register kept in free text cannot drive a reminder, be printed on a label or be searched.
  **Loads stay strings** — the gear is marked "22 kN" or "9.9 t", and a label that printed our
  arithmetic instead of the marking would be the wrong number to compare against the sling.
  "N/A" is read as "there is none", not as a value.
- Three importer faults the real file exposed, all of which would have mangled it silently:
  - **"Manufacturer" was read as the manufacture DATE.** `make` is only claimed outright when a
    column is literally called "Type"; this register calls it "Equipment Name", so `make` fell
    through to the keyword pass where `/manufactur/i` took it for `manufactureDate`. A bare
    "Manufacturer" is now claimed first.
  - **"Next Annual inspection" was not a next-inspection column** — the pattern wanted the noun
    immediately after "next", so the word "Annual" broke it and the date went to extras.
  - **"Size / Length (m)" had no keyword at all**; `size` was matched only as an exact heading.
- The row-sorting vocabulary learned the lifting words (mooring, working aloft, cranes, hooks,
  slings and shackles, chain blocks, lifting eyes), so a sheet named the vessel's way — "Mooring
  lines", not "Mooring Equipment" — still lands in the right category.
- `npm run check:register` still reports the reference workbook at 627 items with an unchanged
  export → import round trip, module on and off.

### Lifting & Mooring — built, and switched off

A vessel asked for lifting and mooring gear to live inside MSM rather than in a second app: one
account, one crew list, one set of labels, one place the evidence is kept. They are right, and the
app was already shaped for it — MSM is a register of CATEGORIES grouped into LSA, FFE and Other, so a
new register is another group.

- `constants/lifting.ts` — the eight categories the vessel listed (mooring, working aloft, cranes,
  hooks & cables, deck slings & shackles, engineering lifting, working aloft anchors, interior
  lifting eyes & beams), each with a monthly check and a quarterly one. Every monthly check asks for
  the SWL/WLL marking and the test certificate, because that is what the gear is inspected against.
- `constants/modules.ts` — **the module ships dark.** Off, its categories are never registered, so no
  screen, report, picker or import sheet knows it exists. Shipping it is one line, and
  `npm run check:inspections` covers the register both ways: with the module off it asserts nothing
  about it is reachable; with it on, that every category is registered, grouped and owes its rounds.
- **Groups are now declared once** (`GROUP_ORDER`, `GROUP_LABEL`, `GROUP_SHORT` in
  constants/categories). Six screens each kept their own copy of the three-group list, which is how a
  fourth register would have appeared in the equipment grid and nowhere else. They all read the
  shared one now, so the module needs no screen changes at all.
- Not yet: typed fields for SWL/WLL, the last proof test and its certificate. `extra{}` carries them
  today and `nextInspection` already drives the reminder; the labels are being settled with the
  vessel's own register rather than invented here.

### Glyphs everywhere, no emoji

Settings showed five question marks in a column — Categories, Print QR labels, Checklists, Scan QR
label before signing and Sounds — because `GlyphBadge` maps an emoji to a monochrome glyph and those
five had never been added to the map, so they fell through to `help-circle-outline`. Five "?" in a
row reads as five broken features.

- The seven missing mappings are in, each checked against the MDI set — an invented name renders as
  an empty square, which is worse than a question mark.
- **The emoji indirection is gone from the screens.** Where the code said
  `<GlyphBadge emoji="🗂️">` it now says `<IconChip name="view-grid-outline">`, which is how the rest
  of the app has always worked. The map stays for the two places where the emoji is DATA (the manual
  and getting-started sections), not a spelling of an icon.
- **Raw emoji rendered as text are gone too**: the Dashboard strip headers (🛠 🚩 📷), the attachment
  and certificate badges (📎 📜), the lock, the compressor's timer, the anchor on the consent screen,
  the file placeholders, the ZIP button and the manual's warning note are all glyphs now. An
  attachment count shows as a number beside one paperclip rather than as a row of them.
- `✓`, `✕` and `★` stay — typographic marks, not emoji, and consistent with the rest.

### The version can no longer be typed twice

An archive went to the App Store carrying the previous build's numbers. `patch-native-version.js`
has synced app.json into the native projects since September, but only when something runs it
(`postinstall`, `npm run aab`) — and an archive made from Xcode runs neither.

`scripts/patch-ios-version-phase.js` adds a Run Script build phase, **first** in the app target, that
runs the sync before anything is compiled. Xcode can now no longer produce a build whose version
disagrees with app.json, whoever presses Archive. `alwaysOutOfDate` is set because the phase has no
inputs Xcode could reason about and would otherwise be skipped as up to date — which is the exact
failure it exists to prevent. Re-applied by `postinstall`, since `ios/` is CNG and prebuild takes the
phase with it; the target is looked up by name because its UUID is minted at prebuild.

Verified by breaking it on purpose: the Info.plist was set to 0.1/1, an ordinary Xcode build was run,
and both the source plist and the built app came out 2.50/20410.

## 2.49 — 29 September 2026

Android versionCode 20409 · iOS build 20409.

### Rectified defects now reach the other devices

A vessel closed its test defects on the Master and they stayed outstanding everywhere else — for
eleven days, as its own cloud copy showed (`open: true`, no rectification, `updatedAt` never moved).

`pushInspections` kept a list of record ids it had already sent and skipped them. That is right for
the inspections themselves, which never change — and wrong for the ONE mutation the trail allows: a
defect going open→closed rewrites a record that had of course already been sent. The closure was
recorded, stamped and signed on the Master's device, and never left it.

What is remembered is now the `updatedAt` that was sent, and `unsentInspections` (pure, checked)
sends a record when it is new **or has moved since**. The old id-only list migrates to a stamp of 0,
so every record goes up once more — which is exactly the repair wanted: **the vessel's stuck
rectifications deliver themselves on the first sync after the update**, with no re-doing by hand.

### The report signs itself off

"Checked by / Rank / Date" at the foot of an inspection report was three blank rules. The vessel does
not print these — they are uploaded straight into the PMS — so a blank line meant every export
needed a human pass before it could be filed, while every record in it already carried who signed it
and their rank.

`signoffFor` (pure, in services/inspections so the check script can reach it) fills the line from the
records themselves: one signer named outright, several all named, more than three named with a count
of the rest. The rank is printed only when it is not in dispute — one person, or several holding the
same rank — because a single rank over several names is wrong for somebody. The date is the LAST
round in the report, not today, so re-exporting September's report in November does not restamp it.
The XLSX summary carries the same three rows.

**The date is built from local parts, not `toISOString`.** A round signed at 00:30 BST is 23:30 the
previous day in UTC, and the report would have filed a night round under the day before — in a
document kept as evidence, on a ship where rounds genuinely happen at night.

### Categories: the vessel's names, and only the ones it carries

- **The Equipment grid shows the full name**, the one saved in Settings. It showed a short form of
  its own invention ("Imm. Suits"), and a heading the vessel added was cut at twelve characters — so
  the two screens disagreed about what a category was called.
- **Any category can be renamed, built-in ones included.** Settings → Categories listed only headings
  the vessel had added, so the twenty-four the app ships could not be worded the way the SMS words
  them. A rename is stored as a vessel row against the SAME key (`applyVesselChange`), so items,
  history and labels never move. Its `sheet` is deliberately NOT renamed: the importer matches
  workbook tabs by that name, and renaming it would leave every existing spreadsheet importing into
  nothing.
- **Hide what the ship does not carry** — a Master-only mode on the Equipment screen itself, where
  you notice the clutter, not buried in Settings. Hidden categories drop out of the grid, the rounds,
  the checklists, the scan rules, the label printing and the reports' "not inspected" lists. Nothing
  is deleted: `CATEGORIES` still holds them, because storage walks it to decide which buckets to
  read, and it is the screens that ask for `visibleCategories()`. Hiding a category that holds
  equipment warns once and says plainly that the items stay on file — "where did my lifebuoys go" is
  a bad five minutes.
- Built-in categories can be hidden but not deleted; only a heading the vessel added can be removed.
- A standalone device (never enrolled) may edit its own categories — it was refused along with the
  crew, and there is no Master aboard to ask.

### iOS 26/27: the app would not open at all

Reported from a vessel: MSM 2.46 dies on launch on an iPhone updated to iOS 27, with
`EXC_BREAKPOINT … UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` and none of our own
code in the trace — because none of it runs. An app LINKED AGAINST the iOS 26+ SDK (anything built
with Xcode 26/27) that does not declare `UIApplicationSceneManifest` is stopped by UIKit during
start-up, before `didFinishLaunchingWithOptions`. **2.47 and 2.48 have the same fault**; the version
number is irrelevant, the SDK it was built with is what counts. Nothing on the phone can work around
it — only a new build.

- `app.json` now declares a single-scene `UIApplicationSceneManifest` pointing at
  `$(PRODUCT_MODULE_NAME).SceneDelegate`.
- **The manifest alone would have shipped a black screen**, which is the trap in every half-fix of
  this going round: UIKit then expects a scene to own the window while Expo's AppDelegate is still
  creating one from `UIScreen.main.bounds` and attaching it to nothing. So window creation and the
  React Native start-up move into a `SceneDelegate`, which also replays the cold-start URLs and user
  activities — otherwise opening the app by scanning a `msm://` label would land on the dashboard
  instead of the item.
- `scripts/patch-ios-scene-lifecycle.js` (postinstall, idempotent) applies it to the generated
  AppDelegate, because `ios/` is CNG and a hand edit is deleted by the next prebuild. It refuses
  loudly rather than silently if Expo changes the template.
- Verified on an **iOS 27 simulator**, not by reading: the unfixed build is killed at launch; the
  fixed one reaches the JS runtime with its window attached.
- Expo adopts this itself from SDK 57.0.23. On the next SDK upgrade, check the generated AppDelegate
  and delete the script rather than patching a file that no longer needs it.

## 2.48 — 27 September 2026

Android versionCode 20408 · iOS build 20408.

Shipped after 2.47 was already in the stores, which is the reason for the number: the whole point
of the change below is to say WHICH build a device is running, and two different builds both
calling themselves 2.47 would have made the new line lie on its first day.

### Which build a device is actually running

- **`refresh` now re-records `appVersion` and `platform` on every connection** (`functions/index.js`,
  `services/enrolment.ts` sends them). They were written once, at enrolment, and never again — so a
  phone that joined on 2.3 and has updated four times since still read as 2.3. That is worse than no
  version at all: it is the number a Master would use to decide whether an old build is why somebody
  cannot find the round they set up. Written only when present, so an older client that does not send
  them keeps what enrolment recorded rather than having it erased.
- **Accounts shows it per device** — "v2.47 · up to date" or "v2.3 · update to 2.47", amber only when
  something is behind. The yardstick is the newest version anybody aboard is running, including this
  device (`utils/version.ts`), because the app cannot ask a store what the latest release is and a
  hard-coded number would be a lie the day after it shipped. It understates rather than overstates:
  nobody is nagged about a build that does not exist yet, and a whole vessel being behind shows the
  moment one device updates.
- Versions compare part by part as NUMBERS. As strings "2.3" sorts after "2.47", which is how a
  version check ends up telling the newest phone on the ship to downgrade. Checked in
  `npm run check:inspections`.

## 2.47 — 25 September 2026

Android versionCode 20407 · iOS build 20407.

A customer's third round of notes from a month of real weekly and monthly rounds aboard,
including their first full monthly fire-extinguisher inspection filed through the app.

### The schedule is the vessel's, per category

- **Quarterly rounds**, beside weekly and monthly (`ADDABLE` in ChecklistsSc, `quarterWindow` /
  `stepPeriod` in services/inspections, a Quarterly chip on Reports). A quarter is a CALENDAR
  quarter for the same reason a month is a calendar month: a round done on 30 September does not
  cover the quarter that starts the next day. Annual is still out on purpose — an annual service is
  a shore job with a certificate behind it, and the Certificates tab is where that evidence lives.
- **Every frequency can be switched off per category** (`ChecklistTemplate.off`, `roundsFor`,
  a switch on each row of Settings → Checklists). Until now a category owed every round the app
  shipped a checklist for, so a ship that checks its hydrants weekly but its escapes quarterly
  read as permanently behind — and a schedule nobody can complete is a schedule nobody trusts.
  Switched off, the round is not offered on the item and the report stops COUNTING it as due;
  records already signed keep their period and still print.
- **It is a tombstone row, not a deletion, and that is the point.** Templates sync by union of
  ids (`mergeTemplates`) and nothing deletes the vessel's copy in Firestore, so a row deleted on
  the bridge came back on the next pull. Same bug, same fix for **"use the standard checklist
  again"** (`standard: true`): withdrawing a vessel's own wording used to last about a minute
  before the vessel handed it back. `off` and `standard` are separate fields because they are
  independent — a vessel can word a round, stop it for a season, and expect its own words back.
- `periodsFor` no longer falls back to `['monthly']` when a category has rounds but all of them
  are off. The fallback existed for categories with no checklist at all, which is still honoured
  (a vessel's own heading gets the generic monthly round); keeping it after this change would have
  silently overruled the Master.

### Scan before signing, per category

- **`SigningPolicy.scanExempt`** + Settings → **Scan by category** (`screens/ScanRulesSc.tsx`).
  Asked for in these words: a rescue boat's inventory and the loose gear in a fire locker are worth
  keeping and checking off item by item, but nobody is going to label every bailer and spanner. One
  switch for the whole register meant the honest choices were to label a hundred small items or to
  turn the rule off for the extinguishers too — which is not a rule. `signingGate` now takes the
  item's category, and `scanRequiredFor` answers for the vessel when no category is named.
- Stored as the EXEMPT list, so a category added next month is covered by default: the rule must
  not quietly stop applying to new equipment. Exempt is not "unverified" either — a scan made
  anyway is still stamped on the record and still printed in the report's Scan column.

### Renaming a device — the bug, and the rank

- **The rename sheet closed the moment you touched a field.** The sheet sat INSIDE a full-screen
  `TouchableOpacity` backdrop and relied on `onStartShouldSetResponder` to swallow taps meant for
  the inputs; on react-native-web — the bridge browser, where this screen is mostly used — that
  claim does not stop the click reaching the Touchable underneath. The backdrop is now an
  absolutely-positioned SIBLING behind the sheet, so a tap that landed on the sheet cannot reach it
  on any platform, with nothing to get right.
- **Rename is a button on the device row**, not the fourth option in an action sheet. It is what a
  Master comes to that list to do at every crew change.
- **Renaming is Master-only, in the rules as well as the UI** (firestore.rules: a device may no
  longer change its own `firstName` / `lastName` / `position`). The name stopped being cosmetic when
  `signAsDevice` arrived — with that rule on, the name on the device record IS the signature on
  every inspection it files, so a crew member who could rename their own handset could sign as the
  Master. **The rules must be re-pasted into the Firestore console for this to bite**
  (`npm run deploy:rules`).
- The sheet's note now says what renaming actually DOES on this vessel: with `signAsDevice` on it
  names who the next round will be signed by, which is exactly why the customer wanted it at a
  crew change; with the rule off it is a label and signatures come from the crew list.

### Cloud functions moved to Node 22

Google decommissions the Node.js 20 runtime on **30 October 2026**, after which nothing deploys
until it is bumped — including an urgent fix. Done now rather than then: `functions/package.json`
`engines.node` and `firebase.json` `runtime` are **nodejs22**, and **firebase-functions is 7.4**
(the CLI had been warning about 6.x). `enrol`, `refresh` and `sweepPhotos` all redeployed and were
smoke-tested against the live endpoints afterwards — argument validation, a refused PIN and the
`reenrol` success payload all answer as before, and the sweep ran a full pass on the new runtime.
Minting a custom token is the one path that cannot be exercised without a real device secret.

**firebase-admin deliberately stays on 12.7.** Version 14 removes the namespaced API
(`admin.firestore()`, `admin.auth()`, `admin.storage()`) in favour of `firebase-admin/firestore`
and friends — five call sites, three of them on the enrolment path that every device on every
vessel depends on, and `createCustomToken` cannot be tested before a real enrolment. That belongs
in its own change, made when a device is on hand to try it, not bundled into a deadline-driven
runtime bump. 12.7 is not deprecated and runs on Node 22.

### Photo retention — 90 days in the cloud, then the vessel's own archive

Asked for on 25 September: keep inspection photographs in the cloud for two or three months and
have the rest backed up locally.

- **The window is 90 days** (`services/photoArchive.ts` `RETENTION_DAYS`). Older photographs are
  deleted from Cloud Storage by a nightly scheduled function, `sweepPhotos` in `functions/`.
- **Nothing is deleted from a period the vessel has not archived.** The cutoff is
  `min(now − 90 days, photoArchive.archivedThrough)`, and no `archivedThrough` means a cutoff of
  **0 — delete nothing**, never "delete everything". A photograph is evidence for a signed record,
  and after a sweep the only copies are the vessel's archive and whatever the crew's own devices
  hold; a job that deleted the last copy of evidence because a ship was slow to archive would be
  indefensible. A vessel that never archives keeps paying for storage instead, which is a bill and
  not a loss.
- **Settings → Inspection photos → Photo archive** (`screens/PhotoArchiveSc.tsx`). One ZIP per
  calendar month — `photos_2026-09/<date>_<category>_<item>.jpg`, `index.csv` (item, serial,
  position, round, outcome, signer, status) and a README for whoever opens it in two years without
  MSM to hand. Per month because a browser cannot hold a year of JPEGs in memory, and because
  "where are September's photos" is the question that actually gets asked.
- **Save, then confirm — two steps, deliberately.** The app cannot see where a saved file went, so
  it does not pretend to: the Master confirms, and the confirmation is worded as what it authorises
  (the originals may now be deleted). Months are archived in order — `archivedThrough` is a single
  watermark, so marking October while September is unsaved would hand the sweep permission it must
  not have (`canMarkArchived`).
- **A missing photo does not fail the archive, it is recorded in it.** One unreadable file — never
  uploaded from a handset since wiped — would otherwise keep a vessel from ever archiving anything,
  and a sweep gated on archiving would then never run. `index.csv` carries a Status column and the
  count comes back in the confirmation.
- **The sweep deletes by the RECORD's date, not the object's age**, which is why it is a function
  and not a bucket lifecycle rule: the queue holds photographs until the ship has Wi-Fi, so a round
  done in March can upload in May. Each night it reads only the band since `sweptThrough` (with a
  30-day overlap for exactly those late uploads) rather than every record ever signed, and it lists
  the collection with `select('photoArchive')` because a vessel document carries the whole register
  as one string field.
- `photoArchive` is a Master-only field in **firestore.rules**, beside `entitlement` and
  `signingPolicy` and for a sharper reason than either: a crew device that could claim "everything
  up to today is archived" could have the vessel's evidence erased overnight. **storage.rules is
  unchanged — no device may delete a photograph**; only the job may, with admin credentials.
- Local copies are never touched, anywhere. After a sweep the original on the phone that took the
  photo, and the copy another device fetched to view it, are real copies of evidence rather than a
  cache.
- An archived record says so instead of showing a pending-upload icon (`InspectionDetailSc`): "in
  the vessel's own archive for September 2026" — "not uploaded yet" and "kept by the vessel" are
  different facts and the screen now tells them apart.
- `npm run check:inspections` covers the retention logic — the cutoff with and without an archive,
  the window boundary (a month is offered only when it is COMPLETELY out of it), the watermark
  never moving backwards, and the counts the screens show. 141 checks.

**Deploy:** `cd functions && npm run deploy` (first deploy enables Cloud Scheduler), then
`npm run deploy:rules` for the Firestore change.

### Smaller things asked for

- **"Clear all"** beside "All pass" on the inspection screen: one confirmation clears every answer,
  the comment and the defect note. Evidence photos stay — a photograph was taken of something real,
  and "clear the form" is not what anybody means by deleting it; the thumbnails have their own
  remove control.
- **The Vessel card in Settings stays collapsed once the vessel is identified.** It opened on every
  visit showing five filled fields and a live "Save vessel info" button, which reads as an unsaved
  form — the app asking again for what was entered weeks ago. It now opens only while the five
  fields are incomplete, shows "Vessel name · IMO …" when collapsed, and the button is disabled and
  reads "Saved" until something actually changes. A card opened by hand survives the vessel arriving
  from storage a moment later (`touched`), or the effect would shut it under the user's finger.
- `writeSigningPolicy` (services/policy.ts) is now the one path that stores the rule locally and
  pushes it to the vessel. It was inline in SettingsSc, and the per-category screen would have been
  a second copy of "store it, push it, explain a failed push" — with the error handling as the half
  that drifted.
- `npm run check:inspections` covers the new pure logic: round resolution with `off` / `standard`,
  the tombstone surviving a merge against an older row, calendar quarters and stepping, and the
  category-aware scan gate. 117 checks.

## 2.46 — 19 September 2026

Android versionCode 20406 · iOS build 20406.

A customer's second round of testing notes, answered in one release.

### The signature is the device

- **Sign as the device's account** (`SigningPolicy.signAsDevice`, Settings, Master-only like the scan
  rule). An Officer could scan an item on their own phone and then pick a colleague's name from the
  list, so a signature said nothing about whose hands the phone was in. With the rule on, an
  enrolled device signs as the person it was issued to — the name and rank on its account, read
  live from the vessel — and the picker is not offered. The Master changes who a device belongs to
  where the devices are, Settings → Accounts (rename). `signerRule` is pure and checked: a device on
  no vessel still picks (it has no account); an enrolled device whose account has not loaded is
  HELD, not let through to the picker — a rule that quietly fell back whenever the network was slow
  would not be one. The record's `byId` becomes `device:<id>`, which nothing looks up (it was always
  allowed to dangle).
- The Master's no-scan override and the report's Scan column already existed (2.44); the customer
  had not found them. Both are now called out in the reply, not changed.

### Smaller things asked for

- **Sounds on/off** (Settings → Modules → Sounds, `prefs.soundsMuted`). Read straight from the
  prefs key when `utils/sound` loads, because the ship's bell plays on the splash before DataContext
  has anything — a mute that let the loudest sound through once per launch would not be a mute.
- **Emergency Escapes** is a built-in LSA category (`emergency_escapes`) with weekly and monthly
  checklists: hatches, routes, signs, lighting, seals, ladders, the gear along the route. Filed
  under Other it was invisible in the LSA report. The importer sorts "escape hatch / route / door /
  ladder", "means of escape" and "emergency exit" rows into it — but "emergency escape breathing
  device" is still an EEBD, which is why the pattern names the things along a route rather than
  the word "escape". 24 categories now.
- **BA cylinder pressure: ≥ 90% of rated (300 bar → ≥ 270 bar)**, was 80%, in both the BA-set
  weekly line and the bottle-pressure monthly line. Wording only; the line ids are unchanged, so
  older records read back correctly. A vessel with a different figure words it in Settings → Checklists.
- **The blank import template now has a sheet for Other Safety Equipment** (named after the label,
  which the importer already matched). It used to be skipped for having no source worksheet — so
  the one category a vessel fills by hand was the one it could not fill from Excel.

## 2.45 — 16 September 2026

Android versionCode 20405 · iOS build 20405.

### One round, one page

- **The inspection report can be narrowed to a category** (`ReportOptions.categories`,
  Reports → Inspections). Under the group, every category that owes the period's round is listed
  with its progress — "5 of 5 inspected · complete", "3 of 12", "failed", "defect open" — tap to
  include or leave out, press and hold to report on that one alone. Asked for by a customer: the
  lifebuoy round, finished, filed in the PMS as its own evidence. The whole-group report answers
  "is the month done"; this one answers "is THIS check done", and a report that also listed forty
  extinguishers nobody had reached yet read as incomplete for a round that was in fact finished.
- The title names what the report holds — "Lifebuoys Monthly Inspection Report", or the group
  followed by the categories when there are several — and a single category names the file after
  itself. A report must never claim more than it contains.

### All the labels at once

- **A batch picker for QR labels** (`screens/LabelBatchSc.tsx`, `services/labelBatch.ts`) — the tag
  button beside the scanner on the Categories tab, and Settings → Print QR labels. A customer
  fitting out a vessel asked for it in so many words: select a category, a deck or a group and get
  every label in one go. The Label screen already knew how to print a batch to a roll, an A4 grid,
  a PDF or the Xprinter; what it lacked was a way to be handed more than one category's items, and
  the long-press multi-select is a thumb's worth of stickers, not a ship's.
- **Decks are the vessel's own words**, read from the register rather than a list, and two
  spellings of one deck ("Sun Deck", "sun deck ") are one chip. An item with no deck recorded is
  still an item that needs a sticker, so it gets a bucket of its own instead of vanishing from every
  filter.
- **Labels come off deck by deck**, then by category and item number. The person sticking them walks
  a deck, not a category, and a roll that follows the walk is the difference between an afternoon
  and a day. Items with no deck print last — they are the ones somebody has to go and find.
- Not gated on rank: printing writes nothing to the register, and the bosun holding the label
  printer is exactly who prints them.
- `npm run check:labels` — the selection and its order, 15 checks.

## 2.2 — 5 September 2026

Android versionCode 20201 · iOS build 20201.

The release that answers a customer's question: can MSM take a QR scan through a checklist to a
signed record and out as an LSA/FFE report. It can now, and the account model underneath it had
to change to make those signatures mean anything.

### The audit trail

- **Signed inspections** (`types/inspection.ts`, `services/inspections.ts`). One record is one
  crew member working one checklist against one item: exact timestamp, signature snapshot,
  per-line `pass|fail|na`, frozen outcome, comment, evidence photos, optional defect.
- **Records are append-only.** A correction is a new inspection, never an edit. Two things
  depend on it: a signed statement that could be quietly rewritten is worth nothing at an audit,
  and merging two devices becomes a set union — so several officers can work a round on separate
  phones and lose nothing. The only permitted mutation is a defect going open→closed, itself
  stamped and signed.
- **30 checklist templates** (`constants/checklists.ts`), weekly and/or monthly per category,
  with a generic fallback so no category can refuse a round. Line ids are permanent: they are
  the keys of every stored result map.
- **LSA/FFE period reports** (`services/inspectionReport.ts`), PDF + XLSX, from one pure
  `buildReport` so the preview and the file cannot disagree. Three sections — what was
  inspected, **what was not**, and every open defect carried forward. The middle one is printed
  on purpose: a report that hides the gap reads like a clean sheet.
- New screens: Inspection, InspectionDetail (read-only by design), Crew, Defects.
- `npm run check:inspections` — 41 invariant checks on immutability, merge and calendar windows.

### Accounts are issued, not shared

- **The shared connection password is gone, and its code with it** (~800 lines). A Master issues
  an invitation (name + 8-digit PIN); `functions/enrol` mints a custom token carrying
  `{vessel, role, approved, deviceId}`, and `firestore.rules` is written against those claims.
  A role is now enforced by the server rather than agreed between colleagues, and revoking one
  person no longer means changing the password for everybody.
- **Do not reintroduce a fallback to the old path.** It keyed the register by the Firebase uid,
  which since enrolment is per-device (`<imo>__<deviceId>`) — a device reaching it wrote a
  second register beside the real one, one vessel with two incomplete copies.
- Roles: Crew / Officer / Master. Device management lives in Settings → Accounts, including
  removing a device outright; a device cannot remove itself, or a lone Master would lock the
  vessel out of its own accounts with one tap.
- **The bootstrap code is digits.** The enrolment field is a number pad — crew key it on deck in
  gloves — so a base64 secret could not be entered at all and the first device on a vessel could
  never enrol. Found by walking the flow on a device, not by any typecheck.

## 2.3 — 6 September 2026

Android versionCode 20301 · iOS build 20301.

- **Two photographs broke syncing for a whole vessel.** In a browser an attachment IS a base64
  `data:` URI inside the item, and the register travels as ONE Firestore document with a 1 MiB
  ceiling: `The value of property "register" is longer than 1048487 bytes`. Files now go to Cloud
  Storage and the register carries a reference. The reference is a download URL rather than a
  path so every existing render site keeps working unchanged — the cost, stated plainly, is that
  such a URL carries its own token, and it lives only inside a register that only members can
  read. An upload that fails is not fatal: the records still go up whole and the file waits.
- **Inspection photographs signed in a browser never uploaded at all.** `uploadPhoto` was written
  around expo-file-system, which reports a `data:` URI as a missing file — so the queue retried
  six times and parked it. On a phone the same URI made `getInfoAsync` THROW, the throw escaped
  the effect, and neither the image nor the "not uploaded" state was ever set: the spinner turned
  for ever. And opening one failed with "You don't have access to the provided file", which was
  true — there was no file; a data URI is now written to one before it is shared.
- **An upload allowance for unlicensed vessels: 25 files.** Unlike the other free-tier caps this
  applies DURING the trial, because it limits what we pay for rather than what the app will do.
  Nothing is refused locally — photographs are taken, kept and backed up as before; what waits is
  the copy for the other devices, and everything held back goes up on the first sync after the
  vessel is licensed. Counted on the vessel document so five phones cannot each spend it.
- **A round mark beside every item**, mirroring the expiry bar: blue not inspected, green signed
  and clear, amber the period is closing, red a defect still outstanding. Red is deliberately not
  tied to the window — a defect raised in March is still a defect in June, and letting the
  calendar clear a red mark would hide exactly what an audit looks for. "This period" joins the
  sort options on both the dashboard and the category list.
- **A device removed from the vessel could not rejoin.** `refresh` refused it with "This device is
  not in the register", but the stale secret kept `enrolled` true — so the app believed it was
  aboard, never offered to join, and showed a "Try again" that could not succeed. The server now
  answers `reenrol`, the client forgets the secret, and "Join this vessel" comes back with the
  reason why.
- Settings rearranged: theme as sun/moon/star and PRO as a badge in the header, joining moved
  behind the "This device" card that already carried its name, the Cloud sync panel removed once
  it had nothing left to say. On web the tab bar moved to the top, and the counters and pickers
  became one row of five under the title.
- **Close worked only when there was something behind it.** `navigation.goBack()` is a no-op on a
  one-entry stack and fails SILENTLY, so the button looked dead. It never showed while people
  tapped their way through the app, and started the moment screens got URLs: open /label directly
  or reload the page on it and the stack has exactly one entry. `utils/nav.ts` goes back when it
  can and to the Dashboard when it cannot — applied to all ten screens that could be reached that
  way, not just the one that was reported.
- **The first splash now shares the MSM cube's teal.** It sat on the app's pale background, which
  made the sequence two screens rather than one resolving into the next.
- **The widgets carry the QR-with-the-cube tile** instead of a line-drawn viewfinder — on a home
  screen among two dozen icons a frame reads as "some utility". The art needed a quiet zone added:
  it puts the code hard against the tile edge, so rounding the corners ate into the finder
  squares, the three marks a scanner uses to find a code at all. Only NEUTRAL pixels were
  whitened; a levels curve across all three channels turned the cube's red and blue into poster
  paint. `.unredacted()` on iOS is load-bearing: WidgetKit blanks every Image and Text into grey
  shapes while it has no timeline, which is right for private data and nonsense for a button —
  that is what a real iPhone was showing.
- **The picker previews were regenerated** from the same tile; they are native Android drawables,
  so they reach the app only through `android/app/src/main/res` (or a prebuild).
- **Version 2.3 / 20301 everywhere.** Two copies had drifted: the widget extension was still on
  1.9 / 1096 in the Xcode project — Xcode warns and App Store Connect refuses an extension whose
  version differs from its app — and the web shell has its own app.json, so the deploy stamp said
  2.2 while the app said 2.3, which tells an open tab it is current when it is not.
  `patch-native-version.js` now covers the project settings, and the stamp reads the app's version.
- **Signing: the project was pointed at the wrong team.** `DEVELOPMENT_TEAM` was VL4B4R8D84, which
  holds only a Developer ID (macOS) certificate — no iOS identity — so Xcode could not issue a
  profile and none existed. app.json's LAGTN99698 has a valid one; with that, automatic signing
  produced the profiles by itself and the app ran on a device.

### Labels for printers that are not ours

- **A custom label size, in millimetres.** The five presets match the printer MSM ships with, and
  for that one a free size picker is a way to waste a roll. But a file handed to another make's
  driver app has to match THEIR roll, and nobody can be told to buy ours. The QR footprint and the
  layout are DERIVED from the two numbers, not asked for: nobody knows what "24 mm of QR" means on
  a roll they have just bought, and getting it wrong prints a code that will not scan in a dark
  engine room. Three limits — the short edge less a margin, 40% of the long edge, half the width.
  The third earns its place on PORTRAIT stock: without it a 40 × 60 label gave the code 24 mm of
  its 40 mm width and the layout dropped the type and serial for want of room.
- **Save as image (600 dpi)** in the browser build. The PDF page is the better carrier because it
  has a physical size, but expo-print cannot make one on web — and a desk machine is exactly where
  somebody sits with another maker's thermal printer and its own app. An image is the one format
  every such app takes. Rendered from the SAME html the print path uses, so there is no second
  renderer to keep in step. Verified end to end in a browser: 2362 × 1181 px, which is 100 × 50 mm
  at 600 dpi exactly.
- The millimetres are in the PNG's file name on purpose: an image carries no page size, so the
  receiving app has to be told what to print it at — and told not to "fit to page".

### Small things that make the work read

- **An officer can roll their own device back, and it stays there.** Restoring from a file is
  the Master's because it replaces the register and hands it to the vessel; rolling THIS handset
  back to how it was an hour ago is repairing what is in your hand. To keep that promise the push
  has to be actively suppressed — every local edit schedules one — so a private recovery cannot
  quietly become everyone's. What it cannot do is outrank the ship: the register is one shared
  document, so the next sync reconciles, and the dialog says so instead of implying otherwise.
- **Worksheet tabs are coloured by group** in both the blank import template and the exported
  register: LSA blue, FFE red, the rest slate, matching the app. SheetJS 0.18 READS a tab colour
  and does not write one (verified before relying on it — the property goes in and nothing comes
  out), and cell styling is a Pro feature, so the colour is written into the file afterwards with
  jszip, which is already here for the ZIP export. `<sheetPr>` must be the first child of
  `<worksheet>`; anywhere else and Excel calls the file corrupt. A failure to paint returns the
  plain workbook — a colourless template is still a template.

### Manual and splash

- The manual gained 16 entries across six sections, in all four languages: the catch-all
  category, the browser scanner's opt-in camera, the reason on every defect, snapshots and the
  roll-back, what Reset really clears on a syncing device, and rank aboard / This device / Sign
  off. Section counts are equal across languages (22 sections, 88 entries).
- Splash: the octopus is cropped and the logo squared off. `splash.png` is OPAQUE and carries
  ~19% white margin, so on the app's pale background it read as a hard-edged white square with a
  small octopus adrift in it. The file is untouched (it is also the native splash, where the
  margin is wanted) — the image is drawn larger than its window, and the difference is the crop.

### Sync: what it was actually refusing

"Could not connect" was covering a perfectly good connection. The session was fine and the
FUNCTION calls were succeeding — the server logs showed `auth: VALID` throughout — and the
register WRITE was being refused. Three separate causes, none of which could be seen because
every path to `error` set the status and threw the reason away.

- **The crew list was pushed by every device on every sync**, and the rules gate it on `isSuper`.
  On any device but the Master that is a guaranteed refusal, and it took the whole push down with
  it. A device that may not write the list no longer tries: only a Master can have changed it.
- **The whole inspection trail was re-pushed every time.** By the rules that is an UPDATE, and an
  inspection may be updated only by an officer and only in its `defect` — so a crew device was
  refused for re-sending a record that had not changed at all. It also cost real money: the trail
  grows for the life of the vessel and every launch pushed all of it up a metered VSAT link.
  Devices now track what is already up there; a signed record is immutable, so that knowledge is
  permanent.
- **Signing an inspection scheduled no push at all.** The effect watched the register, the
  certificates, the vessel and the compressor — everything except the one thing the app exists to
  record. A signature reached the vessel on the next launch, or when somebody happened to edit an
  item. On a round worked from two phones that is the difference between seconds and tomorrow.

Every path to `error` now carries its reason, each write names itself (`register:`,
`inspections:`, `crew:`), and a permission refusal on the wrong vessel prints the two IMO numbers
side by side instead of "Missing or insufficient permissions".

- **The rank is remembered locally.** It arrives in a token, so a device with no signal had no
  rank — and gating the interface on that left a Master who lost signal without the backup or the
  roll-back, at exactly the moment those matter. For the INTERFACE only; every write is still
  checked against the claim.
- **Sign off now updates the screens.** `disconnect()` left `enrolled` standing, so the join
  screen went on showing the identity of a device that had just left, and Settings went on hiding
  controls a standalone device is entitled to, until the app was restarted. State that mirrors
  storage must be corrected by whoever changes the storage. "Sign off & erase" also reloads and
  drops the snapshots.

### A net under the trapeze, and who may pull it

- **Automatic snapshots.** The app copies the RECORDS on every launch and keeps the last three
  on the device. Settings → Data → "Roll back to <time>" names the moment it would return you
  to — the date is on the row, because "Restore a snapshot" makes a person open a dialog to find
  out whether it is worth anything. It exists for the accidents nobody plans for, and it is the
  copy that will actually be there: nobody exports a backup the morning before the mistake.
- No binaries in a snapshot: a register with a few hundred photos is tens of megabytes and would
  be felt on every open. Attachment files stay on disk under their own names, so a roll-back
  relinks to them — which is why the UI says a snapshot is not a substitute for a real backup.
- **An empty register never overwrites a good snapshot.** Opening onto an emptied register would
  otherwise record the emptiness and, across three launches, erase the last good copy — the very
  accident the feature exists to survive. Same reasoning as the guard in `pullAll`.
- **"Reset all data" was clearing the ship, silently.** Wiping storage fires the data-change
  push, and `pushAll` sends what it finds, including nothing — so the vessel's register and every
  other device went with it, within seconds. It now asks separately, the button is named "Erase
  everywhere", and it points at Sign off & erase for anyone who wants only their own handset
  cleared. A reset also drops the snapshots, or "delete everything" would be untrue.
- **Data controls follow the rank.** Restore and Reset are the Master's — they replace the
  register and hand it to the vessel, overwriting what other officers have worked against.
  Officers keep Import and Export. A device that has NOT joined a vessel keeps all of it: gating
  on rank alone took Import away from every new install, because the rank is null until
  enrolment, and the first thing a new user must do became the one thing they could not.

### A signed record cannot be doubled, and a defect always says why

- **Tapping Sign twice signed twice.** The guard was React state, which does not settle between
  taps: three taps stacked three confirmations and all three closures read the flag as false.
  A signed record cannot be edited or deleted, so the duplicate was a second signed statement
  about one check — and on a failed round, a second open defect for somebody to close by hand.
  Refs now guard both the confirmation and the signing, and the same guard covers recording a
  rectification. Three checks in `check:inspections` pin down why the guard has to live in the
  screen: two signings get different ids, merge is a union, and nothing downstream can undo it.
- **Every defect carries its reason** — the checklist lines that failed — on the card, on the
  Dashboard strip and in the report, where the column is now "What failed". The officer's note
  is added to the reason, never instead of it: the note is optional, so a defect raised without
  one used to print a blank where the finding should be, and an auditor reading a blank has to
  come and ask. `defectReason` lives in the domain module, not the report: it is a statement
  about a defect, and there it can be tested (the report module imports expo-print and will not
  load under Node).

### The register grows a catch-all

- **Other Safety Equipment** — every register carries gear the standard sheets do not name, and
  with nowhere to put it that item stays on paper, which makes it the one that gets missed. Built
  by hand with ＋; it behaves like any other category (dates, QR labels, inspections, reports).
- `CategoryMeta.sheet` became optional. An empty string made the importer report a missing
  worksheet with no name, and asked Excel for a sheet called `""` — which it refuses, breaking
  "Download import template". Absent says it plainly.
- `check:inspections` now asserts EVERY category has a monthly round and builds a non-empty
  template, instead of sampling one. A category added without a checklist can be scanned and
  opened but not inspected, and nothing else would have said so.

### The interface matches the rank

Every enrolled device was shown the Master's controls — issuing accounts, approving devices,
editing the signing list. The server refused those writes (`firestore.rules` gates them on the
`superadmin` claim), so nothing could actually be done, but **a button that always fails tells
the user something untrue about their own authority**.

- Accounts, Crew and the Settings entry to Accounts now open according to what the device's own
  token says it is. Until the rank comes back from `refresh` the screens offer nothing at all
  rather than guessing.
- A member sees the crew and device lists read-only. That read is legitimate and the rules allow
  it — knowing who is aboard is not the same as changing it.
- Only a Master subscribes to invitations. They carry PINs and are Master-only in the rules, so
  subscribing as anyone else was a guaranteed permission error landing on screen as a red card
  for doing nothing wrong.
- **The crew list tightened from `isAdmin` to `isSuper`.** It decides whose name may appear on a
  signed record, which is closer to issuing an account than to doing a round.
- The Master can add an already-enrolled person to the signing list in one tap, taking the name
  from their account. Asking an officer to type a name the vessel already holds invites two
  spellings of one person. Manual entry stays, because a bosun with no phone still has to be
  able to sign.

### Joining, and leaving

- **A device that has joined is shown who it is, not a form.** Three empty boxes asking for a
  name and a PIN read as "you are not in", which is the opposite of the truth. The screen now
  carries the name, the rank and the approval state, read live from the vessel — so a rank the
  Master changes an hour later appears without anyone reinstalling anything.
- **Sign off** ends the session AND clears the device secret. The second half is the load-bearing
  one: without it `refresh` mints a new session on the next launch and signing off lasts only
  until the app is reopened. Erasing the local register is offered as a separate choice, because
  it is a different decision — that one matters when the handset is handed on or sold.
- **Neither buys a fresh trial**, and the dialog says so with the actual number of days. The 60
  days run from the vessel's first launch, mirrored to the account, earliest wins. A device that
  signs off, wipes and rejoins finds the clock where it left it — and rejoining needs a new
  invitation and a Master's approval, because the device can no longer let itself back in.

### Rank aboard, and where joining lives

- **Invitations carry a `position`** — Third Officer, Bosun, Chief Engineer — kept deliberately
  apart from `role`, which is what the app permits (Crew / Officer / Master). A Second Engineer
  may hold a Crew account and a cadet an Officer one; conflating them would make every promotion
  aboard a permissions change and every permissions change look like a promotion. Free text,
  because ranks differ by flag, company and trade.
- The rank travels invitation → device record → the join screen, and is what fills the signing
  list when a Master adds an enrolled person. **A device cannot name its own rank**: `enrol`
  reads it only from the invitation, or the signature line would be self-declared. Devices that
  enrolled before this have no rank until they rejoin.
- **Joining moved to the bottom of the Vessel section.** The IMO above it is what a device
  joins, so the two questions now read as one sequence. Among the inspection links it looked
  like another weekly task rather than the last step of naming the ship. Once aboard, the row
  reports instead of inviting — "This device · Who it signs as, and how to sign off".
- **The Crew screen is offered to the Master only.** For anyone else it is a management page
  with nothing to do on it and usually nothing on it. Signing is unaffected: the picker inside
  an inspection reads the same list, and every rank still signs.

### Transport: Realtime Database → Firestore

- Per-document writes, so two officers inspecting at once write two documents instead of racing
  for one tree; a real offline queue; live `onSnapshot` instead of manual Push/Pull.
- The register travels as one JSON **string** field: item `extra` keys come from arbitrary Excel
  headers, and as a map every one of them would become an indexed field name.
- The trail is one document per record — it has no 1 MiB ceiling and cannot collide between
  devices.
- `pullAll` **refuses an empty cloud register when the device holds items.** Without that guard a
  device pulled an empty blob, lost all 13 items and pushed the emptiness back over the good copy
  within a minute. Observed for real on 4 Sep 2026.

### Licensing: one licence per vessel

- MSM Pro is **€99/year per vessel (one IMO)**, bought on LemonSqueezy and attached to the
  vessel's account. Every enrolled device inherits it; a crew member buys nothing. A store
  purchase is tied to the Apple ID that paid, so the mate who bought it had Pro and the second
  officer beside him did not — though the licence was meant to cover the ship.
- No IAP product exists in either store, and none should: the app is free there and the native
  paywall shows no price and no link, only key activation.
- **Pass the vessel key, never the auth uid.** Activation used `currentUid()` and wrote to
  `safety_vessels/<imo>__<dev>`, which the rules do not recognise — the key validated and then
  failed with "Missing or insufficient permissions".
- The trial belongs to the vessel, not the handset: the first-launch stamp is mirrored to the
  account, earliest wins. On Android the secure store is wiped with the app, so without this
  every reinstall handed out a fresh 60 days.

### Inspection photos

- Downscaled to 1600px on the long edge before storage — `expo-image-picker`'s `quality` only
  sets JPEG compression and left the full 12 MP, so photos were 2–3 MB and are now 200–450 KB.
- Held in a queue until the connection is worth spending (Wi-Fi by default). The cost that hurts
  is not Google's — it is the ship's own VSAT airtime.
- The object path is **derived** from the record's ids rather than written back onto it: a signed
  inspection is immutable.

### Web / desktop

- Desktop is the web build. The Electron/NSIS installer and the react-native-windows track are
  retired; Firebase Hosting serves the site and `npm run exe` wraps it into one self-updating
  file. macOS is served by the iPad build or the browser — `../MSM_Mac` was retired on 5 Sep.
- **`Alert.alert` is drawn in the DOM.** It used `window.confirm`, and a browser lets the user
  tick "prevent this page from creating additional dialogs" — after which `confirm()` returns
  false having shown nothing. The shim read that as Cancel, so restoring a backup quietly did
  nothing, and the same suppression sat in front of the dialog that SIGNS an inspection.
- **Backup restore.** Three separate faults, in order: the file picker filtered by MIME type and
  `.msm` has none, so macOS greyed the backup out; cancellation was then inferred from window
  focus and a good file could be reported as a cancel; and finally the restore was overwritten by
  the cloud listener putting the vessel's copy back. A restore now outranks incoming data for 30
  seconds and is pushed to the vessel, so the ship adopts what the user chose.
- Deep links: a screen map onto URL paths, so `/accounts` and friends are real addresses.
- The scanner no longer reaches for the camera when it opens. On a desk machine the browser sat
  in a "connecting a device" state — on Opera worded as waiting for a scanner to be plugged in —
  and the page looked stuck with nothing to say why. In a browser the camera is now asked for
  explicitly, and a machine with no camera is told so in one line.

### Build traps found the hard way

- **The version never reached the native projects.** app.json said 2.1/20101 and the AAB came out
  1.9/1095: both `android/` and `ios/` take the version at prebuild, which neither `expo run:*`
  nor Gradle re-runs. `scripts/patch-native-version.js` syncs it and never downgrades.
- **`OutOfMemoryError: Metaspace`** in `:expo:lintVitalAnalyzeRelease` — heap was fine, metaspace
  was not, and it fails at release only. Run `./gradlew --stop` after changing the JVM args or
  the running daemon keeps the old ones.
- **Cloud Storage write-once needs `resource == null`.** `allow update: if false` does not stop an
  overwrite there; verified live before trusting it.
- **`firebase deploy` refuses a hosting `public` path outside the project directory** while
  `firebase serve` accepts it — so serving locally is not proof the deploy will work.
