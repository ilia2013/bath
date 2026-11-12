'use strict';
/* «Ночь в торговом центре» — движок: 1920x1080, 30 fps. Кадр рисуется по времени T из window.TIMELINE (build2.py). */
const W = 1920, H = 1080, FPS = 30;
const cv = document.getElementById('c'), c = cv.getContext('2d');
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a)), eOut = t => 1 - Math.pow(1 - t, 3), eIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const PI = Math.PI, TAU = PI * 2;
const INK = '#17142e', SKIN = '#f7cfa6', YEL = '#ffd84a', RED = '#ff3b47';
function rr(x, y, w, h, r = 0) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function ell(x, y, rx, ry = rx) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, TAU); }
function line(x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function ink(w = 9) { c.strokeStyle = INK; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; }
function box(x, y, w, h, fill, r = 0, lw = 8) { c.fillStyle = fill; rr(x, y, w, h, r); c.fill(); if (lw) { ink(lw); c.stroke(); } }
function poly(pts, fill, lw = 8) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (lw) { ink(lw); c.stroke(); } }
function fnt(size, fam = 'Russo One', weight = 400) { c.font = `${weight} ${size}px "${fam}"`; }
function label(text, x, y, o = {}) {
  const { size = 80, fam = 'Russo One', weight = 400, fill = '#fff', stroke = null, sw = 14, align = 'center', maxW = 0 } = o;
  fnt(size, fam, weight); let s = size; if (maxW) { const w = c.measureText(text).width; if (w > maxW) { s = size * maxW / w; fnt(s, fam, weight); } }
  c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = sw; c.strokeText(text, x, y); }
  c.fillStyle = fill; c.fillText(text, x, y);
}
/* ---------- свет ---------- */
const LM = document.createElement('canvas'); LM.width = W / 2; LM.height = H / 2; const lm = LM.getContext('2d');
function lightmap(amb, lights = [], extra) {
  lm.setTransform(.5, 0, 0, .5, 0, 0); lm.globalAlpha = 1; lm.globalCompositeOperation = 'source-over'; lm.fillStyle = amb; lm.fillRect(0, 0, W, H);
  lm.globalCompositeOperation = 'lighter'; lm.fillStyle = 'rgb(46,46,64)'; lm.fillRect(0, 0, W, H);   // общий подъём яркости
  for (const L of lights) { const g = lm.createRadialGradient(L.x, L.y, L.r0 || 0, L.x, L.y, L.r); g.addColorStop(0, L.c); g.addColorStop(1, 'rgba(0,0,0,0)'); lm.fillStyle = g; lm.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2); }
  if (extra) extra(lm);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'multiply'; c.drawImage(LM, 0, 0, W, H); c.restore();
}
/* ---------- персонажи ---------- */
const EMO = {
  neutral: { eyes: 'n', brow: 'n', mouth: 'flat' }, scared: { eyes: 'w', brow: 's', mouth: 'small', sweat: 1 }, wide: { eyes: 'w', brow: 's', mouth: 'o', sweat: 1 },
  happy: { eyes: 'h', brow: 'u', mouth: 'smile' }, sad: { eyes: 'n', brow: 's', mouth: 'small', look: [0, .7] }, tired: { eyes: 'n', brow: 'n', mouth: 'flat', lid: .55 },
  sleep: { eyes: 'n', brow: 'n', mouth: 'small', lid: 1 }, angry: { eyes: 'n', brow: 'a', mouth: 'flat' }, cry: { eyes: 'c', brow: 's', mouth: 'scared', tears: 1 },
  smile: { eyes: 'w', brow: 'n', mouth: 'grin', creepy: 1 }, turn: { eyes: 'w', brow: 'n', mouth: 'grin', creepy: 1, tilt: .5 }, talk: { eyes: 'n', brow: 'n', mouth: 'flat' },
};
const KIND = {
  hero: { skin: SKIN, hair: '#3b2719', body: '#f6a531', collar: '#d98a1c' },
  double: { skin: '#d8cfc8', hair: '#1b1410', body: '#f6a531', collar: '#d98a1c', black: 1 },
  anya: { skin: '#fbd9b9', hair: '#8a4320', body: '#8e6bd6', collar: '#6f4fb8' },
  petr: { skin: '#eec39c', hair: '#c9ccd6', body: '#3d4f7a', collar: '#2c3a5c' },
  cashier: { skin: '#f4e6dd', hair: '#1c1a26', body: '#d63a3a', collar: '#a82828' },
};
function person(o) {
  const k = KIND[o.kind], e = EMO[o.emo] || EMO.neutral, T = o.T || 0, talk = o.talk || 0;
  const look = o.look || e.look || [0, 0], R = 170;
  c.save(); c.translate(o.x, o.y + (talk > .05 ? -talk * 6 : 0)); c.scale(o.s * (o.flip ? -1 : 1), o.s); if (o.alpha) c.globalAlpha = o.alpha; ink(11);
  if (o.kind === 'anya') { c.fillStyle = k.hair; rr(-196, -60, 392, 330, 150); c.fill(); c.stroke(); }
  // тело
  c.fillStyle = k.body; c.beginPath(); c.moveTo(-200, 900); c.lineTo(-200, 310); c.bezierCurveTo(-200, 190, -115, 150, 0, 150); c.bezierCurveTo(115, 150, 200, 190, 200, 310); c.lineTo(200, 900); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = k.collar; ell(0, 186, 128, 50); c.fill(); c.stroke();
  if (o.kind === 'hero' || o.kind === 'double') { c.lineWidth = 8; line(-38, 226, -44, 300); line(38, 226, 44, 300); }
  if (o.kind === 'petr') { c.fillStyle = YEL; rr(70, 330, 70, 84, 12); c.fill(); ink(7); c.stroke(); ink(8); line(0, 236, 0, 600); }
  if (o.kind === 'cashier') { c.fillStyle = '#fff'; rr(-150, 320, 110, 56, 10); c.fill(); ink(6); c.stroke(); }
  if (o.kind === 'anya') { c.strokeStyle = INK; c.lineWidth = 44; line(-150, 240, -130, 620); line(150, 240, 130, 620); c.strokeStyle = '#3aa58b'; c.lineWidth = 28; line(-150, 240, -130, 620); line(150, 240, 130, 620); }
  ink(11); c.rotate((e.tilt || 0) + (o.tilt || 0));
  c.fillStyle = k.skin; ell(-R + 6, 22, 26, 34); c.fill(); c.stroke(); ell(R - 6, 22, 26, 34); c.fill(); c.stroke();
  ell(0, 0, R, R); c.fill(); c.stroke();
  // волосы / головные уборы
  c.fillStyle = k.hair;
  if (o.kind === 'hero' || o.kind === 'double') {
    c.beginPath(); c.arc(0, 0, R, PI * 1.02, PI * 1.98); c.bezierCurveTo(R * .62, -R * .28, R * .34, -R * .62, R * .02, -R * .5); c.bezierCurveTo(-R * .12, -R * .28, -R * .42, -R * .36, -R * .58, -R * .46);
    c.bezierCurveTo(-R * .78, -R * .3, -R * .92, -R * .2, -R * .998, -R * .06); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-20, -R + 4); c.quadraticCurveTo(10, -R - 62, 62, -R - 34); c.quadraticCurveTo(34, -R - 20, 40, -R + 8); c.closePath(); c.fill(); c.stroke();
  } else if (o.kind === 'anya') {
    c.beginPath(); c.arc(0, 0, R, PI * .98, PI * 2.02); c.bezierCurveTo(R * .7, -R * .1, R * .5, -R * .55, 0, -R * .5); c.bezierCurveTo(-R * .5, -R * .55, -R * .7, -R * .1, -R, R * .06); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(R * .75, -R * .75); c.bezierCurveTo(R * 1.5, -R * 1.1, R * 1.7, -R * .1, R * 1.25, R * .5); c.bezierCurveTo(R * 1.3, -R * .1, R * 1.1, -R * .5, R * .86, -R * .5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ff6fa3'; ell(R * .82, -R * .66, 20, 20); c.fill(); c.stroke();
  } else if (o.kind === 'petr') {
    for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * (R - 14), -30, 34, 70, 0, 0, TAU); c.fill(); c.stroke(); }
    c.fillStyle = '#26324f'; c.beginPath(); c.arc(0, -40, R + 6, PI * 1.03, PI * 1.97); c.closePath(); c.fill(); c.stroke();
    rr(-R - 30, -82, R * 2 + 60, 44, 20); c.fill(); c.stroke(); c.fillStyle = YEL; ell(0, -128, 26, 26); c.fill(); ink(7); c.stroke(); ink(11);
  } else if (o.kind === 'cashier') {
    ell(0, -R - 6, 54, 46); c.fill(); c.stroke();
    c.beginPath(); c.arc(0, 0, R, PI * 1.0, PI * 2.0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e02f2f'; c.beginPath(); c.arc(0, -34, R + 4, PI * 1.04, PI * 1.96); c.closePath(); c.fill(); c.stroke(); rr(-40, -90, R + 110, 40, 18); c.fill(); c.stroke();
  }
  // лицо
  const lx = look[0] * 16, ly = look[1] * 14, blinkT = (T * .37 + o.x * .01) % 1, blink = e.creepy ? 0 : (blinkT < .035 ? 1 : 0), lid = Math.max(e.lid || 0, blink);
  c.fillStyle = 'rgba(255,110,110,.25)'; if (!e.creepy) { ell(-112, 58, 26, 20); c.fill(); ell(112, 58, 26, 20); c.fill(); }
  for (const sd of [-1, 1]) {
    const ex = sd * 66 + lx * .5, ey = -4 + ly * .5;
    if (e.eyes === 'h') { ink(11); c.beginPath(); c.arc(ex, ey + 14, 34, PI * 1.12, PI * 1.88); c.stroke(); continue; }
    if (e.eyes === 'c') { ink(11); c.beginPath(); c.arc(ex, ey - 6, 34, PI * .12, PI * .88); c.stroke(); continue; }
    const wide = e.eyes === 'w', rx = wide ? 47 : 40, ry = (wide ? 54 : 44) * (1 - lid * .93);
    c.fillStyle = k.black ? '#07060c' : '#fff'; ell(ex, ey, rx, ry); c.fill(); ink(9); c.stroke();
    if (lid < .8) {
      c.save(); ell(ex, ey, rx - 3, Math.max(1, ry - 3)); c.clip();
      if (k.black) { c.fillStyle = '#fff'; ell(ex - 12, ey - 14, 7); c.fill(); }
      else { const pr = e.creepy ? 8 : (wide ? 12 : 18); c.fillStyle = INK; ell(ex + lx * 1.15, ey + ly * 1.15, pr); c.fill(); c.fillStyle = '#fff'; ell(ex + lx * 1.15 - pr * .35, ey + ly * 1.15 - pr * .35, pr * .3); c.fill(); }
      c.restore();
    }
  }
  ink(12);
  for (const sd of [-1, 1]) {
    const by = (e.eyes === 'w' ? -84 : -70), b = e.brow; if (o.kind === 'petr') c.strokeStyle = '#8f93a3';
    if (b === 's') line(sd * 30, by - 22, sd * 106, by + 6); else if (b === 'a') line(sd * 30, by + 8, sd * 104, by - 18);
    else if (b === 'u') { c.beginPath(); c.moveTo(sd * 30, by - 14); c.quadraticCurveTo(sd * 68, by - 36, sd * 106, by - 12); c.stroke(); } else line(sd * 32, by, sd * 102, by - 4);
  }
  ink(10); const mx = lx * .5, my = 92 + (o.kind === 'petr' ? 14 : 0);
  if (talk > .06) { c.fillStyle = '#5a1a24'; ell(mx, my + 2, 26 + talk * 8, 6 + talk * 30); c.fill(); c.stroke(); }
  else if (e.mouth === 'smile') { c.beginPath(); c.arc(mx, my - 26, 46, PI * .16, PI * .84); c.stroke(); }
  else if (e.mouth === 'flat') line(mx - 26, my, mx + 26, my);
  else if (e.mouth === 'small') { c.beginPath(); c.arc(mx, my + 22, 22, PI * 1.2, PI * 1.8); c.stroke(); }
  else if (e.mouth === 'o') { c.fillStyle = '#5a1a24'; ell(mx, my + 2, 22, 28); c.fill(); c.stroke(); }
  else if (e.mouth === 'scared') { c.fillStyle = '#5a1a24'; ell(mx, my + 4, 40, 24); c.fill(); c.stroke(); }
  else if (e.mouth === 'grin') {
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-104, 52); c.quadraticCurveTo(0, 150, 104, 52); c.quadraticCurveTo(0, 96, -104, 52); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 5; for (let i = -3; i <= 3; i++) line(i * 26, 76 - Math.abs(i) * 3, i * 26, 112 - Math.abs(i) * 7);
  }
  if (o.kind === 'petr') { c.fillStyle = '#c9ccd6'; ink(9); c.beginPath(); c.moveTo(-74, 70); c.quadraticCurveTo(-30, 40, 0, 62); c.quadraticCurveTo(30, 40, 74, 70); c.quadraticCurveTo(34, 96, 0, 80); c.quadraticCurveTo(-34, 96, -74, 70); c.fill(); c.stroke(); }
  if (e.sweat) { c.fillStyle = '#9fe3ff'; ink(6); const dx = 128, dy = -86; c.beginPath(); c.moveTo(dx, dy - 30); c.bezierCurveTo(dx + 22, dy, dx + 20, dy + 22, dx, dy + 22); c.bezierCurveTo(dx - 20, dy + 22, dx - 22, dy, dx, dy - 30); c.fill(); c.stroke(); }
  if (e.tears) { c.fillStyle = '#9fe3ff'; ink(6); for (const sd of [-1, 1]) { const ty = 40 + ((T * 60 + sd * 20) % 70); ell(sd * 66, ty, 11, 15); c.fill(); c.stroke(); } }
  if (o.emo === 'sleep') label('z Z', 190, -190 - (T * 20 % 30), { size: 70, fill: '#cfd6ff', stroke: INK, sw: 12 });
  c.restore();
}
function mannequin(x, y, s, coat = '#7c5ba6', a = 1) {
  c.save(); c.translate(x, y); c.scale(s, s); c.globalAlpha = a; ink(8);
  c.fillStyle = '#9a9aa8'; rr(-8, 300, 16, 220, 4); c.fill(); ell(0, 520, 70, 16); c.fill(); c.stroke();
  c.fillStyle = coat; c.beginPath(); c.moveTo(-86, 330); c.lineTo(-92, 90); c.quadraticCurveTo(-90, 40, 0, 40); c.quadraticCurveTo(90, 40, 92, 90); c.lineTo(86, 330); c.closePath(); c.fill(); c.stroke(); line(0, 60, 0, 330);
  c.strokeStyle = INK; c.lineWidth = 40; line(-96, 80, -110, 260); line(96, 80, 110, 260); c.strokeStyle = coat; c.lineWidth = 26; line(-96, 80, -110, 260); line(96, 80, 110, 260); ink(8);
  c.fillStyle = '#f1f0f5'; rr(-16, 6, 32, 44, 8); c.fill(); c.stroke(); c.beginPath(); c.ellipse(0, -40, 52, 62, 0, 0, TAU); c.fill(); c.stroke(); ell(-110, 268, 14); c.fill(); c.stroke(); ell(110, 268, 14); c.fill(); c.stroke();
  c.restore();
}
function shadeFig(x, y, s, tilt = 0, col = '#05060d') {
  c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-104, 120); c.bezierCurveTo(-112, 56, 112, 56, 104, 120); c.lineTo(72, 1100); c.lineTo(-72, 1100); c.closePath(); c.fill();
  c.lineWidth = 26; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 94, 126); c.quadraticCurveTo(sd * 160, 400, sd * 128, 660); c.stroke(); }
  c.rotate(tilt); ell(0, 0, 86); c.fill(); c.restore();
}
function shadeArm(x, y, s, ang, col = '#05060d') { c.save(); c.translate(x, y); c.scale(s, s); c.strokeStyle = col; c.lineCap = 'round'; c.lineWidth = 26; c.beginPath(); c.moveTo(94, 126); c.lineTo(94 + Math.cos(ang) * 330, 126 + Math.sin(ang) * 330); c.stroke(); c.restore(); }
function shadeFace(x, y, s, tilt = 0, a = 1, smile = 1) {
  if (a <= 0) return; c.save(); c.translate(x, y); c.scale(s, s); c.rotate(tilt); c.globalAlpha = a; c.shadowColor = 'rgba(255,255,255,.9)'; c.shadowBlur = 22; c.fillStyle = '#fff';
  ell(-30, -8, 13, 15); c.fill(); ell(30, -8, 13, 15); c.fill();
  if (smile) { c.strokeStyle = '#fff'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.arc(0, -10, 48, PI * .2, PI * .8); c.stroke(); } c.restore();
}
function hudClock(text, col = '#fff', x = W / 2, y = 110, size = 96) {
  fnt(size); const w = c.measureText(text).width + 90; c.fillStyle = 'rgba(8,9,24,.8)'; rr(x - w / 2, y - size * .78, w, size * 1.56, 36); c.fill(); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 5; c.stroke();
  label(text, x, y + 5, { size, fill: col });
}
