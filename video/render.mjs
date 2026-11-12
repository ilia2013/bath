// Рендер мультика: Chromium (Playwright) рисует кадры, ffmpeg собирает mp4.
//   node render.mjs                -> out/video_silent.mp4 + out/events.json
//   node render.mjs --still 3.2,10 -> out/still_*.png (проверочные кадры)
//   node render.mjs --sheet        -> out/sheet_*.jpg (раскадровка)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'out'); mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', e => { console.error('PAGE ERROR:', e.message); });
await page.goto(pathToFileURL(path.join(here, 'index.html')).href + '?render=1');
await page.evaluate(() => window.READY);
const info = await page.evaluate(() => ({ DUR: FILM.DUR, FPS: FILM.FPS, EVENTS: FILM.EVENTS, SCENES: FILM.SCENES, VO: FILM.VO }));
writeFileSync(path.join(out, 'events.json'), JSON.stringify(info, null, 1));
const grab = (t, type = 'image/jpeg', q = 0.95) => page.evaluate(([t, type, q]) => { FILM.renderFrame(t); return document.getElementById('c').toDataURL(type, q).split(',')[1]; }, [t, type, q]);

if (args[0] === '--still') {
  for (const t of args[1].split(',').map(Number)) writeFileSync(path.join(out, `still_${t.toFixed(2)}.png`), Buffer.from(await grab(t, 'image/png'), 'base64'));
} else if (args[0] === '--sheet') {
  // раскадровка: по 10 кадров на лист (5x2), уменьшенных
  const step = Number(args[1] || 0.75), per = 10;
  const times = []; for (let t = 0.05; t < info.DUR; t += step) times.push(t);
  for (let s = 0; s * per < times.length; s++) {
    const chunk = times.slice(s * per, s * per + per);
    const b64 = await page.evaluate(async ([chunk]) => {
      const sh = document.createElement('canvas'); sh.width = 5 * 324; sh.height = 2 * 576; const g = sh.getContext('2d');
      g.fillStyle = '#222'; g.fillRect(0, 0, sh.width, sh.height);
      chunk.forEach((t, i) => { FILM.renderFrame(t); const x = (i % 5) * 324, y = Math.floor(i / 5) * 576; g.drawImage(document.getElementById('c'), x, y, 324, 576); g.fillStyle = '#0f0'; g.font = '22px monospace'; g.fillText(t.toFixed(2), x + 6, y + 24); });
      return sh.toDataURL('image/jpeg', 0.88).split(',')[1];
    }, [chunk]);
    writeFileSync(path.join(out, `sheet_${String(s).padStart(2, '0')}.jpg`), Buffer.from(b64, 'base64'));
  }
} else {
  const N = Math.round(info.DUR * info.FPS);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(info.FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, 'video_silent.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const buf = Buffer.from(await grab(f / info.FPS), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 150 === 0) console.log(`кадр ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}с`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('готово:', N, 'кадров');
}
await browser.close();
