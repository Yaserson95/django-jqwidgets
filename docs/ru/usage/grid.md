# Гриды — `<jqx-grid>`

Как строить таблицы данных: источники, колонки, опции и HTTP-протокол между
компонентом и Django.

## 1. Быстрый старт

```python
# views.py
from django.shortcuts import render
from jqxwidgets import Grid, GridViewSet

# 1. REST-источник: /api/product/ + /api/product/config/
ProductSource = GridViewSet.create("myapp.Product")

# 2. Виджет
def products(request):
    return render(request, 'products.html', {'grid': Grid(source=ProductSource)})
```

```django
{# templates/products.html #}
<!DOCTYPE html>
<html>
<head>{% load static %}<title>Товары</title></head>
<body>
  {{ grid }}
</body>
</html>
```

`{{ grid }}` рендерит веб-компонент вместе со стилями и загрузчиком:

```html
<link rel="stylesheet" href="/static/jqxwidgets/styles-….css">
<script>… один раз на страницу подключает polyfills-*.js и main-*.js …</script>
<jqx-grid source="/api/product/" config="{&quot;pagesize&quot;:50, …}"></jqx-grid>
```

Готово: серверная пагинация, фильтры и сортировка из коробки.

---

## 2. Источники данных — `GridViewSet.create()`

```python
Source = GridViewSet.create(
    "myapp.Product",          # модель: класс, "Product" или "app.Model"
    name="products",          # префикс URL (по умолчанию — имя модели)
    queryset=...,             # свой queryset (по умолчанию model.objects.all())
    serializer_class=...,     # свой сериализатор (по умолчанию автосозданный)
    extra={...},              # доп. опции в ответ <source>config/
    # и любые атрибуты DRF-ViewSet'а:
    search_fields=['name'],
    ordering=['-created_at'],
    filterset_fields={'price': ['gt', 'lt']},
)
```

* Фабрика **кэширует по модели**: повторный вызов `create()` для той же модели
  возвращает тот же класс (без дублирующихся маршрутов).
* URL: `<prefix>/` (список, GET/POST/PUT/PATCH/DELETE — это `ModelViewSet`)
  и `<prefix>/config/` (конфигурация колонок).
* `filterset_fields` генерируется из модели автоматически, если вы не передали
  свои: `exact` для каждого конкретного поля плюс `icontains/istartswith/…`
  для текста и `gt/gte/lt/lte` для чисел и дат.
* Viewset регистрируется в роутере пакета — поэтому `urls.py` должен содержать
  `path('api/', include('jqxwidgets.urls'))`.

`Grid(source=...)` принимает:

| Значение | Результат |
| --- | --- |
| класс viewset'а из `GridViewSet.create()` | URL разрешается автоматически |
| экземпляр viewset'а | то же самое |
| строка (`"/api/products/"`) | используется как есть |

---

## 3. Колонки

### 3.1 Автоматические (по умолчанию)

Делать нечего: `GET <source>config/` строит колонки из сериализатора (или из
модели, если сериализатор автосоздан) — заголовок, тип данных, виджет фильтра,
формат даты, скрытое поле `pk`.

### 3.2 Явные колонки

Передайте их в виджет или задайте на подклассе:

```python
class CategoryGrid(Grid):
    columns = [
        {'text': 'ID',         'datafield': 'id',          'width': 80,  'columngroup': 'main'},
        {'text': 'Название',   'datafield': 'name',        'width': 300, 'columngroup': 'main'},
        {'text': 'Приоритет',  'datafield': 'priority',    'width': 140, 'cellsalign': 'right'},
    ]
    columnsgroups = [
        {'text': 'Основное',      'name': 'main', 'align': 'center'},
        {'text': 'Дополнительное', 'name': 'extra', 'align': 'center'},
    ]

grid = CategoryGrid(source=CategorySource)
```

Принимаются два синтаксиса колонок (их можно смешивать в одном списке):

