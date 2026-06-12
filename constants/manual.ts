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
        'Badges next to an item show 📎 N (attached files) and 📜 (covered by a certificate).',
        'Checklist categories (Hydrants, BA Bottle Pressure, Fire Detectors) have monthly check toggles in the item screen.',
        'Inside a category, sort by Expiry date or by Position (grouped under location headers). On tablets the list shows two columns.',
      ],
    },
    {
      emoji: '📎',
      title: 'Photos & documents',
      body: [
        'Each item can hold up to 4 attachments — photos or documents (PDF, etc.) — in the "Photos & documents" block of the item screen.',
        'Tap the dashed ＋ Add slot to take a photo, pick from the library, or choose a document.',
        'Tap a photo to open it full-screen (Open / Share); tap a document to open it in the system viewer. Remove with the ✕ on its thumbnail.',
      ],
    },
    {
      emoji: '📜',
      title: 'Certificates',
      body: [
        'The Certificates tab holds documents that cover many items at once — e.g. a single liferaft service certificate applying to several rafts (a "group certificate").',
        'Open a certificate to set its number, issue/expiry dates and attached file, and to link the items it covers.',
        'A certificate carries its own expiry status (red / amber / green), so it appears in your due-soon view.',
        'On an item screen, covering certificates are listed; items covered show a 📜 badge.',
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
        'Filter by group (All · LSA · FFE · Other) and sort by Expiry date or by Position — the Position view groups items under their location with a count.',
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
      ],
    },
    {
      emoji: '☁️',
      title: 'Cloud sync',
      body: [
        'Enter your vessel IMO number in Settings → Save vessel info — the IMO is the cloud account for the vessel.',
        'Set a Connection password in Settings → Cloud sync. The first device sets it; every other device must enter the same password to join.',
        'Tap Connect this device. The first device becomes the Master; others appear as pending until the Master approves them. Push uploads, Pull downloads.',
        'Push / Pull sync the equipment register, certificates and compressor logs. Attached files (photos, certificate documents) are not uploaded — use an .msm backup to move files between devices.',
        'The Master can disconnect a device, hand over the role with "👑 Make master", and change the connection password (Settings → Cloud sync → Change connection password: current, then the new one twice — other devices must then re-enter it).',
        'If the Master device is permanently lost, tap the version line in Manual → About nine times to make THIS device the Master. Each vessel only sees its own data.',
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
      title: 'MSM Pro subscription',
      body: [
        'Settings → Marine Safety Manager Pro opens the plan: a 1-month free trial, then a yearly subscription. The price shown is your store\'s local price for your region.',
        'Start the trial from that screen. "Restore purchase" re-activates a subscription on a new device; "Manage subscription" opens the subscription settings in your store account.',
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
        'Значки у позиции: 📎 N (прикреплённые файлы) и 📜 (покрыта сертификатом).',
        'У чек-лист категорий (Hydrants, BA Bottle Pressure, Fire Detectors) в карточке есть помесячные отметки проверок.',
        'Внутри категории — сортировка по Expiry date или Position (с заголовками по расположению). На планшетах список показывается в две колонки.',
      ],
    },
    {
      emoji: '📎',
      title: 'Фото и документы',
      body: [
        'К каждой позиции можно прикрепить до 4 вложений — фото или документы (PDF и т. п.) — в блоке "Photos & documents" карточки.',
        'Нажмите пунктирный слот ＋ Add: снять фото, выбрать из галереи или выбрать документ.',
        'Тап по фото открывает его на весь экран (Open / Share); тап по документу — в системном просмотрщике. Удаление — крестиком ✕ на миниатюре.',
      ],
    },
    {
      emoji: '📜',
      title: 'Сертификаты',
      body: [
        'Вкладка Certificates хранит документы, покрывающие сразу много позиций — например, один сервисный сертификат на несколько плотов ("групповой сертификат").',
        'Откройте сертификат, чтобы задать номер, даты выдачи/окончания, прикреплённый файл и связать покрываемые позиции.',
        'У сертификата свой статус срока (красный / жёлтый / зелёный), поэтому он попадает в список «скоро истекает».',
        'В карточке позиции перечислены покрывающие её сертификаты; покрытые позиции отмечены значком 📜.',
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
        'Фильтр по группе (All · LSA · FFE · Other) и сортировка по Expiry date или Position — в режиме Position позиции группируются по расположению с количеством.',
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
      ],
    },
    {
      emoji: '☁️',
      title: 'Облачная синхронизация',
      body: [
        'Введите номер IMO судна в Settings → Save vessel info — IMO служит облачным аккаунтом судна.',
        'Задайте Connection password в Settings → Cloud sync. Первое устройство задаёт его; остальные должны ввести тот же пароль.',
        'Нажмите Connect this device. Первое устройство становится Master; остальные ждут одобрения. Push выгружает, Pull загружает.',
        'Push / Pull синхронизируют реестр оборудования, сертификаты и журналы компрессоров. Прикреплённые файлы (фото, документы сертификатов) в облако не загружаются — для переноса файлов используйте бэкап .msm.',
        'Master может отключить устройство, передать роль через "👑 Make master" и сменить connection password (Settings → Cloud sync → Change connection password: текущий, затем новый дважды — остальным устройствам придётся ввести его заново).',
        'Если мастер-устройство безвозвратно утеряно — девять раз нажмите строку версии в Manual → About, и ЭТО устройство станет мастером. Каждое судно видит только свои данные.',
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
      title: 'Подписка MSM Pro',
      body: [
        'Settings → Marine Safety Manager Pro открывает план: 1 месяц бесплатно, затем годовая подписка. Цена показывается локальная — из вашего магазина для вашего региона.',
        'Триал запускается с этого экрана. "Restore purchase" восстанавливает подписку на новом устройстве; "Manage subscription" открывает настройки подписок вашего магазина.',
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
        'Las insignias junto a un elemento muestran 📎 N (archivos adjuntos) y 📜 (cubierto por un certificado).',
        'Las categorías de lista de control (Hydrants, BA Bottle Pressure, Fire Detectors) tienen casillas mensuales en la ficha del elemento.',
        'Dentro de una categoría, ordene por Expiry date o por Position (con encabezados por ubicación). En tabletas la lista se muestra en dos columnas.',
      ],
    },
    {
      emoji: '📎',
      title: 'Fotos y documentos',
      body: [
        'Cada elemento admite hasta 4 adjuntos — fotos o documentos (PDF, etc.) — en el bloque "Photos & documents" de la ficha.',
        'Pulse la casilla punteada ＋ Add para tomar una foto, elegir de la galería o seleccionar un documento.',
        'Pulse una foto para abrirla a pantalla completa (Open / Share); pulse un documento para abrirlo en el visor del sistema. Quítelo con la ✕ de su miniatura.',
      ],
    },
    {
      emoji: '📜',
      title: 'Certificados',
      body: [
        'La pestaña Certificates guarda documentos que cubren varios elementos a la vez — p. ej. un único certificado de servicio de balsas para varias balsas ("certificado de grupo").',
        'Abra un certificado para fijar su número, fechas de emisión/caducidad y archivo adjunto, y vincular los elementos que cubre.',
        'El certificado tiene su propio estado de caducidad (rojo / ámbar / verde), por lo que aparece en su vista de «próximos a vencer».',
        'En la ficha de un elemento se listan los certificados que lo cubren; los elementos cubiertos muestran una insignia 📜.',
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
        'Filtre por grupo (All · LSA · FFE · Other) y ordene por Expiry date o por Position — la vista Position agrupa por ubicación con recuento.',
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
      ],
    },
    {
      emoji: '☁️',
      title: 'Sincronización en la nube',
      body: [
        'Introduzca el número IMO del buque en Settings → Save vessel info — el IMO es la cuenta en la nube del buque.',
        'Defina una Connection password en Settings → Cloud sync. El primer dispositivo la fija; los demás deben introducir la misma.',
        'Pulse Connect this device. El primer dispositivo es el Master; los demás quedan pendientes hasta su aprobación. Push sube, Pull baja.',
        'Push / Pull sincronizan el registro de equipos, los certificados y los registros del compresor. Los archivos adjuntos (fotos, documentos de certificados) no se suben — use una copia .msm para mover archivos entre dispositivos.',
        'El Master puede desconectar un dispositivo, ceder el rol con "👑 Make master" y cambiar la contraseña de conexión (Settings → Cloud sync → Change connection password: la actual y luego la nueva dos veces — los demás dispositivos deberán volver a introducirla).',
        'Si el dispositivo Master se pierde de forma permanente, pulse nueve veces la línea de versión en Manual → About para convertir ESTE dispositivo en Master. Cada buque solo ve sus datos.',
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
      title: 'Suscripción MSM Pro',
      body: [
        'Settings → Marine Safety Manager Pro abre el plan: 1 mes gratis y luego una suscripción anual. El precio mostrado es el local de su tienda para su región.',
        'Inicie la prueba desde esa pantalla. "Restore purchase" reactiva una suscripción en un dispositivo nuevo; "Manage subscription" abre los ajustes de suscripciones de su tienda.',
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
        'Значки біля позиції: 📎 N (прикріплені файли) та 📜 (покрита сертифікатом).',
        'У чек-лист категорій (Hydrants, BA Bottle Pressure, Fire Detectors) у картці є щомісячні позначки перевірок.',
        'Усередині категорії — сортування за Expiry date або Position (із заголовками за розташуванням). На планшетах список показується у дві колонки.',
      ],
    },
    {
      emoji: '📎',
      title: 'Фото та документи',
      body: [
        'До кожної позиції можна прикріпити до 4 вкладень — фото або документи (PDF тощо) — у блоці "Photos & documents" картки.',
        'Натисніть пунктирний слот ＋ Add: зробити фото, вибрати з галереї або обрати документ.',
        'Тап по фото відкриває його на весь екран (Open / Share); тап по документу — у системному перегляді. Видалення — хрестиком ✕ на мініатюрі.',
      ],
    },
    {
      emoji: '📜',
      title: 'Сертифікати',
      body: [
        'Вкладка Certificates зберігає документи, що покривають одразу багато позицій — наприклад, один сервісний сертифікат на кілька плотів ("груповий сертифікат").',
        'Відкрийте сертифікат, щоб задати номер, дати видачі/закінчення, прикріплений файл і пов’язати позиції, які він покриває.',
        'Сертифікат має власний статус терміну (червоний / жовтий / зелений), тож потрапляє у список «скоро спливає».',
        'У картці позиції перелічені сертифікати, що її покривають; покриті позиції позначені значком 📜.',
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
        'Фільтр за групою (All · LSA · FFE · Other) і сортування за Expiry date або Position — у режимі Position позиції групуються за розташуванням із кількістю.',
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
      ],
    },
    {
      emoji: '☁️',
      title: 'Хмарна синхронізація',
      body: [
        'Введіть номер IMO судна в Settings → Save vessel info — IMO слугує хмарним акаунтом судна.',
        'Задайте Connection password у Settings → Cloud sync. Перший пристрій задає його; решта мають ввести той самий пароль.',
        'Натисніть Connect this device. Перший пристрій стає Master; решта очікують схвалення. Push вивантажує, Pull завантажує.',
        'Push / Pull синхронізують реєстр обладнання, сертифікати та журнали компресорів. Прикріплені файли (фото, документи сертифікатів) до хмари не завантажуються — для перенесення файлів використовуйте бекап .msm.',
        'Master може відключити пристрій, передати роль через "👑 Make master" і змінити connection password (Settings → Cloud sync → Change connection password: поточний, потім новий двічі — решта пристроїв муситиме ввести його заново).',
        'Якщо майстер-пристрій безповоротно втрачено — дев’ять разів натисніть рядок версії в Manual → About, і ЦЕЙ пристрій стане майстром. Кожне судно бачить лише свої дані.',
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
      title: 'Підписка MSM Pro',
      body: [
        'Settings → Marine Safety Manager Pro відкриває план: 1 місяць безкоштовно, далі річна підписка. Ціна показується локальна — з вашого магазину для вашого регіону.',
        'Тріал запускається з цього екрана. "Restore purchase" відновлює підписку на новому пристрої; "Manage subscription" відкриває налаштування підписок вашого магазину.',
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
