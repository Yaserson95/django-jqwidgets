# API reference — base

Public classes, functions and constants of **django-jqxwidgets** shared by all
widgets. Everything listed here is importable from the package root unless
noted otherwise:

```python
from jqxwidgets import Widget          # base class of all widgets
```

Widget-specific reference: [grid](grid.md) ·
[tree](tree.md) · [form](form.md).

---

## `Widget`

*class* `jqxwidgets.widgets.Widget` — the base class every widget inherits
from (`Grid`, `Tree`, `Form`). It owns everything common: source resolution,
option merging, the `url` property and template rendering. You normally do
not subclass it directly — use `Grid` / `Tree` / `Form`.

### Constructor

```python
Widget(source=None, config=None, **options)
```

| Argument | Type | Description |
| --- | --- | --- |
| `source` | viewset class / viewset instance / `str` | data endpoint; falls back to the class attribute |
| `config` | `dict \| None` | options merged over the class attributes (parsed by the `_extract_config()` hook) |
| `**options` | any | any jqx option; wins over `config` and class attributes |

Option merge order (later wins): class `options` → `config` → `**options`.

### Class attributes (override them in a subclass)

| Attribute | Default | Description |
| --- | --- | --- |
| `source` | `None` | default source for instances |
| `options` | `{}` | default jqx options |
| `template_name` | — | template rendered by `__html__()`, e.g. `jqxwidgets/grid.html` |
| `basename_attr` | `'grid_basename'` | viewset attribute holding the route basename |
| `widget_name` | `'Grid'` | widget name used in error messages |

### Hooks (override them in a subclass)

| Hook | Description |
| --- | --- |
| `_extract_config(config)` | parse `config` into a plain options dict (base: requires a `dict`) |
| `config_json()` | serialize the configuration for the element's `config` attribute |
| `get_context()` | template context; base returns `source`, `config` (JSON), `assets` |

### Members

| Member | Description |
| --- | --- |
| `source` | the resolved source (class attribute or constructor argument) |
| `options` | the merged options dict (after class `options` / `config` / `**options`) |
| `url` *(property)* | resolved URL of the data endpoint (raises `ImproperlyConfigured` when the source cannot be resolved) |
| `__html__()` | renders `template_name` with the `get_context()` payload |
| `__str__()` | same as `__html__()` |

---

## Module functions

### `jqxwidgets.viewsets` (shared helpers)

| Function | Description |
| --- | --- |
| `resolve_model(target)` | model class → class; `"MyModel"` / `"app.Model"` → class; raises `LookupError` when not found or ambiguous |
| `build_serializer(model)` | auto-generated `ModelSerializer` subclass with `fields = '__all__'` |
| `default_filterset_fields(model)` | dict of `filterset_fields` from model fields (with type-dependent lookups) |
| `decode_json_param(value)` | url-safe Base64 → JSON text; raw JSON (starting with `{`/`[`) is passed through (backward compatibility); padding optional |
| `source_url(source, basename_attr='grid_basename', widget='Grid')` | viewset class/instance/string → URL; `basename_attr` selects the route attribute (`'grid_basename'` for grids, `'tree_basename'` for trees); raises `ImproperlyConfigured` if it cannot be reversed |
| `default_label_field(model)` | auto-detected label field: the first of `name`, `title`, `label`; `None` when none exists (`str(obj)` is used) |
| `CONDITION_MAP` | mapping `condition → ORM lookup` (see [../usage/grid.md](../usage/grid.md) §5.2) |
| `FIELD_FILTERS` | field types → extra lookups used by `default_filterset_fields` |

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
| `router` | the package-level `rest_framework.routers.SimpleRouter` used by all factories; basenames are deduplicated across `GridViewSet`, `TreeViewSet` and `FormViewSet` registrations |
| `jqxwidgets.urls` | exposes `router.urls`; application namespace `jqxwidgets` (`reverse('jqxwidgets:<basename>-list')`) |

---

## Package exports

```python
import jqxwidgets
jqxwidgets.__version__   # '0.2.0'
jqxwidgets.Widget        # jqxwidgets.widgets.Widget (base class)
jqxwidgets.Grid          # jqxwidgets.widgets.grid.Grid
jqxwidgets.GridConfig    # jqxwidgets.widgets.grid.GridConfig
jqxwidgets.GridViewSet   # jqxwidgets.viewsets.GridViewSet
jqxwidgets.Tree          # jqxwidgets.widgets.tree.Tree
jqxwidgets.TreeViewSet   # jqxwidgets.viewsets.TreeViewSet
jqxwidgets.Form          # jqxwidgets.widgets.form.Form
jqxwidgets.FormViewSet   # jqxwidgets.viewsets.FormViewSet
jqxwidgets.template_from_form  # jqxwidgets.widgets.form.template_from_form
```

## Exceptions raised to the caller

| Exception | Where | When |
| --- | --- | --- |
| `ImproperlyConfigured` | `source_url()` / `Grid.url` / `Tree.url` / `Form.url` | no `source`, or the viewset has no registered URL |
| `LookupError` | `resolve_model()` | model not found / ambiguous name |
| `TypeError` | `GridConfig.from_value()` / `Tree()` / `Form()` / `template_from_form()` | value is neither `dict` nor `GridConfig` (for `Tree(config=…)` / `Form(config=…)` — not a `dict`); `template_from_form()` got something that is not a Django form class/instance |
| `ImproperlyConfigured` | `template_from_form()` | form field jqxForm cannot render (file, multi-select) — exclude it or pass an explicit `template` |
| `ValueError` | `TreeViewSet.create()` | `parent_field` is not a self-FK / integer field, or `label_field` does not exist |
| `FieldError` | `apply_jqx_sorting()` | *caught and logged* — invalid sort field |

Malformed query parameters (`sorting`, `filterGroups`) never propagate: they are
logged (`logger.error`) and the request still returns `200`.

---

Next: [../usage/base.md](../usage/base.md) — shared concepts ·
[grid.md](grid.md) · [tree.md](tree.md) ·
[form.md](form.md) — widget references.

Русская версия: [../../ru/classes/base.md](../../ru/classes/base.md).
