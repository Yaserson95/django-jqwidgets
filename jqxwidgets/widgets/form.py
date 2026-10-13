"""Виджет jqxForm — рендерится в шаблоне как ``{{ my_form }}``."""
import json

from django import forms
from django.core.exceptions import ImproperlyConfigured
from django.forms.utils import pretty_name
from django.utils.html import strip_tags

from .base import Widget

#: Класс Django-поля -> тип контрола jqxForm (None — jqxForm не поддерживает:
#: файлы и мультивыбор). Поиск по MRO: подкласс проверяется раньше родителя,
#: поэтому (например) ModelMultipleChoiceField перекрывает ModelChoiceField.
JQX_FORM_TYPES = {
    forms.ModelMultipleChoiceField: None,
    forms.MultipleChoiceField: None,
    forms.FileField: None,
    forms.ModelChoiceField: 'dropdownlist',
    forms.TypedChoiceField: 'dropdownlist',
    forms.ChoiceField: 'dropdownlist',
    forms.NullBooleanField: 'boolean',
    forms.BooleanField: 'boolean',
    forms.SplitDateTimeField: 'datetime',
    forms.DateTimeField: 'datetime',
    forms.DateField: 'date',
    forms.TimeField: 'time',
    forms.IntegerField: 'number',
    forms.FloatField: 'number',
    forms.DecimalField: 'number',
    forms.CharField: 'text',
}


def template_from_form(form) -> list[dict]:
    """Построить шаблон jqxForm из полей Django-формы.

    Принимает класс или инстанс ``django.forms.Form`` / ``ModelForm``
    и возвращает плоский массив строк jqxForm (FormTemplateItem):

    * тип контрола — по классу поля (CharField → text, IntegerField → number,
      ChoiceField/ModelChoiceField → dropdownlist, BooleanField → boolean,
      DateField → date, TimeField → time, DateTimeField → datetime;
      виджет PasswordInput → password, RadioSelect → option);
    * ``bind`` — имя поля (ключи ответа REST-источника);
    * подпись — ``label`` поля (для ModelForm он берётся из ``verbose_name``
      модели) плюс ``label_suffix`` формы (по умолчанию «:»);
    * ``required`` — только для обязательных полей;
    * ``source`` (dropdownlist) / ``options`` (radio) — choices поля в формате
      ``[{'value': …, 'label': …}]``, включая список FK (ModelChoiceField);
    * ``info`` — ``help_text`` без HTML-тегов.

    Поля, которые jqxForm не умеет (файлы, мультивыбор), поднимают
    ``ImproperlyConfigured``: исключите их из формы или задайте шаблон
    вручную через ``template=``.

    Шаблон можно доработать перед передачей в виджет::

        rows = template_from_form(BookForm)
        rows.append({'type': 'label', 'text': 'Справочно', 'bind': 'hint'})
        my_form = Form(source=BOOK_FORM, template=rows)
    """
    if isinstance(form, type):
        form = form()
    if not isinstance(form, forms.BaseForm):
        raise TypeError(
            "template_from_form ожидает Django-форму (класс или инстанс), "
            f"получено: {type(form)!r}")

    return [
        _field_row(form, field_name, field)
        for field_name, field in form.fields.items()
    ]


def _field_row(form, field_name: str, field) -> dict:
    """Строка шаблона jqxForm для одного поля Django-формы."""
    jtype = _field_type(form, field_name, field)

    label = field.label or pretty_name(field_name)
    suffix = getattr(form, 'label_suffix', ':') or ''
    row = {'type': jtype, 'label': f'{label}{suffix}', 'bind': field_name}
    if field.required:
        row['required'] = True
    if jtype == 'dropdownlist':
        row['source'] = _choice_items(field.choices)
    elif jtype == 'option':
        # dropdownlist читает source, radio — только options (см. jqxForm)
        row['options'] = _choice_items(field.choices)
    help_text = strip_tags(str(field.help_text or '')).strip()
    if help_text:
        row['info'] = help_text
    return row


def _field_type(form, field_name: str, field) -> str:
    """Тип контрола jqxForm для поля Django-формы."""
    for cls in type(field).__mro__:
        if cls not in JQX_FORM_TYPES:
            continue
        jtype = JQX_FORM_TYPES[cls]
        if jtype is None:
            raise ImproperlyConfigured(
                f"Форма {type(form).__name__}: поле '{field_name}' "
                f"({type(field).__name__}) не поддерживается jqxForm "
                f"(файлы и мультивыбор); исключите его из формы или задайте "
                f"шаблон вручную через template=.")
        break
    else:
        jtype = 'text'  # JSONField, UUIDField и прочие без явного маппинга

    widget = field.widget
    if isinstance(widget, forms.PasswordInput):
        return 'password'
    if getattr(widget, 'allow_multiple_selected', False):
        raise ImproperlyConfigured(
            f"Форма {type(form).__name__}: поле '{field_name}' — "
            f"{type(field).__name__} с мультивыбором "
            f"({type(widget).__name__}) не поддерживается jqxForm; "
            f"исключите его из формы или задайте шаблон вручную через "
            f"template=.")
    if isinstance(widget, forms.RadioSelect):
        return 'option'
    return jtype


