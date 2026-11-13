# Marine Safety Manager (MSM) — Claude Code Context

## Project overview
React Native + Expo app for a ship's **LSA** (Life-Saving Appliances) and **FFE/FIFI**
(Fire-Fighting Equipment) inventory: per-category equipment registers, inspection/expiry
tracking, Excel import, PDF/XLSX export, optional Firebase cloud sync. Targets **iOS**,
**Android**, and **Windows** (react-native-windows, follow-up track).

**Mac and Windows are served by the browser build, not by native desktop apps.** The
react-native-macos copy at `../MSM_Mac` was RETIRED on 5 Sep 2026 (see the banner at the top of
its CLAUDE.md) and the react-native-windows track before it — each was a third tree to mirror
every change into, and the cost was visible: four copies of the version number drifted apart
unnoticed. Mac users get the iPad build from the App Store or the web app; Windows users get the
web app. Port anything you still want OUT of `MSM_Mac`, never back into it.

Sibling app to **Marine Hospital Manager (MHM)** at `/Users/MarineHospitalManager/MHM_4.1.1`,
whose conventions (theme, navigation, expiry logic, XLSX import, Firebase device-approval) this
app mirrors. Bundle id `com.kukalab.msm`.

## Tech stack
- React Native 0.81.5 + React 19.1.0 + TypeScript + Expo SDK 54 (managed)
- Navigation: `@react-navigation` v6 (bottom-tabs + stack), gesture-handler swipe (no reanimated)
- Storage: AsyncStorage (local-first), one key per category `msm:<category>` + `msm:vessel_info`
  + `msm:certificates` + `msm:compressor` (up to 3 BA compressors, each a running-time +
  maintenance log; `types/compressor.ts` `normalizeCompressorState` migrates the old single-log shape)
- Backup: `services/backup.ts` — full self-contained `.msm` snapshot (JSON: all categories +
  vessel + certificates + compressor, with attachment/cert binaries embedded as base64). Export/
  restore from Settings → Data. Restore re-creates files in `attachments/` and relinks every uri.
  Backup file name: `MSM_backup_DDMMYY.msm` (`fileDateStamp()` in utils/dates).
- ZIP export: `export.ts` `exportZip` (Reports tab) — bundles the PDF register of the selected
  categories + every attached photo/document (jszip, base64 round-trip) into `MSM_backup_DDMMYY.zip`.
- Import/Export: SheetJS (`xlsx`), `expo-document-picker`, `expo-print`, `expo-sharing`,
  `expo-file-system/legacy` (base64 read/write)
- **QR labels + scanning** (`services/qrLabel.ts`, `services/barcode.ts`): every item is labelable
  from the moment it exists, because the payload is its own `id` — `msm://item/<id>` (a private
  scheme matching app.json's, not an https URL). A reprint is therefore never a new code and can't
  fork one item into two. The sticker deliberately does NOT encode the category: ItemDetail needs
  `{category, id}`, and the category is recovered from the register (`flat`) at scan time, so a
  re-categorised item's printed label can't point at the wrong screen. Two thermal stocks
  (100×50 / 50×30 mm), one label per page, `@page`-sized. `qrcode` (pure JS) builds the matrix →
  inline SVG string for print, and the same encoder at the same ECL (Q) backs the on-screen preview
  via `react-native-qrcode-svg` — deliberately, so what is approved is what prints. **The printed QR
  does not depend on react-native-svg** (which is a Windows mock). Scanning: `expo-camera`
  BarcodeScanning, lookup order `msm://` id → `serial` (there is no factory-barcode field on
  EquipmentItem, so no third route is pretended).
- **Inspections (the audit trail)** (`types/inspection.ts`, `constants/checklists.ts`,
  `services/inspections.ts`, key `msm:inspections`): a signed record of one crew member working
  one checklist against one item — exact timestamp (`at`), signature snapshot (`by`/`byRank`,
  plus a `byId` that is allowed to dangle), per-line `pass|fail|na`, frozen `outcome`, comment,
  evidence photos, and an optional `defect`. **Records are append-only and never edited** — a
  correction is a new inspection. Two consequences the code depends on: (a) a signed statement
  that could be quietly rewritten is worthless at an audit, and (b) merging two devices is a set
  union (`mergeInspections`, ordered by `updatedAt` only to settle a defect close), which is why
  several officers can work a round on separate phones and lose nothing. The ONE mutation allowed
  is a defect going open→closed, itself stamped and signed. `roundStatus` is calendar-window based
  (`monthWindow`/`weekWindow`), not "within 30 days": a monthly check is a calendar obligation.
- **The schedule is per category** (`ChecklistTemplate.off` / `standard`, `roundsFor` in
  `constants/checklists.ts`, 25 Sep 2026): a vessel says which frequencies a category owes —
  **weekly / monthly / quarterly**, each a switch on its row in Settings → Checklists. A category
  used to owe every round the app shipped a checklist for, so a ship that checks hydrants weekly and
  escapes quarterly read as permanently behind. Off = not offered on the item, and not COUNTED as
  due by the report; records already signed keep their period and still print. Both flags are
  **tombstone rows, never deletions**: templates merge by union of ids and nothing deletes the
  vessel's copy in Firestore, so a deleted row came back on the next pull (which is also why
  "use the standard checklist again" used to last a minute — `standard: true` fixes it). `off` and
  `standard` are separate because they are independent: word a round, stop it for a season, get your
  own words back. Quarters are CALENDAR quarters (`quarterWindow`, `stepPeriod`), for the same
  reason months are; annual is deliberately not offered (a shore service with a certificate).
- **Scan before signing** (`services/signingPolicy.ts`, Sep 2026): a vessel rule (`signingPolicy`
  field on the vessel document, Master-only in firestore.rules, mirrored to `msm:signing_policy`)
  that Crew/Officers may sign only after scanning the item. Proof is IN MEMORY per item, 30 min,
  recorded only by the in-app camera (`ScanSc`, not the typed code) or the `msm://item` deep link;
  never route params (a web URL could carry them) or storage. Rank is the DEVICE's token role,
  never the picked signer name. A Master (or a device on no vessel) may override with a reason.
  The record carries `verification` {method, scannedAt, reason}; the report prints a Scan column
  and the override reason in Comments. Enforced in the app, not in the inspection rules — older
  app versions do not know the rule, so the report column is what makes a gap visible.
  **Per category** (`scanExempt`, 25 Sep 2026, Settings → Scan by category → `ScanRulesSc`):
  an inventory — a rescue boat's gear, the loose kit in a fire locker — is checked off item by item
  and nobody labels every bailer, so those categories are named as exceptions and signed from the
  list. Stored as the EXEMPT list so a category added later is covered by default; `signingGate`
  takes the item's category and `scanRequiredFor(policy)` with none answers for the vessel.
  `services/policy.ts` `writeSigningPolicy` is the ONE path that stores the rule and pushes it.
  **`signAsDevice`** (19 Sep 2026) is the second half of the same policy: an enrolled device signs
  as its own account (`SyncContext.me`, watched live from the vessel's device list) and the picker
  is gone — `signerRule` in signingPolicy.ts, pure, checked in `check:inspections`. A device on no
  vessel still picks; an account not yet loaded HOLDS the signature rather than falling back.
- **Check groups** (2 Nov 2026, Jez — `services/checkGroups.ts`, `screens/GroupCheckSc.tsx` route `GroupCheck`,
  `npm run check:groups`): `EquipmentItem.checkGroup` (free text, matched case/space-blind WITHIN a category — the
  checklist is the category's). Set from the category list's multi-select ("Group") or the item form; chips above the
  list and a card on the round open the group check. ONE signature writes ONE RECORD PER ITEM (same answers, signer,
  `at`; `verification` {method `group`, group, groupId, groupSize, scannedAt | reason}) — so rounds, due marks and the
  report need no change; report Scan cell "Group QR" / "Group, no scan". PASS/N/A only: a bad unit is UNTICKED and
  inspected on its own, where its defect is raised. **Presence is still proven**: where the vessel requires a scan, the
  group's own label `msm://group/<encoded id>` (printed from the screen — `LabelText.qr`; ScanSc and the phone-camera
  deep link record the proof under `group:<id>`) is scanned once; without it only the Master signs, with a reason
  (`signingGate`, unchanged). The person who looked signs — never the officer told about it. Renaming a group changes
  its id, so its label must be reprinted (the scanner says so).
- **Equipment replaced** (3 Nov 2026, Sven — "the auditor will check records of replaced items, defects found on the rounds"):
  pure `services/replacements.ts`, `screens/ReplaceItemSc.tsx` (route `ReplaceItem` `replaced/:id`, from the item's Lifecycle card
  "Replaced…"; officers/Master — rules `item_movements` isAdmin, no new collection). A replacement is an `ItemMovement` with
  `dir: 'replaced'`: whole unit or `part`, reason, date, `before`/`after` (only changed fields of make/type/serial/made/
  next inspection/expiry), signed; the same signature writes `after` onto the item (same id — the label stays) and may close
  the item's open defect (`defectInspId`, closedNote = what was replaced). A whole unit needs at least one new detail.
  ItemDetail now adopts the stored item whenever it changes and nothing is typed (a stale draft saved later would undo the
  replacement); Replaced… asks to save first when the draft is touched. Inspection report (period and round): two more
  sections from `reportData.auditSections` — **Defects put right in this period** (defect.closedAt in the window) and
  **Equipment replaced in this period** (only when `opts.movements` is passed: ReportsSc, RoundSc). Old apps show the raw
  dir "replaced" in the lifecycle. `npm run check:replacements`.
- **Record books: the Master's verification and the true copy** (25 Oct 2026, for flag approval
  under MEPC.312(74) — `services/verification.ts`, `components/Verification.tsx`,
  `services/trueCopy.ts` + `utils/trueCopyPdf.ts`, `npm run check:verification`). ORB, Garbage,
  Sewage and Ballast: a Master's signature lists the entry VERSIONS it verified (`covers`), so an
  amendment (a new id, services/versions) is "awaiting re-verification" until signed again; a
  pre-2.68 signature without `covers` counts for every version of its month written before it.
  The month's first signature keeps the id `<book>_<yyyy-mm>` so 2.67 still sees the month signed.
  The PDF is drawn with jsPDF on every platform (it has to number its pages) — earlier versions
  struck under their replacement, signer ID and UTC times, and on each page print time, software
  version, "Page n of N" and a true-copy line; phones fall back to the old HTML page if jsPDF fails.
  Plan and requirement-by-requirement gaps: `/Users/Oxford/MarineSafetyManager/research/flag-erb-recognition.md`.
- **Fuel oil changeover and ODS record books** (26 Oct 2026, stage 4 — flags `fuelChange`, `ods`, on from 2.69):
  two more specs in `services/logbooks.ts` on the shared `LogBookSc` (routes `FuelChangeover`, `Ods`),
  so they inherit verification, seals, true copy, signed copy and the access log. Changeover (Annex VI
  reg. 14.6): IN / ENTER / EXIT / OUT per ECA (`method` = the ECA) + EU berth BERTH / DEPART; > 0.10 % S
  signs only with a reason in the remarks. ODS (reg. 12.6): by MASS in kg (`mass`, not `quantity`).
  Firestore `fuel_changeover(_signs)`, `ods(_signs)` — need `npm run deploy:rules`. `npm run check:logbooks`.
