/* שלוש שכבות סיני — swipeable card deck (no physics) */
(function () {
  "use strict";

  const COLORS = { A: "#e8b53d", B: "#4a90e2", C: "#9aa0a6", D: "#43c08a" };
  const LAYER_HE = { A: "מפי אלוהים", B: "מפי משה", C: "קול המספר", D: "ספר דברים" };
  const TYPE_HE = { "ע": "מצוות עשה", "ל": "מצוות לא תעשה" };
  const PERM_HE = {
    "eternal": "לדורות ♾", "temple-land": "תלוי במקדש / בארץ 🏛", "one-time": "הוראת שעה ☄"
  };

  const deck = document.getElementById("deck");
  const posEl = document.getElementById("pos");
  const totalEl = document.getElementById("total");
  const hint = document.getElementById("hint");

  let DATA = [];
  let view = [];        // current filtered list
  let idx = 0;
  let current = "all";
  let hintGone = false;

  function noteFor(d) {
    if (d.frame === "B") return "מצווה נדירה — נאמרה רק בפי משה אל העם, ללא \"וַיְדַבֵּר ה'\" ישיר לתוכן.";
    if (d.frame === "C") return "הלכה שנובעת מהערת המספר (קול הנרטיב), לא מדיבור אלוהי ישיר ולא מנאום משה.";
    if (d.frame === "D" && d.frame_sub === "D-only") return "מצווה הקיימת אך ורק בספר דברים, מפי משה — ללא מקבילה בשמות־ויקרא־במדבר במסגרת דיבור אלוהי ישיר.";
    return "";
  }

  function cardHTML(d) {
    const col = COLORS[d.frame] || "#888";
    const sub = d.frame_sub ? " · " + (d.frame_sub === "D-only" ? "רק בדברים" : "יש מקבילה") : "";
    const note = noteFor(d);
    return (
      '<article class="card' + (d.flagged ? ' flagged' : '') + '" style="--accent:' + col + '">' +
        '<span class="idtag">#' + d.id + '</span>' +
        '<span class="badge" style="color:' + col + '"><span class="dot"></span>' + LAYER_HE[d.frame] + sub + '</span>' +
        '<div class="he">' + d.he + '</div>' +
        '<div class="rows">' +
          '<div class="row"><span class="k">מקור</span><span class="v">' + d.source + '</span></div>' +
          '<div class="row"><span class="k">סוג</span><span class="v">' + (TYPE_HE[d.type] || d.type) + '</span></div>' +
          '<div class="row"><span class="k">קביעוּת</span><span class="v">' + (PERM_HE[d.permanence] || d.permanence) + '</span></div>' +
          '<div class="row"><span class="k">תחום</span><span class="v">' + d.category + '</span></div>' +
        '</div>' +
        (note ? '<div class="note">' + note + '</div>' : '') +
      '</article>'
    );
  }

  function render() {
    if (!view.length) { deck.innerHTML = ''; posEl.textContent = '0'; totalEl.textContent = '0'; return; }
    if (idx < 0) idx = 0;
    if (idx >= view.length) idx = view.length - 1;
    deck.innerHTML = cardHTML(view[idx]);
    posEl.textContent = (idx + 1);
    totalEl.textContent = view.length;
  }

  function go(delta) {
    const ni = idx + delta;
    if (ni < 0 || ni >= view.length) {
      // little bounce feedback
      const c = deck.querySelector('.card');
      if (c) { c.style.transform = 'translateX(' + (delta > 0 ? 14 : -14) + 'px)'; setTimeout(() => c.style.transform = '', 130); }
      return;
    }
    const out = deck.querySelector('.card');
    if (out) { out.style.transform = 'translateX(' + (delta > 0 ? -110 : 110) + '%)'; out.style.opacity = '0'; }
    idx = ni;
    setTimeout(() => {
      render();
      const c = deck.querySelector('.card');
      if (c) {
        c.style.transform = 'translateX(' + (delta > 0 ? 110 : -110) + '%)';
        c.style.opacity = '0';
        requestAnimationFrame(() => requestAnimationFrame(() => { c.style.transform = ''; c.style.opacity = '1'; }));
      }
    }, 120);
    killHint();
  }

  function killHint() { if (!hintGone) { hint.style.opacity = '0'; hintGone = true; } }

  // arrows  (RTL: next = visually left, advances forward)
  document.getElementById('next').onclick = () => go(1);
  document.getElementById('prev').onclick = () => go(-1);

  // keyboard
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') go(1);
    else if (e.key === 'ArrowRight') go(-1);
  });

  // swipe
  let sx = 0, sy = 0, swiping = false;
  deck.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; swiping = true; }, { passive: true });
  deck.addEventListener('touchend', e => {
    if (!swiping) return; swiping = false;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) {
      // swipe left (dx<0) → forward;  swipe right (dx>0) → back
      go(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  // mouse drag (desktop)
  let mdx = 0, mdown = false;
  deck.addEventListener('mousedown', e => { mdown = true; mdx = e.clientX; });
  window.addEventListener('mouseup', e => {
    if (!mdown) return; mdown = false;
    const dx = e.clientX - mdx;
    if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  });

  // layer tabs
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      current = btn.dataset.layer;
      view = current === 'all' ? DATA.slice() : DATA.filter(d => d.frame === current);
      idx = 0;
      render();
      killHint();
    };
  });

  // about
  const overlay = document.getElementById('overlay');
  const about = document.getElementById('about');
  document.getElementById('aboutBtn').onclick = () => { overlay.classList.add('open'); about.classList.add('open'); };
  document.getElementById('closeAbout').onclick = () => { overlay.classList.remove('open'); about.classList.remove('open'); };
  overlay.onclick = () => { overlay.classList.remove('open'); about.classList.remove('open'); };

  // load
  fetch('data.json').then(r => r.json()).then(data => {
    // order: keep canonical id order, but float flagged "stars" so they're easy to find? no — keep numeric order for study.
    DATA = data.slice().sort((a, b) => a.id - b.id);
    view = DATA.slice();
    const counts = { all: data.length, A: 0, B: 0, C: 0, D: 0 };
    data.forEach(d => counts[d.frame] = (counts[d.frame] || 0) + 1);
    document.getElementById('c-all').textContent = counts.all;
    ['A', 'B', 'C', 'D'].forEach(k => document.getElementById('c-' + k).textContent = counts[k] || 0);
    render();
  }).catch(err => { deck.innerHTML = '<div class="card"><div class="he">שגיאה בטעינת הנתונים</div></div>'; console.error(err); });
})();
