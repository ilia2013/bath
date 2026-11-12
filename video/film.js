'use strict';
/* «Ночь, когда погас весь город» — вертикальный мульт-шортс 1080x1920, 30 fps.
   Вся анимация детерминирована: renderFrame(T) рисует кадр для времени T (сек). */

const W = 1080, H = 1920, FPS = 30;
const cv = document.getElementById('c');
const c = cv.getContext('2d');

/* ---------- математика ---------- */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eOut = t => 1 - Math.pow(1 - t, 3);
const eIn = t => t * t * t;
const eIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const PI = Math.PI, TAU = PI * 2;
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const p = hex(a), q = hex(b); return `rgb(${p.map((v, i) => Math.round(lerp(v, q[i], t))).join(',')})`; };

/* ---------- палитра ---------- */
const INK = '#17142e';
const SKIN = '#f7cfa6', HAIR = '#3b2719', HOOD = '#f6a531';
const YEL = '#ffd84a', RED = '#ff3b47';

/* ---------- примитивы ---------- */
function rr(x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function ell(x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); }
function line(x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function ink(w = 11) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; }
function fnt(size, fam = 'Russo One', weight = 400) { c.font = `${weight} ${size}px "${fam}"`; }
function fitSize(text, maxW, size, fam = 'Russo One', weight = 400) {
  fnt(size, fam, weight); const w = c.measureText(text).width;
  return w > maxW ? size * maxW / w : size;
}
function label(text, x, y, o = {}) {
  const { size = 100, fam = 'Russo One', weight = 400, fill = '#fff', stroke = null, sw = 16, align = 'center', maxW = 0 } = o;
  const s = maxW ? fitSize(text, maxW, size, fam, weight) : size;
  fnt(s, fam, weight); c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = sw; c.strokeText(text, x, y); }
  c.fillStyle = fill; c.fillText(text, x, y);
}
function cam(z, cx = W / 2, cy = H / 2, sx = 0, sy = 0) { c.translate(W / 2 + sx, H / 2 + sy); c.scale(z, z); c.translate(-cx, -cy); }
function shake(t, t0, amp, dur = 0.35) {
  if (t < t0) return [0, 0]; const k = clamp(1 - (t - t0) / dur); if (k <= 0) return [0, 0];
  const f = Math.floor(t * FPS + 0.5);
  return [(rnd(f * 3.1 + t0) - .5) * 2 * amp * k, (rnd(f * 7.7 + t0) - .5) * 2 * amp * k];
}
const addv = (...v) => v.reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);

/* ---------- карта освещения (темнота + источники света) ---------- */
const LM = document.createElement('canvas'); LM.width = W / 2; LM.height = H / 2;
const lm = LM.getContext('2d');
function lightmap(ambient, lights, extra) {
  lm.setTransform(.5, 0, 0, .5, 0, 0); lm.globalAlpha = 1; lm.globalCompositeOperation = 'source-over';
  lm.fillStyle = ambient; lm.fillRect(0, 0, W, H);
  lm.globalCompositeOperation = 'lighter';
  for (const L of lights) {
    const g = lm.createRadialGradient(L.x, L.y, L.r0 || 0, L.x, L.y, L.r);
    g.addColorStop(0, L.c); g.addColorStop(1, 'rgba(0,0,0,0)');
    lm.fillStyle = g; lm.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
  }
  if (extra) extra(lm);
  c.save(); c.globalCompositeOperation = 'multiply'; c.drawImage(LM, 0, 0, W, H); c.restore();
}

/* ---------- герой ---------- */
function hero(o) {
  const { x, y, s = 1, look = [0, 0], eyes = 'normal', mouth = 'smile', brow = 'neutral', blink = 0,
    tilt = 0, sweat = 0, body = true, phone = false, pupil = 1 } = o;
  c.save(); c.translate(x, y); c.scale(s, s); ink(11);
  if (body) {
    c.fillStyle = HOOD;
    c.beginPath(); c.moveTo(-200, 800); c.lineTo(-200, 310);
    c.bezierCurveTo(-200, 190, -115, 150, 0, 150); c.bezierCurveTo(115, 150, 200, 190, 200, 310);
    c.lineTo(200, 800); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#d98a1c'; ell(0, 186, 128, 50); c.fill(); c.stroke();           // капюшон
    c.lineWidth = 8; line(-38, 226, -44, 300); line(38, 226, 44, 300);               // шнурки
    c.fillStyle = '#fff'; ell(-44, 306, 8, 8); c.fill(); ell(44, 306, 8, 8); c.fill();
    ink(11);
    c.beginPath(); c.moveTo(-110, 560); c.quadraticCurveTo(0, 520, 110, 560); c.stroke(); // карман
  }
  c.save(); c.rotate(tilt);
  const R = 170;
  c.fillStyle = SKIN; ell(-R + 6, 22, 26, 34); c.fill(); c.stroke(); ell(R - 6, 22, 26, 34); c.fill(); c.stroke(); // уши
  ell(0, 0, R, R); c.fill(); c.stroke();
  // волосы
  c.fillStyle = HAIR; c.beginPath(); c.arc(0, 0, R, PI * 1.02, PI * 1.98);
  c.bezierCurveTo(R * .62, -R * .28, R * .34, -R * .62, R * .02, -R * .50);
  c.bezierCurveTo(-R * .12, -R * .28, -R * .42, -R * .36, -R * .58, -R * .46);
  c.bezierCurveTo(-R * .78, -R * .30, -R * .92, -R * .2, -R * Math.cos(.02 * PI), -R * Math.sin(.02 * PI));
  c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-20, -R + 4); c.quadraticCurveTo(10, -R - 62, 62, -R - 34); c.quadraticCurveTo(34, -R - 20, 40, -R + 8); c.closePath(); c.fill(); c.stroke(); // вихор
  // лицо
  const lx = look[0] * 16, ly = look[1] * 14;
  c.fillStyle = 'rgba(255,110,110,.26)'; ell(-112 + lx * .3, 58, 26, 20); c.fill(); ell(112 + lx * .3, 58, 26, 20); c.fill();
  for (const sd of [-1, 1]) {
    const ex = sd * 66 + lx * .5, ey = -4 + ly * .5;
    if (eyes === 'happy') { ink(11); c.beginPath(); c.arc(ex, ey + 14, 34, PI * 1.12, PI * 1.88); c.stroke(); continue; }
    const wide = eyes === 'wide';
    const rx = wide ? 47 : 40, ry = (wide ? 54 : 44) * (1 - blink * .93);
    c.fillStyle = '#fff'; ell(ex, ey, rx, ry); c.fill(); ink(9); c.stroke();
    if (blink < .7) {
      c.save(); ell(ex, ey, rx - 3, Math.max(1, ry - 3)); c.clip();
      const pr = (wide ? 12 : 18) * pupil;
      c.fillStyle = INK; ell(ex + lx * 1.15, ey + ly * 1.15, pr, pr); c.fill();
      c.fillStyle = '#fff'; ell(ex + lx * 1.15 - pr * .35, ey + ly * 1.15 - pr * .35, pr * .3, pr * .3); c.fill();
      c.restore();
    }
  }
  // брови
  ink(12);
  for (const sd of [-1, 1]) {
    const by = (eyes === 'wide' ? -84 : -70) + ly * .3, bx = lx * .4;
    if (brow === 'scared') line(sd * 30 + bx, by - 22, sd * 106 + bx, by + 6);
    else if (brow === 'angry') line(sd * 30 + bx, by + 8, sd * 104 + bx, by - 18);
    else if (brow === 'up') { c.beginPath(); c.moveTo(sd * 30 + bx, by - 14); c.quadraticCurveTo(sd * 68 + bx, by - 36, sd * 106 + bx, by - 12); c.stroke(); }
    else line(sd * 32 + bx, by, sd * 102 + bx, by - 4);
  }
  // рот
  const mx = lx * .5, my = 92 + ly * .3; ink(10);
  if (mouth === 'smile') { c.beginPath(); c.arc(mx, my - 26, 46, PI * .16, PI * .84); c.stroke(); }
  else if (mouth === 'flat') line(mx - 26, my, mx + 26, my);
  else if (mouth === 'small') { c.beginPath(); c.arc(mx, my + 22, 22, PI * 1.2, PI * 1.8); c.stroke(); }
  else if (mouth === 'o') { c.fillStyle = '#5a1a24'; ell(mx, my + 2, 22, 28); c.fill(); c.stroke(); }
  else if (mouth === 'scared') {
    c.fillStyle = '#5a1a24'; ell(mx, my + 4, 40, 26); c.fill();
    c.save(); ell(mx, my + 4, 40, 26); c.clip(); c.fillStyle = '#ff7b89'; ell(mx, my + 30, 26, 16); c.fill(); c.restore();
    ell(mx, my + 4, 40, 26); c.stroke();
  } else if (mouth === 'grit') {
    c.fillStyle = '#fff'; rr(mx - 46, my - 16, 92, 36, 14); c.fill(); c.stroke();
    c.lineWidth = 6; for (const dx of [-23, 0, 23]) line(mx + dx, my - 14, mx + dx, my + 18); line(mx - 44, my + 2, mx + 44, my + 2);
  } else if (mouth === 'laugh') {
    c.fillStyle = '#5a1a24'; c.beginPath(); c.moveTo(mx - 60, my - 26); c.lineTo(mx + 60, my - 26);
    c.bezierCurveTo(mx + 56, my + 62, mx - 56, my + 62, mx - 60, my - 26); c.closePath(); c.fill();
    c.save(); c.clip(); c.fillStyle = '#ff7b89'; ell(mx, my + 40, 34, 20); c.fill(); c.fillStyle = '#fff'; c.fillRect(mx - 60, my - 28, 120, 16); c.restore();
    ink(10); c.beginPath(); c.moveTo(mx - 60, my - 26); c.lineTo(mx + 60, my - 26);
    c.bezierCurveTo(mx + 56, my + 62, mx - 56, my + 62, mx - 60, my - 26); c.closePath(); c.stroke();
  }
  if (sweat > 0) {
    c.globalAlpha = sweat; c.fillStyle = '#9fe3ff'; ink(6);
    for (const [dx, dy, k] of [[128, -86, 1], [-140, -40, .75]]) {
      c.beginPath(); c.moveTo(dx, dy - 30 * k); c.bezierCurveTo(dx + 22 * k, dy, dx + 20 * k, dy + 22 * k, dx, dy + 22 * k);
      c.bezierCurveTo(dx - 20 * k, dy + 22 * k, dx - 22 * k, dy, dx, dy - 30 * k); c.fill(); c.stroke();
    }
    c.globalAlpha = 1;
  }
  c.restore();
  if (phone) { // телефон в руке (вид сзади)
    ink(11);
    c.strokeStyle = INK; c.lineWidth = 86; line(236, 420, 150, 520);
    c.strokeStyle = HOOD; c.lineWidth = 64; line(236, 420, 150, 520);
    ink(10); c.save(); c.translate(84, 430); c.rotate(-.14);
    c.fillStyle = '#2a2a38'; rr(-74, -128, 148, 256, 26); c.fill(); c.stroke();
    c.fillStyle = '#11111a'; ell(-36, -90, 15, 15); c.fill(); c.fillStyle = '#4a4a60'; ell(-36, -90, 6, 6); c.fill();
    c.restore();
    c.fillStyle = SKIN; ell(128, 512, 48, 44); c.fill(); c.stroke();
    c.lineWidth = 7; line(98, 496, 150, 488); line(96, 520, 150, 514);
  }
  c.restore();
}
function heroBack(x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s); ink(11);
  c.fillStyle = HOOD;
  c.beginPath(); c.moveTo(-200, 800); c.lineTo(-200, 310);
  c.bezierCurveTo(-200, 190, -115, 150, 0, 150); c.bezierCurveTo(115, 150, 200, 190, 200, 310); c.lineTo(200, 800); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#d98a1c'; c.beginPath(); c.moveTo(-130, 190); c.quadraticCurveTo(0, 330, 130, 190); c.quadraticCurveTo(0, 120, -130, 190); c.fill(); c.stroke();
  const R = 170;
  c.fillStyle = SKIN; ell(-R + 6, 22, 26, 34); c.fill(); c.stroke(); ell(R - 6, 22, 26, 34); c.fill(); c.stroke();
  c.fillStyle = HAIR; ell(0, 0, R, R); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-20, -R + 4); c.quadraticCurveTo(10, -R - 62, 62, -R - 34); c.quadraticCurveTo(34, -R - 20, 40, -R + 8); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = SKIN; c.beginPath(); c.moveTo(-70, 150); c.quadraticCurveTo(0, 196, 70, 150); c.quadraticCurveTo(0, 172, -70, 150); c.fill();
  c.restore();
}

