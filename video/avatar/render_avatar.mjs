// node avatar/render_avatar.mjs -> avatar/ava_<вариант>.png (800x800) + avatar/preview.png (как в кружке YouTube)
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
await page.goto(pathToFileURL(path.join(here, 'index.html')).href);
const names = await page.evaluate(() => AVATAR_NAMES);
for (const n of names) {
  const b64 = await page.evaluate(n => {
    drawAvatar(n);
    const o = document.createElement('canvas'); o.width = o.height = 800;
    o.getContext('2d').drawImage(document.getElementById('c'), 0, 0, 1080, 1080, 0, 0, 800, 800);
    return o.toDataURL('image/png').split(',')[1];
  }, n);
  writeFileSync(path.join(here, `ava_${n}.png`), Buffer.from(b64, 'base64'));
}
// превью: все варианты кружками, большой и маленький размер, на светлом и тёмном фоне
const prev = await page.evaluate(names => {
  const o = document.createElement('canvas'); o.width = 1500; o.height = 760; const g = o.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 1500, 380); g.fillStyle = '#0f0f0f'; g.fillRect(0, 380, 1500, 380);
  names.forEach((n, i) => {
    drawAvatar(n); const src = document.getElementById('c');
    for (const [y, big] of [[40, 1], [420, 1]]) {
      const x = 40 + i * 490;
      g.save(); g.beginPath(); g.arc(x + 150, y + 150, 150, 0, 7); g.clip(); g.drawImage(src, 0, 0, 1080, 1080, x, y, 300, 300); g.restore();
      g.save(); g.beginPath(); g.arc(x + 380, y + 250, 40, 0, 7); g.clip(); g.drawImage(src, 0, 0, 1080, 1080, x + 340, y + 210, 80, 80); g.restore();
    }
  });
  return o.toDataURL('image/png').split(',')[1];
}, names);
writeFileSync(path.join(here, 'preview.png'), Buffer.from(prev, 'base64'));
console.log('готово:', names.join(', '));
await browser.close();