| Синтаксис | Пример | Происхождение |
| --- | --- | --- |
| **config** | `{'dataField': 'price', 'label': 'Цена', 'dataType': 'number'}` | та же форма, что и у `<source>config/` |
| **нативный jqx** | `{'text': 'Цена', 'datafield': 'price', 'width': 120}` | передаётся в jqxGrid без изменений |

Ключи config-синтаксиса: `dataField`, `label`, `dataType`, `visible`,
`editable`, `hidden`, `width`, `format` / `cellsformat`, `columntype`,
`columngroup`, `cellsalign`, `filter` (`{enabled, type}`), `filtertype`.
Всё остальное пересылается в jqxGrid как есть.

### 3.3 Конфигурация колонок в сериализаторе

```python
class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        # переопределения по полям (для вложенных — ключ через __)
        grid_config = {
            'id':             {'hidden': True},
            'name':           {'width': '45%', 'filter': {'type': 'textbox'}},
            'price':          {'width': '15%', 'format': 'c2'},
            'in_stock':       {'width': '10%', 'columntype': 'checkbox'},
            'category__name': {'label': 'Категория', 'filtertype': 'list', 'width': '20%'},
        }
        grid_columnsgroups = [
            {'text': 'Товар', 'name': 'product', 'align': 'center'},
        ]
```

* Вложенные сериализаторы превращаются в плоские поля `parent__child`
  (`category__name`) — ответ содержит те же ключи, поэтому jqxGrid показывает
  их нативно.
* Встроенное сопоставление типов → колонок: `Boolean→boolean`,
  `Integer/Decimal/Float→number`, `DateTime/Date→date`, всё остальное → `string`.
* Форматы ячеек по умолчанию: `DateTimeField → dd.MM.yyyy HH:mm`,
  `DateField → dd.MM.yyyy`.
* Виджет фильтра по умолчанию: checkbox / date / number / list (choices) / text.

### 3.4 Приоритеты

`columns` и `columnsgroups`: аргумент конструктора → аргумент `config=` →
атрибут класса подкласса → автоматическая конфигурация из `<source>config/`.

Опции (любой другой ключ): `**options` конструктора → аргумент `config=` →
`options` подкласса → `extra` viewset'а → ответ `<source>config/` →
встроенные значения по умолчанию.

---

## 4. Опции jqxGrid

Любую опцию jqxGrid можно передать именованным аргументом в виджет или задать
на подклассе:

```python
class ProductGrid(Grid):
    options = {
        'columnsresize': True,
        'pageable': True,
        'pagesize': 10,
        'pagesizeoptions': [5, 10, 25],
        'sortable': True,
        'filterable': True,
        'showfilterrow': True,
        'selectionmode': 'singlecell',
        'altrows': True,
    }
```

или на экземпляр:

```python
grid = Grid(source=ProductSource, pagesize=25, height=600, showfilterrow=True)
```

Структурные ключи (`columns`, `columnsgroups`, `pk`, `sorting`, `label`,
`model`) потребляются самим пакетом и **не** передаются в jqxGrid.

Серверная пагинация (`virtualmode`) всегда включена — это единственный режим,
работающий вместе с REST-бэкендом; не пытайтесь переопределить его.

---

## 5. HTTP-протокол (грид ⇄ Django)

Компонент отправляет GET-запросы со следующими query-параметрами:

| Параметр | Формат | Примечания |
| --- | --- | --- |
| `pagenum` | целое, **с нуля** | `0` — первая страница |
| `pagesize` | целое | ограничивается `GridPagination.max_page_size` (50 по умолчанию) |
| `sorting` | url-safe Base64 от JSON `[[field, dir], …]` | `dir = 1` по возрастанию, `0` по убыванию; обычный JSON тоже принимается |
| `filterGroups` | url-safe Base64 от JSON-списка групп | обычный JSON тоже принимается |

Ответ (пагинатор DRF):

```json
{
  "count": 120,
  "results": [
    {"id": 1, "name": "Смартфон 1", "price": "123.45",
     "in_stock": true, "category__name": "Электроника"}
  ]
}
```

Base64 использует url-safe алфавит (RFC 4648 §5: `-`/`_`, без паддинга `=`),
поэтому ни один символ не требует дополнительного экранирования; декодирование
делает `jqxwidgets.viewsets.decode_json_param`, который также принимает обычный
JSON для обратной совместимости.

