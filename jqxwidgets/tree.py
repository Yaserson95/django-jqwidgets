"""Виджет jqxTree — рендерится в шаблоне как ``{{ my_tree }}``.

Дерево подгружает данные динамически: корни — сразу, дети узла — при
раскрытии ветки, а если у узла детей много (больше ``chunk_size``), то
следующие чанки догружаются по мере того, как пользователь долистывает
до последнего загруженного элемента ветки.
"""
import json

from django.template.loader import render_to_string

from .assets import assets_html
from .viewsets import source_url


class Tree:
    """Виджет jqxTree с динамической подгрузкой узлов.

    Простой случай::

        my_tree = Tree(source=TreeViewSet.create("MyModel"))

    В шаблоне::

        {{ my_tree }}

    Опции jqxTree (``height``, ``checkboxes`` и любые другие) передаются через
    ``**options`` или задаются в подклассе::

        class DepartmentTree(Tree):
            options = {'height': 500, 'checkboxes': True}

        my_tree = DepartmentTree(source=DEPARTMENT_SOURCE)
    """
    source = None
    options: dict = {}

    def __init__(self, source=None, config: dict | None = None, **options):
        self.source = source if source is not None else type(self).source

        merged_options = dict(type(self).options or {})
        if config is not None:
            if not isinstance(config, dict):
                raise TypeError(f"Tree ожидает dict для config, получено: {type(config)!r}")
            merged_options.update(config)
        merged_options.update(options)
        self.config = merged_options

    @property
    def url(self) -> str:
        """URL источника данных (REST-уровня) дерева."""
        return source_url(self.source, basename_attr='tree_basename', widget='Tree')

    def __html__(self) -> str:
        return render_to_string('jqxwidgets/tree.html', {
            'source': self.url,
            'config': json.dumps(self.config, ensure_ascii=False, default=str),
            'assets': assets_html(),
        })

    def __str__(self) -> str:
        return self.__html__()
