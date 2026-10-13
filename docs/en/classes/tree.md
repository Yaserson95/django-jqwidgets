# API reference — tree

Public tree classes of **django-jqxwidgets**:

```python
from jqxwidgets import Tree, TreeViewSet
```

Base class, shared helpers and package exports:
[base.md](base.md).

---

## `Tree`

*class* `jqxwidgets.widgets.tree.Tree` — the tree widget with lazy loading.
Renders as `{{ tree }}`.

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

Next: [../usage/tree.md](../usage/tree.md) — the tree guide ·
[base.md](base.md) — base reference ·
[grid.md](grid.md) · [form.md](form.md).

Русская версия: [../../ru/classes/tree.md](../../ru/classes/tree.md).
