"""
django-jqwidgets — Django-приложение для виджетов jQWidgets.

Публичный API:

    from jqxwidgets import Form, FormViewSet, Grid, GridViewSet, Tree, TreeViewSet

    my_grid = Grid(source=GridViewSet.create("MyModel"))
    my_tree = Tree(source=TreeViewSet.create("MyModel"))
    my_form = Form(source=FormViewSet.create("MyModel"), id=request.GET.get('id'))
    my_form = Form(source=..., form=MyDjangoForm)   # шаблон из Django-формы

Виджеты лежат в пакете ``jqxwidgets.widgets``: базовый класс ``Widget`` и его
подклассы ``Grid`` / ``Tree`` / ``Form`` (экспортируются из корня пакета).
"""
from .viewsets import BaseViewSet, FormViewSet, GridViewSet, TreeViewSet  # noqa: F401
from .widgets import (  # noqa: F401
    Form, Grid, GridConfig, Tree, Widget, template_from_form,
)

__all__ = [
    'BaseViewSet', 'Form', 'FormViewSet', 'Grid', 'GridConfig', 'GridViewSet',
    'Tree', 'TreeViewSet', 'Widget', 'template_from_form',
]
__version__ = '0.2.0'
