import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { jqxGridComponent } from 'jqwidgets-ng/jqxgrid';

import { buildGridOptions, configUrl } from './jqx-grid-config';

/**
 * Web-компонент `<jqx-grid>`: Django-шаблон рендерит элемент с атрибутами
 * `source` (URL REST-списка) и `config` (JSON явных опций/колонок),
 * а компонент сам загружает конфигурацию и поднимает jqxGrid.
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
export class JqxGridElement implements AfterViewInit, OnDestroy {
  @ViewChild('inner') inner?: jqxGridComponent;

  // События для потребителей элемента (CustomEvent на <jqx-grid>)
  @Output() created = new EventEmitter<void>();
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

  readonly error = signal<string | null>(null);
  private destroyed = false;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState = 'data';
  private adapter: any = null;

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.wireEvents();
    void this.init();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.reloadTimer !== null) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
  }

  private async init(): Promise<void> {
    const host = this.hostRef.nativeElement;
    const source = host.getAttribute('source') ?? '';
    const overrides = this.parseConfig(host.getAttribute('config'));

    let definition: any = {};
    if (source) {
      try {
        const response = await fetch(configUrl(source), {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        definition = await response.json();
      } catch (err) {
        console.error('[jqx-grid] не удалось загрузить конфигурацию:', err);
        if (!overrides.columns) {
          this.error.set('Не удалось загрузить конфигурацию таблицы');
          return;
        }
      }
    }

    if (this.destroyed) return;

    const options = buildGridOptions(
      definition,
      overrides,
      source,
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

  private parseConfig(raw: string | null): Record<string, any> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
      console.error('[jqx-grid] невалидный JSON в атрибуте config:', err);
      return {};
    }
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

  private wireEvents(): void {
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

  private relay(source: EventEmitter<any> | undefined, target: EventEmitter<any>): void {
    source?.subscribe((value) => target.emit(value));
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
}
