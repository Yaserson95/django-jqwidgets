/**
 * Сборка опций jqxForm из конфигурации Django-бэкенда.
 *
 * Конфигурация приходит из двух мест:
 *  - `<source>config/` — шаблон полей формы (FormViewSet); если источником
 *    выступает грид или дерево, поля выводятся из их конфигурации
 *    (колонки грида -> поля формы, подпись узла -> поле формы);
 *  - атрибут `config` элемента `<jqx-form>` — явные поля/опции из вьюшки
 *    или подкласса Form (побеждают в спорных случаях).
 */

/** Строка шаблона jqxForm (см. jqwidgets.FormTemplateItem). */
export interface FormRow {
  /** Тип контрола: text/password/number/boolean/dropdownlist/date/time/datetime/label/button. */
  type?: string;
  /** Подпись слева от контрола. */
  label?: string;
  /** Имя поля записи (ключ в getValues/setValues/ответе API). */
  bind?: string;
  /** Имя кнопки (для type='button'): 'save'/'reset' обрабатываются формой. */
  name?: string;
  /** Исходные значения для dropdownlist/option. */
  source?: any[];
  required?: boolean;
  [key: string]: any;
}

/** Конфигурация `<source>config/`: форма, грид или дерево. */
export interface FormDefinition {
  pk?: string;
  template?: FormRow[];
  /** Кнопки (false — не рендерить кнопки по умолчанию). */
  buttons?: FormRow[] | false;
  /** Колонки грида (GridViewSet). */
  columns?: any[];
  /** Поля дерева (TreeViewSet). */
  labelField?: string | null;
  parentField?: string;
  [key: string]: any;
}

/** Ключи конфигурации, которые не являются опциями jqxForm. */
const STRUCTURAL_KEYS = new Set([
  'template',
  'buttons',
  'pk',
  'columns',
  'columnsgroups',
  'columnGroups',
  'labelField',
  'parentField',
  'chunkSize',
  'sorting',
  'label',
  'model',
]);

/** dataType колонки jqxGrid -> тип контрола jqxForm. */
const GRID_TYPE_TO_FORM: Record<string, string> = {
  string: 'text',
  number: 'number',
  boolean: 'boolean',
  date: 'date',
  datetime: 'date',
};

/** Кнопки по умолчанию: сохранить запись (POST/PUT) и сбросить форму. */
const DEFAULT_BUTTONS: FormRow[] = [
  { type: 'button', name: 'save', text: 'Сохранить' },
  { type: 'button', name: 'reset', text: 'Отмена' },
];

/** Типы контролов, значения которых приходят строкой ISO -> Date. */
export function isDateType(type: string | undefined): boolean {
  return type === 'date' || type === 'time' || type === 'datetime';
}

/**
 * Поля формы из колонок грида: видимые редактируемые колонки становятся
 * полями ввода. Скрытые колонки (pk, created_at) и read-only пропускаются.
 */
function deriveFromColumns(columns: any[]): FormRow[] {
  const rows: FormRow[] = [];
  for (const column of columns ?? []) {
    if (!column || typeof column !== 'object') continue;
    if (column.hidden === true || column.visible === false) continue;
    if (column.editable === false) continue;
    const bind = column.dataField ?? column.datafield;
    if (!bind || column.columntype === 'button') continue;
    rows.push({
      type: GRID_TYPE_TO_FORM[String(column.dataType ?? column.datatype).toLowerCase()] ?? 'text',
      label: column.label ?? column.text ?? bind,
      bind: String(bind),
    });
  }
  return rows;
}

/** Поля формы из конфигурации дерева: подпись узла (TreeViewSet). */
function deriveFromTree(definition: FormDefinition): FormRow[] {
  const bind = definition.labelField;
  if (!bind) return [];
  return [{ type: 'text', label: 'Подпись:', bind: String(bind) }];
}

/** Выбрать шаблон полей: явный -> форма -> колонки грида -> поля дерева. */
function pickTemplate(
  definition: FormDefinition,
  overrides: Record<string, any>,
): FormRow[] {
  if (Array.isArray(overrides.template)) {
    return overrides.template.map((row: FormRow) => ({ ...row }));
  }
  if (Array.isArray(definition.template)) {
    return definition.template.map((row: FormRow) => ({ ...row }));
  }
  if (Array.isArray(definition.columns)) {
    return deriveFromColumns(definition.columns);
  }
  if (definition.labelField) {
    return deriveFromTree(definition);
  }
  return [];
}

function pickJqxOptions(merged: Record<string, any>): Record<string, any> {
  const options: Record<string, any> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (!STRUCTURAL_KEYS.has(key) && value !== undefined && value !== null) {
      options[key] = value;
    }
  }
  return options;
}

export interface FormBuildResult {
  /** Опции jqxForm для createComponent() (всегда с непустым template). */
  options: Record<string, any>;
  /** Имя pk записи — для ответов create/update. */
  pk: string;
}

/**
 * Собрать опции jqxForm: шаблон полей (+ кнопки по умолчанию) и опции
 * (`width`, `padding`, `backgroundColor` …) из `<source>config/` и атрибута
 * `config` элемента. Атрибут `config` в спорных случаях побеждает.
 *
 * Кнопки добавляются в конец шаблона, если `buttons !== false`:
 * `buttons` — массив кастомных кнопок либо false (выключить).
 */
export function buildFormOptions(
  definition: FormDefinition | null | undefined,
  overrides: Record<string, any> | null | undefined,
): FormBuildResult {
  const def = definition ?? {};
  const over: Record<string, any> = { ...(overrides ?? {}) };

  let template = pickTemplate(def, over);
  delete over.template;

  const buttonsOption = over.buttons ?? def.buttons;
  delete over.buttons;
  if (template.length > 0 && buttonsOption !== false) {
    const buttons = Array.isArray(buttonsOption) ? buttonsOption : DEFAULT_BUTTONS;
    template = [...template, ...buttons.map((row) => ({ ...row }))];
  }

  const options: Record<string, any> = {};
  // Опции из <source>config/ — только у настоящей формы (FormViewSet):
  // конфигурации грида/дерева содержат чужие свойства (pagesize и т.p.),
  // а jqxCore на неизвестном свойстве валит создание виджета
  // ("Invalid property: ..."). Для грида/дерева выводится лишь шаблон полей,
  // явные опции задаются атрибутом config.
  if (Array.isArray(def.template)) {
    Object.assign(options, pickJqxOptions({ ...def, ...over }));
  } else {
    Object.assign(options, pickJqxOptions(over));
  }
  options.template = template;
  return { options, pk: String(def.pk ?? 'id') };
}
