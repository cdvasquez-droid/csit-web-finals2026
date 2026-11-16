/* ---------- Galaxy canvas ---------- */
const canvas = document.getElementById("galaxy");
const ctx = canvas.getContext("2d");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


let W, H, stars = [], shooting = [], bursts = [], nebulae = [];
const mouse = { x: 0, y: 0, px: -999, py: -999 }; // x/y: -0.5..0.5, px/py: pixels
const cam = { x: 0, y: 0, vx: 0, vy: 0 };
const COLORS = ["#f1eeff", "#bfb2ff", "#5ce1ff", "#ffb3f0"];
const THEMES = {
  nebula:    { violet: "#7a5cff", magenta: "#e24fd2", cyan: "#5ce1ff", v: "122,92,255", m: "226,79,210", c: "92,225,255", stars: ["#f1eeff", "#bfb2ff", "#5ce1ff", "#ffb3f0"] },
  aurora:    { violet: "#3aa0ff", magenta: "#2fe6a6", cyan: "#9bffe0", v: "58,160,255", m: "47,230,166", c: "155,255,224", stars: ["#effff9", "#a9d8ff", "#9bffe0", "#7ff0c4"] },
  supernova: { violet: "#ff6b4a", magenta: "#ffc247", cyan: "#ffe29b", v: "255,107,74", m: "255,194,71", c: "255,226,155", stars: ["#fff6ee", "#ffb59f", "#ffe29b", "#ff9fb0"] }
};
let theme = THEMES.nebula, boost = 0;
let scrollV = 0, lastScroll = window.scrollY;


function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  stars = Array.from({ length: Math.round((W * H) / 5500) }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    z: Math.random() * 0.9 + 0.1,
    r: Math.random() * 1.4 + 0.3,
    tw: Math.random() * Math.PI * 2,
    ci: Math.floor(Math.random() * 4)
  }));
  nebulae = [0, 1, 2, 0].map((k, i) => ({
    x: Math.random() * W, y: Math.random() * H,
    r: Math.max(W, H) * (0.25 + Math.random() * 0.2),
    z: 0.15 + i * 0.05, k
  }));
}
window.addEventListener("resize", resize);
resize();


// Make sure the helper elements exist, even if index.html is an older copy
function ensure(id) {
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("div"); el.id = id; document.body.appendChild(el); }
  return el;
}
const glow = ensure("cursor-glow");
const bar = ensure("progress");
const planet = document.querySelector(".planet");
window.addEventListener("pointermove", e => {
  mouse.x = e.clientX / W - 0.5;
  mouse.y = e.clientY / H - 0.5;
  mouse.px = e.clientX; mouse.py = e.clientY;
  glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  if (planet && !reduceMotion) planet.style.translate = `${-mouse.x * 40}px ${-mouse.y * 40}px`;
});


window.addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - H;
  bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
}, { passive: true });


/* Drag the empty background to fly */
let flying = false, last = { x: 0, y: 0 };
canvas.addEventListener("pointerdown", e => {
  flying = true; last = { x: e.clientX, y: e.clientY };
  canvas.classList.add("flying");
  canvas.setPointerCapture(e.pointerId);
  // Click burst of stars
  if (!reduceMotion) for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
    bursts.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1,
                  ci: Math.floor(Math.random() * 4) });
  }
});
canvas.addEventListener("pointermove", e => {
  if (!flying) return;
  cam.vx = e.clientX - last.x; cam.vy = e.clientY - last.y;
  cam.x += cam.vx; cam.y += cam.vy;
  last = { x: e.clientX, y: e.clientY };
});
const stopFly = () => { flying = false; canvas.classList.remove("flying"); };
canvas.addEventListener("pointerup", stopFly);
canvas.addEventListener("pointercancel", stopFly);


const wrap = (v, max) => ((v % max) + max) % max;


