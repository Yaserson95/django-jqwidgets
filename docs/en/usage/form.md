# Forms — `<jqx-form>`

A record form (create / edit) with full CRUD against a Django REST endpoint.
The field template comes from the serializer, your own rows — or straight from
a Django `Form`/`ModelForm`.

## 1. Data source

```python
CATEGORY_FORM = FormViewSet.create('Category')   # -> /api/category-form/
```

Same factory as the grids: CRUD + `<source>config/` (template from the
serializer). Prefixes are deduplicated automatically, so a model that already
has a grid gets a `-form` suffix.

---

## 2. Standalone form

```python
def form_view(request):
    return render(request, 'form.html', {
        'form': Form(source=CATEGORY_FORM, id=request.GET.get('id')),
    })
```

```html
{{ form }}
```

`id` is `None` → create mode; with a value → the record is loaded for
editing. «Сохранить»/«Отмена» buttons are built in (`buttons=False` turns
them off).

---

## 3. Template from a Django form

Pass any `django.forms.Form` / `ModelForm` (class or instance) via `form=` —
the jqxForm template is generated from its fields:

```python
class ProductDjangoForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ('name', 'price', 'category', 'in_stock')

my_form = Form(source=PRODUCT_FORM, form=ProductDjangoForm)
```

* control type from the field class (`CharField → text`, `IntegerField →
  number`, `ChoiceField/ModelChoiceField → dropdownlist`, `BooleanField →
  boolean`, `DateField → date`, …; widgets `PasswordInput → password`,
  `RadioSelect → option`);
* `bind` = field name, label from `verbose_name` (ModelForms) plus
  `form.label_suffix` (default `:`), `required` flag, choices (including FK
  lists) as the dropdown `source`, `help_text` → `info`;
* files / multi-select raise `ImproperlyConfigured` — exclude them or pass an
  explicit `template`.

The generator is public: `from jqxwidgets import template_from_form` — build
the rows, adjust them, hand the list to `Form(template=rows)`.

---

## 4. Form from a widget

```js
const form = grid.getForm();          // new record
const form2 = grid.getForm(row.id);   // edit row
```

Returns a ready `<jqx-form>` element — place it yourself (window, side
panel). It saves through the same source; `saved`/`removed` events reload the
parent widget.

---

Next: [../classes/form.md](../classes/form.md) — the form API reference ·
[base.md](base.md) — shared concepts ·
[grid.md](grid.md) — grids ·
[tree.md](tree.md) — trees.

Русская версия: [../../ru/usage/form.md](../../ru/usage/form.md).