/* ---------- «они» ---------- */
function shadeFig(x, y, s, tilt = 0, col = '#05060d') {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(-104, 120); c.bezierCurveTo(-112, 56, 112, 56, 104, 120); c.lineTo(72, 1100); c.lineTo(-72, 1100); c.closePath(); c.fill();
  c.lineWidth = 26;
  for (const sd of [-1, 1]) {
    c.beginPath(); c.moveTo(sd * 94, 126); c.quadraticCurveTo(sd * 160, 400, sd * 128, 660); c.stroke();
    c.lineWidth = 9; for (let i = 0; i < 4; i++) line(sd * 128, 660, sd * (104 + i * 16), 760 - Math.abs(i - 1.5) * 12); c.lineWidth = 26;
  }
  c.rotate(tilt); ell(0, 0, 86, 86); c.fill();
  c.restore();
}
function shadeFace(x, y, s, tilt = 0, a = 1, smile = 1, dx = 0) {
  if (a <= 0) return;
  c.save(); c.translate(x, y); c.scale(s, s); c.rotate(tilt); c.globalAlpha = a;
  c.shadowColor = 'rgba(255,255,255,.9)'; c.shadowBlur = 26; c.fillStyle = '#fff';
  ell(-30 + dx, -8, 13, 15); c.fill(); ell(30 + dx, -8, 13, 15); c.fill();
  if (smile) { c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(dx, -10, 48, PI * .2, PI * .8); c.stroke(); }
  c.restore();
}

/* ---------- плашки / HUD ---------- */
function hudClock(text, a = 1, col = '#fff', y = 250) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = a; fnt(118); const w = c.measureText(text).width + 110;
  c.fillStyle = 'rgba(8,9,24,.78)'; rr(W / 2 - w / 2, y - 92, w, 184, 46); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 5; c.stroke();
  label(text, W / 2, y + 6, { size: 118, fill: col });
  c.restore();
}
function ruleBadge(n, a = 1) {
  if (a <= 0) return;
  c.save(); c.globalAlpha = a; c.translate(64, 190); c.rotate(-.035);
  c.fillStyle = RED; rr(0, 0, 400, 104, 26); c.fill(); ink(9); c.stroke();
  label('ПРАВИЛО ' + n, 200, 56, { size: 56 });
  c.restore();
}

/* ============================================================
   СЦЕНЫ
   ============================================================ */

/* ---------- город ---------- */
const CITY = (() => {
  const defs = [
    { base: 1640, minH: 640, maxH: 1080, minW: 150, maxW: 230, col: '#1a2352', ww: 24, wh: 32, gx: 20, gy: 26, seed: 11 },
    { base: 1700, minH: 430, maxH: 840, minW: 190, maxW: 290, col: '#121a43', ww: 32, wh: 42, gx: 24, gy: 30, seed: 23 },
    { base: 1780, minH: 250, maxH: 560, minW: 230, maxW: 360, col: '#0b1031', ww: 42, wh: 54, gx: 28, gy: 36, seed: 37 },
  ];
  let id = 0;
  return defs.map(d => {
    const bs = []; let x = -70, k = 0;
    while (x < W + 60) {
      const w = lerp(d.minW, d.maxW, rnd(d.seed + k * 1.7)), h = lerp(d.minH, d.maxH, rnd(d.seed * 3 + k * 2.3));
      const top = d.base - h, wins = [];
      const cols = Math.floor((w - 36) / (d.ww + d.gx)), rows = Math.floor((h - 60) / (d.wh + d.gy));
      const x0 = x + (w - (cols * (d.ww + d.gx) - d.gx)) / 2;
      for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
        id++; const lit = rnd(id * 1.31) < .62, col = rnd(id * 2.9) < .14 ? '#9be7ff' : (rnd(id * 4.1) < .3 ? '#ffb347' : '#ffd166');
        wins.push({ x: x0 + q * (d.ww + d.gx), y: top + 44 + r * (d.wh + d.gy), lit, col, id });
      }
      bs.push({ x, w, top, wins, ant: rnd(d.seed + k * 9.1) }); x += w + lerp(-6, 14, rnd(d.seed + k)); k++;
    }
    return { d, bs };
  });
})();
function drawCity(p, litFn, t) {     // p: 0 ночь … 1 рассвет
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix('#060a1e', '#4a5aa8', p)); g.addColorStop(.55, mix('#16224f', '#f28f63', p)); g.addColorStop(1, mix('#22346e', '#ffd692', p));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) {     // звёзды
    const a = (.35 + .65 * Math.abs(Math.sin(t * 1.5 + i * 2.1))) * (1 - p);
    c.fillStyle = `rgba(255,255,255,${a})`; const r = 2 + rnd(i * 5.5) * 3.5;
    ell(rnd(i * 1.1) * W, rnd(i * 2.3) * 900, r, r); c.fill();
  }
  // луна
  c.save(); c.globalAlpha = 1 - p * .9; c.translate(800, 520);
  const mg = c.createRadialGradient(0, 0, 80, 0, 0, 280); mg.addColorStop(0, 'rgba(255,245,200,.28)'); mg.addColorStop(1, 'rgba(255,245,200,0)');
  c.fillStyle = mg; ell(0, 0, 280, 280); c.fill();
  c.fillStyle = '#fdf3c4'; ell(0, 0, 96, 96); c.fill();
  c.fillStyle = '#e9dca4'; ell(-30, -22, 22, 22); c.fill(); ell(34, 18, 15, 15); c.fill(); ell(-12, 44, 10, 10); c.fill();
  c.restore();
  if (p > 0) {                        // солнце
    const sy = lerp(1500, 930, eOut(p));
    const sg = c.createRadialGradient(540, sy, 60, 540, sy, 700); sg.addColorStop(0, `rgba(255,236,170,${.75 * p})`); sg.addColorStop(1, 'rgba(255,236,170,0)');
    c.fillStyle = sg; c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff0b0'; ell(540, sy, 150, 150); c.fill();
  }
  CITY.forEach((L, li) => {
    for (const b of L.bs) {
      c.fillStyle = mix(L.d.col, ['#56508f', '#3b3a78', '#27285c'][li], p);
      c.fillRect(b.x, b.top, b.w, H - b.top);
      c.fillRect(b.x - 6, b.top - 10, b.w + 12, 14);
      if (b.ant > .55) { c.fillRect(b.x + b.w * .3, b.top - 80, 6, 80); c.fillRect(b.x + b.w * .3 - 16, b.top - 62, 38, 5); }
      else if (b.ant < .2) { c.fillRect(b.x + b.w * .55, b.top - 46, 54, 40); }
      for (const w of b.wins) {
        const l = w.lit ? litFn(w) : 0;
        c.fillStyle = mix(L.d.col, '#ffffff', .07 + p * .1); c.fillRect(w.x, w.y, L.d.ww, L.d.wh);
        if (l > 0) { c.globalAlpha = l; c.fillStyle = w.col; c.fillRect(w.x, w.y, L.d.ww, L.d.wh); c.globalAlpha = 1; }
      }
    }
  });
}
function sCity(t, d) {
  const off = 2.95;
  c.save(); cam(lerp(1.0, 1.1, eIO(t / d)), 540, lerp(960, 1040, t / d), ...shake(t, off, 14, .5));
  drawCity(0, w => {
    const tt = off + w.x / W * .55 + rnd(w.id * 7.7) * .3;
    if (t < tt) return 1; if (t < tt + .12) return rnd(w.id + Math.floor(t * 30)) > .5 ? 1 : .15; return 0;
  }, t);
  const dark = seg(t, off, off + 1.0);
  c.fillStyle = `rgba(3,4,14,${.38 * dark})`; c.fillRect(-100, -100, W + 200, H + 200);
  c.restore();
  hudClock(Math.floor(t * 2) % 2 ? '23 47' : '23:47', 1, t > off + .2 ? '#ff6b6b' : '#fff');
}

