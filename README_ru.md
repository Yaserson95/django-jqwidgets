# django-jqxwidgets

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

> English: [README.md](README.md)

Серверно-управляемые **jQWidgets**: таблица данных, дерево и форма записи для
Django. Пакет состоит из двух половин:

* Django/DRF-бэкенда (`jqxwidgets`), который превращает любую модель в
  JSON-эндпоинт с пагинацией, фильтрацией, сортировкой и автосгенерированной
  конфигурацией колонок — плюс ленивый эндпоинт дерева и CRUD-эндпоинт формы;
* заранее собранного Angular Elements бандла, который рендерит веб-компоненты
  `<jqx-grid>`, `<jqx-tree>` и `<jqx-form>` (Node.js в рантайме **не нужен** —
  бандл закоммичен в `jqxwidgets/static/jqxwidgets/`).

Вы пишете модель, регистрируете viewset, вставляете `{{ my_grid }}` (или
`{{ my_tree }}`, `{{ my_form }}`) в шаблон — и получаете полностью
серверно-пагинируемую таблицу с фильтрами и многоколоночной сортировкой,
дерево, подгружающее узлы при раскрытии и прокрутке, или форму записи (даже с
полями, сгенерированными из Django `ModelForm`).

---

## Возможности

* **Источники без конфигурации** — `GridViewSet.create("Product")` регистрирует
  REST-эндпоинт и эндпоинт `<source>config/` с колонками, выведенными из
  модели / сериализатора (заголовки, типы данных, виджеты фильтров, форматы дат).
* **Явный контроль** — наследуйте `Grid`, чтобы задать нативные jqx-колонки,
  группы колонок и любую опцию jqxGrid (`pagesize`, `showfilterrow`,
  `selectionmode`, …).
* **Всё на сервере** — пагинация (`pagenum`/`pagesize`), многоколоночная
  сортировка (`sorting`), групповая фильтрация (`filterGroups`); оба параметра
  передаются в url-safe Base64, обычный JSON принимается для обратной
  совместимости.
* **Ленивое дерево** — `TreeViewSet.create("Node")` + `Tree(source=…)`: корни
  загружаются при загрузке страницы, дети — при раскрытии ветки
  (`?parent=<id>`), а большие уровни стримятся чанками при прокрутке
  (`?offset=&limit=`); `haschildren` считается на сервере, поэтому стрелка
  раскрытия появляется до загрузки детей.
* **Вложенные данные** — вложенные сериализаторы сплющиваются в ключи вида
  `category__name`, которые jqxGrid понимает нативно.
* **Формы записей** — `Form(source=FormViewSet.create("Product"), id=…)`
  рендерит `<jqx-form>` со встроенными кнопками сохранения/отмены и полным
  CRUD; шаблон полей берётся из сериализатора, ваших собственных строк — или
  прямо из Django `Form`/`ModelForm` через `form=MyDjangoForm` (типы,
  заголовки, `required`, варианты/списки FK, `help_text`).
* **Один бандл на страницу** — ассеты внедряются один раз, защищены от двойной
  загрузки и разрешаются через `manifest.json` (хеши для инвалидации кэша).

---

## Установка как пакета

Требуется Python 3.10+, Django 4.2+, djangorestframework, django-filter.

```bash
pip install git+https://github.com/Yaserson95/django-jqxwidgets.git
```

Зафиксируйте тег/коммит для воспроизводимых деплоев:

```bash
pip install "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git@v0.2.0"
```

Минимальная настройка:

```python
# settings.py
INSTALLED_APPS = [
    # ...
    'rest_framework',
    'django_filters',
    'jqxwidgets',
]
```

```python
# urls.py
urlpatterns = [
    path('api/', include('jqxwidgets.urls')),
]
```

```python
# views.py
from jqxwidgets import Grid, GridViewSet

ProductSource = GridViewSet.create("myapp.Product")

def products_page(request):
    return render(request, 'products.html', {'grid': Grid(source=ProductSource)})
```

```django
{# templates/products.html #}
<!DOCTYPE html>
<html>
<head>{% load static %}<title>Товары</title></head>
<body>
  {{ grid }}
</body>
</html>
```

