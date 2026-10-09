# django-jqxwidgets

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)

Server-driven **jQWidgets** data grid for Django. The package ships two halves:

* a Django/DRF backend (`jqxwidgets`) that turns any model into a JSON endpoint
  with paging, filtering, sorting and an auto-generated column config;
* a prebuilt Angular Elements bundle that renders the `<jqx-grid>` web component
  (no Node.js is required at runtime — the bundle is committed under
  `jqxwidgets/static/jqxwidgets/`).

You write a model, register a viewset, drop `{{ my_grid }}` into a template —
and get a fully server-side paginated grid with filters and multi-column sorting.

---

## Features

* **Zero-config sources** — `GridViewSet.create("Product")` registers a REST
  endpoint and a `<source>config/` endpoint with columns inferred from the model
  / serializer (labels, data types, filter widgets, date formats).
* **Explicit control** — subclass `Grid` to define native jqx columns, column
  groups and any jqxGrid option (`pagesize`, `showfilterrow`, `selectionmode`, …).
* **Server-side everything** — paging (`pagenum`/`pagesize`), multi-column
  sorting (`sorting`), grouped filtering (`filterGroups`); both parameters are
  sent as url-safe Base64, plain JSON is accepted for backward compatibility.
* **Nested data** — nested serializers are flattened into `category__name`
  style keys that jqxGrid understands natively.
* **One bundle per page** — assets are injected once, guarded against double
  loading, and resolved through `manifest.json` (cache-busting hashes).

---

## Install as a package

Requires Python 3.10+, Django 4.2+, djangorestframework, django-filter.

```bash
pip install git+https://github.com/Yaserson95/django-jqxwidgets.git
```

Pin a tag/commit for reproducible deployments:

```bash
pip install "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git@v0.1.0"
```

Minimal setup:

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
<head>{% load static %}<title>Products</title></head>
<body>
  {{ grid }}
</body>
</html>
```

Full walkthrough, options and the request protocol:
**[docs/installation.md](docs/installation.md)** · **[docs/usage.md](docs/usage.md)** ·
**[docs/classes.md](docs/classes.md)** (API reference).

---

## Run the demo project (this repository)

The repository itself is a ready-to-run Django project: the `jqxwidgets` package
plus an `examples` app with four demo pages and 120 seeded products.

### 1. Prerequisites

* Python 3.10+ (tested on 3.11)
* Node.js 18+ — **only** if you want to rebuild the JS bundle
  (a prebuilt bundle is already committed, so you can skip Node.js entirely)

### 2. Virtual environment and dependencies

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

The demo imports `jqxwidgets` straight from the repository checkout — installing
the package itself is not needed here.

### 3. Database

```bash
python manage.py migrate
python manage.py seed_examples          # 6 categories + 120 products (deterministic)
# python manage.py seed_examples --clear --products 500   # re-seed
```

`db.sqlite3` is created next to `manage.py`.

### 4. Run

```bash
python manage.py runserver
```

Open <http://127.0.0.1:8000/>:

| Page | What it shows |
| --- | --- |
| `/` | index of the examples |
| `/auto-columns/` | columns inferred from the model/serializer (`<source>config/`) |
| `/explicit-columns/` | explicit columns and column groups (subclass of `Grid`) |
| `/custom-options/` | explicit jqxGrid options (`pagesize`, `showfilterrow`, …) |
| `/combined/` | two grids on one page (bundle loads exactly once) |
| `/admin/` | Django admin (seeded data) |
| `/api/product/`, `/api/product/config/` | the JSON endpoints behind the grids |
| `/api/category/`, `/api/category/config/` | same for categories |

---

## Rebuild the frontend bundle

Needed only when you change TypeScript sources in `frontend/src/`:

```bash
cd frontend
npm install
npm run typecheck      # optional: tsc --noEmit
npm run build          # ng build + copy into jqxwidgets/static/jqxwidgets/
```

`npm run build` runs `scripts/copy-dist.mjs`, which wipes
`jqxwidgets/static/jqxwidgets/`, copies the fresh `dist/` there and regenerates
`manifest.json` (list of hashed `main-*.js` / `styles-*.css` entry files read by
`jqxwidgets.assets.assets_html()`). Commit the regenerated static files together
with the source change.

## Tests

Smoke test (pages, REST endpoints, paging, Base64 sorting/filtering, legacy
compat) — run from the repository root:

```bash
python -m examples.tests.smoke
```

Expected output: a list of `[OK]` lines ending with `ALL PASSED`.

---

## Repository layout

```
jqxwidgets/            # the installable Django app (the package on PyPI/GitHub)
  static/jqxwidgets/   #   built web component bundle + manifest.json
  templates/jqxwidgets/#   <jqx-grid> template
  viewsets.py          #   GridViewSet: filters, sorting, config endpoint
  grid.py              #   Grid / GridConfig widgets
  ...
frontend/              # Angular sources for the web component (npm run build)
docs/                  # installation, usage and API reference
examples/              # demo Django app (models, views, pages, seed command)
config/                # demo project settings / urls
pyproject.toml         # packaging (pip install git+...)
examples/tests/smoke.py# smoke test
```

## Documentation

| File | Contents |
| --- | --- |
| [docs/installation.md](docs/installation.md) | install from GitHub, settings, static files, upgrading |
| [docs/usage.md](docs/usage.md) | how to build grids: sources, columns, options, request protocol |
| [docs/classes.md](docs/classes.md) | API reference: classes, methods, functions, constants |

## License

[MIT](LICENSE) © YASER
