import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';

import { configUrl } from './jqx-grid-config';

/**
 * Базовый класс web-компонентов jqxWidgets (`<jqx-grid>`, `<jqx-tree>`,
 * `<jqx-form>`).
 *
 * Виджеты работают с данными через REST-источник (атрибут `source`), поэтому
 * в базовом классе живёт всё общее:
 *
 *  - атрибуты `source` (URL REST-уровня) и `config` (JSON явных опций),
 *    конфигурация `<source>config/` (`loadConfig`, `parseConfig`);
 *  - lifecycle: `wireEvents()` + `init()` при создании, флаг `destroyed`
 *    и `teardown()` при уничтожении;
 *  - `error` — сигнал ошибки (шаблон показывает `⚠ …` вместо виджета),
 *    `created` — виджет создан (createComponent отработал);
 *  - `relay()` — проброс jqx-событий обёртки наружу;
 *  - **CRUD по источнику**: `get` / `create` / `update` / `delete` —
 *    REST-протокол DRF (GET список/запись, POST, PUT/PATCH, DELETE).
 *    После мутации данные виджета перечитываются через `reloadData()`
 *    (у грида — повторный запрос страницы, у дерева — перезагрузка корня).
 *
 * Источником полного CRUD сейчас выступает `GridViewSet` (ModelViewSet);
 * `TreeViewSet` отдаёт только список/конфигурацию — методы мутаций на нём
 * завершатся HTTP-ошибкой.
 */
// @Directive() без селектора: база для компонентов (DI + наследование
// ViewChild/Output/lifecycle), а не самостоятельная директива.
@Directive()
export abstract class JqxWidgetElement implements AfterViewInit, OnDestroy {
  /** Внутренний виджет jqx (шаблонная ссылка `#inner`). */
  @ViewChild('inner') inner?: any;

  /** Виджет создан (createComponent отработал). */
  @Output() created = new EventEmitter<void>();

  /** Ошибка инициализации; непустое значение показывается вместо виджета. */
  readonly error = signal<string | null>(null);

  /** URL REST-уровня (атрибут `source` элемента). */
  protected source = '';
  /** Компонент уничтожен — асинхронные продолжения должны молча выйти. */
  protected destroyed = false;
  /** Имя виджета для сообщений: 'grid' / 'tree'. */
  protected readonly widgetName: string = 'widget';

  constructor(protected readonly hostRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.wireEvents();
    void this.init();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.teardown();
  }

  // ------------------------------------------------------------------
  // CRUD по источнику (REST DRF: list/retrieve/create/update/destroy)
  // ------------------------------------------------------------------

  /**
   * Прочитать данные: список записей (без id) либо одна запись по id.
   *
   * @param id идентификатор записи; `null`/пропуск — список;
   * @param params доп. query-параметры (`offset`, `parent`, `limit` и т.п.);
   * @return распарсенный JSON ответа.
   */
  async get(
    id: string | number | null = null,
    params: Record<string, string | number | boolean> = {},
  ): Promise<any> {
    return this.request('GET', id, undefined, params);
  }

  /** Создать запись (POST) и перечитать данные виджета. */
  async create(data: Record<string, unknown>): Promise<any> {
    const result = await this.request('POST', null, data);
    this.reloadData();
    return result;
  }

  /** Обновить запись: PUT — целиком, PATCH (`partial`) — частично. */
  async update(
    id: string | number,
    data: Record<string, unknown>,
    partial = false,
  ): Promise<any> {
    const result = await this.request(partial ? 'PATCH' : 'PUT', id, data);
    this.reloadData();
    return result;
  }

  /** Удалить запись (DELETE) и перечитать данные виджета. */
  async delete(id: string | number): Promise<any> {
    const result = await this.request('DELETE', id);
    this.reloadData();
    return result;
  }

  /** Перечитать данные источника после мутации (определяется виджетом). */
  protected reloadData(): void {}

