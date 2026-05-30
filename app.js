/* שלוש שכבות סיני — neural-network physics (zero gravity) */
(function () {
  "use strict";

  const COLORS = { A: "#e8b53d", B: "#4a90e2", C: "#9aa0a6", D: "#43c08a" };
  const LAYER_HE = { A: "מפי אלוהים", B: "מפי משה", C: "קול המספר", D: "ספר דברים" };
  const TYPE_HE = { "ע": "מצוות עשה", "ל": "מצוות לא תעשה" };
  const PERM_HE = {
    "eternal": "לדורות ♾", "temple-land": "תלוי במקדש / בארץ 🏛", "one-time": "הוראת שעה ☄"
  };

  const {
    Engine, Render, Runner, World, Bodies, Body,
    Mouse, MouseConstraint, Constraint, Events
  } = Matter;

  const canvas = document.getElementById("world");
  let W = window.innerWidth, H = window.innerHeight;

  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;            // ← חלל. אפס גרוויטציה.
  const world = engine.world;

  const render = Render.create({
    canvas, engine,
    options: { width: W, height: H, wireframes: false, background: "transparent", pixelRatio: window.devicePixelRatio || 1 }
  });
  Render.run(render);
  const runner = Runner.create();
  Runner.run(runner, engine);

  // ---- soft walls (far out, so the brain floats freely) ----
  let walls = [];
  function buildWalls() {
    walls.forEach(w => World.remove(world, w));
    const t = 300, pad = 60;
    walls = [
      Bodies.rectangle(W / 2, -t / 2 - pad, W + 1200, t, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(W / 2, H + t / 2 + pad, W + 1200, t, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(-t / 2 - pad, H / 2, t, H + 1200, { isStatic: true, render: { visible: false } }),
      Bodies.rectangle(W + t / 2 + pad, H / 2, t, H + 1200, { isStatic: true, render: { visible: false } }),
    ];
    World.add(world, walls);
  }
  buildWalls();

  // ---- mouse drag (grabbing a neuron drags its whole web) ----
  const mouse = Mouse.create(canvas);
  mouse.pixelRatio = window.devicePixelRatio || 1;
  const mc = MouseConstraint.create(engine, {
    mouse, constraint: { stiffness: 0.09, render: { visible: false } }
  });
  World.add(world, mc);
  render.mouse = mouse;

  let DATA = [];
  let bodies = [];
  let links = [];          // {a, b, backbone}
  let constraints = [];
  let current = "all";

  function radiusFor() {
    const base = Math.sqrt((W * H) / 30000);
    return Math.max(12, Math.min(24, base));
  }

  function clearWorld() {
    constraints.forEach(c => World.remove(world, c));
    bodies.forEach(b => World.remove(world, b));
    bodies = []; links = []; constraints = [];
  }

  function spawn(layer) {
    clearWorld();
    const items = layer === "all" ? DATA : DATA.filter(d => d.frame === layer);
    const r = radiusFor();
    const cx = W / 2, cy = H / 2;
    const byId = {};

    items.forEach((d, i) => {
      // seed positions in a soft disc around the centre
      const ang = Math.random() * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * Math.min(W, H) * 0.42;
      const x = cx + Math.cos(ang) * rad;
      const y = cy + Math.sin(ang) * rad;
      const col = COLORS[d.frame] || "#888";
      const body = Bodies.circle(x, y, r, {
        restitution: 0.2, friction: 0.02, frictionAir: 0.045, density: 0.0012,
        render: {
          fillStyle: col,
          strokeStyle: d.flagged ? "#fff8e0" : "rgba(255,255,255,.16)",
          lineWidth: d.flagged ? 2.5 : 1
        }
      });
      body.mitzvah = d;
      body.flagged = d.flagged;
      bodies.push(body);
      byId[d.id] = body;
    });
    World.add(world, bodies);

    // ---- synapses: link mitzvot of the same category into strands ----
    const byCat = {};
    items.forEach(d => { (byCat[d.category] = byCat[d.category] || []).push(d); });
    const hubs = [];
    const linkLen = r * 2.7;

    function addLink(a, b, backbone) {
      if (!a || !b || a === b) return;
      const c = Constraint.create({
        bodyA: a, bodyB: b,
        stiffness: backbone ? 0.004 : 0.012,
        damping: 0.08,
        length: backbone ? r * 6 : linkLen,
        render: { visible: false }
      });
      constraints.push(c);
      links.push({ a, b, backbone });
    }

    Object.keys(byCat).forEach(cat => {
      const arr = byCat[cat];
      for (let i = 0; i < arr.length; i++) {
        const a = byId[arr[i].id];
        if (i + 1 < arr.length) addLink(a, byId[arr[i + 1].id], false);
        if (i + 2 < arr.length && Math.random() < 0.35) addLink(a, byId[arr[i + 2].id], false);
      }
      hubs.push(byId[arr[0].id]);
    });
    // weakly wire the category-hubs together → one connected brain
    for (let i = 0; i + 1 < hubs.length; i++) addLink(hubs[i], hubs[i + 1], true);

    World.add(world, constraints);
  }

  // ---- gentle centering force (keeps the brain floating in the middle) ----
  Events.on(engine, "beforeUpdate", function () {
    if (!bodies.length) return;
    const cx = W / 2, cy = H / 2;
    for (const b of bodies) {
      const dx = cx - b.position.x, dy = cy - b.position.y;
      Body.applyForce(b, b.position, { x: dx * 2.2e-6 * b.mass, y: dy * 2.2e-6 * b.mass });
    }
  });

  // ---- render synapses + glow + labels ----
  Events.on(render, "afterRender", function () {
    const ctx = render.context;
    const t = engine.timing.timestamp;

    // synapses
    ctx.save();
    ctx.lineCap = "round";
    for (const l of links) {
      const a = l.a.position, b = l.b.position;
      const col = l.a.mitzvah ? COLORS[l.a.mitzvah.frame] : "#889";
      const fire = (l.a.flagged || l.b.flagged) ? (0.5 + 0.5 * Math.sin(t / 320 + l.a.id)) : 0;
      ctx.strokeStyle = col;
      ctx.globalAlpha = l.backbone ? 0.07 : (0.14 + fire * 0.35);
      ctx.lineWidth = l.backbone ? 0.6 : (1 + fire * 1.4);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();

    // glow + labels
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const b of bodies) {
      const p = b.position, r = b.circleRadius;
      if (b.flagged) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 380 + b.id);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 4 + pulse * 7, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,248,210," + (0.08 + pulse * 0.17) + ")";
        ctx.fill();
      }
      if (r >= 14) {
        ctx.fillStyle = "rgba(255,255,255,.92)";
        ctx.font = ((r * 0.6) | 0) + "px 'Frank Ruhl Libre', serif";
        ctx.fillText(shortLabel(b.mitzvah), p.x, p.y);
      }
    }
    ctx.restore();
  });

  function shortLabel(d) {
    const m = d.source.match(/([\u05d0-\u05ea]+):([\u05d0-\u05ea]+)/);
    if (m) return m[1].length <= 3 ? m[0] : m[2];
    return d.he.split(/\s+/)[0].slice(0, 4);
  }

  // ---- click vs drag ----
  let downPos = null, downBody = null;
  Events.on(mc, "mousedown", function () {
    downPos = { x: mouse.position.x, y: mouse.position.y };
    downBody = mc.body;
    hideHint();
  });
  Events.on(mc, "mouseup", function () {
    if (downBody && downPos) {
      const dx = mouse.position.x - downPos.x, dy = mouse.position.y - downPos.y;
      if (Math.hypot(dx, dy) < 7 && downBody.mitzvah) openDetail(downBody.mitzvah);
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

  // ---- load ----
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
