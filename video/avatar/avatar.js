'use strict';
/* Авы для канала. Использует рисовалки из film.js (герой, «он», карта освещения).
   Рисуем в квадрат 1080x1080 в верхней части холста; render_avatar.mjs вырезает его и сохраняет 800x800. */
const S = 1080;
function bgNight(c1, c2) {
  const g = c.createRadialGradient(540, 470, 60, 540, 540, 820); g.addColorStop(0, c1); g.addColorStop(1, c2);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
}
function stars(n, seed) {
  for (let i = 0; i < n; i++) { const r = 2 + rnd(seed + i * 5.5) * 3; c.fillStyle = `rgba(255,255,255,${.35 + .5 * rnd(seed + i)})`; ell(rnd(seed + i * 1.1) * S, rnd(seed + i * 2.3) * S * .6, r, r); c.fill(); }
}
function rim(col) { // мягкая кайма по кругу, чтобы ава читалась на любом фоне
  const g = c.createRadialGradient(540, 540, 440, 540, 540, 560); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
  c.fillStyle = g; c.fillRect(0, 0, S, S);
}

const AVATARS = {
  // 1. Герой в страхе, за плечом — «он» со светящейся улыбкой
  behind() {
    bgNight('#3b3f8f', '#0a0b22'); stars(40, 3);
    c.fillStyle = '#fdf3c4'; ell(860, 210, 70, 70); c.fill();
    shadeFig(735, 330, 1.55, .16, '#04050b');
    hero({ x: 470, y: 600, s: 1.55, eyes: 'wide', brow: 'scared', mouth: 'small', look: [.95, -.15], sweat: 1, pupil: .8 });
    lightmap('#4a4f9a', [{ x: 470, y: 600, r0: 120, r: 640, c: 'rgba(190,195,255,.75)' }, { x: 860, y: 210, r: 380, c: 'rgba(120,130,220,.5)' }]);
    shadeFace(735, 330, 1.55, .16, 1, 1);
    rim('rgba(5,5,20,.55)');
  },
  // 2. Минимализм: только улыбка во тьме, красное свечение
  smile() {
    bgNight('#3a0b18', '#050309');
    const g = c.createRadialGradient(540, 560, 40, 540, 560, 520); g.addColorStop(0, 'rgba(255,40,70,.45)'); g.addColorStop(1, 'rgba(255,40,70,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    shadeFig(540, 520, 4.1, 0, '#030206');
    shadeFace(540, 520, 4.1, 0, 1, 1);
    rim('rgba(0,0,0,.6)');
  },
  // 3. Герой под одеялом, в темноте за ним — глаза
  blanket() {
    bgNight('#4a4fa0', '#0b0c26'); stars(30, 9);
    for (const [x, y, s] of [[200, 330, .9], [880, 300, 1.0], [150, 700, .7], [930, 690, .8]]) shadeFace(x, y, s, 0, .95, 0);
    ink(14); c.fillStyle = '#e0607c';
    c.beginPath(); c.moveTo(120, 1180); c.bezierCurveTo(170, 640, 330, 310, 540, 300); c.bezierCurveTo(750, 310, 910, 640, 960, 1180); c.closePath(); c.fill(); c.stroke();
    c.save(); c.clip(); c.fillStyle = '#ffc24a'; for (let i = 0; i < 22; i++) { ell(160 + rnd(i * 2.2) * 760, 380 + rnd(i * 6.1) * 700, 24, 24); c.fill(); } c.restore();
    c.fillStyle = '#121735'; ell(540, 600, 250, 222); c.fill(); c.stroke();
    c.save(); ell(540, 600, 244, 216); c.clip();
    hero({ x: 540, y: 640, s: 1.25, body: false, look: [-.8, -.1], eyes: 'wide', brow: 'scared', mouth: 'small', sweat: 1 });
    c.restore();
    ink(11); c.fillStyle = SKIN;
    for (const sd of [-1, 1]) { ell(540 + sd * 160, 800, 62, 50); c.fill(); c.stroke(); c.lineWidth = 8; line(540 + sd * 140, 780, 540 + sd * 142, 828); line(540 + sd * 176, 780, 540 + sd * 178, 828); c.lineWidth = 11; }
    lightmap('#3d4290', [{ x: 540, y: 620, r0: 100, r: 520, c: 'rgba(185,190,250,.8)' }]);
    for (const [x, y, s] of [[200, 330, .9], [880, 300, 1.0], [150, 700, .7], [930, 690, .8]]) shadeFace(x, y, s, 0, .95, 0);
    rim('rgba(5,5,20,.5)');
  },
};
window.drawAvatar = name => { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); AVATARS[name](); };
window.AVATAR_NAMES = Object.keys(AVATARS);
