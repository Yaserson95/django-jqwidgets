# API reference — form

Public form classes of **django-jqxwidgets**:

```python
from jqxwidgets import Form, FormViewSet, template_from_form
```

Base class, shared helpers and package exports:
[base.md](base.md).

---

## `Form`

*class* `jqxwidgets.widgets.form.Form` — the form widget (record
create/edit). Renders as `{{ form }}`.

### Constructor

```python
Form(source=None, id=None, template=None, buttons=None, form=None, config=None, **options)
```

| Argument | Type | Description |
| --- | --- | --- |
| `source` | viewset class / viewset instance / `str` | data endpoint with CRUD + `<source>config/` (usually `FormViewSet`) |
| `id` | any / `None` | record identifier to edit (`None` — new record) |
| `template` | `list[dict]` / `None` | explicit jqxForm template rows; wins over `form` |
| `buttons` | `bool` / `None` | render «Сохранить»/«Отмена» buttons (default `True`) |
| `form` | Django form class or instance / `None` | template rows are built from the Django form's fields (see `template_from_form`) |
| `config` | `dict` / `None` | kind keys `template`/`buttons` are absorbed; the rest become jqx options |
| `**options` | any | any jqxForm option (`width`, `padding` …) |

Template precedence (later wins): class `template` attribute → `form` →
explicit `template` argument → `config={'template': …}`.

```python
class CategoryDjangoForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = '__all__'

my_form = Form(source=CATEGORY_FORM, form=CategoryDjangoForm,
               id=request.GET.get('id'))
```

### Class attributes (override them in a subclass)

| Attribute | Default | Description |
| --- | --- | --- |
| `template` | `None` | default template rows |
| `buttons` | `True` | render save/cancel buttons |

### Members

| Member | Description |
| --- | --- |
| `id` | the record identifier (`None` — new record) |
| `django_form` | the resolved Django form instance passed via `form=` (`None` if not given) |
| `template` | the resolved template rows (list of dicts) |
| `buttons` | whether save/cancel buttons are rendered |
| `url` *(property)* | resolved URL of the form endpoint (raises `ImproperlyConfigured` when the source cannot be resolved) |
| `__html__()` | renders `jqxwidgets/form.html` with `source`, `record`, `config` (JSON), `assets` |
| `__str__()` | same as `__html__()` |

---

## `FormViewSet`

*class* `jqxwidgets.viewsets.FormViewSet` — the CRUD backend for forms: a
`ModelViewSet` plus a `<prefix>/config/` action returning the template rows
built from the serializer. Normally you never subclass it by hand: use the
factory.

### `FormViewSet.create(model, name=None, *, queryset=None, serializer_class=None, extra=None, **attrs)` → `type`

| Argument | Description |
| --- | --- |
| `model` | model class, `"MyModel"` or `"app_label.MyModel"` |
| `name` | URL prefix; defaults to the model name with a `-form` suffix when a grid already owns the bare name |
| `queryset` | custom queryset (default `model.objects.all()`) |
| `serializer_class` | custom `ModelSerializer` (default: auto-generated with `fields = '__all__'`) |
| `extra` | dict merged into the `<prefix>/config/` response |
| `**attrs` | any DRF ViewSet attribute: `permission_classes`, `filterset_fields`, … |

Behaviour: cached per model, registered in the package router with the same
basename deduplication as the grid and tree factories; GET/POST/PUT/PATCH/DELETE
come from `ModelViewSet`.

### `GET <prefix>/config/` response

Template rows for the form, one per serializer field (`{type, bind, label,
required, source, info}`, …) — the same shape the `template` argument of
`Form` expects.

---

## `template_from_form(form)` → `list[dict]`

*Also* `jqxwidgets.template_from_form` — builds jqxForm template rows from a
Django form (class or instance of `django.forms.Form` / `ModelForm`):

| Row key | Source |
| --- | --- |
| `type` | control type from the field class: `CharField` → `text`, `IntegerField`/`FloatField`/`DecimalField` → `number`, `ChoiceField`/`ModelChoiceField` → `dropdownlist`, `BooleanField` → `boolean`, `DateField` → `date`, `TimeField` → `time`, `DateTimeField` → `datetime`; widgets `PasswordInput` → `password`, `RadioSelect` → `option` |
| `bind` | field name (REST record keys) |
| `label` | field label (ModelForms take `verbose_name`) + `form.label_suffix` (default `:`) |
| `required` | present for required fields |
| `source` / `options` | choices as `[{'value': …, 'label': …}]` (dropdownlist uses `source`, radio uses `options`); FK lists come from the queryset; optgroups are flattened with a «Group: item» prefix |
| `info` | `help_text` with HTML stripped |

Fields jqxForm cannot render (files, multi-select) raise
`ImproperlyConfigured` — exclude them from the form or pass an explicit
`template`. The generated list can be post-processed before handing it to
the widget (`rows = template_from_form(Form); rows.append(...)`).

---

Next: [../usage/form.md](../usage/form.md) — the form guide ·
[base.md](base.md) — base reference ·
[grid.md](grid.md) · [tree.md](tree.md).

Русская версия: [../../ru/classes/form.md](../../ru/classes/form.md).
