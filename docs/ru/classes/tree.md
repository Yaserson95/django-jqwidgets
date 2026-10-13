# Справочник API — дерево

Публичные классы дерева **django-jqxwidgets**:

```python
from jqxwidgets import Tree, TreeViewSet
```

Базовый класс, общие хелперы и экспорты пакета:
[base.md](base.md).

---

## `Tree`

*class* `jqxwidgets.widgets.tree.Tree` — виджет дерева с ленивой загрузкой.
Рендерится как `{{ tree }}`.

### Конструктор

```python
Tree(source=None, config=None, **options)
```

| Аргумент | Тип | Описание |
| --- | --- | --- |
| `source` | класс viewset'а / экземпляр viewset'а / `str` | эндпоинт данных; строки используются как есть, viewset'ы разрешаются в URL |
| `config` | `dict \| None` | опции jqxTree, сливаемые поверх атрибутов класса |
| `**options` | любые | любая опция jqxTree (`height`, `checkboxes`, `width`, …); перебивает `config` и атрибуты класса |

### Атрибуты класса (переопределяйте в подклассе)

| Атрибут | По умолчанию | Описание |
| --- | --- | --- |
| `source` | `None` | источник по умолчанию для экземпляров |
| `options` | `{}` | опции jqxTree по умолчанию |

```python
class DepartmentTree(Tree):
    options = {'height': 500, 'checkboxes': True}
```

### Члены

| Член | Описание |
| --- | --- |
| `url` *(property)* | разрешённый URL эндпоинта дерева (выбрасывает `ImproperlyConfigured`, если источник разрешить нельзя) |
| `config` | итоговый dict опций (после слияния) |
| `__html__()` | рендерит `jqxwidgets/tree.html` с `source`, `config` (JSON), `assets` (стили + загрузчик) |
| `__str__()` | то же, что `__html__()` |

---

## `TreeViewSet`

*class* `jqxwidgets.viewsets.TreeViewSet(rest_framework.viewsets.ViewSet)` —
дата-бэкенд дерева (корни + ленивые дети + чанковая загрузка). Используйте
фабрику.

### `TreeViewSet.create(model, name=None, *, queryset=None, label_field=None, parent_field='parent', chunk_size=50, max_chunk_size=500, extra=None, **attrs)` → `type`

| Аргумент | Описание |
| --- | --- |
| `model` | класс модели, `"MyModel"` или `"app_label.MyModel"` |
| `name` | префикс URL; по умолчанию — имя модели (в нижнем регистре) |
| `queryset` | свой queryset (по умолчанию `model.objects.all()`); его порядок задаёт порядок узлов |
| `label_field` | поле подписи узла; по умолчанию — автоподбор (`name` / `title` / `label` / `str(obj)`) |
| `parent_field` | self-FK (или целочисленное) поле, указывающее на родителя; валидируется при создании |
| `chunk_size` | сколько узлов возвращается за запрос по умолчанию (`50`) |
| `max_chunk_size` | верхний кламп для клиентского `limit` (`500`) |
| `extra` | dict, сливаемый в ответ `<prefix>/config/` (любая опция jqxTree) |
| `**attrs` | любой атрибут ViewSet'а: `permission_classes`, `authentication_classes`, … |

Поведение:

* **кэшируется по модели**, регистрируется в роутере пакета (атрибут basename'а
  `tree_basename`);
* дедупликация basename'а общая с `GridViewSet.create()`;
* `haschildren` вычисляется подзапросом `Exists` (без дополнительных запросов).

### Члены экземпляра

| Член | Описание |
| --- | --- |
| `label_field` / `parent_field` / `chunk_size` / `max_chunk_size` | конфигурация уровня класса (см. выше) |
| `list(request, …)` | `GET <prefix>/` (корни) / `?parent=<id>` (дети) / `?offset=&limit=` (чанки) → `{count, results}` с `{id, label, parentid, haschildren}` |
| `tree_config` *(action)* | `GET <prefix>/config/` → `{pk, labelField, parentField, chunkSize}` + `extra` |

Битые `offset`/`limit` откатываются к значениям по умолчанию; неизвестный
`parent` возвращает `200` с пустым списком `results`.

---

Далее: [../usage/tree.md](../usage/tree.md) — руководство по дереву ·
[base.md](base.md) — базовый справочник ·
[grid.md](grid.md) · [form.md](form.md).

English version: [../../en/classes/tree.md](../../en/classes/tree.md).
