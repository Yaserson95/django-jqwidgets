import base64
from django.apps import apps
from django.db import models
from rest_framework import serializers
from django.urls import NoReverseMatch, reverse
from django.core.exceptions import ImproperlyConfigured

FIELD_FILTERS = [
    ((models.IntegerField, models.DecimalField, models.DateTimeField, models.DateField),
     ['gt', 'gte', 'lt', 'lte']),
    ((models.CharField, models.TextField, models.SlugField, models.UUIDField),
     ['icontains', 'istartswith', 'iendswith', 'regex', 'iregex']),
]

def flatten_data_object(data: dict, parent_key: str = '', separator: str = '__') -> dict:
    """Разворачивает вложенные структуры ответа в плоский словарь.

    jqxGrid работает с плоскими полями (``category__name``), поэтому вложенные
    объекты и списки из DRF-ответа приводятся к плоскому виду.
    """
    items = {}
    for key, value in data.items():
        new_key = f"{parent_key}{separator}{key}" if parent_key else key

        if isinstance(value, dict):
            items.update(flatten_data_object(value, new_key, separator))
        elif isinstance(value, list):
            for i, item in enumerate(value):
                if isinstance(item, dict):
                    items.update(flatten_data_object(
                        item,
                        f"{new_key}{separator}{i}",
                        separator,
                    ))
                else:
                    items[f"{new_key}{separator}{i}"] = item
        else:
            items[new_key] = value

    return items


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


def source_url(source, basename_attr: str = 'grid_basename', widget: str = 'Grid') -> str:
    """Вернуть URL источника данных для ``Grid(source=...)``/``Tree(source=...)``.

    :param basename_attr: атрибут класса viewset'а с basename'ом маршрута
        (``grid_basename`` у ``GridViewSet``, ``tree_basename`` у ``TreeViewSet``);
    :param widget: имя виджета для сообщений об ошибках.
    """
    if isinstance(source, str):
        return source
    if source is None:
        raise ImproperlyConfigured(
            f"{widget}: не задан source. Передайте URL или класс, "
            f"созданный через {widget}ViewSet.create('ModelName')."
        )

    viewset = source if isinstance(source, type) else type(source)
    basename = getattr(viewset, basename_attr, None)
    if basename:
        for view_name in (f'jqxwidgets:{basename}-list', f'{basename}-list'):
            try:
                return reverse(view_name)
            except NoReverseMatch:
                continue
    raise ImproperlyConfigured(
        f"{widget}: не удалось определить URL источника для {viewset.__name__}. "
        f"Создайте его через {widget}ViewSet.create() и подключите jqxwidgets.urls в URLconf "
        "(path('api/', include('jqxwidgets.urls')))."
    )

def default_label_field(model) -> str | None:
    """Подпись узла дерева по умолчанию.

    Порядок подбора: явно известные имена (``label`` → ``name`` → ``title``),
    затем первое ``CharField``; если ничего не подошло — ``None``
    (узел будет показан через ``str(obj)``).
    """
    concrete = model._meta.concrete_fields
    names = {field.name for field in concrete}
    for candidate in ('label', 'name', 'title'):
        if candidate in names:
            return candidate
    for field in concrete:
        if isinstance(field, models.CharField):
            return field.name
    return None