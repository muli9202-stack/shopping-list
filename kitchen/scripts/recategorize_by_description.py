# Re-sorts built-in videos stuck in "other" using their description, and drops the old "shorts" extra category.
import json, re, collections, sys
sys.path.insert(0, '/tmp/claude-0/yt2')
from cat_lib import classify, DISH, THEMES, norm
P = '/home/user/shopping-list/public/kitchen/seed-videos.json'
data = json.load(open(P))
d1 = json.load(open('/tmp/claude-0/yt/descs.json'))
d2 = json.load(open('/tmp/claude-0/yt2/descs2.json'))
def desc(vid):
    if vid in d2: return d2[vid]['d']
    return d1.get(vid)
URLISH = re.compile(r'https?://|www\.|@\w|instagram|facebook|tiktok|youtube|הרשמ|הירשמ|עקבו|לייק|subscribe|follow', re.I)
def norm_line(l): return re.sub(r'\s+', ' ', l.replace('\xa0', ' ')).strip()
moved = collections.Counter(); still = 0
for chef, rows in data.items():
    # lines repeated across many of this channel's descriptions are channel boilerplate
    cnt = collections.Counter()
    descs = {r[0]: desc(r[0]) for r in rows}
    n = sum(1 for v in descs.values() if v)
    for v in descs.values():
        if v: cnt.update({norm_line(l) for l in v.split('\n') if norm_line(l)})
    boiler = {l for l, c in cnt.items() if c >= 3 and c >= 0.05 * n}
    for r in rows:
        if len(r) > 3 and r[3]:
            r[3] = [x for x in r[3] if x != 'shorts'] or None
        if r[2] != 'other': continue
        v = descs.get(r[0])
        if not v: still += 1; continue
        lines = [norm_line(l) for l in v.split('\n')]
        lines = [l for l in lines if l and l not in boiler and not URLISH.search(l)]
        text = norm(' '.join(lines)[:900])
        # count keyword hits per dish category; move only on clear evidence
        scores = sorted(((sum(len(p.findall(text)) for p in pats), cid) for cid, pats in DISH), reverse=True)
        (best, main), (second, _) = scores[0], scores[1]
        themes = [cid for cid, pats in THEMES if sum(len(p.findall(text)) for p in pats) >= 2]
        if not (best >= 2 and best >= 2 * second):
            main = 'other'
        if main != 'other':
            r[2] = main; moved[main] += 1
            extra = sorted(set((r[3] or []) + themes) - {main}) if len(r) > 3 else themes
            if len(r) == 3: r.append(extra or None)
            else: r[3] = extra or None
        else:
            still += 1
    for r in rows:
        while len(r) > 3 and r[-1] is None: r.pop()
        if len(r) == 4 and r[3] is None: r.pop()
json.dump(data, open(P, 'w'), ensure_ascii=False, separators=(',', ':'))
print('moved out of "other":', sum(moved.values()), dict(moved.most_common()))
print('still other:', still)
