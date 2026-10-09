"""Smoke-тест нового проекта: страницы примеров + REST-эндпоинты гридов."""
import base64
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client  # noqa: E402

failures = []


def check(name, cond, detail=''):
    status = 'OK' if cond else 'FAIL'
    print(f'[{status}] {name}' + (f' — {detail}' if detail and not cond else ''))
    if not cond:
        failures.append(name)


c = Client()

# --- Страницы примеров ---
for path in ['/', '/auto-columns/', '/explicit-columns/', '/custom-options/', '/combined/']:
    r = c.get(path)
    check(f'GET {path}', r.status_code == 200, f'status={r.status_code}')

html = c.get('/auto-columns/').content.decode()
check('auto-columns содержит <jqx-grid', '<jqx-grid' in html)
check('auto-columns source=/api/product/', 'source="/api/product/"' in html)
check('auto-columns имеет ассеты (loader)', '__JQXWIDGETS_LOADED__' in html)
check('auto-columns config передан', 'config="' in html and 'columns' in html)

html = c.get('/explicit-columns/').content.decode()
check('explicit содержит columnsgroups', 'columnsgroups' in html)
check('explicit source=/api/category/', 'source="/api/category/"' in html)

html = c.get('/combined/').content.decode()
check('combined: два <jqx-grid', html.count('<jqx-grid') == 2, f'count={html.count("<jqx-grid")}')
# маркер guard'а встречается 3 раза на каждый loader (check/set/reset) — 2 грида × 3
check('combined: loader дважды (guard не даёт повторную загрузку)',
      html.count('if(w.__JQXWIDGETS_LOADED__){return;}') == 2,
      f"count={html.count('if(w.__JQXWIDGETS_LOADED__){return;}')}")

# --- REST: config ---
r = c.get('/api/product/config/')
check('GET /api/product/config/', r.status_code == 200, f'status={r.status_code}')
cfg = r.json()
cols = {col['dataField']: col for col in cfg.get('columns', [])}
check('config: колонки есть', len(cols) >= 5, f'cols={list(cols)}')
check('config: id скрыта (hidden=true)', cols.get('id', {}).get('hidden') is True)
check('config: category__name присутствует', 'category__name' in cols)
check('config: формат цены', cols.get('price', {}).get('format') == 'c2')
check('config: pagesize', cfg.get('pagesize') in (10, 50), f"pagesize={cfg.get('pagesize')}")

r = c.get('/api/category/config/')
check('GET /api/category/config/', r.status_code == 200, f'status={r.status_code}')

# --- REST: список + пагинация ---
r = c.get('/api/product/')
check('GET /api/product/', r.status_code == 200, f'status={r.status_code}')
data = r.json()
check('list: results', 'results' in data and len(data['results']) > 0)
check('list: count=120', data.get('count') == 120, f"count={data.get('count')}")
check('list: плоские ключи category__name', 'category__name' in data['results'][0],
      f"keys={list(data['results'][0])}")

r = c.get('/api/product/', {'pagenum': 1, 'pagesize': 50})
data = r.json()
check('страница 1 (pagenum=1) -> 50 записей', len(data['results']) == 50, f"n={len(data['results'])}")
first_id_page2 = data['results'][0]['id']
r0 = c.get('/api/product/', {'pagenum': 0, 'pagesize': 50})
check('pagenum=0 ≠ pagenum=1', r0.json()['results'][0]['id'] != first_id_page2)

# --- Сортировка (протокол jqx v27: sorting=[[field,1|0]], в base64) ---
def b64(obj) -> str:
    raw = json.dumps(obj, ensure_ascii=False)
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip('=')


r = c.get('/api/product/', {'sorting': b64([['price', 1]]), 'pagesize': 5})
prices = [float(x['price']) for x in r.json()['results']]
check('sorting price asc (base64)', prices == sorted(prices), f'prices={prices}')
r = c.get('/api/product/', {'sorting': b64([['price', 0]]), 'pagesize': 5})
prices = [float(x['price']) for x in r.json()['results']]
check('sorting price desc (base64)', prices == sorted(prices, reverse=True), f'prices={prices}')

