# Installation

How to install **django-jqxwidgets** into your own Django project.

## Requirements

| | |
| --- | --- |
| Python | 3.10+ |
| Django | 4.2 – 5.1 |
| djangorestframework | 3.14+ |
| django-filter | 23.0+ |
| Node.js | *not required* — the JS bundle is prebuilt and shipped in the package |

Static files are served with `django.contrib.staticfiles`, so make sure it is in
`INSTALLED_APPS` (it is in every project created by `django-admin startproject`).

## 1. Install the package

From GitHub (recommended):

```bash
pip install git+https://github.com/Yaserson95/django-jqxwidgets.git
```

Pin a tag or a commit for reproducible deployments:

```bash
pip install "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git@v0.1.0"
pip install "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git@<sha>"
```

Editable install (only for contributors to the library itself):

```bash
git clone https://github.com/Yaserson95/django-jqxwidgets.git
cd django-jqxwidgets
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
```

Dependencies (`Django`, `djangorestframework`, `django-filter`) are pulled in
automatically; if they are already pinned in your project, pip keeps your pins.

## 2. Register the app

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

`jqxwidgets` adds no models, no migrations and no database tables — only a
template, static files and DRF viewsets you create yourself.

## 3. Wire the URLs

The router is exposed through `jqxwidgets.urls`; every viewset registered with
`GridViewSet.create()` appears under this prefix:

```python
# urls.py
from django.urls import path, include

urlpatterns = [
    path('api/', include('jqxwidgets.urls')),
]
```

Registration is **lazy**: `jqxwidgets/urls.py` reads the router through a
property, so it does not matter whether your viewsets are imported before or
after this `include()`.

If you use namespaces, the application namespace is `jqxwidgets`
(e.g. `reverse('jqxwidgets:product-list')`).

## 4. Static files

In development (`DEBUG = True`) `runserver` serves everything automatically.

In production collect the package assets together with your own:

```bash
python manage.py collectstatic
```

The bundle files are content-hashed (`main-XXXXXXXX.js`, `styles-XXXXXXXX.css`)
and listed in `jqxwidgets/static/jqxwidgets/manifest.json`, so no manual cache
busting is required.

## 5. Verify

```python
# somewhere in a view or a shell
from jqxwidgets import Grid, GridViewSet, Tree, TreeViewSet
```

Render a page containing `{{ grid }}` or `{{ tree }}` (see
[usage.md](usage.md)) and check the browser dev tools: one
`<link rel="stylesheet">` per stylesheet plus a small inline loader script that
injects `polyfills-*.js` and `main-*.js` exactly once per page
(`window.__JQXWIDGETS_LOADED__` guard).

If the page shows `<jqx-grid>` / `<jqx-tree>` but nothing renders and the
console warns about `manifest.json`, the static files are missing — reinstall
the package or, in a source checkout, rebuild the frontend (below).

## Upgrading

```bash
pip install --upgrade "django-jqxwidgets @ git+https://github.com/Yaserson95/django-jqxwidgets.git"
python manage.py collectstatic --noinput
```

Bundle file names change with every release; `collectstatic` copies the new
hashed files, and `manifest.json` points the loader at them. Stale hashed files
from previous versions can be removed with `collectstatic --clear`.

## Rebuilding the JS bundle (contributors)

Only needed if you edit `frontend/src/`:

```bash
cd frontend
npm install
npm run build        # ng build && node scripts/copy-dist.mjs
```

The script copies `frontend/dist/jqxwidgets-angular/browser/` into
`jqxwidgets/static/jqxwidgets/` and regenerates `manifest.json`.

## Uninstalling

```bash
pip uninstall django-jqxwidgets
```

Remove `'jqxwidgets'` from `INSTALLED_APPS`, the `include('jqxwidgets.urls')`
path, and every `Grid(...)` / `Tree(...)` usage from your views/templates.

Next: [usage.md](usage.md) — how to build grids · [classes.md](classes.md) — API reference.
