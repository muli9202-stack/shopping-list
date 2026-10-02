import json, subprocess, sys, re
from concurrent.futures import ThreadPoolExecutor
def find(o):
    if isinstance(o, dict):
        if 'attributedDescription' in o and isinstance(o['attributedDescription'], dict): return o['attributedDescription'].get('content')
        for v in o.values():
            r = find(v)
            if r is not None: return r
    elif isinstance(o, list):
        for v in o:
            r = find(v)
            if r is not None: return r
    return None
def get(vid):
    body=json.dumps({'context':{'client':{'clientName':'WEB','clientVersion':'2.20261001.01.00','hl':'he'}},'videoId':vid})
    for _ in range(2):
        r=subprocess.run(['curl','-s','--max-time','30','-X','POST','https://www.youtube.com/youtubei/v1/next?prettyPrint=false','-H','Content-Type: application/json','-d',body],capture_output=True,text=True).stdout
        try: return vid, find(json.loads(r))
        except Exception: pass
    return vid, None
if __name__=='__main__':
    for vid,d in ThreadPoolExecutor(8).map(get, sys.argv[1:]): print(vid, len(d or ''), repr((d or '')[:400]))
