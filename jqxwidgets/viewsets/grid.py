import json
import logging

from django.core.exceptions import FieldError
from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.settings import api_settings

from ..config import build_grid_config
from ..pagination import GridPagination
from ..utils import flatten_data_object, default_filterset_fields, decode_json_param, build_serializer
from .base import BaseViewSet

CONDITION_MAP = {
    'CONTAINS': '__icontains',
    'DOES_NOT_CONTAIN': '__icontains',
    'EQUAL': '__exact',
    'NOT_EQUAL': '__exact',
    'GREATER_THAN': '__gt',
    'LESS_THAN': '__lt',
    'GREATER_THAN_OR_EQUAL': '__gte',
    'LESS_THAN_OR_EQUAL': '__lte',
    'STARTS_WITH': '__istartswith',
    'ENDS_WITH': '__iendswith',
    'NULL': '__isnull',
    'NOT_NULL': '__isnull',
}

logger = logging.getLogger(__name__)

class GridViewSet(BaseViewSet, viewsets.ModelViewSet):
    """ViewSet для jqxGrid: список данных + авто-конфигурация колонок.

    Фабрика источников данных::

        ProductViewSet = GridViewSet.create("Product")
        my_grid = Grid(source=ProductViewSet)

    Общее с ``TreeViewSet`` (реестр, basename'ы, роутинг, ``extra``) —
    в :class:`jqxwidgets.viewsets.base.BaseViewSet`.
    """
    _kind = 'grid'
    pagination_class = GridPagination

    class Meta:
        abstract = True

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
        :param extra: дополнительные опции jqxGrid для ``<source>config/``;
        :param attrs: дополнительные атрибуты класса viewset'а
            (``ordering``, ``search_fields``, ``filter_backends`` и т.п.);
        :return: класс viewset'а (можно передавать в ``Grid(source=...)``).
        """
        return super().create(
            model, name, queryset=queryset, extra=extra,
            serializer_class=serializer_class, **attrs,
        )

    @classmethod
    def _build_options(cls, model, *, queryset, extra, **attrs):
        """Опции создаваемого класса: автосериализатор и фильтруемые поля."""
        options = super()._build_options(model, queryset=queryset, extra=extra, **attrs)
        if options.get('serializer_class') is None:
            options['serializer_class'] = build_serializer(model)
        if 'filterset_fields' not in options:
            options['filterset_fields'] = default_filterset_fields(model)
        return options

    # ------------------------------------------------------------------
    # Данные
    # ------------------------------------------------------------------
    def filter_queryset(self, qs):
        qs = super().filter_queryset(qs)
        if self.action == 'list':
            qs = self.apply_jqx_filters(qs)
            qs = self.apply_jqx_sorting(qs)
        return qs

    def apply_jqx_filters(self, queryset):
        filter_groups = self.request.GET.get('filterGroups')
        if not filter_groups:
            return queryset

        try:
            filter_groups = json.loads(decode_json_param(filter_groups))
            q_objects = Q()

            for group in filter_groups:
                field = group.get('field')
                filters = group.get('filters')
                q_group = Q()
                # Пропускаем невалидные группы
                if field is None or filters is None:
                    continue

                for flt in filters:
                    condition = flt.get('condition')
                    val = flt.get('value')
                    operator = str(flt.get('operator', 'and')).lower()
                    # Пропускаем невалидные фильтры
                    if condition is None:
                        continue

                    if condition in ['NULL', 'NOT_NULL']:
                        val = True
                    elif val is None:
                        # Фильтр без значения: EQUAL трактуем как проверку на
                        # NULL, остальные условия без значения пропускаем.
                        if condition == 'EQUAL':
                            condition = 'NULL'
                            val = True
                        else:
                            continue

                    lookup = CONDITION_MAP.get(condition, '__exact')
                    q_obj = Q(**{f"{field}{lookup}": val})

                    # Инвертируем условие для NOT-фильтров
                    if condition in ['DOES_NOT_CONTAIN', 'NOT_EQUAL']:
                        q_obj = ~q_obj

                    if operator == 'or':
                        q_group |= q_obj
                    else:
                        q_group &= q_obj

                q_objects &= q_group
            queryset = queryset.filter(q_objects)
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
            logger.error(f"FilterGroups parsing error: {e}")
        return queryset

    def apply_jqx_sorting(self, queryset):
        sorting = self.request.GET.get('sorting')
        if not sorting:
            return queryset

        try:
            sorting = json.loads(decode_json_param(sorting))
            order_by = []
            for sort_item in sorting:
                field_name = sort_item[0]
                if not field_name:
                    continue
                if not bool(sort_item[1]):
                    field_name = '-' + field_name
                order_by.append(field_name)

            if order_by:
                queryset = queryset.order_by(*order_by)
        except FieldError as e:
            logger.error(f"Некорректное поле для сортировки: {e}")
        # ValueError покрывает JSONDecodeError и ошибки base64
        # (binascii.Error, UnicodeEncodeError/DecodeError): битый параметр
        # игнорируется, ответ остаётся 200 без сортировки.
        except (ValueError, IndexError, TypeError, KeyError) as e:
            logger.error(f"Ошибка парсинга сортировки: {e}")

        return queryset

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        # Разворачиваем вложенные данные для jqxGrid (category__name и т.п.)
        response.data['results'] = [
            flatten_data_object(item) for item in response.data['results']
        ]
        return response

    # ------------------------------------------------------------------
    # Конфигурация колонок
    # ------------------------------------------------------------------
    @action(url_path='config', url_name='grid_config', methods=['GET', 'OPTIONS'], detail=False)
    def grid_config(self, request, *args, **kwargs):
        """Конфигурация грида: колонки из сериализатора/модели + опции."""
        pagesize = None
        paginator = self.paginator
        if paginator is not None:
            pagesize = getattr(paginator, 'max_page_size', None) or getattr(paginator, 'page_size', None)
        if pagesize is None:
            pagesize = api_settings.PAGE_SIZE

        config = build_grid_config(self.get_serializer(), pagesize=pagesize)
        return Response(data=self._apply_extra(config))

