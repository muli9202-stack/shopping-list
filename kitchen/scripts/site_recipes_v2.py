# Recipe pages linked from the new channels' descriptions (links already in descs2.json).
import json, os, sys, subprocess
sys.path.insert(0, '/tmp/claude-0/yt')
from concurrent.futures import ThreadPoolExecutor
import site_recipes as S
sys.path.insert(0, '/tmp/claude-0/yt2')
from newchefs import HE
d2 = json.load(open('/tmp/claude-0/yt2/descs2.json'))
data = json.load(open('/home/user/shopping-list/public/kitchen/seed-videos.json'))
done_site = json.load(open('/tmp/claude-0/yt/site.json'))
todo = []
for ch, rows in data.items():
    for r in rows:
        v = d2.get(r[0])
        if not v or r[0] in done_site: continue
        cands = [u for u in v['l'] if not S.SKIP.search(u)][:3]
        if cands: todo.append((r[0], r[1], cands))
print('todo', len(todo), flush=True)
def proc(item):
    vid, title, cands = item
    tw = S.stems(S.words(title))
    for u in cands:
        r = S.fetch_recipe(u)
        if not r: continue
        name = S.clean(r.get('name', ''))
        if tw and not (tw & S.stems(S.words(name))): continue
        raw = r.get('recipeIngredient') or r.get('ingredients') or []
        flat = []
        for x in (raw if isinstance(raw, list) else [raw]): flat += x if isinstance(x, list) else [x]
        ing = [x for x in (S.clean(x) for x in flat) if x]
        st = S.steps_of(r.get('recipeInstructions'))
        if ing and st: return vid, {'name': name, 'ing': ing, 'steps': st, 'url': u}
    return vid, None
out = {}
with ThreadPoolExecutor(32) as ex:
    for i, (vid, rec) in enumerate(ex.map(proc, todo)):
        out[vid] = rec
        if (i + 1) % 500 == 0: print(i + 1, sum(1 for v in out.values() if v), flush=True)
done_site.update(out)
json.dump(done_site, open('/tmp/claude-0/yt/site.json', 'w'), ensure_ascii=False)
print('done', sum(1 for v in out.values() if v), 'new site recipes', flush=True)
