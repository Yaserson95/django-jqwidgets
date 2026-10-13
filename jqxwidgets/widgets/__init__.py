"""Виджеты django-jqwidgets: базовый класс и конкретные виджеты.

* ``Widget``  — базовый класс (общее: source, опции, url, рендер);
* ``Grid``    — таблица jqxGrid (+ ``GridConfig``);
* ``Tree``    — дерево jqxTree с ленивой подгрузкой;
* ``Form``    — форма записи jqxForm (+ ``template_from_form`` — шаблон
  из Django-формы).
"""
from .base import Widget
from .form import Form, template_from_form
from .grid import Grid, GridConfig
from .tree import Tree

__all__ = ['Form', 'Grid', 'GridConfig', 'Tree', 'Widget', 'template_from_form']
