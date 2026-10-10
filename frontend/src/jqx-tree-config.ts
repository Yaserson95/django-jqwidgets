/**
 * Сборка опций jqxTree из конфигурации Django-бэкенда.
 *
 * Конфигурация приходит из двух мест:
 *  - `<source>config/` — параметры источника (имена полей, chunkSize);
 *  - атрибут `config` элемента `<jqx-tree>` — явные опции из вьюшки или
 *    подкласса Tree (побеждают в спорных случаях).
 *
 * Данные компонент грузит сам: корни при создании, дети — при раскрытии
 * ветки, следующие чанки — когда пользователь долистывает до последнего
 * загруженного элемента поддерева (см. jqx-tree.element.ts).
 */

export interface TreeDefinition {
  pk?: string;
  labelField?: string | null;
  parentField?: string;
  chunkSize?: number;
  [key: string]: any;
}

/** Ключи, которые не являются опциями jqxTree. */
const STRUCTURAL_KEYS = new Set([
  'pk',
  'labelField',
  'parentField',
  'chunkSize',
  'label',
  'model',
]);

function pickJqxOptions(merged: Record<string, any>): Record<string, any> {
  const options: Record<string, any> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (!STRUCTURAL_KEYS.has(key) && value !== undefined && value !== null) {
      options[key] = value;
    }
  }
  return options;
}

/** Собрать опции jqxTree для createComponent(). */
export function buildTreeOptions(
  definition: TreeDefinition | null | undefined,
  overrides: Record<string, any> | null | undefined,
): { options: any; chunkSize: number } {
  const def = definition ?? {};
  const over = overrides ?? {};

  const options: any = {
    width: '100%',
    height: 400,
    ...pickJqxOptions({ ...def, ...over }),
    // Данные подгружаются компонентом сами (корни/дети/чанки) —
    // статический source здесь не используется.
    source: [],
  };

  const chunkSize = Number(over.chunkSize ?? def.chunkSize ?? 50) || 50;
  return { options, chunkSize };
}

/** HTML-экранирование подписи: _parseItem() jqxTree строит разметку конкатенацией. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Безопасный DOM-идентификатор узла: используется как id <li>,
 * остальное отбрасывается (jqxTree вставляет id в разметку конкатенацией).
 */
export function sanitizeId(value: any): string {
  return String(value).replace(/[^\w.-]/g, '_');
}
