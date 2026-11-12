'use strict';
/* Сцены. Каждая: (A — набор флагов, K — параметры, u — время в шоте, d — длина шота, T — общее время)
   рисует фон и возвращает { amb, lights, extra, after } для света и светящихся деталей. */
const NIGHT = '#2a2f6a';
function shutter(x, y, w, h, lit) {
  box(x, y, w, h, lit ? lit : '#8b90b0', 6, 6);
  if (!lit) { c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 3; for (let yy = y + 14; yy < y + h - 4; yy += 14) line(x + 6, yy, x + w - 6, yy); }
}
function snow(T, n = 70, y0 = 0, y1 = H) { c.fillStyle = '#fff'; for (let i = 0; i < n; i++) { const x = (rnd(i * 3.1) * W + Math.sin(T + i) * 30) % W, y = y0 + ((rnd(i * 7.7) * (y1 - y0) + T * (40 + rnd(i) * 50)) % (y1 - y0)); ell(x, y, 3 + rnd(i * 2) * 4); c.fill(); } }
function stars(n, T) { for (let i = 0; i < n; i++) { c.fillStyle = `rgba(255,255,255,${.4 + .5 * Math.abs(Math.sin(T + i * 2))})`; ell(rnd(i * 1.1) * W, rnd(i * 2.3) * 200, 2 + rnd(i * 5) * 3); c.fill(); } }
function speakerIcon(x, y, T, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s); box(-90, -60, 180, 120, '#3b4066', 18); c.fillStyle = '#15172e'; ell(0, 0, 44); c.fill(); ink(6); c.stroke(); ell(0, 0, 16); c.fillStyle = '#6b72a8'; c.fill();
  c.strokeStyle = '#ffe9a3'; c.lineWidth = 9; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const p = (T * 1.4 + i / 3) % 1; c.globalAlpha = 1 - p; for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 100, 0, 30 + p * 110, sd > 0 ? -PI * .28 : PI * .72, sd > 0 ? PI * .28 : PI * 1.28); c.stroke(); } } c.restore();
}
const SC = {
  black(A, K) { c.fillStyle = '#04040c'; c.fillRect(0, 0, W, H); if (K.t) label(K.t, W / 2, H / 2, { size: 380, fill: RED }); return {}; },
  chapter(A, K, u, d) {
    const g = c.createRadialGradient(960, 540, 60, 960, 540, 1100); g.addColorStop(0, '#2b1c6b'); g.addColorStop(1, '#07051a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.globalAlpha = .08; label(String(K.n), 960, 560, { size: 900 }); c.restore();
    const p = eBack(seg(u, .1, .45)), q = eBack(seg(u, .35, .7));
    c.save(); c.translate(960, 400); c.scale(p, p); label('ГЛАВА ' + K.n, 0, 0, { size: 90, fill: YEL, stroke: INK, sw: 18 }); c.restore();
    c.save(); c.translate(960, 580); c.scale(q, q); label(K.title, 0, 0, { size: 170, maxW: 1600, stroke: INK, sw: 30 }); c.restore();
    c.fillStyle = RED; c.fillRect(960 - 300 * seg(u, .5, 1.1), 720, 600 * seg(u, .5, 1.1), 12); return {};
  },
  title(A, K, u) {
    const g = c.createRadialGradient(960, 540, 60, 960, 540, 1100); g.addColorStop(0, '#3a1030'); g.addColorStop(1, '#05030c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(960, 540); c.rotate(u * .1); c.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 12; i++) { c.rotate(TAU / 12); c.beginPath(); c.moveTo(0, 0); c.lineTo(-150, -1500); c.lineTo(150, -1500); c.fill(); } c.restore();
    const a = eBack(seg(u, .1, .5)), b = eBack(seg(u, .4, .8)), d2 = eBack(seg(u, 1.2, 1.6));
    c.save(); c.translate(960, 330); c.scale(a, a); label('НОЧЬ', 0, 0, { size: 330, fill: YEL, stroke: INK, sw: 40 }); c.restore();
    c.save(); c.translate(960, 620); c.scale(b, b); label('В ТОРГОВОМ ЦЕНТРЕ', 0, 0, { size: 170, maxW: 1700, stroke: INK, sw: 32 }); c.restore();
    c.save(); c.translate(960, 850); c.scale(d2, d2); c.rotate(-.02); box(-470, -70, 940, 140, RED, 36, 10); label('5 ПРАВИЛ ДО 6:00', 0, 6, { size: 84 }); c.restore(); return {};
  },
  final(A, K, u) {
    c.fillStyle = '#04040c'; c.fillRect(0, 0, W, H); shadeFace(960, 300, 3, 0, seg(u, 0, .3), 1);
    const s = seg(u, .3, .45); c.save(); c.translate(960, 620); c.scale(lerp(2.2, 1, eOut(s)), lerp(2.2, 1, eOut(s))); c.globalAlpha = s;
    label('ПРАВИЛО ШЕСТОЕ', 0, -90, { size: 110, fill: RED }); label('НЕ ЗАСЫПАЙ', 0, 80, { size: 200 }); c.restore(); return {};
  },
  outro(A, K, u, d, T) {
    const g = c.createRadialGradient(960, 540, 60, 960, 540, 1100); g.addColorStop(0, '#2b1c6b'); g.addColorStop(1, '#07051a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    label('В СЛЕДУЮЩЕЙ СЕРИИ', 960, 250, { size: 80, fill: YEL, stroke: INK, sw: 16 });
    label('МЕТРО ПОСЛЕ', 960, 430, { size: 190, stroke: INK, sw: 32 }); label('ПОСЛЕДНЕГО ПОЕЗДА', 960, 620, { size: 190, maxW: 1700, stroke: INK, sw: 32 });
    const p = 1 + .04 * Math.sin(T * 5); c.save(); c.translate(960, 860); c.scale(p, p); box(-330, -70, 660, 140, RED, 40, 10); label('ПОДПИШИСЬ', 0, 6, { size: 92 }); c.restore(); return {};
  },
  fitting(A, K, u, d, T) {
    c.fillStyle = '#c9b8e6'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(255,255,255,.14)'; for (let x = 40; x < W; x += 160) c.fillRect(x, 0, 60, H);
    box(-20, 880, W + 40, 240, '#7a5a48', 0, 8);
    box(1240, 120, 420, 700, '#e9ecff', 16, 12); c.fillStyle = 'rgba(255,255,255,.5)'; poly([[1290, 170], [1400, 170], [1300, 520], [1290, 520]], 'rgba(255,255,255,.55)', 0);
    box(160, 60, 1100, 34, '#8a8fa8', 12);
    for (let i = 0; i < 6; i++) { const x = 130 + i * 70; c.fillStyle = i % 2 ? '#b2475f' : '#c9566f'; c.beginPath(); c.moveTo(x, 94); c.quadraticCurveTo(x + 40 + Math.sin(T + i) * 6, 500, x + 10, 900); c.lineTo(x + 80, 900); c.quadraticCurveTo(x + 110, 500, x + 70, 94); c.closePath(); c.fill(); ink(8); c.stroke(); }
    box(760, 250, 40, 16, '#8a8fa8', 6, 6); poly([[700, 270], [860, 270], [900, 620], [660, 620]], '#3e7d6a'); line(780, 270, 780, 620);
    return { amb: A.has('mirror') ? '#454a92' : '#33376f', lights: [{ x: 960, y: 500, r0: 150, r: 900, c: 'rgba(170,175,245,.7)' }] };
  },
  phone(A, K, u, d, T) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b1f4d'); g.addColorStop(1, '#0a0b22'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.save(); c.translate(960, 560); c.rotate(-.04 + Math.sin(T * 1.3) * .01); box(-300, -500, 600, 1000, '#15151c', 70, 14); box(-268, -468, 536, 936, '#101a3a', 46, 0);
    label(K.time || '00:00', 0, -240, { size: 190 }); if (K.date) label(K.date.replace(/_/g, ' '), 0, -100, { size: 62, fill: YEL, fam: 'Montserrat', weight: 900 });
    const b = +K.bat || 0; box(140, -440, 90, 40, 'rgba(0,0,0,0)', 8, 5); c.fillStyle = b < 10 ? RED : '#6fe08a'; c.fillRect(146, -434, Math.max(6, 78 * b / 100), 28); label(b + '%', 80, -420, { size: 40, fam: 'Montserrat', weight: 800, align: 'right' });
    for (let i = 0; i < 4; i++) { c.fillStyle = +K.net ? '#fff' : '#555a80'; c.fillRect(-240 + i * 22, -404 - i * 10, 14, 14 + i * 10); } if (!+K.net) { c.strokeStyle = RED; c.lineWidth = 8; line(-250, -448, -160, -396); }
    if (K.calls) { box(-240, 20, 480, 150, '#fff', 30, 0); label(K.calls + ' пропущенных', 0, 66, { size: 46, fill: INK, fam: 'Montserrat', weight: 900 }); label('МАМА', 0, 126, { size: 44, fill: RED, fam: 'Montserrat', weight: 900 }); box(-240, 200, 480, 150, '#2f6fe4', 30, 0); label('ТЦ «Галерея»', 0, 246, { size: 40, fam: 'Montserrat', weight: 900 }); label('1 уведомление', 0, 306, { size: 40, fam: 'Montserrat', weight: 800 }); }
    else if (!+K.net) label('нет сети', 0, 120, { size: 60, fill: '#8f96c8', fam: 'Montserrat', weight: 800 });
    c.restore(); return {};
  },
  atrium(A, K, u, d, T) {
    const day = A.has('day'), lit = A.has('lit') || A.has('crowd'), dark = !day && !lit;
    const g = c.createLinearGradient(0, 0, 0, 240); if (day) { g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, '#e3f5ff'); } else { g.addColorStop(0, '#080d2c'); g.addColorStop(1, '#1b2863'); } c.fillStyle = g; c.fillRect(0, 0, W, 240);
    if (!day) { stars(40, T); c.fillStyle = '#fdf3c4'; ell(1500, 110, 60); c.fill(); } else { c.fillStyle = '#fff3b0'; ell(1500, 110, 60); c.fill(); }
    ink(8); for (let x = 0; x <= W; x += 240) line(x, 0, x, 240); line(0, 120, W, 120);
    box(-10, 232, W + 20, 30, '#7d83ad', 0, 8); c.fillStyle = '#d6d9f2'; c.fillRect(0, 262, W, 600);
    const cols = ['#ff7b6b', '#6bd6ff', '#ffd84a', '#8be08a', '#c98bff', '#ff9bd2'];
    for (let f = 0; f < 3; f++) {
      const y = 280 + f * 190;
      for (let i = 0; i < 7; i++) { const x = 30 + i * 270; if (i === 3) continue; shutter(x, y + 34, 230, 110, (lit || day) ? (day ? '#f4f7ff' : cols[(i + f * 2) % 6]) : null); box(x + 20, y, 190, 30, cols[(i + f) % 6], 6, 6); }
      box(-10, y + 150, W + 20, 22, '#8f95bd', 0, 7); c.fillStyle = 'rgba(160,200,255,.35)'; c.fillRect(0, y + 110, W, 40); ink(6); for (let x = 0; x <= W; x += 96) line(x, y + 110, x, y + 150); line(0, y + 110, W, y + 110);
      if (lit) for (let x = 20; x < W; x += 48) { c.fillStyle = cols[Math.floor(x / 48 + f + T * 3) % 6]; ell(x, y + 162 + Math.sin(x) * 6, 9); c.fill(); }
    }
    c.fillStyle = '#b9bedc'; c.fillRect(0, 850, W, 230); ink(8); line(0, 850, W, 850); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 4; for (let i = -6; i <= 6; i++) line(960 + i * 160, 850, 960 + i * 420, 1080);
    for (const sd of [-1, 1]) { const x0 = 960 + sd * 760, x1 = 960 + sd * 420; poly([[x0, 850], [x0 + sd * 90, 850], [x1 + sd * 90, 470], [x1, 470]], '#6d7399'); c.strokeStyle = '#2b2e55'; c.lineWidth = 16; line(x0 + sd * 100, 800, x1 + sd * 100, 420); }
    if (lit) { for (let i = 0; i < 4; i++) poly([[960, 430 + i * 90], [960 - 90 - i * 46, 620 + i * 90], [960 + 90 + i * 46, 620 + i * 90]], '#2f8a55'); for (let i = 0; i < 26; i++) { c.fillStyle = cols[(i + Math.floor(T * 4)) % 6]; ell(960 + (rnd(i * 3) - .5) * (120 + (i % 4) * 90), 560 + (i % 4) * 90 + rnd(i) * 50, 12); c.fill(); } c.fillStyle = YEL; ell(960, 420, 26); c.fill(); ink(6); c.stroke(); }
    else { box(740, 880, 440, 70, '#8f95bd', 34); c.fillStyle = '#7fb9e6'; ell(960, 890, 190, 26); c.fill(); ink(6); c.stroke(); box(935, 780, 50, 110, '#8f95bd', 10); }
    if (A.has('crowd')) for (let i = 0; i < 11; i++) { const x = 120 + i * 168, yy = 520 + (i % 3) * 30 + Math.sin(T * 2 + i) * 6; if (i % 3 === 1) shadeFig(x, yy, .5); else mannequin(x, yy + 60, .78, cols[i % 6]); }
    if (day) { box(1380, 760, 150, 120, '#f2c94c', 10); box(1400, 720, 30, 60, '#6b8fd6', 6); c.fillStyle = INK; ell(1410, 890, 18); c.fill(); ell(1500, 890, 18); c.fill(); }
    const r = { after() { if (A.has('speaker')) speakerIcon(960, 420, T, 1.6); if (K.t) hudClock(K.t, RED); if (A.has('crowd')) for (let i = 1; i < 11; i += 3) shadeFace(120 + i * 168, 520 + (i % 3) * 30 + Math.sin(T * 2 + i) * 6, .5); } };
    if (dark) { r.amb = NIGHT; r.lights = [{ x: 1500, y: 110, r: 800, c: 'rgba(110,130,250,.5)' }, { x: 960, y: 900, r0: 100, r: 800, c: 'rgba(150,155,235,.55)' }];
      if (A.has('lamp')) r.lights.push({ x: 1700, y: 880, r0: 40, r: 520, c: 'rgba(255,214,120,.95)' });
      if (A.has('run')) r.lights.push({ x: 960 + Math.sin(T * 7) * 500, y: 500 + Math.cos(T * 9) * 120, r0: 60, r: 380, c: 'rgba(255,240,200,.9)' }); }
    if (lit) r.tint = 'rgba(255,60,140,.10)';
    return r;
  },
  exit(A, K, u, d, T) {
    const day = A.has('day') || A.has('memorial') || A.has('reflect');
    if (A.has('memorial')) {
      c.fillStyle = '#e9e4d6'; c.fillRect(0, 0, W, H); box(260, 120, 1400, 760, '#b9824f', 20, 12); box(300, 160, 1320, 680, '#f6efdc', 8, 0); label('ЛУЧШИЕ СОТРУДНИКИ', 960, 220, { size: 70, fill: INK });
      for (let i = 0; i < 3; i++) { const x = 360 + i * 300; box(x, 300, 230, 290, '#fff', 8, 7); c.fillStyle = ['#ffd2a8', '#f3c69b', '#ffe0bd', '#eec39c'][i]; ell(x + 115, 420, 62); c.fill(); ink(6); c.stroke(); c.fillStyle = ['#6b8fd6', '#d66b8f', '#6bd69a', '#3d4f7a'][i]; c.fillRect(x + 40, 500, 150, 80); }
      box(1300, 290, 250, 430, '#111', 6, 0); box(1318, 308, 214, 300, '#d9d9d9', 0, 0); c.save(); c.beginPath(); c.rect(1318, 308, 214, 300); c.clip(); person({ kind: 'petr', emo: 'happy', x: 1425, y: 470, s: .52, T: 0 }); c.restore();
      label('Пётр Семёнович', 1425, 640, { size: 28, fam: 'Montserrat', weight: 900 }); label('пропал без вести', 1425, 678, { size: 24, fam: 'Montserrat', weight: 800, fill: '#bbb' }); label('12 лет назад', 1425, 708, { size: 24, fam: 'Montserrat', weight: 800, fill: '#bbb' });
      return {};
    }
    const g = c.createLinearGradient(0, 0, 0, 800); if (day) { g.addColorStop(0, '#8fd3ff'); g.addColorStop(1, '#f4fbff'); } else { g.addColorStop(0, '#070b24'); g.addColorStop(1, '#27357a'); } c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = day ? '#fff' : '#cfd6f5'; c.fillRect(0, 700, W, 400);
    for (let i = 0; i < 4; i++) { const x = 300 + i * 440; c.fillStyle = '#3a3f66'; c.fillRect(x, 300, 14, 420); box(x - 40, 280, 94, 30, '#3a3f66', 10, 0); if (!day) { const lg = c.createRadialGradient(x + 7, 320, 10, x + 7, 320, 260); lg.addColorStop(0, 'rgba(255,220,140,.6)'); lg.addColorStop(1, 'rgba(255,220,140,0)'); c.fillStyle = lg; c.fillRect(x - 260, 60, 520, 520); } }
    if (day) { c.fillStyle = '#fff3b0'; ell(1600, 160, 80); c.fill(); }
    snow(T, 90, 0, 860);
    if (A.has('figures')) for (const [x, ph] of [[820, 0], [1120, 1.2]]) { shadeFig(x, 250, .9); shadeArm(x, 250, .9, -1.2 + Math.sin(T * 2.2 + ph) * .5); }
    if (A.has('reflect')) { c.fillStyle = 'rgba(10,12,40,.82)'; c.fillRect(0, 0, W, H); box(1180, 300, 300, 200, '#0d1f1c', 10, 8); c.fillStyle = '#2a5e52'; c.fillRect(1196, 316, 268, 168); label('CAM 07', 1330, 400, { size: 40, fill: '#bfffe6' }); }
    c.fillStyle = 'rgba(180,215,255,.16)'; c.fillRect(0, 0, W, 900);
    ink(14); c.fillStyle = '#5a5f85'; c.fillRect(0, 0, W, 60); c.fillRect(0, 880, W, 200); line(0, 60, W, 60); line(0, 880, W, 880);
    for (const x of [0, 470, 950, 970, 1450, 1906]) { c.fillStyle = '#5a5f85'; c.fillRect(x, 60, 14, 820); } c.fillStyle = '#d7b45a'; rr(900, 440, 30, 130, 12); c.fill(); ink(6); c.stroke(); rr(990, 440, 30, 130, 12); c.fill(); c.stroke();
    if (A.has('knock')) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 8; for (let i = 0; i < 3; i++) { const p = (u * 1.2 + i / 3) % 1; c.globalAlpha = 1 - p; ell(700, 480, 40 + p * 200); c.stroke(); } c.globalAlpha = 1; }
    const r = { after() { if (A.has('figures')) for (const x of [820, 1120]) shadeFace(x, 250, .9); } };
    if (!day) { r.amb = '#3a3f85'; r.lights = [{ x: 960, y: 420, r: 900, c: 'rgba(150,165,255,.5)' }]; }
    return r;
  },
  security(A, K, u, d, T) {
    c.fillStyle = '#9aa3c9'; c.fillRect(0, 0, W, H); c.fillStyle = '#6c7399'; c.fillRect(0, 820, W, 260);
    const grid = (x0, y0, w, h, nx, ny) => { for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = x0 + i * (w + 16), y = y0 + j * (h + 16); box(x, y, w, h, '#101a2b', 8, 7); c.fillStyle = ['#1f4d45', '#243a66', '#3a2a5c'][(i + j) % 3]; c.fillRect(x + 8, y + 8, w - 16, h - 16); c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(x + 8, y + 8 + ((T * 40 + i * 30) % (h - 24)), w - 16, 6); } };
    if (A.has('cam_fitting')) {
      c.fillStyle = '#05080c'; c.fillRect(0, 0, W, H); const big = A.has('big'), X = big ? 110 : 310, Y = big ? 40 : 110, Wd = big ? 1700 : 1300, Hd = big ? 1000 : 780;
      box(X, Y, Wd, Hd, '#0c1512', 20, 14); c.save(); c.beginPath(); c.rect(X + 20, Y + 20, Wd - 40, Hd - 40); c.clip(); c.fillStyle = '#254c44'; c.fillRect(X, Y, Wd, Hd);
      c.fillStyle = '#1b3a35'; c.fillRect(X, Y + Hd * .72, Wd, Hd); for (let i = 0; i < 5; i++) { c.fillStyle = '#17302c'; c.fillRect(X + 40 + i * 90, Y, 60, Hd * .72); }
      c.save(); c.translate(X + Wd * .56, Y + Hd * .7); c.rotate(-1.35); c.scale(big ? 1.5 : 1.15, big ? 1.5 : 1.15); c.fillStyle = '#3d7a6b'; rr(-120, 120, 240, 420, 90); c.fill(); ell(0, 0, 150); c.fill(); c.fillStyle = '#16302b'; c.beginPath(); c.arc(0, 0, 150, PI, TAU); c.fill();
      if (A.has('wake')) { c.fillStyle = '#eafff6'; c.shadowColor = '#fff'; c.shadowBlur = 30; ell(-58, 10, 26, 30); c.fill(); ell(58, 10, 26, 30); c.fill(); c.shadowBlur = 0; c.fillStyle = '#05080c'; ell(-58, 10, 8); c.fill(); ell(58, 10, 8); c.fill(); } else { c.strokeStyle = '#16302b'; c.lineWidth = 9; line(-90, 10, -30, 10); line(30, 10, 90, 10); } c.restore();
      c.fillStyle = 'rgba(0,0,0,.18)'; for (let y = Y; y < Y + Hd; y += 8) c.fillRect(X, y, Wd, 3); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(X, Y + ((T * 120) % Hd), Wd, 30); c.restore();
      label('CAM 07 — ПРИМЕРОЧНАЯ', X + 60, Y + 70, { size: 44, fill: '#bfffe6', align: 'left' }); if (Math.floor(T * 2) % 2) { c.fillStyle = RED; ell(X + Wd - 190, Y + 70, 16); c.fill(); } label('REC', X + Wd - 60, Y + 72, { size: 44, fill: RED, align: 'right' });
      return {};
    }
    if (A.has('desk')) {
      box(1050, 240, 520, 340, '#101a2b', 14); c.fillStyle = '#1f4d45'; c.fillRect(1070, 260, 480, 300); box(1180, 300, 240, 220, '#fff7d6', 4, 5); c.strokeStyle = '#8a8fa8'; c.lineWidth = 4; for (let i = 0; i < 6; i++) line(1200, 336 + i * 30, 1400, 336 + i * 30); box(1280, 580, 60, 80, '#3b4066', 0);
      box(300, 660, 1500, 80, '#8a6a4f', 10); c.fillStyle = '#6f543e'; c.fillRect(340, 740, 1420, 340);
      box(560, 560, 110, 110, '#e9e4d6', 14); c.strokeStyle = INK; c.lineWidth = 10; c.beginPath(); c.arc(680, 610, 30, -PI / 2, PI / 2); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 9; for (let i = 0; i < 3; i++) { c.beginPath(); const x = 585 + i * 30; c.moveTo(x, 540); c.bezierCurveTo(x - 20, 500 - (T * 30 % 30), x + 20, 470, x, 420); c.stroke(); }
      c.save(); c.translate(300, 700); c.rotate(Math.sin(T * .8) * .5); box(-110, -230, 220, 260, '#3b4066', 30); c.restore(); box(280, 730, 40, 200, '#2b2e55', 0);
      box(820, 500, 30, 160, '#3b4066', 0); poly([[760, 500], [910, 500], [880, 420], [790, 420]], '#ffd84a');
      return { amb: '#3d4284', lights: [{ x: 835, y: 560, r0: 30, r: 760, c: 'rgba(255,214,120,.95)' }] };
    }
    grid(180, 120, 240, 150, 6, 3);
    if (A.has('clock')) { box(1560, 60, 0, 0, '#fff', 0, 0); c.fillStyle = '#fff'; ell(960, 480, 300); c.fill(); ink(16); c.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.lineWidth = 12; line(960 + Math.cos(a) * 250, 480 + Math.sin(a) * 250, 960 + Math.cos(a) * 280, 480 + Math.sin(a) * 280); } const ha = (3 + 29 / 60) / 12 * TAU - PI / 2, ma = 29 / 60 * TAU - PI / 2 + u * .002; c.lineWidth = 22; line(960, 480, 960 + Math.cos(ha) * 150, 480 + Math.sin(ha) * 150); c.lineWidth = 14; line(960, 480, 960 + Math.cos(ma) * 230, 480 + Math.sin(ma) * 230); c.strokeStyle = RED; c.lineWidth = 6; const sa = Math.floor(T) / 60 * TAU; line(960, 480, 960 + Math.cos(sa) * 240, 480 + Math.sin(sa) * 240); }
    const r = { amb: '#3a3f80', lights: [{ x: 960, y: 380, r: 1000, c: 'rgba(120,200,190,.45)' }, { x: 960, y: 900, r0: 100, r: 900, c: 'rgba(170,175,240,.5)' }] };
    if (A.has('key')) r.after = () => { c.save(); c.translate(960, 330); c.rotate(-.3 + Math.sin(T * 2) * .05); const p = eBack(seg(u, .1, .5)); c.scale(p, p); c.fillStyle = YEL; ink(10); ell(-150, 0, 70); c.fill(); c.stroke(); c.fillStyle = '#3a3f80'; ell(-150, 0, 28); c.fill(); c.stroke(); box(-90, -18, 300, 36, YEL, 8, 10); box(150, 18, 30, 50, YEL, 4, 10); box(90, 18, 30, 36, YEL, 4, 10); c.rotate(.5); box(-320, 60, 190, 90, '#f3e3c2', 10, 8); label('ЗАЛ 7', -225, 108, { size: 48, fill: INK }); c.restore(); };
    return r;
  },
  note(A, K, u, d, T) {
    c.fillStyle = '#20253f'; c.fillRect(0, 0, W, H); const n = +K.n || 0, ps = +K.ps || 0;
    c.save(); c.translate(960, 540); c.rotate(-.015); box(-640, -500, 1280, 1000, '#fbf6e2', 6, 10); c.strokeStyle = '#b9c6e6'; c.lineWidth = 3; for (let y = -400; y < 480; y += 62) line(-610, y, 610, y); c.strokeStyle = '#f0a0a0'; line(-520, -500, -520, 500);
    c.fillStyle = 'rgba(210,200,160,.6)'; c.fillRect(-120, -530, 240, 60);
    c.transform(1, 0, -.12, 1, 0, 0); const o = { fam: 'Montserrat', weight: 800, fill: '#232a5c', align: 'left' };
    label('ЕСЛИ ТЫ ЭТО ЧИТАЕШЬ —', -520, -400, { ...o, size: 58, weight: 900 }); label('ТЫ ОСТАЛСЯ НА НОЧЬ', -520, -330, { ...o, size: 58, weight: 900 }); c.strokeStyle = '#232a5c'; c.lineWidth = 5; line(-520, -292, 180, -292); line(-520, -280, 180, -280);
    const R = ['1. Манекены не двигаются, пока ты смотришь.', '2. Не заходи в лифт. Только эскалаторы.', '3. Назовут твоё имя по радио — не иди.', '4. Ничего не ешь на фудкорте.', '5. В 3:33 — в кинозал № 7. Жди звонка.'];
    for (let i = 0; i < n; i++) { const fresh = i === n - 1 && !ps ? eBack(seg(u, 0, .3)) : 1; c.save(); c.translate(-520, -190 + i * 104); c.scale(fresh, fresh); label(R[i], 0, 0, { ...o, size: 50, maxW: 1080, fill: i === n - 1 && !ps ? '#b3202c' : '#232a5c' }); c.restore(); }
    if (ps) { label('Звонок — это три коротких.', -520, 350, { ...o, size: ps === 2 ? 46 : 34 }); label('Длинный — не звонок.', -520, 410, { ...o, size: ps === 2 ? 46 : 34 }); if (ps === 2) { c.strokeStyle = RED; c.lineWidth = 8; c.beginPath(); c.ellipse(-140, 380, 430 * seg(u, 0, .6), 90, 0, 0, TAU); c.stroke(); } }
    c.restore(); return { amb: '#8a86a8', lights: [{ x: 900 + Math.sin(T) * 60, y: 500, r0: 150, r: 900, c: 'rgba(255,235,190,.9)' }] };
  },
  parking(A, K, u, d, T) {
    c.fillStyle = '#8f93a6'; c.fillRect(0, 0, W, H); c.fillStyle = '#6b6f82'; c.fillRect(0, 0, W, 170); c.fillStyle = '#787c90'; c.fillRect(0, 760, W, 320); ink(8); line(0, 170, W, 170); line(0, 760, W, 760);
    c.strokeStyle = '#f2f2f2'; c.lineWidth = 10; for (let i = 0; i < 9; i++) line(120 + i * 220, 780, 60 + i * 230, 1080);
    const lamps = [200, 580, 960, 1340, 1720], prog = A.has('lights') ? seg(u, 0, d) : 0, on = i => !(A.has('lights') && (4 - i) / 5 < prog);
    lamps.forEach((x, i) => { box(x - 90, 170, 180, 22, on(i) ? '#fff7d6' : '#55586b', 6, 6); });
    for (const x of [420, 1500]) { box(x - 70, 170, 140, 600, '#a9adc0', 0, 9); c.fillStyle = '#ffd84a'; for (let j = 0; j < 4; j++) poly([[x - 70, 640 + j * 32], [x + 70, 610 + j * 32], [x + 70, 626 + j * 32], [x - 70, 656 + j * 32]], j % 2 ? '#22243a' : '#ffd84a', 0); }
    label('−1', 420, 330, { size: 110, fill: '#2f6fe4' });
    if (A.has('loop')) { c.save(); c.translate(1500, 380); c.rotate(-.06); label('НЕ ТРАТЬ', 0, -30, { size: 30, fill: '#111', fam: 'Montserrat', weight: 900 }); label('ВРЕМЯ', 0, 14, { size: 30, fill: '#111', fam: 'Montserrat', weight: 900 }); c.restore(); }
    if (A.has('ramp')) { box(1100, 520, 26, 240, '#d9d9e6', 0); c.save(); c.translate(1113, 540); c.rotate(-.1); for (let i = 0; i < 9; i++) { c.fillStyle = i % 2 ? '#fff' : RED; c.fillRect(i * 70, -14, 70, 28); } ink(7); c.strokeRect(0, -14, 630, 28); c.restore(); }
    const r = { amb: '#2b2e55', lights: lamps.filter((x, i) => on(i)).map(x => ({ x, y: 190, r0: 40, r: 560, c: 'rgba(255,240,200,.75)' })) };
    if (A.has('car')) r.after = () => { const b = Math.floor(T * 4) % 2; for (let i = 0; i < 4; i++) { const x = 300 + i * 440, yy = 700 + (i % 2) * 40; c.fillStyle = (i + b) % 2 ? 'rgba(255,240,170,.95)' : 'rgba(255,170,60,.9)'; c.shadowColor = c.fillStyle; c.shadowBlur = 60; ell(x - 90, yy, 34, 22); c.fill(); ell(x + 90, yy, 34, 22); c.fill(); c.shadowBlur = 0; } };
    return r;
  },
  escalator(A, K, u, d, T) {
    c.fillStyle = '#c5c9e6'; c.fillRect(0, 0, W, H); c.fillStyle = '#9aa0c8'; c.fillRect(0, 0, W, 90); c.fillStyle = '#a9aed0'; c.fillRect(0, 940, W, 140);
    const mov = A.has('stopped') ? 0 : T * 60, x0 = 200, y0 = 930, x1 = 1720, y1 = 150, n = 26;
    poly([[x0, y0 + 60], [x1, y1 + 60], [x1, y1 + 220], [x0 + 200, y0 + 150], [x0, y0 + 150]], '#5d6390');
    c.save(); c.beginPath(); c.moveTo(x0, y0 + 60); c.lineTo(x1, y1 + 60); c.lineTo(x1, y1 - 400); c.lineTo(x0, y0 - 400); c.clip();
    for (let i = -1; i < n + 1; i++) { const p = (i + (mov % 60) / 60) / n, x = lerp(x0, x1, p), y = lerp(y0, y1, p); box(x, y + 20, (x1 - x0) / n + 2, 60, i % 2 ? '#8a90b8' : '#9ea4cc', 0, 5); } c.restore();
    c.strokeStyle = INK; c.lineWidth = 46; line(x0 - 20, y0 - 150, x1 + 20, y1 - 150); c.strokeStyle = '#2b2e55'; c.lineWidth = 30; line(x0 - 20, y0 - 150, x1 + 20, y1 - 150);
    c.fillStyle = 'rgba(170,205,255,.3)'; poly([[x0, y0 - 130], [x1, y1 - 130], [x1, y1 + 30], [x0, y0 + 30]], 'rgba(170,205,255,.3)', 6);
    if (A.has('endless')) { c.fillStyle = 'rgba(8,8,30,.75)'; poly([[x0, y0 + 200], [x0 + 700, y0 - 160], [x0, y0 - 500]], 'rgba(8,8,30,.8)', 0); }
    const r = { amb: '#34387a', lights: [{ x: 1100, y: 500, r0: 100, r: 1100, c: 'rgba(160,170,245,.6)' }] };
    if (A.has('run')) r.after = () => { for (let i = 0; i < 5; i++) { const x = 180 + i * 90; if (i % 2) { shadeFig(x, 720 + i * 14, .4); shadeFace(x, 720 + i * 14, .4); } else mannequin(x, 760 + i * 10, .6, '#7c5ba6'); } if (A.has('phone')) { c.save(); c.translate(1050, 640); c.rotate(.5); box(-50, -90, 100, 180, '#15151c', 14, 7); c.fillStyle = '#fff3d6'; c.fillRect(-40, -78, 80, 150); c.fillStyle = '#fbd9b9'; ell(-12, -10, 16); c.fill(); ell(16, -16, 20); c.fill(); c.restore(); } };
    return r;
  },
  clothes(A, K, u, d, T) {
    c.fillStyle = '#e6d9c8'; c.fillRect(0, 0, W, H); c.fillStyle = '#b89c7c'; c.fillRect(0, 860, W, 220); ink(8); line(0, 860, W, 860);
    if (A.has('shutter')) {
      c.fillStyle = '#3a2f55'; c.fillRect(200, 120, 1520, 760); box(200, 60, 1520, 90, '#c98bff', 10); label('МОДА', 960, 108, { size: 70 });
      for (let i = 0; i < 4; i++) mannequin(480 + i * 320, 420, .8, ['#7c5ba6', '#4f8a66', '#b2475f', '#3d6fa6'][i], .75);
      const cl = A.has('close'), h = cl ? 730 : 360, sh = A.has('knock') ? Math.sin(T * 40) * 5 * (Math.floor(T * 1.6) % 2) : 0;
      c.save(); c.translate(sh, 0); c.fillStyle = 'rgba(150,155,185,.92)'; c.fillRect(200, 150, 1520, h); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 5; for (let y = 170; y < 150 + h; y += 26) line(200, y, 1720, y); for (let x = 200; x <= 1720; x += 60) line(x, 150, x, 150 + h); ink(10); c.strokeRect(200, 150, 1520, h); c.restore();
      return { amb: '#363a7a', lights: [{ x: 960, y: 500, r: 1100, c: 'rgba(150,160,240,.55)' }] };
    }
    for (let i = 0; i < 3; i++) { const x = 250 + i * 620; box(x, 140, 420, 26, '#8a8fa8', 10); for (let j = 0; j < 6; j++) { const cx = x + 40 + j * 66; poly([[cx - 26, 170], [cx + 26, 170], [cx + 36, 430], [cx - 36, 430]], ['#b2475f', '#3d6fa6', '#4f8a66', '#d9a441', '#7c5ba6', '#5a5f85'][(j + i) % 6], 6); } }
    box(1500, 560, 380, 300, '#8a6a4f', 10); box(1560, 480, 120, 80, '#ffd84a', 8); box(1700, 500, 90, 60, RED, 8);
    const st = +K.stage || (A.has('mirror') ? 2 : 0), pos = [[620, 300, .62], [860, 280, .6], [1080, 310, .62], [1290, 290, .6], [760, 330, .64], [1180, 340, .64]];
    const near = [[560, 360, 1.0], [900, 330, .95], [1130, 370, 1.0], [1380, 340, .95], [720, 420, 1.1], [1260, 430, 1.1]];
    if (!A.has('mirror')) pos.forEach(([x, y, s], i) => { let p = pos[i]; if (st >= 2 || (st === 1 && i === 4)) p = near[i]; mannequin(p[0], p[1], p[2] * 1.15, ['#7c5ba6', '#4f8a66', '#b2475f', '#3d6fa6', '#d9a441', '#5a5f85'][i]); });
    else { box(520, 100, 880, 780, '#b9824f', 20, 12); c.save(); c.beginPath(); c.rect(560, 140, 800, 700); c.clip(); c.fillStyle = '#cfe0ea'; c.fillRect(560, 140, 800, 700); pos.forEach(([x, y, s], i) => mannequin(600 + i * 130, 420 + (i % 2) * 40, .62, ['#7c5ba6', '#4f8a66', '#b2475f', '#3d6fa6', '#d9a441', '#5a5f85'][i])); c.fillStyle = 'rgba(255,255,255,.35)'; poly([[600, 140], [760, 140], [640, 840], [560, 840]], 'rgba(255,255,255,.3)', 0); c.restore(); }
    return { amb: '#3a3e80', lights: [{ x: 960, y: 480, r0: 100, r: 1100, c: 'rgba(165,170,245,.6)' }, { x: 1620, y: 520, r: 300, c: 'rgba(255,220,140,.5)' }] };
  },
  elevator(A, K, u, d, T) {
    c.fillStyle = '#c5c9e6'; c.fillRect(0, 0, W, H); c.fillStyle = '#a9aed0'; c.fillRect(0, 900, W, 180); ink(8); line(0, 900, W, 900);
    let op = A.has('open') ? 1 : A.has('closing') ? 1 - .7 * seg(u, 0, d) : 0;
    box(560, 120, 800, 790, '#6d7399', 10, 12);
    c.save(); c.beginPath(); c.rect(600, 160, 720, 750); c.clip(); const g = c.createLinearGradient(0, 160, 0, 910); g.addColorStop(0, '#fff1c9'); g.addColorStop(1, '#e8b36b'); c.fillStyle = g; c.fillRect(600, 160, 720, 750); c.fillStyle = '#b9824f'; c.fillRect(600, 560, 720, 20); c.fillStyle = '#fff'; c.fillRect(760, 170, 400, 16);
    c.restore();
    r_el = { amb: '#383c7e', lights: [{ x: 960, y: 520, r0: 100, r: 300 + 700 * op, c: `rgba(255,225,160,${.2 + .75 * op})` }], doors: op };
    box(1400, 420, 70, 130, '#3b4066', 10); c.fillStyle = op ? YEL : '#8a8fa8'; poly([[1435, 440], [1455, 470], [1415, 470]], op ? YEL : '#8a8fa8', 0); poly([[1435, 530], [1455, 500], [1415, 500]], '#8a8fa8', 0);
    box(860, 50, 200, 64, '#15172e', 10); label(op ? '2' : '—', 960, 84, { size: 46, fill: RED });
    return Object.assign(r_el, { front() { const w = 360 * (1 - op); c.fillStyle = '#9ea4cc'; c.fillRect(600, 160, w, 750); c.fillRect(1320 - w, 160, w, 750); ink(8); if (w > 4) { c.strokeRect(600, 160, w, 750); c.strokeRect(1320 - w, 160, w, 750); } } });
  },
  foodcourt(A, K, u, d, T) {
    const dark = A.has('dark');
    c.fillStyle = '#ffe2b0'; c.fillRect(0, 0, W, H); c.fillStyle = '#e9b87a'; c.fillRect(0, 880, W, 200);
    if (A.has('tray') || A.has('flat')) {
      c.fillStyle = '#c64f4f'; c.fillRect(0, 700, W, 380); const flat = A.has('flat');
      c.save(); c.translate(960, 620); box(-560, -40, 1120, 260, '#8a8fa8', 40, 12);
      if (flat) { box(-330, -330, 660, 420, '#fff', 10, 10); poly([[0, -280], [250, 40], [-250, 40]], '#f2c94c', 8); for (const [x, y] of [[-40, -120], [60, -40], [-90, -10], [10, -200]]) { c.fillStyle = '#d63a3a'; ell(x, y, 30); c.fill(); ink(6); c.stroke(); } label('ПИЦЦА 0 ₽', 0, 70, { size: 40, fill: INK }); c.strokeStyle = '#8a8a96'; c.lineWidth = 6; for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(-200 + i * 66, -300); c.bezierCurveTo(-260 + i * 40, -500, -500 - i * 10, -500 + Math.sin(T * 2 + i) * 30, -900, -420 + i * 30); c.stroke(); } }
      else { c.fillStyle = '#e9a23b'; ell(0, 30, 330, 90); c.fill(); ink(10); c.stroke(); c.fillStyle = '#f7d774'; ell(0, 16, 290, 72); c.fill(); for (const [x, y] of [[-120, 0], [40, 30], [150, -10], [-30, -24], [-200, 30]]) { c.fillStyle = '#d63a3a'; ell(x, y, 34, 16); c.fill(); ink(5); c.stroke(); } c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 12; for (let i = 0; i < 4; i++) { c.beginPath(); const x = -150 + i * 100; c.moveTo(x, -70); c.bezierCurveTo(x - 40, -160 - (T * 40 % 40), x + 40, -220, x, -320); c.stroke(); } }
      c.restore(); return flat ? { amb: '#8a84a8', lights: [{ x: 960, y: 520, r0: 100, r: 800, c: 'rgba(255,240,220,.6)' }] } : {};
    }
    for (let i = 0; i < 3; i++) { const x = 120 + i * 600; box(x, 260, 500, 620, ['#d63a3a', '#3d8a5f', '#3d6fa6'][i], 16); box(x + 30, 330, 440, 300, dark ? '#20233f' : '#fff7e0', 10); box(x, 660, 500, 60, '#f3e3c2', 0); }
    c.save(); c.translate(370, 160); c.rotate(Math.sin(T * 1.5) * .2); c.fillStyle = '#f2c94c'; ell(0, 0, 120); c.fill(); ink(10); c.stroke(); for (const [x, y] of [[-40, -30], [40, 20], [-10, 50], [30, -50]]) { c.fillStyle = '#d63a3a'; ell(x, y, 22); c.fill(); } c.restore();
    label('ПИЦЦА', 370, 300, { size: 54, fill: '#fff', stroke: INK, sw: 12 }); label('БУРГЕРЫ', 970, 300, { size: 54, fill: '#fff', stroke: INK, sw: 12 }); label('СУШИ', 1570, 300, { size: 54, fill: '#fff', stroke: INK, sw: 12 });
    for (let i = 0; i < 4; i++) { const x = 300 + i * 440; box(x - 110, 930, 220, 26, '#8a6a4f', 10); box(x - 12, 950, 24, 130, '#6f543e', 0); }
    return dark ? { amb: '#23264f', lights: [] } : { tint: 'rgba(255,120,60,.08)' };
  },
  infodesk(A, K, u, d, T) {
    c.fillStyle = '#d6d9f2'; c.fillRect(0, 0, W, H); for (let i = 0; i < 6; i++) shutter(60 + i * 310, 180, 270, 300); c.fillStyle = '#b9bedc'; c.fillRect(0, 760, W, 320);
    c.fillStyle = '#2f6fe4'; ell(960, 230, 130); c.fill(); ink(12); c.stroke(); label('i', 960, 236, { size: 190 });
    const r = { amb: '#30346f', lights: [{ x: 960, y: 600, r0: 100, r: 1000, c: 'rgba(150,160,240,.6)' }], front() { box(160, 720, 1600, 400, '#5a5f9e', 30, 12); box(120, 690, 1680, 60, '#8f95cf', 20, 12); label('ИНФОРМАЦИЯ', 960, 900, { size: 120, fill: 'rgba(255,255,255,.35)' }); } };
    if (A.has('speaker')) { r.after = () => speakerIcon(960, 420, T, 2.2); r.charHide = true; }
    r.charY = 640; r.charS = .9; return r;
  },
  market(A, K, u, d, T) {
    c.fillStyle = '#cfe3ee'; c.fillRect(0, 0, W, H); c.fillStyle = '#a9c0cf'; c.fillRect(0, 860, W, 220); ink(8); line(0, 860, W, 860); c.fillStyle = '#e9f4fa'; for (let i = 0; i < 5; i++) c.fillRect(140 + i * 380, 40, 220, 26);
    const shelf = (x, y, w, h, seed) => { box(x, y, w, h, '#e9ecf5', 6, 8); for (let j = 0; j < 4; j++) { const yy = y + 20 + j * (h - 20) / 4; ink(6); line(x, yy + (h - 20) / 4 - 14, x + w, yy + (h - 20) / 4 - 14); for (let i = 0; i < Math.floor(w / 62); i++) { c.fillStyle = ['#ff7b6b', '#6bd6ff', '#ffd84a', '#8be08a', '#c98bff', '#f3a55c'][Math.floor(rnd(seed + i * 3 + j * 7) * 6)]; rr(x + 12 + i * 62, yy + 6, 46, (h - 20) / 4 - 24, 8); c.fill(); ink(5); c.stroke(); } } };
    if (A.has('checkout')) { c.fillStyle = '#0c1028'; c.fillRect(0, 0, W, H); box(560, 100, 800, 760, '#3b4066', 30, 12); box(620, 160, 680, 420, '#eaf6ff', 16, 8); label('НЕИЗВЕСТНЫЙ ТОВАР', 960, 280, { size: 52, fill: RED, fam: 'Montserrat', weight: 900 }); label('ОСТАВАЙТЕСЬ НА МЕСТЕ', 960, 370, { size: 44, fill: INK, fam: 'Montserrat', weight: 900 }); label('к вам уже идут' + '.'.repeat(1 + Math.floor(T * 2) % 3), 960, 470, { size: 40, fill: '#5a5f85', fam: 'Montserrat', weight: 800 }); box(700, 640, 520, 150, '#15172e', 14); c.fillStyle = RED; c.fillRect(720, 706 + Math.sin(T * 6) * 50, 480, 6); return { after() { const g = c.createRadialGradient(960, 370, 100, 960, 370, 900); g.addColorStop(0, 'rgba(180,220,255,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); } }; }
    if (A.has('tags')) { c.fillStyle = '#e9ecf5'; c.fillRect(0, 0, W, H); for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { const x = 140 + i * 580, y = 150 + j * 430; box(x, y, 480, 320, '#fff8c9', 14, 10); label('ТВОЁ ИМЯ', x + 240, y + 70, { size: 46, fill: INK, fam: 'Montserrat', weight: 900 }); label('3:33', x + 240, y + 200, { size: 150, fill: RED }); } return { amb: '#8f8fb5', lights: [{ x: 960, y: 540, r: 1100, c: 'rgba(200,220,255,.6)' }] }; }
    if (A.has('maze')) { shelf(-60, 200, 560, 660, 5); shelf(1420, 200, 560, 660, 9); shelf(620, 300, 680, 460, 13 + Math.floor(u / 2.5)); }
    else { poly([[0, 120], [620, 300], [620, 760], [0, 1000]], '#e9ecf5'); poly([[1920, 120], [1300, 300], [1300, 760], [1920, 1000]], '#e9ecf5'); for (let j = 0; j < 5; j++) { ink(6); line(0, 160 + j * 170, 620, 320 + j * 90); line(1920, 160 + j * 170, 1300, 320 + j * 90); for (let i = 0; i < 7; i++) { for (const sd of [0, 1]) { const p = i / 7, x = sd ? 1920 - p * 620 - 70 : p * 620 + 10, y = lerp(170 + j * 170, 326 + j * 90, p), s = lerp(1, .5, p); c.fillStyle = ['#ff7b6b', '#6bd6ff', '#ffd84a', '#8be08a', '#c98bff'][(i * 3 + j + sd) % 5]; rr(x, y, 60 * s, 110 * s, 6); c.fill(); ink(4); c.stroke(); } } } c.fillStyle = '#0c1028'; c.fillRect(620, 300, 680, 460); }
    const r = { amb: '#3b4a86', lights: [{ x: 960, y: 300, r: 1200, c: 'rgba(140,190,255,.55)' }] };
    if (A.has('cart')) r.front = () => { for (let i = 0; i < 3; i++) { const x = 1900 - ((u * 110 + i * 330) % 1500), y = 720 + i * 60; c.save(); c.translate(x, y); ink(9); c.fillStyle = 'rgba(200,205,225,.5)'; poly([[-110, -120], [120, -120], [90, 30], [-80, 30]], 'rgba(200,205,225,.55)'); for (let k = -3; k <= 4; k++) line(k * 28, -120, k * 24, 30); line(-110, -120, -160, -170); c.fillStyle = INK; ell(-60, 60, 18); c.fill(); ell(70, 60, 18); c.fill(); c.restore(); } };
    return r;
  },
  playroom(A, K, u, d, T) {
    c.fillStyle = '#bfe3ff'; c.fillRect(0, 0, W, H); const cols = ['#ff6b6b', '#ffd84a', '#6bd68a', '#6bb6ff', '#c98bff'];
    for (let i = 0; i < 12; i++) { c.fillStyle = cols[i % 5]; c.fillRect(i * 160, 800 + (i % 2) * 0, 160, 280); } ink(8); line(0, 800, W, 800);
    if (A.has('phone')) { c.fillStyle = '#ffe9c9'; c.fillRect(0, 620, W, 460); c.save(); c.translate(960 + Math.sin(T * 50) * 8, 520); c.rotate(Math.sin(T * 40) * .05); box(-170, -260, 340, 520, '#ff6fa3', 50, 12); box(-130, -210, 260, 200, '#fff', 20, 8); c.fillStyle = '#6bd68a'; ell(0, -110, 60); c.fill(); ink(6); c.stroke(); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { c.fillStyle = cols[(i + j) % 5]; ell(-80 + i * 80, 40 + j * 70, 26); c.fill(); c.stroke(); } c.restore(); c.strokeStyle = YEL; c.lineWidth = 10; for (let i = 0; i < 3; i++) { const p = (T * 2 + i / 3) % 1; c.globalAlpha = 1 - p; ell(960, 500, 300 + p * 260); c.stroke(); } c.globalAlpha = 1; return { amb: '#4a4f92', lights: [{ x: 960, y: 520, r0: 100, r: 800, c: 'rgba(255,220,240,.7)' }] }; }
    poly([[80, 800], [80, 300], [760, 300], [760, 800]], null, 0); for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) box(100 + i * 170, 300 + j * 165, 150, 150, cols[(i + j * 2) % 5], 16, 8); poly([[760, 460], [1100, 800], [980, 800], [760, 580]], '#ffd84a');
    const rise = A.has('rise') ? eIO(seg(u, 0, d)) : 0;
    box(1080, 640, 760, 220, '#6bb6ff', 40, 12); c.save(); c.beginPath(); c.rect(1090, 300, 740, 550); c.clip(); for (let i = 0; i < 90; i++) { const bx = 1110 + rnd(i * 2.3) * 700, by0 = 700 + rnd(i * 5.1) * 120, hump = Math.exp(-Math.pow((bx - 1460) / 170, 2)) * 330 * rise; c.fillStyle = cols[i % 5]; ell(bx, by0 - hump + Math.sin(T * 2 + i) * (A.has('balls') || rise ? 5 : 0), 30); c.fill(); ink(5); c.stroke(); } c.restore();
    for (const x of [300, 900, 1500]) { box(x, 820, 180, 60, RED, 10, 6); }
    const bear = A.has('bear');
    if (bear) { c.save(); c.translate(960, 480); c.fillStyle = '#b07a4a'; ink(12); ell(-150, -170, 70); c.fill(); c.stroke(); ell(150, -170, 70); c.fill(); c.stroke(); ell(0, 240, 230, 260); c.fill(); c.stroke(); ell(0, 0, 220); c.fill(); c.stroke(); c.fillStyle = '#e0b98a'; ell(0, 70, 100, 80); c.fill(); c.stroke(); c.fillStyle = INK; ell(0, 30, 30, 22); c.fill(); c.beginPath(); c.arc(0, 60, 56, PI * .1, PI * .9); c.stroke(); c.restore(); }
    return { amb: '#2e3270', lights: [{ x: 960, y: 500, r0: 100, r: 1000, c: 'rgba(150,160,245,.55)' }], after() { if (bear) { c.fillStyle = '#fff'; c.shadowColor = '#ff6'; c.shadowBlur = 50; ell(880, 440, 30); c.fill(); ell(1040, 440, 30); c.fill(); c.shadowBlur = 0; c.fillStyle = RED; ell(880, 440, 10); c.fill(); ell(1040, 440, 10); c.fill(); } } };
  },
  rink(A, K, u, d, T) {
    const g = c.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#080d2c'); g.addColorStop(1, '#1b2863'); c.fillStyle = g; c.fillRect(0, 0, W, 300); stars(30, T); c.fillStyle = '#fdf3c4'; ell(300, 120, 50); c.fill(); ink(8); for (let x = 0; x <= W; x += 240) line(x, 0, x, 300);
    c.fillStyle = '#c9cfee'; c.fillRect(0, 300, W, 200); for (let i = 0; i < 7; i++) shutter(30 + i * 270, 330, 230, 130); c.fillStyle = '#aab2d8'; c.fillRect(0, 500, W, 600); ink(8); line(0, 500, W, 500);
    if (A.has('under')) { c.fillStyle = '#d9f1ff'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 6; for (let i = 0; i < 9; i++) { c.beginPath(); c.moveTo(rnd(i) * W, 0); c.lineTo(rnd(i * 3) * W, H); c.stroke(); }
      for (let i = 0; i < 14; i++) { const x = 140 + (i % 7) * 270 + rnd(i) * 60, y = 280 + Math.floor(i / 7) * 400 + rnd(i * 4) * 80; c.save(); c.translate(x, y); c.rotate((rnd(i * 9) - .5) * .8); c.fillStyle = 'rgba(120,150,190,.55)'; ell(0, 0, 100, 120); c.fill(); c.strokeStyle = 'rgba(40,60,100,.7)'; c.lineWidth = 8; line(-56, -10, -20, -10); line(20, -10, 56, -10); c.beginPath(); c.arc(0, 60, 20, PI * 1.2, PI * 1.8); c.stroke(); c.restore(); } return { amb: '#5a6aa8', lights: [{ x: 960, y: 540, r: 1100, c: 'rgba(170,200,255,.6)' }] }; }
    c.fillStyle = '#eef8ff'; c.beginPath(); c.ellipse(960, 800, 900, 300, 0, 0, TAU); c.fill(); ink(14); c.strokeStyle = '#d63a3a'; c.stroke(); c.strokeStyle = 'rgba(120,170,220,.5)'; c.lineWidth = 5; for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(700 + rnd(i) * 500, 760 + rnd(i * 3) * 120, 80 + rnd(i * 7) * 120, 30 + rnd(i * 5) * 40, rnd(i) * 3, 0, TAU * .7); c.stroke(); }
    const r = { amb: '#343a80', lights: [{ x: 960, y: 760, r0: 150, r: 1000, c: 'rgba(190,210,255,.7)' }, { x: 300, y: 120, r: 600, c: 'rgba(120,140,255,.4)' }] };
    if (A.has('marks')) r.front = () => { c.strokeStyle = '#2f6fe4'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); const n = Math.floor(seg(u, 0, d) * 240); for (let i = 0; i < n; i++) { const a = i / 240 * TAU * 2.5, rx = 520 - i * .8, x = 960 + Math.cos(a) * rx, y = 800 + Math.sin(a) * rx * .3; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); };
    return r;
  },
  cinema(A, K, u, d, T) {
    if (A.has('corridor') || A.has('door')) {
      c.fillStyle = '#5a2340'; c.fillRect(0, 0, W, H); c.fillStyle = '#3d1830'; c.fillRect(0, 860, W, 220); c.fillStyle = '#c9a24a'; c.fillRect(0, 850, W, 14);
      const close = A.has('door'); const X = close ? 560 : 700, Wd = close ? 800 : 520, Y = close ? 60 : 220, Hd = close ? 1100 : 650;
      if (!close) for (const x of [140, 1400]) { box(x, 260, 380, 520, '#15172e', 8, 10); c.fillStyle = ['#d63a3a', '#3d6fa6'][x > 500 ? 1 : 0]; c.fillRect(x + 20, 280, 340, 480); label(x > 500 ? 'УЖАСЫ' : 'КОМЕДИЯ', x + 190, 700, { size: 50 }); }
      box(X, Y, Wd, Hd, '#8a1f33', 10, 12); line(X + Wd / 2, Y, X + Wd / 2, Y + Hd); c.fillStyle = '#d7b45a'; ell(X + Wd / 2 - 40, Y + Hd * .55, 20); c.fill(); ink(6); c.stroke(); ell(X + Wd / 2 + 40, Y + Hd * .55, 20); c.fill(); c.stroke();
      box(X + Wd / 2 - 130, Y - (close ? -40 : 110), 260, 90, '#15172e', 14); label('ЗАЛ 7', X + Wd / 2, Y - (close ? -86 : 64), { size: 60, fill: YEL });
      const r = { amb: '#3a2a5c', lights: [{ x: 960, y: 500, r0: 100, r: 1000, c: 'rgba(255,170,150,.5)' }] };
      if (A.has('hand')) r.after = () => { c.save(); c.translate(1130, 520); c.rotate(-.2); c.fillStyle = '#05060d'; ell(0, 40, 90, 100); c.fill(); for (let i = 0; i < 5; i++) { c.save(); c.rotate(-.7 + i * .35); rr(-22, -230 + (i === 0 || i === 4 ? 50 : 0), 44, 200, 22); c.fill(); c.restore(); } c.restore(); };
      return r;
    }
    c.fillStyle = '#1a0d1c'; c.fillRect(0, 0, W, H); const scr = K.screen;
    box(260, 60, 1400, 560, '#0c0c14', 10, 12); c.save(); c.beginPath(); c.rect(280, 80, 1360, 520); c.clip();
    if (scr && scr !== 'off') { c.fillStyle = '#254c44'; c.fillRect(280, 80, 1360, 520);
      if (scr === 'mall') { c.fillStyle = '#1b3a35'; c.fillRect(280, 420, 1360, 200); for (let i = 0; i < 12; i++) { c.fillStyle = '#0c1f1c'; const x = 340 + i * 110, y = 300 + (i % 3) * 30; ell(x, y, 28); c.fill(); c.fillRect(x - 26, y + 24, 52, 200); } }
      else { box(800, 120, 320, 480, '#16302b', 6, 8); label('ЗАЛ 7', 960, 180, { size: 44, fill: '#bfffe6' }); for (let i = 0; i < 9; i++) { const x = 380 + i * 140, y = 330 + (i % 2) * 40; c.fillStyle = '#0c1f1c'; ell(x, y, 46); c.fill(); c.fillRect(x - 44, y + 40, 88, 300); if (scr === 'turn') { c.fillStyle = '#eafff6'; ell(x - 16, y - 4, 8); c.fill(); ell(x + 16, y - 4, 8); c.fill(); } } }
      c.fillStyle = 'rgba(0,0,0,.2)'; for (let y = 80; y < 600; y += 8) c.fillRect(280, y, 1360, 3); if (Math.floor(T * 2) % 2) { c.fillStyle = RED; ell(1560, 130, 14); c.fill(); } }
    c.restore();
    const r = { amb: scr && scr !== 'off' ? '#4a5a7a' : '#4a3f7a', lights: [{ x: 960, y: 340, r0: 200, r: scr && scr !== 'off' ? 1300 : 1000, c: scr && scr !== 'off' ? 'rgba(160,230,210,.6)' : 'rgba(150,140,230,.5)' }, { x: 960, y: 700, r0: 150, r: 800, c: 'rgba(170,160,240,.45)' }], charY: 640, charS: .95 };
    r.back = () => { for (let j = 0; j < 2; j++) for (let i = 0; i < 11; i++) { const x = 60 + i * 180 + j * 90, y = 640 + j * 90; box(x - 70, y, 140, 500, '#8a1f33', 30, 9); } };
    r.front = () => { for (let i = 0; i < 9; i++) { const x = 100 + i * 220; box(x - 95, 900, 190, 300, '#a32840', 40, 10); } };
    return r;
  },
};
let r_el;
