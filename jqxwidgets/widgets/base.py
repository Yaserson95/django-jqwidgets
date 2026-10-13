"""Базовый класс виджетов django-jqwidgets.

Общее для всех виджетов (``Grid`` / ``Tree`` / ``Form``):

* классовые поля ``source`` (источник данных) и ``options`` (опции jqx);
* разрешение ``source`` из подкласса и слияние опций в одну последовательность:
  классовые ``options`` → ``config`` → ``**options`` (побеждают kwargs);
* свойство ``url`` — REST-URL источника; kind-параметры ``basename_attr`` /
  ``widget_name`` подбираются под viewset соответствующего вида;
* рендеринг: ``__html__`` отрисовывает шаблон ``template_name`` с контекстом
  ``{source, config (JSON), assets}`` (подклассы добавляют своё:
  у формы — ``record``), ``__str__`` — то же самое.

Kind-специфика живёт в подклассах и задаётся классовыми полями и hook'ами:

===================  =========================================================
Поле / hook           Назначение
===================  =========================================================
``template_name``     шаблон вида ``jqxwidgets/<kind>.html``
``basename_attr``     атрибут viewset'а с basename'ом маршрута (``source_url``)
``widget_name``       имя виджета для сообщений об ошибках
``_extract_config()`` разбор kind-полей ``config`` в словарь опций jqx
``config_json()``     сериализация конфигурации для атрибута ``config``
``get_context()``     контекст шаблона (добавляет поля поверх базового)
===================  =========================================================
"""
import json

from django.template.loader import render_to_string

from ..assets import assets_html
from ..viewsets import source_url


class Widget:
    """Базовый виджет django-jqwidgets.

    Сам по себе не используется: наследуется конкретными виджетами —
    ``Grid``, ``Tree``, ``Form`` — и задаёт всё общее (см. docstring модуля).
    Подкласс обычно достаточно описать классовыми полями::

        class ProductGrid(Grid):
            columns = [{'text': 'Название', 'datafield': 'name'}]
            options = {'pagesize': 25}
    """

    #: Источник данных по умолчанию: класс viewset'а (``...ViewSet``),
    #: его инстанс или готовая строка-URL.
    source = None
    #: Опции jqx, заданные классом (подклассом); на инстансе — слитые.
    options: dict = {}
    #: Шаблон вида ``jqxwidgets/<kind>.html`` (обязателен для рендера).
    template_name: str | None = None
    #: Атрибут viewset'а с basename'ом маршрута (см. ``source_url``).
    basename_attr = 'grid_basename'
    #: Имя виджета для сообщений об ошибках (``source_url`` и др.).
    widget_name = 'Grid'

    def __init__(self, source=None, config=None, **options):
        self.source = source if source is not None else type(self).source

        merged = dict(type(self).options or {})
        if config is not None:
            merged.update(self._extract_config(config))
        merged.update(options)
        self.options = merged

    # ------------------------------------------------------------------
    # Kind-хуки (переопределяются подклассами)
    # ------------------------------------------------------------------

    def _extract_config(self, config) -> dict:
        """Разобрать аргумент ``config`` в словарь опций jqx (hook).

        Базовая реализация принимает открытый ``dict``; подклассы поглощают
        свои ключи (колонки у грида, ``template``/``buttons`` у формы)
        и возвращают остаток как опции.
        """
        if not isinstance(config, dict):
            raise TypeError(
                f"{type(self).__name__}: config ожидает dict, "
                f"получено: {type(config)!r}")
        return config

    def config_json(self) -> str:
        """Конфигурация виджета как JSON для атрибута ``config`` элемента."""
        return json.dumps(self.options, ensure_ascii=False, default=str)

    def get_context(self) -> dict:
        """Контекст шаблона виджета (hook: подклассы добавляют свои поля)."""
        return {
            'source': self.url,
            'config': self.config_json(),
            'assets': assets_html(),
        }

    # ------------------------------------------------------------------
    # Рендеринг
    # ------------------------------------------------------------------

    @property
    def url(self) -> str:
        """URL источника данных (REST) виджета."""
        return source_url(self.source, basename_attr=self.basename_attr,
                          widget=self.widget_name)

    def __html__(self) -> str:
        """Отрендерить виджет (``{{ my_widget }}`` в шаблоне Django)."""
        if not self.template_name:
            raise NotImplementedError(
                f"{type(self).__name__}: не задан template_name")
        return render_to_string(self.template_name, self.get_context())

    def __str__(self) -> str:
        return self.__html__()
