import json, re, subprocess, sys, urllib.parse
def curl(args): return subprocess.run(['curl','-s','-L','--max-time','40','-H','Accept-Language: he,en']+args,capture_output=True,text=True).stdout
def walk(o, out):
    if isinstance(o, dict):
        if 'channelRenderer' in o:
            c=o['channelRenderer']
            title=c.get('title',{}).get('simpleText','')
            subs=(c.get('videoCountText') or {}).get('simpleText','') or ''.join(r.get('text','') for r in (c.get('videoCountText') or {}).get('runs',[]))
            handle=(c.get('subscriberCountText') or {}).get('simpleText','')
            url=c.get('navigationEndpoint',{}).get('browseEndpoint',{}).get('canonicalBaseUrl','')
            out.append({'id':c.get('channelId'),'title':title,'subs':subs,'handle':handle,'url':url})
        for v in o.values(): walk(v,out)
    elif isinstance(o,list):
        for v in o: walk(v,out)
def search(q):
    s=curl([f'https://www.youtube.com/results?search_query={urllib.parse.quote(q)}&sp=EgIQAg%253D%253D&hl=he&gl=IL'])
    m=re.search(r'var ytInitialData = (\{.*?\});</script>',s)
    out=[]
    if m: walk(json.loads(m.group(1)),out)
    return out
if __name__=='__main__':
    for c in search(sys.argv[1]): print(c)
