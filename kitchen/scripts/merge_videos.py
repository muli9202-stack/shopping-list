import json, glob, re, sys
sys.path.insert(0, '/tmp/claude-0/yt2')
from cat_lib import classify, SKIP
from newchefs import HE
P = '/home/user/shopping-list/public/kitchen/seed-videos.json'
data = json.load(open(P))
# drop any earlier merge of shorts / new chefs so the script can be re-run
new_ids = {c[0] for c in HE}
data = {k: [r for r in v if not (len(r) > 4 and r[4] == 1)] for k, v in data.items() if k not in new_ids}
def row(v, short):
    t = v['t'].strip()
    if SKIP.search(t) and not short: return None
    main, themes = classify(t)
    extras = list(themes)
    if short: extras.append('shorts')
    r = [v['id'], t, main, extras or None]
    if short: r.append(1)
    while len(r) > 3 and r[-1] is None: r.pop()
    return r
stats = {}
for f in sorted(glob.glob('/tmp/claude-0/yt2/out/*.json')):
    name = f.split('/')[-1][:-5]
    d = json.load(open(f))
    chef = name[4:] if name.startswith('old-') else name
    rows = data.setdefault(chef, [])
    have = {r[0] for r in rows}
    n = [0, 0]
    for v in d['videos']:
        if v['id'] in have: continue
        r = row(v, False)
        if r: rows.append(r); have.add(v['id']); n[0] += 1
    for v in d['shorts']:
        if v['id'] in have: continue
        r = row(v, True)
        if r: rows.append(r); have.add(v['id']); n[1] += 1
    stats[chef] = n
json.dump(data, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
tv = sum(len([r for r in v if not (len(r) > 4 and r[4] == 1)]) for v in data.values())
ts = sum(len([r for r in v if len(r) > 4 and r[4] == 1]) for v in data.values())
print('chefs', len(data), '| videos', tv, '| shorts', ts, '| total', tv + ts)
import os; print(os.path.getsize(P) // 1024, 'KiB')
other = sum(1 for v in data.values() for r in v if r[2] == 'other'); print('other', other)
