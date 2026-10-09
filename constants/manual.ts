// ===================================
// Manual content, localized (en / ru / es / uk).
// The app's UI labels (menu/button names) stay in English — they appear in
// English in the app — so the localized prose references them verbatim. Only
// explanations are translated; regulatory reference codes are left unchanged.
// ===================================

import { ModuleKey, moduleOn } from './modules';
import { APP_CONFIG } from '../theme';
import { DUE_SOON_DAYS } from '../types/equipment';
import { Lang } from '../utils/locale';

export interface IntervalRow {
  k: string;
  v: string;
  ref?: string;
}

export interface Section {
  emoji: string;
  title: string;
  body?: string[];
  note?: string;
  rows?: IntervalRow[];
  link?: string;
  /** The ISMpilot shield, faint, behind the section (was the KukaLab octopus). */
  watermark?: boolean;
}

export interface ManualContent {
  screenTitle: string;
  screenSubtitle: string;
  sections: Section[];
}

const aboutLine = (lang: string) =>
  `${APP_CONFIG.name} v${APP_CONFIG.version} — ${APP_CONFIG.company}, ${APP_CONFIG.year}.`;

// ---------------------------------------------------------------- English ----
const en: ManualContent = {
  screenTitle: 'User Manual',
  screenSubtitle: 'How to use the app',
  sections: [
    {
      emoji: '⚓',
      title: 'Getting started',
      body: [
        `${APP_CONFIG.name} keeps your vessel's Life-Saving Appliances (LSA) and Fire-Fighting Equipment (FFE/FIFI) in one place, with inspection and expiry tracking.`,
        "Equipment is grouped into four registers: LSA, FFE, Other and Lifting & Mooring. Each item has its own number, a type and size, make, serial/ID, deck and location, and the dates that drive compliance.",
        "Fastest way to begin: Settings → Import from Excel. Bring your existing list as it is — one sheet with columns such as #, Deck, Location, Description, Make, Type, Size, Serial and Exp / Inspc. is sorted into categories by each item's description — or tap Download blank template (one sheet per category) and fill that in. Either way you see what was found before anything is saved. All data stays on the device and can optionally sync to the cloud.",
      ],
    },
    {
      emoji: '📥',
      title: 'Importing from Excel',
      body: [
        "Settings → Import from Excel → choose your .xlsx workbook. A worksheet named after a category (Liferafts, Lifejackets, Fire extinguishers, …) maps to that category automatically.",
        "Your own layout works too. A sheet that is not named after a category — typically one list of everything, deck by deck — is read by its column headings (#, Deck, Location, Description, Make, Type, Size, Serial, Exp / Inspc., Comments …), and every row is sorted into its category by what the item is: \"Fire extinguisher\" goes to Fire Extinguishers, \"EEBD\" to EEBD. Anything that cannot be recognised goes to Other Safety Equipment. The Import screen names the sheets it sorted this way.",
        "\"#\" is read as the item number when the sheet also has a Serial column, and as the serial when it has not. \"Exp / Inspc.\" fills whichever date the category is judged by — Next inspection or Expiry. Section rows such as \"Sun Deck\" between the items are skipped.",
        'No workbook yet? Tap "Download blank template (.xlsx)" on the Import screen (or Settings → Download import template) — one sheet per category with the right column headers — fill it in and import it back.',
        'You get a preview of how many items were found per category before anything is saved.',
        'Choose "Update" to bring an existing register in line with the file: each row finds the item it already is (by MSM ID, then serial, then number and location), changed cells are applied, new rows are added, and items keep their QR labels, photos and inspection history. Items that are in the register but not in the file are listed, and are removed only if you switch that on.',
        'To work on the list gradually: Reports → export the register as Excel, edit that file (it carries an "MSM ID" column — leave it as it is), then import it here with "Update". Add new rows with the MSM ID left empty.',
        '"Replace all" overwrites the register with the file; "Add as new" adds every row next to what is already there.',
        "Dates written as Excel serials, years (e.g. \"2034\"), DD/MM/YYYY or month and year (e.g. \"Jun/26\", read as the 1st of that month) are converted automatically. You can edit any item afterwards.",
      ],
    },
    {
      emoji: '🧰',
      title: 'Equipment & categories',
      body: [
        'The Equipment tab shows a grid of all categories with item counts and a coloured dot for the worst status inside.',
        "Tap a category to see its items — each row leads with the item number, e.g. \"No. 01-SD — CO2 5kg\". Search by number, type, make, size, serial, deck or location. Tap ＋ to add a new item by hand.",
        "An item records its Item No., Type / Description, Make, Size (free text — 5kg, 9L, XL, 150N), Serial / ID, Deck and Location, quantity or persons, its dates and Comments. The item number is shown large at the top of the item screen and of the inspection screen: among forty identical extinguishers it is the one thing that tells them apart.",
        'Dates are set with a calendar picker — tap the field, then choose year, month and day. To remove a date entered by mistake (say, a next inspection that should have been the expiry), tap the × at the end of the field and Save; the item is then judged by the date it still has.',
        'After a service, set the same dates on many items at once: long-press one item (or tap the tag button), tick the others or tap All, then Set dates. Fill in the next inspection, the expiry or both, and optionally a comment; a field left blank keeps each item\'s own value, and "Clear this date on all selected" removes that date from every one of them. The items stay the same items — their QR labels, photos, certificates and inspection history are untouched — and a copy of the register is kept in Settings → Data first.',
        'Adding several identical items — a row of dive cylinders, a batch of lifejackets? Save the first one, then tap Duplicate item at the bottom of its screen. The copy opens with everything filled in except the serial number, and with the next free item number (01-DT → 02-DT); type the serial and Save. Photos, certificates, flags and inspection history are not copied — they belong to the one item.',
        'Badges next to an item show one paperclip per attached file (📎) and 📜 when a certificate covers it.',
        'Checklist categories (Hydrants, BA Bottle Pressure, Fire Detectors) have monthly check toggles in the item screen.',
        'Inside a category, sort by Expiry date, Position, Name (A–Z) or Type — Position and Type group items under headers. On tablets the list shows two columns.',
        "\"Other Safety Equipment\" is the catch-all: anything the standard sheets do not name — a portable pump, a spare charge, a locker of gear nobody else counts. Add to it by hand with ＋; an imported row that cannot be recognised lands here too. It behaves like any other category — due dates, QR labels, inspections, reports.",
      ],
    },
    {
      emoji: '📎',
      title: 'Photos & documents',
      body: [
        'Each item can hold up to 4 attachments — photos or documents (PDF, etc.) — in the "Photos & documents" block of the item screen.',
        'Tap the dashed ＋ Add slot to take a photo, pick from the library, or choose a document.',
        'Tap a photo to open it full-screen (Open / Share); tap a document to open it in the system viewer.',
        'Long-press any attachment for its edit menu — Download / Share, Rename, Replace or Delete.',
      ],
    },
    {
      emoji: '🪝',
      title: "Lifting & Mooring",
      body: [
        "Lifting and mooring gear lives in the same app as LSA and FFE — one account, one crew list, one set of QR labels, one place the evidence is kept. It appears on the Dashboard, in the Equipment tab, in reports and in the Excel import template like any other register.",
        "Eight categories: Mooring Equipment, Working Aloft Equipment, Cranes, Hooks & Cables, Deck Slings & Shackles, Engineering Lifting Equipment, Working Aloft Anchors, Interior Lifting Eyes & Beams.",
        "Every category has an ANNUAL round — the examination the certificate rests on: the item matches the lifting register (ID, SWL/WLL, location), the thorough examination / proof test is in date, the certificate is attached and readable, wear is within the maker's limits, and anything doubtful is withdrawn and tagged.",
        "Mooring Equipment and Working Aloft Equipment also have a QUARTERLY round — the hands-on look at gear in constant use, plus SWL/WLL marking, the test certificate and visible damage.",
        "Record the next examination date so the ship's certification falls due in one annual period rather than scattered through the year.",
        "Nothing here is monthly by default. A vessel that works differently adds a round — a monthly one included — or re-words the checks in Settings → Checklists.",
      ],
    },
    {
      emoji: '📜',
      title: 'Certificates',
      body: [
        'The Certificates tab holds documents that cover many items at once — e.g. a single liferaft service certificate applying to several rafts (a "group certificate").',
        'Open a certificate to set its number, issue/expiry dates (calendar picker) and attached file, and to link the items it covers.',
        'A certificate carries its own expiry status (red / amber / green), so it appears in your due-soon view.',
        'On an item screen, covering certificates are listed — tap ＋ Link to attach an existing certificate to that item (it is saved straight away). Items covered show a 📜 badge.',
        "Three tabs: Equipment, Crew and Vessel. Crew certificates belong to a PERSON — STCW, Certificate of Competency, ENG1 / medical, passport, seaman's book, visa. Choose the holder from the crew list and tap a suggested name (or type your own), so the same document is spelt the same way for everyone.",
        "The Crew tab groups certificates by person, with the person whose papers expire first at the top. Settings → Crew shows the same at a glance on each row: \"3 certificates · 1 expired\".",
        "Vessel certificates are the ship's own papers — registry, SMC, DOC, ISSC, MLC, load line, safety equipment, radio, IOPP, class, insurance.",
        "With Expiry reminders on, crew and vessel certificates get the same 60 / 30 / 7-day notifications as the equipment.",
      ],
    },
    {
      emoji: '⏱️',
      title: 'BA Compressor log',
      body: [
        'An optional module for the breathing-air (BA) compressor in the FIFI outfit — turn it on in Settings → Modules → BA Compressor log.',
        'Open it from Settings → Open compressor log, or from the "FIFI Outfit & BA Sets" category.',
        'Track up to 3 compressors. Tap "＋ Add compressor" to create a unit, rename it, and switch between units with the chips at the top.',
        'Log a run: choose "Running", pick the date, enter the running time (hours / minutes) and a note. Each run adds to that unit\'s total running-time counter, with a running Σ total on every entry.',
        'Log servicing: choose Maintenance, Service or Inspection with a date and note. Use "Adjust starting counter" for hours accumulated before logging began.',
      ],
    },
    {
      emoji: '📊',
      title: 'Dashboard & statuses',
      body: [
        'The Dashboard lists every item that has a date, sorted soonest-first, so the most urgent work is on top.',
        `Status colours: red = Expired (date in the past), amber = Due soon (within ${DUE_SOON_DAYS} days), green = Valid.`,
        'Tap a counter (Expired / Due soon / Valid) to filter the list to that status; tap again to clear.',
        'Filter by group (All · LSA · FFE · Other) and sort by Expiry date, Position, Name or Type — Position groups items by location and Type groups them by equipment category, each with a count.',
        "Every row carries TWO marks, one at each edge. The left bar is the date — expired, due soon, valid. The right bar is the current round: blue not inspected yet, green signed and clear, amber the period is closing, red a defect still outstanding. An item can be perfectly in date and uninspected, and that is exactly the case worth seeing.",
        "Red on the right is not cleared by the calendar. A defect raised in March is still a defect in June, so the mark stays red until the rectification is signed — the month turning over must not hide what an audit looks for.",
        "SORT has a «This period» setting on both the dashboard and the category lists: the list is then grouped worst first — failed, period closing, not inspected yet, inspected — because it is read to find what is still owed.",
      ],
    },
    {
      emoji: '🔎',
      title: 'Scan, flag & recently scanned',
      body: [
        'Scan a QR label or a serial from the QR button in the header of the Dashboard or the Categories tab. A match opens the item straight away; a maker\'s barcode or a recorded serial finds it too. Use the in-app button rather than the phone\'s own camera — an ISMpilot QR is a private link the camera app cannot open by itself. If a code is too damaged to scan and you can still read the digits, type them in — same lookup.',
        "Print label (on the item screen) makes the QR sticker. The full-size label carries the type and size (\"CO2 5kg\"), the item number and serial (\"No. 01-SD · S/N C001111\"), the next inspection or expiry date, and the category with deck and location. The smallest stocks keep the type, the number and the serial.",
        "Print all the labels at once from the tag button beside the QR scanner on the Categories tab (or Settings → Print QR labels). Pick a group, tick decks and categories, and the button says how many stickers that is; the next screen chooses the stock and where to print — the Xprinter over Bluetooth, a thermal roll, an A4 sheet of labels with cut lines on the office printer, or a PDF for another printer's own app. Labels come off deck by deck, then by category and item number, so a roll follows the walk round the ship. Inside one category, long-press an item to pick a few by hand instead.",
        'Flag "come back to this": open an item and tap the Flag button by the status. A flag is not a compliance state — an item can be perfectly in date and still need a second look (rust, a sticky pin, a doubt). Add a short note on why, if it helps the next person.',
        'The Dashboard shows two quick-access strips. Flagged lists what the crew marked for a second look; Recently scanned lists the labels you last opened on this device, newest first. Tap either heading to open its full screen — and on the Flagged screen you can clear a flag once the item is dealt with.',
        "In a browser the scanner does not reach for the camera until you ask. On a desk machine the code is usually quicker to type, and a browser asked for a camera it cannot find simply waits with nothing to say — tap \"Use the camera\" when you do want it, and a machine without one says so instead of hanging. On a phone the scanner opens looking, as before.",
      ],
    },
    {
      emoji: '🛟',
      title: 'Inspection intervals — LSA',
      note: "Indicative only. Always verify against the vessel's flag State, classification society, the maker's instructions and the current SOLAS / LSA Code / MSC circulars. The app records dates — it does not enforce intervals.",
      rows: [
        { k: 'Inflatable liferafts', v: 'Service at an approved station every 12 months (extension possible under a flag-approved scheme).', ref: 'SOLAS III/20; LSA Code' },
        { k: 'Liferaft HRU (hydrostatic release)', v: 'Replace / service per maker; disposable types (e.g. Hammar H20) every 2 years.', ref: 'SOLAS III/20; maker' },
        { k: 'Lifejackets', v: 'Monthly visual; annual thorough inspection. Lights & inflatable units serviced annually; cartridge/battery replaced at expiry.', ref: 'SOLAS III/20; MSC.1/Circ.1304' },
        { k: 'Immersion / anti-exposure suits', v: 'Annual inspection; air-pressure (seam) test at intervals ≤ 3 years for applicable types.', ref: 'MSC.1/Circ.1047' },
        { k: 'Lifebuoys', v: 'Monthly inspection; self-igniting lights & smoke signals replaced at expiry.', ref: 'SOLAS III/20' },
        { k: 'EPIRB', v: 'Monthly self-test; annual performance test; shore-based maintenance and battery renewal within battery expiry (≤ 5 yr).', ref: 'SOLAS IV/15; MSC.1/Circ.1040' },
        { k: 'SART', v: 'Monthly check; battery replaced at expiry.', ref: 'SOLAS IV' },
        { k: 'Pyrotechnics (rockets, flares, smoke)', v: 'Replace by expiry — normally 3 years from manufacture.', ref: 'SOLAS III; LSA Code' },
        { k: 'Rescue / MOB boat + davit', v: 'Weekly & monthly checks; annual thorough examination + operational test; 5-yearly winch-brake dynamic test and release-gear overhaul.', ref: 'SOLAS III/20; Res. MSC.402(96)' },
        { k: 'Launching appliances / davits', v: 'Annual thorough examination; 5-yearly load test of winch brake.', ref: 'SOLAS III/20; MSC.402(96)' },
        { k: 'Harnesses / fall arresters', v: "Inspected by a competent person at the maker's interval (commonly 6–12 months).", ref: 'maker / SMS' },
        { k: 'Emergency escapes (hatches, routes)', v: 'Weekly: route clear, hatch opens freely, signs and emergency lighting; monthly: seals, ladders, associated equipment. Escape routes must be kept unobstructed at all times.', ref: 'SOLAS II-2/13; ISM / SMS' },
      ],
    },
    {
      emoji: '🧯',
      title: 'Inspection intervals — FFE',
      note: 'Indicative only. Verify against flag, class, maker and the current SOLAS Ch II-2 / FSS Code and MSC.1/Circ.1432 (as amended by MSC.1/Circ.1622).',
      rows: [
        { k: 'Portable fire extinguishers', v: 'Monthly visual; annual inspection/service; periodic discharge test & recharge; CO₂ cylinders hydrostatic test every 10 years.', ref: 'SOLAS II-2/14; FSS Code; MSC.1/Circ.1432' },
        { k: 'Fixed CO₂ / gas systems', v: 'Annual inspection; cylinders weighed (recharge if loss > 10%); 10-yearly hydrostatic test; pipework blow-through.', ref: 'FSS Code Ch.5; MSC.1/Circ.1432' },
        { k: 'Fire detection & alarm', v: 'Periodic functional testing of detectors/MCPs; full system test annually.', ref: 'SOLAS II-2; FSS Code Ch.9' },
        { k: 'Fire dampers / flaps', v: 'Operational test periodically (typically annual).', ref: 'MSC.1/Circ.1432' },
        { k: 'Hydrants, hoses, fireboxes, nozzles', v: 'Monthly inspection; fire hoses pressure-tested annually.', ref: 'SOLAS II-2/14; MSC.1/Circ.1432' },
        { k: 'BA sets (SCBA)', v: 'Monthly cylinder pressure & function check; annual thorough check; cylinder hydrostatic test per maker (steel ~5 yr; composite per stamp).', ref: 'FSS Code Ch.3; maker' },
        { k: 'EEBD', v: 'Monthly check; annual inspection; replace at the marked life-date.', ref: 'SOLAS II-2/13; FSS Code Ch.3' },
        { k: "Fireman's outfit / blanket / foam applicator", v: 'Annual inspection.', ref: 'FSS Code Ch.3; MSC.1/Circ.1432' },
      ],
    },
    {
      emoji: '🧪',
      title: 'Inspection intervals — Other',
      rows: [
        { k: 'Eye-wash stations', v: 'Periodic check; flushing bottles replaced at expiry.', ref: 'maker / SMS' },
        { k: 'First-aid / medical kits', v: 'Per flag State / MLC; contents replaced at expiry.', ref: 'flag; WHO IMGS' },
        { k: 'Gas detection meters', v: 'Bump test before use; calibration per maker (e.g. 6-monthly) with annual verification.', ref: 'maker / SMS' },
        { k: 'Chemical / gas-tight suits', v: 'Periodic pressure test per maker.', ref: 'maker' },
        { k: 'SOPEP locker', v: 'Periodic inventory check; absorbents/items replenished as used.', ref: 'MARPOL; SMS' },
      ],
    },
    {
      emoji: '✅',
      title: "Inspections — the audit trail",
      body: [
        "Open an item — scan its QR label or find it in a category — and tap Weekly, Monthly, Quarterly or Annual. Only the rounds that category owes on this vessel are offered — the schedule is set per category in Settings → Checklists.",
        "Every line is PASS / FAIL / N/A. \"All pass\" fills the list in one tap and you downgrade what is actually wrong; nothing is pre-filled until you tap it, because an untouched checklist must never look like an inspected one.",
        "\"Clear all\" beside \"All pass\" starts the round again: every answer, the comment and the defect note are cleared after one confirmation. Photographs you have added stay — remove those individually. Nothing has been signed at that point, so nothing on file changes.",
        "Choose who is signing from the vessel's crew list before you start — that name goes on the record. Add comments and up to four evidence photographs; they belong to that inspection, not to the item's general photos.",
        "Signing stamps the exact date and time, the crew member and the checklist version. A signed record cannot be edited or deleted by anyone, including the Master: a mistake is corrected by inspecting the item again, and both records stay on file. That is what makes the trail worth showing to a surveyor.",
        "Any FAIL raises a defect against that item, and it stays outstanding until somebody records the rectification.",
        "Scan before signing (Settings → Scan QR label before signing, set by the Master). When it is on, Crew and Officers can sign an inspection only after scanning that item's QR label with the in-app scanner (the QR button). The scan counts for 30 minutes; typing the code in by hand does not count.",
        "Scan by category (Settings → Scan by category, set by the Master). The scan rule does not have to apply to everything. A rescue boat's inventory or the loose gear in a fire locker is worth keeping and checking off item by item, and nobody is going to label every bailer and spanner — switch those categories off here and their items are inspected and signed straight from the equipment list. Everything else still asks for the label. A category added later is covered by the rule by default, and a scan made anyway is still stamped on the record and still printed in the report's Scan column.",
        "Sign as the device's account (Settings → Sign as the device's account, set by the Master). When it is on, every enrolled phone, tablet or PC signs inspections as the person it was issued to — the name and rank on its account — and the signer list is not offered. An Officer can no longer scan an item on their own phone and put a colleague's name to it. The Master changes who a device belongs to in Settings → Accounts (rename); a device that has not joined the vessel still picks from the crew list, because it has no account to sign as.",
        "The scan is written onto the signed record and shown in the Scan column of the inspection report. A Master may sign without a scan (a missing label, an item out of reach) but must give a reason, which is printed in the report beside the signature.",
      ],
    },
    {
      emoji: '📋',
      title: 'Your own categories and checklists',
      body: [
        "The built-in categories and the checklists behind them are a starting point, not a limit. A vessel whose SMS words a check differently — or that inspects things nobody else asks about — sets both up itself, in Settings.",
        "Settings → Categories adds headings of your own: Emergency Lighting, Escape Routes, Alarm Systems, whatever you actually walk round. Each takes a group (LSA / FFE / Other), which decides the report it prints in, and an icon. A heading behaves like any built-in one: its own list, QR labels, checklists, reports, and its own sheet in the blank import template, so a hundred light fittings come in from Excel rather than one at a time.",
        "Every category can be renamed, the built-in ones included — a category is identified by a key that never changes, so the items, their history, their QR labels and their certificates stay exactly where they are whatever it is called on screen. And a category the vessel does not carry can be switched off: Equipment → \"Show or hide categories\" (Master only), tap what you do not use, tap Done. A hidden category also leaves the rounds, the checklists, the scan rules, the label printing and the reports' \"not inspected\" lists. Nothing is deleted — the items stay on file with everything attached to them, and any category comes back from the same place or from Settings → Categories.",
        "The report signs itself off: \"Checked by / Rank / Date\" at the foot of an inspection report is filled in from the people who actually signed the inspections in it. Where a round was shared, everyone who signed is named; the rank is printed when they hold the same one, and the date is the last round in the report rather than the day it was exported. The same three lines are in the XLSX summary. If nothing was signed in that period the blank rules stay, to be filled in by hand.",
        "Settings → Checklists words the questions. Open a round and you get the checklist already filled in — re-word a line, re-order them, delete what does not apply to your ship, add what your SMS asks. Save, and that is what the next round asks, on every device the vessel has enrolled.",
        "Which rounds a category owes is yours to set — weekly, monthly, quarterly and annual, per category. Settings → Checklists lists every round beside a switch: switch one off and that category is no longer offered it and the report stops counting it as due; switch it back on and it returns. \"＋ Weekly\", \"＋ Monthly\" or \"＋ Quarterly\" beside a category starts a round it does not have yet, from the checks it already has — a weekly EEBD check, a quarterly one on the escape routes. Edit the lines and save: from then on the item screen offers that round and the weekly, monthly or quarterly report includes it. Nothing signed is affected either way — records already on file keep their period and still print. Rounds are not built in for everybody because a round added for one vessel would otherwise be owed by every vessel.",
        "An Officer or the Master may do both. Wording a check is the work of whoever runs the round; deciding whose signature counts stays with the Master.",
        "Editing cannot reach into the past. Every signed inspection carries its own copy of the questions it was signed against, so re-wording a line today does not change a single record from last month — open one and it still reads exactly as it was signed. Removing a heading does not remove its equipment either: the items and their history stay, and adding the heading back brings them straight back.",
      ],
    },
    {
      emoji: '🛠️',
      title: "Defects",
      body: [
        "The Open defects strip on the Dashboard lists everything still owed work — filterable by LSA / FFE, newest first, with the age of each one.",
        "A defect is not a flag on the item; it IS the failed inspection that raised it, so it always answers what is wrong, who found it and when.",
        "Open one and tap \"Record rectification\" when the work is done — that is signed and stamped in its turn. Rectified defects stay reachable behind a toggle: at an audit, \"we found it and fixed it\" is a better story than silence.",
        "Every defect carries its reason: the checklist lines that failed. They are on the card, on the Dashboard strip and in the report's \"What failed\" column. The officer's note is added to them, never instead of them — so a defect raised without a note still says what was wrong.",
      ],
    },
    {
      emoji: '📤',
      title: 'Reports & export',
      body: [
        'Open the Reports tab and tap the category panels to choose which ones to include ("Select all" / "Clear all" toggles all). The counter shows how many items will be exported.',
        "Export as PDF or XLSX (named MSM_report_DDMMYY): item number, type, size, serial, location, dates, status and comments. The PDF is landscape with each item on a single line; the XLSX keeps Make, Deck and Location in separate columns so the file imports straight back.",
        'Export ZIP (PDF + photos) bundles the PDF, every attached photo/document, and the certificate files covering the items (with a certificates/INDEX.txt mapping each certificate to its items) into MSM_backup_DDMMYY.zip.',
        'Print sends the report to a printer via the system print dialog — or "Save to PDF". Exports open the device share sheet.',
        "Reports → Inspections is the record of what was done. Choose the group (LSA, FFE, Other or All) and Weekly or Monthly, then step back to any earlier month or week with ‹ ›; \"Back to current\" returns to this one. The figures on screen are the ones that will be printed.",
        "Under the group, the categories that owe this period's round are listed with their progress — \"5 of 5 inspected · complete\", \"3 of 12\", or \"failed\". Tap to include or leave one out; press and hold to report on that category ALONE. That is how the lifebuoy round is filed as its own page: the report is titled after the category, and it lists only those items — inspected, not inspected, and any open defect on them. \"Whole group\" puts everything back.",
        "The report opens with its verdict — for example \"September 2026 Monthly Inspection – Completed – Passed\", or \"Incomplete (12 of 40 inspected)\" and \"Failed\" when that is the truth. It is the line to file as evidence in your planned maintenance system. Each item is judged by its latest inspection in the period, so a failure put right and re-inspected is not held against it.",
        "Inspections carried out are listed with No., Location, Category, Type, Size, Serial, Result, Comments, the inspector's Initials, Date and Time, with a key from initials to names under the table. What was written in Comments during the inspection — and what failed — is carried into the report. After that come the items not inspected in the period, and every defect still open.",
        "The inspection report has a Scan column: QR when the label was scanned before signing, No scan when a Master signed without one (the reason is in Comments). The register XLSX carries an MSM ID column — keep it when you edit the file, and Import → Update finds every item again.",
      ],
    },
    {
      emoji: '💾',
      title: 'Backup & restore',
      body: [
        'Settings → Export backup (.msm) writes one file with everything on the device: items, certificates, compressor logs, vessel info and the attached files embedded inside (MSM_backup_DDMMYY.msm).',
        'Restore backup (.msm) recreates the data on another device or after a reinstall — it replaces all current data, so restore onto a fresh device.',
        'Backups work without the cloud. Device preferences (such as the compressor-module toggle) are not part of the backup.',
        "The app also takes a SNAPSHOT of the records every time it opens and keeps the last three on the device. Settings → Data → \"Roll back to …\" names the moment it would take you back to. It is there for the accidents nobody plans for — a wrong file restored, a register emptied — and it is the copy that will actually exist, because nobody exports a backup the morning before the mistake.",
        "A snapshot carries the RECORDS, not the files. Photographs and documents stay on the device under their own names and remain linked, so a roll-back is not a substitute for a real backup taken to another machine.",
        "An empty register never overwrites a good snapshot: if the app opens onto nothing, the copies it already holds are kept.",
        "Restore and Roll back belong to the Master — they replace the register and hand it to the vessel, so they overwrite what other officers have already worked against. Officers keep Import and Export. A device that has not joined a vessel keeps all of it: its register is its own.",
      ],
    },
    {
      emoji: '🗑️',
      title: 'Reset all data',
      note: 'Make an Export backup (.msm) first if there is any chance you will need the data again — a reset cannot be undone.',
      body: [
        'At the bottom of Settings, "Reset all data" permanently deletes every item, certificate, compressor log, attached file and the vessel info on this device.',
        'It is password-gated: type the password "Reset all data" exactly to enable the confirm button. Tap outside the dialog or Cancel to back out.',
        'Device preferences and your acceptance of the Privacy Policy / Terms are kept; only the safety-register data is removed.',
        "Reset is the Master's, and on a syncing device it does not clear a handset — it clears the SHIP. The confirmation says so and the button is named \"Erase everywhere\", because it reaches the vessel's register and every other device aboard within seconds.",
        "To empty only this device, leave the vessel first: Settings → This device → \"Sign off & erase\". The vessel's copy is untouched.",
        "A reset also removes the automatic snapshots — otherwise \"delete everything\" would not be true.",
      ],
    },
    {
      emoji: '🔑',
      title: "Joining a vessel, accounts & roles",
      body: [
        "The vessel is identified by its IMO number (Settings → Vessel). Everything else follows from it, and the card at the top of Settings always names the next step.",
        "The FIRST device joins with the bootstrap code supplied with your licence and becomes the Master.",
        "The Master then issues each crew member an account in Settings → Accounts: a name and an 8-digit PIN. The PIN stays readable in that list so it can be read out again, and can be re-issued or revoked one person at a time.",
        "Everyone else enters the IMO, then joins from the “This device” card at the top of Settings with their name and PIN. Their device waits in a queue; the Master approves it in Accounts → Devices, and the waiting device notices by itself within seconds — no restart and nothing to re-enter.",
        "Three roles: Crew records inspections, Officer also clears defects, Master also issues accounts and sets roles. Roles are enforced by the server, not merely by the app.",
        "Lost a handset? The Master switches that device off in Accounts → Devices. Nobody else is disturbed and no password changes.",
        "An invitation can also carry the person's RANK ABOARD — Third Officer, Bosun, Chief Engineer. That is deliberately not the same thing as the role: a Second Engineer may hold a Crew account and a cadet an Officer one, so a promotion aboard is not a permissions change. The rank travels with them onto the join screen and into the signing list, so no name and no rank is ever typed twice.",
        "Once a device has joined, Settings → This device shows who it signs as: name, rank, and whether it is approved. It is read live from the vessel, so a rank the Master changes an hour later appears by itself.",
        "\"Sign off this device\" leaves the vessel from that handset. It stops syncing at once and cannot let itself back in, so rejoining needs a fresh invitation and the Master's approval. \"Sign off & erase\" also clears the register on that device — for one being handed on or sold. Neither restarts the free period: it belongs to the vessel, not to the handset.",
        "The interface follows the rank. Accounts, the crew list and the device list are the Master's and are not offered to anyone else. The server refused those writes in any case; a button that always fails only tells you something untrue about your own authority.",
        "If a Master removes a device, that device says so and offers to join again — it does not sit on a connection error it cannot act on. Rejoining needs a fresh invitation, as it did the first time.",
      ],
    },
    {
      emoji: '🧭',
      title: "Access — which tabs each device shows",
      body: [
        "Settings → Access (Master only) is a table: one row per device, one column per tab — Certificates, PMS, Rest, Reports. A green dot means the tab is on that device, red means it is not. Tap to switch; the device follows on its next sync.",
        "Use it to keep each screen to what its holder needs: a deckhand's phone without the engine room's maintenance plan, an engineer's without the crew certificates.",
        "Dashboard, Equipment and Settings are always on. A Master's device always shows every tab. A device the Master has never set shows every tab, so nothing disappears on an update.",
        "This is tidiness, not a lock: what a device may change is still decided by its rank in Accounts, and enforced by the server.",
      ],
    },
    {
      emoji: '📚',
      title: "ISM documents",
      body: [
        "The Docs tab holds the vessel's controlled documents — SMS manual, procedures, circulars, the Master's standing orders, policies, forms — each with its number, revision, issue date and review date. A document is a file (the PDF from the office), text written aboard, or both.",
        "At the top is what the person on this device still has to read. Open the document, read it, and tap I have read and understood: that is a signature for the current revision, confirmed like any other.",
        "Each document shows how many of the crew list have signed it and who has not yet. Signatures are never removed.",
        "Officers and the Master add and edit documents. New revision moves it to Rev N+1 and asks everyone to read and sign again; signatures for earlier revisions stay in the history. Correcting a typo in the same revision does not.",
        "Files are shared with every device through the vessel. If the file cannot be uploaded (no connection), the document is saved and its file stays on the device that attached it until it is saved again with a connection.",
      ],
    },
    {
      emoji: '🏢',
      title: "Fleet console (superintendent)",
      body: [
        "For a superintendent in the office: one console with every vessel they look after, worst first — expired and due equipment, certificates (vessel, crew, equipment), maintenance, spares, and ISM documents still to be signed.",
        "Access is given by each vessel's Master: in Accounts, issue an account of the type Superintendent (shore). The superintendent opens Fleet (app.ismpilot.com/fleet), enters the IMO, name and PIN, and the vessel is added; further vessels are added the same way. The Master sees the account in Devices and can switch it off at any time.",
        "Open a vessel to add and edit its certificates and ISM documents, issue a new revision, and see who has not signed. Changes reach the devices aboard on their next sync. Equipment is shown read-only — it is inspected aboard.",
      ],
    },
    {
      emoji: '✍️',
      title: "Confirmed signatures",
      body: [
        "With Settings → Confirm every signature on (Master), each signature — an inspection, a maintenance job, a stores movement — is confirmed by the signer: their fingerprint or face on their own device, or their own signing PIN.",
        "Fingerprint and face are offered only when the device signs as its own account. A phone knows an enrolled finger touched it, not whose — so on a shared tablet everyone signs with their PIN.",
        "The first time you sign on a device you choose a signing PIN of 4–6 digits. It is not your account PIN, it is stored only as a hash, and nobody can read it — the Master included. Five wrong tries lock it for five minutes. Forgotten? The Master resets it in Settings, and you choose a new one.",
        "The report shows how each signature was confirmed (PIN or biometric) beside the name.",
      ],
    },
    {
      emoji: '🛏️',
      title: "Hours of rest",
      body: [
        "The Rest tab records each person's work and rest, half hour by half hour, in ship's time. It opens on the person this device belongs to; the Master can switch to anyone to review or correct their month.",
        "Tap a day, choose the pen (Tap marks WORK / Tap marks REST) and tap across the hours — or fill the day in one tap: Same as previous day, Day work 08–17, the three watch patterns, Day off. Moving to the next or previous day saves the one you leave.",
        "The rules are checked as you edit, against the days around it: at least 10 h rest in any 24 h and 77 h in any 7 days; rest in no more than two periods, one of at least 6 h; no more than 14 h between rest periods (MLC 2006 Reg. 2.3, STCW A-VIII/1). Windows are rolling, so a breach across midnight is caught. The check is indicative: exceptions the flag allows (drills, emergencies) are the Master's call — write them in the day's Note.",
        "A day with no record is shown as \"Not recorded\" and is never counted as rest.",
        "Monthly record (PDF) prints the month in the usual layout — one row per day, work shaded, totals, breaches — with signature lines for the seafarer and the Master.",
      ],
    },
    {
      emoji: '⚙️',
      title: "Planned maintenance",
      body: [
        "The PMS tab (or the Maintenance strip on the Dashboard) holds the machinery — main engines, generators, watermaker, compressors, pumps, stabilisers — each with its running-hours counter and its jobs.",
        "A job has an interval in running hours, in days, or both, and falls due on whichever comes first, as makers write it (\"every 250 h or 12 months\"). Set when it was last done — date and counter — once; after that, Record as done moves it for you. A job never done has no start to count from and shows \"Never done\" instead of a date.",
        "Enter the counter on the machine's screen (Save reading). The last readings give a running rate, so an hours-based job also shows roughly how many days it has left. A reading lower than the last is refused: a replaced counter is a new machine.",
        "Due soon is the last 10 % of the interval — not the 60 days used for equipment, which would make a monthly job \"due\" from the day it was done.",
        "Typical jobs adds the usual list for a kind of machine. The intervals are typical, not the maker's: check each against the manual and edit it.",
        "Record as done signs a completion — date, counter, note, your name — into the machine's history. Like an inspection it cannot be edited or deleted afterwards; a mistake is corrected by recording the job again. Removing a machine or a job keeps the history.",
      ],
    },
    {
      emoji: '📦',
      title: "Spare parts",
      body: [
        "The Spares tab is the stores: each line has its name, part number, maker, where it is kept and a re-order level. The list is grouped by location, out-of-stock and low lines first; To order narrows it to exactly those.",
        "On hand is never typed over. Open a part and use + Received for a delivery, − Used for a part taken outside the maintenance plan, or Stocktake for what is physically on the shelf. Each is a signed movement and the stock is their sum, so two devices booking at once both count.",
        "A stocktake is recorded as the difference from the book, so a count taken offline does not undo a delivery booked meanwhile. A wrong movement is corrected by a stocktake; movements cannot be edited.",
        "Mark which machines a part fits: the machine's screen lists its spares with the stock. On a maintenance job, Parts used each time lists what the job takes; Record as done takes them out of the stores, and the quantities can be changed or set to 0 on the day.",
        "The Dashboard shows a line when anything is out of stock or low.",
      ],
    },
    {
      emoji: '☁️',
      title: "Cloud sync & inspection photos",
      body: [
        "Once a device has joined, sync keeps itself in step — there are no Push / Pull buttons. Sign a record and it is on the vessel's other devices in seconds; the app stays fully usable offline and catches up when the connection returns.",
        "Inspection records are append-only, so two officers working a round on two phones cannot overwrite each other. The equipment register is one shared document: if two people edit the SAME item at once, the later edit wins.",
        "Evidence photographs are downscaled on capture and then queued. Settings → Inspection photos chooses Wi-Fi only (the default), any connection, or never — at sea the airtime bill is the vessel's, so the record travels at once and the pictures follow in port.",
        "The cloud keeps a photograph for 90 days. After that it is the vessel's to keep: Settings → Inspection photos → Photo archive saves that month as a ZIP — the pictures, plus an index listing the item, the round, the result and who signed it. Save it where the ship keeps its records and confirm it, and those photographs are cleared from cloud storage overnight. Nothing is deleted from a month you have not confirmed, nothing is ever deleted from the phones and tablets themselves, and the signed records — the inspections, the reports, the .msm backup — are not touched by any of this. Confirming is the Master's; saving a copy is anyone's.",
        "Attached files still travel in an .msm backup, which remains the way to move everything between devices without a connection.",
        "Photographs and attached documents no longer travel inside the register — they go to secure storage and the record carries a reference. A Firestore document stops at 1 MiB, and two photographs used to be enough to stop an entire vessel syncing.",
        "A vessel without a licence may upload 25 files in total. This is the one limit that applies during the trial too, because it is the vessel's photographs on our storage bill. Nothing is refused on the device: pictures are taken, kept, shown and included in a .msm backup as always — what waits is the copy for the other devices, and everything held back goes up on the first sync after the vessel is licensed. Settings → Inspection photos says how many are left.",
      ],
    },
    {
      emoji: '🔔',
      title: 'Expiry reminders',
      body: [
        'Settings → Modules → Expiry reminders schedules local notifications 60, 30 and 7 days before each item\'s inspection or expiry date.',
        'The first time you turn it on, allow notifications when asked. Reminders stay in sync automatically as you add, edit or import items.',
        'They are on-device only (no internet needed). With a large register the soonest reminders are scheduled first and the list refills as dates pass.',
      ],
    },
    {
      emoji: '🎨',
      title: 'Appearance (themes)',
      body: [
        'Settings → Appearance switches the colour theme: Light (default), Dark and Colorful.',
        'Settings → Modules → Sounds switches every sound cue off or on — the ship\'s bell on launch and the chimes on save, sign and error. Off is remembered on this device; a long round of inspections is quieter for it.',
        'Colorful tints equipment icons by group — LSA green, FFE red, Other teal. Your choice is saved and applies across the whole app.',
        'On tablets the Dashboard, Equipment, Certificates and Reports lists show two columns automatically.',
      ],
    },
    {
      emoji: '👑',
      title: "Vessel licence",
      body: [
        "ISMpilot Pro is licensed to the VESSEL by its IMO number — not per person and not per device. Every officer and every handset that has joined the vessel is covered by the one licence.",
        "Every vessel has 60 days to try the app before the 15-items-per-category limit applies.",
        "Pricing and fleet licences: mail@ismpilot.com.",
        "The licence is bought once by whoever manages the vessel and activated on the ship's account: Settings → ISMpilot Pro → Activate the vessel licence. From that moment every enrolled device has full access; a crew member buys nothing and needs no store account.",
        "Without a licence after the free period the app keeps working, but the register is capped at 15 items per category — enough to try it, not enough to run a ship.",
        "A device that joins a licensed vessel picks the licence up by itself. If one still shows the activation page, open it and tap Restore the vessel licence.",
      ],
    },
    {
      emoji: 'ℹ️',
      title: 'About',
      body: [
        aboutLine('en'),
        "This app is a record-keeping aid. It does not replace the vessel's official safety documentation, statutory inspections or class/flag requirements. Always follow your company SMS and applicable regulations.",
      ],
      link: APP_CONFIG.website,
      watermark: true,
    },
  ],
};

