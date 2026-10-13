# Справочник API — базовый

Публичные классы, функции и константы **django-jqxwidgets**, общие для всех
виджетов. Всё перечисленное импортируется из корня пакета, если не указано
иное:

```python
from jqxwidgets import Widget          # базовый класс всех виджетов
```

Справочники по виджетам: [grid](grid.md) ·
[tree](tree.md) · [form](form.md).

---

## `Widget`

*class* `jqxwidgets.widgets.Widget` — базовый класс, от которого наследуются
все виджеты (`Grid`, `Tree`, `Form`). Он владеет всем общим: разрешением
источника, слиянием опций, свойством `url` и рендером шаблонов. Обычно вы
наследуете его напрямую — используйте `Grid` / `Tree` / `Form`.

### Конструктор

```python
Widget(source=None, config=None, **options)
```

| Аргумент | Тип | Описание |
| --- | --- | --- |
| `source` | класс viewset'а / экземпляр viewset'а / `str` | эндпоинт данных; при отсутствии берётся атрибут класса |
| `config` | `dict \| None` | опции, сливаемые поверх атрибутов класса (парсится хуком `_extract_config()`) |
| `**options` | любые | любая jqx-опция; перебивает `config` и атрибуты класса |

Порядок слияния опций (побеждает последний): `options` класса → `config` →
`**options`.

### Атрибуты класса (переопределяйте в подклассе)

| Атрибут | По умолчанию | Описание |
| --- | --- | --- |
| `source` | `None` | источник по умолчанию для экземпляров |
| `options` | `{}` | jqx-опции по умолчанию |
| `template_name` | — | шаблон, рендеримый `__html__()`, например `jqxwidgets/grid.html` |
| `basename_attr` | `'grid_basename'` | атрибут viewset'а с basename'ом маршрута |
| `widget_name` | `'Grid'` | имя виджета в сообщениях об ошибках |

### Хуки (переопределяйте в подклассе)

| Хук | Описание |
| --- | --- |
| `_extract_config(config)` | разобрать `config` в обычный dict опций (базовый: требует `dict`) |
| `config_json()` | сериализовать конфигурацию для атрибута `config` элемента |
| `get_context()` | контекст шаблона; базовый возвращает `source`, `config` (JSON), `assets` |

### Члены

| Член | Описание |
| --- | --- |
| `source` | разрешённый источник (атрибут класса или аргумент конструктора) |
| `options` | слитый dict опций (после `options` класса / `config` / `**options`) |
| `url` *(property)* | разрешённый URL эндпоинта данных (выбрасывает `ImproperlyConfigured`, если источник разрешить нельзя) |
| `__html__()` | рендерит `template_name` с payload'ом из `get_context()` |
| `__str__()` | то же, что `__html__()` |

---

## Функции модулей

### `jqxwidgets.viewsets` (общие хелперы)

| Функция | Описание |
| --- | --- |
| `resolve_model(target)` | класс модели → класс; `"MyModel"` / `"app.Model"` → класс; выбрасывает `LookupError`, если не найдено или имя неоднозначно |
| `build_serializer(model)` | автосозданный подкласс `ModelSerializer` с `fields = '__all__'` |
| `default_filterset_fields(model)` | dict `filterset_fields` из полей модели (lookup'и зависят от типа) |
| `decode_json_param(value)` | url-safe Base64 → JSON-текст; обычный JSON (начинающийся с `{`/`[`) пропускается как есть (обратная совместимость); паддинг опционален |
| `source_url(source, basename_attr='grid_basename', widget='Grid')` | класс/экземпляр/строка viewset'а → URL; `basename_attr` выбирает атрибут маршрута (`'grid_basename'` для гридов, `'tree_basename'` для деревьев); выбрасывает `ImproperlyConfigured`, если не удалось сделать reverse |
| `default_label_field(model)` | автоподбираемое поле подписи: первое из `name`, `title`, `label`; `None`, если нет ни одного (используется `str(obj)`) |
| `CONDITION_MAP` | сопоставление `condition → ORM lookup` (см. [../usage/grid.md](../usage/grid.md) §5.2) |
| `FIELD_FILTERS` | типы полей → дополнительные lookup'и, используемые `default_filterset_fields` |

### `jqxwidgets.utils`

| Функция | Описание |
| --- | --- |
| `flatten_data_object(data, parent_key='', separator='__')` | рекурсивно сплющивает dict/list в строке ответа в ключи `a__b` и `a__b__0` |

### `jqxwidgets.assets`

| Функция | Описание |
| --- | --- |
| `assets_html()` | HTML-фрагмент: `<link>`-и таблиц стилей + инлайновый загрузчик, внедряющий бандл один раз на страницу; пустой список `js` → предупреждение в логе |

### `jqxwidgets.router` / `jqxwidgets.urls`

| Объект | Описание |
| --- | --- |
| `router` | `rest_framework.routers.SimpleRouter` уровня пакета, используемый всеми фабриками; basename'ы дедуплицируются между регистрациями `GridViewSet`, `TreeViewSet` и `FormViewSet` |
| `jqxwidgets.urls` | экспортирует `router.urls`; неймспейс приложения `jqxwidgets` (`reverse('jqxwidgets:<basename>-list')`) |

---

## Экспорты пакета

```python
import jqxwidgets
jqxwidgets.__version__   # '0.2.0'
jqxwidgets.Widget        # jqxwidgets.widgets.Widget (базовый класс)
jqxwidgets.Grid          # jqxwidgets.widgets.grid.Grid
jqxwidgets.GridConfig    # jqxwidgets.widgets.grid.GridConfig
jqxwidgets.GridViewSet   # jqxwidgets.viewsets.GridViewSet
jqxwidgets.Tree          # jqxwidgets.widgets.tree.Tree
jqxwidgets.TreeViewSet   # jqxwidgets.viewsets.TreeViewSet
jqxwidgets.Form          # jqxwidgets.widgets.form.Form
jqxwidgets.FormViewSet   # jqxwidgets.viewsets.FormViewSet
jqxwidgets.template_from_form  # jqxwidgets.widgets.form.template_from_form
```

## Исключения, выбрасываемые вызывающему коду

| Исключение | Где | Когда |
| --- | --- | --- |
| `ImproperlyConfigured` | `source_url()` / `Grid.url` / `Tree.url` / `Form.url` | нет `source`, или у viewset'а нет зарегистрированного URL |
| `LookupError` | `resolve_model()` | модель не найдена / неоднозначное имя |
| `TypeError` | `GridConfig.from_value()` / `Tree()` / `Form()` / `template_from_form()` | значение не `dict` и не `GridConfig` (для `Tree(config=…)` / `Form(config=…)` — не `dict`); в `template_from_form()` передано что-то, не являющееся классом/экземпляром Django-формы |
| `ImproperlyConfigured` | `template_from_form()` | поле формы, которое jqxForm не может отрисовать (файл, multi-select) — исключите его или передайте явный `template` |
| `ValueError` | `TreeViewSet.create()` | `parent_field` — не self-FK и не целочисленное поле, либо `label_field` не существует |
| `FieldError` | `apply_jqx_sorting()` | *перехватывается и логируется* — невалидное поле сортировки |

Битые query-параметры (`sorting`, `filterGroups`) никогда не всплывают: они
логируются (`logger.error`), а запрос всё равно возвращает `200`.

---

Далее: [../usage/base.md](../usage/base.md) — общие концепции ·
[grid.md](grid.md) · [tree.md](tree.md) ·
[form.md](form.md) — справочники по виджетам.

English version: [../../en/classes/base.md](../../en/classes/base.md).
