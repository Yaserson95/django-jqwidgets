# Base concepts

Everything shared by `<jqx-grid>`, `<jqx-tree>` and `<jqx-form>`: the source
resolution rules, option merging, asset injection and the package router.
Each widget page ([grid](grid.md) · [tree](tree.md) ·
[form](form.md)) builds on these rules.

## 1. Sources — what `source=` accepts

Every widget takes a `source` pointing at a DRF endpoint:

| Value | Result |
| --- | --- |
| viewset class from `GridViewSet.create()` / `TreeViewSet.create()` / `FormViewSet.create()` | URL resolved automatically |
| viewset instance | the same |
| a string (`"/api/products/"`) | used as-is |

Resolution is done by `jqxwidgets.viewsets.source_url()`; when it fails (no
`source`, or the viewset has no registered URL) the widget raises
`ImproperlyConfigured` with a message naming the widget.

## 2. Option merge order

All widgets merge options the same way (later wins):

```
class attributes  →  config=  →  **options
```

* **class attributes** — set on a `Grid`/`Tree`/`Form` subclass;
* **config=** — a dict (or `GridConfig` for the grid) passed to the constructor;
* **\*\*options** — any jqx option passed as a keyword argument.

For grids the chain continues below: viewset `extra` → `<source>config/`
response → built-in defaults (see [grid.md](grid.md) §3.4).

## 3. One bundle per page

`{{ grid }}` / `{{ tree }}` / `{{ form }}` each render three things: a
stylesheet `<link>`, an inline loader script and the custom element itself.
The loader:

* resolves the hashed file names through `manifest.json` (cache busting);
* injects `polyfills-*.js` and `main-*.js` **once per page** even when several
  widgets are rendered (`window.__JQXWIDGETS_LOADED__` guard);
* logs a warning when the manifest lists no JS entries.

Rendering two widgets on one page is safe — the second one reuses the already
registered assets.

## 4. Package router and URLs

All factories (`GridViewSet.create`, `TreeViewSet.create`, `FormViewSet.create`)
register their viewset in the package-level `rest_framework.routers.SimpleRouter`
(`jqxwidgets.router.router`). The application `urls.py` must include it once:

```python
urlpatterns = [
    path('api/', include('jqxwidgets.urls')),
]
```

Route basenames are deduplicated across **all** factories — when two models
resolve to the same name, the second one gets an `app_label_` prefix (and a
form source gets a `-form` suffix). Reversing works through the application
namespace: `reverse('jqxwidgets:<basename>-list')`.

## 5. Custom markup

Every widget renders a template from `jqxwidgets/templates/jqxwidgets/` with
the same context shape (`source`, `config` JSON, `assets`, plus widget-specific
keys). To change the markup, subclass the widget and override `__html__()` or
`template_name`.

---

Next: [grid.md](grid.md) · [tree.md](tree.md) ·
[form.md](form.md) — the widget guides ·
[../classes/base.md](../classes/base.md) — the base API reference.
