# Справочник API — грид

Публичные классы и функции грида **django-jqxwidgets**:

```python
from jqxwidgets import Grid, GridViewSet, GridConfig
```

Базовый класс, общие хелперы и экспорты пакета:
[base.md](base.md).

---

## `Grid`

*class* `jqxwidgets.widgets.grid.Grid` — шаблонный виджет. Рендерится как
`{{ grid }}` (реализует `__html__`, поэтому корректно автоэкранируется).

### Конструктор

```python
Grid(source=None, columns=None, columnsgroups=None, config=None, **options)
```

| Аргумент | Тип | Описание |
| --- | --- | --- |
| `source` | класс viewset'а / экземпляр viewset'а / `str` | эндпоинт данных; строки используются как есть, viewset'ы разрешаются в URL |
| `columns` | `list[dict] \| None` | явные колонки (config- или нативный jqx-синтаксис) |
| `columnsgroups` | `list[dict] \| None` | группы колонок jqxGrid `{'text', 'name', 'align'}` |
| `config` | `GridConfig \| dict \| None` | объединённая конфигурация; сливается поверх атрибутов класса |
| `**options` | любые | любая опция jqxGrid (`pagesize`, `showfilterrow`, `height`, …); перебивает `config` и атрибуты класса |

### Атрибуты класса (переопределяйте в подклассе)

| Атрибут | По умолчанию | Описание |
| --- | --- | --- |
| `source` | `None` | источник по умолчанию для экземпляров |
| `columns` | `None` | колонки по умолчанию |
| `columnsgroups` | `None` | группы по умолчанию |
| `options` | `{}` | опции jqxGrid по умолчанию |

```python
class ProductGrid(Grid):
    columns = [{'text': 'Название', 'datafield': 'name', 'width': 300}]
    options = {'pagesize': 25, 'showfilterrow': True}
```

### Члены

| Член | Описание |
| --- | --- |
| `url` *(property)* | разрешённый URL эндпоинта данных (выбрасывает `ImproperlyConfigured`, если источник разрешить нельзя) |
| `config` | итоговый экземпляр `GridConfig` (после слияния) |
| `__html__()` | рендерит `jqxwidgets/grid.html` с `source`, `config` (JSON), `assets` (стили + загрузчик) |
| `__str__()` | то же, что `__html__()` |

---

## `GridConfig`

*class* `jqxwidgets.widgets.grid.GridConfig` — сериализуемый контейнер для
колонок, групп и опций.

```python
GridConfig(columns=None, columnsgroups=None, **options)
```

| Член | Описание |
| --- | --- |
| `columns` | список dict'ов колонок или `None` |
| `columnsgroups` | список dict'ов групп или `None` |
| `options` | dict опций jqxGrid |
| `from_value(value, **kwargs)` *(classmethod)* | построить из `dict`, `GridConfig` или `None`; `kwargs` перебивают значение |
| `as_dict()` | обычный `dict` (опции + `columns` + `columnsgroups`) |
| `to_json()` | JSON-строка (`ensure_ascii=False`, не-JSON значения приводятся к строке) |

---

## `GridViewSet`

*class* `jqxwidgets.viewsets.GridViewSet(rest_framework.viewsets.ModelViewSet)` —
дата-бэкенд. Обычно вы никогда не наследуете его вручную: используйте фабрику.

### `GridViewSet.create(model, name=None, *, queryset=None, serializer_class=None, extra=None, **attrs)` → `type`

| Аргумент | Описание |
| --- | --- |
| `model` | класс модели, `"MyModel"` или `"app_label.MyModel"` |
| `name` | префикс URL; по умолчанию — имя модели (в нижнем регистре) |
| `queryset` | свой queryset (по умолчанию `model.objects.all()`) |
| `serializer_class` | свой `ModelSerializer` (по умолчанию — автосозданный с `fields = '__all__'`) |
| `extra` | dict, сливаемый в ответ `<prefix>/config/` (любая опция jqxGrid) |
| `**attrs` | любой атрибут DRF-ViewSet'а: `search_fields`, `ordering`, `filter_backends`, `filterset_fields`, `permission_classes`, … |

