import { Component, EventEmitter, Output } from '@angular/core';
import { jqxTreeComponent } from 'jqwidgets-ng/jqxtree';

import {
  buildTreeOptions,
  escapeHtml,
  sanitizeId,
  type TreeDefinition,
} from './jqx-tree-config';
import { JqxWidgetElement } from './jqx-widget.base';

/** Состояние подгрузки уровня одного узла. */
interface LevelState {
  /** Сколько узлов уровня уже добавлено в дерево. */
  loaded: number;
  /** Всего узлов уровня (count бэкенда); null — ещё не известно. */
  total: number | null;
  /** Идёт ли запрос за этим уровнем. */
  loading: boolean;
  /** Раскрыт ли узел; свёрнутому узлу чанки не грузятся (корень всегда true). */
  expanded: boolean;
  /**
   * Расположение последнего загруженного элемента уровня — верхняя кромка
   * его `<li>` в координатах корневого списка. Чанк дозагружается, когда
   * видимая область доезжает до этой отметки (см. checkPending).
   * Пересчитывается при любой смене вёрстки (refreshPositions).
   */
  lastTop: number | null;
}

/** Ключ состояния корневого уровня (без узла-родителя). */
const ROOT_KEY = 'root';

/** Строка, показываемая у ветки с ещё не загруженными детьми (стрелка(jqx)). */
const PLACEHOLDER_LABEL = '…';

/**
 * Web-компонент `<jqx-tree>`: Django-шаблон рендерит элемент с атрибутами
 * `source` (URL REST-уровня) и `config` (JSON явных опций), а компонент сам
 * поднимает jqxTree и подгружает данные динамически:
 *
 *  - корневой уровень — сразу при создании;
 *  - дети узла — при раскрытии ветки (`expand`);
 *  - следующие чанки уровня — как только пользователь долистал до последнего
 *    загруженного элемента этого поддерева. Для каждого узла хранятся
 *    расположение последнего элемента (`lastTop`) и флаг раскрытости
 *    (`expanded`); событие `valueChanged` вертикального скроллбара jqxPanel
 *    сверяет позицию видимой области с этими отметками и догружает нужные
 *    чанки (таймер не используется).
 *
 * Уровень «на середине» панели догружается независимо от глобального дна
 * скролла: важно только, долистал ли пользователь до его последнего элемента.
 *
 * jqxTree не умеет показывать стрелку раскрытия у узла без детей, поэтому
 * для веток с `haschildren: true` добавляется заглушка-узел «…», которая
 * заменяется реальными детьми сразу после загрузки.
 *
 * Общее с `<jqx-grid>` (CRUD по источнику, source/config, error, lifecycle) —
 * в базовом классе `JqxWidgetElement`.
 */
