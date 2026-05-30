/* שלוש שכבות סיני — matter.js physics visualization */
(function () {
  "use strict";

  const COLORS = { A: "#e8b53d", B: "#4a90e2", C: "#9aa0a6", D: "#43c08a" };
  const LAYER_HE = {
    A: "מפי אלוהים", B: "מפי משה", C: "קול המספר", D: "ספר דברים"
  };
  const TYPE_HE = { "ע": "מצוות עשה", "ל": "מצוות לא תעשה" };
  const PERM_HE = {
    "eternal": "לדורות ♾", "temple-land": "תלוי במקדש / בארץ 🏛", "one-time": "הוראת שעה ☄"
  };

  const {
    Engine, Render, Runner, World, Bodies, Body,
    Composite, Mouse, MouseConstraint, Events
  } = Matter;

  const canvas = document.getElementById("world");
  let W = window.innerWidth, H = window.innerHeight;

  const engine = Engine.create();
  engine.gravity.y = 0.35;
  const world = engine.world;

  const render = Render.create({
    canvas, engine,
    options: { width: W, height: H, wireframes: false, background: "transparent", pixelRatio: window.devicePixelRatio || 1 }
  });
  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // ---- walls ----
  let walls = [];
  function buildWalls() {
    walls.forEach(w => World.remove(world, w));
    const t = 200;
    walls = [
      Bodies.rectangle(W / 2, H + t / 2 - 4, W + 400, t, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(-t / 2 + 2, H / 2, t, H * 3, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(W + t / 2 - 2, H / 2, t, H * 3, { isStatic: true, render: { visible: false } }),
    ];
    World.add(world, walls);
  }
  buildWalls();

  // ---- mouse drag ----
  const mouse = Mouse.create(canvas);
  mouse.pixelRatio = window.devicePixelRatio || 1;
  const mc = MouseConstraint.create(engine, {
    mouse, constraint: { stiffness: 0.18, render: { visible: false } }
  });
  World.add(world, mc);
  render.mouse = mouse;

  let DATA = [];
  let bodies = [];        // active mitzvah bodies
  let current = "all";

  function radiusFor() {
    const base = Math.sqrt((W * H) / 26000);
    return Math.max(13, Math.min(26, base));
  }

  function clearBodies() {
    bodies.forEach(b => World.remove(world, b));
    bodies = [];
  }

  function spawn(layer) {
    clearBodies();
    const items = layer === "all" ? DATA : DATA.filter(d => d.frame === layer);
    const r = radiusFor();
    items.forEach((d, i) => {
      const x = 40 + Math.random() * (W - 80);
      const y = -Math.random() * H * 0.8 - 20;
      const col = COLORS[d.frame] || "#888";
      const flagged = d.flagged;
      const body = Bodies.circle(x, y, r, {
        restitution: 0.55, friction: 0.04, frictionAir: 0.012,
        density: 0.0014,
        render: {
          fillStyle: col,
          strokeStyle: flagged ? "#fff8e0" : "rgba(255,255,255,.18)",
          lineWidth: flagged ? 2.5 : 1
        }
      });
      body.mitzvah = d;
      body.baseColor = col;
      body.flagged = flagged;
      bodies.push(body);
    });
    World.add(world, bodies);
  }

  // ---- custom render: labels + glow for flagged ----
  Events.on(render, "afterRender", function () {
    const ctx = render.context;
    const t = engine.timing.timestamp;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    bodies.forEach(b => {
      const p = b.position, r = b.circleRadius;
      if (b.flagged) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 380 + b.id);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4 + pulse * 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,248,210," + (0.08 + pulse * 0.16) + ")";
        ctx.fill();
      }
      // short label: source ref short (e.g. "לה:ג") or first word
      if (r >= 15) {
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.font = (r * 0.62 | 0) + "px 'Frank Ruhl Libre', serif";
        const label = shortLabel(b.mitzvah);
        ctx.fillText(label, p.x, p.y);
      }
    });
    ctx.restore();
  });

  function shortLabel(d) {
    // take the chapter:verse tail of the source
    const m = d.source.match(/([\u05d0-\u05ea]+):([\u05d0-\u05ea]+)/);
    if (m) return m[1].length <= 3 ? m[0] : m[2];
    return d.he.split(/\s+/)[0].slice(0, 4);
  }

  // ---- click vs drag detection ----
  let downPos = null, downBody = null;
  Events.on(mc, "mousedown", function () {
    downPos = { x: mouse.position.x, y: mouse.position.y };
    downBody = mc.body;
    hideHint();
  });
  Events.on(mc, "mouseup", function () {
    if (!downBody || !downPos) { downBody = null; return; }
    const dx = mouse.position.x - downPos.x, dy = mouse.position.y - downPos.y;
    if (Math.hypot(dx, dy) < 7 && downBody.mitzvah) {
      openDetail(downBody.mitzvah);
    }
    downBody = null;
  });

  // ---- detail panel ----
  const overlay = document.getElementById("overlay");
  const detail = document.getElementById("detail");
  function openDetail(d) {
    const fr = document.getElementById("detailFrame");
    fr.textContent = LAYER_HE[d.frame] + (d.frame_sub ? " · " + (d.frame_sub === "D-only" ? "רק בדברים" : "יש מקבילה") : "");
    fr.style.background = "rgba(255,255,255,.08)";
    fr.style.color = COLORS[d.frame];
    fr.style.border = "1px solid " + COLORS[d.frame];
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
    if (msg) { note.textContent = msg; note.classList.add("show"); }
    else note.classList.remove("show");
    overlay.classList.add("open");
    detail.classList.add("open");
  }
  function closeDetail() { overlay.classList.remove("open"); detail.classList.remove("open"); }
  document.getElementById("closeDetail").onclick = closeDetail;

  // ---- about ----
  const about = document.getElementById("about");
  document.getElementById("aboutBtn").onclick = () => { overlay.classList.add("open"); about.classList.add("open"); };
  document.getElementById("closeAbout").onclick = () => { overlay.classList.remove("open"); about.classList.remove("open"); };
  overlay.onclick = () => { closeDetail(); about.classList.remove("open"); };

  // ---- layer buttons ----
  document.querySelectorAll(".layer-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".layer-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      current = btn.dataset.layer;
      spawn(current);
      hideHint();
    };
  });

  function hideHint() { document.getElementById("hint").classList.add("gone"); }

  // ---- resize ----
  let rzT;
  window.addEventListener("resize", () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      W = window.innerWidth; H = window.innerHeight;
      render.canvas.width = W * (window.devicePixelRatio || 1);
      render.canvas.height = H * (window.devicePixelRatio || 1);
      render.options.width = W; render.options.height = H;
      Render.setPixelRatio(render, window.devicePixelRatio || 1);
      buildWalls();
      spawn(current);
    }, 220);
  });

  // ---- load data ----
  fetch("data.json").then(r => r.json()).then(data => {
    DATA = data;
    const counts = { all: data.length, A: 0, B: 0, C: 0, D: 0 };
    data.forEach(d => { counts[d.frame] = (counts[d.frame] || 0) + 1; });
    document.getElementById("c-all").textContent = counts.all;
    ["A", "B", "C", "D"].forEach(k => document.getElementById("c-" + k).textContent = counts[k] || 0);
    spawn("all");
  }).catch(err => {
    document.getElementById("hint").textContent = "שגיאה בטעינת הנתונים";
    console.error(err);
  });
})();