- **Finance: APA and budget** (27 Oct 2026 — flag `finance`, on from 2.69): `screens/FinanceSc` (route `Finance`),
  `types/finance.ts`, pure maths in `services/finance.ts`, PDF/Excel in `services/financeReport.ts`. A fund
  (owner's account / charter APA) has its currency; entries are APPEND-ONLY — a mistake is a reversing
  entry (`reverses`), both stay on the statement. Budget per cost centre per year: spent = APA payments +
  received PO lines, committed = rest of sent/partial POs; a PO named by an APA payment (`poId`) counts
  once; amounts in another currency are skipped and counted, never converted by guess. PO line currency
  is a symbol (€ $ £ ¥) → `isoCurrency()`. Officers + Master only (`officers: true`, rules `isAdmin`),
  shore reads. Firestore `apa_funds`, `apa_entries`, `budget` — need `npm run deploy:rules`. `npm run check:finance`.
- **Suppliers and quotations** (27 Oct 2026 — flag `suppliers`, on from 2.69): directory `types/suppliers.ts`
  (`screens/SuppliersSc`, `SupplierSc`; Firestore `suppliers`, officers write, never deleted — `deleted`),
  and on a PO (`components/RfqPanel` in OrderSc, `screens/QuoteSc`) `quotes` / `quoteBy` / `award` ON THE
  ORDER — no new collection, the PO's sync/rules/backup carry them. Pure maths `services/rfq.ts`: total =
  Σ price × qty − discount + delivery; ranked only within the currency most quotes came in (never
  converted); cheapest = lowest COMPLETE quote; any other award needs a reason; awarding writes supplier,
  ref and prices onto the lines (ISO → symbol for € $ £ ¥). Papers `services/rfqSheet.ts` (English): RFQ
  PDF/Excel per supplier — the Excel's `Line ID` column is how a filled sheet is read back
  (`quoteFromSheet`) — and the comparison PDF/Excel. jsPDF on web sizes a table to the widths GIVEN, so
  give every column one; its font has no ★ or − (use * and -). Supplier record (quotes won, reply days,
  on time, one delivery, last prices) is computed from the orders (`supplierStats`), not stored.
  Needs `npm run deploy:rules` before the flag. `npm run check:rfq`.
- **Quotes by link** (8 Nov 2026 — flag `quoteLink`, plan item 48): `functions/quoteLink.js` (callables `quoteLinkSend` /
  `quoteLinkExtend` / `quoteLinkRevoke`, public `supplierQuote`), page `MSM Win Web/public/quote.html` + `quote.js` behind
  `/quote/**` (firebase.json rewrite, both sites), client `services/quoteLink.ts`, buttons in RfqPanel (enrolled officer).
  Token 128 bits, shown once in the URL/mail; only its SHA-256 is kept: `quote_links/{hash}` → vessel, order, quote,
  expiry, and `safety_vessels/{v}/quote_links/{quoteId}` → which hash (Admin SDK only, rules deny). 7 days, extendable; a
  new link drops the old; deleting the quote revokes. The page shows vessel, PO, port, dates, lines, and maker/model/serial
  of the machines a spare fits — never who raised it or line notes. The answer is written INTO the order in the cloud in a
  transaction (`withAnswer`): prices per OUR unit (their unit/price/part type/lead/part no. in `Quote.lineInfo`), `charges`
  (counted in `quoteTotal`), `file` (Storage `attachments/{quoteId}/supplier-…`, download-token URL), `link.answeredAt`.
  Closed when expired, awarded, not draft/standby, or the quote removed (410). 20 answers an hour per link
  (`quote_guard/{hash}`). **Sync**: purchase_orders pull through `rfq.ts foldOrder` (`fromCloud`) — an older local copy
  keeps its edit but takes the newer answer and comes back 1 ms newer so it goes up; `pushOrderNow` folds before writing
  the order the callable needs. Mail: same SMTP secrets as the digest. `npm run check:quotelink`; tested end to end in the
  emulators (JDK 21: `JAVA_HOME=/opt/homebrew/opt/openjdk@21`, dummy `functions/.secret.local` — delete after).
  Not yet: "return for rework" and the supplier confirming the PO on the same link.
- **Oil analysis** (27 Oct 2026 — flag `oil`, on from 2.69): `screens/OilSc` (route `OilAnalysis`, also linked from
  Maintenance), `OilPointSc`, `OilSampleSc`; `types/oil.ts`, pure `services/oil.ts`, reports `services/oilReport.ts`.
  A point sits on a PMS machine (running hours), with oil, lab, interval (days and/or hours, whichever first),
  new-oil V40/V100/TBN/TAN and own limits over the compartment's `GUIDE`. A sample goes taken → sent → result
  (typed, or the lab's Excel/CSV via `readLabSheet` — header row found by ≥3 parameter names, water in ppm → %,
  row matched by bottle no., then date, else the user picks) → an officer's signed review, after which it is
  frozen (rules). Verdict = worst of each value vs its limit, "rising" (up ×1.5 and past half the caution limit,
  only while below the limit) and the lab's own verdict. Firestore `oil_points` (officers), `oil_samples`
  (members until reviewed) — need `npm run deploy:rules`. `npm run check:oil`.
- **Yard periods and warranty** (27 Oct 2026 — flag `yard`, on from 2.69): built ON the PMS project (`PmsProject` gains kind,
  yard, place, endDate, startedOn/finishedOn, currency, budget — same `pms_projects`, rules `plans`), not a second project
  type. `screens/YardSc` (route `Yard`, also linked from Maintenance; PmsProjectsSc opens `YardProject` when the flag is on),
  `YardProjectSc`, `YardJobSc`, `WarrantyClaimSc`; `types/yard.ts`, pure `services/yard.ts`, papers `services/yardReport.ts`.
  A work-list job (`yard_jobs`) goes planned → started → done → accepted (signed; may close its PMS defect with the same
  signature); after acceptance only `final` / `invoice` change (rules `onlyChanges`); cancelled, never deleted; numbers never
  re-used. Open defects and deferred PMS jobs become jobs in one step (deterministic ids, so two devices do not double them).
  Specification Excel has `Job ID` + `Yard price` / `Yard remarks`; `readSpecPrices` reads the yard's filled sheet (European
  and English number formats); `specRows` lives in the pure file so the round trip is checked. Warranty = accepted job's
  `warrantyMonths` (`addMonths` clamps to month end) or a claim's own `coverUntil`; amber 60 days before. Claims
  (`warranty_claims`, officers, frozen once closed) draft → submitted → answered → closed (signed), `WC-<year>-<nnn>`.
  Needs `npm run deploy:rules` before the flag. `npm run check:yard`.
- **Vessel API** (28 Oct 2026 — flag `api`): `functions/api.js` (HTTP `api` + callables `apiKeyCreate` / `apiKeyRevoke`),
  shared reading in `functions/vesselData.js`, Master's screen `screens/ApiKeysSc` (Settings → API access), docs on the site
  (`/Users/Oxford/MarineSafetyManager/site/api.html` → ismpilot.com/api). Bearer key `ismp_…`, shown once; only its SHA-256 is
  kept (`api_keys/{hash}` → vessel + keyId, Admin SDK only; `safety_vessels/{v}/api_keys`, `api_log` — Master reads, nobody
  writes). Reads: vessel, due, equipment, certificates (never crew), surveys, defects, machines — no crew names. Writes: running
  hours only, through COPIES of checkReading / withReading / followerReadings / surveyStatus — **change them in both places**;
  `npm run check:api` compares the copies with the app's functions. 60 requests a minute per key. Support key:
  `cd functions && npm run apikey -- <IMO> "label" [--write]`. **The register field is an OBJECT** (`{categories, certificates…}`)
  — read it with `vesselData.readRegister`; inspectView and icsCalendar iterated it as an array and threw until this.
  Not in the API yet: PMS jobs due and drills (their due logic is the app's TS — bundle it rather than re-write it).
- **Verified by the office** (28 Oct 2026 — flag `officeCheck`, plan item 31 from JiBe): pure `services/officeCheck.ts`.
  A machinery defect (`PmsDefect`) gains `responsible`, `awaitingSpares` (officers, while open), `office` and `closedBefore`.
  The superintendent answers in Fleet (FleetVesselSc tab "To verify", `shore.saveOfficeCheck`): Verify, or Return with a reason —
  `closed` moves to `closedBefore`, the defect is open again aboard ("Returned by the office", amber Board notice to officers).
  A verified defect is final. A closed NC can be verified once (never returned — a closed NC stays final). Safety/class defects
  close only with a repair photo. "Closures awaiting the office" (blue, Master) appears only once the office has answered
  anything on that vessel (`officeInLoop`) — no per-vessel switch. Open defects ranked criticality × age (`rankDefects`) on
  Maintenance and the Board. Rules: `pms_defects`, `ncs` (rules-test.mjs covers both) — `npm run deploy:rules` before the flag.
  `npm run check:officecheck`.
  **Deferral through the office** (plan item 32, same flag and tab): a `PmsDeferral` signed by the Master holds AT ONCE (the vessel
  cannot wait for office hours); the office sets `office` once — approved, or refused with a reason (rules: shore, only
  `office`+`updatedAt`, refusal needs a note ≥ 3). `activeDeferral` skips a refused one, so the job is due on its own dates again;
  `refusedDeferral` = latest of the cycle refused → amber Board notice to the Master. Re-deferring is a new record. Only deferrals
  of the job's CURRENT cycle wait for an answer (`deferralsToAnswer`). Rules `pms_deferrals` need `npm run deploy:rules`.
- **External inspections** (29 Oct 2026 — flag `extInsp`, off; plan item 33): `types/extInspection.ts`, pure
  `services/extInspections.ts`, papers `services/extInspectionReport.ts`, screens `ExtInspectionsSc` / `ExtInspectionSc`
  (routes `ExtInspections`, `ExtInspection`; entry: Safety → Non-conformities). The record is the VISIT (PSC, flag, class,
  superintendent, vetting, external ISM/MLC; date, port, authority, report no., detained / `releasedOn`), signed by whoever
  records it, `EI-<year>-nn`, never deleted. **Findings are not stored on it**: each is an NC with `inspId` (+ `pscCode`,
  `pscAction`) made by `findingsToNcs` — one correction action, owner and date; PSC action code sets the date (17/30 the day,
  16 +14 d, 18 +3 months), 30 → major, 10 → the correction already done. The visit's state is derived (`inspStatus`:
  clean / open / overdue / closed / verified). Board: a detention not lifted is the FIRST red notice for the Master; an
  overdue finding names its inspection. Fleet: tab on the vessel + pills (detained, findings open, last PSC) from
  `extSummary`. Rules `ext_inspections` (officers; `no`/`by`/`at` fixed) — `npm run deploy:rules` before the flag.
  `npm run check:extinsp`.