function frame(t) {
  ctx.clearRect(0, 0, W, H);
  scrollV += (Math.abs(window.scrollY - lastScroll) - scrollV) * 0.15; // smoothed scroll speed
  lastScroll = window.scrollY;
  const warp = reduceMotion ? 0 : Math.min(scrollV * 0.6 + boost, 46);
  boost *= 0.95;


  if (!flying) { cam.x += cam.vx; cam.y += cam.vy; cam.vx *= 0.95; cam.vy *= 0.95; }


  // Nebula clouds drift slowly with the camera
  for (const n of nebulae) {
    const x = wrap(n.x + cam.x * n.z - mouse.x * 30, W + n.r) - n.r / 2;
    const y = wrap(n.y + cam.y * n.z - mouse.y * 30, H + n.r) - n.r / 2;
    const rgb = [theme.v, theme.m, theme.c][n.k];
    const g = ctx.createRadialGradient(x, y, 0, x, y, n.r);
    g.addColorStop(0, `rgba(${rgb},0.16)`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }


  const near = [];
  for (const s of stars) {
    const px = wrap(s.x + cam.x * s.z - mouse.x * 60 * s.z, W);
    const py = wrap(s.y + cam.y * s.z - mouse.y * 60 * s.z, H);
    const tw = reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(t / 700 + s.tw);
    ctx.globalAlpha = s.z * tw;
    ctx.fillStyle = ctx.strokeStyle = COLORS[s.ci];
    const r = s.r * (0.6 + s.z);
    if (warp > 1) {            // scrolling stretches stars into streaks
      ctx.lineWidth = r * 1.4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - warp * s.z); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    if (Math.hypot(px - mouse.px, py - mouse.py) < 130) near.push([px, py]);
  }


  // Constellation lines around the cursor
  if (!reduceMotion) {
    ctx.lineWidth = 0.8;
    for (let i = 0; i < near.length; i++) {
      const d = Math.hypot(near[i][0] - mouse.px, near[i][1] - mouse.py);
      ctx.globalAlpha = (1 - d / 130) * 0.7;
      ctx.strokeStyle = theme.cyan;
      ctx.beginPath(); ctx.moveTo(mouse.px, mouse.py); ctx.lineTo(near[i][0], near[i][1]); ctx.stroke();
      for (let j = i + 1; j < near.length; j++) {
        if (Math.hypot(near[i][0] - near[j][0], near[i][1] - near[j][1]) < 70) {
          ctx.globalAlpha = 0.25;
          ctx.beginPath(); ctx.moveTo(near[i][0], near[i][1]); ctx.lineTo(near[j][0], near[j][1]); ctx.stroke();
        }
      }
    }


    if (Math.random() < 0.004) shooting.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.4,
                                               vx: 8 + Math.random() * 6, vy: 3 + Math.random() * 3, life: 1 });
    for (let i = shooting.length - 1; i >= 0; i--) {
      const m = shooting[i];
      ctx.globalAlpha = m.life; ctx.strokeStyle = "#cfe9ff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 6, m.y - m.vy * 6); ctx.stroke();
      m.x += m.vx; m.y += m.vy; m.life -= 0.02;
      if (m.life <= 0) shooting.splice(i, 1);
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      ctx.globalAlpha = b.life; ctx.fillStyle = COLORS[b.ci];
      ctx.beginPath(); ctx.arc(b.x, b.y, 2 * b.life + 0.5, 0, Math.PI * 2); ctx.fill();
      b.x += b.vx; b.y += b.vy; b.vx *= 0.96; b.vy *= 0.96; b.life -= 0.02;
      if (b.life <= 0) bursts.splice(i, 1);
    }
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);


/* ---------- Draggable items: throw them and they glide, then settle ---------- */
const draggables = document.querySelectorAll("[data-drag]");
let topZ = 50;