### 5.1 Сортировка

```
sorting = base64(JSON([["price", 1], ["name", 0]]))   # сначала цена ↑, потом название ↓
```

Невалидные поля логируются и игнорируются; битый параметр никогда не ломает
страницу (ответ остаётся `200`, без сортировки).

### 5.2 Фильтрация

```json
[
  {"field": "price", "operator": "and",
   "filters": [
     {"field": "price", "condition": "GREATER_THAN", "value": 300, "operator": "and"},
     {"field": "price", "condition": "LESS_THAN",    "value": 1000, "operator": "or"}
   ]},
  {"field": "in_stock", "operator": "and",
   "filters": [{"condition": "EQUAL", "value": true, "operator": "and"}]}
]
```

* `field` — поле модели (вложенное: `category__name`).
* `operator` — как фильтры внутри группы комбинируются (`and`/`or`), и как
  группы комбинируются между собой (`and`).
* `condition` — одно из:

| Условие | Lookup | | Условие | Lookup |
| --- | --- | --- | --- | --- |
| `CONTAINS` | `icontains` | | `GREATER_THAN_OR_EQUAL` | `gte` |
| `DOES_NOT_CONTAIN` | `~icontains` | | `LESS_THAN_OR_EQUAL` | `lte` |
| `EQUAL` | `exact` | | `STARTS_WITH` | `istartswith` |
| `NOT_EQUAL` | `~exact` | | `ENDS_WITH` | `iendswith` |
| `GREATER_THAN` | `gt` | | `NULL` | `isnull=True` |
| `LESS_THAN` | `lt` | | `NOT_NULL` | `isnull=False` |

`EQUAL` с пустым значением трактуется как `NULL`. Фильтры применяются через
объекты `Q`, поэтому сочетаются с `filterset_fields`, `search_fields` и
`ordering` из бэкендов DRF.

---

## 6. Элемент `<jqx-grid>`

Вы редко пишете его вручную (виджет `Grid` делает это за вас), но API
компонента — всего два атрибута:

```html
<jqx-grid source="/api/product/" config='{"pagesize":25,"columns":[…]}'></jqx-grid>
```

| Атрибут | Значение |
| --- | --- |
| `source` | URL DRF-эндпоинта со списком |
| `config` | JSON: опции + `columns` + `columnsgroups` + `pk` |

Правила и гарантии:

* ассеты загружаются **один раз на страницу**, даже при нескольких гридах
  (защита `window.__JQXWIDGETS_LOADED__`);
* `config` — это JSON — держите его в HTML-атрибуте в двойных кавычках и
  давайте Django экранировать его (`Grid` делает это за вас);
* требуются `django.contrib.staticfiles` и собранные статические файлы пакета
  (см. [../installation.md](../installation.md)).

---

## 7. Рецепты

**Свой queryset / права доступа**

```python
Source = GridViewSet.create(
    "myapp.Product",
    queryset=Product.objects.filter(is_active=True).select_related('category'),
)
```

**Скрыть колонку по умолчанию** — `{'dataField': 'id', 'hidden': True}` или
`'id': {'hidden': True}` внутри `Meta.grid_config`.

**Другой размер страницы** — передайте `pagesize=25` в `Grid(...)`, либо задайте
`extra={'pagesize': 25}` на viewset'е, чтобы все гриды этого источника его
получили.

**Два грида на одной странице** — просто отрендерьте два `{{ … }}`; бандл
общий (проверено демо-страницей `/combined/`).

**Своя разметка** — унаследуйте `Grid` и переопределите `__html__()` (он
рендерит шаблон `jqxwidgets/grid.html` с `source`, `config` и `assets` в
контексте).

---

Далее: [../classes/grid.md](../classes/grid.md) — справочник API грида ·
[base.md](base.md) — общие концепции ·
[tree.md](tree.md) — деревья ·
[form.md](form.md) — формы.

English version: [../../en/usage/grid.md](../../en/usage/grid.md).