/* ---------- комната ---------- */
function roomBG(day, o = {}) {
  c.fillStyle = day ? '#ffe3ad' : '#8090da'; c.fillRect(-100, -100, W + 200, H + 200);
  c.fillStyle = day ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)';
  for (let x = 30; x < W; x += 120) c.fillRect(x, -100, 46, H + 200);
  ink(11);
  // окно
  c.fillStyle = '#eef0ff'; rr(640, 290, 350, 500, 18); c.fill(); c.stroke();
  const g = c.createLinearGradient(0, 320, 0, 760);
  if (day) { g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, '#e3f5ff'); } else { g.addColorStop(0, '#0d1540'); g.addColorStop(1, '#2b3f93'); }
  c.fillStyle = g; rr(668, 318, 294, 444, 8); c.fill(); c.stroke();
  c.save(); rr(668, 318, 294, 444, 8); c.clip();
  if (day) {
    c.fillStyle = '#fff3b0'; ell(900, 400, 52, 52); c.fill();
    c.fillStyle = '#fff'; ell(740, 470, 50, 26); c.fill(); ell(780, 452, 40, 28); c.fill(); ell(815, 474, 44, 22); c.fill();
    c.fillStyle = '#b7a6d6'; c.fillRect(668, 640, 120, 130); c.fillStyle = '#9d8fc7'; c.fillRect(800, 600, 170, 170);
  } else {
    c.fillStyle = '#fdf3c4'; ell(890, 410, 44, 44); c.fill();
    c.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { ell(690 + rnd(i * 3.3) * 250, 340 + rnd(i * 5.1) * 240, 4, 4); c.fill(); }
    c.fillStyle = '#0a0f2c'; c.fillRect(668, 640, 120, 130); c.fillStyle = '#0d1436'; c.fillRect(800, 600, 170, 170);
  }
  c.restore();
  ink(10); line(815, 318, 815, 762); line(668, 540, 962, 540);
  c.fillStyle = '#eef0ff'; rr(622, 780, 386, 34, 10); c.fill(); c.stroke();
  // картина
  ink(11); c.fillStyle = '#e0a93f'; rr(96, 370, 290, 350, 14); c.fill(); c.stroke();
  c.fillStyle = '#cfe8ff'; rr(126, 400, 230, 290, 6); c.fill(); c.stroke();
  c.save(); rr(126, 400, 230, 290, 6); c.clip();
  c.fillStyle = '#ff9b6b'; ell(290, 470, 34, 34); c.fill();
  c.fillStyle = '#6fa37a'; c.beginPath(); c.moveTo(110, 700); c.lineTo(210, 520); c.lineTo(300, 700); c.fill();
  c.fillStyle = '#4f8a66'; c.beginPath(); c.moveTo(210, 700); c.lineTo(310, 570); c.lineTo(380, 700); c.fill();
  c.restore();
  if (!o.noCouch) {
    ink(12); c.fillStyle = '#c64f4f'; rr(30, 1150, 1020, 900, 110); c.fill(); c.stroke();
    c.fillStyle = '#b04242'; rr(-60, 1420, 250, 700, 90); c.fill(); c.stroke(); rr(890, 1420, 250, 700, 90); c.fill(); c.stroke();
  }
}
function sRoom(t, d) {
  const k1 = 4.2, k2 = 4.65, k3 = 5.1;
  const sh = addv(shake(t, k1, 16), shake(t, k2, 16), shake(t, k3, 22));
  c.save(); cam(lerp(1.04, 1.12, eIO(t / d)), 540, 1000, ...sh);
  roomBG(false);
  const turned = t > 2.5, kn = t > k1;
  const lk = turned ? [lerp(.2, -1, eOut(seg(t, 2.5, 2.8))), lerp(.9, -.15, eOut(seg(t, 2.5, 2.8)))] : [.2, .9];
  hero({
    x: 540, y: 1000 + (kn ? Math.sin(t * 60) * 3 : 0), s: 1.45, look: lk, eyes: kn ? 'wide' : 'normal',
    brow: kn ? 'scared' : (turned ? 'up' : 'neutral'), mouth: kn ? 'o' : (turned ? 'flat' : 'small'),
    blink: (t > 1.3 && t < 1.42) ? 1 : 0, phone: true, sweat: seg(t, k2, k2 + .3),
  });
  lightmap('#3d4286', [
    { x: 600, y: 1240, r0: 160, r: 980, c: `rgba(190,215,255,${.9 + .05 * Math.sin(t * 9)})` },
    { x: 810, y: 540, r: 460, c: 'rgba(90,110,220,.5)' },
  ]);
  // «нет сети»
  const a = eBack(seg(t, .25, .55)) * (1 - seg(t, 2.3, 2.5));
  if (a > 0) {
    c.save(); c.translate(250, 520); c.rotate(-.08 + Math.sin(t * 3) * .02); c.scale(a, a);
    c.fillStyle = '#fff'; rr(-170, -110, 340, 220, 40); c.fill(); ink(10); c.stroke();
    c.fillStyle = '#c9cede'; for (let i = 0; i < 4; i++) { rr(-112 + i * 44, 34 - i * 30, 30, 30 + i * 30, 6); c.fill(); }
    c.strokeStyle = RED; c.lineWidth = 16; c.lineCap = 'round'; line(-70, -56, 60, 62); line(60, -56, -70, 62);
    label('НЕТ СЕТИ', 0, 150, { size: 46, fam: 'Montserrat', weight: 900, fill: '#fff', stroke: INK, sw: 14 });
    c.restore();
  }
  // ТУК
  [[k1, 230, 560, -.18], [k2, 330, 400, .1], [k3, 240, 760, -.06]].forEach(([tk, x, y, r], i) => {
    const p = seg(t, tk, tk + .16), o = 1 - seg(t, tk + .75, tk + 1.0); if (t < tk || o <= 0) return;
    c.save(); c.translate(x, y); c.rotate(r); const s = (.5 + .5 * eBack(p)) * (i === 2 ? 1.3 : 1); c.scale(s, s); c.globalAlpha = o;
    label('ТУК!', 0, 0, { size: 150, fill: '#fff', stroke: RED, sw: 26 }); label('ТУК!', 0, 0, { size: 150, fill: '#fff', stroke: INK, sw: 10 });
    c.restore();
  });
  c.restore();
}

