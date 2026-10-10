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
for path in ['/', '/auto-columns/', '/explicit-columns/', '/custom-options/', '/combined/', '/tree/']:
    r = c.get(path)
    check(f'GET {path}', r.status_code == 200, f'status={r.status_code}')

html = c.get('/auto-columns/').content.decode()
check('auto-columns содержит <jqx-grid', '<jqx-grid' in html)
check('auto-columns source=/api/product/', 'source="/api/product/"' in html)
check('auto-columns имеет ассеты (loader)', '__JQXWIDGETS_LOADED__' in html)
check('auto-columns config передан', 'config="' in html and 'columns' in html)
# jqx написан для sloppy-режима: ES-модули (type="module") всегда строгие,
# и отвязанные вызовы вроде this.theme падают (баг меню фильтров/сортировки).
# Бандл оборачивается в IIFE (copy-dist.mjs) и грузится как classic script.
check('loader грузит бандл как classic script (не module)', 'type="module"' not in html,
      f"найдено type=\"module\": {'module' in html}")

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

# --- jqxTree: страница и разметка ---
html = c.get('/tree/').content.decode()
check('tree: страница содержит <jqx-tree', '<jqx-tree' in html)
check('tree: source=/api/node/', 'source="/api/node/"' in html)
check('tree: имеет ассеты (loader)', '__JQXWIDGETS_LOADED__' in html)

# --- jqxTree: REST — корневой уровень ---
r = c.get('/api/node/')
check('GET /api/node/', r.status_code == 200, f'status={r.status_code}')
data = r.json()
# корни: 20 разделов + «Большой» + «Глубокий»
check('tree list: count корней = 22', data.get('count') == 22, f"count={data.get('count')}")
first = data['results'][0]
check('tree list: элемент содержит id/label/parentid/haschildren',
      set(first) >= {'id', 'label', 'parentid', 'haschildren'}, f"keys={sorted(first)}")
check('tree list: parentid корней = None', first['parentid'] is None)
check('tree list: haschildren=true у корней', all(x['haschildren'] for x in data['results']))
check('tree list: сортировка по имени (Б → Г → Р)',
      first['label'].startswith('Большой'), f"label={first['label']}")

# --- jqxTree: REST — дети узла и чанки ---
big = next(x for x in data['results'] if x['label'].startswith('Большой'))
r = c.get('/api/node/', {'parent': big['id']})
check('GET /api/node/?parent=<big>', r.status_code == 200, f'status={r.status_code}')
kids = r.json()
check('tree parent: count детей Большого раздела = 300', kids.get('count') == 300,
      f"count={kids.get('count')}")
check('tree parent: первый чанк = 50 (chunk_size)', len(kids['results']) == 50,
      f"n={len(kids['results'])}")
check('tree parent: parentid детей = id Большого', kids['results'][0]['parentid'] == big['id'])
check('tree parent: листья haschildren=false',
      all(not x['haschildren'] for x in kids['results']))

r = c.get('/api/node/', {'parent': big['id'], 'offset': 50, 'limit': 50})
page2 = r.json()['results']
check('tree offset=50: следующий чанк без повторов',
      len(page2) == 50 and page2[0]['id'] != kids['results'][0]['id'],
      f"first={page2[0]['id'] if page2 else None}")

r = c.get('/api/node/', {'parent': big['id'], 'offset': 250})
last_page = r.json()['results']
check('tree offset=250: хвост чанка (300-250=50)', len(last_page) == 50, f"n={len(last_page)}")

r = c.get('/api/node/', {'parent': big['id'], 'limit': 9999})
check('tree limit клампится max_chunk_size (500)', len(r.json()['results']) <= 500,
      f"n={len(r.json()['results'])}")

# --- jqxTree: REST — глубина и пустые уровни ---
deep = next(x for x in data['results'] if x['label'].startswith('Глубокий'))
r = c.get('/api/node/', {'parent': deep['id']})
check('tree deep: 3 дочерних узла первого уровня', r.json()['count'] == 3,
      f"count={r.json().get('count')}")
check('tree deep: у детей есть внуки (haschildren=true)',
      all(x['haschildren'] for x in r.json()['results']))

r = c.get('/api/node/', {'parent': 'не-id!!'})
check('tree: битый parent -> 200, пустой уровень',
      r.status_code == 200 and r.json() == {'count': 0, 'results': []},
      f"status={r.status_code}, body={r.json()}")

r = c.get('/api/node/', {'parent': 999999})
check('tree: несуществующий parent -> пустой уровень', r.json()['count'] == 0,
      f"count={r.json().get('count')}")

# --- jqxTree: REST — config ---
r = c.get('/api/node/config/')
check('GET /api/node/config/', r.status_code == 200, f'status={r.status_code}')
cfg = r.json()
check('tree config: pk/labelField/parentField/chunkSize',
      cfg.get('pk') == 'id' and cfg.get('labelField') == 'name'
      and cfg.get('parentField') == 'parent' and cfg.get('chunkSize') == 50,
      f"cfg={cfg}")

print()
if failures:
    print(f'FAILED: {len(failures)} → {failures}')
    sys.exit(1)
print('ALL PASSED')
