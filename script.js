(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WORLD = { w: 3200, h: 2200 };
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

const canvas = $("#space"), ctx = canvas.getContext("2d");
const stage = $("#stage"), world = $("#world");
const mini = $("#mini"), mctx = mini.getContext("2d");
const panel = $("#panel"), panes = $$(".pane"), closeBtn = $("#close"), hint = $("#hint");

const ORDER = ["home", "about", "skills", "projects", "contact"];
const COLOR = { home: "255,200,110", about: "120,185,255", skills: "160,130,255", projects: "255,122,107", contact: "77,227,182" };
const STAR_COL = ["#efeaff", "#bcd8ff", "#d8c8ff", "#ffd9c9", "#bff5e4"];

/* ---------- Places on the map ---------- */
const nodes = {};
$$(".node").forEach(el => {
  const id = el.dataset.id, x = +el.dataset.x, y = +el.dataset.y;
  el.style.setProperty("--x", x + "px");
  el.style.setProperty("--y", y + "px");
  nodes[id] = { id, x, y, el };
});

// Dotted route linking the places in order
(() => {
  let d = "";
  ORDER.forEach((id, i) => {
    const n = nodes[id];
    if (i === 0) { d += `M${n.x} ${n.y}`; return; }
    const p = nodes[ORDER[i - 1]];
    const mx = (p.x + n.x) / 2, my = (p.y + n.y) / 2;
    const nx = -(n.y - p.y), ny = n.x - p.x, len = Math.hypot(nx, ny) || 1;
    const k = (i % 2 ? 1 : -1) * 90 / len;
    d += ` Q${mx + nx * k} ${my + ny * k} ${n.x} ${n.y}`;
  });
  const svg = $("#lines");
  svg.setAttribute("viewBox", `0 0 ${WORLD.w} ${WORLD.h}`);
  svg.innerHTML = `<path d="${d}"/>`;
})();

/* ---------- Screen + camera ---------- */
let W = 0, H = 0, dpr = 1, compact = false;
const cam = { x: 0, y: 0, z: 1 };
const vel = { x: 0, y: 0 };
let tween = null, stars = [], shooting = [], warp = 0, prevX = 0, prevY = 0;
const mouse = { x: -999, y: -999 };
let bursts = [];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (v, m) => ((v % m) + m) % m;
const baseZ = () => (compact ? 0.65 : W < 1100 ? 0.8 : 1);
function clampCam() { cam.x = clamp(cam.x, 200, WORLD.w - 200); cam.y = clamp(cam.y, 200, WORLD.h - 200); }

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mini.width = 180 * dpr; mini.height = 124 * dpr; mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  compact = W <= 820;
  document.body.classList.toggle("compact", compact);
  stars = Array.from({ length: Math.round((W * H) / 4200) }, () => ({
    x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.9 + 0.1,
    r: Math.random() * 1.3 + 0.3, tw: Math.random() * 6.28, ci: (Math.random() * 5) | 0
  }));
}
addEventListener("resize", resize);
resize();

function tweenTo(x, y, z, done, dur) {
  vel.x = vel.y = 0;
  const dist = Math.hypot(x - cam.x, y - cam.y);
  const d = dur ?? Math.min(2400, 800 + dist * 0.8);
  if (reduce) { cam.x = x; cam.y = y; cam.z = z; tween = null; if (done) done(); return; }
  tween = { t0: performance.now(), dur: d, sx: cam.x, sy: cam.y, sz: cam.z, x, y, z, dist, done };
}

/* ---------- Panel ---------- */
let current = null;
function openPanel(id) {
  current = id;
  panes.forEach(p => { p.hidden = p.dataset.pane !== id; });
  panel.scrollTop = 0;
  panel.inert = false;
  panel.setAttribute("aria-hidden", "false");
  panel.classList.add("open");
  document.body.classList.add("paneled");
  closeBtn.focus({ preventScroll: true });
}
function closePanel(recenter) {
  if (!current) return;
  const n = nodes[current];
  current = null;
  panel.classList.remove("open");
  panel.inert = true;
  panel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("paneled");
  if (recenter && !reduce) tweenTo(n.x, n.y, cam.z, null, 900);
}
closeBtn.addEventListener("click", () => closePanel(true));

