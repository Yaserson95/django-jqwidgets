# Деревья — `<jqx-tree>`

Лениво подгружаемое дерево на jqxTree. Узлы загружаются динамически из
REST-бэкенда:

* **корни** — запрашиваются при загрузке страницы (`GET <prefix>/`);
* **дети** — запрашиваются при раскрытии ветки (`?parent=<id>`);
* **ещё дети** — если на уровне больше узлов, чем помещается в один чанк,
  следующие чанки подгружаются, когда пользователь прокручивает список к низу
  (`?parent=<id>&offset=…&limit=…`).

## 1. Быстрый старт

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

Модели нужно self-FK-поле родителя (по умолчанию `parent`) и поле подписи
(подбирается автоматически: первое из `name`, `title`, `label`, `str`):

```python
class Node(models.Model):
    name = models.CharField(max_length=100)
    parent = models.ForeignKey('self', null=True, blank=True,
                               related_name='children', on_delete=models.CASCADE)
    priority = models.IntegerField(default=0)
```

---

## 2. Источники данных — `TreeViewSet.create()`

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

* Фабрика **кэширует по модели** и регистрирует viewset в том же роутере
  пакета, что и гриды (атрибут basename'а `tree_basename`).
* `parent_field` должен быть self-FK или целочисленным полем; фабрика
  валидирует это при создании.
* Порядок узлов определяется порядком queryset'а (добавьте `ordering` или
  передайте `queryset=Node.objects.order_by('priority')`).

---

## 3. HTTP-протокол (дерево ⇄ Django)

`GET <prefix>/` (корни) и `GET <prefix>/?parent=<id>` (дети) принимают:

| Параметр | Формат | Примечания |
| --- | --- | --- |
| `parent` | id узла | опущено → корни (`parent IS NULL`); неизвестный id → пустой `results` |
| `offset` | целое, по умолчанию `0` | смещение чанка |
| `limit` | целое | ограничивается `1 … max_chunk_size` (500) |

```json
{
  "count": 300,
  "results": [
    {"id": 322, "label": "Узел 322", "parentid": 321, "haschildren": true}
  ]
}
```

* `haschildren` вычисляется через подзапрос `Exists` — дерево показывает
  стрелку раскрытия до загрузки детей (компонент рендерит временный узел-заглушку,
  пока не придёт первый чанк).
* `count` — общее число детей — компонент использует его, чтобы понять, есть ли
  ещё чанки.

`GET <prefix>/config/`:

```json
{"pk": "id", "labelField": "name", "parentField": "parent", "chunkSize": 50}
```

`extra` viewset'а (если задан) сливается в этот ответ — передайте туда опции
jqxTree (`height`, `checkboxes`, …).

---

## 4. Опции jqxTree

Любую опцию jqxTree можно передать на экземпляр или задать на подклассе:

```python
class DepartmentTree(Tree):
    options = {'height': 500, 'checkboxes': True, 'width': 320}

tree = DepartmentTree(source=NodeSource)
```

---

## 5. Элемент `<jqx-tree>`

```html
<jqx-tree source="/api/node/" config='{"height":400}'></jqx-tree>
```

| Атрибут | Значение |
| --- | --- |
| `source` | URL эндпоинта дерева |
| `config` | JSON: опции jqxTree (плюс `extra` из viewset'а) |

Правила и гарантии:

* ассеты загружаются **один раз на страницу**, даже при нескольких виджетах
  (грид + дерево);
* подписи экранируются на клиенте (HTML-escape), id санитизируются;
* запросы чанков прекращаются, как только все дети загружены (достигнут
  `count`) — циклов запросов нет.

---

Далее: [../classes/tree.md](../classes/tree.md) — справочник API дерева ·
[base.md](base.md) — общие концепции ·
[grid.md](grid.md) — гриды ·
[form.md](form.md) — формы.

English version: [../../en/usage/tree.md](../../en/usage/tree.md).