/* ---------- титул ---------- */
function burstBG(t, c1, c2, rays = 'rgba(255,255,255,.05)') {
  const g = c.createRadialGradient(540, 900, 50, 540, 900, 1300); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fillRect(-100, -100, W + 200, H + 200);
  c.save(); c.translate(540, 900); c.rotate(t * .25); c.fillStyle = rays;
  for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(-190, -1900); c.lineTo(190, -1900); c.fill(); }
  c.restore();
}
function pop(t, t0, dur = .3) { const p = seg(t, t0, t0 + dur); return p <= 0 ? 0 : eBack(p); }
function sTitle(t, d) {
  c.save(); cam(1.02 + .03 * t / d, 540, 960, ...addv(shake(t, .05, 20), shake(t, 1.5, 10)));
  burstBG(t, '#2b1c6b', '#07051a');
  // лампочка
  const on = t < 1.5 ? (rnd(Math.floor(t * 24)) > .25 || t < .9) : false;
  c.save(); c.translate(540, 470); const bs = pop(t, 0, .35); c.scale(bs, bs); c.rotate(Math.sin(t * 2) * .06);
  if (on) { const gg = c.createRadialGradient(0, 0, 60, 0, 0, 380); gg.addColorStop(0, 'rgba(255,220,90,.55)'); gg.addColorStop(1, 'rgba(255,220,90,0)'); c.fillStyle = gg; ell(0, 0, 380, 380); c.fill(); }
  ink(12); c.fillStyle = on ? YEL : '#3a3f6b'; ell(0, -20, 150, 150); c.fill(); c.stroke();
  c.fillStyle = '#9aa0c0'; rr(-64, 118, 128, 96, 18); c.fill(); c.stroke(); line(-60, 150, 60, 150); line(-60, 182, 60, 182);
  c.strokeStyle = on ? '#fff3a8' : '#5a6090'; c.lineWidth = 10; c.beginPath(); c.moveTo(-50, 40); c.lineTo(-25, -40); c.lineTo(0, 20); c.lineTo(25, -40); c.lineTo(50, 40); c.stroke();
  if (!on) { c.strokeStyle = RED; c.lineWidth = 26; c.lineCap = 'round'; line(-170, -190, 170, 150); }
  c.restore();
  const l1 = pop(t, .15), l2 = pop(t, .35), l3 = pop(t, .6), l4 = pop(t, 2.0);
  c.save(); c.translate(540, 830); c.scale(l1, l1); label('КАК ПЕРЕЖИТЬ', 0, 0, { size: 124, maxW: 940, stroke: INK, sw: 26 }); c.restore();
  c.save(); c.translate(540, 1030); c.scale(l2, l2); c.rotate(-.03); label('НОЧЬ', 0, 0, { size: 300, fill: YEL, stroke: INK, sw: 34 }); c.restore();
  c.save(); c.translate(540, 1230); c.scale(l3, l3); label('БЕЗ СВЕТА', 0, 0, { size: 168, maxW: 940, fill: '#fff', stroke: INK, sw: 28 }); c.restore();
  c.save(); c.translate(540, 1560); c.scale(l4, l4); c.rotate(.03);
  c.fillStyle = RED; rr(-290, -74, 580, 148, 40); c.fill(); ink(11); c.stroke(); label('3 ПРАВИЛА', 0, 6, { size: 86 }); c.restore();
  c.restore();
}

/* ---------- карточка правила ---------- */
function ruleCard(t, d, n, lines) {
  c.save(); cam(1.02, 540, 960, ...shake(t, .1, 26, .4));
  burstBG(t * 2, '#ff5560', '#a80f26', 'rgba(255,255,255,.08)');
  const a = seg(t, 0, .14), s = lerp(2.6, 1, eOut(a));
  c.save(); c.translate(540, 560); c.scale(s, s); c.globalAlpha = a;
  label('ПРАВИЛО', 0, -180, { size: 110, stroke: INK, sw: 16 });
  label(String(n), 0, 150, { size: 560, fill: YEL, stroke: INK, sw: 40 });
  c.restore();
  lines.forEach((ln, i) => {
    const p = pop(t, 1.0 + i * .16, .25);
    c.save(); c.translate(540, 1210 + i * 190); c.scale(p, p); c.rotate(i ? .02 : -.02);
    label(ln, 0, 0, { size: 170, maxW: 960, stroke: INK, sw: 30 }); c.restore();
  });
  c.restore();
}

/* ---------- дверь ---------- */
function sDoor(t, d) {
  const sh = addv(shake(t, .2, 14), shake(t, .55, 14));
  c.save(); cam(lerp(1.02, 1.07, eIO(t / d)), 540, lerp(975, 960, t / d), ...sh);
  c.fillStyle = '#8f7cc0'; c.fillRect(-100, -100, W + 200, H + 200);
  c.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 10; x < W; x += 110) c.fillRect(x, -100, 40, H + 200);
  c.fillStyle = '#4e4177'; c.fillRect(-100, 1570, W + 200, 500);
  ink(11); c.fillStyle = '#6a5a9c'; c.fillRect(-100, 1530, W + 200, 44); line(-100, 1530, W + 100, 1530); line(-100, 1574, W + 100, 1574);
  // вешалка
  c.fillStyle = '#5b3d2b'; rr(880, 600, 240, 36, 12); c.fill(); c.stroke();
  c.fillStyle = '#3f7f8c'; c.beginPath(); c.moveTo(930, 636); c.lineTo(900, 1120); c.lineTo(1100, 1120); c.lineTo(1100, 636); c.closePath(); c.fill(); c.stroke();
  // дверь
  const dx = sh[0] * .6;
  c.fillStyle = '#5e3b25'; rr(236, 280, 608, 1296, 16); c.fill(); c.stroke();
  c.fillStyle = '#0a0c1c'; c.fillRect(270, 1536, 540, 40);
  c.fillStyle = 'rgba(150,180,255,.9)'; c.fillRect(270, 1552, 540, 24);
  c.fillStyle = '#0a0c1c'; ell(470 + Math.sin(t * 1.3) * 10, 1574, 62, 22); c.fill(); ell(610 + Math.sin(t * 1.3) * 10, 1574, 62, 22); c.fill();
  c.save(); c.translate(dx, 0);
  c.fillStyle = '#a66b42'; rr(270, 312, 540, 1236, 8); c.fill(); c.stroke();
  c.fillStyle = '#93592f'; rr(326, 380, 428, 470, 14); c.fill(); c.stroke(); rr(326, 940, 428, 540, 14); c.fill(); c.stroke();
  c.fillStyle = '#d7b45a'; ell(540, 620, 34, 34); c.fill(); c.stroke(); c.fillStyle = '#10142c'; ell(540, 620, 16, 16); c.fill();
  c.fillStyle = '#d7b45a'; rr(712, 990, 70, 26, 12); c.fill(); c.stroke(); ell(724, 1003, 26, 26); c.fill(); c.stroke();
  c.restore();
  const tr = Math.sin(t * 55) * 3;
  hero({ x: 235 + tr, y: 1700, s: 1.05, look: [.75, -.85], eyes: 'wide', brow: 'scared', mouth: 'grit', sweat: 1 });
  lightmap('#4a4d92', [
    { x: 540, y: 1600, r: 560, c: 'rgba(140,170,255,.75)' },
    { x: 240, y: 1700, r0: 120, r: 480, c: 'rgba(170,170,235,.7)' },
    { x: 540, y: 760, r: 760, c: 'rgba(90,90,160,.4)' },
  ]);
  // ТУК
  [[.2, 800, 430, .12], [.55, 880, 560, -.08]].forEach(([tk, x, y, r]) => {
    const p = seg(t, tk, tk + .15), o = 1 - seg(t, tk + .55, tk + .8); if (t < tk || o <= 0) return;
    c.save(); c.translate(x, y); c.rotate(r); c.scale(.5 + .5 * eBack(p), .5 + .5 * eBack(p)); c.globalAlpha = o;
    label('ТУК', 0, 0, { size: 110, fill: '#fff', stroke: INK, sw: 22 }); c.restore();
  });
  // голос из-за двери
  const b = pop(t, 2.1, .3);
  if (b > 0) {
    c.save(); c.translate(540, 900); c.scale(b, b); c.rotate(Math.sin(t * 5) * .012);
    c.fillStyle = '#fff'; ink(11);
    c.beginPath(); c.moveTo(-40, -150); c.lineTo(0, -246); c.lineTo(50, -150); c.closePath(); c.fill(); c.stroke();
    rr(-400, -160, 800, 320, 60); c.fill(); c.stroke();
    c.fillRect(-34, -168, 78, 20);
    const j = i => (rnd(Math.floor(t * 12) + i) - .5) * 5;
    label('«Сосед… это я.', j(1), -66 + j(2), { size: 70, fam: 'Montserrat', weight: 900, fill: INK });
    label('Одолжи свечку…»', j(3), 62 + j(4), { size: 70, fam: 'Montserrat', weight: 900, fill: INK });
    c.restore();
  }
  c.restore();
  ruleBadge(1);
}

/* ---------- глазок ---------- */
function sPeep(t, d) {
  const st = t < 1.55 ? 0 : (t < 3.0 ? 1 : 2);
  const sh = addv(shake(t, 1.55, 18), shake(t, 3.0, 34, .5));
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const cx = 540, cy = 800, R = 440;
  c.save(); c.translate(sh[0], sh[1]);
  c.save(); ell(cx, cy, R, R); c.clip();
  const g = c.createRadialGradient(cx, cy - 60, 40, cx, cy, R); g.addColorStop(0, '#3d5a5c'); g.addColorStop(1, '#0c1517');
  c.fillStyle = g; c.fillRect(cx - R, cy - R, R * 2, R * 2);
  c.fillStyle = '#16282a'; c.beginPath(); c.moveTo(cx - R, cy + R); c.lineTo(cx - 210, cy + 150); c.lineTo(cx + 210, cy + 150); c.lineTo(cx + R, cy + R); c.fill();   // пол
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 5; for (let i = -3; i <= 3; i++) line(cx + i * 60, cy + 150, cx + i * 150, cy + R);
  c.fillStyle = '#22393b'; c.strokeStyle = '#0a1214'; c.lineWidth = 8; rr(cx - 120, cy - 210, 240, 362, 6); c.fill(); c.stroke();       // дверь напротив
  label('47', cx, cy - 150, { size: 44, fill: 'rgba(255,255,255,.25)' });
  c.fillStyle = '#0a1214'; ell(cx + 86, cy - 10, 10, 10); c.fill();
  c.strokeStyle = '#0a1214'; c.lineWidth = 10; for (let i = 0; i < 5; i++) line(cx + 260 + i * 34, cy + 40 - i * 20, cx + 260 + i * 34, cy + 240 - i * 14);        // перила
  line(cx + 250, cy + 44, cx + 420, cy - 50);
  // фигура
  const sc = [.48, .9, 2.35][st], fy = [cy - 150, cy - 210, cy - 40][st];
  const tilt = st === 0 ? lerp(0, .38, eIO(seg(t, .5, 1.4))) : (st === 1 ? -.3 : .12 * Math.sin(t * 7));
  const fx = cx + (st === 0 ? Math.sin(t * 1.4) * 14 : 0);
  shadeFig(fx, fy, sc, tilt, '#040609');
  shadeFace(fx, fy, sc, tilt, 1, 1);
  const vg = c.createRadialGradient(cx, cy, R * .45, cx, cy, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.92)');
  c.fillStyle = vg; c.fillRect(cx - R, cy - R, R * 2, R * 2);
  c.restore();
  const rg = c.createLinearGradient(cx - R, cy - R, cx + R, cy + R); rg.addColorStop(0, '#e8cf7a'); rg.addColorStop(.5, '#6e5a26'); rg.addColorStop(1, '#c9aa55');
  c.strokeStyle = rg; c.lineWidth = 44; ell(cx, cy, R + 20, R + 20); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 9; ell(cx, cy, R + 43, R + 43); c.stroke(); ell(cx, cy, R - 2, R - 2); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, R - 46, PI * 1.12, PI * 1.38); c.stroke();
  c.restore();
  ruleBadge(1);
}

