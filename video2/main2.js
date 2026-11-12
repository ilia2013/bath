'use strict';
/* Сборка кадра: сцена + персонажи + свет + субтитры. */
const TL = window.TIMELINE;
const SPK = { N: [null, null, '#fff'], A: ['anya', 'АНЯ', '#c9a8ff'], P: ['petr', 'ПЁТР СЕМЁНОВИЧ', '#9fc0ff'], R: [null, 'ГОЛОС ИЗ ДИНАМИКОВ', '#ffe9a3'], K: ['cashier', 'КАССИРША', '#ff9a9a'], D: ['double', '???', '#ff6b6b'] };
function findLast(arr, T) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].t0 <= T) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
for (const l of TL.lines) {           // субтитры: куски по ≤8 слов, время — пропорционально длине
  const words = l.text.split(' '), chunks = [[]];
  for (const w of words) { const cur = chunks[chunks.length - 1]; cur.push(w); if ((cur.length >= 8) || (cur.length >= 4 && /[.!?…—:,]$/.test(w))) chunks.push([]); }
  if (!chunks[chunks.length - 1].length) chunks.pop();
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 2) { const last = chunks.pop(); chunks[chunks.length - 1].push(...last); }
  const wt = words.map(w => w.length + 2), tot = wt.reduce((a, b) => a + b, 0); let acc = 0, wi = 0;
  l.chunks = chunks.map(ch => ({ words: ch.map(w => { const o = { w, t: l.t0 + acc / tot * l.d }; acc += wt[wi++]; return o; }) }));
  l.chunks.forEach((ch, i) => { ch.t0 = ch.words[0].t; ch.t1 = i + 1 < l.chunks.length ? l.chunks[i + 1].words[0].t : l.t0 + l.d + .25; });
}
function caption(l, T) {
  const ch = l.chunks.find(q => T >= q.t0 && T < q.t1); if (!ch) return;
  const SZ = 60, LH = 76; fnt(SZ, 'Montserrat', 900); c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const sp = c.measureText(' ').width, rows = [[]]; let lw = 0;
  for (const o of ch.words) { const ww = c.measureText(o.w).width; if (lw + ww > 1620 && rows[rows.length - 1].length) { rows.push([]); lw = 0; } rows[rows.length - 1].push({ ...o, ww }); lw += ww + sp; }
  const y0 = 1010 - (rows.length - 1) * LH, pos = [];
  rows.forEach((r, i) => { const tw = r.reduce((s, o) => s + o.ww, 0) + sp * (r.length - 1); let x = W / 2 - tw / 2; for (const o of r) { pos.push({ ...o, x, y: y0 + i * LH }); x += o.ww + sp; } });
  const name = SPK[l.sp][1];
  if (name) { fnt(34, 'Russo One'); const nw = c.measureText(name).width + 44; c.fillStyle = 'rgba(8,9,24,.85)'; rr(W / 2 - nw / 2, y0 - 96, nw, 52, 16); c.fill(); label(name, W / 2, y0 - 68, { size: 34, fill: SPK[l.sp][2] }); fnt(SZ, 'Montserrat', 900); c.textAlign = 'left'; }
  c.strokeStyle = '#0b0a1a'; c.lineWidth = 18; for (const o of pos) c.strokeText(o.w, o.x, o.y + 4);
  let cur = 0; pos.forEach((o, i) => { if (T >= o.t) cur = i; });
  pos.forEach((o, i) => { c.fillStyle = i === cur ? YEL : (l.sp === 'N' ? '#fff' : SPK[l.sp][2]); c.fillText(o.w, o.x, o.y); });
}
const SHAKE = { sting: [16, .45], crash: [28, .5], boom: [24, .6], thud: [16, .35], grab: [18, .35], blast: [24, .6], wake: [8, .4], click: [5, .2], ding: [4, .2] };
function renderFrame(T) {
  T = clamp(T, 0, TL.dur - 1e-3);
  const sh = TL.shots[Math.max(0, findLast(TL.shots, T))], u = T - sh.t0, d = sh.d, A = new Set(sh.A), K = sh.K, fx = new Set(sh.fx);
  const li = findLast(TL.lines, T), line0 = li >= 0 && T < TL.lines[li].t0 + TL.lines[li].d + .25 ? TL.lines[li] : null;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  let sx = 0, sy = 0; const f = Math.floor(T * FPS);
  for (const n of sh.fx) if (SHAKE[n]) { const k = clamp(1 - u / SHAKE[n][1]); sx += (rnd(f * 3.1) - .5) * 2 * SHAKE[n][0] * k; sy += (rnd(f * 7.7) - .5) * 2 * SHAKE[n][0] * k; }
  if (fx.has('alarm') || fx.has('rumble')) { sx += (rnd(f * 1.7) - .5) * 9; sy += (rnd(f * 5.3) - .5) * 9; }
  if (fx.has('run')) { sy += Math.sin(T * 14) * 9; sx += Math.sin(T * 7) * 5; }
  for (const n of ['knock', 'knockback']) if (fx.has(n)) for (const t0 of (n === 'knock' ? [.3, .75, 1.2] : [1.2, 1.65, 2.1])) { const k = clamp(1 - (u - t0) / .25); if (u >= t0 && k > 0) { sx += (rnd(f * 2.3) - .5) * 24 * k; sy += (rnd(f * 4.1) - .5) * 24 * k; } }
  const z = 1.03 + .035 * (sh.i % 2 ? u / d : 1 - u / d) + .04 * (1 - eOut(seg(u, 0, .22)));
  c.save(); c.translate(W / 2 + sx, H / 2 + sy); c.scale(z, z); c.translate(-W / 2, -H / 2);
  const r = (SC[sh.scene] || SC.black)(A, K, u, d, T) || {};
  if (r.back) r.back();
  const n = sh.chars.length, S = r.charS || (n >= 3 ? 1.0 : 1.15), Y = r.charY || 610;
  const draw = ch => { const talk = line0 && SPK[line0.sp][0] === ch.who && T < line0.t0 + line0.d ? (line0.env[Math.floor((T - line0.t0) * 30)] || 0) : 0; const others = sh.chars.filter(q => q !== ch); const lookX = others.length ? Math.sign(others[0].x - ch.x) * .7 : 0;
    person({ kind: ch.who, emo: ch.emo, x: ch.x * W, y: Y + (ch.emo === 'sleep' ? 60 : 0), s: S, talk, T, look: EMO[ch.emo] && EMO[ch.emo].look ? null : [lookX, 0], tilt: ch.emo === 'sleep' ? .25 : 0 }); };
  if (!r.charHide) {
    if (sh.scene === 'elevator') { sh.chars.filter(q => q.who === 'double').forEach(draw); r.front(); sh.chars.filter(q => q.who !== 'double').forEach(draw); }
    else { sh.chars.forEach(draw); if (r.front) r.front(); }
  } else if (r.front) r.front();
  if (r.amb) { let amb = r.amb; lightmap(amb, r.lights || [], r.extra); }
  if (r.tint) { c.fillStyle = r.tint; c.fillRect(-50, -50, W + 100, H + 100); }
  if (r.after) r.after();
  c.restore();
  if (fx.has('flicker') && rnd(Math.floor(T * 14)) > .6) { c.fillStyle = 'rgba(0,0,10,.55)'; c.fillRect(0, 0, W, H); }
  if (fx.has('lightsout')) { c.fillStyle = `rgba(255,240,200,${.5 * (1 - seg(u, 0, .35))})`; c.fillRect(0, 0, W, H); }
  if (fx.has('blast')) { c.fillStyle = `rgba(255,255,255,${1 - seg(u, 0, .5)})`; c.fillRect(0, 0, W, H); }
  if (fx.has('wake')) { c.fillStyle = `rgba(0,0,0,${1 - seg(u, 0, 1.2)})`; c.fillRect(0, 0, W, H); }
  const vg = c.createRadialGradient(960, 540, 560, 960, 540, 1150); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  if (line0) caption(line0, T);
}
window.FILM = { W, H, FPS, DUR: TL.dur, renderFrame };
