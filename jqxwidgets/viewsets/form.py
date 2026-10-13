from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..config import build_form_config
from ..utils import build_serializer, default_filterset_fields
from .base import BaseViewSet


class FormViewSet(BaseViewSet, viewsets.ModelViewSet):
    """REST-бэкенд для jqxForm: поля формы из сериализатора + CRUD записи.

    Фабрика источников данных::

        CategoryViewSet = FormViewSet.create("Category")
        my_form = Form(source=CategoryViewSet)

    Протокол:

    * ``GET <prefix>/config/`` — конфигурация формы: шаблон полей jqxForm
      (из сериализатора) + имя pk + опции из ``extra``;
    * ``GET <prefix>/<id>/`` — запись для редактирования;
    * ``POST <prefix>/`` — создать запись (``create_object``);
    * ``PUT/PATCH <prefix>/<id>/`` — обновить запись, ``DELETE`` — удалить.

    Форма работает и с другими источниками пакета: ``GridViewSet`` (поля
    выводятся из колонок конфигурации грида) и ``TreeViewSet`` (поле
    подписи узла) — см. фронтенд ``<jqx-form>``.

    Общее с ``GridViewSet``/``TreeViewSet`` (реестр, basename'ы, префиксы,
    роутинг, ``extra``, CRUD) — в
    :class:`jqxwidgets.viewsets.base.BaseViewSet`.
    """
    _kind = 'form'

    # ------------------------------------------------------------------
    # Фабрика
    # ------------------------------------------------------------------
    @classmethod
    def create(cls, model, name=None, *, queryset=None, serializer_class=None,
               extra=None, **attrs):
        """Создать и зарегистрировать viewset для модели.

        :param model: класс модели или её имя (``"MyModel"``, ``"app.MyModel"``);
        :param name: префикс URL (по умолчанию — имя модели);
        :param queryset: свой queryset (по умолчанию ``model.objects.all()``);
        :param serializer_class: свой сериализатор (по умолчанию — автосозданный);
        :param extra: дополнительные опции jqxForm для ``<source>config/``;
        :param attrs: дополнительные атрибуты класса viewset'а
            (``ordering``, ``permission_classes`` и т.п.);
        :return: класс viewset'а (можно передавать в ``Form(source=...)``).
        """
        return super().create(
            model, name, queryset=queryset, extra=extra,
            serializer_class=serializer_class, **attrs,
        )

    @classmethod
    def _build_options(cls, model, *, queryset, extra, **attrs):
        """Опции создаваемого класса: автосериализатор + фильтруемые поля."""
        options = super()._build_options(model, queryset=queryset, extra=extra, **attrs)
        if options.get('serializer_class') is None:
            options['serializer_class'] = build_serializer(model)
        if 'filterset_fields' not in options:
            options['filterset_fields'] = default_filterset_fields(model)
        return options

    # ------------------------------------------------------------------
    # Конфигурация
    # ------------------------------------------------------------------
    @action(url_path='config', url_name='form_config', methods=['GET', 'OPTIONS'], detail=False)
    def form_config(self, request, *args, **kwargs):
        """Конфигурация формы: шаблон полей jqxForm из сериализатора."""
        config = build_form_config(self.get_serializer())
        return Response(data=self._apply_extra(config))