draggables.forEach(el => {
  let sx, sy, x = 0, y = 0, vx = 0, vy = 0, lx, ly, active = false, raf;


  const apply = (tilt = 0) => { el.style.transform = `translate(${x}px, ${y}px) rotate(${tilt}deg)`; };


  const glide = () => {
    x += vx; y += vy; vx *= 0.93; vy *= 0.93;
    apply(Math.max(-8, Math.min(8, vx * 0.5)));
    if (Math.abs(vx) + Math.abs(vy) > 0.3) raf = requestAnimationFrame(glide); else apply(0);
  };


  el.addEventListener("pointerdown", e => {
    if (e.target.closest("a")) return;
    cancelAnimationFrame(raf);
    active = true; sx = lx = e.clientX; sy = ly = e.clientY; vx = vy = 0;
    el.classList.add("dragging");
    el.style.position = "relative";
    el.style.zIndex = ++topZ;
    el.setPointerCapture(e.pointerId);
  });


  el.addEventListener("pointermove", e => {
    if (!active) return;
    vx = e.clientX - lx; vy = e.clientY - ly;
    x += vx; y += vy; lx = e.clientX; ly = e.clientY;
    apply(Math.max(-8, Math.min(8, vx * 0.6)));
  });


  const drop = () => {
    if (!active) return;
    active = false; el.classList.remove("dragging");
    if (reduceMotion) { apply(0); return; }
    raf = requestAnimationFrame(glide);
  };
  el.addEventListener("pointerup", drop);
  el.addEventListener("pointercancel", drop);


  el.resetPosition = () => {
    cancelAnimationFrame(raf); x = y = vx = vy = 0;
    el.style.transition = "transform 0.5s ease";
    el.style.transform = "translate(0, 0)";
    setTimeout(() => { el.style.transition = ""; }, 520);
  };
});


const resetBtn = document.getElementById("reset");
if (resetBtn) resetBtn.addEventListener("click", () => {
  draggables.forEach(el => el.resetPosition());
  cam.x = cam.y = cam.vx = cam.vy = 0;
});


/* ---------- Typing effect ---------- */
const words = ["websites.", "interactive experiences.", "clean code.", "things for the web."];
const typed = document.getElementById("typed");
let w = 0, c = 0, deleting = false;
function type() {
  const word = words[w];
  typed.textContent = word.slice(0, c);
  if (!deleting && c === word.length) { deleting = true; return setTimeout(type, 1400); }
  if (deleting && c === 0) { deleting = false; w = (w + 1) % words.length; }
  c += deleting ? -1 : 1;
  setTimeout(type, deleting ? 40 : 90);
}
if (typed) { if (reduceMotion) typed.textContent = words[0]; else type(); }




/* ---------- Themes, warp button, hyperspace entry ---------- */
function applyTheme(name) {
  theme = THEMES[name] || THEMES.nebula;
  const r = document.documentElement.style;
  r.setProperty("--violet", theme.violet); r.setProperty("--magenta", theme.magenta); r.setProperty("--cyan", theme.cyan);
  r.setProperty("--v-rgb", theme.v); r.setProperty("--m-rgb", theme.m); r.setProperty("--c-rgb", theme.c);
  theme.stars.forEach((col, i) => { COLORS[i] = col; });
  document.querySelectorAll(".swatch").forEach(b => b.classList.toggle("active", b.dataset.theme === name));
  try { localStorage.setItem("galaxy-theme", name); } catch (e) {}
}
document.querySelectorAll(".swatch").forEach(b => b.addEventListener("click", () => { applyTheme(b.dataset.theme); boost = 18; }));
const warpBtn = document.getElementById("warp");
if (warpBtn) warpBtn.addEventListener("click", () => { boost = 46; });
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", () => { boost = 30; }));


let saved = "nebula";
try { saved = localStorage.getItem("galaxy-theme") || "nebula"; } catch (e) {}
applyTheme(saved);
if (!reduceMotion) boost = 46;   // hyperspace entry on page load
