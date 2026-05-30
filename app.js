/* שלוש שכבות סיני — Obsidian-style force graph (interactive, deep zoom) */
(function () {
  "use strict";

  const COLORS = { A: "#e8b53d", B: "#4a90e2", C: "#9aa0a6", D: "#43c08a" };
  const LAYER_HE = { A: "מפי אלוהים", B: "מפי משה", C: "קול המספר", D: "ספר דברים" };
  const TYPE_HE = { "ע": "מצוות עשה", "ל": "מצוות לא תעשה" };
  const PERM_HE = { "eternal": "לדורות ♾", "temple-land": "תלוי במקדש / בארץ 🏛", "one-time": "הוראת שעה ☄" };

  const canvas = document.getElementById("sky");
  const ctx = canvas.getContext("2d");
  let DPR = 1, W = 0, H = 0;

  let DATA = [];
  let nodes = [];      // {d, x,y, vx,vy, r, frame, flagged, cat}
  let edges = [];      // {a, b, strong}
  let current = "all";
  let hintGone = false;

  // camera
  let cam = { x: 0, y: 0, z: 0.4 };
  const Z_MIN = 0.02, Z_MAX = 4.0;   // deep zoom-out (0.02) all the way in (4x)

  // hover / selection
  let hoverNode = null, selNode = null;
  let neighbors = new Set();

  function resize() {
    DPR = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);

  function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  // ---- build graph ----
  function build(layer) {
    const items = layer === "all" ? DATA : DATA.filter(d => d.frame === layer);
    nodes = []; edges = []; selNode = null; hoverNode = null; neighbors = new Set();

    const byId = {};
    const r0 = rng(7);
    items.forEach(d => {
      const a = r0() * Math.PI * 2, rad = Math.sqrt(r0()) * 900;
      const n = {
        d, x: Math.cos(a) * rad, y: Math.sin(a) * rad, vx: 0, vy: 0,
        frame: d.frame, flagged: d.flagged, cat: d.category,
        r: d.flagged ? 9 : (5 + (d.permanence === "eternal" ? 1.5 : 0))
      };
      nodes.push(n); byId[d.id] = n;
    });

    // edges: chain within each category (a constellation strand) + a hub link
    const byCat = {};
    items.forEach(d => { (byCat[d.category] = byCat[d.category] || []).push(d); });
    const hubs = [];
    Object.keys(byCat).forEach(cat => {
      const arr = byCat[cat];
      for (let i = 0; i < arr.length; i++) {
        if (i + 1 < arr.length) edges.push({ a: byId[arr[i].id], b: byId[arr[i + 1].id], strong: true });
        if (i + 3 < arr.length) edges.push({ a: byId[arr[i].id], b: byId[arr[i + 3].id], strong: false });
      }
      hubs.push(byId[arr[0].id]);
    });
    // weak ring between category hubs → one connected "brain"
    for (let i = 0; i < hubs.length; i++) edges.push({ a: hubs[i], b: hubs[(i + 1) % hubs.length], strong: false });

    // adjacency for highlight
    adj = {};
    edges.forEach(e => {
      (adj[e.a.d.id] = adj[e.a.d.id] || []).push(e.b);
      (adj[e.b.d.id] = adj[e.b.d.id] || []).push(e.a);
    });

    simTime = 0;
    fitView();
  }
  let adj = {};
  let simTime = 0;

  // ---- force simulation (cheap Obsidian-like) ----
  function step() {
    const n = nodes.length;
    if (!n) return;
    const alpha = Math.max(0.02, 0.35 * Math.exp(-simTime / 120));
    simTime++;

    // spatial grid for repulsion (keeps it O(n))
    const cell = 90;
    const grid = {};
    for (const a of nodes) {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      (grid[gx + "," + gy] = grid[gx + "," + gy] || []).push(a);
    }
    for (const a of nodes) {
      const gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
        const bucket = grid[(gx + ix) + "," + (gy + iy)];
        if (!bucket) continue;
        for (const b of bucket) {
          if (a === b) continue;
          let dx = a.x - b.x, dy = a.y - b.y;
          let d2 = dx * dx + dy * dy; if (d2 < 0.01) { d2 = 0.01; dx = Math.random(); }
          if (d2 > cell * cell * 4) continue;
          const f = 360 / d2;
          const inv = 1 / Math.sqrt(d2);
          a.vx += dx * inv * f * alpha; a.vy += dy * inv * f * alpha;
        }
      }
    }
    // link springs
    for (const e of edges) {
      const a = e.a, b = e.b;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const target = e.strong ? 46 : 120;
      const k = (e.strong ? 0.035 : 0.012) * alpha;
      const f = (dist - target) * k;
      const ux = dx / dist, uy = dy / dist;
      a.vx += ux * f; a.vy += uy * f; b.vx -= ux * f; b.vy -= uy * f;
    }
    // gentle gravity to centre + integrate
    for (const a of nodes) {
      a.vx += -a.x * 0.0008 * alpha; a.vy += -a.y * 0.0008 * alpha;
      a.vx *= 0.86; a.vy *= 0.86;
      if (a !== dragNode) { a.x += a.vx; a.y += a.vy; }
    }
  }

  // ---- transforms ----
  function w2s(x, y) { return { x: (x - cam.x) * cam.z + W / 2, y: (y - cam.y) * cam.z + H / 2 }; }
  function s2w(x, y) { return { x: (x - W / 2) / cam.z + cam.x, y: (y - H / 2) / cam.z + cam.y }; }

  function bounds() {
    if (!nodes.length) return { minx: -500, miny: -500, maxx: 500, maxy: 500 };
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const a of nodes) { if (a.x < minx) minx = a.x; if (a.y < miny) miny = a.y; if (a.x > maxx) maxx = a.x; if (a.y > maxy) maxy = a.y; }
    return { minx, miny, maxx, maxy };
  }
  function fitView() {
    const b = bounds();
    cam.x = (b.minx + b.maxx) / 2; cam.y = (b.miny + b.maxy) / 2;
    const zx = W / (b.maxx - b.minx + 240), zy = H / (b.maxy - b.miny + 240);
    cam.z = Math.max(Z_MIN, Math.min(1, Math.min(zx, zy)));
  }

  // ---- draw ----
  function draw(ts) {
    step();
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H * 0.32, 0, W / 2, H * 0.32, Math.max(W, H) * 0.85);
    g.addColorStop(0, "#11162a"); g.addColorStop(1, "#070812");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const t = ts || 0;

    const focus = selNode || hoverNode;

    // edges
    ctx.lineCap = "round";
    for (const e of edges) {
      const a = w2s(e.a.x, e.a.y), b = w2s(e.b.x, e.b.y);
      if ((a.x < 0 && b.x < 0) || (a.x > W && b.x > W) || (a.y < 0 && b.y < 0) || (a.y > H && b.y > H)) continue;
      const col = COLORS[e.a.frame] || "#889";
      let al = e.strong ? 0.16 : 0.06;
      let lw = (e.strong ? 0.9 : 0.5) * Math.max(0.5, cam.z);
      if (focus && (e.a === focus || e.b === focus)) { al = 0.85; lw = 1.8 * Math.max(0.7, cam.z); }
      else if (focus) { al *= 0.25; }
      ctx.globalAlpha = al; ctx.strokeStyle = (focus && (e.a === focus || e.b === focus)) ? "#fff" : col;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // nodes
    const showLabels = cam.z > 0.9;
    for (const nd of nodes) {
      const p = w2s(nd.x, nd.y);
      if (p.x < -40 || p.x > W + 40 || p.y < -40 || p.y > H + 40) continue;
      const col = COLORS[nd.frame] || "#888";
      const rr = Math.max(1.1, nd.r * cam.z);
      const dim = focus && nd !== focus && !neighbors.has(nd);
      const tw = 0.8 + 0.2 * Math.sin(t / 520 + nd.x);

      if (nd.flagged) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 430 + nd.y);
        ctx.globalAlpha = (dim ? 0.05 : 0.12) + pulse * (dim ? 0.05 : 0.2);
        ctx.fillStyle = "#fff8e0";
        ctx.beginPath(); ctx.arc(p.x, p.y, rr + 3 + pulse * 6, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = (dim ? 0.12 : 0.32) * tw;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(p.x, p.y, rr * 2.0, 0, 6.283); ctx.fill();
      ctx.globalAlpha = dim ? 0.3 : 1;
      ctx.fillStyle = nd === focus ? "#fff" : (nd.flagged ? "#fff6d8" : col);
      ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.283); ctx.fill();

      if ((showLabels && !dim) || nd === focus || (focus && neighbors.has(nd))) {
        ctx.globalAlpha = nd === focus ? 1 : Math.min(1, (cam.z - 0.9) * 2 + (focus ? 0.6 : 0));
        if (ctx.globalAlpha > 0.05) {
          ctx.fillStyle = "rgba(244,241,232,.9)";
          ctx.font = "500 12px Heebo"; ctx.textAlign = "center"; ctx.textBaseline = "top";
          ctx.fillText(shortLabel(nd.d), p.x, p.y + rr + 3);
        }
      }
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  function shortLabel(d) {
    const m = d.source.match(/([\u05d0-\u05ea]+):([\u05d0-\u05ea]+)/);
    return m ? m[0] : d.he.split(/\s+/).slice(0, 2).join(" ");
  }

  // ---- pick ----
  function pick(sx, sy) {
    const w = s2w(sx, sy); let best = null, bd = 1e9;
    for (const nd of nodes) {
      const dd = (nd.x - w.x) ** 2 + (nd.y - w.y) ** 2;
      const hitR = Math.max(14, nd.r * 2.2) / cam.z;
      if (dd < hitR * hitR && dd < bd) { best = nd; bd = dd; }
    }
    return best;
  }
  function setFocus(nd) {
    selNode = nd; neighbors = new Set();
    if (nd && adj[nd.d.id]) adj[nd.d.id].forEach(x => neighbors.add(x));
  }

  // ---- interaction ----
  let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0, dragNode = null;
  canvas.addEventListener("mousedown", e => {
    dragging = true; moved = false; lastX = downX = e.clientX; lastY = downY = e.clientY;
    dragNode = pick(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", e => {
    if (!dragging) { const h = pick(e.clientX, e.clientY); hoverNode = h; canvas.style.cursor = h ? "pointer" : "grab"; return; }
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) moved = true;
    if (dragNode) { const w = s2w(e.clientX, e.clientY); dragNode.x = w.x; dragNode.y = w.y; dragNode.vx = dragNode.vy = 0; simTime = 0; }
    else { cam.x -= dx / cam.z; cam.y -= dy / cam.z; }
    lastX = e.clientX; lastY = e.clientY; killHint();
  });
  window.addEventListener("mouseup", e => {
    if (dragging && !moved) { const nd = pick(e.clientX, e.clientY); if (nd) { setFocus(nd); openDetail(nd.d); } else setFocus(null); }
    dragging = false; dragNode = null;
  });
  canvas.addEventListener("wheel", e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });

  // touch
  let tMode = 0, pinchD0 = 0, pinchZ0 = 1, tcx = 0, tcy = 0;
  canvas.addEventListener("touchstart", e => {
    if (e.touches.length === 1) { tMode = 1; moved = false; lastX = downX = e.touches[0].clientX; lastY = downY = e.touches[0].clientY; dragNode = pick(downX, downY); }
    else if (e.touches.length === 2) { tMode = 2; pinchD0 = d2(e.touches); pinchZ0 = cam.z; tcx = (e.touches[0].clientX + e.touches[1].clientX) / 2; tcy = (e.touches[0].clientY + e.touches[1].clientY) / 2; }
  }, { passive: true });
  canvas.addEventListener("touchmove", e => {
    if (tMode === 1 && e.touches.length === 1) {
      const x = e.touches[0].clientX, y = e.touches[0].clientY, dx = x - lastX, dy = y - lastY;
      if (Math.abs(x - downX) + Math.abs(y - downY) > 6) moved = true;
      if (dragNode) { const w = s2w(x, y); dragNode.x = w.x; dragNode.y = w.y; dragNode.vx = dragNode.vy = 0; simTime = 0; }
      else { cam.x -= dx / cam.z; cam.y -= dy / cam.z; }
      lastX = x; lastY = y; killHint();
    } else if (tMode === 2 && e.touches.length === 2) {
      const d = d2(e.touches); zoomTo(tcx, tcy, Math.max(Z_MIN, Math.min(Z_MAX, pinchZ0 * (d / pinchD0)))); killHint();
    }
  }, { passive: true });
  canvas.addEventListener("touchend", e => {
    if (tMode === 1 && !moved) { const nd = pick(downX, downY); if (nd) { setFocus(nd); openDetail(nd.d); } else setFocus(null); }
    if (e.touches.length === 0) { tMode = 0; dragNode = null; }
  }, { passive: true });
  function d2(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }

  function zoomAt(sx, sy, m) { zoomTo(sx, sy, Math.max(Z_MIN, Math.min(Z_MAX, cam.z * m))); }
  function zoomTo(sx, sy, nz) { const b = s2w(sx, sy); cam.z = nz; const a = s2w(sx, sy); cam.x += b.x - a.x; cam.y += b.y - a.y; }

  // ---- detail ----
  const overlay = document.getElementById("overlay");
  const detail = document.getElementById("detail");
  function openDetail(d) {
    const fr = document.getElementById("detailFrame");
    const sub = d.frame_sub ? " · " + (d.frame_sub === "D-only" ? "רק בדברים" : "יש מקבילה") : "";
    fr.textContent = LAYER_HE[d.frame] + sub;
    fr.style.background = "rgba(255,255,255,.08)"; fr.style.color = COLORS[d.frame]; fr.style.border = "1px solid " + COLORS[d.frame];
    document.getElementById("detailHe").textContent = d.he;
    // Torah quote (from research)
    const qbox = document.getElementById("detailQuote");
    if (d.quote) { qbox.textContent = "\u201c" + d.quote + "\u201d"; qbox.classList.add("show"); }
    else qbox.classList.remove("show");
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

  const about = document.getElementById("about");
  document.getElementById("aboutBtn").onclick = () => { overlay.classList.add("open"); about.classList.add("open"); };
  document.getElementById("closeAbout").onclick = () => { overlay.classList.remove("open"); about.classList.remove("open"); };
  overlay.onclick = () => { overlay.classList.remove("open"); detail.classList.remove("open"); about.classList.remove("open"); };

  document.getElementById("zin").onclick = () => zoomAt(W / 2, H / 2, 1.45);
  document.getElementById("zout").onclick = () => zoomAt(W / 2, H / 2, 1 / 1.45);
  document.getElementById("zfit").onclick = () => fitView();

  document.querySelectorAll(".layer-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active"); current = btn.dataset.layer; build(current); killHint();
    };
  });
  function killHint() { if (!hintGone) { document.getElementById("hint").classList.add("gone"); hintGone = true; } }

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
