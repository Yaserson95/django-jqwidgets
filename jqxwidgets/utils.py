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
