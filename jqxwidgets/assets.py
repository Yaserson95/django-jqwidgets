"""Отдача собранного Angular-бандла (web-компонент ``<jqx-grid>``)."""
import json
import logging
import os

from django.templatetags.static import static
from django.utils.safestring import mark_safe

logger = logging.getLogger(__name__)
_warned = False

STATIC_DIR = os.path.join(os.path.dirname(__file__), 'static', 'jqxwidgets')
_cache = {'mtime': None, 'data': None}


def _manifest() -> dict:
    """manifest.json, сгенерированный scripts/copy-dist.mjs после сборки."""
    path = os.path.join(STATIC_DIR, 'manifest.json')
    try:
        mtime = os.path.getmtime(path)
    except OSError:
        return {}
    if _cache['mtime'] != mtime:
        with open(path, encoding='utf-8') as fh:
            _cache['data'] = json.load(fh)
        _cache['mtime'] = mtime
    return _cache['data'] or {}


def assets_html() -> str:
    """HTML-фрагмент: стили jqx + ленивая загрузка бандла (один раз на страницу)."""
    global _warned
    manifest = _manifest()
    js = manifest.get('js') or []
    css = manifest.get('css') or []

    if not js and not _warned:
        logger.warning(
            "jqxwidgets: не найден static/jqxwidgets/manifest.json — "
            "соберите фронтенд: npm install && npm run build (каталог frontend/)."
        )
        _warned = True

    links = ''.join(
        f'<link rel="stylesheet" href="{static("jqxwidgets/" + name)}">'
        for name in css
    )
    if not js:
        return mark_safe(links)

    sources = json.dumps([static('jqxwidgets/' + name) for name in js])
    loader = (
        '<script>(function(){var w=window;if(w.__JQXWIDGETS_LOADED__){return;}'
        'w.__JQXWIDGETS_LOADED__=true;var f=' + sources + ';var i=0;'
        '(function next(){if(i>=f.length){return;}'
        'var s=document.createElement("script");s.type="module";s.src=f[i++];'
        's.onload=next;s.onerror=function(){w.__JQXWIDGETS_LOADED__=false;};'
        'document.head.appendChild(s);})();})();</script>'
    )
    return mark_safe(links + loader)
