import json, re, subprocess, html, os, sys
from concurrent.futures import ThreadPoolExecutor
from links import get as get_links
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
SKIP = re.compile(r'(youtube\.com|youtu\.be|instagram\.com|facebook\.com|fb\.me|tiktok\.com|twitter\.com|x\.com/|amazon\.|amzn\.|pinterest\.|spotify\.|apple\.com|patreon\.|discord\.|whatsapp|t\.me/|linktr\.ee|threads\.net|/shop|merch|store\.|book\.|wa\.me|bit\.ly/.*shop)', re.I)

def walk(o):
    if isinstance(o, dict):
        t = o.get('@type')
        if t == 'Recipe' or (isinstance(t, list) and 'Recipe' in t): return o
        for v in o.values():
            r = walk(v)
            if r: return r
    if isinstance(o, list):
        for v in o:
            r = walk(v)
            if r: return r

def clean(s):
    s = html.unescape(re.sub(r'<[^>]+>', ' ', str(s)))
    return re.sub(r'\s+', ' ', s.replace('\xa0', ' ')).strip()

def steps_of(ins):
    out = []
    if isinstance(ins, str):
        parts = [clean(x) for x in re.split(r'\n+|<br\s*/?>|</p>|</li>', ins)]
        return [p for p in parts if p]
    if isinstance(ins, dict): ins = [ins]
    for x in ins or []:
        if isinstance(x, str):
            if clean(x): out.append(clean(x))
        elif isinstance(x, dict):
            if x.get('@type') == 'HowToSection':
                name = clean(x.get('name', ''))
                if name: out.append(name.rstrip(':') + ':')
                out += steps_of(x.get('itemListElement', []))
            else:
                t = clean(x.get('text') or x.get('name') or '')
                if t: out.append(t)
    return out

WORD = re.compile(r'[\w֐-׿]{3,}')
STOP = {'the','and','with','for','recipe','recipes','how','make','easy','best','מתכון','מתכונים','עם','של','איך','הכי','פרק','episode'}
def words(s): return {w.lower() for w in WORD.findall(s)} - STOP
def stems(ws): return {w[:4] for w in ws}

def fetch_recipe(url):
    try:
        s = subprocess.run(['curl', '-s', '-L', '--max-time', '25', '-A', UA, url], capture_output=True, text=True, errors='ignore').stdout
    except Exception:
        return None
    for b in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', s, re.S):
        try: r = walk(json.loads(b.strip()))
        except Exception: continue
        if r: return r
    return None

def process(item):
    vid, title = item
    _, links = get_links(vid)
    if not links: return vid, None
    cands = [u for u in links if not SKIP.search(u)][:3]
    tw = stems(words(title))
    for u in cands:
        r = fetch_recipe(u)
        if not r: continue
        name = clean(r.get('name', ''))
        if tw and not (tw & stems(words(name))): continue   # a different dish linked from the description
        raw = r.get('recipeIngredient') or r.get('ingredients') or []
        flat = []
        for x in (raw if isinstance(raw, list) else [raw]):
            flat += x if isinstance(x, list) else [x]
        ing = [clean(x) for x in flat]
        ing = [x for x in ing if x]
        st = steps_of(r.get('recipeInstructions'))
        if ing and st:
            return vid, {'name': name, 'ing': ing, 'steps': st, 'url': u}
    return vid, None

if __name__ == '__main__':
    seed = json.load(open('/home/user/shopping-list/kitchen/src/seedRecipes.json'))
    have = {r[0] for r in seed if r[4]}
    videos = json.load(open('/home/user/shopping-list/kitchen/src/seedVideos.json'))
    todo = [(r[0], r[1]) for c in videos for r in videos[c] if r[0] not in have]
    out = json.load(open('site.json')) if os.path.exists('site.json') else {}
    todo = [t for t in todo if t[0] not in out]
    print('todo', len(todo), flush=True)
    n = 0
    with ThreadPoolExecutor(40) as ex:
        for vid, rec in ex.map(process, todo):
            out[vid] = rec
            n += 1
            if n % 250 == 0:
                json.dump(out, open('site.json', 'w'), ensure_ascii=False)
                print(n, sum(1 for v in out.values() if v), flush=True)
    json.dump(out, open('site.json', 'w'), ensure_ascii=False)
    print('done', len(out), sum(1 for v in out.values() if v), flush=True)
