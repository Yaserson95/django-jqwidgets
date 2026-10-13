import { Component, EventEmitter, Output } from '@angular/core';
import { jqxFormComponent } from 'jqwidgets-ng/jqxform';

import {
  buildFormOptions,
  isDateType,
  type FormDefinition,
  type FormRow,
} from './jqx-form-config';
import { JqxWidgetElement } from './jqx-widget.base';

/**
 * Web-компонент `<jqx-form>`: Django-шаблон рендерит элемент с атрибутами
 * `source` (URL REST-уровня), `record` (id редактируемой записи) и `config`
 * (JSON явных полей/опций), а компонент сам загружает конфигурацию,
 * поднимает jqxForm и при наличии `record` открывает запись.
 *
 * Поля берутся из `<source>config/`: у `FormViewSet` — шаблон из
 * сериализатора, у `GridViewSet` — из колонок, у `TreeViewSet` — поле
 * подписи узла (см. jqx-form-config.ts).
 *
 * Методы данных идут от базового класса (`get/create/update/delete`);
 * собственные:
 *
 *  - `getValues()` / `setValues(values)` — значения формы;
 *  - `load(id)` — открыть запись для редактирования;
 *  - `save()` — POST новой, PUT редактируемой (кнопка «Сохранить»);
 *  - `remove()` — DELETE редактируемой записи + сброс;
 *  - `reset()` — очистить и перейти в режим новой записи.
 *
 * События: `loaded` {id, data}, `saved` {id, mode, data}, `removed` {id},
 * `changed` (правка поля), `saveerror` (сбой сохранения), `buttonclick`.
 *
 * Элемент можно получить и из виджета: `grid.getForm(id)` — страница
 * сама размещает результат (jqxWindow, панель рядом с виджетом).
 */
@Component({
  selector: 'jqx-form',
  standalone: true,
  imports: [jqxFormComponent],
  template: `
    @if (error()) {
      <div class="jqxwidgets-error">⚠ {{ error() }}</div>
    } @else {
      <jqxForm #inner [auto-create]="false"></jqxForm>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      :host > * {
        display: block;
        width: 100%;
      }
      .jqxwidgets-error {
        padding: 12px 16px;
        border: 1px solid #fecdca;
        border-radius: 6px;
        background: #fef3f2;
        color: #b42318;
        font: 14px/1.4 system-ui, sans-serif;
      }
    `,
  ],
})
export class JqxFormElement extends JqxWidgetElement {
  protected override readonly widgetName = 'form';

  // События для потребителей элемента (CustomEvent на <jqx-form>)
  /** Запись загружена: {id, data}. */
  @Output() loaded = new EventEmitter<{ id: string | number; data: any }>();
  /** Форма сохранена: {id, mode: 'create'|'update', data}. */
  @Output() saved = new EventEmitter<{ id: string | number | null; mode: string; data: any }>();
  /** Запись удалена: {id}. */
  @Output() removed = new EventEmitter<{ id: string | number }>();
  /** Поле формы изменено: {value, previousValue}. */
  @Output() changed = new EventEmitter<any>();
  /** Сбой сохранения (POST/PUT): Error. */
  @Output() saveerror = new EventEmitter<Error>();
  /** Любая кнопка формы нажата: {name, text}. */
  @Output() buttonclick = new EventEmitter<{ name?: string; text?: string }>();

  /** Имя pk записи (из `<source>config/`). */
  private pk = 'id';
  /** Шаблон полей (включая кнопки) — для сброса и преобразования значений. */
  private template: FormRow[] = [];
  /** Поля с датами: значение ISO приводится к Date. */
  private readonly dateBinds = new Set<string>();
  /** Идентификатор редактируемой записи; null — новая запись. */
  private currentId: string | number | null = null;

  protected override async init(): Promise<void> {
    const host = this.hostRef.nativeElement;
    this.source = host.getAttribute('source') ?? '';
    const overrides = this.parseConfig(host.getAttribute('config'));

    // Сбой загрузки конфига некритичен: работаем на дефолтах/явных полях.
    const definition: FormDefinition = (await this.loadConfig()) ?? {};

    if (this.destroyed) return;

    const { options, pk } = buildFormOptions(definition, overrides);
    if (!options.template?.length) {
      this.error.set('Для формы не заданы поля');
      return;
    }
    this.pk = pk;
    this.template = options.template as FormRow[];
    for (const row of this.template) {
      if (row.bind && isDateType(row.type)) this.dateBinds.add(row.bind);
    }

    this.inner?.createComponent(options);
    this.created.emit();

    // record="3" — сразу открыть запись для редактирования.
    const record = host.getAttribute('record');
    if (record) {
      try {
        await this.load(record);
      } catch (err) {
        console.error(`[jqx-form] не удалось загрузить запись #${record}:`, err);
        this.error.set(`Не удалось загрузить запись #${record}`);
      }
    }
  }

