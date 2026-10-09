# Usage

How to build grids with **django-jqxwidgets**: sources, columns, options and the
HTTP protocol between the grid and Django.

## 1. Quick start

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

`{{ grid }}` renders the web component together with its styles and loader:

```html
<link rel="stylesheet" href="/static/jqxwidgets/styles-….css">
<script>… один раз на страницу подключает polyfills-*.js и main-*.js …</script>
<jqx-grid source="/api/product/" config="{&quot;pagesize&quot;:50, …}"></jqx-grid>
```

Done: server-side paging, filters and sorting out of the box.

---

## 2. Data sources — `GridViewSet.create()`

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

* The factory **caches by model**: calling `create()` twice for the same model
  returns the same class (no duplicate routes).
* URLs: `<prefix>/` (list, GET/POST/PUT/PATCH/DELETE — it is a `ModelViewSet`)
  and `<prefix>/config/` (column config).
* `filterset_fields` is generated from the model automatically unless you pass
  your own: `exact` for every concrete field plus `icontains/istartswith/…`
  for text and `gt/gte/lt/lte` for numbers and dates.
* The viewset is registered in the package router — that is why `urls.py` must
  contain `path('api/', include('jqxwidgets.urls'))`.

`Grid(source=...)` accepts:

| Value | Result |
| --- | --- |
| viewset class from `GridViewSet.create()` | URL resolved automatically |
| viewset instance | the same |
| a string (`"/api/products/"`) | used as-is |

---

## 3. Columns

### 3.1 Automatic (default)

Nothing to do: `GET <source>config/` builds columns from the serializer (or the
model when a serializer is auto-generated) — label, data type, filter widget,
date format, `pk` field hidden.

### 3.2 Explicit columns

Pass them to the widget or set them on a subclass:

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

Two column syntaxes are accepted (both may be mixed inside one list):

| Syntax | Example | Origin |
| --- | --- | --- |
| **config** | `{'dataField': 'price', 'label': 'Цена', 'dataType': 'number'}` | same shape as `<source>config/` |
| **native jqx** | `{'text': 'Цена', 'datafield': 'price', 'width': 120}` | passed to jqxGrid untouched |

Config-syntax keys: `dataField`, `label`, `dataType`, `visible`, `editable`,
`hidden`, `width`, `format` / `cellsformat`, `columntype`, `columngroup`,
`cellsalign`, `filter` (`{enabled, type}`), `filtertype`. Anything else is
forwarded to jqxGrid as-is.

### 3.3 Column config in the serializer

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

* Nested serializers become flat `parent__child` fields (`category__name`) —
  the response contains the same keys, so jqxGrid shows them natively.
* Built-in type → column mapping: `Boolean→boolean`, `Integer/Decimal/Float→number`,
  `DateTime/Date→date`, everything else → `string`.
* Default cell formats: `DateTimeField → dd.MM.yyyy HH:mm`, `DateField → dd.MM.yyyy`.
* Default filter widget: checkbox / date / number / list (choices) / text.

### 3.4 Precedence

`columns` and `columnsgroups`: constructor argument → `config=` argument →
subclass class attribute → automatic config from `<source>config/`.

Options (any other key): constructor `**options` → `config=` argument →
subclass `options` → `extra` of the viewset → `<source>config/` response →
built-in defaults.

---

## 4. jqxGrid options

Any option of jqxGrid can be passed as a keyword argument to the widget or set
on a subclass:

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

or per instance:

```python
grid = Grid(source=ProductSource, pagesize=25, height=600, showfilterrow=True)
```

Structural keys (`columns`, `columnsgroups`, `pk`, `sorting`, `label`, `model`)
are consumed by the package itself and are **not** passed to jqxGrid.

Server-side paging (`virtualmode`) is always enabled — it is the only mode that
works together with a REST backend; do not try to override it.

---

## 5. HTTP protocol (grid ⇄ Django)