def _choice_items(choices) -> list[dict]:
    """Choices Django -> элементы source/options jqx ``{'value', 'label'}``.

    Группы (optgroup) разворачиваются: подпункты получают подпись
    «Группа: пункт». Значения FK (ModelChoiceIteratorValue) разворачиваются
    до pk, чтобы в JSON уходил примитив, а не обёртка.
    """
    items = []
    for value, label in choices:
        if isinstance(label, (list, tuple)):  #optgroup: ('Группа', [(v, l), …])
            for sub_value, sub_label in label:
                items.append({
                    'value': getattr(sub_value, 'value', sub_value),
                    'label': f'{value}: {sub_label}',
                })
        else:
            items.append({
                'value': getattr(value, 'value', value),
                'label': str(label),
            })
    return items


class Form(Widget):
    """Виджет jqxForm (форма записи).

    Простой случай::

        my_form = Form(source=FormViewSet.create("Category"))

    В шаблоне::

        {{ my_form }}

    Редактирование существующей записи — передайте идентификатор::

        my_form = Form(source=CATEGORY_FORM, id=request.GET.get('id'))

    Шаблон полей из Django-формы (класс или инстанс ``django.forms.Form`` /
    ``ModelForm``)::

        class CategoryDjangoForm(forms.ModelForm):
            class Meta:
                model = Category
                fields = '__all__'

        my_form = Form(source=CATEGORY_FORM, form=CategoryDjangoForm)

    поля, подписи (с ``label_suffix``), обязательность, choices (включая FK)
    и подсказки ``help_text`` берутся из Django-формы (см.
    ``template_from_form``). Явный ``template`` (или ``config={'template': …}``)
    побеждает ``form``.

    Явные поля/опции (во вьюшке или в подклассе)::

        class ProductForm(Form):
            template = [
                {'type': 'text', 'label': 'Название:', 'bind': 'name'},
                {'type': 'number', 'label': 'Цена:', 'bind': 'price'},
            ]
            buttons = False   # не рендерить кнопки Сохранить/Отмена

    Форма работает с любым источником пакета, у которого есть CRUD и
    ``<source>config/``: ``FormViewSet`` (поля из сериализатора),
    ``GridViewSet`` (поля из колонок грида) и ``TreeViewSet`` (поле
    подписи узла).

    На фронтенте ту же форму можно получить из виджета:
    ``grid.getForm(id)`` возвращает элемент ``<jqx-form>`` — разместите
    его сами (jqxWindow, панель рядом с виджетом и т.п.).
    """
    template_name = 'jqxwidgets/form.html'
    basename_attr = 'form_basename'
    widget_name = 'Form'

    template: list | None = None
    buttons = True

    def __init__(self, source=None, id=None, template=None, buttons=None,
                 form=None, config=None, **options):
        if form is not None:
            if isinstance(form, type):
                form = form()
            if template is None:
                template = template_from_form(form)
        if template is None:
            template = type(self).template
        buttons_default = type(self).buttons

        if config is not None:
            # kind-поля формы (template/buttons) поглощаются здесь,
            # остаток уходит в базу как опции jqxForm.
            data = dict(self._extract_config(config))
            template = data.pop('template', template)
            if 'buttons' in data:
                buttons_default = data.pop('buttons')
            config = data

        super().__init__(source=source, config=config, **options)

        # Идентификатор редактируемой записи (None — создание новой)
        self.id = id
        # Django-форма, из которой построен шаблон (None — не передавалась)
        self.django_form = form
        self.template = list(template) if template is not None else None
        self.buttons = buttons_default if buttons is None else buttons

    def config_json(self) -> str:
        """Конфигурация формы: опции + шаблон полей + кнопки."""
        config = dict(self.options)
        if self.template is not None:
            config['template'] = self.template
        config['buttons'] = self.buttons
        return json.dumps(config, ensure_ascii=False, default=str)

    def get_context(self) -> dict:
        context = super().get_context()
        # '' — новая запись; record="" на фронтенде трактуется как её отсутствие
        context['record'] = '' if self.id is None else str(self.id)
        return context
