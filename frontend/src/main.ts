import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import { JqxGridElement } from './jqx-grid.element';
import { JqxTreeElement } from './jqx-tree.element';

// <jqx-grid> и <jqx-tree> — веб-компоненты, которые Django рендерит в шаблоне.
// createApplication() даёт инжектор приложения (NgZone, ApplicationRef,
// ChangeDetectionScheduler), который нужен стратегии Angular Elements.
// Регистрация идемпотентна: несколько экземпляров скрипта на одной странице
// безопасны.
if (!customElements.get('jqx-grid') || !customElements.get('jqx-tree')) {
  void createApplication().then((app) => {
    if (!customElements.get('jqx-grid')) {
      const grid = createCustomElement(JqxGridElement, { injector: app.injector });
      customElements.define('jqx-grid', grid);
    }
    if (!customElements.get('jqx-tree')) {
      const tree = createCustomElement(JqxTreeElement, { injector: app.injector });
      customElements.define('jqx-tree', tree);
    }
  });
}
