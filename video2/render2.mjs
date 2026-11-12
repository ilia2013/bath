// Рендер длинного ролика в несколько потоков: node render2.mjs [потоков] -> out/video_silent.mp4
//   node render2.mjs --sheet 20  -> out/sheet_*.jpg (раскадровка: кадр каждые 20 с)
//   node render2.mjs --still 12.5,300 -> out/still_*.jpg
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, 'out'); mkdirSync(out, { recursive: true });
const args = process.argv.slice(2), url = pathToFileURL(path.join(here, 'index.html')).href + '?render=1';
const browser = await chromium.launch();
async function open() { const p = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 }); p.on('pageerror', e => console.error('PAGE ERROR:', e.message)); await p.goto(url); await p.evaluate(() => window.READY); return p; }
const page = await open(); const DUR = await page.evaluate(() => FILM.DUR), FPS = 30;
if (args[0] === '--sheet' || args[0] === '--still') {
  const times = []; if (args[0] === '--still') times.push(...args[1].split(',').map(Number)); else for (let t = 1; t < DUR; t += Number(args[1] || 20)) times.push(t);
  const per = args[0] === '--still' ? 1 : 12;
  for (let s = 0; s * per < times.length; s++) {
    const chunk = times.slice(s * per, s * per + per);
    const b64 = await page.evaluate(([chunk, per]) => { const cw = per === 1 ? 1920 : 480, chh = per === 1 ? 1080 : 270, cols = per === 1 ? 1 : 4; const o = document.createElement('canvas'); o.width = cols * cw; o.height = Math.ceil(chunk.length / cols) * chh; const g = o.getContext('2d');
      chunk.forEach((t, i) => { FILM.renderFrame(t); const x = (i % cols) * cw, y = Math.floor(i / cols) * chh; g.drawImage(document.getElementById('c'), x, y, cw, chh); if (per > 1) { g.fillStyle = '#0f0'; g.font = '20px monospace'; g.fillText(Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'), x + 6, y + 22); } });
      return o.toDataURL('image/jpeg', .85).split(',')[1]; }, [chunk, per]);
    writeFileSync(path.join(out, (per === 1 ? `still_${chunk[0]}` : `sheet_${String(s).padStart(2, '0')}`) + '.jpg'), Buffer.from(b64, 'base64'));
  }
} else {
  const N = Math.round(DUR * FPS), J = Number(args[0] || 4), t0 = Date.now(); let done = 0;
  await Promise.all([...Array(J).keys()].map(async j => {
    const p = j ? await open() : page, a = Math.floor(N * j / J), b = Math.floor(N * (j + 1) / J);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '25', '-g', '90', '-pix_fmt', 'yuv420p', path.join(out, `part_${j}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const buf = Buffer.from(await p.evaluate(t => { FILM.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', .93).split(',')[1]; }, f / FPS), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 1500 === 0) console.log(`кадров ${done}/${N}  ${((Date.now() - t0) / 60000).toFixed(1)} мин`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }));
  writeFileSync(path.join(out, 'parts.txt'), [...Array(J).keys()].map(j => `file 'part_${j}.mp4'`).join('\n'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(out, 'parts.txt'), '-c', 'copy', '-movflags', '+faststart', path.join(out, 'video_silent.mp4')]);
  console.log('готово:', N, 'кадров');
}
await browser.close();