function setActive(id) { $$(".top [data-goto]").forEach(b => b.classList.toggle("active", b.dataset.goto === id)); }
const hideHint = () => hint.classList.add("gone");

function homeCam() { const n = nodes.home; return compact ? { x: n.x, y: n.y + 150 } : { x: n.x + 305, y: n.y }; }

function go(id) {
  const n = nodes[id];
  if (!n) return;
  setActive(id); hideHint(); closePanel(false);
  const z = baseZ();
  let tx = n.x, ty = n.y;
  if (id === "home") { const h = homeCam(); tx = h.x; ty = h.y; }
  else if (compact) ty += (0.28 * H) / z;
  else tx += (Math.min(520, W * 0.46) + 16) / 2 / z;
  tweenTo(tx, ty, z, () => { if (id !== "home") openPanel(id); });
}

/* ---------- Dragging, tapping, zooming ---------- */
let dragging = false, moved = 0, last = { x: 0, y: 0 }, downT = null;
addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; });
stage.addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  if (!reduce) for (let i = 0; i < 16; i++) {   // little star burst where you press
    const a = Math.random() * 6.283, sp = 1 + Math.random() * 3;
    bursts.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, ci: (Math.random() * 5) | 0 });
  }
  tween = null; dragging = true; moved = 0; downT = e.target;
  last = { x: e.clientX, y: e.clientY }; vel.x = vel.y = 0;
  stage.setPointerCapture(e.pointerId); stage.classList.add("drag");
});
stage.addEventListener("pointermove", e => {
  if (!dragging) return;
  const dx = e.clientX - last.x, dy = e.clientY - last.y;
  last = { x: e.clientX, y: e.clientY };
  moved += Math.abs(dx) + Math.abs(dy);
  cam.x -= dx / cam.z; cam.y -= dy / cam.z;
  vel.x = -dx / cam.z; vel.y = -dy / cam.z;
  clampCam();
  if (moved > 8) hideHint();
});
function endDrag(tap) {
  if (!dragging) return;
  dragging = false; stage.classList.remove("drag");
  if (tap && moved < 8) {
    const t = downT && downT.closest && downT.closest("[data-goto]");
    vel.x = vel.y = 0;
    if (t) go(t.dataset.goto);
  }
}
stage.addEventListener("pointerup", () => endDrag(true));
stage.addEventListener("pointercancel", () => endDrag(false));

// Keyboard users activate planets with Enter/Space; mouse taps are handled above
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-goto]");
  if (!t) return;
  if (stage.contains(t) && e.detail !== 0) return;
  go(t.dataset.goto);
});

function zoomAt(factor, cx, cy) {
  const nz = clamp(cam.z * factor, 0.5, 1.5);
  const wx = cam.x + (cx - W / 2) / cam.z, wy = cam.y + (cy - H / 2) / cam.z;
  cam.z = nz; cam.x = wx - (cx - W / 2) / nz; cam.y = wy - (cy - H / 2) / nz;
  clampCam();
}
stage.addEventListener("wheel", e => { e.preventDefault(); tween = null; zoomAt(Math.exp(-e.deltaY * 0.0012), e.clientX, e.clientY); hideHint(); }, { passive: false });

addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const step = 120 / cam.z;
  const pan = (dx, dy) => { tween = null; cam.x += dx; cam.y += dy; clampCam(); hideHint(); };
  switch (e.key) {
    case "Escape": closePanel(true); break;
    case "ArrowLeft": pan(-step, 0); break;
    case "ArrowRight": pan(step, 0); break;
    case "ArrowUp": pan(0, -step); break;
    case "ArrowDown": pan(0, step); break;
    case "+": case "=": zoomAt(1.15, W / 2, H / 2); break;
    case "-": zoomAt(1 / 1.15, W / 2, H / 2); break;
    default: { const i = +e.key; if (i >= 1 && i <= 5) go(ORDER[i - 1]); }
  }
});

