/* שלוש שכבות סיני — star map / skill-tree (pan + zoom canvas) */
(function () {
  "use strict";

  const COLORS = { A: "#e8b53d", B: "#4a90e2", C: "#9aa0a6", D: "#43c08a" };
  const LAYER_HE = { A: "מפי אלוהים", B: "מפי משה", C: "קול המספר", D: "ספר דברים" };
  const TYPE_HE = { "ע": "מצוות עשה", "ל": "מצוות לא תעשה" };
  const PERM_HE = { "eternal": "לדורות ♾", "temple-land": "תלוי במקדש / בארץ 🏛", "one-time": "הוראת שעה ☄" };

  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let DPR = window.devicePixelRatio || 1;
  let W = 0, H = 0;

  // world space
  let stars = [];            // {x,y,r,d,cat,frame,flagged}
  let constellations = [];   // {cat, members:[stars], cx, cy}
  let bgStars = [];          // decorative far stars (parallax)
  let WORLD = { w: 4000, h: 4000 };

  // camera
  let cam = { x: 2000, y: 2000, z: 0.5 };  // x,y = world point at screen centre; z = zoom
  const Z_MIN = 0.12, Z_MAX = 2.6;

  let DATA = [], current = "all";
  let hintGone = false;

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", () => { resize(); });

  // ---- deterministic pseudo-random (so layout is stable) ----
  function rng(seed) {
    let s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return () => (s = s * 16807 % 2147483647) / 2147483647;
  }

  // ---- build constellations from the filtered data ----
  function build(layer) {
    const items = layer === "all" ? DATA : DATA.filter(d => d.frame === layer);

    // group by category
    const groups = {};
    items.forEach(d => { (groups[d.category] = groups[d.category] || []).push(d); });
    const cats = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

    // lay constellations on a loose grid, size-ordered so big ones get room
    const n = cats.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.4)));
    const rows = Math.ceil(n / cols);
    const cellW = 760, cellH = 700;
    WORLD.w = cols * cellW; WORLD.h = rows * cellH;

    stars = []; constellations = [];
    cats.forEach((cat, ci) => {
      const members = groups[cat];
      const gx = (ci % cols) * cellW + cellW / 2;
      const gy = Math.floor(ci / cols) * cellH + cellH / 2;
      const r = rng(hash(cat) + members.length * 7);
      // arrange members in a rough spiral around the constellation centre
      const cstars = [];
      const k = members.length;
      const spread = Math.min(300, 70 + Math.sqrt(k) * 42);
      members.forEach((d, i) => {
        const t = i / Math.max(1, k);
        const ang = t * Math.PI * 2 * (1.8 + r() * 0.6) + r() * 0.5;
        const rad = spread * Math.sqrt(t) + r() * 26;
        const x = gx + Math.cos(ang) * rad;
        const y = gy + Math.sin(ang) * rad * 0.92;
        const star = {
          x, y, d, cat, frame: d.frame, flagged: d.flagged,
          r: d.flagged ? 7.5 : (4.2 + (d.permanence === "eternal" ? 1.6 : 0)),
          tw: r() * Math.PI * 2  // twinkle phase
        };
        cstars.push(star); stars.push(star);
      });
      constellations.push({ cat, members: cstars, cx: gx, cy: gy });
    });

    // decorative background starfield
    bgStars = [];
    const br = rng(99);
    for (let i = 0; i < 320; i++) {
      bgStars.push({ x: br() * WORLD.w, y: br() * WORLD.h, r: br() * 1.1 + 0.2, a: br() * 0.5 + 0.1 });
    }

    fitView();
  }

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // fit whole world so you can see ~all at once, then user zooms in
  function fitView() {
    cam.x = WORLD.w / 2; cam.y = WORLD.h / 2;
    const zx = W / (WORLD.w + 200), zy = H / (WORLD.h + 200);
    cam.z = Math.max(Z_MIN, Math.min(zx, zy));
  }

  // ---- transforms ----
  function worldToScreen(wx, wy) {
    return { x: (wx - cam.x) * cam.z + W / 2, y: (wy - cam.y) * cam.z + H / 2 };
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - W / 2) / cam.z + cam.x, y: (sy - H / 2) / cam.z + cam.y };
  }

  // ---- render loop ----
  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    // nebula glow background
    const g = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, Math.max(W, H) * 0.8);
    g.addColorStop(0, "#13182c"); g.addColorStop(1, "#070812");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const t = ts || 0;

    // far starfield (subtle)
    ctx.save();
    for (const b of bgStars) {
      const p = worldToScreen(b.x, b.y);
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      ctx.globalAlpha = b.a * (0.6 + 0.4 * Math.sin(t / 900 + b.x));
      ctx.fillStyle = "#cdd6ff";
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, b.r * cam.z * 0.8), 0, 6.283); ctx.fill();
    }
    ctx.restore();

    // constellation lines
    ctx.lineCap = "round";
    for (const c of constellations) {
      const col = COLORS[c.members[0] ? c.members[0].frame : "A"] || "#889";
      ctx.strokeStyle = col;
      // connect each star to the next (constellation strand)
      for (let i = 0; i + 1 < c.members.length; i++) {
        const a = worldToScreen(c.members[i].x, c.members[i].y);
        const b = worldToScreen(c.members[i + 1].x, c.members[i + 1].y);
        if (offscreen(a) && offscreen(b)) continue;
        ctx.globalAlpha = 0.14;
        ctx.lineWidth = Math.max(0.4, 0.8 * cam.z);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // constellation labels (only when zoomed out enough to read groups)
    if (cam.z < 0.62) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "700 " + Math.max(12, 17 * Math.min(1, cam.z * 1.7)) + "px Heebo";
      for (const c of constellations) {
        const p = worldToScreen(c.cx, c.cy - 220);
        if (offscreen(p, 120)) continue;
        ctx.fillStyle = "rgba(200,206,235,.4)";
        ctx.fillText(c.cat + " · " + c.members.length, p.x, p.y);
      }
    }

    // stars
    for (const s of stars) {
      const p = worldToScreen(s.x, s.y);
      if (offscreen(p, 30)) continue;
      const col = COLORS[s.frame] || "#888";
      const rr = Math.max(1.4, s.r * cam.z);
      const tw = 0.78 + 0.22 * Math.sin(t / 480 + s.tw);

      if (s.flagged) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 420 + s.tw);
        ctx.globalAlpha = 0.10 + pulse * 0.20;
        ctx.fillStyle = "#fff8e0";
        ctx.beginPath(); ctx.arc(p.x, p.y, rr + 4 + pulse * 7, 0, 6.283); ctx.fill();
      }
      // glow
      ctx.globalAlpha = 0.35 * tw;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr * 2.1, 0, 6.283); ctx.fill();
      // core
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.flagged ? "#fff6d8" : col;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.283); ctx.fill();

      // label nearby stars when zoomed in
      if (cam.z > 1.05) {
        ctx.globalAlpha = Math.min(1, (cam.z - 1.05) * 2);
        ctx.fillStyle = "rgba(244,241,232,.85)";
        ctx.font = "500 " + (12) + "px Heebo";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(shortLabel(s.d), p.x, p.y + rr + 3);
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  function offscreen(p, m) { m = m || 0; return p.x < -m || p.x > W + m || p.y < -m || p.y > H + m; }
  function shortLabel(d) {
    const m = d.source.match(/([\u05d0-\u05ea]+):([\u05d0-\u05ea]+)/);
    if (m) return m[0];
    return d.he.split(/\s+/).slice(0, 2).join(" ");
  }

  // ---- interaction: pan, zoom, tap ----
  let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
  canvas.addEventListener("mousedown", e => { dragging = true; moved = false; lastX = downX = e.clientX; lastY = downY = e.clientY; });
  window.addEventListener("mousemove", e => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) moved = true;
    cam.x -= dx / cam.z; cam.y -= dy / cam.z; lastX = e.clientX; lastY = e.clientY; killHint();
  });
  window.addEventListener("mouseup", e => {
    if (dragging && !moved) tapAt(e.clientX, e.clientY);
    dragging = false;
  });
  canvas.addEventListener("wheel", e => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0014));
  }, { passive: false });

  // touch
  let touchMode = 0, pinchD0 = 0, pinchZ0 = 1, tcx = 0, tcy = 0;
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) {
      touchMode = 1; moved = false;
      lastX = downX = e.touches[0].clientX; lastY = downY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      touchMode = 2;
      pinchD0 = dist2(e.touches); pinchZ0 = cam.z;
      tcx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      tcy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (touchMode === 1 && e.touches.length === 1) {
      const x = e.touches[0].clientX, y = e.touches[0].clientY;
      const dx = x - lastX, dy = y - lastY;
      if (Math.abs(x - downX) + Math.abs(y - downY) > 6) moved = true;
      cam.x -= dx / cam.z; cam.y -= dy / cam.z; lastX = x; lastY = y; killHint();
    } else if (touchMode === 2 && e.touches.length === 2) {
      const d = dist2(e.touches);
      const factor = (d / pinchD0);
      const target = Math.max(Z_MIN, Math.min(Z_MAX, pinchZ0 * factor));
      zoomTo(tcx, tcy, target); killHint();
    }
  }, { passive: true });
  canvas.addEventListener("touchend", e => {
    if (touchMode === 1 && !moved) tapAt(downX, downY);
    if (e.touches.length === 0) touchMode = 0;
  }, { passive: true });
  function dist2(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

  function zoomAt(sx, sy, mult) { zoomTo(sx, sy, Math.max(Z_MIN, Math.min(Z_MAX, cam.z * mult))); }
  function zoomTo(sx, sy, nz) {
    const before = screenToWorld(sx, sy);
    cam.z = nz;
    const after = screenToWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
  }

  function tapAt(sx, sy) {
    const w = screenToWorld(sx, sy);
    let best = null, bestD = 1e9;
    for (const s of stars) {
      const dd = (s.x - w.x) ** 2 + (s.y - w.y) ** 2;
      const hitR = Math.max(16, s.r * 2.4) / cam.z;
      if (dd < hitR * hitR && dd < bestD) { best = s; bestD = dd; }
    }
    if (best) openDetail(best.d);
  }

  // ---- detail ----
  const overlay = document.getElementById("overlay");
  const detail = document.getElementById("detail");
  function openDetail(d) {
    const fr = document.getElementById("detailFrame");
    const sub = d.frame_sub ? " · " + (d.frame_sub === "D-only" ? "רק בדברים" : "יש מקבילה") : "";
    fr.textContent = LAYER_HE[d.frame] + sub;
    fr.style.background = "rgba(255,255,255,.08)";
    fr.style.color = COLORS[d.frame]; fr.style.border = "1px solid " + COLORS[d.frame];
    document.getElementById("detailHe").textContent = d.he;
    document.getElementById("detailSrc").textContent = d.source;
    document.getElementById("detailType").textContent = TYPE_HE[d.type] || d.type;
    document.getElementById("detailPerm").textContent = PERM_HE[d.permanence] || d.permanence;
    document.getElementById("detailCat").textContent = d.category;
    const note = document.getElementById("detailNote");
    let msg = "";
    if (d.frame === "B") msg = "מצווה נדירה — נאמרה רק בפי משה אל העם, ללא \"וַיְדַבֵּר ה'\" ישיר לתוכן.";
    else if (d.frame === "C") msg = "הלכה שנובעת מהערת המספר (קול הנרטיב), לא מדיבור אלוהי ישיר ולא מנאום משה.";
    else if (d.frame === "D" && d.frame_sub === "D-only") msg = "מצווה הקיימת אך ורק בספר דברים, מפי משה — ללא מקבילה בשמות־ויקרא־במדבר במסגרת דיבור אלוהי ישיר.";
    if (msg) { note.textContent = msg; note.classList.add("show"); } else note.classList.remove("show");
    overlay.classList.add("open"); detail.classList.add("open");
  }
  document.getElementById("closeDetail").onclick = () => { overlay.classList.remove("open"); detail.classList.remove("open"); };

  // about
  const about = document.getElementById("about");
  document.getElementById("aboutBtn").onclick = () => { overlay.classList.add("open"); about.classList.add("open"); };
  document.getElementById("closeAbout").onclick = () => { overlay.classList.remove("open"); about.classList.remove("open"); };
  overlay.onclick = () => { overlay.classList.remove("open"); detail.classList.remove("open"); about.classList.remove("open"); };

  // zoom buttons
  document.getElementById("zin").onclick = () => zoomAt(W / 2, H / 2, 1.4);
  document.getElementById("zout").onclick = () => zoomAt(W / 2, H / 2, 1 / 1.4);
  document.getElementById("zfit").onclick = () => fitView();

  // layer tabs
  document.querySelectorAll(".layer-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      current = btn.dataset.layer;
      build(current); killHint();
    };
  });

  function killHint() { if (!hintGone) { document.getElementById("hint").classList.add("gone"); hintGone = true; } }

  // load
  resize();
  fetch("data.json").then(r => r.json()).then(data => {
    DATA = data.slice().sort((a, b) => a.id - b.id);
    const counts = { all: data.length, A: 0, B: 0, C: 0, D: 0 };
    data.forEach(d => counts[d.frame] = (counts[d.frame] || 0) + 1);
    document.getElementById("c-all").textContent = counts.all;
    ["A", "B", "C", "D"].forEach(k => document.getElementById("c-" + k).textContent = counts[k] || 0);
    build("all");
    requestAnimationFrame(draw);
  }).catch(err => { document.getElementById("hint").textContent = "שגיאה בטעינת הנתונים"; console.error(err); });
})();
