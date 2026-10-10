"""
django-jqwidgets — Django-приложение для виджетов jQWidgets.

Публичный API:

    from jqxwidgets import Grid, GridViewSet, Tree, TreeViewSet

    my_grid = Grid(source=GridViewSet.create("MyModel"))
    my_tree = Tree(source=TreeViewSet.create("MyModel"))
"""
from .grid import Grid, GridConfig  # noqa: F401
from .tree import Tree  # noqa: F401
from .viewsets import BaseViewSet, GridViewSet, TreeViewSet  # noqa: F401

__all__ = ['BaseViewSet', 'Grid', 'GridConfig', 'GridViewSet', 'Tree', 'TreeViewSet']
__version__ = '0.2.0'
