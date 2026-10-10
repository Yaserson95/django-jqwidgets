from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.db import models
from django.db.models import Exists, OuterRef
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..utils import default_label_field
from .base import BaseViewSet

class TreeViewSet(BaseViewSet, viewsets.ViewSet):
    """REST-бэкенд для jqxTree: дети узла + чанки для подгрузки при прокрутке.

    Фабрика источников данных::

        NodeViewSet = TreeViewSet.create("Node")
        my_tree = Tree(source=NodeViewSet)

    Протокол:

    * ``GET <prefix>/`` — корневые узлы (``parent IS NULL``), первый чанк;
    * ``GET <prefix>/?parent=<id>`` — дочерние узлы, первый чанк;
    * ``GET <prefix>/?offset=&limit=`` — следующий чанк (подгрузка при
      прокрутке); ``limit`` ограничивается ``max_chunk_size``;
    * ``GET <prefix>/config/`` — конфигурация дерева (имена полей, chunkSize)
      плюс опции jqxTree из ``extra``.

    Ответ списка: ``{'count': <всего детей узла>, 'results': [items]}``, где
    элемент — ``{'id', 'label', 'parentid', 'haschildren'}`` (+ поля из
    ``extra_fields``). Формат элементов — jqxTree localdata (id/label/parentid),
    ``haschildren`` позволяет показать стрелку раскрытия ещё до загрузки детей
    (сам jqx такое не умеет — фронтенд подставляет заглушку).

    Общее с ``GridViewSet`` (реестр, basename'ы, роутинг, ``extra``) —
    в :class:`jqxwidgets.viewsets.base.BaseViewSet`.
    """

    # Атрибуты источника (задаются фабрикой create(); extra — из BaseViewSet)
    queryset = None
    label_field: str | None = None
    parent_field: str = 'parent'
    chunk_size: int = 50
    max_chunk_size: int = 500
    extra_fields: list = []
    ordering = None

    _kind = 'tree'

    # Значения параметра parent, означающие «корневой уровень»
    ROOT_PARENT_VALUES = ('', 'null', 'none')

    # ------------------------------------------------------------------
    # Фабрика
    # ------------------------------------------------------------------
    @classmethod
    def create(cls, model, name=None, *, queryset=None, label_field=None,
               parent_field='parent', chunk_size=50, max_chunk_size=500,
               extra_fields=None, extra=None, **attrs):
        """Создать и зарегистрировать viewset для иерархической модели.

        :param model: класс модели или её имя (``"MyModel"``, ``"app.MyModel"``);
        :param name: префикс URL (по умолчанию — имя модели);
        :param queryset: свой queryset (по умолчанию ``model.objects.all()``);
        :param label_field: поле подписи узла (по умолчанию автоподбор:
            ``label`` → ``name`` → ``title`` → первый ``CharField`` → ``str(obj)``);
        :param parent_field: поле-ссылка на родителя (FK на саму себя или
            целочисленное поле с pk родителя); по умолчанию ``'parent'``;
        :param chunk_size: размер чанка — сколько узлов отдаётся за один
            запрос (первая порция при раскрытии и каждая следующая при
            прокрутке);
        :param max_chunk_size: верхний кламп для ``limit`` из запроса;
        :param extra_fields: доп. поля модели, включаемые в каждый элемент;
        :param extra: дополнительные опции jqxTree для ``<source>config/``;
        :param attrs: дополнительные атрибуты класса viewset'а
            (``ordering``, ``permission_classes`` и т.п.);
        :return: класс viewset'а (можно передавать в ``Tree(source=...)``).
        """
        return super().create(
            model, name, queryset=queryset, extra=extra,
            label_field=label_field, parent_field=parent_field,
            chunk_size=chunk_size, max_chunk_size=max_chunk_size,
            extra_fields=extra_fields, **attrs,
        )

    @classmethod
    def _build_options(cls, model, *, queryset, extra, label_field=None,
                       parent_field='parent', chunk_size=50,
                       max_chunk_size=500, extra_fields=None, **attrs):
        """Валидация полей дерева + имена полей/параметры чанкинга."""
        try:
            parent = model._meta.get_field(parent_field)
        except Exception as exc:  # FieldDoesNotExist
            raise ImproperlyConfigured(
                f"TreeViewSet: у модели {model._meta.label} нет поля "
                f"'{parent_field}' (parent_field)."
            ) from exc
        if not isinstance(parent, (models.ForeignKey, models.IntegerField)):
            raise ImproperlyConfigured(
                f"TreeViewSet: поле '{parent_field}' модели {model._meta.label} "
                "должно быть ForeignKey или целочисленным (ссылка на родителя)."
            )

        if label_field is not None:
            model._meta.get_field(label_field)  # проверка имени поля

        options = super()._build_options(model, queryset=queryset, extra=extra, **attrs)
        options.update({
            'label_field': label_field or default_label_field(model),
            'parent_field': parent_field,
            'chunk_size': chunk_size,
            'max_chunk_size': max_chunk_size,
            'extra_fields': list(extra_fields or []),
        })
        return options

    # ------------------------------------------------------------------
    # Данные
    # ------------------------------------------------------------------
    def _lookup(self) -> str:
        """Lookup для поля родителя: ``parent__pk`` (FK) или ``parent`` (int)."""
        field = self.tree_model._meta.get_field(self.parent_field)
        return f'{self.parent_field}__pk' if isinstance(field, models.ForeignKey) \
            else self.parent_field

    def _pagination(self, request) -> tuple[int, int]:
        """offset/limit из запроса (клампы: offset ≥ 0, 1 ≤ limit ≤ max)."""
        try:
            offset = max(int(request.query_params.get('offset', 0)), 0)
        except (TypeError, ValueError):
            offset = 0
        try:
            limit = int(request.query_params.get('limit', self.chunk_size))
        except (TypeError, ValueError):
            limit = self.chunk_size
        return offset, min(max(limit, 1), self.max_chunk_size)

    def _item(self, obj, parent_id) -> dict:
        """Элемент jqxTree (localdata-формат) из объекта модели."""
        item = {
            'id': obj.pk,
            'label': str(getattr(obj, self.label_field)) if self.label_field else str(obj),
            'parentid': parent_id,
            'haschildren': bool(getattr(obj, 'jqx_haschildren', False)),
        }
        for field_name in self.extra_fields:
            item[field_name] = getattr(obj, field_name)
        return item

    def list(self, request, *args, **kwargs):
        """Узлы уровня: корни (без ``parent``) или дети ``?parent=<id>``."""
        qs = self.queryset
        if qs is None:
            raise ImproperlyConfigured(
                f"{type(self).__name__}: не задан queryset. "
                "Создавайте viewset через TreeViewSet.create('ModelName')."
            )
        qs = qs.all()
        model = qs.model

        parent_param = request.query_params.get('parent')
        parent_id = None
        if parent_param is None or parent_param.strip().lower() in self.ROOT_PARENT_VALUES:
            qs = qs.filter(**{f'{self.parent_field}__isnull': True})
        else:
            try:
                parent_id = model._meta.pk.to_python(parent_param)
            except (ValidationError, ValueError, TypeError):
                # Некорректный pk — пустой уровень, ответ остаётся 200.
                return Response({'count': 0, 'results': []})
            qs = qs.filter(**{self._lookup(): parent_id})

        if self.ordering:
            qs = qs.order_by(*self.ordering)

        # EXISTS-подзапрос: флаг haschildren есть у всех элементов уровня,
        # даже если их дети ещё не подгружены (стрелка раскрытия в jqxTree).
        children = model.objects.filter(**{self._lookup(): OuterRef('pk')})
        qs = qs.annotate(jqx_haschildren=Exists(children))

        count = qs.count()
        offset, limit = self._pagination(request)
        items = [self._item(obj, parent_id) for obj in qs[offset:offset + limit]]
        return Response({'count': count, 'results': items})

    # ------------------------------------------------------------------
    # Конфигурация
    # ------------------------------------------------------------------
    @action(url_path='config', url_name='tree_config', methods=['GET', 'OPTIONS'], detail=False)
    def tree_config(self, request, *args, **kwargs):
        """Конфигурация дерева: имена полей + размер чанка + опции jqxTree."""
        model = getattr(self, 'tree_model', None) or self.queryset.model
        config = {
            'pk': model._meta.pk.name,
            'labelField': self.label_field,
            'parentField': self.parent_field,
            'chunkSize': self.chunk_size,
        }
        return Response(data=self._apply_extra(config))