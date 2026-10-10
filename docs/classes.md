# API reference

Public classes, functions and constants of **django-jqxwidgets**.

Everything listed below is importable from the package root unless noted
otherwise:

```python
from jqxwidgets import Grid, GridViewSet
from jqxwidgets import GridConfig
from jqxwidgets import Tree, TreeViewSet
```

---

## `Grid`

*class* `jqxwidgets.grid.Grid` — the template widget. Renders as
`{{ grid }}` (implements `__html__`, so it is also auto-escaped correctly).

### Constructor

```python
Grid(source=None, columns=None, columnsgroups=None, config=None, **options)
```

| Argument | Type | Description |
| --- | --- | --- |
| `source` | viewset class / viewset instance / `str` | data endpoint; strings are used as-is, viewsets are resolved to their URL |
| `columns` | `list[dict] \| None` | explicit columns (config or native jqx syntax) |
| `columnsgroups` | `list[dict] \| None` | jqxGrid column groups `{'text', 'name', 'align'}` |
| `config` | `GridConfig \| dict \| None` | combined config; merged over the class attributes |
| `**options` | any | any jqxGrid option (`pagesize`, `showfilterrow`, `height`, …); wins over `config` and class attributes |

### Class attributes (override them in a subclass)

| Attribute | Default | Description |
| --- | --- | --- |
| `source` | `None` | default source for instances |
| `columns` | `None` | default columns |
| `columnsgroups` | `None` | default groups |
| `options` | `{}` | default jqxGrid options |

```python
class ProductGrid(Grid):
    columns = [{'text': 'Название', 'datafield': 'name', 'width': 300}]
    options = {'pagesize': 25, 'showfilterrow': True}
```

### Members

| Member | Description |
| --- | --- |
| `url` *(property)* | resolved URL of the data endpoint (raises `ImproperlyConfigured` when the source cannot be resolved) |
| `config` | the resulting `GridConfig` instance (after merging) |
| `__html__()` | renders `jqxwidgets/grid.html` with `source`, `config` (JSON), `assets` (styles + loader) |
| `__str__()` | same as `__html__()` |

---

## `GridConfig`

*class* `jqxwidgets.grid.GridConfig` — a serializable container for columns,
groups and options.

```python
GridConfig(columns=None, columnsgroups=None, **options)
```

| Member | Description |
| --- | --- |
| `columns` | list of column dicts or `None` |
| `columnsgroups` | list of group dicts or `None` |
| `options` | dict of jqxGrid options |
| `from_value(value, **kwargs)` *(classmethod)* | build from `dict`, `GridConfig` or `None`; `kwargs` override the value |
| `as_dict()` | plain `dict` (options + `columns` + `columnsgroups`) |
| `to_json()` | JSON string (`ensure_ascii=False`, non-JSON values stringified) |

---

## `Tree`

*class* `jqxwidgets.tree.Tree` — the tree widget with lazy loading. Renders as
`{{ tree }}`.

### Constructor

```python
Tree(source=None, config=None, **options)
```

| Argument | Type | Description |
| --- | --- | --- |
| `source` | viewset class / viewset instance / `str` | data endpoint; strings are used as-is, viewsets are resolved to their URL |
| `config` | `dict \| None` | jqxTree options merged over the class attributes |
| `**options` | any | any jqxTree option (`height`, `checkboxes`, `width`, …); wins over `config` and class attributes |

### Class attributes (override them in a subclass)

| Attribute | Default | Description |
| --- | --- | --- |
| `source` | `None` | default source for instances |
| `options` | `{}` | default jqxTree options |

```python
class DepartmentTree(Tree):
    options = {'height': 500, 'checkboxes': True}
```

### Members

| Member | Description |
| --- | --- |
| `url` *(property)* | resolved URL of the tree endpoint (raises `ImproperlyConfigured` when the source cannot be resolved) |
| `config` | the resulting options dict (after merging) |
| `__html__()` | renders `jqxwidgets/tree.html` with `source`, `config` (JSON), `assets` (styles + loader) |
| `__str__()` | same as `__html__()` |

---

## `GridViewSet`

*class* `jqxwidgets.viewsets.GridViewSet(rest_framework.viewsets.ModelViewSet)` —
the data backend. Normally you never subclass it by hand: use the factory.

### `GridViewSet.create(model, name=None, *, queryset=None, serializer_class=None, extra=None, **attrs)` → `type`