/* ---------- окно и фонарик ---------- */
const WIN = (() => {
  const cols = [228, 436, 644, 852], rows = [560, 760, 960, 1160, 1360], ws = [];
  rows.forEach((y, r) => cols.forEach((x, q) => ws.push({ x, y, k: r * 4 + q, seen: 99 })));
  const KF = [[3.0, 330, 1230], [3.7, 640, 1110], [4.35, 830, 900], [5.0, 450, 770], [5.6, 250, 570], [6.15, 610, 640], [9, 610, 640]];
  const spot = u => {
    for (let i = 0; i < KF.length - 1; i++) if (u <= KF[i + 1][0]) {
      const p = eIO(seg(u, KF[i][0], KF[i + 1][0])); return [lerp(KF[i][1], KF[i + 1][1], p), lerp(KF[i][2], KF[i + 1][2], p)];
    }
    return [KF[KF.length - 1][1], KF[KF.length - 1][2]];
  };
  for (let u = 3.0; u < 6.5; u += 1 / 60) { const [sx, sy] = spot(u); for (const w of ws) if (w.seen > 90 && Math.hypot(w.x - sx, w.y - sy) < 175) w.seen = u; }
  return { ws, spot };
})();
function sWin(t, d) {
  const ON = 3.0, ALL = 5.95, OFF = 6.75;
  const flick = (t > ON && t < ON + .25) ? (rnd(Math.floor(t * 30)) > .4 ? 1 : .2) : (t > OFF - .3 && t < OFF) ? (rnd(Math.floor(t * 30) + 5) > .5 ? 1 : .1) : 1;
  const on = (t >= ON && t < OFF) ? flick : 0;
  const [sx, sy] = WIN.spot(t);
  const sh = addv(shake(t, ALL, 20, .5), shake(t, OFF, 10));
  c.save(); cam(lerp(1.03, 1.09, eIO(t / d)), 540, lerp(1000, 940, t / d), ...sh);
  c.fillStyle = '#454a86'; c.fillRect(-100, -100, W + 200, H + 200);
  // вид из окна
  c.save(); rr(110, 250, 860, 1230, 10); c.clip();
  const g = c.createLinearGradient(0, 250, 0, 440); g.addColorStop(0, '#0a1030'); g.addColorStop(1, '#1b2863'); c.fillStyle = g; c.fillRect(110, 250, 860, 200);
  c.fillStyle = '#fdf3c4'; ell(830, 330, 40, 40); c.fill();
  c.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { ell(140 + rnd(i * 3.7) * 600, 270 + rnd(i * 9.1) * 110, 4, 4); c.fill(); }
  c.fillStyle = '#2a3368'; c.fillRect(110, 430, 860, 1060);
  c.fillStyle = '#232b5c'; c.fillRect(110, 418, 860, 30);
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 4; for (let y = 470; y < 1480; y += 50) line(110, y, 970, y);
  for (const w of WIN.ws) {
    c.fillStyle = '#3d4884'; c.fillRect(w.x - 80, w.y - 86, 160, 172);
    c.fillStyle = '#141a3d'; c.fillRect(w.x - 68, w.y - 74, 136, 148);
    c.fillStyle = '#04050c'; ell(w.x, w.y - 8, 34, 34); c.fill();
    c.beginPath(); c.moveTo(w.x - 46, w.y + 74); c.lineTo(w.x - 42, w.y + 46); c.quadraticCurveTo(w.x, w.y + 14, w.x + 42, w.y + 46); c.lineTo(w.x + 46, w.y + 74); c.fill();
    c.fillStyle = '#4b5694'; c.fillRect(w.x - 88, w.y + 78, 176, 14);
  }
  c.restore();
  // рама, шторы, подоконник
  ink(12); c.strokeStyle = INK; c.lineWidth = 46; rr(110, 250, 860, 1230, 12); c.stroke();
  c.strokeStyle = '#dfe2f5'; c.lineWidth = 26; rr(110, 250, 860, 1230, 12); c.stroke();
  c.strokeStyle = INK; c.lineWidth = 34; line(540, 262, 540, 1470); c.strokeStyle = '#dfe2f5'; c.lineWidth = 16; line(540, 262, 540, 1470);
  ink(11);
  for (const sd of [0, 1]) {
    c.fillStyle = '#2f7682'; c.beginPath();
    const x0 = sd ? 1100 : -20, x1 = sd ? 930 : 150;
    c.moveTo(x0, 150); c.lineTo(x1, 150); c.quadraticCurveTo(x1 + (sd ? 50 : -50), 800, x1 + (sd ? -10 : 10), 1500); c.lineTo(x0, 1500); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 7; line(lerp(x0, x1, .45), 170, lerp(x0, x1, .5), 1480); c.lineWidth = 11;
  }
  c.fillStyle = '#6b4a36'; rr(-40, 130, 1160, 44, 14); c.fill(); c.stroke();
  c.fillStyle = '#dfe2f5'; rr(60, 1480, 960, 56, 12); c.fill(); c.stroke();
  c.fillStyle = '#c96a4a'; rr(800, 1408, 90, 74, 10); c.fill(); c.stroke(); c.fillStyle = '#4f9b63'; ell(845, 1370, 36, 50); c.fill(); c.stroke();
  // герой и фонарик
  const hx = 300, hy = 1730, tr = t > ALL ? Math.sin(t * 60) * 4 : 0;
  heroBack(hx + tr, hy, 1.0);
  const fx = 610 + tr, fy = 1640, ang = Math.atan2(sy - fy, sx - fx), up = eOut(seg(t, 2.3, 2.9));
  const fyy = lerp(fy + 320, fy, up);
  c.strokeStyle = INK; c.lineWidth = 88; c.lineCap = 'round'; line(470, 1960, fx - 14, fyy + 34);
  c.strokeStyle = HOOD; c.lineWidth = 66; line(470, 1960, fx - 14, fyy + 34);
  c.save(); c.translate(fx, fyy); c.rotate(ang); ink(10);
  c.fillStyle = '#4a4f66'; rr(-40, -26, 130, 52, 12); c.fill(); c.stroke();
  c.fillStyle = '#8a90aa'; c.beginPath(); c.moveTo(90, -30); c.lineTo(128, -46); c.lineTo(128, 46); c.lineTo(90, 30); c.closePath(); c.fill(); c.stroke();
  if (on) { c.fillStyle = '#fff6c9'; ell(130, 0, 10, 42); c.fill(); }
  c.restore();
  c.fillStyle = SKIN; ink(10); ell(fx - 8, fyy + 12, 46, 42); c.fill(); c.stroke();
  // свет
  const lights = [{ x: 830, y: 330, r: 460, c: 'rgba(70,90,180,.45)' }, { x: 330, y: 1720, r0: 100, r: 560, c: 'rgba(140,145,215,.6)' }];
  lightmap('#2b3070', lights, on ? (l) => {
    const nx = Math.cos(ang + PI / 2), ny = Math.sin(ang + PI / 2), bx = fx + Math.cos(ang) * 130, by = fyy + Math.sin(ang) * 130;
    l.fillStyle = `rgba(255,236,170,${.2 * on})`;
    l.beginPath(); l.moveTo(bx + nx * 30, by + ny * 30); l.lineTo(sx + nx * 215, sy + ny * 215); l.lineTo(sx - nx * 215, sy - ny * 215); l.lineTo(bx - nx * 30, by - ny * 30); l.fill();
    const gg = l.createRadialGradient(sx, sy, 60, sx, sy, 250); gg.addColorStop(0, `rgba(255,244,205,${on})`); gg.addColorStop(.75, `rgba(255,236,170,${.75 * on})`); gg.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = gg; l.fillRect(sx - 250, sy - 250, 500, 500);
  } : null);
  // глаза в окнах (светятся сами)
  c.save(); rr(110, 250, 860, 1230, 10); c.clip();
  for (const w of WIN.ws) {
    const tAll = ALL + rnd(w.k * 3.3) * .45;
    const a = Math.max(seg(t, w.seen, w.seen + .12) * (t < ALL ? .95 : 1), seg(t, tAll, tAll + .08));
    if (a <= 0) continue;
    const bl = (Math.floor(t * 30 + w.k * 17) % 97) < 3 ? 0 : 1;
    shadeFace(w.x, w.y - 8, .58, 0, a * bl, t > ALL ? 1 : 0, clamp((300 - w.x) / 500, -1, 1) * 6);
  }
  // пасхалка: отражение того, кто стоит за спиной
  const eg = seg(t, 6.5, 7.4) * .34;
  if (eg > 0) {
    c.globalAlpha = eg; shadeFig(700, 640 + Math.sin(t * 1.2) * 6, 1.25, .1, '#0a0d22'); c.globalAlpha = 1;
    shadeFace(700, 640 + Math.sin(t * 1.2) * 6, 1.25, .1, eg * 1.5, 1);
  }
  c.restore();
  c.restore();
  ruleBadge(2);
}

