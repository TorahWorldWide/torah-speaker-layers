#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extract all 613 mitzvot from the three findings tables into a clean data.json,
classified by speaker-layer (A/B/C/D) per BUILD_PLAN.md."""
import json, re, os

ROOT = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(ROOT, "research")
FILES = ["findings_613_A.md", "findings_613_B.md", "findings_613_C.md"]

BOOKS = ["בראשית", "שמות", "ויקרא", "במדבר", "דברים"]

def norm_type(t):
    t = t.strip()
    # positive (עשה) vs negative (לא תעשה)
    if t.startswith("ע") and "ל" not in t.replace("עשה", ""):
        return "ע"
    if "עשה" in t and "לא" not in t and "ל\u05f4ת" not in t and "ל״ת" not in t:
        return "ע"
    if t == "ע":
        return "ע"
    return "ל"

def norm_perm(p):
    p = p.strip()
    if "♾" in p or "לדורות" in p or "נצחי" in p:
        return "eternal"
    if "☄" in p or "חד" in p or "הוראת שעה" in p or "היסטורי" in p:
        return "one-time"
    if "🏛" in p or "מקדש" in p or "ארץ" in p or "תלוי" in p or "יובל" in p:
        return "temple-land"
    return "eternal"

def book_of(source):
    s = source.strip()
    for b in BOOKS:
        if s.startswith(b):
            return b
    # sometimes source begins with a different token
    for b in BOOKS:
        if b in s:
            return b
    return "?"

def classify_layer(source, frame):
    book = book_of(source)
    f = frame.strip()
    # Deuteronomy is always layer D regardless of how the file labeled the frame
    if book == "דברים":
        return "D"
    if "משנה תורה" in f or "נדון בנפרד" in f or "דברים" in f.split("(")[0]:
        return "D"
    # narrator voice
    fhead = f.split("(")[0].strip()
    if fhead.startswith("C") or "נרטיב" in f or "קול המספר" in f or "המספר" in f:
        return "C"
    # genuine Moses-mouth in Exodus/Lev/Numbers
    if fhead.startswith("B"):
        return "B"
    if fhead.startswith("D"):
        return "D"
    return "A"

# D-only "star" keywords (from p2_deut_2 / p2_deut_3 analysis) — the emotional core
DONLY_KEYWORDS = [
    "מלך", "עמלק", "הקהל", "וידוי מעשר", "מעשר שני", "מעשר עני",
    "יבום", "חליצה", "עגלה ערופה", "בן סורר", "מסיג גבול", "נביא",
    "מסית", "עיר הנידחת", "לא תסור", "בית דין הגדול", "יפת תואר",
    "שילוח הקן", "מעקה", "מלקות", "לא תחסם", "שמיטת כספים",
    "מקרא ביכורים", "מוציא שם רע", "ממזר", "עמוני", "מואבי",
    "כלי גבר", "שעטנז",  # note שעטנז has A-parallel; keep conservative below
]
# refine: drop ones with clear A-parallel from the star list
DONLY_KEYWORDS = [k for k in DONLY_KEYWORDS if k not in ("שעטנז",)]

def is_donly(desc):
    return any(k in desc for k in DONLY_KEYWORDS)

# ---- Torah quote extraction (from existing research text only — no new research) ----
NIKKUD = re.compile(r"[\u0591-\u05c7]")
QUOTE_RE = re.compile(r"[\"\u201c\u201d\u05f4]([^\"\u201c\u201d\u05f4\n]{4,160})[\"\u201c\u201d\u05f4]")

def nikkud_count(s):
    return len(NIKKUD.findall(s))

def best_quote(*texts):
    """Pick the longest quoted Hebrew string that actually carries vowel points."""
    best = None
    for t in texts:
        if not t:
            continue
        for m in QUOTE_RE.finditer(t):
            q = m.group(1).strip().replace("**", "").strip(" …·-—\u05be")
            if nikkud_count(q) >= 3 and len(q) >= 6:
                # avoid picking the frame-label parentheticals; prefer verse-like text
                if best is None or len(q) > len(best):
                    best = q
    return best

# scan ALL research files to build a source-ref -> verse-quote fallback map
def norm_ref(book, ch):
    return book + "|" + ch

HEB_NUM = "אבגדהוזחטיכלמנסעפצקרשת"
def ref_keys_from_text(line):
    # find refs like "שמות כ:ב", "שמות כ\"ג, יט", "ויקרא י\"ט"
    keys = []
    for b in BOOKS:
        for m in re.finditer(re.escape(b) + r"\s+([\u05d0-\u05ea\u05f3\u05f4\"]{1,5})", line):
            ch = m.group(1).replace('"', '').replace('\u05f4', '').replace('\u05f3', '')
            if ch:
                keys.append(norm_ref(b, ch))
    return keys

SRCMAP = {}
def build_srcmap():
    for fn in os.listdir(RES):
        if not fn.endswith(".md"):
            continue
        try:
            with open(os.path.join(RES, fn), encoding="utf-8") as fh:
                for line in fh:
                    q = best_quote(line)
                    if not q:
                        continue
                    for k in ref_keys_from_text(line):
                        if k not in SRCMAP or len(q) > len(SRCMAP[k]):
                            SRCMAP[k] = q
        except Exception:
            pass
build_srcmap()

def quote_for(source, *inline):
    q = best_quote(*inline)
    if q:
        return q
    # fallback: match source book+chapter against the scanned map
    for b in BOOKS:
        if source.startswith(b):
            mm = re.search(re.escape(b) + r"\s*([\u05d0-\u05ea\u05f3\u05f4\"]{1,5})", source)
            if mm:
                ch = mm.group(1).replace('"', '').replace('\u05f4', '').replace('\u05f3', '')
                k = norm_ref(b, ch)
                if k in SRCMAP:
                    return SRCMAP[k]
    return None

rows = []
for fn in FILES:
    path = os.path.join(RES, fn)
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line.startswith("|"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 7:
                continue
            # skip header/separator rows
            first = cells[0].replace("*", "").strip()
            if not re.match(r"^\d+", first):
                continue
            m = re.match(r"(\d+)", first)
            mid = int(m.group(1))
            desc = cells[1].replace("**", "").strip()
            source = cells[2].replace("**", "").strip()
            typ = norm_type(cells[3])
            perm = norm_perm(cells[4])
            category = cells[5].strip()
            frame_raw = cells[6].replace("**", "").strip()
            layer = classify_layer(source, frame_raw)
            rows.append({
                "id": mid, "he": desc, "source": source, "type": typ,
                "frame": layer, "permanence": perm, "category": category,
                "_frameraw": frame_raw, "_desc": desc, "_line_quote": best_quote(frame_raw, desc),
            })

# dedupe: same source + same normalized first 4 words of description
seen = {}
deduped = []
for r in rows:
    key = (r["source"], " ".join(r["he"].split()[:4]))
    if key in seen:
        # keep the one whose layer is more specific (B/C/D over A) if conflict
        prev = seen[key]
        rank = {"A": 0, "D": 1, "C": 2, "B": 3}
        if rank.get(r["frame"], 0) > rank.get(prev["frame"], 0):
            prev["frame"] = r["frame"]
        continue
    seen[key] = r
    deduped.append(r)

# assign flagged + frame_sub
for r in deduped:
    layer = r["frame"]
    if layer == "B" or layer == "C":
        r["flagged"] = True
        r["frame_sub"] = None
    elif layer == "D":
        donly = is_donly(r["he"]) or "D-only" in r["_frameraw"] or "D-בלבד" in r["_frameraw"]
        r["frame_sub"] = "D-only" if donly else "D+A"
        r["flagged"] = bool(donly)
    else:
        r["flagged"] = False
        r["frame_sub"] = None
    # attach a real Torah quote pulled from the research text (no new research)
    r["quote"] = quote_for(r["source"], r.get("_line_quote"), r.get("_frameraw"))
    del r["_frameraw"]
    r.pop("_desc", None)
    r.pop("_line_quote", None)

# stats
from collections import Counter
cnt = Counter(r["frame"] for r in deduped)
flag = sum(1 for r in deduped if r["flagged"])
withq = sum(1 for r in deduped if r.get("quote"))
print("total:", len(deduped), "| layers:", dict(cnt), "| flagged:", flag, "| with quote:", withq)

out = os.path.join(ROOT, "data.json")
with open(out, "w", encoding="utf-8") as fh:
    json.dump(deduped, fh, ensure_ascii=False, indent=1)
print("wrote", out)