| Argument | Description |
| --- | --- |
| `model` | model class, `"MyModel"` or `"app_label.MyModel"` |
| `name` | URL prefix; defaults to the model name (lowercased) |
| `queryset` | custom queryset (default `model.objects.all()`) |
| `serializer_class` | custom `ModelSerializer` (default: auto-generated with `fields = '__all__'`) |
| `extra` | dict merged into the `<prefix>/config/` response (any jqxGrid option) |
| `**attrs` | any DRF ViewSet attribute: `search_fields`, `ordering`, `filter_backends`, `filterset_fields`, `permission_classes`, … |

Behaviour:

* **cached per model** — the second `create()` for the same model returns the
  already registered class;
* basename deduplication — when two models share a name, the second gets an
  `app_label_` prefix;
* registers the viewset in the package router (visible under
  `include('jqxwidgets.urls')`);
* `filterset_fields` is generated automatically when not provided;
* the returned class carries `grid_basename` and `grid_model`.

### Instance/class members

| Member | Description |
| --- | --- |
| `pagination_class = GridPagination` | `pagenum`/`pagesize` paging (0-based pages) |
| `extra` | default `None`; config endpoint extras |
| `filter_queryset(qs)` | DRF backends, then `apply_jqx_filters()`, then `apply_jqx_sorting()` (only for the `list` action) |
| `apply_jqx_filters(qs)` | applies `filterGroups`; logs and ignores malformed input |
| `apply_jqx_sorting(qs)` | applies `sorting`; invalid fields/malformed payloads are logged and ignored |
| `list(request, …)` | returns `{count, results}` with nested objects flattened to `a__b` keys |
| `grid_config` *(action)* | `GET <prefix>/config/` → column configuration (see below) |

### `GET <prefix>/config/` response

Built by `build_grid_config()` plus the viewset's `extra`:

```json
{
  "columns": [
    {"dataField": "id", "label": "Id", "dataType": "number", "visible": true,
     "editable": false, "filter": {"enabled": true, "type": "number"}, "hidden": true},
    {"dataField": "name", "label": "Название", "dataType": "string", "visible": true,
     "editable": true, "filter": {"enabled": true, "type": "text"}}
  ],
  "pagesize": 50,
  "pk": "id"
}
```

(`hidden: true` here comes from `Meta.grid_config`; `editable: false` — because
the field is read-only in the serializer. `pagesize` mirrors
`GridPagination.max_page_size`, falling back to `REST_FRAMEWORK['PAGE_SIZE']`.)

Optional keys: `columnsgroups` (from `Meta.grid_columnsgroups`).

---

## `TreeViewSet`

*class* `jqxwidgets.viewsets.TreeViewSet(rest_framework.viewsets.ViewSet)` —
the tree data backend (roots + lazy children + chunked loading). Use the
factory.

### `TreeViewSet.create(model, name=None, *, queryset=None, label_field=None, parent_field='parent', chunk_size=50, max_chunk_size=500, extra=None, **attrs)` → `type`

| Argument | Description |
| --- | --- |
| `model` | model class, `"MyModel"` or `"app_label.MyModel"` |
| `name` | URL prefix; defaults to the model name (lowercased) |
| `queryset` | custom queryset (default `model.objects.all()`); its ordering controls node order |
| `label_field` | node label field; default — auto-detected (`name` / `title` / `label` / `str(obj)`) |
| `parent_field` | self-FK (or integer) field pointing to the parent; validated at creation |
| `chunk_size` | nodes returned per request by default (default `50`) |
| `max_chunk_size` | upper clamp for the client `limit` (default `500`) |
| `extra` | dict merged into the `<prefix>/config/` response (any jqxTree option) |
| `**attrs` | any ViewSet attribute: `permission_classes`, `authentication_classes`, … |

Behaviour:

* **cached per model**, registered in the package router (basename attribute
  `tree_basename`);
* basename deduplication is shared with `GridViewSet.create()`;
* `haschildren` is computed with an `Exists` subquery (no extra queries).

### Instance members

| Member | Description |
| --- | --- |
| `label_field` / `parent_field` / `chunk_size` / `max_chunk_size` | class-level configuration (see above) |
| `list(request, …)` | `GET <prefix>/` (roots) / `?parent=<id>` (children) / `?offset=&limit=` (chunks) → `{count, results}` with `{id, label, parentid, haschildren}` |
| `tree_config` *(action)* | `GET <prefix>/config/` → `{pk, labelField, parentField, chunkSize}` + `extra` |

Malformed `offset`/`limit` fall back to defaults; an unknown `parent` returns
`200` with an empty `results` list.

---

## `GridPagination`

*class* `jqxwidgets.pagination.GridPagination(rest_framework.pagination.PageNumberPagination)`

| Attribute | Value | Meaning |
| --- | --- | --- |
| `page_query_param` | `'pagenum'` | **0-based** page index (`0` = first page) |
| `page_size_query_param` | `'pagesize'` | client page size |
| `max_page_size` | `50` | upper clamp for `pagesize` |
| `get_page_number()` | overridden | maps `pagenum=0 → 1`, non-numeric → first page, `last` → last page |

