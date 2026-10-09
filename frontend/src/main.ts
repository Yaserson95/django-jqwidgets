import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import { JqxGridElement } from './jqx-grid.element';

// <jqx-grid> — веб-компонент, который Django рендерит в шаблоне.
// createApplication() даёт инжектор приложения (NgZone, ApplicationRef,
// ChangeDetectionScheduler), который нужен стратегии Angular Elements.
// Регистрация идемпотентна: несколько экземпляров скрипта на одной странице
// безопасны.
if (!customElements.get('jqx-grid')) {
  void createApplication().then((app) => {
    if (customElements.get('jqx-grid')) return;
    const element = createCustomElement(JqxGridElement, {
      injector: app.injector,
    });
    customElements.define('jqx-grid', element);
  });
}
