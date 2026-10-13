# Usage

How to build grids and trees with **django-jqxwidgets**: sources, columns,
options and the HTTP protocol between the components and Django.

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

---

## 8. Trees — `<jqx-tree>`

The package also ships a lazily-loading tree built on jqxTree. Nodes load
dynamically from a REST backend:

* **roots** — requested on page load (`GET <prefix>/`);
* **children** — requested when a branch is expanded (`?parent=<id>`);
* **more children** — when a level has more nodes than one chunk, the next
  chunks are fetched as the user scrolls near the bottom of the list
  (`?parent=<id>&offset=…&limit=…`).

### 8.1 Quick start

```python
# views.py
from django.shortcuts import render
from jqxwidgets import Tree, TreeViewSet

# 1. REST-источник: /api/node/ + /api/node/config/
NodeSource = TreeViewSet.create("myapp.Node")

# 2. Виджет
def nodes(request):
    return render(request, 'nodes.html', {'tree': Tree(source=NodeSource)})
```

```django
{# templates/nodes.html #}
{{ tree }}
```

The model needs a self-referencing parent field (default name `parent`) and a
label field (auto-detected: the first of `name`, `title`, `label`, `str`):

```python
class Node(models.Model):
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', null=True, blank=True,
                               related_name='children', on_delete=models.CASCADE)
    priority = models.IntegerField(default=0)
```

### 8.2 Data sources — `TreeViewSet.create()`

```python
Source = TreeViewSet.create(
    "myapp.Node",          # модель: класс, "Node" или "app.Model"
    name="nodes",          # префикс URL (по умолчанию — имя модели)
    queryset=...,          # свой queryset (по умолчанию model.objects.all())
    label_field='name',    # поле подписи (по умолчанию — автоподбор)
    parent_field='parent', # поле-ссылка на родителя (FK на саму себя)
    chunk_size=50,         # сколько узлов отдаётся за один запрос
    max_chunk_size=500,    # верхний кламп для limit из запроса
)
```

* The factory **caches by model** and registers the viewset in the same package
  router as grids (basename attribute `tree_basename`).
* `parent_field` must be a self-FK or an integer field; the factory validates
  this at creation time.
* Nodes are ordered by the queryset order (add `ordering` or pass
  `queryset=Node.objects.order_by('priority')` to control it).

### 8.3 HTTP protocol (tree ⇄ Django)

`GET <prefix>/` (roots) and `GET <prefix>/?parent=<id>` (children) accept:

| Param | Format | Notes |
| --- | --- | --- |
| `parent` | node id | omitted → roots (`parent IS NULL`); unknown id → empty `results` |
| `offset` | integer, default `0` | chunk offset |
| `limit` | integer | clamped to `1 … max_chunk_size` (500) |

```json
{
  "count": 300,
  "results": [
    {"id": 322, "label": "Узел 322", "parentid": 321, "haschildren": true}
  ]
}
```

* `haschildren` is computed with an `Exists` subquery — the tree shows the
  expand arrow before children are loaded (the component renders a temporary
  placeholder node until the first chunk arrives).
* `count` is the total number of children — the component uses it to decide
  whether more chunks exist.

`GET <prefix>/config/`:

```json
{"pk": "id", "labelField": "name", "parentField": "parent", "chunkSize": 50}
```

`extra` of the viewset (if set) is merged into this response, exactly like for
grids — pass jqxTree options there (`height`, `checkboxes`, …).

### 8.4 jqxTree options

Same pattern as `Grid`: any jqxTree option can be passed per instance or set on
a subclass:

```python
class DepartmentTree(Tree):
    options = {'height': 500, 'checkboxes': True, 'width': 320}

tree = DepartmentTree(source=NodeSource)
```

### 8.5 The `<jqx-tree>` element

```html
<jqx-tree source="/api/node/" config='{"height":400}'></jqx-tree>
```

| Attribute | Meaning |
| --- | --- |
| `source` | URL of the tree endpoint |
| `config` | JSON: jqxTree options (plus `extra` from the viewset) |

Rules and guarantees:

* assets are loaded **once per page** even with several widgets (grid + tree);
* labels are HTML-escaped client-side, ids are sanitized;
* chunk requests stop as soon as all children are loaded (`count` reached) —
  no request loops.

## 9. Forms — `<jqx-form>`

### 9.1 Data source

```python
CATEGORY_FORM = FormViewSet.create('Category')   # -> /api/category-form/
```

Same factory as the grids: CRUD + `<source>config/` (template from the
serializer). Prefixes are deduplicated automatically, so a model that already
has a grid gets a `-form` suffix.

### 9.2 Standalone form

```python
def form_view(request):
    return render(request, 'form.html', {
        'form': Form(source=CATEGORY_FORM, id=request.GET.get('id')),
    })
```

```html
{{ form }}
```

`id` is `None` → create mode; with a value → the record is loaded for
editing. «Сохранить»/«Отмена» buttons are built in (`buttons=False` turns
them off).

### 9.3 Template from a Django form

Pass any `django.forms.Form` / `ModelForm` (class or instance) via `form=` —
the jqxForm template is generated from its fields:

```python
class ProductDjangoForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ('name', 'price', 'category', 'in_stock')

my_form = Form(source=PRODUCT_FORM, form=ProductDjangoForm)
```

* control type from the field class (`CharField → text`, `IntegerField →
  number`, `ChoiceField/ModelChoiceField → dropdownlist`, `BooleanField →
  boolean`, `DateField → date`, …; widgets `PasswordInput → password`,
  `RadioSelect → option`);
* `bind` = field name, label from `verbose_name` (ModelForms) plus
  `form.label_suffix` (default `:`), `required` flag, choices (including FK
  lists) as the dropdown `source`, `help_text` → `info`;
* files / multi-select raise `ImproperlyConfigured` — exclude them or pass an
  explicit `template`.

The generator is public: `from jqxwidgets import template_from_form` — build
the rows, adjust them, hand the list to `Form(template=rows)`.

### 9.4 Form from a widget

```js
const form = grid.getForm();          // new record
const form2 = grid.getForm(row.id);   // edit row
```

Returns a ready `<jqx-form>` element — place it yourself (window, side
panel). It saves through the same source; `saved`/`removed` events reload the
parent widget.

Next: [classes.md](classes.md) — full API reference.
