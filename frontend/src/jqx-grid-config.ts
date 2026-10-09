/**
 * Сборка опций jqxGrid из конфигурации Django-бэкенда.
 *
 * Конфигурация приходит из двух мест:
 *  - `<source>config/` — авто-колонки из модели/сериализатора;
 *  - атрибут `config` элемента `<jqx-grid>` — явные колонки/группы/опции
 *    из вьюшки или подкласса Grid (побеждают в спорных случаях).
 */

export interface GridDefinition {
  columns?: any[];
  columnsgroups?: any[];
  columnGroups?: any[];
  pk?: string;
  pagesize?: number;
  [key: string]: any;
}

/** Ключи, которые не являются опциями jqxGrid. */
const STRUCTURAL_KEYS = new Set([
  'columns',
  'columnsgroups',
  'columnGroups',
  'pk',
  'sorting',
  'label',
  'model',
]);

const FILTER_TYPE_ALIASES: Record<string, string> = {
  text: 'textbox',
  string: 'textbox',
  numberinput: 'number',
  integer: 'number',
  float: 'number',
  bool: 'checkbox',
  boolean: 'checkbox',
};

function mapFilterType(type?: string): string | undefined {
  if (!type) return undefined;
  return FILTER_TYPE_ALIASES[type] ?? type;
}

/** URL эндпоинта конфигурации: `<source>config/`. */
export function configUrl(source: string): string {
  const base = source.endsWith('/') ? source : `${source}/`;
  return `${base}config/`;
}

/** Конфигурационная или нативная jqx-колонка -> колонка jqxGrid. */
export function toJqxColumn(column: any): any {
  if (!column || typeof column !== 'object') return column;

  // Нативная jqx-колонка ({text, datafield, ...}) — передаём как есть.
  const native =
    (column.text !== undefined || column.datafield !== undefined) &&
    column.dataField === undefined &&
    column.label === undefined;
  if (native) return { ...column };

  const {
    dataField,
    label,
    dataType,
    visible,
    editable,
    filter,
    format,
    hidden,
    filtertype,
    width,
    columntype,
    columngroup,
    cellsalign,
    cellsformat,
    ...rest
  } = column;

  const col: any = { ...rest };
  col.text = label ?? dataField ?? '';
  col.datafield = dataField;
  if (width !== undefined) col.width = width;
  if (columntype !== undefined) col.columntype = columntype;
  if (columngroup !== undefined) col.columngroup = columngroup;

  const ft = filtertype ?? mapFilterType(filter?.type);
  if (ft) col.filtertype = ft;
  if (filter?.enabled === false) col.filterable = false;
  if (editable !== undefined) col.editable = editable;

  col.cellsalign = cellsalign ?? (dataType === 'number' ? 'right' : 'left');
  const cellsFormat =
    cellsformat ?? format ?? (dataType === 'date' ? 'dd.MM.yyyy HH:mm' : undefined);
  if (cellsFormat) col.cellsformat = cellsFormat;

  col.hidden = hidden ?? visible === false;
  return col;
}

/** datafields адаптера: имя + тип из конфигурации колонок. */
export function toDatafields(columns: any[]): any[] {
  const fields: any[] = [];
  const seen = new Set<string>();
  for (const column of columns ?? []) {
    if (!column || typeof column !== 'object') continue;
    const name = column.dataField ?? column.datafield;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    fields.push(column.dataType ? { name, type: column.dataType } : { name });
  }
  return fields;
}

function isTruthyDirection(value: any): boolean {
  if (typeof value === 'string') return value.toLowerCase() !== 'desc';
  return Boolean(value);
}

/**
 * JSON -> url-safe Base64 (RFC 4648 §5): только [A-Za-z0-9_-], без padding,
 * поэтому значение безопасно для query-строки ('+' в обычном Base64
 * серверы декодируют как пробел).
 */
export function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Параметры запроса к DRF: `sorting` + `filterGroups` (оба — url-safe Base64
 * от JSON) в формате backend'а (см. GridViewSet.apply_jqx_sorting /
 * apply_jqx_filters).
 */
