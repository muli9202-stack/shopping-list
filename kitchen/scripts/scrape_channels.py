import re, json, subprocess, sys, os
OUT='/tmp/claude-0/yt'
def curl(args):
    return subprocess.run(['curl','-s','-L','--max-time','40','-H','Accept-Language: he,en']+args, capture_output=True, text=True).stdout

def walk(o, out, conts):
    if isinstance(o, dict):
        if 'lockupViewModel' in o:
            l=o['lockupViewModel']
            vid=l.get('contentId'); 
            try: t=l['metadata']['lockupMetadataViewModel']['title']['content']
            except Exception: t=None
            if vid and t and l.get('contentType','').endswith('VIDEO'): out.append((vid,t))
        if 'continuationItemRenderer' in o:
            try: conts.append(o['continuationItemRenderer']['continuationEndpoint']['continuationCommand']['token'])
            except Exception: pass
        for v in o.values(): walk(v,out,conts)
    elif isinstance(o, list):
        for v in o: walk(v,out,conts)

def scrape(url, cap):
    s=curl([url.rstrip('/')+'/videos'])
    m=re.search(r'var ytInitialData = (\{.*?\});</script>',s)
    if not m: return None
    key=re.search(r'"INNERTUBE_API_KEY":"([^"]+)"',s).group(1)
    ver=re.search(r'"INNERTUBE_CLIENT_VERSION":"([^"]+)"',s).group(1)
    m2=re.search(r'"VISITOR_DATA":"([^"]+)"',s); vd=m2.group(1) if m2 else ''
    vids=[]; conts=[]
    walk(json.loads(m.group(1)),vids,conts)
    seen=set(); res=[]
    def add(lst):
        for v,t in lst:
            if v not in seen: seen.add(v); res.append({'id':v,'t':t})
    add(vids)
    while conts and len(res)<cap:
        tok=conts[0]
        body=json.dumps({'context':{'client':{'clientName':'WEB','clientVersion':ver,'hl':'he','visitorData':vd}},'continuation':tok})
        r=curl(['-X','POST','https://www.youtube.com/youtubei/v1/browse?prettyPrint=false','-H','Content-Type: application/json','-H','X-Youtube-Client-Name: 1','-H',f'X-Youtube-Client-Version: {ver}','-d',body])
        try: d=json.loads(r)
        except Exception: break
        v2=[];c2=[]; walk(d,v2,c2)
        if not v2: break
        add(v2); conts=c2
    return res[:cap]

chefs=json.load(open(OUT+'/chefs.json'))
for c in chefs:
    f=f"{OUT}/{c['id']}.json"
    if os.path.exists(f): continue
    r=scrape(c['url'], c['cap'])
    json.dump(r or [], open(f,'w'), ensure_ascii=False)
    print(c['id'], len(r or []), flush=True)