// ---------------------------------------------------------------- Русский ----
const ru: ManualContent = {
  screenTitle: 'Руководство пользователя',
  screenSubtitle: 'Как пользоваться приложением',
  sections: [
    {
      emoji: '⚓',
      title: 'Начало работы',
      body: [
        `${APP_CONFIG.name} хранит спасательное (LSA) и противопожарное (FFE/FIFI) снабжение судна в одном месте, с контролем проверок и сроков годности.`,
        "Оборудование сгруппировано в четыре реестра: LSA, FFE, Other и Lifting & Mooring. У каждой позиции есть свой номер, тип и размер, производитель, серийный номер/ID, палуба и расположение, а также даты, определяющие соответствие.",
        "Быстрее всего начать: Settings → Import from Excel. Загрузите ваш список как есть — лист со столбцами вроде #, Deck, Location, Description, Make, Type, Size, Serial и Exp / Inspc. раскладывается по категориям по описанию каждой позиции — или нажмите Download blank template (по листу на категорию) и заполните его. В обоих случаях до сохранения видно, что найдено. Все данные хранятся на устройстве и при желании синхронизируются с облаком.",
      ],
    },
    {
      emoji: '📥',
      title: 'Импорт из Excel',
      body: [
        "Settings → Import from Excel → выберите файл .xlsx. Лист, названный по категории (Liferafts, Lifejackets, Fire extinguishers, …), автоматически сопоставляется с этой категорией.",
        "Подходит и ваш собственный формат. Лист, не названный по категории — обычно единый список всего оборудования по палубам, — читается по заголовкам столбцов (#, Deck, Location, Description, Make, Type, Size, Serial, Exp / Inspc., Comments …), и каждая строка попадает в свою категорию по тому, что это за позиция: \"Fire extinguisher\" — в Fire Extinguishers, \"EEBD\" — в EEBD. Всё, что распознать не удалось, попадает в Other Safety Equipment. Экран импорта называет листы, разобранные таким образом.",
        "\"#\" читается как номер позиции, если на листе есть и столбец Serial, и как серийный номер — если его нет. \"Exp / Inspc.\" заполняет ту дату, по которой оценивается категория, — Next inspection или Expiry. Строки-разделы вроде \"Sun Deck\" между позициями пропускаются.",
        'Нет файла? Нажмите "Download blank template (.xlsx)" на экране импорта (или Settings → Download import template) — по листу на категорию с правильными заголовками — заполните и импортируйте обратно.',
        'Перед сохранением показывается предпросмотр: сколько позиций найдено в каждой категории.',
        'Выберите "Update", чтобы привести существующий реестр в соответствие с файлом: каждая строка находит свою позицию (по MSM ID, затем по серийному номеру, затем по номеру и месту), изменённые ячейки применяются, новые строки добавляются, а позиции сохраняют QR-наклейки, фото и историю проверок. Позиции, которые есть в реестре, но отсутствуют в файле, показываются списком и удаляются, только если вы это включите.',
        'Чтобы вести список постепенно: Reports → экспортируйте реестр в Excel, отредактируйте этот файл (в нём есть столбец "MSM ID" — не меняйте его) и импортируйте здесь через "Update". Новые строки добавляйте с пустым MSM ID.',
        '"Replace all" заменяет реестр содержимым файла; "Add as new" добавляет все строки к уже имеющимся.',
        "Даты в виде Excel-серий, годов (например, \"2034\"), ДД/ММ/ГГГГ или месяца и года (например, \"Jun/26\" — читается как 1-е число месяца) конвертируются автоматически. Любую позицию можно отредактировать позже.",
      ],
    },
    {
      emoji: '🧰',
      title: 'Оборудование и категории',
      body: [
        'Вкладка Equipment показывает сетку всех категорий с количеством позиций и цветной точкой худшего статуса внутри.',
        "Нажмите на категорию, чтобы увидеть позиции — каждая строка начинается с номера, например \"No. 01-SD — CO2 5kg\". Поиск — по номеру, типу, производителю, размеру, серийному номеру, палубе или расположению. Нажмите ＋, чтобы добавить позицию вручную.",
        "У позиции есть Item No., Type / Description, Make, Size (свободный текст — 5kg, 9L, XL, 150N), Serial / ID, Deck и Location, количество или вместимость, даты и Comments. Номер позиции крупно показан вверху экрана позиции и экрана инспекции: среди сорока одинаковых огнетушителей только он их и различает.",
        'Даты задаются календарём — нажмите поле и выберите год, месяц и день.',
        'Значки у позиции: по одной скрепке на каждый прикреплённый файл (📎) и 📜, если её покрывает сертификат.',
        'У чек-лист категорий (Hydrants, BA Bottle Pressure, Fire Detectors) в карточке есть помесячные отметки проверок.',
        'Внутри категории — сортировка по Expiry date, Position, Name (А–Я) или Type; в режимах Position и Type позиции группируются под заголовками. На планшетах список показывается в две колонки.',
        "\"Other Safety Equipment\" — категория для всего остального: того, что не названо в стандартных листах, — переносной насос, запасной заряд, рундук со снаряжением, которое больше никто не учитывает. Добавляйте в неё вручную через ＋; сюда же попадает импортированная строка, которую не удалось распознать. Она работает как любая другая категория — сроки, QR-этикетки, инспекции, отчёты.",
      ],
    },
    {
      emoji: '📎',
      title: 'Фото и документы',
      body: [
        'К каждой позиции можно прикрепить до 4 вложений — фото или документы (PDF и т. п.) — в блоке "Photos & documents" карточки.',
        'Нажмите пунктирный слот ＋ Add: снять фото, выбрать из галереи или выбрать документ.',
        'Тап по фото открывает его на весь экран (Open / Share); тап по документу — в системном просмотрщике.',
        'Долгий тап по вложению открывает меню редактирования — Download / Share, Rename, Replace или Delete.',
      ],
    },
    {
      emoji: '🪝',
      title: "Lifting & Mooring (грузоподъёмное и швартовное)",
      body: [
        "Грузоподъёмное и швартовное оборудование ведётся в том же приложении, что LSA и FFE: один аккаунт, один список экипажа, одни QR-этикетки, одно место для доказательств. Оно есть на дашборде, во вкладке Equipment, в отчётах и в шаблоне импорта Excel, как любой другой реестр.",
        "Восемь категорий: Mooring Equipment, Working Aloft Equipment, Cranes, Hooks & Cables, Deck Slings & Shackles, Engineering Lifting Equipment, Working Aloft Anchors, Interior Lifting Eyes & Beams.",
        "У каждой категории есть ГОДОВОЙ обход — освидетельствование, на котором держится сертификат: позиция совпадает с реестром (ID, SWL/WLL, место), полное освидетельствование / испытание нагрузкой в сроке, сертификат приложен и читается, износ в пределах допусков производителя, всё сомнительное выведено из эксплуатации и помечено.",
        "У Mooring Equipment и Working Aloft Equipment есть ещё КВАРТАЛЬНЫЙ обход — осмотр оборудования в постоянной работе плюс маркировка SWL/WLL, сертификат испытаний и видимые повреждения.",
        "Записывайте дату следующего освидетельствования, чтобы сертификаты судна приходились на один годовой период, а не были разбросаны по году.",
        "Ежемесячных обходов по умолчанию нет. Если на судне иначе — добавьте обход (в том числе месячный) или измените формулировки в Settings → Checklists.",
      ],
    },
    {
      emoji: '📜',
      title: 'Сертификаты',
      body: [
        'Вкладка Certificates хранит документы, покрывающие сразу много позиций — например, один сервисный сертификат на несколько плотов ("групповой сертификат").',
        'Откройте сертификат, чтобы задать номер, даты выдачи/окончания (через календарь), прикреплённый файл и связать покрываемые позиции.',
        'У сертификата свой статус срока (красный / жёлтый / зелёный), поэтому он попадает в список «скоро истекает».',
        'В карточке позиции перечислены покрывающие её сертификаты — нажмите ＋ Link, чтобы привязать к позиции существующий сертификат (сохраняется сразу). Покрытые позиции отмечены значком 📜.',
        "Три вкладки: Equipment, Crew и Vessel. Сертификаты экипажа принадлежат ЧЕЛОВЕКУ — STCW, диплом (CoC), медкомиссия ENG1, паспорт, мореходная книжка, виза. Выберите владельца из списка экипажа и нажмите подходящее название (или впишите своё), чтобы один и тот же документ назывался одинаково у всех.",
        "Вкладка Crew группирует сертификаты по людям; выше всех тот, у кого документы истекают раньше. В Settings → Crew то же видно в строке каждого: «3 certificates · 1 expired».",
        "Сертификаты судна — собственные документы корабля: регистрация, SMC, DOC, ISSC, MLC, грузовая марка, safety equipment, радио, IOPP, класс, страховка.",
        "Если включены Expiry reminders, по сертификатам экипажа и судна приходят те же напоминания за 60 / 30 / 7 дней, что и по оборудованию.",
      ],
    },
    {
      emoji: '⏱️',
      title: 'Журнал компрессора ДА',
      body: [
        'Опциональный модуль для компрессора дыхательного воздуха (BA) из состава FIFI — включается в Settings → Modules → BA Compressor log.',
        'Открывается из Settings → Open compressor log или с экрана категории "FIFI Outfit & BA Sets".',
        'До 3 компрессоров. "＋ Add compressor" создаёт юнит, его можно переименовать и переключаться между юнитами чипами сверху.',
        'Запись наработки: выберите "Running", укажите дату, время работы (часы / минуты) и заметку. Каждый запуск прибавляется к общему счётчику наработки, у каждой записи показан накопительный итог Σ.',
        'Обслуживание: выберите Maintenance, Service или Inspection с датой и заметкой. "Adjust starting counter" — для часов, накопленных до начала ведения журнала.',
      ],
    },
    {
      emoji: '📊',
      title: 'Дашборд и статусы',
      body: [
        'Дашборд перечисляет все позиции с датой, по возрастанию срока — самое срочное сверху.',
        `Цвета статуса: красный = Expired (дата в прошлом), жёлтый = Due soon (в пределах ${DUE_SOON_DAYS} дней), зелёный = Valid.`,
        'Нажмите счётчик (Expired / Due soon / Valid), чтобы отфильтровать список по статусу; повторный тап снимает фильтр.',
        'Фильтр по группе (All · LSA · FFE · Other) и сортировка по Expiry date, Position, Name или Type — Position группирует по расположению, а Type — по категории оборудования, каждая с количеством.',
        "У каждой строки ДВЕ метки, по одной с каждого края. Левая полоса — про дату: просрочено, скоро, в силе. Правая — про текущий раунд: синяя ещё не проверялось, зелёная проверено и чисто, жёлтая период на исходе, красная дефект не устранён. Предмет может быть совершенно в дате и при этом не осмотрен — как раз этот случай и нужно видеть.",
        "Красный справа не снимается календарём. Дефект, поднятый в марте, остаётся дефектом в июне: метка держится красной, пока не подписано устранение — смена месяца не должна прятать то, что ищет аудит.",
        "В SORT появился пункт «This period» — и на дашборде, и в списках категорий. Список тогда группируется от худшего: провал, период на исходе, ещё не проверялось, проверено; его читают, чтобы найти несделанное.",
      ],
    },
    {
      emoji: '🔎',
      title: 'Сканирование, флаги и недавно отсканированные',
      body: [
        'Сканируйте QR-этикетку или серийный номер кнопкой QR в шапке экрана Dashboard или вкладки Categories. Совпадение сразу открывает позицию; заводской штрихкод или записанный серийный номер тоже её найдут. Пользуйтесь кнопкой в приложении, а не системной камерой — QR формата ISMpilot это приватная ссылка, которую камера сама открыть не может. Если код повреждён, а цифры ещё читаются, введите их вручную — поиск тот же.',
        "Print label (на экране позиции) печатает QR-этикетку. Полноразмерная этикетка содержит тип и размер (\"CO2 5kg\"), номер позиции и серийный номер (\"No. 01-SD · S/N C001111\"), дату следующей проверки или срока годности, а также категорию с палубой и расположением. На самых маленьких этикетках остаются тип, номер и серийный номер.",
        "Все этикетки сразу печатаются кнопкой с ярлыком рядом с QR-сканером на вкладке Categories (или Settings → Print QR labels). Выберите группу, отметьте палубы и категории — кнопка покажет, сколько это наклеек; следующий экран выбирает размер и куда печатать: на Xprinter по Bluetooth, на термо-рулон, на лист A4 с линиями отреза на офисном принтере или в PDF для приложения другого принтера. Этикетки выходят палуба за палубой, затем по категории и номеру позиции, так что рулон повторяет обход судна. Внутри одной категории вместо этого можно долгим нажатием отметить несколько позиций вручную.",
        'Флаг «вернуться к этому»: откройте позицию и нажмите кнопку Flag рядом со статусом. Флаг — не статус соответствия: позиция может быть полностью в сроке и всё равно требовать второго взгляда (ржавчина, залипающий палец, сомнение). При желании добавьте короткую заметку почему.',
        'На Dashboard есть две полосы быстрого доступа. Flagged показывает то, что команда отметила для второго взгляда; Recently scanned — этикетки, которые вы последними открывали на этом устройстве, новое сверху. Нажмите на заголовок любой, чтобы открыть полный экран; на экране Flagged флаг можно снять, когда с позицией разобрались.',
        "В браузере сканер не трогает камеру, пока его не попросят. На настольной машине код обычно быстрее ввести, а браузер, у которого запросили камеру и не нашли её, просто ждёт и ничего не объясняет — нажмите «Use the camera», когда камера действительно нужна; машина без камеры так и скажет, вместо того чтобы висеть. На телефоне сканер по-прежнему открывается уже глядя.",
      ],
    },
    {
      emoji: '🛟',
      title: 'Интервалы проверок — LSA',
      note: 'Только ориентировочно. Всегда сверяйтесь с флагом судна, классификационным обществом, инструкциями изготовителя и действующими SOLAS / LSA Code / циркулярами MSC. Приложение фиксирует даты — оно не навязывает интервалы.',
      rows: [
        { k: 'Надувные спасательные плоты', v: 'Обслуживание на одобренной станции каждые 12 мес. (продление возможно по схеме, одобренной флагом).', ref: 'SOLAS III/20; LSA Code' },
        { k: 'ГСУ плота (гидростат)', v: 'Замена/обслуживание по изготовителю; одноразовые типы (напр. Hammar H20) — каждые 2 года.', ref: 'SOLAS III/20; maker' },
        { k: 'Спасательные жилеты', v: 'Ежемесячный осмотр; ежегодная тщательная проверка. Огни и надувные узлы обслуживаются ежегодно; картридж/батарея — по сроку.', ref: 'SOLAS III/20; MSC.1/Circ.1304' },
        { k: 'Гидрокостюмы / костюмы защиты от воздействия', v: 'Ежегодная проверка; пневмо- (швов) тест с интервалом ≤ 3 лет для применимых типов.', ref: 'MSC.1/Circ.1047' },
        { k: 'Спасательные круги', v: 'Ежемесячный осмотр; самозажигающиеся огни и дымовые шашки — по сроку.', ref: 'SOLAS III/20' },
        { k: 'АРБ (EPIRB)', v: 'Ежемесячный самотест; ежегодный тест работоспособности; береговое ТО и замена батареи в пределах её срока (≤ 5 лет).', ref: 'SOLAS IV/15; MSC.1/Circ.1040' },
        { k: 'SART', v: 'Ежемесячная проверка; батарея — по сроку.', ref: 'SOLAS IV' },
        { k: 'Пиротехника (ракеты, фальшфейеры, дымы)', v: 'Замена по сроку — обычно 3 года с даты изготовления.', ref: 'SOLAS III; LSA Code' },
        { k: 'Дежурная/спасательная шлюпка + шлюпбалка', v: 'Еженедельные и ежемесячные проверки; ежегодное освидетельствование + рабочий тест; раз в 5 лет динамический тест тормоза лебёдки и переборка разобщающего устройства.', ref: 'SOLAS III/20; Res. MSC.402(96)' },
        { k: 'Спусковые устройства / шлюпбалки', v: 'Ежегодное освидетельствование; раз в 5 лет нагрузочный тест тормоза лебёдки.', ref: 'SOLAS III/20; MSC.402(96)' },
        { k: 'Страховочные привязи / устройства защиты от падения', v: 'Проверка компетентным лицом с интервалом изготовителя (обычно 6–12 мес.).', ref: 'maker / SMS' },
        { k: 'Аварийные выходы (люки, пути эвакуации)', v: 'Еженедельно: путь свободен, люк открывается свободно, знаки и аварийное освещение; ежемесячно: уплотнения, трапы, сопутствующее оборудование. Пути эвакуации должны быть свободны всегда.', ref: 'SOLAS II-2/13; ISM / SMS' },
      ],
    },
    {
      emoji: '🧯',
      title: 'Интервалы проверок — FFE',
      note: 'Только ориентировочно. Сверяйтесь с флагом, классом, изготовителем и действующими SOLAS гл. II-2 / FSS Code и MSC.1/Circ.1432 (с поправками MSC.1/Circ.1622).',
      rows: [
        { k: 'Переносные огнетушители', v: 'Ежемесячный осмотр; ежегодная проверка/обслуживание; периодический разрядный тест и перезарядка; гидротест баллонов CO₂ каждые 10 лет.', ref: 'SOLAS II-2/14; FSS Code; MSC.1/Circ.1432' },
        { k: 'Стационарные системы CO₂ / газовые', v: 'Ежегодная проверка; взвешивание баллонов (перезарядка при потере > 10%); гидротест раз в 10 лет; продувка трубопроводов.', ref: 'FSS Code Ch.5; MSC.1/Circ.1432' },
        { k: 'Пожарная сигнализация и обнаружение', v: 'Периодическая проверка работоспособности извещателей/ручных пунктов; полный тест системы ежегодно.', ref: 'SOLAS II-2; FSS Code Ch.9' },
        { k: 'Противопожарные заслонки / клапаны', v: 'Периодический рабочий тест (обычно ежегодно).', ref: 'MSC.1/Circ.1432' },
        { k: 'Гидранты, рукава, пож. посты, стволы', v: 'Ежемесячный осмотр; пожарные рукава — гидротест ежегодно.', ref: 'SOLAS II-2/14; MSC.1/Circ.1432' },
        { k: 'Дыхательные аппараты (SCBA)', v: 'Ежемесячная проверка давления и работы; ежегодная тщательная проверка; гидротест баллона по изготовителю (сталь ~5 лет; композит по клейму).', ref: 'FSS Code Ch.3; maker' },
        { k: 'EEBD', v: 'Ежемесячная проверка; ежегодный осмотр; замена по указанному сроку службы.', ref: 'SOLAS II-2/13; FSS Code Ch.3' },
        { k: 'Снаряжение пожарного / кошма / пеногенератор', v: 'Ежегодная проверка.', ref: 'FSS Code Ch.3; MSC.1/Circ.1432' },
      ],
    },
    {
      emoji: '🧪',
      title: 'Интервалы проверок — Other',
      rows: [
        { k: 'Станции промывки глаз', v: 'Периодическая проверка; промывочные бутыли — по сроку.', ref: 'maker / SMS' },
        { k: 'Аптечки / мед. наборы', v: 'По требованиям флага / MLC; содержимое — по сроку годности.', ref: 'flag; WHO IMGS' },
        { k: 'Газоанализаторы', v: 'Bump-тест перед использованием; калибровка по изготовителю (напр. раз в 6 мес.) с ежегодной поверкой.', ref: 'maker / SMS' },
        { k: 'Химические / газонепроницаемые костюмы', v: 'Периодический пневмотест по изготовителю.', ref: 'maker' },
        { k: 'Шкаф SOPEP', v: 'Периодическая проверка комплектности; сорбенты/предметы пополняются по мере использования.', ref: 'MARPOL; SMS' },
      ],
    },
    {
      emoji: '✅',
      title: "Инспекции — журнал проверок",
      body: [
        "Откройте позицию — отсканируйте её QR-этикетку или найдите в категории — и нажмите Weekly, Monthly, Quarterly или Annual. Предлагаются только те обходы, которые положены категории на этом судне — расписание задаётся по категориям в Settings → Checklists.",
        "Каждый пункт — PASS / FAIL / N/A. Кнопка «All pass» заполняет весь список одним нажатием, а вы понижаете то, что действительно неисправно. Ничего не проставляется заранее: незаполненный чек-лист не должен выглядеть как пройденный.",
        "Кнопка «Clear all» рядом с «All pass» начинает обход заново: после подтверждения сбрасываются все ответы, комментарий и запись о дефекте. Добавленные фотографии остаются — их удаляют по одной. На этом этапе ничего ещё не подписано, поэтому в деле ничего не меняется.",
        "Перед началом выберите, кто подписывает, из списка экипажа судна — это имя попадёт в запись. Добавьте комментарий и до четырёх фотографий-доказательств: они принадлежат этой инспекции, а не общим фото позиции.",
        "Подпись фиксирует точные дату и время, члена экипажа и версию чек-листа. Подписанную запись не может изменить или удалить никто, включая Мастера: ошибка исправляется новой инспекцией, и обе записи остаются в деле. Именно это делает журнал пригодным для предъявления инспектору.",
        "Любой FAIL поднимает дефект на этой позиции, и он остаётся открытым, пока кто-нибудь не зафиксирует устранение.",
        "Скан перед подписью (Settings → Scan QR label before signing, включает Master). Когда режим включён, Crew и Officer могут подписать проверку только после скана QR-наклейки этой позиции сканером приложения (кнопка QR). Скан действует 30 минут; ввод кода вручную не считается.",
        "Скан по категориям (Settings → Scan by category, включает Master). Правило не обязано касаться всего. Инвентарь спасательной шлюпки или мелкое имущество в пожарном посту стоит вести и отмечать по позициям, но наклеивать метку на каждый черпак и ключ никто не станет — выключите такие категории здесь, и их позиции проверяются и подписываются прямо из списка. Для остальных метку по-прежнему нужно сканировать. Категория, добавленная позже, по умолчанию подпадает под правило, а сделанный всё же скан по-прежнему фиксируется в записи и печатается в колонке Scan отчёта.",
        "Подпись аккаунтом устройства (Settings → Sign as the device's account, включает Master). Когда режим включён, каждый зарегистрированный телефон, планшет или ПК подписывает проверки от имени того, кому он выдан — имя и должность из его аккаунта, — а список подписантов не предлагается. Офицер больше не сможет отсканировать позицию своим телефоном и поставить имя коллеги. Кому принадлежит устройство, Master меняет в Settings → Accounts (переименование); устройство, не присоединённое к судну, по-прежнему выбирает из списка экипажа — у него нет аккаунта, которым подписывать.",
        "Скан записывается в подписанную запись и показывается в колонке Scan отчёта о проверках. Master может подписать без скана (наклейка утеряна, позиция недоступна), но обязан указать причину — она печатается в отчёте рядом с подписью.",
      ],
    },
    {
      emoji: '📋',
      title: 'Свои категории и чек-листы',
      body: [
        'Встроенные категории и чек-листы за ними — отправная точка, а не предел. Судно, чья SMS формулирует проверку иначе — или которое осматривает то, о чём никто больше не спрашивает, — настраивает и то, и другое само, в Settings.',
        'Settings → Categories добавляет свои рубрики: Emergency Lighting, Escape Routes, Alarm Systems — всё, что вы действительно обходите. У рубрики есть группа (LSA / FFE / Other), которая решает, в какой отчёт она попадёт, и иконка. Дальше рубрика ведёт себя как встроенная: свой список, QR-этикетки, чек-листы, отчёты и свой лист в пустом шаблоне импорта — то есть сотня светильников заводится из Excel, а не по одному.',
        "Любую категорию можно переименовать, включая встроенные: категория опознаётся по ключу, который никогда не меняется, поэтому позиции, их история, QR-этикетки и сертификаты остаются на месте, как бы она ни называлась на экране. А категорию, которой на судне нет, можно выключить: Equipment → \"Show or hide categories\" (только Master), отметить ненужные, нажать Done. Скрытая категория уходит и из обходов, и из чек-листов, и из правил скана, и из печати этикеток, и из раздела «не проверено» в отчётах. Ничего не удаляется — позиции остаются в деле со всем, что к ним привязано, и категорию можно вернуть оттуда же или из Settings → Categories.",
        "Отчёт подписывает себя сам: строка «Checked by / Rank / Date» внизу отчёта заполняется теми, кто реально подписал входящие в него проверки. Если обход делали несколько человек — названы все; должность печатается, когда она у них одна, а дата — это последний обход в отчёте, а не день выгрузки. Те же три строки есть в сводке XLSX. Если за период ничего не подписано, пустые линейки остаются — для заполнения от руки.",
        'Settings → Checklists задаёт сами вопросы. Открываете обход — чек-лист уже заполнен: переформулируйте строку, поменяйте порядок, уберите то, чего на вашем судне нет, добавьте то, что требует ваша SMS. Сохраняете — и следующий обход спросит именно это, на всех устройствах судна.',
        "Какие обходы положены категории — решаете вы: недельный, месячный, квартальный и годовой, отдельно по каждой категории. В Settings → Checklists у каждого обхода есть переключатель: выключите — и категории его больше не предлагают, а отчёт перестаёт считать его к сроку; включите обратно — обход возвращается. Кнопка \"＋ Weekly\", \"＋ Monthly\" или \"＋ Quarterly\" рядом с категорией создаёт обход, которого у неё ещё нет, на основе уже имеющихся проверок — например, недельную проверку EEBD или квартальную по путям эвакуации. Поправьте пункты и сохраните: с этого момента экран позиции предлагает этот обход, а недельный, месячный или квартальный отчёт его учитывает. На подписанное это не влияет никак — записи в деле сохраняют свой период и печатаются как прежде. Встроенными такие обходы не делают, потому что иначе обход, добавленный для одного судна, стал бы обязательным для всех.",
        'Делать это может Officer или Master. Сформулировать проверку — работа того, кто ведёт обход; решать, чья подпись действительна, остаётся за Master.',
        'Правка не достаёт до прошлого. Каждая подписанная инспекция несёт свою копию вопросов, под которыми её подписали, поэтому переформулированная сегодня строка не меняет ни одной записи прошлого месяца — откройте её, и она читается ровно так, как её подписывали. Удаление рубрики тоже не удаляет оборудование: позиции и их история остаются, и возврат рубрики возвращает их.',
      ],
    },
    {
      emoji: '🛠️',
      title: "Дефекты",
      body: [
        "Полоса Open defects на дашборде показывает всё, по чему ещё есть работа: фильтр LSA / FFE, новые сверху, с возрастом каждого дефекта.",
        "Дефект — это не флаг на позиции, а сама проваленная инспекция. Поэтому он всегда отвечает, что именно не так, кто это нашёл и когда.",
        "Откройте дефект и нажмите «Record rectification», когда работа сделана — устранение тоже подписывается и штампуется. Устранённые дефекты остаются доступны по переключателю: на аудите «нашли и исправили» звучит лучше, чем молчание.",
        "У каждого дефекта есть причина — провалившиеся строки чек-листа. Они видны на карточке, в полосе на дашборде и в отчёте, в графе «What failed». Заметка офицера добавляется к ним, а не заменяет их: дефект, поднятый без заметки, всё равно говорит, что именно не так.",
      ],
    },
    {
      emoji: '📤',
      title: 'Отчёты и экспорт',
      body: [
        'Откройте вкладку Reports и нажатием панелей категорий выберите, что включить ("Select all" / "Clear all" — все сразу). Счётчик показывает, сколько позиций будет выгружено.',
        "Экспорт в PDF или XLSX (имя файла MSM_report_DDMMYY): номер позиции, тип, размер, серийный номер, расположение, даты, статус и комментарии. PDF — в альбомной ориентации, каждая позиция в одну строку; в XLSX Make, Deck и Location идут отдельными столбцами, так что файл импортируется обратно без правок.",
        'Export ZIP (PDF + photos) кладёт в MSM_backup_DDMMYY.zip сам PDF, все прикреплённые фото/документы и файлы сертификатов, покрывающих позиции (с certificates/INDEX.txt, где указано, какой сертификат к каким позициям относится).',
        'Print отправляет отчёт на принтер через системный диалог печати — или "Save to PDF". Экспорт открывает системное окно «Поделиться».',
        "Reports → Inspections — запись о том, что было сделано. Выберите группу (LSA, FFE, Other или All) и Weekly или Monthly, затем стрелками ‹ › перейдите к любому прошлому месяцу или неделе; \"Back to current\" возвращает к текущему. Цифры на экране — те же, что будут напечатаны.",
        "Под группой перечислены категории, у которых есть проверка этого периода, с прогрессом — «5 of 5 inspected · complete», «3 of 12» или «failed». Нажмите, чтобы включить или исключить категорию; нажмите и удерживайте, чтобы отчёт был ТОЛЬКО по ней. Так проверка спасательных кругов подшивается отдельной страницей: отчёт называется по категории и содержит только её позиции — проверенные, непроверенные и открытые дефекты по ним. «Whole group» возвращает всё.",
        "Отчёт начинается с итога — например, \"September 2026 Monthly Inspection – Completed – Passed\" или \"Incomplete (12 of 40 inspected)\" и \"Failed\", если так оно и есть. Эту строку и подшивают как подтверждение в систему планового обслуживания (PMS). Каждая позиция оценивается по последней инспекции за период, так что устранённое и повторно проверенное замечание не засчитывается против неё.",
        "Проведённые инспекции перечислены со столбцами No., Location, Category, Type, Size, Serial, Result, Comments, Initials инспектора, Date и Time; под таблицей — расшифровка инициалов. Написанное в Comments во время инспекции — и что не прошло проверку — переносится в отчёт. Далее идут позиции, не проверенные за период, и все незакрытые дефекты.",
        "В отчёте о проверках есть колонка Scan: QR — наклейку отсканировали перед подписью, No scan — Master подписал без скана (причина в Comments). XLSX реестра содержит колонку MSM ID — сохраните её при редактировании файла, и Import → Update снова найдёт каждую позицию.",
      ],
    },
    {
      emoji: '💾',
      title: 'Резервная копия и восстановление',
      body: [
        'Settings → Export backup (.msm) создаёт один файл со всем на устройстве: позиции, сертификаты, журналы компрессоров, данные судна и прикреплённые файлы внутри (MSM_backup_DDMMYY.msm).',
        'Restore backup (.msm) воссоздаёт данные на другом устройстве или после переустановки — заменяет все текущие данные, поэтому восстанавливайте на чистое устройство.',
        'Бэкап работает без облака. Настройки устройства (например, тумблер модуля компрессора) в бэкап не входят.',
        "Кроме этого приложение при каждом открытии делает СЛЕПОК записей и хранит на устройстве три последних. Settings → Data → «Roll back to …» прямо называет момент, к которому вернёт. Он существует ради аварий, которых никто не планирует — восстановили не тот файл, опустошили регистр, — и это та копия, которая действительно окажется под рукой: никто не делает экспорт утром накануне ошибки.",
        "Слепок несёт ЗАПИСИ, а не файлы. Фотографии и документы остаются на устройстве под своими именами и не теряют связи, поэтому откат не заменяет настоящую копию, унесённую на другую машину.",
        "Пустой регистр никогда не затирает хороший слепок: если приложение открылось на пустоте, уже сохранённые копии сохраняются.",
        "Восстановление и откат — права Мастера: они заменяют регистр и отдают его судну, то есть переписывают то, с чем уже работали другие офицеры. У офицера остаются импорт и экспорт. Устройство, не вступившее на судно, сохраняет всё: его регистр принадлежит только ему.",
      ],
    },
    {
      emoji: '🗑️',
      title: 'Сброс всех данных',
      note: 'Сначала сделайте Export backup (.msm), если данные ещё могут понадобиться — сброс необратим.',
      body: [
        'Внизу Settings кнопка "Reset all data" безвозвратно удаляет все позиции, сертификаты, журналы компрессоров, прикреплённые файлы и данные судна на этом устройстве.',
        'Защищено паролем: введите пароль "Reset all data" в точности, чтобы активировать кнопку подтверждения. Тап вне окна или Cancel — отмена.',
        'Настройки устройства и согласие с Privacy Policy / Terms сохраняются; удаляются только данные реестра.',
        "Сброс — право Мастера, и на синхронизированном устройстве он очищает не аппарат, а СУДНО. Подтверждение говорит об этом прямо, а кнопка называется «Erase everywhere»: за секунды это доходит до судового регистра и до всех остальных приборов на борту.",
        "Чтобы очистить только это устройство, сначала выйдите с судна: Settings → This device → «Sign off & erase». Судовая копия остаётся нетронутой.",
        "Сброс стирает и автоматические слепки — иначе «удалить всё» было бы неправдой.",
      ],
    },
    {
      emoji: '🔑',
      title: "Вступление на судно, аккаунты и роли",
      body: [
        "Судно определяется номером IMO (Настройки → Vessel). Всё остальное следует из него, а карточка вверху настроек всегда называет следующий шаг.",
        "ПЕРВОЕ устройство вступает по стартовому коду, который поставляется с лицензией, и становится Мастером.",
        "Дальше Мастер выдаёт каждому члену экипажа аккаунт в Настройки → Accounts: имя и восьмизначный PIN. PIN остаётся видимым в списке, чтобы его можно было продиктовать повторно, и его можно перевыпустить или отозвать по одному человеку.",
        "Остальные вводят IMO, затем вступают из карточки «This device» вверху Настроек — своим именем и PIN. Устройство попадает в очередь; Мастер одобряет его в Accounts → Devices, и ожидающее устройство само замечает это за несколько секунд — без перезапуска и без повторного ввода.",
        "Три роли: Crew проводит инспекции, Officer вдобавок закрывает дефекты, Master вдобавок выдаёт аккаунты и меняет роли. Роли проверяются сервером, а не только приложением.",
        "Потеряли телефон? Мастер выключает это устройство в Accounts → Devices. Остальных это не касается, пароли менять не нужно.",
        "В приглашении можно указать и ДОЛЖНОСТЬ на судне — Third Officer, Bosun, Chief Engineer. Это намеренно не то же самое, что роль: второй механик может иметь учётку Crew, а курсант — Officer, поэтому повышение на борту не превращается в изменение прав. Должность едет вместе с человеком на экран вступления и в список подписантов, так что ни имя, ни должность не набираются дважды.",
        "После вступления Settings → This device показывает, кем устройство подписывает: имя, должность и одобрено ли оно. Читается живьём с судна, поэтому должность, изменённая Мастером через час, появится сама.",
        "«Sign off this device» — выход с судна с этого аппарата. Синхронизация прекращается сразу, и обратно устройство само себя не впустит: нужно новое приглашение и одобрение Мастера. «Sign off & erase» вдобавок стирает регистр на этом аппарате — для случая, когда его передают другому или продают. Ни то, ни другое не начинает бесплатный период заново: он принадлежит судну, а не устройству.",
        "Интерфейс следует рангу. Аккаунты, список экипажа и список устройств — права Мастера, остальным они не предлагаются. Сервер такие записи всё равно отклонял; кнопка, которая всегда падает, лишь сообщает неправду о ваших собственных полномочиях.",
        "Если Мастер удалил устройство, оно так и скажет и предложит вступить заново — а не будет висеть на ошибке связи, с которой ничего нельзя сделать. Для возврата нужно новое приглашение, как и в первый раз.",
      ],
    },
    {
      emoji: '🧭',
      title: "Доступ — какие вкладки видит устройство (Access)",
      body: [
        "Settings → Access (только Мастер) — таблица: строка на каждое устройство, столбец на каждую вкладку — Certificates, PMS, Rest, Reports. Зелёная точка — вкладка на этом устройстве есть, красная — нет. Нажмите, чтобы переключить; устройство подхватит при следующей синхронизации.",
        "Так у каждого на экране только нужное: у матроса нет плана ТО машинного отделения, у механика — сертификатов экипажа.",
        "Dashboard, Equipment и Settings включены всегда. На устройстве Мастера всегда все вкладки. Устройство, которое Мастер ещё не настраивал, показывает все вкладки — при обновлении ничего не пропадёт.",
        "Это порядок, а не замок: что устройство может менять, по-прежнему решает его роль в Accounts, и это проверяет сервер.",
      ],
    },
    {
      emoji: '📚',
      title: "ISM-документы",
      body: [
        "Вкладка Docs хранит управляемые документы судна — руководство SMS, процедуры, циркуляры, постоянные распоряжения капитана, политики, формы — у каждого номер, ревизия, дата выпуска и дата пересмотра. Документ — это файл (PDF из офиса), текст, написанный на борту, или и то и другое.",
        "Сверху — то, что человеку на этом устройстве ещё нужно прочитать. Откройте документ, прочитайте и нажмите I have read and understood: это подпись за текущую ревизию, подтверждаемая как любая другая.",
        "У каждого документа видно, сколько человек из списка экипажа подписали и кто ещё нет. Подписи никогда не удаляются.",
        "Офицеры и Мастер добавляют и правят документы. New revision переводит его в Rev N+1 и просит всех прочитать и подписать заново; подписи прошлых ревизий остаются в истории. Исправление опечатки в той же ревизии этого не делает.",
        "Файлы попадают на все устройства через судно. Если файл не удалось загрузить (нет связи), документ сохраняется, а файл остаётся на устройстве, которое его прикрепило, пока его не сохранят снова при связи.",
      ],
    },
    {
      emoji: '🏢',
      title: "Береговая консоль (суперинтендант)",
      body: [
        "Для суперинтенданта в офисе: одна консоль со всеми его судами, сначала проблемные — просроченное и подходящее оборудование, сертификаты (судна, экипажа, оборудования), ТО, запчасти и ISM-документы, которые ещё не подписаны.",
        "Доступ даёт Мастер каждого судна: в Accounts выдать аккаунт типа Superintendent (shore). Суперинтендант открывает Fleet (app.ismpilot.com/fleet), вводит IMO, имя и PIN — судно добавлено; следующие суда добавляются так же. Мастер видит этот аккаунт в Devices и может отключить его в любой момент.",
        "Откройте судно, чтобы добавлять и править его сертификаты и ISM-документы, выпускать новую ревизию и видеть, кто не подписал. Изменения приходят на устройства на борту при следующей синхронизации. Оборудование — только для просмотра: его проверяют на борту.",
      ],
    },
    {
      emoji: '✍️',
      title: "Подтверждённые подписи",
      body: [
        "Если Мастер включил Settings → Confirm every signature, каждая подпись — проверка, работа ТО, движение склада — подтверждается: отпечатком или лицом на своём устройстве либо своим PIN подписи.",
        "Отпечаток и лицо доступны, только когда устройство подписывает как свой аккаунт. Телефон знает, что приложен сохранённый палец, но не чей — поэтому на общем планшете каждый подписывает своим PIN.",
        "При первой подписи на устройстве вы выбираете PIN подписи из 4–6 цифр. Это не PIN аккаунта; он хранится только в виде хеша, и прочитать его не может никто, включая Мастера. Пять неверных попыток блокируют его на пять минут. Забыли — Мастер сбрасывает его в Settings, и вы выбираете новый.",
        "В отчёте рядом с именем указано, чем подтверждена подпись (PIN или биометрия).",
      ],
    },
    {
      emoji: '🛏️',
      title: "Часы отдыха (Hours of rest)",
      body: [
        "Вкладка Rest записывает работу и отдых каждого человека по получасам, по судовому времени. Экран открывается на человеке, которому принадлежит устройство; Мастер может переключиться на любого, чтобы проверить или поправить его месяц.",
        "Нажмите день, выберите «перо» (Tap marks WORK / Tap marks REST) и проведите нажатиями по часам — или заполните день одним нажатием: Same as previous day, Day work 08–17, три вахтенных графика, Day off. При переходе на соседний день текущий сохраняется.",
        "Правила проверяются во время ввода, вместе с соседними днями: не менее 10 ч отдыха за любые 24 ч и 77 ч за любые 7 дней; отдых не более чем в двух периодах, один не короче 6 ч; не более 14 ч между периодами отдыха (MLC 2006 Reg. 2.3, STCW A-VIII/1). Окна скользящие, поэтому нарушение через полночь тоже видно. Проверка ориентировочная: исключения, допускаемые флагом (учения, аварии), решает Мастер — запишите их в Note дня.",
        "День без записи показан как «Not recorded» и никогда не считается отдыхом.",
        "Monthly record (PDF) печатает месяц в привычной форме — строка на день, работа закрашена, итоги, нарушения — с местами для подписи моряка и Мастера.",
      ],
    },
    {
      emoji: '⚙️',
      title: "Планово-предупредительное ТО (Planned maintenance)",
      body: [
        "Вкладка PMS (или полоска Maintenance на дашборде) — механизмы: главные двигатели, генераторы, опреснитель, компрессоры, насосы, стабилизаторы — у каждого счётчик моточасов и свои работы.",
        "У работы интервал в моточасах, в днях или и то и другое; срок наступает по тому, что раньше, как пишут производители («каждые 250 ч или 12 месяцев»). Один раз укажите, когда она делалась последний раз — дата и счётчик; дальше Record as done сдвигает это сам. Работа, которая ни разу не делалась, показывает «Never done» вместо даты.",
        "Показания счётчика вводятся на экране механизма (Save reading). По последним показаниям считается среднее в сутки, поэтому у работы по часам видно и примерно сколько дней осталось. Показание меньше прошлого не принимается: заменённый счётчик — это новый механизм.",
        "«Скоро» — последние 10 % интервала, а не 60 дней, как у оборудования: иначе ежемесячная работа была бы «скоро» с первого же дня.",
        "Typical jobs добавляет обычный список для типа механизма. Интервалы типовые, не от производителя: сверьте каждый с инструкцией и поправьте.",
        "Record as done подписывает выполнение — дата, счётчик, примечание, ваше имя — в историю механизма. Как и проверку, её нельзя изменить или удалить; ошибка исправляется повторной записью. При удалении механизма или работы история сохраняется.",
      ],
    },
    {
      emoji: '📦',
      title: "Запчасти (Spare parts)",
      body: [
        "Вкладка Spares — это склад: у каждой позиции название, партномер, производитель, место хранения и минимальный остаток. Список сгруппирован по местам хранения, сначала то, чего нет или мало; кнопка To order оставляет только такие позиции.",
        "Остаток никогда не вводится поверх. Откройте запчасть: + Received — поступление, − Used — взято вне плана ТО, Stocktake — сколько физически на полке. Каждое действие — подписанное движение, а остаток — их сумма, поэтому если два устройства записали одновременно, учтутся оба.",
        "Пересчёт записывается как разница с учётом, поэтому пересчёт без связи не отменит поступление, записанное в это время на другом устройстве. Ошибочное движение исправляется пересчётом; движения не редактируются.",
        "Отметьте, к каким механизмам подходит запчасть: в карточке механизма будет список его запчастей с остатком. В работе ТО раздел Parts used each time перечисляет, что она расходует; Record as done списывает это со склада, а количество можно поменять или поставить 0 в день работы.",
        "На главном экране появляется строка, когда что-то закончилось или ниже минимума.",
      ],
    },
    {
      emoji: '☁️',
      title: "Синхронизация и фото инспекций",
      body: [
        "После вступления синхронизация идёт сама — кнопок Push / Pull больше нет. Подписали запись — через секунды она на других устройствах судна; приложение полностью работает офлайн и догоняет, когда связь вернётся.",
        "Записи инспекций только дополняются, поэтому два офицера на двух телефонах не затрут работу друг друга. Реестр оборудования — один общий документ: если двое правят ОДНУ позицию одновременно, побеждает более поздняя правка.",
        "Фотографии уменьшаются при съёмке и ставятся в очередь. Настройки → Inspection photos: только Wi-Fi (по умолчанию), любое соединение или никогда. В море за трафик платит судно, поэтому запись уходит сразу, а снимки догоняют в порту.",
        "В облаке фотография хранится 90 дней. Дальше её хранит судно: Настройки → Inspection photos → Photo archive сохраняет месяц одним ZIP — сами снимки плюс список: позиция, обход, результат, кто подписал. Положите файл туда, где судно держит документы, и подтвердите — после этого за ночь эти фотографии удаляются из облака. Из неподтверждённого месяца не удаляется ничего, с телефонов и планшетов не удаляется ничего никогда, а подписанные записи — проверки, отчёты, резервная копия .msm — всё это не затрагивает. Подтверждает Master; сохранить копию может любой.",
        "Вложенные файлы по-прежнему переносятся в .msm-бэкапе — это способ перенести всё между устройствами без связи.",
        "Фотографии и прикреплённые документы больше не едут внутри регистра — они уходят в хранилище, а в записи остаётся ссылка. Документ Firestore ограничен 1 МиБ, и двух снимков хватало, чтобы остановить синхронизацию всего судна.",
        "Судну без лицензии доступно 25 выгруженных файлов. Это единственное ограничение, которое действует и во время пробного периода: снимки судна лежат на нашем счёте за хранилище. На устройстве не запрещено ничего — снимки делаются, хранятся, показываются и попадают в .msm-бэкап как раньше; ждёт только копия для других устройств, и всё придержанное уходит первой же синхронизацией после оплаты. Остаток показан в Settings → Inspection photos.",
      ],
    },
    {
      emoji: '🔔',
      title: 'Напоминания о сроках',
      body: [
        'Settings → Modules → Expiry reminders планирует локальные уведомления за 60, 30 и 7 дней до даты проверки или истечения каждой позиции.',
        'При первом включении разрешите уведомления. Напоминания автоматически синхронизируются при добавлении, изменении или импорте позиций.',
        'Работают только на устройстве (интернет не нужен). При большом реестре сначала планируются ближайшие напоминания, список дозаполняется по мере прохождения дат.',
      ],
    },
    {
      emoji: '🎨',
      title: 'Оформление (темы)',
      body: [
        'Settings → Appearance переключает тему: Light (по умолчанию), Dark и Colorful.',
        'Settings → Modules → Sounds выключает или включает все звуки — корабельный колокол при запуске и сигналы при сохранении, подписи и ошибке. Выбор запоминается на этом устройстве; длинный обход проходит тише.',
        'Colorful красит иконки оборудования по группам — LSA зелёный, FFE красный, Other бирюзовый. Выбор сохраняется и применяется во всём приложении.',
        'На планшетах списки Dashboard, Equipment, Certificates и Reports автоматически показываются в две колонки.',
      ],
    },
    {
      emoji: '👑',
      title: "Лицензия на судно",
      body: [
        "ISMpilot Pro лицензируется на СУДНО. Лицензия привязана к кораблю по номеру IMO, не к человеку и не к устройству. Все офицеры и все телефоны, вступившие на судно, покрыты одной лицензией.",
        "У каждого судна есть 60 дней, чтобы попробовать приложение, прежде чем начнёт действовать лимит 15 позиций на категорию.",
        "Цены и лицензии для флота: mail@ismpilot.com.",
        "Лицензию покупает один раз тот, кто ведёт судно, и активирует её на аккаунте корабля: Настройки → ISMpilot Pro → Activate the vessel licence. С этого момента полный доступ есть у всех вступивших устройств; члену экипажа покупать нечего.",
        "Без лицензии после бесплатного периода приложение продолжает работать, но реестр ограничен 15 позициями на категорию — этого хватает попробовать, но не хватает вести судно.",
        "Устройство, подключённое к судну с лицензией, получает её автоматически. Если оно всё же показывает страницу активации, откройте её и нажмите Restore the vessel licence.",
      ],
    },
    {
      emoji: 'ℹ️',
      title: 'О приложении',
      body: [
        aboutLine('ru'),
        'Приложение — вспомогательный инструмент учёта. Оно не заменяет официальную судовую документацию по безопасности, обязательные освидетельствования и требования класса/флага. Всегда следуйте СУБ компании и применимым правилам.',
      ],
      link: APP_CONFIG.website,
      watermark: true,
    },
  ],
};