export function formatRequest(data: any, sortInfo: any): any {
  if (!data || typeof data !== 'object') return data;

  // Сортировка: из состояния грида (мульти-сортировка) либо из параметров jqx.
  let sorting: any[] = [];
  const sortColumns = Array.isArray(sortInfo?.sortcolumns) ? sortInfo.sortcolumns : [];
  const valid = sortColumns.filter(
    (c: any) => c && (typeof c === 'string' || Boolean(c.dataField ?? c.datafield)),
  );
  if (valid.length > 0) {
    sorting = valid.map((c: any) =>
      typeof c === 'string' ? [c, 1] : [c.dataField ?? c.datafield, isTruthyDirection(c.ascending) ? 1 : 0],
    );
  } else if (data.sortdatafield) {
    sorting = [[data.sortdatafield, isTruthyDirection(data.sortorder) ? 1 : 0]];
  }

  // Сортировка и фильтры: jqx уже прислал filterGroups объектом —
  // сериализуем в JSON и кодируем в url-safe Base64, чтобы в query-строку
  // не попадал открытый JSON (backend декодирует и принимает оба формата).
  const groups = Array.isArray(data.filterGroups) ? data.filterGroups : [];
  const filterGroups = groups.map((group: any) => ({
    field: group.field,
    filters: (group.filters ?? []).map((flt: any) => ({
      field: flt.field ?? group.field,
      value: flt.value,
      operator: flt.operator ?? 'and',
      condition: flt.condition,
    })),
  }));

  // Удаляем родные параметры jqx (sort*, filter*, *operator), заменяем своими.
  for (const key of Object.keys(data)) {
    if (key.startsWith('sort') || key.startsWith('filter') || key.endsWith('operator')) {
      delete data[key];
    }
  }
  data.sorting = encodeBase64(JSON.stringify(sorting));
  data.filterGroups = encodeBase64(JSON.stringify(filterGroups));
  return data;
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

function buildAdapter(
  url: string,
  rawColumns: any[],
  pk: string,
  getSortInfo: () => any,
  scheduleReload: (state: string) => void,
): any {
  const adapter: any = {
    datatype: 'json',
    cache: false,
    url,
    id: pk,
    root: 'results',
    datafields: toDatafields(rawColumns),
    formatdata: (data: any) => {
      let sortInfo: any = null;
      try {
        sortInfo = getSortInfo();
      } catch {
        sortInfo = null;
      }
      return formatRequest(data, sortInfo);
    },
    // В virtualmode jqx сам перезапрашивает данные при навигации по страницам
    // и смене pagesize (gotopage -> updatebounddata), но сортировку и
    // фильтрацию оставляет адаптеру. Хуки sort/filter — штатный способ
    // заставить грид обратиться к серверу снова: вызов scheduleReload()
    // отложенно делает updatebounddata(state), который шлёт GET с текущими
    // pagenum/pagesize/sorting/filterGroups.
    sort: () => scheduleReload('sort'),
    filter: () => scheduleReload('filter'),
  };
  // DRF возвращает {count, results}; передаём totalrecords в jqx для пейджера.
  adapter.beforeprocessing = (data: any) => {
    if (data && typeof data === 'object' && !Array.isArray(data) && data.count !== undefined) {
      adapter.totalrecords = data.count;
      data.totalrecords = data.count;
    }
    return data;
  };
  return adapter;
}

/** Собрать опции jqxGrid (включая source-адаптер) для createComponent(). */
export function buildGridOptions(
  definition: GridDefinition | null | undefined,
  overrides: Record<string, any> | null | undefined,
  sourceUrl: string,
  getSortInfo: () => any,
  scheduleReload: (state: string) => void,
): any {
  const def = definition ?? {};
  const over = overrides ?? {};
  const rawColumns = over.columns ?? def.columns ?? [];
  const rawGroups =
    over.columnsgroups ?? over.columnGroups ?? def.columnsgroups ?? def.columnGroups;
  const pk = def.pk ?? 'id';

  const options: any = {
    width: '100%',
    height: 400,
    pageable: true,
    sortable: true,
    filterable: true,
    columnsresize: true,
    ...pickJqxOptions({ ...def, ...over }),
    columns: rawColumns.map(toJqxColumn),
    // Серверная постраничная загрузка — единственный режим, который jqx
    // корректно совмещает с REST-бэкендом: записи раскладываются на
    // абсолютные индексы страницы (loadjson в virtualmode), пейджер берёт
    // totalrecords из count бэкенда, а навигация/фильтры/сортировка сами
    // дёргают updatebounddata(). Запрещено отключать через config:
    // локальная пагинация в этом пакете не поддерживается.
    virtualmode: true,
    rendergridrows: (params: any) => params?.data ?? [],
  };

  options.pagesize = over.pagesize ?? def.pagesize ?? 10;
  // Дефолт jqx (["5","10","20"]) не содержит pagesize из конфигурации, и
  // комбобокс "Show rows" отображает ближайшее меньшее значение («20» при
  // pagesize=50). Гарантируем, что текущий размер страницы есть в списке.
  const pagesizeoptions: number[] = Array.isArray(options.pagesizeoptions)
    ? (options.pagesizeoptions as any[]).map(Number)
    : [10, 20, 50, 100];
  if (!pagesizeoptions.includes(options.pagesize)) {
    pagesizeoptions.push(options.pagesize);
    pagesizeoptions.sort((a, b) => a - b);
  }
  options.pagesizeoptions = pagesizeoptions;
  if (Array.isArray(rawGroups) && rawGroups.length > 0) {
    options.columnGroups = rawGroups.map((group: any) => ({ ...group }));
  }
  options.source = buildAdapter(sourceUrl, rawColumns, pk, getSortInfo, scheduleReload);
  return options;
}
