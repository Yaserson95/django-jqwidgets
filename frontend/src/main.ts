import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import { JqxFormElement } from './jqx-form.element';
import { JqxGridElement } from './jqx-grid.element';
import { JqxTreeElement } from './jqx-tree.element';

/**
 * Angular Elements пробрасывает наружу только inputs/outputs. Методы
 * компонентов вручную делегируются на веб-компонент, чтобы их можно было
 * вызывать прямо со страницы:
 *
 *     const grid = document.querySelector('jqx-grid');
 *     await grid.create({ name: 'Новая запись' });   // CRUD базового класса
 *     await grid.get(1);
 *     await grid.update(1, { name: 'Изменён' }, true);  // partial -> PATCH
 *     await grid.delete(1);
 *     const form = grid.getForm(1);   // <jqx-form> для записи (размещает страница)
 *     grid.getSelectedRow();          // текущая строка грида
 *
 *     const el = document.querySelector('jqx-form');
 *     await el.load(3);               // открыть запись для редактирования
 *     await el.save();                // POST/PUT формы
 *     el.getValues();                 // значения полей
 *
 * Метод, отсутствующий у конкретного виджета (например getSelectedRow у
 * дерева), завершается понятной ошибкой, а не TypeError.
 */
const DATA_METHODS = [
  // CRUD по источнику (база JqxWidgetElement)
  'get',
  'create',
  'update',
  'delete',
  // виджет -> форма
  'getForm',
  'getSelectedRow',
  // данные формы <jqx-form>
  'save',
  'load',
  'reset',
  'remove',
  'getValues',
  'setValues',
] as const;

function exposeDataMethods(elementClass: any): void {
  for (const name of DATA_METHODS) {
    elementClass.prototype[name] = function (this: any, ...args: any[]) {
      const instance = this.ngElementStrategy?.componentRef?.instance;
      if (!instance) {
        return Promise.reject(
          new Error(`виджет <${this.tagName.toLowerCase()}> ещё не инициализирован`),
        );
      }
      if (typeof instance[name] !== 'function') {
        return Promise.reject(
          new Error(`виджет <${this.tagName.toLowerCase()}> не имеет метода «${name}»`),
        );
      }
      return instance[name](...args);
    };
  }
}

// Веб-компоненты, которые Django рендерит в шаблоне.
// createApplication() даёт инжектор приложения (NgZone, ApplicationRef,
// ChangeDetectionScheduler), который нужен стратегии Angular Elements.
// Регистрация идемпотентна: несколько экземпляров скрипта на одной странице
// безопасны.
if (
  !customElements.get('jqx-grid') ||
  !customElements.get('jqx-tree') ||
  !customElements.get('jqx-form')
) {
  void createApplication().then((app) => {
    if (!customElements.get('jqx-grid')) {
      const grid = createCustomElement(JqxGridElement, { injector: app.injector });
      exposeDataMethods(grid);
      customElements.define('jqx-grid', grid);
    }
    if (!customElements.get('jqx-tree')) {
      const tree = createCustomElement(JqxTreeElement, { injector: app.injector });
      exposeDataMethods(tree);
      customElements.define('jqx-tree', tree);
    }
    if (!customElements.get('jqx-form')) {
      const form = createCustomElement(JqxFormElement, { injector: app.injector });
      exposeDataMethods(form);
      customElements.define('jqx-form', form);
    }
  });
}