// ---------------------------------------------------------------- Español ----
const es: ManualContent = {
  screenTitle: 'Manual de usuario',
  screenSubtitle: 'Cómo usar la aplicación',
  sections: [
    {
      emoji: '⚓',
      title: 'Primeros pasos',
      body: [
        `${APP_CONFIG.name} reúne los dispositivos de salvamento (LSA) y los equipos contra incendios (FFE/FIFI) del buque en un solo lugar, con seguimiento de inspecciones y caducidades.`,
        "Los equipos se agrupan en cuatro registros: LSA, FFE, Other y Lifting & Mooring. Cada elemento tiene su propio número, tipo y tamaño, fabricante, número de serie/ID, cubierta y ubicación, y las fechas que determinan el cumplimiento.",
        "Lo más rápido para empezar: Settings → Import from Excel. Traiga su lista tal como está — una hoja con columnas como #, Deck, Location, Description, Make, Type, Size, Serial y Exp / Inspc. se reparte en categorías según la descripción de cada elemento — o pulse Download blank template (una hoja por categoría) y rellénela. En ambos casos verá lo encontrado antes de guardar nada. Los datos quedan en el dispositivo y, opcionalmente, se sincronizan con la nube.",
      ],
    },
    {
      emoji: '📥',
      title: 'Importar desde Excel',
      body: [
        "Settings → Import from Excel → elija su libro .xlsx. Una hoja con el nombre de una categoría (Liferafts, Lifejackets, Fire extinguishers, …) se asigna a esa categoría automáticamente.",
        "También sirve su propio formato. Una hoja que no lleva el nombre de una categoría — normalmente una lista única de todo, cubierta por cubierta — se lee por sus cabeceras de columna (#, Deck, Location, Description, Make, Type, Size, Serial, Exp / Inspc., Comments …) y cada fila va a su categoría según lo que es el elemento: \"Fire extinguisher\" a Fire Extinguishers, \"EEBD\" a EEBD. Lo que no se puede reconocer va a Other Safety Equipment. La pantalla de importación indica las hojas repartidas de este modo.",
        "\"#\" se lee como número del elemento si la hoja también tiene una columna Serial, y como número de serie si no la tiene. \"Exp / Inspc.\" rellena la fecha por la que se evalúa la categoría — Next inspection o Expiry. Las filas de sección como \"Sun Deck\" entre los elementos se omiten.",
        '¿Aún no tiene libro? Pulse "Download blank template (.xlsx)" en la pantalla de importación (o Settings → Download import template) — una hoja por categoría con las cabeceras correctas — complételo e impórtelo.',
        'Antes de guardar verá una vista previa de cuántos elementos se hallaron por categoría.',
        'Elija "Update" para ajustar un registro existente al archivo: cada fila encuentra el elemento que ya es (por MSM ID, luego número de serie, luego número y ubicación), se aplican las celdas cambiadas, se añaden las filas nuevas y los elementos conservan sus etiquetas QR, fotos e historial de inspecciones. Los elementos que están en el registro pero no en el archivo se listan, y solo se eliminan si lo activa.',
        'Para trabajar la lista poco a poco: Reports → exporte el registro a Excel, edite ese archivo (tiene una columna "MSM ID"; no la modifique) e impórtelo aquí con "Update". Añada filas nuevas con el MSM ID vacío.',
        '"Replace all" sustituye el registro por el archivo; "Add as new" añade todas las filas junto a lo existente.',
        "Las fechas escritas como números de serie de Excel, años (p. ej. \"2034\"), DD/MM/AAAA o mes y año (p. ej. \"Jun/26\", leído como el día 1 de ese mes) se convierten automáticamente. Puede editar cualquier elemento después.",
      ],
    },
    {
      emoji: '🧰',
      title: 'Equipos y categorías',
      body: [
        'La pestaña Equipment muestra una cuadrícula de todas las categorías con el recuento de elementos y un punto de color con el peor estado del interior.',
        "Pulse una categoría para ver sus elementos — cada fila empieza por el número, p. ej. \"No. 01-SD — CO2 5kg\". Busque por número, tipo, fabricante, tamaño, serie, cubierta o ubicación. Pulse ＋ para añadir un elemento a mano.",
        "Un elemento registra Item No., Type / Description, Make, Size (texto libre — 5kg, 9L, XL, 150N), Serial / ID, Deck y Location, cantidad o personas, sus fechas y Comments. El número del elemento se muestra grande arriba en la pantalla del elemento y en la de inspección: entre cuarenta extintores idénticos es lo único que los distingue.",
        'Las fechas se fijan con un calendario — pulse el campo y elija año, mes y día.',
        'Las insignias junto a un elemento muestran un clip por cada archivo adjunto (📎) y 📜 cuando lo cubre un certificado.',
        'Las categorías de lista de control (Hydrants, BA Bottle Pressure, Fire Detectors) tienen casillas mensuales en la ficha del elemento.',
        'Dentro de una categoría, ordene por Expiry date, Position, Name (A–Z) o Type — Position y Type agrupan los elementos bajo encabezados. En tabletas la lista se muestra en dos columnas.',
        "\"Other Safety Equipment\" es el cajón de sastre: todo lo que las hojas estándar no nombran — una bomba portátil, una carga de repuesto, una taquilla de material que nadie más cuenta. Añada elementos a mano con ＋; una fila importada que no se puede reconocer también acaba aquí. Funciona como cualquier otra categoría — vencimientos, etiquetas QR, inspecciones, informes.",
      ],
    },
    {
      emoji: '📎',
      title: 'Fotos y documentos',
      body: [
        'Cada elemento admite hasta 4 adjuntos — fotos o documentos (PDF, etc.) — en el bloque "Photos & documents" de la ficha.',
        'Pulse la casilla punteada ＋ Add para tomar una foto, elegir de la galería o seleccionar un documento.',
        'Pulse una foto para abrirla a pantalla completa (Open / Share); pulse un documento para abrirlo en el visor del sistema.',
        'Mantenga pulsado un adjunto para su menú de edición — Download / Share, Rename, Replace o Delete.',
      ],
    },
    {
      emoji: '🪝',
      title: "Lifting & Mooring (izado y amarre)",
      body: [
        "Los equipos de izado y amarre viven en la misma aplicación que LSA y FFE: una cuenta, una lista de tripulación, unas etiquetas QR, un solo lugar para las evidencias. Aparecen en el Dashboard, en la pestaña Equipment, en los informes y en la plantilla de importación de Excel como cualquier otro registro.",
        "Ocho categorías: Mooring Equipment, Working Aloft Equipment, Cranes, Hooks & Cables, Deck Slings & Shackles, Engineering Lifting Equipment, Working Aloft Anchors, Interior Lifting Eyes & Beams.",
        "Cada categoría tiene una ronda ANUAL — el examen en el que se apoya el certificado: el equipo coincide con el registro (ID, SWL/WLL, ubicación), el examen exhaustivo / prueba de carga está en fecha, el certificado está adjunto y legible, el desgaste está dentro de los límites del fabricante y todo lo dudoso se retira y se etiqueta.",
        "Mooring Equipment y Working Aloft Equipment tienen además una ronda TRIMESTRAL — la revisión del equipo en uso constante, más el marcado SWL/WLL, el certificado de prueba y los daños visibles.",
        "Anote la fecha del próximo examen para que la certificación del buque venza en un mismo periodo anual y no dispersa a lo largo del año.",
        "Por defecto nada es mensual. Un buque que trabaja de otra forma añade una ronda — también mensual — o cambia la redacción en Settings → Checklists.",
      ],
    },
    {
      emoji: '📜',
      title: 'Certificados',
      body: [
        'La pestaña Certificates guarda documentos que cubren varios elementos a la vez — p. ej. un único certificado de servicio de balsas para varias balsas ("certificado de grupo").',
        'Abra un certificado para fijar su número, fechas de emisión/caducidad (con el calendario) y archivo adjunto, y vincular los elementos que cubre.',
        'El certificado tiene su propio estado de caducidad (rojo / ámbar / verde), por lo que aparece en su vista de «próximos a vencer».',
        'En la ficha de un elemento se listan los certificados que lo cubren — pulse ＋ Link para vincular un certificado existente a ese elemento (se guarda al instante). Los elementos cubiertos muestran una insignia 📜.',
        "Tres pestañas: Equipment, Crew y Vessel. Los certificados de tripulación pertenecen a una PERSONA — STCW, título (CoC), reconocimiento médico ENG1, pasaporte, libreta marítima, visado. Elija el titular de la lista de tripulación y pulse un nombre sugerido (o escriba el suyo), para que el mismo documento se llame igual para todos.",
        "La pestaña Crew agrupa los certificados por persona; arriba, quien tiene documentos que caducan antes. En Settings → Crew se ve lo mismo en cada fila: «3 certificates · 1 expired».",
        "Los certificados del buque son los documentos propios del barco: registro, SMC, DOC, ISSC, MLC, francobordo, equipo de seguridad, radio, IOPP, clase, seguro.",
        "Con Expiry reminders activado, los certificados de tripulación y del buque reciben los mismos avisos a 60 / 30 / 7 días que los equipos.",
      ],
    },
    {
      emoji: '⏱️',
      title: 'Registro del compresor ABA',
      body: [
        'Módulo opcional para el compresor de aire respirable (ABA) del equipo FIFI — actívelo en Settings → Modules → BA Compressor log.',
        'Ábralo en Settings → Open compressor log o desde la categoría "FIFI Outfit & BA Sets".',
        'Hasta 3 compresores. "＋ Add compressor" crea una unidad, puede renombrarla y cambiar de unidad con los chips superiores.',
        'Registrar marcha: elija "Running", la fecha, el tiempo de marcha (horas / minutos) y una nota. Cada marcha se suma al contador total de horas, con un total acumulado Σ en cada entrada.',
        'Registrar mantenimiento: elija Maintenance, Service o Inspection con fecha y nota. Use "Adjust starting counter" para las horas acumuladas antes de empezar el registro.',
      ],
    },
    {
      emoji: '📊',
      title: 'Panel y estados',
      body: [
        'El panel lista todo elemento con fecha, ordenado por vencimiento más próximo primero.',
        `Colores de estado: rojo = Expired (fecha pasada), ámbar = Due soon (dentro de ${DUE_SOON_DAYS} días), verde = Valid.`,
        'Pulse un contador (Expired / Due soon / Valid) para filtrar la lista por ese estado; púlselo de nuevo para quitarlo.',
        'Filtre por grupo (All · LSA · FFE · Other) y ordene por Expiry date, Position, Name o Type — Position agrupa por ubicación y Type por categoría de equipo, cada una con recuento.',
        "Cada fila lleva DOS marcas, una en cada borde. La barra izquierda es la fecha: caducado, próximo, vigente. La derecha es la ronda actual: azul aún sin inspeccionar, verde firmada y limpia, ámbar el periodo se cierra, roja un defecto sin resolver. Un elemento puede estar perfectamente en fecha y sin inspeccionar, y ese es justo el caso que conviene ver.",
        "El rojo de la derecha no lo borra el calendario. Un defecto abierto en marzo sigue siéndolo en junio: la marca permanece roja hasta que se firma la rectificación.",
        "SORT incluye «This period» en el panel y en las listas de categoría: la lista se agrupa de peor a mejor — fallado, periodo cerrándose, sin inspeccionar, inspeccionado.",
      ],
    },
    {
      emoji: '🔎',
      title: 'Escaneo, marcas y escaneados recientes',
      body: [
        'Escanee una etiqueta QR o un número de serie con el botón QR en la cabecera del Panel o de la pestaña Categories. Una coincidencia abre el equipo de inmediato; un código de barras del fabricante o un número de serie registrado también lo encuentran. Use el botón de la app y no la cámara del teléfono: un QR de ISMpilot es un enlace privado que la cámara no puede abrir por sí sola. Si el código está muy dañado y aún puede leer los dígitos, escríbalos — la misma búsqueda.',
        "Print label (en la pantalla del elemento) crea la etiqueta QR. La etiqueta de tamaño completo lleva el tipo y tamaño (\"CO2 5kg\"), el número y la serie (\"No. 01-SD · S/N C001111\"), la fecha de la próxima inspección o de caducidad, y la categoría con cubierta y ubicación. Los formatos más pequeños conservan el tipo, el número y la serie.",
        "Imprima todas las etiquetas de una vez con el botón de etiquetas junto al escáner QR en la pestaña Categories (o Settings → Print QR labels). Elija un grupo, marque cubiertas y categorías, y el botón dice cuántas pegatinas son; la siguiente pantalla elige el formato y dónde imprimir: la Xprinter por Bluetooth, un rollo térmico, una hoja A4 de etiquetas con líneas de corte en la impresora de la oficina, o un PDF para la app de otra impresora. Las etiquetas salen cubierta por cubierta, luego por categoría y número, de modo que el rollo sigue el recorrido del barco. Dentro de una categoría, mantenga pulsado un elemento para elegir unos pocos a mano.",
        'Marque «volver a esto»: abra un equipo y pulse el botón Flag junto al estado. Una marca no es un estado de cumplimiento: un equipo puede estar en fecha y aun así necesitar una segunda mirada (óxido, un pasador duro, una duda). Añada una nota breve del motivo si ayuda.',
        'El Panel muestra dos tiras de acceso rápido. Flagged enumera lo que la tripulación marcó para revisar; Recently scanned enumera las etiquetas que abrió por última vez en este dispositivo, la más reciente primero. Pulse cualquier encabezado para abrir su pantalla completa; en la pantalla Flagged puede quitar la marca cuando el equipo ya esté atendido.',
        "En el navegador el escáner no toca la cámara hasta que se lo pida. En un ordenador de mesa suele ser más rápido teclear el código, y un navegador al que se le pide una cámara que no encuentra simplemente espera sin explicar nada — pulse «Use the camera» cuando de verdad la necesite; una máquina sin cámara lo dirá en lugar de quedarse colgada. En el teléfono el escáner se abre mirando, como antes.",
      ],
    },
    {
      emoji: '🛟',
      title: 'Intervalos de inspección — LSA',
      note: 'Solo orientativo. Verifique siempre con el Estado de abanderamiento, la sociedad de clasificación, las instrucciones del fabricante y los vigentes SOLAS / Código IDS / circulares MSC. La app registra fechas — no impone intervalos.',
      rows: [
        { k: 'Balsas salvavidas inflables', v: 'Servicio en estación aprobada cada 12 meses (prórroga posible bajo un esquema aprobado por el Estado de abanderamiento).', ref: 'SOLAS III/20; LSA Code' },
        { k: 'Zafa hidrostática de balsa (HRU)', v: 'Sustituir/servir según fabricante; tipos desechables (p. ej. Hammar H20) cada 2 años.', ref: 'SOLAS III/20; maker' },
        { k: 'Chalecos salvavidas', v: 'Inspección visual mensual; revisión anual a fondo. Luces y unidades inflables se sirven anualmente; cartucho/batería al caducar.', ref: 'SOLAS III/20; MSC.1/Circ.1304' },
        { k: 'Trajes de inmersión / protección', v: 'Inspección anual; prueba de presión de aire (costuras) a intervalos ≤ 3 años en los tipos aplicables.', ref: 'MSC.1/Circ.1047' },
        { k: 'Aros salvavidas', v: 'Inspección mensual; luces de encendido automático y señales de humo al caducar.', ref: 'SOLAS III/20' },
        { k: 'RLS (EPIRB)', v: 'Autoprueba mensual; prueba de rendimiento anual; mantenimiento en tierra y batería dentro de su caducidad (≤ 5 años).', ref: 'SOLAS IV/15; MSC.1/Circ.1040' },
        { k: 'SART', v: 'Comprobación mensual; batería al caducar.', ref: 'SOLAS IV' },
        { k: 'Pirotecnia (cohetes, bengalas, humos)', v: 'Sustituir al caducar — normalmente 3 años desde fabricación.', ref: 'SOLAS III; LSA Code' },
        { k: 'Bote de rescate / MOB + pescante', v: 'Comprobaciones semanales y mensuales; examen anual a fondo + prueba operativa; cada 5 años prueba dinámica del freno del chigre y revisión del mecanismo de suelta.', ref: 'SOLAS III/20; Res. MSC.402(96)' },
        { k: 'Dispositivos de puesta a flote / pescantes', v: 'Examen anual a fondo; cada 5 años prueba de carga del freno del chigre.', ref: 'SOLAS III/20; MSC.402(96)' },
        { k: 'Arneses / anticaídas', v: 'Inspección por persona competente al intervalo del fabricante (normalmente 6–12 meses).', ref: 'maker / SMS' },
        { k: 'Escapes de emergencia (escotillas, vías)', v: 'Semanal: vía despejada, escotilla abre libremente, señales e iluminación de emergencia; mensual: juntas, escalas, equipo asociado. Las vías de evacuación deben mantenerse libres en todo momento.', ref: 'SOLAS II-2/13; ISM / SMS' },
      ],
    },
    {
      emoji: '🧯',
      title: 'Intervalos de inspección — FFE',
      note: 'Solo orientativo. Verifique con abanderamiento, clase, fabricante y los vigentes SOLAS Cap. II-2 / Código SSCI y MSC.1/Circ.1432 (modificada por MSC.1/Circ.1622).',
      rows: [
        { k: 'Extintores portátiles', v: 'Visual mensual; inspección/servicio anual; prueba de descarga y recarga periódicas; prueba hidrostática de botellas de CO₂ cada 10 años.', ref: 'SOLAS II-2/14; FSS Code; MSC.1/Circ.1432' },
        { k: 'Sistemas fijos de CO₂ / gas', v: 'Inspección anual; pesaje de botellas (recargar si pérdida > 10%); prueba hidrostática cada 10 años; soplado de tuberías.', ref: 'FSS Code Ch.5; MSC.1/Circ.1432' },
        { k: 'Detección y alarma de incendios', v: 'Prueba funcional periódica de detectores/pulsadores; prueba completa del sistema anual.', ref: 'SOLAS II-2; FSS Code Ch.9' },
        { k: 'Compuertas / tapas cortafuego', v: 'Prueba operativa periódica (normalmente anual).', ref: 'MSC.1/Circ.1432' },
        { k: 'Hidrantes, mangueras, cajas, lanzas', v: 'Inspección mensual; mangueras probadas a presión anualmente.', ref: 'SOLAS II-2/14; MSC.1/Circ.1432' },
        { k: 'Equipos autónomos (SCBA)', v: 'Comprobación mensual de presión y función; revisión anual a fondo; prueba hidrostática de botella según fabricante (acero ~5 años; compuesto según marca).', ref: 'FSS Code Ch.3; maker' },
        { k: 'EEBD', v: 'Comprobación mensual; inspección anual; sustituir en la fecha de vida marcada.', ref: 'SOLAS II-2/13; FSS Code Ch.3' },
        { k: 'Equipo de bombero / manta / aplicador de espuma', v: 'Inspección anual.', ref: 'FSS Code Ch.3; MSC.1/Circ.1432' },
      ],
    },
    {
      emoji: '🧪',
      title: 'Intervalos de inspección — Other',
      rows: [
        { k: 'Lavaojos', v: 'Comprobación periódica; botellas de lavado al caducar.', ref: 'maker / SMS' },
        { k: 'Botiquines / kits médicos', v: 'Según Estado de abanderamiento / MLC; contenido al caducar.', ref: 'flag; WHO IMGS' },
        { k: 'Detectores de gas', v: 'Prueba de respuesta antes de usar; calibración según fabricante (p. ej. cada 6 meses) con verificación anual.', ref: 'maker / SMS' },
        { k: 'Trajes químicos / estancos a gas', v: 'Prueba de presión periódica según fabricante.', ref: 'maker' },
        { k: 'Pañol SOPEP', v: 'Comprobación periódica del inventario; absorbentes/artículos repuestos según uso.', ref: 'MARPOL; SMS' },
      ],
    },
    {
      emoji: '✅',
      title: "Inspecciones — el registro de auditoría",
      body: [
        "Abra un equipo — escanee su etiqueta QR o búsquelo en una categoría — y pulse Weekly, Monthly, Quarterly o Annual. Solo se ofrecen las rondas que esa categoría debe en este buque — el calendario se fija por categoría en Settings → Checklists.",
        "Cada línea es PASS / FAIL / N/A. «All pass» rellena la lista de una vez y usted baja lo que realmente falla; nada se marca solo, porque una lista sin tocar nunca debe parecer inspeccionada.",
        "«Clear all», junto a «All pass», empieza la ronda de nuevo: tras una confirmación se borran todas las respuestas, el comentario y la nota de defecto. Las fotografías añadidas se mantienen — esas se quitan una a una. En ese momento nada está firmado, así que nada del archivo cambia.",
        "Elija quién firma desde la lista de tripulación antes de empezar: ese nombre queda en el registro. Añada comentarios y hasta cuatro fotografías de prueba; pertenecen a esa inspección, no a las fotos generales del equipo.",
        "Al firmar se sella la fecha y hora exactas, el tripulante y la versión de la lista. Un registro firmado no puede editarse ni borrarse por nadie, ni siquiera por el Master: un error se corrige inspeccionando otra vez, y ambos registros quedan archivados.",
        "Cualquier FAIL genera un defecto sobre ese equipo, y queda pendiente hasta que alguien registre la subsanación.",
        "Escanear antes de firmar (Settings → Scan QR label before signing, lo activa el Master). Cuando está activo, Crew y Officer solo pueden firmar una inspección después de escanear la etiqueta QR de ese elemento con el escáner de la app (el botón QR). El escaneo vale 30 minutos; escribir el código a mano no cuenta.",
        "Escaneo por categoría (Settings → Scan by category, lo activa el Master). La regla no tiene que aplicarse a todo. El inventario del bote de rescate o el material suelto de un puesto contra incendios merece mantenerse y marcarse pieza a pieza, y nadie va a etiquetar cada balde y cada llave — desactive esas categorías aquí y sus elementos se inspeccionan y se firman directamente desde la lista. Las demás siguen pidiendo la etiqueta. Una categoría añadida más tarde queda cubierta por la regla por defecto, y un escaneo hecho de todos modos se sigue registrando y se sigue imprimiendo en la columna Scan del informe.",
        "Firmar con la cuenta del dispositivo (Settings → Sign as the device's account, lo activa el Master). Cuando está activo, cada teléfono, tableta o PC inscrito firma las inspecciones como la persona a la que se le asignó — el nombre y el rango de su cuenta — y no se ofrece la lista de firmantes. Un oficial ya no puede escanear un equipo con su propio teléfono y poner el nombre de un compañero. El Master cambia a quién pertenece un dispositivo en Settings → Accounts (renombrar); un dispositivo que no se ha unido al buque sigue eligiendo de la lista, porque no tiene cuenta con la que firmar.",
        "El escaneo queda en el registro firmado y aparece en la columna Scan del informe de inspecciones. El Master puede firmar sin escanear (etiqueta perdida, elemento inaccesible), pero debe indicar el motivo, que se imprime en el informe junto a la firma.",
      ],
    },
    {
      emoji: '📋',
      title: 'Categorías y listas de comprobación propias',
      body: [
        'Las categorías incluidas y sus listas de comprobación son un punto de partida, no un límite. Un buque cuyo SMS redacta una comprobación de otra manera — o que inspecciona cosas que nadie más pide — configura ambas cosas por su cuenta, en Settings.',
        'Settings → Categories añade encabezados propios: Emergency Lighting, Escape Routes, Alarm Systems, lo que realmente se recorra. Cada uno lleva un grupo (LSA / FFE / Other), que decide en qué informe se imprime, y un icono. El encabezado se comporta como cualquiera de los integrados: su propia lista, etiquetas QR, listas de comprobación, informes y su propia hoja en la plantilla de importación, de modo que cien luminarias entran desde Excel y no una a una.',
        "Cualquier categoría puede renombrarse, incluidas las incorporadas: una categoría se identifica por una clave que nunca cambia, así que los elementos, su historial, sus etiquetas QR y sus certificados permanecen donde están, se llame como se llame en pantalla. Y una categoría que el buque no lleva puede desactivarse: Equipment → \"Show or hide categories\" (solo el Master), marque las que no usa y pulse Done. Una categoría oculta sale también de las rondas, las listas de comprobación, las reglas de escaneo, la impresión de etiquetas y del apartado \"no inspeccionado\" de los informes. No se borra nada — los elementos siguen archivados con todo lo suyo, y cualquier categoría vuelve desde ahí mismo o desde Settings → Categories.",
        "El informe se firma solo: la línea \"Checked by / Rank / Date\" al pie se rellena con quienes firmaron realmente las inspecciones que contiene. Si la ronda fue compartida, se nombran todos; el rango se imprime cuando es el mismo para todos, y la fecha es la última ronda del informe, no el día de la exportación. Las mismas tres líneas están en el resumen XLSX. Si no se firmó nada en ese periodo, las líneas en blanco se mantienen para rellenarlas a mano.",
        'Settings → Checklists redacta las preguntas. Abra una ronda y la lista ya viene rellena: reescriba una línea, reordénelas, elimine lo que no aplica a su buque, añada lo que pida su SMS. Guarde, y eso es lo que preguntará la próxima ronda, en todos los dispositivos del buque.',
        "Qué rondas debe una categoría lo decide usted — semanal, mensual, trimestral y anual, categoría por categoría. Settings → Checklists muestra cada ronda con un interruptor: desactívela y esa categoría deja de recibirla y el informe deja de contarla como debida; vuelva a activarla y regresa. \"＋ Weekly\", \"＋ Monthly\" o \"＋ Quarterly\" junto a una categoría crea una ronda que aún no tiene, a partir de las comprobaciones que ya tiene — una comprobación semanal de EEBD, una trimestral de las vías de evacuación. Edite las líneas y guarde: desde entonces la pantalla del elemento ofrece esa ronda y el informe semanal, mensual o trimestral la incluye. Nada de lo firmado se altera — los registros ya archivados conservan su período y se siguen imprimiendo. No vienen incorporadas porque una ronda añadida para un buque sería obligatoria para todos.",
        'Un Officer o el Master pueden hacer ambas cosas. Redactar una comprobación es trabajo de quien dirige la ronda; decidir qué firma es válida sigue siendo del Master.',
        'La edición no alcanza al pasado. Cada inspección firmada lleva su propia copia de las preguntas con las que se firmó, así que reescribir una línea hoy no cambia ni un registro del mes pasado — ábralo y se lee exactamente como se firmó. Eliminar un encabezado tampoco elimina su equipo: los elementos y su historial permanecen, y volver a añadir el encabezado los recupera.',
      ],
    },
    {
      emoji: '🛠️',
      title: "Defectos",
      body: [
        "La franja Open defects del panel lista todo lo que queda por hacer: filtrable por LSA / FFE, lo más reciente primero y con la antigüedad de cada uno.",
        "Un defecto no es una marca sobre el equipo: ES la inspección fallida que lo generó, así que siempre responde qué falla, quién lo encontró y cuándo.",
        "Ábralo y pulse «Record rectification» cuando el trabajo esté hecho — eso también se firma y se sella. Los defectos subsanados siguen accesibles.",
        "Cada defecto lleva su motivo: las líneas de la lista de comprobación que fallaron. Aparecen en la ficha, en la franja del panel y en la columna «What failed» del informe. La nota del oficial se añade a ellas, nunca las sustituye — un defecto abierto sin nota sigue diciendo qué estaba mal.",
      ],
    },
    {
      emoji: '📤',
      title: 'Informes y exportación',
      body: [
        'Abra la pestaña Reports y pulse los paneles de categoría para elegir cuáles incluir ("Select all" / "Clear all" alterna todos). El contador indica cuántos elementos se exportarán.',
        "Exporte en PDF o XLSX (nombre MSM_report_DDMMYY): número del elemento, tipo, tamaño, serie, ubicación, fechas, estado y comentarios. El PDF va en horizontal con cada elemento en una sola línea; el XLSX mantiene Make, Deck y Location en columnas separadas para que el archivo se vuelva a importar tal cual.",
        'Export ZIP (PDF + photos) agrupa en MSM_backup_DDMMYY.zip el PDF, todas las fotos/documentos adjuntos y los archivos de certificados que cubren los elementos (con un certificates/INDEX.txt que asocia cada certificado con sus elementos).',
        'Print envía el informe a una impresora por el diálogo del sistema — o "Save to PDF". Las exportaciones abren el menú de compartir del dispositivo.',
        "Reports → Inspections es el registro de lo que se hizo. Elija el grupo (LSA, FFE, Other o All) y Weekly o Monthly, y retroceda a cualquier mes o semana anterior con ‹ ›; \"Back to current\" vuelve al actual. Las cifras en pantalla son las que se imprimirán.",
        "Bajo el grupo se listan las categorías con ronda en este periodo y su progreso — «5 of 5 inspected · complete», «3 of 12» o «failed». Pulse para incluir o excluir una; mantenga pulsado para informar SOLO de esa categoría. Así la ronda de aros salvavidas se archiva como su propia página: el informe lleva el nombre de la categoría y solo lista esos elementos — inspeccionados, no inspeccionados y cualquier defecto abierto. «Whole group» lo devuelve todo.",
        "El informe empieza con su veredicto — por ejemplo \"September 2026 Monthly Inspection – Completed – Passed\", o \"Incomplete (12 of 40 inspected)\" y \"Failed\" cuando esa es la verdad. Es la línea que se archiva como evidencia en el sistema de mantenimiento planificado (PMS). Cada elemento se juzga por su última inspección del periodo, así que un fallo corregido y reinspeccionado no cuenta en su contra.",
        "Las inspecciones realizadas aparecen con No., Location, Category, Type, Size, Serial, Result, Comments, las Initials del inspector, Date y Time, con una clave de iniciales a nombres bajo la tabla. Lo escrito en Comments durante la inspección — y lo que falló — pasa al informe. Después vienen los elementos no inspeccionados en el periodo y todos los defectos aún abiertos.",
        "El informe de inspecciones tiene una columna Scan: QR cuando se escaneó la etiqueta antes de firmar, No scan cuando un Master firmó sin escanear (el motivo va en Comments). El XLSX del registro lleva una columna MSM ID: consérvela al editar el archivo e Import → Update volverá a encontrar cada elemento.",
      ],
    },
    {
      emoji: '💾',
      title: 'Copia de seguridad y restauración',
      body: [
        'Settings → Export backup (.msm) crea un archivo con todo lo del dispositivo: elementos, certificados, registros de compresor, datos del buque y los archivos adjuntos incrustados (MSM_backup_DDMMYY.msm).',
        'Restore backup (.msm) recrea los datos en otro dispositivo o tras reinstalar — reemplaza todos los datos actuales, así que restaure en un dispositivo limpio.',
        'Las copias funcionan sin la nube. Las preferencias del dispositivo (como el interruptor del módulo de compresor) no forman parte de la copia.',
        "Además, la aplicación toma una INSTANTÁNEA de los registros cada vez que se abre y guarda las tres últimas en el dispositivo. Settings → Data → «Roll back to …» indica el momento al que le devolvería. Existe para los accidentes que nadie planea — un archivo equivocado restaurado, un registro vaciado — y es la copia que realmente estará ahí, porque nadie exporta una copia la mañana anterior al error.",
        "Una instantánea lleva los REGISTROS, no los archivos. Las fotografías y los documentos permanecen en el dispositivo con sus nombres y siguen enlazados, así que una reversión no sustituye a una copia real llevada a otra máquina.",
        "Un registro vacío nunca sobrescribe una buena instantánea: si la aplicación se abre sin nada, se conservan las copias que ya tiene.",
        "Restaurar y revertir son del Master: reemplazan el registro y se lo entregan al buque, sobrescribiendo aquello con lo que otros oficiales ya han trabajado. Los oficiales conservan importar y exportar. Un dispositivo que no se ha unido a un buque lo conserva todo: su registro es suyo.",
      ],
    },
    {
      emoji: '🗑️',
      title: 'Restablecer todos los datos',
      note: 'Haga primero un Export backup (.msm) si hay alguna posibilidad de necesitar los datos de nuevo — el restablecimiento no se puede deshacer.',
      body: [
        'Al final de Settings, "Reset all data" elimina permanentemente todo elemento, certificado, registro de compresor, archivo adjunto y los datos del buque en este dispositivo.',
        'Está protegido por contraseña: escriba exactamente "Reset all data" para activar el botón de confirmar. Pulse fuera del diálogo o Cancel para salir.',
        'Se conservan las preferencias del dispositivo y su aceptación de la Privacy Policy / Terms; solo se borran los datos del registro de seguridad.',
        "El restablecimiento es del Master y, en un dispositivo sincronizado, no borra un aparato: borra el BUQUE. La confirmación lo dice y el botón se llama «Erase everywhere», porque en segundos alcanza el registro del buque y todos los demás dispositivos a bordo.",
        "Para vaciar solo este dispositivo, abandone primero el buque: Settings → This device → «Sign off & erase». La copia del buque queda intacta.",
        "El restablecimiento borra también las instantáneas automáticas — de lo contrario «borrarlo todo» no sería cierto.",
      ],
    },
    {
      emoji: '🔑',
      title: "Unirse al buque, cuentas y roles",
      body: [
        "El buque se identifica por su número IMO (Ajustes → Vessel). Todo lo demás se deriva de ahí, y la tarjeta superior de Ajustes siempre indica el siguiente paso.",
        "El PRIMER dispositivo se une con el código de arranque que acompaña a su licencia y pasa a ser el Master.",
        "Después el Master emite una cuenta a cada tripulante en Ajustes → Accounts: un nombre y un PIN de 8 dígitos. El PIN permanece visible en esa lista para poder dictarlo de nuevo, y puede reemitirse o revocarse persona a persona.",
        "Los demás introducen el IMO y luego se unen desde la tarjeta «This device» al principio de Ajustes con su nombre y PIN. Su dispositivo queda en cola; el Master lo aprueba en Accounts → Devices y el dispositivo en espera lo detecta solo en unos segundos, sin reiniciar nada.",
        "Tres roles: Crew registra inspecciones, Officer además cierra defectos, Master además emite cuentas y asigna roles. Los roles los aplica el servidor, no solo la aplicación.",
        "¿Móvil perdido? El Master desactiva ese dispositivo en Accounts → Devices. Nadie más se ve afectado y no cambia ninguna contraseña.",
        "La invitación puede llevar también el CARGO A BORDO — Third Officer, Bosun, Chief Engineer. No es lo mismo que el rol: un segundo maquinista puede tener una cuenta Crew y un cadete una de Officer, de modo que un ascenso a bordo no es un cambio de permisos. El cargo viaja con la persona a la pantalla de ingreso y a la lista de firmantes, así que ni el nombre ni el cargo se teclean dos veces.",
        "Una vez unido el dispositivo, Settings → This device muestra con qué identidad firma: nombre, cargo y si está aprobado. Se lee en vivo del buque, así que un cargo que el Master cambie una hora después aparece solo.",
        "«Sign off this device» abandona el buque desde ese aparato. Deja de sincronizar de inmediato y no puede readmitirse solo: volver exige una nueva invitación y la aprobación del Master. «Sign off & erase» borra además el registro de ese dispositivo — para uno que se cede o se vende. Ninguno reinicia el periodo gratuito: es del buque, no del aparato.",
        "La interfaz sigue al rango. Cuentas, la lista de tripulación y la de dispositivos son del Master y no se ofrecen a nadie más. El servidor rechazaba esas escrituras de todos modos; un botón que siempre falla solo le dice algo falso sobre su propia autoridad.",
        "Si el Master retira un dispositivo, este lo dice y ofrece unirse de nuevo, en lugar de quedarse en un error de conexión que no puede resolver. Volver exige una invitación nueva, como la primera vez.",
      ],
    },
    {
      emoji: '🧭',
      title: "Acceso — qué pestañas muestra cada dispositivo (Access)",
      body: [
        "Settings → Access (solo el Master) es una tabla: una fila por dispositivo y una columna por pestaña — Certificates, PMS, Rest, Reports. Punto verde: la pestaña está en ese dispositivo; rojo: no está. Toque para cambiar; el dispositivo lo aplica en la siguiente sincronización.",
        "Así cada pantalla muestra solo lo necesario: el teléfono de un marinero sin el plan de mantenimiento de máquinas, el de un maquinista sin los certificados de la tripulación.",
        "Dashboard, Equipment y Settings están siempre activas. El dispositivo del Master muestra siempre todas las pestañas. Un dispositivo que el Master nunca configuró muestra todas, para que nada desaparezca con una actualización.",
        "Es orden, no un cerrojo: lo que un dispositivo puede cambiar lo sigue decidiendo su rango en Accounts, y lo hace cumplir el servidor.",
      ],
    },
    {
      emoji: '📚',
      title: "Documentos ISM",
      body: [
        "La pestaña Docs guarda los documentos controlados del buque — manual SMS, procedimientos, circulares, órdenes permanentes del Master, políticas, formularios — cada uno con número, revisión, fecha de emisión y fecha de revisión. Un documento es un archivo (el PDF de la oficina), texto escrito a bordo, o ambos.",
        "Arriba aparece lo que la persona de este dispositivo aún tiene que leer. Abra el documento, léalo y pulse I have read and understood: es una firma de la revisión vigente, confirmada como cualquier otra.",
        "Cada documento muestra cuántos de la lista de tripulación lo han firmado y quién aún no. Las firmas nunca se eliminan.",
        "Los oficiales y el Master añaden y editan documentos. New revision lo pasa a Rev N+1 y pide a todos leer y firmar de nuevo; las firmas de revisiones anteriores quedan en el historial. Corregir una errata en la misma revisión no lo hace.",
        "Los archivos llegan a todos los dispositivos a través del buque. Si el archivo no se puede subir (sin conexión), el documento se guarda y el archivo queda en el dispositivo que lo adjuntó hasta que se guarde de nuevo con conexión.",
      ],
    },
    {
      emoji: '🏢',
      title: "Consola de flota (superintendente)",
      body: [
        "Para un superintendente en la oficina: una consola con todos sus buques, primero los que tienen problemas — equipos vencidos y próximos, certificados (del buque, de la tripulación, de equipos), mantenimiento, repuestos y documentos ISM aún sin firmar.",
        "El acceso lo da el Master de cada buque: en Accounts, emitir una cuenta del tipo Superintendent (shore). El superintendente abre Fleet (app.ismpilot.com/fleet), introduce el IMO, el nombre y el PIN, y el buque se añade; los demás buques, igual. El Master ve la cuenta en Devices y puede desactivarla en cualquier momento.",
        "Abra un buque para añadir y editar sus certificados y documentos ISM, emitir una nueva revisión y ver quién no ha firmado. Los cambios llegan a los dispositivos a bordo en la siguiente sincronización. Los equipos solo se ven: se inspeccionan a bordo.",
      ],
    },
    {
      emoji: '✍️',
      title: "Firmas confirmadas",
      body: [
        "Con Settings → Confirm every signature activado (Master), cada firma — una inspección, un trabajo de mantenimiento, un movimiento del pañol — la confirma el firmante: con su huella o su cara en su propio dispositivo, o con su propio PIN de firma.",
        "La huella y la cara solo se ofrecen cuando el dispositivo firma como su propia cuenta. Un teléfono sabe que lo tocó un dedo registrado, no de quién: en una tableta compartida cada uno firma con su PIN.",
        "La primera vez que firma en un dispositivo elige un PIN de firma de 4–6 cifras. No es el PIN de la cuenta, se guarda solo como hash y nadie puede leerlo, ni el Master. Cinco intentos fallidos lo bloquean cinco minutos. ¿Olvidado? El Master lo restablece en Settings y usted elige uno nuevo.",
        "El informe indica junto al nombre cómo se confirmó cada firma (PIN o biometría).",
      ],
    },
    {
      emoji: '🛏️',
      title: "Horas de descanso (Hours of rest)",
      body: [
        "La pestaña Rest registra el trabajo y el descanso de cada persona, media hora a media hora, en hora del buque. Se abre en la persona a la que pertenece el dispositivo; el Master puede cambiar a cualquiera para revisar o corregir su mes.",
        "Pulse un día, elija el lápiz (Tap marks WORK / Tap marks REST) y pulse a lo largo de las horas — o rellene el día con un toque: Same as previous day, Day work 08–17, las tres guardias, Day off. Al pasar al día siguiente o anterior se guarda el actual.",
        "Las reglas se comprueban al editar, junto con los días vecinos: al menos 10 h de descanso en cualquier periodo de 24 h y 77 h en cualquier periodo de 7 días; descanso en no más de dos periodos, uno de al menos 6 h; no más de 14 h entre periodos de descanso (MLC 2006 Reg. 2.3, STCW A-VIII/1). Las ventanas son móviles, así que se detecta una infracción a través de la medianoche. Es orientativo: las excepciones que permite el pabellón (ejercicios, emergencias) las decide el Master — anótelas en Note.",
        "Un día sin registro aparece como «Not recorded» y nunca cuenta como descanso.",
        "Monthly record (PDF) imprime el mes en el formato habitual — una fila por día, trabajo sombreado, totales, infracciones — con líneas de firma para el marino y el Master.",
      ],
    },
    {
      emoji: '⚙️',
      title: "Mantenimiento planificado (Planned maintenance)",
      body: [
        "La pestaña PMS (o la franja Maintenance del Dashboard) contiene la maquinaria — motores principales, generadores, potabilizadora, compresores, bombas, estabilizadores — cada una con su contador de horas y sus trabajos.",
        "Un trabajo tiene un intervalo en horas de funcionamiento, en días o ambos, y vence con lo que llegue antes, como lo escriben los fabricantes («cada 250 h o 12 meses»). Indique una vez cuándo se hizo por última vez — fecha y contador; después Record as done lo mueve solo. Un trabajo nunca hecho muestra «Never done» en vez de fecha.",
        "Introduzca el contador en la pantalla de la máquina (Save reading). Las últimas lecturas dan un ritmo de uso, así que un trabajo por horas muestra también cuántos días le quedan aproximadamente. No se acepta una lectura menor que la anterior: un contador sustituido es una máquina nueva.",
        "«Pronto» es el último 10 % del intervalo, no los 60 días de los equipos, que harían «pendiente» un trabajo mensual desde el primer día.",
        "Typical jobs añade la lista habitual para un tipo de máquina. Los intervalos son típicos, no del fabricante: compruebe cada uno con el manual y ajústelo.",
        "Record as done firma la realización — fecha, contador, nota, su nombre — en el historial de la máquina. Como una inspección, no se puede editar ni borrar; un error se corrige registrando el trabajo de nuevo. Al quitar una máquina o un trabajo el historial se conserva.",
      ],
    },
    {
      emoji: '📦',
      title: "Repuestos (Spare parts)",
      body: [
        "La pestaña Spares es el pañol: cada línea tiene nombre, número de pieza, fabricante, dónde se guarda y un nivel de pedido. La lista se agrupa por ubicación, primero lo agotado y lo bajo; To order deja solo esas líneas.",
        "Las existencias nunca se escriben encima. Abra un repuesto: + Received para una entrega, − Used para una pieza usada fuera del plan de mantenimiento, Stocktake para lo que hay físicamente en el estante. Cada uno es un movimiento firmado y las existencias son su suma, así que si dos dispositivos registran a la vez, cuentan los dos.",
        "Un recuento se registra como la diferencia con el libro, así que un recuento hecho sin conexión no anula una entrega registrada mientras tanto. Un movimiento erróneo se corrige con un recuento; los movimientos no se editan.",
        "Marque a qué máquinas sirve un repuesto: la pantalla de la máquina lista sus repuestos con las existencias. En un trabajo de mantenimiento, Parts used each time lista lo que consume; Record as done lo descuenta del pañol, y las cantidades se pueden cambiar o poner a 0 ese día.",
        "El Dashboard muestra una línea cuando algo está agotado o bajo.",
      ],
    },
    {
      emoji: '☁️',
      title: "Sincronización y fotos de inspección",
      body: [
        "Una vez unido el dispositivo, la sincronización se mantiene sola: ya no hay botones Push / Pull. Firme un registro y estará en los demás dispositivos del buque en segundos; la aplicación funciona sin conexión y se pone al día cuando vuelve.",
        "Los registros de inspección solo se añaden, así que dos oficiales trabajando en dos móviles no se pisan. El registro de equipos es un único documento compartido: si dos personas editan el MISMO equipo a la vez, gana la edición posterior.",
        "Las fotografías se reducen al capturarlas y se ponen en cola. Ajustes → Inspection photos: solo Wi-Fi (por defecto), cualquier conexión o nunca. En el mar el tráfico lo paga el buque.",
        "La nube conserva una fotografía 90 días. Después la guarda el buque: Ajustes → Inspection photos → Photo archive guarda ese mes en un ZIP — las imágenes y un índice con el equipo, la ronda, el resultado y quién firmó. Guárdelo donde el buque guarda sus registros y confírmelo: esa noche esas fotografías se borran del almacenamiento en la nube. De un mes sin confirmar no se borra nada, de los teléfonos y tabletas no se borra nunca nada, y los registros firmados — las inspecciones, los informes, la copia .msm — no se tocan. Confirmar es del Master; guardar una copia, de cualquiera.",
        "Los archivos adjuntos siguen viajando en una copia .msm.",
        "Las fotografías y los documentos adjuntos ya no viajan dentro del registro: van al almacenamiento y el registro guarda una referencia. Un documento de Firestore se detiene en 1 MiB, y dos fotografías bastaban para parar la sincronización de todo el buque.",
        "Un buque sin licencia puede subir 25 archivos en total. Es el único límite que rige también durante la prueba, porque son fotografías del buque en nuestra factura de almacenamiento. En el dispositivo no se prohíbe nada: se toman, se guardan, se ven y entran en la copia .msm como siempre; lo que espera es la copia para los demás dispositivos, y todo lo retenido sube en la primera sincronización tras licenciar el buque.",
      ],
    },
    {
      emoji: '🔔',
      title: 'Recordatorios de caducidad',
      body: [
        'Settings → Modules → Expiry reminders programa notificaciones locales 60, 30 y 7 días antes de la fecha de inspección o caducidad de cada elemento.',
        'La primera vez que lo active, permita las notificaciones cuando se le pida. Los recordatorios se sincronizan automáticamente al añadir, editar o importar elementos.',
        'Son solo en el dispositivo (sin internet). Con un registro grande se programan primero los recordatorios más próximos y la lista se rellena a medida que pasan las fechas.',
      ],
    },
    {
      emoji: '🎨',
      title: 'Apariencia (temas)',
      body: [
        'Settings → Appearance cambia el tema de color: Light (por defecto), Dark y Colorful.',
        'Settings → Modules → Sounds apaga o enciende todas las señales sonoras: la campana del barco al iniciar y los avisos al guardar, firmar o ante un error. La elección se recuerda en este dispositivo; una ronda larga de inspecciones resulta más silenciosa.',
        'Colorful colorea los iconos de equipo por grupo — LSA verde, FFE rojo, Other turquesa. Su elección se guarda y se aplica en toda la app.',
        'En tabletas, las listas de Dashboard, Equipment, Certificates y Reports se muestran en dos columnas automáticamente.',
      ],
    },
    {
      emoji: '👑',
      title: "Licencia por buque",
      body: [
        "ISMpilot Pro se licencia por BUQUE — ligada al barco por su número IMO, no por persona ni por dispositivo. Todos los oficiales y todos los móviles unidos al buque quedan cubiertos por la misma licencia.",
        "Cada buque tiene 60 días para probar la aplicación antes de que se aplique el límite de 15 elementos por categoría.",
        "Precios y licencias para flotas: mail@ismpilot.com.",
        "La licencia la compra una vez quien gestiona el buque y se activa en la cuenta del barco: Ajustes → ISMpilot Pro → Activate the vessel licence. Desde ese momento todos los dispositivos inscritos tienen acceso completo.",
        "Sin licencia tras el periodo gratuito la aplicación sigue funcionando, pero el registro se limita a 15 elementos por categoría.",
        "Un dispositivo que se une a un buque con licencia la recibe por sí solo. Si aún muestra la página de activación, ábrala y pulse Restore the vessel licence.",
      ],
    },
    {
      emoji: 'ℹ️',
      title: 'Acerca de',
      body: [
        aboutLine('es'),
        'La app es una ayuda de registro. No sustituye la documentación oficial de seguridad del buque, las inspecciones reglamentarias ni los requisitos de clase/abanderamiento. Siga siempre el SGS de su compañía y la normativa aplicable.',
      ],
      link: APP_CONFIG.website,
      watermark: true,
    },
  ],
};

