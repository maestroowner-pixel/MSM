// ===================================
// "How to start?" — a short, focused guide shown on an empty register:
// how to load an existing inventory from an Excel (.xlsx) file.
// Localized (en / ru / es / uk) exactly like the full Manual (utils/locale).
// UI labels (button/menu names) stay English — the prose references them verbatim.
// ===================================

import { Lang, manualLang } from '../utils/locale';

export interface StartStep {
  emoji: string;
  title: string;
  body: string;
}

export interface GettingStartedContent {
  /** Label of the "How to start?" call-to-action on the empty Dashboard. */
  ctaLabel: string;
  /** Empty-state heading + one line under it. */
  emptyTitle: string;
  emptyBody: string;
  /** Guide screen. */
  screenTitle: string;
  screenSubtitle: string;
  intro: string;
  steps: StartStep[];
  tip: string;
  templateBtn: string;
  importBtn: string;
  /** Link to the full in-app User Manual. */
  manualLink: string;
}

const en: GettingStartedContent = {
  ctaLabel: 'How to start?',
  emptyTitle: 'Your register is empty',
  emptyBody: 'Load your existing LSA / FFE inventory from an Excel file to get started.',
  screenTitle: 'How to start',
  screenSubtitle: 'Load an existing register from Excel',
  intro:
    'The fastest way to fill the app is to import your existing inventory from an Excel (.xlsx) workbook. Follow these four steps.',
  steps: [
    {
      emoji: '⬇️',
      title: '1 · Get the blank template',
      body: 'Tap "Download blank template" below. It is an .xlsx with one worksheet per category and the correct column headers already in place.',
    },
    {
      emoji: '📝',
      title: '2 · Copy in your data',
      body: 'Paste your existing register into the template, keeping its column headings. The importer reads each column by its heading, so the headings — not their order — are what must stay.',
    },
    {
      emoji: '📥',
      title: '3 · Import the file',
      body: 'Tap "Import from Excel", choose your filled-in file, and review the preview of how many items were found per category before anything is saved.',
    },
    {
      emoji: '✅',
      title: '4 · Confirm',
      body: 'On a first import choose "Replace all". Later, import an edited copy with "Update" — items keep their QR labels and history — or "Add as new" to add rows, then confirm. Dates are converted automatically and every item stays editable afterwards.',
    },
  ],
  tip: 'Already have your own list? Import it directly. A sheet with columns such as #, Deck, Location, Description, Make, Type, Size, Serial and Exp / Inspc. is sorted into categories by each item\'s description, and the preview shows the result before anything is saved.',
  templateBtn: 'Download blank template (.xlsx)',
  importBtn: 'Import from Excel',
  manualLink: 'Open the full User Manual',
};

const ru: GettingStartedContent = {
  ctaLabel: 'Как начать?',
  emptyTitle: 'Реестр пуст',
  emptyBody: 'Загрузите вашу имеющуюся базу LSA / FFE из файла Excel, чтобы начать.',
  screenTitle: 'Как начать',
  screenSubtitle: 'Загрузка имеющейся базы из Excel',
  intro:
    'Быстрее всего наполнить приложение — импортировать имеющуюся базу из файла Excel (.xlsx). Выполните четыре шага.',
  steps: [
    {
      emoji: '⬇️',
      title: '1 · Скачайте пустой шаблон',
      body: 'Нажмите "Download blank template" ниже. Это файл .xlsx с отдельным листом на каждую категорию и уже готовыми правильными заголовками столбцов.',
    },
    {
      emoji: '📝',
      title: '2 · Скопируйте свои данные',
      body: 'Вставьте вашу имеющуюся базу в шаблон, сохранив заголовки столбцов. Импортёр читает каждый столбец по заголовку, поэтому важны именно заголовки, а не порядок столбцов.',
    },
    {
      emoji: '📥',
      title: '3 · Импортируйте файл',
      body: 'Нажмите "Import from Excel", выберите заполненный файл и проверьте предпросмотр — сколько позиций найдено в каждой категории, прежде чем что-либо сохранится.',
    },
    {
      emoji: '✅',
      title: '4 · Подтвердите',
      body: 'При первом импорте выберите "Replace all". Позже импортируйте отредактированную копию через "Update" — позиции сохранят QR-наклейки и историю — или "Add as new", чтобы добавить строки, и подтвердите. Даты конвертируются автоматически, любую позицию можно отредактировать позже.',
    },
  ],
  tip: 'Уже есть свой список? Импортируйте его напрямую. Лист со столбцами вроде #, Deck, Location, Description, Make, Type, Size, Serial и Exp / Inspc. раскладывается по категориям по описанию каждой позиции, а предпросмотр показывает результат до сохранения.',
  templateBtn: 'Download blank template (.xlsx)',
  importBtn: 'Import from Excel',
  manualLink: 'Открыть полное руководство пользователя',
};