  /**
   * Создать элемент `<jqx-form>` для новой (null) или существующей (id)
   * записи виджета — возвращается сам элемент, размещает его страница:
   * в jqxWindow, рядом с виджетом, в панели и т.п. (custom element
   * инициализируется при подключении к документу).
   *
   * Поля формы выводятся из `<source>config/` виджета: колонки грида ->
   * поля ввода, подпись узла дерева -> поле; если у источника есть свой
   * шаблон (FormViewSet) — берётся он. После `saved`/`removed` формы
   * данные виджета перечитаются автоматически.
   *
   * Ограничение: у `TreeViewSet` нет ни retrieve, ни мутаций — для дерев
   * источником формы должен выступать `FormViewSet` той же модели.
   *
   * @param id идентификатор записи; null/пропуск — новая запись.
   */
  getForm(id: string | number | null = null): HTMLElement {
    const form = document.createElement('jqx-form');
    form.setAttribute('source', this.source);
    if (id !== null && id !== undefined) form.setAttribute('record', String(id));
    form.addEventListener('saved', () => this.reloadData());
    form.addEventListener('removed', () => this.reloadData());
    return form;
  }

  /** URL запроса: список — источник, запись — `<source><id>/`. */
  protected apiUrl(id: string | number | null = null): string {
    if (!this.source) return '';
    const base = this.source.endsWith('/') ? this.source : `${this.source}/`;
    return id === null || id === undefined
      ? base
      : `${base}${encodeURIComponent(String(id))}/`;
  }

  /** HTTP-запрос к источнику (JSON); при !ok выбрасывает Error. */
  protected async request(
    method: string,
    id: string | number | null = null,
    body?: unknown,
    params: Record<string, string | number | boolean> = {},
  ): Promise<any> {
    if (!this.source) {
      throw new Error(`[jqx-${this.widgetName}] не задан источник (атрибут source).`);
    }
    const url = new URL(this.apiUrl(id), window.location.href);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    // Django: POST/PUT/PATCH/DELETE от залогиненной сессии требуют
    // CSRF-токен — отдаём куку csrftoken в стандартном заголовке Django.
    // Для анонимных запросов DRF CSRF не проверяет, заголовок безвреден.
    const csrf = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
    const response = await fetch(url.toString(), {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(csrf ? { 'X-CSRFToken': decodeURIComponent(csrf[1]) } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(
        `[jqx-${this.widgetName}] ${method} ${url.pathname} — HTTP ${response.status}`,
      );
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  // ------------------------------------------------------------------
  // Конфигурация и вспомогательные
  // ------------------------------------------------------------------

  /** Атрибут `config` (JSON явных опций); невалидный JSON -> `{}`. */
  protected parseConfig(raw: string | null): Record<string, any> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.error(`[jqx-${this.widgetName}] невалидный JSON в атрибуте config:`, err);
      return {};
    }
  }

  /**
   * Конфигурация `<source>config/`: `{}` если источник не задан,
   * `null` при сбое — вызывающий решает, fatal это или работаем на дефолтах.
   */
  protected async loadConfig(): Promise<Record<string, any> | null> {
    if (!this.source) return {};
    try {
      const response = await fetch(configUrl(this.source), {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data && typeof data === 'object' ? data : {};
    } catch (err) {
      console.warn(`[jqx-${this.widgetName}] конфигурация не загружена, используются дефолты:`, err);
      return null;
    }
  }

  /** Прокинуть jqx-событие обёртки наружу (CustomEvent элемента). */
  protected relay(source: EventEmitter<any> | undefined, target: EventEmitter<any>): void {
    source?.subscribe((value) => target.emit(value));
  }

  // ------------------------------------------------------------------
  // Хуки для виджетов
  // ------------------------------------------------------------------

  /** Подписки на события внутреннего виджета. */
  protected abstract wireEvents(): void;

  /** Инициализация: атрибуты, конфигурация, createComponent, первый запрос. */
  protected abstract init(): Promise<void>;

  /** Очистка при уничтожении (таймеры, подписки). */
  protected teardown(): void {}
}