- **Critical equipment** (29 Oct 2026 — flag `critEq`, off; plan item 34): pure `services/critEq.ts`, trigger
  `functions/critAlert.js`. **Downtime lives on the defect** (`PmsDefect.outOfService` {from, to, by, backBy…}): no
  out-of-service without a reason; a machine's downtime is read from its defects. Set when raising (anyone) or later by an
  officer (rules `pms_defects`: `outOfService` joins the officers' open-defect fields); "back in service" signed by an officer;
  closing the defect ends it the same day (`closeOut`); a job signed out with condition Out of service + Found a defect does it
  too. Board: critical machine out = red per machine, others one amber line, defects on critical machines red (safety ones are
  already there). Fleet: pill on the card + tab "Critical equipment" (on for the build or `modules.critEq`). Papers: machine
  history/survey pack — "OUT OF SERVICE since" fact and a Downtime table; monthly PMS report — "Out of service this month"
  (only when `pmsMonth` gets the defects, i.e. flag on). **Mail**: `critAlert` (onDocumentWritten pms_defects, us-central1)
  mails the monthly report's recipients (`emailReport.recipients`, whether or not the digest is enabled) when an alert-worthy
  defect appears (critical machine or safety-critical — `alertWorthy`, COPIED in the function: `check:criteq` compares),
  goes out of service, or comes back; once per event (`crit_alerts/{v}_{id}_{event}` marker); rank, never the name. Until
  `CRIT_EQ_RELEASED` in critAlert.js is flipped it mails only vessels with `modules.critEq` — flip it with the build flag.
  Needs `npm run deploy:rules` + the `critAlert` function before the flag. `npm run check:criteq`.
  Manual: `MODULE_PARTS` `drop` takes a NEGATIVE index (from the end) — pt/no sections are shorter than en.
- **Requisitions through the office** (31 Oct 2026 — flag `poApproval`, off; plan item 35): pure `services/poApproval.ts`,
  `components/PoApprovalPanel.tsx` (on OrderSc; `PoProgress` also in Fleet). The office decides on NEED, not price — there is
  no amount ladder. The way is append-only STEPS on the order (`PurchaseOrder.approval: PoStep[]`); the stage is READ from them
  and `status` is untouched (2.69 still reads the order). Officer `submit` → Master `master` (sends to the office; a Master
  raising it sends it straight on) or `masterReturn` (reason) → office `review` (written when a shore user opens it in Fleet —
  "Under review" for the vessel), `approve` (lines reduced or struck, each with a reason: `qty` changed, `OrderLine.cut`
  {asked, note, by}, the step's `cuts`), `return` (reason; a return starts a new round), `reject` (reason), `ordered` (the office
  placed it: status → sent). Only an approved order may go to `sent` (OrderSc `mayOrder`; rules `poSendOk`). `emergency`: the
  Master sends an emergency-urgency order at once with a reason; the office approves/rejects afterwards (`emergencyOpen`), its
  lines no longer cut. Progress Sent to the office → Under review → Approved → In work (status sent) → Delivered (`progress`).
  Struck lines (`liveLines`) are left out of quotations and the PO PDF table; the PDF prints an Approvals table. Fleet: tab
  "Requisitions" (queue, approved not placed, in work), `PoSheet`; card pill from `poSummary`. Board: Master — waiting for you,
  sent without the office, emergency rejected; officers — returned, approved (with cuts), rejected (2 weeks). Rules
  `purchase_orders`: one step per write, whose step decides who (`poStepAdded`, list compared with `hasAll` — rules have no
  list slices), reason ≥ 3 for masterReturn/emergency/return/reject; shore may change only approval/lines/status/sentAt/sentBy
  and status → sent only with `ordered`. `check:poapproval` compares the step names and the reason list with the rules.
  Per vessel ON REQUEST (`npm run modules -- <IMO> on poApproval`) — a vessel without an office does not get it.
  `npm run deploy:rules` before switching it on.
- **Plan wizard** (2 Nov 2026, no flag — part of `pms`): pure `services/pmsWizard.ts`, `screens/PmsWizardSc.tsx` (route
  `PmsWizard`, Maintenance → Plan, and the big button on an empty plan; Master / superintendent, `plansPms`). Kind of vessel
  (`KIND_SYSTEMS`: which catalogue systems are asked and default counts; the rest under More systems) → count per system →
  each unit (`unitNames`: PS/SB/CL, No.n, bow/stern; `resize` keeps what was typed) with maker/model/serial/hours now →
  jobs per SYSTEM (untick, interval for all its units; typed back to the catalogue figure is no change and keeps
  `TYPICAL_NOTE`) → summary → `savePlan`. ADDS ONLY: a unit whose name (case/space-blind) is on the plan, not scrapped,
  is skipped — so it can be re-run. Jobs get no last-done date. Maker/model on the machine are what a maker library will
  match later. `npm run check:pmswizard`.
- **Makers' library** (8 Nov 2026 — plan item 54, no flag: part of `ai` + `pms`): `functions/makerLibrary.js`, pure `services/makerLibrary.ts`,
  `libraryLookup` in `services/ai.ts`. Filled ONLY by AI-3 manual reads: after task `manual`, when the machine has maker + model and the reply
  says `covers: 'yes'`, `remember` keeps the jobs (title, hours, days, type, parts, page) under `maker_library/{libraryKey}` (Admin SDK only, no
  rules — no client reads it); a fuller read (more jobs with an interval) replaces a poorer one; vessels counted by a hash, never returned.
  `libraryKey`: maker folded (accents, Inc/GmbH…, trailing Marine/Engines/Power…, aliases Caterpillar→cat, MTU Friedrichshafen→mtu, Volvo→volvopenta)
  + model alphanumerics; another model is another key (C32 ≠ C32 ACERT). Read through task `library` of the `ai` callable (no model call, 300/day,
  ≤ 40 units, exact keys — it cannot be listed). Wizard: step 3 → 4 asks once; a unit of a known model takes `libraryJobs` instead of the typical
  list unless the card is unticked (`WizardAnswers.makers`); no-interval and under-a-week calendar checks are left out and counted. Machine
  screen (`ManualAiPanel`): Compare with the library feeds `asManualReply` to `readManual` with `untickNew` (titles only — a job worded otherwise
  must not be added twice). Poisoning risk accepted: everything stays a proposal with "check against the manual aboard". Needs deploy of `ai`.
  `npm run check:makerlib`.
- **Crane operator's log** (13 Nov 2026 — flag `craneLog`, off; needs `lifting`): `types/craneLog.ts`, pure `services/craneLog.ts`,
  paper `services/craneReport.ts` (PMS-history PDF), `screens/CraneLogSc.tsx` (route `CraneLog` `crane-log`; button on the Cranes register).
  One entry = one operator × one crane × one day: hours (half hours, ≤ 24), lifts (optional — totals then read "22+"), kinds of work
  (`CRANE_OPS`, **permanent ids**), heaviest lift, note; signed by the officer who confirms it. The crane's make/type/SWL are COPIED onto the
  entry (`craneSnap`) so the statement survives a rename or replacement. `crane_log` is APPEND-ONLY (rules: officers create, hours > 0
  and ≤ 24, nothing changes); a mistake is a new signed entry with `voids` — `standing()` drops both. Operators tab: per crane hours,
  lifts, days, work, dates (`operatorTotals`); Experience statement PDF (English): cranes table, Master's signature/stamp line, every
  entry with who confirmed it; the text names the days actually worked. Synced, in .msm, erased with the device. `npm run check:cranelog`;
  rules-test.mjs covers it. `npm run deploy:rules` before the flag.
  **Load tests** (same flag, `components/CraneTestsPanel.tsx`, tab Tests): `crane_tests` APPEND-ONLY, officers (`CRANE_TEST_KINDS` —
  **permanent ids**; result pass/fail). `applyTest`: a pass writes `testCertNo` and moves `nextInspection` — a due on or before the test
  takes the new due, a later due is NEVER pushed further (a five-yearly does not excuse the annual); a fail changes nothing (red via
  `testsDue` until passed). A test with the operator named goes on their statement ("Load tests operated") and lists them in Operators.
- **PSC walk-round** (13 Nov 2026 — plan item 46, no flag: part of `readiness`): pure `services/pscWalk.ts` (checks + figures),
  `services/pscWalkReport.ts` (marks + PDF), `screens/PscWalkSc.tsx` (route `PscWalk` `psc-walk`; link on Readiness when PSC is picked).
  31 checks by place (fire, LSA, deck, bridge, engine, accommodation/MLC, papers), each with its regulation, the figure that put it on the
  list and a link to where the app keeps the proof (only when its module is on). **Check ids are permanent** — they key the marks. Figures
  (`PSC_STATS`) come ONLY from the MOUs' own annual reports — Tokyo MOU 2025 (Table 7 / Fig. 7–8) and Paris MoU 2025 (year report page);
  USCG left out (its site refuses automated reading). When a new report is out, replace the year's block, never mix years.
  Marks are a device draft (`msm:psc_walk`, in the reset list), never synced; PDF puts "To put right" first, prints blank to tick by hand.
  Checks and figures stay English; the chrome is translated. `npm run check:pscwalk`.
- **DP drills** (13 Nov 2026, no new flag: part of `drills` + `dp`): the standard topics are IMCA's DP drill scenarios (DP Event Bulletins,
  M273 App. A) — nine `DRILL_TYPES` with `dp: true` (dpUps, dpAutoManual, dpDriftOff, dpBlackout, dpRefLoss, dpRedGroup, dpCooling, dpDriveOff,
  dpThrustFull — **ids permanent**), offered only with `dp` on, NOT required (join the schedule once held/planned). Interval = `Drill.everyDays` on the
  latest drill of the type (company DPOM), else the default. Theory in `constants/dpDrillTheory.ts` (`theoryOf` — drillTheory.ts is regenerated from
  Drill Trainer, never put DP there), scenario bones `DP_SCENARIOS` (our wording). `Drill.mode` live/desktop/touch (desktop default — the company counts
  it), `asog`, `postponed[]` (Master, reason ≥ 3; the plan stays amber, printed). "On DP operations" = last DP status `on` (`onDpOps`, events from DP log +
  deck log): Board shows an overdue DP drill amber, not red; set-up / off DP is the window — the DP log page lists `dpDrillsDue` (live offered at set-up,
  desktop off DP). Signing a DP drill appends a DP log line. Attended DP drills (by name on the list) count in the appraisal's DP facts. `npm run check:drills`.
- **Needs attention in Fleet** (2 Nov 2026 — plan items 37 + 45, no flag: part of `fleet`): pure `services/officeInbox.ts`,
  FleetSc opens on it (tabs Needs attention / Vessels). **Waiting for your answer** = every record waiting for the office
  across the fleet (`inboxOf`: deferrals to answer, closures and NCs to verify, `officeQueue` requisitions) — emergencies
  first, then oldest; a row navigates `FleetVessel {imo, tab, open: <record id>}` and FleetVesselSc opens that record's
  sheet once (`opened` ref) — so phone and laptop answer through the same sheets. **Red today** (`redOf`/`fleetRed`): only
  red — detention, critical machine out, critical defects, overdue findings, PMS overdue (deferral counted), expired
  certificates/equipment; amber stays on the vessel cards. Each part shows only when its module is on for the build or
  the vessel (`officeParts`). Nothing stored; FleetSc re-reads on focus, so an answer leaves the list. FleetVesselSc gained
  a read-only PMS tab (overdue + due). `npm run check:inbox`.
- **Management of change** (3 Nov 2026 — flag `moc`, off; plan item 38): `types/moc.ts`, pure `services/moc.ts`, screens
  `MocsSc` / `MocSc` (routes `Mocs` `changes`, `Moc` `change/:id`; entry: Safety → Non-conformities). The record is the CHANGE
  (procedure / equipment / crew / organisation / other; what, why, `until` = temporary, ISM `docs` with the revision each was at,
  `needsOffice`), `MOC-<year>-nn`, never deleted. The way is append-only `steps` as a requisition's — stage READ from them
  (`mocStage`): officer `submit` → Master `master` (approve; the Master raising it approves straight from draft) / `masterReturn` /
  `reject` → office `office` / `officeReturn` / `reject` (only when `needsOffice`) → actions signed done → Master `close`
  (signed, the note = whether it worked); `cancel` before approval. Approval needs what, why, an action and — with `ptw` on — an
  APPROVED risk assessment made for it (`RiskAssessment.mocId`, RiskSc takes `mocId`), frozen onto the record (`ra`, `raSnapshot`
  from jobGate) by the approving write. Content is fixed once approved (`mocEditable`), only actions move. Closing with a named
  document not re-issued asks first (`docsNotRevised`). Board: to approve / ready to close (Master), returned (officers), action
  overdue red, temporary past `until` red for the Master. Fleet: tab "Changes (MOC)" + `MocSheet`, inbox kind `moc`
  (`officeParts.moc`). Rules `mocs`: one step per write, whose step decides who, the step must follow the one before
  (`mocOrderOk`), reason ≥ 3, `needsOffice` fixed after approval, final after reject/cancel/close; `check:moc` compares the step
  lists with the rules, rules-test.mjs covers the way. `npm run deploy:rules` before the flag. `npm run check:moc`.
- **Crew appraisals** (3 Nov 2026 — flag `appraisals`, off; plan item 40; needs `crewCerts`): `types/appraisal.ts`, pure
  `services/appraisals.ts`, paper `services/appraisalReport.ts` (the PMS-history PDF; drawn signatures printed as drawings),
  screens `AppraisalsSc` / `AppraisalSc` (routes `Appraisals` `appraisals` (+`crewId`), `Appraisal` `appraisal/:id` (`new` +
  `crewId`, `reason`); entry: Crew → Appraisals and the crew card's Appraisals section). **Officers and the Master only**:
  synced `officers: true` (crew phones never get them), rules `crew_appraisals` isAdmin write, isAdmin + shore read. Due
  (`appraisalDue`): `CrewMember.contractEnd` (new field, on the card when the flag is on; cleared on signing on again) 30 days
  ahead, cleared by an end-of-contract appraisal whose `to` is in this trip; else annual — a year after the last appraisal's
  `to`, or signing on, or `addedAt`; when the contract ends within 30 days after the year is up only the contract one is asked.
  Not the Master (`isMasterRank` — the office appraises the Master); a draft does not count, a cancelled one never.
  Criteria `CRITERIA` — **ids permanent**; `leadership` only for `isOfficerRank`. Way = append-only `steps`, stage read from
  them: `appraiser` (content fixed from here; `asMaster` only from a Master device) → `crew` (the person, on the same device,
  own PIN or by hand, `agree` + comment) or `refused` (reason) → `master` countersign (only the Master; on a device on no vessel
  the picked signer must have a Master rank) — none after the Master's own appraisal; `cancel` (reason) before the person signs.
  Rules: one step per write once signed, nothing else changes; an unchanged copy (only `updatedAt`) always passes. Board:
  officers — who is due (red when past), Master — to countersign. `npm run check:appraisals`; rules-test.mjs covers the way.
  `npm run deploy:rules` before the flag.
  **Company form** (13 Nov 2026, `screens/ApFormSc.tsx` route `ApForm` `appraisal-form`, link on AppraisalsSc): `ap_form/form` (Master or shore write;
  scale 2–10 words, lowest first; items = `section` / criterion / `text` question, `officers` flag). Editor wording parsed by `formFromText`
  ("Scale: a | b", "## Section", criterion, "X *officers", "@text Q"; a line keeping its text keeps its id); "Start from the standard form";
  AI task `apform` (functions/ai.js, 20/day) reads the blank paper form → `apFormFromReply` → the editor, checked before saving. A NEW
  appraisal takes a COPY (`CrewAppraisal.form`, `activeForm`), answers to questions in `answers`; no `form` = `STANDARD_FORM` (the nine
  criteria, 1–5) — old records read as before. `itemsFor` drops officers-only lines for a rating and empty headings; scores above the scale are
  refused; PDF prints a table per section on the company scale + Questions. Needs `npm run deploy:rules` and functions `ai`.
  **Criteria by position** (13 Nov 2026, no new flag): `roleFacts` — crane when the person has standing `crane_log` entries or a load test in
  the period (or rank /crane/), DP when they have DP time in it (or rank SDPO/JDPO/DPO); only with `craneLog` / `dp` on. Each role adds a section
  of 3 criteria (`ROLE_CRITERIA`, **ids permanent**; translated on screens even on a company form, `isRoleItem`) after the form's items, on the
  same scale, plus figures (`ApRoleFacts`: hours, days, lifts "n+", load tests, cranes with SWL; DP Active hours and DP days ≥ 2 h). Live while a
  draft, written to `CrewAppraisal.roles` on save and fixed once the appraiser signs; scores of a role no longer on it are dropped on save. PDF:
  a fact line per role + a table per role. No rules change (draft fields are free).
- **Watch plan** (3 Nov 2026 — flag `restPlan`, off; plan item 41; needs `rest`): `types/restPlan.ts`, pure `services/restPlan.ts`,
  `screens/RestPlanSc.tsx` (route `RestPlan` `watch-plan` (+`crewId`); entry: Hours of rest → "Watch plan — the next two weeks", Board).
  ONE document per person (`rest_plans/{crewId}`): standing watch `pattern` (48 wall-clock slots, from `from`) + `days` that differ
  (arrival, drill, day off). Drawn on RestDaySc in PLAN MODE (`plan: true`; `date: 'pattern'` = the standing watch) — it saves into the
  plan, never into `rest`; passing through a day saves it only when edited (else every day would get a copy of the pattern).
  `forecast` = the record where there is one, the plan where not — also for the six days BEHIND today nobody recorded, or the 7-day rule
  could not judge a week ahead — run through `analyseRest`, plus the day after the horizon so the last day's 24 h is judged. `ahead` =
  breaches on a planned day or on a day whose 24 h runs into one. `prunePlan` keeps a week behind. Board (officers, amber): whose plan
  breaks and from when (`planBreaches`). Recording a day: "As planned" fills it from the plan. Officers/Master write (rules
  `rest_plans` isAdmin, id = crewId), everyone reads. `npm run check:restplan`; rules-test.mjs covers it. `npm run deploy:rules` before the flag.
  The split rule (restHours) judges a rest period cut by the window's edge on its WHOLE length for the 6 h test (fixed 3 Nov 2026 —
  before, any single night under 12 h, e.g. work 06–19, was flagged daily); only hours inside the window count towards the 10.
