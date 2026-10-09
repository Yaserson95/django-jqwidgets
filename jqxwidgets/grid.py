"""Виджет jqxGrid — рендерится в шаблоне как ``{{ my_grid }}``."""
import json

from django.template.loader import render_to_string

from .assets import assets_html
from .viewsets import source_url


class GridConfig:
    """Явная конфигурация грида: колонки, группы колонок и опции jqxGrid.

    Колонки в ``columns`` можно указывать в двух видах:

    * «конфигурационном» — ``{'dataField': 'price', 'label': 'Цена', 'dataType': 'number'}``
      (как в ответе ``<source>config/``);
    * «нативном jqx» — ``{'text': 'Цена', 'datafield': 'price', 'width': 120}``.

    ``columnsgroups`` — список групп jqxGrid: ``[{'text': '...', 'name': '...'}]``.
    """

    def __init__(self, columns=None, columnsgroups=None, **options):
        self.columns = columns
        self.columnsgroups = columnsgroups
        self.options = options

    @classmethod
    def from_value(cls, value, **kwargs) -> 'GridConfig':
        if value is None:
            return cls(**kwargs)
        if isinstance(value, GridConfig):
            options = dict(value.options)
            options.update(kwargs)
            return cls(
                columns=kwargs.get('columns', value.columns),
                columnsgroups=kwargs.get('columnsgroups', value.columnsgroups),
                **{k: v for k, v in options.items()
                   if k not in ('columns', 'columnsgroups')},
            )
        if isinstance(value, dict):
            data = dict(value)
            data.update(kwargs)
            columns = data.pop('columns', None)
            columnsgroups = data.pop('columnsgroups', None)
            return cls(columns=columns, columnsgroups=columnsgroups, **data)
        raise TypeError(f"GridConfig ожидает dict или GridConfig, получено: {type(value)!r}")

    def as_dict(self) -> dict:
        data = dict(self.options)
        if self.columns is not None:
            data['columns'] = list(self.columns)
        if self.columnsgroups is not None:
            data['columnsgroups'] = list(self.columnsgroups)
        return data

    def to_json(self) -> str:
        return json.dumps(self.as_dict(), ensure_ascii=False, default=str)


class Grid:
    """Виджет jqxGrid.

    Простой случай::

        my_grid = Grid(source=GridViewSet.create("MyModel"))

    В шаблоне::

        {{ my_grid }}

    Явные колонки (во вьюшке или в подклассе)::

        class ProductGrid(Grid):
            columns = [{'text': 'Название', 'datafield': 'name', 'width': 300}]
            columnsgroups = [{'text': 'Товар', 'name': 'product', 'align': 'center'}]
            options = {'columnsresize': True}

        my_grid = ProductGrid(source=GridViewSet.create("Product"))
    """
    source = None
    columns: list | None = None
    columnsgroups: list | None = None
    options: dict = {}

    def __init__(self, source=None, columns=None, columnsgroups=None,
                 config: GridConfig | dict | None = None, **options):
        self.source = source if source is not None else type(self).source
        if columns is None:
            columns = type(self).columns
        if columnsgroups is None:
            columnsgroups = type(self).columnsgroups

        merged_options = dict(type(self).options or {})
        if config is not None:
            cfg = GridConfig.from_value(config)
            merged_options.update(cfg.options)
            if cfg.columns is not None:
                columns = cfg.columns
            if cfg.columnsgroups is not None:
                columnsgroups = cfg.columnsgroups
        merged_options.update(options)

        self.config = GridConfig(columns=columns, columnsgroups=columnsgroups,
                                 **merged_options)

    @property
    def url(self) -> str:
        """URL источника данных (REST-списка) грида."""
        return source_url(self.source)

    def __html__(self) -> str:
        return render_to_string('jqxwidgets/grid.html', {
            'source': self.url,
            'config': self.config.to_json(),
            'assets': assets_html(),
        })

    def __str__(self) -> str:
        return self.__html__()
