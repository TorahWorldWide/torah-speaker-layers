# BUILD PLAN — "Three Layers of Sinai" interactive physics visualization
## Handoff brief for a fresh AI session (this is self-contained — read it fully)

You are picking up a finished research project for **Tomer** (Hebrew speaker, non-technical maker, devout Karaite-leaning Jew, Torah-first/peshat, anti-Rashi). Your job is to BUILD AND DEPLOY an interactive web visualization from research that is ALREADY COMPLETE and saved in this same folder (`~/torah-research/`). You do NOT need to redo any research. All data exists in the `.md` files here.

Communicate with Tomer in Hebrew. Be terse. Ship working code, then send him a clickable link. Don't ask permission for small safe steps — just do them.

---

## 1. THE GOAL (what Tomer wants)
A visual, tactile, interactive web page where he can **see, touch, drag and feel every commandment of the Torah, grouped by WHO SPOKE IT.** This is the payload of a long research project that classified every Torah commandment by "speaker frame":

- **Layer A — God's direct speech** ("וַיְדַבֵּר ה' אֶל מֹשֶׁה לֵּאמֹר" + content in God's voice)
- **Layer B — Moses-attributed** (Moses tells the people "אֵלֶּה הַדְּבָרִים אֲשֶׁר צִוָּה ה'", no direct divine frame)
- **Layer C — narrator's voice** (e.g. gid hanasheh, "in the carriers shall bear it")
- **Layer D — Deuteronomy** (Moses's first-person retelling — sub-flagged D+A if it has an Exodus-Numbers parallel, D-only if unique)

He wants to: click a layer and see ALL its mitzvot; drag the mitzvot around; they should have **light physics** (float, collide, settle, get flung when grabbed); click a single mitzvah to read its detail (Hebrew text + source ref + permanence + category). The emotional point: feel viscerally how big each group is and where each law sits.

The research question behind it (for context, not required in UI but nice as an "About"): Tomer noticed the fire-prohibition (Exodus 35:3 "לֹא תְבַעֲרוּ אֵשׁ") is spoken ONLY by Moses, not God directly. The study confirmed his observation is accurate but the law is not unique — it has siblings (Numbers 30 vows, tefillin, Hakhel, ~35 Deuteronomy-only mitzvot). See `VERDICT.md` for the full conclusion.

---

## 2. DATA — your first task: build `data.json`
The mitzvot data is spread across these files. Extract it into ONE clean `data.json` (array of objects). Do this carefully — it is the core asset.

**Primary sources for the full 613 list with source + permanence + category + frame:**
- `findings_613_A.md` (mitzvot 1–205) — has a table: number, description (Hebrew), source ch:v, positive/negative, permanence (♾ eternal / 🏛 Temple-Land / ☄ one-time), category, AND speaker-frame (A/B/C/D)
- `findings_613_B.md` (206–410) — same table structure
- `findings_613_C.md` (411–613) — same

**Frame-accurate per-chapter scan (use to CORRECT/confirm the frame column):**
- `p2_genesis.md`, `p2_exodus_1.md`, `p2_exodus_2.md`, `p2_leviticus_1.md`, `p2_leviticus_2.md`, `p2_numbers_1.md`, `p2_numbers_2.md`, `p2_deut_1.md`, `p2_deut_2.md`, `p2_deut_3.md`
- These have the authoritative speaker-frame classification verse-by-verse. Where the 613 list and the p2 scan disagree on frame, TRUST the p2 scan (it read the actual text).

**Each data.json object should be:**
```json
{
  "id": 89,
  "he": "שלא להבעיר אש בשבת",
  "source": "שמות לה:ג",
  "type": "ל",            // ע (positive) or ל (negative)
  "frame": "B",            // A / B / C / D
  "frame_sub": null,        // for D: "D+A" or "D-only"
  "permanence": "eternal",  // eternal / temple-land / one-time
  "category": "שבת",
  "flagged": true           // true for the rare B/C/D-only "Moses-mouth" cases — these are the stars of the show
}
```
Aim for completeness (all ~613) but if some are ambiguous, include them with best-effort frame and `"flagged": false`. The FLAGGED ones (the B-frame and C-frame and D-only mitzvot) are the emotional core — make sure these are all captured correctly. The key flagged cases to never miss: Exodus 35:3 (fire), Numbers 30 (vows), Numbers 31:21-24 (Elazar/vessels), Numbers 36 (Tzelophchad daughters refinement), Exodus 13:9,16 (tefillin), Deut 31:10-13 (Hakhel), gid hanasheh (Genesis 32:33, frame C), plus the ~35 D-only listed in `p2_deut_2.md` and `p2_deut_3.md`.

---

## 3. THE BUILD (tech + UX)
**Single self-contained static site** (so it deploys to GitHub Pages with zero backend):
- `index.html`, `style.css`, `app.js`, `data.json`
- Physics: use **matter.js** (CDN, https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js) for real 2D physics — bodies, gravity, drag, collisions. This is the right tool for "float, collide, fling, settle."
- Render each mitzvah as a small circle/pill (Hebrew label or icon). Color by layer: A = warm gold/divine, B = blue (Moses), C = grey (narrator), D = green (Deuteronomy). Size optionally by category or uniform.
- **Layer toggle UI**: buttons "מפי אלוהים (A)", "מפי משה (B)", "קול המספר (C)", "דברים (D)", plus "הכל". Clicking a layer drops ONLY that group's bodies into the world (others fade/clear). Counts shown on each button.
- **Drag**: matter.js mouse constraint — Tomer grabs a mitzvah and flings it; it collides with others.
- **Click a mitzvah** (vs drag): open a side panel / modal showing he-text, source, permanence, category, and for flagged ones a one-line note ("מצווה נדירה — נאמרה רק בפי משה, ללא 'וידבר ה'' ישיר").
- **Flagged mitzvot glow / pulse** so the rare "Moses-mouth" laws stand out visually — this is the whole point of the research.
- RTL Hebrew, mobile-friendly (he reads on his phone). Big touch targets.
- Optional "About" panel summarizing the three layers and the fire-prohibition finding (pull 3-4 sentences from `VERDICT.md`).

Keep it ONE page, fast, no build step, no npm. Vanilla JS + matter.js CDN only.

---

## 4. DEPLOY (give Tomer a link)
- GitHub account: **TorahWorldWide**. Token at `~/.hermes/.github_token` (load with: `read -r TOK < ~/.hermes/.github_token; export TOK` — never echo it inline).
- Create/confirm repo (suggest name: `three-layers-sinai` or `shloshet-haregalim`... no — `torah-speaker-layers`). Push the site to `main`.
- Enable GitHub Pages on `main` (root or `/docs`). Use the REST API.
- Final link to send Tomer: `https://torahworldwide.github.io/<repo>/`
- The research `.md` files can live in the same repo under `/research/` so everything is together and public.

---

## 5. ORDER OF WORK
1. Read this file + `VERDICT.md` fully.
2. Extract `data.json` from the findings (section 2). This is the slow careful part — get the flagged cases right.
3. Build `index.html` + `style.css` + `app.js` with matter.js.
4. Test locally (start a server, use the Cloudflare quick-tunnel `~/serve.sh <port>` to eyeball it, or just open the file).
5. Push to TorahWorldWide GitHub, enable Pages.
6. Send Tomer the `https://torahworldwide.github.io/...` link in Hebrew, one line.

If anything blocks you (token bad, Pages won't enable), tell Tomer in one sentence with the specific blocker + one option — don't retry variations more than once.