- **Discussion on a record** (4 Nov 2026 — flag `threads`, off; plan item 43): `types/thread.ts`, `services/threads.ts`,
  `components/RecordThread.tsx` (`ThreadPanel` both sides, `RecordThread` aboard: PmsDefectSc, NcSc, OrderSc), Fleet: vessel
  tab `talk` + `TalkSheet` (FleetVesselSc), inbox kind `thread`. One document per message in `threads` (appendOnly; rules
  create only, `side` tied to member/shore, ≤ 2000 chars, closed field list), so the two sides never overwrite each other.
  Mention = `@Name` of someone aboard or `@Office`, parsed by `mentionsIn`. Waits for the office (`threadsToAnswer`): last
  word is the vessel's AND it called `@Office` since the office last wrote, or the office is already in the thread; a reply
  clears it, nothing stored. Board: named person's line is `first` (above red, or "Show more" hides it), the office's
  unread message goes to officers (blue). Read state is device-local (`prefs.threadRead`, `threadNotifiedAt`). The
  notification is LOCAL (BoardSc → `notifyNow`, needs reminders on and a sync): no remote push, and no mail to the office.
  Times are the sender's clock: a ship's clock running ahead can misorder a reply and leave it read. `npm run check:threads`;
  rules-test.mjs covers it. `npm run deploy:rules` before the flag.
