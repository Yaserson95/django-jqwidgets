# Формы — `<jqx-form>`

Форма записи (создание / редактирование) с полным CRUD против Django
REST-эндпоинта. Шаблон полей берётся из сериализатора, из ваших собственных
строк — или прямо из Django `Form`/`ModelForm`.

## 1. Источник данных

```python
CATEGORY_FORM = FormViewSet.create('Category')   # -> /api/category-form/
```

Та же фабрика, что и у гридов: CRUD + `<source>config/` (шаблон из
сериализатора). Префиксы дедуплицируются автоматически, поэтому модель,
у которой уже есть грид, получает суффикс `-form`.

---

## 2. Отдельная форма

```python
def form_view(request):
    return render(request, 'form.html', {
        'form': Form(source=CATEGORY_FORM, id=request.GET.get('id')),
    })
```

```html
{{ form }}
```

`id` равен `None` → режим создания; со значением → запись загружается на
редактирование. Кнопки «Сохранить»/«Отмена» встроены (`buttons=False` их
отключает).

---

## 3. Шаблон из Django-формы

Передайте любую `django.forms.Form` / `ModelForm` (класс или экземпляр) через
`form=` — шаблон jqxForm будет сгенерирован из её полей:

```python
class ProductDjangoForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ('name', 'price', 'category', 'in_stock')

my_form = Form(source=PRODUCT_FORM, form=ProductDjangoForm)
```

* тип контрола определяется классом поля (`CharField → text`, `IntegerField →
  number`, `ChoiceField/ModelChoiceField → dropdownlist`, `BooleanField →
  boolean`, `DateField → date`, …; виджеты `PasswordInput → password`,
  `RadioSelect → option`);
* `bind` = имя поля, заголовок из `verbose_name` (ModelForms) плюс
  `form.label_suffix` (по умолчанию `:`), флаг `required`, варианты choices
  (включая списки FK) как `source` у dropdown'а, `help_text` → `info`;
* файлы / multi-select выбрасывают `ImproperlyConfigured` — исключите их или
  передайте явный `template`.

Генератор публичный: `from jqxwidgets import template_from_form` — соберите
строки, поправьте их и передайте список в `Form(template=rows)`.

---

## 4. Форма из виджета

```js
const form = grid.getForm();          // новая запись
const form2 = grid.getForm(row.id);   // редактирование строки
```

Возвращает готовый элемент `<jqx-form>` — разместите его сами (окно, боковая
панель). Он сохраняет через тот же источник; события `saved`/`removed`
перезагружают родительский виджет.

---

Далее: [../classes/form.md](../classes/form.md) — справочник API формы ·
[base.md](base.md) — общие концепции ·
[grid.md](grid.md) — гриды ·
[tree.md](tree.md) — деревья.

English version: [../../en/usage/form.md](../../en/usage/form.md).