  // ------------------------------------------------------------------
  // Данные формы
  // ------------------------------------------------------------------

  /**
   * Виджет jqxForm напрямую.
   *
   * Обёртка `inner.val()` идёт через jQuery-прокси jqx (`jqx.invoke`):
   * для одноаргументного вызова он подмешивает лишний аргумент-заглушку
   * `e({}).toArray() === [{}]`, поэтому геттер `val` видит его как
   * аргумент и уходит в сеттер `_setValue({})` — очищает форму и
   * возвращает undefined. Прямой вызов на instance лишён этой проблемы.
   */
  private get widget(): any {
    return (this.inner as any)?.widgetObject ?? null;
  }

  /** Значения полей формы: {bind -> value}. */
  getValues(): Record<string, any> {
    try {
      return this.widget?.val() ?? {};
    } catch (err) {
      console.error('[jqx-form] не удалось прочитать значения формы:', err);
      return {};
    }
  }

  /** Заполнить форму значениями (режим записи не меняет). */
  setValues(values: Record<string, any>): void {
    this.applyValues(values);
  }

  /**
   * Загрузить запись по идентификатору и открыть её для редактирования.
   * При сбое (записи нет, у источника нет retrieve) бросает Error.
   */
  async load(id: string | number): Promise<any> {
    const record = await this.get(id);
    if (this.destroyed) return null;
    this.currentId = id;
    this.applyValues(record);
    this.loaded.emit({ id, data: record });
    return record;
  }

  /**
   * Сохранить форму: POST — новой записи, PUT — редактируемой.
   * Ошибка уходит в `saveerror` и бросается дальше (для явных вызовов).
   */
  async save(): Promise<{ id: string | number | null; mode: string; data: any }> {
    const values = this.getValues();
    const updating = this.currentId !== null;
    try {
      const data = updating
        ? await this.update(this.currentId as string | number, values)
        : await this.create(values);
      const id = data?.[this.pk] ?? this.currentId;
      if (!updating && id !== null && id !== undefined) this.currentId = id;
      const result = {
        id: this.currentId,
        mode: updating ? 'update' : 'create',
        data,
      };
      this.saved.emit(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.saveerror.emit(error);
      throw error;
    }
  }

  /** Удалить редактируемую запись и очистить форму. */
  async remove(): Promise<any> {
    if (this.currentId === null) return null;
    const id = this.currentId;
    const data = await this.delete(id);
    this.removed.emit({ id });
    this.reset();
    return data;
  }

  /** Очистить форму и перейти в режим новой записи. */
  reset(): void {
    this.currentId = null;
    const widget = this.widget;
    if (!widget) return;
    const cleared: Record<string, any> = {};
    for (const row of this.template) {
      if (!row.bind) continue;
      if (row.type === 'boolean' || row.type === 'checkbox') cleared[row.bind] = false;
      else if (row.type === 'number' || isDateType(row.type)) cleared[row.bind] = null;
      else if (row.type !== 'button' && row.type !== 'label') cleared[row.bind] = '';
    }
    widget.val(cleared);
  }

  /** Идентификатор редактируемой записи (null — новая запись). */
  get recordId(): string | number | null {
    return this.currentId;
  }

  /**
   * Форма сама управляет состоянием (load/save/reset) — перечитывать
   * источник, как это делают грид/дерево после мутаций, ей незачем.
   * Связь с виджетом-«хозяином» настраивается на стороне вызывающего
   * (см. getForm: подписка на saved/removed -> reloadData виджета).
   */
  protected override reloadData(): void {}

  // ------------------------------------------------------------------
  // jqx-события
  // ------------------------------------------------------------------

  protected override wireEvents(): void {
    const inner = this.inner;
    if (!inner) return;
    inner.onFormDataChange?.subscribe((event: any) => {
      this.changed.emit(event?.args ?? event);
    });
    inner.onButtonClick?.subscribe((event: any) => {
      const args = (event?.args ?? event) as { name?: string; text?: string };
      if (args?.name === 'save') {
        // Ошибка уже ушла в saveerror; без обработчика промис даст
        // unhandledrejection при HTTP-ошибке.
        this.save().catch(() => {});
      } else if (args?.name === 'reset') {
        this.reset();
      }
      this.buttonclick.emit(args);
    });
  }

  // ------------------------------------------------------------------
  // Вспомогательные
  // ------------------------------------------------------------------

  /** Применить значения: даты из ответа API (ISO) -> Date для jqxDateTimeInput. */
  private applyValues(values: Record<string, any>): void {
    const widget = this.widget;
    if (!widget || !values) return;
    const converted: Record<string, any> = {};
    for (const [key, value] of Object.entries(values)) {
      converted[key] =
        this.dateBinds.has(key) && typeof value === 'string' && value
          ? new Date(value)
          : value;
    }
    widget.val(converted);
  }
}
