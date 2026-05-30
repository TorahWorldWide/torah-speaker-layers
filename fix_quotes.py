#!/usr/bin/env python3
import json, re, time, urllib.request, urllib.parse, sys

BOOK = {
    'בראשית':'Genesis','שמות':'Exodus','ויקרא':'Leviticus',
    'במדבר':'Numbers','דברים':'Deuteronomy','ירמיהו':'Jeremiah',
}
# Hebrew gematria -> int
VAL = {'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,
       'י':10,'כ':20,'ל':30,'מ':40,'נ':50,'ס':60,'ע':70,'פ':80,'צ':90,
       'ק':100,'ר':200,'ש':300,'ת':400,
       'ך':20,'ם':40,'ן':50,'ף':80,'ץ':90}
def gem(s):
    s=s.replace('"','').replace("'",'').replace('\u05f3','').replace('\u05f4','')
    return sum(VAL.get(c,0) for c in s)

def strip_nikud(t):  # keep nikud actually; just clean tags
    t=re.sub(r'<[^>]+>','',t)
    t=t.replace('\u05be',' ')  # maqaf to space optional - keep maqaf actually
    return t.strip()

CACHE={}
def fetch(book,ch,vs):
    ref=f"{book}.{ch}.{vs}"
    if ref in CACHE: return CACHE[ref]
    url=f"https://www.sefaria.org/api/texts/{urllib.parse.quote(ref)}?context=0&commentary=0"
    for attempt in range(3):
        try:
            req=urllib.request.Request(url, headers={'User-Agent':'torah-viz/1.0'})
            with urllib.request.urlopen(req, timeout=20) as r:
                d=json.load(r)
            he=d.get('he')
            if isinstance(he,list): he=' '.join(x for x in he if x)
            he=re.sub(r'<[^>]+>','',he or '').strip()
            CACHE[ref]=he
            return he
        except Exception as e:
            time.sleep(1.5*(attempt+1))
    CACHE[ref]=None
    return None

def parse_source(s):
    s=s.strip()
    parts=re.split(r'[ \u00a0]+', s, maxsplit=1)
    if len(parts)<2: return None
    book=BOOK.get(parts[0])
    if not book: return None
    m=re.match(r'([\u05d0-\u05ea\"\u05f3]+):([\u05d0-\u05ea\"\u05f3]+)', parts[1])
    if not m: return None
    ch=gem(m.group(1))
    # verse may be a range a–b ; take first
    vraw=re.split(r'[\u2013\u2014\-]', m.group(2))[0]
    vs=gem(vraw)
    if ch<1 or vs<1: return None
    return book,ch,vs

data=json.load(open('data.json'))
fixed=0; failed=[]
for i,m in enumerate(data):
    p=parse_source(m.get('source',''))
    if not p:
        failed.append((m['id'],m.get('source'),'parse'))
        continue
    txt=fetch(*p)
    time.sleep(0.12)
    if txt and len(txt)>3:
        m['quote']=txt
        m['quote_ref']=f"{p[0]} {p[1]}:{p[2]}"
        fixed+=1
    else:
        failed.append((m['id'],m.get('source'),'fetch'))
    if (i+1)%50==0:
        print(f"  ...{i+1}/{len(data)} done, fixed={fixed}", flush=True)

json.dump(data, open('data.json','w'), ensure_ascii=False, indent=1)
print(f"DONE. fixed={fixed} failed={len(failed)} total={len(data)}", flush=True)
if failed:
    print("FAILED:", json.dumps(failed[:30], ensure_ascii=False), flush=True)