// --------------------------------------------------------------- Українська --
const uk: ManualContent = {
  screenTitle: 'Посібник користувача',
  screenSubtitle: 'Як користуватися застосунком',
  sections: [
    {
      emoji: '⚓',
      title: 'Початок роботи',
      body: [
        `${APP_CONFIG.name} зберігає рятувальне (LSA) та протипожежне (FFE/FIFI) майно судна в одному місці, з контролем перевірок і термінів придатності.`,
        "Обладнання згруповане у чотири реєстри: LSA, FFE, Other та Lifting & Mooring. Кожна позиція має власний номер, тип і розмір, виробника, серійний номер/ID, палубу й розташування, а також дати, що визначають відповідність.",
        "Найшвидше почати: Settings → Import from Excel. Завантажте ваш список як є — аркуш зі стовпцями на кшталт #, Deck, Location, Description, Make, Type, Size, Serial та Exp / Inspc. розкладається за категоріями за описом кожної позиції — або натисніть Download blank template (по аркушу на категорію) і заповніть його. В обох випадках до збереження видно, що знайдено. Усі дані зберігаються на пристрої та за бажанням синхронізуються з хмарою.",
      ],
    },
    {
      emoji: '📥',
      title: 'Імпорт з Excel',
      body: [
        "Settings → Import from Excel → виберіть файл .xlsx. Аркуш, названий за категорією (Liferafts, Lifejackets, Fire extinguishers, …), автоматично зіставляється з цією категорією.",
        "Підходить і ваш власний формат. Аркуш, не названий за категорією, — зазвичай єдиний список усього обладнання по палубах, — читається за заголовками стовпців (#, Deck, Location, Description, Make, Type, Size, Serial, Exp / Inspc., Comments …), і кожен рядок потрапляє до своєї категорії за тим, що це за позиція: \"Fire extinguisher\" — до Fire Extinguishers, \"EEBD\" — до EEBD. Усе, що не вдалося розпізнати, потрапляє до Other Safety Equipment. Екран імпорту називає аркуші, розібрані таким чином.",
        "\"#\" читається як номер позиції, якщо на аркуші є також стовпець Serial, і як серійний номер — якщо його немає. \"Exp / Inspc.\" заповнює ту дату, за якою оцінюється категорія, — Next inspection або Expiry. Рядки-розділи на кшталт \"Sun Deck\" між позиціями пропускаються.",
        'Немає файлу? Натисніть "Download blank template (.xlsx)" на екрані імпорту (або Settings → Download import template) — по аркушу на категорію з правильними заголовками — заповніть і імпортуйте назад.',
        'Перед збереженням показується попередній перегляд: скільки позицій знайдено в кожній категорії.',
        'Виберіть "Update", щоб привести наявний реєстр у відповідність до файлу: кожен рядок знаходить свою позицію (за MSM ID, потім за серійним номером, потім за номером і місцем), змінені клітинки застосовуються, нові рядки додаються, а позиції зберігають QR-наклейки, фото та історію перевірок. Позиції, що є в реєстрі, але відсутні у файлі, показуються списком і видаляються, лише якщо ви це ввімкнете.',
        'Щоб вести список поступово: Reports → експортуйте реєстр в Excel, відредагуйте цей файл (у ньому є стовпець "MSM ID" — не змінюйте його) та імпортуйте тут через "Update". Нові рядки додавайте з порожнім MSM ID.',
        '"Replace all" замінює реєстр вмістом файлу; "Add as new" додає всі рядки до наявних.',
        "Дати у вигляді Excel-серій, років (наприклад, \"2034\"), ДД/ММ/РРРР або місяця й року (наприклад, \"Jun/26\" — читається як 1-ше число місяця) конвертуються автоматично. Будь-яку позицію можна відредагувати пізніше.",
      ],
    },
    {
      emoji: '🧰',
      title: 'Обладнання та категорії',
      body: [
        'Вкладка Equipment показує сітку всіх категорій з кількістю позицій і кольоровою точкою найгіршого статусу всередині.',
        "Натисніть на категорію, щоб побачити позиції, — кожен рядок починається з номера, наприклад \"No. 01-SD — CO2 5kg\". Пошук — за номером, типом, виробником, розміром, серійним номером, палубою або розташуванням. Натисніть ＋, щоб додати позицію вручну.",
        "Позиція містить Item No., Type / Description, Make, Size (довільний текст — 5kg, 9L, XL, 150N), Serial / ID, Deck і Location, кількість або місткість, дати та Comments. Номер позиції великим шрифтом показано вгорі екрана позиції та екрана інспекції: серед сорока однакових вогнегасників лише він їх і розрізняє.",
        'Дати задаються календарем — натисніть поле та виберіть рік, місяць і день.',
        'Значки біля позиції: по одній скріпці на кожен прикріплений файл (📎) та 📜, якщо її покриває сертифікат.',
        'У чек-лист категорій (Hydrants, BA Bottle Pressure, Fire Detectors) у картці є щомісячні позначки перевірок.',
        'Усередині категорії — сортування за Expiry date, Position, Name (А–Я) або Type; у режимах Position і Type позиції групуються під заголовками. На планшетах список показується у дві колонки.',
        "\"Other Safety Equipment\" — категорія для всього іншого: того, що не назване в стандартних аркушах, — переносний насос, запасний заряд, рундук зі спорядженням, яке більше ніхто не враховує. Додавайте до неї вручну через ＋; сюди ж потрапляє імпортований рядок, який не вдалося розпізнати. Вона працює як будь-яка інша категорія — терміни, QR-етикетки, інспекції, звіти.",
      ],
    },
    {
      emoji: '📎',
      title: 'Фото та документи',
      body: [
        'До кожної позиції можна прикріпити до 4 вкладень — фото або документи (PDF тощо) — у блоці "Photos & documents" картки.',
        'Натисніть пунктирний слот ＋ Add: зробити фото, вибрати з галереї або обрати документ.',
        'Тап по фото відкриває його на весь екран (Open / Share); тап по документу — у системному перегляді.',
        'Довгий тап по вкладенні відкриває меню редагування — Download / Share, Rename, Replace або Delete.',
      ],
    },
    {
      emoji: '🪝',
      title: "Lifting & Mooring (вантажопідйомне та швартовне)",
      body: [
        "Вантажопідйомне та швартовне обладнання ведеться в тому ж застосунку, що LSA та FFE: один акаунт, один список екіпажу, одні QR-етикетки, одне місце для доказів. Воно є на дашборді, у вкладці Equipment, у звітах і в шаблоні імпорту Excel, як будь-який інший реєстр.",
        "Вісім категорій: Mooring Equipment, Working Aloft Equipment, Cranes, Hooks & Cables, Deck Slings & Shackles, Engineering Lifting Equipment, Working Aloft Anchors, Interior Lifting Eyes & Beams.",
        "Кожна категорія має РІЧНИЙ обхід — огляд, на якому тримається сертифікат: позиція збігається з реєстром (ID, SWL/WLL, місце), повний огляд / випробування навантаженням у строку, сертифікат додано й він читається, знос у межах допусків виробника, усе сумнівне виведено з експлуатації та позначено.",
        "Mooring Equipment і Working Aloft Equipment мають ще КВАРТАЛЬНИЙ обхід — огляд обладнання в постійній роботі плюс маркування SWL/WLL, сертифікат випробувань і видимі пошкодження.",
        "Записуйте дату наступного огляду, щоб сертифікати судна припадали на один річний період, а не були розкидані по року.",
        "Щомісячних обходів за замовчуванням немає. Якщо на судні інакше — додайте обхід (зокрема місячний) або змініть формулювання в Settings → Checklists.",
      ],
    },
    {
      emoji: '📜',
      title: 'Сертифікати',
      body: [
        'Вкладка Certificates зберігає документи, що покривають одразу багато позицій — наприклад, один сервісний сертифікат на кілька плотів ("груповий сертифікат").',
        'Відкрийте сертифікат, щоб задати номер, дати видачі/закінчення (через календар), прикріплений файл і пов’язати позиції, які він покриває.',
        'Сертифікат має власний статус терміну (червоний / жовтий / зелений), тож потрапляє у список «скоро спливає».',
        'У картці позиції перелічені сертифікати, що її покривають — натисніть ＋ Link, щоб прив’язати до позиції наявний сертифікат (зберігається одразу). Покриті позиції позначені значком 📜.',
        "Три вкладки: Equipment, Crew і Vessel. Сертифікати екіпажу належать ЛЮДИНІ — STCW, диплом (CoC), медогляд ENG1, паспорт, посвідчення моряка, віза. Оберіть власника зі списку екіпажу й натисніть запропоновану назву (або впишіть свою), щоб той самий документ називався однаково в усіх.",
        "Вкладка Crew групує сертифікати за людьми; вище за всіх той, у кого документи спливають раніше. У Settings → Crew те саме видно в рядку кожного: «3 certificates · 1 expired».",
        "Сертифікати судна — власні документи корабля: реєстрація, SMC, DOC, ISSC, MLC, вантажна марка, safety equipment, радіо, IOPP, клас, страховка.",
        "Якщо ввімкнено Expiry reminders, за сертифікатами екіпажу й судна надходять ті самі нагадування за 60 / 30 / 7 днів, що й за обладнанням.",
      ],
    },
    {
      emoji: '⏱️',
      title: 'Журнал компресора ДА',
      body: [
        'Опціональний модуль для компресора дихального повітря (BA) зі складу FIFI — вмикається в Settings → Modules → BA Compressor log.',
        'Відкривається з Settings → Open compressor log або з екрана категорії "FIFI Outfit & BA Sets".',
        'До 3 компресорів. "＋ Add compressor" створює юніт, його можна перейменувати та перемикатися між юнітами чипами зверху.',
        'Запис напрацювання: виберіть "Running", вкажіть дату, час роботи (години / хвилини) та нотатку. Кожен запуск додається до загального лічильника напрацювання, у кожного запису показано накопичувальний підсумок Σ.',
        'Обслуговування: виберіть Maintenance, Service або Inspection з датою та нотаткою. "Adjust starting counter" — для годин, накопичених до початку ведення журналу.',
      ],
    },
    {
      emoji: '📊',
      title: 'Панель та статуси',
      body: [
        'Панель перелічує всі позиції з датою, за зростанням терміну — найтерміновіше зверху.',
        `Кольори статусу: червоний = Expired (дата в минулому), жовтий = Due soon (у межах ${DUE_SOON_DAYS} днів), зелений = Valid.`,
        'Натисніть лічильник (Expired / Due soon / Valid), щоб відфільтрувати список за статусом; повторний тап знімає фільтр.',
        'Фільтр за групою (All · LSA · FFE · Other) і сортування за Expiry date, Position, Name або Type — Position групує за розташуванням, а Type — за категорією обладнання, кожна з кількістю.',
        "У кожного рядка ДВІ позначки, по одній з кожного краю. Ліва смуга — про дату: прострочено, скоро, чинне. Права — про поточний раунд: синя ще не перевірялося, зелена перевірено й чисто, жовта період добігає кінця, червона дефект не усунуто. Предмет може бути цілком у даті й при цьому неоглянутий — саме цей випадок і треба бачити.",
        "Червоний праворуч не знімається календарем. Дефект, відкритий у березні, лишається дефектом у червні: позначка тримається червоною, доки не підписано усунення.",
        "У SORT з'явився пункт «This period» — і на дашборді, і в списках категорій. Список групується від гіршого: провал, період на виході, ще не перевірялося, перевірено.",
      ],
    },
    {
      emoji: '🔎',
      title: 'Сканування, позначки та нещодавно відскановані',
      body: [
        'Скануйте QR-етикетку або серійний номер кнопкою QR у шапці екрана Dashboard або вкладки Categories. Збіг одразу відкриває позицію; заводський штрихкод або записаний серійний номер теж її знайдуть. Користуйтеся кнопкою в застосунку, а не системною камерою — QR формату ISMpilot це приватне посилання, яке камера сама відкрити не може. Якщо код пошкоджено, а цифри ще читаються, введіть їх вручну — той самий пошук.',
        "Print label (на екрані позиції) друкує QR-етикетку. Повнорозмірна етикетка містить тип і розмір (\"CO2 5kg\"), номер позиції та серійний номер (\"No. 01-SD · S/N C001111\"), дату наступної перевірки або терміну придатності, а також категорію з палубою та розташуванням. На найменших етикетках залишаються тип, номер і серійний номер.",
        "Усі етикетки одразу друкуються кнопкою з ярликом поряд із QR-сканером на вкладці Categories (або Settings → Print QR labels). Оберіть групу, позначте палуби та категорії — кнопка покаже, скільки це наклейок; наступний екран обирає розмір і куди друкувати: на Xprinter по Bluetooth, на термо-рулон, на аркуш A4 з лініями відрізу на офісному принтері або в PDF для застосунку іншого принтера. Етикетки виходять палуба за палубою, потім за категорією та номером позиції, тож рулон повторює обхід судна. Усередині однієї категорії натомість можна довгим натисканням позначити кілька позицій вручну.",
        'Позначка «повернутися до цього»: відкрийте позицію та натисніть кнопку Flag поряд зі статусом. Позначка — не статус відповідності: позиція може бути повністю в терміні й усе одно потребувати другого погляду (іржа, тугий палець, сумнів). За бажанням додайте коротку нотатку чому.',
        'На Dashboard є дві смуги швидкого доступу. Flagged показує те, що екіпаж позначив для перегляду; Recently scanned — етикетки, які ви востаннє відкривали на цьому пристрої, нове згори. Натисніть на заголовок будь-якої, щоб відкрити повний екран; на екрані Flagged позначку можна зняти, коли з позицією розібралися.',
        "У браузері сканер не чіпає камеру, доки його не попросять. На настільній машині код зазвичай швидше ввести, а браузер, у якого попросили камеру й не знайшли її, просто чекає й нічого не пояснює — натисніть «Use the camera», коли камера справді потрібна; машина без камери так і скаже, замість того щоб зависнути. На телефоні сканер, як і раніше, відкривається вже дивлячись.",
      ],
    },
    {
      emoji: '🛟',
      title: 'Інтервали перевірок — LSA',
      note: 'Лише орієнтовно. Завжди звіряйтеся з прапором судна, класифікаційним товариством, інструкціями виробника та чинними SOLAS / LSA Code / циркулярами MSC. Застосунок фіксує дати — він не нав’язує інтервали.',
      rows: [
        { k: 'Надувні рятувальні плоти', v: 'Обслуговування на схваленій станції кожні 12 міс. (продовження можливе за схемою, схваленою прапором).', ref: 'SOLAS III/20; LSA Code' },
        { k: 'Гідростат плоту (HRU)', v: 'Заміна/обслуговування за виробником; одноразові типи (напр. Hammar H20) — кожні 2 роки.', ref: 'SOLAS III/20; maker' },
        { k: 'Рятувальні жилети', v: 'Щомісячний огляд; щорічна ретельна перевірка. Вогні та надувні вузли обслуговуються щороку; картридж/батарея — за терміном.', ref: 'SOLAS III/20; MSC.1/Circ.1304' },
        { k: 'Гідрокостюми / костюми захисту', v: 'Щорічна перевірка; пневмо- (швів) тест з інтервалом ≤ 3 років для застосовних типів.', ref: 'MSC.1/Circ.1047' },
        { k: 'Рятувальні круги', v: 'Щомісячний огляд; самозаймисті вогні та димові шашки — за терміном.', ref: 'SOLAS III/20' },
        { k: 'АРБ (EPIRB)', v: 'Щомісячний самотест; щорічний тест працездатності; берегове ТО та заміна батареї в межах її терміну (≤ 5 років).', ref: 'SOLAS IV/15; MSC.1/Circ.1040' },
        { k: 'SART', v: 'Щомісячна перевірка; батарея — за терміном.', ref: 'SOLAS IV' },
        { k: 'Піротехніка (ракети, фальшфеєри, дими)', v: 'Заміна за терміном — зазвичай 3 роки від дати виготовлення.', ref: 'SOLAS III; LSA Code' },
        { k: 'Чергова/рятувальна шлюпка + шлюпбалка', v: 'Щотижневі та щомісячні перевірки; щорічне освідчення + робочий тест; раз на 5 років динамічний тест гальма лебідки та переборка роз’єднувального пристрою.', ref: 'SOLAS III/20; Res. MSC.402(96)' },
        { k: 'Спускові пристрої / шлюпбалки', v: 'Щорічне освідчення; раз на 5 років навантажувальний тест гальма лебідки.', ref: 'SOLAS III/20; MSC.402(96)' },
        { k: 'Запобіжні пояси / засоби захисту від падіння', v: 'Перевірка компетентною особою з інтервалом виробника (зазвичай 6–12 міс.).', ref: 'maker / SMS' },
        { k: 'Аварійні виходи (люки, шляхи евакуації)', v: 'Щотижня: шлях вільний, люк відкривається вільно, знаки та аварійне освітлення; щомісяця: ущільнення, трапи, супутнє обладнання. Шляхи евакуації мають бути вільними завжди.', ref: 'SOLAS II-2/13; ISM / SMS' },
      ],
    },
    {
      emoji: '🧯',
      title: 'Інтервали перевірок — FFE',
      note: 'Лише орієнтовно. Звіряйтеся з прапором, класом, виробником і чинними SOLAS гл. II-2 / FSS Code та MSC.1/Circ.1432 (зі змінами MSC.1/Circ.1622).',
      rows: [
        { k: 'Переносні вогнегасники', v: 'Щомісячний огляд; щорічна перевірка/обслуговування; періодичний розрядний тест і перезарядка; гідротест балонів CO₂ кожні 10 років.', ref: 'SOLAS II-2/14; FSS Code; MSC.1/Circ.1432' },
        { k: 'Стаціонарні системи CO₂ / газові', v: 'Щорічна перевірка; зважування балонів (перезарядка за втрати > 10%); гідротест раз на 10 років; продувка трубопроводів.', ref: 'FSS Code Ch.5; MSC.1/Circ.1432' },
        { k: 'Пожежна сигналізація та виявлення', v: 'Періодична перевірка працездатності сповіщувачів/ручних пунктів; повний тест системи щороку.', ref: 'SOLAS II-2; FSS Code Ch.9' },
        { k: 'Протипожежні заслінки / клапани', v: 'Періодичний робочий тест (зазвичай щороку).', ref: 'MSC.1/Circ.1432' },
        { k: 'Гідранти, рукави, пож. пости, стволи', v: 'Щомісячний огляд; пожежні рукави — гідротест щороку.', ref: 'SOLAS II-2/14; MSC.1/Circ.1432' },
        { k: 'Дихальні апарати (SCBA)', v: 'Щомісячна перевірка тиску та роботи; щорічна ретельна перевірка; гідротест балона за виробником (сталь ~5 років; композит за клеймом).', ref: 'FSS Code Ch.3; maker' },
        { k: 'EEBD', v: 'Щомісячна перевірка; щорічний огляд; заміна за вказаним терміном служби.', ref: 'SOLAS II-2/13; FSS Code Ch.3' },
        { k: 'Спорядження пожежника / кошма / піногенератор', v: 'Щорічна перевірка.', ref: 'FSS Code Ch.3; MSC.1/Circ.1432' },
      ],
    },
    {
      emoji: '🧪',
      title: 'Інтервали перевірок — Other',
      rows: [
        { k: 'Станції промивання очей', v: 'Періодична перевірка; промивні пляшки — за терміном.', ref: 'maker / SMS' },
        { k: 'Аптечки / мед. набори', v: 'За вимогами прапора / MLC; вміст — за терміном придатності.', ref: 'flag; WHO IMGS' },
        { k: 'Газоаналізатори', v: 'Bump-тест перед використанням; калібрування за виробником (напр. раз на 6 міс.) зі щорічною повіркою.', ref: 'maker / SMS' },
        { k: 'Хімічні / газонепроникні костюми', v: 'Періодичний пневмотест за виробником.', ref: 'maker' },
        { k: 'Шафа SOPEP', v: 'Періодична перевірка комплектності; сорбенти/предмети поповнюються за використанням.', ref: 'MARPOL; SMS' },
      ],
    },
    {
      emoji: '✅',
      title: "Інспекції — журнал перевірок",
      body: [
        "Відкрийте позицію — відскануйте її QR-етикетку або знайдіть у категорії — і натисніть Weekly, Monthly, Quarterly або Annual. Пропонуються лише ті обходи, які належать категорії на цьому судні — розклад задається для кожної категорії в Settings → Checklists.",
        "Кожен пункт — PASS / FAIL / N/A. Кнопка «All pass» заповнює список одним дотиком, а ви знижуєте те, що справді несправне. Нічого не проставляється заздалегідь.",
        "Кнопка «Clear all» біля «All pass» починає обхід заново: після підтвердження скидаються всі відповіді, комментар і запис про дефект. Додані фотографії залишаються — їх видаляють по одній. На цьому етапі ще нічого не підписано, тож у справі нічого не змінюється.",
        "Перед початком оберіть, хто підписує, зі списку екіпажу — це ім'я потрапить у запис. Додайте коментар і до чотирьох фотографій-доказів: вони належать цій інспекції, а не загальним фото позиції.",
        "Підпис фіксує точні дату й час, члена екіпажу та версію чек-листа. Підписаний запис не може змінити або видалити ніхто, включно з Майстром: помилка виправляється новою інспекцією, і обидва записи лишаються у справі.",
        "Будь-який FAIL піднімає дефект на цій позиції, і він лишається відкритим, доки хтось не зафіксує усунення.",
        "Скан перед підписом (Settings → Scan QR label before signing, вмикає Master). Коли режим увімкнено, Crew і Officer можуть підписати перевірку лише після скану QR-наклейки цієї позиції сканером застосунку (кнопка QR). Скан діє 30 хвилин; введення коду вручну не зараховується.",
        "Скан за категоріями (Settings → Scan by category, вмикає Master). Правило не мусить стосуватися всього. Інвентар рятувальної шлюпки або дрібне майно в пожежному пості варто вести й відмічати по позиціях, але наклеювати мітку на кожен черпак і ключ ніхто не буде — вимкніть такі категорії тут, і їхні позиції перевіряються та підписуються просто зі списку. Для решти мітку й далі потрібно сканувати. Категорія, додана пізніше, за умовчанням підпадає під правило, а зроблений усе ж скан і далі фіксується в записі та друкується в колонці Scan звіту.",
        "Підпис обліковим записом пристрою (Settings → Sign as the device's account, вмикає Master). Коли режим увімкнено, кожен зареєстрований телефон, планшет чи ПК підписує перевірки від імені того, кому його видано — ім'я та посада з його облікового запису, — а список підписантів не пропонується. Офіцер більше не зможе відсканувати позицію своїм телефоном і поставити ім'я колеги. Кому належить пристрій, Master змінює в Settings → Accounts (перейменування); пристрій, не приєднаний до судна, як і раніше обирає зі списку екіпажу — він не має облікового запису, яким підписувати.",
        "Скан записується в підписаний запис і показується в колонці Scan звіту про перевірки. Master може підписати без скану (наклейку втрачено, позиція недоступна), але мусить вказати причину — вона друкується у звіті поруч із підписом.",
      ],
    },
    {
      emoji: '📋',
      title: 'Власні категорії та чек-листи',
      body: [
        'Вбудовані категорії й чек-листи за ними — відправна точка, а не межа. Судно, чия SMS формулює перевірку інакше — або яке оглядає те, про що більше ніхто не питає, — налаштовує і те, і те саме, у Settings.',
        'Settings → Categories додає власні рубрики: Emergency Lighting, Escape Routes, Alarm Systems — усе, що ви справді обходите. Рубрика має групу (LSA / FFE / Other), яка вирішує, до якого звіту вона потрапить, і піктограму. Далі рубрика поводиться як вбудована: власний список, QR-етикетки, чек-листи, звіти та власний аркуш у порожньому шаблоні імпорту — тобто сотня світильників заводиться з Excel, а не по одному.',
        "Будь-яку категорію можна перейменувати, зокрема вбудовані: категорія розпізнається за ключем, який ніколи не змінюється, тож позиції, їхня історія, QR-етикетки та сертифікати лишаються на місці, хоч би як вона називалася на екрані. А категорію, якої на судні немає, можна вимкнути: Equipment → \"Show or hide categories\" (лише Master), позначити непотрібні, натиснути Done. Прихована категорія зникає і з обходів, і з чек-листів, і з правил скану, і з друку етикеток, і з розділу «не перевірено» у звітах. Нічого не видаляється — позиції лишаються у справі з усім, що до них прив'язано, і категорію можна повернути звідти ж або з Settings → Categories.",
        "Звіт підписує себе сам: рядок \"Checked by / Rank / Date\" внизу звіту заповнюється тими, хто справді підписав уміщені в ньому перевірки. Якщо обхід робили кілька людей — названі всі; посада друкується, коли вона в них одна, а дата — це останній обхід у звіті, а не день вивантаження. Ті самі три рядки є у зведенні XLSX. Якщо за період нічого не підписано, порожні лінійки лишаються — для заповнення від руки.",
        'Settings → Checklists задає самі запитання. Відкриваєте обхід — чек-лист уже заповнений: переформулюйте рядок, змініть порядок, приберіть те, чого на вашому судні немає, додайте те, що вимагає ваша SMS. Зберігаєте — і наступний обхід запитає саме це, на всіх пристроях судна.',
        "Які обходи належать категорії — вирішуєте ви: тижневий, місячний, квартальний і річний, окремо для кожної категорії. У Settings → Checklists біля кожного обходу є перемикач: вимкніть — і категорії його більше не пропонують, а звіт перестає рахувати його як належний; увімкніть назад — обхід повертається. Кнопка \"＋ Weekly\", \"＋ Monthly\" або \"＋ Quarterly\" біля категорії створює обхід, якого в неї ще немає, на основі наявних перевірок — наприклад, тижневу перевірку EEBD або квартальну шляхів евакуації. Виправте пункти й збережіть: відтепер екран позиції пропонує цей обхід, а тижневий, місячний або квартальний звіт його враховує. На підписане це не впливає — записи у справі зберігають свій період і друкуються як раніше. Вбудованими такі обходи не роблять, бо інакше обхід, доданий для одного судна, став би обов'язковим для всіх.",
        'Робити це може Officer або Master. Сформулювати перевірку — робота того, хто веде обхід; вирішувати, чий підпис дійсний, лишається за Master.',
        'Правка не дістає до минулого. Кожна підписана інспекція несе власну копію запитань, під якими її підписали, тож переформульований сьогодні рядок не змінює жодного запису минулого місяця — відкрийте його, і він читається рівно так, як його підписували. Видалення рубрики теж не видаляє обладнання: позиції та їхня історія лишаються, і повернення рубрики повертає їх.',
      ],
    },
    {
      emoji: '🛠️',
      title: "Дефекти",
      body: [
        "Смуга Open defects на дашборді показує все, за чим ще є робота: фільтр LSA / FFE, новіші зверху, з віком кожного дефекту.",
        "Дефект — це не позначка на позиції, а сама провалена інспекція. Тому він завжди відповідає, що саме не так, хто це знайшов і коли.",
        "Відкрийте дефект і натисніть «Record rectification», коли роботу виконано — усунення теж підписується та штампується.",
        "Кожен дефект несе свою причину — рядки чек-листа, що не пройшли. Вони видні на картці, у смузі на дашборді та у графі «What failed» у звіті. Нотатка офіцера додається до них, а не заміняє їх: дефект, відкритий без нотатки, все одно каже, що саме не так.",
      ],
    },
    {
      emoji: '📤',
      title: 'Звіти та експорт',
      body: [
        'Відкрийте вкладку Reports і натисканням панелей категорій виберіть, що включити ("Select all" / "Clear all" — усі одразу). Лічильник показує, скільки позицій буде вивантажено.',
        "Експорт у PDF або XLSX (ім'я файлу MSM_report_DDMMYY): номер позиції, тип, розмір, серійний номер, розташування, дати, статус і коментарі. PDF — в альбомній орієнтації, кожна позиція в один рядок; у XLSX Make, Deck і Location йдуть окремими стовпцями, тож файл імпортується назад без правок.",
        'Export ZIP (PDF + photos) кладе в MSM_backup_DDMMYY.zip сам PDF, усі прикріплені фото/документи та файли сертифікатів, що покривають позиції (з certificates/INDEX.txt, де вказано, який сертифікат до яких позицій належить).',
        'Print надсилає звіт на принтер через системний діалог друку — або "Save to PDF". Експорт відкриває системне вікно «Поділитися».',
        "Reports → Inspections — запис того, що було зроблено. Виберіть групу (LSA, FFE, Other або All) і Weekly чи Monthly, потім стрілками ‹ › перейдіть до будь-якого минулого місяця чи тижня; \"Back to current\" повертає до поточного. Цифри на екрані — ті самі, що будуть надруковані.",
        "Під групою перелічені категорії, що мають перевірку цього періоду, з прогресом — «5 of 5 inspected · complete», «3 of 12» або «failed». Натисніть, щоб увімкнути чи вимкнути категорію; натисніть і утримуйте, щоб звіт був ЛИШЕ по ній. Так перевірка рятувальних кругів підшивається окремою сторінкою: звіт названо за категорією і містить лише її позиції — перевірені, неперевірені та відкриті дефекти по них. «Whole group» повертає все.",
        "Звіт починається з підсумку — наприклад, \"September 2026 Monthly Inspection – Completed – Passed\" або \"Incomplete (12 of 40 inspected)\" і \"Failed\", якщо так і є. Саме цей рядок підшивають як підтвердження до системи планового обслуговування (PMS). Кожна позиція оцінюється за останньою інспекцією за період, тож усунене й повторно перевірене зауваження не зараховується проти неї.",
        "Проведені інспекції перелічено зі стовпцями No., Location, Category, Type, Size, Serial, Result, Comments, Initials інспектора, Date і Time; під таблицею — розшифровка ініціалів. Написане в Comments під час інспекції — і що не пройшло перевірку — переноситься до звіту. Далі йдуть позиції, не перевірені за період, і всі незакриті дефекти.",
        "У звіті про перевірки є колонка Scan: QR — наклейку відскановано перед підписом, No scan — Master підписав без скану (причина в Comments). XLSX реєстру містить колонку MSM ID — збережіть її під час редагування файлу, і Import → Update знову знайде кожну позицію.",
      ],
    },
    {
      emoji: '💾',
      title: 'Резервна копія та відновлення',
      body: [
        'Settings → Export backup (.msm) створює один файл з усім на пристрої: позиції, сертифікати, журнали компресорів, дані судна та прикріплені файли всередині (MSM_backup_DDMMYY.msm).',
        'Restore backup (.msm) відтворює дані на іншому пристрої або після перевстановлення — замінює всі поточні дані, тож відновлюйте на чистий пристрій.',
        'Бекап працює без хмари. Налаштування пристрою (наприклад, перемикач модуля компресора) до бекапу не входять.',
        "Крім того, застосунок під час кожного відкриття робить ЗЛІПОК записів і зберігає на пристрої три останні. Settings → Data → «Roll back to …» прямо називає момент, до якого поверне. Він існує заради аварій, яких ніхто не планує — відновили не той файл, спорожнили реєстр, — і це та копія, яка справді буде під рукою: ніхто не робить експорт зранку напередодні помилки.",
        "Зліпок несе ЗАПИСИ, а не файли. Світлини й документи лишаються на пристрої під своїми іменами й не втрачають зв'язку, тож відкат не замінює справжню копію, винесену на іншу машину.",
        "Порожній реєстр ніколи не затирає добрий зліпок: якщо застосунок відкрився на порожнечі, вже збережені копії залишаються.",
        "Відновлення та відкат — права Майстра: вони замінюють реєстр і віддають його судну, тобто переписують те, з чим уже працювали інші офіцери. В офіцера лишаються імпорт і експорт. Пристрій, що не приєднався до судна, зберігає все: його реєстр належить лише йому.",
      ],
    },
    {
      emoji: '🗑️',
      title: 'Скидання всіх даних',
      note: 'Спершу зробіть Export backup (.msm), якщо дані ще можуть знадобитися — скидання незворотне.',
      body: [
        'Унизу Settings кнопка "Reset all data" безповоротно видаляє всі позиції, сертифікати, журнали компресорів, прикріплені файли та дані судна на цьому пристрої.',
        'Захищено паролем: введіть пароль "Reset all data" точно, щоб активувати кнопку підтвердження. Тап поза вікном або Cancel — скасування.',
        'Налаштування пристрою та згода з Privacy Policy / Terms зберігаються; видаляються лише дані реєстру.',
        "Скидання — право Майстра, і на синхронізованому пристрої воно очищає не апарат, а СУДНО. Підтвердження каже про це прямо, а кнопка називається «Erase everywhere»: за секунди це доходить до суднового реєстру й до всіх інших приладів на борту.",
        "Щоб очистити лише цей пристрій, спершу залиште судно: Settings → This device → «Sign off & erase». Суднова копія лишається недоторканою.",
        "Скидання стирає й автоматичні зліпки — інакше «видалити все» було б неправдою.",
      ],
    },
    {
      emoji: '🔑',
      title: "Приєднання до судна, акаунти та ролі",
      body: [
        "Судно визначається номером IMO (Налаштування → Vessel). Усе інше випливає з нього, а картка вгорі налаштувань завжди називає наступний крок.",
        "ПЕРШИЙ пристрій приєднується за стартовим кодом, що постачається з ліцензією, і стає Майстром.",
        "Далі Майстер видає кожному члену екіпажу акаунт у Налаштування → Accounts: ім'я та восьмизначний PIN. PIN лишається видимим у списку, і його можна перевипустити або відкликати для однієї людини.",
        "Решта вводять IMO, потім приєднуються з картки «This device» вгорі Налаштувань — своїм ім'ям і PIN. Пристрій потрапляє в чергу; Майстер схвалює його в Accounts → Devices, і пристрій сам помічає це за кілька секунд — без перезапуску.",
        "Три ролі: Crew проводить інспекції, Officer додатково закриває дефекти, Master додатково видає акаунти та змінює ролі. Ролі перевіряє сервер, а не лише застосунок.",
        "Загубили телефон? Майстер вимикає цей пристрій у Accounts → Devices. Інших це не стосується.",
        "У запрошенні можна вказати й ПОСАДУ на судні — Third Officer, Bosun, Chief Engineer. Це навмисно не те саме, що роль: другий механік може мати обліковку Crew, а курсант — Officer, тож підвищення на борту не перетворюється на зміну прав. Посада їде разом із людиною на екран приєднання та у список підписантів, тож ані ім'я, ані посада не набираються двічі.",
        "Після приєднання Settings → This device показує, ким пристрій підписує: ім'я, посаду й чи схвалений він. Читається наживо з судна, тож посада, змінена Майстром за годину, з'явиться сама.",
        "«Sign off this device» — вихід із судна з цього апарата. Синхронізація припиняється одразу, і назад пристрій сам себе не впустить: потрібне нове запрошення та схвалення Майстра. «Sign off & erase» на додачу стирає реєстр на цьому апараті — для випадку, коли його передають або продають. Ані те, ані інше не починає безкоштовний період заново: він належить судну, а не пристрою.",
        "Інтерфейс іде за рангом. Акаунти, список екіпажу та список пристроїв — права Майстра, іншим вони не пропонуються. Сервер такі записи все одно відхиляв; кнопка, що завжди падає, лише повідомляє неправду про ваші власні повноваження.",
        "Якщо Майстер вилучив пристрій, той так і скаже й запропонує приєднатися знову, а не висітиме на помилці зв'язку, з якою нічого не вдієш. Для повернення потрібне нове запрошення, як і першого разу.",
      ],
    },
    {
      emoji: '🧭',
      title: "Доступ — які вкладки бачить пристрій (Access)",
      body: [
        "Settings → Access (лише Майстер) — таблиця: рядок на кожен пристрій, стовпець на кожну вкладку — Certificates, PMS, Rest, Reports. Зелена точка — вкладка на цьому пристрої є, червона — немає. Натисніть, щоб перемкнути; пристрій підхопить при наступній синхронізації.",
        "Так у кожного на екрані лише потрібне: у матроса немає плану ТО машинного відділення, у механіка — сертифікатів екіпажу.",
        "Dashboard, Equipment і Settings увімкнені завжди. На пристрої Майстра завжди всі вкладки. Пристрій, який Майстер ще не налаштовував, показує всі вкладки — після оновлення нічого не зникне.",
        "Це порядок, а не замок: що пристрій може змінювати, як і раніше вирішує його роль в Accounts, і це перевіряє сервер.",
      ],
    },
    {
      emoji: '📚',
      title: "ISM-документи",
      body: [
        "Вкладка Docs зберігає керовані документи судна — посібник SMS, процедури, циркуляри, постійні розпорядження капітана, політики, форми — у кожного номер, ревізія, дата випуску й дата перегляду. Документ — це файл (PDF з офісу), текст, написаний на борту, або обидва.",
        "Угорі — те, що людині на цьому пристрої ще треба прочитати. Відкрийте документ, прочитайте й натисніть I have read and understood: це підпис за поточну ревізію, підтверджений як будь-який інший.",
        "У кожного документа видно, скільки людей зі списку екіпажу підписали і хто ще ні. Підписи ніколи не видаляються.",
        "Офіцери й Майстер додають і редагують документи. New revision переводить його в Rev N+1 і просить усіх прочитати й підписати знову; підписи попередніх ревізій лишаються в історії. Виправлення одруківки в тій самій ревізії цього не робить.",
        "Файли потрапляють на всі пристрої через судно. Якщо файл не вдалося завантажити (немає зв'язку), документ зберігається, а файл лишається на пристрої, який його прикріпив, доки його не збережуть знову зі зв'язком.",
      ],
    },
    {
      emoji: '🏢',
      title: "Берегова консоль (суперінтендант)",
      body: [
        "Для суперінтенданта в офісі: одна консоль з усіма його суднами, спочатку проблемні — прострочене й найближче обладнання, сертифікати (судна, екіпажу, обладнання), ТО, запчастини та ISM-документи, які ще не підписані.",
        "Доступ дає Майстер кожного судна: в Accounts видати акаунт типу Superintendent (shore). Суперінтендант відкриває Fleet (app.ismpilot.com/fleet), вводить IMO, ім'я та PIN — судно додано; наступні судна додаються так само. Майстер бачить цей акаунт у Devices і може вимкнути його будь-коли.",
        "Відкрийте судно, щоб додавати й редагувати його сертифікати та ISM-документи, випускати нову ревізію й бачити, хто не підписав. Зміни приходять на пристрої на борту під час наступної синхронізації. Обладнання — лише для перегляду: його перевіряють на борту.",
      ],
    },
    {
      emoji: '✍️',
      title: "Підтверджені підписи",
      body: [
        "Якщо Майстер увімкнув Settings → Confirm every signature, кожен підпис — перевірка, робота ТО, рух складу — підтверджується: відбитком або обличчям на своєму пристрої чи своїм PIN підпису.",
        "Відбиток і обличчя доступні, лише коли пристрій підписує як свій акаунт. Телефон знає, що приклали збережений палець, але не чий — тож на спільному планшеті кожен підписує своїм PIN.",
        "Під час першого підпису на пристрої ви обираєте PIN підпису з 4–6 цифр. Це не PIN акаунта; він зберігається лише як хеш, і прочитати його не може ніхто, зокрема Майстер. П'ять невдалих спроб блокують його на п'ять хвилин. Забули — Майстер скидає його в Settings, і ви обираєте новий.",
        "У звіті поруч з ім'ям зазначено, чим підтверджено підпис (PIN чи біометрія).",
      ],
    },
    {
      emoji: '🛏️',
      title: "Години відпочинку (Hours of rest)",
      body: [
        "Вкладка Rest записує роботу й відпочинок кожної людини по півгодини, за судновим часом. Екран відкривається на людині, якій належить пристрій; Майстер може перемкнутися на будь-кого, щоб перевірити чи виправити його місяць.",
        "Натисніть день, оберіть «перо» (Tap marks WORK / Tap marks REST) і пройдіться натисканнями по годинах — або заповніть день одним натисканням: Same as previous day, Day work 08–17, три вахтові графіки, Day off. Під час переходу на сусідній день поточний зберігається.",
        "Правила перевіряються під час введення разом із сусідніми днями: щонайменше 10 год відпочинку за будь-які 24 год і 77 год за будь-які 7 днів; відпочинок не більше ніж у двох періодах, один не коротший за 6 год; не більше 14 год між періодами відпочинку (MLC 2006 Reg. 2.3, STCW A-VIII/1). Вікна ковзні, тож порушення через північ теж видно. Перевірка орієнтовна: винятки, дозволені прапором (навчання, аварії), вирішує Майстер — запишіть їх у Note дня.",
        "День без запису показано як «Not recorded», і він ніколи не вважається відпочинком.",
        "Monthly record (PDF) друкує місяць у звичній формі — рядок на день, робота зафарбована, підсумки, порушення — з місцями для підпису моряка й Майстра.",
      ],
    },
    {
      emoji: '⚙️',
      title: "Планове ТО (Planned maintenance)",
      body: [
        "Вкладка PMS (або смуга Maintenance на дашборді) — механізми: головні двигуни, генератори, опріснювач, компресори, насоси, стабілізатори — у кожного лічильник мотогодин і свої роботи.",
        "Робота має інтервал у мотогодинах, у днях або і те, і те; строк настає за тим, що раніше, як пишуть виробники («кожні 250 год або 12 місяців»). Один раз укажіть, коли її робили востаннє — дата й лічильник; далі Record as done зсуває це сам. Робота, яку ще не робили, показує «Never done» замість дати.",
        "Показання лічильника вводяться на екрані механізму (Save reading). За останніми показаннями рахується середнє на добу, тож у роботи за годинами видно й приблизно скільки днів лишилося. Показання менше за попереднє не приймається: замінений лічильник — це новий механізм.",
        "«Скоро» — останні 10 % інтервалу, а не 60 днів, як в обладнання: інакше щомісячна робота була б «скоро» з першого ж дня.",
        "Typical jobs додає звичний перелік для типу механізму. Інтервали типові, не від виробника: звірте кожен з інструкцією й виправте.",
        "Record as done підписує виконання — дата, лічильник, примітка, ваше ім'я — в історію механізму. Як і перевірку, її не можна змінити чи видалити; помилка виправляється повторним записом. Під час видалення механізму чи роботи історія зберігається.",
      ],
    },
    {
      emoji: '📦',
      title: "Запчастини (Spare parts)",
      body: [
        "Вкладка Spares — це склад: у кожної позиції назва, партномер, виробник, місце зберігання і мінімальний залишок. Список згрупований за місцями зберігання, спочатку те, чого немає або мало; кнопка To order залишає лише такі позиції.",
        "Залишок ніколи не вводиться поверх. Відкрийте запчастину: + Received — надходження, − Used — взято поза планом ТО, Stocktake — скільки фізично на полиці. Кожна дія — підписаний рух, а залишок — їхня сума, тож якщо два пристрої записали одночасно, врахуються обидва.",
        "Перерахунок записується як різниця з обліком, тож перерахунок без зв'язку не скасує надходження, записане в цей час на іншому пристрої. Помилковий рух виправляється перерахунком; рухи не редагуються.",
        "Позначте, до яких механізмів підходить запчастина: у картці механізму буде список його запчастин із залишком. У роботі ТО розділ Parts used each time перелічує, що вона витрачає; Record as done списує це зі складу, а кількість можна змінити або поставити 0 у день роботи.",
        "На головному екрані з'являється рядок, коли щось закінчилося або нижче мінімуму.",
      ],
    },
    {
      emoji: '☁️',
      title: "Синхронізація та фото інспекцій",
      body: [
        "Після приєднання синхронізація йде сама — кнопок Push / Pull більше немає. Підписали запис — за секунди він на інших пристроях судна; застосунок повністю працює офлайн.",
        "Записи інспекцій лише додаються, тому двоє офіцерів на двох телефонах не затруть роботу одне одного. Реєстр обладнання — один спільний документ: якщо двоє правлять ОДНУ позицію одночасно, перемагає пізніша правка.",
        "Фотографії зменшуються під час зйомки та стають у чергу. Налаштування → Inspection photos: лише Wi-Fi (типово), будь-яке з'єднання або ніколи.",
        "У хмарі фотографія зберігається 90 днів. Далі її зберігає судно: Налаштування → Inspection photos → Photo archive зберігає місяць одним ZIP — самі знімки плюс перелік: позиція, обхід, результат, хто підписав. Покладіть файл туди, де судно тримає документи, і підтвердьте — після цього за ніч ці фотографії видаляються з хмари. З непідтвердженого місяця не видаляється нічого, з телефонів і планшетів не видаляється нічого ніколи, а підписані записи — перевірки, звіти, резервна копія .msm — це не зачіпає. Підтверджує Master; зберегти копію може будь-хто.",
        "Вкладені файли й далі переносяться в .msm-резервній копії.",
        "Світлини та прикріплені документи більше не їдуть усередині реєстру — вони йдуть у сховище, а в записі лишається посилання. Документ Firestore обмежений 1 МіБ, і двох знімків вистачало, щоб зупинити синхронізацію всього судна.",
        "Судну без ліцензії доступно 25 вивантажених файлів. Це єдине обмеження, що діє й під час пробного періоду: знімки судна лежать на нашому рахунку за сховище. На пристрої не заборонено нічого — знімки робляться, зберігаються, показуються й потрапляють у .msm-резерв як раніше; чекає лише копія для інших пристроїв, і все притримане піде першою ж синхронізацією після оплати.",
      ],
    },
    {
      emoji: '🔔',
      title: 'Нагадування про терміни',
      body: [
        'Settings → Modules → Expiry reminders планує локальні сповіщення за 60, 30 і 7 днів до дати перевірки або закінчення кожної позиції.',
        'Під час першого ввімкнення дозвольте сповіщення. Нагадування автоматично синхронізуються при додаванні, зміні чи імпорті позицій.',
        'Працюють лише на пристрої (інтернет не потрібен). За великого реєстру спершу плануються найближчі нагадування, список дозаповнюється у міру проходження дат.',
      ],
    },
    {
      emoji: '🎨',
      title: 'Оформлення (теми)',
      body: [
        'Settings → Appearance перемикає тему: Light (за замовчуванням), Dark і Colorful.',
        'Settings → Modules → Sounds вимикає або вмикає всі звуки — корабельний дзвін під час запуску та сигнали при збереженні, підписі й помилці. Вибір запам\'ятовується на цьому пристрої; довгий обхід проходить тихіше.',
        'Colorful фарбує іконки обладнання за групами — LSA зелений, FFE червоний, Other бірюзовий. Вибір зберігається і діє в усьому застосунку.',
        'На планшетах списки Dashboard, Equipment, Certificates і Reports автоматично показуються у дві колонки.',
      ],
    },
    {
      emoji: '👑',
      title: "Ліцензія на судно",
      body: [
        "ISMpilot Pro ліцензується на СУДНО. Ліцензія прив'язана до корабля за номером IMO, не до людини й не до пристрою. Усі офіцери та всі телефони, що приєдналися до судна, покриті однією ліцензією.",
        "Кожне судно має 60 днів, щоб спробувати застосунок, перш ніж почне діяти ліміт 15 позицій на категорію.",
        "Ціни та ліцензії для флоту: mail@ismpilot.com.",
        "Ліцензію купує один раз той, хто веде судно, і активує її на акаунті корабля: Налаштування → ISMpilot Pro → Activate the vessel licence. Відтоді повний доступ мають усі приєднані пристрої.",
        "Без ліцензії після безкоштовного періоду застосунок працює далі, але реєстр обмежений 15 позиціями на категорію.",
        "Пристрій, приєднаний до судна з ліцензією, отримує її автоматично. Якщо він усе ж показує сторінку активації, відкрийте її та натисніть Restore the vessel licence.",
      ],
    },
    {
      emoji: 'ℹ️',
      title: 'Про застосунок',
      body: [
        aboutLine('uk'),
        'Застосунок — допоміжний інструмент обліку. Він не замінює офіційну суднову документацію з безпеки, обов’язкові освідчення та вимоги класу/прапора. Завжди дотримуйтесь СУБ компанії та чинних правил.',
      ],
      link: APP_CONFIG.website,
      watermark: true,
    },
  ],
};

