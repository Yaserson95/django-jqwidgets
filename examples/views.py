from django.shortcuts import render

from jqxwidgets import Form, FormViewSet, Grid, GridViewSet, Tree, TreeViewSet

from .forms import ProductDjangoForm
from .serializers import ProductSerializer

# Источники данных для гридов (регистрация viewset'ов в ростере jqxwidgets)
PRODUCT_SOURCE = GridViewSet.create('Product', serializer_class=ProductSerializer)
CATEGORY_SOURCE = GridViewSet.create('Category')

# Источник данных для дерева: REST-уровни + конфигурация jqxTree
NODE_SOURCE = TreeViewSet.create('Node', chunk_size=50)

# Источник данных для формы: поля из сериализатора + CRUD записи.
# У Category уже есть грид-источник — префикс формы дедуплицируется
# автоматически: /api/category-form/ (см. BaseViewSet.create).
CATEGORY_FORM = FormViewSet.create('Category')
PRODUCT_FORM = FormViewSet.create('Product')   # -> /api/product-form/


class CategoryGrid(Grid):
    """Пример: явные колонки и группы колонок, заданные во вьюшке."""
    columns = [
        {'text': 'ID', 'datafield': 'id', 'width': 80, 'columngroup': 'main'},
        {'text': 'Название', 'datafield': 'name', 'width': 300, 'columngroup': 'main'},
        {'text': 'Описание', 'datafield': 'description', 'width': 400, 'columngroup': 'main'},
        {'text': 'Приоритет', 'datafield': 'priority', 'width': 140,
         'cellsalign': 'right', 'columngroup': 'extra'},
    ]
    columnsgroups = [
        {'text': 'Основное', 'name': 'main', 'align': 'center'},
        {'text': 'Дополнительное', 'name': 'extra', 'align': 'center'},
    ]
    options = {'columnsresize': True, 'pageable': False, "theme":"material"}


class ProductOptionsGrid(Grid):
    """Пример: собственные опции jqxGrid, переданные во вьюшке."""
    options = {
        'columnsresize': True,
        'pageable': True,
        'pagesize': 10,
        'pagesizeoptions': ['5', '10', '25'],
        'sortable': True,
        'filterable': True,
        'showfilterrow': True,
        'selectionmode': 'singlecell',
        'altrows': True,
        "theme":"material"
    }


def index(request):
    """Страница со списком примеров."""
    return render(request, 'examples/index.html')


def auto_columns(request):
    """Автоопределение колонок из модели/сериализатора (``<source>config/``)."""
    context = {
        'grid': Grid(source=PRODUCT_SOURCE),
    }
    return render(request, 'examples/auto_columns.html', context)


def explicit_columns(request):
    """Явные колонки и группы колонок (подкласс ``Grid``)."""
    context = {
        'grid': CategoryGrid(source=CATEGORY_SOURCE),
    }
    return render(request, 'examples/explicit_columns.html', context)


def custom_options(request):
    """Колонки из конфига + кастомные опции jqxGrid."""
    context = {
        'grid': ProductOptionsGrid(source=PRODUCT_SOURCE),
    }
    return render(request, 'examples/custom_options.html', context)


def combined(request):
    """Два грида на одной странице (проверка однократной загрузки ассетов)."""
    context = {
        'product_grid': Grid(source=PRODUCT_SOURCE),
        'category_grid': CategoryGrid(source=CATEGORY_SOURCE),
    }
    return render(request, 'examples/combined.html', context)


def tree(request):
    """jqxTree: дети узла грузятся при раскрытии, чанки — по мере долистывания."""
    context = {
        'tree': Tree(source=NODE_SOURCE, height=400),
    }
    return render(request, 'examples/tree.html', context)


def form_view(request):
    """Самостоятельная форма: создание записи или редактирование ``?id=``."""
    record_id = request.GET.get('id') or None
    context = {
        'form': Form(source=CATEGORY_FORM, id=record_id),
        'grid': CategoryGrid(source=CATEGORY_SOURCE),
    }
    return render(request, 'examples/form.html', context)


def form_django(request):
    """jqxForm из Django-формы: поля/подписи/подсказки — из ``ModelForm``."""
    record_id = request.GET.get('id') or None
    context = {
        'form': Form(source=PRODUCT_FORM, form=ProductDjangoForm, id=record_id),
    }
    return render(request, 'examples/form_django.html', context)
