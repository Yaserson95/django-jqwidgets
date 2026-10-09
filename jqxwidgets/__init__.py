"""
django-jqwidgets — Django-приложение для виджетов jQWidgets.

Публичный API:

    from jqxwidgets import Grid, GridViewSet

    my_grid = Grid(source=GridViewSet.create("MyModel"))
"""
from .grid import Grid, GridConfig  # noqa: F401
from .viewsets import GridViewSet  # noqa: F401

__all__ = ['Grid', 'GridConfig', 'GridViewSet']
__version__ = '0.1.0'