- **Erasing a device** (4 Nov 2026; plan items 55, 64): `resetAllData` erases every storage key except `NOT_RESET` (prefs: this device, not the vessel); `npm run check:reset` fails on a key in neither. Sign off & erase also calls `fb.forgetSyncMarks()`, or a device that rejoins never pulls older records; Reset on a syncing device must not, or every list comes straight back.
- **Deck log, GMDSS, order groups, galley orders sync** (4 Nov 2026; plan item 64; lived on one device, without sync or .msm backup, until then): `deck_log` goes one record at a time (`toCloud` identity). Rules: a signed entry does not change; a draft does; the Master's review is added once by an officer or Master device; updatedAt alone may differ (`dl-clock-<id>` written by several devices). `gmdss` append-only. `npm run deploy:rules` BEFORE a build with this reaches anyone; until then records stay queued, nothing is lost.
- **Evidence photos stay out of a record's cloud copy** (7 Nov 2026; pure `services/inlinePhotos.ts`, `npm run check:inlinephotos`): in a browser a photo is a `data:` URI inside the record, and four of them took a defect, inspection or rope entry past Firestore's 1 MiB — the write was refused and the record stayed queued for good. Every record write (`writeInBatches`, `pushPartly`, `pushList`, `pushOneInspection`) goes through `photosToCloud`: any `photos` list, however deep, `kind: 'photo'` with a `data:` uri → `INLINE_ELSEWHERE` (documents stay); the photo queue already sends the bytes to Storage. Every read back (`pullList`, `pullInspections`, the inspections listener, `pushPartly`'s read) puts this device's own bytes back with `keepLocalPhotos`. `ensureLocalPhoto` on web returns the Storage download link (expo-file-system has no browser files), so a browser now shows a phone's photos too. The bucket has no CORS, so `fetch` of that link (archive ZIP, the photo check's earlier photo) fails in a browser until it is set; `<img>` does not need it.
- **The web stores in IndexedDB, not localStorage** (7 Nov 2026; MSM Win Web `web/shims/async-storage.js`, swapped in by its metro.config): AsyncStorage's own web build is localStorage, ~5 MB for the whole site — about 7 photos (a photo lies in its record, the photo queue and each register snapshot) and from then on every write failed, a signed record included. Every read and write goes to IndexedDB (`msm-storage` / `kv`), no cache, because two tabs are normal. Values up to 8000 chars are mirrored into localStorage for the synchronous reads before the first render (`msm:vessel_info`, `msm:vessel_modules`, the UI language); only IndexedDB is read back. The first start moves localStorage into IndexedDB and drops the large values (flag `msm-storage:moved-v1`); no IndexedDB → localStorage as before. A test seeding a browser profile writes to IndexedDB, or to localStorage only before the app's first start.
- **A daily whole-list read** (5 Nov 2026; `services/listSync.ts`, `npm run check:listsync`): `pullList` asks for `updatedAt` newer than its mark, but `updatedAt` is when a record was made, so one that reached the vessel late (made offline, a log's history sent for the first time) was never found by a device past that time. Once a day each list is read whole; merging is by id, newest wins. Costs Firestore reads, per device, per day.
- **My documents** (5 Nov 2026 — flag `myDocs`, off; plan item 47; needs `crewCerts`): pure `services/myDocs.ts`, screen `MyDocsSc` (route `MyDocs` `my-documents`; entry: menu, Board). Read only, no new data or rules. The person: `findMe`, by id or by the enrolled name against the crew list. Certificates, trip and contract, 7 days' rest, drills carried out and attended. `crew_private` is not shown: a crew device does not hold it. Board `my:cert:*` (first), `my:changed`; prefs `myDocsSeen`, `myDocsNotifiedAt`; never looked = nothing new. Own SDM file (`services/mySdm.ts`, `msm:my_sdm`): on phones only, stored on the device, never synced or in .msm; the file is SDM's whole state as plain JSON, so `toMySdm` keeps a whitelist (no biometrics, rate, photo, notes, DP days); `sdmDiffs` shows what differs from the vessel's records, nothing is written. `npm run check:mydocs`.
- **Master PIN and one-time codes** (5 Nov 2026; plan item 57): the Master PIN exists on the Master's device only; an enrolled Master must choose one (`MasterPinBanner`, `required` on `PinChange`). Elsewhere 0000 opens nothing: an own account chooses its first PIN, a shared device or a forgotten PIN takes a one-time code (`services/pinCodes.ts`, `pin_codes`: id = hash of the code, `get` without `list`, spent once, 15 min, one name). Standalone installs keep 0000 and the reminder.
- **Who is still let in** (7 Nov 2026; plan item 68): a token's claims outlive the decision — Firebase renews a session with the same claims for as long as the install keeps it. So `firestore.rules` and `storage.rules` read the token's own device record on every request (`device`/`live`: approved, not switched off; retired duplicates still pass), and Officer/Master take the LOWER of token and record (demotion at once, promotion with the next token). Shore tokens: the vessel's `devices/<deviceId>` must be a live `shore` record. Callables check the same in `functions/access.js` (`liveCaller`, `liveDevice`); `revokeOnSwitchOff` revokes a crew device's sessions when the Master switches it off or removes it. Self-approving invitations (Master, shore) are good for 48 hours from `issuedAt` (server timestamp; an older app's `createdAt`) and one device (`inviteClosed`, mirrored by `types/role inviteWindow` for Accounts). PIN guessing is also counted per vessel (`vesselGuard`, 20 in 15 min, `meta/enrolGuard`) — the per-device counter is keyed by an id the caller makes up. Storage rules use a cross-service read: the Storage service agent needs `roles/firebaserules.firestoreServiceAgent` (granted 7 Nov 2026 by gcloud — the CLI did NOT ask, and without it Storage refuses everyone). `functions/scripts/live-access-check.js` checks it all live on 1234567. `npm run check:enrolguard`; rules-test.mjs; scripts/storage-rules-test.mjs.
- **Public endpoints and the web's headers** (7 Nov 2026; plan item 61; `functions/publicLimits.js`, `npm run check:publicfns`): `submitObs`, `inspectView`, `icsCalendar`, `api` answer anyone with the link, so each runs on at most `PUBLIC_MAX_INSTANCES` (5) — check:publicfns fails on any `onRequest` without `maxInstances`. `submitObs` caps the text (topic/location 120, what 2000, name 80) and takes 30 observations an hour per vessel (`meta/obsGuard`); `inspectView` escapes the vessel name, flag and call sign (typed by any member). Link tokens are 128 random bits (`newLinkToken`, platform generator). Hosting (`firebase.json`, both sites) sends a Content-Security-Policy, nosniff, Referrer-Policy and Permissions-Policy (camera and microphone self). **The CSP refuses inline scripts**: the QR form's script is `MSM Win Web/public/obs.js`, MediaPipe's loader is a blob: module — so never deploy this firebase.json with a web-dist built before it (the QR form would stop working). A new CDN, API or iframe source must be added to the CSP, or it is blocked in the browser only. Not done: App Check (needs a store release that sends it before it can be enforced).
- **Backups and restore** (7 Nov 2026; plan item 58; `functions/RESTORE.md`): Firestore daily backup kept 5 days, delete protection on, no PITR; Storage soft delete 7 days. A backup restores only into a NEW database — restore, compare with `functions/scripts/restore-check.js <db> <snapshot time>` (read-only), copy back what was lost, delete the copy. Tried 07.11.2026: 1 282 unchanged documents identical, 0 missing.
- **Shared tablet** (5 Nov 2026): `shared` + `responsible` on the device (Master, Accounts; rules bar the device itself). It never signs as itself: `useSigner` and `signerRule` pick from `maySign` (officer rank or `crew.canSign`), the last name is not remembered. The gangway watch is `anyAboard`. Hand signature there opens only after someone with the right to sign used a PIN on that tablet, for 30 min (`handUnder`), not for them; the proof carries `under`.
- **Left for signature** (5 Nov 2026; `types/signDraft.ts`, `sign_drafts`): engine rounds, DP / bridge / engine checklists and toolbox meetings can be left unsigned for an officer's own device. Deliberately not a draft flag in the books: they are append-only and older builds would read it as signed. The signed record is made at the signature, the draft is marked `done`. Board: first lines to officers, with deck log drafts, running drills and unsigned meetings.
- **DP log** (5 Nov 2026; `dp_log`, page in `DpSc`): time, action, the DPO's initials; append-only, a correction is a new line; PDF per day (`exportDpLog`). **DP time from the records** (13 Nov 2026, `slotsFromRecords`): a watch runs from the DP handover the person signed taking over (`by2`) to the one they signed handing over (`by`) — else to/from their own last/first DP log line — plus every half-hour with their own log line; ALL Active ("while the DP log is kept there is no passive"). Ship's wall clock from each checklist's `shipOffset`. Only DP-book handovers (`isDpHandover`). **DP status** (`DP_EVENTS` setup/ready/on/off — **permanent ids**): buttons on the DP log page write a DP log line (`event`) + a deck log entry (`dpEvent`, `dl-dpe-<line id>`); a signed DP-book checklist writes `dl-dpc-<id>` (`dpCheckRef`, `dpCheckDeckEntry`) when `deckLog` is on. `offDpSpans`: off from "off" to the next setup/on; set-up counts; before the first event nothing is cut — the fill drops half-hours wholly off DP (`cut`). `npm run check:dp`.
- **Emissions** (4 Nov 2026 — flag `emissions`, off; plan item 44; needs `fuel`): `types/emissions.ts`, pure `services/emissions.ts`, paper
  `services/emissionsReport.ts` (PMS-history PDF, Excel with real numbers), screens `EmissionsSc` / `EmPassageSc` (routes `Emissions` `emissions`,
  `EmPassage` `em-passage/:id` (`new`); entry: a chip on Fuel, Board). `em_vessel/vessel` (Master: type, GT, DWT, commercial yes/no/unsure — decides
  `applicability`: DCS >= 5000 GT; CII >= 5000 GT, listed types, no yachts or offshore; MRV commercial >= 5000 GT, offshore/general cargo >= 400 GT, `unsure` = check).
  `em_passages` (versioned like bunkers: berth to berth in UTC, FAOP/EOSP, ROB both ends, typed miles; over the new year also ROB and miles at 31 Dec 24:00 UTC
  because each year reports its part). `em_statements` (append-only, officers: fuel per consumer typed in tonnes, under way or not, with the method; `frozen`
  figures; the newest of a year counts). **Distance is NOT summed from the deck log**: a noon `distanceRun` may be the total since departure. Fuel comes from
  `fuelMonth`, diesel only (a tender's petrol is excluded, HFO is not modelled). Tonnes from the BDN density, litre-weighted, else the last before the year;
  no density = no tonnes, never assumed. CF 3.206, CH4 0.00005, N2O 0.00018; G2/G3/G4 tables in `ciiLine`/`CII_Z` (no G5 corrections; no Z after 2030 = no rating).
  Everything missing comes back as `EmGap` (screen `em.gap.*`, report `EM_GAP_EN`). Board `em:stmt` for officers where DCS or MRV applies and last year has passages:
  amber to 31 March, red after. `npm run check:emissions`; rules-test.mjs covers it. `npm run deploy:rules` before the flag.
- **Chemicals and SDS** (7 Nov 2026 — flag `chem`, off; plan item 65, UniSea's "Safe Chemistry"): `types/chemicals.ts`, pure `services/chemicals.ts`,
  paper `services/chemicalsReport.ts` (PMS-history PDF + Excel with a first aid / fire / spill sheet), screen `ChemicalSc` (route `Chemical` `chemical/:id`
  (`new`)); the list is the third tab of PermitsSc (`Permits {tab: 'chem'}`). One card per product (`chemicals`, newest wins, never deleted — `deleted`):
  use, places + qty, the SDS file (`uploadInline` to `attachments/<chemId>/`; on a device on no vessel the data URI itself — the rules refuse anything
  but an https link in the cloud), and what the SDS says (signal, GHS, H lines, PPE, first aid, fire, spill, storage, incompatible, UN, `sdsDate`).
  AI task `sds` (functions/ai.js, SMART, 60/day): read right after the file is added, `readSds` keeps only the nine pictograms and a real date,
  `applySds` REPLACES every SDS field (an old sheet's advice must not survive), name/maker only when empty, use only on a new card; `byAi` until an
  officer signs `checked`; `sdsChanged` (file or any SDS field) drops the check on save. Missing (`chemIssues`): no SDS, SDS dated over 5 years,
  signal word without an APPROVED `RiskAssessment.chemId` (only with `ptw`), not checked. RiskSc takes `chemId` + `enclosed` and starts from
  `chemHazards` (per pictogram, card PPE/fire/spill/storage as controls; enclosed adds the vapour line only for a product that gives off one).
  `Permit.chemIds` — chips + PPE on PermitSc. Board (officers): amber no SDS / old SDS / no assessment, blue to check. Officers write, all read
  (rules `chemicals`, rules-test.mjs). `npm run check:chem`. `npm run deploy:rules` + functions `ai` before the flag.
- **Rope and wire log** (7 Nov 2026 — flag `wires`, off; needs `lifting`; plan item 67, UniSea's "Wire Manager"): `types/wireLog.ts`,
  pure `services/wireLog.ts` + rows `services/wireRows.ts` (pure, so check:wirelog can reach them), papers `services/wireReport.ts`
  (PMS-history PDF + Excel Ropes/Log), `components/WireLogCard.tsx` (on ItemDetail), screens `WireEntrySc` (route `WireEntry`
  `rope-entry/:itemId`), `WireLogSc` (route `WireLog` `ropes`; button on the rope categories' lists, Board). A log for items in
  `WIRE_CATEGORIES` (mooring, hooks_cables, cranes) or any LIFTING item with a diameter. `wire_log` is APPEND-ONLY, one signed entry
  each: inspect (rating, `diameterMm`, `brokenWires` wire only, findings, photos via photoQueue/EvidencePhoto like a PMS defect),
  cutSlip, endForEnd, lube, brake (`brakeOk`), renewed (officers; rules too) — the same signature writes `installedDate`, diameter,
  `ropeLength`, `testCertNo` onto the item (`renewItem`), and everything counts from there. Item gains `ropeLength`, `minLength`,
  `discardDia`, `retireYears` (form shows them under Lifting when the log applies). `wireState`: loss %, mm/year by least squares
  (the nominal on the day fitted counts as a reading; ≥ 2 points ≥ 30 days apart), discard date at that rate, length after cuts, age.
  No `discardDia` → 10 % off nominal, said as "assumed". Red: discard look, at discard diameter, below shortest length, past years, brake
  failed; amber: poor look, discard within 90 days, ¾ of the allowance gone, within 10 % of the shortest length, retiring within 90 days.
  Board (officers): `wire:red`, `wire:amber`. Diameters in inches are never converted (`diaOf`). Translation keys are `rope.*` (`wl.*`
  is the Engine room log). `npm run check:wirelog`; rules-test.mjs covers it. `npm run deploy:rules` before the flag.
- **Drug and alcohol tests** (3 Nov 2026 — flag `daTests`, off; plan item 42; needs `crewCerts`): `types/daTest.ts`, pure
  `services/daTests.ts`, paper `services/daTestReport.ts` (PMS-history PDF), screens `DaTestsSc` / `DaTestSc` (routes `DaTests`
  `da-tests`, `DaTest` `da-test/:id` (`new`); entry: Crew → Drug and alcohol tests, Board). THREE append-only records: `da_tests`
  (the session: reason unannounced/random/postIncident/cause/preJoining/followUp, alcohol/drugs, `limit` mg/l breath, breathalyser,
  kit, tester, witness, `drawn` {n, of} for a random draw, `DA-<year>-nnn`, one signature), `da_results` (one per person — a
  document of its own so the RULES can check the mask: name `^.(….)?$`, no `crewId`), `da_followups` (`lab` result of a
  non-negative screen / `action` taken on a positive or refusal; no name, no crewId), plus `da_policy/policy` (Master: months 3/6/12,
  limit — default 12 months, 0.25 mg/l = STCW A-VIII/1). **A result is health data**: `daResultToCloud` masks the name and drops
  crewId; `daResultFromCloud` restores both only on the device that recorded it — other officers and the office see "J…d". Outcome
  (`outcome`): refused → positive (the CONFIRMING reading when taken, > limit; or lab positive) → pending (non-negative, no lab) →
  negative. Board (officers' devices, no names): unannounced test due/never (random counts; amber 30 d ahead, red past), labs
  awaited (amber), positive/refused without an action (red, Master). Officers only: synced `officers: true`, rules isAdmin write,
  isAdmin + shore read. `npm run check:datests`; rules-test.mjs covers it. `npm run deploy:rules` before the flag.
- **Web PDFs from `utils/pmsHistoryPdf.web.ts`**: a table is sized to its `widths` only when EVERY column has one (the DP
  tables side by side); with some widths it takes the page and the rest share — before 29 Oct 2026 the sum of SOME widths
  was the table width, and the machine history, survey/class pack and project PDFs printed Job/Note/Defect a letter a line.
- **Record books: seals, chain, signed copy** (25 Oct 2026, stage 2 — `services/seal.ts`,
  `services/signKeys.ts`, `services/bookAccess.ts`, `services/signedCopy.ts`, `npm run check:seal`).
  Every signer has an ECDSA P-256 key per device (`@noble/curves`, pure JS; randomness from
  `expo-crypto` on phones — a NATIVE module, so `pod install` and a store build; without it no key,
  the record is simply unsealed). The PIN key is stored AES-GCM-encrypted under the stretched PIN;
  the fingerprint key (own device) and the device key (hand-drawn signatures) are kept plain in the
  Keychain/Keystore. `withSeal` (components/SignConfirm) signs `contentHash(record)` — canonical
  JSON without `updatedAt`/`signedWith`/`editedWith` — into `signedWith.seal` (an amendment's into
  `editedWith.seal`); each entry carries `prev` = hash of the book's latest version; a Master's
  verification seals `coverHashes`. Public keys go to `sign_keys` (append-only, synced), opens and
  exports to `book_access`. Changing/resetting a PIN drops the person's keys (a new one appears in the
  register). **Never add a field to a sealed record after signing** — it breaks the seal; add it
  before `withSeal`. Signed copy = ZIP (PDF + records.json + manifest sealed by the Master);
  "Check a copy" runs `checkCopy`. Rules for `sign_keys`/`book_access` need `npm run deploy:rules`.
- **Checklists** (`constants/checklists.ts`): 30 templates keyed `<category>.<period>`, weekly
  and/or monthly, plus a `genericTemplate` fallback so no category can refuse a round. **Line ids
  are permanent** — they are the keys of every stored `results` map, so re-word freely but never
  re-use an id for a different question; bump `version` when the line set changes (the record
  stores the version, and `templateById` reads old records back against the right questions).
- **Crew** (`types/crew.ts`, key `msm:crew`): who may sign. Deliberately NOT accounts or logins —
  the vessel already has one account by IMO, and per-person passwords on a shared bridge tablet at
  0300 is how a safety round stops happening. The picker is the vocabulary; the NAME is snapshotted
  onto the record so a crew member who leaves (and is deleted) doesn't blank two years of history.
  `prefs.lastCrewId` is device-local, so the bridge tablet and an engineer's phone each default well.
- **Inspection reports** (`services/inspectionReport.ts`): LSA/FFE × weekly/monthly, PDF + XLSX,
  built from one pure `buildReport` so the on-screen preview and the file can never disagree.
  `categories` narrows a report to some of the group (one round filed as its own page; the title
  and file name then say so) — the picker in ReportsSc shows per-category progress from the same
  function. Three
  sections: what was inspected, **what was not** (printed on purpose — a report that hides the gap
  reads like a clean sheet, and this is what makes it usable as a worklist mid-month), and every
  open defect carried forward. Separate from the register export in `export.ts`, which answers the
  different question "what is falling due".
- **Remote files on native** (`ensureLocalFile` in `services/attachments.ts`): a file added on
  another device is a Cloud Storage download URL, and sharing / the ZIP export accept only local
  paths — fetch into `cacheDirectory/remote/` first (named from the attachment, else Content-Type;
  objects are stored by id with no extension). The `.msm` backup still keeps such files as links.
- Attachments: `expo-image-picker` (camera/library) + `expo-document-picker` (PDF/docs),
  persisted to `documentDirectory/attachments/` via `services/attachments.ts`. Items carry
  `attachments: Attachment[]` (up to 4; long-press a thumbnail for the edit menu —
  Download/Share, Rename, Replace, Delete). **Certificates** (`types/certificate.ts`, key
  `msm:certificates`) are documents that link to many items (group certificate) — managed in the
  Certificates tab (`CertificatesSc` + `CertificateDetailSc`); item detail shows covering
  certificates (row tap = preview the file, chevron = open the cert screen) and can link an
  existing certificate via "＋ Link" (writes to the cert's `itemIds` + `saveCertificate`, since the
  link lives on the certificate — the item's own Save never persists it). Cert dates use
  `SimpleDatePicker`; the cert icon is always 📜 (never the photo/🖼️ variant).
- **`resolveUri(uri)` in `attachments.ts` — IMPORTANT.** iOS app-container UUIDs change on
  reinstall (and simulator rebuilds), so the absolute `file://…/Application/<UUID>/…` path saved
  in an `Attachment.uri`/`cert.fileUri` goes stale and the image/file vanishes. The file *name*
  under `attachments/` is stable, so `resolveUri` re-bases any stored uri onto the CURRENT
  `documentDirectory`. Always render/open/read attachment files through it: `<Image>` sources,
  `openFile`/`deleteFile` (resolve internally), `export.ts` (ZIP reads) and `backup.ts`
  (`collectFileUris` — without it, stale-prefixed files were silently dropped from the backup).
- Audio: `expo-av` — ship's bell on app start (`utils/sound.ts` → `playShipBellSound`,
  asset `assets/sounds/ship-bell.mp3`), mirrors MHM. Shown via `screens/SplashSc.tsx`, an
  overlay in `index.tsx` (`showSplash` state) that animates the logo and calls `onDone` after ~2.2s.
  **On the web the splash is a video** (`MSM Win Web/public/splash.mp4`, 10 s, 3.5 MB): the logo
  surfaces from water and ends on the app's navy; its own audio track is the ship's bell once,
  as the logo clears (~3.3 s). The frames are painted into a `<canvas>` over the video: shown as a
  `<video>`, Opera on macOS drew a thin vertical blue line through its hardware video path. Browsers allow sound only on an engaged site — otherwise it
  plays muted. Tap skips; no playback within 4 s or an error → the logo splash.
- Cloud (optional): Firebase JS SDK (`firebase`) — Firestore + Storage + Cloud Functions, live
  `onSnapshot` sync; the session comes from a custom token minted by `functions/enrol`
- **Home-screen widgets** (ported from DEM) — a small **Scan** widget (one tap → in-app scanner)
  and a medium **Scan + Flagged** widget (scanner button + the latest flagged items as deep-linked
  rows). iOS: WidgetKit/SwiftUI via `@bacons/apple-targets` (`targets/widget/` — `MSMWidgets.swift`
  + `Shared.swift` + `expo-target.config.js`, a real widget-extension target linked on prebuild).
  Android: `react-native-android-widget` JSX (`widgets/ScanWidget.tsx`, `widgets/FlaggedWidget.tsx`,
  headless `widgets/widget-task-handler.tsx` → `registerMsmWidgets()` at the top of `index.tsx`).
  The widget process can't see live data, so the app pushes a tiny flagged snapshot through a shared
  container — an **App Group** (`group.com.kukalab.msm`) on iOS, an AsyncStorage key on Android —
  from `services/widgetBridge.ts` (`syncFlaggedWidget`, debounced in DataContext on every `flat`
  change). Shape + keys live in `widgets/shared.ts` and MUST match `Shared.swift`. Widgets open the
  app via the same `msm://` scheme as labels, with two extra verbs `msm://scan` / `msm://flagged`
  (see `parseDeepLink` in `qrLabel.ts`); `index.tsx` captures the link (getInitialURL + 'url' event)
  and, for `msm://item/<id>`, recovers the item's category from the register before navigating
  ItemDetail. No-op on web/Windows/Expo Go (native modules absent, wrapped in try/catch).

## Architecture
```
index.tsx                    entry: providers + nav (4 tabs + stack modals + swipe)
theme.ts                     design tokens (copied from MHM, + LSA/FFE group colors)
types/equipment.ts           EquipmentItem model + CategoryKey union (24 categories)
constants/categories.ts      CATEGORIES registry: label, group (LSA/FFE/OTHER), source sheet,
                             emoji, color, dateField (nextInspection|expiry), monthly flag
utils/dates.ts               excelSerialToISO, parseDateCell, daysUntil, computeStatus, formatDate
utils/id.ts                  uid()
services/storage.ts          AsyncStorage CRUD per category + vessel info
services/excelImport.ts      header-driven generic mapper (see below) + First Aid special case
services/export.ts           PDF (expo-print HTML) + XLSX (SheetJS) + expo-sharing
services/qrLabel.ts          msm://item/<id> payload + QR→inline-SVG + printable label HTML
                             (100×50 / 50×30 mm, one label per page). Print: expo-print native,
                             printHtmlWeb on web (@page is honoured there), off on Windows. A PDF
                             file is native-only (printToFileAsync has no web impl) → deliverFile.
services/barcode.ts          lookupScan(code, flat) -> item+category | stale | unknown
services/firebaseService.ts  FIRESTORE storage + live subscriptions. Signs nobody in — see enrolment.ts
contexts/SyncContext.tsx     live sync: auto sign-in, onSnapshot listeners, debounced push,
                             forced re-push on launch/foreground (Firestore's offline queue
                             does not survive process death), and a re-`refresh` on foreground
                             plus a 20s poll WHILE PENDING — approval cannot announce itself,
                             because the device's rights live in a token it has not been given
contexts/DataContext.tsx     in-memory items + vessel, reload()/saveItem()/removeItem()
components/ui.tsx            Screen, Card, StatusPill/Dot, ScreenTitle, Empty, Label
types/inspection.ts          signed inspection record (append-only) + outcomeOf
types/crew.ts                CrewMember + signatureLine (name snapshot, not a login)
constants/checklists.ts      per-category weekly/monthly templates; permanent line ids
services/inspections.ts      create/closeDefect + queries (forItem, openDefects, roundStatus,
                             month/week windows) + mergeInspections/mergeCrew (union by id)
services/inspectionReport.ts LSA/FFE × weekly/monthly PDF+XLSX from one pure buildReport
screens/                    Dashboard, Categories, CategoryItems, ItemDetail(modal),
                             Import(modal), Reports (multi-select category panels →
                             PDF/XLSX), Settings, Manual (accordion help), Compressor
                             (BA compressor running-time + maintenance log; opt-in module —
                             toggle in Settings → Modules, stored in `msm:prefs`; entry point on
                             the FIFI/BA category screen + a Settings link), Splash, Consent (first-launch Privacy +
                             Terms gate), Legal (Privacy/Terms viewer, route.params.doc),
                             Inspection (modal — the round: checklist, signature, defect,
                             photos; "All pass" then downgrade what is wrong), InspectionDetail
                             (modal — one signed record, read-only by design; the only control
                             is recording a rectification), Crew, Defects (open/rectified,
                             filterable by LSA/FFE),
                             Label (modal — QR preview + stock toggle + print; one item via
                             ItemDetail's "Print label", a batch via CategoryItems' long-press
                             multi-select, or a whole category/deck/group via LabelBatch — the
                             tag button on the Categories tab + Settings → Print QR labels;
                             `services/labelBatch.ts` picks and orders the items, deck by deck,
                             `npm run check:labels`), Scan (modal — camera + manual entry; a match REPLACES
                             the screen with ItemDetail so back returns to the list)
constants/legal.ts           Privacy Policy + Terms of Use + disclaimer points; LEGAL_VERSION
                             drives the consent key `msm:legal_accepted_v{n}` (gated in index.tsx).
                             Bump LEGAL_VERSION to force re-consent after material changes.
```

### Data model
One unified `EquipmentItem` (id, category, no, type, serial, position, quantity, persons,
manufactureDate, nextInspection, expiry, remarks, extra{}, monthlyChecks{}) for all 23
categories — not 25 rigid schemas. `complianceDate(item)` picks the category's `dateField`;
`computeStatus` → `expired` (<today) / `due` (≤60d) / `ok` / `none`.

### Excel importer (services/excelImport.ts) — IMPORTANT
The source workbook (`LSA FFE Inventories.xlsx`, 25 sheets) is heterogeneous. The mapper is
**header-driven, not fixed-index**:
- `classifyHeader(row)` matches each cell against `FIELD_PATTERNS` → column→field map.
- A row is a **header** when ≥3 columns classify into fields (data rows classify ~0–1 because
  cell *values* don't contain column-name words). This handles multi-section sheets
  (Liferafts+HRU, GMDSS radios+SART+EPIRB, FIFI sets+bottles) by rebuilding the column map per
  section, and carries forward merged `type` cells within a section.
- First Aid sheet has no header row → `mapFirstAid` special case.
- **Exact headings win before keywords** (`EXACT_PATTERNS`, Sep 2026): a vessel's own list
  ("# · Deck · Location · Description · Make · Type · Size · Serial · Exp / Inspc.") imported
  "Make" as the type by keyword order. Guards that keep the reference workbook identical: `make`
  is exact only when a Type column exists; `type` is exact only beside an exact Make; `#` is the
  item number when a Serial column exists, otherwise the serial (Harnesses); make/size/deck do
  not count toward "is this row an item" (a stray number under "Volume" made a section title an item).
- **Sheets with no category of their own** are sorted row by row (`sortRows`, `CATEGORY_WORDS`)
  from description/type, then the sheet name, else `other_safety`. Re-check the reference file
  after touching any of this: 627 items; the only intended differences are Volume→size, Brand→make.
- **The blank template's headings live in `registerSheet.ts` (`templateHeadings`)**, pure, so
  `npm run check:places` can put a filled-in sheet through the importer. Every LSA/FFE sheet has
  BOTH `Next Inspection` and `Expiry`, and a `Quantity` (3 Oct 2026 — the Liferafts sheet had no
  column for an HRU's expiry). The category list's Position sort is headed by DECK when the
  category records any (`services/placeGroups.ts`), by Location otherwise.
- **Bulk "Set dates"** (`services/bulkEdit.ts`, 8 Oct 2026) shares the category list's multi-select
  with label printing: next inspection / expiry / an appended comment on the selected items, in
  place (ids untouched), snapshot first. For a whole register the Excel route is the same safety:
  export (writes MSM ID) → edit dates → Update from Excel. `npm run check:bulk`.
- **Web reads the file bytes itself** (`pickBinaryFileWeb` → `parseWorkbookBytes`):
  `expo-file-system.readAsStringAsync` does not exist in a browser.
- Validated against the real file: **627 items across all 23 sheets** (run `npx tsc --noEmit`
  to typecheck; counts e.g. liferafts 12, immersion 93, fire detectors 108).
- **Update from Excel** (`services/registerUpdate.ts`, Sep 2026) — the default import mode once a
  register exists. "Replace all" re-issues every id, and the id IS the QR label, the inspection
  link and the attachment owner, so a second import used to orphan all of them. Update matches
  each row to its item — `MSM ID` column (written by the XLSX export, `services/registerSheet.ts`)
  → unique serial → category+No+Type+Deck+Location (identical items paired in order) → for a row
  with neither number nor location, an item identical in type/make/size/serial/deck (`twinKey`,
  2 Oct 2026 — without it such rows were re-added on every update and a register tripled) — applies
  only columns the sheet HAS (an emptied cell clears, a missing column keeps), keeps the item's
  category, and lists items not in the file; they are removed only if the user switches that on.
  "Missing" is limited to categories the file has sheets for. The export's `Due`/`Status` headings
  are read specially only in our own layout (`ourExport`), and dates it writes ("01 Mar 2027")
  now parse — before this a register exported and re-imported lost every date.
  `npm run check:register -- "/path/LSA FFE Inventories.xlsx"` checks the round trip (export →
  import changes nothing, 627/627 matched by id) and that the reference import is unchanged.

## Running locally
```bash
cd /Users/Inspector/MarineSafetyManager
npm install
npx expo start            # then iOS simulator / Android / Expo Go
npx tsc --noEmit          # typecheck (clean)
npm run check:inspections # audit-trail invariants (immutability, merge, windows) — no jest here
```

### iOS native build (prebuilt)
`ios/` is generated via `npx expo prebuild -p ios` (CNG — it's gitignored; regenerate, don't
hand-edit; configure through `app.json`). Workspace: `ios/MarineSafetyManager.xcworkspace`
(bundle id `com.kukalab.msm`, CocoaPods installed). expo-av's microphone permission is disabled
via the `expo-av` plugin config in `app.json` (playback only).
```bash
npx expo run:ios                       # build & launch on a simulator
# or open ios/MarineSafetyManager.xcworkspace in Xcode (set a signing team for a device build)
```
**Widget target (`@bacons/apple-targets`).** `expo prebuild -p ios` reads `targets/widget/` and
adds a real **MSMWidgets** WidgetKit extension to the Xcode project, sharing the App Group
`group.com.kukalab.msm` with the app (both declared in `app.json` `ios.entitlements` +
`expo-target.config.js`). Needs `ios.appleTeamId` set (LAGTN99698) so the extension can be signed;
on a device build confirm BOTH targets have the App Groups capability with that identifier. The
Swift editor shows false "cannot find FlaggedItem / @main in top-level code" errors when a file is
opened in isolation — they resolve once the target is linked at prebuild. Android's widgets need no
extra native work beyond the `react-native-android-widget` plugin block in `app.json`.
### Hermes compatibility fixes (hard-won — keep these)
The app runs on Hermes (RN 0.81). Two real fixes were needed to boot on a real iOS build —
do not regress them:
1. **Import auth from scoped `@firebase/auth`, not `firebase/auth`** (see firebaseService.ts).
   The umbrella `firebase/auth` export map has no `react-native` condition → pulls the browser
   ESM build (ES private fields Hermes can't parse + browser globals → "DOMException doesn't
   exist"). `@firebase/auth` has a `react-native` export condition → clean RN build. (Same as MHM.)
2. **`babel-preset-expo` must match the SDK (`~54.0.11`), NOT latest (56.x).** A stray
   `npm install babel-preset-expo` grabbed 56 → it transpiled JSX/private fields for the wrong
   target → "private properties are not supported", then a blank white screen. Pinning 54.0.11
   fixed it. `babel.config.js` is plain (`presets: ['babel-preset-expo']`) — do NOT add
   `@babel/plugin-transform-private-*` plugins: with the correct preset they're unnecessary and
   break RN's FlatList/VirtualizedList ("property is not configurable" when a list renders items).
3. **Keep every Expo native module on its SDK-54 version — esp. transitive ones like
   `expo-font` (`~14.0.12`).** A stray latest `expo-font` (56.x, for SDK 56) was pulled in via
   `@expo/vector-icons`/`npm audit fix` → at startup `FontLoaderModule` called
   `getDirectConverter` on the older `expo-modules-core` (3.0.30) → `java.lang.NoSuchMethodError`
   in `create_react_context` → Android **release** crashed right after the splash (debug/sim
   fine; not R8). `expo install --check` misses it because `expo-font` isn't a direct dep. Fix:
   `npx expo install expo-font` (pins SDK-54 version), then clean-rebuild. Mismatched native Expo
   modules show up only at runtime in a built APK, never in tsc or the JS bundle.

### Licensing — one licence per VESSEL, sold outside the stores (5 Sep 2026)

The licence is **per vessel (one IMO), priced on request** (since 27 Oct 2026 — by length band and
discounts, worked out in MSM Fleet → Pricing), bought by the operator on LemonSqueezy through a payment
link made for that vessel (`custom_price` on product 1197509) and attached to the vessel's Firestore
account. Every enrolled device inherits it; a crew member buys nothing.
`services/purchases.ts` `activateLicense()` works on ALL platforms now (it was web-only), and
`isSubscribed()` reads the vessel entitlement FIRST, falling back to a store subscription only for
anyone who bought through the App Store before this. Why it changed: a store purchase is tied to
the Apple ID that paid, so the mate who bought it had Pro and the second officer beside him did
not — though the licence was meant to cover the ship.

**No IAP product exists on the App Store or Play, and none should.** The app is free in both
stores. On iOS and Android the paywall shows **no price, no buy button and no link** — only key
activation — because sending a user from inside iOS to an outside checkout is what App Store
review rejects (guideline 3.1.1). What is allowed is this shape: free app, silent about where to
pay, accepting a key the operator was issued. Apple's IAP disclosure ("payment is charged to your
store account…") was removed from the native paywall for the same reason — there is no store
charge to disclose, so printing it would simply be untrue.

**The app holds no price and no checkout link** (3 Nov 2026): `LS_PRICE_STRING` (€99) and the public
`LS_CHECKOUT_URL` were removed with the unused `getOffer` / `purchaseYearly` / `webCheckoutUrl` — the link sat
in the web bundle and sold a year at the variant's base price, round the quote. The web paywall asks for a
quote (mailto) and activates keys. Keep the variant's base price in the dashboard at the top band, so a
bare link to it never undercuts a quote.

**The trial belongs to the vessel, not the handset.** `syncTrialWithAccount()` mirrors the
first-launch stamp to and from `safety_vessels/{imo}.trialFirstLaunch`, taking the EARLIEST of the
two, and now runs from `SyncContext.connect()` on the enrolment path — it used to run only from
the legacy password sign-in, which nothing calls any more. On iOS the local stamp survives an
uninstall in the Keychain; **on Android the secure store is wiped with the app**, so this account
copy is the only memory the trial has and without it every reinstall handed out a fresh 60 days.
A reinstalled device does see a fresh counter until it re-enrols — the device secret is wiped too
— but it has to join the vessel to reach the register at all, and the stamp is corrected then.

**Pass the VESSEL KEY, never the auth uid** (`firebaseService.currentVesselKey()`). Since
enrolment a device's Firebase uid is `<imo>__<deviceId>` — unique per device — while all vessel
data lives under the IMO and firestore.rules authorises by the `vessel` claim. Licence activation
used `currentUid()` and wrote to `safety_vessels/<imo>__<dev>`, which the rules do not recognise:
the key validated on LemonSqueezy and then failed with "Missing or insufficient permissions".
Fixed 5 Sep 2026; the same trap applies to anything else that addresses the vessel document.

`ENFORCE_LIMITS` is now on everywhere except Windows, which has no cloud path and therefore no way
to activate a licence — enforcing there would be a dead end, not a paywall.

**firestore.rules protects the `entitlement` field**: it lives on the vessel document, which every
member may write, so without that carve-out any crew phone could grant the whole ship Pro with one
field write. Only a Master may change it.

### Two release-build traps (both cost a failed upload — found 3 Sep 2026)

**1. `OutOfMemoryError: Metaspace` in `:expo:lintVitalAnalyzeRelease`.** Expo generates
`-Xmx2048m -XX:MaxMetaspaceSize=512m`; heap is fine, METASPACE is not — Lint's vital analysis
loads the class metadata of the app plus every dependency into one daemon. It fails at RELEASE
only (`lintVitalAnalyzeRelease` does not run for debug), which is why `expo run:android` works
and `npm run aab` does not. Fixed by `scripts/patch-android-memory.js` (6 GB heap / 2 GB
metaspace, sized for a dev Mac — lower on a small CI box). **Run `./gradlew --stop` after
changing it**, or the running daemon keeps the old JVM args and the build fails identically.

**2. The version never reached the native projects.** `app.json` said 2.1 / versionCode 20101 and
the AAB came out **1.9 / 1095**. Both `android/` and `ios/` are CNG and get the version at
PREBUILD; neither `expo run:*` nor Gradle re-runs prebuild when the folder exists, so a bump lands
in app.json, every screen shows it, and the artifact carries the old one — Play then rejects the
upload for a duplicate versionCode. `scripts/patch-native-version.js` syncs app.json into
`android/app/build.gradle` and `ios/.../Info.plist`, and runs from BOTH `postinstall` and
`npm run aab`. It **never downgrades**: a hand-bumped TestFlight build is legitimately ahead of
app.json, and rewinding it would make the next App Store upload unacceptable — it warns instead.
`theme.ts`'s `APP_CONFIG.version` now reads app.json too, so the version lives in exactly one place.

### Android release signing / AAB (Play Store)
The release build is signed with an **upload keystore** kept at repo-root
`credentials/msm-upload.jks` (+ `credentials/keystore.properties` with the passwords).
`credentials/` is **gitignored — never commit it**, and the password is unrecoverable: if it's
lost you can no longer update the app on Play. Back up the keystore + password offline.
- Keystore lives OUTSIDE `android/` so `expo prebuild` (CNG, android/ is gitignored) doesn't wipe it.
- `scripts/patch-android-signing.js` re-injects the release `signingConfig` into
  `android/app/build.gradle` (reads `../credentials/keystore.properties`, falls back to the debug
  key if absent). Idempotent; runs from `postinstall`. **Re-run after every `expo prebuild -p android`.**
- **R8 minify + obfuscation + resource shrinking** are ON for release (gradle.properties
  `android.enableMinifyInReleaseBuilds=true` + `…ShrinkResourcesInReleaseBuilds=true`; keep rules in
  `android/app/proguard-rules.pro`). Re-applied after prebuild by `scripts/patch-android-minify.js`
  (postinstall). App logic is JS→Hermes bytecode (R8 only shrinks/obfuscates the native layer).
  Keep `android/app/build/outputs/mapping/release/mapping.txt` per release → upload to Play to
  de-obfuscate crash stacks. **Smoke-test the release build on a device** (R8 breakage shows at runtime).
- Build the bundle: `npm run aab` → `android/app/build/outputs/bundle/release/app-release.aab`.
- Verify signer: `keytool -printcert -jarfile <aab>` SHA-256 must match the keystore's.
- Bump `expo.android.versionCode` in app.json for each Play upload (and `version` for the name).
- Regenerate the keystore only with: `keytool -genkeypair -keystore credentials/msm-upload.jks
  -alias msm-upload -keyalg RSA -keysize 2048 -validity 10000` (changing it breaks updates once published).

### Firebase RTDB key encoding (keep this)
RTDB forbids `. # $ / [ ]` (and control chars) in keys. Item `extra` keys come from Excel column
headers (e.g. `PLB (Ser.#)`) and broke `pushAll` ("invalid key … in property … .extra"). `pushAll`/
`pullAll` (firebaseService.ts) reversibly `~xx`-hex-encode every object key on push and decode on
pull (`encodeKey`/`decodeKey`/`transformKeys`) so data round-trips while staying RTDB-legal. Values
are never touched. Local AsyncStorage keeps the original (unencoded) keys.

Also: `newArchEnabled` is **`true`** in app.json (re-prebuild after changing — it also gets written
to `android/gradle.properties` + `ios/Podfile.properties.json`). **It MUST stay on:**
`react-native-android-widget`'s headless renderer uses the bridgeless `ReactHost`, and with New Arch
OFF (RN 0.81 / SDK 54) placing a home-screen widget hard-crashes the task
(`TurboModuleRegistry.getEnforcing('PlatformConstants') could not be found`) — the widget appears in
the picker but won't drop onto the home screen. Turning New Arch on affects the WHOLE app (iOS +
Android), so **re-test every screen** after a rebuild. (Was `false` originally; flipped to add the
home-screen widgets. Earlier sim check: Dashboard/Settings render, 627 imported items, export works.)

### Native-build gotchas (iOS) — needed after `prebuild`/reinstall
0. **Xcode 27 refuses pods with a deployment target below 15.0** (SDWebImage 9.0, RNSVG 12.4,
   RevenueCat 13.0, RNCAsyncStorage 13.4 … — "the range of supported deployment target versions
   is 15.0 to 27.0.x"; older Xcodes only warned). `scripts/patch-ios-deployment-target.js`
   (postinstall) adds a loop to the Podfile's `post_install` that lifts every pod to the app's
   own 15.1; then `cd ios && pod install`. Found 17 Sep 2026 on the first archive under Xcode 27.
   **Same Xcode, second trap: fmt 11.0.2 fails in its own format.cc** ("call to consteval function
   … is not a constant expression"). It cannot be switched off — base.h #defines
   FMT_USE_CONSTEVAL unconditionally — so `patch-rn.js` lifts `fmt.podspec` and RCT-Folly's pin
   to **11.1.4** (what react-native main uses); apply with `pod update fmt RCT-Folly --no-repo-update`
   the first time (plain `pod install` refuses a changed local podspec). Verified: an unsigned
   Release `xcodebuild` of the whole workspace succeeds under Xcode 27.0.
1. **RN FuseboxTracer patch** — this RN 0.81.5 copy ships a malformed
   `ReactCommon/reactperflogger/fusebox/FuseboxTracer.h` (uses `BufferEvent` but doesn't define
   it → "use of undeclared identifier 'BufferEvent'"). Fixed by `scripts/patch-rn.js`, run via
   the `postinstall` npm script (re-applies on every `npm install`). Idempotent.
2. **Script sandboxing** — Expo prebuild sets `ENABLE_USER_SCRIPT_SANDBOXING = YES` in
   `ios/.../project.pbxproj`, which makes CocoaPods' resource-copy script fail
   ("Sandbox: deny file-write-create"). Set it to `NO` (sed) after prebuild before building.
3. **Codegen** — don't `rm -rf ios/build` between `pod install` and the build; the React
   codegen specs (`ios/build/generated/...`) are produced at pod-install time. If you see
   "Build input file cannot be found … States.cpp", just re-run `pod install` and rebuild.
4. **After ANY npm install / package add/remove/version change → `cd ios && pod install`.**
   npm re-hoists `node_modules`, so an Expo module can move between `node_modules/expo/node_modules/<pkg>`
   and top-level `node_modules/<pkg>`. The Pods project caches the old absolute path, so the iOS
   build then fails with `lstat(... expo/node_modules/<pkg>/ios/...): No such file` (seen with
   expo-font, expo-constants' PrivacyInfo.xcprivacy, …). `pod install` regenerates the paths; then
   Clean Build Folder (⇧⌘K) / clear DerivedData and rebuild. (Mirrors the expo-font SDK-version
   hazard above — node/native mismatches only surface in a real build, never in tsc or the JS bundle.)

Note: `npx expo export` AOT-compiles with `hermesc`; the dev workflow (`expo start` / `run:ios`)
is the validated path.

## Open items / TODO
1. **Firebase — Firestore, not Realtime Database (changed Sep 2026).** The transport was
   migrated to Firestore following DEM/NSeaStoreManager (`/Users/DEM`), because RTDB's single
   tree made two officers syncing at once a race. The login model changed with it — see (2):
   the shared connection password is gone, and **the legacy path was DELETED on 5 Sep 2026**
   (~500 lines out of firebaseService, 300 out of SettingsSc). Do not reintroduce a fallback to
   it: it keyed the register by the Firebase uid, which since enrolment is per-device
   (`<imo>__<deviceId>`), so any device reaching it wrote a second register beside the real one.
   Crew are still identified by the SIGNATURE on each inspection, not by personal accounts.
   Layout: `safety_vessels/{uid}` holds the whole register as ONE JSON STRING field
   (`register`) plus `masterDeviceId` / `entitlement` / `trialFirstLaunch`; subcollections hold
   `devices`, `pending_devices`, `crew` and — one document per signed record — `inspections`.
   The register is a string so arbitrary Excel column headers never become indexed field names;
   the trail is separate documents so it has no 1 MiB ceiling and cannot collide between devices.
   Rules: **`firestore.rules`** (paste into the console). `database.rules.json.rtdb-legacy` is
   the retired RTDB rule, kept only for reference.
   **There is no migration to do.** The Realtime Database was never actually created in the
   project (the console still offered "Set up database" on 3 Sep 2026), so despite `databaseURL`
   sitting in the config, cloud sync had never worked for any vessel and nothing was stored there.
   Firestore is this app's first working cloud, not its second.
   **Windows (react-native-windows) can no longer sync**: its REST path passed the ID token as
   `?auth=`, which RTDB allowed and Firestore does not — Firestore needs an `Authorization`
   header, and `RNCWindowsFileManager.httpRequest` cannot set one. `syncSupported()` returns
   false there and the UI says so. The Windows story is now the browser build in `../MSM Win Web`.
2. **Accounts are ISSUED, not shared (Sep 2026).** The shared connection password is replaced by
   the enrolment model from DEM/NSeaStoreManager: a Master issues an invitation (a name + an
   8-digit PIN) in Settings → Accounts, the person enters it in Settings → Join this vessel, and
   `functions/enrol` mints a **custom token** carrying `{ vessel, role, approved, deviceId }`.
   `firestore.rules` is written against those claims, so a role is now enforced by the server
   rather than agreed between colleagues — and revoking one person no longer means changing the
   password for everybody. The first device on an unclaimed vessel bootstraps to Master using the
   `BOOTSTRAP_CODE` **secret** (`cd functions && npm run secret`), which never ships in the app.
   **`pullAll` refuses an empty cloud register when the device holds items** (firebaseService).
   Without that guard a device pulled an empty blob, lost all 13 items, and pushed the emptiness
   back over the good copy inside a minute — a recoverable glitch turning permanent. Observed for
   real on 4 Sep 2026. Clearing a register is only allowed in the local→cloud direction, which is
   deliberate and recoverable from a `.msm` backup.
   **`components/ConnectionCard.tsx` at the top of Settings is what makes the order discoverable.**
   Joining has a sequence — set the IMO, enrol, then wait to be approved — and until it existed the
   app said none of it: sync just stayed `off` and Settings offered "Join this vessel" beside
   "Accounts" with no hint which came first. The card names ONLY the next step, driven by
   `useSync()` (status / role / enrolled) plus whether the IMO is set.
   `refresh` re-mints a token without a PIN, using the per-device secret issued at enrolment —
   that is how a waiting device notices it has been approved, and why device ids are no longer a
   credential. Roles: `user` (Crew) / `admin` (Officer) / `superadmin` (Master), see `types/role.ts`.
   **The rules also enforce the audit trail**: inspections may be created by any member, updated
   only in their `defect` field and only by an officer, and deleted by nobody — append-only is no
   longer merely an app convention.
   **The bootstrap code must be DIGITS.** The enrolment field is a number pad — crew key it on
   deck in gloves (types/role.ts) — so it strips non-digits. A base64 secret therefore could not
   be entered at all and the first device on a vessel could never enrol; found by walking the flow
   on a device, not by any typecheck. It is 12 digits (10^12 against a counter that stops after 8
   tries in 15 minutes), and the field accepts 8–16 digits so one input serves both an issued PIN
   and the bootstrap code.
   Deploy: `cd functions && npm i && npm run secret && npm run deploy`, then `npm run deploy:rules`.
   **Runtime: nodejs22** (`functions/package.json` engines + `firebase.json` runtime, bumped
   25 Sep 2026 — Node 20 is decommissioned on 30 Oct 2026 and nothing deploys after that on it),
   with **firebase-functions 7.4**. **firebase-admin stays on 12.7 on purpose**: v14 drops the
   namespaced API (`admin.firestore()` / `auth()` / `storage()`) that `enrol`, `refresh` and
   `sweepPhotos` use, and `createCustomToken` cannot be exercised without a real device secret —
   migrate it deliberately, with a device to test on, not alongside a runtime bump.
   Run `npx firebase-tools functions:artifacts:setpolicy --force` once, or container images
   accumulate in Artifact Registry and quietly bill.
   **After the FIRST functions deploy, grant the runtime service account permission to sign
   tokens** — without it `enrol` deploys cleanly, runs its whole logic, logs
   `role superadmin, approved true`, and then dies at the last line with
   `Permission 'iam.serviceAccounts.signBlob' denied`, returning a bare `INTERNAL` to the app.
   `createCustomToken` signs through the IAM API, and the default compute service account cannot
   sign for itself:
   ```
   SA=353177370508-compute@developer.gserviceaccount.com
   gcloud iam service-accounts add-iam-policy-binding $SA --member="serviceAccount:$SA" \
     --role="roles/iam.serviceAccountTokenCreator" --project=marine-safety-manager
   ```
   It takes a minute or two to propagate. Verified end to end on 3 Sep 2026: enrol with the
   bootstrap code returns `superadmin` + a token whose claims are exactly
   `{vessel, role, approved, deviceId}`, `refresh` re-mints with the device secret and refuses a
   wrong one.
3. **Firebase console steps** — Dedicated project `marine-safety-manager`; web config (apiKey,
   appId, messagingSenderId, etc.) is in `services/firebaseService.ts` (`FIREBASE_CONFIG`,
   `ROOT = 'safety_vessels'`). Auth uses `initializeAuth` + `getReactNativePersistence`.
   (a) Authentication → enable Email/Password; (b) create the **Firestore** database (pick the
   region once — it cannot be changed); (c) paste `firestore.rules` into Firestore → Rules.
   The project is **already on Blaze**, so Cloud Storage and Cloud Functions are available —
   which is what unblocks syncing inspection PHOTOS (the one remaining hole in the audit trail:
   the record travels between devices, the image does not). Firestore itself stays inside the
   free tier at this scale; Blaze bills only above it.
4. **The web/desktop build has no source of its own.** `../MSM Win Web` is a shell: its
   `index.js` imports `../MarineSafetyManager/index` and Metro watches this folder, so anything
   added here ships there automatically — no port, no second copy. It does keep its own
   `package.json`, and a dependency added here must be mirrored (this bit rot once: `qrcode` was
   missing and the web bundle would not build at all). Native-only modules get a shim in
   `MSM Win Web/web/shims/` — `react-native-ble-plx`, `react-native-purchases`,
   `react-native-android-widget` and `expo-secure-store` are stubbed there.
5. **`firebase.json` must NOT ignore `**/node_modules/**`** (the CLI's default). `expo export`
   writes library images under `web-dist/assets/node_modules/…` — React Navigation's back arrow
   is one — and Hosting then answers those URLs with index.html through the `**` rewrite: a 200
   that is HTML, so the header button was there and its arrow invisible. Fixed 13 Sep 2026.
   **Desktop is the web build; there is no installer (changed Sep 2026).** Firebase Hosting
   serves `../MSM Win Web/dist` (`firebase.json` here, `npm run deploy` there). A deploy stamps
   `dist/version.json`; an open tab compares it and offers a reload (`utils/webUpdate.ts` +
   `components/UpdateBanner.tsx`), and `npm run exe` wraps the same site into a single
   self-updating `.exe` via Node's single-executable mechanism — no install, no Node, works
   offline. The Electron/NSIS wrapper and the react-native-windows track below are RETIRED.
   Their scaffolding is still on disk and costs nothing — `mocks/` and the `.windows` redirects
   only engage when Metro runs ON a Windows dev machine (`process.platform === 'win32'`), which
   nothing in the shipping path now does — but it can be deleted whenever you want the tree
   smaller. The web build's own stubs are separate, in `../MSM Win Web/web/shims/`.
6. **Windows track (react-native-windows) — RETIRED** — scaffolding still present (see `WINDOWS.md`): `mocks/` JS stubs +
   `metro.config.js` (swaps native-less modules on `win32`) + `react-native.config.js`
   (guarded `@react-native-windows/cli`, autolink disables) + `assets/windows/` tiles. All
   gated to Windows — iOS/Android unaffected. Use **react-native-windows 0.81.26** (RN 0.81).
   Mirror the working MHM project at `/Volumes/Turbo/MHMWin 1205`. Native modules ported (repo
   root `.h`): **StorageModule.h** (persistent KV via registry → `mocks/async-storage.js` bridge),
   **FileManagerModule.h** (`RNCWindowsFileManager` Save/Open dialogs → `utils/WindowsFileManager.ts`
   + `utils/fileShare.ts`; wired into export.ts/backup.ts/ImportSc), **SoundModule.h** (ship bell).
   So on Windows: persistent data + XLSX export + .msm backup/restore + Excel import work; PDF/ZIP/
   print/attachments are guarded off (`onWindows`). **`mocks/expo-camera.js` is not optional
   politeness** — expo-camera resolves its native module at IMPORT time, so without the mock a
   Windows bundle throws "Cannot find native module 'ExpoCamera'" the moment ScanSc is imported,
   before any Platform check inside the screen could run. (Scan degrades to manual entry there, and
   the lookup is pure JS so it still works; the Label screen guards printing off.) Generate `windows/` (gitignored), copy the 3
   `.h` into `windows/<App>/` + register, build on the Windows machine.
7. **App icons** — since 2.58 (ISMpilot): `icon.png` = `ismpilot-app-icon.png` (navy shield),
   `adaptive-icon.png` = the shield keyed out of it on transparent (bg `#0B2545`), `splash.png`
   plain navy (the JS SplashSc animates the logo). Native copies (Android mipmaps/splash drawables,
   iOS AppIcon/SplashScreenLegacy/colour) were written by hand into the CNG folders — a prebuild
   regenerates them from these assets. HISTORY (pre-2.58) — generated from `assets/MSM logo.png` (transparent isometric MSM cube):
   `icon.png` (iOS, white bg), `adaptive-icon.png` (Android foreground, transparent, white bg via
   app.json), `splash.png` (white bg), `favicon.png`. Windows/UWP tiles in `assets/windows/`
   (Square44/71/150/310, Wide310x150, StoreLogo, SplashScreen, LockScreenLogo, target-size
   variants) — drop into `windows/<App>/Assets/` after prebuild. Regenerate via the Pillow
   scripts (crop cube by alpha bbox, composite at scale on white/transparent).
4. **Inspection photos: downscaled, then queued (Sep 2026).** Two pieces, and the reasoning
   matters more than the code. `services/images.ts` downscales to 1600px on the long edge before
   anything is stored — `expo-image-picker`'s `quality` only sets JPEG compression and leaves the
   full 12 MP resolution, so photos were 2–3 MB and are now 200–450 KB. It measures first, to
   avoid UPSCALING an already-small image, and constrains the long edge rather than the width so
   a portrait photo is not made bigger. `services/photoQueue.ts` then holds each photo in
   AsyncStorage until the connection is worth spending (`prefs.photoUpload`: `wifi` default /
   `always` / `never`), because the cost that hurts is not Google's — Cloud Storage is single-digit
   dollars a month for a hundred vessels — but the ship's own VSAT airtime. Drained on foreground
   (SyncContext) and by a button in Settings; failures back off and park after 6 tries.
   `services/photoStorage.ts` **derives** the object path from the record's ids
   (`safety_vessels/{imo}/inspections/{id}/{photoId}.jpg`) instead of writing a download URL back
   onto the record — a signed inspection is immutable, and the rules only permit updating
   `defect`. `storage.rules` mirrors firestore.rules against the same claims, write-once, no
   delete. **The Storage bucket is not created yet** — Firebase console → Storage → Get started;
   uploads fail harmlessly until it exists (the queue simply keeps them).
5. **Photo retention: 90 days in the cloud, then the vessel's archive (25 Sep 2026)** —
   `services/photoArchive.ts` (pure), `services/photoArchiveExport.ts` (the ZIP),
   `screens/PhotoArchiveSc.tsx`, and `sweepPhotos` in `functions/index.js`. The nightly job
   deletes Storage objects for records older than
   `cutoff = min(now − 90d, photoArchive.archivedThrough)` — and **no `archivedThrough` means a
   cutoff of 0, i.e. delete nothing**. That `Math.min` is the whole safety property: after a sweep
   the only copies of a photograph are the vessel's monthly ZIP and whatever devices hold locally,
   so the job never deletes inside a period the Master has not confirmed archived. The confirmation
   is a separate step from saving the file because the app cannot see where the file went, and
   months go in order (`canMarkArchived`) because `archivedThrough` is one watermark. It deletes by
   the RECORD's `at`, not the object's age — the queue uploads a March round in May — which is why
   it is a function and not a bucket lifecycle rule; it walks only the band since `sweptThrough`
   (30-day overlap for late uploads) and lists vessels with `select('photoArchive')`, since a
   vessel document holds the whole register as one string field. `photoArchive` is Master-only in
   firestore.rules; **storage.rules still lets NO client delete a photo** — only the job, which runs
   with admin credentials. Nothing clears local copies, ever: after a sweep they are evidence, not
   cache. Deploy: `cd functions && npm run deploy` (enables Cloud Scheduler) + `npm run deploy:rules`.
6. **The register syncs from a BASE, not by last-writer-wins (14 Sep 2026)** —
   `services/registerMerge.ts`. It was a whole-document replace pushed on every connect and every
   foreground, before pulling, so a phone with an old register wiped the vessel's the moment it was
   opened ("the equipment keeps deleting itself"). Now each device stores `msm:register_base`
   (the vessel copy it last agreed with + hashes of its own data then). Sync = pull first
   (`pullRegister`: current / take / merge three-way by item id / refuse an empty vessel over a
   base-less device), then `pushAll` only if something changed here, as a Firestore transaction
   on `registerUpdatedAt` (a `RegisterConflict` goes round again). A device with NO base (just
   joined, or first sync after this update) UNITES by id rather than taking either side — the
   migration case is a website holding the good register while the vessel holds a phone's stale
   one. `force` (restore a `.msm`) replaces on purpose. Decisions are pure (`decidePull`/
   `decidePush`) and driven through two-device scenarios by `npm run check:sync`. The Firestore
   glue itself was not exercised against a live vessel — only typechecked and reviewed.
   Two devices editing the SAME item still resolve by later `updatedAt`.
7. **A device's name is the Master's** (firestore.rules, 25 Sep 2026): a device may keep its own
   record current but may no longer change its `firstName` / `lastName` / `position`. With
   `signAsDevice` on that name IS the signature it files, so self-renaming was a way to sign as the
   Master. **Re-paste the rules after pulling this** (`npm run deploy:rules`).
8. **Checklist templates ARE editable now** (Settings → Checklists, `ChecklistsSc` +
   `ChecklistEditSc`, Officer and above) — the stale note here said otherwise. A vessel words its own
   rounds, adds ones the app does not ship (weekly / monthly / quarterly) and switches off the ones
   it does not owe; the version + line ids + the `lines` snapshot on every record are what make that
   safe. Not editable: the built-in templates themselves, which stay reachable for ever so history
   reads as it was signed.
9. **Importer polish** — minor cosmetic mappings (e.g. Hydrants `type` = "Yes", FIFI BA-set
   `position` = fire-station number). Items are editable, so acceptable for v1.
```