/* ---------- под одеялом ---------- */
function clockStr(m) { m = Math.floor(m); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function sHide(t, d) {
  const mins = lerp(4, 359, eIO(seg(t, .4, d - .5)));
  const bpm = lerp(1.25, 2.0, seg(t, 0, d - 1.2)), ph = (t * bpm) % 1, beat = Math.max(0, 1 - ph * 5) + .6 * Math.max(0, 1 - Math.abs(ph - .28) * 7);
  c.save(); cam(1.04 + .012 * beat + .04 * t / d, 540, 960);
  c.fillStyle = '#8090da'; c.fillRect(-100, -100, W + 200, H + 200);
  c.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 30; x < W; x += 120) c.fillRect(x, -100, 46, H + 200);
  c.fillStyle = '#51457c'; c.fillRect(-100, 1500, W + 200, 600); ink(11); c.fillStyle = '#6c5d9f'; c.fillRect(-100, 1460, W + 200, 44); line(-100, 1460, W + 100, 1460); line(-100, 1504, W + 100, 1504);
  // пятно лунного света и тени пальцев
  const patch = () => { c.beginPath(); c.moveTo(430, 360); c.lineTo(960, 300); c.lineTo(1010, 900); c.lineTo(500, 980); c.closePath(); };
  c.fillStyle = '#b9c6ff'; patch(); c.fill();
  c.save(); patch(); c.clip();
  c.strokeStyle = '#8090da'; c.lineWidth = 26; line(700, 300, 750, 980); line(440, 650, 1010, 600);
  const grow = eIO(seg(t, .9, 4.2)) * (1 - eIn(seg(t, d - .9, d - .3)));
  c.fillStyle = '#141737';
  for (let i = 0; i < 5; i++) {
    const y0 = 380 + i * 105, len = (480 + rnd(i * 4.4) * 170) * grow * (1 + .04 * Math.sin(t * 3 + i)), wv = Math.sin(t * 2.2 + i * 1.7) * 26;
    c.beginPath(); c.moveTo(1100, y0 - 34); c.quadraticCurveTo(1100 - len * .5, y0 - 30 + wv, 1100 - len, y0 + wv * 1.4);
    c.quadraticCurveTo(1100 - len * .5, y0 + 24 + wv, 1100, y0 + 34); c.fill();
  }
  c.restore();
  // часы
  ink(11); c.fillStyle = '#fff'; ell(220, 560, 118, 118); c.fill(); c.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineWidth = 7; line(220 + Math.cos(a) * 92, 560 + Math.sin(a) * 92, 220 + Math.cos(a) * 104, 560 + Math.sin(a) * 104); }
  const ha = (mins / 720) * TAU - PI / 2, ma = (mins / 60) * TAU - PI / 2;
  c.lineWidth = 13; line(220, 560, 220 + Math.cos(ha) * 56, 560 + Math.sin(ha) * 56);
  c.lineWidth = 9; line(220, 560, 220 + Math.cos(ma) * 86, 560 + Math.sin(ma) * 86);
  c.fillStyle = RED; ell(220, 560, 11, 11); c.fill();
  // одеяло
  ink(12); c.fillStyle = '#e0607c';
  c.beginPath(); c.moveTo(60, 2000); c.bezierCurveTo(120, 1300, 300, 800, 540, 790); c.bezierCurveTo(780, 800, 960, 1300, 1020, 2000); c.closePath(); c.fill(); c.stroke();
  c.save(); c.clip(); c.fillStyle = '#ffc24a';
  for (let i = 0; i < 26; i++) { const px = 120 + rnd(i * 2.2) * 840, py = 860 + rnd(i * 6.1) * 1050; ell(px, py, 20, 20); c.fill(); }
  c.restore();
  c.fillStyle = '#121735'; ell(540, 1070, 200, 178); c.fill(); c.stroke();
  c.save(); ell(540, 1070, 194, 172); c.clip();
  const lx = Math.sin(t * 2.6) > 0 ? .9 : -.9, lxs = lerp(-lx, lx, eOut(seg((t * 2.6 / PI) % 1, 0, .25)));
  hero({ x: 540 + Math.sin(t * 58) * 2.5, y: 1100, s: 1.0, body: false, look: [lxs, -.1], eyes: 'wide', brow: 'scared', mouth: 'small', sweat: 1 });
  c.restore();
  ink(10); c.fillStyle = SKIN;
  for (const sd of [-1, 1]) { ell(540 + sd * 128, 1238, 50, 40); c.fill(); c.stroke(); c.lineWidth = 7; line(540 + sd * 110, 1222, 540 + sd * 112, 1262); line(540 + sd * 140, 1222, 540 + sd * 142, 1262); c.lineWidth = 10; }
  lightmap('#3a3f84', [{ x: 540, y: 1090, r0: 90, r: 420, c: 'rgba(175,180,245,.75)' }], l => {
    l.fillStyle = 'rgba(150,170,255,.62)'; l.beginPath(); l.moveTo(430, 360); l.lineTo(960, 300); l.lineTo(1010, 900); l.lineTo(500, 980); l.fill();
    l.fillStyle = 'rgba(120,130,220,.3)'; l.beginPath(); l.arc(220, 560, 200, 0, TAU); l.fill();
  });
  c.restore();
  const vg = c.createRadialGradient(540, 960, 500, 540, 960, 1150); vg.addColorStop(0, 'rgba(255,30,50,0)'); vg.addColorStop(1, `rgba(255,30,50,${.32 * beat})`);
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  ruleBadge(3);
  hudClock(clockStr(mins), 1, '#fff', 380);
}

/* ---------- рассвет ---------- */
function sDawn(t, d) {
  const p = eIO(seg(t, 0, 1.7));
  c.save(); cam(lerp(1.1, 1.02, eOut(t / d)), 540, 1000);
  drawCity(p, w => seg(t, .7 + w.x / W * .5 + rnd(w.id * 7.7) * .4, .8 + w.x / W * .5 + rnd(w.id * 7.7) * .4) * .9, t);
  c.strokeStyle = INK; c.lineWidth = 7; c.lineCap = 'round';
  for (let i = 0; i < 5; i++) { const bx = 120 + i * 90 + t * 130, by = 620 + i * 46 + Math.sin(t * 3 + i) * 16, fl = Math.sin(t * 14 + i * 2) * 12; c.beginPath(); c.moveTo(bx - 22, by - fl); c.quadraticCurveTo(bx - 8, by - 10, bx, by); c.quadraticCurveTo(bx + 8, by - 10, bx + 22, by - fl); c.stroke(); }
  c.restore();
  hudClock('06:00', 1, YEL);
}
function sRelief(t, d) {
  c.save(); cam(lerp(1.1, 1.04, eOut(t / d)), 540, 1000);
  roomBG(true);
  const ding = t > 1.55;
  hero({
    x: 540, y: 1000 + Math.sin(seg(t, .1, .9) * PI) * 26, s: 1.45, eyes: ding ? 'normal' : 'happy', look: ding ? [.75, -.7] : [0, 0],
    brow: 'up', mouth: ding ? 'flat' : (t < .9 ? 'o' : 'smile'), sweat: 1 - seg(t, 1.0, 1.5),
  });
  for (let i = 0; i < 3; i++) {   // выдох
    const p = seg(t, .15 + i * .12, 1.0 + i * .12); if (p <= 0 || p >= 1) continue;
    c.globalAlpha = (1 - p) * .9; c.fillStyle = '#fff'; ink(8); ell(560 + p * 240, 1150 + p * 90 - i * 40, 26 + p * 46, 20 + p * 34); c.fill(); c.stroke(); c.globalAlpha = 1;
  }
  const b = pop(t, 1.55, .25);
  if (b > 0) {
    c.save(); c.translate(820, 560); c.rotate(.06 + Math.sin(t * 40) * .03 * (1 - seg(t, 1.55, 2.0))); c.scale(b, b);
    c.fillStyle = '#2f6fe4'; ink(11); rr(-190, -100, 380, 200, 50); c.fill(); c.stroke();
    c.fillStyle = '#fff'; rr(-120, -44, 240, 100, 16); c.fill(); c.strokeStyle = '#2f6fe4'; c.lineWidth = 12; c.beginPath(); c.moveTo(-112, -36); c.lineTo(0, 22); c.lineTo(112, -36); c.stroke();
    c.fillStyle = RED; ink(9); ell(170, -90, 46, 46); c.fill(); c.stroke(); label('1', 170, -86, { size: 56 });
    c.restore();
  }
  c.restore();
}

