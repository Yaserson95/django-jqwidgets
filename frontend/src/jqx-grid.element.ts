import { Component, EventEmitter, Output } from '@angular/core';
import { jqxGridComponent } from 'jqwidgets-ng/jqxgrid';

import { buildGridOptions } from './jqx-grid-config';
import { JqxWidgetElement } from './jqx-widget.base';

/**
 * Web-компонент `<jqx-grid>`: Django-шаблон рендерит элемент с атрибутами
 * `source` (URL REST-списка) и `config` (JSON явных опций/колонок),
 * а компонент сам загружает конфигурацию и поднимает jqxGrid.
 *
 * Общее с `<jqx-tree>` (CRUD по источнику, source/config, error, lifecycle) —
 * в базовом классе `JqxWidgetElement`.
 */
@Component({
  selector: 'jqx-grid',
  standalone: true,
  imports: [jqxGridComponent],
  template: `
    @if (error()) {
      <div class="jqxwidgets-error">⚠ {{ error() }}</div>
    } @else {
      <jqxGrid #inner [auto-create]="false"></jqxGrid>
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
export class JqxGridElement extends JqxWidgetElement {
  protected override readonly widgetName = 'grid';

  // События для потребителей элемента (CustomEvent на <jqx-grid>)
  @Output() bindingcomplete = new EventEmitter<any>();
  @Output() cellclick = new EventEmitter<any>();
  @Output() celldoubleclick = new EventEmitter<any>();
  @Output() rowselect = new EventEmitter<any>();
  @Output() rowunselect = new EventEmitter<any>();
  @Output() rowdoubleclick = new EventEmitter<any>();
  @Output() cellvaluechanged = new EventEmitter<any>();
  @Output() columnresized = new EventEmitter<any>();
  @Output() columnreordered = new EventEmitter<any>();
  @Output() groupschanged = new EventEmitter<any>();
  @Output() rowexpand = new EventEmitter<any>();
  @Output() rowcollapse = new EventEmitter<any>();
  @Output() sort = new EventEmitter<any>();
  @Output() filter = new EventEmitter<any>();
  @Output() pagechanged = new EventEmitter<any>();
  @Output() pagesizechanged = new EventEmitter<any>();

  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState = 'data';
  private adapter: any = null;

  protected override async init(): Promise<void> {
    const host = this.hostRef.nativeElement;
    this.source = host.getAttribute('source') ?? '';
    const overrides = this.parseConfig(host.getAttribute('config'));

    let definition: any = {};
    if (this.source) {
      const loaded = await this.loadConfig();
      if (loaded === null) {
        // Сбой загрузки конфигурации: без явных колонок грид не поднять.
        if (!overrides.columns) {
          this.error.set('Не удалось загрузить конфигурацию таблицы');
          return;
        }
      } else {
        definition = loaded;
      }
    }

    if (this.destroyed) return;

    const options = buildGridOptions(
      definition,
      overrides,
      this.source,
      () => this.sortInfo(),
      (state) => this.scheduleReload(state),
    );
    if (!options.columns?.length) {
      this.error.set('Для таблицы не заданы колонки');
      return;
    }

    this.adapter = options.source;
    this.inner?.createComponent(options);
    this.created.emit();
  }

  /**
   * Хуки адаптера (sort/filter/pager) вызываются синхронно(jqx ждёт решения),
   * поэтому перезагрузку откладываем: к моменту updatebounddata() грид уже
   * обновил pagenum/sortcolumn/dataview-состояние. Серия вызовов за один
   * тик схлопывается в один запрос.
   */
  private scheduleReload(state: string): void {
    this.pendingState = state;
    if (this.reloadTimer !== null) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => {
      this.reloadTimer = null;
      if (this.destroyed) return;
      this.inner?.updatebounddata(this.pendingState);
    }, 0);
  }

  /** После create/update/delete — адаптер в virtualmode снова запросит страницу. */
  protected override reloadData(): void {
    this.scheduleReload('data');
  }

  private sortInfo(): any {
    try {
      const inner = this.inner;
      if (!inner?.host) return null;
      return inner.getsortinformation?.() ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Данные выбранной строки (null, если ничего не выбрано).
   *
   * `getselectedrowdata` у jqx v27 нет ни в обёртке, ни в виджете —
   * индекс берём через `getselectedrowindex()`, строку — `getrowdata()`
   * (в virtualmode он отдаёт данные из dataview по bound-индексу).
   */
  getSelectedRow(): any | null {
    try {
      const inner = this.inner;
      const grid: any = inner?.widgetObject;
      if (!grid) return null;
      const index = inner.getselectedrowindex?.();
      if (!Number.isInteger(index) || index < 0) return null;
      return grid.getrowdata?.(index) ?? null;
    } catch {
      return null;
    }
  }

  protected override wireEvents(): void {
    const inner = this.inner;
    if (!inner) return;
    this.relay(inner.onBindingcomplete, this.bindingcomplete);
    // После каждой загрузки сверяем totalrecords dataview с count бэкенда:
    // при расхождении updatepagerdetails() может посчитать, что текущая
    // страница выходит за пределы, и вызвать gotoprevpage() — со сбросом
    // страницы на первую. В virtualmode значения обычно совпадают сами,
    // здесь лишь страховка.
    inner.onBindingcomplete?.subscribe(() => this.syncPagerTotals());
    this.relay(inner.onCellclick, this.cellclick);
    this.relay(inner.onCelldoubleclick, this.celldoubleclick);
    this.relay(inner.onRowselect, this.rowselect);
    this.relay(inner.onRowunselect, this.rowunselect);
    this.relay(inner.onRowdoubleclick, this.rowdoubleclick);
    this.relay(inner.onCellvaluechanged, this.cellvaluechanged);
    this.relay(inner.onColumnresized, this.columnresized);
    this.relay(inner.onColumnreordered, this.columnreordered);
    this.relay(inner.onGroupschanged, this.groupschanged);
    this.relay(inner.onRowexpand, this.rowexpand);
    this.relay(inner.onRowcollapse, this.rowcollapse);
    this.relay(inner.onSort, this.sort);
    this.relay(inner.onFilter, this.filter);
    this.relay(inner.onPagechanged, this.pagechanged);
    this.relay(inner.onPagesizechanged, this.pagesizechanged);
  }

  /** Привести dataview.totalrecords к count бэкенда и обновить пейджер. */
  private syncPagerTotals(): void {
    try {
      const grid: any = (this.inner as any)?.widgetObject;
      const total = Number(this.adapter?.totalrecords);
      if (!grid?.dataview || !Number.isFinite(total)) return;
      if (grid.dataview.totalrecords !== total) {
        grid.dataview.totalrecords = total;
        grid.updatepagerdetails?.();
      }
    } catch (err) {
      console.warn('[jqx-grid] не удалось синхронизировать totalrecords:', err);
    }
  }

  protected override teardown(): void {
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }
}