Поведение:

* **кэшируется по модели** — второй `create()` для той же модели возвращает
  уже зарегистрированный класс;
* дедупликация basename'а — когда две модели делят имя, вторая получает
  префикс `app_label_`;
* регистрирует viewset в роутере пакета (виден под `include('jqxwidgets.urls')`);
* `filterset_fields` генерируется автоматически, если не передан;
* возвращаемый класс несёт `grid_basename` и `grid_model`.

### Члены экземпляра/класса

| Член | Описание |
| --- | --- |
| `pagination_class = GridPagination` | пагинация `pagenum`/`pagesize` (страницы с нуля) |
| `extra` | по умолчанию `None`; дополнения для config-эндпоинта |
| `filter_queryset(qs)` | бэкенды DRF, затем `apply_jqx_filters()`, затем `apply_jqx_sorting()` (только для действия `list`) |
| `apply_jqx_filters(qs)` | применяет `filterGroups`; логирует и игнорирует битый ввод |
| `apply_jqx_sorting(qs)` | применяет `sorting`; невалидные поля/битые payload'ы логируются и игнорируются |
| `list(request, …)` | возвращает `{count, results}` с плоскими ключами `a__b` для вложенных объектов |
| `grid_config` *(action)* | `GET <prefix>/config/` → конфигурация колонок (см. ниже) |

### Ответ `GET <prefix>/config/`

Строится `build_grid_config()` плюс `extra` viewset'а:

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

(`hidden: true` здесь приходит из `Meta.grid_config`; `editable: false` — потому
что поле read-only в сериализаторе. `pagesize` зеркалит
`GridPagination.max_page_size`, откатываясь на `REST_FRAMEWORK['PAGE_SIZE']`.)

Необязательные ключи: `columnsgroups` (из `Meta.grid_columnsgroups`).

---

## `GridPagination`

*class* `jqxwidgets.pagination.GridPagination(rest_framework.pagination.PageNumberPagination)`

| Атрибут | Значение | Смысл |
| --- | --- | --- |
| `page_query_param` | `'pagenum'` | индекс страницы **с нуля** (`0` = первая страница) |
| `page_size_query_param` | `'pagesize'` | размер страницы от клиента |
| `max_page_size` | `50` | верхний кламп для `pagesize` |
| `get_page_number()` | переопределён | отображает `pagenum=0 → 1`, нечисловое → первая страница, `last` → последняя страница |

Размер страницы по умолчанию берётся из `REST_FRAMEWORK['PAGE_SIZE']`.

---

## Функции модуля — `jqxwidgets.config`

| Функция | Описание |
| --- | --- |
| `build_grid_config(serializer, pagesize=None)` | полный dict конфигурации: `columns`, опциональный `pagesize`, `pk`, `columnsgroups` |
| `flatten_serializer_fields(serializer, prefix='')` | вложенные сериализаторы → плоская карта полей `parent__child` |
| `get_filter_type(field)` | поле сериализатора → jqx-виджет фильтра (`checkbox`/`date`/`number`/`list`/`text`) |
| `TYPE_MAPPINGS` | имя класса поля DRF → jqx `dataType` |
| `DATE_FORMATS` | `DateTimeField → 'dd.MM.yyyy HH:mm'`, `DateField → 'dd.MM.yyyy'` |

Хуки `Meta` сериализатора, читаемые `build_grid_config`:

| Атрибут `Meta` | Смысл |
| --- | --- |
| `grid_config` | переопределения по полям, например `{'price': {'width': '15%', 'format': 'c2'}}` |
| `grid_columnsgroups` | список групп колонок |

---

Далее: [../usage/grid.md](../usage/grid.md) — руководство по гриду ·
[base.md](base.md) — базовый справочник ·
[tree.md](tree.md) · [form.md](form.md).

English version: [../../en/classes/grid.md](../../en/classes/grid.md).
