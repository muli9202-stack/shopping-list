import json, subprocess, sys, os, urllib.parse
from concurrent.futures import ThreadPoolExecutor
def find(o):
    if isinstance(o, dict):
        if 'attributedDescription' in o and isinstance(o['attributedDescription'], dict): return o['attributedDescription']
        for v in o.values():
            r = find(v)
            if r is not None: return r
    elif isinstance(o, list):
        for v in o:
            r = find(v)
            if r is not None: return r
def links(ad):
    out = []
    for run in ad.get('commandRuns', []) or []:
        try: u = run['onTap']['innertubeCommand']['urlEndpoint']['url']
        except Exception: continue
        if 'youtube.com/redirect' in u:
            q = urllib.parse.parse_qs(urllib.parse.urlparse(u).query).get('q')
            if q: u = q[0]
        out.append(u)
    return out
def get(vid):
    body = json.dumps({'context': {'client': {'clientName': 'WEB', 'clientVersion': '2.20261001.01.00', 'hl': 'he'}}, 'videoId': vid})
    for _ in range(3):
        r = subprocess.run(['curl','-s','--max-time','30','-X','POST','https://www.youtube.com/youtubei/v1/next?prettyPrint=false','-H','Content-Type: application/json','-d',body], capture_output=True, text=True).stdout
        try:
            ad = find(json.loads(r))
            return vid, {'d': (ad or {}).get('content', ''), 'l': links(ad) if ad else []}
        except Exception: pass
    return vid, None
if __name__ == '__main__':
    old = json.load(open('/tmp/claude-0/yt/descs.json'))
    data = json.load(open('/home/user/shopping-list/public/kitchen/seed-videos.json'))
    from newchefs import HE
    new = {c[0] for c in HE}
    ids = [r[0] for ch, rows in data.items() for r in rows if (ch in new or r[2] == 'other') and r[0] not in old]
    out = json.load(open('descs2.json')) if os.path.exists('descs2.json') else {}
    ids = [i for i in dict.fromkeys(ids) if i not in out]
    print('todo', len(ids), flush=True)
    n = 0
    with ThreadPoolExecutor(32) as ex:
        for vid, d in ex.map(get, ids):
            if d is not None: out[vid] = d
            n += 1
            if n % 1000 == 0:
                json.dump(out, open('descs2.json', 'w'), ensure_ascii=False); print(n, flush=True)
    json.dump(out, open('descs2.json', 'w'), ensure_ascii=False); print('done', len(out), flush=True)