mini.addEventListener("pointerdown", e => {
  const r = mini.getBoundingClientRect();
  tweenTo(((e.clientX - r.left) / r.width) * WORLD.w, ((e.clientY - r.top) / r.height) * WORLD.h, cam.z);
  hideHint();
});

/* ---------- Drawing ---------- */
function drawSpace(t, cvx, cvy) {
  ctx.clearRect(0, 0, W, H);
  const z = cam.z;

  // Coloured nebulae, one near each place
  for (const id of ORDER) {
    const n = nodes[id];
    const sx = W / 2 + (n.x - cam.x) * z * 0.55, sy = H / 2 + (n.y - cam.y) * z * 0.55, r = 520 * z;
    if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(${COLOR[id]},0.2)`); g.addColorStop(1, `rgba(${COLOR[id]},0)`);
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }

  // Chart grid: small crosses every 400 units, locked to the map
  const step = 400;
  const x0 = Math.floor((cam.x - W / 2 / z) / step) * step, x1 = cam.x + W / 2 / z;
  const y0 = Math.floor((cam.y - H / 2 / z) / step) * step, y1 = cam.y + H / 2 / z;
  ctx.globalAlpha = 1; ctx.strokeStyle = "rgba(170,160,255,0.22)"; ctx.lineWidth = 1; ctx.beginPath();
  for (let gx = x0; gx <= x1; gx += step) for (let gy = y0; gy <= y1; gy += step) {
    const sx = W / 2 + (gx - cam.x) * z, sy = H / 2 + (gy - cam.y) * z;
    ctx.moveTo(sx - 6, sy); ctx.lineTo(sx + 6, sy); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx, sy + 6);
  }
  ctx.stroke();

  // Stars: parallax by depth, streaks follow the camera's motion
  const radialK = warp * 0.004;
  const near = [];
  for (const s of stars) {
    const sx = wrap(s.x - cam.x * z * 0.2 * s.z, W), sy = wrap(s.y - cam.y * z * 0.2 * s.z, H);
    const tw = reduce ? 1 : 0.65 + 0.35 * Math.sin(t / 700 + s.tw);
    ctx.globalAlpha = s.z * tw;
    ctx.strokeStyle = ctx.fillStyle = STAR_COL[s.ci];
    let tx = cvx * 0.2 * s.z * 6, ty = cvy * 0.2 * s.z * 6;
    if (warp > 0.5) { tx -= (sx - W / 2) * radialK; ty -= (sy - H / 2) * radialK; }
    const r = s.r * (0.6 + s.z);
    if (!reduce && !dragging && Math.hypot(sx - mouse.x, sy - mouse.y) < 130) near.push([sx, sy]);
    if (Math.hypot(tx, ty) > 2) {
      ctx.lineWidth = r; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + tx, sy + ty); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill();
    }
  }

  // Constellation lines between the cursor and nearby stars
  if (near.length) {
    ctx.lineWidth = 0.8; ctx.strokeStyle = "#a9d4ff";
    for (let i = 0; i < near.length; i++) {
      const d = Math.hypot(near[i][0] - mouse.x, near[i][1] - mouse.y);
      ctx.globalAlpha = (1 - d / 130) * 0.7;
      ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(near[i][0], near[i][1]); ctx.stroke();
      for (let k = i + 1; k < near.length; k++) {
        if (Math.hypot(near[i][0] - near[k][0], near[i][1] - near[k][1]) < 70) {
          ctx.globalAlpha = 0.22;
          ctx.beginPath(); ctx.moveTo(near[i][0], near[i][1]); ctx.lineTo(near[k][0], near[k][1]); ctx.stroke();
        }
      }
    }
  }
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    ctx.globalAlpha = b.life; ctx.fillStyle = STAR_COL[b.ci];
    ctx.beginPath(); ctx.arc(b.x, b.y, 2 * b.life + 0.5, 0, 6.283); ctx.fill();
    b.x += b.vx; b.y += b.vy; b.vx *= 0.96; b.vy *= 0.96; b.life -= 0.02;
    if (b.life <= 0) bursts.splice(i, 1);
  }

  if (!reduce) {
    if (Math.random() < 0.003) shooting.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.4, vx: 9 + Math.random() * 6, vy: 3 + Math.random() * 3, life: 1 });
    for (let i = shooting.length - 1; i >= 0; i--) {
      const m = shooting[i];
      ctx.globalAlpha = m.life; ctx.strokeStyle = "#d6ecff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 6, m.y - m.vy * 6); ctx.stroke();
      m.x += m.vx; m.y += m.vy; m.life -= 0.02;
      if (m.life <= 0) shooting.splice(i, 1);
    }
  }
  ctx.globalAlpha = 1;
}

function drawMini() {
  const s = 180 / WORLD.w;
  mctx.clearRect(0, 0, 180, 124);
  mctx.strokeStyle = "rgba(170,160,255,0.35)"; mctx.lineWidth = 1; mctx.setLineDash([2, 4]); mctx.beginPath();
  ORDER.forEach((id, i) => { const n = nodes[id]; i ? mctx.lineTo(n.x * s, n.y * s) : mctx.moveTo(n.x * s, n.y * s); });
  mctx.stroke(); mctx.setLineDash([]);
  for (const id of ORDER) {
    const n = nodes[id];
    mctx.fillStyle = `rgb(${COLOR[id]})`; mctx.beginPath(); mctx.arc(n.x * s, n.y * s, id === "home" ? 5 : 4, 0, 6.283); mctx.fill();
  }
  mctx.strokeStyle = "#efeaff"; mctx.lineWidth = 1.2;
  mctx.strokeRect((cam.x - W / 2 / cam.z) * s, (cam.y - H / 2 / cam.z) * s, (W / cam.z) * s, (H / cam.z) * s);
}

function frame(now) {
  if (tween) {
    const p = Math.min(1, (now - tween.t0) / tween.dur);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    cam.x = tween.sx + (tween.x - tween.sx) * e;
    cam.y = tween.sy + (tween.y - tween.sy) * e;
    const dip = 1 - Math.min(0.22, tween.dist / 6000) * Math.sin(Math.PI * e);   // pull back during long flights
    cam.z = (tween.sz + (tween.z - tween.sz) * e) * dip;
    if (p >= 1) { cam.z = tween.z; const d = tween.done; tween = null; if (d) d(); }
  } else if (!dragging) {
    cam.x += vel.x; cam.y += vel.y; vel.x *= 0.93; vel.y *= 0.93;
    if (Math.abs(vel.x) + Math.abs(vel.y) < 0.02) vel.x = vel.y = 0;
    clampCam();
  }
  const cvx = (cam.x - prevX) * cam.z, cvy = (cam.y - prevY) * cam.z;
  prevX = cam.x; prevY = cam.y;
  world.style.transform = `translate3d(${W / 2 - cam.x * cam.z}px, ${H / 2 - cam.y * cam.z}px, 0) scale(${cam.z})`;
  drawSpace(now, cvx, cvy);
  drawMini();
  warp *= 0.965;
  requestAnimationFrame(frame);
}

/* ---------- Typing effect ---------- */
const words = ["websites.", "interactive experiences.", "clean code.", "things for the web."];
const typed = $("#typed");
let wi = 0, ci = 0, del = false;
function type() {
  const word = words[wi];
  typed.textContent = word.slice(0, ci);
  if (!del && ci === word.length) { del = true; return setTimeout(type, 1400); }
  if (del && ci === 0) { del = false; wi = (wi + 1) % words.length; }
  ci += del ? -1 : 1;
  setTimeout(type, del ? 40 : 90);
}
if (reduce) typed.textContent = words[0]; else type();

/* ---------- Launch: fly in from far away ---------- */
const start = homeCam();
cam.x = prevX = start.x; cam.y = prevY = start.y;
cam.z = baseZ() * 0.45;
setActive("home");
if (!reduce) { warp = 16; tweenTo(start.x, start.y, baseZ(), null, 2400); } else cam.z = baseZ();
requestAnimationFrame(frame);
})();