The default page size comes from `REST_FRAMEWORK['PAGE_SIZE']`.

---

## Module functions

### `jqxwidgets.viewsets`

| Function | Description |
| --- | --- |
| `resolve_model(target)` | model class → class; `"MyModel"` / `"app.Model"` → class; raises `LookupError` when not found or ambiguous |
| `build_serializer(model)` | auto-generated `ModelSerializer` subclass with `fields = '__all__'` |
| `default_filterset_fields(model)` | dict of `filterset_fields` from model fields (with type-dependent lookups) |
| `decode_json_param(value)` | url-safe Base64 → JSON text; raw JSON (starting with `{`/`[`) is passed through (backward compatibility); padding optional |
| `source_url(source, basename_attr='grid_basename', widget='Grid')` | viewset class/instance/string → URL; `basename_attr` selects the route attribute (`'grid_basename'` for grids, `'tree_basename'` for trees); raises `ImproperlyConfigured` if it cannot be reversed |
| `default_label_field(model)` | auto-detected label field: the first of `name`, `title`, `label`; `None` when none exists (`str(obj)` is used) |
| `CONDITION_MAP` | mapping `condition → ORM lookup` (see [usage.md](usage.md) §5.2) |
| `FIELD_FILTERS` | field types → extra lookups used by `default_filterset_fields` |

### `jqxwidgets.config`

| Function | Description |
| --- | --- |
| `build_grid_config(serializer, pagesize=None)` | full config dict: `columns`, optional `pagesize`, `pk`, `columnsgroups` |
| `flatten_serializer_fields(serializer, prefix='')` | nested serializers → flat `parent__child` field map |
| `get_filter_type(field)` | serializer field → jqx filter widget (`checkbox`/`date`/`number`/`list`/`text`) |
| `TYPE_MAPPINGS` | DRF field class name → jqx `dataType` |
| `DATE_FORMATS` | `DateTimeField → 'dd.MM.yyyy HH:mm'`, `DateField → 'dd.MM.yyyy'` |

Serializer `Meta` hooks read by `build_grid_config`:

| `Meta` attribute | Meaning |
| --- | --- |
| `grid_config` | per-field overrides, e.g. `{'price': {'width': '15%', 'format': 'c2'}}` |
| `grid_columnsgroups` | column groups list |

### `jqxwidgets.utils`

| Function | Description |
| --- | --- |
| `flatten_data_object(data, parent_key='', separator='__')` | recursively flattens dicts/lists in a response row into `a__b` and `a__b__0` keys |

### `jqxwidgets.assets`

| Function | Description |
| --- | --- |
| `assets_html()` | HTML fragment: stylesheet `<link>`s + inline loader that injects the bundle once per page; empty `js` list → warning in the log |

### `jqxwidgets.router` / `jqxwidgets.urls`

| Object | Description |
| --- | --- |
| `router` | the package-level `rest_framework.routers.SimpleRouter` used by both factories; basenames are deduplicated across `GridViewSet` and `TreeViewSet` registrations |
| `jqxwidgets.urls` | exposes `router.urls`; application namespace `jqxwidgets` (`reverse('jqxwidgets:<basename>-list')`) |

---

## Package exports

```python
import jqxwidgets
jqxwidgets.__version__   # '0.2.0'
jqxwidgets.Grid          # jqxwidgets.grid.Grid
jqxwidgets.GridConfig    # jqxwidgets.grid.GridConfig
jqxwidgets.GridViewSet   # jqxwidgets.viewsets.GridViewSet
jqxwidgets.Tree          # jqxwidgets.tree.Tree
jqxwidgets.TreeViewSet   # jqxwidgets.viewsets.TreeViewSet
```

## Exceptions raised to the caller

| Exception | Where | When |
| --- | --- | --- |
| `ImproperlyConfigured` | `source_url()` / `Grid.url` / `Tree.url` | no `source`, or the viewset has no registered URL |
| `LookupError` | `resolve_model()` | model not found / ambiguous name |
| `TypeError` | `GridConfig.from_value()` / `Tree()` | value is neither `dict` nor `GridConfig` (for `Tree(config=…)` — not a `dict`) |
| `ValueError` | `TreeViewSet.create()` | `parent_field` is not a self-FK / integer field, or `label_field` does not exist |
| `FieldError` | `apply_jqx_sorting()` | *caught and logged* — invalid sort field |

Malformed query parameters (`sorting`, `filterGroups`) never propagate: they are
logged (`logger.error`) and the request still returns `200`.