# Обратная совместимость: открытый JSON в sorting всё ещё принимается
r = c.get('/api/product/', {'sorting': '[["price",1]]', 'pagesize': 5})
prices = [float(x['price']) for x in r.json()['results']]
check('sorting price asc (открытый JSON, legacy)', prices == sorted(prices), f'prices={prices}')

# Много-колоночная сортировка: [[field,dir],[field,dir]]
r = c.get('/api/product/', {'sorting': b64([['in_stock', 1], ['price', 0]]), 'pagesize': 50})
rows = [(bool(x['in_stock']), float(x['price'])) for x in r.json()['results']]
multi_ok = all(rows[i][0] <= rows[i + 1][0] for i in range(len(rows) - 1))
multi_ok = multi_ok and all(
    rows[i][1] >= rows[i + 1][1]
    for i in range(len(rows) - 1)
    if rows[i][0] == rows[i + 1][0]
)
check('sorting multi-column (base64)', multi_ok, f'rows={rows[:5]}')

# Мусорный base64 не роняет сервер: сортировка игнорируется, ответ валиден
r = c.get('/api/product/', {'sorting': 'не-base64!!', 'pagesize': 5})
check('битый base64 sorting -> 200, без сортировки', r.status_code == 200
      and r.json().get('count') == 120, f"status={r.status_code}, count={r.json().get('count')}")

# --- Фильтрация (filterGroups: url-safe Base64 от JSON) ---
fg = b64([{"field": "in_stock", "filters": [{"condition": "EQUAL", "value": True,
                                              "operator": "and"}], "operator": "and"}])
r = c.get('/api/product/', {'filterGroups': fg, 'pagesize': 50})
res = r.json()['results']
check('filter in_stock=true (base64)', all(x['in_stock'] for x in res) and len(res) > 0,
      f"n={len(res)}")

fg = b64([{"field": "price", "filters": [{"condition": "GREATER_THAN", "value": 300,
                                           "operator": "and"}], "operator": "and"}])
r = c.get('/api/product/', {'filterGroups': fg, 'pagesize': 50})
res = r.json()['results']
check('filter price>300 (base64)', all(float(x['price']) > 300 for x in res) and len(res) > 0,
      f"n={len(res)}, prices={[x['price'] for x in res[:5]]}")

# Обратная совместимость: открытый JSON всё ещё принимается
fg = ('[{"field":"in_stock","filters":[{"condition":"EQUAL","value":true,'
      '"operator":"and"}],"operator":"and"}]')
r = c.get('/api/product/', {'filterGroups': fg, 'pagesize': 50})
res = r.json()['results']
check('filter in_stock=true (открытый JSON, legacy)', all(x['in_stock'] for x in res) and len(res) > 0,
      f"n={len(res)}")

# Кириллица в значении фильтра переживает base64 round-trip
fg = b64([{"field": "name", "filters": [{"condition": "CONTAINS", "value": "Роман",
                                          "operator": "and"}], "operator": "and"}])
r = c.get('/api/product/', {'filterGroups': fg, 'pagesize': 50})
res = r.json()['results']
check('filter name contains "Роман" (base64 + UTF-8)', len(res) > 0
      and all('Роман' in x['name'] for x in res), f"n={len(res)}")

# Мусорный base64 не роняет сервер: фильтры игнорируются, ответ валиден
r = c.get('/api/product/', {'filterGroups': 'не-base64!!', 'pagesize': 5})
check('битый base64 -> 200, без фильтрации', r.status_code == 200
      and r.json().get('count') == 120, f"status={r.status_code}, count={r.json().get('count')}")

print()
if failures:
    print(f'FAILED: {len(failures)} → {failures}')
    sys.exit(1)
print('ALL PASSED')