export const MANUAL: Record<Lang, ManualContent> = { en, ru, es, uk };

// ---- Modules that ship dark --------------------------------------------------
// A module that is off (constants/modules.ts) has no screen, so the manual must
// not describe one. Keyed by the ENGLISH title, like the help buttons; `from`
// hides only the paragraphs from that position on, for a module that extends an
// existing section (crew certificates in Certificates). The order and length of
// each section's body are the same in every language.
const MODULE_PARTS: { title: string; module: ModuleKey; from?: number }[] = [
  { title: 'Certificates', module: 'crewCerts', from: 4 },
  { title: 'Access — which tabs each device shows', module: 'access' },
  { title: 'Hours of rest', module: 'rest' },
  { title: 'Planned maintenance', module: 'pms' },
  { title: 'Spare parts', module: 'spares' },
  { title: 'Confirmed signatures', module: 'signConfirm' },
  { title: 'ISM documents', module: 'docs' },
  { title: 'Fleet console (superintendent)', module: 'fleet' },
];

/** The manual as this build should show it: sections of switched-off modules removed. */
export function releasedManual(lang: Lang): ManualContent {
  const content = MANUAL[lang];
  const sections: Section[] = [];
  content.sections.forEach((sec, i) => {
    const part = MODULE_PARTS.find((p) => p.title === MANUAL.en.sections[i]?.title && !moduleOn(p.module));
    if (!part) sections.push(sec);
    else if (part.from != null) sections.push({ ...sec, body: sec.body?.slice(0, part.from) });
  });
  return { ...content, sections };
}
