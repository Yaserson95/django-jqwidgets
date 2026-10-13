# Trees — `<jqx-tree>`

A lazily-loading tree built on jqxTree. Nodes load dynamically from a REST
backend:

* **roots** — requested on page load (`GET <prefix>/`);
* **children** — requested when a branch is expanded (`?parent=<id>`);
* **more children** — when a level has more nodes than one chunk, the next
  chunks are fetched as the user scrolls near the bottom of the list
  (`?parent=<id>&offset=…&limit=…`).

## 1. Quick start

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

---

## 2. Data sources — `TreeViewSet.create()`

```python
Source = TreeViewSet.create(
    "myapp.Node",          # модель: класс, "Node" или "app.Model"
    name="nodes",          # префикс URL (по умолчанию — имя модели)
    queryset=...,          # свой queryset (по умолчанию model.objects.all())
    label_field='name',    # поле подписи (по умолчанию — автоподбор)
    parent_field='parent', # поле-ссылка на родителя (FK на саму себя)
    chunk_size=50,         # сколько узлов отдаётся за один запрос
    max_chunk_size=500,    # верхний кламп для limit из запроса
    extra={...},           # доп. опции jqxTree в ответ <source>config/
)
```

* The factory **caches by model** and registers the viewset in the same package
  router as grids (basename attribute `tree_basename`).
* `parent_field` must be a self-FK or an integer field; the factory validates
  this at creation time.
* Nodes are ordered by the queryset order (add `ordering` or pass
  `queryset=Node.objects.order_by('priority')` to control it).

---

## 3. HTTP protocol (tree ⇄ Django)

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

`extra` of the viewset (if set) is merged into this response — pass jqxTree
options there (`height`, `checkboxes`, …).

---

## 4. jqxTree options

Any jqxTree option can be passed per instance or set on a subclass:

```python
class DepartmentTree(Tree):
    options = {'height': 500, 'checkboxes': True, 'width': 320}

tree = DepartmentTree(source=NodeSource)
```

---

## 5. The `<jqx-tree>` element

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

---

Next: [../classes/tree.md](../classes/tree.md) — the tree API reference ·
[base.md](base.md) — shared concepts ·
[grid.md](grid.md) — grids ·
[form.md](form.md) — forms.

Русская версия: [../../ru/usage/tree.md](../../ru/usage/tree.md).