/* ---------- чат ---------- */
function wrap(text, maxW) {
  const out = []; let cur = '';
  for (const w of text.split(' ')) { const tt = cur ? cur + ' ' + w : w; if (c.measureText(tt).width > maxW && cur) { out.push(cur); cur = w; } else cur = tt; }
  if (cur) out.push(cur); return out;
}
function chat(t, msgs, typing, zoom, dark) {
  c.save(); cam(zoom.z, zoom.x, zoom.y);
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#ffd9a0'); g.addColorStop(1, '#f2a36b'); c.fillStyle = g; c.fillRect(-200, -200, W + 400, H + 400);
  c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 9; i++) { ell(rnd(i * 2.2) * W, rnd(i * 5.9) * H, 90 + rnd(i) * 120, 90 + rnd(i) * 120); c.fill(); }
  ink(14); c.fillStyle = '#191922'; rr(90, 150, 900, 1700, 100); c.fill(); c.stroke();
  c.fillStyle = '#eaf0fb'; rr(124, 184, 832, 1632, 72); c.fill();
  c.save(); rr(124, 184, 832, 1632, 72); c.clip();
  c.fillStyle = '#2f6fe4'; c.fillRect(124, 184, 832, 236);
  // аватар соседа
  ink(8); c.fillStyle = '#ffe0a8'; ell(240, 310, 70, 70); c.fill(); c.stroke();
  c.save(); ell(240, 310, 66, 66); c.clip(); c.fillStyle = '#e9b98a'; ell(240, 322, 44, 44); c.fill();
  c.fillStyle = '#4b6cb7'; c.fillRect(190, 264, 100, 34); c.fillStyle = INK; ell(226, 318, 6, 6); c.fill(); ell(254, 318, 6, 6); c.fill();
  c.fillStyle = '#6b4a2e'; rr(216, 332, 48, 14, 7); c.fill(); c.restore();
  label('Сосед Витя', 340, 290, { size: 60, fam: 'Montserrat', weight: 900, align: 'left' });
  label('в сети', 340, 356, { size: 38, fam: 'Montserrat', weight: 800, align: 'left', fill: 'rgba(255,255,255,.75)' });
  let y = 470;
  const SZ = 54, LH = 68, PAD = 32;
  for (const m of msgs) {
    fnt(SZ, 'Montserrat', 800); const lines = wrap(m.text, 640);
    const bw = Math.max(...lines.map(l => c.measureText(l).width)) + PAD * 2, bh = lines.length * LH + PAD * 2 - 10;
    const p = pop(t, m.t, .28);
    if (p > 0) {
      const ax = m.me ? 916 : 164;
      c.save(); c.translate(ax, y + bh); c.scale(p, p); c.translate(-ax, -(y + bh));
      const bx = m.me ? 916 - bw : 164;
      c.fillStyle = 'rgba(20,20,60,.12)'; rr(bx + 4, y + 8, bw, bh, 36); c.fill();
      c.fillStyle = m.me ? '#2f6fe4' : '#fff'; rr(bx, y, bw, bh, 36); c.fill();
      if (m.hot) { c.strokeStyle = RED; c.lineWidth = 8 * seg(t, m.t + 1.0, m.t + 1.5); if (c.lineWidth > 0.5) c.stroke(); }
      lines.forEach((ln, i) => label(ln, bx + PAD, y + PAD + LH * i + LH / 2 - 6, { size: SZ, fam: 'Montserrat', weight: 800, align: 'left', fill: m.me ? '#fff' : INK }));
      c.restore();
    }
    if (t >= m.t) y += bh + 22;
  }
  if (typing && t >= typing[0] && t < typing[1]) {
    c.fillStyle = '#fff'; rr(164, y, 190, 96, 36); c.fill();
    for (let i = 0; i < 3; i++) { c.fillStyle = '#9aa3c0'; const yy = y + 48 - Math.max(0, Math.sin(t * 9 - i * .9)) * 14; ell(214 + i * 46, yy, 13, 13); c.fill(); }
  }
  c.restore();
  ink(14); rr(124, 184, 832, 1632, 72); c.stroke();
  c.fillStyle = SKIN; ink(12); rr(900, 1500, 260, 150, 70); c.fill(); c.stroke();   // палец
  if (dark > 0) { const vg = c.createRadialGradient(540, zoom.y, 300, 540, zoom.y, 1200); vg.addColorStop(0, 'rgba(5,5,20,0)'); vg.addColorStop(1, `rgba(5,5,20,${dark})`); c.fillStyle = vg; c.fillRect(-200, -200, W + 400, H + 400); }
  c.restore();
}
const M1 = [{ t: .35, text: 'Здорово! Я вчера вечером вернулся' }, { t: 3.5, text: 'Свет вырубили, стучал к тебе за свечкой' }, { t: 6.1, text: 'Ты чего не открыл??' }];
function sChat1(t, d) { chat(t, M1, null, { z: lerp(1.0, 1.06, eIO(t / d)), x: 540, y: lerp(960, 900, t / d) }, 0); }
const M2 = [...M1.map(m => ({ ...m, t: -9 })), { t: .15, me: true, text: 'Ахах, а я думал — монстр' }, { t: 1.5, hot: true, text: 'Кстати… а кто стоял у тебя за спиной, когда ты светил в окно?' }];
function sChat2(t, d) {
  const z = eIO(seg(t, 1.7, d));
  chat(t, M2, [.7, 1.5], { z: lerp(1.04, 1.34, z), x: lerp(540, 470, z), y: lerp(960, 1300, z) }, .75 * seg(t, 1.9, d));
}
function sLaugh(t, d) {
  c.save(); cam(1.06, 540, 1000);
  roomBG(true);
  hero({ x: 540, y: 1000 + Math.abs(Math.sin(t * 13)) * -22, s: 1.45, eyes: 'happy', brow: 'up', mouth: 'laugh', tilt: Math.sin(t * 6.5) * .05 });
  c.save(); c.translate(250, 600); c.rotate(-.12); const s = pop(t, .1, .25); c.scale(s, s); label('ФУХ!', 0, 0, { size: 150, fill: YEL, stroke: INK, sw: 28 }); c.restore();
  c.restore();
}

let EGG_LABEL = '0:30';
/* ---------- финал ---------- */
function sFreeze(t, d) {
  const fl = t < .55 ? 1 : (t < 1.05 ? (rnd(Math.floor(t * 30) * 1.7) > .45 ? 1 : .12) : 0);
  const rise = eOut(seg(t, 1.15, 2.2));
  c.save(); cam(lerp(1.06, 1.2, eIO(t / d)), 540, lerp(1000, 950, t / d), ...shake(t, 1.05, 12));
  roomBG(fl > .5);
  const fy = lerp(1500, 690, rise);
  if (rise > 0) shadeFig(820, fy, 1.5, .14, '#04050b');
  hero({
    x: 540 + Math.sin(t * 60) * (t > 1.05 ? 3 : 1), y: 1000, s: 1.45, eyes: 'wide', brow: 'scared', mouth: 'small', pupil: .8,
    look: [lerp(0, .95, eIO(seg(t, 2.1, 2.7))), 0], sweat: seg(t, .1, .5),
  });
  if (fl < 1) lightmap(fl > .5 ? '#ffffff' : mix('#33387a', '#ffffff', fl), [{ x: 540, y: 1010, r0: 150, r: 700, c: 'rgba(150,160,235,.62)' }]);
  if (rise > 0) shadeFace(820, fy, 1.5, .14, seg(t, 1.5, 2.0), 1);
  c.restore();
}
function sEnd(t, d) {
  c.fillStyle = '#04040c'; c.fillRect(0, 0, W, H);
  c.save(); cam(1 + .03 * t / d, 540, 960, ...shake(t, .2, 26, .45));
  const bl = (t > 4.0 && t < 4.12) ? 0 : 1;
  shadeFace(540, 520, 3.2, 0, seg(t, 0, .2) * bl, 1);
  const s1 = seg(t, .2, .32), sc = lerp(2.4, 1, eOut(s1));
  c.save(); c.translate(540, 900); c.scale(sc, sc); c.globalAlpha = s1;
  label('ПРАВИЛО 4', 0, -110, { size: 130, fill: RED });
  label('НЕ ОБОРАЧИВАЙСЯ', 0, 70, { size: 150, maxW: 980 });
  c.restore();
  const a2 = seg(t, 3.15, 3.5);
  c.globalAlpha = a2;
  label(`Пересмотри ${EGG_LABEL}.`, 540, 1250 + (1 - a2) * 30, { size: 66, fam: 'Montserrat', weight: 900, fill: YEL });
  label('Он там уже стоял.', 540, 1345 + (1 - a2) * 30, { size: 66, fam: 'Montserrat', weight: 900, fill: '#fff' });
  c.globalAlpha = 1;
  c.restore();
}

/* ============================================================
   ТАЙМЛАЙН
   ============================================================ */