const es: GettingStartedContent = {
  ctaLabel: '¿Cómo empezar?',
  emptyTitle: 'El registro está vacío',
  emptyBody: 'Cargue su inventario LSA / FFE existente desde un archivo Excel para empezar.',
  screenTitle: 'Cómo empezar',
  screenSubtitle: 'Cargar un registro existente desde Excel',
  intro:
    'La forma más rápida de llenar la app es importar su inventario existente desde un libro de Excel (.xlsx). Siga estos cuatro pasos.',
  steps: [
    {
      emoji: '⬇️',
      title: '1 · Descargue la plantilla',
      body: 'Pulse "Download blank template" abajo. Es un .xlsx con una hoja por categoría y las cabeceras de columna correctas ya puestas.',
    },
    {
      emoji: '📝',
      title: '2 · Copie sus datos',
      body: 'Pegue su registro existente en la plantilla conservando las cabeceras de columna. El importador lee cada columna por su cabecera, así que lo que debe mantenerse son las cabeceras, no su orden.',
    },
    {
      emoji: '📥',
      title: '3 · Importe el archivo',
      body: 'Pulse "Import from Excel", elija su archivo completado y revise la vista previa de cuántos elementos se hallaron por categoría antes de guardar nada.',
    },
    {
      emoji: '✅',
      title: '4 · Confirme',
      body: 'En la primera importación elija "Replace all". Más adelante importe una copia editada con "Update" (los elementos conservan etiquetas QR e historial) o "Add as new" para añadir filas, y confirme. Las fechas se convierten automáticamente y cada elemento queda editable después.',
    },
  ],
  tip: '¿Ya tiene su propia lista? Impórtela directamente. Una hoja con columnas como #, Deck, Location, Description, Make, Type, Size, Serial y Exp / Inspc. se reparte en categorías según la descripción de cada elemento, y la vista previa muestra el resultado antes de guardar nada.',
  templateBtn: 'Download blank template (.xlsx)',
  importBtn: 'Import from Excel',
  manualLink: 'Abrir el manual de usuario completo',
};

const uk: GettingStartedContent = {
  ctaLabel: 'Як почати?',
  emptyTitle: 'Реєстр порожній',
  emptyBody: 'Завантажте вашу наявну базу LSA / FFE з файлу Excel, щоб почати.',
  screenTitle: 'Як почати',
  screenSubtitle: 'Завантаження наявної бази з Excel',
  intro:
    'Найшвидший спосіб наповнити застосунок — імпортувати наявну базу з файлу Excel (.xlsx). Виконайте чотири кроки.',
  steps: [
    {
      emoji: '⬇️',
      title: '1 · Завантажте порожній шаблон',
      body: 'Натисніть "Download blank template" нижче. Це файл .xlsx з окремим аркушем на кожну категорію та вже готовими правильними заголовками стовпців.',
    },
    {
      emoji: '📝',
      title: '2 · Скопіюйте свої дані',
      body: 'Вставте вашу наявну базу в шаблон, зберігши заголовки стовпців. Імпортер читає кожен стовпець за заголовком, тож важливі саме заголовки, а не порядок стовпців.',
    },
    {
      emoji: '📥',
      title: '3 · Імпортуйте файл',
      body: 'Натисніть "Import from Excel", виберіть заповнений файл і перегляньте попередній перегляд — скільки позицій знайдено в кожній категорії, перш ніж щось збережеться.',
    },
    {
      emoji: '✅',
      title: '4 · Підтвердьте',
      body: 'Під час першого імпорту виберіть "Replace all". Пізніше імпортуйте відредаговану копію через "Update" — позиції збережуть QR-наклейки та історію — або "Add as new", щоб додати рядки, і підтвердьте. Дати конвертуються автоматично, будь-яку позицію можна відредагувати згодом.',
    },
  ],
  tip: 'Уже маєте свій список? Імпортуйте його напряму. Аркуш зі стовпцями на кшталт #, Deck, Location, Description, Make, Type, Size, Serial та Exp / Inspc. розкладається за категоріями за описом кожної позиції, а попередній перегляд показує результат до збереження.',
  templateBtn: 'Download blank template (.xlsx)',
  importBtn: 'Import from Excel',
  manualLink: 'Відкрити повний посібник користувача',
};

export const GETTING_STARTED: Record<Lang, GettingStartedContent> = { en, ru, es, uk };

/** Getting-started content in the device language (ru/es/uk), else English. */
export function gettingStarted(): GettingStartedContent {
  return GETTING_STARTED[manualLang()];
}