The component sends GET requests with the following query parameters:

| Param | Format | Notes |
| --- | --- | --- |
| `pagenum` | integer, **0-based** | `0` is the first page |
| `pagesize` | integer | clamped to `GridPagination.max_page_size` (50 by default) |
| `sorting` | url-safe Base64 of JSON `[[field, dir], …]` | `dir = 1` ascending, `0` descending; plain JSON is accepted too |
| `filterGroups` | url-safe Base64 of JSON group list | plain JSON accepted too |

Response (DRF paginator):

```json
{
  "count": 120,
  "results": [
    {"id": 1, "name": "Смартфон 1", "price": "123.45",
     "in_stock": true, "category__name": "Электроника"}
  ]
}
```

Base64 is url-safe (RFC 4648 §5: `-`/`_`, no `=` padding) so no character needs
extra escaping; decoding is done by `jqxwidgets.viewsets.decode_json_param`,
which also accepts raw JSON for backward compatibility.

### 5.1 Sorting

```
sorting = base64(JSON([["price", 1], ["name", 0]]))   # сначала цена ↑, потом название ↓
```

Invalid fields are logged and ignored; a malformed parameter never breaks the
page (the response stays `200`, without ordering).

### 5.2 Filtering

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

* `field` — model field (nested: `category__name`).
* `operator` — how filters inside a group combine (`and`/`or`), and how groups
  combine with each other (`and`).
* `condition` — one of:

| Condition | Lookup | | Condition | Lookup |
| --- | --- | --- | --- | --- |
| `CONTAINS` | `icontains` | | `GREATER_THAN_OR_EQUAL` | `gte` |
| `DOES_NOT_CONTAIN` | `~icontains` | | `LESS_THAN_OR_EQUAL` | `lte` |
| `EQUAL` | `exact` | | `STARTS_WITH` | `istartswith` |
| `NOT_EQUAL` | `~exact` | | `ENDS_WITH` | `iendswith` |
| `GREATER_THAN` | `gt` | | `NULL` | `isnull=True` |
| `LESS_THAN` | `lt` | | `NOT_NULL` | `isnull=False` |

`EQUAL` with an empty value is treated as `NULL`. Filters are applied through
`Q` objects, so they compose with `filterset_fields`, `search_fields` and
`ordering` from DRF backends.

---

## 6. The `<jqx-grid>` element

You rarely write it by hand (the `Grid` widget does it), but the component API
is just two attributes:

```html
<jqx-grid source="/api/product/" config='{"pagesize":25,"columns":[…]}'></jqx-grid>
```

| Attribute | Meaning |
| --- | --- |
| `source` | URL of the DRF list endpoint |
| `config` | JSON: options + `columns` + `columnsgroups` + `pk` |

Rules and guarantees:

* assets are loaded **once per page** even with several grids
  (`window.__JQXWIDGETS_LOADED__` guard);
* `config` is JSON — keep it in a double-quoted HTML attribute and let Django
  escape it (`Grid` does this for you);
* requires `django.contrib.staticfiles` and the package's static files to be
  collected (see [installation.md](installation.md)).

---

## 7. Recipes

**Own queryset / permissions**

```python
Source = GridViewSet.create(
    "myapp.Product",
    queryset=Product.objects.filter(is_active=True).select_related('category'),
)
```

**Hide a column by default** — `{'dataField': 'id', 'hidden': True}` or
`'id': {'hidden': True}` inside `Meta.grid_config`.

**Different page size** — pass `pagesize=25` to `Grid(...)`, or set
`extra={'pagesize': 25}` on the viewset so every grid of that source gets it.

**Two grids on one page** — just render two `{{ … }}`; the bundle is shared
(verified by the `/combined/` demo page).

**Custom markup** — subclass `Grid` and override `__html__()` (it renders the
`jqxwidgets/grid.html` template with `source`, `config` and `assets` in context).

Next: [classes.md](classes.md) — full API reference.
