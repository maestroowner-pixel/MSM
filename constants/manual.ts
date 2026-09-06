// ===================================
// Manual content, localized (en / ru / es / uk).
// The app's UI labels (menu/button names) stay in English — they appear in
// English in the app — so the localized prose references them verbatim. Only
// explanations are translated; regulatory reference codes are left unchanged.
// ===================================

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
  octopus?: boolean;
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
        'Equipment is grouped into 23 categories under three groups: LSA, FFE and Other. Each item has a type, serial/ID, position on the vessel, and the dates that drive compliance.',
        'Fastest way to begin: Settings → Import from Excel → Download blank template, then copy your existing register into it WITHOUT changing the column order, and import that file. The importer reads by column headers, so an arbitrary workbook with different or rearranged columns may not map correctly — the template guarantees a clean import. All data stays on the device and can optionally sync to the cloud.',
      ],
    },
    {
      emoji: '📥',
      title: 'Importing from Excel',
      body: [
        'Settings → Import from Excel → choose your .xlsx workbook. Each worksheet (Liferafts, Lifejackets, Fire extinguishers, …) maps to a category automatically.',
        'No workbook yet? Tap "Download blank template (.xlsx)" on the Import screen (or Settings → Download import template) — one sheet per category with the right column headers — fill it in and import it back.',
        'You get a preview of how many items were found per category before anything is saved.',
        'Choose "Replace all" to overwrite the imported categories, or "Append" to add to what is already there.',
        'Dates written as Excel serials, years (e.g. "2034") or DD/MM/YYYY are converted automatically. You can edit any item afterwards.',
      ],
    },
    {
      emoji: '🧰',
      title: 'Equipment & categories',
      body: [
        'The Equipment tab shows a grid of all categories with item counts and a coloured dot for the worst status inside.',
        'Tap a category to see its items; use the search box to filter by type, serial or position. Tap ＋ to add a new item by hand.',
        'Dates are set with a calendar picker — tap the field, then choose year, month and day.',
        'Badges next to an item show one paperclip per attached file (📎) and 📜 when a certificate covers it.',
        'Checklist categories (Hydrants, BA Bottle Pressure, Fire Detectors) have monthly check toggles in the item screen.',
        'Inside a category, sort by Expiry date, Position, Name (A–Z) or Type — Position and Type group items under headers. On tablets the list shows two columns.',
        "\"Other Safety Equipment\" is the catch-all: anything the standard sheets do not name — a portable pump, a spare charge, a locker of gear nobody else counts. It is built by hand with ＋ (there is no worksheet to import it from) and behaves like any other category — due dates, QR labels, inspections, reports.",
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
      emoji: '📜',
      title: 'Certificates',
      body: [
        'The Certificates tab holds documents that cover many items at once — e.g. a single liferaft service certificate applying to several rafts (a "group certificate").',
        'Open a certificate to set its number, issue/expiry dates (calendar picker) and attached file, and to link the items it covers.',
        'A certificate carries its own expiry status (red / amber / green), so it appears in your due-soon view.',
        'On an item screen, covering certificates are listed — tap ＋ Link to attach an existing certificate to that item (it is saved straight away). Items covered show a 📜 badge.',
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
      ],
    },
    {
      emoji: '🔎',
      title: 'Scan, flag & recently scanned',
      body: [
        'Scan a QR label or a serial from the QR button in the header of the Dashboard or the Categories tab. A match opens the item straight away; a maker\'s barcode or a recorded serial finds it too. Use the in-app button rather than the phone\'s own camera — an MSM QR is a private link the camera app cannot open by itself. If a code is too damaged to scan and you can still read the digits, type them in — same lookup.',
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
        "Open an item — scan its QR label or find it in a category — and tap Weekly or Monthly. Only the periods that category actually has a checklist for are offered.",
        "Every line is PASS / FAIL / N/A. \"All pass\" fills the list in one tap and you downgrade what is actually wrong; nothing is pre-filled until you tap it, because an untouched checklist must never look like an inspected one.",
        "Choose who is signing from the vessel's crew list before you start — that name goes on the record. Add comments and up to four evidence photographs; they belong to that inspection, not to the item's general photos.",
        "Signing stamps the exact date and time, the crew member and the checklist version. A signed record cannot be edited or deleted by anyone, including the Master: a mistake is corrected by inspecting the item again, and both records stay on file. That is what makes the trail worth showing to a surveyor.",
        "Any FAIL raises a defect against that item, and it stays outstanding until somebody records the rectification.",
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
        'Export as PDF or XLSX (named MSM_report_DDMMYY): type, serial, position, dates and status. The PDF is landscape with each item on a single line.',
        'Export ZIP (PDF + photos) bundles the PDF, every attached photo/document, and the certificate files covering the items (with a certificates/INDEX.txt mapping each certificate to its items) into MSM_backup_DDMMYY.zip.',
        'Print sends the report to a printer via the system print dialog — or "Save to PDF". Exports open the device share sheet.',
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
        "To empty only this device, leave the vessel first: Settings → Vessel → This device → \"Sign off & erase\". The vessel's copy is untouched.",
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
        "Everyone else enters the IMO, then Settings → Vessel → Join this vessel with their name and PIN. Their device waits in a queue; the Master approves it in Accounts → Devices, and the waiting device notices by itself within seconds — no restart and nothing to re-enter.",
        "Three roles: Crew records inspections, Officer also clears defects, Master also issues accounts and sets roles. Roles are enforced by the server, not merely by the app.",
        "Lost a handset? The Master switches that device off in Accounts → Devices. Nobody else is disturbed and no password changes.",
        "An invitation can also carry the person's RANK ABOARD — Third Officer, Bosun, Chief Engineer. That is deliberately not the same thing as the role: a Second Engineer may hold a Crew account and a cadet an Officer one, so a promotion aboard is not a permissions change. The rank travels with them onto the join screen and into the signing list, so no name and no rank is ever typed twice.",
        "Once a device has joined, Settings → Vessel → This device shows who it signs as: name, rank, and whether it is approved. It is read live from the vessel, so a rank the Master changes an hour later appears by itself.",
        "\"Sign off this device\" leaves the vessel from that handset. It stops syncing at once and cannot let itself back in, so rejoining needs a fresh invitation and the Master's approval. \"Sign off & erase\" also clears the register on that device — for one being handed on or sold. Neither starts a new trial: the 60 days belong to the vessel, not to the handset.",
        "The interface follows the rank. Accounts, the crew list and the device list are the Master's and are not offered to anyone else. The server refused those writes in any case; a button that always fails only tells you something untrue about your own authority.",
      ],
    },
    {
      emoji: '☁️',
      title: "Cloud sync & inspection photos",
      body: [
        "Once a device has joined, sync keeps itself in step — there are no Push / Pull buttons. Sign a record and it is on the vessel's other devices in seconds; the app stays fully usable offline and catches up when the connection returns.",
        "Inspection records are append-only, so two officers working a round on two phones cannot overwrite each other. The equipment register is one shared document: if two people edit the SAME item at once, the later edit wins.",
        "Evidence photographs are downscaled on capture and then queued. Settings → Inspection photos chooses Wi-Fi only (the default), any connection, or never — at sea the airtime bill is the vessel's, so the record travels at once and the pictures follow in port.",
        "Attached files still travel in an .msm backup, which remains the way to move everything between devices without a connection.",
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
        'Colorful tints equipment icons by group — LSA green, FFE red, Other teal. Your choice is saved and applies across the whole app.',
        'On tablets the Dashboard, Equipment, Certificates and Reports lists show two columns automatically.',
      ],
    },
    {
      emoji: '👑',
      title: "Vessel licence",
      body: [
        "MSM Pro is €99 per year for the VESSEL — licensed to the ship by its IMO number, not per person and not per device. Every officer and every handset that has joined the vessel is covered by the one licence.",
        "Every install has 60 days free, with no key and no card — long enough to run a full monthly cycle before deciding.",
        "The licence is bought once by whoever manages the vessel and activated on the ship's account: Settings → Marine Safety Manager Pro → Activate the vessel licence. From that moment every enrolled device has full access; a crew member buys nothing and needs no store account.",
        "Without a licence after the free period the app keeps working, but the register is capped at 15 items per category — enough to try it, not enough to run a ship.",
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
      octopus: true,
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
        'Оборудование сгруппировано в 23 категории под тремя группами: LSA, FFE и Other. У каждой позиции есть тип, серийный номер/ID, расположение на судне и даты, определяющие соответствие.',
        'Быстрее всего начать: Settings → Import from Excel → Download blank template, затем скопируйте в него вашу имеющуюся базу, НЕ меняя порядок столбцов, и импортируйте этот файл. Импортёр читает по заголовкам столбцов, поэтому произвольный файл с другими или переставленными столбцами может не распознаться — шаблон гарантирует чистый импорт. Все данные хранятся на устройстве и при желании синхронизируются с облаком.',
      ],
    },
    {
      emoji: '📥',
      title: 'Импорт из Excel',
      body: [
        'Settings → Import from Excel → выберите файл .xlsx. Каждый лист (Liferafts, Lifejackets, Fire extinguishers, …) автоматически сопоставляется с категорией.',
        'Нет файла? Нажмите "Download blank template (.xlsx)" на экране импорта (или Settings → Download import template) — по листу на категорию с правильными заголовками — заполните и импортируйте обратно.',
        'Перед сохранением показывается предпросмотр: сколько позиций найдено в каждой категории.',
        'Выберите "Replace all", чтобы перезаписать импортируемые категории, или "Append", чтобы добавить к уже имеющимся.',
        'Даты в виде Excel-серий, годов (например, "2034") или ДД/ММ/ГГГГ конвертируются автоматически. Любую позицию можно отредактировать позже.',
      ],
    },
    {
      emoji: '🧰',
      title: 'Оборудование и категории',
      body: [
        'Вкладка Equipment показывает сетку всех категорий с количеством позиций и цветной точкой худшего статуса внутри.',
        'Нажмите категорию, чтобы увидеть позиции; поиском фильтруйте по типу, серийному номеру или расположению. ＋ добавляет новую позицию вручную.',
        'Даты задаются календарём — нажмите поле и выберите год, месяц и день.',
        'Значки у позиции: по одной скрепке на каждый прикреплённый файл (📎) и 📜, если её покрывает сертификат.',
        'У чек-лист категорий (Hydrants, BA Bottle Pressure, Fire Detectors) в карточке есть помесячные отметки проверок.',
        'Внутри категории — сортировка по Expiry date, Position, Name (А–Я) или Type; в режимах Position и Type позиции группируются под заголовками. На планшетах список показывается в две колонки.',
        "«Other Safety Equipment» — категория для всего остального: что не названо в стандартных листах — переносной насос, запасной заряд, шкаф со снаряжением, которое больше нигде не учтено. Заполняется вручную кнопкой ＋ (импортировать её неоткуда — такого листа в книге нет) и ведёт себя как любая другая категория: сроки, QR-этикетки, инспекции, отчёты.",
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
      emoji: '📜',
      title: 'Сертификаты',
      body: [
        'Вкладка Certificates хранит документы, покрывающие сразу много позиций — например, один сервисный сертификат на несколько плотов ("групповой сертификат").',
        'Откройте сертификат, чтобы задать номер, даты выдачи/окончания (через календарь), прикреплённый файл и связать покрываемые позиции.',
        'У сертификата свой статус срока (красный / жёлтый / зелёный), поэтому он попадает в список «скоро истекает».',
        'В карточке позиции перечислены покрывающие её сертификаты — нажмите ＋ Link, чтобы привязать к позиции существующий сертификат (сохраняется сразу). Покрытые позиции отмечены значком 📜.',
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
      ],
    },
    {
      emoji: '🔎',
      title: 'Сканирование, флаги и недавно отсканированные',
      body: [
        'Сканируйте QR-этикетку или серийный номер кнопкой QR в шапке экрана Dashboard или вкладки Categories. Совпадение сразу открывает позицию; заводской штрихкод или записанный серийный номер тоже её найдут. Пользуйтесь кнопкой в приложении, а не системной камерой — QR формата MSM это приватная ссылка, которую камера сама открыть не может. Если код повреждён, а цифры ещё читаются, введите их вручную — поиск тот же.',
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
        "Откройте позицию — отсканируйте её QR-этикетку или найдите в категории — и нажмите Weekly или Monthly. Предлагаются только те периоды, для которых у категории есть чек-лист.",
        "Каждый пункт — PASS / FAIL / N/A. Кнопка «All pass» заполняет весь список одним нажатием, а вы понижаете то, что действительно неисправно. Ничего не проставляется заранее: незаполненный чек-лист не должен выглядеть как пройденный.",
        "Перед началом выберите, кто подписывает, из списка экипажа судна — это имя попадёт в запись. Добавьте комментарий и до четырёх фотографий-доказательств: они принадлежат этой инспекции, а не общим фото позиции.",
        "Подпись фиксирует точные дату и время, члена экипажа и версию чек-листа. Подписанную запись не может изменить или удалить никто, включая Мастера: ошибка исправляется новой инспекцией, и обе записи остаются в деле. Именно это делает журнал пригодным для предъявления инспектору.",
        "Любой FAIL поднимает дефект на этой позиции, и он остаётся открытым, пока кто-нибудь не зафиксирует устранение.",
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
        'Экспорт в PDF или XLSX (имя MSM_report_DDMMYY): тип, серийный номер, расположение, даты и статус. PDF — альбомный, каждая позиция в одну строку.',
        'Export ZIP (PDF + photos) кладёт в MSM_backup_DDMMYY.zip сам PDF, все прикреплённые фото/документы и файлы сертификатов, покрывающих позиции (с certificates/INDEX.txt, где указано, какой сертификат к каким позициям относится).',
        'Print отправляет отчёт на принтер через системный диалог печати — или "Save to PDF". Экспорт открывает системное окно «Поделиться».',
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
        "Чтобы очистить только это устройство, сначала выйдите с судна: Settings → Vessel → This device → «Sign off & erase». Судовая копия остаётся нетронутой.",
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
        "Остальные вводят IMO, затем Настройки → Vessel → Join this vessel со своим именем и PIN. Устройство попадает в очередь; Мастер одобряет его в Accounts → Devices, и ожидающее устройство само замечает это за несколько секунд — без перезапуска и без повторного ввода.",
        "Три роли: Crew проводит инспекции, Officer вдобавок закрывает дефекты, Master вдобавок выдаёт аккаунты и меняет роли. Роли проверяются сервером, а не только приложением.",
        "Потеряли телефон? Мастер выключает это устройство в Accounts → Devices. Остальных это не касается, пароли менять не нужно.",
        "В приглашении можно указать и ДОЛЖНОСТЬ на судне — Third Officer, Bosun, Chief Engineer. Это намеренно не то же самое, что роль: второй механик может иметь учётку Crew, а курсант — Officer, поэтому повышение на борту не превращается в изменение прав. Должность едет вместе с человеком на экран вступления и в список подписантов, так что ни имя, ни должность не набираются дважды.",
        "После вступления Settings → Vessel → This device показывает, кем устройство подписывает: имя, должность и одобрено ли оно. Читается живьём с судна, поэтому должность, изменённая Мастером через час, появится сама.",
        "«Sign off this device» — выход с судна с этого аппарата. Синхронизация прекращается сразу, и обратно устройство само себя не впустит: нужно новое приглашение и одобрение Мастера. «Sign off & erase» вдобавок стирает регистр на этом аппарате — для случая, когда его передают другому или продают. Ни то, ни другое не открывает новый пробный период: 60 дней принадлежат судну, а не устройству.",
        "Интерфейс следует рангу. Аккаунты, список экипажа и список устройств — права Мастера, остальным они не предлагаются. Сервер такие записи всё равно отклонял; кнопка, которая всегда падает, лишь сообщает неправду о ваших собственных полномочиях.",
      ],
    },
    {
      emoji: '☁️',
      title: "Синхронизация и фото инспекций",
      body: [
        "После вступления синхронизация идёт сама — кнопок Push / Pull больше нет. Подписали запись — через секунды она на других устройствах судна; приложение полностью работает офлайн и догоняет, когда связь вернётся.",
        "Записи инспекций только дополняются, поэтому два офицера на двух телефонах не затрут работу друг друга. Реестр оборудования — один общий документ: если двое правят ОДНУ позицию одновременно, побеждает более поздняя правка.",
        "Фотографии уменьшаются при съёмке и ставятся в очередь. Настройки → Inspection photos: только Wi-Fi (по умолчанию), любое соединение или никогда. В море за трафик платит судно, поэтому запись уходит сразу, а снимки догоняют в порту.",
        "Вложенные файлы по-прежнему переносятся в .msm-бэкапе — это способ перенести всё между устройствами без связи.",
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
        'Colorful красит иконки оборудования по группам — LSA зелёный, FFE красный, Other бирюзовый. Выбор сохраняется и применяется во всём приложении.',
        'На планшетах списки Dashboard, Equipment, Certificates и Reports автоматически показываются в две колонки.',
      ],
    },
    {
      emoji: '👑',
      title: "Лицензия на судно",
      body: [
        "MSM Pro — €99 в год за СУДНО. Лицензия привязана к кораблю по номеру IMO, не к человеку и не к устройству. Все офицеры и все телефоны, вступившие на судно, покрыты одной лицензией.",
        "У каждой установки есть 60 бесплатных дней — без ключа и без карты. Этого хватает, чтобы пройти полный месячный цикл и решить.",
        "Лицензию покупает один раз тот, кто ведёт судно, и активирует её на аккаунте корабля: Настройки → Marine Safety Manager Pro → Activate the vessel licence. С этого момента полный доступ есть у всех вступивших устройств; члену экипажа покупать нечего.",
        "Без лицензии после бесплатного периода приложение продолжает работать, но реестр ограничен 15 позициями на категорию — этого хватает попробовать, но не хватает вести судно.",
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
      octopus: true,
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
        'El equipo se agrupa en 23 categorías bajo tres grupos: LSA, FFE y Other. Cada elemento tiene tipo, número de serie/ID, ubicación a bordo y las fechas que rigen el cumplimiento.',
        'Lo más rápido para empezar: Settings → Import from Excel → Download blank template, luego copie su registro existente en ella SIN cambiar el orden de las columnas e importe ese archivo. El importador lee por las cabeceras de columna, así que un libro cualquiera con columnas distintas o reordenadas puede no asignarse bien — la plantilla garantiza una importación limpia. Los datos quedan en el dispositivo y, opcionalmente, se sincronizan con la nube.',
      ],
    },
    {
      emoji: '📥',
      title: 'Importar desde Excel',
      body: [
        'Settings → Import from Excel → elija su libro .xlsx. Cada hoja (Liferafts, Lifejackets, Fire extinguishers, …) se asigna a una categoría automáticamente.',
        '¿Aún no tiene libro? Pulse "Download blank template (.xlsx)" en la pantalla de importación (o Settings → Download import template) — una hoja por categoría con las cabeceras correctas — complételo e impórtelo.',
        'Antes de guardar verá una vista previa de cuántos elementos se hallaron por categoría.',
        'Elija "Replace all" para sobrescribir las categorías importadas, o "Append" para añadir a lo existente.',
        'Las fechas como series de Excel, años (p. ej. "2034") o DD/MM/AAAA se convierten automáticamente. Puede editar cualquier elemento después.',
      ],
    },
    {
      emoji: '🧰',
      title: 'Equipos y categorías',
      body: [
        'La pestaña Equipment muestra una cuadrícula de todas las categorías con el recuento de elementos y un punto de color con el peor estado del interior.',
        'Pulse una categoría para ver sus elementos; filtre por tipo, serie o ubicación con el buscador. ＋ añade un elemento a mano.',
        'Las fechas se fijan con un calendario — pulse el campo y elija año, mes y día.',
        'Las insignias junto a un elemento muestran un clip por cada archivo adjunto (📎) y 📜 cuando lo cubre un certificado.',
        'Las categorías de lista de control (Hydrants, BA Bottle Pressure, Fire Detectors) tienen casillas mensuales en la ficha del elemento.',
        'Dentro de una categoría, ordene por Expiry date, Position, Name (A–Z) o Type — Position y Type agrupan los elementos bajo encabezados. En tabletas la lista se muestra en dos columnas.',
        "«Other Safety Equipment» es el cajón de sastre: todo lo que las hojas estándar no nombran — una bomba portátil, una carga de repuesto, un pañol con equipo que nadie más cuenta. Se rellena a mano con ＋ (no hay hoja de la que importarlo) y se comporta como cualquier otra categoría: fechas, etiquetas QR, inspecciones e informes.",
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
      emoji: '📜',
      title: 'Certificados',
      body: [
        'La pestaña Certificates guarda documentos que cubren varios elementos a la vez — p. ej. un único certificado de servicio de balsas para varias balsas ("certificado de grupo").',
        'Abra un certificado para fijar su número, fechas de emisión/caducidad (con el calendario) y archivo adjunto, y vincular los elementos que cubre.',
        'El certificado tiene su propio estado de caducidad (rojo / ámbar / verde), por lo que aparece en su vista de «próximos a vencer».',
        'En la ficha de un elemento se listan los certificados que lo cubren — pulse ＋ Link para vincular un certificado existente a ese elemento (se guarda al instante). Los elementos cubiertos muestran una insignia 📜.',
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
      ],
    },
    {
      emoji: '🔎',
      title: 'Escaneo, marcas y escaneados recientes',
      body: [
        'Escanee una etiqueta QR o un número de serie con el botón QR en la cabecera del Panel o de la pestaña Categories. Una coincidencia abre el equipo de inmediato; un código de barras del fabricante o un número de serie registrado también lo encuentran. Use el botón de la app y no la cámara del teléfono: un QR de MSM es un enlace privado que la cámara no puede abrir por sí sola. Si el código está muy dañado y aún puede leer los dígitos, escríbalos — la misma búsqueda.',
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
        "Abra un equipo — escanee su etiqueta QR o búsquelo en una categoría — y pulse Weekly o Monthly. Solo se ofrecen los periodos para los que esa categoría tiene lista de comprobación.",
        "Cada línea es PASS / FAIL / N/A. «All pass» rellena la lista de una vez y usted baja lo que realmente falla; nada se marca solo, porque una lista sin tocar nunca debe parecer inspeccionada.",
        "Elija quién firma desde la lista de tripulación antes de empezar: ese nombre queda en el registro. Añada comentarios y hasta cuatro fotografías de prueba; pertenecen a esa inspección, no a las fotos generales del equipo.",
        "Al firmar se sella la fecha y hora exactas, el tripulante y la versión de la lista. Un registro firmado no puede editarse ni borrarse por nadie, ni siquiera por el Master: un error se corrige inspeccionando otra vez, y ambos registros quedan archivados.",
        "Cualquier FAIL genera un defecto sobre ese equipo, y queda pendiente hasta que alguien registre la subsanación.",
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
        'Exporte como PDF o XLSX (nombre MSM_report_DDMMYY): tipo, serie, ubicación, fechas y estado. El PDF es apaisado, con cada elemento en una sola línea.',
        'Export ZIP (PDF + photos) agrupa en MSM_backup_DDMMYY.zip el PDF, todas las fotos/documentos adjuntos y los archivos de certificados que cubren los elementos (con un certificates/INDEX.txt que asocia cada certificado con sus elementos).',
        'Print envía el informe a una impresora por el diálogo del sistema — o "Save to PDF". Las exportaciones abren el menú de compartir del dispositivo.',
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
        "Para vaciar solo este dispositivo, abandone primero el buque: Settings → Vessel → This device → «Sign off & erase». La copia del buque queda intacta.",
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
        "Los demás introducen el IMO y luego Ajustes → Vessel → Join this vessel con su nombre y PIN. Su dispositivo queda en cola; el Master lo aprueba en Accounts → Devices y el dispositivo en espera lo detecta solo en unos segundos, sin reiniciar nada.",
        "Tres roles: Crew registra inspecciones, Officer además cierra defectos, Master además emite cuentas y asigna roles. Los roles los aplica el servidor, no solo la aplicación.",
        "¿Móvil perdido? El Master desactiva ese dispositivo en Accounts → Devices. Nadie más se ve afectado y no cambia ninguna contraseña.",
        "La invitación puede llevar también el CARGO A BORDO — Third Officer, Bosun, Chief Engineer. No es lo mismo que el rol: un segundo maquinista puede tener una cuenta Crew y un cadete una de Officer, de modo que un ascenso a bordo no es un cambio de permisos. El cargo viaja con la persona a la pantalla de ingreso y a la lista de firmantes, así que ni el nombre ni el cargo se teclean dos veces.",
        "Una vez unido el dispositivo, Settings → Vessel → This device muestra con qué identidad firma: nombre, cargo y si está aprobado. Se lee en vivo del buque, así que un cargo que el Master cambie una hora después aparece solo.",
        "«Sign off this device» abandona el buque desde ese aparato. Deja de sincronizar de inmediato y no puede readmitirse solo: volver exige una nueva invitación y la aprobación del Master. «Sign off & erase» borra además el registro de ese dispositivo — para uno que se cede o se vende. Ninguno inicia una prueba nueva: los 60 días son del buque, no del aparato.",
        "La interfaz sigue al rango. Cuentas, la lista de tripulación y la de dispositivos son del Master y no se ofrecen a nadie más. El servidor rechazaba esas escrituras de todos modos; un botón que siempre falla solo le dice algo falso sobre su propia autoridad.",
      ],
    },
    {
      emoji: '☁️',
      title: "Sincronización y fotos de inspección",
      body: [
        "Una vez unido el dispositivo, la sincronización se mantiene sola: ya no hay botones Push / Pull. Firme un registro y estará en los demás dispositivos del buque en segundos; la aplicación funciona sin conexión y se pone al día cuando vuelve.",
        "Los registros de inspección solo se añaden, así que dos oficiales trabajando en dos móviles no se pisan. El registro de equipos es un único documento compartido: si dos personas editan el MISMO equipo a la vez, gana la edición posterior.",
        "Las fotografías se reducen al capturarlas y se ponen en cola. Ajustes → Inspection photos: solo Wi-Fi (por defecto), cualquier conexión o nunca. En el mar el tráfico lo paga el buque.",
        "Los archivos adjuntos siguen viajando en una copia .msm.",
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
        'Colorful colorea los iconos de equipo por grupo — LSA verde, FFE rojo, Other turquesa. Su elección se guarda y se aplica en toda la app.',
        'En tabletas, las listas de Dashboard, Equipment, Certificates y Reports se muestran en dos columnas automáticamente.',
      ],
    },
    {
      emoji: '👑',
      title: "Licencia por buque",
      body: [
        "MSM Pro cuesta 99 € al año por BUQUE — con licencia ligada al barco por su número IMO, no por persona ni por dispositivo. Todos los oficiales y todos los móviles unidos al buque quedan cubiertos por la misma licencia.",
        "Cada instalación tiene 60 días gratis, sin clave y sin tarjeta.",
        "La licencia la compra una vez quien gestiona el buque y se activa en la cuenta del barco: Ajustes → Marine Safety Manager Pro → Activate the vessel licence. Desde ese momento todos los dispositivos inscritos tienen acceso completo.",
        "Sin licencia tras el periodo gratuito la aplicación sigue funcionando, pero el registro se limita a 15 elementos por categoría.",
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
      octopus: true,
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
        'Обладнання згруповане у 23 категорії в межах трьох груп: LSA, FFE та Other. Кожна позиція має тип, серійний номер/ID, розташування на судні та дати, що визначають відповідність.',
        'Найшвидший старт: Settings → Import from Excel → Download blank template, потім скопіюйте у нього вашу наявну базу, НЕ змінюючи порядок стовпців, та імпортуйте цей файл. Імпортер читає за заголовками стовпців, тож довільний файл з іншими або переставленими стовпцями може не розпізнатися — шаблон гарантує чистий імпорт. Усі дані лишаються на пристрої та за бажанням синхронізуються з хмарою.',
      ],
    },
    {
      emoji: '📥',
      title: 'Імпорт з Excel',
      body: [
        'Settings → Import from Excel → виберіть файл .xlsx. Кожен аркуш (Liferafts, Lifejackets, Fire extinguishers, …) автоматично зіставляється з категорією.',
        'Немає файлу? Натисніть "Download blank template (.xlsx)" на екрані імпорту (або Settings → Download import template) — по аркушу на категорію з правильними заголовками — заповніть і імпортуйте назад.',
        'Перед збереженням показується попередній перегляд: скільки позицій знайдено в кожній категорії.',
        'Виберіть "Replace all", щоб перезаписати імпортовані категорії, або "Append", щоб додати до наявних.',
        'Дати у вигляді Excel-серій, років (наприклад, "2034") або ДД/ММ/РРРР конвертуються автоматично. Будь-яку позицію можна відредагувати згодом.',
      ],
    },
    {
      emoji: '🧰',
      title: 'Обладнання та категорії',
      body: [
        'Вкладка Equipment показує сітку всіх категорій з кількістю позицій і кольоровою точкою найгіршого статусу всередині.',
        'Натисніть категорію, щоб побачити позиції; пошуком фільтруйте за типом, серійним номером або розташуванням. ＋ додає нову позицію вручну.',
        'Дати задаються календарем — натисніть поле та виберіть рік, місяць і день.',
        'Значки біля позиції: по одній скріпці на кожен прикріплений файл (📎) та 📜, якщо її покриває сертифікат.',
        'У чек-лист категорій (Hydrants, BA Bottle Pressure, Fire Detectors) у картці є щомісячні позначки перевірок.',
        'Усередині категорії — сортування за Expiry date, Position, Name (А–Я) або Type; у режимах Position і Type позиції групуються під заголовками. На планшетах список показується у дві колонки.',
        "«Other Safety Equipment» — категорія для решти: усе, чого немає у стандартних аркушах — переносна помпа, запасний заряд, шафа зі спорядженням, яке більше ніде не обліковане. Заповнюється вручну кнопкою ＋ (імпортувати нізвідки — такого аркуша немає) і поводиться як будь-яка інша категорія: строки, QR-етикетки, інспекції, звіти.",
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
      emoji: '📜',
      title: 'Сертифікати',
      body: [
        'Вкладка Certificates зберігає документи, що покривають одразу багато позицій — наприклад, один сервісний сертифікат на кілька плотів ("груповий сертифікат").',
        'Відкрийте сертифікат, щоб задати номер, дати видачі/закінчення (через календар), прикріплений файл і пов’язати позиції, які він покриває.',
        'Сертифікат має власний статус терміну (червоний / жовтий / зелений), тож потрапляє у список «скоро спливає».',
        'У картці позиції перелічені сертифікати, що її покривають — натисніть ＋ Link, щоб прив’язати до позиції наявний сертифікат (зберігається одразу). Покриті позиції позначені значком 📜.',
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
      ],
    },
    {
      emoji: '🔎',
      title: 'Сканування, позначки та нещодавно відскановані',
      body: [
        'Скануйте QR-етикетку або серійний номер кнопкою QR у шапці екрана Dashboard або вкладки Categories. Збіг одразу відкриває позицію; заводський штрихкод або записаний серійний номер теж її знайдуть. Користуйтеся кнопкою в застосунку, а не системною камерою — QR формату MSM це приватне посилання, яке камера сама відкрити не може. Якщо код пошкоджено, а цифри ще читаються, введіть їх вручну — той самий пошук.',
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
        "Відкрийте позицію — відскануйте її QR-етикетку або знайдіть у категорії — і натисніть Weekly чи Monthly. Пропонуються лише ті періоди, для яких у категорії є чек-лист.",
        "Кожен пункт — PASS / FAIL / N/A. Кнопка «All pass» заповнює список одним дотиком, а ви знижуєте те, що справді несправне. Нічого не проставляється заздалегідь.",
        "Перед початком оберіть, хто підписує, зі списку екіпажу — це ім'я потрапить у запис. Додайте коментар і до чотирьох фотографій-доказів: вони належать цій інспекції, а не загальним фото позиції.",
        "Підпис фіксує точні дату й час, члена екіпажу та версію чек-листа. Підписаний запис не може змінити або видалити ніхто, включно з Майстром: помилка виправляється новою інспекцією, і обидва записи лишаються у справі.",
        "Будь-який FAIL піднімає дефект на цій позиції, і він лишається відкритим, доки хтось не зафіксує усунення.",
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
        'Експорт у PDF або XLSX (ім’я MSM_report_DDMMYY): тип, серійний номер, розташування, дати та статус. PDF — альбомний, кожна позиція в один рядок.',
        'Export ZIP (PDF + photos) кладе в MSM_backup_DDMMYY.zip сам PDF, усі прикріплені фото/документи та файли сертифікатів, що покривають позиції (з certificates/INDEX.txt, де вказано, який сертифікат до яких позицій належить).',
        'Print надсилає звіт на принтер через системний діалог друку — або "Save to PDF". Експорт відкриває системне вікно «Поділитися».',
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
        "Щоб очистити лише цей пристрій, спершу залиште судно: Settings → Vessel → This device → «Sign off & erase». Суднова копія лишається недоторканою.",
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
        "Решта вводять IMO, потім Налаштування → Vessel → Join this vessel зі своїм ім'ям і PIN. Пристрій потрапляє в чергу; Майстер схвалює його в Accounts → Devices, і пристрій сам помічає це за кілька секунд — без перезапуску.",
        "Три ролі: Crew проводить інспекції, Officer додатково закриває дефекти, Master додатково видає акаунти та змінює ролі. Ролі перевіряє сервер, а не лише застосунок.",
        "Загубили телефон? Майстер вимикає цей пристрій у Accounts → Devices. Інших це не стосується.",
        "У запрошенні можна вказати й ПОСАДУ на судні — Third Officer, Bosun, Chief Engineer. Це навмисно не те саме, що роль: другий механік може мати обліковку Crew, а курсант — Officer, тож підвищення на борту не перетворюється на зміну прав. Посада їде разом із людиною на екран приєднання та у список підписантів, тож ані ім'я, ані посада не набираються двічі.",
        "Після приєднання Settings → Vessel → This device показує, ким пристрій підписує: ім'я, посаду й чи схвалений він. Читається наживо з судна, тож посада, змінена Майстром за годину, з'явиться сама.",
        "«Sign off this device» — вихід із судна з цього апарата. Синхронізація припиняється одразу, і назад пристрій сам себе не впустить: потрібне нове запрошення та схвалення Майстра. «Sign off & erase» на додачу стирає реєстр на цьому апараті — для випадку, коли його передають або продають. Ані те, ані інше не відкриває нового пробного періоду: 60 днів належать судну, а не пристрою.",
        "Інтерфейс іде за рангом. Акаунти, список екіпажу та список пристроїв — права Майстра, іншим вони не пропонуються. Сервер такі записи все одно відхиляв; кнопка, що завжди падає, лише повідомляє неправду про ваші власні повноваження.",
      ],
    },
    {
      emoji: '☁️',
      title: "Синхронізація та фото інспекцій",
      body: [
        "Після приєднання синхронізація йде сама — кнопок Push / Pull більше немає. Підписали запис — за секунди він на інших пристроях судна; застосунок повністю працює офлайн.",
        "Записи інспекцій лише додаються, тому двоє офіцерів на двох телефонах не затруть роботу одне одного. Реєстр обладнання — один спільний документ: якщо двоє правлять ОДНУ позицію одночасно, перемагає пізніша правка.",
        "Фотографії зменшуються під час зйомки та стають у чергу. Налаштування → Inspection photos: лише Wi-Fi (типово), будь-яке з'єднання або ніколи.",
        "Вкладені файли й далі переносяться в .msm-резервній копії.",
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
        'Colorful фарбує іконки обладнання за групами — LSA зелений, FFE червоний, Other бірюзовий. Вибір зберігається і діє в усьому застосунку.',
        'На планшетах списки Dashboard, Equipment, Certificates і Reports автоматично показуються у дві колонки.',
      ],
    },
    {
      emoji: '👑',
      title: "Ліцензія на судно",
      body: [
        "MSM Pro — €99 на рік за СУДНО. Ліцензія прив'язана до корабля за номером IMO, не до людини й не до пристрою. Усі офіцери та всі телефони, що приєдналися до судна, покриті однією ліцензією.",
        "Кожне встановлення має 60 безкоштовних днів — без ключа й без картки.",
        "Ліцензію купує один раз той, хто веде судно, і активує її на акаунті корабля: Налаштування → Marine Safety Manager Pro → Activate the vessel licence. Відтоді повний доступ мають усі приєднані пристрої.",
        "Без ліцензії після безкоштовного періоду застосунок працює далі, але реєстр обмежений 15 позиціями на категорію.",
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
      octopus: true,
    },
  ],
};

export const MANUAL: Record<Lang, ManualContent> = { en, ru, es, uk };
