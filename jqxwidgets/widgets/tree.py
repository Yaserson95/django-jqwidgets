"""Виджет jqxTree — рендерится в шаблоне как ``{{ my_tree }}``.

Дерево подгружает данные динамически: корни — сразу, дети узла — при
раскрытии ветки, а если у узла детей много (больше ``chunk_size``), то
следующие чанки догружаются по мере того, как пользователь долистывает
до последнего загруженного элемента ветки.
"""
from .base import Widget


class Tree(Widget):
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
    template_name = 'jqxwidgets/tree.html'
    basename_attr = 'tree_basename'
    widget_name = 'Tree'

    @property
    def config(self) -> dict:
        """Слиянные опции дерева (алиас ``options``, обратная совместимость)."""
        return self.options
