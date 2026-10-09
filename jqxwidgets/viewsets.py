import base64
import json
import logging

from django.apps import apps
from django.core.exceptions import FieldError, ImproperlyConfigured
from django.db import models
from django.db.models import Q
from django.urls import NoReverseMatch, reverse
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.settings import api_settings

from .config import build_grid_config
from .pagination import GridPagination
from .router import router
from .utils import flatten_data_object

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

FIELD_FILTERS = [
    ((models.IntegerField, models.DecimalField, models.DateTimeField, models.DateField),
     ['gt', 'gte', 'lt', 'lte']),
    ((models.CharField, models.TextField, models.SlugField, models.UUIDField),
     ['icontains', 'istartswith', 'iendswith', 'regex', 'iregex']),
]

logger = logging.getLogger(__name__)


def resolve_model(target):
    """Разрешить модель по классу или по имени (``"MyModel"`` / ``"app.MyModel"``)."""
    if isinstance(target, type) and issubclass(target, models.Model):
        return target
    if not isinstance(target, str):
        raise TypeError(f"Ожидается класс модели или её имя, получено: {target!r}")

    if '.' in target:
        try:
            return apps.get_model(target)
        except (LookupError, ValueError) as exc:
            raise LookupError(f"Модель '{target}' не найдена") from exc

    matches = [
        model for model in apps.get_models()
        if model.__name__.lower() == target.lower()
        or model._meta.model_name == target.lower()
    ]
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        names = ', '.join(f'{m._meta.app_label}.{m.__name__}' for m in matches)
        raise LookupError(f"Модель '{target}' неоднозначна: {names}. Используйте 'app_label.ModelName'")
    raise LookupError(f"Модель '{target}' не найдена")


def build_serializer(model):
    """Автоматически создать ModelSerializer для модели."""
    meta = type('Meta', (), {'model': model, 'fields': '__all__'})
    return type(f'{model.__name__}GridSerializer', (serializers.ModelSerializer,), {'Meta': meta})


def default_filterset_fields(model) -> dict:
    """Стандартный набор полей для DjangoFilterBackend (как в master_widgets)."""
    fields = {}
    for field in model._meta.fields:
        if field.primary_key or field.many_to_many or field.one_to_many:
            continue
        lookups = ['exact']
        for field_types, extra_lookups in FIELD_FILTERS:
            if isinstance(field, field_types):
                lookups = lookups + extra_lookups
                break
        fields[field.name] = lookups
    return fields


def decode_json_param(value: str) -> str:
    """Раскодировать JSON-параметр запроса (``filterGroups``, ``sorting``).

    Фронтенд кодирует JSON в url-safe Base64 (RFC 4648 §5), чтобы в
    query-строку не попадал открытый JSON. Открытый JSON (начинается с
    ``{``/``[``) также принимается — обратная совместимость.
    """
    raw = value.strip()
    if raw.startswith(('{', '[')):
        return raw
    # padding опционален (фронтенд отбрасывает '='), url-safe алфавит
    # декодируется как стандартный
    raw += '=' * (-len(raw) % 4)
    return base64.urlsafe_b64decode(raw).decode('utf-8')


def source_url(source) -> str:
    """Вернуть URL источника данных для ``Grid(source=...)``."""
    if isinstance(source, str):
        return source
    if source is None:
        raise ImproperlyConfigured(
            "Grid: не задан source. Передайте URL или класс, "
            "созданный через GridViewSet.create('ModelName')."
        )

    viewset = source if isinstance(source, type) else type(source)
    basename = getattr(viewset, 'grid_basename', None)
    if basename:
        for view_name in (f'jqxwidgets:{basename}-list', f'{basename}-list'):
            try:
                return reverse(view_name)
            except NoReverseMatch:
                continue
    raise ImproperlyConfigured(
        f"Grid: не удалось определить URL источника для {viewset.__name__}. "
        "Создайте его через GridViewSet.create() и подключите jqxwidgets.urls в URLconf "
        "(path('api/', include('jqxwidgets.urls')))."
    )


class GridViewSet(viewsets.ModelViewSet):
    """ViewSet для jqxGrid: список данных + авто-конфигурация колонок.

    Фабрика источников данных::

        ProductViewSet = GridViewSet.create("Product")
        my_grid = Grid(source=ProductViewSet)
    """
    pagination_class = GridPagination
    extra: dict | None = None

    # Реестр созданных viewset'ов: 'app_label.model_name' -> класс
    _registry: dict = {}
    _registered_basenames: set = set()

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
        resolved = resolve_model(model)
        registry_key = f'{resolved._meta.app_label}.{resolved._meta.model_name}'
        if registry_key in cls._registry:
            return cls._registry[registry_key]

        prefix = name or resolved._meta.model_name
        basename = resolved._meta.model_name
        if basename in cls._registered_basenames:
            basename = f'{resolved._meta.app_label}_{basename}'

        options = {
            'queryset': queryset if queryset is not None else resolved.objects.all(),
            'serializer_class': serializer_class if serializer_class is not None
            else build_serializer(resolved),
            'extra': extra,
            **attrs,
        }
        if 'filterset_fields' not in options:
            options['filterset_fields'] = default_filterset_fields(resolved)

        viewset = type(f'{resolved.__name__}GridViewSet', (cls,), options)
        viewset.grid_basename = basename
        viewset.grid_model = resolved

        router.register(prefix, viewset, basename=basename)
        cls._registry[registry_key] = viewset
        cls._registered_basenames.add(basename)
        return viewset

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
        if self.extra:
            config.update(self.extra)
        return Response(data=config)