@Component({
  selector: 'jqx-tree',
  standalone: true,
  imports: [jqxTreeComponent],
  template: `
    @if (error()) {
      <div class="jqxwidgets-error">⚠ {{ error() }}</div>
    } @else {
      <jqxTree #inner [auto-create]="false"></jqxTree>
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
export class JqxTreeElement extends JqxWidgetElement {
  protected override readonly widgetName = 'tree';

  // События для потребителей элемента (CustomEvent на <jqx-tree>)
  @Output() expand = new EventEmitter<any>();
  @Output() collapse = new EventEmitter<any>();
  @Output() select = new EventEmitter<any>();
  @Output() itemclick = new EventEmitter<any>();
  @Output() checkchange = new EventEmitter<any>();
  @Output() added = new EventEmitter<any>();
  @Output() removed = new EventEmitter<any>();
  @Output() dragstart = new EventEmitter<any>();
  @Output() dragend = new EventEmitter<any>();
  /** Загружен очередной чанк: {parent, loaded, total}. */
  @Output() chunkloaded = new EventEmitter<{ parent: string | null; loaded: number; total: number }>();

  private chunkSize = 50;
  private readonly states = new Map<string, LevelState>();
  private readonly originalIds = new Map<string, string>();
  private scrollbarHost: any = null;
  private readonly onScroll = (): void => this.checkPending();

  protected override async init(): Promise<void> {
    const host = this.hostRef.nativeElement;
    this.source = host.getAttribute('source') ?? '';
    const overrides = this.parseConfig(host.getAttribute('config'));

    // Сбой загрузки конфига некритичен: дерево работает на дефолтах.
    const definition: TreeDefinition = (await this.loadConfig()) ?? {};

    if (this.destroyed) return;

    const { options, chunkSize } = buildTreeOptions(definition, overrides);
    this.chunkSize = chunkSize;
    this.inner?.createComponent(options);
    this.created.emit();
    this.wireScroll();

    this.states.set(ROOT_KEY, {
      loaded: 0, total: null, loading: false, expanded: true, lastTop: null,
    });
    await this.loadChunk(ROOT_KEY, null, false);
  }

  // ------------------------------------------------------------------
  // Загрузка данных
  // ------------------------------------------------------------------

  /** Загрузить очередной чанк уровня и добавить его в дерево. */
  private async loadChunk(
    key: string,
    parentElement: HTMLElement | null,
    removePlaceholder: boolean,
  ): Promise<void> {
    const state = this.states.get(key);
    if (!state || state.loading || this.destroyed) return;
    if (state.total !== null && state.loaded >= state.total) return;

    state.loading = true;
    try {
      const url = new URL(this.source, window.location.href);
      const parent = key === ROOT_KEY ? null : (this.originalIds.get(key) ?? null);
      if (parent !== null) url.searchParams.set('parent', parent);
      url.searchParams.set('offset', String(state.loaded));
      url.searchParams.set('limit', String(this.chunkSize));

      const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (this.destroyed) return;

      const records: any[] = Array.isArray(data?.results) ? data.results : [];
      const count = Number(data?.count);
      state.total = Number.isFinite(count) ? count : state.loaded + records.length;

      const items = records.map((record) => this.toItem(record));
      this.appendItems(key, parentElement, items, removePlaceholder);
      state.loaded += records.length;
      this.chunkloaded.emit({
        parent: parent,
        loaded: state.loaded,
        total: state.total,
      });
    } catch (err) {
      console.error('[jqx-tree] не удалось загрузить узлы:', err);
    } finally {
      state.loading = false;
      // Вёрстка изменилась: пересчитываем расположения последних элементов
      // и проверяем, не долистал ли кто-то до конца своего поддерева.
      this.refreshPositions();
      this.checkPending();
    }
  }

  /** После create/update/delete (и вручную) — перезагрузка дерева с корня. */
  protected override reloadData(): void {
    const tree: any = (this.inner as any)?.widgetObject;
    if (!tree || this.destroyed) return;
    tree.clear();
    this.states.clear();
    this.originalIds.clear();
    this.states.set(ROOT_KEY, {
      loaded: 0, total: null, loading: false, expanded: true, lastTop: null,
    });
    void this.loadChunk(ROOT_KEY, null, false);
  }

  /** Запись бэкенда -> элемент jqxTree (+ заглушка для ветки с haschildren). */
  private toItem(record: any): any {
    const id = sanitizeId(record.id);
    this.originalIds.set(id, String(record.id));
    const item: any = {
      id,
      label: escapeHtml(String(record.label ?? '')),
    };
    if (record.haschildren) {
      // Заглушка: jqxTree показывает стрелку раскрытия только при наличии
      // дочерних <li>. Она удаляется в момент загрузки реальных детей.
      item.items = [{ id: `ph-${id}`, label: PLACEHOLDER_LABEL }];
      if (!this.states.has(id)) {
        this.states.set(id, {
          loaded: 0, total: null, loading: false, expanded: false, lastTop: null,
        });
      }
    }
    return item;
  }

  /** Добавить элементы к узлу (или в корень) одним рендером. */
  private appendItems(
    key: string,
    parentElement: HTMLElement | null,
    items: any[],
    removePlaceholder: boolean,
  ): void {
    const tree: any = (this.inner as any)?.widgetObject;
    if (!tree || items.length === 0) return;

    if (removePlaceholder) {
      const placeholder = document.getElementById(`ph-${key}`);
      if (placeholder) tree.removeItem(placeholder, false);
    }
    // Внимание: jqxTree.addTo принимает (items, parentElement, render) —
    // элементы первыми, узел-родитель вторым. render=false — без
    // промежуточного рендера, затем один render() на весь чанк
    // (меньше миганий и работы DOM).
    tree.addTo(items, parentElement ?? null, false);
    tree.render();
  }

  // ------------------------------------------------------------------
  // Раскрытие/сворачивание ветки
  // ------------------------------------------------------------------

  private handleExpand(event: any): void {
    const tree: any = (this.inner as any)?.widgetObject;
    // jqx-событие: обёртка эмитит его целиком, элемент — в event.args.element
    // (допускаем и «плоский» вариант аргументов).
    const element = (event?.args?.element ?? event?.element) as HTMLElement | undefined;
    if (!tree || !element) return;

    const item = tree.getItem?.(element);
    if (!item) return;

    const key = String(item.id);
    const state = this.states.get(key);
    if (!state) return;

    // Флаг раскрытости — по нему проверяется, грузить ли чанки по позиции.
    state.expanded = true;
    // Дети ещё ни разу не загружались — подгружаем первый чанк
    // (после вставки loadChunk сам пересчитает позиции и проверит их).
    if (!state.loading && state.loaded === 0) {
      void this.loadChunk(key, element, true);
      return;
    }
    // Ветка уже содержала детей — позиции могли съехать.
    this.refreshPositions();
    this.checkPending();
  }

  private handleCollapse(event: any): void {
    const element = (event?.args?.element ?? event?.element) as HTMLElement | undefined;
    if (!element) return;

    const tree: any = (this.inner as any)?.widgetObject;
    const item = tree?.getItem?.(element);
    if (!item) return;

    const state = this.states.get(String(item.id));
    if (state) state.expanded = false;
    // Свёрнутая ветка уехала вверх — позиции остальных узлов съехали.
    this.refreshPositions();
    this.checkPending();
  }

  // ------------------------------------------------------------------
  // Подгрузка чанков при прокрутке
  // ------------------------------------------------------------------

  /**
   * Подписка на перемещение вертикального скроллбара jqxPanel: перетаскивание
   * ползунка, кнопки, области и колесо у jqxScrollBar идут через setPosition,
   * который кидает jQuery-событие `valueChanged` на элементе скроллбара.
   */
  private wireScroll(): void {
    const tree: any = (this.inner as any)?.widgetObject;
    const panel = tree?.panel;
    if (!panel) return;
    // Имя элемента скроллбара = id панели + 'verticalScrollBar'.
    this.scrollbarHost = panel.find('[id$="verticalScrollBar"]');
    this.scrollbarHost.on('valueChanged', this.onScroll);
  }

  /**
   * Проверка сохранённых позиций: для каждого раскрытого узла, у которого
   * ещё есть незагруженные чанки, — если видимая область доехала (или уже
   * проехала) до последнего загруженного элемента этого поддерева,
   * догружаем следующий чанк. Глобальное дно скролла не требуется: уровень
   * «на середине» панели догружается, как только пользователь долистал
   * именно его конец.
   */
  private checkPending(): void {
    if (this.destroyed) return;
    const tree: any = (this.inner as any)?.widgetObject;
    const host = (this.inner as any)?.elementRef?.nativeElement as HTMLElement | undefined;
    if (!tree || !host) return;

    let position = 0;
    try {
      position = tree.panel?.jqxPanel('getVScrollPosition') ?? 0;
    } catch {
      return;
    }
    const viewportBottom = position + host.clientHeight;

    for (const [key, state] of this.states) {
      if (state.loading || !state.expanded) continue;
      if (state.total === null || state.loaded >= state.total) continue;
      if (state.lastTop === null || viewportBottom < state.lastTop) continue;
      void this.loadChunk(key, this.elementOf(key), true);
    }
  }

  /**
   * Пересчитать сохранённые расположения последних элементов уровней —
   * вёрстка съезжает при раскрытии/сворачивании веток и при добавлении
   * чанков. Позиция — верхняя кромка последнего `<li>` уровня в координатах
   * корневого списка (не зависит от текущего скролла).
   */
  private refreshPositions(): void {
    const tree: any = (this.inner as any)?.widgetObject;
    const host = (this.inner as any)?.elementRef?.nativeElement as HTMLElement | undefined;
    const rootList = host?.querySelector('ul') ?? null;
    if (!tree || !rootList) return;
    const rootTop = rootList.getBoundingClientRect().top;

    const byId = new Map<string, HTMLElement>();
    for (const item of tree.getItems?.() ?? []) {
      if (item?.element && item?.id != null) byId.set(String(item.id), item.element);
    }

    for (const [key, state] of this.states) {
      if (!state.expanded || state.loaded === 0) {
        state.lastTop = null;
        continue;
      }
      const list = key === ROOT_KEY ? rootList : (byId.get(key)?.querySelector('ul') ?? null);
      const last = list?.lastElementChild ?? null;
      state.lastTop = last instanceof HTMLElement
        ? last.getBoundingClientRect().top - rootTop
        : null;
    }
  }

  /** DOM-узел <li> узла дерева по ключу состояния. */
  private elementOf(key: string): HTMLElement | null {
    const tree: any = (this.inner as any)?.widgetObject;
    if (!tree) return null;
    const items: any[] = tree.getItems?.() ?? [];
    const found = items.find((item) => String(item?.id) === key);
    return found?.element ?? null;
  }

  protected override wireEvents(): void {
    const inner = this.inner;
    if (!inner) return;
    inner.onExpand?.subscribe((args: any) => {
      this.handleExpand(args);
      this.expand.emit(args);
    });
    inner.onCollapse?.subscribe((args: any) => {
      this.handleCollapse(args);
      this.collapse.emit(args);
    });
    this.relay(inner.onSelect, this.select);
    this.relay(inner.onItemClick, this.itemclick);
    this.relay(inner.onCheckChange, this.checkchange);
    this.relay(inner.onAdded, this.added);
    this.relay(inner.onRemoved, this.removed);
    this.relay(inner.onDragStart, this.dragstart);
    this.relay(inner.onDragEnd, this.dragend);
  }

  protected override teardown(): void {
    this.scrollbarHost?.off('valueChanged', this.onScroll);
    this.scrollbarHost = null;
  }
}