Подробное руководство, опции и протокол запросов: см.
[Документацию](#документация) ниже.

---

## Запуск демо-проекта (этот репозиторий)

Сам репозиторий — готовый к запуску Django-проект: пакет `jqxwidgets` плюс
приложение `examples` с семью демо-страницами и засеянными данными (120 товаров,
742 узла дерева).

### 1. Предварительные требования

* Python 3.10+ (проверено на 3.11)
* Node.js 18+ — **только** если хотите пересобрать JS-бандл
  (заранее собранный бандл уже закоммичен, поэтому Node.js можно не ставить)

### 2. Виртуальное окружение и зависимости

```bash
git clone https://github.com/Yaserson95/django-jqxwidgets.git
cd django-jqxwidgets

python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

Демо импортирует `jqxwidgets` прямо из чекаута репозитория — устанавливать
сам пакет здесь не нужно.

### 3. База данных

```bash
python manage.py migrate
python manage.py seed_examples          # 6 категорий + 120 товаров (детерминированно)
python manage.py seed_tree              # 742 узла: 20 корней, уровень на 300 узлов, глубокие ветки
# python manage.py seed_examples --clear --products 500   # перезасеять
```

`db.sqlite3` создаётся рядом с `manage.py`.

### 4. Запуск

```bash
python manage.py runserver
```

Откройте <http://127.0.0.1:8000/>:

| Страница | Что показывает |
| --- | --- |
| `/` | индекс примеров |
| `/auto-columns/` | колонки, выведенные из модели/сериализатора (`<source>config/`) |
| `/explicit-columns/` | явные колонки и группы колонок (подкласс `Grid`) |
| `/custom-options/` | явные опции jqxGrid (`pagesize`, `showfilterrow`, …) |
| `/combined/` | два грида на одной странице (бандл загружается ровно один раз) |
| `/tree/` | ленивое дерево: дети при раскрытии, чанки при прокрутке (уровень на 300 узлов) |
| `/form/` | форма записи: создание/редактирование, встроенные кнопки, `getForm()` из грида |
| `/form-django/` | jqxForm, сгенерированный из Django `ModelForm` (`form=`) |
| `/admin/` | Django admin (засеянные данные) |
| `/api/product/`, `/api/product/config/` | JSON-эндпоинты за гридами |
| `/api/category/`, `/api/category/config/` | то же для категорий |
| `/api/node/`, `/api/node/config/` | JSON-эндпоинты за деревом |
| `/api/category-form/`, `/api/product-form/` | CRUD + config за формами |

---

## Пересборка фронтенд-бандла

Нужно только при изменении TypeScript-исходников в `frontend/src/`:

```bash
cd frontend
npm install
npm run typecheck      # опционально: tsc --noEmit
npm run build          # ng build + копирование в jqxwidgets/static/jqxwidgets/
```

`npm run build` запускает `scripts/copy-dist.mjs`, который стирает
`jqxwidgets/static/jqxwidgets/`, копирует туда свежий `dist/` и регенерирует
`manifest.json` (список хешированных entry-файлов `main-*.js` / `styles-*.css`,
которые читает `jqxwidgets.assets.assets_html()`). Закоммитьте регенерированные
статические файлы вместе с исходным изменением.

## Тесты

Smoke-тест (страницы, REST-эндпоинты, пагинация, Base64-сортировка/фильтрация,
протокол дерева, legacy-совместимость) — запускать из корня репозитория:

```bash
python -m examples.tests.smoke
```

Ожидаемый вывод — список строк `[OK]`, завершающийся `ALL PASSED`.

Фронтенд-тесты (опционально; им нужен jsdom — `npm install --no-save jsdom` в
`frontend/` — плюс запущенный демо-сервер для e2e-теста):

```bash
cd frontend
npm install --no-save jsdom
node scripts/test-tree-jsdom.mjs                       # контракт jqxTree API (jsdom)
python manage.py runserver 127.0.0.1:8765              # в другом терминале, корень репо
node scripts/test-tree-e2e.mjs                         # полная страница: загрузка → раскрытие → чанки при прокрутке
```

---

## Структура репозитория

```
jqxwidgets/            # устанавливаемое Django-приложение (пакет на PyPI/GitHub)
  static/jqxwidgets/   #   собранный бандл веб-компонентов + manifest.json
  templates/jqxwidgets/#   шаблоны <jqx-grid>, <jqx-tree> и <jqx-form>
  widgets/             #   базовый класс Widget + Grid / GridConfig / Tree / Form
  viewsets/            #   BaseViewSet + GridViewSet / TreeViewSet / FormViewSet
  ...
frontend/              # Angular-исходники веб-компонентов (npm run build)
docs/                  # установка + руководства и справочники по виджетам
  en/ ru/              #   английская и русская версии документации
examples/              # демо Django-приложение (модели, views, страницы, seed-команды)
config/                # настройки / urls демо-проекта
pyproject.toml         # упаковка (pip install git+...)
examples/tests/smoke.py# smoke-тест
```

## Документация

### Начало работы

| Файл | Содержание |
| --- | --- |
| [docs/ru/installation.md](docs/ru/installation.md) | установка с GitHub, настройки, статические файлы, обновление |

### Руководства (usage)

| Файл | Содержание |
| --- | --- |
| [docs/ru/usage/base.md](docs/ru/usage/base.md) | общие концепции: источники, порядок слияния опций, один бандл на страницу, роутер пакета |
| [docs/ru/usage/grid.md](docs/ru/usage/grid.md) | гриды: быстрый старт, источники, колонки, опции jqxGrid, протокол запросов, рецепты |
| [docs/ru/usage/tree.md](docs/ru/usage/tree.md) | деревья: ленивая загрузка (корни, раскрытие, чанки при прокрутке), опции jqxTree |
| [docs/ru/usage/form.md](docs/ru/usage/form.md) | формы: CRUD, шаблон из Django `ModelForm`, `getForm()` |

### Справочник API (classes)

| Файл | Содержание |
| --- | --- |
| [docs/ru/classes/base.md](docs/ru/classes/base.md) | базовый класс `Widget`, общие функции модулей, экспорты пакета, исключения |
| [docs/ru/classes/grid.md](docs/ru/classes/grid.md) | `Grid`, `GridConfig`, `GridViewSet`, `GridPagination`, `jqxwidgets.config` |
| [docs/ru/classes/tree.md](docs/ru/classes/tree.md) | `Tree`, `TreeViewSet` |
| [docs/ru/classes/form.md](docs/ru/classes/form.md) | `Form`, `FormViewSet`, `template_from_form` |

Английская версия документации — в [docs/en/](docs/en/installation.md).

## Лицензия

[MIT](LICENSE) © YASER
