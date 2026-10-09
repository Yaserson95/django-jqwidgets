"""Построение конфигурации jqxGrid из DRF-сериализатора."""
from rest_framework import serializers

TYPE_MAPPINGS = {
    'BooleanField': 'boolean',
    'NullBooleanField': 'boolean',
    'IntegerField': 'number',
    'BigIntegerField': 'number',
    'SmallIntegerField': 'number',
    'PositiveIntegerField': 'number',
    'PositiveSmallIntegerField': 'number',
    'PositiveBigIntegerField': 'number',
    'DecimalField': 'number',
    'FloatField': 'number',
    'DateTimeField': 'date',
    'DateField': 'date',
    'TimeField': 'string',
    'CharField': 'string',
    'EmailField': 'string',
    'SlugField': 'string',
    'URLField': 'string',
    'UUIDField': 'string',
    'TextField': 'string',
}

# Форматы отображения дат в ячейках jqxGrid (встроенный формат jqx, без globalize)
DATE_FORMATS = {
    'DateTimeField': 'dd.MM.yyyy HH:mm',
    'DateField': 'dd.MM.yyyy',
}


def get_filter_type(field) -> str:
    """Тип фильтра jqxGrid для поля сериализатора."""
    if isinstance(field, serializers.BooleanField):
        return 'checkbox'
    if isinstance(field, (serializers.DateTimeField, serializers.DateField)):
        return 'date'
    if isinstance(field, (serializers.DecimalField, serializers.IntegerField, serializers.FloatField)):
        return 'number'
    if isinstance(field, serializers.ChoiceField):
        return 'list'
    return 'text'


def flatten_serializer_fields(serializer, prefix: str = '') -> dict:
    """Плоский список полей сериализатора (вложенные — через ``__``)."""
    fields = {}
    for field_name, field in serializer.get_fields().items():
        if isinstance(field, serializers.BaseSerializer):
            nested = flatten_serializer_fields(field, f"{prefix}{field_name}__")
            fields.update(nested)
        else:
            fields[f"{prefix}{field_name}"] = field
    return fields


def build_grid_config(serializer, pagesize: int | None = None) -> dict:
    """Собрать конфигурацию грида (колонки и группу колонок) из сериализатора.

    Ожидания к сериализатору (всё необязательно):

    * ``Meta.grid_config`` — словарь с переопределениями по полям
      (например ``{'price': {'width': '15%', 'format': 'c2'}}``);
    * ``Meta.grid_columnsgroups`` — список групп колонок jqxGrid
      (``[{'text': '...', 'name': '...', 'align': 'center'}]``).
    """
    meta = getattr(serializer, 'Meta', None)
    overrides = getattr(meta, 'grid_config', None) or {}

    flat_fields = flatten_serializer_fields(serializer)
    columns = []
    for field_name, field in flat_fields.items():
        field_class = field.__class__.__name__
        column = {
            'dataField': field_name,
            'label': field.label or field_name.replace('__', ' ').capitalize(),
            'dataType': TYPE_MAPPINGS.get(field_class, 'string'),
            'visible': True,
            'editable': not field.read_only,
            'filter': {'enabled': True, 'type': get_filter_type(field)},
        }
        if field_class in DATE_FORMATS:
            column['format'] = DATE_FORMATS[field_class]
        column.update(overrides.get(field_name, {}))
        columns.append(column)

    config = {'columns': columns}
    if pagesize is not None:
        config['pagesize'] = pagesize

    model = getattr(meta, 'model', None)
    if model is not None:
        config['pk'] = model._meta.pk.name

    columnsgroups = getattr(meta, 'grid_columnsgroups', None)
    if columnsgroups:
        config['columnsgroups'] = list(columnsgroups)

    return config
