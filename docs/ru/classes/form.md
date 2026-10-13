# Справочник API — форма

Публичные классы формы **django-jqxwidgets**:

```python
from jqxwidgets import Form, FormViewSet, template_from_form
```

Базовый класс, общие хелперы и экспорты пакета:
[base.md](base.md).

---

## `Form`

*class* `jqxwidgets.widgets.form.Form` — виджет формы (создание/редактирование
записи). Рендерится как `{{ form }}`.

### Конструктор

```python
Form(source=None, id=None, template=None, buttons=None, form=None, config=None, **options)
```

| Аргумент | Тип | Описание |
| --- | --- | --- |
| `source` | класс viewset'а / экземпляр viewset'а / `str` | эндпоинт данных с CRUD + `<source>config/` (обычно `FormViewSet`) |
| `id` | любой / `None` | идентификатор записи для редактирования (`None` — новая запись) |
| `template` | `list[dict]` / `None` | явные строки шаблона jqxForm; перебивает `form` |
| `buttons` | `bool` / `None` | рендерить кнопки «Сохранить»/«Отмена» (по умолчанию `True`) |
| `form` | класс или экземпляр Django-формы / `None` | строки шаблона строятся из полей Django-формы (см. `template_from_form`) |
| `config` | `dict` / `None` | ключи `template`/`buttons` поглощаются; остальное становится jqx-опциями |
| `**options` | любые | любая опция jqxForm (`width`, `padding` …) |

Приоритет шаблона (побеждает последний): атрибут класса `template` → `form` →
явный аргумент `template` → `config={'template': …}`.

```python
class CategoryDjangoForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = '__all__'

my_form = Form(source=CATEGORY_FORM, form=CategoryDjangoForm,
               id=request.GET.get('id'))
```

### Атрибуты класса (переопределяйте в подклассе)

| Атрибут | По умолчанию | Описание |
| --- | --- | --- |
| `template` | `None` | строки шаблона по умолчанию |
| `buttons` | `True` | рендерить кнопки сохранения/отмены |

### Члены

| Член | Описание |
| --- | --- |
| `id` | идентификатор записи (`None` — новая запись) |
| `django_form` | разрешённый экземпляр Django-формы, переданный через `form=` (`None`, если не передан) |
| `template` | разрешённые строки шаблона (список dict'ов) |
| `buttons` | рендерятся ли кнопки сохранения/отмены |
| `url` *(property)* | разрешённый URL эндпоинта формы (выбрасывает `ImproperlyConfigured`, если источник разрешить нельзя) |
| `__html__()` | рендерит `jqxwidgets/form.html` с `source`, `record`, `config` (JSON), `assets` |
| `__str__()` | то же, что `__html__()` |

---

## `FormViewSet`

*class* `jqxwidgets.viewsets.FormViewSet` — CRUD-бэкенд для форм:
`ModelViewSet` плюс действие `<prefix>/config/`, возвращающее строки шаблона,
построенные из сериализатора. Обычно вы не наследуете его вручную:
используйте фабрику.

### `FormViewSet.create(model, name=None, *, queryset=None, serializer_class=None, extra=None, **attrs)` → `type`

| Аргумент | Описание |
| --- | --- |
| `model` | класс модели, `"MyModel"` или `"app_label.MyModel"` |
| `name` | префикс URL; по умолчанию — имя модели с суффиксом `-form`, если голое имя уже занято гридом |
| `queryset` | свой queryset (по умолчанию `model.objects.all()`) |
| `serializer_class` | свой `ModelSerializer` (по умолчанию — автосозданный с `fields = '__all__'`) |
| `extra` | dict, сливаемый в ответ `<prefix>/config/` |
| `**attrs` | любой атрибут DRF-ViewSet'а: `permission_classes`, `filterset_fields`, … |

Поведение: кэшируется по модели, регистрируется в роутере пакета с той же
дедупликацией basename'ов, что и фабрики грида и дерева; GET/POST/PUT/PATCH/DELETE
приходят от `ModelViewSet`.

### Ответ `GET <prefix>/config/`

Строки шаблона формы — по одной на поле сериализатора (`{type, bind, label,
required, source, info}`, …) — та же форма, которую ожидает аргумент `template`
у `Form`.

---

## `template_from_form(form)` → `list[dict]`

*Также* `jqxwidgets.template_from_form` — строит строки шаблона jqxForm из
Django-формы (класса или экземпляра `django.forms.Form` / `ModelForm`):

| Ключ строки | Источник |
| --- | --- |
| `type` | тип контрола из класса поля: `CharField` → `text`, `IntegerField`/`FloatField`/`DecimalField` → `number`, `ChoiceField`/`ModelChoiceField` → `dropdownlist`, `BooleanField` → `boolean`, `DateField` → `date`, `TimeField` → `time`, `DateTimeField` → `datetime`; виджеты `PasswordInput` → `password`, `RadioSelect` → `option` |
| `bind` | имя поля (ключи записи REST) |
| `label` | заголовок поля (ModelForms берут `verbose_name`) + `form.label_suffix` (по умолчанию `:`) |
| `required` | присутствует для обязательных полей |
| `source` / `options` | варианты как `[{'value': …, 'label': …}]` (dropdownlist использует `source`, radio — `options`); списки FK приходят из queryset'а; optgroup'ы сплющиваются с префиксом «Группа: элемент» |
| `info` | `help_text` с очищенным HTML |

Поля, которые jqxForm не может отрисовать (файлы, multi-select), выбрасывают
`ImproperlyConfigured` — исключите их из формы или передайте явный `template`.
Сгенерированный список можно постобработать перед передачей виджету
(`rows = template_from_form(Form); rows.append(...)`).

---

Далее: [../usage/form.md](../usage/form.md) — руководство по форме ·
[base.md](base.md) — базовый справочник ·
[grid.md](grid.md) · [tree.md](tree.md).

English version: [../../en/classes/form.md](../../en/classes/form.md).