const VD = window.VOICE_DUR || {};       // длительности реплик озвучки (voice/durations.js)
// cues: [id реплики, старт внутри сцены (сек), текст субтитра или null]
const SC = [
  { n: 'city', d: 5.2, f: sCity, cues: [['city1', .25, '23:47. Обычный вечер.'], ['city2', 3.0, 'И вдруг во всём городе гаснет свет.']] },
  { n: 'room', d: 5.9, f: sRoom, cues: [['room1', .2, 'Сеть пропала. Интернета нет.'], ['room2', 2.5, 'А ровно через минуту… в твою дверь стучат.']] },
  { n: 'title', d: 3.6, f: sTitle, cues: [['title', .4, null]] },
  { n: 'card1', d: 2.5, f: (t, d) => ruleCard(t, d, 1, ['НЕ ОТКРЫВАЙ', 'ДВЕРЬ']), cues: [['rule1', .15, null]] },
  { n: 'door', d: 6.9, f: sDoor, cues: [['door1', .8, 'За дверью — голос.'], ['door_n', 2.1, null], ['door2', 5.25, 'Точь-в-точь как у соседа.']] },
  { n: 'peep', d: 4.0, f: sPeep, cues: [['peep1', .2, 'Вот только сосед…'], ['peep2', 1.7, '…уехал неделю назад.']], capY: 1500 },
  { n: 'card2', d: 2.5, f: (t, d) => ruleCard(t, d, 2, ['НЕ СВЕТИ', 'В ОКНО']), cues: [['rule2', .15, null]] },
  { n: 'win', d: 8.2, f: sWin, cues: [['win1', .3, 'В доме напротив — ни одного огня.'], ['win2', 3.0, 'Но стоит включить фонарик…'], ['win3', 5.9, '…и все они смотрят на тебя.']] },
  { n: 'card3', d: 2.5, f: (t, d) => ruleCard(t, d, 3, ['НИ ЗВУКА', 'ДО УТРА']), cues: [['rule3', .15, null]] },
  { n: 'hide', d: 6.5, f: sHide, cues: [['hide1', .3, 'Они не видят в темноте.'], ['hide2', 2.3, 'Они слушают.'], ['hide3', 4.0, 'Просто сиди. И жди рассвета.']], capY: 1500 },
  { n: 'dawn', d: 2.5, f: sDawn, cues: [['dawn', .3, '06:00. Свет вернулся.']] },
  { n: 'relief', d: 2.7, f: sRelief, cues: [['relief1', .2, 'Ты пережил эту ночь.'], ['relief2', 1.75, 'Наверное.']] },
  { n: 'chat1', d: 7.6, f: sChat1, cues: [['msg1', .45, null], ['msg2', 3.6, null], ['msg3', 6.2, null]] },
  { n: 'laugh', d: 2.0, f: sLaugh, cues: [['laugh', .2, 'Так это и правда был сосед!']] },
  { n: 'chat2', d: 6.2, f: sChat2, cues: [['msg4', 1.6, null]] },
  { n: 'freeze', d: 2.8, f: sFreeze, cues: [] },
  { n: 'end', d: 4.8, f: sEnd, cues: [['rule4', .5, null]] },
];
// реплики не налезают друг на друга: если не помещается — сдвигаем следующую и удлиняем сцену
let acc = 0, prevEnd = 0;
for (const s of SC) {
  s.t0 = acc;
  s.caps = s.cues.map(([id, a, text]) => {
    const vd = VD[id] || ((text || '').length * .07 + .5);
    const t0 = Math.max(s.t0 + a, prevEnd + .2);
    prevEnd = t0 + vd;
    return { id, text, t0, vd };
  });
  if (s.caps.length) s.d = Math.max(s.d, prevEnd - s.t0 + .3);
  s.caps.forEach((cp, i) => { cp.t1 = Math.min(cp.t0 + cp.vd + .3, i + 1 < s.caps.length ? s.caps[i + 1].t0 : s.t0 + s.d); });
  acc += s.d;
}
const DUR = acc;
const at = (n, dt = 0) => +(SC.find(s => s.n === n).t0 + dt).toFixed(3);
const tEgg = at('win', 7.3);
EGG_LABEL = `${Math.floor(tEgg / 60)}:${String(Math.floor(tEgg % 60)).padStart(2, '0')}`;
const VO = SC.flatMap(s => s.caps.map(cp => ({ id: cp.id, t: +cp.t0.toFixed(3), d: cp.vd, scene: s.n, sceneEnd: +(s.t0 + s.d).toFixed(3) })));

/* события для звуковой дорожки */
const EVENTS = [
  ['lights_out', at('city', 2.95)], ['knock', at('room', 4.2)], ['knock', at('room', 4.65)], ['knock_big', at('room', 5.1)],
  ['title', at('title', .05)], ['bulb', at('title', 1.5)],
  ['rule', at('card1')], ['knock', at('door', .2)], ['knock', at('door', .55)],
  ['creep', at('peep', 0)], ['jump', at('peep', 1.55)], ['jump_big', at('peep', 3.0)],
  ['rule', at('card2')], ['click', at('win', 3.0)],
  ...WIN.ws.filter(w => w.seen < 90).map(w => ['eye', at('win', w.seen)]),
  ['jump_big', at('win', 5.95)], ['click', at('win', 6.75)], ['egg', at('win', 6.5)],
  ['rule', at('card3')], ['hide_start', at('hide', 0)], ['hide_end', at('hide', 6.5)],
  ['dawn', at('dawn', 0)], ['puff', at('relief', .15)], ['ding', at('relief', 1.55)],
  ['msg', at('chat1', .35)], ['msg', at('chat1', 3.5)], ['msg', at('chat1', 6.1)], ['laugh', at('laugh', 0)],
  ['sent', at('chat2', .15)], ['typing', at('chat2', .7)], ['msg_bad', at('chat2', 1.5)], ['riser', at('chat2', 1.9)],
  ['freeze', at('freeze', 0)], ['flicker', at('freeze', .55)], ['lights_out2', at('freeze', 1.05)], ['final', at('end', .2)], ['end', DUR],
].map(([name, t]) => ({ name, t }));

/* ---------- субтитры ---------- */
function drawCaption(cap, T, y0) {
  const SZ = 84, LH = 104;
  fnt(SZ, 'Montserrat', 900); c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const words = cap.text.split(' '), sp = c.measureText(' ').width, maxW = 940;
  const lines = [[]]; let lw = 0;
  words.forEach((w, i) => { const ww = c.measureText(w).width; if (lw + ww > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ w, ww, i }); lw += ww + sp; });
  const wt = words.map(w => w.length + 3), tot = wt.reduce((a, b) => a + b, 0), span = cap.vd;
  let a = 0; const st = wt.map(v => { const s = cap.t0 + a / tot * span; a += v; return s; });
  let cur = 0; st.forEach((s, i) => { if (T >= s) cur = i; });
  const p = .78 + .22 * eBack(seg(T, cap.t0, cap.t0 + .16));
  c.save(); c.translate(W / 2, y0); c.scale(p, p);
  const pos = [];
  lines.forEach((ln, li) => {
    const tw = ln.reduce((s, o) => s + o.ww, 0) + sp * (ln.length - 1); let x = -tw / 2; const y = (li - (lines.length - 1) / 2) * LH;
    for (const o of ln) { pos.push({ ...o, x, y }); x += o.ww + sp; }
  });
  c.strokeStyle = '#0b0a1a'; c.lineWidth = 24; for (const o of pos) c.strokeText(o.w, o.x, o.y + 5);
  for (const o of pos) {
    if (o.i === cur) { const k = 1 + .1 * (1 - seg(T, st[cur], st[cur] + .14)); c.save(); c.translate(o.x + o.ww / 2, o.y); c.scale(k, k); c.fillStyle = YEL; c.fillText(o.w, -o.ww / 2, 0); c.restore(); }
    else { c.fillStyle = o.i < cur ? '#fff' : 'rgba(255,255,255,.96)'; c.fillText(o.w, o.x, o.y); }
  }
  c.restore();
}

/* ---------- плёночное зерно и виньетка ---------- */
const GR = document.createElement('canvas'); GR.width = 360; GR.height = 640;
(() => {
  const g = GR.getContext('2d'), im = g.createImageData(360, 640);
  for (let i = 0; i < 360 * 640; i++) { const v = 128 + (rnd(i * .731 + 5) - .5) * 150; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
})();
function post(f) {
  const vg = c.createRadialGradient(540, 960, 620, 540, 960, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.42)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = .1; c.globalCompositeOperation = 'overlay';
  const ox = Math.floor(rnd(f * 1.3) * 300), oy = Math.floor(rnd(f * 2.9) * 300);
  c.drawImage(GR, -ox, -oy, 360 * 4, 640 * 4); c.restore();
}

/* ---------- кадр ---------- */
function renderFrame(T) {
  T = clamp(T, 0, DUR - 1e-4);
  let s = SC[SC.length - 1]; for (const q of SC) if (T >= q.t0 && T < q.t0 + q.d) { s = q; break; }
  const t = T - s.t0;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  const pz = 1 + .05 * (1 - eOut(seg(t, 0, .22)));       // «удар» зума на склейке
  c.save(); c.translate(W / 2, H / 2); c.scale(pz, pz); c.translate(-W / 2, -H / 2);
  s.f(t, s.d);
  c.restore();
  for (const cp of s.caps) if (cp.text && T >= cp.t0 && T < cp.t1) drawCaption(cp, T, s.capY || 1400);
  post(Math.floor(T * FPS + .5));
}
window.FILM = { W, H, FPS, DUR, EVENTS, VO, SCENES: SC.map(s => ({ n: s.n, t0: s.t0, d: s.d })), renderFrame };
