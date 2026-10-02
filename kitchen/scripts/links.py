import json, subprocess, re, urllib.parse
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
def urls(ad):
    out=[]
    for run in ad.get('commandRuns', []) or []:
        try: u=run['onTap']['innertubeCommand']['urlEndpoint']['url']
        except Exception: continue
        if 'youtube.com/redirect' in u:
            q=urllib.parse.parse_qs(urllib.parse.urlparse(u).query).get('q')
            if q: u=q[0]
        out.append(u)
    return out
def get(vid):
    body=json.dumps({'context':{'client':{'clientName':'WEB','clientVersion':'2.20261001.01.00','hl':'he'}},'videoId':vid})
    for _ in range(2):
        r=subprocess.run(['curl','-s','--max-time','30','-X','POST','https://www.youtube.com/youtubei/v1/next?prettyPrint=false','-H','Content-Type: application/json','-d',body],capture_output=True,text=True).stdout
        try:
            ad=find(json.loads(r))
            return vid, urls(ad) if ad else []
        except Exception: pass
    return vid, None
if __name__=='__main__':
    import sys
    for v,u in ThreadPoolExecutor(8).map(get, sys.argv[1:]): print(v,u)
