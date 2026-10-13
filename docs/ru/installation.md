# Установка

Как установить **django-jqxwidgets** в собственный Django-проект.

## Требования

| | |
| --- | --- |
| Python | 3.10+ |
| Django | 4.2 – 5.1 |
| djangorestframework | 3.14+ |
| django-filter | 23.0+ |
| Node.js | *не требуется* — JS-бандл собран и поставляется в составе пакета |

Статические файлы раздаются через `django.contrib.staticfiles`, поэтому
убедитесь, что он есть в `INSTALLED_APPS` (он есть в каждом проекте,
созданном `django-admin startproject`).

## 1. Установка пакета

С GitHub (рекомендуется):

```bash
pip install git+https://github.com/Yaserson95/django-jqxwidgets.git
```

Зафиксируйте тег или коммит для воспроизводимых деплоев:

```bash
pip install "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git@v0.1.0"
pip install "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git@<sha>"
```

Установка в режиме editable (только для контрибьюторов самой библиотеки):

```bash
git clone https://github.com/Yaserson95/django-jqxwidgets.git
cd django-jqxwidgets
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

Зависимости (`Django`, `djangorestframework`, `django-filter`) подтягиваются
автоматически; если они уже зафиксированы в вашем проекте, pip сохранит ваши
версии.

## 2. Регистрация приложения

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'django.contrib.staticfiles',
    'rest_framework',
    'django_filters',   # для фильтров по полям (filterset_fields)
    'jqxwidgets',
]
```

`jqxwidgets` не добавляет моделей, миграций и таблиц в базу данных — только
шаблон, статические файлы и DRF-viewset'ы, которые вы создаёте сами.

## 3. Подключение URL

Роутер экспортируется через `jqxwidgets.urls`; каждый viewset, зарегистрированный
через `GridViewSet.create()`, появляется под этим префиксом:

```python
# urls.py
from django.urls import path, include

urlpatterns = [
    path('api/', include('jqxwidgets.urls')),
]
```

Регистрация **ленивая**: `jqxwidgets/urls.py` читает роутер через property,
поэтому не имеет значения, импортируются ли ваши viewset'ы до или после этого
`include()`.

Если вы используете пространства имён, приложение-неймспейс — `jqxwidgets`
(например, `reverse('jqxwidgets:product-list')`).

## 4. Статические файлы

В разработке (`DEBUG = True`) `runserver` раздаёт всё автоматически.

В продакшене соберите ассеты пакета вместе с вашими:

```bash
python manage.py collectstatic
```

Файлы бандла содержат хеш содержимого (`main-XXXXXXXX.js`, `styles-XXXXXXXX.css`)
и перечислены в `jqxwidgets/static/jqxwidgets/manifest.json`, поэтому
ручной инвалидации кэша не требуется.

## 5. Проверка

```python
# где-нибудь во view или в shell
from jqxwidgets import Grid, GridViewSet, Tree, TreeViewSet
```

Отрендерьте страницу с `{{ grid }}`, `{{ tree }}` или `{{ form }}` (см.
[usage/grid.md](usage/grid.md), [usage/tree.md](usage/tree.md),
[usage/form.md](usage/form.md)) и проверьте dev-tools браузера: один
`<link rel="stylesheet">` на каждую таблицу стилей плюс небольшой инлайновый
скрипт-загрузчик, который внедряет `polyfills-*.js` и `main-*.js` ровно один
раз на страницу (защита `window.__JQXWIDGETS_LOADED__`).

Если страница показывает `<jqx-grid>` / `<jqx-tree>` / `<jqx-form>`, но ничего
не рендерится, а консоль предупреждает о `manifest.json` — статические файлы
отсутствуют: переустановите пакет или в исходниках пересоберите фронтенд (ниже).

## Обновление

```bash
pip install --upgrade "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git"
python manage.py collectstatic --noinput
```

Имена файлов бандла меняются с каждого релиза; `collectstatic` копирует новые
хешированные файлы, а `manifest.json` указывает загрузчику на них. Устаревшие
хешированные файлы прошлых версий можно удалить через `collectstatic --clear`.

## Пересборка JS-бандла (контрибьюторы)

Нужно только при изменении файлов в `frontend/src/`:

```bash
cd frontend
npm install
npm run build        # ng build && node scripts/copy-dist.mjs
```

Скрипт копирует `frontend/dist/jqxwidgets-angular/browser/` в
`jqxwidgets/static/jqxwidgets/` и регенерирует `manifest.json`.

## Удаление

```bash
pip uninstall django-jqxwidgets
```

Уберите `'jqxwidgets'` из `INSTALLED_APPS`, путь `include('jqxwidgets.urls')`
и все использования `Grid(...)` / `Tree(...)` из ваших views/шаблонов.

Далее: [usage/grid.md](usage/grid.md) — как строить гриды ·
[classes/base.md](classes/base.md) — справочник API.

English version: [../en/installation.md](../en/installation.md).
