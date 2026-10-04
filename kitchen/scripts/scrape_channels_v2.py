import re, json, subprocess, os, sys
from concurrent.futures import ThreadPoolExecutor
OUT = '/tmp/claude-0/yt2/out'
os.makedirs(OUT, exist_ok=True)
def curl(args):
    return subprocess.run(['curl','-s','-L','--max-time','40','-H','Accept-Language: he,en']+args, capture_output=True, text=True).stdout
def walk(o, out, conts):
    if isinstance(o, dict):
        if 'lockupViewModel' in o:
            l = o['lockupViewModel']
            try: t = l['metadata']['lockupMetadataViewModel']['title']['content']
            except Exception: t = None
            if l.get('contentId') and t and l.get('contentType','').endswith('VIDEO'): out.append((l['contentId'], t))
        if 'shortsLockupViewModel' in o:
            s = o['shortsLockupViewModel']
            vid = (s.get('onTap',{}).get('innertubeCommand',{}).get('reelWatchEndpoint',{}) or {}).get('videoId') or s.get('entityId','').replace('shorts-shelf-item-','')
            try: t = s['overlayMetadata']['primaryText']['content']
            except Exception: t = s.get('accessibilityText','')
            if vid and t: out.append((vid, t))
        if 'continuationItemRenderer' in o:
            try: conts.append(o['continuationItemRenderer']['continuationEndpoint']['continuationCommand']['token'])
            except Exception: pass
        for v in o.values(): walk(v, out, conts)
    elif isinstance(o, list):
        for v in o: walk(v, out, conts)
def scrape(cid, tab, cap):
    path = f'channel/{cid}' if re.fullmatch(r'UC[\w-]{22}', cid) else cid
    s = curl([f'https://www.youtube.com/{path}/{tab}'])
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', s)
    if not m: return []
    ver = re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"', s).group(1)
    m2 = re.search(r'"VISITOR_DATA":"([^"]+)"', s); vd = m2.group(1) if m2 else ''
    vids = []; conts = []
    walk(json.loads(m.group(1)), vids, conts)
    seen = set(); res = []
    def add(lst):
        for v, t in lst:
            if v not in seen: seen.add(v); res.append({'id': v, 't': t})
    add(vids)
    while conts and len(res) < cap:
        body = json.dumps({'context': {'client': {'clientName': 'WEB', 'clientVersion': ver, 'hl': 'he', 'visitorData': vd}}, 'continuation': conts[0]})
        r = curl(['-X','POST','https://www.youtube.com/youtubei/v1/browse?prettyPrint=false','-H','Content-Type: application/json','-H','X-Youtube-Client-Name: 1','-H',f'X-Youtube-Client-Version: {ver}','-d',body])
        try: d = json.loads(r)
        except Exception: break
        v2 = []; c2 = []; walk(d, v2, c2)
        if not v2: break
        add(v2); conts = c2
    return res[:cap]
def job(ch):
    cid, chef_id, vcap, scap = ch
    f = f'{OUT}/{chef_id}.json'
    if os.path.exists(f): return chef_id, None
    v = scrape(cid, 'videos', vcap)
    s = scrape(cid, 'shorts', scap)
    json.dump({'videos': v, 'shorts': s}, open(f, 'w'), ensure_ascii=False)
    return chef_id, (len(v), len(s))
if __name__ == '__main__':
    jobs = json.load(open(sys.argv[1]))
    with ThreadPoolExecutor(6) as ex:
        for cid, r in ex.map(job, jobs): print(cid, r, flush=True)
